const express = require('express');
const router = express.Router();
const { contractors, contractorService } = require('../data/contractors');

// Mock database for demonstration
let leads = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '(555) 123-4567',
    company: 'Smith Family',
    projectType: 'residential',
    projectSize: 'medium',
    budget: { min: 15000, max: 25000, currency: 'USD' },
    requirements: 'Complete kitchen renovation with new cabinets and countertops',
    leadGrade: 'A',
    aiScore: 92,
    status: 'new',
    priority: 'high',
    engagementLevel: 'hot',
    freshnessScore: 95,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    location: {
      city: 'Henderson',
      state: 'NV',
      zipCode: '89002'
    },
    timeline: {
      startDate: new Date().toISOString(),
      duration: 4,
      urgency: 'high'
    },
    source: 'website',
    contractorMatch: {
      isMatched: false,
      matchScore: 0,
      contractorId: null,
      contractorName: null
    },
    followUpHistory: [],
    autoFollowUp: {
      isEnabled: true,
      nextFollowUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      followUpType: 'email',
      template: 'Thank you for your interest in our services.'
    },
    crmData: {
      lastContacted: null,
      contactAttempts: 0,
      responseRate: 0,
      preferredContactMethod: 'email',
      notes: [],
      tags: []
    },
    notes: [],
    tags: []
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah.j@email.com',
    phone: '(555) 987-6543',
    company: 'Johnson Properties',
    projectType: 'residential',
    projectSize: 'large',
    budget: { min: 35000, max: 55000, currency: 'USD' },
    requirements: 'Add master bathroom to existing home',
    leadGrade: 'B',
    aiScore: 78,
    status: 'contacted',
    priority: 'medium',
    engagementLevel: 'warm',
    freshnessScore: 85,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    location: {
      city: 'Las Vegas',
      state: 'NV',
      zipCode: '89101'
    },
    timeline: {
      startDate: new Date().toISOString(),
      duration: 6,
      urgency: 'medium'
    },
    source: 'referral',
    contractorMatch: {
      isMatched: true,
      matchScore: 85,
      contractorId: 'contractor-1',
      contractorName: 'ABC Construction'
    },
    followUpHistory: [
      {
        id: '1',
        date: new Date().toISOString(),
        type: 'email',
        status: 'completed',
        notes: 'Initial contact made',
        response: 'Interested in proceeding'
      }
    ],
    autoFollowUp: {
      isEnabled: true,
      nextFollowUpDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      followUpType: 'call',
      template: 'Following up on your bathroom project.'
    },
    crmData: {
      lastContacted: new Date().toISOString(),
      contactAttempts: 1,
      responseRate: 100,
      preferredContactMethod: 'phone',
      notes: ['High-value prospect', 'Ready to start within 30 days'],
      tags: ['bathroom', 'addition']
    },
    notes: ['High-value prospect', 'Ready to start within 30 days'],
    tags: ['bathroom', 'addition']
  }
];

// Get all leads with filtering
router.get('/', (req, res) => {
  try {
    const { status, grade, budget, timeline, search, contractorId } = req.query;
    let filteredLeads = [...leads];

    // Contractor filter - show only matched leads for specific contractor
    if (contractorId) {
      filteredLeads = filteredLeads.filter(lead => {
        // Check if lead has matchedContractors array and includes this contractor
        if (lead.matchedContractors && Array.isArray(lead.matchedContractors)) {
          return lead.matchedContractors.some(match => match.contractorId === contractorId);
        }
        // Fallback: check contractorMatch for backward compatibility
        if (lead.contractorMatch && lead.contractorMatch.contractorId === contractorId) {
          return true;
        }
        return false;
      });
    }

    // Status filter
    if (status && status !== 'all') {
      filteredLeads = filteredLeads.filter(lead => lead.status === status);
    }

    // Grade filter
    if (grade && grade !== 'all') {
      filteredLeads = filteredLeads.filter(lead => lead.leadGrade === grade);
    }

    // Budget filter
    if (budget && budget !== 'all') {
      const budgetRanges = {
        'low': { min: 0, max: 25000 },
        'medium': { min: 25000, max: 75000 },
        'high': { min: 75000, max: 999999 }
      };
      const range = budgetRanges[budget];
      if (range) {
        filteredLeads = filteredLeads.filter(lead => 
          lead.budget.min >= range.min && lead.budget.max <= range.max
        );
      }
    }

    // Timeline filter
    if (timeline && timeline !== 'all') {
      filteredLeads = filteredLeads.filter(lead => lead.timeline.urgency === timeline);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLeads = filteredLeads.filter(lead => 
        lead.name.toLowerCase().includes(searchLower) ||
        lead.email.toLowerCase().includes(searchLower) ||
        lead.requirements.toLowerCase().includes(searchLower) ||
        lead.projectType.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: filteredLeads,
      total: filteredLeads.length,
      contractorId: contractorId || null
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ message: 'Failed to fetch leads' });
  }
});

// Get lead analytics
router.get('/analytics', (req, res) => {
  try {
    const total = leads.length;
    
    if (total === 0) {
      return res.json({
        success: true,
        data: {
          total: 0,
          byStatus: {},
          byGrade: {},
          averageAIScore: 0,
          averageResponseRate: 0,
          averageFreshnessScore: 0,
          contractorMatchRate: 0,
          conversionRate: 0,
          recentLeads: 0
        }
      });
    }
    
    const byStatus = leads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {});
    
    const byGrade = leads.reduce((acc, lead) => {
      acc[lead.leadGrade] = (acc[lead.leadGrade] || 0) + 1;
      return acc;
    }, {});
    
    const averageAIScore = leads.reduce((sum, lead) => sum + (lead.aiScore || 0), 0) / total;
    const averageResponseRate = 75; // Mock data
    const averageFreshnessScore = 85; // Mock data
    const contractorMatchRate = 60; // Mock data
    const conversionRate = Math.round((byStatus.won || 0) / total * 100);
    
    const recentLeads = leads
      .filter(lead => new Date(lead.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .length;
    
    res.json({
      success: true,
      data: {
        total,
        byStatus,
        byGrade,
        averageAIScore: Math.round(averageAIScore),
        averageResponseRate,
        averageFreshnessScore,
        contractorMatchRate,
        conversionRate,
        recentLeads
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

// Get lead by ID
router.get('/:id', (req, res) => {
  try {
    const lead = leads.find(l => l.id === req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    res.json({
      success: true,
      data: lead
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lead'
    });
  }
});

// Create new lead
router.post('/', (req, res) => {
  try {
    const newLead = {
      id: Date.now().toString(),
      ...req.body,
      createdAt: new Date().toISOString(),
      status: 'new',
      contractorMatch: {
        isMatched: false,
        matchScore: 0,
        contractorId: null,
        contractorName: null
      }
    };

    // AI scoring logic (mock implementation)
    const aiScore = Math.floor(Math.random() * 40) + 60; // 60-100
    newLead.aiScore = aiScore;
    
    // Determine lead grade based on AI score
    let leadGrade = 'C';
    if (aiScore >= 90) leadGrade = 'A';
    else if (aiScore >= 80) leadGrade = 'B';
    else if (aiScore >= 70) leadGrade = 'C';
    else if (aiScore >= 60) leadGrade = 'D';
    else leadGrade = 'F';
    
    newLead.leadGrade = leadGrade;

    // Contractor matching logic
    const matchedContractors = contractors.filter(contractor => {
      // Check if contractor is available
      if (!contractor.availability.isAvailable) return false;
      
      // Check location match (ZIP code)
      const locationMatch = contractor.zipCodes.includes(newLead.location?.zipCode);
      if (!locationMatch) return false;
      
      // Check trade type match
      const tradeMatch = contractor.tradeTypes.includes(newLead.projectType?.toLowerCase());
      if (!tradeMatch) return false;
      
      // Check budget match
      const leadBudget = newLead.budget?.max || 0;
      const budgetMatch = leadBudget >= contractor.budget.min && leadBudget <= contractor.budget.max;
      if (!budgetMatch) return false;
      
      // Check lead grade requirements
      const gradeOrder = { 'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'F': 1 };
      const leadGradeValue = gradeOrder[newLead.leadGrade] || 4;
      const minGradeValue = gradeOrder[contractor.preferences.minLeadGrade] || 4;
      const gradeMatch = leadGradeValue >= minGradeValue;
      if (!gradeMatch) return false;
      
      // Check AI score requirements
      const scoreMatch = newLead.aiScore >= contractor.preferences.minAIScore;
      if (!scoreMatch) return false;
      
      return true;
    });

    // Calculate match scores and sort by best match
    const scoredMatches = matchedContractors.map(contractor => {
      let matchScore = 0;
      const matchFactors = {
        positive: [],
        negative: [],
        neutral: []
      };

      // Trade type match (20 points)
      if (contractor.tradeTypes.includes(newLead.projectType?.toLowerCase())) {
        matchScore += 20;
        matchFactors.positive.push('Trade type matches');
      }

      // Location match (15 points)
      if (contractor.zipCodes.includes(newLead.location?.zipCode)) {
        matchScore += 15;
        matchFactors.positive.push('Location matches service area');
      }

      // Budget match (10 points)
      const leadBudget = newLead.budget?.max || 0;
      if (leadBudget >= contractor.budget.min && leadBudget <= contractor.budget.max) {
        matchScore += 10;
        matchFactors.positive.push('Budget within range');
      }

      // Grade match (10 points)
      const gradeOrder = { 'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'F': 1 };
      const leadGrade = newLead.leadGrade || 'C';
      const minGrade = contractor.preferences.minLeadGrade;
      if (gradeOrder[leadGrade] >= gradeOrder[minGrade]) {
        matchScore += 10;
        matchFactors.positive.push('Lead grade meets minimum');
      }

      // AI score match (5 points)
      if (newLead.aiScore >= contractor.preferences.minAIScore) {
        matchScore += 5;
        matchFactors.positive.push('AI score meets minimum');
      }

      // Auto-accept logic
      const autoAccept = contractor.preferences.autoAccept && matchScore >= 60;

      return {
        contractorId: contractor.id,
        contractorName: contractor.name,
        company: contractor.company,
        matchScore,
        matchFactors,
        autoAccept,
        responseTime: contractor.availability.responseTime,
        rating: contractor.rating,
        experience: contractor.experience,
        specialties: contractor.specialties,
        estimatedConversion: Math.min(0.95, Math.max(0.05, matchScore / 100 + 0.3))
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    // Update lead with match information
    newLead.matchedContractors = scoredMatches;
    newLead.contractorMatch = {
      isMatched: scoredMatches.length > 0,
      matchScore: scoredMatches.length > 0 ? scoredMatches[0].matchScore : 0,
      contractorId: scoredMatches.length > 0 ? scoredMatches[0].contractorId : null,
      contractorName: scoredMatches.length > 0 ? scoredMatches[0].contractorName : null,
      totalMatches: scoredMatches.length
    };
    
    leads.push(newLead);
    
    res.status(201).json({
      success: true,
      data: newLead,
      matches: {
        total: scoredMatches.length,
        topMatch: scoredMatches.length > 0 ? scoredMatches[0] : null,
        allMatches: scoredMatches
      }
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create lead'
    });
  }
});

// Update lead
router.put('/:id', (req, res) => {
  try {
    const leadIndex = leads.findIndex(l => l.id === req.params.id);
    if (leadIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    
    leads[leadIndex] = {
      ...leads[leadIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: leads[leadIndex]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update lead'
    });
  }
});

// Delete lead
router.delete('/:id', (req, res) => {
  try {
    const leadIndex = leads.findIndex(l => l.id === req.params.id);
    if (leadIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    
    leads.splice(leadIndex, 1);
    
    res.json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete lead'
    });
  }
});

// Match lead to contractors
router.post('/:id/match', (req, res) => {
  try {
    const lead = leads.find(l => l.id === req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    
    // Mock contractor matching logic
    const matchedContractors = [
      {
        id: 'contractor-1',
        name: 'ABC Construction',
        matchScore: 85,
        specialties: ['residential', 'kitchen'],
        location: 'Henderson, NV',
        rating: 4.8
      },
      {
        id: 'contractor-2',
        name: 'XYZ Remodeling',
        matchScore: 72,
        specialties: ['residential', 'bathroom'],
        location: 'Las Vegas, NV',
        rating: 4.6
      }
    ];
    
    res.json({
      success: true,
      data: {
        lead,
        matchedContractors
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to match lead'
    });
  }
});

// Update lead status
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const lead = leads.find(l => l.id === req.params.id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    
    lead.status = status;
    lead.updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: lead
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update status'
    });
  }
});

module.exports = router; 