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
  } catch (err) {
    console.error('[DB MIGRATION] Failed:', err.message);
  }
}

// Fire-and-forget — server boot should not be blocked by this.
runMigrations();

module.exports = pool;
