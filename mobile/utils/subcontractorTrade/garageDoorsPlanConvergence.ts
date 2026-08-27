import {
  openingScheduleQuantityTotal,
  tallyGarageDoorTypesFromSchedule,
  type OpeningSchedules,
} from './windowsDoorsPlanConvergence';

export type GarageDoorsReconcileContext = {
  rooms?: Array<{ name?: string | null }> | null;
  openingSchedules?: OpeningSchedules | null;
};

export function countRvGarageRooms(
  rooms?: Array<{ name?: string | null }> | null
): number {
  return (rooms || []).filter(room =>
    /\brv\s*garage\b/i.test(String(room?.name || ''))
  ).length;
}

export function countStandardGarageRooms(
  rooms?: Array<{ name?: string | null }> | null
): number {
  return (rooms || []).filter(room => {
    const name = String(room?.name || '');
    return /\bgarage\b/i.test(name) && !/\brv\s*garage\b/i.test(name);
  }).length;
}

/**
 * Fix mis-bucketed garage doors when the plan labels a separate RV bay or the
 * schedule shows tall/RV openings that vision typed as single-car.
 */
export function reconcileGarageDoorTypeCounts(
  input: Record<string, unknown> = {},
  context?: GarageDoorsReconcileContext
): Record<string, number> {
  let single = positiveCount(input.garageDoorSingleCount) || 0;
  let double = positiveCount(input.garageDoorDoubleCount) || 0;
  let rv = positiveCount(input.garageDoorRvCount) || 0;
  const opener = positiveCount(input.garageDoorOpenerCount);

  const scheduleTallies = tallyGarageDoorTypesFromSchedule(
    context?.openingSchedules
  );
  const scheduleTotal =
    scheduleTallies.single +
    scheduleTallies.double +
    scheduleTallies.rv +
    scheduleTallies.unclassified;
  if (scheduleTotal > 0 && scheduleTallies.unclassified === 0) {
    single = scheduleTallies.single;
    double = scheduleTallies.double;
    rv = scheduleTallies.rv;
  } else if (scheduleTallies.rv > rv) {
    const need = scheduleTallies.rv - rv;
    const fromSingle = Math.min(single, need);
    single -= fromSingle;
    rv += fromSingle;
  }

  const rvGarageRooms = countRvGarageRooms(context?.rooms);
  if (rvGarageRooms > 0 && rv === 0 && single > 0) {
    const transfer = Math.min(single, rvGarageRooms);
    single -= transfer;
    rv += transfer;
  }

  const out: Record<string, number> = {};
  if (single > 0) out.garageDoorSingleCount = single;
  if (double > 0) out.garageDoorDoubleCount = double;
  if (rv > 0) out.garageDoorRvCount = rv;
  if (opener != null) out.garageDoorOpenerCount = opener;
  return out;
}

export type GarageDoorsQuantityKey =
  | 'garageDoorSingleCount'
  | 'garageDoorDoubleCount'
  | 'garageDoorRvCount'
  | 'garageDoorOpenerCount';

export const GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS: GarageDoorsQuantityKey[] =
  [
    'garageDoorSingleCount',
    'garageDoorDoubleCount',
    'garageDoorRvCount',
    'garageDoorOpenerCount',
  ];

export const GARAGE_DOORS_PLAN_QUICK_MEASUREMENT_KEYS: GarageDoorsQuantityKey[] =
  [...GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS];

export const GARAGE_DOORS_PLAN_SCOPE_ALLOWLIST = [
  'garage_doors',
  'garage_door_openers',
] as const;

export const GARAGE_DOORS_COUNT_SCOPE_ITEM_IDS = [
  'garage_doors',
  'garage_door_openers',
] as const;

export function isGarageDoorsCountScopeItemId(
  itemId: string | null | undefined
): boolean {
  return GARAGE_DOORS_COUNT_SCOPE_ITEM_IDS.includes(
    String(itemId || '') as (typeof GARAGE_DOORS_COUNT_SCOPE_ITEM_IDS)[number]
  );
}

const GARAGE_DOORS_REVIEW_LABELS: Record<GarageDoorsQuantityKey, string> = {
  garageDoorSingleCount: 'Single garage doors',
  garageDoorDoubleCount: 'Double garage doors',
  garageDoorRvCount: 'RV / oversized garage doors',
  garageDoorOpenerCount: 'Garage door openers',
};

export function garageDoorsReviewMeasurementLabel(key: string): string | null {
  return GARAGE_DOORS_REVIEW_LABELS[key as GarageDoorsQuantityKey] ?? null;
}

function positiveCount(value: unknown): number | null {
  const count = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(count) && count > 0 ? Math.round(count) : null;
}

export function normalizeGarageDoorsPlanMeasurements(
  input: Record<string, unknown> = {},
  context?: GarageDoorsReconcileContext
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
    const max = key === 'garageDoorOpenerCount' ? 20 : 20;
    const value = positiveCount(input[key]);
    if (value != null && value <= max) out[key] = value;
  }
  if (!context?.rooms?.length && !context?.openingSchedules?.garageDoors?.length) {
    return out;
  }
  return reconcileGarageDoorTypeCounts(out, context);
}

export function buildGarageDoorsStructuredMeasurements(
  input: Record<string, unknown> = {},
  quantitySource: 'plan_detected' | 'user_entered' = 'plan_detected'
): {
  itemQuantities: Record<
    string,
    { quantity: number; unit: 'each'; quantitySource: string }
  >;
} {
  const measurements = normalizeGarageDoorsPlanMeasurements(input);
  const itemQuantities: Record<
    string,
    { quantity: number; unit: 'each'; quantitySource: string }
  > = {};
  const garageCount =
    (measurements.garageDoorSingleCount || 0) +
    (measurements.garageDoorDoubleCount || 0) +
    (measurements.garageDoorRvCount || 0);
  if (garageCount > 0) {
    itemQuantities.garage_doors = {
      quantity: garageCount,
      unit: 'each',
      quantitySource,
    };
  }
  if (measurements.garageDoorOpenerCount) {
    itemQuantities.garage_door_openers = {
      quantity: measurements.garageDoorOpenerCount,
      unit: 'each',
      quantitySource,
    };
  }
  return { itemQuantities };
}

const GARAGE_DOORS_SCOPE_CARDS = [
  {
    itemId: 'garage_doors' as const,
    label: 'Garage doors',
    keys: [
      'garageDoorSingleCount',
      'garageDoorDoubleCount',
      'garageDoorRvCount',
    ] as const,
  },
  {
    itemId: 'garage_door_openers' as const,
    label: 'Garage door openers',
    keys: ['garageDoorOpenerCount'] as const,
  },
];

export function garageDoorsMeasurementKeysForScopeItem(
  itemId: string | null | undefined
): GarageDoorsQuantityKey[] {
  const id = String(itemId || '').trim();
  const card = GARAGE_DOORS_SCOPE_CARDS.find(row => row.itemId === id);
  return card ? [...card.keys] : [];
}

export function garageDoorsMeasurementKeyForScopeItem(
  itemId: string | null | undefined
): GarageDoorsQuantityKey | null {
  const keys = garageDoorsMeasurementKeysForScopeItem(itemId);
  return keys.length === 1 ? keys[0]! : null;
}

export function augmentGarageDoorsScopeDetections<
  T extends {
    itemId?: string | null;
    label?: string | null;
    evidence?: string | null;
    state?: string | null;
    confidence?: number | null;
  },
>(
  detections: T[],
  measurements: Record<string, number | string | null | undefined>
): T[] {
  const counts = normalizeGarageDoorsPlanMeasurements(measurements);
  const existing = new Set(
    detections.map(row => String(row.itemId || '').trim()).filter(Boolean)
  );
  const additions: T[] = [];
  for (const card of GARAGE_DOORS_SCOPE_CARDS) {
    const count = card.keys.reduce((sum, key) => {
      const value = counts[key];
      return value != null ? sum + value : sum;
    }, 0);
    if (count <= 0 || existing.has(card.itemId)) continue;
    additions.push({
      itemId: card.itemId,
      label: card.label,
      evidence: `${count} ${card.label.toLowerCase()} from plan`,
      state: 'included',
      confidence: 0.92,
    } as T);
    existing.add(card.itemId);
  }
  return [...detections, ...additions];
}

/** Always expose garage door count rows in Plan Review, even when vision could not verify. */
export function seedGarageDoorsReviewMeasurements(
  measurements: Record<string, unknown> = {},
  takeoff?: {
    lowConfidence?: Array<{ field?: string | null; value?: unknown }> | null;
    measurementProvenance?: Record<
      string,
      { value?: unknown } | unknown
    > | null;
    itemQuantities?: Record<string, { quantity?: unknown } | undefined> | null;
  } | null
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...measurements };
  const itemByKey: Partial<Record<GarageDoorsQuantityKey, string>> = {
    garageDoorOpenerCount: 'garage_door_openers',
  };
  for (const reading of takeoff?.lowConfidence || []) {
    const key = String(reading?.field || '') as GarageDoorsQuantityKey;
    if (!GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS.includes(key)) continue;
    if (positiveCount(next[key]) != null) continue;
    const value = positiveCount(reading?.value);
    if (value != null) next[key] = value;
  }
  for (const key of GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
    if (positiveCount(next[key]) != null) continue;
    const provenance = takeoff?.measurementProvenance?.[key];
    const provenanceValue =
      provenance && typeof provenance === 'object'
        ? positiveCount((provenance as { value?: unknown }).value)
        : null;
    if (provenanceValue != null) {
      next[key] = provenanceValue;
      continue;
    }
    const itemKey = itemByKey[key];
    const itemValue = itemKey
      ? positiveCount(takeoff?.itemQuantities?.[itemKey]?.quantity)
      : null;
    if (itemValue != null && key === 'garageDoorOpenerCount') {
      next[key] = itemValue;
    }
  }
  return next;
}

export function garageDoorsTakeoffQuickMeasurementSources(input: {
  values?: Record<string, unknown> | null;
  confirmedKeys?: Iterable<string> | null;
}): Partial<
  Record<
    GarageDoorsQuantityKey,
    'needs_confirmation' | 'contractor_confirmed_from_plan_review'
  >
> {
  const confirmed = new Set(
    [...(input.confirmedKeys || [])]
      .map(key => String(key || '').trim())
      .filter(Boolean)
  );
  const out: Partial<
    Record<
      GarageDoorsQuantityKey,
      'needs_confirmation' | 'contractor_confirmed_from_plan_review'
    >
  > = {};
  for (const key of GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
    if (positiveCount(input.values?.[key]) == null) continue;
    out[key] = confirmed.has(key)
      ? 'contractor_confirmed_from_plan_review'
      : 'needs_confirmation';
  }
  return out;
}

export function syncGarageDoorsScopeItems<
  T extends { id: string; state?: string },
>(
  items: T[],
  quantities?: Partial<Record<GarageDoorsQuantityKey, unknown>> & {
    itemQuantities?: Record<string, { quantity?: unknown }>;
  }
): T[] {
  const active = new Set<string>();
  for (const card of GARAGE_DOORS_SCOPE_CARDS) {
    const total = card.keys.reduce((sum, key) => {
      const value = Number(
        String(quantities?.[key] ?? '').replace(/,/g, '')
      );
      return Number.isFinite(value) && value > 0 ? sum + value : sum;
    }, 0);
    const fromItem = Number(
      quantities?.itemQuantities?.[card.itemId]?.quantity
    );
    if (total > 0 || (Number.isFinite(fromItem) && fromItem > 0)) {
      active.add(card.itemId);
    }
  }
  return items.map(item => {
    if (!active.has(item.id)) return item;
    if (item.state === 'included' || item.state === 'excluded') return item;
    return { ...item, state: 'included' };
  });
}

export function hydrateGarageDoorsPlanReviewMeasurements(
  measurements: Record<string, unknown> = {},
  schedules?: OpeningSchedules | null,
  rooms?: Array<{ name?: string | null }> | null
): Record<string, number | string> {
  const normalized = normalizeGarageDoorsPlanMeasurements(measurements, {
    openingSchedules: schedules,
    rooms,
  });
  const out: Record<string, number | string> = {};
  for (const key of GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
    const fromSchedule = openingScheduleQuantityTotal(key, schedules);
    out[key] =
      normalized[key] != null
        ? normalized[key]
        : fromSchedule != null
          ? fromSchedule
          : '';
  }
  return out;
}

export function isGarageDoorsPlanReviewKey(key: string): boolean {
  return GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS.includes(
    key as GarageDoorsQuantityKey
  );
}
