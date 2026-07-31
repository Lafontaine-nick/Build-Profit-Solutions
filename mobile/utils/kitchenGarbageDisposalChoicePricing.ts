import type { ScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';

export type KitchenGarbageDisposalChoiceId =
  | 'reuse_install'
  | 'replace_install'
  | 'not_in_scope'
  | 'unsure';

const KITCHEN_GARBAGE_DISPOSAL_CHOICE_IDS = new Set<KitchenGarbageDisposalChoiceId>([
  'reuse_install',
  'replace_install',
  'not_in_scope',
  'unsure',
]);

/** Remove existing unit and reinstall at the same drain — labor-heavy. */
const GARBAGE_DISPOSAL_REUSE_EACH = {
  material: 20,
  labor: 120,
  total: 140,
  range: { low: 100, high: 185 },
} as const;

/** New disposal unit + install at existing rough-in. */
const GARBAGE_DISPOSAL_REPLACE_EACH = {
  material: 185,
  labor: 215,
  total: 400,
  range: { low: 300, high: 525 },
} as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeChoiceId(choiceId?: string | null): KitchenGarbageDisposalChoiceId | null {
  if (!choiceId || !KITCHEN_GARBAGE_DISPOSAL_CHOICE_IDS.has(choiceId as KitchenGarbageDisposalChoiceId)) {
    return null;
  }
  return choiceId as KitchenGarbageDisposalChoiceId;
}

function buildReuseInstallPricing(count: number): ScopeItemSuggestedPricing {
  const material = round2(GARBAGE_DISPOSAL_REUSE_EACH.material * count);
  const labor = round2(GARBAGE_DISPOSAL_REUSE_EACH.labor * count);
  const total = round2(GARBAGE_DISPOSAL_REUSE_EACH.total * count);
  return {
    fill: {
      material,
      labor,
      total,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'Suggested budget split · National Average · disposal reuse/install',
      helper: `${count.toLocaleString()} each · remove & reinstall existing disposal at same drain`,
      mode: 'suggested_price',
      basis: { quantity: count, unit: 'each' },
      splitSource: 'source',
      splitConfidence: 'medium',
      comparisonRange: {
        low: round2(GARBAGE_DISPOSAL_REUSE_EACH.range.low * count),
        high: round2(GARBAGE_DISPOSAL_REUSE_EACH.range.high * count),
      },
      costBuckets: [
        {
          key: 'material',
          label: 'Reuse supplies (flange, cord, hardware)',
          amount: material,
          rate: GARBAGE_DISPOSAL_REUSE_EACH.material,
          source: 'national_average',
        },
        {
          key: 'labor',
          label: 'Disposal remove & reinstall labor',
          amount: labor,
          rate: GARBAGE_DISPOSAL_REUSE_EACH.labor,
          source: 'national_average',
        },
      ],
      pricingRecordId: 'bps_national:garbage_disposal:reuse_install:1ea',
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: 'garbage_disposal',
      benchmarkAction: 'price_ready',
      storedTotalExact: total,
      impliedUnitRateLabel: `$${GARBAGE_DISPOSAL_REUSE_EACH.total.toLocaleString()}/each`,
    },
    comparison: null,
  };
}

export function isKitchenGarbageDisposalChoiceScope(
  itemId: string,
  templateKey?: string | null
): boolean {
  if (String(templateKey || '').toLowerCase() !== 'kitchen') return false;
  return itemId === 'garbage_disposal';
}

/**
 * Kitchen garbage disposal choice pricing.
 * - `undefined` → fall through to default national-average resolver (replace/install).
 * - `{ fill: null }` → choice handled; no suggested price.
 * - `{ fill: {...} }` → reuse/install band.
 */
export function resolveKitchenGarbageDisposalChoiceSuggestedPricing(params: {
  itemId: string;
  templateKey?: string | null;
  choiceId?: string | null;
  quantity?: number | null;
  unit?: string | null;
}): ScopeItemSuggestedPricing | undefined {
  if (!isKitchenGarbageDisposalChoiceScope(params.itemId, params.templateKey)) return undefined;

  const choiceId = normalizeChoiceId(params.choiceId);
  if (!choiceId || choiceId === 'not_in_scope' || choiceId === 'unsure') return undefined;

  if (choiceId === 'replace_install') return undefined;

  if (choiceId === 'reuse_install') {
    const count =
      params.unit === 'each' && params.quantity != null && params.quantity > 0 ? params.quantity : 1;
    return buildReuseInstallPricing(count);
  }

  return undefined;
}

export const KITCHEN_GARBAGE_DISPOSAL_CHOICE_PRICING = {
  reuseEach: GARBAGE_DISPOSAL_REUSE_EACH,
  replaceEach: GARBAGE_DISPOSAL_REPLACE_EACH,
} as const;
