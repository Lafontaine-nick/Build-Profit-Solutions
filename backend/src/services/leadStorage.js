const fs = require('fs');
const path = require('path');
const { getPool } = require('./database');

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

/**
 * Load projects from disk
 */
const PROJECTS_FILE = path.join(STORAGE_DIR, 'projects.json');

if (!fs.existsSync(PROJECTS_FILE)) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify([], null, 2));
}

let projectCache = null;
let projectSchemaPromise = null;

function readProjectFile() {
  try {
    const data = fs.readFileSync(PROJECTS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('❌ Error loading projects:', error);
    return [];
  }
}

function writeProjectFile(projects) {
  try {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
  } catch (error) {
    console.error('❌ Error saving projects:', error);
  }
}

function loadProjects() {
  if (projectCache == null) {
    projectCache = readProjectFile();
  }
  return projectCache;
}

async function ensureProjectSchema() {
  if (!process.env.DATABASE_URL) return null;
  if (!projectSchemaPromise) {
    const pool = getPool();
    projectSchemaPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS synced_projects (
          user_id TEXT NOT NULL DEFAULT '',
          project_id TEXT NOT NULL,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, project_id)
        );
      `)
      .then(() => pool)
      .catch((error) => {
        projectSchemaPromise = null;
        throw error;
      });
  }
  return projectSchemaPromise;
}

async function persistProjectList(projects) {
  const pool = await ensureProjectSchema();
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const keys = [];
    for (const project of projects) {
      const projectId = String(project?.id || '').trim();
      if (!projectId) continue;
      const userId = String(project?.userId || '');
      keys.push(`${userId}\u0000${projectId}`);
      await client.query(
        `INSERT INTO synced_projects (user_id, project_id, payload, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (user_id, project_id)
         DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
        [userId, projectId, JSON.stringify(project)]
      );
    }
    if (keys.length === 0) {
      await client.query('DELETE FROM synced_projects');
    } else {
      await client.query(
        `DELETE FROM synced_projects
         WHERE (user_id || chr(0) || project_id) <> ALL($1::text[])`,
        [keys]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function hydrateProjectsFromDatabase() {
  if (!process.env.DATABASE_URL) {
    projectCache = readProjectFile();
    return;
  }
  const pool = await ensureProjectSchema();
  const result = await pool.query('SELECT payload FROM synced_projects');
  if (result.rows.length > 0) {
    projectCache = result.rows.map((row) => row.payload);
    writeProjectFile(projectCache);
    console.log(`✅ Loaded ${projectCache.length} projects from Postgres`);
    return;
  }
  const fromFile = readProjectFile();
  projectCache = fromFile;
  if (fromFile.length > 0) {
    await persistProjectList(fromFile);
    console.log(`✅ Moved ${fromFile.length} projects from disk into Postgres`);
  }
}

/**
 * Save projects to disk and, when DATABASE_URL is set, to Postgres.
 */
async function saveProjects(projects) {
  projectCache = Array.isArray(projects) ? projects : [];
  writeProjectFile(projectCache);
  if (process.env.DATABASE_URL) {
    await persistProjectList(projectCache);
  }
  return true;
}

/**
 * Load users from disk
 */
const USERS_FILE = path.join(STORAGE_DIR, 'users.json');

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({}, null, 2));
}

function loadUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    const usersObj = JSON.parse(data);
    // Convert object to Map
    const usersMap = new Map();
    for (const [email, user] of Object.entries(usersObj)) {
      usersMap.set(email, user);
    }
    return usersMap;
  } catch (error) {
    console.error('❌ Error loading users:', error);
    return new Map();
  }
}

/**
 * Save users to disk
 */
function saveUsers(usersMap) {
  try {
    // Convert Map to object for JSON serialization
    const usersObj = {};
    for (const [email, user] of usersMap.entries()) {
      usersObj[email] = user;
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersObj, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error saving users:', error);
    return false;
  }
}

module.exports = {
  loadProjectLeads,
  saveProjectLeads,
  loadUnifiedLeads,
  saveUnifiedLeads,
  loadProjects,
  saveProjects,
  hydrateProjectsFromDatabase,
  loadUsers,
  saveUsers,
  PROJECT_LEADS_FILE,
  UNIFIED_LEADS_FILE,
  PROJECTS_FILE,
  USERS_FILE
};
