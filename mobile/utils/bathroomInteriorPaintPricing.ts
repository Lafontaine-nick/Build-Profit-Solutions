import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import {
  detectDrywallPaintInteriorOverlap,
  paintRepairInScope,
} from '@/utils/bathroomDrywallPaintScope';
import type { ScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';

export const INTERIOR_PAINT_BASE_RATE = 3.35;
export const INTERIOR_PAINT_MATERIAL_PER_SF = 0.85;
export const INTERIOR_PAINT_LABOR_PER_SF = 2.5;
export const INTERIOR_PAINT_STANDALONE_MINIMUM = 350;
export const INTERIOR_PAINT_MINIMUM_MATERIAL = 75;
export const INTERIOR_PAINT_MINIMUM_LABOR = 275;

export const INTERIOR_PAINT_INCLUDES_SCOPE =
  'Includes standard paint materials, preparation, and labor.';

export const INTERIOR_PAINT_BASE_RATE_NOTE =
  '$3.35/sq. ft. base rate with a $350 small-job minimum.';

export const INTERIOR_PAINT_SURFACE_BASIS_NOTE =
  'Painting quantity uses wall and ceiling surface area, not room floor area.';

export const INTERIOR_PAINT_MINIMUM_STATUS =
  'Small-job minimum applied for mobilization, preparation, masking, application, and cleanup.';

export const INTERIOR_PAINT_MEASURED_STATUS =
  'Pricing based on measured wall and ceiling surface area.';

export const INTERIOR_PAINT_SHORT_EXCLUDES =
  'Excludes drywall repair, texture repair, trim, doors, cabinets, specialty finishes, premium coatings, and major color changes.';

export const INTERIOR_PAINT_UNSURE_MOBILIZATION_STATUS =
  'Planning assumption — priced as a standalone small painting scope.';

export const INTERIOR_PAINT_DEFAULT_PLANNING_ASSUMPTION =
  'Priced as a standalone small painting scope using standard interior paint and a same-or-similar color.';

export const INTERIOR_PAINT_OVERLAP_WARNING =
  'Possible scope overlap: Painting for this area may already be included in Interior painting/patch and repair. Review before applying both prices.';

export type BathroomInteriorPaintMobilization = 'bundled' | 'standalone' | 'unsure';
export type BathroomInteriorPaintSurface = 'walls' | 'ceiling' | 'walls_and_ceiling' | 'unsure';
export type BathroomInteriorPaintCondition =
  | 'same_color'
  | 'color_change'
  | 'new_drywall'
  | 'stained_damaged'
  | 'unsure';

export const BATHROOM_INTERIOR_PAINT_MOBILIZATION_OPTIONS: Array<{
  id: BathroomInteriorPaintMobilization;
  label: string;
}> = [
  { id: 'bundled', label: 'Yes — painter is already mobilized' },
  { id: 'standalone', label: 'No — standalone painting scope' },
  { id: 'unsure', label: 'Not sure yet' },
];

export const BATHROOM_INTERIOR_PAINT_SURFACE_OPTIONS: Array<{
  id: BathroomInteriorPaintSurface;
  label: string;
}> = [
  { id: 'walls', label: 'Walls' },
  { id: 'ceiling', label: 'Ceiling' },
  { id: 'walls_and_ceiling', label: 'Walls and ceiling' },
  { id: 'unsure', label: 'Not sure yet' },
];

export const BATHROOM_INTERIOR_PAINT_CONDITION_OPTIONS: Array<{
  id: BathroomInteriorPaintCondition;
  label: string;
}> = [
  { id: 'same_color', label: 'Same or similar color' },
  { id: 'color_change', label: 'Major color change' },
  { id: 'new_drywall', label: 'New drywall' },
  { id: 'stained_damaged', label: 'Stained or damaged surface' },
  { id: 'unsure', label: 'Not sure yet' },
];

const INTERIOR_PAINT_INCLUDES = [
  'Standard interior wall or ceiling paint',
  'Spot primer where required',
  'Minor nail-hole filling',
  'Minor caulking',
  'Light surface preparation',
  'Spot sanding',
  "Painter's tape",
  'Masking plastic or paper',
  'Drop-cloth protection',
  'Roller covers and standard consumables',
  'One to two finish coats',
  'Application labor',
  'Setup and cleanup',
  'Standard contractor overhead and profit',
] as const;

const INTERIOR_PAINT_EXCLUDES = [
  'Drywall patching',
  'Drywall replacement',
  'Significant texture repair',
  'Full-wall skim coating',
  'Water-damage remediation',
  'Mold remediation',
  'Heavy stain blocking',
  'Extensive peeling-paint removal',
  'Lead or hazardous-material remediation',
  'Baseboard or trim painting',
  'Door painting',
  'Cabinet painting',
  'Specialty finishes',
  'Decorative coatings',
  'Premium paint upgrades',
  'Major furniture moving',
  'Difficult-access equipment',
  'Major color changes requiring additional coats',
] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function roundInteriorPaintPriceToNearest25(total: number): number {
  return Math.round(total / 25) * 25;
}

export function resolveInteriorPaintMobilization(
  value: string | null | undefined
): BathroomInteriorPaintMobilization {
  if (value === 'bundled' || value === 'standalone') return value;
  return 'unsure';
}

export function resolveInteriorPaintSurface(
  value: string | null | undefined
): BathroomInteriorPaintSurface {
  if (value === 'walls' || value === 'ceiling' || value === 'walls_and_ceiling') return value;
  return 'unsure';
}

export function resolveInteriorPaintCondition(
  value: string | null | undefined
): BathroomInteriorPaintCondition {
  if (
    value === 'same_color' ||
    value === 'color_change' ||
    value === 'new_drywall' ||
    value === 'stained_damaged'
  ) {
    return value;
  }
  return 'unsure';
}

export function interiorPaintConditionMultiplier(
  condition: BathroomInteriorPaintCondition
): number {
  if (condition === 'color_change') return 1.2;
  if (condition === 'new_drywall') return 1.15;
  if (condition === 'stained_damaged') return 1.3;
  return 1;
}

export function interiorPaintSurfaceMultiplier(surface: BathroomInteriorPaintSurface): number {
  if (surface === 'ceiling') return 1.1;
  return 1;
}

export function isInteriorPaintSuggestedBlock(pricingRecordId?: string | null): boolean {
  return String(pricingRecordId || '').startsWith('bps_national:interior_paint:bathroom:');
}

export function interiorPaintContextFromPricingRecord(pricingRecordId?: string | null): {
  sqft: number;
  mobilization: BathroomInteriorPaintMobilization;
  surface: BathroomInteriorPaintSurface;
  condition: BathroomInteriorPaintCondition;
} | null {
  if (!isInteriorPaintSuggestedBlock(pricingRecordId)) return null;
  const parts = String(pricingRecordId).split(':');
  if (parts.length < 8) return null;
  const sqft = Number(parts[4]?.replace(/sf$/, ''));
  if (!Number.isFinite(sqft) || sqft <= 0) return null;
  return {
    sqft,
    mobilization: resolveInteriorPaintMobilization(parts[5]),
    surface: resolveInteriorPaintSurface(parts[6]),
    condition: resolveInteriorPaintCondition(parts[7]),
  };
}

export function splitInteriorPaintMaterialLabor(total: number, minimumApplied: boolean): {
  material: number;
  labor: number;
} {
  if (minimumApplied) {
    const ratio = INTERIOR_PAINT_MINIMUM_MATERIAL / INTERIOR_PAINT_STANDALONE_MINIMUM;
    const material = round2(total * ratio);
    return { material, labor: round2(total - material) };
  }
  const ratio = INTERIOR_PAINT_MATERIAL_PER_SF / INTERIOR_PAINT_BASE_RATE;
  const material = round2(total * ratio);
  return { material, labor: round2(total - material) };
}

export function computeInteriorPaintSuggestedTotal(params: {
  sqft: number;
  mobilization: BathroomInteriorPaintMobilization;
  surface: BathroomInteriorPaintSurface;
  condition: BathroomInteriorPaintCondition;
}): { total: number; rawTotal: number; minimumApplied: boolean } {
  const rate =
    INTERIOR_PAINT_BASE_RATE *
    interiorPaintConditionMultiplier(params.condition) *
    interiorPaintSurfaceMultiplier(params.surface);
  const rawTotal = round2(params.sqft * rate);

  if (params.mobilization === 'bundled') {
    return {
      rawTotal,
      total: roundInteriorPaintPriceToNearest25(rawTotal),
      minimumApplied: false,
    };
  }

  const withMinimum = Math.max(rawTotal, INTERIOR_PAINT_STANDALONE_MINIMUM);
  const total = roundInteriorPaintPriceToNearest25(withMinimum);
  const minimumApplied = rawTotal < INTERIOR_PAINT_STANDALONE_MINIMUM || total <= INTERIOR_PAINT_STANDALONE_MINIMUM;
  return { rawTotal, total, minimumApplied };
}

export function formatInteriorPaintEffectiveRate(total: number, sqft: number): string {
  if (!(sqft > 0)) return '';
  const rate = total / sqft;
  const decimals = rate >= 10 ? 2 : 2;
  return `$${rate.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}/sq. ft. effective rate`;
}

export function buildInteriorPaintPricingDetails(params: {
  sqft: number;
  mobilization: BathroomInteriorPaintMobilization;
  surface: BathroomInteriorPaintSurface;
  condition: BathroomInteriorPaintCondition;
  total: number;
  minimumApplied: boolean;
}) {
  const { material, labor } = splitInteriorPaintMaterialLabor(params.total, params.minimumApplied);
  return {
    material,
    labor,
    total: params.total,
    includesScopeLine: INTERIOR_PAINT_INCLUDES_SCOPE,
    baseRateNote: INTERIOR_PAINT_BASE_RATE_NOTE,
    surfaceBasisNote: INTERIOR_PAINT_SURFACE_BASIS_NOTE,
    effectiveRateLabel: formatInteriorPaintEffectiveRate(params.total, params.sqft),
    statusLine: params.minimumApplied
      ? INTERIOR_PAINT_MINIMUM_STATUS
      : INTERIOR_PAINT_MEASURED_STATUS,
    planningAssumption:
      params.mobilization === 'unsure'
        ? INTERIOR_PAINT_UNSURE_MOBILIZATION_STATUS
        : params.mobilization === 'standalone' &&
            (params.condition === 'same_color' || params.condition === 'unsure')
          ? INTERIOR_PAINT_DEFAULT_PLANNING_ASSUMPTION
          : params.condition === 'unsure'
            ? INTERIOR_PAINT_DEFAULT_PLANNING_ASSUMPTION
            : null,
    shortExcludesLine: INTERIOR_PAINT_SHORT_EXCLUDES,
    includes: [...INTERIOR_PAINT_INCLUDES],
    excludes: [...INTERIOR_PAINT_EXCLUDES],
    confidence:
      params.mobilization === 'unsure' || params.condition === 'unsure' ? ('low' as const) : ('medium' as const),
  };
}

export function detectInteriorPaintRepairOverlap(params: {
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
  paintRepairScope?: string | null;
  paintRepairEntireRoom?: boolean | null;
}): boolean {
  return (
    detectDrywallPaintInteriorOverlap({
      checklistItems: params.checklistItems,
      paintRepairScope: params.paintRepairScope ?? 'affected_area',
      paintRepairEntireRoom: params.paintRepairEntireRoom,
    }) && paintRepairInScope(params.checklistItems)
  );
}

export function resolveBathroomInteriorPaintSuggestedPricing(params: {
  sqft?: number | null;
  mobilization?: string | null;
  surface?: string | null;
  condition?: string | null;
  itemId?: string;
}): ScopeItemSuggestedPricing | undefined {
  const sqft = params.sqft;
  if (sqft == null || !(sqft > 0)) return undefined;

  const mobilization = resolveInteriorPaintMobilization(params.mobilization);
  const surface = resolveInteriorPaintSurface(params.surface);
  const condition = resolveInteriorPaintCondition(params.condition);
  const { total, minimumApplied } = computeInteriorPaintSuggestedTotal({
    sqft,
    mobilization,
    surface,
    condition,
  });
  const details = buildInteriorPaintPricingDetails({
    sqft,
    mobilization,
    surface,
    condition,
    total,
    minimumApplied,
  });

  let helper = `${details.includesScopeLine} ${details.surfaceBasisNote}`;
  if (details.planningAssumption) helper = `${details.planningAssumption} ${helper}`;
  if (minimumApplied) helper = `${INTERIOR_PAINT_MINIMUM_STATUS} ${helper}`;

  const scopeKey = params.itemId === 'paint' ? 'paint' : 'interior_paint';

  return {
    fill: {
      material: details.material,
      labor: details.labor,
      total: details.total,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'National-average planning allowance',
      helper,
      mode: 'suggested_price',
      basis: { quantity: sqft, unit: 'sqft' },
      comparisonRange: {
        low: roundInteriorPaintPriceToNearest25(total * 0.85),
        high: roundInteriorPaintPriceToNearest25(total * 1.2),
      },
      pricingRecordId: `bps_national:interior_paint:bathroom:${sqft}sf:${mobilization}:${surface}:${condition}`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: scopeKey,
      benchmarkAction: 'price_ready',
      storedTotalExact: details.total,
      splitConfidence: details.confidence,
    },
    comparison: null,
  };
}

export function formatInteriorPaintSuggestedTitle(): string {
  return 'Interior painting — prep, labor, and paint';
}

export function formatInteriorPaintQuantityLine(sqft: number, provenance?: string | null): string {
  const label = `${sqft} sq. ft. · ${provenance || 'User-entered wall/ceiling surface area'}`;
  return label;
}
