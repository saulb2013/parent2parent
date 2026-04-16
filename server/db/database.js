require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Lightweight schema migrations applied on boot. Each entry is idempotent
// and safe to run on every startup. Add new entries here when you need to
// evolve the schema rather than touching schema.sql (which is only for
// fresh installs).
async function runMigrations() {
  try {
    // 2026-04-10: age/stage filter
    await pool.query(
      `ALTER TABLE listings ADD COLUMN IF NOT EXISTS age_stage TEXT`
    );

    // 2026-04-15: per-listing parcel size so shipping quotes and
    // shipment creation use accurate dimensions instead of a global
    // 5kg/30×30×20 hardcode.
    await pool.query(
      `ALTER TABLE listings ADD COLUMN IF NOT EXISTS parcel_size TEXT DEFAULT 'medium'`
    );

    // 2026-04-15: separate the TCG-facing waybill from Shiplogic's
    // short internal reference. tracking_reference was being used for
    // both, which broke the TCG deep-link when only the short one
    // came back. Keep the existing column for the short ref (still
    // needed for Shiplogic status polling) and add a dedicated column
    // for the human-facing TCG waybill (e.g. "TCG1234567890").
    await pool.query(
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tcg_waybill TEXT`
    );

    // 2026-04-15: backfill street_address + postal_code for the seed
    // users so couriered shipments have a valid collection address.
    // Idempotent — only updates rows where the field is currently
    // null/empty, so re-running is safe and won't clobber real data.
    const seedAddresses = [
      ['naledi@example.com', '45 Jan Smuts Avenue', '2196'],
      ['johan@example.com',  '78 Long Street',      '8001'],
      ['priya@example.com',  '23 Florida Road',     '4001'],
      ['thabo@example.com',  '56 Lynnwood Road',    '0081'],
      ['sarah@example.com',  '34 Cape Road',        '6001'],
    ];
    for (const [email, street, postal] of seedAddresses) {
      await pool.query(
        `UPDATE users
           SET street_address = COALESCE(NULLIF(street_address, ''), $2),
               postal_code    = COALESCE(NULLIF(postal_code, ''), $3)
         WHERE email = $1`,
        [email, street, postal]
      );
    }
    // TEMP: Seed listing 27 (Cot) as sold with a test order. Remove after verifying.
    const seedListingId = 27;
    const { rows: seedCheck } = await pool.query(
      "SELECT id FROM orders WHERE listing_id = $1 AND status != 'pending'", [seedListingId]
    );
    if (!seedCheck.length) {
      const { rows: seedListing } = await pool.query('SELECT * FROM listings WHERE id = $1', [seedListingId]);
      if (seedListing.length) {
        const sl = seedListing[0];
        const fee = Math.round(sl.price * 5 / 100);
        const { rows: newOrder } = await pool.query(
          `INSERT INTO orders (buyer_id, listing_id, seller_id, item_price, platform_fee, total_price,
            delivery_method, delivery_city, delivery_province, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'delivery', 'Cape Town', 'Western Cape', 'paid')
           RETURNING id`,
          [sl.seller_id, seedListingId, sl.seller_id, sl.price, fee, sl.price + fee]
        );
        await pool.query("UPDATE listings SET status = 'sold' WHERE id = $1", [seedListingId]);
        console.log(`[SEED] Created test sold order #${newOrder[0].id} for listing ${seedListingId}`);
      }
    } else {
      console.log(`[SEED] Listing ${seedListingId} already has order #${seedCheck[0].id}`);
    }

  } catch (err) {
    console.error('[DB MIGRATION] Failed:', err.message);
  }
}

// Fire-and-forget — server boot should not be blocked by this.
runMigrations();

module.exports = pool;
