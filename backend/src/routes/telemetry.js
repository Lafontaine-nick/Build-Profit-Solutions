const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/authenticateToken');
const { getPool } = require('../services/database');

function telemetryEnabled() {
  return process.env.APP_TELEMETRY_ENABLED === 'true';
}

router.post(
  '/event',
  authenticateToken,
  [
    body('event').trim().isLength({ min: 1, max: 128 }),
    body('properties').optional().isObject(),
    body('appVersion').optional().trim().isLength({ max: 64 }),
    body('platform').optional().trim().isLength({ max: 32 }),
  ],
  async (req, res) => {
    if (!telemetryEnabled()) {
      return res.json({ success: true, skipped: true });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = req.user.userId || req.user.id || null;
    const { event, properties, appVersion, platform } = req.body;

    console.log(
      '[telemetry]',
      JSON.stringify({
        event,
        userId,
        t: new Date().toISOString(),
        props: properties || {},
      })
    );

    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO app_telemetry_events (user_id, event_name, properties, app_version, platform)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        [
          userId,
          event,
          properties && typeof properties === 'object' ? properties : {},
          appVersion || null,
          platform || null,
        ]
      );
    } catch (e) {
      if (e.code !== '42P01') {
        console.warn('telemetry insert failed:', e.message);
      }
    }

    return res.json({ success: true });
  }
);

module.exports = router;
