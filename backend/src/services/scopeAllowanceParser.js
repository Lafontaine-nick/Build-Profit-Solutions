/**
 * Parse lump-sum / allowance dollar amounts from job notes into checklist itemQuantities.
 * Skips unit rates ($8/sqft) — only totals and lump-sum lines.
 */

const { splitScopeNoteSentences } = require('./estimateDraftQuantityPrice');
const ACCUMULATE_ALLOWANCE_IDS = new Set(['floor_demo']);

const UNIT_RATE_AFTER_RE =
  /^\s*(?:dollars?\s*)?(?:(?:\/|per|a|@)\s*(?:the\s+)?)?(?:sq\.?\s*ft\.?|sqft|sf|square\s+(?:foot|feet)|lf|ln|hr|hour|each|ea)\b/i;

/** Keep compound labels intact (e.g. "cabinets and counters $28,629") — do not split on "and". */
function splitAllowanceClauses(text) {
  return splitScopeNoteSentences(text)
    .flatMap((clause) =>
      clause.split(
        /,\s+(?=(?:demo|demolition|remove|tear|install|baseboards?|trim|flooring|lvp|vinyl|carpet|sod|turf|pavers?|rock|mulch|gravel|decorative\s+rock|concrete|roof|shingles?|cleanup|final\s+clean|haul)\b)/i
      )
    )
    .map((clause) => clause.trim())
    .filter(Boolean);
}

/**
 * @typedef {{ quantity: number, unit: string, quantitySource: 'notes' }} ParsedItemAllowance
 */

/**
 * Ordered matchers — first match per clause wins (most specific first).
 * @type {Array<{ id: string, match: RegExp, exclude?: RegExp, unit: string }>}
 */
const ITEM_ALLOWANCE_MATCHERS = [
  {
    id: 'appliances',
    match: /\b(appliance\s+install|install\s+appliances?|appliance\s+allowance|appliance\s+hookup|reconnect\s+appliances?)\b/i,
    unit: 'allowance',
  },
  {
    id: 'appliance_removal',
    match: /\b(remove|disconnect|haul)\b[^.;]{0,48}\b(appliances?|ridge|dishwasher|range|refrigerator)\b|\b(appliances?|ridge|dishwasher|range|refrigerator)\b[^.;]{0,48}\b(remove|disconnect|haul)\b/i,
    unit: 'allowance',
  },
  {
    id: 'cabinets',
    match: /\b(cabinets?)\b/i,
    exclude:
      /\b(cabinets?|cabinetry)\b[^.;]{0,48}\b(demo|demolition|tear[\s-]?out|haul[\s-]?off|remove|removal)\b|\b(demo|demolition|tear[\s-]?out|haul[\s-]?off|remove|removal)\b[^.;]{0,48}\b(cabinets?|cabinetry)\b/i,
    unit: 'allowance',
  },
  {
    id: 'countertops',
    match: /\b(countertops?|quartz|granite)\b/i,
    exclude:
      /\b(countertops?|quartz|granite)\b[^.;]{0,48}\b(demo|demolition|tear[\s-]?out)\b|\b(demo|demolition|tear[\s-]?out)\b[^.;]{0,48}\b(countertops?|quartz|granite)\b/i,
    unit: 'allowance',
  },
  {
    id: 'countertops',
    match: /\bcounters\b/i,
    exclude:
      /\bcounters\b[^.;]{0,48}\b(demo|demolition|tear[\s-]?out)\b|\b(demo|demolition|tear[\s-]?out)\b[^.;]{0,48}\bcounters\b/i,
    unit: 'allowance',
  },
  {
    id: 'backsplash',
    match: /\b(backsplash|back\s*splash)\b/i,
    exclude: /\b(demo|demolition|material\s+\$|labor\s+\$)\b/i,
    unit: 'allowance',
  },
  {
    id: 'vanity',
    match: /\bvanity\b/i,
    exclude: /\b(demo|demolition|remove)\b/i,
    unit: 'allowance',
  },
  {
    id: 'glass_door',
    match: /\b(shower\s+door|glass\s+shower)\b/i,
    unit: 'allowance',
  },
  {
    id: 'floor_demo',
    // Require floor-specific language — bare "demo … tile" is shower wall/pan tear-out.
    match:
      /\b(?:demo|demolition|tear[\s-]?out|remove|removal)\b[^.;]{0,80}\b(?:floor(?:ing)?|lvp|vinyl|laminate|carpet|floor\s+tile|tile\s+floor|bath(?:room)?\s+floor)\b|\b(?:floor(?:ing)?|lvp|vinyl|laminate|carpet|floor\s+tile|tile\s+floor|bath(?:room)?\s+floor)\b[^.;]{0,80}\b(?:demo|demolition|tear[\s-]?out|remove|removal)\b/i,
    unit: 'allowance',
  },
  {
    id: 'cleanup',
    match: /\b(cleanup|disposal|dumpster|debris|final\s+clean(?:\s+and\s+haul(?:[\s-]?off?))?)\b/i,
    exclude: /\b(demo|demolition|tear[\s-]?out)\b/i,
    unit: 'lump_sum',
  },
  {
    id: 'demo',
    match: /\b(demo|demolition|tear[\s-]?out|gut|haul[\s-]?off)\b/i,
    exclude: /\b(final\s+clean|cleanup|disposal)\b/i,
    unit: 'lump_sum',
  },
  {
    id: 'permits',
    match: /\b(permit|inspection)\b/i,
    unit: 'allowance',
  },
  {
    id: 'paint',
    match: /\b(paint(?:ing)?|primer)\b/i,
    exclude: /\b(exterior|\/|per\s+sq|square\s+(?:foot|feet))/i,
    unit: 'allowance',
  },
  {
    id: 'floor_tile',
    match: /\b(floor\s+tile|tile\s+floor)\b/i,
    exclude: /\b(demo|demolition|\/|per\s+sq|square\s+(?:foot|feet))/i,
    unit: 'allowance',
  },
  {
    id: 'flooring',
    match: /\b(flooring|laminate|lvp|vinyl\s+floor|carpet)\b/i,
    exclude: /\b(demo|demolition|remove|removal|tear[\s-]?out|\/|per\s+sq|not\s+priced|unpriced|no\s+pric(?:e|ing))/i,
    unit: 'allowance',
  },
  {
    id: 'trim',
    match: /\b(baseboards?|trim|moulding|molding|casing)\b/i,
    exclude: /\b(\/|per\s+(?:linear\s+foot|feet|lf)|per\s+lf)\b/i,
    unit: 'allowance',
  },
  {
    id: 'rock_mulch',
    match: /\b(rock|mulch|gravel|stone)\b/i,
    exclude: /\b(\/|per\s+(?:ton|sq|square|sf|sqft))\b/i,
    unit: 'allowance',
  },
  {
    id: 'tear_off',
    match: /\b(tear[\s-]?off|roof\s+demo|remove\s+shingles?|shingle\s+removal)\b/i,
    unit: 'allowance',
  },
];

function parseAmountToken(raw, kSuffix) {
  let n = Number(String(raw || '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (kSuffix && /^k$/i.test(kSuffix)) n *= 1000;
  return n;
}

/** Dollar totals in a clause — excludes $/sqft and per-sqft rates. */
function extractTotalDollarAmounts(clause) {
  const amounts = [];
  const text = String(clause || '');

  const dollarRe = /\$\s*(\d[\d,]*(?:\.\d+)?)\s*([kK])?/g;
  let m;
  while ((m = dollarRe.exec(text)) !== null) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 24);
    if (UNIT_RATE_AFTER_RE.test(after)) continue;
    const amt = parseAmountToken(m[1], m[2]);
    if (amt) amounts.push(amt);
  }

  const lumpRe = /\b(\d[\d,]*(?:\.\d+)?)\s*([kK])?\s*lump\s*sum\b/gi;
  while ((m = lumpRe.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 8), m.index);
    if (/\$/.test(before)) continue;
    const amt = parseAmountToken(m[1], m[2]);
    if (amt) amounts.push(amt);
  }

  const allowanceRe = /\ballowance\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*([kK])?/gi;
  while ((m = allowanceRe.exec(text)) !== null) {
    const amt = parseAmountToken(m[1], m[2]);
    if (amt) amounts.push(amt);
  }

  return amounts;
}

function pickClauseTotalAmount(clause) {
  const amounts = extractTotalDollarAmounts(clause);
  if (!amounts.length) return null;
  return Math.max(...amounts);
}

/** Dollar positions in clause — used to bind amounts to the nearest keyword match. */
function extractAmountPositions(clause) {
  const positions = [];
  const text = String(clause || '');

  const dollarRe = /\$\s*(\d[\d,]*(?:\.\d+)?)\s*([kK])?/g;
  let m;
  while ((m = dollarRe.exec(text)) !== null) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 24);
    if (UNIT_RATE_AFTER_RE.test(after)) continue;
    const amt = parseAmountToken(m[1], m[2]);
    if (amt) positions.push({ amount: amt, index: m.index });
  }

  const lumpRe = /\b(\d[\d,]*(?:\.\d+)?)\s*([kK])?\s*lump\s*sum\b/gi;
  while ((m = lumpRe.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 8), m.index);
    if (/\$/.test(before)) continue;
    const amt = parseAmountToken(m[1], m[2]);
    if (amt) positions.push({ amount: amt, index: m.index });
  }

  const allowanceRe = /\ballowance\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*([kK])?/gi;
  while ((m = allowanceRe.exec(text)) !== null) {
    const amt = parseAmountToken(m[1], m[2]);
    if (amt) positions.push({ amount: amt, index: m.index });
  }

  return positions;
}

function pickExplicitDemoAmount(clause) {
  const text = String(clause || '');
  const demoRe =
    /\b(?:demo|demolition|tear[\s-]?out|gut|haul[\s-]?off|remove\s+(?:old\s+)?cabinets?)\b/gi;
  const dollarRe = /\$\s*(\d[\d,]*(?:\.\d+)?)\s*([kK])?/g;
  let demoMatch;

  while ((demoMatch = demoRe.exec(text)) !== null) {
    const searchStart = demoMatch.index + demoMatch[0].length;
    const searchEnd = Math.min(text.length, searchStart + 140);
    dollarRe.lastIndex = searchStart;
    let dollarMatch;

    while ((dollarMatch = dollarRe.exec(text)) !== null && dollarMatch.index <= searchEnd) {
      const after = text.slice(dollarMatch.index + dollarMatch[0].length, dollarMatch.index + dollarMatch[0].length + 24);
      if (UNIT_RATE_AFTER_RE.test(after)) continue;
      const amt = parseAmountToken(dollarMatch[1], dollarMatch[2]);
      if (amt) return amt;
    }
  }

  return null;
}

/** Pick the dollar amount closest to this matcher’s hit — not the largest in the clause. */
function pickAmountForMatcher(clause, matcher) {
  if (matcher.id === 'demo') {
    const explicitDemoAmount = pickExplicitDemoAmount(clause);
    if (explicitDemoAmount) return explicitDemoAmount;
  }

  const re = new RegExp(matcher.match.source, matcher.match.flags);
  const hit = re.exec(clause);
  if (!hit) return null;

  const anchor = hit.index;
  const positions = extractAmountPositions(clause);
  if (!positions.length) return null;

  const forward = positions.filter((p) => p.index >= anchor - 8);
  const pool = forward.length ? forward : positions;

  let best = pool[0];
  let bestDist = Math.abs(pool[0].index - anchor);
  for (const p of pool) {
    const dist = Math.abs(p.index - anchor);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best.amount;
}

function clauseMatchesMatcher(clause, matcher) {
  if (!matcher.match.test(clause)) return false;
  if (matcher.exclude?.test(clause)) return false;
  return true;
}

function clauseHasCombinedCabinetsAndCounters(clause) {
  const c = String(clause || '').toLowerCase();
  const hasCabinets = /\b(cabinets?|cabinetry)\b/.test(c);
  const hasCounters = /\b(counters?|countertops?|quartz|granite)\b/.test(c);
  return hasCabinets && hasCounters;
}

/**
 * @param {string} notes
 * @param {{ templateKey?: string, projectType?: string }} [ctx]
 * @returns {Record<string, ParsedItemAllowance>}
 */
function parseScopeItemAllowancesFromNotes(notes, ctx = {}) {
  const text = String(notes || '').trim();
  if (!text) return {};

  const out = {};
  const clauses = splitAllowanceClauses(text);

  for (const clause of clauses) {
    const combinedCabinetsCounters = clauseHasCombinedCabinetsAndCounters(clause);

    const matchedIdsForClause = new Set();

    for (const matcher of ITEM_ALLOWANCE_MATCHERS) {
      if (matcher.id === 'demo' && matchedIdsForClause.has('floor_demo')) continue;
      if (matcher.id === 'demo' && /\b(final\s+clean|cleanup|disposal)\b/i.test(clause)) continue;
      if (!clauseMatchesMatcher(clause, matcher)) continue;

      const amount = pickAmountForMatcher(clause, matcher) ?? pickClauseTotalAmount(clause);
      if (!amount) continue;

      if (ACCUMULATE_ALLOWANCE_IDS.has(matcher.id) && out[matcher.id]) {
        out[matcher.id].quantity += amount;
        matchedIdsForClause.add(matcher.id);
        continue;
      }
      if (out[matcher.id]) continue;

      const entry = {
        quantity: amount,
        unit: matcher.unit,
        quantitySource: 'notes',
      };
      if (combinedCabinetsCounters && matcher.id === 'cabinets') {
        entry.includesCountertops = true;
      }
      out[matcher.id] = entry;
      matchedIdsForClause.add(matcher.id);
    }
  }

  return out;
}

module.exports = {
  parseScopeItemAllowancesFromNotes,
  splitAllowanceClauses,
  ITEM_ALLOWANCE_MATCHERS,
};
