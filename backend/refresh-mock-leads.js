const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, 'storage');
const UNIFIED_LEADS_FILE = path.join(STORAGE_DIR, 'unified-leads.json');

// Load current leads
const currentLeads = JSON.parse(fs.readFileSync(UNIFIED_LEADS_FILE, 'utf8'));

console.log(`📋 Current total leads: ${currentLeads.length}`);

// Keep only campaign leads (those with projectId starting with "CAMPAIGN-")
const campaignLeads = currentLeads.filter(lead => 
  lead.projectId && lead.projectId.startsWith('CAMPAIGN-')
);

// Count what we're deleting
const deletedLeads = currentLeads.length - campaignLeads.length;
console.log(`🗑️  Deleting ${deletedLeads} non-campaign leads`);
console.log(`✅ Keeping ${campaignLeads.length} campaign leads`);

// Generate fresh mock leads with various pipeline stages
const now = new Date();
const generateMockLead = (id, title, trade, stage, daysAgo, options = {}) => {
  const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const locations = [
    { city: 'Las Vegas', state: 'NV', zip: '89123', lat: 36.1699, lng: -115.1398 },
    { city: 'Salt Lake City', state: 'UT', zip: '84101', lat: 40.7608, lng: -111.8910 },
    { city: 'Henderson', state: 'NV', zip: '89002', lat: 36.0395, lng: -114.9817 },
    { city: 'St. George', state: 'UT', zip: '84770', lat: 37.0965, lng: -113.5684 },
  ];
  const location = locations[Math.floor(Math.random() * locations.length)];
  
  const trades = ['Roofing', 'Plumbing', 'Electrical', 'HVAC', 'Framing', 'Drywall', 'Painting', 'Flooring'];
  const tradeName = trade || trades[Math.floor(Math.random() * trades.length)];
  
  const stages = ['new', 'qualified', 'proposal', 'won'];
  const stageData = {
    new: { aiScore: 75 + Math.floor(Math.random() * 20), verified: Math.random() > 0.3 },
    qualified: { aiScore: 80 + Math.floor(Math.random() * 15), verified: true },
    proposal: { aiScore: 85 + Math.floor(Math.random() * 10), verified: true },
    won: { aiScore: 90 + Math.floor(Math.random() * 10), verified: true },
  };
  
  const budgetRanges = [
    { min: 5000, max: 15000 },
    { min: 15000, max: 35000 },
    { min: 35000, max: 75000 },
    { min: 75000, max: 150000 },
    { min: 150000, max: 300000 },
  ];
  const budget = budgetRanges[Math.floor(Math.random() * budgetRanges.length)];
  
  const timelines = ['Normal', 'Soon', 'Urgent'];
  const timeline = timelines[Math.floor(Math.random() * timelines.length)];
  
  const sources = ['PROJECT_BASED', 'MARKETPLACE', 'BID_INVITATION', 'SHARED'];
  const source = options.source || sources[Math.floor(Math.random() * sources.length)];
  
  const lead = {
    id: `MOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: title || `${tradeName} Project - ${location.city}`,
    trade: tradeName,
    source: source,
    contact: {
      name: options.contactName || `${['John', 'Sarah', 'Mike', 'Emily', 'David', 'Lisa'][Math.floor(Math.random() * 6)]} ${['Smith', 'Johnson', 'Williams', 'Brown', 'Davis'][Math.floor(Math.random() * 5)]}`,
      email: options.contactEmail || `contact${Math.floor(Math.random() * 1000)}@example.com`,
      phone: `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      company: options.company || `${location.city} ${tradeName} Co`,
    },
    location: {
      ...location,
    },
    project: {
      type: options.projectType || ['new_build', 'remodel', 'repair', 'other'][Math.floor(Math.random() * 4)],
      budgetMin: budget.min,
      budgetMax: budget.max,
      timeline: timeline,
    },
    stage: stage,
    aiScore: stageData[stage].aiScore,
    verified: stageData[stage].verified,
    createdBy: options.createdBy || `gc-${Math.random().toString(36).substr(2, 8)}`,
    assignedTo: options.assignedTo || 'contractor-demo',
    createdAt: createdAt.toISOString(),
    description: options.description || `${tradeName} services for ${location.city} area`,
    updatedAt: createdAt.toISOString(),
  };
  
  // Add stage-specific data
  if (stage === 'qualified') {
    lead.reachedQualifiedAt = new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  }
  
  if (stage === 'proposal') {
    lead.reachedQualifiedAt = new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    lead.bidSubmittedAt = new Date(createdAt.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
  }
  
  if (stage === 'won') {
    lead.reachedQualifiedAt = new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    lead.bidSubmittedAt = new Date(createdAt.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    lead.bidWonAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  
  return lead;
};

// Generate fresh mock leads across all pipeline stages for testing
const freshLeads = [
  // NEW STAGE (4 leads) - Fresh leads just entered
  generateMockLead('mock-new-1', 'Residential Roofing Replacement', 'Roofing', 'new', 1, { source: 'PROJECT_BASED' }),
  generateMockLead('mock-new-2', 'Commercial HVAC Installation', 'HVAC', 'new', 2, { source: 'BID_INVITATION' }),
  generateMockLead('mock-new-3', 'Kitchen Plumbing Upgrade', 'Plumbing', 'new', 3, { source: 'MARKETPLACE' }),
  generateMockLead('mock-new-4', 'Electrical Panel Upgrade', 'Electrical', 'new', 0, { source: 'SHARED' }),
  
  // QUALIFIED STAGE (4 leads) - Leads that have been qualified
  generateMockLead('mock-qual-1', 'Office Building Electrical', 'Electrical', 'qualified', 5, { source: 'PROJECT_BASED' }),
  generateMockLead('mock-qual-2', 'Custom Home Framing', 'Framing', 'qualified', 7, { source: 'BID_INVITATION' }),
  generateMockLead('mock-qual-3', 'Bathroom Remodel - Plumbing', 'Plumbing', 'qualified', 10, { source: 'MARKETPLACE' }),
  generateMockLead('mock-qual-4', 'Warehouse Drywall Installation', 'Drywall', 'qualified', 12, { source: 'SHARED' }),
  
  // PROPOSAL STAGE (4 leads) - Leads with bids submitted
  generateMockLead('mock-prop-1', 'Multi-Unit HVAC System', 'HVAC', 'proposal', 15, { source: 'PROJECT_BASED' }),
  generateMockLead('mock-prop-2', 'New Construction Roofing', 'Roofing', 'proposal', 18, { source: 'BID_INVITATION' }),
  generateMockLead('mock-prop-3', 'Office Renovation - Electrical', 'Electrical', 'proposal', 20, { source: 'MARKETPLACE' }),
  generateMockLead('mock-prop-4', 'Residential Painting Project', 'Painting', 'proposal', 22, { source: 'SHARED' }),
  
  // WON STAGE (4 leads) - Leads that won the bid
  generateMockLead('mock-won-1', 'Residential Flooring Installation', 'Flooring', 'won', 25, { source: 'PROJECT_BASED' }),
  generateMockLead('mock-won-2', 'Commercial Plumbing Repair', 'Plumbing', 'won', 30, { source: 'BID_INVITATION' }),
  generateMockLead('mock-won-3', 'New Home Construction - Framing', 'Framing', 'won', 35, { source: 'MARKETPLACE' }),
  generateMockLead('mock-won-4', 'Retail Store HVAC Upgrade', 'HVAC', 'won', 28, { source: 'SHARED' }),
];

// Combine campaign leads with fresh mock leads
const updatedLeads = [...campaignLeads, ...freshLeads];

// Save to file
fs.writeFileSync(UNIFIED_LEADS_FILE, JSON.stringify(updatedLeads, null, 2));

console.log(`\n✅ Generated ${freshLeads.length} fresh mock leads`);
console.log(`📊 Total leads: ${updatedLeads.length} (${campaignLeads.length} campaign + ${freshLeads.length} mock)`);
console.log(`\n📈 Stage breakdown (all leads):`);
const stageBreakdown = updatedLeads.reduce((acc, lead) => {
  acc[lead.stage] = (acc[lead.stage] || 0) + 1;
  return acc;
}, {});
Object.entries(stageBreakdown).forEach(([stage, count]) => {
  console.log(`   ${stage}: ${count}`);
});

console.log(`\n📈 Fresh mock leads by stage:`);
const mockStageBreakdown = freshLeads.reduce((acc, lead) => {
  acc[lead.stage] = (acc[lead.stage] || 0) + 1;
  return acc;
}, {});
Object.entries(mockStageBreakdown).forEach(([stage, count]) => {
  console.log(`   ${stage}: ${count}`);
});

console.log(`\n💾 Saved to ${UNIFIED_LEADS_FILE}`);
console.log(`🔄 Backend will auto-reload with nodemon`);

