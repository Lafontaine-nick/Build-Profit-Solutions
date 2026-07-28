import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import { checklistItemInScope } from '@/utils/scopeItemQuantities';
import type { ScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';

/** Trim-out labor + minor supplies — not fixture purchases on other lines. */
const LAV_FAUCET_HOOKUP = { material: 85, labor: 215 } as const;
const SHOWER_TUB_TRIM = { material: 65, labor: 185 } as const;
/** Only when toilet is not a separate Fixtures line. */
const TOILET_HOOKUP = { material: 50, labor: 150 } as const;

const WET_AREA_SCOPE_IDS = new Set([
  'waterproofing',
  'wet_area_install',
  'tub_install',
  'prefab_shower_pan',
  'prefab_shower_enclosure',
  'shower_pan',
  'shower_tile',
  'shower_floor_tile',
  'tub_shower',
  'glass_door',
]);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function itemInScope(
  items: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null | undefined,
  id: string
): boolean {
  const item = items?.find((row) => row.id === id);
  return Boolean(item && checklistItemInScope(item));
}

function wetAreaInScope(
  items: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null | undefined
): boolean {
  return Boolean(items?.some((row) => WET_AREA_SCOPE_IDS.has(row.id) && checklistItemInScope(row)));
}

export { wetAreaInScope, WET_AREA_SCOPE_IDS };

/**
 * Bathroom trim-out pricing that avoids double-counting toilet, vanity, and countertop
 * when those are separate Fixtures checklist rows.
 */
export function resolveBathroomPlumbingTrimSuggestedPricing(params: {
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
}): ScopeItemSuggestedPricing | undefined {
  const items = params.checklistItems;
  if (!items?.length) return undefined;

  const toiletSeparate = itemInScope(items, 'toilet');
  const vanitySeparate = itemInScope(items, 'vanity');
  const wetArea = wetAreaInScope(items);

  let material = 0;
  let labor = 0;
  if (vanitySeparate) {
    material += LAV_FAUCET_HOOKUP.material;
    labor += LAV_FAUCET_HOOKUP.labor;
  }
  if (wetArea) {
    material += SHOWER_TUB_TRIM.material;
    labor += SHOWER_TUB_TRIM.labor;
  }
  if (!toiletSeparate) {
    material += TOILET_HOOKUP.material;
    labor += TOILET_HOOKUP.labor;
  }

  if (material + labor <= 0) {
    return { fill: null, comparison: null };
  }

  const total = round2(material + labor);
  const helper =
    toiletSeparate && vanitySeparate
      ? 'Lav faucet + shower/tub trim hookups — toilet and vanity installs are on their own lines.'
      : toiletSeparate
        ? 'Shower/tub trim and lav hookups — toilet install is on its own line.'
        : 'Fixture trim-out hookups — excludes rough-in and fixture purchases on other lines.';

  return {
    fill: {
      material: round2(material),
      labor: round2(labor),
      total,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel:
        'Suggested budget split · National Average · bath trim-out hookups (excludes separate fixture lines)',
      helper,
      mode: 'suggested_price',
      basis: { quantity: 1, unit: 'allowance' },
      comparisonRange: { low: Math.round(total * 0.75), high: Math.round(total * 1.35) },
      pricingRecordId: 'bps_national:plumbing_trim:bathroom_trim_out',
      productionStatus: 'review_required',
      benchmarkLevel: 'component',
      benchmarkScopeKey: 'plumbing_trim',
      benchmarkAction: 'price_ready',
      storedTotalExact: total,
    },
    comparison: null,
  };
}
