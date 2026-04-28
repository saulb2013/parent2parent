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
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_role TEXT DEFAULT NULL",
    "ALTER TABLE disputes ADD COLUMN IF NOT EXISTS seller_return_address TEXT",
    "ALTER TABLE disputes ADD COLUMN IF NOT EXISTS seller_address_provided_at TIMESTAMPTZ",
    "ALTER TABLE disputes ADD COLUMN IF NOT EXISTS return_shipped_at TIMESTAMPTZ",
    "ALTER TABLE disputes ADD COLUMN IF NOT EXISTS return_deadline TIMESTAMPTZ",
    "ALTER TABLE disputes ADD COLUMN IF NOT EXISTS evidence_photos JSONB DEFAULT '[]'::jsonb",
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch {}
  }
  // Set admin user
  try {
    await pool.query("UPDATE users SET is_admin = TRUE WHERE email = 'saul.bloch13@gmail.com'");
    await pool.query("UPDATE users SET is_admin = TRUE WHERE name = 'Dean Cohen'");
  } catch {}

  // One-time cleanup: remove ALL test orders except "Breast Pads"
  // Order: disputes → seller_payouts → escrow_holds → orders, then re-activate listings
  try {
    const testOrderFilter = `SELECT o.id FROM orders o JOIN listings l ON o.listing_id = l.id WHERE l.title != 'Breast Pads'`;
    await pool.query(`DELETE FROM disputes WHERE order_id IN (${testOrderFilter})`);
    await pool.query(`DELETE FROM seller_payouts WHERE order_id IN (${testOrderFilter})`);
    await pool.query(`DELETE FROM escrow_holds WHERE order_id IN (${testOrderFilter})`);
    // Re-activate listings that were marked 'sold' by test orders
    await pool.query(
      `UPDATE listings SET status = 'active', updated_at = NOW()
       WHERE status = 'sold' AND id IN (
         SELECT listing_id FROM orders o JOIN listings l ON o.listing_id = l.id
         WHERE l.title != 'Breast Pads'
       )`
    );
    const { rowCount } = await pool.query(`DELETE FROM orders WHERE id IN (${testOrderFilter})`);
    if (rowCount > 0) console.log(`[STARTUP] Cleaned up ${rowCount} test orders`);
  } catch (err) {
    console.error('[STARTUP] Test cleanup failed:', err.message);
  }

  // Backfill escrow rows for orders that were paid before the escrow system existed.
  // Fix: orders still in transit (paid/shipped) get 'holding' with a proper 7-day timer.
  // Only delivered orders get 'released'.
  try {
    // First, delete any incorrectly backfilled escrow/payout rows so we can redo them properly
    await pool.query(
      `DELETE FROM seller_payouts WHERE escrow_id IN (
        SELECT eh.id FROM escrow_holds eh JOIN orders o ON eh.order_id = o.id
        WHERE o.status IN ('paid', 'shipped')
      )`
    );
    await pool.query(
      `DELETE FROM escrow_holds WHERE order_id IN (
        SELECT id FROM orders WHERE status IN ('paid', 'shipped')
      )`
    );

    // In-transit orders: holding, timer doesn't start until delivery
    await pool.query(
      `INSERT INTO escrow_holds (order_id, seller_id, buyer_id, item_amount, platform_fee, courier_fee, status, hold_started_at, release_due_at)
       SELECT o.id, o.seller_id, o.buyer_id, o.item_price, o.platform_fee, COALESCE(o.courier_fee, 0),
              'holding', o.created_at, o.created_at + INTERVAL '90 days'
       FROM orders o
       WHERE o.status IN ('paid', 'shipped')
         AND NOT EXISTS (SELECT 1 FROM escrow_holds eh WHERE eh.order_id = o.id)
       ON CONFLICT (order_id) DO NOTHING`
    );

    // Delivered orders: holding with 7-day timer from delivery date
    await pool.query(
      `INSERT INTO escrow_holds (order_id, seller_id, buyer_id, item_amount, platform_fee, courier_fee, status, hold_started_at, release_due_at)
       SELECT o.id, o.seller_id, o.buyer_id, o.item_price, o.platform_fee, COALESCE(o.courier_fee, 0),
              'holding', o.created_at, COALESCE(o.delivered_at, NOW()) + INTERVAL '48 hours'
       FROM orders o
       WHERE o.status = 'delivered'
         AND NOT EXISTS (SELECT 1 FROM escrow_holds eh WHERE eh.order_id = o.id)
       ON CONFLICT (order_id) DO NOTHING`
    );

    // Create payout rows only for released escrows
    await pool.query(
      `INSERT INTO seller_payouts (seller_id, order_id, escrow_id, amount, platform_fee, status)
       SELECT eh.seller_id, eh.order_id, eh.id, eh.item_amount, eh.platform_fee, 'pending'
       FROM escrow_holds eh
       WHERE eh.status = 'released'
         AND NOT EXISTS (SELECT 1 FROM seller_payouts sp WHERE sp.order_id = eh.order_id)
       ON CONFLICT (order_id) DO NOTHING`
    );
    // Fix any existing escrows for undelivered orders that had incorrect release dates
    await pool.query(
      `UPDATE escrow_holds SET release_due_at = hold_started_at + INTERVAL '90 days', updated_at = NOW()
       WHERE status = 'holding' AND order_id IN (
         SELECT id FROM orders WHERE status IN ('paid', 'shipped')
       )`
    );

    console.log('[STARTUP] Escrow backfill checked');
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
  // Auto-escalate: seller didn't provide address within 48hrs
  await pool.query(
    `UPDATE disputes SET status = 'admin_review', escalated_at = NOW(), updated_at = NOW()
     WHERE status = 'awaiting_address' AND created_at <= NOW() - INTERVAL '48 hours'`
  );

  // Auto-close: buyer didn't ship within 72hrs of getting address.
  // Per Yaga-style rule, the buyer loses by default — we close the dispute
  // and resume the seller's escrow timer.
  const { rows: missedShipping } = await pool.query(
    `SELECT d.*, o.id as order_id, o.buyer_id, o.seller_id, o.listing_id,
            buyer.email as buyer_email, buyer.name as buyer_name,
            seller.email as seller_email, seller.name as seller_name,
            l.title as listing_title
     FROM disputes d
     JOIN orders o ON d.order_id = o.id
     JOIN users buyer ON o.buyer_id = buyer.id
     JOIN users seller ON o.seller_id = seller.id
     JOIN listings l ON o.listing_id = l.id
     WHERE d.status = 'open' AND d.return_deadline IS NOT NULL AND d.return_deadline <= NOW()`
  );
  for (const d of missedShipping) {
    await pool.query(
      `UPDATE disputes SET status = 'resolved_no_refund',
        admin_notes = 'Auto-closed: buyer did not ship the return within 72 hours',
        resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [d.id]
    );
    // Resume escrow with original time remaining (captured at dispute open)
    const remaining = d.time_remaining_ms || 0;
    await pool.query(
      `UPDATE escrow_holds
       SET status = 'holding', paused_at = NULL,
           release_due_at = NOW() + INTERVAL '1 millisecond' * $1,
           updated_at = NOW()
       WHERE id = $2`,
      [remaining, d.escrow_id]
    );
    console.log(`[DISPUTE] Auto-closed #${d.id} — buyer missed 72hr return deadline`);

    // Notify buyer + seller
    try {
      const { sendBrevoEmail } = require('./utils/email');
      const clientUrl = process.env.CLIENT_URL || 'https://parent2parent.co.za';
      const orderUrl = `${clientUrl}/orders/${d.order_id}`;
      const wrap = (content) => `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #fafafa;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 22px; font-weight: bold; color: #2D6A4F;">Parent</span><span style="font-size: 22px; font-weight: bold; color: #F4A261;">2</span><span style="font-size: 22px; font-weight: bold; color: #2D6A4F;">Parent</span>
          </div>
          <div style="background: white; border-radius: 12px; padding: 28px; border: 1px solid #eee;">${content}</div>
          <p style="color: #bbb; font-size: 11px; text-align: center; margin-top: 20px;">Parent2Parent &mdash; Previously loved. Ready for more.</p>
        </div>`;
      sendBrevoEmail({
        to: d.buyer_email,
        subject: `Return deadline passed for "${d.listing_title}"`,
        html: wrap(`
          <h2 style="color: #2D6A4F; font-size: 20px; margin: 0 0 16px;">Your return deadline has passed</h2>
          <p style="color: #555; line-height: 1.6; margin: 0 0 16px;">Hi ${d.buyer_name.split(' ')[0]},</p>
          <p style="color: #555; line-height: 1.6; margin: 0 0 16px;">
            The 72-hour window to ship your return for <strong>"${d.listing_title}"</strong> has passed without a tracking number being submitted, so this return has been closed.
          </p>
          <p style="color: #555; line-height: 1.6; margin: 0 0 16px;">
            If this was a mistake or you've genuinely already shipped the item, please reach out to support and we'll review.
          </p>
          <div style="text-align: center; margin: 24px 0 8px;">
            <a href="${orderUrl}" style="background: #2D6A4F; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">View Order</a>
          </div>
        `),
      }).catch(() => {});
      sendBrevoEmail({
        to: d.seller_email,
        subject: `Return deadline passed — payment will release for "${d.listing_title}"`,
        html: wrap(`
          <h2 style="color: #2D6A4F; font-size: 20px; margin: 0 0 16px;">Return closed in your favour</h2>
          <p style="color: #555; line-height: 1.6; margin: 0 0 16px;">Hi ${d.seller_name.split(' ')[0]},</p>
          <p style="color: #555; line-height: 1.6; margin: 0 0 16px;">
            The buyer did not ship the return for <strong>"${d.listing_title}"</strong> within the 72-hour window, so the return has been closed and your payment will release as normal.
          </p>
          <div style="text-align: center; margin: 24px 0 8px;">
            <a href="${orderUrl}" style="background: #2D6A4F; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">View Order</a>
          </div>
        `),
      }).catch(() => {});
    } catch (err) {
      console.error('[DISPUTE] Failed to send auto-close emails:', err.message);
    }
  }

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
