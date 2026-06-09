/**
 * Client mirror of backend scopeMeasurementParser.js
 */

export type ParsedScopeMeasurements = {
  bathroomFloorSqft?: number;
  kitchenFloorSqft?: number;
  backsplashSqft?: number;
  showerWallTileSqft?: number;
  showerFloorTileSqft?: number;
  wallPaintSqft?: number;
  drywallSqft?: number;
  landscapeSqft?: number;
  roofSquares?: number;
  concreteSqft?: number;
  concreteCy?: number;
  excavationCy?: number;
  landscapeTons?: number;
  baseboardLf?: number;
  sqft?: number;
  lf?: number;
};

const SQFT_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|\bsf\b|ft\.?\s*²|square\s+feet)/gi;
const LF_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+feet|ln\s*ft|linear\s+ft)/gi;
const CY_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:cy|cubic\s+yards?)/gi;
const SQUARES_RE = /(\d[\d,]*(?:\.\d+)?)\s*squares?\b/gi;
const TON_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:tons?)\b/gi;

function parseQty(match: RegExpExecArray): number | null {
  const n = Number(String(match[1] ?? match[0]).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function firstQty(text: string, re: RegExp): number | null {
  const m = re.exec(text);
  re.lastIndex = 0;
  return m ? parseQty(m) : null;
}

function splitNoteClauses(text: string): string[] {
  return String(text || '')
    .split(/[\n.;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clauseMatches(clause: string, patterns: RegExp[]): boolean {
  const c = clause.toLowerCase();
  return patterns.some((p) => p.test(c));
}

function pickSqftNearPattern(text: string, pattern: RegExp): number | null {
  const re = new RegExp(SQFT_RE.source, SQFT_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = Math.max(0, m.index - 25);
    const end = Math.min(text.length, m.index + m[0].length + 25);
    const window = text.slice(start, end).toLowerCase();
    if (pattern.test(window)) return parseQty(m);
  }
  return null;
}

export function parseScopeMeasurementsFromNotes(
  notes: string,
  ctx: { templateKey?: string; projectType?: string } = {}
): ParsedScopeMeasurements {
  const text = String(notes || '').trim();
  if (!text) return {};

  const templateKey = String(ctx.templateKey || '').toLowerCase();
  const projectType = String(ctx.projectType || '').toLowerCase();
  const out: ParsedScopeMeasurements = {};
  const clauses = splitNoteClauses(text);
  const blob = text.toLowerCase();

  const pickSqftFromClauses = (patterns: RegExp[]) => {
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

  const bathFloor =
    pickSqftFromClauses([/\bbath(?:room)?\s+floor\b/, /\bbath(?:room)?\b.*\bfloor(?:ing)?\b/]) ||
    (/\bbath(?:room)?\s+remodel\b/.test(blob) && !/\bkitchen\b/.test(blob) ? firstQty(text, SQFT_RE) : null);
  if (bathFloor) out.bathroomFloorSqft = bathFloor;

  const kitchenFloor =
    pickSqftFromClauses([/\bkitchen\s+floor\b/, /\bkitchen\b.*\bfloor(?:ing)?\b/]) ||
    (projectType === 'kitchen' || templateKey === 'kitchen' ? firstQty(text, SQFT_RE) : null);
  if (kitchenFloor) out.kitchenFloorSqft = kitchenFloor;

  const backsplash =
    pickSqftNearPattern(text, /\bback\s*splash\b|\bbacksplash\b/) ||
    pickSqftFromClauses([/\bback\s*splash\b/, /\bbacksplash\b/]);
  if (backsplash) out.backsplashSqft = backsplash;

  const showerWall = pickSqftFromClauses([/\bshower\s+wall\b/, /\bshower\s+tile\b/, /\btile\s+shower\b/]);
  if (showerWall) out.showerWallTileSqft = showerWall;

  const showerFloor = pickSqftFromClauses([/\bshower\s+floor\b/, /\bshower\s+pan\b/]);
  if (showerFloor) out.showerFloorTileSqft = showerFloor;

  const paintSqft = pickSqftFromClauses([/\bpaint(?:ing)?\b/, /\binterior\s+paint\b/]);
  if (paintSqft) out.wallPaintSqft = paintSqft;

  const drywallSqft = pickSqftFromClauses([/\bdrywall\b/, /\bsheetrock\b/]);
  if (drywallSqft) out.drywallSqft = drywallSqft;

  const landscapeSqft =
    pickSqftFromClauses([/\b(?:back|front|side)?\s*yard\b/, /\blandscap/, /\bsod\b/, /\bturf\b/, /\bmulch\b/, /\bpavers?\b/]) ||
    (projectType === 'landscaping' || templateKey === 'landscaping' ? firstQty(text, SQFT_RE) : null);
  if (landscapeSqft) out.landscapeSqft = landscapeSqft;

  for (const clause of clauses) {
    if (!/\bbaseboard\b|\btrim\b/.test(clause.toLowerCase())) continue;
    const q = firstQty(clause, LF_RE);
    if (q) {
      out.baseboardLf = q;
      break;
    }
  }

  if (/\broof(?:ing)?\b|\bshingles?\b|\btear[\s-]?off\b/.test(blob)) {
    for (const clause of clauses) {
      const sq = firstQty(clause, SQUARES_RE);
      if (sq) {
        out.roofSquares = sq;
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

  const concreteSqft = pickSqftFromClauses([/\bconcrete\b/, /\bflatwork\b/, /\bslab\b/, /\bpatio\b/]);
  if (concreteSqft) out.concreteSqft = concreteSqft;

  for (const clause of clauses) {
    if (!/\bexcavat/.test(clause.toLowerCase())) continue;
    const cy = firstQty(clause, CY_RE);
    if (cy) {
      out.excavationCy = cy;
      break;
    }
  }

  if (out.bathroomFloorSqft) out.sqft = out.bathroomFloorSqft;
  if (out.baseboardLf) out.lf = out.baseboardLf;

  return out;
}
