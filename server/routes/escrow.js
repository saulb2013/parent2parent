const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Buyer confirms receipt — releases escrow immediately
router.post('/confirm-receipt', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { orderId } = req.body;

    // Validate order
    const { rows: orders } = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND buyer_id = $2',
      [orderId, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });

    const order = orders[0];
    if (!['paid', 'shipped', 'delivered'].includes(order.status)) {
      return res.status(400).json({ error: 'Order is not in a confirmable state' });
    }

    // Check escrow
    const { rows: escrows } = await pool.query(
      'SELECT * FROM escrow_holds WHERE order_id = $1',
      [orderId]
    );
    if (!escrows.length) return res.status(404).json({ error: 'No escrow found for this order' });

    const escrow = escrows[0];
    if (escrow.status !== 'holding') {
      return res.status(400).json({ error: `Escrow is ${escrow.status}, not holding` });
    }

    // Check no open dispute
    const { rows: openDisputes } = await pool.query(
      "SELECT id FROM disputes WHERE order_id = $1 AND status NOT IN ('resolved_no_refund', 'refunded')",
      [orderId]
    );
    if (openDisputes.length) {
      return res.status(400).json({ error: 'Cannot confirm while a dispute is open' });
    }

    // Release escrow
    await pool.query(
      `UPDATE escrow_holds SET status = 'released', released_at = NOW(), buyer_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [escrow.id]
    );

    // Update order status to delivered if not already
    if (order.status !== 'delivered') {
      await pool.query(
        "UPDATE orders SET status = 'delivered', delivered_at = COALESCE(delivered_at, NOW()), updated_at = NOW() WHERE id = $1",
        [orderId]
      );
    }

    // Create seller payout
    await pool.query(
      `INSERT INTO seller_payouts (seller_id, order_id, escrow_id, amount, platform_fee, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (order_id) DO NOTHING`,
      [escrow.seller_id, orderId, escrow.id, escrow.item_amount, escrow.platform_fee]
    );

    console.log(`[ESCROW] Buyer confirmed receipt for order #${orderId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Confirm receipt error:', err);
    res.status(500).json({ error: 'Failed to confirm receipt' });
  }
});

// Get escrow status for an order
router.get('/:orderId', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { rows } = await pool.query(
      `SELECT eh.*, d.id as dispute_id, d.status as dispute_status, d.reason as dispute_reason
       FROM escrow_holds eh
       LEFT JOIN disputes d ON d.escrow_id = eh.id AND d.status NOT IN ('resolved_no_refund', 'refunded')
       WHERE eh.order_id = $1`,
      [req.params.orderId]
    );
    if (!rows.length) return res.status(404).json({ error: 'No escrow found' });
    res.json({ escrow: rows[0] });
  } catch (err) {
    console.error('Get escrow error:', err);
    res.status(500).json({ error: 'Failed to get escrow status' });
  }
});

module.exports = router;
