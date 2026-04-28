const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const PLATFORM_FEE_PERCENT = 5;
const YOCO_RATE = 0.0299; // 2.6% + VAT ≈ 2.99%

// Calculate buyer protection fee: covers our 5% margin + Yoco's processing
// fee on the entire transaction. Grossed up so after Yoco takes their cut,
// we net exactly PLATFORM_FEE_PERCENT on the item price.
function calcBuyerProtectionFee(itemPrice, courierFee) {
  const desiredMargin = itemPrice * PLATFORM_FEE_PERCENT / 100;
  const yocoCostOnItemAndCourier = YOCO_RATE * (itemPrice + courierFee);
  const fee = (desiredMargin + yocoCostOnItemAndCourier) / (1 - YOCO_RATE);
  return Math.round(fee);
}

// Create order (checkout)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const buyerId = req.user.id;
    const {
      listingId,
      deliveryMethod,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      deliveryCity,
      deliveryProvince,
      deliveryPostalCode,
      buyerPhone,
      buyerNotes,
      courierFee,
      serviceLevelCode,
      parcelSize,
    } = req.body;

    // Get listing details
    const { rows: listings } = await pool.query(
      'SELECT id, title, price, seller_id, status FROM listings WHERE id = $1',
      [listingId]
    );

    if (!listings.length) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = listings[0];

    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'This listing is no longer available' });
    }

    if (listing.seller_id === buyerId) {
      return res.status(400).json({ error: 'You cannot buy your own listing' });
    }

    const itemPrice = listing.price;
    const courierFeeAmount = deliveryMethod === 'delivery' ? (courierFee || 0) : 0;
    const platformFee = calcBuyerProtectionFee(itemPrice, courierFeeAmount);
    const totalPrice = itemPrice + platformFee + courierFeeAmount;

    const normPhone = buyerPhone
      ? buyerPhone.replace(/[\s\-()]/g, '').replace(/^0(\d{9})$/, '+27$1').replace(/^27(\d{9})$/, '+27$1')
      : null;

    // Reuse existing pending order for same buyer + listing
    const { rows: existing } = await pool.query(
      "SELECT * FROM orders WHERE buyer_id = $1 AND listing_id = $2 AND status = 'pending'",
      [buyerId, listingId]
    );

    if (existing.length) {
      // Update the pending order with any changed details (address, phone, etc.)
      const { rows: updated } = await pool.query(
        `UPDATE orders SET
          delivery_address = $1, delivery_lat = $2, delivery_lng = $3,
          delivery_city = $4, delivery_province = $5, delivery_postal_code = $6,
          buyer_phone = $7, buyer_notes = $8, courier_fee = $9,
          service_level_code = $10, parcel_size = $11, total_price = $12,
          updated_at = NOW()
         WHERE id = $13 RETURNING *`,
        [
          deliveryAddress, deliveryLat || null, deliveryLng || null,
          deliveryCity || null, deliveryProvince || null, deliveryPostalCode || null,
          normPhone, buyerNotes || null, courierFeeAmount || null, serviceLevelCode || null,
          parcelSize || 'medium', totalPrice, existing[0].id
        ]
      );
      return res.status(201).json({ order: updated[0] });
    }

    const { rows } = await pool.query(
      `INSERT INTO orders (buyer_id, listing_id, seller_id, item_price, platform_fee, total_price,
        delivery_method, delivery_address, delivery_lat, delivery_lng, delivery_city, delivery_province, delivery_postal_code,
        buyer_phone, buyer_notes, courier_fee, service_level_code, parcel_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [buyerId, listingId, listing.seller_id, itemPrice, platformFee, totalPrice,
       deliveryMethod || 'collect', deliveryAddress, deliveryLat || null, deliveryLng || null, deliveryCity || null,
       deliveryProvince || null, deliveryPostalCode || null,
       normPhone,
       buyerNotes || null,
       courierFeeAmount || null, serviceLevelCode || null, parcelSize || 'medium']
    );

    res.status(201).json({ order: rows[0] });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get the order associated with a listing (for the seller's sold-item detail view)
router.get('/by-listing/:listingId', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(
      `SELECT o.*, l.title as listing_title, l.description as listing_description,
        (SELECT url FROM listing_images WHERE listing_id = o.listing_id AND is_primary = true LIMIT 1) as listing_image,
        seller.name as seller_name,
        buyer.name as buyer_name
       FROM orders o
       JOIN listings l ON o.listing_id = l.id
       JOIN users seller ON o.seller_id = seller.id
       JOIN users buyer ON o.buyer_id = buyer.id
       WHERE o.listing_id = $1 AND o.seller_id = $2 AND o.status != 'pending'
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [req.params.listingId, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'No order found for this listing' });
    }

    res.json({ order: rows[0] });
  } catch (err) {
    console.error('Get order by listing error:', err);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Get user's orders (as seller) — used on the Sold tab of the seller profile
router.get('/sales', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(
      `SELECT o.id, o.listing_id, o.status, o.delivery_method,
              o.tracking_reference, o.tcg_waybill, o.shipment_id,
              o.delivery_city, o.delivery_province,
              o.created_at, o.updated_at,
              o.item_price, o.platform_fee, o.courier_fee, o.total_price,
              l.title as listing_title,
              (SELECT url FROM listing_images WHERE listing_id = o.listing_id AND is_primary = true LIMIT 1) as listing_image,
              buyer.name as buyer_name,
              eh.status as escrow_status, sp.status as payout_status, sp.paid_at as payout_paid_at
       FROM orders o
       JOIN listings l ON o.listing_id = l.id
       JOIN users buyer ON o.buyer_id = buyer.id
       LEFT JOIN escrow_holds eh ON eh.order_id = o.id
       LEFT JOIN seller_payouts sp ON sp.order_id = o.id
       WHERE o.seller_id = $1 AND o.status != 'pending'
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    res.json({ orders: rows });
  } catch (err) {
    console.error('Get sales error:', err);
    res.status(500).json({ error: 'Failed to get sales' });
  }
});

// Get order by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(
      `SELECT o.*, l.title as listing_title, l.description as listing_description,
        (SELECT url FROM listing_images WHERE listing_id = o.listing_id AND is_primary = true LIMIT 1) as listing_image,
        seller.name as seller_name, buyer.name as buyer_name,
        eh.id as escrow_id, eh.status as escrow_status, eh.release_due_at, eh.buyer_confirmed_at, eh.paused_at,
        d.id as dispute_id, d.status as dispute_status, d.reason as dispute_reason, d.description as dispute_description, d.created_at as dispute_created_at,
        d.seller_return_address, d.return_tracking as dispute_return_tracking, d.return_deadline, d.seller_address_provided_at,
        d.evidence_photos as dispute_evidence_photos
       FROM orders o
       JOIN listings l ON o.listing_id = l.id
       JOIN users seller ON o.seller_id = seller.id
       JOIN users buyer ON o.buyer_id = buyer.id
       LEFT JOIN escrow_holds eh ON eh.order_id = o.id
       LEFT JOIN disputes d ON d.order_id = o.id AND d.status NOT IN ('resolved_no_refund', 'refunded')
       WHERE o.id = $1 AND (o.buyer_id = $2 OR o.seller_id = $2)`,
      [req.params.id, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order: rows[0] });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Get user's orders (as buyer)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(
      `SELECT o.*, l.title as listing_title,
        (SELECT url FROM listing_images WHERE listing_id = o.listing_id AND is_primary = true LIMIT 1) as listing_image,
        seller.name as seller_name
       FROM orders o
       JOIN listings l ON o.listing_id = l.id
       JOIN users seller ON o.seller_id = seller.id
       WHERE o.buyer_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    res.json({ orders: rows });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

module.exports = router;
