const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const unifiedLeadService = require('../services/unifiedLeadService');
const { loadProjectLeads, saveProjectLeads } = require('../services/leadStorage');
const { authenticateToken } = require('../middleware/authenticateToken');
const {
  resolveActorIdFromAuth,
  urlParamUserMatchesAuth,
  leadOwnedByRequester,
  normalizeLeadOwnerKey,
} = require('../lib/leadActorAuth');

const resolveAuthoritativeCreatedBy = resolveActorIdFromAuth;

function firstNonEmptyTrimmedString(...vals) {
  for (const v of vals) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) return t;
    }
  }
  return '';
}

/**
 * Headline shown on lead cards for the poster (Request Subcontractor / campaign).
 * Historically `contact.name` was set to `createdBy`, which is often a Clerk `user_…` id — unreadable in UI.
 */
function resolveLeadPosterContactName(req, createdBy, body = {}) {
  const company = firstNonEmptyTrimmedString(
    body.companyName,
    body.businessName,
    body.organizationName
  );
  const person = firstNonEmptyTrimmedString(
    body.contactName,
    body.displayName,
    body.posterName
  );
  if (company) return company.slice(0, 160);
  if (person) return person.slice(0, 160);

  const u = req.user || {};
  const nm = firstNonEmptyTrimmedString(u.name, u.fullName, u.displayName);
  if (nm) return nm.slice(0, 160);

  const em = firstNonEmptyTrimmedString(u.email);
  if (em) {
    const local = em.split('@')[0];
    const pretty = local
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    if (pretty.length >= 2) return pretty.slice(0, 160);
    return em.slice(0, 160);
  }

  const id = String(createdBy || '').trim();
  if (/^user[_]/i.test(id)) return 'Your company';

  return id.slice(0, 160) || 'Your request';
}

/** Matches `unified-leads.js` — e.g. LEAD-<ms>-<suffix> and LEAD-<ms>-<suffix>-contractor-<user> share one base. */
function stageBaseIdFromParam(leadId) {
  if (!leadId || !String(leadId).includes('-')) return leadId;
  return String(leadId).split('-').slice(0, 3).join('-');
}

function collectLeadsByProjectId(projectId) {
  const byId = new Map();
  for (const l of projectLeads) {
    if (l.projectId === projectId) byId.set(l.id, l);
  }
  for (const l of unifiedLeadService.allLeads) {
    if (l.projectId === projectId) byId.set(l.id, l);
  }
  return [...byId.values()];
}

/** Resolve one lead row to check `createdBy` before delete (projectLeads or unified). */
function resolveLeadForDeleteOwnership(leadId) {
  let leadIndex = projectLeads.findIndex((lead) => lead.id === leadId);
  if (leadIndex === -1) {
    const stripped = leadId.replace(/-contractor-\w+$/, '');
    leadIndex = projectLeads.findIndex((lead) => lead.id === stripped);
  }
  if (leadIndex !== -1) return projectLeads[leadIndex];

  const direct = unifiedLeadService.allLeads.find((l) => l.id === leadId);
  if (direct) return direct;

  const paramBase = stageBaseIdFromParam(leadId);
  return (
    unifiedLeadService.allLeads.find((l) => {
      const leadBaseId = stageBaseIdFromParam(l.id);
      return leadBaseId === paramBase || l.id === leadId;
    }) || null
  );
}

// Persistent storage - load from disk on startup
let projectLeads = loadProjectLeads();
console.log(`📦 Loaded ${projectLeads.length} project leads from persistent storage`);

// Helper function to save project leads
const persistProjectLeads = () => {
  const saved = saveProjectLeads(projectLeads);
  if (saved) {
    console.log(`💾 Saved ${projectLeads.length} project leads to disk`);
  }
};
const projects = [
  {
    id: 'PRJ-2024-001',
    name: 'Mountain View Condos',
    type: 'new_build',
    city: 'Salt Lake City',
    state: 'UT',
    zip: '84101',
    budgetLowByTrade: {
      'Framing': 45000,
      'HVAC': 25000,
      'Plumbing': 18000,
      'Electrical': 22000
    },
    budgetHighByTrade: {
      'Framing': 65000,
      'HVAC': 35000,
      'Plumbing': 28000,
      'Electrical': 32000
    },
    timeline: 'Soon',
    createdBy: 'gc-sarah-001',
    requiredTrades: ['Framing', 'HVAC', 'Plumbing', 'Electrical'],
    status: 'active'
  },
  {
    id: 'PRJ-2024-002',
    name: 'Downtown Office Complex',
    type: 'new_build',
    city: 'Las Vegas',
    state: 'NV',
    zip: '89101',
    budgetLowByTrade: {
      'Framing': 120000,
      'HVAC': 80000,
      'Stucco': 45000,
      'Electrical': 95000
    },
    budgetHighByTrade: {
      'Framing': 180000,
      'HVAC': 120000,
      'Stucco': 65000,
      'Electrical': 140000
    },
    timeline: 'Urgent',
    createdBy: 'gc-mike-002',
    requiredTrades: ['Framing', 'HVAC', 'Stucco', 'Electrical'],
    status: 'active'
  }
];

// Create a single subcontractor request (direct endpoint)
router.post('/', authenticateToken, async (req, res) => {
  try {
    console.log('📥 ===== PROJECT LEAD CREATION REQUEST =====');
    console.log('🔍 Backend received request body:', JSON.stringify(req.body, null, 2));
    console.log('✅ CODE VERSION: budgetMin is OPTIONAL - validation removed');
    
    // Extract fields - explicitly ignore budgetMin if present; createdBy comes from auth only
    const { budgetMin, createdBy: _clientCreatedBy, ...rest } = req.body;
    const {
      title,
      trade,
      projectId,
      city,
      state,
      zip: zipRaw,
      budgetMax,
      timeline,
      description,
    } = rest;

    const createdBy = resolveAuthoritativeCreatedBy(req);
    if (!createdBy) {
      return res.status(401).json({ error: 'Could not resolve authenticated user for createdBy' });
    }

    const posterContactName = resolveLeadPosterContactName(req, createdBy, rest);
    const posterCompany =
      firstNonEmptyTrimmedString(rest.companyName, rest.businessName, rest.organizationName) ||
      'Project Request';

    const zipNormalized = (zipRaw != null ? String(zipRaw) : '')
      .replace(/\D/g, '')
      .slice(0, 5);

    console.log('📋 Received fields:', Object.keys(req.body));
    console.log('📋 budgetMin received?', 'budgetMin' in req.body, 'value:', budgetMin);
    console.log('📋 budgetMax value:', budgetMax, 'type:', typeof budgetMax);
    console.log('✅ budgetMin will be IGNORED - not validated');

    // More lenient validation - check for truthy values
    // budgetMin is NOT required - completely removed from validation
    // DO NOT ADD budgetMin TO missingFields - IT IS OPTIONAL
    const missingFields = [];
    if (!title) missingFields.push('title');
    if (!trade) missingFields.push('trade');
    if (!city) missingFields.push('city');
    if (!state) missingFields.push('state');
    // budgetMin is optional - completely removed from validation - DO NOT CHECK IT
    if (!budgetMax && budgetMax !== 0) missingFields.push('budgetMax');
    if (!timeline) missingFields.push('timeline');
    
    console.log('✅ Validation complete - budgetMin NOT checked. Missing fields:', missingFields);

    if (missingFields.length > 0) {
      console.log('❌ Missing fields:', missingFields);
      console.log('📋 All received fields:', Object.keys(req.body));
      return res.status(400).json({ 
        error: 'Missing required fields',
        missing: missingFields,
        received: Object.keys(req.body)
      });
    }

    const leadData = {
      title,
      trade,
      projectId: projectId || `PRJ-${Date.now()}`,
      source: 'PROJECT_BASED',
      contact: {
        name: posterContactName,
        company: posterCompany,
      },
      location: {
        city,
        state,
        ...(zipNormalized.length === 5 ? { zip: zipNormalized } : {}),
      },
      project: {
        type: 'other',
        budgetMin: (budgetMin !== undefined && budgetMin !== null && budgetMin !== '') ? parseInt(budgetMin) : 0, // Default to 0 if not provided
        budgetMax: parseInt(budgetMax),
        timeline,
      },
      description: description || `Professional ${trade.toLowerCase()} services needed`,
      verified: true,
      createdBy,
      isOwnRequest: true, // Mark as user's own request
    };

    // Use smart matching to create lead and notify contractors
    const result = await unifiedLeadService.createLeadWithMatching(leadData);

    // Also store in local array for backwards compatibility
    projectLeads.push(result.lead);
    persistProjectLeads(); // Save to disk

    console.log(`📥 Created lead ${result.lead.id} for creator: ${result.lead.createdBy}`);
    console.log(`   - Matched with ${result.matchedContractors.length} contractors`);
    console.log(`   - Lead source: ${result.lead.source}`);
    console.log(`   - Lead stored in projectLeads array: ${projectLeads.length} total`);
    console.log(`   - Lead stored in unifiedLeadService.allLeads: ${unifiedLeadService.allLeads.filter(l => l.id === result.lead.id || l.id.startsWith(result.lead.id)).length} instances`);
    console.log(`📲 Sent ${result.notificationsSent} push notifications`);

    res.status(201).json({
      success: true,
      lead: {
        ...result.lead,
        isOwnRequest: true,
        matchedContractors: result.matchedContractors.length,
      },
      matchedContractors: result.matchedContractors.map(c => ({
        id: c.id,
        name: c.name,
        company: c.company,
        rating: c.rating,
        experience: c.experience,
        distance: c.distance,
        matchScore: c.matchScore,
      })),
      matchedContractorsCount: result.matchedContractors.length,
      notificationsSent: result.notificationsSent,
      message: `Subcontractor request created! ${result.matchedContractors.length > 0 ? `Matched with ${result.matchedContractors.length} qualified contractors.` : 'No matching contractors found yet.'}`,
    });

  } catch (error) {
    console.error('Error creating subcontractor request:', error);
    res.status(500).json({ error: 'Failed to create subcontractor request', details: error.message });
  }
});

// GC selected a verified BPS directory contractor from Find Subcontractors (estimate labor line)
router.post('/bps-selection', authenticateToken, async (req, res) => {
  try {
    const { createdBy: _clientCreatedBy, assignedTo, title, trade, description, city, state, zip: zipRaw } = req.body;
    const createdBy = resolveAuthoritativeCreatedBy(req);
    const missing = [];
    if (!createdBy) missing.push('createdBy');
    if (!assignedTo) missing.push('assignedTo');
    if (!trade) missing.push('trade');
    if (!title) missing.push('title');
    if (!city) missing.push('city');
    if (!state) missing.push('state');
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', missing });
    }
    const zip5 = (zipRaw != null ? String(zipRaw) : '')
      .replace(/\D/g, '')
      .slice(0, 5);

    const leadData = {
      title,
      trade,
      projectId: `EST-${Date.now()}`,
      source: 'BPS_SELECTION',
      contact: {
        name: 'Build Profit Solutions',
        company: 'Find Subcontractors',
        email: '',
        phone: '',
      },
      location: {
        city: String(city).trim(),
        state: String(state).trim(),
        ...(zip5.length === 5 ? { zip: zip5 } : {}),
      },
      project: {
        type: 'other',
        budgetMin: 0,
        budgetMax: 0,
        timeline: 'Normal',
      },
      description:
        description ||
        `You were selected by a GC from the verified BPS directory for ${trade} work.`,
      verified: true,
      createdBy,
      assignedTo,
      isOwnRequest: false,
    };

    const result = await unifiedLeadService.createDirectBpsSelectionLead(leadData);
    projectLeads.push(result.lead);
    persistProjectLeads();

    res.status(201).json({
      success: true,
      lead: result.lead,
      notificationsSent: result.notificationsSent || 0,
    });
  } catch (error) {
    console.error('Error creating BPS selection lead:', error);
    res.status(500).json({ error: 'Failed to create BPS selection lead', details: error.message });
  }
});

// Create subcontractor requests from a project
router.post('/projects/:projectId/create-leads', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { trades, contractorId } = req.body;

    const project = projects.find(p => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const createdByAuthoritative = resolveAuthoritativeCreatedBy(req);

    const createdLeads = [];

    for (const trade of trades) {
      if (!project.requiredTrades.includes(trade)) {
        continue; // Skip trades not required for this project
      }

      const lead = {
        id: `PL-${Date.now()}-${uuidv4().substr(0, 8)}`,
        title: `${trade} needed for ${project.name}`,
        trade,
        projectId: project.id,
        source: 'PROJECT_BASED',
        contact: {
          name: 'Project Manager',
          email: 'pm@project.com',
          phone: '555-000-0000',
          company: 'General Contractor'
        },
        location: {
          city: project.city,
          state: project.state,
          zip: project.zip,
          lat: trade === 'Framing' ? 40.7608 : 36.1699,
          lng: trade === 'Framing' ? -111.8910 : -115.1398
        },
        project: {
          type: project.type,
          budgetMin: project.budgetLowByTrade[trade],
          budgetMax: project.budgetHighByTrade[trade],
          timeline: project.timeline
        },
        stage: 'new',
        aiScore: Math.floor(Math.random() * 30) + 70, // 70-100 for project-based
        verified: true,
        verification: {
          emailValid: true,
          phoneValid: true
        },
        createdBy: createdByAuthoritative || project.createdBy,
        assignedTo: contractorId, // Specific contractor assigned
        createdAt: new Date().toISOString(),
        description: `Professional ${trade.toLowerCase()} services needed for ${project.name}. Project timeline: ${project.timeline}`
      };

      projectLeads.push(lead);
      createdLeads.push(lead);
    }

    persistProjectLeads();

    res.status(201).json({
      success: true,
      message: `Created ${createdLeads.length} subcontractor requests`,
      leads: createdLeads
    });

  } catch (error) {
    console.error('Error creating project leads:', error);
    res.status(500).json({ error: 'Failed to create project leads' });
  }
});

// Get all project-based leads for a contractor (legacy projectLeads store)
router.get('/contractor/:contractorId', authenticateToken, async (req, res) => {
  try {
    const { contractorId } = req.params;
    if (!urlParamUserMatchesAuth(req, contractorId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Authenticated account does not match requested contractor scope.',
      });
    }

    const { trade, status } = req.query;

    let filteredLeads = projectLeads.filter(lead => 
      lead.assignedTo === contractorId || 
      lead.assignedTo === undefined // Unassigned leads
    );

    if (trade) {
      filteredLeads = filteredLeads.filter(lead => lead.trade === trade);
    }

    if (status) {
      filteredLeads = filteredLeads.filter(lead => lead.stage === status);
    }

    res.json({
      success: true,
      leads: filteredLeads,
      count: filteredLeads.length
    });

  } catch (error) {
    console.error('Error fetching project leads:', error);
    res.status(500).json({ error: 'Failed to fetch project leads' });
  }
});

// Accept a project-based lead (legacy projectLeads store; actor from auth)
router.post('/leads/:leadId/accept', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { message } = req.body;
    const actorId = resolveAuthoritativeCreatedBy(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Could not resolve authenticated user' });
    }

    const lead = projectLeads.find(l => l.id === leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (lead.assignedTo && lead.assignedTo !== actorId) {
      return res.status(400).json({ error: 'Lead already assigned to another contractor' });
    }

    const creatorNorm = lead.createdBy ? normalizeLeadOwnerKey(lead.createdBy) : null;
    if (!lead.assignedTo && creatorNorm && creatorNorm === normalizeLeadOwnerKey(actorId)) {
      return res.status(403).json({ error: 'Listing owner cannot accept their own lead via this action' });
    }

    // Update lead
    lead.assignedTo = actorId;
    lead.stage = 'contacted';
    lead.acceptedAt = new Date().toISOString();
    if (message) {
      lead.acceptanceMessage = message;
    }

    persistProjectLeads();

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

// Get available projects for lead creation
router.get('/projects', authenticateToken, async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const filteredProjects = projects.filter(p => p.status === status);
    
    res.json({
      success: true,
      projects: filteredProjects,
      count: filteredProjects.length
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get subcontractor requests created by a specific user
router.get('/my-requests/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, trade } = req.query;

    if (!urlParamUserMatchesAuth(req, userId)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Authenticated account does not match requested user scope.',
      });
    }

    // Disable caching for this endpoint to always get fresh data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    console.log(`🔍 Fetching my-requests for userId: ${userId}`);
    console.log(`   - Total leads in unifiedLeadService: ${unifiedLeadService.allLeads.length}`);
    console.log(`   - Total leads in projectLeads: ${projectLeads.length}`);

    // Get all leads created by this user from unified service
    // Filter for the ORIGINAL lead (not the contractor-assigned versions)
    // Original leads have assignedTo === undefined, contractor-specific leads have assignedTo set
    let userRequests = unifiedLeadService.allLeads.filter(lead => {
      // Normalize createdBy for comparison (trim whitespace, handle case)
      const leadCreatedBy = (lead.createdBy || '').trim().toLowerCase();
      const searchUserId = userId.toLowerCase();

      const matchesUser = leadCreatedBy === searchUserId;

      const isOriginalLead = !lead.assignedTo; // Only original unassigned leads, not contractor-specific assigned ones

      if (lead.source === 'BPS_SELECTION' && leadCreatedBy === searchUserId) {
        return true;
      }

      if (lead.source === 'PROJECT_BASED' && matchesUser && isOriginalLead) {
        return true;
      }
      return false;
    });
    
    console.log(`   - Found ${userRequests.length} matching leads from unifiedLeadService`);
    if (userRequests.length > 0) {
      console.log(`   - Sample lead IDs:`, userRequests.slice(0, 3).map(l => `${l.id} (createdBy: "${l.createdBy}", projectId: "${l.projectId}", assignedTo: "${l.assignedTo}")`));
    } else {
      // Debug: Check if there are any PROJECT_BASED leads at all
      const allProjectBased = unifiedLeadService.allLeads.filter(l => l.source === 'PROJECT_BASED');
      console.log(`   - Total PROJECT_BASED leads in system: ${allProjectBased.length}`);
      if (allProjectBased.length > 0) {
        console.log(`   - Sample PROJECT_BASED leads:`, allProjectBased.slice(0, 3).map(l => ({
          id: l.id,
          title: l.title,
          createdBy: l.createdBy,
          projectId: l.projectId,
          assignedTo: l.assignedTo,
          isCampaign: l.projectId?.startsWith('CAMPAIGN-')
        })));
      }
    }

    // Also include from local storage (projectLeads array)
    const localRequests = projectLeads.filter(lead => {
      const leadCreatedBy = (lead.createdBy || '').trim().toLowerCase();
      const searchUserId = userId.toLowerCase();

      const matchesUser = leadCreatedBy === searchUserId;

      if (lead.source === 'PROJECT_BASED' && matchesUser) {
        return true;
      }
      return false;
    });
    
    console.log(`   - Found ${localRequests.length} matching leads from projectLeads array`);
    if (localRequests.length > 0) {
      console.log(`   - Sample local lead IDs:`, localRequests.slice(0, 3).map(l => `${l.id} (createdBy: "${l.createdBy}", projectId: "${l.projectId}")`));
    }
    
    // Combine and deduplicate
    const allRequests = [...userRequests, ...localRequests];
    const uniqueRequests = allRequests.filter((lead, index, self) =>
      index === self.findIndex((l) => l.id === lead.id)
    );
    
    console.log(`   - Total unique requests after deduplication: ${uniqueRequests.length}`);

    // Apply filters
    let filteredRequests = uniqueRequests;

    if (status) {
      filteredRequests = filteredRequests.filter(r => r.stage === status);
    }

    if (trade) {
      filteredRequests = filteredRequests.filter(r => r.trade === trade);
    }

    // Sort by most recent first
    filteredRequests.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Map to a simpler format for the UI
    const formattedRequests = filteredRequests.map(lead => {
      const formatted = {
        id: lead.id,
        title: lead.title,
        trade: lead.trade,
        source: lead.source || 'PROJECT_BASED',
        projectId: lead.projectId || null, // IMPORTANT: Include projectId so frontend can identify campaign leads
        city: lead.location?.city || 'Unknown',
        state: lead.location?.state || 'Unknown',
        zip: lead.location?.zip || null,
        budgetMin: lead.project?.budgetMin || 0,
        budgetMax: lead.project?.budgetMax || 0,
        timeline: lead.project?.timeline || 'Normal',
        description: lead.description,
        createdAt: lead.createdAt,
        status: lead.stage === 'new' ? 'pending' : lead.stage === 'contacted' ? 'matched' : lead.stage,
        matchedContractors: lead.matchedContractors || 0,
        notificationsSent: lead.notificationsSent || 0,
        assignedTo: lead.assignedTo,
        isOwnRequest: true, // All requests from this endpoint are user's own requests
        contactName: lead.contact?.name || '',
        companyName: lead.contact?.company || '',
      };
      // Debug log for campaign leads
      if (lead.projectId?.startsWith('CAMPAIGN-')) {
        console.log(`   ✅ Campaign lead in response: "${formatted.title}" with projectId: "${formatted.projectId}"`);
      }
      return formatted;
    });

    res.json({
      success: true,
      requests: formattedRequests,
      count: formattedRequests.length,
    });

  } catch (error) {
    console.error('Error fetching user requests:', error);
    res.status(500).json({ error: 'Failed to fetch user requests', details: error.message });
  }
});

// DELETE a specific project lead
router.delete('/:leadId', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    const canonical = resolveLeadForDeleteOwnership(leadId);
    if (!canonical) {
      console.log(`❌ Lead not found: ${leadId}`);
      return res.status(404).json({ error: 'Lead not found' });
    }
    if (!leadOwnedByRequester(req, canonical)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Not allowed to delete this lead',
      });
    }

    console.log(`🗑️ Deleting project lead: ${leadId}`);
    console.log(`📊 Current projectLeads count: ${projectLeads.length}`);
    console.log(`📋 Available lead IDs: ${projectLeads.map(l => l.id).join(', ')}`);
    
    // Find and remove the lead from projectLeads array
    let leadIndex = projectLeads.findIndex(lead => lead.id === leadId);
    
    // If not found, try to find by base ID (remove contractor suffix)
    if (leadIndex === -1) {
      const baseId = leadId.replace(/-contractor-\w+$/, '');
      console.log(`🔍 Trying base ID: ${baseId}`);
      leadIndex = projectLeads.findIndex(lead => lead.id === baseId);
    }
    
    let deletedLead = null;
    if (leadIndex !== -1) {
      deletedLead = projectLeads.splice(leadIndex, 1)[0];
      console.log(`✅ Deleted from projectLeads: ${deletedLead.id}`);
    }
    
    // Also delete from unifiedLeadService.allLeads (exact id + same stage base as unified-leads routes)
    const paramBase = stageBaseIdFromParam(leadId);
    const initialCount = unifiedLeadService.allLeads.length;

    unifiedLeadService.allLeads = unifiedLeadService.allLeads.filter((lead) => {
      const leadBase = stageBaseIdFromParam(lead.id);
      return lead.id !== leadId && leadBase !== paramBase;
    });
    unifiedLeadService.persistUnifiedLeads(); // Save to disk
    
    const deletedFromUnified = initialCount - unifiedLeadService.allLeads.length;
    if (deletedFromUnified > 0) {
      console.log(`✅ Deleted ${deletedFromUnified} lead(s) from unifiedLeadService.allLeads`);
    }
    
    // If lead wasn't found in either location
    if (!deletedLead && deletedFromUnified === 0) {
      console.log(`❌ Lead not found: ${leadId}`);
      console.log(`📋 Available leads:`, projectLeads.map(l => ({ id: l.id, title: l.title })));
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    console.log(`✅ Successfully deleted lead: ${leadId}`);
    console.log(`📊 Remaining projectLeads count: ${projectLeads.length}`);
    console.log(`📊 Remaining unifiedLeadService.allLeads count: ${unifiedLeadService.allLeads.length}`);
    
    persistProjectLeads(); // Save to disk after deletion
    
    res.json({ 
      success: true, 
      message: 'Lead deleted successfully',
      deletedLead: deletedLead || { id: leadId }
    });
    
  } catch (error) {
    console.error('❌ Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead', details: error.message });
  }
});

// Bulk delete by projectId (for campaigns)
router.delete('/campaign/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const decodedId = decodeURIComponent(projectId);
    const batch = collectLeadsByProjectId(decodedId);
    for (const lead of batch) {
      if (!leadOwnedByRequester(req, lead)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Not allowed to delete leads for this campaign',
        });
      }
    }

    console.log(`🗑️ Bulk deleting campaign leads for projectId: ${decodedId}`);
    
    // Delete from projectLeads array
    const initialProjectCount = projectLeads.length;
    projectLeads = projectLeads.filter(lead => lead.projectId !== decodedId);
    const deletedFromProject = initialProjectCount - projectLeads.length;
    
    // Delete from unifiedLeadService.allLeads
    const initialUnifiedCount = unifiedLeadService.allLeads.length;
    unifiedLeadService.allLeads = unifiedLeadService.allLeads.filter(lead => lead.projectId !== decodedId);
    unifiedLeadService.persistUnifiedLeads(); // Save to disk
    const deletedFromUnified = initialUnifiedCount - unifiedLeadService.allLeads.length;
    
    console.log(`✅ Deleted ${deletedFromProject} lead(s) from projectLeads`);
    console.log(`✅ Deleted ${deletedFromUnified} lead(s) from unifiedLeadService.allLeads`);
    console.log(`📊 Total deleted: ${deletedFromProject + deletedFromUnified} lead(s)`);
    
    persistProjectLeads(); // Save to disk after bulk deletion
    
    res.json({ 
      success: true, 
      message: `Deleted ${deletedFromProject + deletedFromUnified} leads for campaign`,
      deletedCount: deletedFromProject + deletedFromUnified
    });
    
  } catch (error) {
    console.error('❌ Error bulk deleting campaign leads:', error);
    res.status(500).json({ error: 'Failed to delete campaign leads', details: error.message });
  }
});

module.exports = router;
