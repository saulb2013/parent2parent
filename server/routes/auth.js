const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { sendBrevoEmail } = require('../utils/email');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, password, province, city, phone } = req.body;
  const db = req.app.get('db');

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password_hash, province, city, phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [name, email, password_hash, province || null, city || null, phone || null]
    );

    const user = { id: rows[0].id, name, email, primary_role: null };
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const db = req.app.get('db');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload = { id: user.id, name: user.name, email: user.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user: { ...payload, avatar_url: user.avatar_url, province: user.province, city: user.city, phone: user.phone, street_address: user.street_address, unit: user.unit, postal_code: user.postal_code, primary_role: user.primary_role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, avatar_url, province, city, phone, bio, street_address, unit, postal_code, primary_role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const db = req.app.get('db');

  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const { rows } = await db.query('SELECT id, name FROM users WHERE email = $1', [email]);

    // Always return success to prevent email enumeration
    if (!rows[0]) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, expires, rows[0].id]
    );

    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    // Send response immediately, email in background
    res.json({ message: 'If that email exists, a reset link has been sent.' });

    if (process.env.BREVO_API_KEY) {
      try {
        await sendBrevoEmail({
          to: email,
          subject: 'Reset your Parent2Parent password',
          html: `
            <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px;">
              <h2 style="color: #2D6A4F; font-size: 24px;">Reset Your Password</h2>
              <p style="color: #555; line-height: 1.6;">Hi ${rows[0].name},</p>
              <p style="color: #555; line-height: 1.6;">We received a request to reset your Parent2Parent password. Click the button below to choose a new one:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: #F4A261; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Reset Password</a>
              </div>
              <p style="color: #999; font-size: 13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #bbb; font-size: 12px;">Parent2Parent &mdash; Previously loved. Ready for more.</p>
            </div>
          `,
        });
        console.log(`[EMAIL] Reset email sent to ${email}`);
      } catch (emailErr) {
        console.error('[EMAIL] Failed to send reset email:', emailErr.message);
      }
    } else {
      console.log(`[DEV] Password reset link for ${email}: ${resetUrl}`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  const db = req.app.get('db');

  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const { rows } = await db.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });

    const password_hash = bcrypt.hashSync(password, 10);
    await db.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [password_hash, rows[0].id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
