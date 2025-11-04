const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const unifiedLeadService = require('../services/unifiedLeadService');

// In-memory storage (replace with database in production)
const bidInvitations = [];
const gcProjects = [
  {
    id: 'GC-PRJ-001',
    name: 'Luxury Residential Complex',
    type: 'new_build',
    city: 'Salt Lake City',
    state: 'UT',
    zip: '84101',
    gcCompany: 'Elite Construction Group',
    gcContact: {
      name: 'Sarah Johnson',
      email: 'sarah@eliteconstruction.com',
      phone: '555-123-4567'
    },
    timeline: 'Soon',
    budgetLowByTrade: {
      'Framing': 85000,
      'HVAC': 45000,
      'Stucco': 35000,
      'Electrical': 55000
    },
    budgetHighByTrade: {
      'Framing': 125000,
      'HVAC': 65000,
      'Stucco': 50000,
      'Electrical': 80000
    },
    requiredTrades: ['Framing', 'HVAC', 'Stucco', 'Electrical'],
    status: 'active'
  },
  {
    id: 'GC-PRJ-002',
    name: 'Commercial Office Building',
    type: 'new_build',
    city: 'Las Vegas',
    state: 'NV',
    zip: '89123',
    gcCompany: 'Metro Builders',
    gcContact: {
      name: 'Mike Rodriguez',
      email: 'mike@metrobuilders.com',
      phone: '555-987-6543'
    },
    timeline: 'Urgent',
    budgetLowByTrade: {
      'Framing': 200000,
      'HVAC': 120000,
      'Plumbing': 80000,
      'Electrical': 110000
    },
    budgetHighByTrade: {
      'Framing': 300000,
      'HVAC': 180000,
      'Plumbing': 120000,
      'Electrical': 160000
    },
    requiredTrades: ['Framing', 'HVAC', 'Plumbing', 'Electrical'],
    status: 'active'
  }
];

// Direct POST endpoint for creating bid invitations (simpler format)
router.post('/', async (req, res) => {
  try {
    const { title, trade, projectId, contact, location, project, description, createdBy, contractorIds, message } = req.body;

    if (!title || !trade || !contact || !location || !project || !createdBy || !contractorIds || contractorIds.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['title', 'trade', 'contact', 'location', 'project', 'createdBy', 'contractorIds']
      });
    }

    const createdInvitations = [];

    for (const contractorId of contractorIds) {
      const leadData = {
        title,
        trade,
        projectId: projectId || `PRJ-${Date.now()}`,
        source: 'BID_INVITATION',
        contact,
        location,
        project,
        description: description || `${message || 'Direct invitation for bid'}`,
        verified: true,
        createdBy,
        assignedTo: contractorId,
      };

      // Create lead using unified service (without matching since we're directly assigning)
      const lead = {
        id: `BI-${Date.now()}-${uuidv4().substr(0, 8)}`,
        createdAt: new Date().toISOString(),
        stage: 'new',
        aiScore: 90, // High score for direct invitations
        ...leadData,
      };

      // Store in unified service
      unifiedLeadService.allLeads.push(lead);
      bidInvitations.push(lead);
      createdInvitations.push(lead);

      console.log(`📨 Sent bid invitation to contractor ${contractorId} for ${trade}`);
    }

    // TODO: Send push notifications to contractors

    res.status(201).json({
      success: true,
      message: `Sent ${createdInvitations.length} bid invitation${createdInvitations.length > 1 ? 's' : ''}`,
      invitations: createdInvitations,
      count: createdInvitations.length,
    });

  } catch (error) {
    console.error('Error sending bid invitations:', error);
    res.status(500).json({ error: 'Failed to send bid invitations', details: error.message });
  }
});

// Send bid invitation to specific contractors (legacy endpoint)
router.post('/send-invitations', async (req, res) => {
  try {
    const { projectId, trade, contractorIds, message, deadline } = req.body;

    const project = gcProjects.find(p => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.requiredTrades.includes(trade)) {
      return res.status(400).json({ error: 'Trade not required for this project' });
    }

    const createdInvitations = [];

    for (const contractorId of contractorIds) {
      const invitation = {
        id: `BI-${Date.now()}-${uuidv4().substr(0, 8)}`,
        title: `${trade} RFQ from ${project.gcCompany}`,
        trade,
        projectId: project.id,
        source: 'BID_INVITATION',
        contact: {
          name: project.gcContact.name,
          email: project.gcContact.email,
          phone: project.gcContact.phone,
          company: project.gcCompany
        },
        location: {
          city: project.city,
          state: project.state,
          zip: project.zip,
          lat: project.city === 'Salt Lake City' ? 40.7608 : 36.1699,
          lng: project.city === 'Salt Lake City' ? -111.8910 : -115.1398
        },
        project: {
          type: project.type,
          budgetMin: project.budgetLowByTrade[trade],
          budgetMax: project.budgetHighByTrade[trade],
          timeline: project.timeline
        },
        stage: 'new',
        aiScore: Math.floor(Math.random() * 20) + 80, // 80-100 for direct invitations
        verified: true,
        verification: {
          emailValid: true,
          phoneValid: true
        },
        createdBy: project.gcContact.email,
        assignedTo: contractorId,
        createdAt: new Date().toISOString(),
        description: `Direct invitation for ${trade.toLowerCase()} work on ${project.name}. ${message || 'Please submit your bid.'}`,
        deadline: deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days default
        invitationMessage: message,
        status: 'pending'
      };

      bidInvitations.push(invitation);
      createdInvitations.push(invitation);
    }

    res.status(201).json({
      success: true,
      message: `Sent ${createdInvitations.length} bid invitations`,
      invitations: createdInvitations
    });

  } catch (error) {
    console.error('Error sending bid invitations:', error);
    res.status(500).json({ error: 'Failed to send bid invitations' });
  }
});

// Get bid invitations for a contractor
router.get('/contractor/:contractorId', async (req, res) => {
  try {
    const { contractorId } = req.params;
    const { trade, status } = req.query;

    let filteredInvitations = bidInvitations.filter(inv => 
      inv.assignedTo === contractorId
    );

    if (trade) {
      filteredInvitations = filteredInvitations.filter(inv => inv.trade === trade);
    }

    if (status) {
      filteredInvitations = filteredInvitations.filter(inv => inv.status === status);
    }

    // Sort by deadline (urgent first)
    filteredInvitations.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    res.json({
      success: true,
      invitations: filteredInvitations,
      count: filteredInvitations.length
    });

  } catch (error) {
    console.error('Error fetching bid invitations:', error);
    res.status(500).json({ error: 'Failed to fetch bid invitations' });
  }
});

// Respond to a bid invitation
router.post('/invitations/:invitationId/respond', async (req, res) => {
  try {
    const { invitationId } = req.params;
    const { contractorId, response, bidAmount, message, documents } = req.body;

    const invitation = bidInvitations.find(inv => inv.id === invitationId);
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.assignedTo !== contractorId) {
      return res.status(403).json({ error: 'Not authorized to respond to this invitation' });
    }

    // Update invitation
    invitation.response = response; // 'accepted', 'declined', 'countered'
    invitation.bidAmount = bidAmount;
    invitation.responseMessage = message;
    invitation.responseDocuments = documents;
    invitation.respondedAt = new Date().toISOString();
    invitation.stage = response === 'accepted' ? 'contacted' : 'lost';

    res.json({
      success: true,
      message: 'Response submitted successfully',
      invitation
    });

  } catch (error) {
    console.error('Error responding to invitation:', error);
    res.status(500).json({ error: 'Failed to respond to invitation' });
  }
});

// Get available GC projects for invitations
router.get('/projects', async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const filteredProjects = gcProjects.filter(p => p.status === status);
    
    res.json({
      success: true,
      projects: filteredProjects,
      count: filteredProjects.length
    });
  } catch (error) {
    console.error('Error fetching GC projects:', error);
    res.status(500).json({ error: 'Failed to fetch GC projects' });
  }
});

module.exports = router;
