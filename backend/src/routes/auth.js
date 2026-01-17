const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getPool } = require('../services/database');
const { loadUsers, saveUsers, loadProjects, saveProjects, loadProjectLeads, saveProjectLeads, loadUnifiedLeads, saveUnifiedLeads } = require('../services/leadStorage');

// Initialize Stripe only if configured
let stripe = null;
if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('your_stripe_secret_key')) {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  } catch (error) {
    console.warn('⚠️  Stripe not configured, subscription cancellation will be skipped');
  }
}

// Load users from disk on startup (persists across server restarts)
let inMemoryUsers = loadUsers();
console.log(`📦 Loaded ${inMemoryUsers.size} users from disk`);

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// User signup
router.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().isLength({ min: 1 }),
  body('lastName').trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { email, password, firstName, lastName } = req.body;
    
    // Check if JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const pool = getPool();
    let useInMemory = false;
    
    // Try to use database, fallback to in-memory if database fails
    if (!pool) {
      console.warn('⚠️  Database pool not initialized, using in-memory storage (development only)');
      useInMemory = true;
    }

    let user;
    
    if (useInMemory) {
      // In-memory user storage (development only)
      if (inMemoryUsers.has(email)) {
        return res.status(409).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user in memory
      const userId = Date.now().toString();
      user = {
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        firstName,
        lastName,
        role: 'contractor',
        created_at: new Date().toISOString()
      };

      inMemoryUsers.set(email, {
        ...user,
        password_hash: hashedPassword
      });

      // Save to disk
      saveUsers(inMemoryUsers);

      console.log(`✅ User created and saved: ${email} (${inMemoryUsers.size} total users)`);
    } else {
      // Database user storage
      // Check if user already exists
      let existingUser;
      try {
        existingUser = await pool.query(
          'SELECT id FROM users WHERE email = $1',
          [email]
        );
      } catch (dbError) {
        console.error('Database query error:', dbError);
        console.warn('⚠️  Falling back to in-memory storage (development only)');
        useInMemory = true;
        
        // Fallback to in-memory
        if (inMemoryUsers.has(email)) {
          return res.status(409).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const userId = Date.now().toString();
        user = {
          id: userId,
          email,
          first_name: firstName,
          last_name: lastName,
          firstName,
          lastName,
          role: 'contractor',
          created_at: new Date().toISOString()
        };

        inMemoryUsers.set(email, {
          ...user,
          password_hash: hashedPassword
        });

        // Save to disk
        saveUsers(inMemoryUsers);

        console.log(`✅ User created and saved (fallback): ${email}`);
      }

      if (!useInMemory) {
        if (existingUser.rows.length > 0) {
          return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        let newUser;
        try {
          newUser = await pool.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, role, created_at) 
             VALUES ($1, $2, $3, $4, $5, NOW()) 
             RETURNING id, email, first_name, last_name, role, created_at`,
            [email, hashedPassword, firstName, lastName, 'contractor']
          );
        } catch (dbError) {
          console.error('Database insert error:', dbError);
          // Check if it's a duplicate key error
          if (dbError.code === '23505') {
            return res.status(409).json({ error: 'User already exists' });
          }
          return res.status(500).json({ 
            error: 'Database error',
            message: dbError.message || 'Failed to create user. Please check database connection and schema.'
          });
        }

        user = newUser.rows[0];
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    delete user.password_hash;

    res.status(201).json({
      success: true,
      user,
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    // Return more specific error messages in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error.message || 'Internal server error'
      : 'Internal server error';
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        hint: error.hint
      } : undefined
    });
  }
});

// User signin
router.post('/signin', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { email, password } = req.body;
    const pool = getPool();
    let useInMemory = false;
    let userData;

    // Try database first, fallback to in-memory
    if (!pool) {
      useInMemory = true;
    }

    if (useInMemory) {
      // Reload users from disk to ensure we have the latest data
      inMemoryUsers = loadUsers();
      console.log(`🔍 Checking signin for: ${email} (${inMemoryUsers.size} users loaded)`);
      console.log(`📋 Available users:`, Array.from(inMemoryUsers.keys()));
      
      // Check in-memory storage
      const storedUser = inMemoryUsers.get(email);
      if (!storedUser) {
        console.log(`❌ User not found: ${email}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      console.log(`✅ User found: ${email}, checking password...`);

      // Check password
      const isValidPassword = await bcrypt.compare(password, storedUser.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      userData = {
        id: storedUser.id,
        email: storedUser.email,
        first_name: storedUser.first_name || storedUser.firstName,
        last_name: storedUser.last_name || storedUser.lastName,
        firstName: storedUser.first_name || storedUser.firstName,
        lastName: storedUser.last_name || storedUser.lastName,
        role: storedUser.role || 'contractor'
      };
    } else {
      // Try database
      let user;
      try {
        user = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );
      } catch (dbError) {
        console.error('Database query error:', dbError);
        console.warn('⚠️  Falling back to in-memory storage');
        
        // Fallback to in-memory
        const storedUser = inMemoryUsers.get(email);
        if (!storedUser) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, storedUser.password_hash);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        userData = {
          id: storedUser.id,
          email: storedUser.email,
          first_name: storedUser.first_name || storedUser.firstName,
          last_name: storedUser.last_name || storedUser.lastName,
          firstName: storedUser.first_name || storedUser.firstName,
          lastName: storedUser.last_name || storedUser.lastName,
          role: storedUser.role || 'contractor'
        };
      }

      if (!userData) {
        if (user.rows.length === 0) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        userData = user.rows[0];

        // Check password
        const isValidPassword = await bcrypt.compare(password, userData.password_hash);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: userData.id, 
        email: userData.email,
        role: userData.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove password from response
    delete userData.password_hash;

    res.json({
      success: true,
      user: userData,
      token
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const user = await pool.query(
      'SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: user.rows[0]
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('name').optional().trim(),
  body('company').optional().trim(),
  body('phone').optional().trim(),
  body('location').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { firstName, lastName, name, company, phone, location } = req.body;
    const pool = getPool();
    let useInMemory = false;

    if (!pool) {
      useInMemory = true;
    }

    // Handle name field - split into firstName/lastName if provided
    let finalFirstName = firstName;
    let finalLastName = lastName;
    if (name && !firstName && !lastName) {
      const nameParts = name.trim().split(' ');
      finalFirstName = nameParts[0] || '';
      finalLastName = nameParts.slice(1).join(' ') || '';
    }

    if (useInMemory) {
      // Update in-memory storage
      inMemoryUsers = loadUsers();
      let userFound = false;
      
      for (const [email, userData] of inMemoryUsers.entries()) {
        if (userData.id === req.user.userId) {
          if (finalFirstName) userData.first_name = finalFirstName;
          if (finalLastName) userData.last_name = finalLastName;
          if (name) userData.name = name;
          if (company) userData.company = company;
          if (phone) userData.phone = phone;
          if (location) userData.location = location;
          
          inMemoryUsers.set(email, userData);
          saveUsers(inMemoryUsers);
          userFound = true;
          
          const updatedUser = {
            id: userData.id,
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            name: userData.name || `${userData.first_name} ${userData.last_name}`,
            company: userData.company,
            phone: userData.phone,
            location: userData.location,
            role: userData.role,
          };
          
          return res.json({
            success: true,
            user: updatedUser
          });
        }
      }
      
      if (!userFound) {
        return res.status(404).json({ error: 'User not found' });
      }
    } else {
      // Update database
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (finalFirstName) {
        updateFields.push(`first_name = $${paramCount}`);
        updateValues.push(finalFirstName);
        paramCount++;
      }

      if (finalLastName) {
        updateFields.push(`last_name = $${paramCount}`);
        updateValues.push(finalLastName);
        paramCount++;
      }

      // Store additional fields in user_settings as JSONB
      // First check if we need to update user_settings
      if (company || phone || location || name) {
        try {
          // Check if user_settings exists
          const settingsCheck = await pool.query(
            'SELECT id FROM user_settings WHERE user_id = $1',
            [req.user.userId]
          );

          const profileData = {};
          if (company) profileData.company = company;
          if (phone) profileData.phone = phone;
          if (location) profileData.location = location;
          if (name) profileData.name = name;

          if (settingsCheck.rows.length > 0) {
            // Update existing settings with profile data
            await pool.query(
              `UPDATE user_settings 
               SET updated_at = NOW()
               WHERE user_id = $1`,
              [req.user.userId]
            );
            // Store in a separate profile_data column if it exists, or we'll add it to user_settings JSONB
            // For now, we'll store it separately - this would require schema update
            // As a workaround, we'll return it in the response
          } else {
            // Create user_settings if it doesn't exist
            await pool.query(
              `INSERT INTO user_settings (user_id, ai_project_manager_mode, ai_manager_aggressiveness, ai_notify_about, ai_preferred_channel)
               VALUES ($1, false, 'medium', 'all', 'in_app')
               ON CONFLICT (user_id) DO NOTHING`,
              [req.user.userId]
            );
          }
        } catch (settingsError) {
          console.warn('Could not update user_settings:', settingsError.message);
          // Continue with user update even if settings update fails
        }
      }

      if (updateFields.length === 0 && !company && !phone && !location && !name) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      let updatedUser;
      if (updateFields.length > 0) {
        updateValues.push(req.user.userId);
        const result = await pool.query(
          `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() 
           WHERE id = $${paramCount} 
           RETURNING id, email, first_name, last_name, role, created_at, updated_at`,
          updateValues
        );
        updatedUser = result.rows[0];
      } else {
        // Just fetch the user if only profile data fields were updated
        const result = await pool.query(
          'SELECT id, email, first_name, last_name, role, created_at, updated_at FROM users WHERE id = $1',
          [req.user.userId]
        );
        updatedUser = result.rows[0];
      }

      // Add additional profile fields to response
      const responseUser = {
        ...updatedUser,
        name: name || `${updatedUser.first_name} ${updatedUser.last_name}`,
        company: company || null,
        phone: phone || null,
        location: location || null,
      };

      res.json({
        success: true,
        user: responseUser
      });
    }
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const pool = getPool();
    const user = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate new token
    const token = jwt.sign(
      { 
        userId: user.rows[0].id, 
        email: user.rows[0].email,
        role: user.rows[0].role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export user data
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = getPool();
    let useInMemory = false;

    if (!pool) {
      useInMemory = true;
    }

    console.log(`📦 Exporting data for user: ${userId}`);

    const exportData: any = {
      exportedAt: new Date().toISOString(),
      user: {},
      projects: [],
      leads: [],
      projectLeads: [],
      unifiedLeads: [],
    };

    // Get user data
    if (useInMemory) {
      inMemoryUsers = loadUsers();
      const userData = Array.from(inMemoryUsers.values()).find(u => u.id === userId);
      if (userData) {
        const { password_hash, ...userWithoutPassword } = userData;
        exportData.user = userWithoutPassword;
      }
    } else {
      try {
        const userResult = await pool.query(
          'SELECT id, email, first_name, last_name, role, created_at, updated_at FROM users WHERE id = $1',
          [userId]
        );
        if (userResult.rows.length > 0) {
          exportData.user = userResult.rows[0];
        }

        // Get leads from database
        const leadsResult = await pool.query(
          'SELECT * FROM leads WHERE user_id = $1',
          [userId]
        );
        exportData.leads = leadsResult.rows;
      } catch (dbError) {
        console.error('Database export error:', dbError);
        useInMemory = true;
      }
    }

    // Get projects from file storage
    try {
      const projects = loadProjects();
      exportData.projects = projects.filter(
        p => p.userId === userId || p.ownerId === userId || p.createdBy === userId
      );
    } catch (projectError) {
      console.error('Error loading projects:', projectError.message);
    }

    // Get project leads from file storage
    try {
      const projectLeads = loadProjectLeads();
      exportData.projectLeads = projectLeads.filter(
        lead => lead.userId === userId || lead.createdBy === userId || lead.ownerId === userId
      );
    } catch (leadError) {
      console.error('Error loading project leads:', leadError.message);
    }

    // Get unified leads from file storage
    try {
      const unifiedLeads = loadUnifiedLeads();
      exportData.unifiedLeads = unifiedLeads.filter(
        lead => lead.userId === userId || lead.createdBy === userId || lead.ownerId === userId
      );
    } catch (unifiedLeadError) {
      console.error('Error loading unified leads:', unifiedLeadError.message);
    }

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="build-profit-solutions-export-${userId}-${Date.now()}.json"`);

    res.json({
      success: true,
      data: exportData,
      summary: {
        projects: exportData.projects.length,
        leads: exportData.leads.length,
        projectLeads: exportData.projectLeads.length,
        unifiedLeads: exportData.unifiedLeads.length,
      }
    });
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ 
      error: 'Failed to export data',
      message: error.message 
    });
  }
});

// Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userEmail = req.user.email;
    const pool = getPool();
    let useInMemory = false;

    // Check if using database or in-memory storage
    if (!pool) {
      useInMemory = true;
    }

    console.log(`🗑️  Starting account deletion for user: ${userEmail} (${userId})`);

    // 1. Cancel Stripe subscriptions if they exist and Stripe is configured
    if (stripe) {
      try {
        if (pool && !useInMemory) {
          // Get user's Stripe customer ID from database
          const userResult = await pool.query(
            'SELECT stripe_customer_id FROM users WHERE id = $1',
            [userId]
          );

          if (userResult.rows.length > 0 && userResult.rows[0].stripe_customer_id) {
            const stripeCustomerId = userResult.rows[0].stripe_customer_id;
            
            // Get all active subscriptions for this customer
            const subscriptions = await stripe.subscriptions.list({
              customer: stripeCustomerId,
              status: 'active',
              limit: 100
            });

            // Cancel all active subscriptions
            for (const subscription of subscriptions.data) {
              try {
                await stripe.subscriptions.cancel(subscription.id);
                console.log(`✅ Cancelled Stripe subscription: ${subscription.id}`);
              } catch (stripeError) {
                console.error(`⚠️  Error cancelling subscription ${subscription.id}:`, stripeError.message);
                // Continue with deletion even if subscription cancellation fails
              }
            }
          }
        } else if (useInMemory) {
          // Check in-memory users for Stripe customer ID
          inMemoryUsers = loadUsers();
          const userData = Array.from(inMemoryUsers.values()).find(u => u.id === userId);
          if (userData && userData.stripe_customer_id) {
            const subscriptions = await stripe.subscriptions.list({
              customer: userData.stripe_customer_id,
              status: 'active',
              limit: 100
            });

            for (const subscription of subscriptions.data) {
              try {
                await stripe.subscriptions.cancel(subscription.id);
                console.log(`✅ Cancelled Stripe subscription: ${subscription.id}`);
              } catch (stripeError) {
                console.error(`⚠️  Error cancelling subscription ${subscription.id}:`, stripeError.message);
              }
            }
          }
        }
      } catch (stripeError) {
        console.error('⚠️  Error handling Stripe subscriptions:', stripeError.message);
        // Continue with deletion even if Stripe operations fail
      }
    } else {
      console.log('⚠️  Stripe not configured, skipping subscription cancellation');
    }

    // 2. Delete from database (if using database)
    if (pool && !useInMemory) {
      try {
        // Delete user (CASCADE will handle related records in user_settings)
        // But we need to manually delete from other tables first due to foreign key constraints
        await pool.query('DELETE FROM leads WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM payments WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM user_settings WHERE user_id = $1', [userId]);
        
        // Finally delete the user
        const deleteResult = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
        
        if (deleteResult.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        console.log(`✅ Deleted user from database: ${userId}`);
      } catch (dbError) {
        console.error('Database deletion error:', dbError);
        // Fallback to in-memory deletion if database fails
        useInMemory = true;
      }
    }

    // 3. Delete from in-memory storage (if using in-memory or database deletion failed)
    if (useInMemory) {
      inMemoryUsers = loadUsers();
      let userFound = false;
      
      // Find and remove user by email
      for (const [email, userData] of inMemoryUsers.entries()) {
        if (userData.id === userId || email === userEmail) {
          inMemoryUsers.delete(email);
          userFound = true;
          console.log(`✅ Deleted user from in-memory storage: ${email}`);
          break;
        }
      }

      if (!userFound) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Save updated users to disk
      saveUsers(inMemoryUsers);
    }

    // 4. Delete user's projects from file storage
    try {
      let projects = loadProjects();
      const initialCount = projects.length;
      projects = projects.filter(p => p.userId !== userId && p.ownerId !== userId && p.createdBy !== userId);
      const deletedCount = initialCount - projects.length;
      
      if (deletedCount > 0) {
        saveProjects(projects);
        console.log(`✅ Deleted ${deletedCount} project(s) for user ${userId}`);
      }
    } catch (projectError) {
      console.error('⚠️  Error deleting projects:', projectError.message);
      // Continue even if project deletion fails
    }

    // 5. Delete user's project leads from file storage
    try {
      let projectLeads = loadProjectLeads();
      const initialCount = projectLeads.length;
      projectLeads = projectLeads.filter(lead => {
        // Check various possible userId fields
        return lead.userId !== userId && 
               lead.createdBy !== userId && 
               lead.ownerId !== userId &&
               (lead.createdByUserId !== userId);
      });
      const deletedCount = initialCount - projectLeads.length;
      
      if (deletedCount > 0) {
        saveProjectLeads(projectLeads);
        console.log(`✅ Deleted ${deletedCount} project lead(s) for user ${userId}`);
      }
    } catch (leadError) {
      console.error('⚠️  Error deleting project leads:', leadError.message);
      // Continue even if lead deletion fails
    }

    // 6. Delete user's unified leads from file storage
    try {
      let unifiedLeads = loadUnifiedLeads();
      const initialCount = unifiedLeads.length;
      unifiedLeads = unifiedLeads.filter(lead => {
        return lead.userId !== userId && 
               lead.createdBy !== userId && 
               lead.ownerId !== userId;
      });
      const deletedCount = initialCount - unifiedLeads.length;
      
      if (deletedCount > 0) {
        saveUnifiedLeads(unifiedLeads);
        console.log(`✅ Deleted ${deletedCount} unified lead(s) for user ${userId}`);
      }
    } catch (unifiedLeadError) {
      console.error('⚠️  Error deleting unified leads:', unifiedLeadError.message);
      // Continue even if unified lead deletion fails
    }

    console.log(`✅ Account deletion completed for user: ${userEmail} (${userId})`);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ 
      error: 'Failed to delete account',
      message: error.message 
    });
  }
});

module.exports = router; 