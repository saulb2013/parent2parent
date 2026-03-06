const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// GET /api/listings
router.get('/', optionalAuth, async (req, res) => {
  const db = req.app.get('db');
  const { category, province, minPrice, maxPrice, condition, sort, page = 1, search, limit: queryLimit } = req.query;
  const limit = parseInt(queryLimit) || 12;
  const offset = (parseInt(page) - 1) * limit;

  let where = ['l.status = $1'];
  let params = ['active'];
  let idx = 2;

  if (category) {
    where.push(`c.slug = $${idx++}`);
    params.push(category);
  }
  if (province) {
    where.push(`l.province = $${idx++}`);
    params.push(province);
  }
  if (minPrice) {
    where.push(`l.price >= $${idx++}`);
    params.push(parseInt(minPrice));
  }
  if (maxPrice) {
    where.push(`l.price <= $${idx++}`);
    params.push(parseInt(maxPrice));
  }
  if (condition) {
    where.push(`l.condition = $${idx++}`);
    params.push(condition);
  }
  if (search) {
    where.push(`(l.title ILIKE $${idx} OR l.description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  let orderBy = 'l.created_at DESC';
  if (sort === 'price_asc') orderBy = 'l.price ASC';
  else if (sort === 'price_desc') orderBy = 'l.price DESC';
  else if (sort === 'popular') orderBy = 'l.views DESC';

  const whereClause = where.join(' AND ');

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM listings l LEFT JOIN categories c ON l.category_id = c.id WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const listingsResult = await db.query(
      `SELECT l.*, c.name as category_name, c.slug as category_slug, c.emoji as category_emoji,
              u.name as seller_name, u.avatar_url as seller_avatar,
              (SELECT url FROM listing_images WHERE listing_id = l.id AND is_primary = TRUE LIMIT 1) as image_url
       FROM listings l
       LEFT JOIN categories c ON l.category_id = c.id
       LEFT JOIN users u ON l.seller_id = u.id
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      listings: listingsResult.rows,
      pagination: { page: parseInt(page), limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// GET /api/listings/:id
router.get('/:id', optionalAuth, async (req, res) => {
  const db = req.app.get('db');
  try {
    const { rows } = await db.query(
      `SELECT l.*, c.name as category_name, c.slug as category_slug, c.emoji as category_emoji,
              u.name as seller_name, u.avatar_url as seller_avatar, u.city as seller_city,
              u.province as seller_province, u.phone as seller_phone, u.created_at as seller_since
       FROM listings l
       LEFT JOIN categories c ON l.category_id = c.id
       LEFT JOIN users u ON l.seller_id = u.id
       WHERE l.id = $1`,
      [req.params.id]
    );
    const listing = rows[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    // Increment views
    await db.query('UPDATE listings SET views = views + 1 WHERE id = $1', [req.params.id]);

    const images = await db.query(
      'SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY display_order',
      [req.params.id]
    );

    // Check if saved by current user
    let isSaved = false;
    if (req.user) {
      const saved = await db.query(
        'SELECT 1 FROM saved_listings WHERE user_id = $1 AND listing_id = $2',
        [req.user.id, req.params.id]
      );
      isSaved = saved.rows.length > 0;
    }

    // Similar listings
    const similar = await db.query(
      `SELECT l.*, (SELECT url FROM listing_images WHERE listing_id = l.id AND is_primary = TRUE LIMIT 1) as image_url,
              u.name as seller_name
       FROM listings l
       LEFT JOIN users u ON l.seller_id = u.id
       WHERE l.category_id = $1 AND l.id != $2 AND l.status = 'active'
       ORDER BY l.created_at DESC LIMIT 4`,
      [listing.category_id, listing.id]
    );

    res.json({ listing: { ...listing, images: images.rows, isSaved }, similar: similar.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// POST /api/listings
router.post('/', authenticateToken, upload.array('images', 6), async (req, res) => {
  const db = req.app.get('db');
  const { title, description, price, negotiable, condition, category_id, province, city } = req.body;

  if (!title || !description || !price || !condition || !category_id || !province || !city) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO listings (title, description, price, negotiable, condition, category_id, seller_id, province, city)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [title, description, parseInt(price), negotiable === 'true' || negotiable === '1', condition, parseInt(category_id), req.user.id, province, city]
    );
    const listingId = rows[0].id;

    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        await db.query(
          'INSERT INTO listing_images (listing_id, url, is_primary, display_order) VALUES ($1,$2,$3,$4)',
          [listingId, req.files[i].path, i === 0, i]
        );
      }
    }

    res.status(201).json({ id: listingId, message: 'Listing created' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// PUT /api/listings/:id
router.put('/:id', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const { rows } = await db.query('SELECT * FROM listings WHERE id = $1', [req.params.id]);
    const listing = rows[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.seller_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    const { title, description, price, negotiable, condition, category_id, province, city, status } = req.body;

    await db.query(
      `UPDATE listings SET title = COALESCE($1, title), description = COALESCE($2, description),
       price = COALESCE($3, price), negotiable = COALESCE($4, negotiable), condition = COALESCE($5, condition),
       category_id = COALESCE($6, category_id), province = COALESCE($7, province), city = COALESCE($8, city),
       status = COALESCE($9, status), updated_at = NOW()
       WHERE id = $10`,
      [title, description, price ? parseInt(price) : null, negotiable != null ? !!negotiable : null, condition, category_id ? parseInt(category_id) : null, province, city, status, req.params.id]
    );

    res.json({ message: 'Listing updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// DELETE /api/listings/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const { rows } = await db.query('SELECT * FROM listings WHERE id = $1', [req.params.id]);
    const listing = rows[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.seller_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    await db.query('DELETE FROM listings WHERE id = $1', [req.params.id]);
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

// POST /api/listings/:id/save
router.post('/:id/save', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    await db.query('INSERT INTO saved_listings (user_id, listing_id) VALUES ($1,$2)', [req.user.id, req.params.id]);
    res.json({ message: 'Listing saved' });
  } catch {
    res.status(409).json({ error: 'Already saved' });
  }
});

// DELETE /api/listings/:id/save
router.delete('/:id/save', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  await db.query('DELETE FROM saved_listings WHERE user_id = $1 AND listing_id = $2', [req.user.id, req.params.id]);
  res.json({ message: 'Listing unsaved' });
});

module.exports = router;
