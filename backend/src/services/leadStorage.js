const fs = require('fs');
const path = require('path');

// Storage file paths
const STORAGE_DIR = path.join(__dirname, '../../storage');
const PROJECT_LEADS_FILE = path.join(STORAGE_DIR, 'project-leads.json');
const UNIFIED_LEADS_FILE = path.join(STORAGE_DIR, 'unified-leads.json');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Initialize storage files if they don't exist
if (!fs.existsSync(PROJECT_LEADS_FILE)) {
  fs.writeFileSync(PROJECT_LEADS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(UNIFIED_LEADS_FILE)) {
  fs.writeFileSync(UNIFIED_LEADS_FILE, JSON.stringify([], null, 2));
}

/**
 * Load project leads from disk
 */
function loadProjectLeads() {
  try {
    const data = fs.readFileSync(PROJECT_LEADS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading project leads:', error);
    return [];
  }
}

/**
 * Save project leads to disk
 */
function saveProjectLeads(leads) {
  try {
    fs.writeFileSync(PROJECT_LEADS_FILE, JSON.stringify(leads, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error saving project leads:', error);
    return false;
  }
}

/**
 * Load unified leads from disk
 */
function loadUnifiedLeads() {
  try {
    const data = fs.readFileSync(UNIFIED_LEADS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading unified leads:', error);
    return [];
  }
}

/**
 * Save unified leads to disk
 */
function saveUnifiedLeads(leads) {
  try {
    fs.writeFileSync(UNIFIED_LEADS_FILE, JSON.stringify(leads, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error saving unified leads:', error);
    return false;
  }
}

module.exports = {
  loadProjectLeads,
  saveProjectLeads,
  loadUnifiedLeads,
  saveUnifiedLeads,
  PROJECT_LEADS_FILE,
  UNIFIED_LEADS_FILE
};
