/**
 * Compute checklist item $ totals from notes sqft + material/labor unit rates.
 * e.g. "45 sqft backsplash, material $8/sqft, labor $12/sqft" → $900 allowance
 */

const { splitNoteClauses } = require('./estimateDraftQuantityPrice');

const UNIT_DENOMS = {
  sqft: '(?:sq\\.?\\s*ft\\.?|sqft|\\bsf\\b|ft\\.?\\s*(?:²|2\\b|\\?)|square\\s+(?:foot|feet))',
  lf: '(?:lf|linear\\s+(?:foot|feet)|linear\\s+ft|ln\\s*ft)',
  cy: '(?:cy|cubic\\s+yards?)',
  ton: '(?:tons?)',
  squares: '(?:roofing\\s+)?squares?',
};
const RATE_UNIT = new RegExp(
  `(?:${UNIT_DENOMS.sqft}|${UNIT_DENOMS.lf}|${UNIT_DENOMS.cy}|${UNIT_DENOMS.ton}|${UNIT_DENOMS.squares})`,
  'i'
);
const PER = '(?:\\/|per|a|@)\\s*(?:the\\s+)?';
const MONEY = '[\\$]?';
// Dictated filler between label and amount: "material is going to be three dollars…"
const VERB_FILLER =
  '(?:(?:is|are|will|runs?|costs?)\\s*)?(?:going\\s+to\\s+be\\s*|gonna\\s+be\\s*|be\\s*)?(?:about\\s*|around\\s*|approximately\\s*|roughly\\s*)?';
const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};
const RATE_AMOUNT = `(?:\\d[\\d,]*(?:\\.\\d+)?|${Object.keys(NUMBER_WORDS).join('|')})`;

/** @type {Record<string, keyof import('./scopeMeasurementParser').ParsedScopeMeasurements>} */
const ITEM_RATE_MEASUREMENT = {
  backsplash: { key: 'backsplashSqft', unit: 'sqft', split: true },
  paint: { key: 'wallPaintSqft', unit: 'sqft', split: true },
  shower_tile: { key: 'showerWallTileSqft', unit: 'sqft', split: true },
  interior_paint: { key: 'wallPaintSqft', unit: 'sqft' },
  exterior_paint: { key: 'exteriorPaintSqft', unit: 'sqft' },
  floor_demo: { keys: ['floorAreaSqft', 'kitchenFloorSqft', 'bathroomFloorSqft'], unit: 'sqft' },
  flooring: { keys: ['kitchenFloorSqft', 'floorAreaSqft', 'bathroomFloorSqft'], unit: 'sqft' },
  floor_tile: { keys: ['bathroomFloorSqft', 'kitchenFloorSqft', 'floorAreaSqft'], unit: 'sqft' },
  drywall: { key: 'drywallSqft', unit: 'sqft' },
  hang: { key: 'drywallSqft', unit: 'sqft' },
  finish_tape: { key: 'drywallSqft', unit: 'sqft' },
  patch_repair: { key: 'drywallSqft', unit: 'sqft' },
  sod_turf: { keys: ['sodSqft', 'landscapeSqft'], unit: 'sqft' },
  pavers: { keys: ['paverSqft', 'landscapeSqft'], unit: 'sqft' },
  rock_mulch: { keys: ['landscapeTons', 'rockMulchSqft', 'landscapeSqft'], units: ['ton', 'sqft', 'sqft'] },
  concrete: { keys: ['concreteSqft', 'concreteCy'], units: ['sqft', 'cy'] },
  pour_flatwork: { keys: ['concreteSqft', 'concreteCy'], units: ['sqft', 'cy'] },
  concrete_patio: { keys: ['concreteSqft', 'concreteCy'], units: ['sqft', 'cy'] },
  excavation: { key: 'excavationCy', unit: 'cy' },
  decking: { key: 'deckSqft', unit: 'sqft' },
  railing: { key: 'railingLf', unit: 'lf' },
  trim: { key: 'baseboardLf', unit: 'lf' },
  tear_off: { key: 'roofSquares', unit: 'squares' },
  shingles_roofing: { key: 'roofSquares', unit: 'squares' },
};

function parseRateToken(raw) {
  const normalized = String(raw || '').trim().toLowerCase();
  if (NUMBER_WORDS[normalized]) return NUMBER_WORDS[normalized];
  const n = Number(normalized.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function splitRateClauses(text) {
  const raw = splitNoteClauses(text)
    .flatMap((clause) =>
      clause.split(
        /\b(?:next|then|also(?:\s+we\s+have)?)\s+(?=(?:install|baseboard|trim|flooring|lvp|laminate|vinyl|carpet)\b)/i
      )
    )
    .flatMap((clause) =>
      clause.split(/,\s+(?=(?:paint|primer|demo|demolition|cabinet|countertop|flooring|drywall|shingle|roof|concrete|deck|landscape|excavat|plumb|electrical)\b|[a-z])/i)
    )
    .map((clause) => clause.trim())
    .filter(Boolean);
  const merged = [];
  for (const clause of raw) {
    if (
      merged.length &&
      /^(?:(?:and\s+)?(?:the\s+)?(?:materials?|material\s+(?:cost|price)|labor(?:\s+(?:cost|price))?)\b)|\$\s*\d[\d,]*(?:\.\d+)?\s*(?:\/|per|a|@)?/i.test(clause) &&
      !RATE_PRICING_MATCHERS.some((matcher) => matcher.match.test(clause))
    ) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}, ${clause}`;
    } else {
      merged.push(clause);
    }
  }
  return merged;
}

function pushRateMatches(clause, re, bucket) {
  let m;
  while ((m = re.exec(clause)) !== null) {
    const rate = parseRateToken(m[1]);
    if (rate) bucket.push(rate);
  }
}

function unitDenomFor(unit) {
  return UNIT_DENOMS[unit] || UNIT_DENOMS.sqft;
}

function pickLaborRate(materialRate, laborBeforePrice, laborSuffix) {
  if (laborBeforePrice.length) {
    return laborBeforePrice[laborBeforePrice.length - 1];
  }
  const fromSuffix = laborSuffix.filter((rate) => rate !== materialRate);
  if (fromSuffix.length) return fromSuffix[fromSuffix.length - 1];
  return laborSuffix[0] || null;
}

function extractUnitRates(clause, unit = 'sqft') {
  const denom = unitDenomFor(unit);
  const materialRates = [];
  const laborBeforePrice = [];
  const laborSuffix = [];
  const generalRates = [];
  // Do not match "$8/sqft Labor $12" — "Labor" here starts the next rate, not a suffix label.
  const laborSuffixTail = '(?!\\s*\\$)';

  pushRateMatches(
    clause,
    new RegExp(
      `\\b(?:materials?|material\\s+(?:cost|price))\\s*${VERB_FILLER}${MONEY}\\s*(${RATE_AMOUNT})\\s*(?:dollars?\\s*)?(?:${PER}${denom}|${denom})\\b`,
      'gi'
    ),
    materialRates
  );
  pushRateMatches(
    clause,
    new RegExp(
      `\\blabor(?:\\s+(?:cost|price))?\\s*${VERB_FILLER}${MONEY}\\s*(${RATE_AMOUNT})\\s*(?:dollars?\\s*)?(?:${PER})?${denom}\\b`,
      'gi'
    ),
    laborBeforePrice
  );
  pushRateMatches(
    clause,
    new RegExp(
      `\\$\\s*(${RATE_AMOUNT})\\s*(?:dollars?\\s*)?(?:${PER})?${denom}\\s*(?:for\\s+)?labor\\b${laborSuffixTail}`,
      'gi'
    ),
    laborSuffix
  );
  pushRateMatches(
    clause,
    new RegExp(
      `\\$\\s*(${RATE_AMOUNT})\\s+(?:dollars?\\s*)?(?:${denom})\\s*(?:for\\s+)?labor\\b${laborSuffixTail}`,
      'gi'
    ),
    laborSuffix
  );
  pushRateMatches(
    clause,
    new RegExp(`\\$\\s*(${RATE_AMOUNT})\\s*(?:dollars?\\s*)?(?:${PER})?${denom}\\b`, 'gi'),
    generalRates
  );

  const materialRate = materialRates[0] || null;
  const laborRate = pickLaborRate(materialRate, laborBeforePrice, laborSuffix);

  return {
    materialRate,
    laborRate,
    generalRate:
      generalRates.find((rate) => rate !== materialRate && rate !== laborRate) || generalRates[0] || null,
  };
}

function extractSqftUnitRates(clause) {
  const { materialRate, laborRate } = extractUnitRates(clause, 'sqft');
  return { materialRate, laborRate };
}

function clauseMatchesMatcher(clause, matcher) {
  if (!matcher.match.test(clause)) return false;
  if (matcher.exclude?.test(clause)) return false;
  return true;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function quantityForItem(itemId, measurements) {
  const config = ITEM_RATE_MEASUREMENT[itemId];
  if (!config) return { quantity: null, unit: null };

  if (config.key && measurements[config.key]) {
    return { quantity: measurements[config.key], unit: config.unit };
  }

  if (config.keys?.length) {
    for (let i = 0; i < config.keys.length; i += 1) {
      const key = config.keys[i];
      if (measurements[key]) {
        return {
          quantity: measurements[key],
          unit: config.units?.[i] || config.unit,
        };
      }
    }
  }

  return { quantity: null, unit: config.unit || null };
}

function quantityFromClauseForUnit(clause, unit) {
  const denom = unitDenomFor(unit);
  const re = new RegExp(`\\b(\\d[\\d,]*(?:\\.\\d+)?)\\s*${denom}\\b`, 'gi');
  let m;
  while ((m = re.exec(clause)) !== null) {
    const before = clause.slice(Math.max(0, m.index - 6), m.index);
    if (/\$\s*$/.test(before)) continue;
    const quantity = Number(String(m[1]).replace(/,/g, ''));
    if (Number.isFinite(quantity) && quantity > 0) {
      return quantity;
    }
  }
  return null;
}

function explicitQuantityForMatchedClause(itemId, clause) {
  const config = ITEM_RATE_MEASUREMENT[itemId];
  if (!config) return null;

  const units = [];
  if (config.unit) units.push(config.unit);
  if (config.units?.length) units.push(...config.units);

  for (const unit of [...new Set(units)]) {
    const quantity = quantityFromClauseForUnit(clause, unit);
    if (quantity) return { quantity, unit };
  }

  return null;
}

function ratePricingItemIdFromKey(key) {
  const match = String(key || '').match(/^(.+)__(?:material|labor|allowance)$/);
  return match ? match[1] : null;
}

function mergeRatePricingEntries(out, itemId, entries) {
  const allowanceKey = ITEM_RATE_MEASUREMENT[itemId]?.split ? `${itemId}__allowance` : itemId;
  const matKey = `${itemId}__material`;
  const labKey = `${itemId}__labor`;
  const nextTotal = Number(entries[allowanceKey]?.quantity || 0);
  const prevTotal = Number(out[allowanceKey]?.quantity || 0);
  const prevMaterial = Number(out[matKey]?.quantity || 0);
  const prevLabor = Number(out[labKey]?.quantity || 0);
  const nextMaterial = Number(entries[matKey]?.quantity || 0);
  const nextLabor = Number(entries[labKey]?.quantity || 0);

  // Complementary clauses ("tile material $3/sqft" + "tile labor $5/sqft") combine
  // instead of the later clause replacing the earlier one.
  const complementary =
    prevTotal > 0 &&
    nextTotal > 0 &&
    ((prevMaterial > 0 && !prevLabor && nextLabor > 0 && !nextMaterial) ||
      (prevLabor > 0 && !prevMaterial && nextMaterial > 0 && !nextLabor));
  if (complementary) {
    const material = prevMaterial || nextMaterial;
    const labor = prevLabor || nextLabor;
    out[matKey] = { quantity: material, unit: 'allowance', quantitySource: 'notes' };
    out[labKey] = { quantity: labor, unit: 'allowance', quantitySource: 'notes' };
    out[allowanceKey] = {
      quantity: roundMoney(material + labor),
      unit: 'allowance',
      quantitySource: 'notes',
    };
    return out;
  }

  const shouldReplace =
    !prevTotal ||
    nextTotal > prevTotal ||
    (nextLabor > 0 && nextLabor !== prevLabor) ||
    (nextTotal === prevTotal && nextLabor > prevLabor);
  if (!shouldReplace) return out;
  delete out[matKey];
  delete out[labKey];
  delete out[allowanceKey];
  delete out[itemId];
  return Object.assign(out, entries);
}

function buildRatePricingEntries(itemId, quantity, rates, options = {}) {
  const { materialRate, laborRate, generalRate } = rates;
  if (!quantity || (!materialRate && !laborRate && !generalRate)) return {};

  const materialTotal = materialRate ? roundMoney(quantity * materialRate) : 0;
  const laborTotal = laborRate ? roundMoney(quantity * laborRate) : 0;
  const generalTotal = !materialTotal && !laborTotal && generalRate ? roundMoney(quantity * generalRate) : 0;
  const total = roundMoney(materialTotal + laborTotal + generalTotal);
  if (total <= 0) return {};

  const out = {};
  if (materialTotal > 0) {
    out[`${itemId}__material`] = {
      quantity: materialTotal,
      unit: 'allowance',
      quantitySource: 'notes',
    };
  }
  if (laborTotal > 0) {
    out[`${itemId}__labor`] = {
      quantity: laborTotal,
      unit: 'allowance',
      quantitySource: 'notes',
    };
  }
  out[options.split ? `${itemId}__allowance` : itemId] = {
    quantity: total,
    unit: 'allowance',
    quantitySource: 'notes',
  };
  return out;
}

/** Rate matchers — do not exclude material$/labor$ (those clauses are rate-based). */
const RATE_PRICING_MATCHERS = [
  {
    id: 'backsplash',
    match: /\b(backsplash|back\s*splash)\b/i,
    exclude: /\b(demo|demolition)\b/i,
  },
  {
    id: 'interior_paint',
    match: /\b(interior\s+paint|paint\s+(?:walls|interior))\b/i,
    exclude: /\b(exterior)\b/i,
  },
  {
    id: 'paint',
    match: /\b(paint(?:ing)?|primer|walls?\s+and\s+(?:the\s+)?ceiling)\b/i,
    exclude: /\b(exterior|interior\s+paint|paint\s+interior)\b/i,
  },
  {
    id: 'shower_tile',
    match: /\b(shower\s+wall\s+tile|shower\s+tile|tile\s+shower)\b/i,
  },
  {
    id: 'exterior_paint',
    match: /\b(exterior\s+paint|paint\s+exterior)\b/i,
  },
  {
    id: 'floor_demo',
    match: /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b.*\b(?:tile|floor|flooring|lvp|vinyl|laminate|carpet)\b|\b(?:tile|floor|flooring|lvp|vinyl|laminate|carpet)\b.*\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/i,
  },
  {
    id: 'flooring',
    match: /\b(flooring|laminate|lvp|vinyl\s+floor|carpet)\b/i,
    exclude: /\b(demo|demolition)\b/i,
  },
  {
    id: 'floor_tile',
    match: /\b(floor\s+tile|tile\s+floor)\b/i,
    exclude: /\b(demo|demolition)\b/i,
  },
  {
    id: 'drywall',
    match: /\b(drywall|sheetrock)\b/i,
    exclude: /\b(demo|demolition)\b/i,
  },
  { id: 'hang', match: /\b(hang\s+drywall|drywall\s+hang)\b/i },
  { id: 'finish_tape', match: /\b(tape|mud|finish\s+drywall)\b/i },
  { id: 'patch_repair', match: /\b(drywall\s+patch|patch\s+drywall|patch\s+repair)\b/i },
  { id: 'sod_turf', match: /\b(sod|turf|grass)\b/i },
  { id: 'pavers', match: /\bpavers?\b/i },
  { id: 'rock_mulch', match: /\b(rock|mulch|gravel)\b/i },
  { id: 'concrete', match: /\bconcrete\b/i },
  { id: 'pour_flatwork', match: /\b(flatwork|slab|driveway|sidewalk|concrete\s+patio)\b/i },
  { id: 'concrete_patio', match: /\bconcrete\s+patio\b/i },
  { id: 'excavation', match: /\b(excavat(?:e|ion)|grading|trench(?:ing)?)\b/i },
  { id: 'decking', match: /\b(decking|deck\s+surface|composite\s+deck)\b/i },
  { id: 'railing', match: /\b(rail(?:ing)?|guardrail)\b/i },
  { id: 'trim', match: /\b(baseboard|trim)\b/i },
  { id: 'tear_off', match: /\b(tear[\s-]?off|roof\s+demo|remove\s+shingles?)\b/i },
  { id: 'shingles_roofing', match: /\b(shingles?|roof(?:ing)?\s+install|new\s+roof)\b/i },
];

/**
 * Bathroom/shower jobs often price "tile" without repeating "shower tile" in the
 * rate clause ("Tile material is $3 a square foot"). Map bare tile → shower_tile
 * only in shower context; floor tile / backsplash clauses stay excluded.
 */
function ratePricingMatchersForContext(notes, ctx = {}) {
  const showerContext =
    ctx.templateKey === 'bathroom' ||
    ctx.projectType === 'bathroom' ||
    /\bshower\b/i.test(String(notes || ''));
  if (!showerContext) return RATE_PRICING_MATCHERS;
  return [
    ...RATE_PRICING_MATCHERS,
    {
      id: 'shower_tile',
      match: /\btile\b/i,
      exclude: /\b(floors?|flooring|backsplash|demo|demolition|remove|removal|tear[\s-]?out)\b/i,
    },
  ];
}

/**
 * @param {string} notes
 * @param {Record<string, number|undefined>} measurements parsed sqft fields
 * @param {{ templateKey?: string, projectType?: string }} [ctx]
 */
function parseScopeItemRatePricingFromNotes(notes, measurements = {}, ctx = {}) {
  const text = String(notes || '').trim();
  if (!text) return {};

  const out = {};
  const matchers = ratePricingMatchersForContext(text, ctx);
  const clauses = splitRateClauses(text);
  for (const clause of clauses) {
    if (!RATE_UNIT.test(clause)) continue;

    for (const matcher of matchers) {
      if (!clauseMatchesMatcher(clause, matcher)) continue;

      const { quantity, unit } =
        explicitQuantityForMatchedClause(matcher.id, clause) || quantityForItem(matcher.id, measurements);
      if (!quantity || !unit) continue;
      const rates = extractUnitRates(clause, unit);
      if (!rates.materialRate && !rates.laborRate && !rates.generalRate) continue;

      const entries = buildRatePricingEntries(
        matcher.id,
        quantity,
        rates,
        ITEM_RATE_MEASUREMENT[matcher.id]
      );
      if (!Object.keys(entries).length) continue;
      mergeRatePricingEntries(out, matcher.id, entries);
    }
  }

  return out;
}

function resolveItemRatePricingFromNotes(itemId, measurements, notes, ctx = {}) {
  const entries = parseScopeItemRatePricingFromNotes(notes, measurements, ctx);
  const totalEntry = entries[`${itemId}__allowance`] || entries[itemId];
  if (!totalEntry?.quantity) return null;
  return {
    material: entries[`${itemId}__material`]?.quantity ?? null,
    labor: entries[`${itemId}__labor`]?.quantity ?? null,
    total: Number(totalEntry.quantity),
  };
}

module.exports = {
  parseScopeItemRatePricingFromNotes,
  resolveItemRatePricingFromNotes,
  extractSqftUnitRates,
  ITEM_SQFT_MEASUREMENT_KEY: Object.fromEntries(
    Object.entries(ITEM_RATE_MEASUREMENT)
      .filter(([, config]) => config.unit === 'sqft' && config.key)
      .map(([id, config]) => [id, config.key])
  ),
  ITEM_RATE_MEASUREMENT,
};
