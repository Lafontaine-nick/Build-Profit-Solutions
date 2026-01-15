const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, 'storage');
const UNIFIED_LEADS_FILE = path.join(STORAGE_DIR, 'unified-leads.json');

// Load current leads
let leads = [];
if (fs.existsSync(UNIFIED_LEADS_FILE)) {
  leads = JSON.parse(fs.readFileSync(UNIFIED_LEADS_FILE, 'utf8'));
  console.log(`📋 Loaded ${leads.length} leads`);
} else {
  console.log('⚠️  No leads file found');
  process.exit(0);
}

// Set all active lead budgets to 0 (won/lost leads keep their budgets for historical tracking)
let updatedCount = 0;
const updatedLeads = leads.map(lead => {
  // Only update active leads (not won or lost)
  const isActive = !['won', 'lost'].includes(lead.stage);
  
  if (isActive && lead.project) {
    updatedCount++;
    return {
      ...lead,
      project: {
        ...lead.project,
        budgetMin: 0,
        budgetMax: 0,
      },
      updatedAt: new Date().toISOString(),
    };
  }
  
  return lead;
});

// Save updated leads
fs.writeFileSync(UNIFIED_LEADS_FILE, JSON.stringify(updatedLeads, null, 2));

console.log(`\n✅ Cleared pipeline health to 0`);
console.log(`📊 Updated ${updatedCount} active leads (budgets set to 0)`);
console.log(`📈 Won/lost leads kept their original budgets for historical tracking`);
console.log(`💾 Saved to ${UNIFIED_LEADS_FILE}`);
console.log(`🔄 Backend will auto-reload with nodemon`);
