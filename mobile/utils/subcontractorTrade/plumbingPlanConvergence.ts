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

export type PlumbingRoomContext = 'bathroom' | 'kitchen' | 'whole_house' | null;

/** Confirm Scope plumbing routing — chosen after notes imply a plumbing bid. */
export type NotesScopeMode =
  | 'whole_project'
  | 'plumbing'
  | 'plumbing_service'
  | 'plumbing_new_construction'
  | 'plumbing_bathroom'
  | 'plumbing_kitchen';

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

const ROOFING_SCOPE_BLEED_ITEM_IDS = new Set([
  'roofing_system',
  'tear_off',
  'decking_repair',
  'underlayment',
  'ice_water_shield',
  'shingles_roofing',
  'drip_edge',
  'ridge_cap',
  'valley_flashing',
  'step_flashing',
  'wall_flashing',
  'ridge_vent',
  'roof_vents',
  'turbine_vents',
  'pipe_boots',
  'chimney_flashing',
  'skylight_flashing',
  'roof_penetrations',
  'flashing',
  'vents_penetrations',
  'roof_pitch_complexity_access',
  'roof_repairs',
  'roof_exclusions',
  'gutters',
  'downspouts',
]);

const ROOFING_QM_BLEED_KEYS = [
  'roofAreaSqft',
  'roofSquares',
  'roofPitch',
  'roofDeckingReplacementSqft',
  'roofDripEdgeLf',
  'roofRidgeCapLf',
  'roofRidgeVentLf',
  'roofValleyFlashingLf',
  'roofStepFlashingLf',
  'roofWallFlashingLf',
  'roofChimneyFlashingCount',
  'roofPipeBootCount',
  'roofVentCount',
  'roofTurbineVentCount',
  'roofSkylightCount',
  'roofPenetrationCount',
  'roofRepairAffectedSqft',
  'roofGutterLf',
  'roofDownspoutCount',
  'roofIceWaterShieldSqft',
] as const;

/** Drop roofing / other-trade bleed from standalone plumbing measurements. */
export function stripNonPlumbingTradeBleedFromMeasurements<
  T extends Record<string, unknown>,
>(input: T): T {
  const next = { ...input } as T & Record<string, unknown>;
  for (const key of ROOFING_QM_BLEED_KEYS) {
    if (!(key in next)) continue;
    if (typeof next[key] === 'string') next[key] = '';
    else delete next[key];
  }
  if (next.itemQuantities && typeof next.itemQuantities === 'object') {
    const quantities = { ...(next.itemQuantities as Record<string, unknown>) };
    for (const itemId of Object.keys(quantities)) {
      if (ROOFING_SCOPE_BLEED_ITEM_IDS.has(itemId)) delete quantities[itemId];
    }
    next.itemQuantities = quantities;
  }
  if (
    next.tradeScopeSelections &&
    typeof next.tradeScopeSelections === 'object'
  ) {
    const { roofing: _roofing, ...rest } =
      next.tradeScopeSelections as Record<string, unknown>;
    next.tradeScopeSelections = rest;
  }
  return next as T;
}

export function filterChecklistItemsToPlumbingScope<
  T extends { id: string },
>(items: T[]): T[] {
  const allowed = new Set(PLUMBING_ITEM_IDS);
  return items.filter(
    item =>
      allowed.has(item.id) ||
      Boolean((item as T & { noteBacked?: boolean }).noteBacked) ||
      String(item.id || '').startsWith('custom_')
  );
}

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

function parseSqftFromNotes(text: string): number | null {
  const patterns = [
    /(\d{1,3}(?:,\d{3})*)\s*(?:sq\.?\s*ft|sf)\b[^.\n]{0,48}\bnew\s+(?:build|construction)\b/i,
    /\bfor\s+(\d{1,3}(?:,\d{3})*)\s*(?:sq\.?\s*ft|sf)\s+new\s+build/i,
    /\bnew\s+(?:build|construction)[^.\n]{0,48}(\d{1,3}(?:,\d{3})*)\s*(?:sq\.?\s*ft|sf)\b/i,
    /\b(\d{1,3}(?:,\d{3})*)\s*(?:sq\.?\s*ft|sf)\s+(?:new\s+)?(?:home|house)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = Number(String(match[1]).replace(/,/g, ''));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function parseStoryCountFromNotes(text: string): number | null {
  const matches = [
    ...text.matchAll(/\b(\d+|one|two|three|four|five)\s*[- ]?stor(?:y|ies)\b/gi),
  ];
  if (!matches.length) return null;
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  };
  let resolved = 0;
  for (const match of matches) {
    const raw = String(match[1] || '').toLowerCase();
    const count = words[raw] || Number(raw);
    if (Number.isFinite(count) && count > 0) resolved = Math.round(count);
  }
  return resolved > 0 ? Math.min(3, resolved) : null;
}

export type PlumbingProjectContextFromNotes = {
  floorAreaSqft?: number;
  storyCount?: number;
};

/** Living area and stories for whole-house / new-build plumbing notes. */
export function parsePlumbingProjectContextFromNotes(
  notes: string
): PlumbingProjectContextFromNotes {
  const text = String(notes || '').trim();
  if (!text) return {};
  const out: PlumbingProjectContextFromNotes = {};
  const floorAreaSqft = parseSqftFromNotes(text);
  if (floorAreaSqft) out.floorAreaSqft = floorAreaSqft;
  const storyCount = parseStoryCountFromNotes(text);
  if (storyCount) out.storyCount = storyCount;
  return out;
}

const PLUMBING_NOTE_MEASUREMENT_KEYS: PlumbingQuantityKey[] = [
  'plumbingRoughPointCount',
  'plumbingTrimHookupCount',
  'waterLineLf',
  'sewerLineLf',
  'gasLineLf',
  'waterHeaterCount',
  'plumbingFixturesHardwareCount',
  'gasApplianceConnectionCount',
  'serviceCallCount',
  'fixtureRepairCount',
  'fixtureReplacementCount',
  'drainCleaningCount',
];

/** Service/repair notes — only these quantities may promote scope cards. */
export const PLUMBING_SERVICE_ONLY_MEASUREMENT_KEYS: PlumbingQuantityKey[] = [
  'serviceCallCount',
  'fixtureRepairCount',
  'fixtureReplacementCount',
  'drainCleaningCount',
  'partsMaterialsCount',
  'emergencyFeeCount',
  'plumbingCleanupCount',
];

/** Tag parsed note quantities so QM and scope cards show From notes. */
export function tagPlumbingNotesMeasurementSources(
  measurements: Record<string, unknown>,
  parsed: Record<string, number>,
  projectContext?: PlumbingProjectContextFromNotes | null
): Record<string, string> {
  const sources = {
    ...((measurements.quickMeasurementSources as Record<string, string>) || {}),
  };
  for (const key of PLUMBING_NOTE_MEASUREMENT_KEYS) {
    if (positiveNumber(parsed[key]) != null) sources[key] = 'notes';
  }
  if (projectContext?.floorAreaSqft) sources.floorAreaSqft = 'notes';
  if (projectContext?.storyCount) sources.storyCount = 'notes';
  return sources;
}

const PLUMBING_NOTE_EXCLUSION_CLAUSE =
  /\b(?:not\s+included|excluded|(?:no|without)\s+(?:[\w-]+\s+){0,5}(?:scope|work|bid|rough(?:-in| in)?|repipe|trim|hookups?|water\s+heaters?))\b/i;

/** True when notes explicitly exclude a scope phrase on the same line or nearby. */
export function notesExcludePlumbingScopePhrase(
  notes: string,
  scopePhrase: RegExp
): boolean {
  const text = String(notes || '').trim();
  if (!text || !scopePhrase.test(text)) return false;

  const fragments = text.split(/\n+|(?<=[.!?])\s+/);
  for (const fragment of fragments) {
    if (!scopePhrase.test(fragment)) continue;
    if (PLUMBING_NOTE_EXCLUSION_CLAUSE.test(fragment)) return true;
  }

  const scopeMatch = scopePhrase.exec(text);
  const exclusionMatch = /\bnot\s+included\b/i.exec(text);
  if (
    scopeMatch &&
    exclusionMatch &&
    Math.abs(scopeMatch.index - exclusionMatch.index) < 96
  ) {
    return true;
  }
  return false;
}

/** Fixture product allowance is opt-in on trade-only notes — not inferred from rough/trim counts. */
export function notesExplicitPlumbingFixtureAllowance(notes: string): boolean {
  const text = String(notes || '').trim();
  if (!text || notesCustomerSuppliesPlumbingFixtures(text)) return false;
  if (notesExcludePlumbingScopePhrase(text, /\bfixture\s+allowance\b/i)) {
    return false;
  }
  return (
    /\bfixture\s+allowance\b/i.test(text) ||
    /\b(?:provide|furnish|include|supply)\s+(?:the\s+)?(?:plumbing\s+)?fixtures?\b/i.test(
      text
    ) ||
    /\bfixtures?\s+(?:allowance|package|included)\b/i.test(text) ||
    /\d+\s+(?:plumbing\s+)?fixtures(?:\s*&\s*hardware)?\b/i.test(text)
  );
}

export function standalonePlumbingProjectTitle(
  notes: string,
  roomContext?: PlumbingRoomContext | null
): string {
  const text = String(notes || '').trim();
  if (inferPlumbingWorkflowModeFromNotes(text) === 'service') {
    return 'Plumbing service call';
  }
  const room = roomContext ?? inferPlumbingRoomContextFromNotes(text);
  if (/\bmaster\s+bath\b/i.test(text)) return 'Master bath plumbing';
  if (room === 'whole_house' || /\bwhole[\s-]?house\s+plumbing\b/i.test(text)) {
    return 'Whole-house plumbing';
  }
  if (room === 'kitchen') return 'Kitchen plumbing';
  if (room === 'bathroom') return 'Bathroom plumbing';
  return 'Plumbing bid';
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
  assign(
    'sewerLineLf',
    parseLength(text, '(?:sewer|drain|waste)\\s+lines?') ??
      parseLength(text, 'drain\\s+line')
  );
  assign(
    'gasLineLf',
    parseLength(text, 'gas\\s+(?:line|piping|pipes?)')
  );
  const roughInPhrase = /\brough(?:-in| in)\b/i;
  assign(
    'plumbingRoughPointCount',
    notesExcludePlumbingScopePhrase(text, roughInPhrase)
      ? null
      : count(
          new RegExp(
            `${COUNT_TOKEN}\\s+(?:plumbing\\s+)?rough(?:-in| in)\\s+points?`,
            'i'
          )
        ) ??
          (/\b(?:plumbing\s+)?rough(?:-in| in)\b/i.test(text) ? 1 : null)
  );
  assign(
    'plumbingTrimHookupCount',
    count(
      new RegExp(
        `${COUNT_TOKEN}\\s+(?:plumbing\\s+trim|trim\\s+hookups?|fixture\\s+hookups?|plumbing\\s+connections?)`,
        'i'
      )
    ) ??
      (/\b(?:plumbing\s+trim|trim\s+hookups?|fixture\s+hookups?|plumbing\s+connections?)\b/i.test(text)
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
  const waterHeaterPhrase = /\b(?:water\s+)?heater(?:\s+tie[\s-]?in)?\b/i;
  const gasAppliancePhrase = /\bgas\s+appliance(?:\s+(?:hookups?|connections?))?\b/i;
  assign(
    'plumbingFixturesHardwareCount',
    notesExplicitPlumbingFixtureAllowance(text)
      ? count(
          new RegExp(
            `${COUNT_TOKEN}\\s+(?:plumbing\\s+)?fixtures?(?:\\s*&\\s*hardware)?`,
            'i'
          )
        ) ??
          (/\b(?:plumbing\s+)?fixtures?\s*(?:&|and)\s*hardware\b/i.test(text)
            ? 1
            : null)
      : null
  );
  assign(
    'waterHeaterCount',
    notesExcludePlumbingScopePhrase(text, waterHeaterPhrase)
      ? null
      : count(new RegExp(`${COUNT_TOKEN}\\s+(?:water\\s+)?heaters?`, 'i')) ??
          (waterHeaterPhrase.test(text) ? 1 : null)
  );
  assign(
    'gasApplianceConnectionCount',
    notesExcludePlumbingScopePhrase(text, gasAppliancePhrase)
      ? null
      : count(
          new RegExp(
            `${COUNT_TOKEN}\\s+(?:gas\\s+)?appliance\\s+(?:hookups?|connections?)`,
            'i'
          )
        ) ??
          (gasAppliancePhrase.test(text) ? 1 : null)
  );
  return out;
}

/** Drop remodel/new-build quantities when notes describe a service/repair visit. */
export function restrictPlumbingMeasurementsForServiceMode(
  parsed: Record<string, number>
): Record<string, number> {
  const allowed = new Set(PLUMBING_SERVICE_ONLY_MEASUREMENT_KEYS);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (allowed.has(key as PlumbingQuantityKey) && value > 0) {
      out[key] = value;
    }
  }
  return out;
}

/** Short reveal bullets from explicit plumbing note quantities. */
export function summarizePlumbingNoteBullets(
  notes: string,
  max = 4
): string[] {
  const parsed = parsePlumbingMeasurementsFromNotes(notes);
  const bullets: string[] = [];
  const pushCount = (value: number | undefined, singular: string, plural?: string) => {
    if (!value || value <= 0) return;
    const label = value === 1 ? singular : plural || `${singular}s`;
    bullets.push(`${value} ${label}`);
  };
  const pushLf = (value: number | undefined, label: string) => {
    if (!value || value <= 0) return;
    bullets.push(`${value} LF ${label}`);
  };

  pushCount(parsed.serviceCallCount, 'service call', 'service calls');
  pushCount(parsed.fixtureRepairCount, 'fixture repair', 'fixture repairs');
  pushCount(parsed.drainCleaningCount, 'drain cleaning', 'drain cleanings');
  pushCount(parsed.plumbingRoughPointCount, 'rough-in point', 'rough-in points');
  pushCount(parsed.plumbingTrimHookupCount, 'trim hookup', 'trim hookups');
  pushLf(parsed.waterLineLf, 'water line');
  pushLf(parsed.sewerLineLf, 'sewer line');
  pushLf(parsed.gasLineLf, 'gas piping');
  pushCount(parsed.waterHeaterCount, 'water heater', 'water heaters');
  pushCount(
    parsed.gasApplianceConnectionCount,
    'gas appliance hookup',
    'gas appliance hookups'
  );
  pushCount(
    parsed.plumbingFixturesHardwareCount,
    'fixture & hardware allowance',
    'fixtures & hardware'
  );

  return bullets.slice(0, max);
}

/** Bathroom, kitchen, home remodel, addition, and similar GC-scope notes. */
export function notesDescribeGeneralContractorProject(notes: string): boolean {
  const text = String(notes || '').toLowerCase();
  if (/\b(?:plumbing|electrical|hvac)\s+only\b/.test(text)) return false;
  if (/\bnot\s+a\s+full\s+remodel\b/.test(text) && /\bplumbing\b/.test(text)) {
    return false;
  }
  const remodelWord = /\bremodel(?:ing)?\b/.test(text);
  const roomContext =
    /\b(?:bath(?:room)?|kitchen|hall\s+bath|master\s+bath|powder\s+room|primary\s+bath)\b/.test(
      text
    );
  const homeContext =
    /\b(?:whole[\s-]?(?:house|home)|entire\s+home|full[\s-]home|home|house|gut\s+rehab|flip)\b/.test(
      text
    );
  const additionContext =
    /\b(?:addition|add[\s-]on|bump[\s-]out|adu|accessory\s+dwelling|second\s+story)\b/.test(
      text
    );
  const finishTrades =
    /\b(?:tile|vanity|toilet|tub|shower|paint|floor(?:ing)?|drywall|demo|backsplash|cabinet|counter(?:top)?s?|surround|ceiling|roof|siding|window|door|framing|insulation|hvac|electrical)\b/.test(
      text
    );

  if (/\b(?:bath(?:room)?|kitchen|home|house|whole[\s-]?(?:house|home)|gut)\s+remodel\b/.test(text)) {
    return true;
  }
  if (/\bremodel(?:ing)?\s+(?:the\s+)?(?:bath(?:room)?|kitchen|home|house)\b/.test(text)) {
    return true;
  }
  if (additionContext) return true;
  if (remodelWord && (roomContext || homeContext)) return true;
  if (roomContext && finishTrades) return true;
  if (homeContext && finishTrades) return true;
  return false;
}

/** @deprecated Use notesDescribeGeneralContractorProject */
export function notesDescribeRoomRemodel(notes: string): boolean {
  return notesDescribeGeneralContractorProject(notes);
}

const STRONG_PLUMBING_PARSE_KEYS = new Set<PlumbingQuantityKey>([
  'plumbingRoughPointCount',
  'plumbingTrimHookupCount',
  'waterLineLf',
  'sewerLineLf',
  'gasLineLf',
  'waterHeaterCount',
  'gasApplianceConnectionCount',
  'serviceCallCount',
  'drainCleaningCount',
  'fixtureRepairCount',
  'fixtureReplacementCount',
  'plumbingFixturesHardwareCount',
]);

/** Strong whole-house / trade-plumbing signals that should not be treated as a room remodel. */
export function notesSuggestStandalonePlumbingTrade(notes: string): boolean {
  const text = String(notes || '').trim();
  if (!text) return false;
  const parsed = parsePlumbingMeasurementsFromNotes(text);
  if (
    Object.keys(parsed).some((key) =>
      STRONG_PLUMBING_PARSE_KEYS.has(key as PlumbingQuantityKey)
    )
  ) {
    return true;
  }
  return /\b(?:whole[\s-]?house|house)\s+plumbing\b|\bplumbing\s+(?:rough|trim|bid|scope)\b|\b(?:water|sewer|gas)\s+(?:line|piping|pipe)\b|\brough[\s-]?in\s+points?\b|\btrim\s+hookups?\b/i.test(
    text
  );
}

export function notesSuggestPlumbingBid(notes: string): boolean {
  const text = String(notes || '').trim();
  if (!text) return false;
  const standalone = notesSuggestStandalonePlumbingTrade(text);
  if (notesDescribeGeneralContractorProject(text) && !standalone) {
    return false;
  }
  return standalone;
}

export function inferPlumbingWorkflowModeFromNotes(
  notes: string
): PlumbingWorkflowMode {
  const text = String(notes || '').toLowerCase();
  if (
    /\b(?:service\s+call|drain\s+clean|fixture\s+repair|clog|leak\s+repair)\b/.test(
      text
    )
  ) {
    return 'service';
  }
  if (/\bnew\s+(?:build|construction|home)\b|\bground[\s-]?up\b/.test(text)) {
    return 'new_construction';
  }
  return 'bathroom_remodel';
}

export function inferPlumbingRoomContextFromNotes(
  notes: string
): PlumbingRoomContext {
  const text = String(notes || '').toLowerCase();
  if (/\b(?:whole[\s-]?house|house)\s+plumbing\b/.test(text)) {
    return 'whole_house';
  }
  if (/\bkitchen\b/.test(text)) return 'kitchen';
  if (/\bbath(?:room)?\b/.test(text)) return 'bathroom';
  return null;
}

/** Homeowner/customer provides fixture product — labor-only plumbing bid. */
export function notesCustomerSuppliesPlumbingFixtures(notes: string): boolean {
  const text = String(notes || '').toLowerCase();
  return (
    /\b(?:customer|homeowner|owner|client)\s+supply(?:ing|s)?\s+(?:the\s+)?(?:plumbing\s+)?fixtures?\b/.test(
      text
    ) ||
    /\bfixtures?\s+(?:are\s+)?(?:customer|owner|homeowner)[\s-]supplied\b/.test(
      text
    ) ||
    /\bwe\s+provide\s+labor\b.*\b(?:customer|homeowner|owner)\s+supplies?\s+fixtures?\b/.test(
      text
    )
  );
}

export function resolveNotesScopeModeFromPlumbingState(params: {
  tradeWorkflowSource?: 'standalone_trade' | null;
  plumbingWorkflowMode?: PlumbingWorkflowMode | null;
  plumbingRoomContext?: PlumbingRoomContext;
  notes?: string | null;
}): NotesScopeMode {
  if (params.tradeWorkflowSource !== 'standalone_trade') {
    return 'whole_project';
  }
  if (params.notes) {
    const room = inferPlumbingRoomContextFromNotes(params.notes);
    const wf = inferPlumbingWorkflowModeFromNotes(params.notes);
    if (wf === 'service') return 'plumbing_service';
    if (wf === 'new_construction') return 'plumbing_new_construction';
    if (room === 'bathroom') return 'plumbing_bathroom';
    if (room === 'kitchen') return 'plumbing_kitchen';
  }
  if (params.plumbingWorkflowMode === 'service') return 'plumbing_service';
  if (params.plumbingWorkflowMode === 'new_construction') {
    return 'plumbing_new_construction';
  }
  if (params.plumbingRoomContext === 'bathroom') return 'plumbing_bathroom';
  if (params.plumbingRoomContext === 'kitchen') return 'plumbing_kitchen';
  return 'plumbing';
}

export function plumbingStateFromNotesScopeMode(mode: NotesScopeMode): {
  tradeWorkflowSource: 'standalone_trade' | null;
  plumbingWorkflowMode: PlumbingWorkflowMode | null;
  plumbingRoomContext: PlumbingRoomContext;
  checklistMode: PlumbingWorkflowMode | null;
} {
  switch (mode) {
    case 'whole_project':
      return {
        tradeWorkflowSource: null,
        plumbingWorkflowMode: null,
        plumbingRoomContext: null,
        checklistMode: null,
      };
    case 'plumbing_service':
      return {
        tradeWorkflowSource: 'standalone_trade',
        plumbingWorkflowMode: 'service',
        plumbingRoomContext: null,
        checklistMode: 'service',
      };
    case 'plumbing_new_construction':
      return {
        tradeWorkflowSource: 'standalone_trade',
        plumbingWorkflowMode: 'new_construction',
        plumbingRoomContext: 'whole_house',
        checklistMode: 'new_construction',
      };
    case 'plumbing_bathroom':
      return {
        tradeWorkflowSource: 'standalone_trade',
        plumbingWorkflowMode: 'bathroom_remodel',
        plumbingRoomContext: 'bathroom',
        checklistMode: 'bathroom_remodel',
      };
    case 'plumbing_kitchen':
      return {
        tradeWorkflowSource: 'standalone_trade',
        plumbingWorkflowMode: 'bathroom_remodel',
        plumbingRoomContext: 'kitchen',
        checklistMode: 'bathroom_remodel',
      };
    case 'plumbing':
    default:
      return {
        tradeWorkflowSource: 'standalone_trade',
        plumbingWorkflowMode: 'bathroom_remodel',
        plumbingRoomContext: null,
        checklistMode: 'bathroom_remodel',
      };
  }
}

export function plumbingMeasurementKeyForItemId(
  itemId: string | null | undefined
): PlumbingQuantityKey | null {
  return (
    PLUMBING_CARDS.find(card => card.itemId === itemId)?.measurementKey || null
  );
}

/** Quick-measurement keys for included plumbing scope cards (standalone trade flow). */
export function plumbingQuickMeasurementKeysForIncludedScope(
  includedItemIds: Iterable<string>
): Set<PlumbingQuantityKey> {
  const keys = new Set<PlumbingQuantityKey>();
  for (const itemId of includedItemIds) {
    const key = plumbingMeasurementKeyForItemId(itemId);
    if (key) keys.add(key);
  }
  return keys;
}

/** Map Scope found "Pricing for …" copy back to a plumbing checklist item id. */
export function resolvePlumbingRevealAttentionItemId(
  pricingLabel: string
): string | null {
  const norm = pricingLabel.trim().toLowerCase();
  for (const card of PLUMBING_CARDS) {
    const label = card.label.toLowerCase();
    if (norm === label || norm.startsWith(label) || label.startsWith(norm)) {
      return card.itemId;
    }
  }
  if (/water line/i.test(norm)) return 'water_line';
  if (/sewer|drain piping/i.test(norm)) return 'sewer_line';
  if (/gas piping/i.test(norm)) return 'gas_line';
  if (/rough-?in/i.test(norm)) return 'plumbing_rough';
  if (/trim|hookup/i.test(norm)) return 'plumbing_trim';
  if (/gas appliance/i.test(norm)) return 'gas_appliance_connections';
  if (/fixture allowance/i.test(norm)) return 'plumbing_fixtures_hardware';
  if (/water heater/i.test(norm)) return 'water_heater';
  if (/service call/i.test(norm)) return 'service_call';
  if (/fixture repair/i.test(norm)) return 'fixture_repair';
  if (/fixture replacement/i.test(norm)) return 'fixture_replace';
  if (/drain clean/i.test(norm)) return 'drain_cleaning';
  return null;
}

/** Checklist rows with note-backed quantities for standalone plumbing reveal. */
export function plumbingRevealNoteBackedItemIds(draft: {
  originalNotes?: string | null;
  scopeChecklist?: {
    items?: Array<{ id: string; state?: string; noteBacked?: boolean }>;
  } | null;
}): Set<string> {
  const ids = new Set<string>();
  for (const item of draft.scopeChecklist?.items || []) {
    if (item.state === 'included' || item.noteBacked) ids.add(item.id);
  }
  const notes = String(draft.originalNotes || '').trim();
  if (!notes) return ids;
  const parsed = parsePlumbingMeasurementsFromNotes(notes);
  for (const card of PLUMBING_CARDS) {
    if (positiveNumber(parsed[card.measurementKey]) != null) {
      ids.add(card.itemId);
    }
  }
  return ids;
}

export function standalonePlumbingRevealDraft(draft: {
  projectType?: string | null;
  scopeChecklist?: { templateKey?: string | null } | null;
  scopeMeasurements?: { tradeWorkflowSource?: string | null } | null;
}): boolean {
  const templateKey = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  if (!['plumbing', 'plumbing_service'].includes(templateKey)) return false;
  return draft.scopeMeasurements?.tradeWorkflowSource === 'standalone_trade';
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

const PLUMBING_SERVICE_CHECKLIST_ITEM_IDS = new Set([
  'service_call',
  'fixture_repair',
  'fixture_replace',
  'drain_cleaning',
]);

/** Confirm Scope template — service vs remodel / new construction. */
export function resolveStandalonePlumbingTemplateKey(
  mode?: PlumbingWorkflowMode | null
): 'plumbing' | 'plumbing_service' {
  return mode === 'service' ? 'plumbing_service' : 'plumbing';
}

/** Checklist rows for a first-class Plumbing bid (not a bathroom remodel overlay). */
export function buildStandalonePlumbingChecklistItems(
  mode?: PlumbingWorkflowMode | null,
  notes?: string | null
): Array<{
  id: string;
  label: string;
  helperText: string;
  category: string;
  state: 'unsure';
}> {
  const cards =
    mode === 'service'
      ? PLUMBING_CARDS.filter(card =>
          PLUMBING_SERVICE_CHECKLIST_ITEM_IDS.has(card.itemId)
        )
      : PLUMBING_CARDS;
  const items = cards.map(card => ({
    id: card.itemId,
    label: card.label,
    helperText: card.helper,
    category: card.groupTitle,
    state: 'unsure' as const,
  }));
  if (!notes) return items;
  return applyStandalonePlumbingChecklistDefaults(items, { notes, mode });
}

/**
 * Promote note-backed quantities to Yes and default unrelated cards to No so
 * trade-only plumbing bids do not open with a wall of "Not sure" cards.
 */
export function applyStandalonePlumbingChecklistDefaults<
  T extends { id: string; state?: string; noteBacked?: boolean },
>(
  items: T[],
  params: {
    notes?: string | null;
    mode?: PlumbingWorkflowMode | null;
    quantities?: Record<string, unknown> | null;
  }
): T[] {
  const notes = String(params.notes || '').trim();
  const mode = params.mode ?? 'bathroom_remodel';
  const parsed = notes ? parsePlumbingMeasurementsFromNotes(notes) : {};
  const customerSuppliesFixtures =
    notes.length > 0 && notesCustomerSuppliesPlumbingFixtures(notes);

  const quantityFor = (itemId: string): number | null => {
    const card = PLUMBING_CARDS.find(entry => entry.itemId === itemId);
    if (!card) return null;
    const fromQuantities = positiveNumber(
      params.quantities?.[card.measurementKey]
    );
    if (fromQuantities != null) return fromQuantities;
    return positiveNumber(parsed[card.measurementKey as keyof typeof parsed]);
  };

  const withState = (
    item: T,
    state: 'included' | 'excluded',
    noteBacked = false
  ): T =>
    item.state === state && (!noteBacked || item.noteBacked)
      ? item
      : { ...item, state, ...(noteBacked ? { noteBacked: true } : {}) };

  if (mode === 'service') {
    return items.map(item => {
      const qty = quantityFor(item.id);
      if (qty != null && qty > 0) return withState(item, 'included', true);
      return withState(item, 'excluded');
    });
  }

  return items.map(item => {
    const card = PLUMBING_CARDS.find(entry => entry.itemId === item.id);
    if (!card) return item;

    const qty = quantityFor(item.id);
    if (qty != null && qty > 0) return withState(item, 'included', true);

    if (item.id === 'plumbing_fixtures_hardware') {
      if (customerSuppliesFixtures) return withState(item, 'excluded');
      if (
        notes &&
        notesSuggestStandalonePlumbingTrade(notes) &&
        !notesExplicitPlumbingFixtureAllowance(notes)
      ) {
        return withState(item, 'excluded');
      }
    }

    if (PLUMBING_SERVICE_CHECKLIST_ITEM_IDS.has(item.id)) {
      return withState(item, 'excluded');
    }

    if (card.groupId === 'closeout') {
      return withState(item, 'excluded');
    }

    if (['lines', 'equipment', 'rough_trim', 'fixtures'].includes(card.groupId)) {
      return withState(item, 'excluded');
    }

    return item;
  });
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

export function finalizeStandalonePlumbingChecklist<
  T extends { id: string; state?: string; noteBacked?: boolean },
>(
  items: T[],
  params: {
    notes?: string | null;
    mode?: PlumbingWorkflowMode | null;
    plumbingScope?: string[] | null;
    quantities?: Record<string, unknown> | null;
  }
): T[] {
  const synced = syncPlumbingScopeItems(items, {
    plumbingScope: params.plumbingScope,
    quantities: params.quantities ?? undefined,
  });
  return applyStandalonePlumbingChecklistDefaults(synced, {
    notes: params.notes,
    mode: params.mode,
    quantities: params.quantities,
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
