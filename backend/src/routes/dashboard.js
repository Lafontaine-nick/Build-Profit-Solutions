const express = require('express');
const router = express.Router();
const { getDashboardMetrics } = require('../services/dashboardService');
const { authenticateToken } = require('../middleware/authenticateToken');

// Get dashboard metrics
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: 'Unauthorized' 
      });
    }

    const metrics = getDashboardMetrics(userId);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to load dashboard metrics' 
    });
  }
});

module.exports = router;

