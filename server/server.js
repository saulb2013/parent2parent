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
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch {}
  }
  console.log('[STARTUP] Migrations checked');
}

app.listen(PORT, async () => {
  console.log(`Parent2Parent API running on http://localhost:${PORT}`);
  try { await runMigrations(); } catch (err) { console.error('[STARTUP] Migration failed:', err.message); }
  try { await syncCategories(); } catch (err) { console.error('[STARTUP] Category sync failed:', err.message); }
});
