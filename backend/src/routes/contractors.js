const express = require('express');
const router = express.Router();
const { contractors, contractorService } = require('../data/contractors');

// Get all contractors
router.get('/', (req, res) => {
  try {
    const { tradeType, location, budget, available, rating, search } = req.query;
    let filteredContractors = [...contractors];

    // Trade type filter
    if (tradeType) {
      filteredContractors = filteredContractors.filter(c => 
        c.tradeTypes.includes(tradeType)
      );
    }

    // Location filter
    if (location) {
      filteredContractors = filteredContractors.filter(c => 
        c.zipCodes.includes(location)
      );
    }

    // Budget filter
    if (budget) {
      const [min, max] = budget.split('-').map(Number);
      filteredContractors = filteredContractors.filter(c => 
        c.budget.min <= max && c.budget.max >= min
      );
    }

    // Availability filter
    if (available === 'true') {
      filteredContractors = filteredContractors.filter(c => 
        c.availability.isAvailable
      );
    }

    // Rating filter
    if (rating) {
      const minRating = parseFloat(rating);
      filteredContractors = filteredContractors.filter(c => 
        c.rating >= minRating
      );
    }

    // Search filter
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredContractors = filteredContractors.filter(c => 
        c.name.toLowerCase().includes(searchTerm) ||
        c.company.toLowerCase().includes(searchTerm)
      );
    }

    res.json({
      success: true,
      data: filteredContractors,
      total: filteredContractors.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contractors'
    });
  }
});

// Get contractor by ID
router.get('/:id', (req, res) => {
  try {
    const contractor = contractorService.getById(req.params.id);
    if (!contractor) {
      return res.status(404).json({
        success: false,
        error: 'Contractor not found'
      });
    }
    res.json({
      success: true,
      data: contractor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contractor'
    });
  }
});

// Get contractor statistics
router.get('/stats/overview', (req, res) => {
  try {
    const stats = contractorService.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contractor statistics'
    });
  }
});

// Update contractor availability
router.patch('/:id/availability', (req, res) => {
  try {
    const { isAvailable } = req.body;
    const contractor = contractorService.updateAvailability(req.params.id, isAvailable);
    
    if (!contractor) {
      return res.status(404).json({
        success: false,
        error: 'Contractor not found'
      });
    }
    
    res.json({
      success: true,
      data: contractor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update contractor availability'
    });
  }
});

// Update contractor preferences
router.patch('/:id/preferences', (req, res) => {
  try {
    const preferences = req.body;
    const contractor = contractorService.updatePreferences(req.params.id, preferences);
    
    if (!contractor) {
      return res.status(404).json({
        success: false,
        error: 'Contractor not found'
      });
    }
    
    res.json({
      success: true,
      data: contractor
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update contractor preferences'
    });
  }
});

// Match contractors to a lead
router.post('/match-lead', (req, res) => {
  try {
    const { lead } = req.body;
    
    if (!lead) {
      return res.status(400).json({
        success: false,
        error: 'Lead data is required'
      });
    }

    // Mock matching algorithm
    const matchedContractors = contractors
      .filter(c => c.availability.isAvailable)
      .map(contractor => {
        let matchScore = 0;
        const matchFactors = {
          positive: [],
          negative: [],
          neutral: []
        };

        // Trade type matching
        if (contractor.tradeTypes.includes(lead.projectType)) {
          matchScore += 20;
          matchFactors.positive.push('Trade type matches');
        } else {
          matchFactors.negative.push('Trade type mismatch');
        }

        // Location matching
        if (contractor.zipCodes.includes(lead.location?.zipCode)) {
          matchScore += 15;
          matchFactors.positive.push('Location matches service area');
        } else {
          matchFactors.negative.push('Location outside service area');
        }

        // Budget matching
        const leadBudget = lead.budget?.max || 0;
        if (leadBudget >= contractor.budget.min && leadBudget <= contractor.budget.max) {
          matchScore += 10;
          matchFactors.positive.push('Budget within range');
        } else {
          matchFactors.negative.push('Budget outside range');
        }

        // Grade matching
        const gradeOrder = { 'A': 6, 'B': 5, 'C': 4, 'D': 3, 'E': 2, 'F': 1 };
        const leadGrade = lead.leadGrade || 'C';
        const minGrade = contractor.preferences.minLeadGrade;
        
        if (gradeOrder[leadGrade] >= gradeOrder[minGrade]) {
          matchScore += 10;
          matchFactors.positive.push('Lead grade meets minimum');
        } else {
          matchFactors.negative.push('Lead grade below minimum');
        }

        // AI score matching
        const leadScore = lead.aiScore || 50;
        if (leadScore >= contractor.preferences.minAIScore) {
          matchScore += 5;
          matchFactors.positive.push('AI score meets minimum');
        } else {
          matchFactors.negative.push('AI score below minimum');
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
      })
      .filter(match => match.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      data: {
        lead,
        matchedContractors,
        totalMatches: matchedContractors.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to match contractors to lead'
    });
  }
});

// Get contractors by trade type
router.get('/trade/:tradeType', (req, res) => {
  try {
    const { tradeType } = req.params;
    const contractorsByTrade = contractorService.getByTradeType(tradeType);
    
    res.json({
      success: true,
      data: contractorsByTrade,
      total: contractorsByTrade.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contractors by trade type'
    });
  }
});

// Get contractors by location
router.get('/location/:zipCode', (req, res) => {
  try {
    const { zipCode } = req.params;
    const contractorsByLocation = contractorService.getByLocation(zipCode);
    
    res.json({
      success: true,
      data: contractorsByLocation,
      total: contractorsByLocation.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contractors by location'
    });
  }
});

// Search contractors
router.get('/search/:query', (req, res) => {
  try {
    const { query } = req.params;
    const searchResults = contractorService.search(query);
    
    res.json({
      success: true,
      data: searchResults,
      total: searchResults.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search contractors'
    });
  }
});

// Get available contractors
router.get('/available/all', (req, res) => {
  try {
    const availableContractors = contractorService.getAvailable();
    
    res.json({
      success: true,
      data: availableContractors,
      total: availableContractors.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available contractors'
    });
  }
});

module.exports = router; 