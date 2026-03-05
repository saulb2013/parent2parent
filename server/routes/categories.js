const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  const db = req.app.get('db');
  try {
    const { rows } = await db.query(`
      SELECT c.*, COUNT(l.id) as listing_count
      FROM categories c
      LEFT JOIN listings l ON l.category_id = c.id AND l.status = 'active'
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json({ categories: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;
