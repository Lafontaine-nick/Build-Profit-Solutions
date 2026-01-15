const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, 'storage');
const UNIFIED_LEADS_FILE = path.join(STORAGE_DIR, 'unified-leads.json');

console.log('🧹 Clearing leads and resetting to fresh mock data...\n');

// Step 1: Delete all existing leads
let leads = [];
if (fs.existsSync(UNIFIED_LEADS_FILE)) {
  leads = JSON.parse(fs.readFileSync(UNIFIED_LEADS_FILE, 'utf8'));
  console.log(`📋 Found ${leads.length} existing leads`);
}

// Step 2: Generate completely fresh leads with proper budgets
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
  
  // For active leads (new, qualified, proposal), set budget to 0
  // For won leads, keep a budget for historical tracking
  const isActive = !['won', 'lost'].includes(stage);
  const budgetRanges = [
    { min: 5000, max: 15000 },
    { min: 15000, max: 35000 },
    { min: 35000, max: 75000 },
    { min: 75000, max: 150000 },
    { min: 150000, max: 300000 },
  ];
  const budget = isActive 
    ? { min: 0, max: 0 }  // Active leads have 0 budget for pipeline health = 0
    : budgetRanges[Math.floor(Math.random() * budgetRanges.length)]; // Won leads keep budget
  
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

// Generate fresh leads
const freshLeads = [
  // NEW STAGE (4 leads) - Fresh leads with 0 budget
  generateMockLead('mock-new-1', 'Residential Roofing Replacement', 'Roofing', 'new', 1, { source: 'PROJECT_BASED' }),
  generateMockLead('mock-new-2', 'Commercial HVAC Installation', 'HVAC', 'new', 2, { source: 'BID_INVITATION' }),
  generateMockLead('mock-new-3', 'Kitchen Plumbing Upgrade', 'Plumbing', 'new', 3, { source: 'MARKETPLACE' }),
  generateMockLead('mock-new-4', 'Electrical Panel Upgrade', 'Electrical', 'new', 0, { source: 'SHARED' }),
  
  // QUALIFIED STAGE (4 leads) - Leads with 0 budget
  generateMockLead('mock-qual-1', 'Office Building Electrical', 'Electrical', 'qualified', 5, { source: 'PROJECT_BASED' }),
  generateMockLead('mock-qual-2', 'Custom Home Framing', 'Framing', 'qualified', 7, { source: 'BID_INVITATION' }),
  generateMockLead('mock-qual-3', 'Bathroom Remodel - Plumbing', 'Plumbing', 'qualified', 10, { source: 'MARKETPLACE' }),
  generateMockLead('mock-qual-4', 'Warehouse Drywall Installation', 'Drywall', 'qualified', 12, { source: 'SHARED' }),
  
  // PROPOSAL STAGE (4 leads) - Leads with 0 budget
  generateMockLead('mock-prop-1', 'Multi-Unit HVAC System', 'HVAC', 'proposal', 15, { source: 'PROJECT_BASED' }),
  generateMockLead('mock-prop-2', 'New Construction Roofing', 'Roofing', 'proposal', 18, { source: 'BID_INVITATION' }),
  generateMockLead('mock-prop-3', 'Office Renovation - Electrical', 'Electrical', 'proposal', 20, { source: 'MARKETPLACE' }),
  generateMockLead('mock-prop-4', 'Residential Painting Project', 'Painting', 'proposal', 22, { source: 'SHARED' }),
  
  // WON STAGE (4 leads) - Leads with budgets (for historical tracking)
  generateMockLead('mock-won-1', 'Residential Flooring Installation', 'Flooring', 'won', 25, { source: 'PROJECT_BASED' }),
  generateMockLead('mock-won-2', 'Commercial Plumbing Repair', 'Plumbing', 'won', 30, { source: 'BID_INVITATION' }),
  generateMockLead('mock-won-3', 'New Home Construction - Framing', 'Framing', 'won', 35, { source: 'MARKETPLACE' }),
  generateMockLead('mock-won-4', 'Retail Store HVAC Upgrade', 'HVAC', 'won', 28, { source: 'SHARED' }),
];

// Save fresh leads
fs.writeFileSync(UNIFIED_LEADS_FILE, JSON.stringify(freshLeads, null, 2));

console.log(`✅ Generated ${freshLeads.length} fresh mock leads`);
console.log(`📊 Total leads: ${freshLeads.length}`);
console.log(`\n📈 Stage breakdown:`);
const stageBreakdown = freshLeads.reduce((acc, lead) => {
  acc[lead.stage] = (acc[lead.stage] || 0) + 1;
  return acc;
}, {});
Object.entries(stageBreakdown).forEach(([stage, count]) => {
  console.log(`   ${stage}: ${count}`);
});

console.log(`\n💰 Budget breakdown:`);
const activeLeads = freshLeads.filter(l => !['won', 'lost'].includes(l.stage));
const activeWithBudget = activeLeads.filter(l => (l.project.budgetMin || 0) > 0 || (l.project.budgetMax || 0) > 0);
const wonLeads = freshLeads.filter(l => l.stage === 'won');
console.log(`   Active leads (new/qualified/proposal): ${activeLeads.length} total`);
console.log(`   Active leads with budget > 0: ${activeWithBudget.length} (should be 0)`);
console.log(`   Won leads with budget: ${wonLeads.length} (for historical tracking)`);

// Calculate pipeline health
const pipelineHealth = activeLeads.reduce((sum, lead) => {
  const min = lead.project.budgetMin || 0;
  const max = lead.project.budgetMax || 0;
  return sum + ((min + max) / 2);
}, 0);
console.log(`\n💵 Pipeline Health: $${pipelineHealth.toLocaleString()} (should be $0)`);

console.log(`\n💾 Saved to ${UNIFIED_LEADS_FILE}`);
console.log(`\n⚠️  IMPORTANT: You need to:`);
console.log(`   1. Reload the backend: curl -X POST http://localhost:3001/api/unified-leads/reload`);
console.log(`   2. Clear frontend cache: Pull to refresh in the app, or restart the app`);
console.log(`   3. If still seeing old leads, clear AsyncStorage 'leadsData' key in the app`);
