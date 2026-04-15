const crypto = require('crypto');

// Sign a short, unguessable token that proves the holder knows this
// order's id. Used in "track my order" email links so recipients can
// open the tracking page without logging in.
//
// The token is derived purely from the order id and JWT_SECRET — no
// DB column required, no expiry (the email is the only place it ever
// leaves our system). Rotating JWT_SECRET invalidates every token,
// which is the right behaviour.
function signOrderToken(orderId) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`order:${orderId}`)
    .digest('base64url');
}

function verifyOrderToken(orderId, token) {
  if (!token) return false;
  try {
    const expected = signOrderToken(orderId);
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = { signOrderToken, verifyOrderToken };
