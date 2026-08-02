const jwt = require('jsonwebtoken');

/**
 * Shared auth: backend JWT first, then Clerk JWT decode (same as auth.js / projects.js).
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
    try {
      const secretKey = String(process.env.CLERK_SECRET_KEY || '').trim();
      if (!secretKey || secretKey.includes('your_')) {
        return res.status(503).json({ error: 'Authentication provider is not configured' });
      }
      const { verifyToken } = require('@clerk/backend');
      const decoded = await verifyToken(token, { secretKey });
      if (decoded && decoded.sub) {
        const clerkEmail =
          decoded.email ||
          (typeof decoded.primary_email_address === 'string'
            ? decoded.primary_email_address
            : null);
        req.user = {
          userId: decoded.sub,
          email: clerkEmail || headerEmail,
          role: decoded.role || 'contractor',
        };
        return next();
      }
    } catch (clerkError) {
      console.error('Clerk token decode error:', clerkError.message);
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticateToken };
