const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const STITCH_BASE_URL = 'https://express.stitch.money/api/v1';

// Get Stitch Express access token
async function getStitchToken() {
  const res = await fetch(`${STITCH_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.STITCH_CLIENT_ID,
      clientSecret: process.env.STITCH_CLIENT_SECRET,
      scope: 'client_paymentrequest',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stitch token error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data?.accessToken || data.accessToken;
}

// Initiate payment for an order
router.post('/initiate', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { orderId } = req.body;

    // Get order + buyer info
    const { rows: orders } = await pool.query(
      `SELECT o.*, u.name as buyer_name, u.email as buyer_email, u.phone as buyer_phone_profile
       FROM orders o JOIN users u ON o.buyer_id = u.id
       WHERE o.id = $1 AND o.buyer_id = $2`,
      [orderId, req.user.id]
    );

    if (!orders.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Order is not pending payment' });
    }

    const token = await getStitchToken();

    // Stitch Express expects amount in cents (integer)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    const paymentBody = {
      amount: order.total_price,
      merchantReference: `P2P-Order-${order.id}`,
      expiresAt,
      payerName: order.buyer_name || 'Parent2Parent Buyer',
    };

    if (order.buyer_email) {
      paymentBody.payerEmailAddress = order.buyer_email;
    }

    const phone = order.buyer_phone || order.buyer_phone_profile;
    if (phone) {
      // Ensure E164 format
      let formatted = phone.replace(/[^0-9+]/g, '');
      if (formatted.startsWith('0')) formatted = '+27' + formatted.slice(1);
      if (!formatted.startsWith('+')) formatted = '+' + formatted;
      paymentBody.payerPhoneNumber = formatted;
    }

    const payRes = await fetch(`${STITCH_BASE_URL}/payment-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(paymentBody),
    });

    if (!payRes.ok) {
      const errText = await payRes.text();
      throw new Error(`Stitch payment error ${payRes.status}: ${errText}`);
    }

    const paymentRes = await payRes.json();
    console.log('[STITCH PAYMENT RESPONSE]', JSON.stringify(paymentRes));

    // Response may be nested in data
    const payment = paymentRes.data || paymentRes;

    if (!payment.link) {
      throw new Error('No payment link returned from Stitch: ' + JSON.stringify(paymentRes));
    }

    // Store Stitch payment ID on the order
    await pool.query(
      'UPDATE orders SET payment_reference = $1, updated_at = NOW() WHERE id = $2',
      [payment.id, order.id]
    );

    res.json({ paymentUrl: payment.link, paymentId: payment.id });
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

    // Query Stitch Express for payment status
    const token = await getStitchToken();

    const statusRes = await fetch(`${STITCH_BASE_URL}/payment-links/${order.payment_reference}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!statusRes.ok) {
      throw new Error(`Stitch status check failed: ${statusRes.status}`);
    }

    const statusData = await statusRes.json();
    const payment = statusData.data || statusData;
    const stitchStatus = payment.status; // PENDING, PAID, SETTLED, EXPIRED, CANCELLED

    // Update order status based on payment state
    if ((stitchStatus === 'PAID' || stitchStatus === 'SETTLED') && order.status === 'pending') {
      await pool.query(
        "UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1",
        [order.id]
      );
      await pool.query(
        "UPDATE listings SET status = 'sold', updated_at = NOW() WHERE id = $1",
        [order.listing_id]
      );
      return res.json({ status: 'paid', paymentStatus: stitchStatus });
    }

    if (stitchStatus === 'CANCELLED') {
      return res.json({ status: order.status, paymentStatus: 'cancelled' });
    }

    if (stitchStatus === 'EXPIRED') {
      return res.json({ status: order.status, paymentStatus: 'expired' });
    }

    res.json({ status: order.status, paymentStatus: stitchStatus || 'pending' });
  } catch (err) {
    console.error('Payment status error:', err);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// Webhook from Stitch
router.post('/webhook', express.json(), async (req, res) => {
  try {
    res.status(200).json({ received: true });
    console.log('[STITCH WEBHOOK]', JSON.stringify(req.body));
  } catch (err) {
    console.error('Webhook error:', err);
  }
});

module.exports = router;
