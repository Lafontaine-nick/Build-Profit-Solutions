/**
 * Parse job notes into Confirm Scope quick-measurement fields.
 * Used to autofill kitchen sqft, landscaping coverage, roof squares, etc.
 */

const { splitNoteClauses } = require('./estimateDraftQuantityPrice');
const { parseScopeItemAllowancesFromNotes } = require('./scopeAllowanceParser');
const { parseScopeItemRatePricingFromNotes } = require('./scopeRatePricingParser');

const SQFT_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:total\s+)?(?:sq\.?\s*ft|sqft|\bsf\b|ft\.?\s*(?:²|2\b|\?)|square\s+(?:foot|feet))/gi;
const LF_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:foot|feet)|ln\s*ft|linear\s+ft)/gi;
const CY_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:cy|cubic\s+yards?)/gi;
const SQUARES_RE = /(\d[\d,]*(?:\.\d+)?)\s*squares?\b/gi;
const TON_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:tons?)\b/gi;

function parseQty(match) {
  const n = Number(String(match[1] ?? match[0]).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function firstQty(text, re) {
  const m = re.exec(text);
  re.lastIndex = 0;
  return m ? parseQty(m) : null;
}

function allQty(text, re) {
  const values = [];
  let m;
  const clone = new RegExp(re.source, re.flags);
  while ((m = clone.exec(text)) !== null) {
    const q = parseQty(m);
    if (q) values.push(q);
  }
  return values;
}

function pickSqftNearPattern(text, pattern) {
  const re = new RegExp(SQFT_RE.source, SQFT_RE.flags);
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - 25);
    const end = Math.min(text.length, m.index + m[0].length + 25);
    const window = text.slice(start, end).toLowerCase();
    if (pattern.test(window)) return parseQty(m);
  }
  return null;
}

function pickLfNearPattern(text, pattern) {
  const re = new RegExp(LF_RE.source, LF_RE.flags);
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - 25);
    const end = Math.min(text.length, m.index + m[0].length + 25);
    const window = text.slice(start, end).toLowerCase();
    if (pattern.test(window)) return parseQty(m);
  }
  return null;
}

function clauseMatches(clause, patterns) {
  const c = clause.toLowerCase();
  return patterns.some((p) => p.test(c));
}

function splitMeasurementClauses(text) {
  return splitNoteClauses(text)
    .flatMap((clause) => clause.split(/,\s+(?=[a-z])/i))
    .map((clause) => clause.trim())
    .filter(Boolean);
}

/**
 * @param {string} notes
 * @param {{ templateKey?: string, projectType?: string }} [ctx]
 */
function parseScopeMeasurementsFromNotes(notes, ctx = {}) {
  const text = String(notes || '').trim();
  if (!text) return {};

  const templateKey = String(ctx.templateKey || '').toLowerCase();
  const projectType = String(ctx.projectType || '').toLowerCase();
  const out = {};

  const clauses = splitMeasurementClauses(text);
  const blob = text.toLowerCase();

  const pickSqftFromClauses = (patterns) => {
    for (const clause of clauses) {
      const matchedPattern = patterns.find((p) => p.test(clause.toLowerCase()));
      if (!matchedPattern) continue;
      const near = pickSqftNearPattern(clause, matchedPattern);
      if (near) return near;
      const q = firstQty(clause, SQFT_RE);
      if (q) return q;
    }
    for (const pattern of patterns) {
      const near = pickSqftNearPattern(text, pattern);
      if (near) return near;
    }
    return null;
  };

  const firstGenericBathroomSqft = () => {
    if (!/\bbath(?:room)?\s+remodel\b/.test(blob) || /\bkitchen\b/.test(blob)) return null;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\b(shower|wall|ceiling|backsplash|countertop|paint)\b/.test(c)) continue;
      const q = firstQty(clause, SQFT_RE);
      if (q) return q;
    }
    return null;
  };

  // Bathroom floor
  const bathFloor =
    pickSqftFromClauses([
      /\bbath(?:room)?.\s+floor\b/,
      /\bbath(?:room)?.\b.*\bfloor(?:ing)?.\b/,
      /\bfloor\b.*\bbath(?:room)?.\b/,
      /\b(?:main\s+)(?:bath(?:room|)|bath)\b/,
    ]) ||
    firstGenericBathroomSqft();
  if (bathFloor) out.bathroomFloorSqft = bathFloor;

  // Kitchen floor — only when notes explicitly mention kitchen/floor tile (not backsplash or paint)
  const kitchenFloor = pickSqftFromClauses([
    /\bkitchen\s+floor\b/,
    /\bkitchen\b.*\b(?:floor(?:ing)?|tile\s+floor|lvp|laminate|vinyl)\b/,
    /\b(?:floor(?:ing)?|tile\s+floor|lvp|laminate|vinyl)\b.*\bkitchen\b/,
    /\bfloor(?:ing)?\s+(?:demo|removal|install)\b/,
  ]);
  if (kitchenFloor) out.kitchenFloorSqft = kitchenFloor;

  // Backsplash
  const backsplash =
    pickSqftNearPattern(text, /\bback\s*splash\b|\bbacksplash\b/) ||
    pickSqftFromClauses([/\bback\s*splash\b/, /\bbacksplash\b/]);
  if (backsplash) out.backsplashSqft = backsplash;

  // Countertops (exclude backsplash lines)
  const countertopSqft = (() => {
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\bback\s*splash|backsplash/.test(c)) continue;
      if (!/\bcountertops?|\bcounters\b|\bquartz\b|\bgranite\b/.test(c)) continue;
      const near = pickSqftNearPattern(clause, /\bcountertops?|\bcounters\b|\bquartz\b|\bgranite\b/);
      if (near) return near;
      const q = firstQty(clause, SQFT_RE);
      if (q) return q;
    }
    return pickSqftNearPattern(text, /\bcountertops?|\bcounters\b|\bquartz\b|\bgranite\b/);
  })();
  if (countertopSqft) out.countertopSqft = countertopSqft;

  // Cabinet run LF
  const cabinetLf = (() => {
    for (const clause of clauses) {
      if (!/\bcabinet/.test(clause.toLowerCase())) continue;
      const q = firstQty(clause, LF_RE);
      if (q) return q;
    }
    return pickLfNearPattern(text, /\bcabinet/);
  })();
  if (cabinetLf) out.cabinetLf = cabinetLf;

  // Shower wall / shower tile
  const showerWall =
    pickSqftFromClauses([
      /\bshower\s+wall\b/,
      /\bshower\s+tile\b/,
      /\btile\s+shower\b/,
      /\bshower\b.*\btile\b/,
    ]) || null;
  if (showerWall) out.showerWallTileSqft = showerWall;

  // Shower floor
  const showerFloor = pickSqftFromClauses([/\bshower\s+floor\b/, /\bshower\s+pan\b/, /\bshower\s+base\b/]);
  if (showerFloor) out.showerFloorTileSqft = showerFloor;

  // Interior paint — use sqft near paint keywords (not first sqft in clause; backsplash may precede paint on one line)
  const PAINT_SQFT_PATTERNS = [
    /\bpaint(?:ing)?\b/,
    /\bwall(?:s)?\s*(?:and\s+(?:the\s+)?|\/|&\s*)ceiling\b/,
    /\binterior\s+paint\b/,
  ];
  const paintSqft = (() => {
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\bexterior\b/.test(c)) continue;
      if (!PAINT_SQFT_PATTERNS.some((p) => p.test(c))) continue;
      for (const pattern of PAINT_SQFT_PATTERNS) {
        const near = pickSqftNearPattern(clause, pattern);
        if (near) return near;
      }
    }
    return pickSqftFromClauses(PAINT_SQFT_PATTERNS);
  })();
  if (paintSqft) out.wallPaintSqft = paintSqft;

  const exteriorPaintSqft = pickSqftFromClauses([/\bexterior\s+paint\b/, /\bpaint\s+exterior\b/]);
  if (exteriorPaintSqft) out.exteriorPaintSqft = exteriorPaintSqft;

  // Drywall
  const drywallSqft = pickSqftFromClauses([/\bdrywall\b/, /\bsheetrock\b/, /\bhang\s+(?:and\s+)?finish\b/]);
  if (drywallSqft) out.drywallSqft = drywallSqft;

  // Landscaping — specific coverage areas first
  const sodSqft = pickSqftFromClauses([/\b(?:new\s+)?sod\b/, /\bturf\b/, /\b(?:new\s+)?grass\b/, /\bexisting\s+sod\b/]);
  if (sodSqft) out.sodSqft = sodSqft;

  const paverSqft = pickSqftFromClauses([/\bpavers?\b/, /\bpatio\b.*\bpaver/]);
  if (paverSqft) out.paverSqft = paverSqft;

  const rockMulchSqft = pickSqftFromClauses([/\brock\b/, /\bmulch\b/, /\bgravel\b/]);
  if (rockMulchSqft) out.rockMulchSqft = rockMulchSqft;

  const landscapeSqft = pickSqftFromClauses([
    /\b(?:back|front|side)?\s*yard\b/,
    /\blandscap(?:e|ing)\b/,
    /\blawn\b/,
  ]);
  if (landscapeSqft) out.landscapeSqft = landscapeSqft;

  // Flooring / floor-area jobs (tile demo, laminate install, etc.)
  const floorAreaSqft = (() => {
    let max = 0;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (
        /\bbaseboards?\b|\btrim\b|\bmoulding\b|\bmolding\b|\bcasing\b/i.test(c) &&
        !/\b(install|installation|lvp|laminate|vinyl|carpet|flooring|tile|demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(c)
      ) {
        continue;
      }
      if (/\bback\s*splash|backsplash|\bcountertop|\bpaint\b|\bshower\b/i.test(c)) continue;
      if (!/\b(demo|demolition|remove|removal|tear[\s-]?out|install|installation|laminate|tile|lvp|vinyl|flooring|floor|carpet)\b/i.test(c)) continue;
      const q = firstQty(clause, SQFT_RE);
      if (q && q > max) max = q;
    }
    return max > 0 ? max : null;
  })();
  if (floorAreaSqft) out.floorAreaSqft = floorAreaSqft;

  const deckSqft = pickSqftFromClauses([/\bdeck(?:ing)?\b/]);
  if (deckSqft) out.deckSqft = deckSqft;

  const railingLf = (() => {
    for (const clause of clauses) {
      if (!/\brail(?:ing)?|guardrail/.test(clause.toLowerCase())) continue;
      const q = firstQty(clause, LF_RE);
      if (q) return q;
    }
    return pickLfNearPattern(text, /\brail(?:ing)?|guardrail/);
  })();
  if (railingLf) out.railingLf = railingLf;

  // Baseboard LF
  const baseboardLf =
    (() => {
      for (const clause of clauses) {
        if (!/\bbaseboards?\b|\btrim\b/.test(clause.toLowerCase())) continue;
        const q = firstQty(clause, LF_RE);
        if (q) return q;
      }
      return null;
    })() || null;
  if (baseboardLf) out.baseboardLf = baseboardLf;

  // Roofing squares (or convert roof sqft → squares)
  if (/\broof(?:ing)?\b|\bshingles?\b|\btear[\s-]?off\b/.test(blob)) {
    for (const clause of clauses) {
      const sq = firstQty(clause, SQUARES_RE);
      if (sq) {
        out.roofSquares = sq;
        break;
      }
      const sqft = firstQty(clause, SQFT_RE);
      if (sqft && /\broof|\bshingle/.test(clause.toLowerCase())) {
        out.roofSquares = Math.round((sqft / 100) * 10) / 10;
        break;
      }
    }
    if (!out.roofSquares) {
      const sq = firstQty(text, SQUARES_RE);
      if (sq) out.roofSquares = sq;
      else {
        const sqft = pickSqftNearPattern(text, /\broof|\bshingle/);
        if (sqft) out.roofSquares = Math.round((sqft / 100) * 10) / 10;
      }
    }
  }

  // Concrete
  const concreteSqft = pickSqftFromClauses([/\bconcrete\b/, /\bflatwork\b/, /\bslab\b/, /\bpatio\b/, /\bdriveway\b/]);
  if (concreteSqft) out.concreteSqft = concreteSqft;

  let concreteCy = null;
  for (const clause of clauses) {
    if (!/\bconcrete\b|\bfoundation\b|\bslab\b/.test(clause.toLowerCase())) continue;
    const cy = firstQty(clause, CY_RE);
    if (cy) {
      concreteCy = cy;
      break;
    }
  }
  if (concreteCy) out.concreteCy = concreteCy;

  // Excavation CY
  let excavationCy = null;
  for (const clause of clauses) {
    if (!/\bexcavat(?:e|ion)\b|\btrench(?:ing)?\b|\bgrading\b/.test(clause.toLowerCase())) continue;
    const cy = firstQty(clause, CY_RE);
    if (cy) {
      excavationCy = cy;
      break;
    }
  }
  if (excavationCy) out.excavationCy = excavationCy;

  // Tons (mulch/rock)
  const tons = (() => {
    for (const clause of clauses) {
      if (!/\bmulch\b|\brock\b|\bgravel\b|\bstone\b/.test(clause.toLowerCase())) continue;
      const t = firstQty(clause, TON_RE);
      if (t) return t;
    }
    return null;
  })();
  if (tons) out.landscapeTons = tons;

  // Legacy aliases
  if (out.bathroomFloorSqft && !out.sqft) out.sqft = out.bathroomFloorSqft;
  if (out.baseboardLf && !out.lf) out.lf = out.baseboardLf;

  const itemAllowances = parseScopeItemAllowancesFromNotes(text, ctx);
  const itemRatePricing = parseScopeItemRatePricingFromNotes(text, out, ctx);
  const itemQuantities = { ...itemAllowances, ...itemRatePricing };
  if (Object.keys(itemQuantities).length) {
    out.itemQuantities = itemQuantities;
  }

  return out;
}

module.exports = {
  parseScopeMeasurementsFromNotes,
};
