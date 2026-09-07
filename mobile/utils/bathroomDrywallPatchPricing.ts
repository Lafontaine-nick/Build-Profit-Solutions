import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import { wetAreaInScope } from '@/utils/bathroomPlumbingTrimPricing';
import {
  BATHROOM_DRYWALL_PATCH_REF_SQFT,
  defaultBathroomEntireRoomPaintSqft,
  DRYWALL_PATCH_PRIMER_PAINT_EXCLUDED,
  DRYWALL_PATCH_TEXTURE_INCLUDES_SCOPE,
  DRYWALL_PAINT_COMBINED_SUMMARY_LABEL,
  DRYWALL_PAINT_PRICING_DISCLAIMER,
  DRYWALL_PAINT_WET_AREA_NOTE,
  formatDrywallPatchQuantityLine,
  resolveBathroomPaintRepairScope,
  scaleBathroomRepairAllowance,
  shouldUseCombinedDrywallPaintAssembly,
  splitMaterialLabor,
} from '@/utils/bathroomDrywallPaintScope';
import {
  checklistItemInScope,
  type ScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';
import {
  bathroomPaintRepairSeverityMultiplier,
  resolveBathroomPaintRepairSeverity,
  syncBathroomPaintRepairFlow,
  type BathroomPaintRepairSeverity,
} from '@/utils/bathroomPaintRepairFlow';
import { parseScopeMeasurementInput } from '@/utils/scopeMeasurements';

const PATCH_SCOPE_IDS = new Set([
  'demo',
  'plumbing_rough',
  'waterproofing',
  'wet_area_install',
  'tub_install',
  'prefab_shower_pan',
  'shower_pan',
  'shower_tile',
  'shower_floor_tile',
  'glass_door',
]);

const DRYWALL_PATCH_BASE = {
  total: 400,
  range: { low: 350, high: 650 },
};

const COMBINED_BASE = {
  total: 700,
  range: { low: 550, high: 900 },
  material: 175,
  labor: 525,
};

const DRYWALL_INCLUDES = [
  'Localized drywall patch material',
  'Minor backing or blocking',
  'Cutting and fitting patches',
  'Fasteners',
  'Joint tape',
  'Joint compound',
  'Multiple mud coats',
  'Sanding',
  'Basic texture blending',
  'Jobsite protection and cleanup',
  'Standard contractor labor',
  'Standard contractor overhead and profit',
] as const;

const DRYWALL_EXCLUDES = [
  'Primer',
  'Paint',
  'Full-wall repainting',
  'Full-room repainting',
  'Full-room skim coating',
  'Specialty texture reproduction',
  'Wet-area backer board',
  'Waterproofing',
  'Water or mold remediation',
  'Structural repairs',
] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function patchWorkLikelyInScope(
  items: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null | undefined
): boolean {
  if (!items?.length) return false;
  if (wetAreaInScope(items)) return true;
  return items.some((row) => PATCH_SCOPE_IDS.has(row.id) && checklistItemInScope(row));
}

export { patchWorkLikelyInScope };

export function defaultBathroomDrywallPatchSqft(params: {
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
  showerWallTileSqft?: number | null;
}): number {
  if (!patchWorkLikelyInScope(params.checklistItems)) return 0;
  const showerSf = params.showerWallTileSqft;
  if (showerSf != null && showerSf > 0) {
    return Math.max(24, Math.round(showerSf * 0.45));
  }
  return 24;
}

export function isDrywallPatchSuggestedBlock(pricingRecordId?: string | null): boolean {
  const id = String(pricingRecordId || '');
  return (
    id.startsWith('bps_national:drywall:bathroom_patch_texture:') ||
    id.startsWith('bps_national:drywall:kitchen_patch_texture:') ||
    id.startsWith('bps_national:drywall_paint:bathroom_combined:')
  );
}

export function drywallPatchSqftFromPricingRecord(pricingRecordId?: string | null): number | null {
  const id = String(pricingRecordId || '');
  const match = id.match(/:(\d+)sf$/);
  if (!match) return null;
  const sqft = Number(match[1]);
  return Number.isFinite(sqft) && sqft > 0 ? sqft : null;
}

export function buildDrywallPatchPricingDetails(params: {
  sqft: number;
  combined?: boolean;
  severity?: BathroomPaintRepairSeverity | string | null;
}) {
  const severityMultiplier =
    params.combined === true
      ? bathroomPaintRepairSeverityMultiplier(
          resolveBathroomPaintRepairSeverity(params.severity)
        )
      : 1;
  const scaledTotal = round2(
    scaleBathroomRepairAllowance(
      params.combined ? COMBINED_BASE.total : DRYWALL_PATCH_BASE.total,
      params.sqft
    ) * severityMultiplier
  );
  const split = params.combined
    ? {
        material: round2(
          scaleBathroomRepairAllowance(COMBINED_BASE.material, params.sqft) *
            severityMultiplier
        ),
        labor: round2(
          scaleBathroomRepairAllowance(COMBINED_BASE.labor, params.sqft) *
            severityMultiplier
        ),
      }
    : splitMaterialLabor(scaledTotal, 0.25);
  const range = params.combined
    ? {
        low: round2(
          scaleBathroomRepairAllowance(COMBINED_BASE.range.low, params.sqft) *
            severityMultiplier
        ),
        high: round2(
          scaleBathroomRepairAllowance(COMBINED_BASE.range.high, params.sqft) *
            severityMultiplier
        ),
      }
    : {
        low: scaleBathroomRepairAllowance(DRYWALL_PATCH_BASE.range.low, params.sqft),
        high: scaleBathroomRepairAllowance(DRYWALL_PATCH_BASE.range.high, params.sqft),
      };

  return {
    sqft: params.sqft,
    total: scaledTotal,
    material: split.material,
    labor: split.labor,
    range,
    includesScopeLine: params.combined
      ? DRYWALL_PAINT_COMBINED_SUMMARY_LABEL
      : DRYWALL_PATCH_TEXTURE_INCLUDES_SCOPE,
    excludesNote: params.combined ? null : DRYWALL_PATCH_PRIMER_PAINT_EXCLUDED,
    planningRangeLabel: `Planning range: $${range.low.toLocaleString()}–$${range.high.toLocaleString()}`,
    quantityLabel: formatDrywallPatchQuantityLine(
      params.sqft,
      params.combined ? 'Combined patch and paint scope' : 'User-entered patch area'
    ),
    wetAreaNote: DRYWALL_PAINT_WET_AREA_NOTE,
    disclaimer: DRYWALL_PAINT_PRICING_DISCLAIMER,
    includes: params.combined
      ? ([
          'Localized drywall patching',
          'Minor backing',
          'Tape and joint compound',
          'Sanding',
          'Basic texture blending',
          'Spot primer',
          'Standard interior paint',
          'Localized paint touch-up',
          'Labor, cleanup, overhead, and profit',
        ] as const)
      : DRYWALL_INCLUDES,
    excludes: params.combined
      ? ([
          'Full-wall repainting',
          'Full-room repainting',
          'Specialty texture matching',
          'Premium paint',
          'Wet-area substrate',
          'Waterproofing',
          'Water or mold remediation',
          'Structural repair',
        ] as const)
      : DRYWALL_EXCLUDES,
  };
}

export function formatBathroomDrywallPatchSqftHint(params: {
  showerWallTileSqft?: number | null;
}): string {
  const showerSf = params.showerWallTileSqft;
  if (showerSf != null && showerSf > 0) {
    const est = defaultBathroomDrywallPatchSqft({
      checklistItems: [{ id: 'shower_tile', state: 'included' }],
      showerWallTileSqft: showerSf,
    });
    return `Enter localized patch SF (wall surface, not floor). Openings near showers are often ~24–40 SF — about ${est} SF for your shower wall area.`;
  }
  return 'Enter localized patch SF at shower or plumbing openings (wall surface, not floor). Typical range: 24–40 SF.';
}

export function parseEnteredBathroomPatchSqft(params: {
  paintRepairQuantity?: number | null;
  paintRepairUnit?: string | null;
  sqftBasisQuantity?: number | null;
  wallPaintSqft?: string | number | null;
  /** @deprecated Legacy fallback — avoid for paint_repair card display/pricing. */
  drywallQuantity?: number | null;
  /** @deprecated Legacy fallback — avoid for paint_repair card display/pricing. */
  drywallSqft?: number | null;
}): number | null {
  if (params.sqftBasisQuantity != null && params.sqftBasisQuantity > 0) {
    return params.sqftBasisQuantity;
  }
  const unit = String(params.paintRepairUnit || 'sqft').toLowerCase();
  const wallSf = parseScopeMeasurementInput(String(params.wallPaintSqft ?? ''));
  if (
    (unit === 'each' || unit === 'allowance' || unit === 'lump_sum') &&
    wallSf != null &&
    wallSf > 0
  ) {
    return wallSf;
  }
  if (
    params.paintRepairQuantity != null &&
    params.paintRepairQuantity > 0 &&
    unit !== 'each' &&
    unit !== 'allowance' &&
    unit !== 'lump_sum'
  ) {
    return params.paintRepairQuantity;
  }
  if (wallSf != null && wallSf > 0) return wallSf;
  const legacy = [params.drywallQuantity, params.drywallSqft];
  for (const value of legacy) {
    if (value != null && value > 0) return value;
  }
  return null;
}

export function resolvePlanningBathroomPatchSqft(params: {
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
  showerWallTileSqft?: number | null;
  enteredPatchSqft?: number | null;
}): number {
  if (params.enteredPatchSqft != null && params.enteredPatchSqft > 0) {
    return params.enteredPatchSqft;
  }
  const estimated = defaultBathroomDrywallPatchSqft({
    checklistItems: params.checklistItems ?? undefined,
    showerWallTileSqft: params.showerWallTileSqft,
  });
  return estimated > 0 ? estimated : BATHROOM_DRYWALL_PATCH_REF_SQFT;
}

/** Kitchen remodel — localized patch + texture scaled from $400 @ 36 SF reference. */
export function resolveKitchenDrywallPatchSuggestedPricing(params: {
  quantity?: number | null;
}): ScopeItemSuggestedPricing | undefined {
  const sqft = params.quantity;
  if (sqft == null || !(sqft > 0)) return undefined;

  const details = buildDrywallPatchPricingDetails({ sqft, combined: false });

  return {
    fill: {
      material: details.material,
      labor: details.labor,
      total: details.total,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel:
        'Suggested budget split · Localized kitchen patch + texture (primer and paint separate)',
      helper: `${DRYWALL_PATCH_TEXTURE_INCLUDES_SCOPE} Paint is priced on the Paint line.`,
      mode: 'suggested_price',
      basis: { quantity: sqft, unit: 'sqft' },
      comparisonRange: details.range,
      pricingRecordId: `bps_national:drywall:kitchen_patch_texture:${sqft}sf`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: 'drywall',
      benchmarkAction: 'price_ready',
      storedTotalExact: details.total,
      splitConfidence: 'medium',
    },
    comparison: null,
  };
}

export function resolveBathroomDrywallPatchSuggestedPricing(params: {
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
  quantity?: number | null;
  showerWallTileSqft?: number | null;
  useCombinedAssembly?: boolean | null;
  paintRepairScope?: string | null;
  severity?: string | null;
}): ScopeItemSuggestedPricing | undefined {
  const items = params.checklistItems;
  if (!items?.length) return undefined;

  const sqft = params.quantity;
  if (sqft == null || !(sqft > 0)) return undefined;

  const combined = shouldUseCombinedDrywallPaintAssembly({
    useCombinedAssembly: params.useCombinedAssembly,
    paintRepairScope: params.paintRepairScope,
  });

  const severity = resolveBathroomPaintRepairSeverity(params.severity);
  const details = buildDrywallPatchPricingDetails({
    sqft,
    combined,
    severity: combined ? severity : undefined,
  });

  if (combined) {
    return {
      fill: {
        material: details.material,
        labor: details.labor,
        total: details.total,
        materialSource: 'national_average',
        laborSource: 'national_average',
        rateSourceLabel: 'Suggested budget split · Combined drywall, texture, primer, and localized paint',
        helper: `${DRYWALL_PAINT_COMBINED_SUMMARY_LABEL} ${DRYWALL_PAINT_WET_AREA_NOTE}`,
        mode: 'suggested_price',
        basis: { quantity: sqft, unit: 'sqft' },
        comparisonRange: details.range,
        pricingRecordId: `bps_national:drywall_paint:bathroom_combined:${severity}:${sqft}sf`,
        productionStatus: 'review_required',
        benchmarkLevel: 'component',
        benchmarkScopeKey: 'drywall',
        benchmarkAction: 'price_ready',
        storedTotalExact: details.total,
        splitConfidence: 'medium',
      },
      comparison: null,
    };
  }

  return {
    fill: {
      material: details.material,
      labor: details.labor,
      total: details.total,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'Suggested budget split · Based on selected remodel conditions',
      helper: `${DRYWALL_PATCH_TEXTURE_INCLUDES_SCOPE} ${DRYWALL_PAINT_WET_AREA_NOTE}`,
      mode: 'suggested_price',
      basis: { quantity: sqft, unit: 'sqft' },
      comparisonRange: details.range,
      pricingRecordId: `bps_national:drywall:bathroom_patch_texture:${sqft}sf`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: 'drywall',
      benchmarkAction: 'price_ready',
      storedTotalExact: details.total,
      splitConfidence: 'medium',
    },
    comparison: null,
  };
}

/** SF for paint_repair count from Quick measurements + selected paint scope. */
export function resolveBathroomPaintRepairQuantityFromMeasurements(params: {
  measurementsInput: ScopeMeasurementsInputExtended;
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
  paintRepairScope?: string | null;
}): number | null {
  void params.checklistItems;
  const fromQm = parseScopeMeasurementInput(
    String(params.measurementsInput.wallPaintSqft ?? '')
  );
  if (fromQm != null && fromQm > 0) return Math.round(fromQm);

  const scope = resolveBathroomPaintRepairScope(
    params.paintRepairScope ?? params.measurementsInput.bathroomPaintRepairScope
  );
  if (scope === 'full_room') {
    return defaultBathroomEntireRoomPaintSqft({
      wallPaintSqft: params.measurementsInput.wallPaintSqft,
      bathroomFloorSqft: params.measurementsInput.bathroomFloorSqft,
    });
  }
  return null;
}

/** Mirror Quick measurements Paint SF into paint_repair count and infer scope/combined defaults. */
export function syncBathroomPaintRepairItemQuantity(
  input: ScopeMeasurementsInputExtended,
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null
): ScopeMeasurementsInputExtended {
  return syncBathroomPaintRepairFlow(input, checklistItems);
}
