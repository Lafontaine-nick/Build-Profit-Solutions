/**
 * Client mirror of backend scopeMeasurementParser.js
 */

import type { ScopeItemQuantity } from '@/utils/estimateAiDraft';
import { parseScopeItemAllowancesFromNotes } from '@/utils/scopeAllowanceParser';
import { parseScopeItemRatePricingFromNotes } from '@/utils/scopeRatePricingParser';
import { parseElectricalMeasurementsFromNotes } from '@/utils/subcontractorTrade/electricalPlanConvergence';

export type ParsedScopeMeasurements = {
  paintScope?: Array<
    'walls' | 'ceilings' | 'trim' | 'doors' | 'cabinets' | 'exterior'
  >;
  paintOccupancyConfirmed?: boolean;
  paintApplicationMethodConfirmed?: boolean;
  paintAreaBasis?: 'walls' | 'ceilings' | 'combined' | 'floor_area' | 'unknown';
  paintAreaNeedsConfirmation?: boolean;
  paintAreaSqft?: number;
  paintPricingMethod?: 'combined' | 'separate';
  combinedPaintableAreaSqft?: number;
  originalPaintAreaReferenceSqft?: number;
  paintOccupancy?: 'occupied' | 'vacant' | 'new_construction';
  paintApplicationMethod?: 'brush_roll' | 'spray' | 'mixed';
  bathroomFloorSqft?: number;
  kitchenFloorSqft?: number;
  floorAreaSqft?: number;
  flooringSqft?: number;
  flooringProductScope?: Array<
    | 'lvp'
    | 'laminate'
    | 'engineered_hardwood'
    | 'solid_hardwood'
    | 'tile'
    | 'carpet'
  >;
  flooringExistingLvpInstallMethod?: 'floating' | 'glue_down' | 'unknown';
  flooringExistingSheetVinylType?: 'sheet_vinyl' | 'vct' | 'unknown';
  planRooms?: Array<{
    name: string;
    areaSqft: number | null;
    sourceType?: 'user_entered' | 'plan_explicit' | 'unknown';
  }>;
  flooringLvpSqft?: number;
  flooringLaminateSqft?: number;
  flooringEngineeredHardwoodSqft?: number;
  flooringSolidHardwoodSqft?: number;
  flooringTileSqft?: number;
  flooringCarpetSqft?: number;
  floorDemoSqft?: number;
  floorPrepSqft?: number;
  underlaymentSqft?: number;
  moistureBarrierSqft?: number;
  transitionLf?: number;
  transitionCount?: number;
  quarterRoundLf?: number;
  backsplashSqft?: number;
  countertopSqft?: number;
  cabinetLf?: number;
  wallDemoSqft?: number;
  wallDemoLf?: number;
  showerWallTileSqft?: number;
  showerFloorTileSqft?: number;
  wallPaintSqft?: number;
  ceilingPaintSqft?: number;
  exteriorPaintSqft?: number;
  interiorDoorCount?: number;
  cabinetPaintSqft?: number;
  cabinetUpperLf?: number;
  cabinetLowerLf?: number;
  cabinetTallLf?: number;
  cabinetRunLf?: number;
  drywallSqft?: number;
  exteriorWallInsulationSqft?: number;
  atticInsulationSqft?: number;
  insulatedRoofDeckSqft?: number;
  floorInsulationSqft?: number;
  garageSeparationInsulationSqft?: number;
  insulatedGarageWallSqft?: number;
  insulatedGarageCeilingSqft?: number;
  openingDeductionSqft?: number;
  insulationMaterialType?: string;
  insulationRValue?: string;
  garageInsulationIncluded?: string;
  landscapeSqft?: number;
  artificialTurfSqft?: number;
  sodSqft?: number;
  paverSqft?: number;
  rockMulchSqft?: number;
  landscapeTons?: number;
  roofAreaSqft?: number;
  roofIceWaterShieldSqft?: number;
  roofSquares?: number;
  roofPitch?: string;
  storyCount?: number;
  concreteSqft?: number;
  concreteDemoSqft?: number;
  concreteDemoThicknessBand?:
    'thin_2_3' | 'standard_4' | 'heavy_5_6' | 'structural_7_plus';
  concreteDemoReinforced?: boolean;
  concreteDemoLimitedAccess?: boolean;
  concreteCy?: number;
  excavationCy?: number;
  excavationAreaSqft?: number;
  excavationDepthInches?: number;
  deckSqft?: number;
  railingLf?: number;
  baseboardLf?: number;
  sqft?: number;
  lf?: number;
  itemQuantities?: Record<string, ScopeItemQuantity>;
};

const SQFT_RE =
  /(\d[\d,]*(?:\.\d+)?)\s*(?:total\s+)?(?:sq\.?\s*ft|sqft|\bsf\b|ft\.?\s*(?:²|2\b|\?)|square\s+(?:foot|feet))/gi;
const LF_RE =
  /(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:foot|feet)|ln\s*ft|linear\s+ft)/gi;
const WALL_LF_RE =
  /(\d[\d,]*(?:\.\d+)?)\s*(?:lf|linear\s+(?:foot|feet)|ln\s*ft|linear\s+ft|feet|foot)\b/gi;
const CY_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:cy|cubic\s+yards?)/gi;
const SQUARES_RE = /(\d[\d,]*(?:\.\d+)?)\s*squares?\b/gi;
const ROOF_PITCH_RE =
  /\b(\d+)\s*(?::|\/)\s*(\d+)\s*pitch\b|\bpitch\s*(\d+)\s*(?::|\/)\s*(\d+)\b/i;
const STORY_COUNT_RE =
  /\b(\d+|one|two|three|four|five)\s*[- ]?stor(?:y|ies)\b/i;
const TON_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:tons?)\b/gi;
const DEPTH_INCHES_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:inches?|["″])/i;

const EXTERIOR_FLATWORK_RE =
  /\b(?:driveway|walkway|sidewalk|flat[\s-]?work|concrete\s+(?:patio|slab|pad)|patio\s+slab|rv\s+pad)\b/i;
const DEMO_VERB_RE =
  /\b(?:demo|demolition|remove|removal|tear[\s-]?out|break\s+up|rip\s+out)\b/i;

function isExteriorFlatworkClause(clause: string): boolean {
  const c = clause.toLowerCase();
  if (EXTERIOR_FLATWORK_RE.test(c)) return true;
  return /\bconcrete\b/.test(c) && /\b(?:patio|slab|drive|walk|flat)/.test(c);
}

function isDemoClause(clause: string): boolean {
  return DEMO_VERB_RE.test(clause.toLowerCase());
}

function isDirtExcavationClause(clause: string): boolean {
  const c = clause.toLowerCase();
  return (
    /\b(?:dirt|soil|earth|subgrade)\b/.test(c) &&
    /\b(?:excavat(?:e|ion)|remove|dig|cut\s*(?:\/|and)?\s*fill|soil\s+movement)\b/.test(
      c
    )
  );
}

function parseQty(match: RegExpExecArray): number | null {
  const n = Number(String(match[1] ?? match[0]).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseStoryCount(text: string): number | null {
  const match = text.match(STORY_COUNT_RE);
  if (!match) return null;
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  };
  const count = words[match[1].toLowerCase()] || Number(match[1]);
  return Number.isFinite(count) && count > 0 ? count : null;
}

function firstQty(text: string, re: RegExp): number | null {
  const m = re.exec(text);
  re.lastIndex = 0;
  return m ? parseQty(m) : null;
}

function allQty(text: string, re: RegExp): number[] {
  const values: number[] = [];
  const clone = new RegExp(re.source, re.flags);
  let m: RegExpExecArray | null;
  while ((m = clone.exec(text)) !== null) {
    const q = parseQty(m);
    if (q) values.push(q);
  }
  return values;
}

function splitNoteClauses(text: string): string[] {
  const normalized = String(text || '').trim();
  if (!normalized) return [];

  let sentences = normalized
    .split(
      /(?<!\d)\.\s+(?=[A-Z])|\.\s+(?=(?:demo|install|final|baseboards?|remove|tear|new|paint|interior|cleanup|haul|trim|replace|lvp|vinyl|carpet|flooring|backsplash|back\s*splash|cabinet|countertops?|counters?|appliance)\b)/gi
    )
    .map(x => x.trim())
    .filter(Boolean);
  if (sentences.length === 1) {
    sentences = normalized
      .split(/[\n;]+/)
      .map(x => x.trim())
      .filter(Boolean);
  }

  const clauses: string[] = [];
  for (let sentence of sentences) {
    sentence = sentence.replace(/\bwalls?\s+and\s+(?:the\s+)?ceiling\b/gi, m =>
      m.replace(/\s+and\s+/i, ' __WALLS_CEILING__ ')
    );
    sentence = sentence.replace(
      /\bfinal\s+clean\s+and\s+haul(?:[\s-]?off?)\b/gi,
      m => m.replace(/\s+and\s+/i, ' __FINAL_CLEAN_HAUL__ ')
    );
    const parts = sentence
      .split(
        /\s+(?:and|&|\+)\s+|\s+in\s+(?=\d[\d,]*\s*(?:sq\.?\s*ft\.?|sqft|sq\s*ft|square\s*feet|ft\.?\s*²|ft\.?\s*2\b|linear\s*feet|ln\.?\s*ft\.?|\blf\b))/i
      )
      .map(p =>
        p
          .trim()
          .replace(/__WALLS_CEILING__/g, ' and ')
          .replace(/__FINAL_CLEAN_HAUL__/g, ' and ')
      )
      .filter(Boolean);
    if (parts.length > 1) clauses.push(...parts);
    else
      clauses.push(
        sentence
          .replace(/__WALLS_CEILING__/g, ' and ')
          .replace(/__FINAL_CLEAN_HAUL__/g, ' and ')
      );
  }
  return clauses
    .flatMap(clause => clause.split(/,\s+(?=[a-z])/i))
    .map(clause => clause.trim())
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
  return pickLfNearPatternWithRegex(text, pattern, LF_RE);
}

function pickCountNearPattern(text: string, pattern: RegExp): number | null {
  const quantityRe = /(\d[\d,]*(?:\.\d+)?)\s*(?:ea|each|count)?\b/i;
  for (const clause of text.split(/[.;,\n]+/)) {
    if (!pattern.test(clause.toLowerCase())) continue;
    const match = clause.match(quantityRe);
    const quantity = match ? Number(String(match[1]).replace(/,/g, '')) : null;
    if (quantity != null && Number.isFinite(quantity) && quantity > 0) {
      return quantity;
    }
  }
  return null;
}

function pickRoofQuantityInClause(
  text: string,
  pattern: RegExp,
  quantityRe: RegExp
): number | null {
  for (const clause of text.split(/[.;,\n]+/)) {
    if (!pattern.test(clause.toLowerCase())) continue;
    const quantity = firstQty(clause, quantityRe);
    if (quantity) return quantity;
  }
  return null;
}

function pickLfNearPatternWithRegex(
  text: string,
  pattern: RegExp,
  quantityRe: RegExp
): number | null {
  const re = new RegExp(quantityRe.source, quantityRe.flags);
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
  if (templateKey === 'painting' || projectType === 'painting') {
    const scope: ParsedScopeMeasurements['paintScope'] = [];
    if (/\bwall(?:s)?\b/i.test(text)) scope.push('walls');
    if (/\bceilings?\b/i.test(text)) scope.push('ceilings');
    if (/\b(?:trim|baseboards?|casing|crown|molding|moulding)\b/i.test(text))
      scope.push('trim');
    if (/\b(?:interior\s+)?doors?\b/i.test(text)) scope.push('doors');
    if (
      /\bcabinets?\b/i.test(text) &&
      /\b(?:paint|painting|refinish|refinishing)\b/i.test(text)
    ) {
      scope.push('cabinets');
    }
    const excludesExteriorPaint =
      /\b(?:no|not|without|exclude(?:d)?|excluding)\s+(?:any\s+)?(?:exterior|outside)\s+(?:paint|painting)\b/i.test(
        text
      );
    if (
      !excludesExteriorPaint &&
      /\b(?:exterior|outside)\s+(?:paint|painting)\b|\b(?:paint|painting)\s+(?:the\s+)?(?:exterior|outside)\b|\b(?:paint|painting)\s+(?:the\s+)?(?:siding|stucco|soffit|fascia)\b|\b(?:siding|stucco|soffit|fascia)\s+(?:paint|painting)\b/i.test(
        text
      )
    ) {
      scope.push('exterior');
    }
    if (scope.length) out.paintScope = scope;
  }
  if (/\b(?:occupied|owner[- ]occupied|furnished)\b/i.test(text)) {
    out.paintOccupancy = 'occupied';
    out.paintOccupancyConfirmed = true;
  } else if (/\b(?:new construction|new build)\b/i.test(text)) {
    out.paintOccupancy = 'new_construction';
    out.paintOccupancyConfirmed = true;
  } else if (/\b(?:vacant|empty|unoccupied)\b/i.test(text)) {
    out.paintOccupancy = 'vacant';
    out.paintOccupancyConfirmed = true;
  }
  const hasSpray = /\b(?:spray|airless|sprayer)\b/i.test(text);
  const hasBrushRoll = /\b(?:brush|roll|roller)\b/i.test(text);
  if (hasSpray && hasBrushRoll) out.paintApplicationMethod = 'mixed';
  else if (hasSpray) out.paintApplicationMethod = 'spray';
  else if (hasBrushRoll) out.paintApplicationMethod = 'brush_roll';
  if (hasSpray || hasBrushRoll) out.paintApplicationMethodConfirmed = true;
  const clauses = splitNoteClauses(text);
  const blob = text.toLowerCase();

  const pickSqftFromClauses = (patterns: RegExp[]) => {
    for (const clause of clauses) {
      const matchedPattern = patterns.find(p => p.test(clause.toLowerCase()));
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
  // A generic yard/landscape area is not an area for a specific material.
  // For example, "fake grass and rocks ... backyard is 150 sqft" describes
  // the total yard, not 150 sqft of turf. Material quantities must be
  // explicitly tied to the material before the sqft value.
  const pickExplicitLandscapeMaterialSqft = (patterns: RegExp[]) => {
    for (const clause of clauses) {
      const lower = clause.toLowerCase();
      const quantityRe = new RegExp(SQFT_RE.source, SQFT_RE.flags);
      let match: RegExpExecArray | null;
      while ((match = quantityRe.exec(clause)) !== null) {
        const beforeQuantity = lower.slice(
          Math.max(0, match.index - 55),
          match.index
        );
        const materialMatches = patterns
          .map(pattern => {
            const materialMatch = [
              ...beforeQuantity.matchAll(
                new RegExp(
                  pattern.source,
                  pattern.flags.includes('g')
                    ? pattern.flags
                    : `${pattern.flags}g`
                )
              ),
            ].pop();
            return materialMatch?.index ?? -1;
          })
          .filter(index => index >= 0);
        const materialIndex = Math.max(...materialMatches);
        if (materialIndex < 0) continue;
        const between = beforeQuantity.slice(materialIndex);
        if (/\b(?:back|front|side)?\s*yard\b/.test(between)) continue;
        return parseQty(match);
      }
    }
    return null;
  };

  const firstGenericBathroomSqft = () => {
    if (!/\bbath(?:room)?\s+remodel\b/.test(blob) || /\bkitchen\b/.test(blob))
      return null;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\b(shower|wall|ceiling|backsplash|countertop|paint)\b/.test(c))
        continue;
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
    ]) || firstGenericBathroomSqft();
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
      if (!/\bcountertops?|\bcounters\b|\bquartz\b|\bgranite\b/.test(c))
        continue;
      const near = pickSqftNearPattern(
        clause,
        /\bcountertops?|\bcounters\b|\bquartz\b|\bgranite\b/
      );
      if (near) return near;
      const q = firstQty(clause, SQFT_RE);
      if (q) return q;
    }
    return pickSqftNearPattern(
      text,
      /\bcountertops?|\bcounters\b|\bquartz\b|\bgranite\b/
    );
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

  const showerWall = pickSqftFromClauses([
    /\bshower\s+wall\b/,
    /\bshower\s+tile\b/,
    /\btile\s+shower\b/,
  ]);
  if (showerWall) out.showerWallTileSqft = showerWall;

  const showerFloor = pickSqftFromClauses([
    /\bshower\s+floor\b/,
    /\bshower\s+pan\b/,
  ]);
  if (showerFloor) out.showerFloorTileSqft = showerFloor;

  // Use sqft near paint keywords — not first sqft in clause (backsplash may precede paint on one line)
  const PAINT_SQFT_PATTERNS = [
    /\bpaint(?:ing)?\b/,
    /\bwall(?:s)?\s*(?:and\s+(?:the\s+)?|\/|&\s*)ceiling\b/,
    /\binterior\s+paint\b/,
  ];
  const paintSqft = (() => {
    let largestRelevantPaintSqft = 0;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\bexterior\b/.test(c)) continue;
      if (!PAINT_SQFT_PATTERNS.some(p => p.test(c))) continue;
      for (const pattern of PAINT_SQFT_PATTERNS) {
        const near = pickSqftNearPattern(clause, pattern);
        if (near)
          largestRelevantPaintSqft = Math.max(largestRelevantPaintSqft, near);
      }
    }
    const globalPaintAreas =
      templateKey === 'painting' ||
      projectType === 'painting' ||
      /\binterior\s+repaint\b|\bpaint\s+all\s+(?:interior\s+)?walls?\b/i.test(
        blob
      )
        ? clauses
            .filter(clause => !/\bexterior\b/i.test(clause))
            .flatMap(clause => allQty(clause, SQFT_RE))
            .filter(q => q > 0)
        : [];
    if (globalPaintAreas.length)
      largestRelevantPaintSqft = Math.max(
        largestRelevantPaintSqft,
        ...globalPaintAreas
      );
    return largestRelevantPaintSqft || pickSqftFromClauses(PAINT_SQFT_PATTERNS);
  })();
  if (paintSqft) out.wallPaintSqft = paintSqft;

  const ceilingPaintSqft = pickSqftFromClauses([/\bceilings?\b/]);
  if (ceilingPaintSqft) out.ceilingPaintSqft = ceilingPaintSqft;

  const explicitWallPaintSqft = pickSqftNearPattern(text, /\bwalls?\b/);
  const explicitCeilingPaintSqft = pickSqftNearPattern(text, /\bceilings?\b/);
  const combinedPaintLanguage =
    /\bwalls?\s*(?:and|&)\s*ceilings?\b|\bceilings?\s*(?:and|&)\s*walls?\b/i.test(
      blob
    );
  const interiorPaintBlob = clauses
    .filter(clause => !/\bexterior\b/i.test(clause))
    .join(' ');
  const floorAreaPaintLanguage =
    /\b(?:house|home|floor\s+area|living\s+area)\b[^.;]{0,35}\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/i.test(
      interiorPaintBlob
    ) ||
    /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b[^.;]{0,35}\b(?:house|home|floor\s+area|living\s+area)\b/i.test(
      interiorPaintBlob
    );

  if (
    explicitWallPaintSqft &&
    explicitCeilingPaintSqft &&
    !combinedPaintLanguage
  ) {
    out.paintPricingMethod = 'separate';
    out.wallPaintSqft = explicitWallPaintSqft;
    out.ceilingPaintSqft = explicitCeilingPaintSqft;
  } else if (explicitWallPaintSqft && !combinedPaintLanguage) {
    out.paintPricingMethod = 'separate';
    out.wallPaintSqft = explicitWallPaintSqft;
    delete out.ceilingPaintSqft;
  } else if (explicitCeilingPaintSqft && !combinedPaintLanguage) {
    out.paintPricingMethod = 'separate';
    out.ceilingPaintSqft = explicitCeilingPaintSqft;
    delete out.wallPaintSqft;
  } else if (
    paintSqft &&
    (combinedPaintLanguage ||
      (!explicitWallPaintSqft && !explicitCeilingPaintSqft))
  ) {
    out.paintAreaSqft = paintSqft;
    out.originalPaintAreaReferenceSqft = paintSqft;
    out.paintAreaNeedsConfirmation = true;
    out.paintAreaBasis = floorAreaPaintLanguage ? 'floor_area' : 'unknown';
    if (combinedPaintLanguage && !floorAreaPaintLanguage) {
      out.paintPricingMethod = 'combined';
      out.combinedPaintableAreaSqft = paintSqft;
      out.paintAreaNeedsConfirmation = false;
      out.paintAreaBasis = 'combined';
    }
    delete out.wallPaintSqft;
    delete out.ceilingPaintSqft;
  }

  const interiorDoorCountMatch = blob.match(
    /(\d[\d,]*)\s+(?:interior\s+)?doors?\b/i
  );
  if (interiorDoorCountMatch) {
    const count = Number(interiorDoorCountMatch[1].replace(/,/g, ''));
    if (Number.isFinite(count) && count > 0) out.interiorDoorCount = count;
  }

  const cabinetPaintSqft =
    firstQty(
      text.match(
        /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b[^.;]{0,40}\bcabinets?\b/i
      )?.[0] || '',
      SQFT_RE
    ) ||
    pickSqftNearPattern(
      text,
      /\b(?:paint(?:ing)?|refinish(?:ing)?)\b[^.;]{0,40}\bcabinets?\b|\bcabinets?\b[^.;]{0,40}\b(?:paint(?:ing)?|refinish(?:ing)?)\b/i
    );
  if (cabinetPaintSqft) out.cabinetPaintSqft = cabinetPaintSqft;
  const cabinetUpperLf = pickLfNearPatternWithRegex(
    text,
    /\b(?:upper|uppers?)\b[^.;]{0,30}\bcabinets?\b/i,
    LF_RE
  );
  const cabinetLowerLf = pickLfNearPatternWithRegex(
    text,
    /\b(?:lower|lowers?)\b[^.;]{0,30}\bcabinets?\b/i,
    LF_RE
  );
  const cabinetTallLf = pickLfNearPatternWithRegex(
    text,
    /\b(?:tall|pantry)\b[^.;]{0,30}\bcabinets?\b/i,
    LF_RE
  );
  const cabinetRunLf = pickLfNearPatternWithRegex(
    text,
    /\b(?:cabinet|cabinetry)\s+(?:run|length)\b/i,
    LF_RE
  );
  if (cabinetUpperLf) out.cabinetUpperLf = cabinetUpperLf;
  if (cabinetLowerLf) out.cabinetLowerLf = cabinetLowerLf;
  if (cabinetTallLf) out.cabinetTallLf = cabinetTallLf;
  if (cabinetRunLf) out.cabinetRunLf = cabinetRunLf;
  if (!cabinetRunLf && (cabinetUpperLf || cabinetLowerLf || cabinetTallLf)) {
    out.cabinetRunLf =
      (cabinetUpperLf || 0) + (cabinetLowerLf || 0) + (cabinetTallLf || 0);
  }

  const exteriorPaintSqft = pickSqftFromClauses([
    /\bexterior\s+paint\b/,
    /\bpaint\s+exterior\b/,
  ]);
  if (exteriorPaintSqft) out.exteriorPaintSqft = exteriorPaintSqft;

  const drywallSqft = pickSqftFromClauses([/\bdrywall\b/, /\bsheetrock\b/]);
  if (drywallSqft) out.drywallSqft = drywallSqft;

  const insulationSqft = (patterns: RegExp[]) => pickSqftFromClauses(patterns);
  const exteriorWallInsulationSqft = insulationSqft([
    /\b(?:exterior|outside)\s+(?:wall\s+)?insulation\b/i,
    /\binsulation\b[^.;]{0,35}\b(?:exterior|outside)\s+walls?\b/i,
  ]);
  const atticInsulationSqft = insulationSqft([
    /\b(?:attic|ceiling)\s+insulation\b/i,
    /\binsulation\b[^.;]{0,35}\b(?:attic|ceiling)\b/i,
  ]);
  const insulatedRoofDeckSqft = insulationSqft([
    /\binsulated\s+roof\s+deck\b/i,
    /\broof\s+deck\s+insulation\b/i,
  ]);
  const floorInsulationSqft = insulationSqft([
    /\bfloor\s+insulation\b/i,
    /\binsulation\b[^.;]{0,35}\bfloor\b/i,
  ]);
  const garageSeparationInsulationSqft = insulationSqft([
    /\bgarage[-\s](?:to[-\s])?house\s+separation\s+insulation\b/i,
    /\bgarage\s+separation\s+insulation\b/i,
  ]);
  const insulatedGarageWallSqft = insulationSqft([
    /\binsulated\s+garage\s+walls?\b/i,
    /\bgarage\s+wall\s+insulation\b/i,
  ]);
  const insulatedGarageCeilingSqft = insulationSqft([
    /\binsulated\s+garage\s+ceilings?\b/i,
    /\bgarage\s+ceiling\s+insulation\b/i,
  ]);
  const openingDeductionSqft = insulationSqft([
    /\b(?:exterior\s+)?(?:window|door)\s+opening\s+deduction\b/i,
    /\binsulation\b[^.;]{0,35}\bopening(?:s)?\b/i,
  ]);
  if (exteriorWallInsulationSqft)
    out.exteriorWallInsulationSqft = exteriorWallInsulationSqft;
  if (atticInsulationSqft) out.atticInsulationSqft = atticInsulationSqft;
  if (insulatedRoofDeckSqft) out.insulatedRoofDeckSqft = insulatedRoofDeckSqft;
  if (floorInsulationSqft) out.floorInsulationSqft = floorInsulationSqft;
  if (garageSeparationInsulationSqft)
    out.garageSeparationInsulationSqft = garageSeparationInsulationSqft;
  if (insulatedGarageWallSqft)
    out.insulatedGarageWallSqft = insulatedGarageWallSqft;
  if (insulatedGarageCeilingSqft)
    out.insulatedGarageCeilingSqft = insulatedGarageCeilingSqft;
  if (openingDeductionSqft) out.openingDeductionSqft = openingDeductionSqft;
  const insulationMaterialType = text.match(
    /\b(?:insulation|insulate|insulated)\b[^.;\n]{0,60}\b(batt|blown[-\s]?in|spray\s+foam|rigid\s+foam|cellulose|fiberglass|mineral\s+wool)\b/i
  )?.[1];
  const insulationRValue = text.match(
    /\bR[-\s]?(\d{2,3})(?:\s*(?:wall|attic|ceiling|roof))?\b/i
  )?.[0];
  const garageInsulationIncluded = /\bgarage\b[^.;\n]{0,50}\b(insulat(?:e|ed|ion)|separation)\b/i.test(
    text
  )
    ? 'yes'
    : undefined;
  if (insulationMaterialType)
    out.insulationMaterialType = insulationMaterialType;
  if (insulationRValue) out.insulationRValue = insulationRValue;
  if (garageInsulationIncluded)
    out.garageInsulationIncluded = garageInsulationIncluded;

  const flooringSqft = (() => {
    let max = 0;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\b(demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(c))
        continue;
      if (!/\b(flooring|lvp|laminate|vinyl|carpet|floor\s+install)\b/i.test(c))
        continue;
      const q = firstQty(clause, SQFT_RE);
      if (q && q > max) max = q;
    }
    return max > 0 ? max : null;
  })();
  if (flooringSqft) out.flooringSqft = flooringSqft;
  const flooringProductScope: NonNullable<
    ParsedScopeMeasurements['flooringProductScope']
  > = [];
  if (/\b(?:lvp|luxury\s+vinyl)\b/i.test(blob))
    flooringProductScope.push('lvp');
  if (/\blaminate\b/i.test(blob)) flooringProductScope.push('laminate');
  if (/\bengineered\s+hardwood\b/i.test(blob))
    flooringProductScope.push('engineered_hardwood');
  if (/\bsolid\s+hardwood\b/i.test(blob))
    flooringProductScope.push('solid_hardwood');
  if (
    /\b(?:floor|flooring)\s+tile\b|\btile\s+(?:floor|flooring)\b/i.test(blob) ||
    (templateKey === 'flooring' && /\btile\b/i.test(blob))
  ) {
    flooringProductScope.push('tile');
  }
  if (/\bcarpet\b/i.test(blob)) flooringProductScope.push('carpet');
  if (flooringProductScope.length)
    out.flooringProductScope = flooringProductScope;
  if (
    /\b(?:glue[\s-]?down|adhesive[\s-]?backed)\s+(?:vinyl|lvp)\b/i.test(blob)
  ) {
    out.flooringExistingLvpInstallMethod = 'glue_down';
  } else if (/\bfloating\s+(?:vinyl|lvp)\b/i.test(blob)) {
    out.flooringExistingLvpInstallMethod = 'floating';
  } else if (
    /\blvp\b/i.test(blob) &&
    /\b(?:existing|current|old)\b/i.test(blob)
  ) {
    out.flooringExistingLvpInstallMethod = 'unknown';
  }
  if (/\b(?:vct|vinyl\s+tile)\b/i.test(blob)) {
    out.flooringExistingSheetVinylType = 'vct';
  } else if (/\bsheet\s+vinyl\b/i.test(blob)) {
    out.flooringExistingSheetVinylType = 'sheet_vinyl';
  } else if (
    /\bsheet\s+vinyl|vct|vinyl\s+tile\b/i.test(blob) &&
    /\b(?:existing|current|old)\b/i.test(blob)
  ) {
    out.flooringExistingSheetVinylType = 'unknown';
  }
  const roomMeasurements: NonNullable<ParsedScopeMeasurements['planRooms']> =
    [];
  const roomPattern =
    /\b(living\s+areas?|living\s+room|great\s+room|kitchens?|dining(?:\s+room)?|hallways?|bedrooms?(?:\s+\d+)?|primary\s+bedroom|bathrooms?(?:\s+\d+)?|offices?|laundry|entries?|foyers?|basements?|mudrooms?)\b/i;
  for (const clause of clauses) {
    const roomMatches = [
      ...clause.matchAll(new RegExp(roomPattern.source, 'gi')),
    ];
    if (!roomMatches.length) continue;
    const area = firstQty(clause, SQFT_RE);
    for (const roomMatch of roomMatches) {
      let name = roomMatch[1]
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      const trailingRoomNumber = name.match(/\s+(\d+)$/);
      if (trailingRoomNumber && Number(trailingRoomNumber[1]) > 20)
        name = name.replace(/\s+\d+$/, '');
      const roomArea = roomMatches.length === 1 ? area : null;
      if (
        !roomMeasurements.some(
          room => room.name.toLowerCase() === name.toLowerCase()
        )
      ) {
        roomMeasurements.push({
          name,
          areaSqft: roomArea || null,
          sourceType: roomArea ? 'user_entered' : 'unknown',
        });
      }
    }
  }
  if (roomMeasurements.length) out.planRooms = roomMeasurements;
  const flooringProductPatterns: Array<
    [keyof ParsedScopeMeasurements, RegExp]
  > = [
    ['flooringLvpSqft', /\b(?:lvp|luxury\s+vinyl)\b/i],
    ['flooringLaminateSqft', /\blaminate\b/i],
    ['flooringEngineeredHardwoodSqft', /\bengineered\s+hardwood\b/i],
    ['flooringSolidHardwoodSqft', /\bsolid\s+hardwood\b/i],
    [
      'flooringTileSqft',
      /\b(?:floor|flooring)\s+tile\b|\btile\s+(?:floor|flooring)\b/i,
    ],
    ['flooringCarpetSqft', /\bcarpet\b/i],
  ];
  for (const [key, pattern] of flooringProductPatterns) {
    const quantity = pickSqftFromClauses([pattern]);
    if (quantity) out[key] = quantity;
  }
  const floorDemoSqft = pickSqftFromClauses([
    /\b(?:floor|flooring|lvp|laminate|vinyl|carpet|tile)\b[^.;]{0,60}\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/,
    /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b[^.;]{0,60}\b(?:floor|flooring|lvp|laminate|vinyl|carpet|tile)\b/,
  ]);
  if (floorDemoSqft) out.floorDemoSqft = floorDemoSqft;
  const floorPrepSqft = pickSqftFromClauses([
    /\b(?:floor|subfloor)\s+prep\b/,
    /\b(?:prep|preparation|leveling|patching|repair|mitigation)\b[^.;]{0,45}\bfloor\b/,
    /\b(?:prep|preparation)\b/,
  ]);
  if (floorPrepSqft) out.floorPrepSqft = floorPrepSqft;
  const underlaymentSqft = pickSqftFromClauses([/\bunderlayment\b/]);
  if (underlaymentSqft) out.underlaymentSqft = underlaymentSqft;
  const moistureBarrierSqft = pickSqftFromClauses([
    /\b(?:moisture|vapor)\s+barrier\b|\bmoisture\s+mitigation\b/,
  ]);
  if (moistureBarrierSqft) out.moistureBarrierSqft = moistureBarrierSqft;
  const transitionLf = pickLfNearPattern(
    text,
    /\b(?:transition|reducer|threshold)s?\b/i
  );
  if (transitionLf) out.transitionLf = transitionLf;
  if (transitionLf) out.transitionCount = transitionLf;
  const quarterRoundLf = pickLfNearPattern(text, /\bquarter[\s-]?round\b/i);
  if (quarterRoundLf) out.quarterRoundLf = quarterRoundLf;

  const sodSqft = pickExplicitLandscapeMaterialSqft([
    /\b(?:new\s+)?sod\b/,
    /\bexisting\s+sod\b/,
  ]);
  if (sodSqft) out.sodSqft = sodSqft;
  const artificialTurfSqft = pickExplicitLandscapeMaterialSqft([
    /\bartificial\s+turf\b/,
    /\bartificial\s+grass\b/,
    /\bsynthetic\s+grass\b/,
    /\bturf\b/,
  ]);
  if (artificialTurfSqft) out.artificialTurfSqft = artificialTurfSqft;

  const paverSqft = pickSqftFromClauses([/\bpavers?\b/, /\bpatio\b.*\bpaver/]);
  if (paverSqft) out.paverSqft = paverSqft;

  const rockMulchSqft = pickSqftFromClauses([
    /\brock\b/,
    /\bmulch\b/,
    /\bgravel\b/,
  ]);
  if (rockMulchSqft) out.rockMulchSqft = rockMulchSqft;

  const landscapeSqft = pickSqftFromClauses([
    /\b(?:back|front|side)?\s*yard\b/,
    /\blandscap(?:e|ing)\b/,
    /\blawn\b/,
  ]);
  if (landscapeSqft) out.landscapeSqft = landscapeSqft;

  const wallDemoSqft = pickSqftFromClauses([
    /\b(?:wall|soffit|bulkhead)s?\b[^.;]{0,80}\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/,
    /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b[^.;]{0,80}\b(?:wall|soffit|bulkhead)s?\b/,
  ]);
  if (wallDemoSqft) out.wallDemoSqft = wallDemoSqft;
  const wallDemoLf = (() => {
    const patterns = [
      /\b(?:wall|soffit|bulkhead)s?\b[^.;]{0,80}\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/,
      /\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b[^.;]{0,80}\b(?:wall|soffit|bulkhead)s?\b/,
    ];
    for (const clause of clauses) {
      const matchedPattern = patterns.find(p => p.test(clause.toLowerCase()));
      if (!matchedPattern) continue;
      const near = pickLfNearPatternWithRegex(
        clause,
        matchedPattern,
        WALL_LF_RE
      );
      if (near) return near;
    }
    return null;
  })();
  if (wallDemoLf) out.wallDemoLf = wallDemoLf;

  // Floor / living area — prefer explicit schedule language over install/demo clauses.
  const livingAreaSqft = (() => {
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (
        !/\b(living\s+area|total\s+living|main\s+living|conditioned\s+(?:floor\s+)?area|building\s+areas?|total\s+(?:floor|heated)\s+area|heated\s+area)\b/i.test(
          c
        )
      ) {
        continue;
      }
      const q = firstQty(clause, SQFT_RE);
      if (q && q >= 200) return q;
    }
    return (
      pickSqftNearPattern(text, /\bliving\s+area\b/) ||
      pickSqftNearPattern(text, /\btotal\s+living\b/) ||
      pickSqftNearPattern(text, /\bmain\s+living\b/) ||
      null
    );
  })();

  const floorAreaSqft = (() => {
    if (livingAreaSqft) return livingAreaSqft;
    let max = 0;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (
        /\bbaseboards?\b|\btrim\b|\bmoulding\b|\bmolding\b|\bcasing\b/i.test(
          c
        ) &&
        !/\b(install|installation|lvp|laminate|vinyl|carpet|flooring|tile|demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(
          c
        )
      ) {
        continue;
      }
      if (
        /\bback\s*splash|backsplash|\bcountertop|\bpaint\b|\bshower\b/i.test(c)
      )
        continue;
      if (/\bwall\b|\bsoffit\b|\bbulkhead\b/i.test(c)) continue;
      if (isExteriorFlatworkClause(c)) continue;
      if (
        !/\b(demo|demolition|remove|removal|tear[\s-]?out|install|installation|laminate|tile|lvp|vinyl|flooring|floor|carpet)\b/i.test(
          c
        )
      )
        continue;
      const q = firstQty(clause, SQFT_RE);
      if (q && q > max) max = q;
    }
    return max > 0 ? max : null;
  })();
  if (floorAreaSqft) out.floorAreaSqft = floorAreaSqft;

  if (!out.storyCount) {
    const allowsStoryParse =
      templateKey === 'plumbing' ||
      templateKey === 'plumbing_service' ||
      templateKey === 'ground_up' ||
      templateKey === 'addition' ||
      templateKey === 'electrical' ||
      projectType === 'ground_up' ||
      projectType === 'addition';
    if (allowsStoryParse) {
      const stories = parseStoryCount(text);
      if (stories) out.storyCount = Math.min(3, stories);
    }
  }

  const deckSqft = (() => {
    // Prefer outdoor deck/patio language; never steal "concrete patio" flatwork SF.
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (
        /\bconcrete\b/.test(c) &&
        !/\bcovered\s+(?:patio|porch)\b|\bdeck(?:ing)?\b/.test(c)
      ) {
        continue;
      }
      if (
        !/\b(?:covered\s+patio|covered\s+porch|roof\s+deck|deck(?:ing)?|patio|porch)\b/.test(
          c
        )
      ) {
        continue;
      }
      const near =
        pickSqftNearPattern(clause, /\bcovered\s+patio\b/) ||
        pickSqftNearPattern(clause, /\bcovered\s+porch\b/) ||
        pickSqftNearPattern(clause, /\broof\s+deck\b/) ||
        pickSqftNearPattern(clause, /\bdeck(?:ing)?\b/) ||
        pickSqftNearPattern(clause, /\bpatio\b/) ||
        pickSqftNearPattern(clause, /\bporch\b/);
      if (near) return near;
    }
    return (
      pickSqftNearPattern(text, /\bcovered\s+patio\b/) ||
      pickSqftNearPattern(text, /\bcovered\s+porch\b/) ||
      pickSqftNearPattern(text, /\broof\s+deck\b/) ||
      pickSqftNearPattern(text, /\bdeck(?:ing)?\b/) ||
      null
    );
  })();
  if (deckSqft) out.deckSqft = deckSqft;

  const garageSqft = (() => {
    // Prefer the number immediately after "garage", not an earlier living-area SF in the same sentence.
    const after = text.match(
      /\bgarages?\b(?:\s+area)?\s*(?:is|:|of|=)?\s*([\d,]+(?:\.\d+)?)\s*sq\.?\s*ft/i
    );
    if (after) {
      const n = Number(String(after[1]).replace(/,/g, ''));
      if (Number.isFinite(n) && n >= 100) return n;
    }
    for (const clause of clauses) {
      if (!/\bgarages?\b/i.test(clause)) continue;
      const near = pickSqftNearPattern(clause, /\bgarages?\b/);
      if (near && near >= 100) return near;
    }
    return null;
  })();
  if (garageSqft) out.garageSqft = garageSqft;

  // Plan takeoff room inventory lines: "- Kitchen: 194.1 sqft"
  const kitchenFromRoomList = (() => {
    const m = text.match(
      /^\s*[-•]\s*Kitchen\s*:\s*([\d,]+(?:\.\d+)?)\s*sq\.?\s*ft/im
    );
    if (!m) return null;
    const n = Number(String(m[1]).replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  if (!out.kitchenFloorSqft && kitchenFromRoomList)
    out.kitchenFloorSqft = kitchenFromRoomList;

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

  if (
    /\broof(?:ing)?\b|\bshingles?\b|\btear[\s-]?off\b|\bgutters?\b|\bdownspouts?\b/.test(
      blob
    )
  ) {
    const pitchMatch = text.match(ROOF_PITCH_RE);
    if (pitchMatch) {
      const rise = pitchMatch[1] || pitchMatch[3];
      const run = pitchMatch[2] || pitchMatch[4];
      if (rise && run) out.roofPitch = `${rise}:${run}`;
    }
    const stories = parseStoryCount(text);
    if (stories) out.storyCount = stories;
    for (const clause of clauses) {
      const sq = firstQty(clause, SQUARES_RE);
      if (sq) {
        out.roofSquares = sq;
        break;
      }
      const sqft = firstQty(clause, SQFT_RE);
      if (sqft && /\broof|\bshingle/.test(clause.toLowerCase())) {
        out.roofAreaSqft = sqft;
        out.roofSquares = Math.round((sqft / 100) * 10) / 10;
        break;
      }
    }
    if (!out.roofAreaSqft) {
      const sqft = pickSqftNearPattern(text, /\broof|\bshingle/);
      if (sqft) out.roofAreaSqft = sqft;
    }
    if (!out.roofSquares) {
      const sq = firstQty(text, SQUARES_RE);
      if (sq) out.roofSquares = sq;
      else {
        const sqft = pickSqftNearPattern(text, /\broof|\bshingle/);
        if (sqft) {
          out.roofAreaSqft = sqft;
          out.roofSquares = Math.round((sqft / 100) * 10) / 10;
        }
      }
    }

    const roofSqftFields = [
      [
        'roofIceWaterShieldSqft',
        /\bice\s*(?:&|and)\s*water\s*(?:shield|membrane)?\b/,
      ],
      [
        'roofDeckingReplacementSqft',
        /\b(?:roof\s*)?deck(?:ing)?\b|\bdeck\s*replacement\b/,
      ],
      [
        'roofRepairAffectedSqft',
        /\broof(?:ing)?\s+repairs?\b|\brepair\s+affected\b/,
      ],
    ] as const;
    for (const [key, pattern] of roofSqftFields) {
      const quantity = pickRoofQuantityInClause(text, pattern, SQFT_RE);
      if (quantity) out[key] = quantity;
    }

    const roofLfFields = [
      ['roofDripEdgeLf', /\bdrip\s*edge\b/],
      ['roofRidgeCapLf', /\bridge\s*cap\b/],
      ['roofValleyFlashingLf', /\bvalley\s*flashing\b/],
      ['roofStepFlashingLf', /\bstep\s*flashing\b/],
      ['roofWallFlashingLf', /\bwall\s*flashing\b/],
      ['roofGutterLf', /\bgutters?\b(?!\s*(?:and|&)\s*downspouts?)/],
    ] as const;
    for (const [key, pattern] of roofLfFields) {
      const quantity = pickRoofQuantityInClause(text, pattern, LF_RE);
      if (quantity) out[key] = quantity;
    }

    const roofCountFields = [
      ['roofVentCount', /\broof\s+vents?\b/],
      ['roofTurbineVentCount', /\bturbine\s+vents?\b/],
      ['roofPipeBootCount', /\bpipe\s+boots?\b/],
      ['roofChimneyFlashingCount', /\bchimney\s+flashing\b/],
      ['roofSkylightCount', /\bskylight(?:\s+flashing)?\b/],
      ['roofPenetrationCount', /\b(?:other\s+)?roof\s+penetrations?\b/],
    ] as const;
    for (const [key, pattern] of roofCountFields) {
      const quantity = pickCountNearPattern(text, pattern);
      if (quantity) out[key] = Math.round(quantity);
    }
    const downspoutMatch = text.match(/(\d[\d,]*(?:\.\d+)?)\s+downspouts?\b/i);
    if (downspoutMatch) {
      const quantity = Number(String(downspoutMatch[1]).replace(/,/g, ''));
      if (Number.isFinite(quantity) && quantity > 0) {
        out.roofDownspoutCount = Math.round(quantity);
      }
    }
    const ridgeVentCount = pickCountNearPattern(text, /\bridge\s*vent\b/);
    if (ridgeVentCount) out.roofRidgeVentLf = Math.round(ridgeVentCount);
  }

  const concreteDemoSqft = (() => {
    let max = 0;
    for (const clause of clauses) {
      if (
        !isDemoClause(clause) ||
        isDirtExcavationClause(clause) ||
        !isExteriorFlatworkClause(clause)
      )
        continue;
      const q = firstQty(clause, SQFT_RE);
      if (q && q > max) max = q;
    }
    return max > 0 ? max : null;
  })();
  if (concreteDemoSqft) out.concreteDemoSqft = concreteDemoSqft;

  for (const clause of clauses) {
    if (
      !isDemoClause(clause) ||
      isDirtExcavationClause(clause) ||
      !/\bconcrete\b|\bslab\b|\bpatio\b|\bdriveway\b|\bsidewalk\b|\bwalkway\b/i.test(
        clause
      )
    ) {
      continue;
    }
    const depth = clause.match(DEPTH_INCHES_RE)?.[1]
      ? Number(clause.match(DEPTH_INCHES_RE)?.[1])
      : null;
    if (depth == null || !Number.isFinite(depth)) continue;
    out.concreteDemoThicknessBand =
      depth >= 7
        ? 'structural_7_plus'
        : depth >= 5
          ? 'heavy_5_6'
          : depth >= 4
            ? 'standard_4'
            : 'thin_2_3';
    if (
      /\b(?:rebar|reinforced|reinforcement|welded\s+wire|wire\s+mesh)\b/i.test(
        clause
      )
    ) {
      out.concreteDemoReinforced = true;
    }
    if (
      /\b(?:limited|no|without)\s+(?:machine|equipment)\s+access\b|\bhand[\s-]?demo\b|\bnarrow\s+access\b|\bno\s+machine\s+access\b/i.test(
        clause
      )
    ) {
      out.concreteDemoLimitedAccess = true;
    }
    break;
  }
  if (
    /\b(?:rebar|reinforced|reinforcement|welded\s+wire|wire\s+mesh)\b/i.test(
      text
    ) &&
    out.concreteDemoSqft
  ) {
    out.concreteDemoReinforced = true;
  }
  if (
    /\b(?:limited|no|without)\s+(?:machine|equipment)\s+access\b|\bhand[\s-]?demo\b|\bnarrow\s+access\b|\bno\s+machine\s+access\b/i.test(
      text
    ) &&
    out.concreteDemoSqft
  ) {
    out.concreteDemoLimitedAccess = true;
  }

  // Do not map covered patio / porch into concrete — those belong on deckSqft.
  const concreteSqft = (() => {
    let max = 0;
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      if (/\bpavers?\b|\bsod\b|\bturf\b|\brock\b|\bmulch\b|\bgravel\b/.test(c))
        continue;
      if (isDemoClause(clause) && isExteriorFlatworkClause(clause)) continue;
      if (
        !/\bconcrete\b|\bflat[\s-]?work\b|\bslab\b|\bdriveway\b|\bwalkway\b|\bsidewalk\b/.test(
          c
        )
      ) {
        continue;
      }
      const near =
        pickSqftNearPattern(
          clause,
          /\bconcrete\b|\bflat[\s-]?work\b|\bslab\b|\bdriveway\b|\bwalkway\b|\bsidewalk\b/
        ) || firstQty(clause, SQFT_RE);
      if (near && near > max) max = near;
    }
    return max > 0 ? max : null;
  })();
  if (concreteSqft) out.concreteSqft = concreteSqft;

  for (const clause of clauses) {
    if (!/\bconcrete\b|\bfoundation\b|\bslab\b/.test(clause.toLowerCase()))
      continue;
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

  if (
    /\b(?:dirt|soil|earth|subgrade)\b/.test(blob) &&
    /\b(?:excavat(?:e|ion)|remove|dig)\b/.test(blob)
  ) {
    const area = firstQty(text, SQFT_RE);
    const depthMatch = text.match(DEPTH_INCHES_RE);
    const depth = depthMatch ? Number(depthMatch[1]) : null;
    if (area && depth && depth > 0) {
      out.excavationAreaSqft = area;
      out.excavationDepthInches = depth;
      out.excavationCy = Math.round(((area * (depth / 12)) / 27) * 100) / 100;
    }
  }
  for (const clause of clauses) {
    if (
      !isDirtExcavationClause(clause) &&
      !(
        /\b(?:dirt|soil|earth|subgrade)\b/.test(blob) &&
        /\b(?:excavat(?:e|ion)|remove|dig)\b/.test(blob)
      )
    )
      continue;
    const area = firstQty(clause, SQFT_RE) || firstQty(text, SQFT_RE);
    const depthMatch =
      clause.match(DEPTH_INCHES_RE) || text.match(DEPTH_INCHES_RE);
    const depth = depthMatch?.[1] ? Number(depthMatch[1]) : null;
    if (area && depth && depth > 0) {
      out.excavationAreaSqft = area;
      out.excavationDepthInches = depth;
      if (!out.excavationCy) {
        out.excavationCy = Math.round(((area * (depth / 12)) / 27) * 100) / 100;
      }
      break;
    }
  }

  for (const clause of clauses) {
    if (!/\bmulch\b|\brock\b|\bgravel\b|\bstone\b/.test(clause.toLowerCase()))
      continue;
    const t = firstQty(clause, TON_RE);
    if (t) {
      out.landscapeTons = t;
      break;
    }
  }

  if (out.bathroomFloorSqft) out.sqft = out.bathroomFloorSqft;
  if (out.baseboardLf) out.lf = out.baseboardLf;

  const electrical = parseElectricalMeasurementsFromNotes(text);
  const electricalItemQuantities = electrical.itemQuantities || {};
  for (const [key, value] of Object.entries(electrical)) {
    if (key === 'itemQuantities' || value == null) continue;
    (out as Record<string, unknown>)[key] = value;
  }

  const itemAllowances = parseScopeItemAllowancesFromNotes(text, ctx);
  const itemRatePricing = parseScopeItemRatePricingFromNotes(text, out, ctx);
  const itemQuantities = { ...itemAllowances, ...itemRatePricing };
  for (const [itemId, quantity] of Object.entries(electricalItemQuantities)) {
    if (!itemQuantities[itemId]) itemQuantities[itemId] = quantity;
  }
  if (wallDemoSqft && !itemQuantities.wall_demo) {
    itemQuantities.wall_demo = {
      quantity: wallDemoSqft,
      unit: 'sqft',
      quantitySource: 'notes',
    };
  }
  if (wallDemoLf && !itemQuantities['walls_moving__remove']) {
    itemQuantities['walls_moving__remove'] = {
      quantity: wallDemoLf,
      unit: 'lf',
      quantitySource: 'notes',
    };
  }
  if (ctx.templateKey === 'flooring' && itemQuantities.floor_demo) {
    delete itemQuantities.demo;
  }
  if (Object.keys(itemQuantities).length) {
    return { ...out, itemQuantities };
  }

  return out;
}

const UNPRICED_NOTE_RE =
  /\b(not\s+priced\s+yet|not\s+priced|unpriced|no\s+pric(?:e|ing))\b/i;

/**
 * Single source of truth for stale-pricing cleanup during hydration. When the
 * notes say an item is unpriced, drop any carried-over rate splits (and money
 * totals) for every item the fresh notes parse did NOT price. Generalized
 * across all trades so material/labor splits never linger from a prior parse.
 */
export function clearStalePricingWhenNotesUnpriced(
  itemQuantities: Record<
    string,
    { quantity: unknown; unit?: string; quantitySource?: unknown }
  >,
  notes: string | null | undefined,
  freshParsedItemQuantities?: Record<string, { unit?: string }> | null
): void {
  if (!itemQuantities || !UNPRICED_NOTE_RE.test(String(notes || ''))) return;
  const fresh = freshParsedItemQuantities || {};
  const bases = new Set<string>();
  for (const id of Object.keys(itemQuantities)) {
    bases.add(id.replace(/__(?:material|labor|allowance)$/, ''));
  }
  const isMoneyUnit = (unit?: string) =>
    unit === 'allowance' || unit === 'lump_sum';
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
