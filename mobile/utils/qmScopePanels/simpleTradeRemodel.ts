import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';

export type SimpleTradeScopeKey = 'deck_patio' | 'hvac' | 'roofing';

type TradeOption = {
  id: string;
  label: string;
  canonicalId: string;
  measurementKey?: string;
  measurementHelper?: string;
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

const HVAC_OPTIONS: TradeOption[] = [
  { id: 'furnace', label: 'Furnace', canonicalId: 'equipment_replace', measurementKey: 'floorAreaSqft', unit: 'sqft' },
  { id: 'condenser', label: 'Condenser', canonicalId: 'equipment_replace', measurementKey: 'floorAreaSqft', unit: 'sqft' },
  { id: 'heat_pump', label: 'Heat pump', canonicalId: 'equipment_replace', measurementKey: 'floorAreaSqft', unit: 'sqft' },
  { id: 'mini_split', label: 'Mini split', canonicalId: 'equipment_replace', measurementKey: 'floorAreaSqft', unit: 'sqft' },
  { id: 'air_handler', label: 'Air handler', canonicalId: 'equipment_replace', measurementKey: 'floorAreaSqft', unit: 'sqft' },
  { id: 'ductwork', label: 'Ductwork', canonicalId: 'ductwork', measurementKey: 'floorAreaSqft', unit: 'sqft' },
  { id: 'thermostat', label: 'Thermostat', canonicalId: 'thermostat', unit: 'each' },
  { id: 'registers', label: 'Registers', canonicalId: 'ductwork', measurementKey: 'floorAreaSqft', unit: 'sqft' },
  { id: 'returns', label: 'Returns', canonicalId: 'ductwork', measurementKey: 'floorAreaSqft', unit: 'sqft' },
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
    embeddedIds: ['equipment_replace', 'ductwork', 'thermostat'],
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

function selectedScope(measurements: Record<string, unknown>, scopeKey: SimpleTradeScopeKey): string[] {
  const selections = measurements.tradeScopeSelections;
  return selections && typeof selections === 'object' && !Array.isArray(selections)
    ? Array.isArray((selections as Record<string, unknown>)[scopeKey])
      ? ((selections as Record<string, unknown>)[scopeKey] as unknown[]).map(String)
      : []
    : [];
}

function includedIds(spec: TradeSpec, selections: string[], measurements: Record<string, unknown>): Set<string> {
  const included = new Set<string>();
  for (const option of spec.options) {
    // Persisted drafts may contain either the selector option ID or the
    // canonical checklist ID. Treat both forms as the same selection so a
    // roofing upgrade cannot disappear when the draft is rehydrated.
    const selected =
      selections.includes(option.id) || selections.includes(option.canonicalId);
    if (selected) included.add(option.canonicalId);
    if (option.measurementKey && Number(measurements[option.measurementKey]) > 0 && selected) {
      included.add(option.canonicalId);
    }
  }
  return included;
}

function hydrateSimpleTrade(ctx: QmPanelHydrateContext, spec: TradeSpec): Record<string, unknown> {
  const saved = selectedScope(ctx.measurements, spec.scopeKey);
  const inferred = spec.options
    .filter(
      (option, index, options) =>
        !(spec.scopeKey === 'roofing' && option.id === 'underlayment') &&
        options.findIndex((candidate) => candidate.canonicalId === option.canonicalId) === index &&
        ctx.checklistItems.some((item) => item.id === option.canonicalId && item.state === 'included')
    )
    .map((option) => option.id);
  const current = saved.length ? saved : inferred;
  return {
    ...ctx.measurements,
    tradeScopeSelections: {
      ...(((ctx.measurements as Record<string, unknown>).tradeScopeSelections as Record<string, string[]>) || {}),
      [spec.scopeKey]: current,
    },
  };
}

function syncSimpleTrade(items: ScopeChecklistItem[], measurements: Record<string, unknown>, spec: TradeSpec): ScopeChecklistItem[] {
  const included = includedIds(spec, selectedScope(measurements, spec.scopeKey), measurements);
  let next = items.map((item) => {
    if (!spec.embeddedIds.includes(item.id)) return item;
    if (included.has(item.id)) return item.state === 'included' ? item : { ...item, state: 'included' as const, noteBacked: true };
    return item.state === 'included' ? { ...item, state: 'excluded' as const, noteBacked: false } : item;
  });
  for (const id of included) {
    if (!next.some((item) => item.id === id)) {
      next = [...next, { id, label: id, inputType: 'yes_no', state: 'included', category: 'general', noteBacked: true }];
    }
  }
  return next;
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
