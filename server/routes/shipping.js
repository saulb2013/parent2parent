const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { parcelForShiplogic } = require('../utils/parcelSizes');

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

    // Return simplified rate options
    const rates = (data.rates || data).map(rate => ({
      service: rate.service_level?.name || rate.service_name || 'Standard',
      code: rate.service_level?.code || rate.service_code || '',
      price: rate.rate || rate.charge || 0,
      estimatedDays: rate.delivery_date_from
        ? Math.ceil((new Date(rate.delivery_date_to || rate.delivery_date_from) - new Date()) / (1000 * 60 * 60 * 24))
        : null,
      deliveryDateFrom: rate.delivery_date_from,
      deliveryDateTo: rate.delivery_date_to,
    }));

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
      parcels: [
        {
          submitted_length_cm: 30,
          submitted_width_cm: 30,
          submitted_height_cm: 20,
          submitted_weight_kg: 5,
        },
      ],
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
    const trackingRef = data.tracking_reference || data.short_tracking_reference || '';

    // Store shipment info on order
    await pool.query(
      'UPDATE orders SET shipment_id = $1, tracking_reference = $2, updated_at = NOW() WHERE id = $3',
      [String(shipmentId), trackingRef, order.id]
    );

    res.json({ shipmentId, trackingReference: trackingRef });
  } catch (err) {
    console.error('Create shipment error:', err);
    res.status(500).json({ error: err.message || 'Failed to create shipment' });
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

module.exports = router;
