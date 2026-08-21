/**
 * Canonical insulation measurements for plan export and notes/manual entry.
 *
 * Insulation follows the thermal envelope, not drywall surface area:
 * exterior walls plus one selected attic/roof-deck boundary.
 */

import type { PlanFacts } from '@/utils/planMeasurementFacts';
import type { InsulationAssembly } from '@/utils/estimateAiDraft';

export const INSULATION_PLAN_REVIEW_MEASUREMENT_KEYS = [
  'exteriorWallGrossSqft',
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
  'exteriorWallGrossSqft',
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
  'exteriorWallGrossSqft',
  'exteriorWallInsulationSqft',
  'atticInsulationSqft',
  'insulatedRoofDeckSqft',
  'floorInsulationSqft',
  'garageSeparationInsulationSqft',
  'insulatedGarageWallSqft',
  'insulatedGarageCeilingSqft',
  'openingDeductionSqft',
] as const;

export function copyInsulationAssemblyFields(
  record?: Record<string, unknown> | null
): InsulationAssembly[] | null {
  if (!record) return null;
  if (!Array.isArray(record.insulationAssemblies)) return null;
  const rows = record.insulationAssemblies
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object') return null;
      const row = raw as Record<string, unknown>;
      const materialType = String(row.materialType ?? '').trim();
      const rValue = String(row.rValue ?? '').trim();
      const sqft =
        typeof row.sqft === 'number' || typeof row.sqft === 'string'
          ? row.sqft
          : null;
      if (!materialType && !rValue && sqft == null) return null;
      return {
        id: String(row.id || `insulation-assembly-${index + 1}`),
        materialType,
        rValue,
        sqft,
        location: String(row.location ?? '').trim() || null,
        source:
          row.source === 'calculated_from_plan' ||
          row.source === 'contractor_entered' ||
          row.source === 'parsed_from_notes' ||
          row.source === 'detected_from_plan'
            ? row.source
            : null,
        confirmed:
          typeof row.confirmed === 'boolean' ? row.confirmed : undefined,
      };
    })
    .filter((row): row is InsulationAssembly => Boolean(row));
  return rows.length ? rows : null;
}

/**
 * Seeds the editable assembly model from a plan takeoff once. Calculated
 * ceiling suggestions remain visible but unconfirmed until the contractor
 * accepts or edits them.
 */
export function buildInsulationAssembliesFromPlanMeasurements(
  record?: Record<string, unknown> | null
): InsulationAssembly[] | null {
  if (!record || Array.isArray(record.insulationAssemblies)) return null;

  const numberFor = (key: string) => {
    const value = Number(String(record[key] ?? '').replace(/,/g, ''));
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  const sources =
    record.quickMeasurementSources &&
    typeof record.quickMeasurementSources === 'object'
      ? (record.quickMeasurementSources as Record<string, unknown>)
      : {};
  const sourceFor = (key: string): InsulationAssembly['source'] => {
    const source = String(sources[key] ?? '').toLowerCase();
    if (
      source === 'calculated_from_components' ||
      source === 'estimated_from_formula' ||
      source === 'fallback_multiplier'
    ) {
      return 'calculated_from_plan';
    }
    return 'detected_from_plan';
  };
  const confirmedFor = (key: string) =>
    sourceFor(key) !== 'calculated_from_plan';
  const materialType =
    String(record.insulationMaterialType || '').trim() || 'Batt';
  const wallRValue =
    String(record.insulationRValue || '').trim() || 'R-21';
  const rows: InsulationAssembly[] = [];
  const wallSqft = numberFor('exteriorWallInsulationSqft');
  if (wallSqft != null) {
    rows.push({
      id: 'insulation-assembly-plan-wall',
      materialType,
      rValue: wallRValue,
      sqft: wallSqft,
      location: 'exterior_wall',
      source: sourceFor('exteriorWallInsulationSqft'),
      confirmed: confirmedFor('exteriorWallInsulationSqft'),
    });
  }

  const roofDeckSqft = numberFor('insulatedRoofDeckSqft');
  const atticSqft = roofDeckSqft == null ? numberFor('atticInsulationSqft') : null;
  if (roofDeckSqft != null || atticSqft != null) {
    const key = roofDeckSqft != null
      ? 'insulatedRoofDeckSqft'
      : 'atticInsulationSqft';
    rows.push({
      id: `insulation-assembly-plan-${roofDeckSqft != null ? 'roof-deck' : 'attic'}`,
      materialType,
      rValue: roofDeckSqft != null ? 'R-49' : 'R-30',
      sqft: roofDeckSqft ?? atticSqft,
      location: roofDeckSqft != null ? 'roof_deck' : 'attic_ceiling',
      source: sourceFor(key),
      confirmed: confirmedFor(key),
    });
  }

  return rows.length ? rows : null;
}

export function copyInsulationScopeNumericFields(
  record: Record<string, unknown> | null | undefined,
  parse: (value: unknown) => number | null
): Partial<
  Record<(typeof INSULATION_SCOPE_NUMERIC_KEYS)[number], number | null>
> {
  if (!record) return {};
  return Object.fromEntries(
    INSULATION_SCOPE_NUMERIC_KEYS.map(key => [key, parse(record[key])])
  ) as Partial<
    Record<(typeof INSULATION_SCOPE_NUMERIC_KEYS)[number], number | null>
  >;
}

export function copyInsulationScopeTextFields(
  record?: Record<string, unknown> | null
): {
  insulationMaterialType: string | null;
  insulationRValue: string | null;
  garageInsulationIncluded: string | null;
} {
  if (!record) {
    return {
      insulationMaterialType: null,
      insulationRValue: null,
      garageInsulationIncluded: null,
    };
  }
  const pick = (key: string) => String(record[key] ?? '').trim() || null;
  return {
    insulationMaterialType: pick('insulationMaterialType'),
    insulationRValue: pick('insulationRValue'),
    garageInsulationIncluded: pick('garageInsulationIncluded'),
  };
}
