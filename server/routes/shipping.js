const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { parcelForShiplogic } = require('../utils/parcelSizes');
const { verifyOrderToken } = require('../utils/orderTokens');

const router = express.Router();

const TCG_BASE_URL = process.env.TCG_API_URL || 'https://api.shiplogic.com';
// Note: sandbox vs production is determined by the API key, not the URL
const TCG_API_KEY = process.env.TCG_API_KEY;

async function tcgFetch(endpoint, options = {}) {
  if (!TCG_API_KEY) {
    throw new Error('The Courier Guy API key not configured');
  }

  const res = await fetch(`${TCG_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TCG_API_KEY}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TCG API error ${res.status}: ${errText}`);
  }

  return res.json();
}

// Get shipping rates/quotes
router.post('/rates', authenticateToken, async (req, res) => {
  try {
    const {
      collectionAddress,
      collectionCity,
      collectionPostalCode,
      collectionProvince,
      deliveryAddress,
      deliveryCity,
      deliveryPostalCode,
      deliveryProvince,
      parcelSize,
    } = req.body;

    const ratesBody = {
      collection_address: {
        type: 'residential',
        street_address: collectionAddress || '',
        local_area: collectionCity || '',
        city: collectionCity || '',
        zone: collectionProvince || '',
        country: 'ZA',
        code: collectionPostalCode || '',
      },
      delivery_address: {
        type: 'residential',
        street_address: deliveryAddress || '',
        local_area: deliveryCity || '',
        city: deliveryCity || '',
        zone: deliveryProvince || '',
        country: 'ZA',
        code: deliveryPostalCode || '',
      },
      parcels: [parcelForShiplogic(parcelSize)],
    };

    const data = await tcgFetch('/rates', {
      method: 'POST',
      body: JSON.stringify(ratesBody),
    });

    const rawRates = data.rates || data;

    // Return simplified rate options.
    // Shiplogic nests delivery dates inside service_level, not at the top level.
    const rates = rawRates.map(rate => {
      const sl = rate.service_level || {};
      const dateFrom = sl.delivery_date_from || rate.delivery_date_from || null;
      const dateTo = sl.delivery_date_to || rate.delivery_date_to || null;
      return {
        service: (sl.name || rate.service_name || 'Standard').replace(/\s*\(.*?\)\s*/g, '').trim(),
        code: sl.code || rate.service_code || '',
        price: rate.rate || rate.charge || 0,
        estimatedDays: dateFrom
          ? Math.ceil((new Date(dateTo || dateFrom) - new Date()) / (1000 * 60 * 60 * 24))
          : null,
        deliveryDateFrom: dateFrom,
        deliveryDateTo: dateTo,
      };
    });

    res.json({ rates });
  } catch (err) {
    console.error('Shipping rates error:', err);
    res.status(500).json({ error: err.message || 'Failed to get shipping rates' });
  }
});

// Create shipment (called after payment is confirmed)
router.post('/shipment', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { orderId, serviceLevelCode } = req.body;

    // Get order with seller and buyer info
    const { rows: orders } = await pool.query(
      `SELECT o.*,
        seller.name as seller_name, seller.phone as seller_phone, seller.email as seller_email, seller.city as seller_city, seller.province as seller_province, seller.street_address as seller_street_address, seller.postal_code as seller_postal_code,
        buyer.name as buyer_name, buyer.phone as buyer_phone_profile, buyer.email as buyer_email,
        l.title as listing_title
       FROM orders o
       JOIN users seller ON o.seller_id = seller.id
       JOIN users buyer ON o.buyer_id = buyer.id
       JOIN listings l ON o.listing_id = l.id
       WHERE o.id = $1 AND (o.buyer_id = $2 OR o.seller_id = $2)`,
      [orderId, req.user.id]
    );

    if (!orders.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orders[0];

    if (order.delivery_method !== 'delivery') {
      return res.status(400).json({ error: 'This order is for collection, not delivery' });
    }

    if (order.shipment_id) {
      return res.json({ shipmentId: order.shipment_id, trackingReference: order.tracking_reference });
    }

    const sellerPhone = order.seller_phone || '';
    const buyerPhone = order.buyer_phone || order.buyer_phone_profile || '';

    const shipmentBody = {
      collection_address: {
        type: 'residential',
        street_address: order.seller_street_address || order.seller_city || '',
        local_area: order.seller_city || '',
        city: order.seller_city || '',
        zone: order.seller_province || '',
        country: 'ZA',
        code: order.seller_postal_code || '',
      },
      collection_contact: {
        name: order.seller_name,
        mobile_number: sellerPhone,
        email: order.seller_email || '',
      },
      delivery_address: {
        type: 'residential',
        street_address: order.delivery_address || '',
        local_area: order.delivery_city || '',
        city: order.delivery_city || '',
        zone: order.delivery_province || '',
        country: 'ZA',
        code: order.delivery_postal_code || '',
      },
      delivery_contact: {
        name: order.buyer_name,
        mobile_number: buyerPhone,
        email: order.buyer_email || '',
      },
      parcels: [parcelForShiplogic(order.parcel_size)],
      special_instructions_collection: `Parent2Parent Order #${order.id} - ${order.listing_title}`,
      special_instructions_delivery: order.buyer_notes || '',
      declared_value: order.item_price / 100, // Convert cents to rands
      service_level_code: serviceLevelCode || order.service_level_code || 'ECO',
      mute_notifications: false,
    };

    const data = await tcgFetch('/shipments', {
      method: 'POST',
      body: JSON.stringify(shipmentBody),
    });

    const shipmentId = data.id || data.shipment_id;
    const trackingRef = data.short_tracking_reference || data.tracking_reference || '';
    const tcgWaybill = data.tracking_reference || data.waybill_number || data.waybill || data.tcg_waybill || '';

    // Store shipment info on order
    await pool.query(
      'UPDATE orders SET shipment_id = $1, tracking_reference = $2, tcg_waybill = $3, updated_at = NOW() WHERE id = $4',
      [String(shipmentId), trackingRef, tcgWaybill, order.id]
    );

    res.json({ shipmentId, trackingReference: trackingRef, tcgWaybill });
  } catch (err) {
    console.error('Create shipment error:', err);
    res.status(500).json({ error: err.message || 'Failed to create shipment' });
  }
});

// Refresh tracking statuses for all in-flight delivery orders belonging
// to the current user (as buyer or seller). Called when the profile or
// order list loads so statuses stay current without TCG webhooks.
router.post('/refresh-statuses', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    if (!TCG_API_KEY) return res.json({ updated: 0 });

    const { rows: inflight } = await pool.query(
      `SELECT id, tracking_reference, status FROM orders
       WHERE (buyer_id = $1 OR seller_id = $1)
         AND delivery_method = 'delivery'
         AND tracking_reference IS NOT NULL
         AND status IN ('paid', 'shipped')`,
      [req.user.id]
    );

    let updated = 0;
    for (const order of inflight) {
      try {
        const data = await tcgFetch(`/tracking/shipments?tracking_reference=${order.tracking_reference}`);
        const shipment = data.shipments?.[0] || data;
        const cs = (shipment.status || '').toLowerCase();

        let newStatus = null;
        if (cs.includes('delivered') && order.status !== 'delivered') newStatus = 'delivered';
        else if ((cs.includes('in-transit') || cs.includes('out-for-delivery')) && order.status === 'paid') newStatus = 'shipped';

        if (newStatus) {
          await pool.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, order.id]);
          updated++;
          console.log(`[REFRESH] Order #${order.id}: ${order.status} → ${newStatus}`);
        }
      } catch (err) {
        console.warn(`[REFRESH] Failed for order #${order.id}:`, err.message);
      }
    }

    res.json({ updated, checked: inflight.length });
  } catch (err) {
    console.error('Refresh statuses error:', err);
    res.status(500).json({ error: 'Failed to refresh statuses' });
  }
});

// Track shipment
router.get('/track/:orderId', authenticateToken, async (req, res) => {
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

    if (!order.tracking_reference) {
      return res.json({ tracking: null, message: 'No tracking info yet' });
    }

    const data = await tcgFetch(`/tracking/shipments?tracking_reference=${order.tracking_reference}`);

    const shipment = data.shipments?.[0] || data;
    const courierStatus = (shipment.status || '').toLowerCase();

    // Sync order status based on courier status
    let newOrderStatus = null;
    if (courierStatus.includes('delivered') && order.status !== 'delivered') {
      newOrderStatus = 'delivered';
    } else if ((courierStatus.includes('in-transit') || courierStatus.includes('out-for-delivery')) && order.status === 'paid') {
      newOrderStatus = 'shipped';
    }

    if (newOrderStatus) {
      await pool.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
        [newOrderStatus, order.id]
      );
      console.log(`[TRACKING] Order #${order.id} status updated to ${newOrderStatus} (courier: ${courierStatus})`);
    }

    res.json({
      trackingReference: order.tracking_reference,
      status: shipment.status || 'unknown',
      events: shipment.tracking_events || [],
      estimatedDelivery: shipment.delivery_date_to || null,
      orderStatus: newOrderStatus || order.status,
    });
  } catch (err) {
    console.error('Track shipment error:', err);
    res.status(500).json({ error: err.message || 'Failed to track shipment' });
  }
});

// Public tracking — no auth required, but caller must present a signed
// token that proves they know this order id (anti-enumeration). The
// token ships in the buyer confirmation email's "Track my order" link.
// Returns only shipment-relevant fields; never buyer PII or price info.
router.get('/public-track/:orderId', async (req, res) => {
  try {
    const { token } = req.query;
    const orderId = req.params.orderId;

    if (!verifyOrderToken(orderId, token)) {
      return res.status(401).json({ error: 'Invalid or missing tracking token' });
    }

    const pool = req.app.get('db');
    const { rows: orders } = await pool.query(
      `SELECT o.id, o.status, o.delivery_method, o.delivery_city, o.delivery_province,
              o.tracking_reference, o.tcg_waybill, l.title as listing_title
         FROM orders o
         JOIN listings l ON o.listing_id = l.id
        WHERE o.id = $1`,
      [orderId]
    );

    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    if (!order.tracking_reference) {
      return res.json({
        listingTitle: order.listing_title,
        deliveryMethod: order.delivery_method,
        deliveryCity: order.delivery_city,
        deliveryProvince: order.delivery_province,
        orderStatus: order.status,
        trackingReference: null,
        tcgWaybill: null,
        status: null,
        events: [],
        estimatedDelivery: null,
      });
    }

    // Live fetch from TCG. If this fails we still return the order
    // shape without tracking events so the page can render a useful
    // fallback state instead of 500'ing.
    let shipment = {};
    try {
      const data = await tcgFetch(`/tracking/shipments?tracking_reference=${order.tracking_reference}`);
      shipment = data.shipments?.[0] || data || {};
    } catch (err) {
      console.warn('[PUBLIC-TRACK] TCG fetch failed:', err.message);
    }

    res.json({
      listingTitle: order.listing_title,
      deliveryMethod: order.delivery_method,
      deliveryCity: order.delivery_city,
      deliveryProvince: order.delivery_province,
      orderStatus: order.status,
      trackingReference: order.tracking_reference,
      tcgWaybill: order.tcg_waybill,
      status: shipment.status || null,
      events: shipment.tracking_events || [],
      estimatedDelivery: shipment.delivery_date_to || null,
    });
  } catch (err) {
    console.error('Public track error:', err);
    res.status(500).json({ error: 'Failed to fetch tracking' });
  }
});

// One-off admin backfill — for orders that were booked before we
// started storing tcg_waybill separately, re-query Shiplogic for
// the full waybill and save it. Requires the caller to be logged
// in (authenticateToken) and be either the buyer or seller on the
// order.
router.post('/backfill-waybill/:orderId', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows: orders } = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)',
      [req.params.orderId, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });

    const order = orders[0];
    if (!order.shipment_id) return res.status(400).json({ error: 'Order has no shipment' });
    if (order.tcg_waybill) return res.json({ message: 'Already has waybill', tcgWaybill: order.tcg_waybill });

    const data = await tcgFetch(`/shipments/${order.shipment_id}`);
    const tcgWaybill = data.tracking_reference || data.waybill_number || data.waybill || '';
    const shortRef = data.short_tracking_reference || order.tracking_reference;

    if (!tcgWaybill) {
      return res.status(404).json({ error: 'Waybill not yet available from Shiplogic' });
    }

    await pool.query(
      'UPDATE orders SET tcg_waybill = $1, tracking_reference = $2 WHERE id = $3',
      [tcgWaybill, shortRef, order.id]
    );

    res.json({ tcgWaybill, trackingReference: shortRef });
  } catch (err) {
    console.error('Backfill waybill error:', err);
    res.status(500).json({ error: err.message || 'Backfill failed' });
  }
});

module.exports = router;
