const express = require('express');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const { sendSellerNotification, sendBuyerConfirmation, sendAdminAlert } = require('../utils/email');
const { parcelForShiplogic } = require('../utils/parcelSizes');

const router = express.Router();

const YOCO_BASE_URL = 'https://payments.yoco.com/api';

// Create a Yoco hosted checkout for an order. Stores the checkout id on the
// order so we can poll status and round-trip through the webhook later.
async function createYocoCheckout({ order, clientUrl }) {
  const returnUrl = `${clientUrl}/payment/return?orderId=${order.id}`;
  const res = await fetch(`${YOCO_BASE_URL}/checkouts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.YOCO_SECRET_KEY}`,
      'Idempotency-Key': `order-${order.id}-${Date.now()}`,
    },
    body: JSON.stringify({
      amount: order.total_price,
      currency: 'ZAR',
      successUrl: `${returnUrl}&status=success`,
      cancelUrl: `${returnUrl}&status=cancelled`,
      failureUrl: `${returnUrl}&status=failed`,
      metadata: {
        orderId: String(order.id),
        buyerId: String(order.buyer_id),
        sellerId: String(order.seller_id),
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Yoco checkout creation failed (${res.status}): ${errText}`);
  }
  return res.json();
}

// Fetch the latest status of a Yoco checkout.
async function getYocoCheckout(checkoutId) {
  const res = await fetch(`${YOCO_BASE_URL}/checkouts/${checkoutId}`, {
    headers: { 'Authorization': `Bearer ${process.env.YOCO_SECRET_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Yoco status check failed: ${res.status}`);
  }
  return res.json();
}

// Mark an order as paid and run post-payment side effects (shipment, emails).
// Idempotent: if the order is already paid, this is a no-op. Used by both
// the polling status check and the Yoco webhook so duplicate triggers don't
// double-process.
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
            parcels: [parcelForShiplogic(o.parcel_size)],
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
          // Shiplogic returns both. Keep them in separate columns:
          //   tracking_reference → Shiplogic's short ref (6-char),
          //     used for our API polling (/tracking/shipments).
          //   tcg_waybill → the "TCG1234567890" format TCG's public
          //     tracking site needs. Fields tried in order because
          //     Shiplogic has renamed these historically.
          const trackingRef = shipData.short_tracking_reference || shipData.tracking_reference || '';
          const tcgWaybill = shipData.tracking_reference || shipData.waybill_number || shipData.waybill || shipData.tcg_waybill || '';
          await pool.query(
            'UPDATE orders SET shipment_id = $1, tracking_reference = $2, tcg_waybill = $3, updated_at = NOW() WHERE id = $4',
            [String(shipmentId), trackingRef, tcgWaybill, order.id]
          );
          console.log(`[TCG] Shipment created for order #${order.id}: short=${trackingRef} waybill=${tcgWaybill}`);
        } else {
          const errText = await shipRes.text();
          console.error('[TCG] Failed to create shipment:', errText);
          // Buyer has paid but no courier will be dispatched — alert
          // the operator so they can manually create the shipment in
          // the TCG portal before the buyer starts asking questions.
          sendAdminAlert({
            subject: `Shipment creation failed for order #${order.id}`,
            body: `Order #${order.id} was paid but The Courier Guy rejected the shipment request. No courier has been dispatched. Create the shipment manually in the TCG portal or follow up with the seller/buyer.`,
            context: {
              orderId: order.id,
              sellerName: o.seller_name,
              sellerCity: o.seller_city,
              sellerPhone: o.seller_phone,
              buyerName: o.buyer_name,
              deliveryCity: o.delivery_city,
              listing: o.listing_title,
              tcgStatus: shipRes.status,
              tcgError: errText.slice(0, 500),
            },
          }).catch(() => {});
        }
      }
    } catch (shipErr) {
      console.error('[TCG] Auto-shipment error:', shipErr.message);
      sendAdminAlert({
        subject: `Shipment creation threw for order #${order.id}`,
        body: `Order #${order.id} was paid but the TCG call threw before it got a response. Order is in "paid" status with no shipment attached. Investigate in the TCG portal or retry manually.`,
        context: {
          orderId: order.id,
          error: shipErr.message,
        },
      }).catch(() => {});
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
        tcgWaybill: eo.tcg_waybill || null,
      }).then(() => console.log(`[EMAIL] Buyer confirmed for order #${eo.id}`))
        .catch(err => console.error('[EMAIL] Buyer confirmation failed:', err.message));
    }
  } catch (emailErr) {
    console.error('[EMAIL] Notification error:', emailErr.message);
  }

  return { changed: true, order };
}

// Initiate payment for an order — creates a Yoco checkout, stores the id,
// returns the hosted checkout URL the client should redirect the buyer to.
router.post('/initiate', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { orderId } = req.body;

    const { rows: orders } = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND buyer_id = $2',
      [orderId, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });

    const order = orders[0];
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Order is not pending payment' });
    }

    const clientUrl = process.env.CLIENT_URL || 'https://parent2parent.onrender.com';
    const checkout = await createYocoCheckout({ order, clientUrl });

    await pool.query(
      'UPDATE orders SET payment_reference = $1, updated_at = NOW() WHERE id = $2',
      [checkout.id, order.id]
    );

    res.json({ paymentUrl: checkout.redirectUrl, checkoutId: checkout.id });
  } catch (err) {
    console.error('[YOCO] Initiate error:', err);
    res.status(500).json({ error: err.message || 'Failed to initiate payment' });
  }
});

// Map Yoco's checkout status to our internal vocabulary.
function isPaidStatus(status) {
  const s = (status || '').toLowerCase();
  return s === 'successful' || s === 'succeeded' || s === 'paid' || s === 'completed';
}
function isCancelledStatus(status) {
  return (status || '').toLowerCase() === 'cancelled';
}
function isFailedStatus(status) {
  const s = (status || '').toLowerCase();
  return s === 'failed' || s === 'expired';
}

// Check payment status — used by PaymentReturn polling.
router.get('/status/:orderId', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows: orders } = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)',
      [req.params.orderId, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });

    const order = orders[0];
    if (!order.payment_reference) {
      return res.json({ status: 'pending', paymentStatus: null });
    }

    const checkout = await getYocoCheckout(order.payment_reference);
    const yocoStatus = checkout.status;

    if (isPaidStatus(yocoStatus) && order.status === 'pending') {
      await handleOrderPaid(pool, order.id);
      return res.json({ status: 'paid', paymentStatus: 'PAID' });
    }
    if (isCancelledStatus(yocoStatus)) {
      return res.json({ status: order.status, paymentStatus: 'cancelled' });
    }
    if (isFailedStatus(yocoStatus)) {
      return res.json({ status: order.status, paymentStatus: 'failed' });
    }

    res.json({ status: order.status, paymentStatus: yocoStatus || 'pending' });
  } catch (err) {
    console.error('[YOCO] Status error:', err);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// Verify a Yoco webhook signature using the Standard Webhooks spec
// (https://www.standardwebhooks.com). Yoco signs with HMAC-SHA256 over
// `{webhook-id}.{webhook-timestamp}.{rawBody}` using the shared secret
// (which is base64-encoded with a `whsec_` prefix). Multiple signatures
// can be present in the header — any one matching is sufficient.
function verifyYocoSignature(req) {
  if (process.env.YOCO_WEBHOOK_SKIP_VERIFY === 'true') return true;

  const secret = process.env.YOCO_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[YOCO WEBHOOK] YOCO_WEBHOOK_SECRET is not set');
    return false;
  }

  const id = req.get('webhook-id');
  const timestamp = req.get('webhook-timestamp');
  const sigHeader = req.get('webhook-signature');
  if (!id || !timestamp || !sigHeader) {
    console.error('[YOCO WEBHOOK] Missing webhook-id/timestamp/signature header');
    return false;
  }

  // Reject events more than 5 minutes old (replay protection).
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) {
    console.error(`[YOCO WEBHOOK] Stale timestamp: ${timestamp} (now=${now})`);
    return false;
  }

  const raw = req.rawBody;
  if (!raw) {
    console.error('[YOCO WEBHOOK] Raw body unavailable');
    return false;
  }

  const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let keyBytes;
  try {
    keyBytes = Buffer.from(cleanSecret, 'base64');
  } catch {
    console.error('[YOCO WEBHOOK] Failed to decode secret');
    return false;
  }

  const signedPayload = `${id}.${timestamp}.${raw.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', keyBytes).update(signedPayload).digest('base64');

  // Header format: "v1,sig1 v1,sig2 ..."
  const candidates = sigHeader.split(' ').map(part => {
    const [version, sig] = part.split(',');
    return { version, sig };
  });

  return candidates.some(({ version, sig }) => {
    if (version !== 'v1' || !sig) return false;
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

// Webhook from Yoco. Acks 200 immediately, then verifies + processes.
router.post('/webhook', async (req, res) => {
  res.status(200).json({ received: true });

  try {
    if (!verifyYocoSignature(req)) {
      console.warn('[YOCO WEBHOOK] Signature verification failed; ignoring event');
      return;
    }

    const event = req.body || {};
    console.log('[YOCO WEBHOOK]', JSON.stringify(event));

    // Standard webhooks event shape: { type, id, payload: { ... } }
    const type = (event.type || '').toLowerCase();
    const payload = event.payload || event.data || event;

    // We only act on successful payments. Other event types are logged and
    // ignored — the polling fallback will catch anything we miss.
    const isSuccess =
      type.includes('payment.succeeded') ||
      type.includes('checkout.succeeded') ||
      type.includes('payment.success') ||
      isPaidStatus(payload.status);
    if (!isSuccess) {
      console.log(`[YOCO WEBHOOK] Ignoring event type=${type} status=${payload.status}`);
      return;
    }

    // Find the order — prefer metadata.orderId we set at checkout creation,
    // fall back to looking up by checkout id stored as payment_reference.
    const orderIdFromMeta = payload.metadata?.orderId;
    const checkoutId = payload.checkoutId || payload.id;

    const pool = req.app.get('db');
    let orderRow;
    if (orderIdFromMeta) {
      const { rows } = await pool.query('SELECT id FROM orders WHERE id = $1', [orderIdFromMeta]);
      orderRow = rows[0];
    }
    if (!orderRow && checkoutId) {
      const { rows } = await pool.query(
        'SELECT id FROM orders WHERE payment_reference = $1',
        [String(checkoutId)]
      );
      orderRow = rows[0];
    }

    if (!orderRow) {
      console.warn(`[YOCO WEBHOOK] No order found for metadata.orderId=${orderIdFromMeta} checkoutId=${checkoutId}`);
      return;
    }

    const result = await handleOrderPaid(pool, orderRow.id);
    if (result.changed) {
      console.log(`[YOCO WEBHOOK] Order #${orderRow.id} marked paid via webhook`);
    } else {
      console.log(`[YOCO WEBHOOK] Order #${orderRow.id} already processed (${result.reason})`);
    }
  } catch (err) {
    console.error('[YOCO WEBHOOK] Processing error:', err);
  }
});

module.exports = router;
