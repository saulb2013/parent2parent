const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'parent2parent-dev-secret-key-change-in-production';

function authenticateToken(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const token = req.cookies?.token;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // Token invalid, continue without auth
    }
  }
  next();
}

module.exports = { authenticateToken, optionalAuth, JWT_SECRET };
