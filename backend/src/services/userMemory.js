// ─────────────────────────────────────────────────────────────────────────────
// userMemory.js — persistent per-user AI memory (additive, non-invasive)
// Stores small, stable preferences and observations across sessions so the
// assistant can say "you usually target 22% margin" without being told each time.
//
// NOTE: This module is purely additive. Existing request logic continues to
// work if this file or its storage is missing — everything falls back to no-op.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage');
const STORAGE_FILE = path.join(STORAGE_DIR, 'user-memory.json');

const MAX_FAVORITE_VENDORS = 8;
const MAX_TRADES = 8;
const MAX_PROJECT_ALIASES = 20;
const MAX_RECENT_TOPICS = 8;

// In-memory cache to avoid touching disk on every request.
let cache = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

function safeReadFile() {
  try {
    if (!fs.existsSync(STORAGE_FILE)) return {};
    const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function safeWriteFile(obj) {
  try {
    if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(obj, null, 2));
    return true;
  } catch (_err) {
    return false;
  }
}

function getStore() {
  const now = Date.now();
  if (!cache || now - cacheLoadedAt > CACHE_TTL_MS) {
    cache = safeReadFile();
    cacheLoadedAt = now;
  }
  return cache;
}

function normalizeUserId(userId) {
  if (userId == null) return null;
  const s = String(userId).trim();
  return s.length > 0 ? s : null;
}

function emptyMemory() {
  return {
    preferredMarginPct: null,
    preferredMarkupPct: null,
    favoriteVendors: {},       // { vendorName: count }
    tradesUsed: {},            // { tradeName: count }
    projectAliases: {},        // { lowercaseAlias: canonicalProjectName }
    lastTopics: [],            // most recent unique topics
    totalMessages: 0,
    firstSeenAt: null,
    updatedAt: null,
  };
}

function loadUserMemory(userId) {
  const id = normalizeUserId(userId);
  if (!id) return emptyMemory();
  const store = getStore();
  const mem = store[id];
  if (!mem || typeof mem !== 'object') return emptyMemory();
  return { ...emptyMemory(), ...mem };
}

function saveUserMemory(userId, memory) {
  const id = normalizeUserId(userId);
  if (!id || !memory || typeof memory !== 'object') return false;
  const store = getStore();
  store[id] = { ...memory, updatedAt: new Date().toISOString() };
  cache = store;
  cacheLoadedAt = Date.now();
  return safeWriteFile(store);
}

// ─── Observation helpers ───────────────────────────────────────────────────

function bumpCount(map, key, maxKeep) {
  if (!map || !key) return map;
  const clean = String(key).trim();
  if (!clean) return map;
  map[clean] = (Number(map[clean]) || 0) + 1;
  // Cap size by keeping top N by count.
  const entries = Object.entries(map);
  if (entries.length > maxKeep) {
    entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
    const capped = {};
    for (const [k, v] of entries.slice(0, maxKeep)) capped[k] = v;
    return capped;
  }
  return map;
}

function pushUnique(arr, value, maxKeep) {
  if (!value) return arr;
  const clean = String(value).trim();
  if (!clean) return arr;
  const filtered = (arr || []).filter((v) => v !== clean);
  filtered.unshift(clean);
  return filtered.slice(0, maxKeep);
}

/**
 * Extract observations from a user message + request context and merge into
 * the user's memory. Safe to call on every request — runs synchronously with
 * no LLM tokens used. All extraction is heuristic / regex.
 */
function recordUserMemoryFromRequest({ userId, message, parsedContext, session }) {
  const id = normalizeUserId(userId);
  if (!id) return;
  const memory = loadUserMemory(id);
  memory.firstSeenAt = memory.firstSeenAt || new Date().toISOString();
  memory.totalMessages = (memory.totalMessages || 0) + 1;

  const msg = String(message || '');
  const msgLower = msg.toLowerCase();

  // Preferred margin — "target 22%", "I want 20% margin", "protect 25%"
  const marginMatch = msg.match(/\b(?:target|keep|protect|need|want|shoot for|aim for)\s+(?:a\s+)?(\d{1,2}(?:\.\d)?)\s*%?\s*margin\b/i) ||
    msg.match(/\b(\d{1,2}(?:\.\d)?)\s*%\s*margin\b/i);
  if (marginMatch) {
    const pct = Number(marginMatch[1]);
    if (pct >= 5 && pct <= 60) memory.preferredMarginPct = pct;
  }

  // Preferred markup — "I usually markup 35%"
  const markupMatch = msg.match(/\b(?:usually|typically|normally)\s+mark\s*up\s+(\d{1,2}(?:\.\d)?)\s*%/i) ||
    msg.match(/\b(\d{1,2}(?:\.\d)?)\s*%\s*markup\b/i);
  if (markupMatch) {
    const pct = Number(markupMatch[1]);
    if (pct >= 5 && pct <= 80) memory.preferredMarkupPct = pct;
  }

  // Topics — mirror what session tracking already did, but persist it.
  if (/\bmargin|profit|money|revenue|earning/i.test(msgLower)) memory.lastTopics = pushUnique(memory.lastTopics, 'profitability', MAX_RECENT_TOPICS);
  if (/\bbudget|cost|spend|expense|over budget/i.test(msgLower)) memory.lastTopics = pushUnique(memory.lastTopics, 'costs', MAX_RECENT_TOPICS);
  if (/\brisk|danger|worry|concern|problem/i.test(msgLower)) memory.lastTopics = pushUnique(memory.lastTopics, 'risks', MAX_RECENT_TOPICS);
  if (/\bpayment|invoice|collect|deposit/i.test(msgLower)) memory.lastTopics = pushUnique(memory.lastTopics, 'payments', MAX_RECENT_TOPICS);
  if (/\btimeline|schedule|milestone|deadline/i.test(msgLower)) memory.lastTopics = pushUnique(memory.lastTopics, 'schedule', MAX_RECENT_TOPICS);
  if (/\bestimate|bid|quote|proposal/i.test(msgLower)) memory.lastTopics = pushUnique(memory.lastTopics, 'estimating', MAX_RECENT_TOPICS);

  // Vendors referenced by recent expense POST actions coming from context
  try {
    const recentExpense = parsedContext?.recentExpense || null;
    if (recentExpense && recentExpense.vendor) {
      memory.favoriteVendors = bumpCount(memory.favoriteVendors, recentExpense.vendor, MAX_FAVORITE_VENDORS);
    }
    // Also scan last expenses array if present (single project contexts)
    const expenses = Array.isArray(parsedContext?.expenses) ? parsedContext.expenses.slice(-5) : [];
    for (const e of expenses) {
      if (e?.vendor) memory.favoriteVendors = bumpCount(memory.favoriteVendors, e.vendor, MAX_FAVORITE_VENDORS);
      const trade = e?.trade || (String(e?.category || '').toLowerCase() === 'labor' ? e?.vendor : null);
      if (trade) memory.tradesUsed = bumpCount(memory.tradesUsed, trade, MAX_TRADES);
    }
  } catch (_err) { /* ignore */ }

  // Project aliases — when user references "chris" and context resolves a project name.
  try {
    const resolvedName =
      parsedContext?.currentProject ||
      parsedContext?.projectName ||
      parsedContext?.bidTitle ||
      null;
    if (resolvedName && msgLower.length < 80) {
      // Look for patterns like "on nick", "for chris", "review chris"
      const aliasMatch = msgLower.match(/\b(?:on|for|about|review|check|how(?:'s| is))\s+([a-z][a-z']{1,20})\b/);
      if (aliasMatch) {
        const alias = aliasMatch[1];
        const commonWords = new Set(['the', 'this', 'that', 'these', 'those', 'chris', 'nick', 'bob', 'jason']);
        // We DO want to capture real names, so only skip pronouns.
        if (!['the', 'this', 'that', 'these', 'those'].includes(alias)) {
          memory.projectAliases[alias] = resolvedName;
        }
      }
    }
    const aliasEntries = Object.entries(memory.projectAliases);
    if (aliasEntries.length > MAX_PROJECT_ALIASES) {
      memory.projectAliases = Object.fromEntries(aliasEntries.slice(-MAX_PROJECT_ALIASES));
    }
  } catch (_err) { /* ignore */ }

  // Pull session-tracked estimate preferences (already set by existing session memory code).
  try {
    if (session?.estimatePreferences && typeof session.estimatePreferences === 'object') {
      const ep = session.estimatePreferences;
      if (typeof ep.targetMarginPct === 'number' && ep.targetMarginPct > 0) {
        memory.preferredMarginPct = ep.targetMarginPct;
      }
      if (typeof ep.markupPct === 'number' && ep.markupPct > 0) {
        memory.preferredMarkupPct = ep.markupPct;
      }
    }
  } catch (_err) { /* ignore */ }

  saveUserMemory(id, memory);
}

/**
 * Build a compact USER PROFILE block for injection into the system prompt.
 * Returns an empty string if the memory is effectively blank so we don't
 * bloat the prompt for brand-new users.
 */
function buildUserMemoryPromptBlock(memory) {
  if (!memory || typeof memory !== 'object') return '';

  const lines = [];
  if (typeof memory.preferredMarginPct === 'number') {
    lines.push(`- Typical target margin: ${memory.preferredMarginPct}%`);
  }
  if (typeof memory.preferredMarkupPct === 'number') {
    lines.push(`- Typical markup: ${memory.preferredMarkupPct}%`);
  }
  const topVendors = Object.entries(memory.favoriteVendors || {})
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, 4)
    .map(([name]) => name);
  if (topVendors.length > 0) {
    lines.push(`- Frequent vendors/suppliers: ${topVendors.join(', ')}`);
  }
  const topTrades = Object.entries(memory.tradesUsed || {})
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, 4)
    .map(([name]) => name);
  if (topTrades.length > 0) {
    lines.push(`- Trades commonly used: ${topTrades.join(', ')}`);
  }
  const aliasEntries = Object.entries(memory.projectAliases || {}).slice(-6);
  if (aliasEntries.length > 0) {
    const pairs = aliasEntries.map(([alias, name]) => `"${alias}" → ${name}`).join(', ');
    lines.push(`- Known project nicknames: ${pairs}`);
  }
  if (Array.isArray(memory.lastTopics) && memory.lastTopics.length > 0) {
    lines.push(`- Recent topics they care about: ${memory.lastTopics.slice(0, 5).join(', ')}`);
  }

  if (lines.length === 0) return '';

  return `
━━━━━ USER PROFILE (persistent memory — use naturally, do NOT recite as a list) ━━━━━
${lines.join('\n')}
GUIDANCE:
→ Use these preferences to ground advice (e.g., if target margin is 22% and a bid is at 17%, flag it).
→ When the user mentions a nickname that matches a known project, resolve it without asking.
→ Do NOT quote this block back to the user — treat it as prior context you already knew.`;
}

/**
 * Derive a stable userId from an Express request. Falls back to the first
 * resolvable identifier — real production auth should fill req.user.userId.
 */
function resolveUserId(req, { sessionId = null, parsedContext = {} } = {}) {
  const fromAuth = req?.user?.userId || req?.user?.id || req?.user?.sub || null;
  if (fromAuth) return String(fromAuth);
  const fromBody = req?.body?.userId;
  if (fromBody) return String(fromBody);
  const fromCtx = parsedContext?.userId || parsedContext?.user?.id || null;
  if (fromCtx) return String(fromCtx);
  if (sessionId && !String(sessionId).startsWith('auto-') && !String(sessionId).startsWith('stream-')) {
    return `session:${sessionId}`;
  }
  return null;
}

module.exports = {
  loadUserMemory,
  saveUserMemory,
  buildUserMemoryPromptBlock,
  recordUserMemoryFromRequest,
  resolveUserId,
};
