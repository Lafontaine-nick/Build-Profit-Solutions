/**
 * Canonical Plumbing architecture.
 *
 * Notes/Voice, manual entry, and Plan Export all converge on these keys.
 * This module owns quantity semantics and provenance-neutral scope identity;
 * pricing remains in the existing quantity/pricing resolver and bathroom
 * condition-specific adapters.
 */

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

export type PlumbingWorkflowMode =
  | 'bathroom_remodel'
  | 'new_construction'
  | 'service';

export type PlumbingPerformerMode =
  | 'self_performed'
  | 'subcontracted'
  | 'existing_quote';

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

/** Physical Plumbing keys shared by Plan Export and Notes/manual flows. */
export const PLUMBING_QUICK_MEASUREMENT_KEYS = [
  'plumbingRoughPointCount',
  'plumbingTrimHookupCount',
  'fixtureReplacementCount',
  'fixtureRepairCount',
  'waterLineLf',
  'sewerLineLf',
  'gasLineLf',
] as const;

/** Plan Export keys for ground-up/addition Plumbing takeoffs. */
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

/** Counts that only exist when a fixture schedule / equipment takeoff was read. */
export const PLUMBING_INVENTORY_DERIVED_KEYS = [
  'plumbingRoughPointCount',
  'plumbingTrimHookupCount',
  'plumbingFixturesHardwareCount',
  'waterHeaterCount',
  'gasApplianceConnectionCount',
] as const;

export const PLUMBING_INVENTORY_DERIVED_ITEM_IDS = [
  'plumbing_rough',
  'plumbing_trim',
  'plumbing_fixtures_hardware',
  'water_heater',
  'gas_appliance_connections',
] as const;

/** Scope cards that can be confirmed from a ground-up/addition plan. */
export const PLUMBING_PLAN_SCOPE_ALLOWLIST = [
  'plumbing_rough',
  'plumbing_trim',
  'plumbing_fixtures_hardware',
  'water_heater',
  'gas_appliance_connections',
  'water_line',
  'sewer_line',
  'gas_line',
] as const;

/** Notes/manual Plumbing Service keys, including explicit service operations. */
export const PLUMBING_SERVICE_QUICK_MEASUREMENT_KEYS = [
  ...PLUMBING_QUICK_MEASUREMENT_KEYS,
  'serviceCallCount',
  'drainCleaningCount',
] as const;

export const PLUMBING_SCOPE_ALLOWLIST = [...PLUMBING_ITEM_IDS] as const;

export const PLUMBING_CARD_GROUPS: Array<{
  id: PlumbingCardGroupId;
  title: string;
}> = [
  { id: 'service', title: 'Service / repairs' },
  { id: 'fixtures', title: 'Fixtures / drain service' },
  { id: 'equipment', title: 'Fixtures & equipment' },
  { id: 'lines', title: 'Water / sewer / gas lines' },
  { id: 'rough_trim', title: 'Rough-in / trim' },
  { id: 'closeout', title: 'Materials / closeout' },
];

/** Ground-up plan export Confirm Scope buckets — construction phase order. */
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

/** Plan and Notes aliases fold onto the same canonical measurement keys. */
export const PLUMBING_PLAN_ALIASES: Record<string, PlumbingQuantityKey> = {
  serviceCalls: 'serviceCallCount',
  plumbingServiceCalls: 'serviceCallCount',
  serviceCallCount: 'serviceCallCount',
  fixtureRepairs: 'fixtureRepairCount',
  fixtureRepairCount: 'fixtureRepairCount',
  fixtureReplacements: 'fixtureReplacementCount',
  fixtureReplaceCount: 'fixtureReplacementCount',
  fixtureReplacementCount: 'fixtureReplacementCount',
  drainCleaningCount: 'drainCleaningCount',
  drainCleanings: 'drainCleaningCount',
  waterLineFeet: 'waterLineLf',
  waterSupplyLf: 'waterLineLf',
  waterLineLf: 'waterLineLf',
  sewerLineFeet: 'sewerLineLf',
  drainLineLf: 'sewerLineLf',
  sewerLineLf: 'sewerLineLf',
  gasLineFeet: 'gasLineLf',
  gasPipingLf: 'gasLineLf',
  gasLineLf: 'gasLineLf',
  roughInPoints: 'plumbingRoughPointCount',
  roughInPointCount: 'plumbingRoughPointCount',
  plumbingRoughPoints: 'plumbingRoughPointCount',
  plumbingRoughPointCount: 'plumbingRoughPointCount',
  trimHookupCount: 'plumbingTrimHookupCount',
  plumbingConnections: 'plumbingTrimHookupCount',
  plumbingTrimCount: 'plumbingTrimHookupCount',
  plumbingTrimHookupCount: 'plumbingTrimHookupCount',
  plumbingFixturesHardwareCount: 'plumbingFixturesHardwareCount',
  fixturesHardwareCount: 'plumbingFixturesHardwareCount',
  waterHeaterCount: 'waterHeaterCount',
  waterHeaters: 'waterHeaterCount',
  gasApplianceConnectionCount: 'gasApplianceConnectionCount',
  gasApplianceConnections: 'gasApplianceConnectionCount',
  partsCount: 'partsMaterialsCount',
  plumbingPartsCount: 'partsMaterialsCount',
  partsMaterialsCount: 'partsMaterialsCount',
  emergencyCount: 'emergencyFeeCount',
  emergencyFeeCount: 'emergencyFeeCount',
  cleanupCount: 'plumbingCleanupCount',
  plumbingCleanupCount: 'plumbingCleanupCount',
};

function positiveNumber(value: unknown): number | null {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function explicitQuantity(
  input: Record<string, unknown>,
  key: PlumbingQuantityKey
): number | null {
  const direct = positiveNumber(input[key]);
  if (direct != null) return direct;
  const alias = Object.entries(PLUMBING_PLAN_ALIASES).find(
    ([, canonical]) => canonical === key
  );
  return alias ? positiveNumber(input[alias[0]]) : null;
}

function buildItemQuantities(
  input: Record<string, unknown>,
  source: string
): Record<string, { quantity: number; unit: string; quantitySource: string }> {
  const out: Record<
    string,
    { quantity: number; unit: string; quantitySource: string }
  > = {};
  for (const card of PLUMBING_CARDS) {
    const quantity = explicitQuantity(input, card.measurementKey);
    if (quantity == null) continue;
    out[card.itemId] = {
      quantity,
      unit: card.unit,
      quantitySource: source,
    };
  }
  return out;
}

function normalizeAliasedInput(
  input: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...input };
  for (const [alias, canonical] of Object.entries(PLUMBING_PLAN_ALIASES)) {
    if (positiveNumber(out[canonical]) != null) continue;
    const value = positiveNumber(out[alias]);
    if (value != null) out[canonical] = value;
  }
  return out;
}

export type PlumbingStructuredMeasurements = {
  plumbingScope?: string[] | null;
  itemQuantities?: Record<
    string,
    { quantity: number; unit: string; quantitySource?: string }
  > | null;
};

export function normalizePlumbingPlanMeasurements(
  input: Record<string, unknown>
): Record<string, unknown> {
  const aliased = normalizeAliasedInput(input);
  const out: Record<string, unknown> = {};
  for (const key of PLUMBING_REVIEW_MEASUREMENT_KEYS) {
    const quantity = positiveNumber(aliased[key]);
    if (quantity != null) out[key] = quantity;
  }
  return out;
}

export function buildPlumbingStructuredMeasurements(
  input: Record<string, unknown>,
  quantitySource = 'user_entered'
): PlumbingStructuredMeasurements {
  const normalized = normalizeAliasedInput(input);
  const plumbingScope = PLUMBING_CARDS.filter(
    card => explicitQuantity(normalized, card.measurementKey) != null
  ).map(card => card.itemId);
  const itemQuantities = buildItemQuantities(normalized, quantitySource);
  return {
    plumbingScope: plumbingScope.length ? plumbingScope : null,
    itemQuantities: Object.keys(itemQuantities).length ? itemQuantities : null,
  };
}

export function normalizePlumbingScalarMeasurements(
  input: Record<string, unknown>
): Record<string, number> {
  const normalized = normalizeAliasedInput(input);
  const out: Record<string, number> = {};
  for (const key of PLUMBING_REVIEW_MEASUREMENT_KEYS) {
    const quantity = positiveNumber(normalized[key]);
    if (quantity != null) out[key] = quantity;
  }
  return out;
}

const COUNT_TOKEN =
  '(\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)';

const WORD_COUNTS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function parseCount(raw: string | undefined): number {
  const normalized = String(raw || '').toLowerCase();
  return WORD_COUNTS[normalized] || Number(normalized) || 1;
}

function parseLength(text: string, noun: string): number | null {
  const match = text.match(
    new RegExp(
      `(\\d+(?:\\.\\d+)?)\\s*(?:lf|linear\\s*(?:ft|feet)|feet|foot|ft)\\s*(?:of\\s+)?${noun}`,
      'i'
    )
  );
  return match ? Number(match[1]) : null;
}

/**
 * Parse explicit Plumbing Notes/Voice language onto canonical keys.
 *
 * This intentionally ignores vague "plumbing" mentions and never derives
 * quantities from room count or living area.
 */
export function parsePlumbingMeasurementsFromNotes(
  notes: string
): Record<string, number> {
  const text = String(notes || '').trim();
  if (!text) return {};
  const out: Record<string, number> = {};
  const assign = (key: PlumbingQuantityKey, value: number | null) => {
    if (value != null && Number.isFinite(value) && value > 0) out[key] = value;
  };
  const count = (pattern: RegExp): number | null => {
    const match = text.match(pattern);
    return match ? parseCount(match[1]) : null;
  };

  assign(
    'serviceCallCount',
    count(new RegExp(`${COUNT_TOKEN}\\s+service\\s+calls?`, 'i')) ??
      (/\bservice\s+call\b/i.test(text) ? 1 : null)
  );
  assign(
    'fixtureRepairCount',
    count(
      new RegExp(`${COUNT_TOKEN}\\s+(?:plumbing\\s+)?fixture repairs?`, 'i')
    ) ?? (/\b(?:plumbing\s+)?fixture repair\b/i.test(text) ? 1 : null)
  );
  assign(
    'fixtureReplacementCount',
    count(
      new RegExp(
        `${COUNT_TOKEN}\\s+(?:plumbing\\s+)?fixture replacements?`,
        'i'
      )
    ) ??
      (/\b(?:plumbing\s+)?fixture (?:replacement|install(?:ation)?)\b/i.test(
        text
      )
        ? 1
        : null)
  );
  assign(
    'drainCleaningCount',
    count(new RegExp(`${COUNT_TOKEN}\\s+drain cleanings?`, 'i')) ??
      (/\bdrain\s+(?:cleaning|clearing|snaking)\b/i.test(text) ? 1 : null)
  );
  assign('waterLineLf', parseLength(text, '(?:water|supply)\\s+lines?'));
  assign('sewerLineLf', parseLength(text, '(?:sewer|drain|waste)\\s+lines?'));
  assign(
    'plumbingRoughPointCount',
    count(
      new RegExp(
        `${COUNT_TOKEN}\\s+(?:plumbing\\s+)?rough(?:-in| in)\\s+points?`,
        'i'
      )
    ) ?? (/\b(?:plumbing\s+)?rough(?:-in| in)\b/i.test(text) ? 1 : null)
  );
  assign(
    'plumbingTrimHookupCount',
    count(
      new RegExp(
        `${COUNT_TOKEN}\\s+(?:plumbing\\s+)?(?:trim|hookups?|connections?)`,
        'i'
      )
    ) ??
      (/\b(?:plumbing\s+)?(?:trim|fixture hookups?|plumbing connections?)\b/i.test(
        text
      )
        ? 1
        : null)
  );
  assign(
    'partsMaterialsCount',
    count(new RegExp(`${COUNT_TOKEN}\\s+(?:plumbing\\s+)?parts?`, 'i')) ??
      (/\bplumbing\s+(?:parts?|materials?)\b/i.test(text) ? 1 : null)
  );
  assign(
    'emergencyFeeCount',
    /\b(?:emergency|after[\s-]?hours?)\s+(?:plumbing\s+)?(?:fee|call|service)\b/i.test(
      text
    )
      ? 1
      : null
  );
  assign(
    'plumbingCleanupCount',
    /\bplumbing\s+cleanup\b/i.test(text) ? 1 : null
  );
  assign(
    'plumbingFixturesHardwareCount',
    count(
      new RegExp(
        `${COUNT_TOKEN}\\s+(?:plumbing\\s+)?fixtures?(?:\\s*&\\s*hardware)?`,
        'i'
      )
    ) ??
      (/\b(?:plumbing\s+)?fixtures?\s*(?:&|and)\s*hardware\b/i.test(text)
        ? 1
        : null)
  );
  assign(
    'waterHeaterCount',
    count(new RegExp(`${COUNT_TOKEN}\\s+(?:water\\s+)?heaters?`, 'i')) ??
      (/\b(?:water\s+)?heater\b/i.test(text) ? 1 : null)
  );
  assign(
    'gasApplianceConnectionCount',
    count(
      new RegExp(
        `${COUNT_TOKEN}\\s+(?:gas\\s+)?appliance\\s+(?:hookups?|connections?)`,
        'i'
      )
    ) ??
      (/\bgas\s+appliance\s+(?:hookups?|connections?)\b/i.test(text) ? 1 : null)
  );
  return out;
}

export function plumbingMeasurementKeyForItemId(
  itemId: string | null | undefined
): PlumbingQuantityKey | null {
  return (
    PLUMBING_CARDS.find(card => card.itemId === itemId)?.measurementKey || null
  );
}

export function plumbingCardForItemId(
  itemId: string | null | undefined
): PlumbingCardDefinition | null {
  return PLUMBING_CARDS.find(card => card.itemId === itemId) || null;
}

export function plumbingMeasurementKeyOwnership(): Record<
  PlumbingQuantityKey,
  string
> {
  return Object.fromEntries(
    PLUMBING_CARDS.map(card => [card.measurementKey, card.itemId])
  ) as Record<PlumbingQuantityKey, string>;
}

export function hasDetailedPlumbingQuantities(
  input: Record<string, unknown> | null | undefined
): boolean {
  if (!input) return false;
  const itemQuantities = (input.itemQuantities || {}) as Record<
    string,
    { quantity?: unknown }
  >;
  return PLUMBING_CARDS.some(
    card =>
      positiveNumber(input[card.measurementKey]) != null ||
      positiveNumber(itemQuantities[card.itemId]?.quantity) != null
  );
}

export function hasDetailedPlumbingRoughQuantities(
  input: Record<string, unknown> | null | undefined
): boolean {
  return Boolean(
    input &&
      (positiveNumber(input.plumbingRoughPointCount) != null ||
        positiveNumber(
          (
            input.itemQuantities as
              | Record<string, { quantity?: unknown }>
              | undefined
          )?.plumbing_rough?.quantity
        ) != null)
  );
}

export function hasDetailedPlumbingTrimQuantities(
  input: Record<string, unknown> | null | undefined
): boolean {
  return Boolean(
    input &&
      (positiveNumber(input.plumbingTrimHookupCount) != null ||
        positiveNumber(
          (
            input.itemQuantities as
              | Record<string, { quantity?: unknown }>
              | undefined
          )?.plumbing_trim?.quantity
        ) != null)
  );
}

export function shouldAutoPricePlumbingRoughPackage(
  input: Record<string, unknown> | null | undefined,
  templateKey?: string | null
): boolean {
  if (hasDetailedPlumbingRoughQuantities(input)) return false;
  if (String(templateKey || '').toLowerCase() === 'plumbing_service') {
    return false;
  }
  return true;
}

export function shouldAutoPricePlumbingTrimPackage(
  input: Record<string, unknown> | null | undefined,
  templateKey?: string | null
): boolean {
  if (hasDetailedPlumbingTrimQuantities(input)) return false;
  if (String(templateKey || '').toLowerCase() === 'plumbing_service') {
    return false;
  }
  return true;
}

export function plumbingScopeGroups(): Array<{
  title: string;
  itemIds: string[];
}> {
  return PLUMBING_PLAN_EXPORT_CHECKLIST_GROUPS.map(group => ({
    title: group.title,
    itemIds: [...group.itemIds],
  }));
}

function explicitlyCleared(value: unknown): boolean {
  return value === null || value === '' || value === 0 || value === '0';
}

/**
 * Keep Plumbing quantities and Confirm Scope cards in lockstep. Positive
 * quantities promote a card; explicit clears return an existing included card
 * to review without deleting a contractor's prior checklist decision.
 */
export function copyPlumbingQuantityFields(
  source: Record<string, unknown> | null | undefined,
  parse: (value: unknown) => number | null = positiveNumber
): Partial<Record<PlumbingQuantityKey, number | null>> {
  const out: Partial<Record<PlumbingQuantityKey, number | null>> = {};
  if (!source) return out;
  for (const key of PLUMBING_QUANTITY_KEYS) {
    const parsed = parse(source[key]);
    if (parsed != null) out[key] = parsed;
  }
  return out;
}

export function syncPlumbingScopeItems<
  T extends { id: string; state?: string },
>(
  items: T[],
  params: {
    plumbingScope?: string[] | null;
    quantities?: Partial<Record<PlumbingQuantityKey, unknown>> & {
      itemQuantities?: Record<string, { quantity?: unknown }>;
    };
  }
): T[] {
  const included = new Set(params.plumbingScope || []);
  const fromQuantity = new Set<string>();
  const clearedQuantity = new Set<string>();
  const itemQuantities = params.quantities?.itemQuantities || {};

  for (const card of PLUMBING_CARDS) {
    const raw =
      params.quantities?.[card.measurementKey] ??
      itemQuantities[card.itemId]?.quantity;
    if (positiveNumber(raw) != null) {
      included.add(card.itemId);
      fromQuantity.add(card.itemId);
    } else if (explicitlyCleared(raw)) {
      clearedQuantity.add(card.itemId);
    }
  }

  const materialized = [...items];
  const existingIds = new Set(materialized.map(item => item.id));
  for (const card of PLUMBING_CARDS) {
    if (!included.has(card.itemId) || existingIds.has(card.itemId)) continue;
    materialized.push({
      id: card.itemId,
      label: card.label,
      helperText: card.helper,
      category: card.groupId,
      inputType: 'yes_no',
      state: 'included',
    } as unknown as T);
    existingIds.add(card.itemId);
  }

  return materialized.map(item => {
    if (fromQuantity.has(item.id)) {
      return item.state === 'included' ? item : { ...item, state: 'included' };
    }
    if (item.state === 'excluded') return item;
    if (clearedQuantity.has(item.id)) {
      return item.state === 'included' ? { ...item, state: 'unsure' } : item;
    }
    if (!included.has(item.id)) return item;
    return item.state === 'included' ? item : { ...item, state: 'included' };
  });
}

/** Invalidate Confirm Scope pricing recompute when plumbing QM or takeoff qty changes. */
export function plumbingScopeSyncSignature(
  measurements: Record<string, unknown>
): string {
  const itemQuantities =
    (measurements.itemQuantities as
      | Record<string, { quantity?: unknown }>
      | undefined) || {};
  return [
    ...PLUMBING_CARDS.map(card => {
      const qm = String(measurements[card.measurementKey] ?? '').replace(/,/g, '');
      const takeoff = String(itemQuantities[card.itemId]?.quantity ?? '').replace(
        /,/g,
        ''
      );
      return `${card.measurementKey}:${qm}:${takeoff}`;
    }),
    `floorAreaSqft:${String(measurements.floorAreaSqft ?? '').replace(/,/g, '')}`,
    `storyCount:${String(measurements.storyCount ?? '').replace(/,/g, '')}`,
    `projectComplexity:${JSON.stringify(measurements.projectComplexity ?? null)}`,
  ].join('|');
}
