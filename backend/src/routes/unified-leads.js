const express = require('express');
const unifiedLeadService = require('../services/unifiedLeadService');
const router = express.Router();

// Get all leads for a contractor with filtering and sorting
router.get('/contractor/:contractorId', async (req, res) => {
  try {
    const { contractorId } = req.params;
    const { 
      source, 
      trade, 
      stage, 
      minScore, 
      includeUnassigned = false,
      sortBy = 'priority' // priority, score, date, budget
    } = req.query;

    const filters = {
      source,
      trade,
      stage,
      minScore: minScore ? parseInt(minScore) : undefined,
      includeUnassigned: includeUnassigned === 'true'
    };

    let leads = unifiedLeadService.getLeadsForContractor(contractorId, filters);

    // Apply sorting
    switch (sortBy) {
      case 'score':
        leads.sort((a, b) => b.aiScore - a.aiScore);
        break;
      case 'date':
        leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'budget':
        leads.sort((a, b) => b.project.budgetMax - a.project.budgetMax);
        break;
      case 'priority':
      default:
        // Already sorted by priority in the service
        break;
    }

    res.json({
      success: true,
      leads,
      count: leads.length,
      filters: {
        source: source || 'all',
        trade: trade || 'all',
        stage: stage || 'all',
        minScore: minScore || 0,
        sortBy
      }
    });

  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get lead statistics for a contractor
router.get('/contractor/:contractorId/stats', async (req, res) => {
  try {
    const { contractorId } = req.params;
    const stats = unifiedLeadService.getLeadStats(contractorId);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ error: 'Failed to fetch lead stats' });
  }
});

// Update lead stage
router.patch('/leads/:leadId/stage', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { stage, contractorId } = req.body;

    // Find lead by exact ID or base ID (for contractor-assigned variants)
    let lead = unifiedLeadService.allLeads.find(l => l.id === leadId);
    
    // If not found by exact ID, try base ID (remove contractor suffix)
    if (!lead && leadId.includes('-')) {
      const baseId = leadId.split('-').slice(0, 3).join('-'); // e.g., "LEAD-123456-abc" -> "LEAD-123456-abc"
      lead = unifiedLeadService.allLeads.find(l => {
        const leadBaseId = l.id.includes('-') ? l.id.split('-').slice(0, 3).join('-') : l.id;
        return leadBaseId === baseId || l.id.startsWith(baseId);
      });
    }
    
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Allow update if:
    // 1. Lead is assigned to this contractor, OR
    // 2. Lead was created by this contractor (campaign leads, own requests)
    const isCreator = lead.createdBy && lead.createdBy.toLowerCase() === contractorId.toLowerCase();
    const isAssigned = lead.assignedTo && lead.assignedTo.toLowerCase() === contractorId.toLowerCase();
    
    if (!isCreator && !isAssigned) {
      return res.status(403).json({ error: 'Not authorized to update this lead' });
    }

    // Update all lead instances (original and contractor-assigned variants)
    unifiedLeadService.allLeads.forEach(l => {
      if (l.id === lead.id || (lead.id.includes('-') && l.id.startsWith(lead.id.split('-').slice(0, 3).join('-')))) {
        l.stage = stage;
        l.updatedAt = new Date().toISOString();
      }
    });
    
    // Persist the updated leads to disk
    unifiedLeadService.persistUnifiedLeads();

    res.json({
      success: true,
      message: 'Lead stage updated successfully',
      lead
    });

  } catch (error) {
    console.error('Error updating lead stage:', error);
    res.status(500).json({ error: 'Failed to update lead stage' });
  }
});

// Accept a lead (for project-based and shared leads)
router.post('/leads/:leadId/accept', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { contractorId, message } = req.body;

    const lead = unifiedLeadService.allLeads.find(l => l.id === leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (lead.assignedTo && lead.assignedTo !== contractorId) {
      return res.status(400).json({ error: 'Lead already assigned to another contractor' });
    }

    lead.assignedTo = contractorId;
    lead.stage = 'contacted';
    lead.acceptedAt = new Date().toISOString();
    if (message) {
      lead.acceptanceMessage = message;
    }

    res.json({
      success: true,
      message: 'Lead accepted successfully',
      lead
    });

  } catch (error) {
    console.error('Error accepting lead:', error);
    res.status(500).json({ error: 'Failed to accept lead' });
  }
});

// Respond to a bid invitation
router.post('/leads/:leadId/respond-bid', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { contractorId, response, bidAmount, message, documents } = req.body;

    const lead = unifiedLeadService.allLeads.find(l => l.id === leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (lead.assignedTo !== contractorId) {
      return res.status(403).json({ error: 'Not authorized to respond to this lead' });
    }

    if (lead.source !== 'BID_INVITATION') {
      return res.status(400).json({ error: 'This lead is not a bid invitation' });
    }

    lead.bidResponse = response;
    lead.bidAmount = bidAmount;
    lead.bidMessage = message;
    lead.bidDocuments = documents;
    lead.respondedAt = new Date().toISOString();
    lead.stage = response === 'accepted' ? 'contacted' : 'lost';

    res.json({
      success: true,
      message: 'Bid response submitted successfully',
      lead
    });

  } catch (error) {
    console.error('Error responding to bid:', error);
    res.status(500).json({ error: 'Failed to respond to bid' });
  }
});

// Get lead details
router.get('/leads/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = unifiedLeadService.allLeads.find(l => l.id === leadId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({
      success: true,
      lead
    });

  } catch (error) {
    console.error('Error fetching lead details:', error);
    res.status(500).json({ error: 'Failed to fetch lead details' });
  }
});

// Get high-value leads insight
router.get('/contractor/:contractorId/insights', async (req, res) => {
  try {
    const { contractorId } = req.params;
    const leads = unifiedLeadService.getLeadsForContractor(contractorId);

    const highValueLeads = leads
      .filter(l => l.aiScore >= 85 && l.project.budgetMax >= 50000)
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 3);

    const urgentLeads = leads
      .filter(l => l.project.timeline === 'Urgent' && l.stage === 'new')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    const recentLeads = leads
      .filter(l => l.stage === 'new')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    res.json({
      success: true,
      insights: {
        highValueLeads,
        urgentLeads,
        recentLeads,
        totalActiveLeads: leads.filter(l => ['new', 'contacted', 'quoted', 'proposal'].includes(l.stage)).length
      }
    });

  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// Reload leads from disk (useful when file is updated externally)
router.post('/reload', async (req, res) => {
  try {
    const count = unifiedLeadService.reloadLeads();
    res.json({
      success: true,
      message: 'Leads reloaded successfully',
      count
    });
  } catch (error) {
    console.error('Error reloading leads:', error);
    res.status(500).json({ error: 'Failed to reload leads' });
  }
});

module.exports = router;



