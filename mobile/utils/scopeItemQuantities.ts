/**
 * Client-side mirror of bathroom checklist quantity rules for Confirm Scope UI.
 * Backend source of truth: backend/src/services/scopeItemQuantityCatalog.js
 */

import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { parseScopeMeasurementInput } from '@/utils/scopeMeasurements';

export type QuantitySource =
  | 'notes'
  | 'user_entered'
  | 'inferred'
  | 'default_assumption'
  | 'missing'
  | 'not_applicable';

export type ScopeItemQuantityRule = {
  defaultUnit: string;
  allowedUnits: string[];
  measurementKey?: keyof NormalizedScopeMeasurements;
  canUseRoomSqft?: boolean;
  requiresUserQuantity?: boolean;
  defaultQuantity?: number;
  quantityHelper?: string;
  missingMessage?: string;
};

export type NormalizedScopeMeasurements = {
  bathroomFloorSqft: number | null;
  baseboardLf: number | null;
  showerWallTileSqft: number | null;
  wallPaintSqft: number | null;
  itemQuantities: Record<string, ScopeItemQuantityValue>;
};

export type ScopeItemQuantityValue = {
  quantity: number | null;
  unit: string;
  quantitySource?: QuantitySource;
};

export type ResolvedItemQuantity = {
  quantity: number | null;
  unit: string;
  quantitySource: QuantitySource;
  sourceLabel: string;
  pricingReady: boolean;
  quantityHelper?: string;
  missingMessage?: string;
  showInput: boolean;
};

export const CHECKLIST_ITEM_QUANTITY_RULES: Record<string, ScopeItemQuantityRule> = {
  demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'bathroomFloorSqft',
    canUseRoomSqft: true,
    quantityHelper: 'Uses bathroom floor sqft for demo area.',
  },
  shower_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerWallTileSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter shower wall tile sqft — not bathroom floor sqft.',
    missingMessage: 'Enter shower wall tile sqft.',
  },
  waterproofing: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerWallTileSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Usually same as shower wall tile sqft.',
    missingMessage: 'Enter shower waterproofing sqft.',
  },
  floor_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'bathroomFloorSqft',
    canUseRoomSqft: true,
    quantityHelper: 'Uses bathroom floor sqft.',
  },
  tub_shower: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'each'],
    measurementKey: 'showerWallTileSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter shower wall tile sqft if replacing tile.',
    missingMessage: 'Enter shower area sqft.',
  },
  vanity: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 vanity. Edit if different.',
  },
  toilet: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 toilet. Edit if different.',
  },
  plumbing_rough: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter fixture moves or use a plumbing allowance.',
    missingMessage: 'Enter fixture count or allowance.',
  },
  electrical_rough: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum', 'hr'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter devices, fixtures, circuits, or allowance.',
    missingMessage: 'Enter device/fixture count or allowance.',
  },
  lighting: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 light fixture. Edit count if different.',
  },
  drywall: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    quantityHelper: 'Enter patch/repair sqft or lump sum.',
    missingMessage: 'Enter drywall repair sqft.',
  },
  paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'wallPaintSqft',
    requiresUserQuantity: true,
    quantityHelper: 'Enter wall/ceiling paint sqft.',
    missingMessage: 'Enter wall/ceiling paint sqft.',
  },
  trim: {
    defaultUnit: 'lf',
    allowedUnits: ['lf'],
    measurementKey: 'baseboardLf',
    requiresUserQuantity: true,
    quantityHelper: 'Linear feet around bathroom perimeter.',
    missingMessage: 'Enter baseboard LF.',
  },
  glass_door: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 shower door.',
  },
  plumbing_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 plumbing trim allowance.',
  },
  electrical_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 electrical trim allowance.',
  },
  permits: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 permit allowance.',
  },
  cleanup: {
    defaultUnit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance'],
    defaultQuantity: 1,
    quantityHelper: 'Assuming 1 cleanup/disposal lump sum.',
  },
};

function sourceLabel(source: QuantitySource): string {
  switch (source) {
    case 'notes':
      return 'From notes';
    case 'user_entered':
      return 'Entered';
    case 'inferred':
      return 'From room measurement';
    case 'default_assumption':
      return 'Assumed';
    case 'missing':
      return 'Needs measurement';
    default:
      return '';
  }
}

export function normalizeScopeMeasurements(measurements?: ScopeMeasurements | null): NormalizedScopeMeasurements {
  const itemQuantities = { ...(measurements?.itemQuantities || {}) };
  return {
    bathroomFloorSqft:
      parseScopeMeasurementInput(String(measurements?.bathroomFloorSqft ?? '')) ??
      parseScopeMeasurementInput(String(measurements?.sqft ?? '')),
    baseboardLf:
      parseScopeMeasurementInput(String(measurements?.baseboardLf ?? '')) ??
      parseScopeMeasurementInput(String(measurements?.lf ?? '')),
    showerWallTileSqft: parseScopeMeasurementInput(String(measurements?.showerWallTileSqft ?? '')),
    wallPaintSqft: parseScopeMeasurementInput(String(measurements?.wallPaintSqft ?? '')),
    itemQuantities,
  };
}

export function formatUnitLabel(unit: string): string {
  if (unit === 'sqft') return 'sqft';
  if (unit === 'lf') return 'LF';
  if (unit === 'each') return 'each';
  if (unit === 'allowance') return 'allowance';
  if (unit === 'lump_sum') return 'lump sum';
  if (unit === 'hr') return 'hr';
  return unit;
}

export function resolveChecklistItemQuantity(
  itemId: string,
  measurements: NormalizedScopeMeasurements
): ResolvedItemQuantity {
  const rule = CHECKLIST_ITEM_QUANTITY_RULES[itemId];
  if (!rule) {
    return {
      quantity: null,
      unit: 'lump_sum',
      quantitySource: 'missing',
      sourceLabel: 'Needs measurement',
      pricingReady: false,
      showInput: false,
    };
  }

  const override = measurements.itemQuantities[itemId];
  if (override?.quantity != null && override.quantity > 0) {
    return {
      quantity: override.quantity,
      unit: override.unit || rule.defaultUnit,
      quantitySource: override.quantitySource || 'user_entered',
      sourceLabel: sourceLabel(override.quantitySource || 'user_entered'),
      pricingReady: true,
      quantityHelper: rule.quantityHelper,
      showInput: true,
    };
  }

  if (rule.measurementKey && measurements[rule.measurementKey]) {
    const val = measurements[rule.measurementKey] as number;
    return {
      quantity: val,
      unit: rule.defaultUnit,
      quantitySource: 'inferred',
      sourceLabel:
        rule.measurementKey === 'bathroomFloorSqft' ? 'From room floor sqft' : 'From room measurement',
      pricingReady: true,
      quantityHelper: rule.quantityHelper,
      showInput: true,
    };
  }

  if (rule.defaultQuantity != null && !rule.requiresUserQuantity) {
    return {
      quantity: rule.defaultQuantity,
      unit: rule.defaultUnit,
      quantitySource: 'default_assumption',
      sourceLabel: sourceLabel('default_assumption'),
      pricingReady: true,
      quantityHelper: rule.quantityHelper,
      showInput: true,
    };
  }

  return {
    quantity: null,
    unit: rule.defaultUnit,
    quantitySource: 'missing',
    sourceLabel: sourceLabel('missing'),
    pricingReady: false,
    quantityHelper: rule.quantityHelper,
    missingMessage: rule.missingMessage,
    showInput: true,
  };
}

export function checklistItemInScope(item: {
  inputType?: string;
  state?: string;
  choiceId?: string | null;
}): boolean {
  if (item.inputType === 'choice') {
    return Boolean(item.choiceId && item.choiceId !== 'not_in_scope' && item.choiceId !== 'unsure');
  }
  return item.state === 'included';
}

export function countScopePricingReadiness(
  items: Array<{ id: string; inputType?: string; state?: string; choiceId?: string | null }>,
  measurements: NormalizedScopeMeasurements
): { ready: number; needsMeasurement: number } {
  let ready = 0;
  let needsMeasurement = 0;
  for (const item of items) {
    if (!checklistItemInScope(item)) continue;
    const resolved = resolveChecklistItemQuantity(item.id, measurements);
    if (resolved.pricingReady) ready += 1;
    else needsMeasurement += 1;
  }
  return { ready, needsMeasurement };
}

export function countDraftPricingReadiness(draft: EstimateAiDraft | null | undefined): {
  ready: number;
  needsMeasurement: number;
} {
  if (!draft) return { ready: 0, needsMeasurement: 0 };
  const items = draft.confirmedAssumptions || draft.scopeChecklist?.items || [];
  const norm = normalizeScopeMeasurements(draft.scopeMeasurements);
  return countScopePricingReadiness(items, norm);
}

export function scopeMeasurementsToPayload(
  input: ScopeMeasurementsInputExtended
): ScopeMeasurements {
  const itemQuantities: Record<string, ScopeItemQuantityValue> = {};
  for (const [id, raw] of Object.entries(input.itemQuantities || {})) {
    const q = parseScopeMeasurementInput(raw.quantity);
    if (q) {
      itemQuantities[id] = {
        quantity: q,
        unit: raw.unit,
        quantitySource: 'user_entered',
      };
    }
  }
  return {
    sqft: parseScopeMeasurementInput(input.bathroomFloorSqft),
    lf: parseScopeMeasurementInput(input.baseboardLf),
    bathroomFloorSqft: parseScopeMeasurementInput(input.bathroomFloorSqft),
    baseboardLf: parseScopeMeasurementInput(input.baseboardLf),
    showerWallTileSqft: parseScopeMeasurementInput(input.showerWallTileSqft),
    wallPaintSqft: parseScopeMeasurementInput(input.wallPaintSqft),
    itemQuantities: Object.keys(itemQuantities).length ? itemQuantities : undefined,
  };
}

export type ScopeMeasurementsInputExtended = {
  bathroomFloorSqft: string;
  baseboardLf: string;
  showerWallTileSqft: string;
  wallPaintSqft: string;
  itemQuantities: Record<string, { quantity: string; unit: string }>;
};

export function initialScopeMeasurementInputExtended(
  draft: { scopeMeasurements?: ScopeMeasurements | null } | null
): ScopeMeasurementsInputExtended {
  const saved = draft?.scopeMeasurements;
  const itemQuantities: Record<string, { quantity: string; unit: string }> = {};
  for (const [id, val] of Object.entries(saved?.itemQuantities || {})) {
    if (val.quantity) {
      itemQuantities[id] = { quantity: String(val.quantity), unit: val.unit };
    }
  }
  return {
    bathroomFloorSqft: saved?.bathroomFloorSqft
      ? String(saved.bathroomFloorSqft)
      : saved?.sqft
        ? String(saved.sqft)
        : '',
    baseboardLf: saved?.baseboardLf ? String(saved.baseboardLf) : saved?.lf ? String(saved.lf) : '',
    showerWallTileSqft: saved?.showerWallTileSqft ? String(saved.showerWallTileSqft) : '',
    wallPaintSqft: saved?.wallPaintSqft ? String(saved.wallPaintSqft) : '',
    itemQuantities,
  };
}
