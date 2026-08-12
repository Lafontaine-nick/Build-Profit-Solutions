import type { ConcreteFlatworkOptionId } from '@/utils/qmScopePanels/concreteRemodel';
import { CONCRETE_FLATWORK_OPTION_IDS } from '@/utils/qmScopePanels/concreteRemodel';

/** Plan-export flat keys mapped to canonical flatwork type ids. */
export const CONCRETE_PLAN_FLATWORK_AREA_KEYS: Record<
  string,
  ConcreteFlatworkOptionId
> = {
  concreteDrivewaySqft: 'driveways',
  concreteSidewalkSqft: 'sidewalks',
  concretePatioSqft: 'patios',
  concreteRvPadSqft: 'rv_pads',
  concreteWalkwaySqft: 'walkways',
};

/** Only prefill per-type thickness when the plan explicitly supplies it. */
export const CONCRETE_PLAN_FLATWORK_THICKNESS_KEYS: Record<
  string,
  ConcreteFlatworkOptionId
> = {
  concreteDrivewayThicknessInches: 'driveways',
  concreteSidewalkThicknessInches: 'sidewalks',
  concretePatioThicknessInches: 'patios',
  concreteRvPadThicknessInches: 'rv_pads',
  concreteWalkwayThicknessInches: 'walkways',
};

export const CONCRETE_REVIEW_MEASUREMENT_KEYS = [
  'concreteDrivewaySqft',
  'concreteSidewalkSqft',
  'concretePatioSqft',
  'concreteRvPadSqft',
  'concreteWalkwaySqft',
  'concreteDrivewayThicknessInches',
  'concreteSidewalkThicknessInches',
  'concretePatioThicknessInches',
  'concreteRvPadThicknessInches',
  'concreteWalkwayThicknessInches',
  'concreteSqft',
  'concreteCy',
  'excavationCy',
  'excavationAreaSqft',
  'excavationDepthInches',
  'concreteDemoSqft',
  'concreteReinforcementSqft',
  'concreteSubgradePrepSqft',
  'complexFormingLf',
  'concreteThicknessInches',
] as const;

export type ConcreteAreaByType = Partial<
  Record<ConcreteFlatworkOptionId, number>
>;

export type ConcreteThicknessByType = Partial<
  Record<ConcreteFlatworkOptionId, number>
>;

export type ConcreteStructuredMeasurements = {
  concreteAreaByType?: ConcreteAreaByType | null;
  concreteThicknessByType?: ConcreteThicknessByType | null;
  concreteScope?: string[] | null;
};

function positiveNumber(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readAreaByType(
  input: Record<string, unknown>
): ConcreteAreaByType | null {
  const merged: ConcreteAreaByType = {};
  const existing =
    input.concreteAreaByType &&
    typeof input.concreteAreaByType === 'object' &&
    !Array.isArray(input.concreteAreaByType)
      ? (input.concreteAreaByType as Record<string, unknown>)
      : {};
  for (const type of CONCRETE_FLATWORK_OPTION_IDS) {
    const value = positiveNumber(existing[type]);
    if (value != null) merged[type] = value;
  }
  for (const [planKey, type] of Object.entries(CONCRETE_PLAN_FLATWORK_AREA_KEYS)) {
    const value = positiveNumber(input[planKey]);
    if (value != null) merged[type] = value;
  }
  return Object.keys(merged).length ? merged : null;
}

function readThicknessByType(
  input: Record<string, unknown>
): ConcreteThicknessByType | null {
  const merged: ConcreteThicknessByType = {};
  const existing =
    input.concreteThicknessByType &&
    typeof input.concreteThicknessByType === 'object' &&
    !Array.isArray(input.concreteThicknessByType)
      ? (input.concreteThicknessByType as Record<string, unknown>)
      : {};
  for (const type of CONCRETE_FLATWORK_OPTION_IDS) {
    const value = positiveNumber(existing[type]);
    if (value != null) merged[type] = value;
  }
  for (const [planKey, type] of Object.entries(
    CONCRETE_PLAN_FLATWORK_THICKNESS_KEYS
  )) {
    const value = positiveNumber(input[planKey]);
    if (value != null) merged[type] = value;
  }
  return Object.keys(merged).length ? merged : null;
}

function sumAreaByType(areaByType: ConcreteAreaByType | null): number | null {
  if (!areaByType) return null;
  const total = Object.values(areaByType).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  );
  return total > 0 ? total : null;
}

/** Build scope selections only from explicitly supported quantities. */
export function inferConcreteScopeFromMeasurements(
  input: Record<string, unknown>,
  areaByType: ConcreteAreaByType | null
): string[] | null {
  const scope = new Set<string>();
  const flatworkTypes = areaByType
    ? (Object.keys(areaByType) as ConcreteFlatworkOptionId[])
    : [];
  for (const type of flatworkTypes) {
    if (positiveNumber(areaByType?.[type]) != null) scope.add(type);
  }

  const aggregateFlatwork = positiveNumber(input.concreteSqft);
  if (aggregateFlatwork != null && !flatworkTypes.length) {
    scope.add('pour_flatwork');
  } else if (flatworkTypes.length) {
    scope.add('pour_flatwork');
  }

  if (positiveNumber(input.concreteCy) != null) {
    scope.add('pour_foundation');
  }
  if (positiveNumber(input.excavationCy) != null) {
    scope.add('excavation');
  }
  if (positiveNumber(input.concreteDemoSqft) != null) {
    scope.add('demo_removal');
  }
  if (positiveNumber(input.concreteReinforcementSqft) != null) {
    scope.add('reinforcement');
  }
  if (positiveNumber(input.concreteSubgradePrepSqft) != null) {
    scope.add('site_prep');
  }
  if (positiveNumber(input.complexFormingLf) != null) {
    scope.add('complex_forming');
  }

  return scope.size ? [...scope] : null;
}

/**
 * Converge plan/notes/manual concrete inputs onto the same canonical keys used
 * by the finished notes/manual Concrete flow. Does not invoke pricing.
 */
export function buildConcreteStructuredMeasurements(
  input: Record<string, unknown>
): ConcreteStructuredMeasurements {
  const areaByType = readAreaByType(input);
  const thicknessByType = readThicknessByType(input);
  const areaTotal = sumAreaByType(areaByType);
  const aggregateFlatwork = positiveNumber(input.concreteSqft);
  const concreteSqft =
    areaTotal != null
      ? areaTotal
      : aggregateFlatwork != null
        ? aggregateFlatwork
        : null;

  const scope =
    Array.isArray(input.concreteScope) && input.concreteScope.length
      ? input.concreteScope.map(String)
      : inferConcreteScopeFromMeasurements(
          {
            ...input,
            ...(concreteSqft != null ? { concreteSqft } : {}),
          },
          areaByType
        );

  return {
    concreteAreaByType: areaByType,
    concreteThicknessByType: thicknessByType,
    concreteScope: scope,
  };
}

export function normalizeConcreteScalarMeasurements(
  input: Record<string, unknown>,
  structured: ConcreteStructuredMeasurements
): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  const scalarKeys = [
    'concreteSqft',
    'concreteCy',
    'excavationCy',
    'excavationAreaSqft',
    'excavationDepthInches',
    'concreteDemoSqft',
    'concreteReinforcementSqft',
    'concreteSubgradePrepSqft',
    'complexFormingLf',
    'concreteThicknessInches',
  ] as const;

  const areaTotal = sumAreaByType(structured.concreteAreaByType || null);
  if (areaTotal != null) {
    out.concreteSqft = areaTotal;
  } else {
    const aggregate = positiveNumber(input.concreteSqft);
    if (aggregate != null) out.concreteSqft = aggregate;
  }

  for (const key of scalarKeys) {
    if (key === 'concreteSqft') continue;
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      out[key] = value;
      continue;
    }
    if (typeof value === 'string' && value.trim()) {
      const n = positiveNumber(value);
      if (n != null) out[key] = n;
    }
  }

  return out;
}
