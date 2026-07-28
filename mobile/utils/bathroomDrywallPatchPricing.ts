import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import { wetAreaInScope } from '@/utils/bathroomPlumbingTrimPricing';
import {
  BATHROOM_DRYWALL_PATCH_REF_SQFT,
  DRYWALL_PATCH_PRIMER_PAINT_EXCLUDED,
  DRYWALL_PATCH_TEXTURE_INCLUDES_SCOPE,
  DRYWALL_PAINT_COMBINED_SUMMARY_LABEL,
  DRYWALL_PAINT_PRICING_DISCLAIMER,
  DRYWALL_PAINT_WET_AREA_NOTE,
  formatDrywallPatchQuantityLine,
  scaleBathroomRepairAllowance,
  shouldUseCombinedDrywallPaintAssembly,
  splitMaterialLabor,
} from '@/utils/bathroomDrywallPaintScope';
import { checklistItemInScope } from '@/utils/scopeItemQuantities';
import type { ScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';

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
}) {
  const scaledTotal = scaleBathroomRepairAllowance(
    params.combined ? COMBINED_BASE.total : DRYWALL_PATCH_BASE.total,
    params.sqft
  );
  const split = params.combined
    ? {
        material: round2(scaleBathroomRepairAllowance(COMBINED_BASE.material, params.sqft)),
        labor: round2(scaleBathroomRepairAllowance(COMBINED_BASE.labor, params.sqft)),
      }
    : splitMaterialLabor(scaledTotal, 0.25);
  const range = params.combined
    ? {
        low: scaleBathroomRepairAllowance(COMBINED_BASE.range.low, params.sqft),
        high: scaleBathroomRepairAllowance(COMBINED_BASE.range.high, params.sqft),
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
  drywallQuantity?: number | null;
  drywallSqft?: number | null;
}): number | null {
  const candidates = [params.paintRepairQuantity, params.drywallQuantity, params.drywallSqft];
  for (const value of candidates) {
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

export function resolveBathroomDrywallPatchSuggestedPricing(params: {
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
  quantity?: number | null;
  showerWallTileSqft?: number | null;
  useCombinedAssembly?: boolean | null;
  paintRepairScope?: string | null;
}): ScopeItemSuggestedPricing | undefined {
  const items = params.checklistItems;
  if (!items?.length) return undefined;

  const sqft = params.quantity;
  if (sqft == null || !(sqft > 0)) return undefined;

  const combined = shouldUseCombinedDrywallPaintAssembly({
    useCombinedAssembly: params.useCombinedAssembly,
    paintRepairScope: params.paintRepairScope,
  });

  const details = buildDrywallPatchPricingDetails({ sqft, combined });

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
        basis: { quantity: 1, unit: 'each' },
        comparisonRange: details.range,
        pricingRecordId: `bps_national:drywall_paint:bathroom_combined:${sqft}sf`,
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
