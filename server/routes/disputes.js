const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { sendAdminAlert } = require('../utils/email');
const router = express.Router();

// Buyer opens a dispute
router.post('/open', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { orderId, reason, description } = req.body;

    if (!reason?.trim()) return res.status(400).json({ error: 'Reason is required' });

    const { rows: orders } = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND buyer_id = $2',
      [orderId, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });

    const order = orders[0];
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Order must be delivered before raising a dispute' });
    }

    // Check 48-hour window
    if (order.delivered_at) {
      const hoursSinceDelivery = (Date.now() - new Date(order.delivered_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceDelivery > 48) {
        return res.status(400).json({ error: 'Dispute window has closed (48 hours after delivery)' });
      }
    }

    const { rows: escrows } = await pool.query(
      'SELECT * FROM escrow_holds WHERE order_id = $1',
      [orderId]
    );
    if (!escrows.length) return res.status(404).json({ error: 'No escrow found' });
    const escrow = escrows[0];

    if (escrow.status !== 'holding') {
      return res.status(400).json({ error: 'Escrow has already been released' });
    }

    // Check no existing open dispute
    const { rows: existing } = await pool.query(
      "SELECT id FROM disputes WHERE order_id = $1 AND status NOT IN ('resolved_no_refund', 'refunded')",
      [orderId]
    );
    if (existing.length) return res.status(400).json({ error: 'A dispute is already open for this order' });

    // Pause escrow timer
    const timeRemainingMs = new Date(escrow.release_due_at).getTime() - Date.now();
    await pool.query(
      `UPDATE escrow_holds SET status = 'paused', paused_at = NOW(), time_remaining_ms = $1, updated_at = NOW() WHERE id = $2`,
      [Math.max(0, timeRemainingMs), escrow.id]
    );

    // Create dispute
    const { rows: disputes } = await pool.query(
      `INSERT INTO disputes (order_id, escrow_id, raised_by, reason, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orderId, escrow.id, req.user.id, reason, description || '']
    );

    console.log(`[DISPUTE] Opened for order #${orderId}: ${reason}`);

    // Alert admin
    sendAdminAlert({
      subject: `Dispute opened for order #${orderId}`,
      body: `A buyer has raised a dispute.\n\nReason: ${reason}\n${description || ''}`,
      context: { orderId, reason },
    }).catch(() => {});

    res.json({ dispute: disputes[0] });
  } catch (err) {
    console.error('Open dispute error:', err);
    res.status(500).json({ error: 'Failed to open dispute' });
  }
});

// Buyer marks return as shipped
router.post('/:id/return-shipped', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { returnTracking } = req.body;

    const { rows } = await pool.query(
      `SELECT d.*, o.buyer_id FROM disputes d JOIN orders o ON d.order_id = o.id WHERE d.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Dispute not found' });
    if (rows[0].buyer_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (rows[0].status !== 'open') return res.status(400).json({ error: 'Dispute is not in open state' });

    const { rows: updated } = await pool.query(
      `UPDATE disputes SET status = 'return_shipping', return_tracking = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [returnTracking || '', req.params.id]
    );

    res.json({ dispute: updated[0] });
  } catch (err) {
    console.error('Return shipped error:', err);
    res.status(500).json({ error: 'Failed to update dispute' });
  }
});

// Seller confirms return received
router.post('/:id/confirm-return', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');

    const { rows } = await pool.query(
      `SELECT d.*, o.seller_id FROM disputes d JOIN orders o ON d.order_id = o.id WHERE d.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Dispute not found' });
    if (rows[0].seller_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (rows[0].status !== 'return_shipping') return res.status(400).json({ error: 'Return has not been shipped yet' });

    const { rows: updated } = await pool.query(
      `UPDATE disputes SET status = 'return_received', seller_confirmed_return_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    res.json({ dispute: updated[0] });
  } catch (err) {
    console.error('Confirm return error:', err);
    res.status(500).json({ error: 'Failed to confirm return' });
  }
});

// Get disputes for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(
      `SELECT d.*, o.buyer_id, o.seller_id, l.title as listing_title
       FROM disputes d
       JOIN orders o ON d.order_id = o.id
       JOIN listings l ON o.listing_id = l.id
       WHERE o.buyer_id = $1 OR o.seller_id = $1
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );
    res.json({ disputes: rows });
  } catch (err) {
    console.error('Get disputes error:', err);
    res.status(500).json({ error: 'Failed to get disputes' });
  }
});

module.exports = router;
