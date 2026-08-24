/**
 * Canonical insulation measurements for plan export and notes/manual entry.
 *
 * Insulation follows the thermal envelope, not drywall surface area:
 * exterior walls plus one selected attic/roof-deck boundary.
 */

import type { PlanFacts } from '@/utils/planMeasurementFacts';
import { mergePlanFactsWithBuildingAreas } from '@/utils/planMeasurementFacts';
import type { InsulationAssembly } from '@/utils/estimateAiDraft';
import type { PlanCeilingBoundary } from '@/utils/planMeasurementFacts';
import { insulationCeilingBoundaryBreakdownFromPlanFacts } from '@/utils/insulationEnvelopeQuantity';
import {
  enrichPlanFactsWithSouthernUtahBarometer,
  enrichPlanFactsWithSouthernUtahInsulationCeiling,
} from '@/utils/southernUtahPlanFacts';

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

/** Openings below ~8% of gross wall area are usually partial AI reads, not takeoffs. */
export const INSULATION_MIN_CREDIBLE_OPENING_SHARE_OF_GROSS = 0.08;

export function isCredibleInsulationOpeningDeduction(
  openingSqft: number,
  grossWallSqft?: number | null
): boolean {
  if (!(openingSqft > 0)) return false;
  if (grossWallSqft == null || !(grossWallSqft > 0)) return true;
  return (
    openingSqft >= grossWallSqft * INSULATION_MIN_CREDIBLE_OPENING_SHARE_OF_GROSS
  );
}

export function assumedInsulationOpeningDeductionSqft(
  grossWallSqft: number
): number {
  return Math.round(grossWallSqft * 0.15 * 10) / 10;
}

/**
 * Resolve opening deduction for review/pricing. Partial low-confidence reads
 * (e.g. 50 SF on a 3,500 SF wall) fall back to the standard 15% share.
 */
export function resolveInsulationOpeningDeductionForReview(
  measurements?: Record<string, unknown> | null,
  planFacts?: PlanFacts | null
): number | null {
  const gross =
    positiveNumber(measurements?.exteriorWallGrossSqft) ??
    expectedInsulationGrossWallSqft(planFacts);
  const mapped = insulationOpeningDeductionFromPlan(measurements, planFacts);
  if (mapped != null && isCredibleInsulationOpeningDeduction(mapped, gross)) {
    return mapped;
  }
  if (gross != null && gross > 0) {
    return assumedInsulationOpeningDeductionSqft(gross);
  }
  return mapped;
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

const INSULATION_CEILING_BOUNDARY_KEYS = [
  'upperFloorAtticSqft',
  'mainFloorAtticExposureSqft',
  'vaultedOpenToBelowSqft',
  'roofDeckInsulationSqft',
] as const;

export function hydrateInsulationCeilingBoundaryFromFieldEvidence(
  boundary?: PlanCeilingBoundary | null
): PlanCeilingBoundary | null | undefined {
  if (!boundary) return boundary;
  const out: PlanCeilingBoundary = { ...boundary };
  let changed = false;
  for (const key of INSULATION_CEILING_BOUNDARY_KEYS) {
    if (positiveNumber(out[key]) != null) continue;
    const evidenceValue = positiveNumber(boundary.fieldEvidence?.[key]?.value);
    if (evidenceValue == null) continue;
    out[key] = evidenceValue;
    changed = true;
  }
  return changed ? out : boundary;
}

export function insulationPlanFactsWithHydratedCeilingBoundary(
  planFacts?: PlanFacts | null
): PlanFacts | null | undefined {
  if (!planFacts) return planFacts;
  const ceilingBoundary = hydrateInsulationCeilingBoundaryFromFieldEvidence(
    planFacts.ceilingBoundary
  );
  if (ceilingBoundary === planFacts.ceilingBoundary) return planFacts;
  return { ...planFacts, ceilingBoundary };
}

export function insulationAtticMateriallyDiffersFromCeilingBoundary(
  atticSqft: number,
  expectedSqft: number
): boolean {
  return Math.abs(atticSqft - expectedSqft) > Math.max(25, expectedSqft * 0.02);
}

export function isMultiStoryInsulationPlanFacts(
  planFacts?: PlanFacts | null
): boolean {
  const stories = positiveNumber(planFacts?.storyCount);
  const upstairs = positiveNumber(planFacts?.buildingAreas?.upstairsLivingSqft);
  const mainFloor = positiveNumber(planFacts?.buildingAreas?.mainFloorLivingSqft);
  const totalLiving = positiveNumber(planFacts?.buildingAreas?.totalLivingSqft);
  return (
    (stories ?? 0) > 1 ||
    upstairs != null ||
    (mainFloor != null && totalLiving != null && mainFloor < totalLiving - 1)
  );
}

export function hasFullInsulationCeilingBoundary(
  boundary?: PlanCeilingBoundary | null
): boolean {
  return (
    positiveNumber(boundary?.upperFloorAtticSqft) != null &&
    positiveNumber(boundary?.mainFloorAtticExposureSqft) != null
  );
}

function isUpperFloorOnlyAtticProxy(
  atticSqft: number,
  planFacts?: PlanFacts | null
): boolean {
  if (!isMultiStoryInsulationPlanFacts(planFacts)) return false;
  const upstairs = positiveNumber(planFacts?.buildingAreas?.upstairsLivingSqft);
  const upper = positiveNumber(planFacts?.ceilingBoundary?.upperFloorAtticSqft);
  return (
    (upstairs != null && nearlyEqual(atticSqft, upstairs)) ||
    (upper != null && nearlyEqual(atticSqft, upper))
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
  const livingSf =
    positiveNumber(measurements?.floorAreaSqft) ??
    positiveNumber(buildingAreas?.totalLivingSqft) ??
    positiveNumber(merged.buildingAreas?.totalLivingSqft);
  const withGeometry = {
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
  return insulationPlanFactsWithHydratedCeilingBoundary(
    enrichPlanFactsWithSouthernUtahInsulationCeiling(
      enrichPlanFactsWithSouthernUtahBarometer(withGeometry, livingSf),
      livingSf
    )
  );
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
    resolveInsulationOpeningDeductionForReview(measurements, planFacts);
  if (openingDeduction == null) return next;

  next.openingDeductionSqft = String(openingDeduction);

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
  const hydratedPlanFacts =
    insulationPlanFactsWithHydratedCeilingBoundary(planFacts);
  const withOpenings = { ...measurements };
  const resolvedOpening = resolveInsulationOpeningDeductionForReview(
    measurements,
    hydratedPlanFacts
  );
  if (resolvedOpening != null) {
    withOpenings.openingDeductionSqft = String(resolvedOpening);
  }
  return reconcileInsulationAtticMeasurementsForReview(
    reconcileInsulationWallMeasurementsForReview(withOpenings, hydratedPlanFacts),
    hydratedPlanFacts
  );
}

type InsulationRepeatImportContext = {
  planFacts?: PlanFacts | null;
  buildingAreas?: PlanFacts['buildingAreas'] | null;
};

/** Normalize repeat-import snapshots through the same review hydration path. */
export function canonicalizeInsulationRepeatImportMeasurements(
  measurements: Record<string, number | string | null | undefined>,
  context?: InsulationRepeatImportContext
): Record<string, number | string> {
  const normalized = Object.fromEntries(
    Object.entries(measurements || {})
      .filter(([, value]) => value != null && value !== '')
      .map(([key, value]) => [key, String(value)])
  );
  const planFacts = mergeInsulationPlanFactsFromTakeoff(
    context?.planFacts,
    context?.buildingAreas,
    normalized
  );
  return hydrateInsulationPlanMeasurementsFromTakeoff(normalized, planFacts);
}

/** Wall+opening plus attic when ceiling-boundary geometry expects it. */
export function hasCompleteInsulationRepeatImportSnapshot(
  measurements?: Record<string, number | string | null | undefined> | null,
  context?: InsulationRepeatImportContext
): boolean {
  const wallSqft = Number(measurements?.exteriorWallInsulationSqft ?? 0);
  const openingSqft = Number(measurements?.openingDeductionSqft ?? 0);
  if (!(wallSqft > 0) || !(openingSqft > 0)) return false;

  const canonical = canonicalizeInsulationRepeatImportMeasurements(
    measurements || {},
    context
  );
  const expectedAttic = Number(canonical.atticInsulationSqft ?? 0);
  if (!(expectedAttic > 0)) return true;

  const snapshotAttic = Number(measurements?.atticInsulationSqft ?? 0);
  if (!(snapshotAttic > 0)) return false;
  return (
    Math.abs(snapshotAttic - expectedAttic) <=
    Math.max(1, expectedAttic * 0.02)
  );
}

/** Reconcile insulation takeoff keys without clobbering plan-review locks. */
export function applyHydratedInsulationScopeMeasurements<
  T extends Record<string, unknown>,
>(measurements: T, context?: InsulationRepeatImportContext): T {
  const confirmed = new Set(
    Object.entries(
      (measurements.quickMeasurementSources as Record<string, string>) || {}
    )
      .filter(([, source]) => source === 'contractor_confirmed_from_plan_review')
      .map(([key]) => key)
  );
  const planFacts = mergeInsulationPlanFactsFromTakeoff(
    context?.planFacts ?? (measurements.planFacts as PlanFacts | undefined),
    context?.buildingAreas ??
      (measurements.planFacts as PlanFacts | undefined)?.buildingAreas,
    measurements as Record<string, number | string>
  );
  const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff(
    Object.fromEntries(
      Object.entries(measurements)
        .filter(([, value]) => value != null && value !== '')
        .map(([key, value]) => [key, String(value)])
    ),
    planFacts
  );
  const next: T = {
    ...measurements,
    ...(planFacts ? { planFacts } : {}),
  };
  for (const key of INSULATION_SCOPE_NUMERIC_KEYS) {
    if (confirmed.has(key)) continue;
    const value = hydrated[key];
    if (value == null || value === '') continue;
    (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

/** Prefer a complete ceiling-boundary takeoff over noisy AI attic SF. */
export function reconcileInsulationAtticMeasurementsForReview(
  measurements: Record<string, number | string>,
  planFacts?: PlanFacts | null
): Record<string, number | string> {
  const hydratedPlanFacts =
    insulationPlanFactsWithHydratedCeilingBoundary(planFacts);
  const boundary =
    insulationCeilingBoundaryBreakdownFromPlanFacts(hydratedPlanFacts);
  const ceiling = hydratedPlanFacts?.ceilingBoundary;
  const hasFullBoundary = hasFullInsulationCeilingBoundary(ceiling);
  const rawAttic = positiveNumber(measurements.atticInsulationSqft);

  if (
    boundary?.calculatedSqft == null &&
    rawAttic != null &&
    isUpperFloorOnlyAtticProxy(rawAttic, hydratedPlanFacts)
  ) {
    const { atticInsulationSqft: _removed, ...rest } = measurements;
    return rest;
  }

  if (boundary?.calculatedSqft == null) {
    return measurements;
  }

  if (
    isMultiStoryInsulationPlanFacts(hydratedPlanFacts) &&
    !hasFullBoundary &&
    ceiling?.complete !== true
  ) {
    if (rawAttic != null && isUpperFloorOnlyAtticProxy(rawAttic, hydratedPlanFacts)) {
      const { atticInsulationSqft: _removed, ...rest } = measurements;
      return rest;
    }
    return measurements;
  }

  const expected = boundary.calculatedSqft;
  if (
    isMultiStoryInsulationPlanFacts(hydratedPlanFacts) &&
    isUpperFloorOnlyAtticProxy(expected, hydratedPlanFacts)
  ) {
    if (rawAttic != null && isUpperFloorOnlyAtticProxy(rawAttic, hydratedPlanFacts)) {
      const { atticInsulationSqft: _removed, ...rest } = measurements;
      return rest;
    }
    return measurements;
  }
  if (
    hasFullBoundary &&
    rawAttic != null &&
    insulationAtticMateriallyDiffersFromCeilingBoundary(rawAttic, expected)
  ) {
    return {
      ...measurements,
      atticInsulationSqft: String(expected),
    };
  }
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

/** Flat material-only premium for kraft/foil-faced batt insulation ($/SF). */
export const INSULATION_BATT_FACED_MATERIAL_ADD_PER_SQFT = 0.2;

/** Material-only premium for faced batt — labor is unchanged. */
export function insulationBattFacingMaterialAddPerSqft(
  facing: InsulationBattFacing | null | undefined
): number {
  return facing === 'faced' ? INSULATION_BATT_FACED_MATERIAL_ADD_PER_SQFT : 0;
}

export function insulationBattFacingNeedsReview(
  materialType: string,
  facing: InsulationBattFacing | null | undefined
): boolean {
  return (
    isBattInsulationMaterial(materialType) &&
    (!facing || facing === 'not_sure')
  );
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

/** Plan-reviewed wall + ceiling/roof takeoff supersedes living-SF envelope formulas. */
export function hasConfirmedInsulationPlanTakeoff(
  record?: Record<string, unknown> | null
): boolean {
  if (!record) return false;
  const assemblies = Array.isArray(record.insulationAssemblies)
    ? (record.insulationAssemblies as InsulationAssembly[])
    : [];
  const pricedAssemblies = assemblies.filter(isPricedInsulationAssembly);
  if (pricedAssemblies.length > 0) {
    const hasWall = pricedAssemblies.some(
      row => String(row.location || '') === 'exterior_wall'
    );
    const hasCeiling = pricedAssemblies.some(row =>
      ['attic_ceiling', 'roof_deck'].includes(String(row.location || ''))
    );
    if (hasWall && hasCeiling) return true;
  }
  const wall = Number(record.exteriorWallInsulationSqft ?? 0);
  const attic = Number(record.atticInsulationSqft ?? 0);
  const roof = Number(record.insulatedRoofDeckSqft ?? 0);
  return wall > 0 && (attic > 0 || roof > 0);
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

export function insulationAssemblyNumericRValue(rValue: string): number {
  return Number(String(rValue || '').match(/\d{2,3}/)?.[0] || 0);
}

function insulationAssemblyLocationReviewLabel(
  location: string | null | undefined
): string {
  return (
    {
      exterior_wall: 'Exterior wall',
      attic_ceiling: 'Attic / ceiling',
      roof_deck: 'Roof deck',
      garage_separation: 'Garage separation',
      floor: 'Floor',
    }[String(location || '').trim()] || 'Assembly'
  );
}

export const INSULATION_ASSEMBLY_RATE_CARD_LABEL = 'National rate card';

/** Production fiberglass-batt baseline for barometer-matched ground-up homes. */
export const INSULATION_PRODUCTION_BATT_BASELINE = {
  material: 0.8,
  labor: 0.7,
} as const;

export const INSULATION_PRODUCTION_RATE_CARD_LABEL = 'Production planning rate';

export const INSULATION_CALIBRATED_RATE_CARD_LABEL =
  'Builder-budget calibrated rate';

export type InsulationAssemblyPlanningRateTier =
  | 'production'
  | 'calibrated'
  | 'national';

export function insulationAssemblyRowsWithoutPricedLocation(
  rows: InsulationAssembly[],
  location: 'attic_ceiling' | 'roof_deck'
): InsulationAssembly[] {
  return rows.filter(
    row => !(row.location === location && isPricedInsulationAssembly(row))
  );
}

export function insulationAssemblyCeilingRoofDeckConflict(
  rows: InsulationAssembly[]
): { hasConflict: boolean; message: string | null } {
  const priced = rows.filter(isPricedInsulationAssembly);
  const hasAttic = priced.some(row => row.location === 'attic_ceiling');
  const hasRoofDeck = priced.some(row => row.location === 'roof_deck');
  if (!hasAttic || !hasRoofDeck) {
    return { hasConflict: false, message: null };
  }
  return {
    hasConflict: true,
    message:
      'Ceiling and roof-deck insulation are both in scope. Most builds insulate the ceiling below the attic or the roof deck — not both. Review before bid to avoid double-counting.',
  };
}

type InsulationCodeMinimumRule = {
  label: string;
  minR: number;
  locations: Array<NonNullable<InsulationAssembly['location']>>;
};

const INSULATION_CODE_MIN_R_BY_STATE: Record<string, InsulationCodeMinimumRule[]> =
  {
    UT: [
      {
        label: 'exterior walls',
        minR: 21,
        locations: ['exterior_wall'],
      },
      {
        label: 'ceilings and roof assemblies',
        minR: 38,
        locations: ['attic_ceiling', 'roof_deck'],
      },
      {
        label: 'floors over unconditioned space',
        minR: 30,
        locations: ['floor'],
      },
    ],
  };

export type InsulationAssemblyCodeUpgradeTarget = {
  rowId: string;
  message: string;
  targetRValue: string;
  location: NonNullable<InsulationAssembly['location']>;
};

export function insulationAssemblyCodeUpgradeTargets(
  rows: InsulationAssembly[],
  state?: string | null
): InsulationAssemblyCodeUpgradeTarget[] {
  const rules =
    INSULATION_CODE_MIN_R_BY_STATE[String(state || '').trim().toUpperCase()];
  if (!rules?.length) return [];

  const stateLabel = String(state || '').trim().toUpperCase();
  const targets: InsulationAssemblyCodeUpgradeTarget[] = [];
  for (const row of rows.filter(isPricedInsulationAssembly)) {
    const location = String(row.location || '').trim() as NonNullable<
      InsulationAssembly['location']
    >;
    const rValue = insulationAssemblyNumericRValue(row.rValue);
    if (!(rValue > 0)) continue;
    for (const rule of rules) {
      if (!rule.locations.includes(location)) continue;
      if (rValue >= rule.minR) continue;
      targets.push({
        rowId: row.id,
        location,
        targetRValue: `R-${rule.minR}`,
        message: `${insulationAssemblyLocationReviewLabel(location)} ${row.rValue} is below ${stateLabel} residential minimum R-${rule.minR} for ${rule.label}.`,
      });
      break;
    }
  }
  return targets;
}

export function insulationAssemblyCodeWarnings(
  rows: InsulationAssembly[],
  state?: string | null
): string[] {
  return insulationAssemblyCodeUpgradeTargets(rows, state).map(
    target => `${target.message} Review before bid.`
  );
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
