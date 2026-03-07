const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const PLATFORM_FEE_PERCENT = 5;

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

    // Reuse existing pending order for same buyer + listing
    const { rows: existing } = await pool.query(
      "SELECT * FROM orders WHERE buyer_id = $1 AND listing_id = $2 AND status = 'pending'",
      [buyerId, listingId]
    );

    if (existing.length) {
      return res.status(201).json({ order: existing[0] });
    }

    const itemPrice = listing.price;
    const platformFee = Math.round(itemPrice * PLATFORM_FEE_PERCENT / 100);
    const totalPrice = itemPrice + platformFee;

    const { rows } = await pool.query(
      `INSERT INTO orders (buyer_id, listing_id, seller_id, item_price, platform_fee, total_price,
        delivery_method, delivery_address, delivery_lat, delivery_lng, delivery_city, delivery_province, delivery_postal_code,
        buyer_phone, buyer_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [buyerId, listingId, listing.seller_id, itemPrice, platformFee, totalPrice,
       deliveryMethod || 'collect', deliveryAddress, deliveryLat || null, deliveryLng || null, deliveryCity || null,
       deliveryProvince || null, deliveryPostalCode || null, buyerPhone || null, buyerNotes || null]
    );

    res.status(201).json({ order: rows[0] });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get order by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(
      `SELECT o.*, l.title as listing_title, l.description as listing_description,
        (SELECT url FROM listing_images WHERE listing_id = o.listing_id AND is_primary = true LIMIT 1) as listing_image,
        seller.name as seller_name, seller.phone as seller_phone, buyer.name as buyer_name
       FROM orders o
       JOIN listings l ON o.listing_id = l.id
       JOIN users seller ON o.seller_id = seller.id
       JOIN users buyer ON o.buyer_id = buyer.id
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
