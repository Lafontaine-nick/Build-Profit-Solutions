const express = require('express');
const router = express.Router();

// In-memory storage for demo (replace with database in production)
let marketplaceLeads = [];

// Generate unique lead ID
const generateLeadId = () => {
  return 'MPL-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
};

// POST /api/marketplace-leads - Submit a new marketplace lead
router.post('/', async (req, res) => {
  try {
    // Handle both JSON and form data
    let data = req.body;
    
    // If it's form data, parse it
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
      data = req.body;
    }
    
    const {
      projectType,
      description,
      budgetMin,
      budgetMax,
      timeline,
      customerName,
      customerEmail,
      customerPhone,
      customerCity,
      customerState,
      customerZip,
      source,
      createdAt
    } = data;

    // Validate required fields
    if (!projectType || !description || !customerName || !customerEmail || !customerPhone || !customerCity || !customerState || !customerZip) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['projectType', 'description', 'customerName', 'customerEmail', 'customerPhone', 'customerCity', 'customerState', 'customerZip']
      });
    }

    // Create the lead
    const lead = {
      id: generateLeadId(),
      title: `${projectType.charAt(0).toUpperCase() + projectType.slice(1)} project in ${customerCity}`,
      trade: projectType,
      projectId: null, // Not linked to an existing project
      source: 'MARKETPLACE',
      contact: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        company: null
      },
      location: {
        city: customerCity,
        state: customerState,
        zip: customerZip,
        lat: null, // Could be geocoded later
        lng: null
      },
      project: {
        type: projectType,
        budgetMin: budgetMin || 0,
        budgetMax: budgetMax || (budgetMin * 1.5) || 10000,
        timeline: timeline || 'Normal'
      },
      description: description,
      aiScore: Math.floor(Math.random() * 40) + 60, // Random score between 60-100 for marketplace
      verified: false, // Marketplace leads need verification
      verification: {
        emailValid: false,
        phoneValid: false
      },
      stage: 'new',
      createdBy: 'marketplace-system',
      assignedTo: null,
      createdAt: createdAt || new Date().toISOString(),
      // Additional marketplace-specific fields
      marketplaceData: {
        submittedAt: new Date().toISOString(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      }
    };

    // Store the lead
    marketplaceLeads.push(lead);

    console.log(`📥 New marketplace lead received: ${lead.id} - ${lead.title}`);

    // In production, you would:
    // 1. Save to database
    // 2. Send notifications to contractors
    // 3. Send confirmation email to customer
    // 4. Trigger lead scoring algorithms

    // Check if this is a form submission (redirect to success page)
    if (req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
      return res.redirect('/success.html');
    }
    
    // Also check for form data in the request
    if (req.body && typeof req.body === 'object' && !req.body.projectType && Object.keys(req.body).length > 0) {
      // This might be form data, try to redirect
      return res.redirect('/success.html');
    }

    res.status(201).json({
      success: true,
      leadId: lead.id,
      message: 'Project submitted successfully! Contractors will be notified.'
    });

  } catch (error) {
    console.error('Error creating marketplace lead:', error);
    res.status(500).json({
      error: 'Failed to submit project',
      message: 'Please try again or contact support.'
    });
  }
});

// GET /api/marketplace-leads - Get all marketplace leads (for contractor app)
router.get('/', (req, res) => {
  try {
    // Filter leads based on query parameters
    let filteredLeads = [...marketplaceLeads];

    // Filter by trade if specified
    if (req.query.trade) {
      filteredLeads = filteredLeads.filter(lead => 
        lead.trade === req.query.trade || 
        lead.project.type === req.query.trade
      );
    }

    // Filter by location if specified
    if (req.query.city) {
      filteredLeads = filteredLeads.filter(lead => 
        lead.location.city.toLowerCase().includes(req.query.city.toLowerCase())
      );
    }

    // Filter by budget range if specified
    if (req.query.minBudget) {
      const minBudget = parseInt(req.query.minBudget);
      filteredLeads = filteredLeads.filter(lead => 
        lead.project.budgetMax >= minBudget
      );
    }

    // Sort by creation date (newest first)
    filteredLeads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      leads: filteredLeads,
      total: filteredLeads.length,
      filters: {
        trade: req.query.trade || null,
        city: req.query.city || null,
        minBudget: req.query.minBudget || null
      }
    });

  } catch (error) {
    console.error('Error fetching marketplace leads:', error);
    res.status(500).json({
      error: 'Failed to fetch leads'
    });
  }
});

// GET /api/marketplace-leads/:id - Get specific marketplace lead
router.get('/:id', (req, res) => {
  try {
    const lead = marketplaceLeads.find(l => l.id === req.params.id);
    
    if (!lead) {
      return res.status(404).json({
        error: 'Lead not found'
      });
    }

    res.json(lead);

  } catch (error) {
    console.error('Error fetching marketplace lead:', error);
    res.status(500).json({
      error: 'Failed to fetch lead'
    });
  }
});

// PUT /api/marketplace-leads/:id/claim - Claim a lead (contractor accepts it)
router.put('/:id/claim', (req, res) => {
  try {
    const { contractorId, contractorName } = req.body;
    
    const leadIndex = marketplaceLeads.findIndex(l => l.id === req.params.id);
    
    if (leadIndex === -1) {
      return res.status(404).json({
        error: 'Lead not found'
      });
    }

    const lead = marketplaceLeads[leadIndex];
    
    // Check if lead is already claimed
    if (lead.assignedTo) {
      return res.status(400).json({
        error: 'Lead is already claimed',
        assignedTo: lead.assignedTo
      });
    }

    // Claim the lead
    lead.assignedTo = contractorId;
    lead.stage = 'contacted';
    lead.claimedAt = new Date().toISOString();
    lead.claimedBy = contractorName;

    marketplaceLeads[leadIndex] = lead;

    console.log(`🎯 Marketplace lead claimed: ${lead.id} by ${contractorName}`);

    res.json({
      success: true,
      lead: lead,
      message: 'Lead claimed successfully'
    });

  } catch (error) {
    console.error('Error claiming marketplace lead:', error);
    res.status(500).json({
      error: 'Failed to claim lead'
    });
  }
});

// GET /api/marketplace-leads/stats - Get marketplace statistics
router.get('/stats/overview', (req, res) => {
  try {
    const stats = {
      totalLeads: marketplaceLeads.length,
      newLeads: marketplaceLeads.filter(l => l.stage === 'new').length,
      claimedLeads: marketplaceLeads.filter(l => l.assignedTo).length,
      leadsByTrade: {},
      leadsByTimeline: {},
      averageBudget: 0,
      totalValue: 0
    };

    // Calculate trade distribution
    marketplaceLeads.forEach(lead => {
      stats.leadsByTrade[lead.trade] = (stats.leadsByTrade[lead.trade] || 0) + 1;
      stats.leadsByTimeline[lead.project.timeline] = (stats.leadsByTimeline[lead.project.timeline] || 0) + 1;
      stats.totalValue += lead.project.budgetMax;
    });

    stats.averageBudget = marketplaceLeads.length > 0 ? 
      Math.round(stats.totalValue / marketplaceLeads.length) : 0;

    res.json(stats);

  } catch (error) {
    console.error('Error fetching marketplace stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;
