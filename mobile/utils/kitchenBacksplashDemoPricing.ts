import type { ScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';

export type KitchenBacksplashDemoDifficulty =
  | 'light'
  | 'moderate'
  | 'extensive'
  | 'unsure';

export const KITCHEN_BACKSPLASH_DEMO_DIFFICULTY_OPTIONS: Array<{
  id: KitchenBacksplashDemoDifficulty;
  label: string;
  ratePerSqft: number;
}> = [
  { id: 'light', label: 'Light — tile over drywall', ratePerSqft: 4.5 },
  { id: 'moderate', label: 'Moderate — standard tile removal', ratePerSqft: 7.5 },
  { id: 'extensive', label: 'Extensive — mortar bed or stubborn adhesive', ratePerSqft: 12 },
  { id: 'unsure', label: 'Not sure yet', ratePerSqft: 7.5 },
];

const MATERIAL_SHARE = 0.1;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveKitchenBacksplashDemoDifficulty(
  value: string | null | undefined
): KitchenBacksplashDemoDifficulty | null {
  if (
    value === 'light' ||
    value === 'moderate' ||
    value === 'extensive' ||
    value === 'unsure'
  ) {
    return value;
  }
  return null;
}

export function effectiveKitchenBacksplashDemoDifficulty(
  stored: KitchenBacksplashDemoDifficulty | null
): Exclude<KitchenBacksplashDemoDifficulty, 'unsure'> {
  if (stored === 'light' || stored === 'extensive') return stored;
  return 'moderate';
}

export function backsplashDemoRatePerSqft(
  difficulty: KitchenBacksplashDemoDifficulty | null
): number {
  const effective = effectiveKitchenBacksplashDemoDifficulty(
    difficulty === 'unsure' ? 'unsure' : difficulty
  );
  const option = KITCHEN_BACKSPLASH_DEMO_DIFFICULTY_OPTIONS.find(
    opt => opt.id === effective
  );
  return option?.ratePerSqft ?? 7.5;
}

export function isBacksplashDemoSuggestedBlock(
  pricingRecordId?: string | null
): boolean {
  return String(pricingRecordId || '').startsWith(
    'bps_national:backsplash_demo:kitchen:'
  );
}

export function backsplashDemoContextFromPricingRecord(
  pricingRecordId?: string | null
): {
  difficulty: KitchenBacksplashDemoDifficulty;
  sqft: number;
} | null {
  if (!isBacksplashDemoSuggestedBlock(pricingRecordId)) return null;
  const parts = String(pricingRecordId).split(':');
  if (parts.length < 6) return null;
  const sqft = Number(parts[5]?.replace(/sf$/, ''));
  if (!Number.isFinite(sqft) || sqft <= 0) return null;
  return {
    difficulty: resolveKitchenBacksplashDemoDifficulty(parts[4]) ?? 'moderate',
    sqft,
  };
}

export function formatBacksplashDemoDifficultyLabel(
  difficulty: KitchenBacksplashDemoDifficulty | null
): string {
  const stored = difficulty ?? 'moderate';
  const option = KITCHEN_BACKSPLASH_DEMO_DIFFICULTY_OPTIONS.find(
    opt => opt.id === stored
  );
  return option?.label ?? 'Moderate — standard tile removal';
}

export function buildBacksplashDemoPricingDetails(params: {
  sqft: number;
  difficulty: KitchenBacksplashDemoDifficulty | null;
}) {
  const stored = params.difficulty;
  const effective = effectiveKitchenBacksplashDemoDifficulty(
    stored === 'unsure' ? 'unsure' : stored
  );
  const rate = backsplashDemoRatePerSqft(stored);
  const total = round2(params.sqft * rate);
  const material = round2(total * MATERIAL_SHARE);
  const labor = round2(total - material);
  const tierLabel =
    KITCHEN_BACKSPLASH_DEMO_DIFFICULTY_OPTIONS.find(opt => opt.id === effective)
      ?.label ?? 'Moderate — standard tile removal';

  return {
    material,
    labor,
    total,
    rate,
    sqft: params.sqft,
    stored,
    effective,
    tierLabel,
    planningAssumption:
      stored === 'unsure' || stored === null
        ? stored === 'unsure'
          ? 'Planning allowance — priced as moderate removal until difficulty is confirmed.'
          : null
        : null,
    confidence:
      stored === 'unsure' || stored === null ? ('low' as const) : ('medium' as const),
    helper: `Based on ${params.sqft.toLocaleString()} sqft · $${rate.toFixed(2)}/SF ${effective} removal`,
  };
}

export function resolveKitchenBacksplashDemoSuggestedPricing(params: {
  sqft?: number | null;
  difficulty?: string | null;
}): ScopeItemSuggestedPricing | undefined {
  const sqft = Number(params.sqft);
  if (!Number.isFinite(sqft) || sqft <= 0) return undefined;

  const stored = resolveKitchenBacksplashDemoDifficulty(params.difficulty);
  const details = buildBacksplashDemoPricingDetails({ sqft, difficulty: stored });
  const effective = details.effective;

  let helper = details.helper;
  if (details.planningAssumption) {
    helper = `${details.planningAssumption} ${helper}`;
  }

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
      lumpSumOnly: false,
      basis: { quantity: sqft, unit: 'sqft' },
      benchmarkAction: 'price_ready',
      pricingRecordId: `bps_national:backsplash_demo:kitchen:${stored ?? 'moderate'}:${sqft}sf`,
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: 'backsplash_demo',
      storedTotalExact: details.total,
      splitConfidence: details.confidence,
    },
    comparison: null,
  };
}
