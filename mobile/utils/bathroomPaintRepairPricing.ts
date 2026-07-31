import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import {
  patchWorkLikelyInScope,
  resolveBathroomDrywallPatchSuggestedPricing,
} from '@/utils/bathroomDrywallPatchPricing';
import {
  BATHROOM_DRYWALL_PATCH_REF_SQFT,
  DRYWALL_PAINT_PRICING_DISCLAIMER,
  DRYWALL_PAINT_WET_AREA_NOTE,
  formatPaintRepairQuantityLine,
  PAINT_REPAIR_FULL_WALL_EXCLUDED,
  PAINT_REPAIR_MATCH_ASSUMPTION,
  PAINT_REPAIR_TOUCH_UP_INCLUDES,
  resolveBathroomPaintRepairScope,
  scaleBathroomRepairAllowance,
  shouldUseCombinedDrywallPaintAssembly,
  splitMaterialLabor,
  type BathroomPaintRepairScope,
} from '@/utils/bathroomDrywallPaintScope';
import { roundInteriorPaintPriceToNearest25 } from '@/utils/bathroomInteriorPaintPricing';
import { checklistItemInScope } from '@/utils/scopeItemQuantities';
import type { ScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';

const AFFECTED_AREA_BAND = {
  total: 500,
  range: { low: 400, high: 650 },
} as const;

/** Full-room paint on paint_repair — patch, texture, primer, and paint included. */
export const FULL_ROOM_PAINT_PATCH_INCLUDED_RATE = 4;
export const FULL_ROOM_PAINT_PATCH_INCLUDED_MINIMUM = 1400;

const PAINT_INCLUDES = [
  'Spot priming the repaired drywall',
  'Standard interior paint',
  'Basic color and sheen matching',
  'Localized touch-up around the repaired area',
  'Standard preparation',
  'Application labor',
  'Basic cleanup',
  'Standard contractor overhead and profit',
] as const;

const PAINT_EXCLUDES = [
  'Painting the entire wall',
  'Painting the entire room',
  'Premium paint upgrades',
  'Difficult color matching',
  'Specialty finishes',
  'Extensive masking or furniture moving',
  'Repairs beyond the selected drywall scope',
] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isPaintRepairSuggestedBlock(pricingRecordId?: string | null): boolean {
  return String(pricingRecordId || '').startsWith('bps_national:paint_repair:bathroom:');
}

export function paintRepairScopeFromPricingRecord(
  pricingRecordId?: string | null
): BathroomPaintRepairScope | null {
  if (!isPaintRepairSuggestedBlock(pricingRecordId)) return null;
  const parts = String(pricingRecordId).split(':');
  const scope = parts[4];
  if (scope === 'affected_area' || scope === 'full_room') return scope;
  if (scope === 'touch_up' || scope === 'affected_wall' || scope === 'unsure') return 'affected_area';
  return null;
}

export function buildPaintRepairPricingDetails(params: {
  sqft: number;
  scope: 'affected_area';
}) {
  const band = AFFECTED_AREA_BAND;
  const total = scaleBathroomRepairAllowance(band.total, params.sqft);
  const { material, labor } = splitMaterialLabor(total, 0.25);
  const range = {
    low: scaleBathroomRepairAllowance(band.range.low, params.sqft),
    high: scaleBathroomRepairAllowance(band.range.high, params.sqft),
  };

  return {
    scope: params.scope,
    routesToInteriorPaint: false,
    total,
    material,
    labor,
    range,
    quantityLabel: formatPaintRepairQuantityLine(params.scope),
    includesScopeLine: PAINT_REPAIR_TOUCH_UP_INCLUDES,
    excludesNote: PAINT_REPAIR_FULL_WALL_EXCLUDED,
    planningRangeLabel: `Planning range: $${range.low.toLocaleString()}–$${range.high.toLocaleString()}`,
    matchAssumption: PAINT_REPAIR_MATCH_ASSUMPTION,
    wetAreaNote: DRYWALL_PAINT_WET_AREA_NOTE,
    disclaimer: DRYWALL_PAINT_PRICING_DISCLAIMER,
    includes: [...PAINT_INCLUDES],
    excludes: [...PAINT_EXCLUDES],
    confidence: 'medium' as const,
  };
}

export function resolveBathroomPaintRepairSuggestedPricing(params: {
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
  patchSqft?: number | null;
  showerWallTileSqft?: number | null;
  paintRepairScope?: string | null;
  paintRepairEntireRoom?: boolean | null;
  entireRoomSqft?: number | null;
  interiorPaintMobilization?: string | null;
  interiorPaintSurface?: string | null;
  interiorPaintCondition?: string | null;
  useCombinedAssembly?: boolean | null;
}): ScopeItemSuggestedPricing | undefined {
  const items = params.checklistItems;
  if (!items?.length) return undefined;

  const paintRepairSelected = items.some(
    (row) => row.id === 'paint_repair' && checklistItemInScope(row)
  );
  if (!paintRepairSelected && !patchWorkLikelyInScope(items)) {
    return { fill: null, comparison: null };
  }
  if (!paintRepairSelected) {
    return { fill: null, comparison: null };
  }

  const scope = resolveBathroomPaintRepairScope(params.paintRepairScope);
  const entireRoomSqft = params.entireRoomSqft;

  // Require the explicit paint-scope button. Do not invent full-room pricing
  // from a sticky entireRoom boolean when neither option is selected in UI.
  if (scope === 'full_room' && entireRoomSqft != null && entireRoomSqft > 0) {
    return resolveBathroomPaintRepairFullRoomPricing({
      entireRoomSqft,
      interiorPaintMobilization: params.interiorPaintMobilization,
      interiorPaintSurface: params.interiorPaintSurface,
      interiorPaintCondition: params.interiorPaintCondition,
    });
  }

  if (scope !== 'affected_area') {
    return { fill: null, comparison: null };
  }

  if (
    shouldUseCombinedDrywallPaintAssembly({
      useCombinedAssembly: params.useCombinedAssembly,
      paintRepairScope: 'affected_area',
    })
  ) {
    return {
      fill: null,
      comparison: null,
    };
  }

  const sqft =
    params.patchSqft != null && params.patchSqft > 0 ? params.patchSqft : null;

  if (sqft == null) {
    return { fill: null, comparison: null };
  }

  const details = buildPaintRepairPricingDetails({ sqft, scope: 'affected_area' });

  let helper = `${details.includesScopeLine}. ${PAINT_REPAIR_MATCH_ASSUMPTION}`;

  const localizedFill: NonNullable<ScopeItemSuggestedPricing['fill']> = {
    material: round2(details.material!),
    labor: round2(details.labor!),
    total: round2(details.total!),
    materialSource: 'national_average',
    laborSource: 'national_average',
    rateSourceLabel: 'Suggested budget split · Based on selected remodel conditions',
    helper: `${helper} ${DRYWALL_PAINT_WET_AREA_NOTE}`,
    mode: 'suggested_price',
    basis: { quantity: 1, unit: 'each' },
    comparisonRange: details.range,
    pricingRecordId: `bps_national:paint_repair:bathroom:affected_area:${sqft || 36}sf`,
    productionStatus: 'review_required',
    benchmarkLevel: 'component',
    benchmarkScopeKey: 'paint_repair',
    benchmarkAction: 'price_ready',
    storedTotalExact: round2(details.total!),
    splitConfidence: details.confidence,
  };

  return {
    fill: localizedFill,
    comparison: null,
  };
}

export function computeFullRoomPaintPatchIncludedTotal(sqft: number): {
  total: number;
  rawTotal: number;
  minimumApplied: boolean;
} {
  const rawTotal = round2(sqft * FULL_ROOM_PAINT_PATCH_INCLUDED_RATE);
  const withMinimum = Math.max(rawTotal, FULL_ROOM_PAINT_PATCH_INCLUDED_MINIMUM);
  const total = roundInteriorPaintPriceToNearest25(withMinimum);
  const minimumApplied = rawTotal < FULL_ROOM_PAINT_PATCH_INCLUDED_MINIMUM;
  return { rawTotal, total, minimumApplied };
}

export function splitFullRoomPaintPatchIncludedMaterialLabor(total: number): {
  material: number;
  labor: number;
} {
  const material = round2(total * 0.25);
  return { material, labor: round2(total - material) };
}

export function resolveBathroomPaintRepairFullRoomPricing(params: {
  entireRoomSqft: number;
  interiorPaintMobilization?: string | null;
  interiorPaintSurface?: string | null;
  interiorPaintCondition?: string | null;
}): ScopeItemSuggestedPricing | undefined {
  if (!(params.entireRoomSqft > 0)) return undefined;

  const sqft = Math.round(params.entireRoomSqft);
  const { total } = computeFullRoomPaintPatchIncludedTotal(sqft);
  const { material, labor } = splitFullRoomPaintPatchIncludedMaterialLabor(total);

  return {
    fill: {
      material: round2(material),
      labor: round2(labor),
      total: round2(total),
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'Suggested budget split · Full-room paint (patch included)',
      helper: `Full-room paint on ${sqft} SF at $${FULL_ROOM_PAINT_PATCH_INCLUDED_RATE}/sq. ft. ($${FULL_ROOM_PAINT_PATCH_INCLUDED_MINIMUM.toLocaleString()} minimum). Drywall patch, texture, primer, and paint included. ${DRYWALL_PAINT_WET_AREA_NOTE}`,
      mode: 'suggested_price',
      basis: { quantity: sqft, unit: 'sqft' },
      comparisonRange: {
        low: round2(total * 0.85),
        high: round2(total * 1.2),
      },
      pricingRecordId: `bps_national:paint_repair:bathroom:full_room:${params.entireRoomSqft}sf`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: 'paint_repair',
      benchmarkAction: 'price_ready',
      storedTotalExact: round2(total),
      splitConfidence: 'medium',
    },
    comparison: null,
  };
}

export function buildBathroomDrywallPaintCombinedSummary(params: {
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
  showerWallTileSqft?: number | null;
  paintRepairScope?: string | null;
  enteredPatchSqft?: number | null;
}): {
  drywallTotal: number;
  paintTotal: number;
  combinedTotal: number;
  material: number;
  labor: number;
  range: { low: number; high: number };
  sqft: number;
} | null {
  if (!(params.enteredPatchSqft != null && params.enteredPatchSqft > 0)) return null;
  const sqft = Math.round(params.enteredPatchSqft);

  const drywall = resolveBathroomDrywallPatchSuggestedPricing({
    checklistItems: params.checklistItems,
    quantity: sqft,
    showerWallTileSqft: params.showerWallTileSqft,
    useCombinedAssembly: false,
  });
  const paint = resolveBathroomPaintRepairSuggestedPricing({
    checklistItems: params.checklistItems,
    patchSqft: sqft,
    paintRepairScope: params.paintRepairScope ?? 'affected_area',
    showerWallTileSqft: params.showerWallTileSqft,
    useCombinedAssembly: false,
  });
  const drywallTotal = drywall?.fill?.total ?? 0;
  const paintTotal = paint?.fill?.total ?? 0;
  if (!drywallTotal || !paintTotal) return null;

  const combinedTotal = round2(drywallTotal + paintTotal);
  const material = round2((drywall?.fill?.material ?? 0) + (paint?.fill?.material ?? 0));
  const labor = round2(combinedTotal - material);
  const drywallRange = drywall?.fill?.comparisonRange;
  const paintRange = paint?.fill?.comparisonRange;

  return {
    sqft,
    drywallTotal,
    paintTotal,
    combinedTotal,
    material,
    labor,
    range: {
      low: (drywallRange?.low ?? 0) + (paintRange?.low ?? 0),
      high: (drywallRange?.high ?? 0) + (paintRange?.high ?? 0),
    },
  };
}

/** One Apply card for separate patch/texture + affected-area paint on paint_repair. */
export function buildBathroomSeparateDrywallPaintSuggestedBlock(params: {
  drywall?: NonNullable<ScopeItemSuggestedPricing['fill']> | null;
  paint: NonNullable<ScopeItemSuggestedPricing['fill']>;
  patchSqft: number;
}): NonNullable<ScopeItemSuggestedPricing['fill']> {
  const paint = params.paint;
  const drywall = params.drywall;
  const total = round2((drywall?.total ?? 0) + paint.total);
  const material = round2((drywall?.material ?? 0) + paint.material);
  const labor = round2(total - material);
  const drywallRange = drywall?.comparisonRange;
  const paintRange = paint.comparisonRange;
  const range =
    drywallRange || paintRange
      ? {
          low: round2(
            (drywallRange?.low ?? drywall?.total ?? 0) + (paintRange?.low ?? paint.total)
          ),
          high: round2(
            (drywallRange?.high ?? drywall?.total ?? 0) + (paintRange?.high ?? paint.total)
          ),
        }
      : null;

  const parts: string[] = [];
  if (drywall) parts.push(`Drywall patch + texture $${drywall.total.toLocaleString()}`);
  parts.push(`Paint $${paint.total.toLocaleString()}`);

  return {
    material,
    labor,
    total,
    materialSource: 'national_average',
    laborSource: 'national_average',
    rateSourceLabel: drywall
      ? 'Suggested budget split · Separate patch/texture and paint lines'
      : 'Suggested budget split · Full-room paint (patch included)',
    helper: `${parts.join(' · ')}. Apply once to price all lines. ${DRYWALL_PAINT_WET_AREA_NOTE}`,
    mode: 'suggested_price',
    basis: { quantity: params.patchSqft, unit: 'sqft' },
    comparisonRange: range,
    pricingRecordId: `bps_national:paint_repair:bathroom_separate:${params.patchSqft}sf`,
    productionStatus: 'review_required',
    benchmarkLevel: 'component',
    benchmarkScopeKey: 'paint_repair',
    benchmarkAction: 'price_ready',
    storedTotalExact: total,
    splitConfidence: 'medium',
  };
}
