const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage (replace with database in production)
const sharedLeads = [];
const contractorNetwork = [
  {
    id: 'contractor-001',
    name: 'Elite Framing Co',
    trades: ['Framing'],
    serviceAreas: ['84101', '84102', '84103'],
    rating: 4.8,
    contact: {
      name: 'John Smith',
      email: 'john@eliteframing.com',
      phone: '555-100-1000'
    }
  },
  {
    id: 'contractor-002',
    name: 'Pro HVAC Solutions',
    trades: ['HVAC'],
    serviceAreas: ['89101', '89123', '89134'],
    rating: 4.6,
    contact: {
      name: 'Maria Garcia',
      email: 'maria@prohvac.com',
      phone: '555-200-2000'
    }
  },
  {
    id: 'contractor-003',
    name: 'Master Electricians',
    trades: ['Electrical'],
    serviceAreas: ['84101', '84102', '89101', '89123'],
    rating: 4.9,
    contact: {
      name: 'David Wilson',
      email: 'david@masterelectricians.com',
      phone: '555-300-3000'
    }
  },
  {
    id: 'contractor-004',
    name: 'Premium Stucco Works',
    trades: ['Stucco'],
    serviceAreas: ['89101', '89123', '89134'],
    rating: 4.7,
    contact: {
      name: 'Lisa Chen',
      email: 'lisa@premiumstucco.com',
      phone: '555-400-4000'
    }
  }
];

// Share a lead with other contractors
router.post('/share-lead', async (req, res) => {
  try {
    const { 
      originalLeadId, 
      sharedBy, 
      trade, 
      message, 
      maxShares = 5,
      targetAreas = [],
      minRating = 4.0
    } = req.body;

    // Find contractors who match the criteria
    let eligibleContractors = contractorNetwork.filter(contractor => 
      contractor.trades.includes(trade) && 
      contractor.rating >= minRating &&
      contractor.id !== sharedBy // Don't share with self
    );

    // Filter by service areas if specified
    if (targetAreas.length > 0) {
      eligibleContractors = eligibleContractors.filter(contractor =>
        contractor.serviceAreas.some(area => targetAreas.includes(area))
      );
    }

    // Limit number of shares
    eligibleContractors = eligibleContractors.slice(0, maxShares);

    if (eligibleContractors.length === 0) {
      return res.status(400).json({ 
        error: 'No eligible contractors found for sharing' 
      });
    }

    const createdShares = [];

    for (const contractor of eligibleContractors) {
      const sharedLead = {
        id: `SL-${Date.now()}-${uuidv4().substr(0, 8)}`,
        title: `${trade} lead shared by ${contractorNetwork.find(c => c.id === sharedBy)?.name || 'Contractor'}`,
        trade,
        originalLeadId,
        source: 'SHARED',
        contact: {
          name: 'Shared Lead Contact',
          email: 'shared@lead.com',
          phone: '555-000-0000',
          company: 'Shared Lead'
        },
        location: {
          city: 'Various',
          state: 'Multiple',
          zip: targetAreas[0] || '00000'
        },
        project: {
          type: 'other',
          budgetMin: 15000,
          budgetMax: 75000,
          timeline: 'Normal'
        },
        stage: 'new',
        aiScore: Math.floor(Math.random() * 25) + 65, // 65-90 for shared leads
        verified: true,
        verification: {
          emailValid: true,
          phoneValid: true
        },
        createdBy: sharedBy,
        assignedTo: contractor.id,
        createdAt: new Date().toISOString(),
        description: `Shared ${trade.toLowerCase()} opportunity. ${message || 'Check details with the sharing contractor.'}`,
        sharedBy,
        sharingMessage: message,
        status: 'active'
      };

      sharedLeads.push(sharedLead);
      createdShares.push(sharedLead);
    }

    res.status(201).json({
      success: true,
      message: `Shared lead with ${createdShares.length} contractors`,
      sharedLeads: createdShares
    });

  } catch (error) {
    console.error('Error sharing lead:', error);
    res.status(500).json({ error: 'Failed to share lead' });
  }
});

// Get shared leads for a contractor
router.get('/contractor/:contractorId', async (req, res) => {
  try {
    const { contractorId } = req.params;
    const { trade, status } = req.query;

    let filteredShares = sharedLeads.filter(share => 
      share.assignedTo === contractorId
    );

    if (trade) {
      filteredShares = filteredShares.filter(share => share.trade === trade);
    }

    if (status) {
      filteredShares = filteredShares.filter(share => share.status === status);
    }

    // Add sharing contractor info
    const sharesWithInfo = filteredShares.map(share => {
      const sharingContractor = contractorNetwork.find(c => c.id === share.sharedBy);
      return {
        ...share,
        sharedByInfo: sharingContractor ? {
          name: sharingContractor.name,
          rating: sharingContractor.rating,
          contact: sharingContractor.contact
        } : null
      };
    });

    res.json({
      success: true,
      sharedLeads: sharesWithInfo,
      count: sharesWithInfo.length
    });

  } catch (error) {
    console.error('Error fetching shared leads:', error);
    res.status(500).json({ error: 'Failed to fetch shared leads' });
  }
});

// Accept or decline a shared lead
router.post('/leads/:leadId/respond', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { contractorId, response, message } = req.body;

    const sharedLead = sharedLeads.find(share => share.id === leadId);
    if (!sharedLead) {
      return res.status(404).json({ error: 'Shared lead not found' });
    }

    if (sharedLead.assignedTo !== contractorId) {
      return res.status(403).json({ error: 'Not authorized to respond to this lead' });
    }

    // Update shared lead
    sharedLead.response = response; // 'accepted', 'declined'
    sharedLead.responseMessage = message;
    sharedLead.respondedAt = new Date().toISOString();
    sharedLead.stage = response === 'accepted' ? 'contacted' : 'lost';
    sharedLead.status = response === 'accepted' ? 'accepted' : 'declined';

    res.json({
      success: true,
      message: 'Response submitted successfully',
      sharedLead
    });

  } catch (error) {
    console.error('Error responding to shared lead:', error);
    res.status(500).json({ error: 'Failed to respond to shared lead' });
  }
});

// Get contractor network for sharing
router.get('/network', async (req, res) => {
  try {
    const { trade, minRating = 4.0, area } = req.query;

    let filteredContractors = contractorNetwork.filter(contractor => 
      contractor.rating >= minRating
    );

    if (trade) {
      filteredContractors = filteredContractors.filter(contractor => 
        contractor.trades.includes(trade)
      );
    }

    if (area) {
      filteredContractors = filteredContractors.filter(contractor =>
        contractor.serviceAreas.includes(area)
      );
    }

    res.json({
      success: true,
      contractors: filteredContractors,
      count: filteredContractors.length
    });

  } catch (error) {
    console.error('Error fetching contractor network:', error);
    res.status(500).json({ error: 'Failed to fetch contractor network' });
  }
});

module.exports = router;



