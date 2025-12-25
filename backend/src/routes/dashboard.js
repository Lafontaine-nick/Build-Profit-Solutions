const express = require('express');
const router = express.Router();
const { getDashboardMetrics } = require('../services/dashboardService');

// Middleware to verify JWT token (same as projects route)
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

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

