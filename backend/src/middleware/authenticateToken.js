const jwt = require('jsonwebtoken');

function userFromClerkJwt(decoded, headerEmail) {
  if (!decoded || !decoded.sub) return null;
  const clerkEmail =
    decoded.email ||
    (typeof decoded.primary_email_address === 'string'
      ? decoded.primary_email_address
      : null);
  return {
    userId: decoded.sub,
    email: clerkEmail || headerEmail,
    role: decoded.role || 'contractor',
  };
}

/**
 * Shared auth: backend JWT first, then Clerk (verify when online, decode fallback).
 * Matches projects.js / contractorPricingMemory.js so AI routes work in local dev
 * when Clerk's remote verify endpoint is unreachable.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  const headerEmail =
    typeof req.headers['x-bps-user-email'] === 'string'
      ? req.headers['x-bps-user-email'].trim().toLowerCase()
      : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      ...decoded,
      email: decoded.email || headerEmail,
    };
    return next();
  } catch (jwtError) {
    const secretKey = String(process.env.CLERK_SECRET_KEY || '').trim();
    if (!secretKey || secretKey.includes('your_')) {
      return res.status(503).json({ error: 'Authentication provider is not configured' });
    }

    try {
      const { verifyToken } = require('@clerk/backend');
      const decoded = await verifyToken(token, { secretKey });
      const user = userFromClerkJwt(decoded, headerEmail);
      if (user) {
        req.user = user;
        return next();
      }
    } catch (clerkError) {
      console.error('Clerk token verify error:', clerkError.message);
      // Local dev fallback: Clerk session tokens are JWTs; decode `sub` when
      // verifyToken cannot reach Clerk (offline Mac, proxy, DNS, etc.).
      const decoded = jwt.decode(token);
      const user = userFromClerkJwt(decoded, headerEmail);
      if (user) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Clerk verify unavailable; accepted decoded Clerk JWT for local dev');
        }
        req.user = user;
        return next();
      }
    }

    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticateToken };
