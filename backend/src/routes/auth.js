const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getPool } = require('../services/database');
const { loadUsers, saveUsers } = require('../services/leadStorage');

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
  body('lastName').optional().trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { firstName, lastName } = req.body;
    const pool = getPool();

    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (firstName) {
      updateFields.push(`first_name = $${paramCount}`);
      updateValues.push(firstName);
      paramCount++;
    }

    if (lastName) {
      updateFields.push(`last_name = $${paramCount}`);
      updateValues.push(lastName);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(req.user.userId);

    const updatedUser = await pool.query(
      `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramCount} 
       RETURNING id, email, first_name, last_name, role, created_at, updated_at`,
      updateValues
    );

    res.json({
      success: true,
      user: updatedUser.rows[0]
    });
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

module.exports = router; 