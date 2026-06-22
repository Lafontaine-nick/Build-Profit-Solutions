/**
 * Distinguish construction quantities (1200 sqft) from prices ($1,200, $5/sqft).
 * Quantity alone must never become a line-item dollar amount.
 */

const { parseSquareFeetFromText, parseLinearFeetFromText } = require('./estimateDraftFromNotes');

const QUANTITY_UNIT_AFTER_RE =
  /^\s*(?:sq\.?\s*ft|sqft|sq\s*ft|square\s*feet|ft\s*[²2ˆ]?|sf\b|linear\s*feet|ln\.?\s*ft|\blf\b|hrs?|hours?|each|ea\b|units?|squares?|yards?|\byd\b)/i;

const UNIT_RATE_AFTER_RE = /^\s*\/\s*(?:sq\.?\s*ft|sqft|sf|lf|ln|hr|hour|each|ea)\b/i;

const PRICE_INDICATOR_BEFORE_RE =
  /(?:\$|\b(?:usd|dollars?|costs?|prices?|charges?|bids?|totals?|allowances?|rates?|at|for)\b)\s*$/i;

const WEAK_LABEL_RE =
  /^(i have|of|and|the|a|an|includes?|with|for|ok|let's say|lets say|let's|lets|create|have|roughly|around|about|maybe|slabs?)$/i;

const META_TOTAL_LABEL_RE =
  /\b(that gives us|gives us a total|grand total|overall total|total of|bid total|project total|stated total)\b/i;

const NUMERIC_ONLY_LABEL_RE = /^#?\d{1,4}$/;

/** PDF/copy-paste artifacts: "19: $309", page numbers, meta totals — not real line items. */
function isJunkPriceLabel(label) {
  const l = String(label || '').trim();
  if (!l || l.length < 2) return true;
  if (NUMERIC_ONLY_LABEL_RE.test(l)) return true;
  if (/^page\s+\d+$/i.test(l)) return true;
  if (META_TOTAL_LABEL_RE.test(l)) return true;
  if (WEAK_LABEL_RE.test(l)) return true;
  return false;
}

function isAbsurdParsedAmount(amount, label) {
  const n = roundMoney(amount);
  if (!n || n <= 0) return false;
  if (n <= 100000) return false;
  if (NUMERIC_ONLY_LABEL_RE.test(String(label || '').trim())) return true;
  if (isJunkPriceLabel(label)) return true;
  return false;
}

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

function isQuantityNotPriceContext(source, amountStr, matchStartIndex) {
  const text = String(source || '');
  const amt = String(amountStr || '').replace(/,/g, '');
  if (!amt || !text) return false;

  const amtPos = text.indexOf(amt, Math.max(0, matchStartIndex - 5));
  if (amtPos < 0) return false;

  const before = text.slice(Math.max(0, amtPos - 28), amtPos);
  const after = text.slice(amtPos + amt.length, amtPos + amt.length + 36);

  if (UNIT_RATE_AFTER_RE.test(after)) {
    return !(PRICE_INDICATOR_BEFORE_RE.test(before) || /\$\s*$/.test(before));
  }

  if (QUANTITY_UNIT_AFTER_RE.test(after)) {
    return !(PRICE_INDICATOR_BEFORE_RE.test(before) || /\$\s*$/.test(before));
  }

  if (!/\$/.test(before) && !PRICE_INDICATOR_BEFORE_RE.test(before)) {
    const n = Number(amt);
    if (Number.isFinite(n) && n >= 50 && /\b(sq|ft|feet|linear|lf)\b/i.test(after)) {
      return true;
    }
  }

  return false;
}

/** Regex match from LABELED_PRICE_RE — reject quantity masquerading as price. */
function labeledPriceMatchIsValid(source, match) {
  const label = String(match[1] || '').trim();
  const amountStr = match[2];
  if (!amountStr) return false;
  if (WEAK_LABEL_RE.test(label)) return false;
  if (isJunkPriceLabel(label)) return false;
  if (isQuantityNotPriceContext(source, amountStr, match.index)) return false;

  const n = Number(String(amountStr).replace(/,/g, ''));
  const suffixK = match[3];
  if (n < 100 && !/\$/.test(match[0])) return false;
  if (/^(roughly|around|about|maybe|let's say|lets say|slabs?)$/i.test(label)) return false;

  if (!/\$/.test(match[0]) && !PRICE_INDICATOR_BEFORE_RE.test(String(source).slice(Math.max(0, match.index - 20), match.index))) {
    if (suffixK && String(suffixK).toLowerCase() === 'k') return true;
    if (n >= 100 && n < 10000 && !/\$/.test(match[0])) {
      const after = String(source).slice(
        match.index + match[0].indexOf(amountStr) + amountStr.length,
        match.index + match[0].length + 30
      );
      if (!QUANTITY_UNIT_AFTER_RE.test(after) && !UNIT_RATE_AFTER_RE.test(after)) {
        return true;
      }
      return false;
    }
  }
  return true;
}

function amountAppearsAsQuantityInText(sourceText, amount) {
  const n = roundMoney(amount);
  if (!n || n <= 0) return false;
  const text = String(sourceText || '');
  const amt = String(n);

  const checks = [
    new RegExp(`\\b${amt}\\s*(?:sq\\.?\\s*ft|sqft|sq\\s*ft|square\\s*feet|ft\\s*[²2])`, 'i'),
    new RegExp(`\\b${amt}\\s*(?:linear\\s*feet|ln\\.?\\s*ft|\\blf\\b)`, 'i'),
    new RegExp(`(?:have|of)\\s+${amt}\\s*(?:ft|sq|linear)`, 'i'),
  ];

  for (const re of checks) {
    const m = re.exec(text);
    if (!m) continue;
    const idx = m.index;
    const before = text.slice(Math.max(0, idx - 12), idx);
    if (!/\$/.test(before) && !PRICE_INDICATOR_BEFORE_RE.test(before)) {
      return true;
    }
  }
  return false;
}

function priceMatchesQuantitySum(price, sourceText) {
  const n = roundMoney(price);
  if (!n) return false;
  const nums = [];
  const re =
    /\b(\d[\d,]*)\s*(?:sq\.?\s*ft|sqft|sq\s*ft|square\s*feet|ft\s*[²2]|linear\s*feet|ln\.?\s*ft|\blf\b)/gi;
  let m;
  while ((m = re.exec(String(sourceText || '')))) {
    const v = Number(String(m[1]).replace(/,/g, ''));
    if (v > 0) nums.push(v);
  }
  if (nums.length === 0) return false;
  if (nums.includes(n)) return true;
  const sum = nums.reduce((a, b) => a + b, 0);
  return roundMoney(sum) === n;
}

function notesContainExplicitPrice(notes, amount) {
  const n = roundMoney(amount);
  if (!n) return false;
  const text = String(notes || '');
  if (new RegExp(`\\$\\s*${n.toLocaleString().replace(/,/g, ',?')}\\b`, 'i').test(text)) return true;
  if (new RegExp(`\\$\\s*${n}\\b`, 'i').test(text)) return true;
  if (new RegExp(`\\b${n}\\s*k\\b`, 'i').test(text)) return true;
  if (
    new RegExp(
      `(?:total|bid|price|cost|charge|allowance|lump|budget)\\s*(?:of|is|:)?\\s*\\$?\\s*${n}\\b`,
      'i'
    ).test(text)
  ) {
    return true;
  }
  return false;
}

function sanitizePricingItem(item, sourceText) {
  const amount =
    item?.amount != null
      ? roundMoney(item.amount)
      : item?.unitRate != null && item?.quantity != null
        ? roundMoney(item.unitRate * item.quantity)
        : item?.unitRate != null
          ? roundMoney(item.unitRate)
          : null;

  if (amount == null || amount <= 0) return { ...item, includedInSubtotal: false };

  const isUnitRate =
    item?.unit &&
    /^(sqft|lf|hr|each|square|yard)$/i.test(String(item.unit)) &&
    (item.unitRate != null || /\//.test(String(item.unit)));

  if (isUnitRate && item.unitRate != null && item.unitRate < 500) {
    return item;
  }

  if (amountAppearsAsQuantityInText(sourceText, amount) && !notesContainExplicitPrice(sourceText, amount)) {
    const qty =
      item?.quantity != null
        ? Number(item.quantity)
        : parseSquareFeetFromText(sourceText) || parseLinearFeetFromText(sourceText);
    return {
      ...item,
      amount: null,
      unitRate: null,
      quantity: qty,
      status: 'missing_price',
      priceSource: 'quantity_only',
      includedInSubtotal: false,
      description: item.description || 'Quantity from notes — rate or price not provided',
    };
  }

  return item;
}

function sanitizePricingItemsList(items, sourceText) {
  return (items || [])
    .map((item) => sanitizePricingItem(item, sourceText))
    .filter((item) => {
      if (!item?.name) return false;
      if (isJunkPriceLabel(item.name)) return false;
      if (item.amount != null && isAbsurdParsedAmount(item.amount, item.name)) return false;
      return true;
    });
}

function sanitizeRoomPrice(room, sourceText) {
  const text = String(sourceText || '').trim();
  const items = sanitizePricingItemsList(room.pricingItems || [], text);
  const pricedLines = items.filter(
    (p) => p.includedInSubtotal !== false && p.amount > 0 && p.priceSource !== 'quantity_only'
  );
  const validSubtotal = pricedLines.reduce((s, p) => s + roundMoney(p.amount), 0);

  const price = room?.price != null ? roundMoney(room.price) : null;
  let next = { ...room, pricingItems: items };

  if (!text) return next;

  const hadLineItems = (room.pricingItems || []).length > 0;

  if (price != null && price > 0) {
    if (
      room.priceProvidedByUser ||
      room.priceSource === 'user_provided' ||
      room.status === 'user_provided' ||
      room.category === 'custom'
    ) {
      return next;
    }
    if (notesContainExplicitPrice(text, price)) return next;

    const stripAsQuantity =
      amountAppearsAsQuantityInText(text, price) || priceMatchesQuantitySum(price, text);

    const stripAsFakeLines =
      validSubtotal === 0 &&
      !notesContainExplicitPrice(text, price) &&
      hadLineItems &&
      items.some((p) => p.priceSource === 'quantity_only' || p.status === 'missing_price');

    if (stripAsQuantity || stripAsFakeLines) {
      next = { ...next, price: null, priceProvidedByUser: false };
    } else if (
      validSubtotal > 0 &&
      validSubtotal === price &&
      pricedLines.every((p) => amountAppearsAsQuantityInText(text, p.amount))
    ) {
      next = { ...next, price: null, priceProvidedByUser: false };
    }
  }

  return next;
}

function normalizePackageKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SQFT_QTY_RE =
  /\b(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|sq\s*ft|square\s*feet|ft\.?\s*²|ft\.?\s*2\b|sf\b)/i;
const LF_QTY_RE =
  /\b(\d[\d,]*)\s*(?:linear\s*feet|ln\.?\s*ft\.?|\blf\b)/i;

function matchAllQty(clause, pattern) {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  return [...clause.matchAll(re)];
}

function packageAcceptsUnit(packageName, scopeText, unit) {
  const pkgKey = normalizePackageKey(packageName);
  const scopeKey = normalizePackageKey(scopeText);
  if (unit === 'lf') {
    return (
      /baseboard|trim|crown|moulding|molding|casing/.test(pkgKey) ||
      /baseboard|trim|linear/.test(scopeKey) ||
      (/paint/.test(pkgKey) && !/tile|floor|laminate|demo|removal/.test(pkgKey))
    );
  }
  if (unit === 'sqft') {
    const trimOnly =
      /\b(baseboard|trim)\b/.test(pkgKey) &&
      !/\b(tile|demo|removal|flooring|laminate|lvp)\b/.test(pkgKey);
    return !trimOnly;
  }
  return true;
}

/**
 * Sentence breaks — skip decimals ($1.50) but split after priced totals ($2,550. Demo)
 * when the next clause starts a new scope item.
 */
const SCOPE_NOTE_SENTENCES_RE =
  /(?<!\d)\.\s+(?=[A-Z])|\.\s+(?=(?:demo|install|final|baseboards?|remove|tear|new|paint|interior|cleanup|haul|trim|replace|lvp|vinyl|carpet|flooring|backsplash|back\s*splash|cabinet|countertops?|counters?|appliance)\b)/gi;

function splitScopeNoteSentences(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return [];

  let sentences = normalized
    .split(SCOPE_NOTE_SENTENCES_RE)
    .map((x) => x.trim())
    .filter(Boolean);
  if (sentences.length === 1) {
    sentences = normalized
      .split(/[;\n]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return sentences;
}

/** Break run-on notes into clauses so "removal … in 1200 … installation" assigns qty per task. */
function splitNoteClauses(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return [];

  const sentences = splitScopeNoteSentences(normalized);

  const clauses = [];
  for (let sentence of sentences) {
    sentence = sentence.replace(/\bwalls?\s+and\s+(?:the\s+)?ceiling\b/gi, (m) =>
      m.replace(/\s+and\s+/i, ' __WALLS_CEILING__ ')
    );
    sentence = sentence.replace(/\bfinal\s+clean\s+and\s+haul(?:[\s-]?off?)\b/gi, (m) =>
      m.replace(/\s+and\s+/i, ' __FINAL_CLEAN_HAUL__ ')
    );
    const parts = sentence
      .split(
        /\s+(?:and|&|\+)\s+|\s+in\s+(?=\d[\d,]*\s*(?:sq\.?\s*ft\.?|sqft|sq\s*ft|square\s*feet|ft\.?\s*²|ft\.?\s*2\b|linear\s*feet|ln\.?\s*ft\.?|\blf\b))/i
      )
      .map((p) => p.trim().replace(/__WALLS_CEILING__/g, ' and ').replace(/__FINAL_CLEAN_HAUL__/g, ' and '))
      .filter(Boolean);
    if (parts.length > 1) clauses.push(...parts);
    else clauses.push(sentence.replace(/__WALLS_CEILING__/g, ' and ').replace(/__FINAL_CLEAN_HAUL__/g, ' and '));
  }
  return clauses;
}

/** Match a note sentence to a scope package (avoid cross-assigning qty between packages). */
function sentenceMatchesPackage(packageName, scopeText, sentence) {
  const pkgKey = normalizePackageKey(packageName);
  const scopeKey = normalizePackageKey(scopeText);
  const s = String(sentence || '').toLowerCase();

  if (/\btile\b/.test(pkgKey) && /\b(install|installation)\b/.test(pkgKey) && !/\b(demo|removal)\b/.test(pkgKey)) {
    return (
      /\btile\b/.test(s) &&
      /\b(install|installation|installing)\b/.test(s) &&
      !/\b(demo|demolish|removal|remove|tear[\s-]?out)\b/.test(s)
    );
  }
  if (/\btile\b/.test(pkgKey) && /\b(demo|removal)\b/.test(pkgKey)) {
    return /\btile\b/.test(s) && /\b(demo|demolish|removal|remove|tear[\s-]?out)\b/.test(s);
  }
  if (/paint/.test(pkgKey) && !/baseboard|trim/.test(pkgKey)) {
    return (
      /\b(paint|painting|primer)\b/.test(s) &&
      !/\b(baseboard|trim)\b/.test(s) &&
      !/\b(tile|laminate|lvp|flooring)\b/.test(s)
    );
  }
  if ((/laminate|flooring|lvp/.test(pkgKey) || /laminate|flooring/.test(scopeKey)) && !/baseboard/.test(pkgKey)) {
    return /\b(laminate|lvp|vinyl|flooring)\b/.test(s) && /\b(install|installation)\b/.test(s);
  }
  if (/baseboard|trim/.test(pkgKey) || /baseboard/.test(scopeKey)) {
    return /\b(baseboard|trim)\b/.test(s) || (/\b(linear\s*feet|lf)\b/.test(s) && !/\btile\b/.test(s) && !/\blaminate\b/.test(s));
  }
  if (/shower|tub/.test(pkgKey)) {
    return /\b(shower|tub)\b/.test(s) && /\b(tile|install|surround)\b/.test(s);
  }
  if (/vanity/.test(pkgKey)) {
    return /\bvanity\b/.test(s);
  }
  if (/toilet/.test(pkgKey)) {
    return /\btoilet\b/.test(s);
  }
  if (/cabinet/.test(pkgKey)) {
    return /\b(cabinet|cabinets)\b/.test(s);
  }
  if (/countertop|counter top/.test(pkgKey)) {
    return /\b(countertop|counter\s*top|quartz|granite)\b/.test(s);
  }
  if (/backsplash/.test(pkgKey)) {
    return /\bbacksplash\b/.test(s);
  }
  if (/bath|bathroom/.test(pkgKey) && /demo|gut|tear|removal/.test(pkgKey)) {
    return /\b(bath|bathroom|shower|vanity)\b/.test(s) && /\b(demo|gut|tear|removal)\b/.test(s);
  }
  if (/kitchen/.test(pkgKey) && /demo|gut|tear|removal/.test(pkgKey)) {
    return /\bkitchen\b/.test(s) && /\b(demo|gut|tear|removal)\b/.test(s);
  }
  if (/plumb/.test(pkgKey)) {
    return /\b(plumb|plumbing|rough[\s-]?in|faucet|drain)\b/.test(s);
  }

  const tokens = pkgKey.split(' ').filter((w) => w.length > 3);
  return tokens.some((t) => s.includes(t));
}

/**
 * Quantities for one scope package only (not global notes blob).
 */
function extractScopeQuantitiesForPackage(packageName, scopeText, originalNotes) {
  const source = `${scopeText || ''}\n${originalNotes || ''}`.trim();
  if (!source) return [];

  const results = [];
  const clauses = splitNoteClauses(source);

  for (const clause of clauses) {
    const sqftMatches = matchAllQty(clause, SQFT_QTY_RE);
    const lfMatches = matchAllQty(clause, LF_QTY_RE);

    if (
      sqftMatches.length &&
      sentenceMatchesPackage(packageName, scopeText, clause) &&
      packageAcceptsUnit(packageName, scopeText, 'sqft')
    ) {
      for (const m of sqftMatches) {
        const qty = Number(String(m[1]).replace(/,/g, ''));
        if (Number.isFinite(qty) && qty > 0) {
          results.push({ label: packageName, quantity: qty, unit: 'sqft' });
        }
      }
    }
    if (
      lfMatches.length &&
      sentenceMatchesPackage(packageName, scopeText, clause) &&
      packageAcceptsUnit(packageName, scopeText, 'lf')
    ) {
      for (const m of lfMatches) {
        const qty = Number(String(m[1]).replace(/,/g, ''));
        if (Number.isFinite(qty) && qty > 0) {
          results.push({ label: packageName, quantity: qty, unit: 'lf' });
        }
      }
    }
  }

  if (results.length === 0 && scopeText) {
    const sqft = parseSquareFeetFromText(scopeText, packageName);
    const lf = parseLinearFeetFromText(scopeText, packageName);
    if (sqft) results.push({ label: packageName, quantity: sqft, unit: 'sqft' });
    if (lf && !results.some((r) => r.unit === 'lf')) {
      results.push({ label: packageName, quantity: lf, unit: 'lf' });
    }
  }

  const byUnit = new Map();
  for (const r of results) {
    if (!byUnit.has(r.unit)) byUnit.set(r.unit, r);
  }
  return [...byUnit.values()];
}

/** @deprecated Use extractScopeQuantitiesForPackage per package */
function extractScopeQuantitiesFromText(text) {
  return extractScopeQuantitiesForPackage('Scope', text, '');
}

function scopeOnlyMissingHints(packageName) {
  const key = normalizePackageKey(packageName);
  if (/tile|demo/.test(key)) return ['Demo / removal rate or lump sum'];
  if (/laminate|flooring|lvp/.test(key) && !/baseboard/.test(key)) {
    return ['Material allowance per sqft', 'Labor install rate per sqft'];
  }
  if (/baseboard|trim/.test(key)) {
    return ['Material rate per LF', 'Labor install rate per LF', 'Caulk & paint'];
  }
  return ['Material and labor pricing'];
}

function inferProjectTypeFromNotes(notes, projectType) {
  const n = String(notes || '').toLowerCase();
  if (/\b(new\s+home|custom\s+home|spec\s+home|ground\s*up|ground-up|new\s+build)\b/.test(n)) {
    return 'new_build';
  }
  if (/\b(?:adu|casita)\b/.test(n)) return 'adu';
  if (/\bgarage\s+conversion\b/.test(n)) return 'garage_conversion';
  if (/\broom\s+addition\b/.test(n)) return 'room_addition';
  if (/\bhome\s+addition\b|\baddition\b.*\b(?:foundation|framing|roof|hvac|drywall)\b/.test(n)) {
    return 'home_addition';
  }
  if (/\b(basement\s+finish(?:ing)?|finished\s+basement|insurance\s+(?:repair|restoration)|restoration|mixed\s+repair)\b/.test(n)) {
    return 'other';
  }
  const floorHeavy =
    /\b(floor\s*job|flooring|laminate\s+flooring|tile\s+demo|lvp|baseboard\s+install)/.test(n) ||
    (/\b(tile demo|laminate|baseboard)\b/.test(n) && /\b(sqft|sq\s*ft|ft²|linear\s*feet|lf)\b/.test(n));
  const bathHeavy = /\b(bath(?:room)?\s+remodel|shower|vanity|toilet|tub)\b/.test(n);
  if (floorHeavy && !bathHeavy) return 'flooring';
  return projectType;
}

module.exports = {
  QUANTITY_UNIT_AFTER_RE,
  PRICE_INDICATOR_BEFORE_RE,
  isQuantityNotPriceContext,
  labeledPriceMatchIsValid,
  amountAppearsAsQuantityInText,
  notesContainExplicitPrice,
  sanitizePricingItem,
  sanitizePricingItemsList,
  sanitizeRoomPrice,
  extractScopeQuantitiesFromText,
  extractScopeQuantitiesForPackage,
  splitNoteClauses,
  splitScopeNoteSentences,
  scopeOnlyMissingHints,
  inferProjectTypeFromNotes,
  isJunkPriceLabel,
  isAbsurdParsedAmount,
  WEAK_LABEL_RE,
};
