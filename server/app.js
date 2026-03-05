const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const pool = require('./db/database');

const authRoutes = require('./routes/auth');
const listingsRoutes = require('./routes/listings');
const usersRoutes = require('./routes/users');
const categoriesRoutes = require('./routes/categories');

const app = express();

app.set('db', pool);

// Middleware
const allowedOrigins = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);

// Serve React frontend in production
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuild));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;
