/**
 * File-backed contractor pricing memory (works without DB migration).
 * Optional PostgreSQL sync when contractor_pricing_memory table exists.
 */

const fs = require('fs');
const path = require('path');
const { getPool } = require('../database');

const DATA_DIR = path.join(__dirname, '../../data/contractor-pricing-memory');

const DEFAULT_SETTINGS = {
  pricingMemoryEnabled: true,
  excludeTestBids: true,
  learnOnApply: true,
  learnOnSubmit: true,
  learnOnWon: true,
  learnOnCompleted: true,
  learnOnSavedTemplate: true,
  learnOnApprovedAiSuggested: true,
  defaultSaveToLibrary: true,
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function safeUserId(userId) {
  return String(userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function userStorePath(userId) {
  return path.join(DATA_DIR, `${safeUserId(userId)}.json`);
}

function loadUserStore(userId) {
  ensureDataDir();
  const file = userStorePath(userId);
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
        entries: Array.isArray(raw.entries) ? raw.entries : [],
      };
    }
  } catch (e) {
    console.warn('contractorPricingMemory: could not read store', e.message);
  }
  return { settings: { ...DEFAULT_SETTINGS }, entries: [] };
}

function saveUserStore(userId, store) {
  ensureDataDir();
  fs.writeFileSync(userStorePath(userId), JSON.stringify(store, null, 2), 'utf8');
}

function newEntryId() {
  return `cpm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeScopeKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function normalizeEntry(entry, userId) {
  const now = new Date().toISOString();
  const scopeItemName = String(entry.scopeItemName || '').trim();
  return {
    id: entry.id || newEntryId(),
    userId: String(userId),
    companyId: entry.companyId || null,
    projectType: entry.projectType || 'other',
    trade: entry.trade || entry.projectType || 'other',
    category: entry.category || 'labor',
    scopeItemName,
    normalizedScopeKey: entry.normalizedScopeKey || normalizeScopeKey(scopeItemName),
    unitType: entry.unitType || 'lump_sum',
    quantity: entry.quantity != null ? Number(entry.quantity) : null,
    unitRate: entry.unitRate != null ? Number(entry.unitRate) : null,
    laborAmount: entry.laborAmount != null ? Math.round(Number(entry.laborAmount)) : null,
    materialAmount: entry.materialAmount != null ? Math.round(Number(entry.materialAmount)) : null,
    subcontractorAmount:
      entry.subcontractorAmount != null ? Math.round(Number(entry.subcontractorAmount)) : null,
    equipmentAmount: entry.equipmentAmount != null ? Math.round(Number(entry.equipmentAmount)) : null,
    totalAmount: entry.totalAmount != null ? Math.round(Number(entry.totalAmount)) : null,
    markupPct: entry.markupPct != null ? Number(entry.markupPct) : null,
    marginPct: entry.marginPct != null ? Number(entry.marginPct) : null,
    region: entry.region || null,
    pricingSource: entry.pricingSource || 'user_provided',
    bidStatus: entry.bidStatus || 'applied',
    projectId: entry.projectId || null,
    estimateId: entry.estimateId || null,
    actualJobCost: entry.actualJobCost != null ? Math.round(Number(entry.actualJobCost)) : null,
    finalProfitMargin: entry.finalProfitMargin != null ? Number(entry.finalProfitMargin) : null,
    isTestBid: Boolean(entry.isTestBid),
    usageCount: entry.usageCount || entry.useCount || 1,
    useCount: entry.useCount || entry.usageCount || 1,
    createdAt: entry.createdAt || now,
    lastUsedAt: now,
  };
}

function entryKey(e) {
  return [
    e.normalizedScopeKey || normalizeScopeKey(e.scopeItemName),
    e.unitType,
    e.category,
    e.trade || '',
    e.unitRate != null ? Math.round(e.unitRate * 100) : 'na',
  ].join('|');
}

function upsertEntries(userId, incoming) {
  const store = loadUserStore(userId);
  const byKey = new Map(store.entries.map((e) => [entryKey(e), e]));

  let added = 0;
  let updated = 0;
  for (const raw of incoming) {
    const entry = normalizeEntry(raw, userId);
    if (!entry.scopeItemName) continue;
    const key = entryKey(entry);
    const existing = byKey.get(key);
    if (existing) {
      existing.usageCount = (existing.usageCount || existing.useCount || 1) + 1;
      existing.useCount = existing.usageCount;
      existing.lastUsedAt = entry.lastUsedAt;
      if (entry.unitRate != null) existing.unitRate = entry.unitRate;
      if (entry.quantity != null) existing.quantity = entry.quantity;
      if (entry.totalAmount != null) existing.totalAmount = entry.totalAmount;
      if (entry.bidStatus) existing.bidStatus = entry.bidStatus;
      updated++;
    } else {
      byKey.set(key, entry);
      added++;
    }
  }

  store.entries = Array.from(byKey.values());
  saveUserStore(userId, store);
  return { added, updated, total: store.entries.length };
}

function getSettings(userId) {
  return loadUserStore(userId).settings;
}

function updateSettings(userId, patch) {
  const store = loadUserStore(userId);
  store.settings = { ...store.settings, ...patch };
  saveUserStore(userId, store);
  return store.settings;
}

function listEntries(userId, filters = {}) {
  const store = loadUserStore(userId);
  let entries = store.entries;
  if (filters.trade) {
    entries = entries.filter((e) => e.trade === filters.trade || e.projectType === filters.trade);
  }
  if (filters.projectType) {
    entries = entries.filter((e) => e.projectType === filters.projectType);
  }
  return entries.sort((a, b) => new Date(b.lastUsedAt) - new Date(a.lastUsedAt));
}

function clearMemory(userId) {
  const store = loadUserStore(userId);
  store.entries = [];
  saveUserStore(userId, store);
  return { cleared: true };
}

function updateEntry(userId, entryId, patch) {
  const store = loadUserStore(userId);
  const idx = store.entries.findIndex((e) => e.id === entryId);
  if (idx < 0) return null;
  const next = normalizeEntry({ ...store.entries[idx], ...patch, id: entryId }, userId);
  store.entries[idx] = next;
  saveUserStore(userId, store);
  return next;
}

function deleteEntry(userId, entryId) {
  const store = loadUserStore(userId);
  const before = store.entries.length;
  store.entries = store.entries.filter((e) => e.id !== entryId);
  saveUserStore(userId, store);
  return { deleted: store.entries.length < before };
}

function deleteEntriesForProject(userId, projectId) {
  const pid = String(projectId || '').trim();
  if (!pid) return { deleted: 0 };
  const store = loadUserStore(userId);
  const before = store.entries.length;
  store.entries = store.entries.filter(
    (e) => String(e.projectId || '') !== pid && String(e.estimateId || '') !== pid
  );
  saveUserStore(userId, store);
  return { deleted: before - store.entries.length };
}

function getLibraryGrouped(userId) {
  const entries = listEntries(userId);
  const byTrade = {};
  for (const e of entries) {
    const trade = e.trade || e.projectType || 'other';
    if (!byTrade[trade]) {
      byTrade[trade] = { trade, label: trade.replace(/_/g, ' '), items: [] };
    }
    byTrade[trade].items.push({
      id: e.id,
      scopeItemName: e.scopeItemName,
      category: e.category,
      unitType: e.unitType,
      unitRate: e.unitRate,
      quantity: e.quantity,
      totalAmount: e.totalAmount,
      usageCount: e.usageCount || e.useCount || 1,
      lastUsedAt: e.lastUsedAt,
      pricingSource: e.pricingSource,
      bidStatus: e.bidStatus,
      region: e.region,
    });
  }
  return Object.values(byTrade).sort((a, b) => a.label.localeCompare(b.label));
}

async function tryPersistToPostgres(userId, entries) {
  const pool = getPool();
  if (!pool || entries.length === 0) return;

  try {
    const check = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'contractor_pricing_memory' LIMIT 1`
    );
    if (check.rows.length === 0) return;

    for (const e of entries) {
      await pool.query(
        `INSERT INTO contractor_pricing_memory (
          user_id, company_id, project_type, trade, category, scope_item_name, unit_type,
          quantity, unit_rate, labor_amount, material_amount, subcontractor_amount, equipment_amount,
          total_amount, markup_pct, margin_pct, region, pricing_source, bid_status,
          project_id, estimate_id, actual_job_cost, final_profit_margin, is_test_bid, use_count, last_used_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,NOW())`,
        [
          e.userId,
          e.companyId,
          e.projectType,
          e.trade,
          e.category,
          e.scopeItemName,
          e.unitType,
          e.quantity,
          e.unitRate,
          e.laborAmount,
          e.materialAmount,
          e.subcontractorAmount,
          e.equipmentAmount,
          e.totalAmount,
          e.markupPct,
          e.marginPct,
          e.region,
          e.pricingSource,
          e.bidStatus,
          e.projectId,
          e.estimateId,
          e.actualJobCost,
          e.finalProfitMargin,
          e.isTestBid,
          e.useCount || 1,
        ]
      );
    }
  } catch (err) {
    console.warn('contractorPricingMemory: postgres persist skipped', err.message);
  }
}

module.exports = {
  DEFAULT_SETTINGS,
  loadUserStore,
  saveUserStore,
  upsertEntries,
  getSettings,
  updateSettings,
  listEntries,
  clearMemory,
  updateEntry,
  deleteEntry,
  deleteEntriesForProject,
  getLibraryGrouped,
  tryPersistToPostgres,
  normalizeScopeKey,
};
