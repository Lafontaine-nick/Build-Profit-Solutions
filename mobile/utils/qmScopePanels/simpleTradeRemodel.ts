import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';
import type { QuickMeasurementFieldKey } from '@/utils/scopeQuickMeasurements';
import { hvacCardForMeasurementKey } from '@/utils/subcontractorTrade/hvacPlanConvergence';

export type SimpleTradeScopeKey = 'deck_patio' | 'hvac' | 'roofing';

export type HvacScopeChipReviewState = 'confirmed' | 'needs_confirmation' | 'idle';

/** HVAC quick-measurement keys owned by the scope chip panel. */
export const HVAC_EMBEDDED_QUICK_MEASUREMENT_KEYS = [
  'hvacSystemCount',
  'hvacSystemTons',
  'hvacEquipmentReplacementCount',
  'hvacDuctworkLf',
  'hvacSupplyRegisterCount',
  'hvacReturnGrilleCount',
  'hvacThermostatCount',
  'hvacVentilationCount',
] as const satisfies readonly QuickMeasurementFieldKey[];

export const HVAC_SYSTEMS_OPTION_ID = 'hvac_systems' as const;
export const HVAC_CAPACITY_OPTION_ID = 'hvac_capacity' as const;

const HVAC_TAKEOFF_SOURCE_TAGS = new Set([
  'needs_confirmation',
  'contractor_confirmed_from_plan_review',
  'user_entered',
  'user_confirmed_suggestion',
  'plan_detected',
  'detected_from_plan',
  'plan_verified',
]);

type TradeOption = {
  id: string;
  label: string;
  canonicalId: string;
  measurementKey?: string;
  measurementHelper?: string;
  quantityLabel?: string;
  unit?: string;
};

type TradeSpec = {
  scopeKey: SimpleTradeScopeKey;
  embeddedIds: string[];
  options: TradeOption[];
};

const DECK_OPTIONS: TradeOption[] = [
  { id: 'wood_fence', label: 'Wood fence', canonicalId: 'landscaping', measurementKey: 'railingLf', unit: 'LF' },
  { id: 'vinyl_fence', label: 'Vinyl fence', canonicalId: 'landscaping', measurementKey: 'railingLf', unit: 'LF' },
  { id: 'chain_link', label: 'Chain link', canonicalId: 'landscaping', measurementKey: 'railingLf', unit: 'LF' },
  { id: 'composite_deck', label: 'Composite deck', canonicalId: 'decking', measurementKey: 'deckSqft', unit: 'sqft' },
  { id: 'wood_deck', label: 'Wood deck', canonicalId: 'decking', measurementKey: 'deckSqft', unit: 'sqft' },
  { id: 'railings', label: 'Railings', canonicalId: 'railing', measurementKey: 'railingLf', unit: 'LF' },
  { id: 'gates', label: 'Gates', canonicalId: 'landscaping' },
  { id: 'stairs', label: 'Stairs', canonicalId: 'stairs', measurementKey: 'deckSqft', unit: 'sqft' },
];

/** Equipment-type chips map to priced Confirm Scope cards (furnace, condenser, …). */
export const HVAC_EQUIPMENT_OPTION_IDS = [
  'furnace',
  'condenser',
  'heat_pump',
  'mini_split',
  'air_handler',
] as const;

export const HVAC_SCOPE_EQUIPMENT_OPTION_IDS = HVAC_EQUIPMENT_OPTION_IDS;

export function hvacEquipmentItemQuantityKey(optionId: string): string {
  return `equipment_replace__${optionId}`;
}

function hasManualHvacEquipmentIntent(
  measurements: Record<string, unknown>
): boolean {
  const sources =
    (measurements.quickMeasurementSources as Record<string, string>) || {};
  const overrides =
    (measurements.quickMeasurementUserOverrides as Record<string, boolean>) ||
    {};
  if (
    sources.hvacEquipmentReplacementCount === 'user_entered' ||
    overrides.hvacEquipmentReplacementCount
  ) {
    return true;
  }
  const itemQuantities =
    (measurements.itemQuantities as Record<string, unknown>) || {};
  return HVAC_EQUIPMENT_OPTION_IDS.some(
    id => itemQuantities[hvacEquipmentItemQuantityKey(id)] != null
  );
}

function readHvacEquipmentTypeCount(
  measurements: Record<string, unknown>,
  optionId: string
): number | null {
  const key = hvacEquipmentItemQuantityKey(optionId);
  const entry = (
    measurements.itemQuantities as Record<string, { quantity?: unknown }>
  )?.[key];
  return positiveMeasurement(entry?.quantity);
}

function syncHvacEquipmentScopeMeasurements(
  measurements: Record<string, unknown>
): Record<string, unknown> {
  const selections = selectedScope(measurements, 'hvac');
  const equipmentIds = selections.filter(id =>
    (HVAC_EQUIPMENT_OPTION_IDS as readonly string[]).includes(id)
  );
  let itemQuantities = {
    ...(((measurements.itemQuantities as Record<string, unknown>) ||
      {}) as Record<string, { quantity?: unknown; quantitySource?: string }>),
  };

  for (const id of HVAC_EQUIPMENT_OPTION_IDS) {
    const key = hvacEquipmentItemQuantityKey(id);
    if (!equipmentIds.includes(id) && itemQuantities[key]) {
      const nextEntries = { ...itemQuantities };
      delete nextEntries[key];
      itemQuantities = nextEntries;
    }
  }

  for (const id of equipmentIds) {
    const key = hvacEquipmentItemQuantityKey(id);
    if (!itemQuantities[key]) {
      itemQuantities[key] = { quantity: 1, quantitySource: 'user_entered' };
    }
    itemQuantities[id] = { ...itemQuantities[key] };
  }

  let next: Record<string, unknown> = {
    ...measurements,
    itemQuantities,
  };

  if (equipmentIds.length > 0) {
    const total = equipmentIds.reduce(
      (sum, id) => sum + (readHvacEquipmentTypeCount(next, id) ?? 1),
      0
    );
    next = markHvacFieldUserEdited(
      next,
      'hvacEquipmentReplacementCount',
      String(total)
    );
    return next;
  }

  if (hasManualHvacEquipmentIntent(measurements)) {
    const { hvacEquipmentReplacementCount: _removed, ...rest } = next as Record<
      string,
      unknown
    > & { hvacEquipmentReplacementCount?: unknown };
    const sources = {
      ...(((rest.quickMeasurementSources as Record<string, string>) || {}) as Record<
        string,
        string
      >),
    };
    delete sources.hvacEquipmentReplacementCount;
    const overrides = {
      ...(((rest.quickMeasurementUserOverrides as Record<string, boolean>) ||
        {}) as Record<string, boolean>),
    };
    delete overrides.hvacEquipmentReplacementCount;
    return {
      ...rest,
      quickMeasurementSources: sources,
      quickMeasurementUserOverrides: overrides,
    };
  }

  return next;
}

/** Optional HVAC scope — excluded from base package unless explicitly included. */
export const HVAC_OPTIONAL_ADDON_OPTION_IDS = ['ventilation'] as const;

/** Shown under the idle whole-house ventilation chip in Confirm Scope. */
export const HVAC_VENTILATION_IDLE_HINT =
  '1 each = one ERV, HRV, or whole-house fresh-air unit — not bath exhaust fans.';

/** Shown on the selected ventilation card quantity row in Confirm Scope. */
export const HVAC_VENTILATION_QUANTITY_HELPER =
  'Enter how many units are in this bid. Price on the next step.';

export const HVAC_SCOPE_DISTRIBUTION_OPTION_IDS = [
  'ductwork',
  'thermostat',
  'registers',
  'returns',
] as const;

export const HVAC_SCOPE_CORE_SECTIONS: Array<{
  label: string | null;
  optionIds: readonly string[];
}> = [
  { label: null, optionIds: [HVAC_SYSTEMS_OPTION_ID, HVAC_CAPACITY_OPTION_ID] },
  { label: 'Equipment', optionIds: HVAC_EQUIPMENT_OPTION_IDS },
  { label: 'Distribution', optionIds: HVAC_SCOPE_DISTRIBUTION_OPTION_IDS },
];

const HVAC_EQUIPMENT_MEASUREMENT = {
  measurementKey: 'hvacEquipmentReplacementCount',
  quantityLabel: 'Equipment replacements',
  unit: 'each',
  measurementHelper: 'Enter quantity for this equipment type.',
} as const;

const HVAC_OPTIONS: TradeOption[] = [
  {
    id: HVAC_SYSTEMS_OPTION_ID,
    label: 'HVAC systems',
    canonicalId: 'hvac',
    measurementKey: 'hvacSystemCount',
    unit: 'each',
    measurementHelper: 'Enter documented HVAC system count from the plans.',
  },
  {
    id: HVAC_CAPACITY_OPTION_ID,
    label: 'HVAC capacity',
    canonicalId: 'hvac',
    measurementKey: 'hvacSystemTons',
    unit: 'ton',
    measurementHelper: 'Enter documented system tonnage from the plans.',
  },
  {
    id: 'furnace',
    label: 'Furnace',
    canonicalId: 'furnace',
    ...HVAC_EQUIPMENT_MEASUREMENT,
  },
  {
    id: 'condenser',
    label: 'Condenser',
    canonicalId: 'condenser',
    ...HVAC_EQUIPMENT_MEASUREMENT,
  },
  {
    id: 'heat_pump',
    label: 'Heat pump',
    canonicalId: 'heat_pump',
    ...HVAC_EQUIPMENT_MEASUREMENT,
  },
  {
    id: 'mini_split',
    label: 'Mini split',
    canonicalId: 'mini_split',
    ...HVAC_EQUIPMENT_MEASUREMENT,
  },
  {
    id: 'air_handler',
    label: 'Air handler',
    canonicalId: 'air_handler',
    ...HVAC_EQUIPMENT_MEASUREMENT,
  },
  {
    id: 'ductwork',
    label: 'Ductwork',
    canonicalId: 'ductwork',
    measurementKey: 'hvacDuctworkLf',
    unit: 'LF',
    measurementHelper: 'Enter labeled or dimensioned ductwork LF only.',
  },
  {
    id: 'thermostat',
    label: 'Thermostat',
    canonicalId: 'thermostat',
    measurementKey: 'hvacThermostatCount',
    unit: 'each',
    measurementHelper: 'Enter thermostat count.',
  },
  {
    id: 'ventilation',
    label: 'Whole-house ventilation',
    canonicalId: 'ventilation',
    measurementKey: 'hvacVentilationCount',
    unit: 'each',
    measurementHelper:
      'Count whole-house ventilation systems — 1 ERV or HRV = 1 each. Not bath exhaust fans.',
  },
  // Distribution toggles — seed register/return counts when selected.
  {
    id: 'registers',
    label: 'Registers',
    canonicalId: 'supply_registers',
    measurementKey: 'hvacSupplyRegisterCount',
    unit: 'each',
    measurementHelper: 'Enter documented supply register count.',
  },
  {
    id: 'returns',
    label: 'Returns',
    canonicalId: 'return_grilles',
    measurementKey: 'hvacReturnGrilleCount',
    unit: 'each',
    measurementHelper: 'Enter documented return grille count.',
  },
];

const ROOFING_OPTIONS: TradeOption[] = [
  { id: 'tear_off', label: 'Tear-off', canonicalId: 'tear_off', measurementKey: 'roofSquares', unit: 'squares' },
  { id: 'underlayment', label: 'Premium / synthetic underlayment upgrade', canonicalId: 'underlayment', measurementKey: 'roofAreaSqft', unit: 'sqft' },
  { id: 'ice_water_shield', label: 'Ice & water shield', canonicalId: 'ice_water_shield', measurementKey: 'roofIceWaterShieldSqft', unit: 'sqft' },
  { id: 'drip_edge', label: 'Drip edge', canonicalId: 'drip_edge', measurementKey: 'roofDripEdgeLf', unit: 'LF' },
  { id: 'ridge_cap', label: 'Ridge cap', canonicalId: 'ridge_cap', measurementKey: 'roofRidgeCapLf', unit: 'LF' },
  { id: 'valley_flashing', label: 'Valley flashing', canonicalId: 'valley_flashing', measurementKey: 'roofValleyFlashingLf', unit: 'LF' },
  { id: 'step_flashing', label: 'Step flashing', canonicalId: 'step_flashing', measurementKey: 'roofStepFlashingLf', unit: 'LF' },
  { id: 'wall_flashing', label: 'Wall flashing', canonicalId: 'wall_flashing', measurementKey: 'roofWallFlashingLf', unit: 'LF' },
  { id: 'shingles', label: 'Shingles', canonicalId: 'shingles_roofing', measurementKey: 'roofSquares', unit: 'squares' },
  { id: 'decking_repair', label: 'Decking replacement', canonicalId: 'decking_repair', measurementKey: 'roofDeckingReplacementSqft', unit: 'sqft' },
  { id: 'ridge_vent', label: 'Ridge vent', canonicalId: 'ridge_vent', measurementKey: 'roofRidgeVentLf', unit: 'EA' },
  { id: 'roof_vents', label: 'Roof vents', canonicalId: 'roof_vents', measurementKey: 'roofVentCount', unit: 'EA' },
  { id: 'turbine_vents', label: 'Turbine vents', canonicalId: 'turbine_vents', measurementKey: 'roofTurbineVentCount', unit: 'EA' },
  { id: 'pipe_boots', label: 'Pipe boots', canonicalId: 'pipe_boots', measurementKey: 'roofPipeBootCount', unit: 'EA' },
  { id: 'chimney_flashing', label: 'Chimney flashing', canonicalId: 'chimney_flashing', measurementKey: 'roofChimneyFlashingCount', unit: 'EA' },
  { id: 'skylight_flashing', label: 'Skylight flashing', canonicalId: 'skylight_flashing', measurementKey: 'roofSkylightCount', unit: 'EA' },
  { id: 'roof_penetrations', label: 'Other penetrations', canonicalId: 'roof_penetrations', measurementKey: 'roofPenetrationCount', unit: 'EA' },
  { id: 'roof_repairs', label: 'Roof repairs', canonicalId: 'roof_repairs', measurementKey: 'roofRepairAffectedSqft', unit: 'sqft' },
  {
    id: 'gutters',
    label: 'Gutters',
    canonicalId: 'gutters',
    measurementKey: 'roofGutterLf',
    measurementHelper: 'Enter only the gutter run included in this scope.',
    unit: 'LF',
  },
  {
    id: 'downspouts',
    label: 'Downspouts',
    canonicalId: 'downspouts',
    measurementKey: 'roofDownspoutCount',
    measurementHelper: 'Enter number of standard downspout drops.',
    unit: 'EA',
  },
  { id: 'cleanup', label: 'Cleanup', canonicalId: 'cleanup' },
];

export const SIMPLE_TRADE_SPECS: Record<SimpleTradeScopeKey, TradeSpec> = {
  deck_patio: {
    scopeKey: 'deck_patio',
    embeddedIds: ['decking', 'railing', 'stairs', 'landscaping'],
    options: DECK_OPTIONS,
  },
  hvac: {
    scopeKey: 'hvac',
    embeddedIds: [
      'furnace',
      'condenser',
      'heat_pump',
      'mini_split',
      'air_handler',
      'equipment_replace',
      'ductwork',
      'supply_registers',
      'return_grilles',
      'thermostat',
      'ventilation',
    ],
    options: HVAC_OPTIONS,
  },
  roofing: {
    scopeKey: 'roofing',
    embeddedIds: [
      'tear_off',
      'underlayment',
      'ice_water_shield',
      'shingles_roofing',
      'decking_repair',
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
      'roof_repairs',
      'gutters',
      'downspouts',
      'cleanup',
    ],
    options: ROOFING_OPTIONS,
  },
};

function positiveMeasurement(value: unknown): number | null {
  const number = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(number) && number > 0 ? number : null;
}

function formatHvacQuantityCaption(value: number, unit?: string): string {
  const normalized = String(unit || 'each').toUpperCase();
  const rounded =
    normalized === 'LF' || normalized === 'SQFT' ? value : Math.round(value);
  if (normalized === 'LF') return `${rounded.toLocaleString()} LF`;
  if (normalized === 'SQFT') return `${rounded.toLocaleString()} sqft`;
  if (normalized === 'TON' || normalized === 'TONS') return `${rounded} tons`;
  if (normalized === 'A') return `${rounded}A`;
  return `${rounded.toLocaleString()} each`;
}

/** Prefer the live field string so cleared inputs do not snap back to plan provenance. */
function hvacPanelFieldDisplayValue(
  measurements: Record<string, unknown>,
  field: string
): string {
  if (Object.prototype.hasOwnProperty.call(measurements, field)) {
    const raw = measurements[field];
    if (raw === undefined || raw === null) return '';
    return String(raw).replace(/,/g, '');
  }
  const coalesced = coalesceHvacFieldValue(measurements, field);
  return coalesced == null ? '' : String(coalesced);
}

function markHvacFieldUserEdited(
  measurements: Record<string, unknown>,
  field: string,
  value: string
): Record<string, unknown> {
  return {
    ...measurements,
    [field]: value,
    quickMeasurementSources: {
      ...((measurements.quickMeasurementSources as Record<string, string>) ||
        {}),
      [field]: 'user_entered',
    },
    quickMeasurementUserOverrides: {
      ...((measurements.quickMeasurementUserOverrides as Record<
        string,
        boolean
      >) || {}),
      [field]: true,
    },
  };
}

function coalesceHvacFieldValue(
  measurements: Record<string, unknown>,
  field: string
): number | null {
  const direct = positiveMeasurement(measurements[field]);
  if (direct != null) return direct;
  const provenance =
    measurements.measurementProvenance &&
    typeof measurements.measurementProvenance === 'object'
      ? (measurements.measurementProvenance as Record<string, unknown>)[field]
      : null;
  if (provenance && typeof provenance === 'object') {
    const fromProvenance = positiveMeasurement(
      (provenance as { value?: unknown; selectedValue?: unknown }).value ??
        (provenance as { selectedValue?: unknown }).selectedValue
    );
    if (fromProvenance != null) return fromProvenance;
  }
  const card = hvacCardForMeasurementKey(field);
  if (!card?.itemId) return null;
  const itemQuantities =
    measurements.itemQuantities && typeof measurements.itemQuantities === 'object'
      ? (measurements.itemQuantities as Record<
          string,
          { quantity?: unknown } | undefined
        >)
      : {};
  return positiveMeasurement(itemQuantities[card.itemId]?.quantity);
}

function hvacOptionPrimaryField(option: TradeOption): string | null {
  if (option.id === HVAC_SYSTEMS_OPTION_ID) return 'hvacSystemCount';
  if (option.id === HVAC_CAPACITY_OPTION_ID) return 'hvacSystemTons';
  if ((HVAC_EQUIPMENT_OPTION_IDS as readonly string[]).includes(option.id)) {
    return 'hvacEquipmentReplacementCount';
  }
  return option.measurementKey ?? null;
}

function isHvacFieldConfirmed(
  measurements: Record<string, unknown>,
  field: string
): boolean {
  const sources =
    measurements.quickMeasurementSources &&
    typeof measurements.quickMeasurementSources === 'object'
      ? (measurements.quickMeasurementSources as Record<string, string>)
      : {};
  const source = sources[field];
  if (source === 'contractor_confirmed_from_plan_review') return true;
  if (source === 'user_entered' || source === 'user_confirmed_suggestion') {
    return true;
  }
  const provenance =
    measurements.measurementProvenance &&
    typeof measurements.measurementProvenance === 'object'
      ? (measurements.measurementProvenance as Record<string, unknown>)[field]
      : null;
  if (provenance && typeof provenance === 'object') {
    const record = provenance as { status?: string; normalizedSource?: string };
    const status = String(record.status || '').toLowerCase();
    const normalized = String(record.normalizedSource || '').toUpperCase();
    if (status === 'user_confirmed' || normalized === 'USER_CONFIRMED') {
      return true;
    }
  }
  return false;
}

/** Plan takeoff left a value on this field — confirmed or still awaiting review. */
export function hvacFieldHasTakeoffEvidence(
  measurements: Record<string, unknown>,
  field: string
): boolean {
  const sources =
    measurements.quickMeasurementSources &&
    typeof measurements.quickMeasurementSources === 'object'
      ? (measurements.quickMeasurementSources as Record<string, string>)
      : {};
  const source = sources[field];
  if (source && HVAC_TAKEOFF_SOURCE_TAGS.has(source)) {
    return coalesceHvacFieldValue(measurements, field) != null;
  }
  const provenance =
    measurements.measurementProvenance &&
    typeof measurements.measurementProvenance === 'object'
      ? (measurements.measurementProvenance as Record<string, unknown>)[field]
      : null;
  if (provenance && typeof provenance === 'object') {
    const record = provenance as {
      status?: string;
      normalizedSource?: string;
      pricingEligible?: boolean;
      value?: unknown;
    };
    const status = String(record.status || '').toLowerCase();
    const normalized = String(record.normalizedSource || '').toUpperCase();
    if (
      status === 'needs_review' ||
      normalized === 'NEEDS_REVIEW' ||
      record.pricingEligible === false ||
      status === 'user_confirmed' ||
      normalized === 'USER_CONFIRMED' ||
      normalized === 'FROM_PLAN'
    ) {
      return coalesceHvacFieldValue(measurements, field) != null;
    }
  }
  return coalesceHvacFieldValue(measurements, field) != null;
}

/** Map confirmed takeoff / manually entered HVAC quantities onto scope chips. */
export function inferHvacScopeSelectionsFromMeasurements(
  measurements: Record<string, unknown>
): string[] {
  const inferred: string[] = [];
  const spec = SIMPLE_TRADE_SPECS.hvac;

  for (const option of spec.options) {
    if (option.id === 'mini_split') continue;
    if ((HVAC_EQUIPMENT_OPTION_IDS as readonly string[]).includes(option.id)) {
      continue;
    }
    if ((HVAC_OPTIONAL_ADDON_OPTION_IDS as readonly string[]).includes(option.id)) {
      continue;
    }
    const field = hvacOptionPrimaryField(option);
    if (!field) continue;
    if (!isHvacFieldConfirmed(measurements, field)) continue;
    inferred.push(option.id);
  }

  return inferred;
}

function hvacOptionIsPendingTakeoffRead(
  measurements: Record<string, unknown>,
  option: TradeOption
): boolean {
  const field = hvacOptionPrimaryField(option);
  return Boolean(
    field &&
      hvacFieldHasTakeoffEvidence(measurements, field) &&
      !isHvacFieldConfirmed(measurements, field)
  );
}

function pruneLegacyBulkEquipmentSelections(
  measurements: Record<string, unknown>,
  selections: string[]
): string[] {
  return selections.filter(id => {
    const isEquipment = (HVAC_EQUIPMENT_OPTION_IDS as readonly string[]).includes(
      id
    );
    // Typed chip quantities are contractor intent. Do not drop them because the
    // shared replacement count looks like an unconfirmed plan read.
    if (isEquipment && hasManualHvacEquipmentIntent(measurements)) {
      return true;
    }
    const option = SIMPLE_TRADE_SPECS.hvac.options.find(
      candidate => candidate.id === id
    );
    if (option && hvacOptionIsPendingTakeoffRead(measurements, option)) {
      return false;
    }
    if (!isEquipment) {
      return true;
    }
    return hvacFieldHasTakeoffEvidence(
      measurements,
      'hvacEquipmentReplacementCount'
    );
  });
}

export function mergeHvacScopeSelections(
  saved: string[],
  inferred: string[]
): string[] {
  const merged = [...saved];
  for (const id of inferred) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

/** Resolve HVAC chip selections for UI — infer from takeoff when nothing saved yet. */
export function resolveHvacTradeScopeSelections(
  measurements: Record<string, unknown>
): string[] {
  const saved = selectedScope(measurements, 'hvac');
  const inferred = inferHvacScopeSelectionsFromMeasurements(measurements);
  return mergeHvacScopeSelections(
    pruneLegacyBulkEquipmentSelections(measurements, saved),
    inferred
  );
}

export const HVAC_SCOPE_EQUIPMENT_EXPAND_HIGHLIGHT = '__equipment_expand__' as const;

const HVAC_MEASUREMENT_FIELD_TO_OPTION_ID: Record<string, string> = {
  hvacSystemCount: HVAC_SYSTEMS_OPTION_ID,
  hvacSystemTons: HVAC_CAPACITY_OPTION_ID,
  hvacDuctworkLf: 'ductwork',
  hvacSupplyRegisterCount: 'registers',
  hvacReturnGrilleCount: 'returns',
  hvacThermostatCount: 'thermostat',
  hvacVentilationCount: 'ventilation',
  hvacEquipmentReplacementCount: HVAC_SCOPE_EQUIPMENT_EXPAND_HIGHLIGHT,
};

/** Map a confirmed plan-read measurement key to its HVAC scope chip id. */
export function hvacScopeOptionIdForMeasurementField(field: string): string | null {
  return HVAC_MEASUREMENT_FIELD_TO_OPTION_ID[field] ?? null;
}

/** Persist a confirmed plan read onto the matching HVAC scope chip selection. */
export function applyHvacScopeSelectionForConfirmedField(
  measurements: Record<string, unknown>,
  field: string
): Record<string, unknown> {
  const optionId = hvacScopeOptionIdForMeasurementField(field);
  if (!optionId) return measurements;
  if (optionId === HVAC_SCOPE_EQUIPMENT_EXPAND_HIGHLIGHT) {
    return applyHvacScopeMeasurements(measurements);
  }
  const saved = selectedScope(measurements, 'hvac');
  if (saved.includes(optionId)) {
    return applyHvacScopeMeasurements(measurements);
  }
  const next = {
    ...measurements,
    tradeScopeSelections: {
      ...((measurements.tradeScopeSelections as Record<string, string[]>) || {}),
      hvac: [...saved, optionId],
    },
  };
  return applyHvacScopeMeasurements(next);
}

export function summarizeHvacScopePanel(measurements: Record<string, unknown>): {
  inBidCount: number;
  needsConfirmationCount: number;
} {
  const selections = resolveHvacTradeScopeSelections(measurements);
  const spec = SIMPLE_TRADE_SPECS.hvac;
  let needsConfirmationCount = 0;
  for (const id of selections) {
    const option = spec.options.find(candidate => candidate.id === id);
    if (!option) continue;
    if (
      hvacScopeChipReviewState(measurements, option, selections) ===
      'needs_confirmation'
    ) {
      needsConfirmationCount += 1;
    }
  }
  return { inBidCount: selections.length, needsConfirmationCount };
}

function finalizeHvacScopeSelections(
  measurements: Record<string, unknown>,
  selections: string[],
  _spec: TradeSpec
): string[] {
  return resolveHvacTradeScopeSelections(measurements);
}

export function formatHvacScopeChipQuantity(
  measurements: Record<string, unknown>,
  option: TradeOption,
  selections: string[] = selectedScope(measurements, 'hvac')
): string | null {
  if (option.id === 'ventilation') return null;
  const field = hvacOptionPrimaryField(option);
  if (!field) return null;
  if ((HVAC_EQUIPMENT_OPTION_IDS as readonly string[]).includes(option.id)) {
    if (!selections.includes(option.id)) return null;
    const value = readHvacEquipmentTypeCount(measurements, option.id);
    return value == null ? null : formatHvacQuantityCaption(value, option.unit);
  }
  if (!selections.includes(option.id)) return null;
  const value = coalesceHvacFieldValue(measurements, field);
  if (value == null) return null;
  return formatHvacQuantityCaption(value, option.unit);
}

export function hvacScopeChipReviewState(
  measurements: Record<string, unknown>,
  option: TradeOption,
  selections: string[] = selectedScope(measurements, 'hvac')
): HvacScopeChipReviewState {
  const field = hvacOptionPrimaryField(option);
  if (!field) {
    return selections.includes(option.id) ? 'confirmed' : 'idle';
  }
  if (isHvacFieldConfirmed(measurements, field)) {
    return selections.includes(option.id) || hvacFieldHasTakeoffEvidence(measurements, field)
      ? 'confirmed'
      : 'idle';
  }
  if (
    selections.includes(option.id) &&
    hvacFieldHasTakeoffEvidence(measurements, field)
  ) {
    return 'needs_confirmation';
  }
  if (hvacFieldHasTakeoffEvidence(measurements, field)) {
    return 'needs_confirmation';
  }
  return selections.includes(option.id) ? 'confirmed' : 'idle';
}

export function formatHvacOptionalAddOnIdleHint(
  option: TradeOption
): string | null {
  if (option.id !== 'ventilation') return null;
  return HVAC_VENTILATION_IDLE_HINT;
}

export function formatHvacOptionalAddOnChipCaption(
  measurements: Record<string, unknown>,
  option: TradeOption
): string | null {
  if (option.id !== 'ventilation') return null;
  const value = positiveMeasurement(measurements.hvacVentilationCount);
  if (value != null) return formatHvacQuantityCaption(value, option.unit);
  const selected = selectedScope(measurements, 'hvac').includes(option.id);
  if (selected) return 'Included · enter quantity';
  return 'Not on plans · $0';
}

export function hvacScopeChipActive(
  option: TradeOption,
  selections: string[],
  _measurements: Record<string, unknown>,
  spec: TradeSpec
): boolean {
  if (selections.includes(option.id)) return true;
  const canonicalSelected = selections.includes(option.canonicalId);
  const hasAlias = selections.some((value) =>
    spec.options.some((candidate) => candidate.id === value)
  );
  const firstCanonicalOption = spec.options.find(
    (candidate) => candidate.canonicalId === option.canonicalId
  )?.id;
  return (
    canonicalSelected &&
    !hasAlias &&
    option.id === firstCanonicalOption
  );
}

/** Each selected HVAC chip owns its own quantity field below the chips. */
export function hvacScopePanelMeasurementRows(
  activeOptions: TradeOption[]
): TradeOption[] {
  return activeOptions.filter(option => Boolean(option.measurementKey));
}

export function hvacScopePanelMeasurementValue(
  option: TradeOption,
  measurements: Record<string, unknown>
): string {
  if (option.id === HVAC_SYSTEMS_OPTION_ID) {
    return hvacPanelFieldDisplayValue(measurements, 'hvacSystemCount');
  }
  if (option.id === HVAC_CAPACITY_OPTION_ID) {
    return hvacPanelFieldDisplayValue(measurements, 'hvacSystemTons');
  }
  if (
    (HVAC_EQUIPMENT_OPTION_IDS as readonly string[]).includes(option.id)
  ) {
    if (!resolveHvacTradeScopeSelections(measurements).includes(option.id)) {
      return '';
    }
    const key = hvacEquipmentItemQuantityKey(option.id);
    const entry = (
      measurements.itemQuantities as Record<string, { quantity?: unknown }>
    )?.[key];
    if (entry?.quantity !== undefined && entry?.quantity !== null) {
      return String(entry.quantity).replace(/,/g, '');
    }
    const seeded = readHvacEquipmentTypeCount(measurements, option.id);
    return seeded == null ? '1' : String(seeded);
  }
  return option.measurementKey
    ? hvacPanelFieldDisplayValue(measurements, option.measurementKey)
    : '';
}

export function hvacScopePanelMeasurementField(
  option: TradeOption
): string | null {
  return hvacOptionPrimaryField(option);
}

export function applyHvacScopePanelMeasurementEdit(
  measurements: Record<string, unknown>,
  option: TradeOption,
  value: string
): Record<string, unknown> {
  if (option.id === HVAC_SYSTEMS_OPTION_ID) {
    return markHvacFieldUserEdited(measurements, 'hvacSystemCount', value);
  }
  if (option.id === HVAC_CAPACITY_OPTION_ID) {
    return markHvacFieldUserEdited(measurements, 'hvacSystemTons', value);
  }
  if (
    (HVAC_EQUIPMENT_OPTION_IDS as readonly string[]).includes(option.id)
  ) {
    const key = hvacEquipmentItemQuantityKey(option.id);
    const itemQuantities = {
      ...(((measurements.itemQuantities as Record<string, unknown>) ||
        {}) as Record<string, { quantity?: unknown; quantitySource?: string }>),
      [key]: {
        ...(((
          measurements.itemQuantities as Record<
            string,
            { quantity?: unknown; quantitySource?: string }
          >
        )?.[key] || {}) as object),
        quantity: value,
        quantitySource: 'user_entered',
      },
    };
    return syncHvacEquipmentScopeMeasurements({
      ...measurements,
      itemQuantities,
    });
  }
  return option.measurementKey
    ? markHvacFieldUserEdited(measurements, option.measurementKey, value)
    : measurements;
}

export function hvacScopePanelMeasurementHelper(
  measurements: Record<string, unknown>,
  option: TradeOption
): string | null {
  const field = hvacOptionPrimaryField(option);
  if (
    field &&
    hvacScopeChipReviewState(measurements, option) === 'needs_confirmation'
  ) {
    return 'Low-confidence plan read — confirm before pricing.';
  }
  return option.measurementHelper ?? null;
}

/** Seed HVAC canonical counts from chip selections when the user has not typed values yet. */
export function applyHvacScopeMeasurements(
  measurements: Record<string, unknown>
): Record<string, unknown> {
  const selections = selectedScope(measurements, 'hvac');
  if (!selections.length) return measurements;

  const next = { ...measurements };
  const equipmentIds = selections.filter(id =>
    (HVAC_EQUIPMENT_OPTION_IDS as readonly string[]).includes(id)
  );

  if (
    selections.includes('thermostat') &&
    positiveMeasurement(next.hvacThermostatCount) == null
  ) {
    next.hvacThermostatCount = 1;
  }
  if (
    selections.includes('registers') &&
    positiveMeasurement(next.hvacSupplyRegisterCount) == null
  ) {
    next.hvacSupplyRegisterCount = 1;
  }
  if (
    selections.includes('returns') &&
    positiveMeasurement(next.hvacReturnGrilleCount) == null
  ) {
    next.hvacReturnGrilleCount = 1;
  }

  return syncHvacEquipmentScopeMeasurements(next);
}

function selectedScope(measurements: Record<string, unknown>, scopeKey: SimpleTradeScopeKey): string[] {
  const selections = measurements.tradeScopeSelections;
  return selections && typeof selections === 'object' && !Array.isArray(selections)
    ? Array.isArray((selections as Record<string, unknown>)[scopeKey])
      ? ((selections as Record<string, unknown>)[scopeKey] as unknown[]).map(String)
      : []
    : [];
}

function includedIds(spec: TradeSpec, selections: string[]): Set<string> {
  const included = new Set<string>();
  for (const option of spec.options) {
    const selected =
      selections.includes(option.id) || selections.includes(option.canonicalId);
    // Persisted drafts may contain either the selector option ID or the
    // canonical checklist ID. Treat both forms as the same selection so a
    // roofing upgrade cannot disappear when the draft is rehydrated.
    if (selected) included.add(option.canonicalId);
  }
  return included;
}

function hydrateSimpleTrade(ctx: QmPanelHydrateContext, spec: TradeSpec): Record<string, unknown> {
  const saved = selectedScope(ctx.measurements, spec.scopeKey);
  const inferredFromChecklist = spec.options
    .filter(
      (option, index, options) =>
        !(spec.scopeKey === 'roofing' && option.id === 'underlayment') &&
        options.findIndex((candidate) => candidate.canonicalId === option.canonicalId) === index &&
        ctx.checklistItems.some((item) => item.id === option.canonicalId && item.state === 'included')
    )
    .map((option) => option.id);
  const inferredFromMeasurements =
    spec.scopeKey === 'hvac'
      ? inferHvacScopeSelectionsFromMeasurements(ctx.measurements)
      : [];
  const current =
    spec.scopeKey === 'hvac'
      ? finalizeHvacScopeSelections(
          ctx.measurements,
          saved.length
            ? saved
            : inferredFromMeasurements.length
              ? inferredFromMeasurements
              : inferredFromChecklist,
          spec
        )
      : saved.length
        ? saved
        : inferredFromChecklist;
  const hydrated = {
    ...ctx.measurements,
    tradeScopeSelections: {
      ...(((ctx.measurements as Record<string, unknown>).tradeScopeSelections as Record<string, string[]>) || {}),
      [spec.scopeKey]: current.length ? current : null,
    },
  };
  return spec.scopeKey === 'hvac' ? applyHvacScopeMeasurements(hydrated) : hydrated;
}

function syncSimpleTrade(items: ScopeChecklistItem[], measurements: Record<string, unknown>, spec: TradeSpec): ScopeChecklistItem[] {
  const included = includedIds(spec, selectedScope(measurements, spec.scopeKey));
  let next = items.map((item) => {
    if (!spec.embeddedIds.includes(item.id)) return item;
    if (included.has(item.id)) return item.state === 'included' ? item : { ...item, state: 'included' as const, noteBacked: true };
    return item.state === 'included' ? { ...item, state: 'excluded' as const, noteBacked: false } : item;
  });
  for (const id of included) {
    if (!next.some((item) => item.id === id)) {
      const option = spec.options.find(candidate => candidate.canonicalId === id || candidate.id === id);
      next = [
        ...next,
        {
          id,
          label: option?.label || id,
          helperText:
            spec.scopeKey === 'hvac' &&
            (HVAC_EQUIPMENT_OPTION_IDS as readonly string[]).includes(id)
              ? 'Additional / replacement equipment. Not part of the complete HVAC system package.'
              : undefined,
          inputType: 'yes_no',
          state: 'included',
          category: spec.scopeKey === 'hvac' ? 'System & Equipment' : 'general',
          noteBacked: true,
        },
      ];
    }
  }
  return spec.scopeKey === 'hvac' ? expandHvacEquipmentScopeDisplayItems(next, measurements) : next;
}

const HVAC_EQUIPMENT_SCOPE_LABELS: Record<string, string> = {
  furnace: 'Furnace',
  condenser: 'Condenser',
  heat_pump: 'Heat pump',
  mini_split: 'Mini split',
  air_handler: 'Air handler',
};

/** Confirm Scope priced cards for selected HVAC equipment types. */
export function expandHvacEquipmentScopeDisplayItems(
  items: ScopeChecklistItem[],
  measurements: Record<string, unknown>
): ScopeChecklistItem[] {
  const selections = resolveHvacTradeScopeSelections(measurements);
  const selectedIds = (HVAC_EQUIPMENT_OPTION_IDS as readonly string[]).filter(id =>
    selections.includes(id)
  );
  const withoutEquipmentTypes = items.filter(
    item => !(HVAC_EQUIPMENT_OPTION_IDS as readonly string[]).includes(item.id)
  );
  const cards: ScopeChecklistItem[] = selectedIds.map(id => {
    const existing = items.find(item => item.id === id);
    return {
      ...(existing || {}),
      id,
      label: HVAC_EQUIPMENT_SCOPE_LABELS[id] || id,
      helperText:
        'Additional / replacement equipment. Not part of the complete HVAC system package.',
      inputType: 'yes_no',
      state: 'included',
      category: 'System & Equipment',
      noteBacked: true,
    };
  });
  if (!cards.length) return withoutEquipmentTypes;
  const hvacIdx = withoutEquipmentTypes.findIndex(item => item.id === 'hvac');
  if (hvacIdx >= 0) {
    return [
      ...withoutEquipmentTypes.slice(0, hvacIdx + 1),
      ...cards,
      ...withoutEquipmentTypes.slice(hvacIdx + 1),
    ];
  }
  return [...cards, ...withoutEquipmentTypes];
}

export function simpleTradePanelFor(scopeKey: SimpleTradeScopeKey): QmPanelDefinition {
  const spec = SIMPLE_TRADE_SPECS[scopeKey];
  return {
    id: `${scopeKey}_qm`,
    templateKeys: [scopeKey],
    embeddedScopeItemIds: spec.embeddedIds,
    isActive: (ctx) => String(ctx.templateKey || '').toLowerCase() === scopeKey,
    hydrateMeasurements: (ctx) => hydrateSimpleTrade(ctx, spec),
    syncScopeItems: (items, measurements) => syncSimpleTrade(items, measurements, spec),
  };
}

export function simpleTradeSpec(scopeKey: SimpleTradeScopeKey): TradeSpec {
  return SIMPLE_TRADE_SPECS[scopeKey];
}

/** Tear-off / demo — rendered in its own QM card, separate from install. */
export const ROOFING_DEMO_OPTION_IDS = ['tear_off'] as const;

/** Main roofing install components (everything except tear-off and accessories). */
export const ROOFING_INSTALL_OPTION_IDS = [
  'underlayment',
  'ice_water_shield',
  'shingles',
  'drip_edge',
  'ridge_cap',
  'valley_flashing',
  'step_flashing',
  'wall_flashing',
  'decking_repair',
] as const;

/** Vents, penetrations, repairs, and closeout extras. */
export const ROOFING_ACCESSORY_OPTION_IDS = [
  'ridge_vent',
  'roof_vents',
  'turbine_vents',
  'pipe_boots',
  'chimney_flashing',
  'skylight_flashing',
  'roof_penetrations',
  'roof_repairs',
  'cleanup',
] as const;

/** Gutters and downspouts — separate drainage card in QM and Confirm Scope. */
export const ROOFING_DRAINAGE_OPTION_IDS = ['gutters', 'downspouts'] as const;

export function roofingOptionsForIds(
  ids: readonly string[]
): TradeOption[] {
  const wanted = new Set(ids);
  return ROOFING_OPTIONS.filter((option) => wanted.has(option.id));
}
