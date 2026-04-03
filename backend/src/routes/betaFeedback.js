const express = require('express');
const router = express.Router();
const { body, validationResult, query, param } = require('express-validator');
const { authenticateToken } = require('../middleware/authenticateToken');
const { getPool } = require('../services/database');

const MAX_SCREENSHOT_CHARS = 1_800_000; // ~1.3MB base64 guard

function intakeEnabled() {
  return process.env.BETA_FEEDBACK_INTAKE_ENABLED === 'true';
}

function requireAdminKey(req, res, next) {
  const expected = process.env.BETA_FEEDBACK_ADMIN_KEY;
  const got = req.headers['x-beta-feedback-admin-key'];
  if (!expected || !got || got !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.post(
  '/',
  authenticateToken,
  [
    body('feedbackType').trim().isLength({ min: 1, max: 64 }),
    body('description').trim().isLength({ min: 1, max: 20000 }),
    body('severity').optional().trim().isLength({ max: 32 }),
    body('intendedAction').optional().trim().isLength({ max: 2000 }),
    body('expectedResult').optional().trim().isLength({ max: 2000 }),
    body('screenshotData').optional().isString(),
    body('routeName').optional().trim().isLength({ max: 512 }),
    body('featureArea').optional().trim().isLength({ max: 64 }),
    body('projectId').optional().trim().isLength({ max: 128 }),
    body('estimateId').optional().trim().isLength({ max: 128 }),
    body('aiContextFlag').optional().isBoolean(),
    body('appVersion').optional().trim().isLength({ max: 64 }),
    body('platform').optional().trim().isLength({ max: 32 }),
    body('deviceInfo').optional().trim().isLength({ max: 2000 }),
    body('email').optional().trim().isLength({ max: 255 }),
    body('metadata').optional().isObject(),
  ],
  async (req, res) => {
    if (!intakeEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'Beta feedback intake is disabled',
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    let screenshot = req.body.screenshotData || null;
    if (screenshot && screenshot.length > MAX_SCREENSHOT_CHARS) {
      screenshot = null;
    }

    const userId = req.user.userId || req.user.id || null;
    const email = req.body.email || req.user.email || null;

    const row = {
      user_id: userId,
      email,
      feedback_type: req.body.feedbackType,
      severity: req.body.severity || null,
      description: req.body.description,
      intended_action: req.body.intendedAction || null,
      expected_result: req.body.expectedResult || null,
      screenshot_data: screenshot,
      route_name: req.body.routeName || null,
      feature_area: req.body.featureArea || null,
      project_id: req.body.projectId || null,
      estimate_id: req.body.estimateId || null,
      ai_context_flag: Boolean(req.body.aiContextFlag),
      app_version: req.body.appVersion || null,
      platform: req.body.platform || null,
      device_info: req.body.deviceInfo || null,
      metadata: req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : null,
    };

    try {
      const pool = getPool();
      const r = await pool.query(
        `INSERT INTO beta_feedback (
          user_id, email, feedback_type, severity, description,
          intended_action, expected_result, screenshot_data,
          route_name, feature_area, project_id, estimate_id,
          ai_context_flag, app_version, platform, device_info, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
        RETURNING id, created_at`,
        [
          row.user_id,
          row.email,
          row.feedback_type,
          row.severity,
          row.description,
          row.intended_action,
          row.expected_result,
          row.screenshot_data,
          row.route_name,
          row.feature_area,
          row.project_id,
          row.estimate_id,
          row.ai_context_flag,
          row.app_version,
          row.platform,
          row.device_info,
          row.metadata,
        ]
      );
      return res.status(201).json({
        success: true,
        id: r.rows[0].id,
        createdAt: r.rows[0].created_at,
      });
    } catch (e) {
      console.error('beta_feedback insert error:', e.message);
      if (e.code === '42P01') {
        return res.status(503).json({
          success: false,
          error: 'Feedback storage not initialized (run database/beta_feedback.sql)',
        });
      }
      return res.status(500).json({ success: false, error: 'Failed to save feedback' });
    }
  }
);

/**
 * Single row including screenshot_data (data URL). Use after listing with /review.
 * GET /api/beta-feedback/review/detail/:id
 */
router.get(
  '/review/detail/:id',
  requireAdminKey,
  [param('id').isInt({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const id = parseInt(req.params.id, 10);
    try {
      const pool = getPool();
      const r = await pool.query(
        `SELECT id, user_id, email, feedback_type, severity, description,
                intended_action, expected_result, screenshot_data,
                CASE WHEN screenshot_data IS NOT NULL THEN true ELSE false END AS has_screenshot,
                route_name, feature_area, project_id, estimate_id, ai_context_flag,
                app_version, platform, device_info, metadata, status, created_at
         FROM beta_feedback WHERE id = $1`,
        [id]
      );
      if (!r.rows.length) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      return res.json({ success: true, item: r.rows[0] });
    } catch (e) {
      console.error('beta_feedback review detail error:', e.message);
      return res.status(500).json({ success: false, error: e.message });
    }
  }
);

router.get(
  '/review',
  requireAdminKey,
  [
    query('status').optional().trim(),
    query('type').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 200 }),
  ],
  async (req, res) => {
    const status = req.query.status;
    const type = req.query.type;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    try {
      const pool = getPool();
      const conditions = [];
      const params = [];
      let i = 1;
      if (status) {
        conditions.push(`status = $${i++}`);
        params.push(status);
      }
      if (type) {
        conditions.push(`feedback_type = $${i++}`);
        params.push(type);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      params.push(limit);
      const r = await pool.query(
        `SELECT id, user_id, email, feedback_type, severity, description,
                intended_action, expected_result,
                CASE WHEN screenshot_data IS NOT NULL THEN true ELSE false END AS has_screenshot,
                route_name, feature_area, project_id, estimate_id, ai_context_flag,
                app_version, platform, device_info, metadata, status, created_at
         FROM beta_feedback ${where}
         ORDER BY created_at DESC
         LIMIT $${i}`,
        params
      );
      return res.json({ success: true, items: r.rows, count: r.rows.length });
    } catch (e) {
      console.error('beta_feedback review error:', e.message);
      return res.status(500).json({ success: false, error: e.message });
    }
  }
);

module.exports = router;
