/**
 * Client mirror of backend scopeMeasurementParser.js
 */

import type { ScopeItemQuantity } from '@/utils/estimateAiDraft';
import { parseScopeItemAllowancesFromNotes } from '@/utils/scopeAllowanceParser';
import { parseScopeItemRatePricingFromNotes } from '@/utils/scopeRatePricingParser';

export type ParsedScopeMeasurements = {
  bathroomFloorSqft?: number;
  kitchenFloorSqft?: number;
  floorAreaSqft?: number;
  flooringSqft?: number;
  backsplashSqft?: number;
  countertopSqft?: number;
  cabinetLf?: number;
  showerWallTileSqft?: number;
  showerFloorTileSqft?: number;
  wallPaintSqft?: number;
  exteriorPaintSqft?: number;
  drywallSqft?: number;
  landscapeSqft?: number;
  sodSqft?: number;
  paverSqft?: number;
  rockMulchSqft?: number;
  landscapeTons?: number;
  roofSquares?: number;
  concreteSqft?: number;
  concreteCy?: number;
  excavationCy?: number;
  deckSqft?: number;
  railingLf?: number;
  baseboardLf?: number;
  sqft?: number;
  lf?: number;
  itemQuantities?: Record<string, ScopeItemQuantity>;
};

const SQFT_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:total\s+)?(?:sq\.?\s*ft|sqft|\bsf\b|ft\.?\s*(?:²|2\b|\?)|square\s+(?:foot|feet))/gi;
const LF_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:foot|feet)|ln\s*ft|linear\s+ft)/gi;
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
  const normalized = String(text || '').trim();
  if (!normalized) return [];

  let sentences = normalized
    .split(
      /(?<!\d)\.\s+(?=[A-Z])|\.\s+(?=(?:demo|install|final|baseboards?|remove|tear|new|paint|interior|cleanup|haul|trim|replace|lvp|vinyl|carpet|flooring|backsplash|back\s*splash|cabinet|countertops?|counters?|appliance)\b)/gi
    )
    .map((x) => x.trim())
    .filter(Boolean);
  if (sentences.length === 1) {
    sentences = normalized
      .split(/[\n;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  const clauses: string[] = [];
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
  return clauses
    .flatMap((clause) => clause.split(/,\s+(?=[a-z])/i))
    .map((clause) => clause.trim())
    .filter(Boolean);
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

function pickLfNearPattern(text: string, pattern: RegExp): number | null {
  const re = new RegExp(LF_RE.source, LF_RE.flags);
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

  const bathFloor =
    pickSqftFromClauses([
      /\bbath(?:room)?\s+floor\b/,
      /\bbath(?:room)?\b.*\bfloor(?:ing)?\b/,
      /\bfloor\b.*\bbath(?:room)?\b/,
      /\bmain\s+bath(?:room)?\b/,
    ]) ||
    firstGenericBathroomSqft();
  if (bathFloor) out.bathroomFloorSqft = bathFloor;

  const kitchenFloor = pickSqftFromClauses([
    /\bkitchen\s+floor\b/,
    /\bkitchen\b.*\b(?:floor(?:ing)?|tile\s+floor|lvp|laminate|vinyl)\b/,
    /\b(?:floor(?:ing)?|tile\s+floor|lvp|laminate|vinyl)\b.*\bkitchen\b/,
    /\bfloor(?:ing)?\s+(?:demo|removal|install)\b/,
  ]);
  if (kitchenFloor) out.kitchenFloorSqft = kitchenFloor;

  const backsplash =
    pickSqftNearPattern(text, /\bback\s*splash\b|\bbacksplash\b/) ||
    pickSqftFromClauses([/\bback\s*splash\b/, /\bbacksplash\b/]);
  if (backsplash) out.backsplashSqft = backsplash;

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

  const cabinetLf = (() => {
    for (const clause of clauses) {
      if (!/\bcabinet/.test(clause.toLowerCase())) continue;
      const q = firstQty(clause, LF_RE);
      if (q) return q;
    }
    return pickLfNearPattern(text, /\bcabinet/);
  })();
  if (cabinetLf) out.cabinetLf = cabinetLf;

  const showerWall = pickSqftFromClauses([/\bshower\s+wall\b/, /\bshower\s+tile\b/, /\btile\s+shower\b/]);
  if (showerWall) out.showerWallTileSqft = showerWall;

  const showerFloor = pickSqftFromClauses([/\bshower\s+floor\b/, /\bshower\s+pan\b/]);
  if (showerFloor) out.showerFloorTileSqft = showerFloor;

  // Use sqft near paint keywords — not first sqft in clause (backsplash may precede paint on one line)
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

  const drywallSqft = pickSqftFromClauses([/\bdrywall\b/, /\bsheetrock\b/]);
  if (drywallSqft) out.drywallSqft = drywallSqft;

  const flooringSqft = (() => {
    let max = 0;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\b(demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(c)) continue;
      if (!/\b(flooring|lvp|laminate|vinyl|carpet|floor\s+install)\b/i.test(c)) continue;
      const q = firstQty(clause, SQFT_RE);
      if (q && q > max) max = q;
    }
    return max > 0 ? max : null;
  })();
  if (flooringSqft) out.flooringSqft = flooringSqft;

  const sodSqft = pickSqftFromClauses([/\b(?:new\s+)?sod\b/, /\bturf\b/, /\b(?:new\s+)?grass\b/, /\bexisting\s+sod\b/]);
  if (sodSqft) out.sodSqft = sodSqft;

  const paverSqft = pickSqftFromClauses([/\bpavers?\b/, /\bpatio\b.*\bpaver/]);
  if (paverSqft) out.paverSqft = paverSqft;

  const rockMulchSqft = pickSqftFromClauses([/\brock\b/, /\bmulch\b/, /\bgravel\b/]);
  if (rockMulchSqft) out.rockMulchSqft = rockMulchSqft;

  const landscapeSqft = pickSqftFromClauses([/\b(?:back|front|side)?\s*yard\b/, /\blandscap(?:e|ing)\b/, /\blawn\b/]);
  if (landscapeSqft) out.landscapeSqft = landscapeSqft;

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

  for (const clause of clauses) {
    if (!/\bbaseboards?\b|\btrim\b/.test(clause.toLowerCase())) continue;
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

  const concreteSqft = pickSqftFromClauses([/\bconcrete\b/, /\bflatwork\b/, /\bslab\b/, /\bpatio\b/, /\bdriveway\b/]);
  if (concreteSqft) out.concreteSqft = concreteSqft;

  for (const clause of clauses) {
    if (!/\bconcrete\b|\bfoundation\b|\bslab\b/.test(clause.toLowerCase())) continue;
    const cy = firstQty(clause, CY_RE);
    if (cy) {
      out.concreteCy = cy;
      break;
    }
  }

  for (const clause of clauses) {
    if (!/\bexcavat/.test(clause.toLowerCase())) continue;
    const cy = firstQty(clause, CY_RE);
    if (cy) {
      out.excavationCy = cy;
      break;
    }
  }

  for (const clause of clauses) {
    if (!/\bmulch\b|\brock\b|\bgravel\b|\bstone\b/.test(clause.toLowerCase())) continue;
    const t = firstQty(clause, TON_RE);
    if (t) {
      out.landscapeTons = t;
      break;
    }
  }

  if (out.bathroomFloorSqft) out.sqft = out.bathroomFloorSqft;
  if (out.baseboardLf) out.lf = out.baseboardLf;

  const itemAllowances = parseScopeItemAllowancesFromNotes(text, ctx);
  const itemRatePricing = parseScopeItemRatePricingFromNotes(text, out, ctx);
  const itemQuantities = { ...itemAllowances, ...itemRatePricing };
  if (ctx.templateKey === 'flooring' && itemQuantities.floor_demo) {
    delete itemQuantities.demo;
  }
  if (Object.keys(itemQuantities).length) {
    return { ...out, itemQuantities };
  }

  return out;
}

const UNPRICED_NOTE_RE = /\b(not\s+priced\s+yet|not\s+priced|unpriced|no\s+pric(?:e|ing))\b/i;

/**
 * Single source of truth for stale-pricing cleanup during hydration. When the
 * notes say an item is unpriced, drop any carried-over rate splits (and money
 * totals) for every item the fresh notes parse did NOT price. Generalized
 * across all trades so material/labor splits never linger from a prior parse.
 */
export function clearStalePricingWhenNotesUnpriced(
  itemQuantities: Record<string, { quantity: unknown; unit?: string; quantitySource?: unknown }>,
  notes: string | null | undefined,
  freshParsedItemQuantities?: Record<string, { unit?: string }> | null
): void {
  if (!itemQuantities || !UNPRICED_NOTE_RE.test(String(notes || ''))) return;
  const fresh = freshParsedItemQuantities || {};
  const bases = new Set<string>();
  for (const id of Object.keys(itemQuantities)) {
    bases.add(id.replace(/__(?:material|labor|allowance)$/, ''));
  }
  const isMoneyUnit = (unit?: string) => unit === 'allowance' || unit === 'lump_sum';
  for (const base of bases) {
    const freshHasPricing =
      `${base}__material` in fresh ||
      `${base}__labor` in fresh ||
      `${base}__allowance` in fresh ||
      (base in fresh && isMoneyUnit(fresh[base]?.unit));
    if (freshHasPricing) continue;
    delete itemQuantities[`${base}__material`];
    delete itemQuantities[`${base}__labor`];
    delete itemQuantities[`${base}__allowance`];
    if (isMoneyUnit(itemQuantities[base]?.unit)) {
      delete itemQuantities[base];
    }
  }
}
