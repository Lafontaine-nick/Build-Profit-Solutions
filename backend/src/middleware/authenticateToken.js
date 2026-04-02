const jwt = require('jsonwebtoken');

/**
 * Shared auth: backend JWT first, then Clerk JWT decode (same as auth.js / projects.js).
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (jwtError) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.sub) {
        let clerkEmail =
          decoded.email ||
          (typeof decoded.primary_email_address === 'string'
            ? decoded.primary_email_address
            : null);
        if (!clerkEmail && Array.isArray(decoded.email_addresses)) {
          clerkEmail =
            decoded.email_addresses[0]?.email_address || null;
        }
        req.user = {
          userId: decoded.sub,
          email: clerkEmail,
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
