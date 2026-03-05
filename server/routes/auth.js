const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

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

    const user = { id: rows[0].id, name, email };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });

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

    res.json({ user: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, avatar_url, province, city, phone, bio, created_at FROM users WHERE id = $1',
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

module.exports = router;
