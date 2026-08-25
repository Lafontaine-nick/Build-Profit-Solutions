/**
 * Canonical Windows & doors plan-import contract.
 *
 * Elevations, opening schedules, manual quick measurements, and Confirm Scope
 * all converge on these counts. Pricing remains in exteriorOpeningsPricing and
 * scopeItemQuantities.
 */

export type WindowsDoorsQuantityKey =
  | 'windowCount'
  | 'exteriorDoorCount'
  | 'slidingDoorCount'
  | 'garageDoorSingleCount'
  | 'garageDoorDoubleCount'
  | 'garageDoorRvCount';

export const WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS: WindowsDoorsQuantityKey[] =
  [
    'windowCount',
    'exteriorDoorCount',
    'slidingDoorCount',
    'garageDoorSingleCount',
    'garageDoorDoubleCount',
    'garageDoorRvCount',
  ];

export const WINDOWS_DOORS_PLAN_QUICK_MEASUREMENT_KEYS: WindowsDoorsQuantityKey[] =
  [...WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS];

export const WINDOWS_DOORS_PLAN_SCOPE_ALLOWLIST = [
  'windows_doors',
  'windows',
  'exterior_doors',
  'sliding_doors',
  'garage_doors',
] as const;

export const WINDOWS_DOORS_PLAN_ALIASES: Record<
  string,
  WindowsDoorsQuantityKey
> = {
  windowsCount: 'windowCount',
  exteriorDoorsCount: 'exteriorDoorCount',
  slidingDoorsCount: 'slidingDoorCount',
};

const ITEM_BY_MEASUREMENT: Record<
  WindowsDoorsQuantityKey,
  { id: string; unit: 'each' }
> = {
  windowCount: { id: 'windows', unit: 'each' },
  exteriorDoorCount: { id: 'exterior_doors', unit: 'each' },
  slidingDoorCount: { id: 'sliding_doors', unit: 'each' },
  garageDoorSingleCount: { id: 'garage_doors', unit: 'each' },
  garageDoorDoubleCount: { id: 'garage_doors', unit: 'each' },
  garageDoorRvCount: { id: 'garage_doors', unit: 'each' },
};

function positiveCount(value: unknown): number | null {
  const count = Number(
    String(value ?? '')
      .replace(/,/g, '')
      .trim()
  );
  return Number.isFinite(count) && count > 0 ? Math.round(count) : null;
}

/** Normalize common model aliases and keep counts bounded to a practical plan range. */
export function normalizeWindowsDoorsPlanMeasurements(
  input: Record<string, unknown> = {}
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS) {
    const value = positiveCount(input[key]);
    if (value != null && value <= 200) out[key] = value;
  }
  for (const [alias, canonical] of Object.entries(WINDOWS_DOORS_PLAN_ALIASES)) {
    if (out[canonical] != null) continue;
    const value = positiveCount(input[alias]);
    if (value != null && value <= 200) out[canonical] = value;
  }
  return out;
}

/**
 * Convert opening counts into the existing item quantity shape used by pricing
 * and Confirm Scope. Garage type counts intentionally share one item ID so the
 * existing type-aware garage pricing resolver remains authoritative.
 */
export function buildWindowsDoorsStructuredMeasurements(
  input: Record<string, unknown> = {},
  quantitySource: 'plan_detected' | 'user_entered' = 'plan_detected'
): { itemQuantities: Record<string, { quantity: number; unit: 'each'; quantitySource: string }> } {
  const measurements = normalizeWindowsDoorsPlanMeasurements(input);
  const itemQuantities: Record<
    string,
    { quantity: number; unit: 'each'; quantitySource: string }
  > = {};

  for (const [key, mapping] of Object.entries(ITEM_BY_MEASUREMENT) as Array<
    [WindowsDoorsQuantityKey, { id: string; unit: 'each' }]
  >) {
    const count = measurements[key];
    if (count == null) continue;
    if (mapping.id === 'garage_doors') continue;
    itemQuantities[mapping.id] = {
      quantity: count,
      unit: mapping.unit,
      quantitySource,
    };
  }

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

  return { itemQuantities };
}
