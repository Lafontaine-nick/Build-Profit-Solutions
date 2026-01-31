const express = require('express');
const router = express.Router();
const { buildAiDashboardForUser } = require('../services/aiDashboardService');

// Middleware to verify JWT token (optional - allows userId from body in development)
const authenticateTokenOptional = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      // If token is invalid, continue without auth (for development)
      // In production, you might want to return 403 here
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
    }
  }
  // Continue even without token (allows userId from body)
  next();
};


/**
 * POST /api/ai/dashboard-insights
 * Generate AI insights and next steps for the user's dashboard
 */
router.post('/dashboard-insights', authenticateTokenOptional, async (req, res) => {
  try {
    // Prefer authenticated user id if available
    const authUserId = req.user?.userId || req.user?.id;
    const bodyUserId = req.body.userId;

    const userId = authUserId || bodyUserId;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Get projects from request body if provided (from mobile app)
    const projectsFromRequest = req.body.projects || null;
    
    // Check if user wants to force refresh (bypass cache)
    const forceRefresh = req.body.forceRefresh === true || req.query.forceRefresh === 'true';

    const data = await buildAiDashboardForUser(userId, projectsFromRequest, forceRefresh);
    return res.json(data);
  } catch (err) {
    console.error('Error in /api/ai/dashboard-insights:', err);
    
    // Handle specific error types
    if (err.message && err.message.includes('OpenAI API key')) {
      return res.status(503).json({
        error: 'AI service unavailable',
        message: err.message,
        details: 'Please configure OPENAI_API_KEY in your backend .env file',
      });
    }
    
    return res.status(500).json({
      error: 'Failed to generate AI dashboard insights',
      message: err.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

module.exports = router;

