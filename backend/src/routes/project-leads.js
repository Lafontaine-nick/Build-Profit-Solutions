const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const unifiedLeadService = require('../services/unifiedLeadService');
const { loadProjectLeads, saveProjectLeads } = require('../services/leadStorage');

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
router.post('/', async (req, res) => {
  try {
    console.log('📥 ===== PROJECT LEAD CREATION REQUEST =====');
    console.log('🔍 Backend received request body:', JSON.stringify(req.body, null, 2));
    
    const { title, trade, projectId, city, state, budgetMin, budgetMax, timeline, createdBy, description } = req.body;

    // More lenient validation - check for truthy values
    const missingFields = [];
    if (!title) missingFields.push('title');
    if (!trade) missingFields.push('trade');
    if (!city) missingFields.push('city');
    if (!state) missingFields.push('state');
    if (!budgetMin) missingFields.push('budgetMin');
    if (!budgetMax) missingFields.push('budgetMax');
    if (!timeline) missingFields.push('timeline');
    if (!createdBy) missingFields.push('createdBy');

    if (missingFields.length > 0) {
      console.log('❌ Missing fields:', missingFields);
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
        name: createdBy,
        company: 'Project Request',
      },
      location: {
        city,
        state,
      },
      project: {
        type: 'other',
        budgetMin: parseInt(budgetMin),
        budgetMax: parseInt(budgetMax),
        timeline,
      },
      description: description || `Professional ${trade.toLowerCase()} services needed`,
      verified: true,
      createdBy,
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
      lead: result.lead,
      matchedContractors: result.matchedContractors.length,
      notificationsSent: result.notificationsSent,
      message: `Subcontractor request created! ${result.matchedContractors.length > 0 ? `Matched with ${result.matchedContractors.length} qualified contractors.` : 'No matching contractors found yet.'}`,
    });

  } catch (error) {
    console.error('Error creating subcontractor request:', error);
    res.status(500).json({ error: 'Failed to create subcontractor request', details: error.message });
  }
});

// Create subcontractor requests from a project
router.post('/projects/:projectId/create-leads', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { trades, contractorId } = req.body;

    const project = projects.find(p => p.id === projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

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
        createdBy: project.createdBy,
        assignedTo: contractorId, // Specific contractor assigned
        createdAt: new Date().toISOString(),
        description: `Professional ${trade.toLowerCase()} services needed for ${project.name}. Project timeline: ${project.timeline}`
      };

      projectLeads.push(lead);
      createdLeads.push(lead);
    }

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

// Get all project-based leads for a contractor
router.get('/contractor/:contractorId', async (req, res) => {
  try {
    const { contractorId } = req.params;
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

// Accept a project-based lead
router.post('/leads/:leadId/accept', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { contractorId, message } = req.body;

    const lead = projectLeads.find(l => l.id === leadId);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (lead.assignedTo && lead.assignedTo !== contractorId) {
      return res.status(400).json({ error: 'Lead already assigned to another contractor' });
    }

    // Update lead
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

// Get available projects for lead creation
router.get('/projects', async (req, res) => {
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
router.get('/my-requests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, trade } = req.query;

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
      
      // Also check if lead is from a campaign (has CAMPAIGN- prefix in projectId)
      const isCampaignLead = lead.projectId && lead.projectId.startsWith('CAMPAIGN-');
      
      // Match if:
      // 1. Exact userId match (normalized), OR
      // 2. It's a campaign lead (created from campaigns in the app - regardless of createdBy name)
      const matchesUser = leadCreatedBy === searchUserId || 
                         (isCampaignLead && lead.source === 'PROJECT_BASED');
      
      const isOriginalLead = !lead.assignedTo; // Only original unassigned leads, not contractor-specific assigned ones
      
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
      // Normalize createdBy for comparison (trim whitespace, handle case)
      const leadCreatedBy = (lead.createdBy || '').trim().toLowerCase();
      const searchUserId = userId.toLowerCase();
      
      // Also check if lead is from a campaign (has CAMPAIGN- prefix in projectId)
      const isCampaignLead = lead.projectId && lead.projectId.startsWith('CAMPAIGN-');
      
      // Match if:
      // 1. Exact userId match (normalized), OR
      // 2. It's a campaign lead (created from campaigns in the app - regardless of createdBy name)
      const matchesUser = leadCreatedBy === searchUserId || 
                         (isCampaignLead && lead.source === 'PROJECT_BASED');
      
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
        projectId: lead.projectId || null, // IMPORTANT: Include projectId so frontend can identify campaign leads
        city: lead.location?.city || 'Unknown',
        state: lead.location?.state || 'Unknown',
        budgetMin: lead.project?.budgetMin || 0,
        budgetMax: lead.project?.budgetMax || 0,
        timeline: lead.project?.timeline || 'Normal',
        description: lead.description,
        createdAt: lead.createdAt,
        status: lead.stage === 'new' ? 'pending' : lead.stage === 'contacted' ? 'matched' : lead.stage,
        matchedContractors: lead.matchedContractors || 0,
        notificationsSent: lead.notificationsSent || 0,
        assignedTo: lead.assignedTo,
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
router.delete('/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
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
    
    // Also delete from unifiedLeadService.allLeads
    // Delete by exact ID or base ID (for contractor-assigned variants)
    const baseId = leadId.includes('-') ? leadId.split('-')[0] + '-' + leadId.split('-')[1] : leadId;
    const initialCount = unifiedLeadService.allLeads.length;
    
    // Remove all leads that match this ID (including contractor variants)
    unifiedLeadService.allLeads = unifiedLeadService.allLeads.filter(lead => {
      const leadBaseId = lead.id.includes('-') ? lead.id.split('-')[0] + '-' + lead.id.split('-')[1] : lead.id;
      return leadBaseId !== baseId && lead.id !== leadId;
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
router.delete('/campaign/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    console.log(`🗑️ Bulk deleting campaign leads for projectId: ${projectId}`);
    
    // Delete from projectLeads array
    const initialProjectCount = projectLeads.length;
    projectLeads = projectLeads.filter(lead => lead.projectId !== projectId);
    const deletedFromProject = initialProjectCount - projectLeads.length;
    
    // Delete from unifiedLeadService.allLeads
    const initialUnifiedCount = unifiedLeadService.allLeads.length;
    unifiedLeadService.allLeads = unifiedLeadService.allLeads.filter(lead => lead.projectId !== projectId);
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
