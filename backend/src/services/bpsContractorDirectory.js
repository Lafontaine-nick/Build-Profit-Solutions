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
function normEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/** One opt-in listing per email — avoids stale rows when Clerk id changes. */
function reconcileEmailListings(activeId, email, listOn) {
  const em = normEmail(email);
  if (!em) return;
  const rows = loadAll();
  let changed = false;
  for (const r of rows) {
    if (normEmail(r.email) !== em) continue;
    const shouldList = listOn && r.id === activeId;
    if (r.listOnFindSubcontractors !== shouldList) {
      r.listOnFindSubcontractors = shouldList;
      r.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) saveAll(rows);
}

/** Opt-out: turn off every listing tied to this account (Clerk id, email, phone, company+ZIP). */
function disableListingsForIdentity({
  userId,
  email,
  phone,
  companyName,
  zip,
} = {}) {
  const uid = String(userId || '').trim();
  const em = normEmail(email);
  const ph = String(phone || '').replace(/\D/g, '');
  const co = String(companyName || '')
    .trim()
    .toLowerCase();
  const z = String(zip || '')
    .replace(/\D/g, '')
    .slice(0, 5);

  const rows = loadAll();
  let changed = false;
  const next = rows.filter((r) => {
    const rowEm = normEmail(r.email);
    const rowPh = String(r.phone || '').replace(/\D/g, '');
    const rowCo = String(r.companyName || '')
      .trim()
      .toLowerCase();
    const rowZip = String(r.zip || '')
      .replace(/\D/g, '')
      .slice(0, 5);

    const identityMatch =
      (uid && r.id === uid) ||
      (em && rowEm && rowEm === em) ||
      (ph.length >= 10 && rowPh.length >= 10 && rowPh === ph) ||
      (co && co.length >= 3 && rowCo === co && z.length === 5 && rowZip === z);

    if (!identityMatch) return true;

    if (isDemoDirectoryId(r.id) || (em && rowEm === em && uid && r.id !== uid)) {
      changed = true;
      return false;
    }

    if (r.listOnFindSubcontractors) {
      r.listOnFindSubcontractors = false;
      r.updatedAt = new Date().toISOString();
      changed = true;
    }
    return true;
  });

  if (changed) saveAll(next.length !== rows.length ? next : rows);
}

function pruneOrphanListings(activeId, entry) {
  const em = normEmail(entry.email);
  if (!em) return;
  const zip = String(entry.zip || '')
    .replace(/\D/g, '')
    .slice(0, 5);
  if (zip.length !== 5) return;

  const rows = loadAll();
  let changed = false;
  const next = rows.filter((r) => {
    if (r.id === activeId) return true;
    if (isDemoDirectoryId(r.id)) {
      changed = true;
      return false;
    }
    if (normEmail(r.email)) return true;
    const rZip = String(r.zip || '')
      .replace(/\D/g, '')
      .slice(0, 5);
    const emptyProfile =
      !String(r.companyName || '').trim() && !String(r.contactName || '').trim();
    if (emptyProfile && rZip === zip) {
      changed = true;
      return false;
    }
    return true;
  });
  if (changed) saveAll(next);
}

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
  if (next.listOnFindSubcontractors === true) {
    reconcileEmailListings(id, next.email, true);
  } else {
    disableListingsForIdentity({
      userId: id,
      email: next.email,
      phone: next.phone,
      companyName: next.companyName,
      zip: next.zip,
    });
  }
  pruneOrphanListings(id, next);

  // Drop stale rows that used email/demo ids before Clerk id was available.
  const em = normEmail(next.email);
  if (em) {
    const current = loadAll();
    const cleaned = current.filter((r) => {
      if (r.id === id) return true;
      if (normEmail(r.email) === em && r.id !== id) return false;
      if (r.id === em) return false;
      if (isDemoDirectoryId(r.id) && normEmail(r.email) === em) return false;
      return true;
    });
    if (cleaned.length !== current.length) saveAll(cleaned);
  }

  return loadAll().find((r) => r.id === id) || next;
}

function isDemoDirectoryId(id) {
  const s = String(id || '').trim().toLowerCase();
  return s === 'contractor-demo' || s === 'anonymous' || s.startsWith('demo-');
}

function hasCompanyName(row) {
  return Boolean(String(row?.companyName || '').trim());
}

/** When the same contractor registered twice (e.g. legacy `contractor-demo` + Clerk `user_…`), keep one row. */
function dedupeDirectoryRows(rows) {
  const keyFor = (r) => {
    const email = normEmail(r.email);
    if (email) return `email:${email}`;
    const phone = String(r.phone || '').replace(/\D/g, '');
    const zip = String(r.zip || '')
      .replace(/\D/g, '')
      .slice(0, 5);
    const co = String(r.companyName || '')
      .trim()
      .toLowerCase();
    if (phone.length >= 10 && zip.length === 5) return `phonezip:${phone}|${zip}`;
    if (phone && co) return `pc:${phone}|${co}`;
    if (co && zip.length === 5) return `cozip:${co}|${zip}`;
    return `id:${String(r.id || '').trim()}`;
  };

  const pick = (a, b) => {
    const aDemo = isDemoDirectoryId(a.id);
    const bDemo = isDemoDirectoryId(b.id);
    if (aDemo && !bDemo) return b;
    if (!aDemo && bDemo) return a;
    const aHasCo = hasCompanyName(a);
    const bHasCo = hasCompanyName(b);
    if (aHasCo && !bHasCo) return a;
    if (!aHasCo && bHasCo) return b;
    const ta = new Date(a.updatedAt || 0).getTime();
    const tb = new Date(b.updatedAt || 0).getTime();
    return tb >= ta ? b : a;
  };

  const map = new Map();
  for (const r of rows) {
    const k = keyFor(r);
    const prev = map.get(k);
    map.set(k, prev ? pick(prev, r) : r);
  }
  return [...map.values()];
}

/** Remove directory rows for a deleted account (Clerk id, email-as-id, or matching email). */
function removeListingsForUser({ userId, email } = {}) {
  const uid = String(userId || '').trim();
  const em = normEmail(email);
  const rows = loadAll();
  const next = rows.filter((r) => {
    const rid = String(r.id || '').trim();
    if (uid && rid === uid) return false;
    if (em && normEmail(r.email) === em) return false;
    if (em && rid === em) return false;
    return true;
  });
  const removed = rows.length - next.length;
  if (removed > 0) saveAll(next);
  return removed;
}

function listPublic() {
  const listed = loadAll().filter(
    (r) => r.listOnFindSubcontractors === true && !isDemoDirectoryId(r.id)
  );
  return dedupeDirectoryRows(listed);
}

module.exports = {
  loadAll,
  upsert,
  listPublic,
  removeListingsForUser,
  disableListingsForIdentity,
};
