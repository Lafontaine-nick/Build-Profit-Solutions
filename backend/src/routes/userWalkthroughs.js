const express = require('express');
const { getPool } = require('../services/database');
const { authenticateToken } = require('../middleware/authenticateToken');

const router = express.Router();

function defaultWalkthroughs() {
  return {
    appOnboarding: { status: 'not_started', version: 0, updatedAt: null },
    firstEstimate: { status: 'not_started', version: 0, updatedAt: null },
    firstProject: { status: 'not_started', version: 0, updatedAt: null },
  };
}

function mergeWalkthroughDefaults(stored) {
  const d = defaultWalkthroughs();
  const w = stored && typeof stored === 'object' ? stored : {};
  return {
    appOnboarding: { ...d.appOnboarding, ...(w.appOnboarding || {}) },
    firstEstimate: { ...d.firstEstimate, ...(w.firstEstimate || {}) },
    firstProject: { ...d.firstProject, ...(w.firstProject || {}) },
  };
}

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_walkthrough_state (
      user_id VARCHAR(255) PRIMARY KEY,
      walkthroughs JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = getPool();

    if (!pool) {
      return res.json({
        success: true,
        serverPersisted: false,
        walkthroughs: defaultWalkthroughs(),
      });
    }

    await ensureTable(pool);

    const result = await pool.query(
      'SELECT walkthroughs, updated_at FROM user_walkthrough_state WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        serverPersisted: true,
        walkthroughs: defaultWalkthroughs(),
      });
    }

    const row = result.rows[0];
    return res.json({
      success: true,
      serverPersisted: true,
      walkthroughs: mergeWalkthroughDefaults(row.walkthroughs),
    });
  } catch (error) {
    console.error('GET walkthrough-state error:', error);
    return res.status(500).json({ error: 'Failed to load walkthrough state' });
  }
});

/**
 * PATCH body: { walkthroughs?: { appOnboarding?, firstEstimate?, firstProject? } }
 * Each partial entry merges by key (status, version, updatedAt).
 */
router.patch('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const incoming = req.body?.walkthroughs;
    const pool = getPool();

    if (!pool) {
      const merged = mergeWalkthroughDefaults(incoming);
      return res.json({
        success: true,
        serverPersisted: false,
        walkthroughs: merged,
      });
    }

    await ensureTable(pool);

    const existing = await pool.query(
      'SELECT walkthroughs FROM user_walkthrough_state WHERE user_id = $1',
      [userId]
    );

    let merged =
      existing.rows.length > 0
        ? mergeWalkthroughDefaults(existing.rows[0].walkthroughs)
        : defaultWalkthroughs();

    if (incoming && typeof incoming === 'object') {
      for (const key of ['appOnboarding', 'firstEstimate', 'firstProject']) {
        if (incoming[key] && typeof incoming[key] === 'object') {
          merged[key] = { ...merged[key], ...incoming[key] };
        }
      }
    }

    await pool.query(
      `INSERT INTO user_walkthrough_state (user_id, walkthroughs, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         walkthroughs = EXCLUDED.walkthroughs,
         updated_at = NOW()`,
      [userId, JSON.stringify(merged)]
    );

    return res.json({
      success: true,
      serverPersisted: true,
      walkthroughs: merged,
    });
  } catch (error) {
    console.error('PATCH walkthrough-state error:', error);
    return res.status(500).json({ error: 'Failed to update walkthrough state' });
  }
});

module.exports = router;
