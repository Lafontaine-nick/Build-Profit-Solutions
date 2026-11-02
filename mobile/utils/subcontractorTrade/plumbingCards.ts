import type { ScopePricingBehavior } from './scopePricingBehavior';

export type PlumbingQuantityKey =
  | 'serviceCallCount'
  | 'fixtureRepairCount'
  | 'fixtureReplacementCount'
  | 'drainCleaningCount'
  | 'waterLineLf'
  | 'sewerLineLf'
  | 'gasLineLf'
  | 'plumbingRoughPointCount'
  | 'plumbingTrimHookupCount'
  | 'plumbingFixturesHardwareCount'
  | 'waterHeaterCount'
  | 'gasApplianceConnectionCount'
  | 'partsMaterialsCount'
  | 'emergencyFeeCount'
  | 'plumbingCleanupCount';

export type PlumbingCardGroupId =
  | 'service'
  | 'fixtures'
  | 'equipment'
  | 'lines'
  | 'rough_trim'
  | 'closeout';

export type PlumbingCardDefinition = {
  itemId: string;
  measurementKey: PlumbingQuantityKey;
  label: string;
  helper: string;
  unit: 'each' | 'lf' | 'allowance';
  groupId: PlumbingCardGroupId;
  groupTitle: string;
  pricingBehavior: ScopePricingBehavior;
};

const P = (
  itemId: string,
  measurementKey: PlumbingQuantityKey,
  label: string,
  helper: string,
  groupId: PlumbingCardGroupId,
  pricingBehavior: ScopePricingBehavior,
  unit: PlumbingCardDefinition['unit'] = 'each'
): PlumbingCardDefinition => ({
  itemId,
  measurementKey,
  label,
  helper,
  unit,
  groupId,
  groupTitle:
    {
      service: 'Service / repairs',
      fixtures: 'Fixtures / drain service',
      equipment: 'Fixtures & equipment',
      lines: 'Water / sewer / gas lines',
      rough_trim: 'Rough-in / trim',
      closeout: 'Materials / closeout',
    }[groupId] || groupId,
  pricingBehavior,
});

export const PLUMBING_CARDS: PlumbingCardDefinition[] = [
  P(
    'service_call',
    'serviceCallCount',
    'Plumbing service call',
    'Explicit service-call visits only. Do not infer a service call from a fixture, line, or plan symbol.',
    'service',
    'CUSTOM_PRICE'
  ),
  P(
    'fixture_repair',
    'fixtureRepairCount',
    'Plumbing fixture repair',
    'Repair existing plumbing fixtures only. Replacement, installation, and new rough-in are separate cards.',
    'fixtures',
    'CUSTOM_PRICE'
  ),
  P(
    'fixture_replace',
    'fixtureReplacementCount',
    'Plumbing fixture replacement',
    'Set, install, or replace fixtures at documented rough. Fixture purchase, trim hookups, and relocated rough-in remain separate.',
    'fixtures',
    'CUSTOM_PRICE'
  ),
  P(
    'drain_cleaning',
    'drainCleaningCount',
    'Drain cleaning',
    'Explicit drain-clearing service only. Drain-line replacement or new rough-in is separate.',
    'fixtures',
    'CUSTOM_PRICE'
  ),
  P(
    'water_line',
    'waterLineLf',
    'Water line piping',
    'Explicit water-supply line work. Quantity is linear feet when documented; do not infer LF from living area or fixture count.',
    'lines',
    'CUSTOM_PRICE',
    'lf'
  ),
  P(
    'sewer_line',
    'sewerLineLf',
    'Sewer / drain piping',
    'Explicit sewer, building-drain, or drain-line work. Quantity is linear feet when documented; cleaning and rough-in are separate.',
    'lines',
    'CUSTOM_PRICE',
    'lf'
  ),
  P(
    'gas_line',
    'gasLineLf',
    'Gas piping',
    'Explicit gas piping or gas stub work shown or noted on the plan. Do not infer gas piping from appliance symbols alone.',
    'lines',
    'CUSTOM_PRICE',
    'lf'
  ),
  P(
    'plumbing_rough',
    'plumbingRoughPointCount',
    'Plumbing rough-in',
    'Supply, drain, vent, or fixture rough-in points only. Fixture setting, trim hookups, and line replacement are separate. Do not use living SF as the quantity.',
    'rough_trim',
    'CUSTOM_PRICE'
  ),
  P(
    'plumbing_trim',
    'plumbingTrimHookupCount',
    'Plumbing trim / hookups',
    'Fixture trim and connection work only. Do not include fixture purchases, new rough-in, or line replacement.',
    'rough_trim',
    'CUSTOM_PRICE'
  ),
  P(
    'plumbing_fixtures_hardware',
    'plumbingFixturesHardwareCount',
    'Plumbing fixture allowance',
    'Builder-grade fixture product allowance — toilets, faucets, shower trim, tub valves, sinks, and drains. Rough-in and trim hookup labor are separate.',
    'equipment',
    'CUSTOM_PRICE'
  ),
  P(
    'water_heater',
    'waterHeaterCount',
    'Water heater',
    'Water heater supply and set for tank or tankless when documented. Gas stub, electrical hookup, and appliance gas connections are separate.',
    'equipment',
    'CUSTOM_PRICE'
  ),
  P(
    'gas_appliance_connections',
    'gasApplianceConnectionCount',
    'Gas appliance connections',
    'Final gas hookups to range, fireplace, dryer, or grill at documented stubs. Gas piping LF and water heater set are separate.',
    'lines',
    'CUSTOM_PRICE'
  ),
  P(
    'parts_materials',
    'partsMaterialsCount',
    'Plumbing parts / materials',
    'Explicit parts or materials allowance not already included in another plumbing card. Do not infer from detected fixtures.',
    'closeout',
    'ALLOWANCE',
    'allowance'
  ),
  P(
    'emergency_fee',
    'emergencyFeeCount',
    'Emergency plumbing fee',
    'Explicit emergency, after-hours, or dispatch fee only. Never infer from the word plumbing.',
    'closeout',
    'ALLOWANCE',
    'allowance'
  ),
  P(
    'cleanup',
    'plumbingCleanupCount',
    'Plumbing cleanup',
    'Explicit plumbing cleanup and disposal only. Do not auto-add cleanup from a plan detection.',
    'closeout',
    'ALLOWANCE',
    'allowance'
  ),
];

export const PLUMBING_ITEM_IDS = PLUMBING_CARDS.map(card => card.itemId);
export const PLUMBING_QUANTITY_KEYS = PLUMBING_CARDS.map(
  card => card.measurementKey
) as PlumbingQuantityKey[];
export const PLUMBING_REVIEW_MEASUREMENT_KEYS = [
  ...PLUMBING_QUANTITY_KEYS,
] as PlumbingQuantityKey[];
export const PLUMBING_SCOPE_ALLOWLIST = [...PLUMBING_ITEM_IDS] as const;
export const PLUMBING_PLAN_QUICK_MEASUREMENT_KEYS = [
  'plumbingRoughPointCount',
  'plumbingTrimHookupCount',
  'plumbingFixturesHardwareCount',
  'waterHeaterCount',
  'gasApplianceConnectionCount',
  'waterLineLf',
  'sewerLineLf',
  'gasLineLf',
] as const;

export const PLUMBING_PLAN_EXPORT_CHECKLIST_GROUPS: Array<{
  title: string;
  itemIds: string[];
}> = [
  {
    title: 'Underground',
    itemIds: ['water_line', 'sewer_line'],
  },
  {
    title: 'Rough plumbing',
    itemIds: ['plumbing_rough', 'gas_line'],
  },
  {
    title: 'Finish plumbing',
    itemIds: [
      'plumbing_trim',
      'plumbing_fixtures_hardware',
      'water_heater',
      'gas_appliance_connections',
    ],
  },
  {
    title: 'Service / repairs',
    itemIds: [
      'service_call',
      'fixture_repair',
      'fixture_replace',
      'drain_cleaning',
    ],
  },
  {
    title: 'Materials / closeout',
    itemIds: ['parts_materials', 'emergency_fee', 'cleanup'],
  },
];

