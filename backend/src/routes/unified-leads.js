const express = require('express');
const unifiedLeadService = require('../services/unifiedLeadService');
const { authenticateToken } = require('../middleware/authenticateToken');
const {
  resolveActorIdFromAuth,
  urlParamUserMatchesAuth,
  leadAccessibleByRequest,
  normalizeLeadOwnerKey,
  authOwnerKeys,
} = require('../lib/leadActorAuth');

const router = express.Router();

function stageBaseIdFromParam(leadId) {
  if (!leadId.includes('-')) return leadId;
  return leadId.split('-').slice(0, 3).join('-');
}

function findLeadForMutation(leadId) {
  let lead = unifiedLeadService.allLeads.find((l) => l.id === leadId);
  if (!lead && leadId.includes('-')) {
    const baseId = stageBaseIdFromParam(leadId);
    lead = unifiedLeadService.allLeads.find((l) => {
      if (l.id === leadId) return true;
      const leadBaseId = l.id.includes('-') ? l.id.split('-').slice(0, 3).join('-') : l.id;
      return leadBaseId === baseId || l.id.startsWith(baseId);
    });
  }
  return lead || null;
}

// Get all leads for a contractor with filtering and sorting
router.get('/contractor/:contractorId', authenticateToken, async (req, res) => {
  try {
    const { contractorId } = req.params;
    if (!urlParamUserMatchesAuth(req, contractorId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Authenticated account does not match requested contractor scope.',
      });
    }

    const {
      source,
      trade,
      stage,
      minScore,
      includeUnassigned = false,
      sortBy = 'priority', // priority, score, date, budget
    } = req.query;

    const filters = {
      source,
      trade,
      stage,
      minScore: minScore ? parseInt(minScore, 10) : undefined,
      includeUnassigned: includeUnassigned === 'true',
    };

    let leads = unifiedLeadService.getLeadsForContractor(contractorId, filters);

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
        sortBy,
      },
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get lead statistics for a contractor
router.get('/contractor/:contractorId/stats', authenticateToken, async (req, res) => {
  try {
    const { contractorId } = req.params;
    if (!urlParamUserMatchesAuth(req, contractorId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Authenticated account does not match requested contractor scope.',
      });
    }

    const stats = unifiedLeadService.getLeadStats(contractorId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ error: 'Failed to fetch lead stats' });
  }
});

// Update lead stage (identity from auth — body contractorId ignored)
router.patch('/leads/:leadId/stage', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { stage } = req.body;
    const actorId = resolveActorIdFromAuth(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Could not resolve authenticated user' });
    }

    const lead = findLeadForMutation(leadId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const keys = authOwnerKeys(req);
    const isCreator = lead.createdBy && keys.has(normalizeLeadOwnerKey(lead.createdBy));
    const isAssigned = lead.assignedTo && keys.has(normalizeLeadOwnerKey(lead.assignedTo));

    if (!isCreator && !isAssigned) {
      return res.status(403).json({ error: 'Not authorized to update this lead' });
    }

    unifiedLeadService.allLeads.forEach((l) => {
      if (
        l.id === lead.id ||
        (lead.id.includes('-') && l.id.startsWith(lead.id.split('-').slice(0, 3).join('-')))
      ) {
        l.stage = stage;
        l.updatedAt = new Date().toISOString();
      }
    });

    unifiedLeadService.persistUnifiedLeads();

    res.json({
      success: true,
      message: 'Lead stage updated successfully',
      lead,
    });
  } catch (error) {
    console.error('Error updating lead stage:', error);
    res.status(500).json({ error: 'Failed to update lead stage' });
  }
});

// Accept a lead (actor from auth; persists unified store)
router.post('/leads/:leadId/accept', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { message } = req.body;
    const actorId = resolveActorIdFromAuth(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Could not resolve authenticated user' });
    }

    const lead = unifiedLeadService.allLeads.find((l) => l.id === leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const actorNorm = normalizeLeadOwnerKey(actorId);
    const creatorNorm = lead.createdBy ? normalizeLeadOwnerKey(lead.createdBy) : null;

    if (lead.assignedTo && normalizeLeadOwnerKey(lead.assignedTo) !== actorNorm) {
      return res.status(400).json({ error: 'Lead already assigned to another contractor' });
    }

    if (!lead.assignedTo && creatorNorm && creatorNorm === actorNorm) {
      return res.status(403).json({ error: 'Listing owner cannot accept their own lead via this action' });
    }

    lead.assignedTo = actorId;
    lead.stage = 'contacted';
    lead.acceptedAt = new Date().toISOString();
    if (message) {
      lead.acceptanceMessage = message;
    }

    unifiedLeadService.persistUnifiedLeads();

    res.json({
      success: true,
      message: 'Lead accepted successfully',
      lead,
    });
  } catch (error) {
    console.error('Error accepting lead:', error);
    res.status(500).json({ error: 'Failed to accept lead' });
  }
});

// Respond to a bid invitation (actor from auth)
router.post('/leads/:leadId/respond-bid', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { response, bidAmount, message, documents } = req.body;
    const actorId = resolveActorIdFromAuth(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Could not resolve authenticated user' });
    }

    const lead = unifiedLeadService.allLeads.find((l) => l.id === leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (!lead.assignedTo) {
      return res.status(403).json({ error: 'Not authorized to respond to this lead' });
    }

    if (normalizeLeadOwnerKey(lead.assignedTo) !== normalizeLeadOwnerKey(actorId)) {
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

    unifiedLeadService.persistUnifiedLeads();

    res.json({
      success: true,
      message: 'Bid response submitted successfully',
      lead,
    });
  } catch (error) {
    console.error('Error responding to bid:', error);
    res.status(500).json({ error: 'Failed to respond to bid' });
  }
});

// Archive / unarchive (mobile Leads tab sync) — register before `GET /leads/:leadId`
router.post('/leads/:leadId/archive', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { archived } = req.body || {};
    const lead = unifiedLeadService.allLeads.find((l) => l.id === leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    if (!leadAccessibleByRequest(req, lead)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Not allowed to update this lead' });
    }
    lead.archived = !!archived;
    if (archived) {
      lead.archivedAt = new Date().toISOString();
    } else {
      delete lead.archivedAt;
    }
    unifiedLeadService.persistUnifiedLeads();
    res.json({ success: true, lead });
  } catch (error) {
    console.error('Error archiving lead:', error);
    res.status(500).json({ error: 'Failed to archive lead' });
  }
});

// Get lead details (only creator or assignee)
router.get('/leads/:leadId', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = unifiedLeadService.allLeads.find((l) => l.id === leadId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (!leadAccessibleByRequest(req, lead)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Not allowed to view this lead' });
    }

    res.json({
      success: true,
      lead,
    });
  } catch (error) {
    console.error('Error fetching lead details:', error);
    res.status(500).json({ error: 'Failed to fetch lead details' });
  }
});

// Get high-value leads insight
router.get('/contractor/:contractorId/insights', authenticateToken, async (req, res) => {
  try {
    const { contractorId } = req.params;
    if (!urlParamUserMatchesAuth(req, contractorId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Authenticated account does not match requested contractor scope.',
      });
    }

    const leads = unifiedLeadService.getLeadsForContractor(contractorId);

    const highValueLeads = leads
      .filter((l) => l.aiScore >= 85 && l.project.budgetMax >= 50000)
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 3);

    const urgentLeads = leads
      .filter((l) => l.project.timeline === 'Urgent' && l.stage === 'new')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    const recentLeads = leads
      .filter((l) => l.stage === 'new')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    res.json({
      success: true,
      insights: {
        highValueLeads,
        urgentLeads,
        recentLeads,
        totalActiveLeads: leads.filter((l) =>
          ['new', 'contacted', 'quoted', 'proposal'].includes(l.stage)
        ).length,
      },
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// Reload leads from disk — disabled unless explicitly enabled (dev / ops)
router.post('/reload', authenticateToken, async (req, res) => {
  try {
    if (process.env.ALLOW_UNIFIED_LEADS_RELOAD !== 'true') {
      return res.status(403).json({ error: 'Reload is disabled' });
    }
    const count = unifiedLeadService.reloadLeads();
    res.json({
      success: true,
      message: 'Leads reloaded successfully',
      count,
    });
  } catch (error) {
    console.error('Error reloading leads:', error);
    res.status(500).json({ error: 'Failed to reload leads' });
  }
});

module.exports = router;
