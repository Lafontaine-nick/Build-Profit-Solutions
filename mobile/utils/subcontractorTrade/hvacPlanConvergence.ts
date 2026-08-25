/**
 * Canonical HVAC architecture.
 *
 * Plan Export and Notes/Voice use the same measurements and scope-card
 * quantities. HVAC is intentionally conservative: living SF is context only;
 * a system count, tonnage, or explicitly documented component quantity is
 * required before pricing.
 */

import type { QuickMeasurementSourceTag } from '@/utils/quickMeasurementProvenance';
import type { ScopePricingBehavior } from './scopePricingBehavior';

export type HvacQuantityKey =
  | 'hvacSystemCount'
  | 'hvacSystemTons'
  | 'hvacServiceCallCount'
  | 'hvacEquipmentReplacementCount'
  | 'hvacRefrigerantCount'
  | 'hvacThermostatCount'
  | 'hvacDuctworkLf'
  | 'hvacSupplyRegisterCount'
  | 'hvacReturnGrilleCount'
  | 'hvacVentilationCount'
  | 'hvacPermitCount'
  | 'hvacCleanupCount';

export type HvacCardGroupId =
  | 'system'
  | 'service'
  | 'equipment'
  | 'distribution'
  | 'controls'
  | 'closeout';

export type HvacCardDefinition = {
  itemId: string;
  measurementKey: HvacQuantityKey;
  label: string;
  helper: string;
  unit: 'each' | 'ton' | 'lf';
  groupId: HvacCardGroupId;
  groupTitle: string;
  pricingBehavior: ScopePricingBehavior;
};

const H = (
  itemId: string,
  measurementKey: HvacQuantityKey,
  label: string,
  helper: string,
  groupId: HvacCardGroupId,
  unit: HvacCardDefinition['unit'] = 'each'
): HvacCardDefinition => ({
  itemId,
  measurementKey,
  label,
  helper,
  unit,
  groupId,
  groupTitle:
    {
      system: 'System & equipment',
      service: 'Service',
      equipment: 'Equipment',
      distribution: 'Distribution',
      controls: 'Controls & ventilation',
      closeout: 'Project add-ons',
    }[groupId] || groupId,
  pricingBehavior: 'CUSTOM_PRICE',
});

export const HVAC_CARDS: HvacCardDefinition[] = [
  H(
    'hvac',
    'hvacSystemCount',
    'HVAC system',
    'Complete HVAC system package. Enter system count and labeled capacity (tons) separately when both are documented.',
    'system'
  ),
  H(
    'service_call',
    'hvacServiceCallCount',
    'HVAC service call',
    'Explicit service or diagnostic visits only. Do not infer a service call from a plan symbol.',
    'service'
  ),
  H(
    'equipment_replace',
    'hvacEquipmentReplacementCount',
    'HVAC equipment replacement',
    'Furnace, air-handler, condenser, heat-pump, or packaged-unit replacement when explicitly documented.',
    'equipment'
  ),
  H(
    'refrigerant',
    'hvacRefrigerantCount',
    'Refrigerant',
    'Refrigerant recovery, recharge, or line-set service when explicitly included. Use an allowance when the quantity is not countable.',
    'equipment'
  ),
  H(
    'thermostat',
    'hvacThermostatCount',
    'Thermostat',
    'Thermostat supply, replacement, or installation count.',
    'controls'
  ),
  H(
    'ductwork',
    'hvacDuctworkLf',
    'Ductwork',
    'Explicit ductwork or flex-duct linear feet. Do not infer duct LF from living area or system count.',
    'distribution',
    'lf'
  ),
  H(
    'supply_registers',
    'hvacSupplyRegisterCount',
    'Supply registers',
    'Count supply air registers or diffusers when documented on plans or schedules.',
    'distribution'
  ),
  H(
    'return_grilles',
    'hvacReturnGrilleCount',
    'Return grilles',
    'Count return air grilles when documented on plans or schedules.',
    'distribution'
  ),
  H(
    'ventilation',
    'hvacVentilationCount',
    'Ventilation',
    'Explicit HVAC ventilation equipment or connection count. Exhaust-fan electrical work remains separate.',
    'controls'
  ),
  H(
    'permits',
    'hvacPermitCount',
    'HVAC permits / inspections',
    'Permit or inspection allowance explicitly assigned to HVAC.',
    'closeout'
  ),
  H(
    'cleanup',
    'hvacCleanupCount',
    'HVAC cleanup',
    'Removal, disposal, and final cleanup assigned to HVAC.',
    'closeout'
  ),
];

/** Plan export / selected-trade HVAC scope — excludes standalone service & replacement lines. */
export const HVAC_PLAN_EXPORT_SCOPE_ITEM_IDS = [
  'hvac',
  'ductwork',
  'supply_registers',
  'return_grilles',
  'thermostat',
  'ventilation',
  'permits',
  'cleanup',
] as const;

export const HVAC_PLAN_SCOPE_ALLOWLIST = [...HVAC_PLAN_EXPORT_SCOPE_ITEM_IDS];

export const HVAC_PLAN_REVIEW_MEASUREMENT_KEYS = [
  ...new Set(HVAC_CARDS.map(card => card.measurementKey).concat('hvacSystemTons')),
] as HvacQuantityKey[];

export const HVAC_PLAN_QUICK_MEASUREMENT_KEYS = [
  'hvacSystemCount',
  'hvacSystemTons',
  'hvacDuctworkLf',
  'hvacSupplyRegisterCount',
  'hvacReturnGrilleCount',
  'hvacThermostatCount',
  'hvacVentilationCount',
] as const;

/** All HVAC quick-measurement keys persisted through Confirm Scope round-trips. */
export const HVAC_QUANTITY_KEYS = [
  ...HVAC_PLAN_REVIEW_MEASUREMENT_KEYS,
] as const;

export type HvacQuantityKeyFromList = (typeof HVAC_QUANTITY_KEYS)[number];

/** Persist HVAC quick-measurement fields through Confirm Scope payload round-trips. */
export function copyHvacQuantityFields(
  source: Record<string, unknown> | null | undefined,
  parse: (value: unknown) => number | null = positiveNumber
): Partial<Record<HvacQuantityKey, number | null>> {
  const out: Partial<Record<HvacQuantityKey, number | null>> = {};
  if (!source) return out;
  for (const key of HVAC_QUANTITY_KEYS) {
    const parsed = parse(source[key]);
    if (parsed != null) out[key] = parsed;
  }
  return out;
}

export const HVAC_SYSTEM_TONNAGE_TIERS = [2, 2.5, 3, 3.5, 4, 5] as const;

export type HvacTonnageTier = (typeof HVAC_SYSTEM_TONNAGE_TIERS)[number];

const HVAC_TONNAGE_TIER_RATES: Record<
  HvacTonnageTier,
  { material: number; labor: number }
> = {
  2: { material: 6200, labor: 5800 },
  2.5: { material: 6800, labor: 6400 },
  3: { material: 7400, labor: 7000 },
  3.5: { material: 8000, labor: 7500 },
  4: { material: 8500, labor: 7500 },
  5: { material: 9800, labor: 9200 },
};

/** Snap documented tonnage to the nearest standard residential system size. */
export function snapHvacTonnageTier(tons: number): HvacTonnageTier {
  if (!Number.isFinite(tons) || tons <= 0) return 4;
  let best: HvacTonnageTier = HVAC_SYSTEM_TONNAGE_TIERS[0];
  let bestDelta = Math.abs(tons - best);
  for (const tier of HVAC_SYSTEM_TONNAGE_TIERS) {
    const delta = Math.abs(tons - tier);
    if (delta < bestDelta) {
      best = tier;
      bestDelta = delta;
    }
  }
  return best;
}

/** National-average material/labor split for a full system at the snapped tonnage tier. */
export function hvacSystemTierBudgetSplit(tons: number): {
  material: number;
  labor: number;
  tierTons: HvacTonnageTier;
  sourceLabel: string;
} {
  const tierTons = snapHvacTonnageTier(tons);
  const rate = HVAC_TONNAGE_TIER_RATES[tierTons];
  return {
    material: rate.material,
    labor: rate.labor,
    tierTons,
    sourceLabel: `Suggested budget split · National Average · ${tierTons}-ton HVAC system`,
  };
}

export function hvacCardForItemId(
  itemId: string | null | undefined
): HvacCardDefinition | null {
  return HVAC_CARDS.find(card => card.itemId === itemId) || null;
}

export function hvacCardForMeasurementKey(
  key: string | null | undefined
): HvacCardDefinition | null {
  return HVAC_CARDS.find(card => card.measurementKey === key) || null;
}

export const HVAC_PLAN_ALIASES: Record<string, HvacQuantityKey> = {
  systemCount: 'hvacSystemCount',
  hvacCount: 'hvacSystemCount',
  hvacSystems: 'hvacSystemCount',
  systemTons: 'hvacSystemTons',
  hvacTons: 'hvacSystemTons',
  tonnage: 'hvacSystemTons',
  tons: 'hvacSystemTons',
  serviceCallCount: 'hvacServiceCallCount',
  equipmentReplaceCount: 'hvacEquipmentReplacementCount',
  equipmentReplacementCount: 'hvacEquipmentReplacementCount',
  thermostatCount: 'hvacThermostatCount',
  ductworkLf: 'hvacDuctworkLf',
  ductLf: 'hvacDuctworkLf',
  supplyRegisterCount: 'hvacSupplyRegisterCount',
  supplyRegisters: 'hvacSupplyRegisterCount',
  registerCount: 'hvacSupplyRegisterCount',
  returnGrilleCount: 'hvacReturnGrilleCount',
  returnGrilles: 'hvacReturnGrilleCount',
  returnCount: 'hvacReturnGrilleCount',
  ventilationCount: 'hvacVentilationCount',
  permitCount: 'hvacPermitCount',
  cleanupCount: 'hvacCleanupCount',
};

function positiveNumber(value: unknown): number | null {
  const number = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(number) && number > 0 ? number : null;
}

function itemQuantity(
  quantity: number | null,
  unit: HvacCardDefinition['unit'],
  quantitySource: string
) {
  return quantity == null
    ? undefined
    : {
        quantity,
        unit,
        quantitySource,
      };
}

/** Normalize plan/notes aliases without inventing missing HVAC quantities. */
export function normalizeHvacPlanMeasurements(
  input: Record<string, unknown> | null | undefined
): Record<string, number | string> {
  const source = input || {};
  const out: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value == null || value === '') continue;
    const canonical = HVAC_PLAN_ALIASES[key] || key;
    if (!HVAC_PLAN_REVIEW_MEASUREMENT_KEYS.includes(canonical as HvacQuantityKey)) {
      continue;
    }
    const numeric = positiveNumber(value);
    if (numeric != null) out[canonical] = numeric;
  }
  return out;
}

/**
 * Build the itemQuantities consumed by Confirm Scope and pricing. The root HVAC
 * card uses count first; tonnage remains on hvacSystemTons for capacity-tier pricing.
 */
export function hvacItemQuantitySource(
  key: HvacQuantityKey,
  sources?: Partial<Record<HvacQuantityKey, QuickMeasurementSourceTag | string>>,
  fallback = 'plan_detected'
): string {
  const tag = sources?.[key];
  if (tag === 'needs_confirmation') return 'needs_confirmation';
  if (tag === 'contractor_confirmed_from_plan_review') {
    return 'contractor_confirmed_from_plan_review';
  }
  if (
    tag === 'plan_detected' ||
    tag === 'detected_from_plan' ||
    tag === 'plan_verified' ||
    tag === 'ai_verified'
  ) {
    return 'plan_detected';
  }
  return fallback;
}

export function buildHvacStructuredMeasurements(
  input: Record<string, unknown> | null | undefined,
  quantitySource:
    | string
    | Partial<Record<HvacQuantityKey, QuickMeasurementSourceTag | string>> = 'plan_detected'
): { itemQuantities: Record<string, ReturnType<typeof itemQuantity>> } {
  const normalized = normalizeHvacPlanMeasurements(input);
  const sourceMap =
    typeof quantitySource === 'string' ? undefined : quantitySource;
  const defaultSource =
    typeof quantitySource === 'string' ? quantitySource : 'plan_detected';
  const itemQuantities: Record<
    string,
    { quantity: number; unit: HvacCardDefinition['unit']; quantitySource: string } | undefined
  > = {};
  const systemCount = positiveNumber(normalized.hvacSystemCount);
  const systemTons = positiveNumber(normalized.hvacSystemTons);
  const rootSource = sourceMap
    ? hvacItemQuantitySource('hvacSystemCount', sourceMap, defaultSource)
    : defaultSource;
  itemQuantities.hvac =
    itemQuantity(systemCount, 'each', rootSource) ||
    itemQuantity(systemTons, 'ton', rootSource);

  for (const card of HVAC_CARDS) {
    if (card.itemId === 'hvac') continue;
    const quantity = positiveNumber(normalized[card.measurementKey]);
    const cardSource = sourceMap
      ? hvacItemQuantitySource(card.measurementKey, sourceMap, defaultSource)
      : defaultSource;
    const entry = itemQuantity(quantity, card.unit, cardSource);
    if (entry) itemQuantities[card.itemId] = entry;
  }
  return {
    itemQuantities: Object.fromEntries(
      Object.entries(itemQuantities).filter(([, value]) => value != null)
    ) as Record<string, ReturnType<typeof itemQuantity>>,
  };
}

function isDeterministicHvacProvenance(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const record = entry as Record<string, unknown>;
  const source = String(record.source || '').toLowerCase();
  const normalized = String(record.normalizedSource || '').toUpperCase();
  if (source === 'pdf_text_instance_tags') return true;
  if (source.includes('equipment_schedule') || source.includes('pdf_text')) {
    return true;
  }
  if (
    normalized === 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW' ||
    String(record.confirmedFrom || '').toUpperCase() === 'PLAN_REVIEW'
  ) {
    return true;
  }
  return false;
}

function provenanceEntryToQuickMeasurementSource(
  entry: unknown
): QuickMeasurementSourceTag {
  if (!entry || typeof entry !== 'object') return 'needs_confirmation';
  const record = entry as {
    status?: unknown;
    normalizedSource?: unknown;
    pricingEligible?: unknown;
    confirmedFrom?: unknown;
  };
  const status = String(record.status || '').toLowerCase();
  const normalized = String(record.normalizedSource || '').toUpperCase();
  const confirmedFrom = String(record.confirmedFrom || '').toUpperCase();
  if (
    confirmedFrom === 'MANUAL' ||
    normalized === 'USER_ENTERED' ||
    status === 'user_entered'
  ) {
    return 'user_entered';
  }
  if (
    confirmedFrom === 'USER_CONFIRMED' ||
    confirmedFrom === 'PLAN_REVIEW' ||
    normalized === 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW'
  ) {
    return 'contractor_confirmed_from_plan_review';
  }
  if (
    status === 'needs_review' ||
    normalized === 'NEEDS_REVIEW' ||
    normalized === 'NEEDS_CONFIRMATION'
  ) {
    return 'needs_confirmation';
  }
  if (record.pricingEligible === false || status === 'conflict') {
    return 'needs_confirmation';
  }
  if (normalized === 'FROM_PLAN' || status === 'plan_verified') {
    return 'plan_verified';
  }
  if (normalized === 'AI_VERIFIED' || status === 'ai_verified') {
    return 'ai_verified';
  }
  return 'plan_detected';
}

/** Derive QM source tags from backend/mobile measurementProvenance records. */
export function hvacQuickMeasurementSourcesFromProvenance(
  measurements: Record<string, unknown> | null | undefined,
  provenance?: Record<string, unknown> | null
): Partial<Record<HvacQuantityKey, QuickMeasurementSourceTag>> {
  const out: Partial<Record<HvacQuantityKey, QuickMeasurementSourceTag>> = {};
  for (const key of HVAC_PLAN_REVIEW_MEASUREMENT_KEYS) {
    const value = positiveNumber(measurements?.[key]);
    if (value == null) continue;
    const entry = provenance?.[key];
    if (!entry) continue;
    out[key] = provenanceEntryToQuickMeasurementSource(entry);
  }
  return out;
}

/** Reconcile stored provenance with QM tags after plan import (client-side). */
export function applyHvacProvenanceGuardToScopeMeasurements(
  scopeMeasurements: Record<string, unknown>,
  options?: {
    deterministicKeys?: Iterable<string>;
  }
): Record<string, unknown> {
  const deterministic = new Set(options?.deterministicKeys || []);
  const provenance = {
    ...((scopeMeasurements.measurementProvenance as Record<string, unknown>) ||
      {}),
  };
  const sources = {
    ...((scopeMeasurements.quickMeasurementSources as Record<string, string>) ||
      {}),
  };

  for (const key of HVAC_PLAN_REVIEW_MEASUREMENT_KEYS) {
    const value = positiveNumber(scopeMeasurements[key]);
    if (value == null) continue;
    const entry = provenance[key];
    if (isDeterministicHvacProvenance(entry)) {
      sources[key] = provenanceEntryToQuickMeasurementSource(entry);
      continue;
    }
    if (deterministic.has(key)) continue;
    if (
      entry &&
      typeof entry === 'object' &&
      String((entry as Record<string, unknown>).normalizedSource || '').toUpperCase() ===
        'NEEDS_REVIEW'
    ) {
      sources[key] = 'needs_confirmation';
      continue;
    }
    if (
      sources[key] === 'plan_detected' ||
      sources[key] === 'detected_from_plan' ||
      sources[key] === 'plan_verified'
    ) {
      sources[key] = 'needs_confirmation';
      provenance[key] = {
        ...(entry && typeof entry === 'object' ? entry : {}),
        value,
        normalizedSource: 'NEEDS_REVIEW',
        status: 'needs_review',
        pricingEligible: false,
        reason:
          'No mechanical schedule or PDF text evidence supports this HVAC quantity.',
      };
    }
  }

  return {
    ...scopeMeasurements,
    measurementProvenance: provenance,
    quickMeasurementSources: sources,
  };
}
