/**
 * Canonical insulation measurements for plan export and notes/manual entry.
 *
 * Insulation follows the thermal envelope, not drywall surface area:
 * exterior walls plus one selected attic/roof-deck boundary.
 */

import type { PlanFacts } from '@/utils/planMeasurementFacts';

export const INSULATION_PLAN_REVIEW_MEASUREMENT_KEYS = [
  'exteriorWallInsulationSqft',
  'atticInsulationSqft',
  'insulatedRoofDeckSqft',
  'floorInsulationSqft',
  'garageSeparationInsulationSqft',
  'insulatedGarageWallSqft',
  'insulatedGarageCeilingSqft',
  'openingDeductionSqft',
  'insulationMaterialType',
  'insulationRValue',
  'garageInsulationIncluded',
  'floorAreaSqft',
  'garageSqft',
  'storyCount',
] as const;

export const INSULATION_PLAN_QUICK_MEASUREMENT_KEYS = [
  'exteriorWallInsulationSqft',
  'atticInsulationSqft',
  'insulatedRoofDeckSqft',
  'floorInsulationSqft',
  'garageSeparationInsulationSqft',
  'insulatedGarageWallSqft',
  'insulatedGarageCeilingSqft',
  'openingDeductionSqft',
  'insulationMaterialType',
  'insulationRValue',
  'garageInsulationIncluded',
  'floorAreaSqft',
  'garageSqft',
  'storyCount',
] as const;

export type InsulationMeasurementKey =
  (typeof INSULATION_PLAN_REVIEW_MEASUREMENT_KEYS)[number];

function positiveString(value: unknown): string | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? String(num) : null;
}

/** Surface insulation takeoff keys after plan review (no living-SF planning fill). */
export function hydrateInsulationPlanMeasurementsFromTakeoff(
  measurements: Record<string, number | string>,
  _planFacts?: PlanFacts | null
): Record<string, number | string> {
  const next = { ...measurements };
  if (!positiveString(next.openingDeductionSqft)) {
    const windowOpenings = Number(next.stuccoWindowDoorOpeningSqft);
    const garageOpenings = Number(next.stuccoGarageOpeningSqft);
    const total =
      (windowOpenings > 0 ? windowOpenings : 0) +
      (garageOpenings > 0 ? garageOpenings : 0);
    const mapped = positiveString(total);
    if (mapped) next.openingDeductionSqft = mapped;
  }
  return next;
}

export const INSULATION_SCOPE_NUMERIC_KEYS = [
  'exteriorWallInsulationSqft',
  'atticInsulationSqft',
  'insulatedRoofDeckSqft',
  'floorInsulationSqft',
  'garageSeparationInsulationSqft',
  'insulatedGarageWallSqft',
  'insulatedGarageCeilingSqft',
  'openingDeductionSqft',
] as const;

export function copyInsulationScopeNumericFields(
  record: Record<string, unknown>,
  parse: (value: unknown) => number | null
): Partial<
  Record<(typeof INSULATION_SCOPE_NUMERIC_KEYS)[number], number | null>
> {
  return Object.fromEntries(
    INSULATION_SCOPE_NUMERIC_KEYS.map(key => [key, parse(record[key])])
  ) as Partial<
    Record<(typeof INSULATION_SCOPE_NUMERIC_KEYS)[number], number | null>
  >;
}

export function copyInsulationScopeTextFields(
  record: Record<string, unknown>
): {
  insulationMaterialType: string | null;
  insulationRValue: string | null;
  garageInsulationIncluded: string | null;
} {
  const pick = (key: string) => String(record[key] ?? '').trim() || null;
  return {
    insulationMaterialType: pick('insulationMaterialType'),
    insulationRValue: pick('insulationRValue'),
    garageInsulationIncluded: pick('garageInsulationIncluded'),
  };
}
