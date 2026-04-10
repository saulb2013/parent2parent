const express = require('express');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const { sendSellerNotification, sendBuyerConfirmation } = require('../utils/email');

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

// Ensure our redirect URL is registered with Stitch (called once on first payment)
let registeredRedirectUrl = null;

async function ensureRedirectUrl(token) {
  const clientUrl = process.env.CLIENT_URL || 'https://parent2parent.onrender.com';
  const returnUrl = `${clientUrl}/payment/return`;

  if (registeredRedirectUrl) return returnUrl;

  // Check existing redirect URLs
  const listRes = await fetch(`${STITCH_BASE_URL}/redirect-urls`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (listRes.ok) {
    const listData = await listRes.json();
    const urls = listData.data || listData;
    const existing = Array.isArray(urls) && urls.find(u => u.redirectUrl === returnUrl);
    if (existing) {
      registeredRedirectUrl = returnUrl;
      return returnUrl;
    }
  }

  // Register our redirect URL
  const regRes = await fetch(`${STITCH_BASE_URL}/redirect-urls`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ redirectUrl: returnUrl }),
  });

  if (!regRes.ok) {
    const errText = await regRes.text();
    console.error('Failed to register redirect URL:', errText);
    // Continue without redirect — better than failing the payment
    return null;
  }

  console.log('[STITCH] Registered redirect URL:', returnUrl);
  registeredRedirectUrl = returnUrl;
  return returnUrl;
}

// Mark an order as paid and run post-payment side effects (shipment, emails).
// Idempotent: if the order is already paid, this is a no-op.
// Used by both the polling status check and the Stitch webhook.
async function handleOrderPaid(pool, orderId) {
  const { rows: orders } = await pool.query(
    'SELECT * FROM orders WHERE id = $1',
    [orderId]
  );
  if (!orders.length) return { changed: false, reason: 'order_not_found' };

  const order = orders[0];
  if (order.status !== 'pending') {
    return { changed: false, reason: 'already_processed', order };
  }

  await pool.query(
    "UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1",
    [order.id]
  );
  await pool.query(
    "UPDATE listings SET status = 'sold', updated_at = NOW() WHERE id = $1",
    [order.listing_id]
  );

  // Auto-create TCG shipment for delivery orders
  if (order.delivery_method === 'delivery' && !order.shipment_id && process.env.TCG_API_KEY) {
    try {
      const TCG_BASE_URL = process.env.TCG_API_URL || 'https://api.shiplogic.com';
      const { rows: fullOrder } = await pool.query(
        `SELECT o.*, seller.name as seller_name, seller.phone as seller_phone,
          seller.email as seller_email, seller.city as seller_city, seller.province as seller_province, seller.street_address as seller_street_address, seller.postal_code as seller_postal_code,
          buyer.name as buyer_name, buyer.phone as buyer_phone_profile, buyer.email as buyer_email,
          l.title as listing_title
         FROM orders o
         JOIN users seller ON o.seller_id = seller.id
         JOIN users buyer ON o.buyer_id = buyer.id
         JOIN listings l ON o.listing_id = l.id
         WHERE o.id = $1`,
        [order.id]
      );
      const o = fullOrder[0];
      if (o) {
        const shipRes = await fetch(`${TCG_BASE_URL}/shipments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.TCG_API_KEY}`,
          },
          body: JSON.stringify({
            collection_address: {
              type: 'residential',
              street_address: o.seller_street_address || o.seller_city || '',
              local_area: o.seller_city || '',
              city: o.seller_city || '',
              zone: o.seller_province || '',
              country: 'ZA',
              code: o.seller_postal_code || '',
            },
            collection_contact: {
              name: o.seller_name,
              mobile_number: o.seller_phone || '',
              email: o.seller_email || '',
            },
            delivery_address: {
              type: 'residential',
              street_address: o.delivery_address || '',
              local_area: o.delivery_city || '',
              city: o.delivery_city || '',
              zone: o.delivery_province || '',
              country: 'ZA',
              code: o.delivery_postal_code || '',
            },
            delivery_contact: {
              name: o.buyer_name,
              mobile_number: o.buyer_phone || o.buyer_phone_profile || '',
              email: o.buyer_email || '',
            },
            parcels: [{ submitted_length_cm: 30, submitted_width_cm: 30, submitted_height_cm: 20, submitted_weight_kg: 5 }],
            special_instructions_collection: `Parent2Parent Order #${o.id} - ${o.listing_title}`,
            special_instructions_delivery: o.buyer_notes || '',
            declared_value: o.item_price / 100,
            service_level_code: o.service_level_code || 'ECO',
            mute_notifications: false,
          }),
        });
        if (shipRes.ok) {
          const shipData = await shipRes.json();
          const shipmentId = shipData.id || shipData.shipment_id;
          const trackingRef = shipData.tracking_reference || shipData.short_tracking_reference || '';
          await pool.query(
            'UPDATE orders SET shipment_id = $1, tracking_reference = $2, updated_at = NOW() WHERE id = $3',
            [String(shipmentId), trackingRef, order.id]
          );
          console.log(`[TCG] Shipment created for order #${order.id}: ${trackingRef}`);
        } else {
          console.error('[TCG] Failed to create shipment:', await shipRes.text());
        }
      }
    } catch (shipErr) {
      console.error('[TCG] Auto-shipment error:', shipErr.message);
    }
  }

  // Send email notifications (non-blocking)
  const clientUrl = process.env.CLIENT_URL || 'https://parent2parent.onrender.com';
  try {
    const { rows: emailOrder } = await pool.query(
      `SELECT o.*, seller.name as seller_name, seller.email as seller_email,
        buyer.name as buyer_name, buyer.email as buyer_email,
        l.title as listing_title
       FROM orders o
       JOIN users seller ON o.seller_id = seller.id
       JOIN users buyer ON o.buyer_id = buyer.id
       JOIN listings l ON o.listing_id = l.id
       WHERE o.id = $1`,
      [order.id]
    );
    const eo = emailOrder[0];
    if (eo) {
      sendSellerNotification({
        sellerEmail: eo.seller_email,
        sellerName: eo.seller_name,
        buyerName: eo.buyer_name,
        listingTitle: eo.listing_title,
        orderId: eo.id,
        totalPrice: eo.total_price,
        deliveryMethod: eo.delivery_method,
        deliveryCity: eo.delivery_city,
        clientUrl,
      }).then(() => console.log(`[EMAIL] Seller notified for order #${eo.id}`))
        .catch(err => console.error('[EMAIL] Seller notification failed:', err.message));

      sendBuyerConfirmation({
        buyerEmail: eo.buyer_email,
        buyerName: eo.buyer_name,
        sellerName: eo.seller_name,
        listingTitle: eo.listing_title,
        orderId: eo.id,
        totalPrice: eo.total_price,
        deliveryMethod: eo.delivery_method,
        clientUrl,
      }).then(() => console.log(`[EMAIL] Buyer confirmed for order #${eo.id}`))
        .catch(err => console.error('[EMAIL] Buyer confirmation failed:', err.message));
    }
  } catch (emailErr) {
    console.error('[EMAIL] Notification error:', emailErr.message);
  }

  return { changed: true, order };
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

    // Ensure redirect URL is registered
    const redirectUrl = await ensureRedirectUrl(token);

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

    // Response is nested in data.payment
    const payment = paymentRes.data?.payment || paymentRes.data || paymentRes;

    if (!payment.link) {
      throw new Error('No payment link returned from Stitch: ' + JSON.stringify(paymentRes));
    }

    // Store Stitch payment ID on the order
    await pool.query(
      'UPDATE orders SET payment_reference = $1, updated_at = NOW() WHERE id = $2',
      [payment.id, order.id]
    );

    // Append redirect URL with orderId so we can check status on return
    let paymentUrl = payment.link;
    if (redirectUrl) {
      const returnWithOrder = `${redirectUrl}?orderId=${order.id}`;
      paymentUrl = `${payment.link}?redirect_url=${encodeURIComponent(returnWithOrder)}`;
    }

    res.json({ paymentUrl, paymentId: payment.id });
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
    const payment = statusData.data?.payment || statusData.data || statusData;
    const stitchStatus = payment.status; // PENDING, PAID, SETTLED, EXPIRED, CANCELLED

    // Update order status based on payment state
    if ((stitchStatus === 'PAID' || stitchStatus === 'SETTLED') && order.status === 'pending') {
      await handleOrderPaid(pool, order.id);
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

// Verify HMAC-SHA256 signature on a Stitch webhook request.
// Stitch returns a `secret` when the webhook is registered (POST /webhook).
// The secret is stored as STITCH_WEBHOOK_SECRET. The signature header name is
// not yet documented by Stitch — we look in the most likely places and accept
// either hex or base64 digests. Set STITCH_WEBHOOK_SKIP_VERIFY=true ONLY for
// initial sandbox debugging — never in production.
function verifyStitchSignature(req) {
  if (process.env.STITCH_WEBHOOK_SKIP_VERIFY === 'true') return true;

  const secret = process.env.STITCH_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[STITCH WEBHOOK] STITCH_WEBHOOK_SECRET is not set — refusing webhook');
    return false;
  }

  const provided =
    req.get('x-stitch-signature') ||
    req.get('stitch-signature') ||
    req.get('x-webhook-signature') ||
    req.get('x-signature');
  if (!provided) {
    console.error('[STITCH WEBHOOK] No signature header on request');
    return false;
  }

  const raw = req.rawBody;
  if (!raw) {
    console.error('[STITCH WEBHOOK] Raw body unavailable — cannot verify signature');
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret).update(raw);
  const hex = hmac.digest('hex');
  const b64 = crypto.createHmac('sha256', secret).update(raw).digest('base64');

  // Strip common prefixes (e.g. "sha256=...")
  const cleaned = provided.replace(/^sha256=/i, '').trim();

  const safeEqual = (a, b) => {
    try {
      const ab = Buffer.from(a);
      const bb = Buffer.from(b);
      return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
    } catch {
      return false;
    }
  };

  return safeEqual(cleaned, hex) || safeEqual(cleaned, b64);
}

// Webhook from Stitch
// Always responds 200 quickly so Stitch doesn't retry — failures are logged.
router.post('/webhook', async (req, res) => {
  // Acknowledge immediately; processing happens after.
  res.status(200).json({ received: true });

  try {
    if (!verifyStitchSignature(req)) {
      console.warn('[STITCH WEBHOOK] Signature verification failed; ignoring event');
      return;
    }

    const event = req.body || {};
    console.log('[STITCH WEBHOOK]', JSON.stringify(event));

    // Stitch's exact event shape isn't fully documented — extract defensively.
    const payload = event.data || event.payment || event;
    const eventType = (event.type || event.eventType || payload.eventType || '').toString().toLowerCase();
    const paymentStatus = (payload.status || event.status || '').toString().toUpperCase();
    const paymentRef = payload.id || payload.paymentId || payload.paymentLinkId || payload.reference || event.id;

    if (!paymentRef) {
      console.warn('[STITCH WEBHOOK] No payment reference in event payload');
      return;
    }

    const isPaid =
      paymentStatus === 'PAID' ||
      paymentStatus === 'SETTLED' ||
      eventType.includes('paid') ||
      eventType.includes('settled') ||
      eventType.includes('success');

    if (!isPaid) {
      console.log(`[STITCH WEBHOOK] Ignoring non-paid event (status=${paymentStatus}, type=${eventType})`);
      return;
    }

    const pool = req.app.get('db');
    const { rows } = await pool.query(
      'SELECT id FROM orders WHERE payment_reference = $1',
      [String(paymentRef)]
    );
    if (!rows.length) {
      console.warn(`[STITCH WEBHOOK] No order found for payment reference ${paymentRef}`);
      return;
    }

    const result = await handleOrderPaid(pool, rows[0].id);
    if (result.changed) {
      console.log(`[STITCH WEBHOOK] Order #${rows[0].id} marked paid via webhook`);
    } else {
      console.log(`[STITCH WEBHOOK] Order #${rows[0].id} already processed (${result.reason})`);
    }
  } catch (err) {
    console.error('[STITCH WEBHOOK] Processing error:', err);
  }
});

module.exports = router;
