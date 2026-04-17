const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  const db = req.app.get('db');
  try {
    const { rows: userRows } = await db.query(
      'SELECT id, name, email, avatar_url, province, city, street_address, postal_code, phone, bio, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!userRows[0]) return res.status(404).json({ error: 'User not found' });

    const { rows: listings } = await db.query(
      `SELECT l.*, (SELECT url FROM listing_images WHERE listing_id = l.id AND is_primary = TRUE LIMIT 1) as image_url
       FROM listings l WHERE l.seller_id = $1 ORDER BY l.created_at DESC`,
      [req.params.id]
    );

    const { rows: statsRows } = await db.query(
      `SELECT
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold_count,
        SUM(CASE WHEN status = 'hidden' THEN 1 ELSE 0 END) as hidden_count,
        COUNT(*) as total_count
       FROM listings WHERE seller_id = $1`,
      [req.params.id]
    );

    res.json({ user: userRows[0], listings, stats: statsRows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/users/:id
router.put('/:id', authenticateToken, upload.single('avatar'), async (req, res) => {
  const db = req.app.get('db');
  if (req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const { name, province, city, phone, bio, street_address, postal_code } = req.body;
  const avatar_url = req.file ? req.file.path : null;

  // Prevent blanking out required fields
  const missing = [];
  if (name !== undefined && !name?.trim()) missing.push('name');
  if (phone !== undefined && !phone?.trim()) missing.push('phone');
  if (street_address !== undefined && !street_address?.trim()) missing.push('address');
  if (city !== undefined && !city?.trim()) missing.push('city');
  if (province !== undefined && !province?.trim()) missing.push('province');
  if (postal_code !== undefined && !postal_code?.trim()) missing.push('postal code');
  if (missing.length) {
    return res.status(400).json({ error: `Required fields cannot be empty: ${missing.join(', ')}` });
  }

  try {
    await db.query(
      `UPDATE users SET name = COALESCE($1, name), province = COALESCE($2, province),
       city = COALESCE($3, city), phone = COALESCE($4, phone), bio = COALESCE($5, bio),
       avatar_url = COALESCE($6, avatar_url), street_address = COALESCE($7, street_address),
       postal_code = COALESCE($8, postal_code)
       WHERE id = $9`,
      [name, province, city, phone, bio, avatar_url, street_address, postal_code, req.params.id]
    );
    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/users/:id/saved
router.get('/:id/saved', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  if (req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  try {
    const { rows } = await db.query(
      `SELECT l.*, (SELECT url FROM listing_images WHERE listing_id = l.id AND is_primary = TRUE LIMIT 1) as image_url,
              u.name as seller_name
       FROM saved_listings sl
       JOIN listings l ON sl.listing_id = l.id
       LEFT JOIN users u ON l.seller_id = u.id
       WHERE sl.user_id = $1
       ORDER BY sl.saved_at DESC`,
      [req.params.id]
    );
    res.json({ listings: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch saved listings' });
  }
});

module.exports = router;
