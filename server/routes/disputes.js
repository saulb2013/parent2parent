const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { sendAdminAlert, sendBrevoEmail } = require('../utils/email');
const router = express.Router();

function emailWrapper(content) {
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #fafafa;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 22px; font-weight: bold; color: #2D6A4F;">Parent</span><span style="font-size: 22px; font-weight: bold; color: #F4A261;">2</span><span style="font-size: 22px; font-weight: bold; color: #2D6A4F;">Parent</span>
      </div>
      <div style="background: white; border-radius: 12px; padding: 28px; border: 1px solid #eee;">
        ${content}
      </div>
      <p style="color: #bbb; font-size: 11px; text-align: center; margin-top: 20px;">
        Parent2Parent &mdash; Previously loved. Ready for more.
      </p>
    </div>
  `;
}

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

    // Create dispute — status starts as 'awaiting_address' (seller must provide return address)
    const { rows: disputes } = await pool.query(
      `INSERT INTO disputes (order_id, escrow_id, raised_by, reason, description, status)
       VALUES ($1, $2, $3, $4, $5, 'awaiting_address') RETURNING *`,
      [orderId, escrow.id, req.user.id, reason, description || '']
    );

    console.log(`[DISPUTE] Opened for order #${orderId}: ${reason}`);

    // Email the seller — ask for return address
    const { rows: seller } = await pool.query('SELECT name, email FROM users WHERE id = $1', [order.seller_id]);
    const { rows: buyer } = await pool.query('SELECT name FROM users WHERE id = $1', [order.buyer_id]);
    const { rows: listing } = await pool.query('SELECT title FROM listings WHERE id = $1', [order.listing_id]);
    const clientUrl = process.env.CLIENT_URL || 'https://parent2parent.co.za';

    if (seller.length) {
      const sellerFirstName = seller[0].name.split(' ')[0];
      const buyerFirstName = buyer.length ? buyer[0].name.split(' ')[0] : 'The buyer';
      const listingTitle = listing.length ? listing[0].title : 'your item';

      sendBrevoEmail({
        to: seller[0].email,
        subject: `Return requested for "${listingTitle}"`,
        html: emailWrapper(`
          <h2 style="color: #2D6A4F; font-size: 20px; margin: 0 0 16px;">A return has been requested</h2>
          <p style="color: #555; line-height: 1.6; margin: 0 0 8px;">Hi ${sellerFirstName},</p>
          <p style="color: #555; line-height: 1.6; margin: 0 0 16px;">
            ${buyerFirstName} has raised a return request for <strong>"${listingTitle}"</strong>.
          </p>
          <div style="background: #fef3c7; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>Reason:</strong> ${reason}
            </p>
            ${description ? `<p style="margin: 8px 0 0; color: #92400e; font-size: 13px;">${description}</p>` : ''}
          </div>
          <p style="color: #555; line-height: 1.6; margin: 0 0 16px;">
            Please provide your return address within <strong>48 hours</strong> so the buyer can ship the item back to you.
          </p>
          <div style="text-align: center; margin: 24px 0 8px;">
            <a href="${clientUrl}/orders/${orderId}" style="background: #2D6A4F; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">Provide Return Address</a>
          </div>
        `),
      }).catch(err => console.error('[EMAIL] Failed to notify seller of dispute:', err.message));
    }

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

// Seller provides return address
router.post('/:id/provide-address', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { returnAddress } = req.body;

    if (!returnAddress?.trim()) return res.status(400).json({ error: 'Return address is required' });

    const { rows } = await pool.query(
      `SELECT d.*, o.seller_id, o.buyer_id, o.id as order_id, l.title as listing_title
       FROM disputes d
       JOIN orders o ON d.order_id = o.id
       JOIN listings l ON o.listing_id = l.id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Dispute not found' });
    if (rows[0].seller_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (rows[0].status !== 'awaiting_address') return res.status(400).json({ error: 'Return address has already been provided' });

    // Update dispute with address and set 72-hour return deadline
    const { rows: updated } = await pool.query(
      `UPDATE disputes SET
        status = 'open',
        seller_return_address = $1,
        seller_address_provided_at = NOW(),
        return_deadline = NOW() + INTERVAL '72 hours',
        updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [returnAddress, req.params.id]
    );

    console.log(`[DISPUTE] Seller provided return address for dispute #${req.params.id}`);

    // Email the buyer — address provided, ship within 72 hours
    const { rows: buyer } = await pool.query('SELECT name, email FROM users WHERE id = $1', [rows[0].buyer_id]);
    const clientUrl = process.env.CLIENT_URL || 'https://parent2parent.co.za';

    if (buyer.length) {
      const buyerFirstName = buyer[0].name.split(' ')[0];
      sendBrevoEmail({
        to: buyer[0].email,
        subject: `Return address provided — ship within 72 hours`,
        html: emailWrapper(`
          <h2 style="color: #2D6A4F; font-size: 20px; margin: 0 0 16px;">Return address ready</h2>
          <p style="color: #555; line-height: 1.6; margin: 0 0 8px;">Hi ${buyerFirstName},</p>
          <p style="color: #555; line-height: 1.6; margin: 0 0 16px;">
            The seller has provided their return address for <strong>"${rows[0].listing_title}"</strong>.
          </p>
          <div style="background: #f0fdf4; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <p style="margin: 0; color: #166534; font-size: 14px;">
              <strong>Ship the item back within 72 hours.</strong> The return address is available on your order page. Return postage is paid by the buyer.
            </p>
          </div>
          <div style="text-align: center; margin: 24px 0 8px;">
            <a href="${clientUrl}/orders/${rows[0].order_id}" style="background: #2D6A4F; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">View Return Details</a>
          </div>
        `),
      }).catch(err => console.error('[EMAIL] Failed to notify buyer of return address:', err.message));
    }

    res.json({ dispute: updated[0] });
  } catch (err) {
    console.error('Provide address error:', err);
    res.status(500).json({ error: 'Failed to provide return address' });
  }
});

// Buyer marks return as shipped
router.post('/:id/return-shipped', authenticateToken, async (req, res) => {
  try {
    const pool = req.app.get('db');
    const { returnTracking } = req.body;

    if (!returnTracking?.trim()) return res.status(400).json({ error: 'A tracking number is required' });

    const { rows } = await pool.query(
      `SELECT d.*, o.buyer_id, o.seller_id, o.id as order_id, l.title as listing_title
       FROM disputes d
       JOIN orders o ON d.order_id = o.id
       JOIN listings l ON o.listing_id = l.id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Dispute not found' });
    if (rows[0].buyer_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (rows[0].status !== 'open') return res.status(400).json({ error: 'Dispute is not ready for return shipping' });

    const { rows: updated } = await pool.query(
      `UPDATE disputes SET status = 'return_shipping', return_tracking = $1, return_shipped_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [returnTracking, req.params.id]
    );

    console.log(`[DISPUTE] Buyer shipped return for dispute #${req.params.id}, tracking: ${returnTracking}`);

    // Email the seller — return is on its way
    const { rows: seller } = await pool.query('SELECT name, email FROM users WHERE id = $1', [rows[0].seller_id]);
    const clientUrl = process.env.CLIENT_URL || 'https://parent2parent.co.za';

    if (seller.length) {
      const sellerFirstName = seller[0].name.split(' ')[0];
      sendBrevoEmail({
        to: seller[0].email,
        subject: `Return shipped for "${rows[0].listing_title}"`,
        html: emailWrapper(`
          <h2 style="color: #2D6A4F; font-size: 20px; margin: 0 0 16px;">Return is on its way</h2>
          <p style="color: #555; line-height: 1.6; margin: 0 0 8px;">Hi ${sellerFirstName},</p>
          <p style="color: #555; line-height: 1.6; margin: 0 0 16px;">
            The buyer has shipped the return for <strong>"${rows[0].listing_title}"</strong>.
          </p>
          ${returnTracking ? `
          <div style="background: #eff6ff; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>Tracking number:</strong> ${returnTracking}
            </p>
          </div>` : ''}
          <p style="color: #555; line-height: 1.6; margin: 0 0 16px;">
            Once you receive the item, please confirm receipt on the order page so we can process the refund.
          </p>
          <div style="text-align: center; margin: 24px 0 8px;">
            <a href="${clientUrl}/orders/${rows[0].order_id}" style="background: #2D6A4F; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">View Order</a>
          </div>
        `),
      }).catch(err => console.error('[EMAIL] Failed to notify seller of return shipped:', err.message));
    }

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

    console.log(`[DISPUTE] Seller confirmed return received for dispute #${req.params.id}`);

    // Alert admin — ready for refund decision
    sendAdminAlert({
      subject: `Return received — dispute #${req.params.id} ready for review`,
      body: `The seller has confirmed they received the returned item. Ready for your refund decision.`,
      context: { disputeId: req.params.id, orderId: rows[0].order_id },
    }).catch(() => {});

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
