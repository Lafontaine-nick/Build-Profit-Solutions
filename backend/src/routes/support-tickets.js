const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const STORAGE_DIR = path.join(__dirname, '../../storage');
const TICKETS_FILE = path.join(STORAGE_DIR, 'support-tickets.json');

// Ensure storage directory exists
async function ensureStorageDir() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating storage directory:', error);
  }
}

// Load tickets from file
async function loadTickets() {
  try {
    await ensureStorageDir();
    const data = await fs.readFile(TICKETS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Error loading tickets:', error);
    return [];
  }
}

// Save tickets to file
async function saveTickets(tickets) {
  try {
    await ensureStorageDir();
    await fs.writeFile(TICKETS_FILE, JSON.stringify(tickets, null, 2));
  } catch (error) {
    console.error('Error saving tickets:', error);
    throw error;
  }
}

// Get user email from Clerk token or request
async function getUserEmail(req) {
  // Try to get from auth token
  if (req.user && req.user.email) {
    return req.user.email;
  }
  
  // Try to get from request body
  if (req.body && req.body.userEmail) {
    return req.body.userEmail;
  }
  
  // Return null if not found
  return null;
}

// POST /api/support-tickets - Submit a new support ticket/issue report
router.post('/', async (req, res) => {
  try {
    const { category, title, description, userEmail } = req.body;

    // Validate required fields
    if (!category) {
      return res.status(400).json({ 
        success: false, 
        error: 'Category is required' 
      });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title is required' 
      });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Description is required' 
      });
    }

    // Get user email
    const email = userEmail || await getUserEmail(req);

    // Create ticket
    const ticket = {
      id: uuidv4(),
      category,
      title: title.trim(),
      description: description.trim(),
      userEmail: email || 'unknown@example.com',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Load existing tickets
    const tickets = await loadTickets();
    
    // Add new ticket
    tickets.push(ticket);
    
    // Save tickets
    await saveTickets(tickets);

    console.log('📝 New support ticket created:', {
      id: ticket.id,
      category: ticket.category,
      title: ticket.title,
      userEmail: ticket.userEmail,
    });

    // TODO: Send email notification to support team
    // For now, we'll just log it
    console.log('📧 Support ticket notification (email not configured):', {
      to: process.env.SUPPORT_EMAIL || 'support@buildprofitsolutions.com',
      subject: `New ${category} Report: ${title}`,
      body: `A new ${category} has been reported.\n\nTitle: ${title}\n\nDescription: ${description}\n\nUser: ${email || 'Unknown'}`,
    });

    res.status(201).json({
      success: true,
      ticket: {
        id: ticket.id,
        category: ticket.category,
        title: ticket.title,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
      message: 'Support ticket created successfully',
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create support ticket',
      message: error.message,
    });
  }
});

// GET /api/support-tickets - Get all tickets (for admin/support team)
router.get('/', async (req, res) => {
  try {
    const tickets = await loadTickets();
    
    // Optionally filter by user email if provided
    const userEmail = req.query.email;
    let filteredTickets = tickets;
    
    if (userEmail) {
      filteredTickets = tickets.filter(t => t.userEmail === userEmail);
    }

    res.json({
      success: true,
      tickets: filteredTickets,
      count: filteredTickets.length,
    });
  } catch (error) {
    console.error('Error loading tickets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load support tickets',
      message: error.message,
    });
  }
});

// GET /api/support-tickets/:id - Get a specific ticket
router.get('/:id', async (req, res) => {
  try {
    const tickets = await loadTickets();
    const ticket = tickets.find(t => t.id === req.params.id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
      });
    }

    res.json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error('Error loading ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load support ticket',
      message: error.message,
    });
  }
});

module.exports = router;

