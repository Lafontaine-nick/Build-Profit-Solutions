const { v4: uuidv4 } = require('uuid');
const { contractorProfileService } = require('./contractorProfile');
const { pushNotificationService } = require('./pushNotifications');
const { loadUnifiedLeads, saveUnifiedLeads } = require('./leadStorage');

class UnifiedLeadService {
  constructor() {
    // Load from persistent storage on startup
    this.allLeads = loadUnifiedLeads();
    console.log(`📦 Loaded ${this.allLeads.length} unified leads from persistent storage`);
    this.contractorProfileService = contractorProfileService;
    this.pushNotificationService = pushNotificationService;
  }

  // Save unified leads to disk
  persistUnifiedLeads() {
    const saved = saveUnifiedLeads(this.allLeads);
    if (saved) {
      console.log(`💾 Saved ${this.allLeads.length} unified leads to disk`);
    }
  }

  // Create a lead with smart matching and notifications
  async createLeadWithMatching(leadData) {
    try {
      // Create the lead
      const lead = {
        id: `LEAD-${Date.now()}-${uuidv4().substr(0, 8)}`,
        createdAt: new Date().toISOString(),
        stage: 'new',
        aiScore: this.calculateAIScore(leadData),
        verified: leadData.verified !== undefined ? leadData.verified : true,
        ...leadData,
      };

      // Find matching contractors
      console.log(`🔍 Finding contractors for ${lead.trade} in ${lead.location.city}, ${lead.location.state}...`);
      const matchedContractors = await this.contractorProfileService.findMatchingContractors(lead);

      if (matchedContractors.length === 0) {
        console.log(`⚠️ No matching contractors found for lead ${lead.id}`);
        // Still save the lead, but mark as unassigned
        this.allLeads.push(lead);
        this.persistUnifiedLeads(); // Save to disk
        return { lead, matchedContractors: [], notificationsSent: 0 };
      }

      console.log(`✅ Found ${matchedContractors.length} matching contractors`);

      // IMPORTANT: Store the original lead first (for the creator to see in "my-requests")
      // This is the unassigned version that the creator posted
      this.allLeads.push(lead);
      this.persistUnifiedLeads(); // Save to disk

      // Assign lead to matched contractors (create individual lead instances for each)
      const createdLeads = [];
      for (const contractor of matchedContractors) {
        const contractorLead = {
          ...lead,
          id: `${lead.id}-${contractor.id}`,
          assignedTo: contractor.id,
          matchedDistance: contractor.distance,
          matchedRating: contractor.rating,
        };
        this.allLeads.push(contractorLead);
        createdLeads.push(contractorLead);
      }
      
      // Persist after adding all contractor leads
      this.persistUnifiedLeads();

      // Send push notifications to matched contractors
      const notificationResult = await this.pushNotificationService.sendBulkLeadNotifications(
        matchedContractors,
        lead
      );

      console.log(`📲 Sent ${notificationResult.sent || 0} push notifications`);

      return {
        lead,
        matchedContractors,
        createdLeads,
        notificationsSent: notificationResult.sent || 0,
        success: true,
      };

    } catch (error) {
      console.error('Error creating lead with matching:', error);
      throw error;
    }
  }

  // Calculate AI score based on lead attributes
  calculateAIScore(leadData) {
    let score = 70; // Base score

    // Budget scoring (higher budget = higher score)
    if (leadData.project?.budgetMax) {
      if (leadData.project.budgetMax >= 100000) score += 15;
      else if (leadData.project.budgetMax >= 50000) score += 10;
      else if (leadData.project.budgetMax >= 25000) score += 5;
    }

    // Timeline scoring (urgent = higher score)
    if (leadData.project?.timeline === 'Urgent') score += 10;
    else if (leadData.project?.timeline === 'Soon') score += 5;

    // Verification scoring
    if (leadData.verified) score += 5;

    // Source scoring
    const sourceBonus = {
      PROJECT_BASED: 5,
      BID_INVITATION: 10,
      SHARED: 3,
      AI_ESTIMATE: 2,
      MARKETPLACE: 0,
    };
    score += sourceBonus[leadData.source] || 0;

    // Cap at 100
    return Math.min(score, 100);
  }

  // Create leads from project-based subcontractor requests
  createProjectBasedLeads(project, contractorId, trades) {
    const leads = [];
    
    for (const trade of trades) {
      if (!project.requiredTrades.includes(trade)) continue;

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
          lat: this.getLatForCity(project.city),
          lng: this.getLngForCity(project.city)
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
        assignedTo: contractorId,
        createdAt: new Date().toISOString(),
        description: `Professional ${trade.toLowerCase()} services needed for ${project.name}. Project timeline: ${project.timeline}`
      };

      this.allLeads.push(lead);
      leads.push(lead);
    }

    return leads;
  }

  // Create leads from bid invitations
  createBidInvitationLeads(invitation, contractorIds) {
    const leads = [];
    
    for (const contractorId of contractorIds) {
      const lead = {
        id: `BI-${Date.now()}-${uuidv4().substr(0, 8)}`,
        title: `${invitation.trade} RFQ from ${invitation.gcCompany}`,
        trade: invitation.trade,
        projectId: invitation.projectId,
        source: 'BID_INVITATION',
        contact: {
          name: invitation.gcContact.name,
          email: invitation.gcContact.email,
          phone: invitation.gcContact.phone,
          company: invitation.gcCompany
        },
        location: {
          city: invitation.city,
          state: invitation.state,
          zip: invitation.zip,
          lat: this.getLatForCity(invitation.city),
          lng: this.getLngForCity(invitation.city)
        },
        project: {
          type: invitation.type,
          budgetMin: invitation.budgetMin,
          budgetMax: invitation.budgetMax,
          timeline: invitation.timeline
        },
        stage: 'new',
        aiScore: Math.floor(Math.random() * 20) + 80, // 80-100 for direct invitations
        verified: true,
        verification: {
          emailValid: true,
          phoneValid: true
        },
        createdBy: invitation.gcContact.email,
        assignedTo: contractorId,
        createdAt: new Date().toISOString(),
        description: `Direct invitation for ${invitation.trade.toLowerCase()} work. ${invitation.message || 'Please submit your bid.'}`,
        deadline: invitation.deadline,
        invitationMessage: invitation.message
      };

      this.allLeads.push(lead);
      leads.push(lead);
    }

    return leads;
  }

  // Create leads from shared opportunities
  createSharedLeads(originalLead, sharingContractor, targetContractors) {
    const leads = [];
    
    for (const contractor of targetContractors) {
      const lead = {
        id: `SL-${Date.now()}-${uuidv4().substr(0, 8)}`,
        title: `${originalLead.trade} lead shared by ${sharingContractor.name}`,
        trade: originalLead.trade,
        originalLeadId: originalLead.id,
        source: 'SHARED',
        contact: {
          name: 'Shared Lead Contact',
          email: 'shared@lead.com',
          phone: '555-000-0000',
          company: 'Shared Lead'
        },
        location: originalLead.location,
        project: originalLead.project,
        stage: 'new',
        aiScore: Math.floor(Math.random() * 25) + 65, // 65-90 for shared leads
        verified: true,
        verification: {
          emailValid: true,
          phoneValid: true
        },
        createdBy: sharingContractor.id,
        assignedTo: contractor.id,
        createdAt: new Date().toISOString(),
        description: `Shared ${originalLead.trade.toLowerCase()} opportunity. ${originalLead.sharingMessage || 'Check details with the sharing contractor.'}`,
        sharedBy: sharingContractor.id,
        sharingMessage: originalLead.sharingMessage
      };

      this.allLeads.push(lead);
      leads.push(lead);
    }

    return leads;
  }

  // Get all leads for a contractor
  getLeadsForContractor(contractorId, filters = {}) {
    let leads = this.allLeads.filter(lead => 
      lead.assignedTo === contractorId || 
      (filters.includeUnassigned && !lead.assignedTo)
    );

    // Apply filters
    if (filters.source) {
      leads = leads.filter(lead => lead.source === filters.source);
    }

    if (filters.trade) {
      leads = leads.filter(lead => lead.trade === filters.trade);
    }

    if (filters.stage) {
      leads = leads.filter(lead => lead.stage === filters.stage);
    }

    if (filters.minScore) {
      leads = leads.filter(lead => lead.aiScore >= filters.minScore);
    }

    // Sort by priority (source-based)
    const sourcePriority = {
      'PROJECT_BASED': 1,
      'BID_INVITATION': 2,
      'SHARED': 3,
      'AI_ESTIMATE': 4,
      'MARKETPLACE': 5
    };

    leads.sort((a, b) => {
      const priorityA = sourcePriority[a.source] || 6;
      const priorityB = sourcePriority[b.source] || 6;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Secondary sort by AI score
      return b.aiScore - a.aiScore;
    });

    return leads;
  }

  // Get lead statistics
  getLeadStats(contractorId) {
    const leads = this.allLeads.filter(lead => lead.assignedTo === contractorId);
    
    const stats = {
      total: leads.length,
      bySource: {
        PROJECT_BASED: leads.filter(l => l.source === 'PROJECT_BASED').length,
        BID_INVITATION: leads.filter(l => l.source === 'BID_INVITATION').length,
        SHARED: leads.filter(l => l.source === 'SHARED').length,
        AI_ESTIMATE: leads.filter(l => l.source === 'AI_ESTIMATE').length,
        MARKETPLACE: leads.filter(l => l.source === 'MARKETPLACE').length
      },
      byStage: {
        new: leads.filter(l => l.stage === 'new').length,
        contacted: leads.filter(l => l.stage === 'contacted').length,
        quoted: leads.filter(l => l.stage === 'quoted').length,
        proposal: leads.filter(l => l.stage === 'proposal').length,
        won: leads.filter(l => l.stage === 'won').length,
        lost: leads.filter(l => l.stage === 'lost').length
      },
      highValue: leads.filter(l => l.aiScore >= 85 && l.project.budgetMax >= 50000).length,
      averageScore: leads.length > 0 ? Math.round(leads.reduce((sum, l) => sum + l.aiScore, 0) / leads.length) : 0
    };

    return stats;
  }

  // Helper methods
  getLatForCity(city) {
    const cityCoords = {
      'Salt Lake City': 40.7608,
      'Las Vegas': 36.1699,
      'Provo': 40.2338
    };
    return cityCoords[city] || 40.7608;
  }

  getLngForCity(city) {
    const cityCoords = {
      'Salt Lake City': -111.8910,
      'Las Vegas': -115.1398,
      'Provo': -111.6585
    };
    return cityCoords[city] || -111.8910;
  }

  // Initialize with some demo data (only if no leads exist)
  initializeDemoData() {
    // Only add demo leads if storage is empty
    if (this.allLeads.length > 0) {
      console.log(`⏭️ Skipping demo leads - ${this.allLeads.length} leads already loaded from storage`);
      return;
    }
    
    // Add some existing leads for demo
    const demoLeads = [
      {
        id: 'demo-1',
        title: 'Framing for Mountain View Condos',
        trade: 'Framing',
        source: 'PROJECT_BASED',
        contact: {
          name: 'Sarah Johnson',
          email: 'sarah@eliteconstruction.com',
          phone: '555-123-4567',
          company: 'Elite Construction'
        },
        location: {
          city: 'Salt Lake City',
          state: 'UT',
          zip: '84101',
          lat: 40.7608,
          lng: -111.8910
        },
        project: {
          type: 'new_build',
          budgetMin: 85000,
          budgetMax: 125000,
          timeline: 'Soon'
        },
        stage: 'new',
        aiScore: 92,
        verified: true,
        createdBy: 'gc-sarah-001',
        assignedTo: 'contractor-demo',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Professional framing services for 12-unit condo development'
      },
      {
        id: 'demo-2',
        title: 'HVAC RFQ from Metro Builders',
        trade: 'HVAC',
        source: 'BID_INVITATION',
        contact: {
          name: 'Mike Rodriguez',
          email: 'mike@metrobuilders.com',
          phone: '555-987-6543',
          company: 'Metro Builders'
        },
        location: {
          city: 'Las Vegas',
          state: 'NV',
          zip: '89123',
          lat: 36.1699,
          lng: -115.1398
        },
        project: {
          type: 'new_build',
          budgetMin: 120000,
          budgetMax: 180000,
          timeline: 'Urgent'
        },
        stage: 'new',
        aiScore: 88,
        verified: true,
        createdBy: 'gc-mike-002',
        assignedTo: 'contractor-demo',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Direct invitation for HVAC work on commercial office building',
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'demo-3',
        title: 'Electrical lead shared by Elite Framing Co',
        trade: 'Electrical',
        source: 'SHARED',
        contact: {
          name: 'Shared Lead Contact',
          email: 'shared@lead.com',
          phone: '555-000-0000',
          company: 'Shared Lead'
        },
        location: {
          city: 'Salt Lake City',
          state: 'UT',
          zip: '84101',
          lat: 40.7608,
          lng: -111.8910
        },
        project: {
          type: 'other',
          budgetMin: 35000,
          budgetMax: 55000,
          timeline: 'Normal'
        },
        stage: 'new',
        aiScore: 76,
        verified: true,
        createdBy: 'contractor-001',
        assignedTo: 'contractor-demo',
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        description: 'Shared electrical opportunity from trusted contractor',
        sharedBy: 'contractor-001',
        sharingMessage: 'This client is looking for quality electrical work'
      }
    ];

    this.allLeads.push(...demoLeads);
    this.persistUnifiedLeads(); // Save demo leads to disk
    console.log(`✅ Initialized with ${demoLeads.length} demo leads`);
  }
}

// Create singleton instance
const unifiedLeadService = new UnifiedLeadService();
unifiedLeadService.initializeDemoData();

module.exports = unifiedLeadService;
