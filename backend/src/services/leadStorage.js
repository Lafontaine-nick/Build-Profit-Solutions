const { v4: uuidv4 } = require('uuid');

// Enhanced Lead structure with best-in-industry features
const createLead = (leadData) => {
  const now = new Date().toISOString();
  const lead = {
    id: uuidv4(),
    name: leadData.name,
    email: leadData.email,
    phone: leadData.phone,
    company: leadData.company,
    projectType: leadData.projectType,
    projectSize: leadData.projectSize,
    budget: leadData.budget,
    timeline: leadData.timeline,
    location: leadData.location,
    requirements: leadData.requirements,
    source: leadData.source,
    status: leadData.status || 'new',
    
    // 🧠 Best-in-Industry Features
    aiScore: leadData.aiScore || 0,
    engagementLevel: leadData.engagementLevel || 'cold',
    freshnessScore: leadData.freshnessScore || 100,
    contractorMatch: leadData.contractorMatch || {
      isMatched: false,
      matchScore: 0,
    },
    followUpHistory: leadData.followUpHistory || [],
    autoFollowUp: leadData.autoFollowUp || {
      isEnabled: true,
      nextFollowUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      followUpType: 'email',
      template: 'Hi {name}, thanks for your interest in {projectType}. I\'d be happy to provide a detailed quote. Would you like to schedule a consultation?',
    },
    crmData: leadData.crmData || {
      lastContacted: now,
      contactAttempts: 0,
      responseRate: 0,
      preferredContactMethod: 'email',
      notes: leadData.aiScore ? [`AI Score: ${leadData.aiScore}/100`] : [],
      tags: [],
    },
    
    // Standard fields
    priority: leadData.priority || 'medium',
    notes: leadData.notes || [],
    createdAt: now,
    updatedAt: now,
    lastContacted: leadData.lastContacted,
    nextFollowUp: leadData.nextFollowUp,
    assignedTo: leadData.assignedTo,
    tags: leadData.tags || [],
  };
  
  leads.push(lead);
  return lead;
};

const getLeads = (filters = {}) => {
  let filteredLeads = [...leads];
  
  // Apply filters
  if (filters.status && filters.status.length > 0) {
    filteredLeads = filteredLeads.filter(lead => filters.status.includes(lead.status));
  }
  
  if (filters.priority && filters.priority.length > 0) {
    filteredLeads = filteredLeads.filter(lead => filters.priority.includes(lead.priority));
  }
  
  if (filters.projectType && filters.projectType.length > 0) {
    filteredLeads = filteredLeads.filter(lead => filters.projectType.includes(lead.projectType));
  }
  
  if (filters.source && filters.source.length > 0) {
    filteredLeads = filteredLeads.filter(lead => filters.source.includes(lead.source));
  }
  
  if (filters.assignedTo) {
    filteredLeads = filteredLeads.filter(lead => lead.assignedTo === filters.assignedTo);
  }
  
  if (filters.dateRange) {
    filteredLeads = filteredLeads.filter(lead => {
      const createdAt = new Date(lead.createdAt);
      const start = new Date(filters.dateRange.start);
      const end = new Date(filters.dateRange.end);
      return createdAt >= start && createdAt <= end;
    });
  }
  
  if (filters.scoreRange) {
    filteredLeads = filteredLeads.filter(lead => 
      lead.aiScore >= filters.scoreRange.min && lead.aiScore <= filters.scoreRange.max
    );
  }
  
  if (filters.engagementLevel && filters.engagementLevel.length > 0) {
    filteredLeads = filteredLeads.filter(lead => filters.engagementLevel.includes(lead.engagementLevel));
  }
  
  if (filters.freshnessScore) {
    filteredLeads = filteredLeads.filter(lead => 
      lead.freshnessScore >= filters.freshnessScore.min && lead.freshnessScore <= filters.freshnessScore.max
    );
  }
  
  if (filters.contractorMatch !== undefined) {
    filteredLeads = filteredLeads.filter(lead => lead.contractorMatch.isMatched === filters.contractorMatch);
  }
  
  return filteredLeads;
};

const getLead = (id) => {
  return leads.find(lead => lead.id === id);
};

const updateLead = (id, updates) => {
  const leadIndex = leads.findIndex(lead => lead.id === id);
  if (leadIndex === -1) return null;
  
  leads[leadIndex] = {
    ...leads[leadIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  return leads[leadIndex];
};

const deleteLead = (id) => {
  const leadIndex = leads.findIndex(lead => lead.id === id);
  if (leadIndex === -1) return false;
  
  leads.splice(leadIndex, 1);
  return true;
};

// 🧠 AI-Powered Lead Scoring
const scoreLead = async (leadData) => {
  // This would integrate with OpenAI in production
  const score = Math.floor(Math.random() * 100) + 1;
  const engagementLevel = score >= 80 ? 'hot' : score >= 50 ? 'warm' : 'cold';
  const priority = score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low';
  
  const factors = [];
  if (leadData.budget?.max > 50000) factors.push('High Budget');
  if (leadData.timeline?.urgency === 'high') factors.push('Urgent Timeline');
  if (leadData.projectSize === 'large') factors.push('Large Project');
  if (leadData.source === 'referral') factors.push('Referral Source');
  
  return {
    aiScore: score,
    engagementLevel,
    priority,
    reasoning: `Lead scored ${score}/100 based on ${factors.join(', ')}`,
    factors,
  };
};

// 📊 Enhanced Analytics with Best-in-Industry Metrics
const getAnalytics = () => {
  const total = leads.length;
  const byStatus = {};
  const bySource = {};
  const byPriority = {};
  const byEngagementLevel = {};
  
  leads.forEach(lead => {
    byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
    bySource[lead.source] = (bySource[lead.source] || 0) + 1;
    byPriority[lead.priority] = (byPriority[lead.priority] || 0) + 1;
    byEngagementLevel[lead.engagementLevel] = (byEngagementLevel[lead.engagementLevel] || 0) + 1;
  });
  
  const averageAIScore = leads.length > 0 ? 
    leads.reduce((sum, lead) => sum + lead.aiScore, 0) / leads.length : 0;
  
  const averageFreshnessScore = leads.length > 0 ?
    leads.reduce((sum, lead) => sum + lead.freshnessScore, 0) / leads.length : 0;
  
  const averageResponseRate = leads.length > 0 ?
    leads.reduce((sum, lead) => sum + lead.crmData.responseRate, 0) / leads.length : 0;
  
  const wonLeads = leads.filter(lead => lead.status === 'won').length;
  const conversionRate = total > 0 ? (wonLeads / total) * 100 : 0;
  
  const contractorMatchRate = total > 0 ?
    (leads.filter(lead => lead.contractorMatch.isMatched).length / total) * 100 : 0;
  
  // Monthly trend (last 6 months)
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = date.toISOString().slice(0, 7);
    const count = leads.filter(lead => 
      lead.createdAt.startsWith(month)
    ).length;
    monthlyTrend.push({ month, count });
  }
  
  // Top performing sources
  const sourceStats = {};
  leads.forEach(lead => {
    if (lead.status === 'won') {
      sourceStats[lead.source] = (sourceStats[lead.source] || 0) + 1;
    }
  });
  
  const topPerformingSources = Object.entries(sourceStats)
    .map(([source, won]) => ({
      source,
      conversionRate: bySource[source] ? (won / bySource[source]) * 100 : 0
    }))
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 5);
  
  return {
    total,
    byStatus,
    bySource,
    byPriority,
    byEngagementLevel,
    averageAIScore: Math.round(averageAIScore),
    averageFreshnessScore: Math.round(averageFreshnessScore),
    averageResponseRate: Math.round(averageResponseRate),
    conversionRate: Math.round(conversionRate),
    monthlyTrend,
    topPerformingSources,
    contractorMatchRate: Math.round(contractorMatchRate),
  };
};

// 🎯 Contractor Control - Match Leads to Contractors
const matchLeadToContractor = (leadId, contractorId, contractorName) => {
  const lead = getLead(leadId);
  if (!lead) return null;
  
  return updateLead(leadId, {
    contractorMatch: {
      isMatched: true,
      matchScore: 85, // Calculate based on contractor profile
      contractorId,
      contractorName,
    },
  });
};

// 💸 Engagement-Based Pricing - Track Lead Engagement
const trackLeadEngagement = (leadId, engagement) => {
  const lead = getLead(leadId);
  if (!lead) return null;
  
  const engagementScores = {
    'email_open': 1,
    'email_click': 3,
    'call': 5,
    'text_response': 4,
    'proposal_view': 6,
  };
  
  const currentScore = lead.crmData.contactAttempts * 2;
  const newScore = currentScore + (engagementScores[engagement.type] || 0);
  
  let updatedEngagementLevel = 'cold';
  if (newScore >= 10) updatedEngagementLevel = 'hot';
  else if (newScore >= 5) updatedEngagementLevel = 'warm';
  
  return updateLead(leadId, {
    engagementLevel: updatedEngagementLevel,
    'crmData.lastContacted': new Date().toISOString(),
    'crmData.contactAttempts': lead.crmData.contactAttempts + 1,
  });
};

// 🔕 Built-in CRM + Auto Follow-up Logic
const scheduleFollowUp = (leadId, followUpData) => {
  const lead = getLead(leadId);
  if (!lead) return null;
  
  const followUpEntry = {
    id: uuidv4(),
    date: followUpData.date,
    type: followUpData.type,
    status: 'scheduled',
    notes: followUpData.notes || '',
  };
  
  return updateLead(leadId, {
    followUpHistory: [...lead.followUpHistory, followUpEntry],
    autoFollowUp: {
      isEnabled: true,
      nextFollowUpDate: followUpData.date,
      followUpType: followUpData.type,
      template: followUpData.template || lead.autoFollowUp.template,
    },
  });
};

const addNote = (leadId, note) => {
  const lead = getLead(leadId);
  if (!lead) return null;
  
  return updateLead(leadId, {
    notes: [...lead.notes, note],
    'crmData.notes': [...lead.crmData.notes, note],
  });
};

const convertToProject = (leadId, projectData) => {
  const lead = getLead(leadId);
  if (!lead) return null;
  
  // Update lead status to won
  updateLead(leadId, { status: 'won' });
  
  // Return project data (would create actual project in production)
  return {
    id: uuidv4(),
    name: projectData.name || `Project from ${lead.name}`,
    leadId,
    ...projectData,
  };
};

// Add sample data with enhanced features
const addSampleData = () => {
  const sampleLeads = [
    {
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '(555) 123-4567',
      company: 'Smith Construction LLC',
      projectType: 'residential',
      projectSize: 'large',
      budget: { min: 75000, max: 120000, currency: 'USD' },
      timeline: { startDate: '2024-02-01', duration: 12, urgency: 'high' },
      location: { city: 'Austin', state: 'TX', zipCode: '78701' },
      requirements: 'Complete kitchen renovation with custom cabinets and granite countertops',
      source: 'website',
      status: 'qualified',
      aiScore: 92,
      engagementLevel: 'hot',
      freshnessScore: 95,
      contractorMatch: { isMatched: true, matchScore: 88, contractorId: 'contractor-1', contractorName: 'Elite Renovations' },
      followUpHistory: [
        { id: '1', date: '2024-01-15T10:00:00Z', type: 'call', status: 'completed', notes: 'Initial consultation - very interested', response: 'Positive response' }
      ],
      autoFollowUp: {
        isEnabled: true,
        nextFollowUpDate: '2024-01-20T14:00:00Z',
        followUpType: 'proposal',
        template: 'Hi John, I have your detailed proposal ready. When would be a good time to review it?'
      },
      crmData: {
        lastContacted: '2024-01-15T10:00:00Z',
        contactAttempts: 3,
        responseRate: 85,
        preferredContactMethod: 'phone',
        notes: ['High-value prospect', 'Ready to start within 30 days', 'Has financing approved'],
        tags: ['high-budget', 'urgent', 'qualified']
      },
      priority: 'high',
      notes: ['Excellent prospect', 'Ready to move forward'],
      assignedTo: 'sales-team',
      tags: ['hot-lead', 'kitchen-renovation']
    },
    {
      name: 'Sarah Johnson',
      email: 'sarah.j@commercial.com',
      phone: '(555) 987-6543',
      company: 'Johnson Properties',
      projectType: 'commercial',
      projectSize: 'medium',
      budget: { min: 45000, max: 65000, currency: 'USD' },
      timeline: { startDate: '2024-03-01', duration: 8, urgency: 'medium' },
      location: { city: 'Dallas', state: 'TX', zipCode: '75201' },
      requirements: 'Office space renovation with modern design elements',
      source: 'referral',
      status: 'contacted',
      aiScore: 78,
      engagementLevel: 'warm',
      freshnessScore: 87,
      contractorMatch: { isMatched: false, matchScore: 0 },
      followUpHistory: [
        { id: '2', date: '2024-01-10T15:30:00Z', type: 'email', status: 'completed', notes: 'Sent proposal', response: 'Will review and get back' }
      ],
      autoFollowUp: {
        isEnabled: true,
        nextFollowUpDate: '2024-01-18T10:00:00Z',
        followUpType: 'email',
        template: 'Hi Sarah, I wanted to follow up on the proposal I sent. Do you have any questions?'
      },
      crmData: {
        lastContacted: '2024-01-10T15:30:00Z',
        contactAttempts: 2,
        responseRate: 60,
        preferredContactMethod: 'email',
        notes: ['Commercial client', 'Budget-conscious', 'Good referral source'],
        tags: ['commercial', 'medium-budget', 'referral']
      },
      priority: 'medium',
      notes: ['Commercial project', 'Good potential'],
      assignedTo: 'commercial-team',
      tags: ['commercial', 'office-renovation']
    },
    {
      name: 'Mike Wilson',
      email: 'mike.wilson@home.com',
      phone: '(555) 456-7890',
      projectType: 'renovation',
      projectSize: 'small',
      budget: { min: 15000, max: 25000, currency: 'USD' },
      timeline: { startDate: '2024-04-01', duration: 4, urgency: 'low' },
      location: { city: 'Houston', state: 'TX', zipCode: '77001' },
      requirements: 'Bathroom remodel with new fixtures and tile',
      source: 'social-media',
      status: 'new',
      aiScore: 45,
      engagementLevel: 'cold',
      freshnessScore: 100,
      contractorMatch: { isMatched: false, matchScore: 0 },
      followUpHistory: [],
      autoFollowUp: {
        isEnabled: true,
        nextFollowUpDate: '2024-01-17T09:00:00Z',
        followUpType: 'email',
        template: 'Hi Mike, I hope you\'re doing well. I specialize in bathroom renovations and would love to help with your project. Let me know if you\'d like to learn more.'
      },
      crmData: {
        lastContacted: '2024-01-14T12:00:00Z',
        contactAttempts: 1,
        responseRate: 0,
        preferredContactMethod: 'email',
        notes: ['Small residential project', 'Budget-conscious', 'Social media lead'],
        tags: ['small-budget', 'bathroom', 'social-media']
      },
      priority: 'low',
      notes: ['New lead from social media'],
      tags: ['bathroom-remodel', 'small-project']
    }
  ];
  
  sampleLeads.forEach(leadData => createLead(leadData));
  return sampleLeads.length;
};

module.exports = {
  leads,
  createLead,
  getLeads,
  getLead,
  updateLead,
  deleteLead,
  scoreLead,
  getAnalytics,
  matchLeadToContractor,
  trackLeadEngagement,
  scheduleFollowUp,
  addNote,
  convertToProject,
  addSampleData,
}; 