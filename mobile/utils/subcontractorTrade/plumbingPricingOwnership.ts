import {
  PLUMBING_CARDS,
  plumbingMeasurementKeyForItemId,
} from './plumbingPlanConvergence';

export type PlumbingPricingOwnership = {
  itemId: string;
  owns: string[];
  excludes: string[];
};

/**
 * Work ownership is explicit so rough, trim, fixtures, and lines cannot
 * silently charge the same operation twice.
 */
export const PLUMBING_PRICING_OWNERSHIP: PlumbingPricingOwnership[] = [
  {
    itemId: 'plumbing_rough',
    owns: ['new supply/drain/vent/fixture rough-in points'],
    excludes: ['fixture setting', 'trim hookups', 'line replacement'],
  },
  {
    itemId: 'plumbing_trim',
    owns: ['fixture trim and final connections'],
    excludes: ['fixture purchase', 'new rough-in', 'line replacement'],
  },
  {
    itemId: 'fixture_replace',
    owns: ['fixture setting, installation, or replacement at documented rough'],
    excludes: [
      'fixture purchase allowance',
      'new rough-in',
      'trim and final connection work',
    ],
  },
  {
    itemId: 'fixture_repair',
    owns: ['repair of an existing plumbing fixture'],
    excludes: ['replacement', 'new rough-in', 'line replacement'],
  },
  {
    itemId: 'water_line',
    owns: ['water-supply line replacement or installation'],
    excludes: ['fixture rough-in', 'fixture trim', 'drain cleaning'],
  },
  {
    itemId: 'sewer_line',
    owns: ['sewer, waste, or drain-line replacement'],
    excludes: ['drain cleaning', 'fixture rough-in', 'fixture trim'],
  },
  {
    itemId: 'gas_line',
    owns: ['documented gas piping and gas stubs'],
    excludes: [
      'appliance purchase',
      'fixture rough-in',
      'unverified gas routing',
    ],
  },
  {
    itemId: 'drain_cleaning',
    owns: ['drain-clearing service'],
    excludes: ['drain-line replacement', 'new rough-in'],
  },
  {
    itemId: 'parts_materials',
    owns: ['explicit unassigned parts/materials allowance'],
    excludes: ['materials already included in another selected card'],
  },
  {
    itemId: 'emergency_fee',
    owns: ['explicit after-hours or emergency fee'],
    excludes: ['ordinary service-call labor'],
  },
  {
    itemId: 'cleanup',
    owns: ['explicit plumbing cleanup/disposal'],
    excludes: ['ordinary installation labor'],
  },
];

export function plumbingPricingOwnerForItem(
  itemId: string | null | undefined
): PlumbingPricingOwnership | null {
  return PLUMBING_PRICING_OWNERSHIP.find(row => row.itemId === itemId) || null;
}

export function plumbingOwnershipByMeasurementKey(): Record<
  string,
  PlumbingPricingOwnership
> {
  return Object.fromEntries(
    PLUMBING_CARDS.map(card => [
      plumbingMeasurementKeyForItemId(card.itemId),
      plumbingPricingOwnerForItem(card.itemId),
    ])
  ) as Record<string, PlumbingPricingOwnership>;
}
