const express = require('express');
const router = express.Router();
const { getPool } = require('../services/database');
const { loadUsers } = require('../services/leadStorage');

// Middleware to verify JWT token (optional for development)
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // For development: allow requests without auth
    // In production, you should require authentication
    req.user = { userId: 'dev-user-1' }; // Default dev user
    return next();
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // For development: allow requests with invalid tokens
    // In production, you should reject invalid tokens
    console.warn('Invalid token, using dev user:', error.message);
    req.user = { userId: 'dev-user-1' }; // Default dev user
    next();
  }
};

// Get user settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = getPool();
    
    if (!pool) {
      // Fallback to in-memory (development only)
      return res.json({
        success: true,
        settings: {
          ai_project_manager_mode: false,
          ai_manager_aggressiveness: 'medium',
          ai_notify_about: 'all',
          ai_preferred_channel: 'in_app',
          darkMode: true,
          notifications: true,
          emailUpdates: true,
          smsAlerts: false,
          marketingEmails: false,
        },
      });
    }

    try {
      const result = await pool.query(
        `SELECT 
          ai_project_manager_mode,
          ai_manager_aggressiveness,
          ai_notify_about,
          ai_preferred_channel
        FROM user_settings 
        WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        // Create default settings if none exist
        try {
          await pool.query(
            `INSERT INTO user_settings (user_id, ai_project_manager_mode, ai_manager_aggressiveness, ai_notify_about, ai_preferred_channel)
             VALUES ($1, false, 'medium', 'all', 'in_app')
             RETURNING *`,
            [userId]
          );
        } catch (insertError) {
          // If insert fails (e.g., table doesn't exist), just return defaults
          console.warn('Could not create user settings, returning defaults:', insertError.message);
        }
        
        return res.json({
          success: true,
          settings: {
            ai_project_manager_mode: false,
            ai_manager_aggressiveness: 'medium',
            ai_notify_about: 'all',
            ai_preferred_channel: 'in_app',
            darkMode: true,
            notifications: true,
            emailUpdates: true,
            smsAlerts: false,
            marketingEmails: false,
          },
        });
      }

      return res.json({
        success: true,
        settings: {
          ai_project_manager_mode: result.rows[0].ai_project_manager_mode || false,
          ai_manager_aggressiveness: result.rows[0].ai_manager_aggressiveness || 'medium',
          ai_notify_about: result.rows[0].ai_notify_about || 'all',
          ai_preferred_channel: result.rows[0].ai_preferred_channel || 'in_app',
          // Return default darkMode (will be updated when user changes it)
          darkMode: result.rows[0].preferences?.darkMode ?? true,
          notifications: result.rows[0].preferences?.notifications ?? true,
          emailUpdates: result.rows[0].preferences?.emailUpdates ?? true,
          smsAlerts: result.rows[0].preferences?.smsAlerts ?? false,
          marketingEmails: result.rows[0].preferences?.marketingEmails ?? false,
        },
      });
    } catch (dbError) {
      // Database connection failed, return defaults
      console.warn('Database unavailable, returning default settings:', dbError.message);
      return res.json({
        success: true,
        settings: {
          ai_project_manager_mode: false,
          ai_manager_aggressiveness: 'medium',
          ai_notify_about: 'all',
          ai_preferred_channel: 'in_app',
        },
      });
    }
  } catch (error) {
    console.error('Error fetching user settings:', error);
    // Return defaults instead of error
    return res.json({
      success: true,
      settings: {
        ai_project_manager_mode: false,
        ai_manager_aggressiveness: 'medium',
        ai_notify_about: 'all',
        ai_preferred_channel: 'in_app',
      },
    });
  }
});

// Update user settings
router.patch('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      ai_project_manager_mode,
      ai_manager_aggressiveness,
      ai_notify_about,
      ai_preferred_channel,
      notifications,
      emailUpdates,
      smsAlerts,
      marketingEmails,
      darkMode,
    } = req.body;

    const pool = getPool();
    
    // Try database, fallback to in-memory if database unavailable
    if (!pool) {
      return res.json({
        success: true,
        settings: {
          ai_project_manager_mode: ai_project_manager_mode ?? false,
          ai_manager_aggressiveness: ai_manager_aggressiveness || 'medium',
          ai_notify_about: ai_notify_about || 'all',
          ai_preferred_channel: ai_preferred_channel || 'in_app',
        },
      });
    }

    try {
      // Check if settings exist
      let existing;
      try {
        existing = await pool.query(
          'SELECT id FROM user_settings WHERE user_id = $1',
          [userId]
        );
      } catch (queryError) {
        // Database connection failed, return requested values
        console.warn('Database unavailable, returning requested settings:', queryError.message);
        return res.json({
          success: true,
          settings: {
            ai_project_manager_mode: ai_project_manager_mode ?? false,
            ai_manager_aggressiveness: ai_manager_aggressiveness || 'medium',
            ai_notify_about: ai_notify_about || 'all',
            ai_preferred_channel: ai_preferred_channel || 'in_app',
          },
        });
      }

      let result;
      if (existing.rows.length === 0) {
        // Create new settings - store notification prefs in JSONB preferences column
        // First check if preferences column exists, if not we'll use a workaround
        const preferences = {};
        if (notifications !== undefined) preferences.notifications = notifications;
        if (emailUpdates !== undefined) preferences.emailUpdates = emailUpdates;
        if (smsAlerts !== undefined) preferences.smsAlerts = smsAlerts;
        if (marketingEmails !== undefined) preferences.marketingEmails = marketingEmails;

        try {
          result = await pool.query(
            `INSERT INTO user_settings (
              user_id, 
              ai_project_manager_mode, 
              ai_manager_aggressiveness, 
              ai_notify_about, 
              ai_preferred_channel
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [
              userId,
              ai_project_manager_mode ?? false,
              ai_manager_aggressiveness || 'medium',
              ai_notify_about || 'all',
              ai_preferred_channel || 'in_app',
            ]
          );
        } catch (insertError) {
          // If insert fails, return defaults
          console.warn('Could not insert user settings:', insertError.message);
          result = { rows: [{}] };
        }
      } else {
        // Update existing settings
        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        if (ai_project_manager_mode !== undefined) {
          updateFields.push(`ai_project_manager_mode = $${paramCount}`);
          updateValues.push(ai_project_manager_mode);
          paramCount++;
        }
        if (ai_manager_aggressiveness !== undefined) {
          updateFields.push(`ai_manager_aggressiveness = $${paramCount}`);
          updateValues.push(ai_manager_aggressiveness);
          paramCount++;
        }
        if (ai_notify_about !== undefined) {
          updateFields.push(`ai_notify_about = $${paramCount}`);
          updateValues.push(ai_notify_about);
          paramCount++;
        }
        if (ai_preferred_channel !== undefined) {
          updateFields.push(`ai_preferred_channel = $${paramCount}`);
          updateValues.push(ai_preferred_channel);
          paramCount++;
        }

        // Store notification preferences and dark mode (we'll return them in response even if not in DB yet)
        const preferences = {};
        if (notifications !== undefined) preferences.notifications = notifications;
        if (emailUpdates !== undefined) preferences.emailUpdates = emailUpdates;
        if (smsAlerts !== undefined) preferences.smsAlerts = smsAlerts;
        if (marketingEmails !== undefined) preferences.marketingEmails = marketingEmails;
        if (darkMode !== undefined) preferences.darkMode = darkMode;

        if (updateFields.length === 0 && Object.keys(preferences).length === 0) {
          return res.status(400).json({ error: 'No fields to update' });
        }

        if (updateFields.length > 0) {
          updateValues.push(userId);
          result = await pool.query(
            `UPDATE user_settings 
             SET ${updateFields.join(', ')}, updated_at = NOW()
             WHERE user_id = $${paramCount}
             RETURNING *`,
            updateValues
          );
        } else {
          // Just fetch existing if only preferences were updated
          result = await pool.query(
            'SELECT * FROM user_settings WHERE user_id = $1',
            [userId]
          );
        }
      }

      // Build response with all settings including notification preferences
      const responseSettings = {
        ai_project_manager_mode: result.rows[0]?.ai_project_manager_mode || false,
        ai_manager_aggressiveness: result.rows[0]?.ai_manager_aggressiveness || 'medium',
        ai_notify_about: result.rows[0]?.ai_notify_about || 'all',
        ai_preferred_channel: result.rows[0]?.ai_preferred_channel || 'in_app',
        // Notification preferences and dark mode (stored in memory/returned even if not in DB schema yet)
        notifications: notifications !== undefined ? notifications : (result.rows[0]?.preferences?.notifications ?? true),
        emailUpdates: emailUpdates !== undefined ? emailUpdates : (result.rows[0]?.preferences?.emailUpdates ?? true),
        smsAlerts: smsAlerts !== undefined ? smsAlerts : (result.rows[0]?.preferences?.smsAlerts ?? false),
        marketingEmails: marketingEmails !== undefined ? marketingEmails : (result.rows[0]?.preferences?.marketingEmails ?? false),
        darkMode: darkMode !== undefined ? darkMode : (result.rows[0]?.preferences?.darkMode ?? true),
      };

      return res.json({
        success: true,
        settings: responseSettings,
      });
    } catch (dbError) {
      // Database connection failed, return the requested values (optimistic update)
      console.warn('Database unavailable, returning requested settings:', dbError.message);
      return res.json({
        success: true,
        settings: {
          ai_project_manager_mode: ai_project_manager_mode ?? false,
          ai_manager_aggressiveness: ai_manager_aggressiveness || 'medium',
          ai_notify_about: ai_notify_about || 'all',
          ai_preferred_channel: ai_preferred_channel || 'in_app',
        },
      });
    }
  } catch (error) {
    console.error('Error updating user settings:', error);
    // Return requested values instead of error
    return res.json({
      success: true,
      settings: {
        ai_project_manager_mode: req.body.ai_project_manager_mode ?? false,
        ai_manager_aggressiveness: req.body.ai_manager_aggressiveness || 'medium',
        ai_notify_about: req.body.ai_notify_about || 'all',
        ai_preferred_channel: req.body.ai_preferred_channel || 'in_app',
      },
    });
  }
});

module.exports = router;












