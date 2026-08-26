import {
  openingScheduleQuantityTotal,
  type OpeningSchedules,
} from './windowsDoorsPlanConvergence';

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
  input: Record<string, unknown> = {}
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of GARAGE_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
    const max = key === 'garageDoorOpenerCount' ? 20 : 20;
    const value = positiveCount(input[key]);
    if (value != null && value <= max) out[key] = value;
  }
  return out;
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
    keys: [
      'garageDoorSingleCount',
      'garageDoorDoubleCount',
      'garageDoorRvCount',
    ] as const,
  },
  {
    itemId: 'garage_door_openers' as const,
    keys: ['garageDoorOpenerCount'] as const,
  },
];

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
  schedules?: OpeningSchedules | null
): Record<string, number | string> {
  const normalized = normalizeGarageDoorsPlanMeasurements(measurements);
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
