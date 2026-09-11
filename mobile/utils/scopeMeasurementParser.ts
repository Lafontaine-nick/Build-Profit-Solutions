/**
 * Client mirror of backend scopeMeasurementParser.js
 */

import type { ScopeItemQuantity } from '@/utils/estimateAiDraft';
import { parseScopeItemAllowancesFromNotes } from '@/utils/scopeAllowanceParser';
import { applyBathroomPlanningMeasurements } from '@/utils/bathroomPlanningMeasurements';
import { applyConcretePlanningMeasurements } from '@/utils/concretePlanningMeasurements';
import { applyRoofingPlanningMeasurements } from '@/utils/roofingPlanningMeasurements';
import { notesImplyRoofTearOffAndInstall } from '@/utils/scopeItemNoteHints';
import { parseScopeItemRatePricingFromNotes } from '@/utils/scopeRatePricingParser';
import { isGarageConversionJob } from '@/utils/additionConversionPlanning';
import { parseElectricalMeasurementsFromNotes } from '@/utils/subcontractorTrade/electricalPlanConvergence';

const AIR_SEALING_SYNONYM_RE =
  /\b(?:air[\s-]?seal(?:ing)?|draft[\s-]?seal(?:ing)?|gap[\s-]?seal(?:ing)?|penetration[\s-]?seal(?:ing)?|gap[\s-]?penetrations?|seal(?:ing)?\s+(?:air\s+)?gaps?|seal(?:ing)?\s+(?:air\s+)?penetrations?)\b/i;

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
  countertopLf?: number;
  cabinetLf?: number;
  wallDemoSqft?: number;
  wallDemoLf?: number;
  showerWallTileSqft?: number;
  showerFloorTileSqft?: number;
  wallPaintSqft?: number;
  ceilingPaintSqft?: number;
  exteriorPaintSqft?: number;
  interiorDoorCount?: number;
  windowCount?: number;
  exteriorDoorCount?: number;
  slidingDoorCount?: number;
  garageDoorSingleCount?: number;
  garageDoorDoubleCount?: number;
  garageDoorRvCount?: number;
  /** True only when notes explicitly call for reframing or a new/modified opening. */
  reframingRequested?: boolean;
  framingOpeningCount?: number;
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
  airSealingIncluded?: boolean;
  airSealingSqft?: number;
  landscapeSqft?: number;
  artificialTurfSqft?: number;
  sodSqft?: number;
  paverSqft?: number;
  rockMulchSqft?: number;
  landscapeTons?: number;
  roofAreaSqft?: number;
  roofIceWaterShieldSqft?: number;
  roofDeckingReplacementSqft?: number;
  roofRepairAffectedSqft?: number;
  roofSquares?: number;
  roofDripEdgeLf?: number;
  roofRidgeCapLf?: number;
  roofValleyFlashingLf?: number;
  roofStepFlashingLf?: number;
  roofWallFlashingLf?: number;
  roofRidgeVentLf?: number;
  roofVentCount?: number;
  roofTurbineVentCount?: number;
  roofPipeBootCount?: number;
  roofChimneyFlashingCount?: number;
  roofSkylightCount?: number;
  roofPenetrationCount?: number;
  roofGutterLf?: number;
  roofDownspoutCount?: number;
  roofPitch?: string;
  storyCount?: number;
  roofingPlanningKeys?: Array<
    'roofDripEdgeLf' | 'roofIceWaterShieldSqft' | 'roofRidgeCapLf'
  >;
  hvacSystemCount?: number;
  hvacSystemTons?: number;
  hvacSupplyRegisterCount?: number;
  hvacReturnGrilleCount?: number;
  hvacServiceCallCount?: number;
  hvacEquipmentReplacementCount?: number;
  hvacRefrigerantCount?: number;
  hvacThermostatCount?: number;
  hvacDuctworkLf?: number;
  hvacVentilationCount?: number;
  hvacPermitCount?: number;
  hvacCleanupCount?: number;
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
const SQUARES_RE = /(\d[\d,]*(?:\.\d+)?)[\s-]*squares?\b/gi;
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

function kitchenFlooringScopeExcluded(text: string): boolean {
  return (
    /\b(?:customer|owner|homeowner|client)\s+(?:is\s+)?(?:handling|doing|providing|taking\s+care\s+of)\s+(?:the\s+)?floor(?:ing)?\b/i.test(
      text
    ) ||
    /\bfloor(?:ing)?\s+by\s+others\b/i.test(text) ||
    /\bno\s+kitchen\s+floor\b/i.test(text) ||
    /\bkitchen\s+floor\s+(?:by\s+others|excluded|not\s+included|n[\/.]?a)\b/i.test(
      text
    )
  );
}

/** Kitchen floor sqft only when notes explicitly scope floor work — never from backsplash proximity. */
function parseKitchenFloorSqftFromClauses(
  clauses: string[],
  text: string
): number | null {
  if (kitchenFlooringScopeExcluded(text)) return null;
  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    if (
      /\bno\s+kitchen\s+floor\b/.test(lower) ||
      /\bfloor(?:ing)?\s+by\s+others\b/.test(lower) ||
      /\bhandling\s+floor(?:ing)?\b/.test(lower)
    ) {
      continue;
    }
    if (/\bback\s*splash|backsplash/.test(lower)) continue;

    if (/\bkitchen\s+floor\b/.test(lower)) {
      const near = pickSqftNearPattern(clause, /\bkitchen\s+floor\b/);
      if (near) return near;
      const q = firstQty(clause, SQFT_RE);
      if (q) return q;
    }

    if (
      /\bkitchen\b/.test(lower) &&
      /\b(?:floor(?:ing)?|tile\s+floor|lvp|laminate|vinyl|carpet)\b/.test(
        lower
      ) &&
      /\b(?:demo|demolition|remove|removal|tear[\s-]?out|install|installation|replace|new)\b/.test(
        lower
      )
    ) {
      const near = pickSqftNearPattern(
        clause,
        /\bkitchen\b.*\b(?:floor(?:ing)?|tile\s+floor|lvp|laminate|vinyl|carpet)\b/
      );
      if (near) return near;
      const q = firstQty(clause, SQFT_RE);
      if (q) return q;
    }
  }
  return null;
}

/** Home living SF from "2,800 sqft two story home" — not garage area. */
function inferHomeFloorAreaSqftFromNotes(text: string): number | null {
  const patterns = [
    /\b([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+feet)\b[^.]{0,96}\b(?:two[\s-]?story\s+|single[\s-]?story\s+)?(?:home|house)\b/i,
    /\b(?:new\s+)?(?:two[\s-]?story\s+|single[\s-]?story\s+)?(?:home|house)\b[^.]{0,48}\b(?:of\s+)?([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft)\b/i,
    /\b([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft)\b[^.]{0,48}\b(?:two[\s-]?story|new\s+build|new\s+construction)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const qty = Number(String(match[1]).replace(/,/g, ''));
    if (Number.isFinite(qty) && qty >= 200) return qty;
  }
  return null;
}

export type ParsedInsulationAssembly = {
  location: 'exterior_wall' | 'attic_ceiling' | 'floor';
  materialType: string;
  rValue: string;
  sqft: number;
  battFacing?: 'faced' | 'unfaced';
};

/** Preserve location-specific insulation assemblies from natural-language notes. */
export function parseInsulationAssembliesFromNotes(
  text: string
): ParsedInsulationAssembly[] {
  const assemblies: ParsedInsulationAssembly[] = [];
  const clauses = String(text || '').split(/[.;\n]+|,(?!\d)/);
  const quantity = (clause: string) => {
    const match = clause.match(
      /([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))/i
    );
    return match ? Number(match[1].replace(/,/g, '')) : 0;
  };
  const material = (clause: string) => {
    if (/\bblown[-\s]?in\b/i.test(clause)) return 'Blown-in';
    if (/\bspray\s+foam\b/i.test(clause)) return 'Spray foam';
    if (/\brigid\s+foam\b/i.test(clause)) return 'Rigid foam board';
    if (/\bcellulose\b/i.test(clause)) return 'Cellulose';
    if (/\bmineral\s+wool\b/i.test(clause)) return 'Mineral wool';
    if (/\b(?:fiberglass\s+)?batt\b/i.test(clause)) return 'Batt';
    return 'Batt';
  };
  const rValue = (clause: string) =>
    clause.match(/\bR[-\s]?(\d{2,3})\b/i)?.[0] || '';
  const battFacing = (clause: string) => {
    if (/\bunfaced\b/i.test(clause)) return 'unfaced' as const;
    if (
      /\bfaced\s+batt\b|\bbatt\s+faced\b|\bkraft[\s-]?faced\b|\bfoil[\s-]?faced\b/i.test(
        clause
      )
    ) {
      return 'faced' as const;
    }
    return undefined;
  };
  const add = (
    location: ParsedInsulationAssembly['location'],
    pattern: RegExp,
    clause: string
  ) => {
    if (!pattern.test(clause)) return;
    const sqft = quantity(clause);
    if (!(sqft > 0)) return;
    assemblies.push({
      location,
      materialType: material(clause),
      rValue: rValue(clause),
      sqft,
      ...(battFacing(clause)
        ? { battFacing: battFacing(clause) }
        : {}),
    });
  };
  for (const clause of clauses) {
    add('exterior_wall', /\b(?:exterior|outside)\s+walls?\b/i, clause);
    add('attic_ceiling', /\b(?:attic|ceiling)(?:\s+area)?\b/i, clause);
    add('floor', /\bfloor(?:\s+area)?\b/i, clause);
  }
  return assemblies;
}

function clauseHomeSqftBeforeGarage(clause: string): number | null {
  const match = clause.match(
    /\b([\d,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft)\b[^.]{0,96}\b(?:home|house)\b[^.]{0,96}\b(?:\d[\s-]?car\s+)?garages?\b/i
  );
  if (!match) return null;
  const qty = Number(String(match[1]).replace(/,/g, ''));
  return Number.isFinite(qty) && qty >= 200 ? qty : null;
}

/** Conditioned SF for convert-garage jobs — "about 400 sqft", not 2-car planning defaults. */
export function inferGarageConversionFloorSqftFromNotes(
  notes: string
): number | null {
  const text = String(notes || '').trim();
  if (
    !/\b(garage\s+conversion|convert(?:ing)?\s+(?:\d[\d,]*\s*[-\s]?car\s*)?garage)\b/i.test(
      text
    )
  ) {
    return null;
  }
  const about = text.match(
    /\b(?:about|roughly|approximately|around)\s*([\d,]+(?:\.\d+)?)\s*sq\.?\s*ft\b/i
  );
  if (about) {
    const n = Number(String(about[1]).replace(/,/g, ''));
    if (Number.isFinite(n) && n >= 80 && n <= 5000) return n;
  }
  const clauses = splitNoteClauses(text);
  for (const clause of clauses) {
    if (
      !/\b(?:convert(?:ing)?|garage|office|studio|sqft|sq\s*ft)\b/i.test(clause)
    ) {
      continue;
    }
    const near =
      pickSqftNearPattern(clause, /\bconvert(?:ing)?\b/) ||
      pickSqftNearPattern(clause, /\bgarage\b/) ||
      pickSqftNearPattern(clause, /\b(?:about|roughly|approximately|around)\b/);
    if (near && near >= 80 && near <= 5000) return near;
    const q = firstQty(clause, SQFT_RE);
    if (q && q >= 80 && q <= 5000) return q;
  }
  return null;
}

/** Planning garage footprint when notes mention car count but not garage SF. */
export function inferGarageSqftFromCarCount(notes: string): number | null {
  const lower = String(notes || '').toLowerCase();
  if (/\b(?:3|three)[\s-]?car\s+garage\b/.test(lower)) return 700;
  if (
    /\b(?:2|two)[\s-]?car\s+garage\b/.test(lower) ||
    /\battached\s+(?:2|two)[\s-]?car\s+garage\b/.test(lower) ||
    /\b(?:2|two)[\s-]?car\s+attached\s+garage\b/.test(lower)
  ) {
    return 500;
  }
  if (/\b(?:1|one)[\s-]?car\s+garage\b/.test(lower)) return 280;
  return null;
}

/** False when notes describe keeping the existing door or converting the garage shell. */
export function shouldInferGarageDoorInstallFromNotes(notes: string): boolean {
  const lower = String(notes || '').toLowerCase();
  const keepExisting =
    /\b(?:keep(?:ing)?\s+(?:the\s+)?(?:existing\s+)?garage\s+door|existing\s+garage\s+door\s+(?:for\s+now|stays?|remain(?:s|ing)?))\b/.test(
      lower
    );
  const conversion =
    /\b(garage\s+conversion|convert(?:ing)?\s+(?:\d[\d,]*\s*[-\s]?car\s*)?garage)\b/.test(
      lower
    );
  const newGarageDoorIntent =
    /\b(?:new|install|replace|add)\b[^.]{0,40}\bgarage\s+doors?\b/.test(lower);
  if (keepExisting || (conversion && !newGarageDoorIntent)) return false;
  return true;
}

export function parseGarageDoorCountsFromNotes(notes: string): Partial<{
  garageDoorSingleCount: number;
  garageDoorDoubleCount: number;
  garageDoorRvCount: number;
}> {
  if (!shouldInferGarageDoorInstallFromNotes(notes)) {
    return {};
  }
  const lower = String(notes || '').toLowerCase();
  if (/\b(?:3|three)[\s-]?car\s+garage\b/.test(lower)) {
    return { garageDoorDoubleCount: 1, garageDoorSingleCount: 1 };
  }
  if (
    /\b(?:2|two)[\s-]?car\s+garage\b/.test(lower) ||
    /\battached\s+(?:2|two)[\s-]?car\s+garage\b/.test(lower) ||
    /\b(?:2|two)[\s-]?car\s+attached\s+garage\b/.test(lower)
  ) {
    return { garageDoorDoubleCount: 1 };
  }
  if (/\b(?:1|one)[\s-]?car\s+garage\b/.test(lower)) {
    return { garageDoorSingleCount: 1 };
  }
  return {};
}

function pickSqftNearPattern(text: string, pattern: RegExp): number | null {
  const source = String(text || '');
  const lower = source.toLowerCase();
  const patternRe = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  );
  const patternPositions: number[] = [];
  let patternMatch: RegExpExecArray | null;
  while ((patternMatch = patternRe.exec(lower)) !== null) {
    patternPositions.push(patternMatch.index);
  }
  if (!patternPositions.length) return null;

  const sqftRe = new RegExp(SQFT_RE.source, SQFT_RE.flags);
  let bestQty: number | null = null;
  let bestDistance = Infinity;
  let m: RegExpExecArray | null;
  while ((m = sqftRe.exec(source)) !== null) {
    const qty = parseQty(m);
    if (!qty) continue;
    const qtyIndex = m.index;
    for (const patternIndex of patternPositions) {
      const distance = Math.abs(qtyIndex - patternIndex);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestQty = qty;
      }
    }
  }
  if (bestDistance > 50) return null;
  return bestQty;
}

function pickLfNearPattern(text: string, pattern: RegExp): number | null {
  return pickLfNearPatternWithRegex(text, pattern, LF_RE);
}

function pickCountNearPattern(text: string, pattern: RegExp): number | null {
  const quantityRe = /(\d[\d,]*(?:\.\d+)?)\s*(?:ea|each|count)?\b/gi;
  for (const clause of text.split(/[.;,\n]+/)) {
    if (!pattern.test(clause.toLowerCase())) continue;
    if (clauseLooksLikeLumpSumAllowance(clause)) continue;
    let match: RegExpExecArray | null;
    while ((match = quantityRe.exec(clause)) !== null) {
      const index = match.index ?? 0;
      const before = clause.slice(Math.max(0, index - 1), index);
      if (before === '$') continue;
      const quantity = Number(String(match[1]).replace(/,/g, ''));
      if (Number.isFinite(quantity) && quantity > 0) {
        return quantity;
      }
    }
  }
  return null;
}

const COUNT_TOKEN_RE =
  /\b(\d[\d,]*(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;

function parseCountToken(value: string): number | null {
  const words: Record<string, number> = {
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
  };
  const normalized = value.toLowerCase();
  const count = words[normalized] ?? Number(normalized.replace(/,/g, ''));
  return Number.isFinite(count) && count > 0 && count <= 200
    ? Math.round(count)
    : null;
}

function pickOpeningCount(
  clauses: string[],
  text: string,
  pattern: RegExp
): number | null {
  const countNearestToPattern = (value: string): number | null => {
    const patternMatch = pattern.exec(value.toLowerCase());
    if (!patternMatch || patternMatch.index == null) return null;
    const countRe = new RegExp(COUNT_TOKEN_RE.source, 'gi');
    let match: RegExpExecArray | null;
    let nearest: { distance: number; count: number } | null = null;
    while ((match = countRe.exec(value)) !== null) {
      const count = parseCountToken(match[1]);
      if (count == null) continue;
      const distance = Math.abs(match.index - patternMatch.index);
      if (!nearest || distance < nearest.distance) {
        nearest = { distance, count };
      }
    }
    return nearest && nearest.distance <= 40 ? nearest.count : null;
  };

  for (const clause of clauses) {
    const count = countNearestToPattern(clause);
    if (count != null) return count;
  }
  return countNearestToPattern(text);
}

function firstHvacCount(text: string, pattern: RegExp | string): number | null {
  const patternSource = pattern instanceof RegExp ? pattern.source : pattern;
  const match = text.match(
    new RegExp(
      `(?:^|\\b)(\\d[\\d,]*(?:\\.\\d+)?|one|two|three|four|five)\\s*(?:ea|each|count)?\\s*(?:${patternSource})`,
      'i'
    )
  );
  if (!match) return null;
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  };
  const count =
    words[match[1].toLowerCase()] || Number(match[1].replace(/,/g, ''));
  return Number.isFinite(count) && count > 0 ? count : null;
}

function clauseLooksLikeLumpSumAllowance(clause: string): boolean {
  return /\ballowance\b/i.test(clause) && /\$\s*[\d,]+/.test(clause);
}

function pickRoofQuantityInClause(
  text: string,
  pattern: RegExp,
  quantityRe: RegExp
): number | null {
  for (const clause of text.split(/[.;,\n]+/)) {
    if (!pattern.test(clause.toLowerCase())) continue;
    if (clauseLooksLikeLumpSumAllowance(clause)) continue;
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

function parseLabeledInteriorFloorAreaTotal(text: string): number | null {
  const values: number[] = [];
  const floorAreaRe =
    /\b(?:main|upper|lower|first|second|third)\s+floor\b[^.;\n]{0,18}?(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet)|ft²)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = floorAreaRe.exec(text)) !== null) {
    const value = Number(match[1].replace(/,/g, ''));
    if (Number.isFinite(value) && value > 0) values.push(value);
  }
  const homeInteriorMatch =
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet)|ft²)\s+(?:existing\s+)?home\s+interior\b/i.exec(
      text,
    );
  if (homeInteriorMatch) {
    const value = Number(homeInteriorMatch[1].replace(/,/g, ''));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return values.length >= 2
    ? values.reduce((sum, value) => sum + value, 0)
    : null;
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
    const excludesCabinetPaint =
      /\b(?:no|not|without|exclude(?:d)?|excluding)\s+(?:any\s+)?(?:paint(?:ing)?|refinish(?:ing)?)\s+(?:of\s+)?(?:the\s+)?(?:kitchen\s+)?cabinets?\b/i.test(
        text
      ) ||
      /\b(?:kitchen\s+)?cabinets?\b[^.;]{0,100}\b(?:exclude|excluded|not included)\b/i.test(
        text
      );
    if (
      !excludesCabinetPaint &&
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
  const pickInsulationArea = (locationPattern: string) => {
    const quantityPattern =
      /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|square\s+feet?)\s+(?:of\s+)?/i;
    for (const clause of clauses) {
      const match = clause.match(
        new RegExp(`${quantityPattern.source}${locationPattern}`, 'i')
      );
      if (match) return Number(match[1].replace(/,/g, ''));
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

  const kitchenFloor = parseKitchenFloorSqftFromClauses(clauses, text);
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
    }
    return pickSqftNearPattern(
      text,
      /\bcountertops?|\bcounters\b|\bquartz\b|\bgranite\b/
    );
  })();
  if (countertopSqft) out.countertopSqft = countertopSqft;
  const countertopLf = pickLfNearPattern(
    text,
    /\bcountertops?|\bcounters\b/i
  );
  if (countertopLf) out.countertopLf = countertopLf;

  const cabinetLf = (() => {
    // Use the quantity nearest the cabinet keyword. A shared sentence can
    // mention countertops first, and clause-level first-quantity parsing
    // incorrectly copied the countertop LF onto cabinets.
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
  const combinedPaintLanguage =
    /\bwalls?\s*(?:and|&)\s*ceilings?\b|\bceilings?\s*(?:and|&)\s*walls?\b/i.test(
      blob
    );
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
      const q = firstQty(clause, SQFT_RE);
      if (q) largestRelevantPaintSqft = Math.max(largestRelevantPaintSqft, q);
    }
    const labeledFloorAreaTotal = parseLabeledInteriorFloorAreaTotal(
      clauses.filter(clause => !/\bexterior\b/i.test(clause)).join(' ')
    );
    if (labeledFloorAreaTotal != null) {
      largestRelevantPaintSqft = Math.max(
        largestRelevantPaintSqft,
        labeledFloorAreaTotal
      );
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
    if (largestRelevantPaintSqft > 0) return largestRelevantPaintSqft;
    if (combinedPaintLanguage) return 0;
    return pickSqftFromClauses(PAINT_SQFT_PATTERNS) || 0;
  })();
  if (paintSqft) out.wallPaintSqft = paintSqft;

  const ceilingPaintSqft = combinedPaintLanguage
    ? null
    : pickSqftFromClauses([/\bceilings?\b/]);
  if (ceilingPaintSqft) out.ceilingPaintSqft = ceilingPaintSqft;

  const explicitWallPaintSqft = (() => {
    const source = String(text || '');
    const lower = source.toLowerCase();
    const sqftRe = new RegExp(SQFT_RE.source, SQFT_RE.flags);
    let match: RegExpExecArray | null;
    while ((match = sqftRe.exec(source)) !== null) {
      const qty = parseQty(match);
      if (!qty) continue;
      const before = lower.slice(Math.max(0, match.index - 45), match.index);
      const after = lower.slice(
        match.index,
        match.index + match[0].length + 25
      );
      if (
        /\bshower\s+wall\b|\bshower\s+tile\b|\btile\s+shower\b/.test(before)
      ) {
        continue;
      }
      if (/\bwalls?\b/.test(before) || /\bwalls?\b/.test(after)) {
        return qty;
      }
    }
    return null;
  })();
  const explicitCeilingPaintSqft = combinedPaintLanguage
    ? null
    : pickSqftNearPattern(text, /\bceilings?\b/);
  const interiorPaintBlob = clauses
    .filter(clause => !/\bexterior\b/i.test(clause))
    .join(' ');
  const floorAreaPaintLanguage =
    /\b(?:house|home|floor\s+area|living\s+area)\b[^.;]{0,35}\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b/i.test(
      interiorPaintBlob
    ) ||
    /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet))\b[^.;]{0,35}\b(?:house|home|floor\s+area|living\s+area)\b/i.test(
      interiorPaintBlob
    ) ||
    /\b(?:main|upper|lower|first|second|third)\s+floor\b[^.;\n]{0,18}\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|square\s+(?:foot|feet)|ft²)\b/i.test(
      interiorPaintBlob
    );
  const labeledFloorAreaTotal = parseLabeledInteriorFloorAreaTotal(
    clauses.filter(clause => !/\bexterior\b/i.test(clause)).join(' ')
  );
  const combinedSurface = paintSqft
    ? floorAreaPaintLanguage
      ? Math.round((labeledFloorAreaTotal ?? paintSqft) * 3.2)
      : paintSqft
    : 0;

  if (combinedPaintLanguage && floorAreaPaintLanguage && paintSqft) {
    // When the notes list floor areas, use that interior total as the paint
    // basis. A later exterior wall-area quantity must not become the interior
    // paint reference.
    const floorAreaReference = labeledFloorAreaTotal ?? paintSqft;
    const ceilingSurface = Math.round(floorAreaReference);
    const wallSurface = Math.max(0, combinedSurface - ceilingSurface);
    out.paintAreaSqft = floorAreaReference;
    out.originalPaintAreaReferenceSqft = floorAreaReference;
    out.paintAreaNeedsConfirmation = true;
    out.paintAreaBasis = 'floor_area';
    out.paintPricingMethod = 'separate';
    out.combinedPaintableAreaSqft = combinedSurface;
    if (wallSurface > 0) out.wallPaintSqft = wallSurface;
    if (ceilingSurface > 0) out.ceilingPaintSqft = ceilingSurface;
  } else if (
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
    if (combinedPaintLanguage) {
      out.paintPricingMethod = 'combined';
      out.combinedPaintableAreaSqft = floorAreaPaintLanguage
        ? Math.round(combinedSurface)
        : combinedSurface;
      out.paintAreaNeedsConfirmation = floorAreaPaintLanguage;
      out.paintAreaBasis = floorAreaPaintLanguage ? 'floor_area' : 'combined';
    }
    delete out.wallPaintSqft;
    delete out.ceilingPaintSqft;
  }
  if (
    templateKey === 'room_remodel' &&
    combinedPaintLanguage &&
    !explicitWallPaintSqft &&
    !explicitCeilingPaintSqft
  ) {
    delete out.wallPaintSqft;
    delete out.ceilingPaintSqft;
    delete out.paintAreaSqft;
    delete out.originalPaintAreaReferenceSqft;
    delete out.combinedPaintableAreaSqft;
    delete out.paintAreaNeedsConfirmation;
    delete out.paintAreaBasis;
    delete out.paintPricingMethod;
  }

  const interiorDoorCountMatch = blob.match(
    /(\d[\d,]*)\s+(?:interior\s+)?doors?\b/i
  );
  if (interiorDoorCountMatch) {
    const count = Number(interiorDoorCountMatch[1].replace(/,/g, ''));
    if (Number.isFinite(count) && count > 0) out.interiorDoorCount = count;
  }

  // Windows & doors notes use explicit counts only. Generic "doors" is not
  // treated as an exterior door because it may describe interior painting.
  const windowCount = pickOpeningCount(
    clauses,
    text,
    /\b(?:windows?|window\s+units?|fenestration)\b/i
  );
  const exteriorDoorCount = pickOpeningCount(
    clauses,
    text,
    /\b(?:exterior|entry|front|back|side|service|swing|hinged|egress)\s+(?:swing\s+|entry\s+)?doors?\b/i
  );
  const slidingDoorCount = pickOpeningCount(
    clauses,
    text,
    /\b(?:sliding|patio|slider|multi[-\s]?panel)\s+doors?\b/i
  );
  if (windowCount) out.windowCount = windowCount;
  if (exteriorDoorCount) out.exteriorDoorCount = exteriorDoorCount;
  if (slidingDoorCount) out.slidingDoorCount = slidingDoorCount;
  if (shouldInferGarageDoorInstallFromNotes(text)) {
    const garageDoorSingleCount = pickOpeningCount(
      clauses,
      text,
      /\b(?:single|one[-\s]?car)\b[^.;\n]{0,25}\bgarage\s+doors?\b|\bgarage\s+doors?\b[^.;\n]{0,25}\b(?:single|one[-\s]?car)\b/i
    );
    const garageDoorDoubleCount = pickOpeningCount(
      clauses,
      text,
      /\b(?:double|two[-\s]?car)\b[^.;\n]{0,25}\bgarage\s+doors?\b|\bgarage\s+doors?\b[^.;\n]{0,25}\b(?:double|two[-\s]?car)\b/i
    );
    const garageDoorRvCount = pickOpeningCount(
      clauses,
      text,
      /\b(?:rv|oversized|extra[-\s]?wide|tall)\b[^.;\n]{0,25}\bgarage\s+doors?\b|\bgarage\s+doors?\b[^.;\n]{0,25}\b(?:rv|oversized|extra[-\s]?wide|tall)\b/i
    );
    if (garageDoorSingleCount)
      out.garageDoorSingleCount = garageDoorSingleCount;
    if (garageDoorDoubleCount)
      out.garageDoorDoubleCount = garageDoorDoubleCount;
    if (garageDoorRvCount) out.garageDoorRvCount = garageDoorRvCount;
  }

  const explicitReframingLanguage =
    /\b(?:re[-\s]?frame(?:d|ing)?|new\s+(?:window|door)\s+opening|new\s+opening|resize(?:d|ing)?\s+(?:the\s+)?(?:window|door)?\s*opening|enlarge(?:d|ing)?\s+(?:the\s+)?(?:window|door)?\s*opening|modify(?:ing|ied)?\s+(?:the\s+)?(?:window|door)?\s*opening)\b/i.test(
      text
    );
  const negatedReframingLanguage =
    /\b(?:no|not|without|exclude(?:d|s)?|excluding)\s+(?:any\s+)?(?:structural\s+)?re[-\s]?framing\b|\b(?:no|not|without)\s+(?:any\s+)?(?:new\s+)?(?:window|door)?\s*openings?\b/i.test(
      text
    );
  const reframingRequested =
    explicitReframingLanguage && !negatedReframingLanguage;
  if (reframingRequested) {
    out.reframingRequested = true;
    const framingOpeningCount = pickOpeningCount(
      clauses,
      text,
      /\b(?:re[-\s]?frame|new|resize|enlarge|modify)[^.;\n]{0,45}\bopenings?\b/i
    );
    if (framingOpeningCount) out.framingOpeningCount = framingOpeningCount;
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
    /\bpaintable\s+(?:exterior\s+)?wall\s+area\b/,
    /\bexterior\s+(?:wall\s+)?(?:surface|wall)\s+area\b/,
  ]);
  if (exteriorPaintSqft) out.exteriorPaintSqft = exteriorPaintSqft;

  if (!isGarageConversionJob(projectType, text)) {
    const drywallSqft = pickSqftFromClauses([/\bdrywall\b/, /\bsheetrock\b/]);
    if (drywallSqft) out.drywallSqft = drywallSqft;
  }

  const insulationSqft = (patterns: RegExp[]) => pickSqftFromClauses(patterns);
  const exteriorWallInsulationSqft =
    pickInsulationArea('(?:exterior|outside)\\s+walls?') ||
    insulationSqft([
      /\b(?:exterior|outside)\s+(?:wall\s+)?insulation\b/i,
      /\binsulation\b[^.;]{0,35}\b(?:exterior|outside)\s+walls?\b/i,
    ]);
  const atticInsulationSqft =
    pickInsulationArea('(?:attic|ceiling)(?:\\s+area)?') ||
    insulationSqft([
      /\b(?:attic|ceiling)\s+insulation\b/i,
      /\binsulation\b[^.;]{0,35}\b(?:attic|ceiling)\b/i,
    ]);
  const insulatedRoofDeckSqft = insulationSqft([
    /\binsulated\s+roof\s+deck\b/i,
    /\broof\s+deck\s+insulation\b/i,
  ]);
  const floorInsulationSqft =
    pickInsulationArea('floor(?:\\s+area)?') ||
    insulationSqft([
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
  const garageInsulationIncluded =
    /\bgarage\b[^.;\n]{0,50}\b(insulat(?:e|ed|ion)|separation)\b/i.test(text)
      ? 'yes'
      : undefined;
  if (insulationMaterialType)
    out.insulationMaterialType = insulationMaterialType;
  if (insulationRValue) out.insulationRValue = insulationRValue;
  if (garageInsulationIncluded)
    out.garageInsulationIncluded = garageInsulationIncluded;
  const airSealingMention = text.match(AIR_SEALING_SYNONYM_RE);
  const airSealingExcluded =
    new RegExp(
      `\\b(?:no|without|exclude|excluding)\\b[^.;\\n]{0,30}${AIR_SEALING_SYNONYM_RE.source}`,
      'i'
    ).test(text);
  if (airSealingMention && !airSealingExcluded) {
    out.airSealingIncluded = true;
  }

  const productIsRemovalOnly = (product: string): boolean => {
    const removal =
      /(?:tear[\s-]?out|remove|removal|demo|demolition)\b[^.;\n]{0,45}\b(?:carpet|lvp|luxury\s+vinyl|laminate|engineered\s+hardwood|solid\s+hardwood|tile|flooring)\b/i;
    const reverse =
      /\b(?:carpet|lvp|luxury\s+vinyl|laminate|engineered\s+hardwood|solid\s+hardwood|tile|flooring)\b[^.;\n]{0,45}\b(?:tear[\s-]?out|remove|removal|demo|demolition)\b/i;
    const installPattern =
      product === 'engineered_hardwood'
        ? 'engineered\\s+hardwood'
        : product === 'solid_hardwood'
          ? 'solid\\s+hardwood'
          : product === 'lvp'
            ? '(?:lvp|luxury\\s+vinyl)'
            : product;
    return (
      (removal.test(blob) || reverse.test(blob)) &&
      !new RegExp(
        `\\b(?:install|installation|installing|new)\\b[^.;\\n]{0,45}\\b${installPattern}\\b`,
        'i'
      ).test(blob)
    );
  };

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
  if (/\bcarpet\b/i.test(blob) && !productIsRemovalOnly('carpet'))
    flooringProductScope.push('carpet');
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
    const product =
      key === 'flooringLvpSqft'
        ? 'lvp'
        : key === 'flooringLaminateSqft'
          ? 'laminate'
          : key === 'flooringEngineeredHardwoodSqft'
            ? 'engineered_hardwood'
            : key === 'flooringSolidHardwoodSqft'
              ? 'solid_hardwood'
              : key === 'flooringTileSqft'
                ? 'tile'
                : 'carpet';
    if (quantity && !productIsRemovalOnly(product)) out[key] = quantity;
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
    if (templateKey === 'bathroom' || projectType === 'bathroom') return null;
    const explicitHomeInterior = parseLabeledInteriorFloorAreaTotal(text);
    if (explicitHomeInterior) return explicitHomeInterior;
    if (
      isGarageConversionJob(projectType, text) ||
      (templateKey === 'addition' &&
        /\bconvert(?:ing)?\s+(?:\d[\d,]*\s*[-\s]?car\s*)?garage\b/i.test(text))
    ) {
      const conversionSf = inferGarageConversionFloorSqftFromNotes(text);
      if (conversionSf) return conversionSf;
    }
    if (livingAreaSqft) return livingAreaSqft;
    const allowsHomeFloorInference =
      templateKey === 'ground_up' ||
      projectType === 'ground_up' ||
      projectType === 'new_build' ||
      templateKey === 'insulation' ||
      /\b(?:insulat(?:e|ion|ed)|fiberglass\s+batt|blown[-\s]?in)\b/i.test(
        text
      );
    if (allowsHomeFloorInference) {
      const homeFloor = inferHomeFloorAreaSqftFromNotes(text);
      if (homeFloor) return homeFloor;
    }
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
        /\bback\s*splash|backsplash|\bcountertop|\bpaint\b|\bshower\b|\bbath(?:room)?\s+floor\b/i.test(
          c
        )
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
  if (out.airSealingIncluded && floorAreaSqft) {
    out.airSealingSqft = floorAreaSqft;
  }
  if (
    (templateKey === 'painting' || projectType === 'painting') &&
    parseLabeledInteriorFloorAreaTotal(text) != null
  ) {
    out.floorAreaSqft = parseLabeledInteriorFloorAreaTotal(text)!;
  }

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
    if (
      isGarageConversionJob(projectType, text) ||
      (templateKey === 'addition' &&
        /\bconvert(?:ing)?\s+(?:\d[\d,]*\s*[-\s]?car\s*)?garage\b/i.test(text))
    ) {
      return null;
    }
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
      if (clauseHomeSqftBeforeGarage(clause)) {
        const inferred =
          inferGarageSqftFromCarCount(clause) ??
          inferGarageSqftFromCarCount(text);
        if (inferred) return inferred;
        continue;
      }
      const near = pickSqftNearPattern(clause, /\bgarages?\b/);
      if (near && near >= 100) {
        const homeBeforeGarage = clauseHomeSqftBeforeGarage(clause);
        if (homeBeforeGarage && Math.abs(near - homeBeforeGarage) < 1) {
          return (
            inferGarageSqftFromCarCount(clause) ??
            inferGarageSqftFromCarCount(text)
          );
        }
        if (near > 1200 && /\b(?:home|house)\b/i.test(clause)) {
          return inferGarageSqftFromCarCount(text);
        }
        return near;
      }
    }
    return inferGarageSqftFromCarCount(text);
  })();
  if (garageSqft) out.garageSqft = garageSqft;

  const garageDoors = parseGarageDoorCountsFromNotes(text);
  if (garageDoors.garageDoorSingleCount) {
    out.garageDoorSingleCount = garageDoors.garageDoorSingleCount;
  }
  if (garageDoors.garageDoorDoubleCount) {
    out.garageDoorDoubleCount = garageDoors.garageDoorDoubleCount;
  }
  if (garageDoors.garageDoorRvCount) {
    out.garageDoorRvCount = garageDoors.garageDoorRvCount;
  }
  if (!shouldInferGarageDoorInstallFromNotes(text)) {
    delete out.garageDoorSingleCount;
    delete out.garageDoorDoubleCount;
    delete out.garageDoorRvCount;
  }

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
    const roofTieInOnly =
      /\broof\s*(?:tie[\s-]?in|framing)\b/i.test(text) &&
      !/\b(?:roofing|shingles?|roof\s+(?:area|squares?|replacement|installation|decking))\b/i.test(
        text
      );
    if (!out.roofAreaSqft) {
      const sqft = roofTieInOnly
        ? null
        : pickSqftNearPattern(text, /\broof|\bshingle/);
      if (sqft) out.roofAreaSqft = sqft;
    }
    if (!out.roofSquares) {
      const sq = roofTieInOnly ? null : firstQty(text, SQUARES_RE);
      if (sq) out.roofSquares = sq;
      else {
        const sqft = roofTieInOnly
          ? null
          : pickSqftNearPattern(text, /\broof|\bshingle/);
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
      if (
        key === 'roofRepairAffectedSqft' &&
        notesImplyRoofTearOffAndInstall(text)
      ) {
        continue;
      }
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

    Object.assign(out, applyRoofingPlanningMeasurements(out, text));
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

  const hvacSignal =
    /\bhvac\b|\bmechanical\b|\bfurnace\b|\bair\s*(?:handler|condition(?:er|ing))\b|\bheat\s*pump\b|\bmini[\s-]?split\b|\bductwork\b|\bthermostat\b|\bventilation\b/i;
  const hvacText = hvacSignal.test(text)
    ? text
    : clauses.filter(clause => hvacSignal.test(clause)).join(' ');
  if (hvacText) {
    const systemCount =
      firstHvacCount(hvacText, '(?:hvac\\s+)?systems?') ||
      firstHvacCount(
        hvacText,
        '(?:furnaces?|air\\s*handlers?|heat\\s*pumps?|mini[\\s-]?splits?)'
      );
    if (systemCount) out.hvacSystemCount = Math.round(systemCount);
    const tons = firstQty(hvacText, TON_RE);
    if (tons) out.hvacSystemTons = tons;
    const ductworkLf = pickLfNearPattern(
      hvacText,
      /\b(?:ductwork|ducts?|flex\s*duct)\b/i
    );
    if (ductworkLf) out.hvacDuctworkLf = ductworkLf;
    const supplyRegisterCount = firstHvacCount(
      hvacText,
      '(?:supply\\s+)?(?:air\\s+)?registers?|(?:supply\\s+)?diffusers?'
    );
    if (supplyRegisterCount) {
      out.hvacSupplyRegisterCount = Math.round(supplyRegisterCount);
    }
    const returnGrilleCount = firstHvacCount(
      hvacText,
      'return(?:\\s+air)?\\s+(?:grilles?|registers?)'
    );
    if (returnGrilleCount) {
      out.hvacReturnGrilleCount = Math.round(returnGrilleCount);
    }
    const thermostatCount = firstHvacCount(hvacText, 'thermostats?');
    if (thermostatCount) out.hvacThermostatCount = Math.round(thermostatCount);
    const serviceCallCount = firstHvacCount(
      hvacText,
      '(?:hvac\\s+)?(?:service|diagnostic|maintenance)\\s+calls?'
    );
    if (serviceCallCount)
      out.hvacServiceCallCount = Math.round(serviceCallCount);
    const replacementCount = firstHvacCount(
      hvacText,
      '(?:equipment|furnace|air\\s*handler|condenser|heat\\s*pump)\\s+(?:replacement|replace(?:ment)?)'
    );
    if (replacementCount) {
      out.hvacEquipmentReplacementCount = Math.round(replacementCount);
    } else if (
      /\b(?:replace|replacement)\b/i.test(hvacText) &&
      /\b(?:equipment|furnace|air\s*handler|condenser|heat\s*pump)\b/i.test(
        hvacText
      )
    ) {
      out.hvacEquipmentReplacementCount = 1;
    }
    const refrigerantCount = firstHvacCount(
      hvacText,
      'refrigerant(?:\\s+(?:service|recharge|recovery))?'
    );
    if (refrigerantCount)
      out.hvacRefrigerantCount = Math.round(refrigerantCount);
    const ventilationCount = firstHvacCount(
      hvacText,
      '(?:ERV|HRV|fresh[\\s-]?air\\s+ventilator|energy[\\s-]?recovery\\s+ventilator|heat[\\s-]?recovery\\s+ventilator)'
    );
    if (ventilationCount)
      out.hvacVentilationCount = Math.round(ventilationCount);
    if (/\b(?:permit|inspection)\b/i.test(hvacText)) {
      out.hvacPermitCount = 1;
    }
    if (/\b(?:hvac\s+)?(?:cleanup|disposal|haul[\s-]?off)\b/i.test(hvacText)) {
      out.hvacCleanupCount = 1;
    }
  }

  const planned = applyConcretePlanningMeasurements(out, text);
  for (const key of [
    'concreteSqft',
    'concreteAreaByType',
    'concreteThicknessByType',
    'concreteDrivewaySqft',
    'concreteSidewalkSqft',
    'concretePatioSqft',
    'concreteWalkwaySqft',
    'concreteRvPadSqft',
  ] as const) {
    if (!(key in planned)) delete (out as Record<string, unknown>)[key];
  }
  Object.assign(out, planned);

  if (
    (templateKey === 'concrete' || projectType === 'concrete') &&
    !/\b(?:paint(?:ing)?|primer|stain|repaint)\b/i.test(text)
  ) {
    for (const key of [
      'wallPaintSqft',
      'ceilingPaintSqft',
      'paintAreaSqft',
      'combinedPaintableAreaSqft',
      'originalPaintAreaReferenceSqft',
      'paintPricingMethod',
      'paintAreaNeedsConfirmation',
      'paintAreaBasis',
    ] as const) {
      delete (out as Record<string, unknown>)[key];
    }
  }

  if (templateKey === 'concrete' || projectType === 'concrete') {
    for (const key of [
      'floorAreaSqft',
      'garageSqft',
      'rockMulchSqft',
    ] as const) {
      delete (out as Record<string, unknown>)[key];
    }
  }

  Object.assign(
    out,
    applyBathroomPlanningMeasurements(out, text, { templateKey, projectType })
  );

  const electrical = parseElectricalMeasurementsFromNotes(text);
  const electricalItemQuantities = electrical.itemQuantities || {};
  for (const [key, value] of Object.entries(electrical)) {
    if (key === 'itemQuantities' || value == null) continue;
    (out as Record<string, unknown>)[key] = value;
  }

  const itemAllowances = parseScopeItemAllowancesFromNotes(text, ctx);
  const itemRatePricing = parseScopeItemRatePricingFromNotes(text, out, ctx);
  const itemQuantities = { ...itemAllowances, ...itemRatePricing };
  const openingItemMap: Array<[keyof ParsedScopeMeasurements, string]> = [
    ['windowCount', 'windows'],
    ['exteriorDoorCount', 'exterior_doors'],
    ['slidingDoorCount', 'sliding_doors'],
  ];
  for (const [key, itemId] of openingItemMap) {
    const quantity = Number(out[key]);
    if (!Number.isFinite(quantity) || quantity <= 0 || itemQuantities[itemId])
      continue;
    itemQuantities[itemId] = {
      quantity,
      unit: 'each',
      quantitySource: 'notes',
    };
  }
  const garageDoorCount =
    (Number(out.garageDoorSingleCount) || 0) +
    (Number(out.garageDoorDoubleCount) || 0) +
    (Number(out.garageDoorRvCount) || 0);
  if (garageDoorCount > 0 && !itemQuantities.garage_doors) {
    itemQuantities.garage_doors = {
      quantity: garageDoorCount,
      unit: 'each',
      quantitySource: 'notes',
    };
  }
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
  const hvacItemMap: Array<
    [keyof ParsedScopeMeasurements, string, 'each' | 'ton' | 'lf']
  > = [
    ['hvacSystemCount', 'hvac', 'each'],
    ['hvacSystemTons', 'hvac', 'ton'],
    ['hvacServiceCallCount', 'service_call', 'each'],
    ['hvacEquipmentReplacementCount', 'equipment_replace', 'each'],
    ['hvacRefrigerantCount', 'refrigerant', 'each'],
    ['hvacThermostatCount', 'thermostat', 'each'],
    ['hvacDuctworkLf', 'ductwork', 'lf'],
    ['hvacSupplyRegisterCount', 'supply_registers', 'each'],
    ['hvacReturnGrilleCount', 'return_grilles', 'each'],
    ['hvacVentilationCount', 'ventilation', 'each'],
    ['hvacPermitCount', 'permits', 'each'],
    ['hvacCleanupCount', 'cleanup', 'each'],
  ];
  for (const [key, itemId, unit] of hvacItemMap) {
    const quantity = Number(out[key]);
    if (!Number.isFinite(quantity) || quantity <= 0 || itemQuantities[itemId]) {
      continue;
    }
    itemQuantities[itemId] = {
      quantity,
      unit,
      quantitySource: 'notes',
    };
  }
  if (templateKey === 'room_remodel' || projectType === 'room_remodel') {
    if (Number(out.cabinetLf) > 0) {
      itemQuantities.cabinets = {
        quantity: Number(out.cabinetLf),
        unit: 'lf',
        quantitySource: 'notes',
      };
    }
    if (Number(out.countertopLf) > 0) {
      itemQuantities.countertops = {
        quantity: Number(out.countertopLf),
        unit: 'lf',
        quantitySource: 'notes',
      };
    }
    const vanityMatch = text.match(
      /\b(?:replace|install)\s+(one|two|three|\d+)\s+(?:bathroom\s+)?vanit(?:y|ies)\b/i
    );
    if (vanityMatch && !itemQuantities.vanity) {
      const quantity = parseCountToken(vanityMatch[1]);
      if (quantity && quantity > 0) {
        itemQuantities.vanity = {
          quantity,
          unit: 'each',
          quantitySource: 'notes',
        };
      }
    }
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
