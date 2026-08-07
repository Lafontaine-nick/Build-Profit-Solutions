import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import type { QmPanelDefinition, QmPanelHydrateContext } from '@/utils/qmScopePanels/types';

export type SimpleTradeScopeKey = 'deck_patio' | 'hvac' | 'roofing';

type TradeOption = {
  id: string;
  label: string;
  canonicalId: string;
  measurementKey?: string;
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
  { id: 'underlayment', label: 'Underlayment', canonicalId: 'underlayment', measurementKey: 'roofSquares', unit: 'squares' },
  { id: 'ice_water_shield', label: 'Ice & water shield', canonicalId: 'underlayment', measurementKey: 'roofSquares', unit: 'squares' },
  { id: 'drip_edge', label: 'Drip edge', canonicalId: 'flashing', measurementKey: 'roofSquares', unit: 'squares' },
  { id: 'flashing', label: 'Flashing', canonicalId: 'flashing', measurementKey: 'roofSquares', unit: 'squares' },
  { id: 'shingles', label: 'Shingles', canonicalId: 'shingles_roofing', measurementKey: 'roofSquares', unit: 'squares' },
  { id: 'ridge_cap', label: 'Ridge cap', canonicalId: 'vents_penetrations', measurementKey: 'roofSquares', unit: 'squares' },
  { id: 'roof_vents', label: 'Roof vents', canonicalId: 'vents_penetrations', measurementKey: 'roofSquares', unit: 'squares' },
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
    embeddedIds: ['tear_off', 'underlayment', 'shingles_roofing', 'flashing', 'vents_penetrations', 'cleanup'],
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
    if (selections.includes(option.id)) included.add(option.canonicalId);
    if (option.measurementKey && Number(measurements[option.measurementKey]) > 0 && selections.includes(option.id)) {
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
