const app = require('./app');
const pool = require('./db/database');

const PORT = process.env.PORT || 3001;

// Ensure all categories exist on startup (idempotent — skips existing slugs)
const CATEGORIES = [
  ['Prams & Strollers', 'prams-strollers', '🛒', 'Prams, strollers, and travel systems'],
  ['Car Seats', 'car-seats', '🪑', 'Infant, toddler, and booster car seats'],
  ['Cots & Beds', 'cots-beds', '🛏️', 'Cots, bassinets, camp cots, and toddler beds'],
  ['Feeding', 'feeding', '🍼', 'Bottles, breast pumps, high chairs, and sterilisers'],
  ['Toys & Play', 'toys-play', '🧸', 'Educational toys, playsets, and games'],
  ['Clothing', 'clothing', '👶', 'Baby and kids clothing bundles'],
  ['Carriers & Slings', 'carriers-slings', '🤱', 'Baby carriers, wraps, and slings'],
  ['Outdoor & Garden', 'outdoor-garden', '🌿', 'Swings, trampolines, and outdoor play equipment'],
  ['Bath & Changing', 'bath-changing', '🛁', 'Baby baths, nappy bins, change mats, and potties'],
  ['Safety & Monitors', 'safety-monitors', '📡', 'Baby monitors, safety gates, and corner guards'],
  ['Nursery & Decor', 'nursery-decor', '🌙', 'Mobiles, lamps, storage baskets, and wall art'],
  ['Books & Learning', 'books-learning', '📚', 'Books, puzzles, and educational materials'],
  ['Maternity', 'maternity', '🤰', 'Pregnancy pillows, nursing wear, and maternity bags'],
];

async function syncCategories() {
  for (const [name, slug, emoji, description] of CATEGORIES) {
    await pool.query(
      `INSERT INTO categories (name, slug, emoji, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO NOTHING`,
      [name, slug, emoji, description]
    );
  }
  console.log(`[STARTUP] Categories synced (${CATEGORIES.length} defined)`);
}

// Lightweight migrations — add columns that may be missing on older DBs.
async function runMigrations() {
  const migrations = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS unit TEXT",
    `CREATE TABLE IF NOT EXISTS escrow_holds (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) NOT NULL UNIQUE,
      seller_id INTEGER REFERENCES users(id) NOT NULL,
      buyer_id INTEGER REFERENCES users(id) NOT NULL,
      item_amount INTEGER NOT NULL,
      platform_fee INTEGER NOT NULL,
      courier_fee INTEGER DEFAULT 0,
      status TEXT DEFAULT 'holding',
      hold_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      release_due_at TIMESTAMPTZ NOT NULL,
      paused_at TIMESTAMPTZ,
      time_remaining_ms INTEGER,
      released_at TIMESTAMPTZ,
      buyer_confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS seller_payouts (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER REFERENCES users(id) NOT NULL,
      order_id INTEGER REFERENCES orders(id) NOT NULL UNIQUE,
      escrow_id INTEGER REFERENCES escrow_holds(id) NOT NULL,
      amount INTEGER NOT NULL,
      platform_fee INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      paid_at TIMESTAMPTZ,
      admin_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS disputes (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) NOT NULL,
      escrow_id INTEGER REFERENCES escrow_holds(id) NOT NULL,
      raised_by INTEGER REFERENCES users(id) NOT NULL,
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'open',
      return_tracking TEXT,
      seller_confirmed_return_at TIMESTAMPTZ,
      yoco_refund_id TEXT,
      admin_notes TEXT,
      escalated_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE",
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch {}
  }
  // Set admin user
  try {
    await pool.query("UPDATE users SET is_admin = TRUE WHERE email = 'saul.bloch13@gmail.com'");
  } catch {}

  // Backfill escrow rows for orders that were paid before the escrow system existed
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO escrow_holds (order_id, seller_id, buyer_id, item_amount, platform_fee, courier_fee, status, hold_started_at, release_due_at)
       SELECT o.id, o.seller_id, o.buyer_id, o.item_price, o.platform_fee, COALESCE(o.courier_fee, 0),
              'released', o.created_at, o.created_at + INTERVAL '7 days'
       FROM orders o
       WHERE o.status IN ('paid', 'shipped', 'delivered')
         AND NOT EXISTS (SELECT 1 FROM escrow_holds eh WHERE eh.order_id = o.id)
       ON CONFLICT (order_id) DO NOTHING`
    );
    if (rowCount > 0) {
      // Also create payout rows for the backfilled escrows
      await pool.query(
        `INSERT INTO seller_payouts (seller_id, order_id, escrow_id, amount, platform_fee, status)
         SELECT eh.seller_id, eh.order_id, eh.id, eh.item_amount, eh.platform_fee, 'pending'
         FROM escrow_holds eh
         WHERE eh.status = 'released'
           AND NOT EXISTS (SELECT 1 FROM seller_payouts sp WHERE sp.order_id = eh.order_id)
         ON CONFLICT (order_id) DO NOTHING`
      );
      console.log(`[STARTUP] Backfilled ${rowCount} escrow holds for existing orders`);
    }
  } catch (err) {
    console.error('[STARTUP] Escrow backfill failed:', err.message);
  }

  console.log('[STARTUP] Migrations checked');
}

// Auto-release escrows that have passed their 7-day hold period, and
// escalate disputes older than 48 hours to admin review.
async function releaseExpiredEscrows() {
  const { rows: due } = await pool.query(
    `UPDATE escrow_holds
     SET status = 'released', released_at = NOW(), updated_at = NOW()
     WHERE status = 'holding' AND release_due_at <= NOW()
     RETURNING *`
  );
  for (const escrow of due) {
    await pool.query(
      `INSERT INTO seller_payouts (seller_id, order_id, escrow_id, amount, platform_fee, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (order_id) DO NOTHING`,
      [escrow.seller_id, escrow.order_id, escrow.id, escrow.item_amount, escrow.platform_fee]
    );
    console.log(`[ESCROW] Auto-released escrow #${escrow.id} for order #${escrow.order_id}`);
  }
  // Auto-escalate disputes older than 48hrs
  await pool.query(
    `UPDATE disputes SET status = 'admin_review', escalated_at = NOW(), updated_at = NOW()
     WHERE status = 'open' AND created_at <= NOW() - INTERVAL '48 hours'`
  );
  return due.length;
}

app.listen(PORT, async () => {
  console.log(`Parent2Parent API running on http://localhost:${PORT}`);
  try { await runMigrations(); } catch (err) { console.error('[STARTUP] Migration failed:', err.message); }
  try { await syncCategories(); } catch (err) { console.error('[STARTUP] Category sync failed:', err.message); }

  // Run escrow release once at startup, then every 5 minutes
  try { await releaseExpiredEscrows(); } catch (err) { console.error('[ESCROW] Startup release failed:', err.message); }
  setInterval(async () => {
    try { await releaseExpiredEscrows(); } catch (err) { console.error('[ESCROW] Interval release failed:', err.message); }
  }, 5 * 60 * 1000);
});
