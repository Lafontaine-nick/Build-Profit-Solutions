/**
 * Canonical insulation measurements for plan export and notes/manual entry.
 *
 * Insulation follows the thermal envelope, not drywall surface area:
 * exterior walls plus one selected attic/roof-deck boundary.
 */

import type { PlanFacts } from '@/utils/planMeasurementFacts';
import { mergePlanFactsWithBuildingAreas } from '@/utils/planMeasurementFacts';
import type { InsulationAssembly } from '@/utils/estimateAiDraft';
import { insulationCeilingBoundaryBreakdownFromPlanFacts } from '@/utils/insulationEnvelopeQuantity';

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

export function insulationOpeningDeductionFromPlan(
  measurements?: Record<string, unknown> | null,
  planFacts?: PlanFacts | null
): number | null {
  const mapped = Number(measurements?.openingDeductionSqft);
  if (Number.isFinite(mapped) && mapped > 0) return mapped;
  const windowOpenings = Number(measurements?.stuccoWindowDoorOpeningSqft);
  const garageOpenings = Number(measurements?.stuccoGarageOpeningSqft);
  const stuccoTotal =
    (windowOpenings > 0 ? windowOpenings : 0) +
    (garageOpenings > 0 ? garageOpenings : 0);
  if (stuccoTotal > 0) return stuccoTotal;
  const faces = Array.isArray(planFacts?.elevationFaces)
    ? planFacts.elevationFaces
    : [];
  const faceTotal = faces.reduce((sum, face) => {
    const categorized =
      Number(face?.windowDoorOpeningsSqft) || Number(face?.garageOpeningsSqft);
    const openings =
      Number.isFinite(categorized) && categorized > 0
        ? categorized
        : Number(face?.openingsSqft);
    return sum + (Number.isFinite(openings) && openings > 0 ? openings : 0);
  }, 0);
  return faceTotal > 0 ? faceTotal : null;
}

function positiveNumber(value: unknown): number | null {
  const num = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function nearlyEqual(a: number, b: number, tolerance = 0.02): boolean {
  return Math.abs(a - b) <= Math.max(1, Math.abs(b) * tolerance);
}

function elevationFaceAreaSqft(
  face: NonNullable<PlanFacts['elevationFaces']>[number]
): number | null {
  const labeled =
    positiveNumber(face?.areaSqft) ??
    (() => {
      const width = positiveNumber(face?.widthFt);
      const height = positiveNumber(face?.heightFt);
      return width != null && height != null ? width * height : null;
    })();
  return labeled;
}

/** Gross exterior wall area from labeled perimeter × height × stories. */
export function expectedInsulationGrossWallSqft(
  planFacts?: PlanFacts | null
): number | null {
  const perimeter =
    positiveNumber(planFacts?.exteriorPerimeterLf) ??
    positiveNumber(planFacts?.foundationPerimeterLf);
  const stories = Math.max(
    1,
    Math.round(positiveNumber(planFacts?.storyCount) ?? 1)
  );
  const height =
    positiveNumber(planFacts?.wallHeightFt) ??
    positiveNumber(planFacts?.plateHeightFt);
  if (perimeter != null && height != null) {
    return Math.round(perimeter * height * stories * 10) / 10;
  }
  const faces = Array.isArray(planFacts?.elevationFaces)
    ? planFacts.elevationFaces
    : [];
  if (faces.length < 2) return null;
  const faceAreas = faces.map(face => elevationFaceAreaSqft(face));
  if (!faceAreas.every(area => area != null)) return null;
  return (
    Math.round(faceAreas.reduce((sum, area) => sum + (area || 0), 0) * 10) / 10
  );
}

/** Merge takeoff measurements into plan facts for insulation geometry. */
export function mergeInsulationPlanFactsFromTakeoff(
  planFacts?: PlanFacts | null,
  buildingAreas?: PlanFacts['buildingAreas'] | null,
  measurements?: Record<string, unknown> | null
): PlanFacts | null | undefined {
  const merged =
    mergePlanFactsWithBuildingAreas(planFacts, buildingAreas) || {};
  const fromMeas = (key: string) => positiveNumber(measurements?.[key]);
  const pick = (key: keyof PlanFacts) =>
    fromMeas(key) ?? positiveNumber(merged[key]) ?? merged[key];
  return {
    ...merged,
    storyCount: pick('storyCount') as PlanFacts['storyCount'],
    foundationPerimeterLf: pick(
      'foundationPerimeterLf'
    ) as PlanFacts['foundationPerimeterLf'],
    exteriorPerimeterLf: pick(
      'exteriorPerimeterLf'
    ) as PlanFacts['exteriorPerimeterLf'],
    wallHeightFt:
      (pick('wallHeightFt') as PlanFacts['wallHeightFt']) ??
      fromMeas('stuccoWallHeightFt'),
    plateHeightFt: pick('plateHeightFt') as PlanFacts['plateHeightFt'],
  };
}

/**
 * AI often returns gross wall SF in exteriorWallInsulationSqft. When plan
 * geometry and opening deductions are known, convert to net wall SF for review.
 */
export function reconcileInsulationWallMeasurementsForReview(
  measurements: Record<string, number | string>,
  planFacts?: PlanFacts | null
): Record<string, number | string> {
  const next = { ...measurements };
  const rawWall = positiveNumber(next.exteriorWallInsulationSqft);
  if (rawWall == null) return next;

  const openingDeduction =
    positiveNumber(next.openingDeductionSqft) ??
    insulationOpeningDeductionFromPlan(measurements, planFacts);
  if (openingDeduction == null) return next;

  if (!positiveString(next.openingDeductionSqft)) {
    next.openingDeductionSqft = String(openingDeduction);
  }

  const expectedGross =
    positiveNumber(next.exteriorWallGrossSqft) ??
    expectedInsulationGrossWallSqft(planFacts);
  if (expectedGross == null) {
    // The plan-import contract exposes exteriorWallInsulationSqft as the net
    // quantity, but older/partial AI payloads have placed gross wall area in
    // that field. When the payload has a readable opening deduction but no
    // gross-area anchor, normalize the unqualified plan value to net here.
    if (rawWall > openingDeduction) {
      next.exteriorWallInsulationSqft = String(
        Math.round((rawWall - openingDeduction) * 10) / 10
      );
    }
    return next;
  }

  const expectedNet = Math.max(
    0,
    Math.round((expectedGross - openingDeduction) * 10) / 10
  );
  const looksLikeGross = nearlyEqual(rawWall, expectedGross);
  const looksLikeNet = nearlyEqual(rawWall, expectedNet);

  if (looksLikeGross && !looksLikeNet) {
    next.exteriorWallInsulationSqft = String(expectedNet);
  }
  return next;
}

/** Surface insulation takeoff keys after plan review (no living-SF planning fill). */
export function hydrateInsulationPlanMeasurementsFromTakeoff(
  measurements: Record<string, number | string>,
  planFacts?: PlanFacts | null
): Record<string, number | string> {
  const withOpenings = { ...measurements };
  if (!positiveString(withOpenings.openingDeductionSqft)) {
    const mapped = positiveString(
      insulationOpeningDeductionFromPlan(measurements, planFacts)
    );
    if (mapped) withOpenings.openingDeductionSqft = mapped;
  }
  return reconcileInsulationAtticMeasurementsForReview(
    reconcileInsulationWallMeasurementsForReview(withOpenings, planFacts),
    planFacts
  );
}

/** Prefer a complete ceiling-boundary takeoff over noisy AI attic SF. */
export function reconcileInsulationAtticMeasurementsForReview(
  measurements: Record<string, number | string>,
  planFacts?: PlanFacts | null
): Record<string, number | string> {
  const boundary = insulationCeilingBoundaryBreakdownFromPlanFacts(planFacts);
  if (
    !planFacts?.ceilingBoundary?.complete ||
    boundary?.calculatedSqft == null
  ) {
    return measurements;
  }
  const expected = boundary.calculatedSqft;
  const rawAttic = positiveNumber(measurements.atticInsulationSqft);
  if (rawAttic != null && nearlyEqual(rawAttic, expected)) {
    return measurements;
  }
  return {
    ...measurements,
    atticInsulationSqft: String(expected),
  };
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

export type InsulationBattFacing = 'faced' | 'unfaced' | 'not_sure';

export const INSULATION_BATT_FACING_DEFAULT: InsulationBattFacing = 'not_sure';

export const INSULATION_BATT_FACING_OPTIONS = [
  { key: 'faced' as const, label: 'Faced' },
  { key: 'unfaced' as const, label: 'Unfaced' },
  { key: 'not_sure' as const, label: 'Not sure' },
] as const;

export function isBattInsulationMaterial(materialType: string): boolean {
  return insulationMaterialTypeKey(materialType) === 'batt';
}

export function normalizeInsulationBattFacing(
  value: unknown
): InsulationBattFacing | null {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (key === 'faced') return 'faced';
  if (key === 'unfaced') return 'unfaced';
  if (key === 'not_sure' || key === 'unsure') return 'not_sure';
  return null;
}

export function insulationBattFacingLabel(
  facing: InsulationBattFacing | null | undefined
): string | null {
  if (!facing || facing === 'not_sure') return null;
  return (
    INSULATION_BATT_FACING_OPTIONS.find(option => option.key === facing)
      ?.label ?? null
  );
}

/** Modest material-only premium for kraft/foil-faced batts. */
export function insulationBattFacingMaterialMultiplier(
  facing: InsulationBattFacing | null | undefined
): number {
  return facing === 'faced' ? 1.06 : 1;
}

export function detectBattFacingFromPlanText(
  text: string
): InsulationBattFacing | null {
  const normalized = text.toLowerCase();
  if (/\bunfaced\b/.test(normalized)) return 'unfaced';
  if (
    /\bfaced\s+batt\b/.test(normalized) ||
    /\bkraft[\s-]?faced\b/.test(normalized) ||
    /\bfoil[\s-]?faced\b/.test(normalized) ||
    /\bfaced\s+insulation\b/.test(normalized)
  ) {
    return 'faced';
  }
  return null;
}

export function copyInsulationAssemblyFields(
  record?: Record<string, unknown> | null
): InsulationAssembly[] | null {
  if (!record) return null;
  if (!Array.isArray(record.insulationAssemblies)) return null;
  const rows = record.insulationAssemblies
    .map<InsulationAssembly | null>((raw, index) => {
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
        battFacing: isBattInsulationMaterial(materialType)
          ? normalizeInsulationBattFacing(row.battFacing) ||
            INSULATION_BATT_FACING_DEFAULT
          : null,
      } as InsulationAssembly;
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
  const wallRValue = String(record.insulationRValue || '').trim() || 'R-21';
  const battFacingFor = (type: string) =>
    isBattInsulationMaterial(type) ? INSULATION_BATT_FACING_DEFAULT : null;
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
      battFacing: battFacingFor(materialType),
    });
  }

  const roofDeckSqft = numberFor('insulatedRoofDeckSqft');
  const atticSqft =
    roofDeckSqft == null ? numberFor('atticInsulationSqft') : null;
  if (roofDeckSqft != null || atticSqft != null) {
    const key =
      roofDeckSqft != null ? 'insulatedRoofDeckSqft' : 'atticInsulationSqft';
    rows.push({
      id: `insulation-assembly-plan-${roofDeckSqft != null ? 'roof-deck' : 'attic'}`,
      materialType,
      rValue: roofDeckSqft != null ? 'R-49' : 'R-30',
      sqft: roofDeckSqft ?? atticSqft,
      location: roofDeckSqft != null ? 'roof_deck' : 'attic_ceiling',
      source: sourceFor(key),
      confirmed: confirmedFor(key),
      battFacing: battFacingFor(materialType),
    });
  }

  return rows.length ? rows : null;
}

/**
 * Reconciles the editable assembly model with a new plan takeoff. Legacy rows
 * without source metadata are replaced; contractor-edited rows are preserved.
 */
export function syncInsulationAssembliesWithPlanMeasurements(
  record?: Record<string, unknown> | null
): InsulationAssembly[] | null {
  if (!record) return null;
  const planRows = buildInsulationAssembliesFromPlanMeasurements({
    ...record,
    insulationAssemblies: undefined,
  });
  if (!planRows?.length) return null;

  const existing = copyInsulationAssemblyFields(record) || [];
  if (!existing.length) return planRows;

  const contractorRows = existing.filter(
    row => row.source === 'contractor_entered'
  );
  const merged = planRows.map(planRow => {
    const contractorRow = contractorRows.find(
      row => row.location === planRow.location
    );
    return contractorRow || planRow;
  });
  const planLocations = new Set(planRows.map(row => row.location));
  merged.push(
    ...contractorRows.filter(row => !planLocations.has(row.location))
  );
  return merged;
}

export function isCompleteInsulationAssembly(row: InsulationAssembly): boolean {
  return Boolean(row.materialType.trim() && row.rValue.trim());
}

function insulationAssemblySqft(row: InsulationAssembly): number {
  const sqft = Number(String(row.sqft ?? '').replace(/,/g, ''));
  return Number.isFinite(sqft) && sqft > 0 ? sqft : 0;
}

/** Rows that contribute to insulation assembly pricing. */
export function isPricedInsulationAssembly(row: InsulationAssembly): boolean {
  return (
    isCompleteInsulationAssembly(row) &&
    insulationAssemblySqft(row) > 0 &&
    row.confirmed !== false &&
    row.source !== 'calculated_from_plan'
  );
}

export function isIncompleteInsulationAssembly(
  row: InsulationAssembly
): boolean {
  if (isPricedInsulationAssembly(row)) return false;
  return Boolean(
    row.materialType.trim() ||
      row.rValue.trim() ||
      insulationAssemblySqft(row) > 0
  );
}

export function insulationAssemblyIdentityKey(row: InsulationAssembly): string {
  const facing =
    row.battFacing && row.battFacing !== 'not_sure' ? row.battFacing : '';
  return [
    insulationMaterialTypeKey(row.materialType),
    String(row.location || '').trim(),
    row.rValue.trim().toLowerCase(),
    facing,
  ].join('|');
}

export function insulationAssemblyDuplicateRowIds(
  rows: InsulationAssembly[]
): Set<string> {
  const seen = new Map<string, string>();
  const duplicateIds = new Set<string>();
  for (const row of rows) {
    if (!isCompleteInsulationAssembly(row)) continue;
    const key = insulationAssemblyIdentityKey(row);
    const priorId = seen.get(key);
    if (priorId) {
      duplicateIds.add(priorId);
      duplicateIds.add(row.id);
    } else {
      seen.set(key, row.id);
    }
  }
  return duplicateIds;
}

/** Keep in-progress assembly rows when parent state only stores complete rows. */
export function mergeInsulationAssemblyRowsWithDrafts(
  fromParent: InsulationAssembly[],
  local: InsulationAssembly[]
): InsulationAssembly[] {
  const parentIds = new Set(fromParent.map(row => row.id));
  const drafts = local.filter(
    row => !isCompleteInsulationAssembly(row) && !parentIds.has(row.id)
  );
  return [...fromParent, ...drafts];
}

export function insulationMaterialTypeKey(materialType: string): string {
  return materialType.trim().toLowerCase();
}

export function rowsForInsulationMaterialType(
  rows: InsulationAssembly[],
  materialType: string
): InsulationAssembly[] {
  const key = insulationMaterialTypeKey(materialType);
  return rows.filter(
    row => insulationMaterialTypeKey(row.materialType) === key
  );
}

export function stashInsulationAssemblyRowsForType(
  stash: Record<string, InsulationAssembly[]>,
  materialType: string,
  rows: InsulationAssembly[]
): Record<string, InsulationAssembly[]> {
  const matching = rowsForInsulationMaterialType(rows, materialType);
  if (!matching.length) return stash;
  const key = insulationMaterialTypeKey(materialType);
  return {
    ...stash,
    [key]: matching.map(row => ({ ...row })),
  };
}

export function takeStashedInsulationAssemblyRowsForType(
  stash: Record<string, InsulationAssembly[]>,
  materialType: string
): { stash: Record<string, InsulationAssembly[]>; rows: InsulationAssembly[] } {
  const key = insulationMaterialTypeKey(materialType);
  const rows = stash[key];
  if (!rows?.length) {
    return { stash, rows: [] };
  }
  const nextStash = { ...stash };
  delete nextStash[key];
  return {
    stash: nextStash,
    rows: rows.map(row => ({ ...row })),
  };
}

/** Drop placeholder rows that would duplicate a restored material/location pair. */
export function mergeRestoredInsulationAssemblyRows(
  current: InsulationAssembly[],
  restored: InsulationAssembly[]
): InsulationAssembly[] {
  if (!restored.length) return current;
  const restoredLocations = new Set(
    restored.map(row => row.location).filter(Boolean)
  );
  const restoredKey = insulationMaterialTypeKey(restored[0].materialType);
  const kept = current.filter(row => {
    if (
      row.location &&
      restoredLocations.has(row.location) &&
      (!row.materialType.trim() ||
        insulationMaterialTypeKey(row.materialType) === restoredKey)
    ) {
      return false;
    }
    return true;
  });
  return [...kept, ...restored];
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
