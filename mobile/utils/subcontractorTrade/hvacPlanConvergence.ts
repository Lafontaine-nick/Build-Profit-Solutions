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
    'Whole-house ventilation',
    'ERV, HRV, or dedicated fresh-air ventilation equipment shown on the plans.',
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

export const HVAC_VENTILATION_MEASUREMENT_KEY =
  'hvacVentilationCount' as const satisfies HvacPlanReviewCanonicalKey;

/** ERV/HRV/fresh-air evidence only — vision guesses and code notes do not count. */
export function isExplicitHvacVentilationEvidence(
  provenanceEntry: unknown,
  options?: {
    quickMeasurementSource?: string | null;
    itemQuantitySource?: string | null;
  }
): boolean {
  const qm = options?.quickMeasurementSource;
  if (
    qm === 'user_entered' ||
    qm === 'contractor_confirmed_from_plan_review'
  ) {
    return true;
  }
  const itemSource = options?.itemQuantitySource;
  if (
    itemSource === 'user_entered' ||
    itemSource === 'contractor_confirmed_from_plan_review'
  ) {
    return true;
  }
  if (!provenanceEntry || typeof provenanceEntry !== 'object') return false;
  const record = provenanceEntry as Record<string, unknown>;
  const source = String(record.source || '').toLowerCase();
  const normalized = String(record.normalizedSource || '').toUpperCase();
  const status = String(record.status || '').toLowerCase();
  if (source === 'vision_takeoff' || source === 'general_plan_takeoff') {
    return false;
  }
  if (source === 'pdf_text_instance_tags') return true;
  if (source.includes('equipment_schedule')) return true;
  if (
    normalized === 'USER_CONFIRMED' ||
    normalized === 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW' ||
    normalized === 'USER_ENTERED'
  ) {
    return true;
  }
  if (status === 'user_confirmed' || status === 'user_entered') return true;
  if (String(record.confirmedFrom || '').toUpperCase() === 'PLAN_REVIEW') {
    return true;
  }
  return false;
}

/** Whole-house ventilation is optional — only surface when plans document equipment. */
export function hasDocumentedHvacVentilationCount(
  source: Record<string, unknown> | null | undefined
): boolean {
  const itemQuantities =
    source?.itemQuantities && typeof source.itemQuantities === 'object'
      ? (source.itemQuantities as Record<string, { quantity?: unknown; quantitySource?: string }>)
      : {};
  const value =
    positiveNumber(source?.[HVAC_VENTILATION_MEASUREMENT_KEY]) ??
    positiveNumber(itemQuantities.ventilation?.quantity);
  if (value == null) return false;
  const provenance =
    source?.measurementProvenance &&
    typeof source.measurementProvenance === 'object'
      ? (source.measurementProvenance as Record<string, unknown>)
      : {};
  const sources =
    source?.quickMeasurementSources &&
    typeof source.quickMeasurementSources === 'object'
      ? (source.quickMeasurementSources as Record<string, string>)
      : {};
  return isExplicitHvacVentilationEvidence(
    provenance[HVAC_VENTILATION_MEASUREMENT_KEY],
    {
      quickMeasurementSource: sources[HVAC_VENTILATION_MEASUREMENT_KEY],
      itemQuantitySource: itemQuantities.ventilation?.quantitySource,
    }
  );
}

export function stripUnverifiedHvacVentilation(
  scopeMeasurements: Record<string, unknown>
): Record<string, unknown> {
  if (hasDocumentedHvacVentilationCount(scopeMeasurements)) {
    return scopeMeasurements;
  }
  const next = { ...scopeMeasurements };
  delete next[HVAC_VENTILATION_MEASUREMENT_KEY];
  if (next.measurementProvenance && typeof next.measurementProvenance === 'object') {
    const provenance = {
      ...(next.measurementProvenance as Record<string, unknown>),
    };
    delete provenance[HVAC_VENTILATION_MEASUREMENT_KEY];
    next.measurementProvenance = provenance;
  }
  if (
    next.quickMeasurementSources &&
    typeof next.quickMeasurementSources === 'object'
  ) {
    const sources = {
      ...(next.quickMeasurementSources as Record<string, string>),
    };
    delete sources[HVAC_VENTILATION_MEASUREMENT_KEY];
    next.quickMeasurementSources = sources;
  }
  if (next.itemQuantities && typeof next.itemQuantities === 'object') {
    const itemQuantities = {
      ...(next.itemQuantities as Record<string, unknown>),
    };
    delete itemQuantities.ventilation;
    next.itemQuantities = itemQuantities;
  }
  return next;
}

export function filterHvacPlanReviewReadingsForTakeoff<
  T extends { field: string; value: number },
>(
  readings: T[],
  takeoff?: HvacPlanReviewTakeoffInput | null,
  overrides?: Record<string, number | string | null | undefined>
): T[] {
  return readings.filter(reading => {
    if (reading.field !== HVAC_VENTILATION_MEASUREMENT_KEY) return true;
    if (positiveNumber(overrides?.[HVAC_VENTILATION_MEASUREMENT_KEY]) != null) {
      return true;
    }
    if (positiveNumber(reading.value) == null) return false;
    return hasDocumentedHvacVentilationCount({
      hvacVentilationCount: reading.value,
      measurementProvenance: takeoff?.measurementProvenance,
      itemQuantities: takeoff?.itemQuantities,
    });
  });
}

/** Seven review-row quantities shown in Review HVAC Takeoff. */
export const HVAC_PLAN_REVIEW_CANONICAL_KEYS = [
  'hvacSystemCount',
  'hvacSystemTons',
  'hvacDuctworkLf',
  'hvacSupplyRegisterCount',
  'hvacReturnGrilleCount',
  'hvacThermostatCount',
  'hvacVentilationCount',
] as const;

export type HvacPlanReviewCanonicalKey =
  (typeof HVAC_PLAN_REVIEW_CANONICAL_KEYS)[number];

export type HvacPlanReviewTakeoffInput = {
  measurements?: Record<string, unknown> | null;
  lowConfidence?: Array<{ field?: string | null; value?: unknown }> | null;
  measurementProvenance?: Record<string, unknown> | null;
  itemQuantities?: Record<
    string,
    { quantity?: unknown; unit?: string | null } | undefined
  > | null;
};

function provenanceMeasurementValue(entry: unknown): number | null {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as Record<string, unknown>;
  return (
    positiveNumber(record.value) ?? positiveNumber(record.selectedValue)
  );
}

function itemQuantityForHvacReviewKey(
  key: HvacPlanReviewCanonicalKey,
  itemQuantities: HvacPlanReviewTakeoffInput['itemQuantities']
): number | null {
  const card = hvacCardForMeasurementKey(key);
  if (!card?.itemId) return null;
  const entry = itemQuantities?.[card.itemId];
  const quantity = positiveNumber(entry?.quantity);
  if (quantity == null) return null;
  if (card.itemId === 'hvac') {
    if (key === 'hvacSystemCount' && entry?.unit === 'ton') return null;
    if (key === 'hvacSystemTons' && entry?.unit === 'each') return null;
  }
  return quantity;
}

/**
 * Resolve the seven HVAC plan-review quantities from every takeoff source the
 * backend may populate (measurements, withheld low-confidence reads, provenance,
 * and structured itemQuantities).
 */
function coalesceHvacPlanReviewReadingNumber(
  takeoff: HvacPlanReviewTakeoffInput | null | undefined,
  key: HvacPlanReviewCanonicalKey,
  override?: number | string | null | undefined
): number | null {
  const fromOverride = positiveNumber(override);
  if (fromOverride != null) return fromOverride;

  const measurements = takeoff?.measurements || {};
  const provenance = takeoff?.measurementProvenance || {};
  const lowConfidenceEntry = (takeoff?.lowConfidence || []).find(
    reading => String(reading?.field || '').trim() === key
  );

  for (const candidate of [
    measurements[key],
    ...(key === HVAC_VENTILATION_MEASUREMENT_KEY
      ? []
      : [lowConfidenceEntry?.value]),
    provenanceMeasurementValue(provenance[key]),
    itemQuantityForHvacReviewKey(key, takeoff?.itemQuantities),
  ]) {
    const parsed = positiveNumber(candidate);
    if (parsed != null) return parsed;
  }

  return null;
}

export function resolveHvacPlanReviewMeasurements(
  takeoff: HvacPlanReviewTakeoffInput | null | undefined
): Record<HvacPlanReviewCanonicalKey, string> {
  const provenance = takeoff?.measurementProvenance || {};
  const itemQuantities = takeoff?.itemQuantities || {};
  const out = {} as Record<HvacPlanReviewCanonicalKey, string>;

  for (const key of HVAC_PLAN_REVIEW_CANONICAL_KEYS) {
    const resolved = coalesceHvacPlanReviewReadingNumber(takeoff, key);
    if (
      key === HVAC_VENTILATION_MEASUREMENT_KEY &&
      resolved != null &&
      !hasDocumentedHvacVentilationCount({
        hvacVentilationCount: resolved,
        measurementProvenance: provenance,
        itemQuantities,
      })
    ) {
      out[key] = '';
      continue;
    }
    out[key] = resolved != null ? String(resolved) : '';
  }

  // Match legacy review-modal merge: withheld low-confidence reads still fill
  // blank canonical rows even when measurements carry placeholder values.
  for (const reading of takeoff?.lowConfidence || []) {
    const field = String(reading?.field || '').trim() as HvacPlanReviewCanonicalKey;
    if (!HVAC_PLAN_REVIEW_CANONICAL_KEYS.includes(field)) continue;
    if (field === HVAC_VENTILATION_MEASUREMENT_KEY) continue;
    const value = positiveNumber(reading?.value);
    if (value == null) continue;
    if (!out[field]?.trim()) {
      out[field] = String(value);
    }
  }

  return out;
}

/** Build the seven HVAC takeoff review rows from low-confidence reads and resolved measurements. */
export function buildHvacPlanReviewLowConfidenceReadings(
  takeoff: HvacPlanReviewTakeoffInput | null | undefined,
  overrides?: Record<string, number | string | null | undefined>
): Array<{ field: HvacPlanReviewCanonicalKey; value: number }> {
  const resolved = resolveHvacPlanReviewMeasurements(takeoff);

  return HVAC_PLAN_REVIEW_CANONICAL_KEYS.map(key => {
    const value =
      coalesceHvacPlanReviewReadingNumber(takeoff, key, overrides?.[key]) ??
      positiveNumber(resolved[key]) ??
      0;
    if (
      key === HVAC_VENTILATION_MEASUREMENT_KEY &&
      !hasDocumentedHvacVentilationCount({
        hvacVentilationCount: value,
        measurementProvenance: takeoff?.measurementProvenance,
        itemQuantities: takeoff?.itemQuantities,
      })
    ) {
      return { field: key, value: 0 };
    }
    return { field: key, value };
  });
}

/** Canonical HVAC reads the contractor skipped in takeoff — surface again in Step 2. */
export function hvacTakeoffSkippedCanonicalReadings(
  readings: Array<{ field: string; value: number }>,
  accepted: Record<string, boolean>
): Array<{ field: HvacPlanReviewCanonicalKey; value: number }> {
  const byField = new Map(
    readings.map(reading => [String(reading.field || '').trim(), reading])
  );
  return HVAC_PLAN_REVIEW_CANONICAL_KEYS.flatMap(key => {
    if (accepted[key]) return [];
    const value = positiveNumber(byField.get(key)?.value) ?? 0;
    if (key === HVAC_VENTILATION_MEASUREMENT_KEY && value <= 0) return [];
    return [{ field: key, value }];
  });
}

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
    normalized === 'USER_CONFIRMED' ||
    String(record.confirmedFrom || '').toUpperCase() === 'PLAN_REVIEW' ||
    String(record.status || '').toLowerCase() === 'user_confirmed'
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
    normalized === 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW' ||
    normalized === 'USER_CONFIRMED' ||
    status === 'user_confirmed'
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
    if (deterministic.has(key)) continue;
    if (
      entry &&
      typeof entry === 'object' &&
      (String((entry as Record<string, unknown>).status || '').toLowerCase() ===
        'needs_review' ||
        String((entry as Record<string, unknown>).normalizedSource || '')
          .toUpperCase() === 'NEEDS_REVIEW')
    ) {
      sources[key] = 'needs_confirmation';
      continue;
    }
    if (isDeterministicHvacProvenance(entry)) {
      sources[key] = provenanceEntryToQuickMeasurementSource(entry);
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
    ...stripUnverifiedHvacVentilation({
      ...scopeMeasurements,
      measurementProvenance: provenance,
      quickMeasurementSources: sources,
    }),
  };
}

/** Force needs_confirmation QM tags for canonical HVAC rows still awaiting review. */
export function syncHvacSkippedTakeoffQuickMeasurementSources(
  scopeMeasurements: Record<string, unknown>
): Record<string, string> {
  const provenance =
    scopeMeasurements.measurementProvenance &&
    typeof scopeMeasurements.measurementProvenance === 'object'
      ? (scopeMeasurements.measurementProvenance as Record<string, unknown>)
      : {};
  const sources = {
    ...((scopeMeasurements.quickMeasurementSources as Record<string, string>) ||
      {}),
  };
  for (const key of HVAC_PLAN_REVIEW_CANONICAL_KEYS) {
    if (
      key === HVAC_VENTILATION_MEASUREMENT_KEY &&
      positiveNumber(scopeMeasurements[key]) == null
    ) {
      continue;
    }
    const entry = provenance[key];
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as {
      status?: string;
      normalizedSource?: string;
      pricingEligible?: boolean;
    };
    const needsReview =
      String(record.status || '').toLowerCase() === 'needs_review' ||
      String(record.normalizedSource || '').toUpperCase() === 'NEEDS_REVIEW' ||
      record.pricingEligible === false;
    if (needsReview) {
      sources[key] = 'needs_confirmation';
    }
  }
  return sources;
}
