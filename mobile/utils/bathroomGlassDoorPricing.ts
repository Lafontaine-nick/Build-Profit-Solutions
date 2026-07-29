import type { ScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';

export type BathroomGlassDoorStyle = 'standard_slider' | 'premium_frameless' | 'unsure';

export const BATHROOM_GLASS_DOOR_STYLE_OPTIONS: Array<{
  id: BathroomGlassDoorStyle;
  label: string;
}> = [
  { id: 'standard_slider', label: 'Standard sliding door (framed or semi-frameless)' },
  { id: 'premium_frameless', label: 'Premium frameless slider or enclosure' },
  { id: 'unsure', label: 'Not sure yet' },
];

export const GLASS_DOOR_DOOR_ONLY_NOTE =
  'Installed shower door only — bath mirror, towel bars, and accessories are separate lines.';

export const GLASS_DOOR_RETAIL_BENCHMARK_NOTE =
  'Planning allowance — retail door kits are often $700–$1,200; price includes professional install and contractor overhead.';

const STYLE_BANDS: Record<
  Exclude<BathroomGlassDoorStyle, 'unsure'>,
  { material: number; labor: number; total: number; range: { low: number; high: number } }
> = {
  standard_slider: {
    material: 835,
    labor: 615,
    total: 1450,
    range: { low: 1200, high: 1900 },
  },
  premium_frameless: {
    material: 1550,
    labor: 950,
    total: 2500,
    range: { low: 2100, high: 3200 },
  },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveBathroomGlassDoorStyle(
  value: string | null | undefined
): BathroomGlassDoorStyle {
  if (value === 'standard_slider' || value === 'premium_frameless') return value;
  return 'unsure';
}

export function resolveBathroomGlassDoorDoorCount(params: {
  quantity?: number | null;
  showerDoorCount?: number | null;
}): number {
  if (params.quantity != null && params.quantity > 0) return Math.round(params.quantity);
  if (params.showerDoorCount != null && params.showerDoorCount > 0) {
    return Math.round(params.showerDoorCount);
  }
  return 1;
}

export function isGlassDoorSuggestedBlock(pricingRecordId?: string | null): boolean {
  return String(pricingRecordId || '').startsWith('bps_national:glass_door:bathroom:');
}

export function glassDoorContextFromPricingRecord(pricingRecordId?: string | null): {
  style: BathroomGlassDoorStyle;
  doorCount: number;
} | null {
  if (!isGlassDoorSuggestedBlock(pricingRecordId)) return null;
  const parts = String(pricingRecordId).split(':');
  if (parts.length < 6) return null;
  const doorCount = Number(parts[5]?.replace(/ea$/, ''));
  if (!Number.isFinite(doorCount) || doorCount <= 0) return null;
  return {
    style: resolveBathroomGlassDoorStyle(parts[4]),
    doorCount,
  };
}

export function formatGlassDoorSuggestedTitle(style: BathroomGlassDoorStyle): string {
  if (style === 'premium_frameless') return 'Premium frameless shower door — installed';
  if (style === 'standard_slider') return 'Standard sliding shower door — installed';
  return 'Shower door — installed';
}

export function formatGlassDoorQuantityLine(doorCount: number, style: BathroomGlassDoorStyle): string {
  const label = doorCount === 1 ? '1 shower door' : `${doorCount} shower doors`;
  if (style === 'premium_frameless') return `${label} · Premium frameless slider`;
  if (style === 'standard_slider') return `${label} · Standard sliding door`;
  return `${label} · Style TBD`;
}

export function buildGlassDoorPricingDetails(params: {
  style: BathroomGlassDoorStyle;
  doorCount: number;
}) {
  const effectiveStyle =
    params.style === 'unsure' ? ('standard_slider' as const) : params.style;
  const band = STYLE_BANDS[effectiveStyle];
  const total = round2(band.total * params.doorCount);
  const material = round2(band.material * params.doorCount);
  const labor = round2(total - material);
  const perDoor = band.total;
  return {
    material,
    labor,
    total,
    perDoor,
    style: params.style,
    effectiveStyle,
    doorCount: params.doorCount,
    range: {
      low: band.range.low * params.doorCount,
      high: band.range.high * params.doorCount,
    },
    includesScopeLine: GLASS_DOOR_DOOR_ONLY_NOTE,
    benchmarkNote: GLASS_DOOR_RETAIL_BENCHMARK_NOTE,
    planningAssumption:
      params.style === 'unsure'
        ? 'Planning assumption — priced as a standard sliding shower door until style is confirmed.'
        : null,
    confidence: params.style === 'unsure' ? ('low' as const) : ('medium' as const),
  };
}

export function resolveBathroomGlassDoorSuggestedPricing(params: {
  quantity?: number | null;
  showerDoorCount?: number | null;
  style?: string | null;
}): ScopeItemSuggestedPricing | undefined {
  const doorCount = resolveBathroomGlassDoorDoorCount(params);
  if (!(doorCount > 0)) return undefined;

  const style = resolveBathroomGlassDoorStyle(params.style);
  const details = buildGlassDoorPricingDetails({ style, doorCount });

  let helper = `${details.includesScopeLine} ${details.benchmarkNote}`;
  if (details.planningAssumption) helper = `${details.planningAssumption} ${helper}`;

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
      basis: { quantity: doorCount, unit: 'each' },
      comparisonRange: details.range,
      pricingRecordId: `bps_national:glass_door:bathroom:${style}:${doorCount}ea`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: 'glass_door',
      benchmarkAction: 'price_ready',
      storedTotalExact: details.total,
      splitConfidence: details.confidence,
    },
    comparison: null,
  };
}
