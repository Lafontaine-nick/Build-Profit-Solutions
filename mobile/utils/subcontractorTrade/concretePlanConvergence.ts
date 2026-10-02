import type { ConcreteFlatworkOptionId } from '@/utils/qmScopePanels/concreteRemodel';
import {
  CONCRETE_FLATWORK_OPTION_IDS,
  isConcreteQmScopeItemActive,
} from '@/utils/qmScopePanels/concreteRemodel';
import { isRvOrToyGarageBayName } from '@/utils/subcontractorTrade/garageDoorsPlanConvergence';

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
  'thickenedEdgeLf',
  'thickenedEdgeCy',
  'gravelBaseCy',
  'gravelBaseDepthInches',
  'concretePumpCount',
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

/**
 * House and garage slabs price at $8/SF.
 * Footings ($350/CY) and rebar ($1.75/SF) price on their own cards once a
 * quantity is entered. With a slab on the bid and no separate quantity, those
 * lines stay at $0 so an empty card is not billed again.
 * Flatwork stays on its own card.
 */
export function concreteFoundationPackageDollars(
  itemId: string,
  measurements:
    | {
        houseSlabSqft?: unknown;
        garageSlabSqft?: unknown;
        concreteCy?: unknown;
        concreteReinforcementSqft?: unknown;
      }
    | null
    | undefined,
  templateKey?: string | null
): { material: number; labor: number; allowance: number } | 'included' | null {
  if (String(templateKey || '').toLowerCase() !== 'concrete') return null;
  const house = positiveNumber(measurements?.houseSlabSqft) ?? 0;
  const garage = positiveNumber(measurements?.garageSlabSqft) ?? 0;
  if (!(house > 0 || garage > 0)) return null;
  if (itemId === 'pour_foundation') {
    return positiveNumber(measurements?.concreteCy) ? null : 'included';
  }
  if (itemId === 'reinforcement') {
    return positiveNumber(measurements?.concreteReinforcementSqft)
      ? null
      : 'included';
  }
  const area = itemId === 'house_slab' ? house : itemId === 'garage_slab' ? garage : 0;
  if (!(area > 0)) return null;
  const half = Math.round(area * 4 * 100) / 100;
  return { material: half, labor: half, allowance: 0 };
}

function concreteConfirmScopeItemVisible(input: {
  itemId: string;
  templateKey?: string | null;
  state?: string | null;
  noteBacked?: boolean | null;
  measurements: Record<string, unknown> | null | undefined;
}): boolean {
  if (String(input.templateKey || '').toLowerCase() !== 'concrete') return true;
  const measurements = input.measurements || {};
  return (
    isConcreteQmScopeItemActive(input.itemId, measurements) ||
    (input.state === 'included' && input.noteBacked === true)
  );
}

/** Confirm Scope should only offer a price the contractor can see and apply. */
export function shouldOfferConcreteConfirmScopePrice(input: {
  itemId: string;
  templateKey?: string | null;
  state?: string | null;
  noteBacked?: boolean | null;
  measurements: Record<string, unknown> | null | undefined;
}): boolean {
  if (!concreteConfirmScopeItemVisible(input)) return false;
  if (String(input.templateKey || '').toLowerCase() !== 'concrete') return true;
  return (
    concreteFoundationPackageDollars(
      input.itemId,
      input.measurements,
      input.templateKey
    ) !== 'included'
  );
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

/**
 * Cover-sheet covered patio is the concrete flatwork area to confirm.
 * Other flatwork types and footing CY stay untouched.
 */
/** Ground-up structural chips. Quantities stay blank until the contractor types them. */
export const CONCRETE_GROUND_UP_STRUCTURE_SCOPE_IDS = [
  'reinforcement',
  'pour_foundation',
  'house_slab',
  'garage_slab',
] as const;

function positiveConcreteQuantity(value: unknown): boolean {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0;
}

/** Copy for Quick measurements when a ground-up structural chip is on with no quantity. */
export function concreteStructureQuantityPrompt(
  measurements: Record<string, unknown>
): string | null {
  const scope = new Set(
    Array.isArray(measurements.concreteScope)
      ? measurements.concreteScope.map(String)
      : []
  );
  const open: string[] = [];
  if (
    scope.has('pour_foundation') &&
    !positiveConcreteQuantity(measurements.concreteCy)
  ) {
    open.push('footing');
  }
  if (
    scope.has('house_slab') &&
    !positiveConcreteQuantity(measurements.houseSlabSqft)
  ) {
    open.push('house slab');
  }
  if (
    scope.has('garage_slab') &&
    !positiveConcreteQuantity(measurements.garageSlabSqft)
  ) {
    open.push('garage slab');
  }
  if (
    scope.has('reinforcement') &&
    !positiveConcreteQuantity(measurements.concreteReinforcementSqft)
  ) {
    open.push('rebar');
  }
  const areaByType =
    measurements.concreteAreaByType &&
    typeof measurements.concreteAreaByType === 'object'
      ? (measurements.concreteAreaByType as Record<string, unknown>)
      : {};
  const flatworkOpen: Array<{ id: string; label: string; scalarKey: string }> = [
    { id: 'driveways', label: 'driveway', scalarKey: 'concreteDrivewaySqft' },
    { id: 'walkways', label: 'walkway', scalarKey: 'concreteWalkwaySqft' },
    { id: 'rv_pads', label: 'RV pad', scalarKey: 'concreteRvPadSqft' },
  ];
  for (const row of flatworkOpen) {
    if (!scope.has(row.id)) continue;
    if (
      positiveConcreteQuantity(areaByType[row.id]) ||
      positiveConcreteQuantity(measurements[row.scalarKey])
    ) {
      continue;
    }
    open.push(row.label);
  }
  if (!open.length) return null;
  if (open.length === 1) {
    return `Enter the ${open[0]} quantity before it can be priced.`;
  }
  const last = open[open.length - 1];
  const rest = open.slice(0, -1);
  const list =
    rest.length > 1 ? `${rest.join(', ')}, and ${last}` : `${rest[0]} and ${last}`;
  return `Enter the ${list} quantities before they can be priced.`;
}

export function withConcreteGroundUpStructurePrompts(
  measurements: Record<string, unknown>
): Record<string, unknown> {
  if (measurements.concreteGroundUpStructurePrompted) return measurements;
  const scope = new Set(
    Array.isArray(measurements.concreteScope)
      ? measurements.concreteScope.map(String)
      : []
  );
  for (const id of CONCRETE_GROUND_UP_STRUCTURE_SCOPE_IDS) scope.add(id);
  return {
    ...measurements,
    concreteScope: [...scope],
    concreteGroundUpStructurePrompted: true,
  };
}

/** A labeled Toy Garage or RV Garage. A plain Garage label is not enough. */
export function planLabelsRvOrToyGarage(input: {
  rooms?: Array<{ name?: string | null }> | null;
  notes?: string | null;
  concreteRvGarageLabeled?: unknown;
}): boolean {
  if (input.concreteRvGarageLabeled === true) return true;
  if ((input.rooms || []).some(room => isRvOrToyGarageBayName(room?.name))) {
    return true;
  }
  return /\b(?:rv|toy)\s*garage\b/i.test(String(input.notes || ''));
}

/**
 * Ground-up flatwork chips with blank areas.
 * Driveway and walkway are typical. RV pad turns on only for a labeled RV or toy garage.
 * Sidewalk stays off.
 */
export function withConcreteGroundUpFlatworkPrompts(
  measurements: Record<string, unknown>,
  context?: {
    rooms?: Array<{ name?: string | null }> | null;
    notes?: string | null;
  }
): Record<string, unknown> {
  const scope = new Set(
    Array.isArray(measurements.concreteScope)
      ? measurements.concreteScope.map(String)
      : []
  );
  const prompted = measurements.concreteGroundUpFlatworkPrompted === true;
  if (!prompted) {
    scope.add('driveways');
    scope.add('walkways');
  }
  const rvLabeled = planLabelsRvOrToyGarage({
    rooms: context?.rooms,
    notes: context?.notes,
    concreteRvGarageLabeled: measurements.concreteRvGarageLabeled,
  });
  const rvPrompted = measurements.concreteRvGaragePrompted === true;
  if (rvLabeled && !rvPrompted) scope.add('rv_pads');
  if (
    prompted &&
    (!rvLabeled || rvPrompted) &&
    measurements.concreteRvGarageLabeled === rvLabeled
  ) {
    return measurements;
  }
  return {
    ...measurements,
    concreteScope: [...scope],
    concreteGroundUpFlatworkPrompted: true,
    concreteRvGarageLabeled: rvLabeled,
    concreteRvGaragePrompted: rvPrompted || rvLabeled,
  };
}

export function withConcreteCoverPatioOffer(
  measurements: Record<string, unknown>,
  coveredPatioSqft: unknown
): Record<string, unknown> {
  if (positiveNumber(measurements.concretePatioSqft) != null) {
    return measurements;
  }
  const patio = positiveNumber(coveredPatioSqft);
  if (patio == null) return measurements;
  return { ...measurements, concretePatioSqft: patio };
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
  const hasFoundationCy = positiveNumber(input.concreteCy) != null;
  if (aggregateFlatwork != null && !flatworkTypes.length && !hasFoundationCy) {
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
  if (positiveNumber(input.gravelBaseCy) != null) {
    scope.add('gravel_base');
  }
  if (
    input.concretePumpReviewNeeded === true ||
    positiveNumber(input.concretePumpCount) != null
  ) {
    scope.add('concrete_pumping');
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
    'thickenedEdgeLf',
    'thickenedEdgeCy',
    'gravelBaseCy',
    'gravelBaseDepthInches',
    'concretePumpCount',
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
