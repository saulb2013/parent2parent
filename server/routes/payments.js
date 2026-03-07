const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const STITCH_TOKEN_URL = 'https://secure.stitch.money/connect/token';
const STITCH_API_URL = 'https://api.stitch.money/graphql';

// Build a JWT client assertion for Stitch OAuth2
function buildClientAssertion() {
  const clientId = process.env.STITCH_CLIENT_ID;
  const clientSecret = process.env.STITCH_CLIENT_SECRET;

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientId,
    sub: clientId,
    aud: STITCH_TOKEN_URL,
    iat: now,
    exp: now + 300, // 5 minutes
    jti: crypto.randomUUID(),
  };

  return jwt.sign(payload, clientSecret, { algorithm: 'HS256' });
}

// Get Stitch access token using client credentials + JWT assertion
async function getStitchToken() {
  const clientAssertion = buildClientAssertion();

  const res = await fetch(STITCH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.STITCH_CLIENT_ID,
      scope: 'client_paymentinitiationrequest',
      audience: 'https://secure.stitch.money/connect/token',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: clientAssertion,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stitch token error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

// Execute Stitch GraphQL query
async function stitchQuery(token, query, variables) {
  const res = await fetch(STITCH_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await res.json();
  if (data.errors) {
    console.error('Stitch GraphQL errors:', JSON.stringify(data.errors, null, 2));
    throw new Error(data.errors[0]?.message || 'Stitch API error');
  }
  return data.data;
}

// Initiate payment for an order
router.post('/initiate', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { orderId } = req.body;

    // Get order
    const { rows: orders } = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND buyer_id = $2',
      [orderId, req.user.id]
    );

    if (!orders.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Order is not pending payment' });
    }

    // Get listing title for reference
    const { rows: listings } = await pool.query(
      'SELECT title FROM listings WHERE id = $1',
      [order.listing_id]
    );

    const token = await getStitchToken();
    const clientUrl = process.env.CLIENT_URL || 'https://parent2parent.onrender.com';
    const nonce = crypto.randomBytes(16).toString('hex');

    // Amount in rands (order stores cents as integers — price is in cents)
    // Our DB stores price in cents (e.g. 15000 = R150.00)
    const amountInRands = (order.total_price / 100).toFixed(2);

    const mutation = `
      mutation CreatePaymentRequest(
        $amount: MoneyInput!,
        $payerReference: String!,
        $beneficiaryReference: String!,
        $externalReference: String,
        $merchant: String
      ) {
        clientPaymentInitiationRequestCreate(input: {
          amount: $amount,
          payerReference: $payerReference,
          beneficiaryReference: $beneficiaryReference,
          externalReference: $externalReference,
          merchant: $merchant
        }) {
          paymentInitiationRequest {
            id
            url
          }
        }
      }
    `;

    const variables = {
      amount: {
        quantity: amountInRands,
        currency: 'ZAR',
      },
      payerReference: `P2P-${order.id}`,
      beneficiaryReference: `Order #${order.id}`,
      externalReference: `order-${order.id}-${nonce}`,
      merchant: 'Parent2Parent',
    };

    const data = await stitchQuery(token, mutation, variables);
    const paymentRequest = data.clientPaymentInitiationRequestCreate?.paymentInitiationRequest;

    if (!paymentRequest?.url) {
      throw new Error('No payment URL returned from Stitch');
    }

    // Store Stitch payment ID on the order
    await pool.query(
      'UPDATE orders SET payment_reference = $1, updated_at = NOW() WHERE id = $2',
      [paymentRequest.id, order.id]
    );

    // Build redirect URL — Stitch will redirect here after payment
    const redirectUrl = `${clientUrl}/payment/return?orderId=${order.id}&paymentId=${paymentRequest.id}`;

    // The Stitch payment URL with redirect
    const paymentUrl = `${paymentRequest.url}?redirect_uri=${encodeURIComponent(redirectUrl)}`;

    res.json({ paymentUrl, paymentId: paymentRequest.id });
  } catch (err) {
    console.error('Payment initiation error:', err);
    res.status(500).json({ error: err.message || 'Failed to initiate payment' });
  }
});

// Check payment status
router.get('/status/:orderId', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows: orders } = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)',
      [req.params.orderId, req.user.id]
    );

    if (!orders.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    if (!order.payment_reference) {
      return res.json({ status: 'pending', paymentStatus: null });
    }

    // Query Stitch for payment status
    const token = await getStitchToken();

    const query = `
      query GetPaymentStatus($paymentRequestId: ID!) {
        node(id: $paymentRequestId) {
          ... on PaymentInitiationRequest {
            id
            state {
              __typename
              ... on PaymentInitiationRequestCompleted {
                date
                amount {
                  quantity
                  currency
                }
                payer {
                  ... on PaymentInitiationBankAccountPayer {
                    accountNumber
                    bankId
                  }
                }
              }
              ... on PaymentInitiationRequestCancelled {
                date
                reason
              }
              ... on PaymentInitiationRequestExpired {
                date
              }
            }
          }
        }
      }
    `;

    const data = await stitchQuery(token, query, { paymentRequestId: order.payment_reference });
    const paymentState = data.node?.state?.__typename;

    // Update order status based on payment state
    if (paymentState === 'PaymentInitiationRequestCompleted' && order.status === 'pending') {
      await pool.query(
        "UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1",
        [order.id]
      );
      // Mark listing as sold
      await pool.query(
        "UPDATE listings SET status = 'sold', updated_at = NOW() WHERE id = $1",
        [order.listing_id]
      );
      return res.json({ status: 'paid', paymentStatus: paymentState });
    }

    if (paymentState === 'PaymentInitiationRequestCancelled') {
      return res.json({ status: order.status, paymentStatus: 'cancelled' });
    }

    if (paymentState === 'PaymentInitiationRequestExpired') {
      return res.json({ status: order.status, paymentStatus: 'expired' });
    }

    res.json({ status: order.status, paymentStatus: paymentState || 'pending' });
  } catch (err) {
    console.error('Payment status error:', err);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// Webhook from Stitch (no auth — verified by Stitch signature)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Acknowledge immediately
    res.status(200).json({ received: true });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    console.log('[STITCH WEBHOOK]', JSON.stringify(body));

    // TODO: Verify webhook signature and update order status
  } catch (err) {
    console.error('Webhook error:', err);
  }
});

module.exports = router;
