/**
 * Match scope items to template / library lines by work intent (demo vs install)
 * and pricing role (material vs labor), not just shared words like "tile".
 */

const { entryMatchesMissingItem } = require('../contractorPricingMemory/normalize');

const DEMO_RE = /\b(demo|demolition|tear[\s-]?out|removal|rip\s*out|haul[\s-]?off)\b/i;
const INSTALL_RE = /\b(install|installation|installing|lay|float|set|place|new\s+floor)\b/i;
const TILE_RE = /\btile\b/i;
const FLOOR_RE = /\b(laminate|lvp|vinyl|flooring|floor)\b/i;
const TRIM_RE = /\b(baseboard|trim|moulding|molding)\b/i;

function blob(...parts) {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

/**
 * Pull only the note fragment that mentions this scope (e.g. "tile demo" for Tile scope),
 * not the whole job notes — avoids classifying laminate as demo because notes mention demo elsewhere.
 */
function noteSnippetForScope(scopeName, notes) {
  if (!notes || !scopeName) return '';
  const tokens = tokenize(scopeName).filter((t) => t.length > 2);
  if (!tokens.length) return '';
  const parts = String(notes).split(/[,;\n]+/);
  for (const part of parts) {
    const pl = part.toLowerCase();
    if (tokens.some((t) => pl.includes(t))) return part.trim();
  }
  return '';
}

function scopeIntentText(scopeItem, draft) {
  const name = scopeItem.scopeName || '';
  const scope = scopeItem.scope || '';
  const primary = blob(name, scope);
  const notes = draft?.originalNotes || '';
  if (!notes) return primary;

  const primaryHasIntent =
    DEMO_RE.test(primary) ||
    INSTALL_RE.test(primary) ||
    FLOOR_RE.test(name) ||
    TRIM_RE.test(primary) ||
    /\bdemo\b/i.test(name);

  if (primaryHasIntent) return primary;

  const snippet = noteSnippetForScope(name, notes);
  return snippet ? blob(primary, snippet) : primary;
}

/**
 * @returns {{ workType: 'demo'|'install'|'supply'|'other', pricingRoles: ('material'|'labor')[], tokens: string[] }}
 */
function getScopeWorkIntent(scopeItem, draft) {
  const name = scopeItem.scopeName || '';
  const text = scopeIntentText(scopeItem, draft);
  const roles = [];

  let workType = 'other';
  if (DEMO_RE.test(text) || /\bdemo\b/i.test(name)) {
    workType = 'demo';
    roles.push('labor');
  } else if (INSTALL_RE.test(text) || FLOOR_RE.test(name) || /flooring|laminate|lvp/i.test(name)) {
    workType = 'install';
    roles.push('material', 'labor');
  } else if (TRIM_RE.test(text)) {
    workType = 'install';
    roles.push('material', 'labor');
  } else {
    roles.push('labor', 'material');
  }

  if (workType === 'demo') {
    return { workType, pricingRoles: ['labor'], tokens: tokenize(text) };
  }
  return { workType, pricingRoles: [...new Set(roles)], tokens: tokenize(text) };
}

/**
 * @param {object} line
 * @param {'material'|'labor'} lineSource - which array the line came from
 */
function getLineWorkIntent(line, lineSource) {
  const text = blob(line.name, line.description, line.section, line.category);
  const fromMaterials = lineSource === 'material';

  let workType = 'install';
  if (DEMO_RE.test(text)) workType = 'demo';
  else if (INSTALL_RE.test(text)) workType = 'install';
  else if (fromMaterials && !DEMO_RE.test(text)) workType = 'install';
  else if (!fromMaterials && DEMO_RE.test(text)) workType = 'demo';
  else if (TILE_RE.test(text) && !DEMO_RE.test(text) && !INSTALL_RE.test(text)) {
    // Bare "Tile" on labor → default install labor, not demo
    workType = 'install';
  }

  const pricingRole = fromMaterials ? 'material' : 'labor';

  return { workType, pricingRole, tokens: tokenize(text), lineSource };
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function workTypesCompatible(scopeWork, lineWork) {
  if (scopeWork.workType === 'demo') return lineWork.workType === 'demo';
  if (scopeWork.workType === 'install') {
    return lineWork.workType === 'install' || lineWork.workType === 'supply';
  }
  return scopeWork.workType === lineWork.workType || lineWork.workType === 'install';
}

function tradeTokensCompatible(scopeItem, line) {
  const scopeText = blob(scopeItem.scopeName, scopeItem.scope);
  const lineText = blob(line.name, line.description);

  if (DEMO_RE.test(scopeText)) return DEMO_RE.test(lineText) || entryMatchesMissingItem(
    { scopeItemName: lineText },
    scopeItem.scopeName
  );

  if (FLOOR_RE.test(scopeText) || /flooring|laminate/i.test(scopeItem.scopeName)) {
    if (FLOOR_RE.test(lineText) || INSTALL_RE.test(lineText)) return true;
    if (TILE_RE.test(lineText) && !DEMO_RE.test(lineText) && !TRIM_RE.test(lineText)) return true;
    return entryMatchesMissingItem({ scopeItemName: lineText }, scopeItem.scopeName);
  }

  if (TRIM_RE.test(scopeText)) return TRIM_RE.test(lineText);

  return entryMatchesMissingItem({ scopeItemName: lineText }, scopeItem.scopeName);
}

/**
 * Score 0 = no match. Higher = better intent + name alignment.
 */
function scoreScopeToLine(scopeItem, line, lineSource, draft) {
  const scopeIntent = getScopeWorkIntent(scopeItem, draft);
  const lineIntent = getLineWorkIntent(line, lineSource);

  if (!workTypesCompatible(scopeIntent, lineIntent)) return 0;
  if (!scopeIntent.pricingRoles.includes(lineIntent.pricingRole)) return 0;
  if (!tradeTokensCompatible(scopeItem, line)) return 0;

  let score = 20;
  if (scopeIntent.workType === lineIntent.workType) score += 25;
  if (scopeIntent.workType === 'demo' && DEMO_RE.test(blob(line.name, line.description))) score += 20;
  if (scopeIntent.workType === 'install' && INSTALL_RE.test(blob(line.name, line.description))) score += 15;
  if (lineIntent.lineSource === 'material' && scopeIntent.pricingRoles.includes('material')) score += 10;
  if (lineIntent.lineSource === 'labor' && scopeIntent.pricingRoles.includes('labor')) score += 10;

  const overlap = scopeIntent.tokens.filter((t) => lineIntent.tokens.includes(t)).length;
  score += overlap * 3;

  return score;
}

module.exports = {
  getScopeWorkIntent,
  getLineWorkIntent,
  scoreScopeToLine,
  workTypesCompatible,
  tradeTokensCompatible,
  noteSnippetForScope,
  scopeIntentText,
};
