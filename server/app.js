const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const pool = require('./db/database');

const authRoutes = require('./routes/auth');
const listingsRoutes = require('./routes/listings');
const usersRoutes = require('./routes/users');
const categoriesRoutes = require('./routes/categories');
const ordersRoutes = require('./routes/orders');
const paymentsRoutes = require('./routes/payments');
const shippingRoutes = require('./routes/shipping');

const app = express();

app.set('db', pool);

// Middleware
const allowedOrigins = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(cors({ origin: allowedOrigins, credentials: true }));
// Capture raw body so webhook handlers can verify HMAC signatures
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/shipping', shippingRoutes);

// Serve React frontend in production
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuild));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

// TEMP: One-time seed — mark listing 26 (Cot, R500) as sold with a test order.
// Idempotent: skips if already done. Remove after verifying UI.
(async () => {
  try {
    const listingId = 26;
    const { rows: existing } = await pool.query(
      "SELECT id FROM orders WHERE listing_id = $1 AND status != 'pending'", [listingId]
    );
    if (existing.length) {
      console.log(`[SEED] Listing ${listingId} already has an order (#${existing[0].id}), skipping.`);
      return;
    }
    const { rows: listings } = await pool.query('SELECT * FROM listings WHERE id = $1', [listingId]);
    if (!listings.length) { console.log('[SEED] Listing 26 not found, skipping.'); return; }
    const listing = listings[0];
    const itemPrice = listing.price;
    const platformFee = Math.round(itemPrice * 5 / 100);
    const totalPrice = itemPrice + platformFee;
    // Use seller as buyer for test purposes
    const { rows } = await pool.query(
      `INSERT INTO orders (buyer_id, listing_id, seller_id, item_price, platform_fee, total_price,
        delivery_method, delivery_city, delivery_province, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'delivery', 'Cape Town', 'Western Cape', 'paid')
       RETURNING id`,
      [listing.seller_id, listingId, listing.seller_id, itemPrice, platformFee, totalPrice]
    );
    await pool.query("UPDATE listings SET status = 'sold' WHERE id = $1", [listingId]);
    console.log(`[SEED] Created test sold order #${rows[0].id} for listing ${listingId}`);
  } catch (err) {
    console.error('[SEED] Failed:', err.message);
  }
})();

module.exports = app;
