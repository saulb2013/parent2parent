const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Admin middleware
async function requireAdmin(req, res, next) {
  const pool = req.app.get('db');
  const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]?.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

// List pending payouts
router.get('/payouts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const status = req.query.status || 'pending';
    const { rows } = await pool.query(
      `SELECT sp.*, u.name as seller_name, u.email as seller_email, u.phone as seller_phone,
              o.delivery_city, l.title as listing_title
       FROM seller_payouts sp
       JOIN users u ON sp.seller_id = u.id
       JOIN orders o ON sp.order_id = o.id
       JOIN listings l ON o.listing_id = l.id
       WHERE sp.status = $1
       ORDER BY sp.created_at DESC`,
      [status]
    );
    res.json({ payouts: rows });
  } catch (err) {
    console.error('Get payouts error:', err);
    res.status(500).json({ error: 'Failed to get payouts' });
  }
});

// Mark payout as paid
router.post('/payouts/:id/mark-paid', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { adminNotes } = req.body;
    const { rows } = await pool.query(
      `UPDATE seller_payouts SET status = 'paid', paid_at = NOW(), admin_notes = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [adminNotes || '', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Payout not found' });
    console.log(`[ADMIN] Payout #${req.params.id} marked as paid`);
    res.json({ payout: rows[0] });
  } catch (err) {
    console.error('Mark paid error:', err);
    res.status(500).json({ error: 'Failed to mark payout as paid' });
  }
});

// Revenue dashboard
router.get('/revenue', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('released') THEN platform_fee ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'holding' THEN platform_fee ELSE 0 END), 0) as pending_revenue,
        COALESCE(SUM(CASE WHEN status = 'holding' THEN item_amount ELSE 0 END), 0) as holding_for_sellers,
        COALESCE(SUM(courier_fee), 0) as total_courier_fees
      FROM escrow_holds
    `);
    const { rows: payoutRows } = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as owed_to_sellers,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_to_sellers
      FROM seller_payouts
    `);
    res.json({ ...rows[0], ...payoutRows[0] });
  } catch (err) {
    console.error('Revenue error:', err);
    res.status(500).json({ error: 'Failed to get revenue data' });
  }
});

// List all disputes (admin view)
router.get('/disputes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(
      `SELECT d.*, o.buyer_id, o.seller_id, l.title as listing_title,
              buyer.name as buyer_name, seller.name as seller_name,
              o.total_price, o.payment_reference
       FROM disputes d
       JOIN orders o ON d.order_id = o.id
       JOIN listings l ON o.listing_id = l.id
       JOIN users buyer ON o.buyer_id = buyer.id
       JOIN users seller ON o.seller_id = seller.id
       ORDER BY d.created_at DESC`
    );
    res.json({ disputes: rows });
  } catch (err) {
    console.error('Admin disputes error:', err);
    res.status(500).json({ error: 'Failed to get disputes' });
  }
});

// Resolve dispute (admin)
router.post('/disputes/:id/resolve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { resolution, adminNotes } = req.body; // 'refund' or 'no_refund'

    const { rows: disputes } = await pool.query(
      `SELECT d.*, o.payment_reference, o.total_price, eh.time_remaining_ms
       FROM disputes d
       JOIN orders o ON d.order_id = o.id
       JOIN escrow_holds eh ON d.escrow_id = eh.id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (!disputes.length) return res.status(404).json({ error: 'Dispute not found' });

    const dispute = disputes[0];

    if (resolution === 'refund') {
      // Issue Yoco refund
      const { issueYocoRefund } = require('./payments');
      let refundResult;
      try {
        refundResult = await issueYocoRefund(dispute.payment_reference);
      } catch (refundErr) {
        return res.status(500).json({ error: `Refund failed: ${refundErr.message}` });
      }

      await pool.query(
        `UPDATE disputes SET status = 'refunded', yoco_refund_id = $1, admin_notes = $2, resolved_at = NOW(), updated_at = NOW() WHERE id = $3`,
        [refundResult.id || refundResult.refundId || '', adminNotes || '', dispute.id]
      );
      await pool.query(
        `UPDATE escrow_holds SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
        [dispute.escrow_id]
      );
      await pool.query(
        `UPDATE orders SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
        [dispute.order_id]
      );
      // Re-activate listing
      await pool.query(
        `UPDATE listings SET status = 'active', updated_at = NOW() WHERE id = (SELECT listing_id FROM orders WHERE id = $1)`,
        [dispute.order_id]
      );

      console.log(`[ADMIN] Dispute #${dispute.id} resolved with refund`);
    } else {
      // No refund — resume escrow timer
      const remaining = dispute.time_remaining_ms || 0;
      await pool.query(
        `UPDATE escrow_holds SET status = 'holding', paused_at = NULL, release_due_at = NOW() + INTERVAL '1 millisecond' * $1, updated_at = NOW() WHERE id = $2`,
        [remaining, dispute.escrow_id]
      );
      await pool.query(
        `UPDATE disputes SET status = 'resolved_no_refund', admin_notes = $1, resolved_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [adminNotes || '', dispute.id]
      );

      console.log(`[ADMIN] Dispute #${dispute.id} resolved without refund, escrow timer resumed`);
    }

    const { rows: updated } = await pool.query('SELECT * FROM disputes WHERE id = $1', [dispute.id]);
    res.json({ dispute: updated[0] });
  } catch (err) {
    console.error('Resolve dispute error:', err);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// All escrow holds overview
router.get('/escrow', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(
      `SELECT eh.*, l.title as listing_title, seller.name as seller_name, buyer.name as buyer_name,
              o.status as order_status, o.delivered_at
       FROM escrow_holds eh
       JOIN orders o ON eh.order_id = o.id
       JOIN listings l ON o.listing_id = l.id
       JOIN users seller ON eh.seller_id = seller.id
       JOIN users buyer ON eh.buyer_id = buyer.id
       ORDER BY eh.created_at DESC`
    );
    const summary = {
      holding: rows.filter(r => r.status === 'holding').length,
      paused: rows.filter(r => r.status === 'paused').length,
      released: rows.filter(r => r.status === 'released').length,
      refunded: rows.filter(r => r.status === 'refunded').length,
    };
    res.json({ holds: rows, summary });
  } catch (err) {
    console.error('Admin escrow error:', err);
    res.status(500).json({ error: 'Failed to get escrow data' });
  }
});

module.exports = router;
