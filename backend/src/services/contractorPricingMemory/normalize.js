/**
 * Normalize scope labels for pricing memory matching.
 */

function normalizeScopeKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

const MISSING_KEYWORD_MAP = [
  { pattern: /\b(demo|demolition|tear\s*out|remove)\b/i, keys: ['demo', 'demolition', 'tear_out', 'remove'] },
  { pattern: /\b(backsplash)\b/i, keys: ['backsplash', 'tile'] },
  { pattern: /\b(countertop|counter)\b/i, keys: ['countertop', 'counter'] },
  { pattern: /\b(cabinet)\b/i, keys: ['cabinet'] },
  { pattern: /\b(plumb|faucet|sink)\b/i, keys: ['plumbing', 'faucet', 'sink'] },
  { pattern: /\b(electrical|reconnect)\b/i, keys: ['electrical'] },
  { pattern: /\b(haul|disposal|dumpster)\b/i, keys: ['haul', 'disposal'] },
  { pattern: /\b(baseboard)\b/i, keys: ['baseboard'] },
  { pattern: /\b(transition)\b/i, keys: ['transition'] },
  { pattern: /\b(waterproof)\b/i, keys: ['waterproofing'] },
  { pattern: /\b(lvp|laminate|flooring|tile)\b/i, keys: ['flooring', 'lvp', 'laminate', 'tile'] },
  { pattern: /\b(paint)\b/i, keys: ['paint', 'painting'] },
  { pattern: /\b(permit)\b/i, keys: ['permit'] },
];

function keywordKeysForMissingItem(label) {
  const keys = new Set();
  const norm = normalizeScopeKey(label);
  if (norm) keys.add(norm);
  for (const { pattern, keys: kws } of MISSING_KEYWORD_MAP) {
    if (pattern.test(label)) kws.forEach((k) => keys.add(k));
  }
  return Array.from(keys);
}

function entryMatchesMissingItem(entry, missingLabel) {
  const entryKey = entry.normalizedScopeKey || normalizeScopeKey(entry.scopeItemName);
  const wanted = keywordKeysForMissingItem(missingLabel);
  if (wanted.some((k) => entryKey.includes(k))) return true;
  return wanted.some((k) => normalizeScopeKey(entry.scopeItemName).includes(k));
}

module.exports = {
  normalizeScopeKey,
  keywordKeysForMissingItem,
  entryMatchesMissingItem,
};
