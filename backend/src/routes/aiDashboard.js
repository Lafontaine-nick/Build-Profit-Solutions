const express = require('express');
const router = express.Router();
const { buildAiDashboardForUser } = require('../services/aiDashboardService');
const { authenticateToken } = require('../middleware/authenticateToken');

/**
 * POST /api/ai/dashboard-insights
 * Generate AI insights and next steps for the user's dashboard
 */
router.post('/dashboard-insights', authenticateToken, async (req, res) => {
  try {
    // Prefer authenticated user id if available
    const authUserId = req.user?.userId || req.user?.id || req.user?.sub;
    const bodyUserId = req.body.userId;

    const userId = authUserId || bodyUserId;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Get projects from request body if provided (from mobile app)
    const projectsFromRequest = req.body.projects || null;
    /** Closed jobs — retrospective net-profit lines only (mobile sends separately from pipeline) */
    const completedSummaries = req.body.completedSummaries || null;

    // Check if user wants to force refresh (bypass cache)
    const forceRefresh = req.body.forceRefresh === true || req.query.forceRefresh === 'true';

    const data = await buildAiDashboardForUser(
      userId,
      projectsFromRequest,
      forceRefresh,
      completedSummaries
    );
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

