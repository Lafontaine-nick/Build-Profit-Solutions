/**
 * Opt-in directory for BPS contractor accounts to appear in Find Subcontractors (merged with Google).
 * Persisted to disk — replace with Postgres when ready.
 */

const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../../storage');
const DIRECTORY_FILE = path.join(STORAGE_DIR, 'bps-contractor-directory.json');

function ensureFile() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(DIRECTORY_FILE)) {
    fs.writeFileSync(DIRECTORY_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function loadAll() {
  ensureFile();
  try {
    const raw = fs.readFileSync(DIRECTORY_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveAll(rows) {
  ensureFile();
  fs.writeFileSync(DIRECTORY_FILE, JSON.stringify(rows, null, 2), 'utf8');
}

/**
 * Upsert by id (Clerk user id or stable email-based id).
 */
function upsert(entry) {
  const rows = loadAll();
  const id = String(entry.id || '').trim();
  if (!id) throw new Error('id is required');

  const idx = rows.findIndex((r) => r.id === id);
  const next = {
    ...entry,
    id,
    updatedAt: new Date().toISOString(),
  };

  if (idx >= 0) rows[idx] = { ...rows[idx], ...next };
  else rows.push(next);

  saveAll(rows);
  return rows[idx >= 0 ? idx : rows.length - 1];
}

function listPublic() {
  return loadAll().filter((r) => r.listOnFindSubcontractors === true);
}

module.exports = {
  loadAll,
  upsert,
  listPublic,
};
