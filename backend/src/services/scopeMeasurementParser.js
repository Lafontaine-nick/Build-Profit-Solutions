/**
 * Parse job notes into Confirm Scope quick-measurement fields.
 * Used to autofill kitchen sqft, landscaping coverage, roof squares, etc.
 */

const { splitNoteClauses } = require('./estimateDraftQuantityPrice');

const SQFT_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|\bsf\b|ft\.?\s*²|square\s+feet)/gi;
const LF_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+feet|ln\s*ft|linear\s+ft)/gi;
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

  const clauses = splitNoteClauses(text);
  const blob = text.toLowerCase();

  const pickSqftFromClauses = (patterns) => {
    for (const clause of clauses) {
      if (!clauseMatches(clause, patterns)) continue;
      const near = pickSqftNearPattern(clause, patterns[0]);
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

  // Bathroom floor
  const bathFloor =
    pickSqftFromClauses([/\bbath(?:room)?\s+floor\b/, /\bbath(?:room)?\b.*\bfloor(?:ing)?\b/, /\bfloor\b.*\bbath(?:room)?\b/]) ||
    (/\bbath(?:room)?\s+remodel\b/.test(blob) && !/\bkitchen\b/.test(blob) ? firstQty(text, SQFT_RE) : null);
  if (bathFloor) out.bathroomFloorSqft = bathFloor;

  // Kitchen floor
  const kitchenFloor =
    pickSqftFromClauses([/\bkitchen\s+floor\b/, /\bkitchen\b.*\bfloor(?:ing)?\b/, /\bfloor\b.*\bkitchen\b/]) ||
    (projectType === 'kitchen' || templateKey === 'kitchen' ? firstQty(text, SQFT_RE) : null);
  if (kitchenFloor) out.kitchenFloorSqft = kitchenFloor;

  // Backsplash
  const backsplash =
    pickSqftNearPattern(text, /\bback\s*splash\b|\bbacksplash\b/) ||
    pickSqftFromClauses([/\bback\s*splash\b/, /\bbacksplash\b/]);
  if (backsplash) out.backsplashSqft = backsplash;

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

  // Paint
  const paintSqft =
    pickSqftFromClauses([
      /\bpaint(?:ing)?\b/,
      /\bwall(?:s)?\s*(?:and|\/|&)\s*ceiling\b/,
      /\binterior\s+paint\b/,
    ]) || null;
  if (paintSqft) out.wallPaintSqft = paintSqft;

  // Drywall
  const drywallSqft = pickSqftFromClauses([/\bdrywall\b/, /\bsheetrock\b/, /\bhang\s+(?:and\s+)?finish\b/]);
  if (drywallSqft) out.drywallSqft = drywallSqft;

  // Landscaping / yard coverage
  const landscapeSqft =
    pickSqftFromClauses([
      /\b(?:back|front|side)?\s*yard\b/,
      /\blandscap(?:e|ing)\b/,
      /\bsod\b/,
      /\bturf\b/,
      /\bmulch\b/,
      /\brock\b/,
      /\bpavers?\b/,
      /\blawn\b/,
    ]) ||
    (projectType === 'landscaping' || templateKey === 'landscaping' ? firstQty(text, SQFT_RE) : null);
  if (landscapeSqft) out.landscapeSqft = landscapeSqft;

  // Baseboard LF
  const baseboardLf =
    (() => {
      for (const clause of clauses) {
        if (!/\bbaseboard\b|\btrim\b/.test(clause.toLowerCase())) continue;
        const q = firstQty(clause, LF_RE);
        if (q) return q;
      }
      return firstQty(text, LF_RE);
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

  return out;
}

module.exports = {
  parseScopeMeasurementsFromNotes,
};
