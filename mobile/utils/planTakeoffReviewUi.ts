import {
  resolvePlanMeasurementProvenance,
  type PlanMeasurementProvenance,
} from '@/utils/planMeasurementProvenance';
import type { QuickMeasurementSourceTag } from '@/utils/quickMeasurementProvenance';
import {
  buildAreaReconciliation,
  formatPlanSourceLabel,
  measurementSemanticsV1Enabled,
  measurementStatusLabel,
  missingStatusForScope,
  type AreaReconciliation,
} from '@/utils/measurementSemantics';
import {
  ELECTRICAL_CARD_GROUPS,
  ELECTRICAL_CARDS,
  electricalCardForMeasurementKey,
  hasDetailedElectricalQuantities,
} from '@/utils/subcontractorTrade/electricalPlanConvergence';
import {
  FRAMING_CARDS,
  FRAMING_SHELL_COMPONENT_ITEM_IDS,
  FRAMING_SHELL_COMPONENT_MEASUREMENT_KEYS,
  buildFramingStructuredMeasurements,
  framingCardForMeasurementKey,
  isShellFramingPackageBid,
  resolveCoveredFramedAreaSqft,
  resolveFramingSheathingSqft,
  shellPackageIncludesSheathing,
  shouldPreserveShellFramingComponentMeasurement,
  shouldStripShellFramingComponentMeasurement,
  stripShellFramingComponentMeasurements,
} from '@/utils/subcontractorTrade/framingPlanConvergence';
import { PLUMBING_CARDS } from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import { hvacCardForMeasurementKey } from '@/utils/subcontractorTrade/hvacPlanConvergence';

export type PlanReviewSpaceKind = 'living' | 'garage' | 'other';

export function classifyPlanSpaceName(name: string): PlanReviewSpaceKind {
  const n = String(name || '');
  if (/\bgarage\b|\brv\s*garage\b|\bcarport\b/i.test(n)) return 'garage';
  if (/\bpatio\b|\bporch\b|\bdeck\b|\bbreezeway\b/i.test(n)) return 'other';
  return 'living';
}

export function spacesDetectedTitle(spaceCount: number): string {
  return `${spaceCount} spaces detected`;
}

export function readyStateSummary(input: {
  measurementCount: number;
  spaceCount: number;
  scopeCount: number;
}): string {
  const bits: string[] = [];
  if (input.measurementCount) {
    bits.push(
      `${input.measurementCount} project measurement${input.measurementCount === 1 ? '' : 's'}`
    );
  }
  if (input.spaceCount) {
    bits.push(
      `${input.spaceCount} detected space${input.spaceCount === 1 ? '' : 's'}`
    );
  }
  if (input.scopeCount) {
    bits.push(
      `${input.scopeCount} scope item${input.scopeCount === 1 ? '' : 's'}`
    );
  }
  return bits.length ? `Ready · ${bits.join(' · ')}` : 'Ready · Plan reviewed';
}

/** Internal scope metadata — never show as a takeoff quantity row. */
export const PLAN_REVIEW_INTERNAL_MEASUREMENT_KEYS = new Set([
  'quickMeasurementSources',
  'quickMeasurementUserOverrides',
  'measurementProvenance',
  'measurementConflicts',
  'itemQuantities',
  'pricingAcceptance',
  'scopeGapResolutions',
  'planFacts',
  'insulationAssemblies',
  'projectComplexity',
  'planImportMode',
  'planImportTradeKey',
  'planImportFingerprint',
  'fieldConfidence',
]);

export function isPlanReviewMeasurementScalar(
  value: unknown
): value is number | string {
  return typeof value === 'number' || typeof value === 'string';
}

export function filterPlanReviewMeasurementEntries(
  measurements: Record<string, unknown>
): Record<string, number | string> {
  return Object.fromEntries(
    Object.entries(measurements || {}).filter(
      ([key, value]) =>
        !PLAN_REVIEW_INTERNAL_MEASUREMENT_KEYS.has(key) &&
        isPlanReviewMeasurementScalar(value) &&
        value !== ''
    )
  ) as Record<string, number | string>;
}

export function measurementDisplayLabel(
  key: string,
  value: number | null | undefined,
  livingSf?: number | null
): {
  label: string;
  subtext?: string | null;
} {
  const plumbingLabels: Record<string, string> = {
    plumbingRoughPointCount: 'Plumbing rough-in points',
    plumbingTrimHookupCount: 'Trim / hookups',
    plumbingFixturesHardwareCount: 'Plumbing fixture allowance',
    waterHeaterCount: 'Water heater',
    gasApplianceConnectionCount: 'Gas appliance connections',
    waterLineLf: 'Underground water service / under-slab piping',
    sewerLineLf: 'Underground sewer / drain / under-slab DWV',
    gasLineLf: 'Gas piping',
  };
  if (plumbingLabels[key]) return { label: plumbingLabels[key] };

  const insulationLabels: Record<string, string> = {
    exteriorWallInsulationSqft: 'Exterior wall insulation',
    atticInsulationSqft: 'Attic / ceiling insulation',
    insulatedRoofDeckSqft: 'Insulated roof deck',
    floorInsulationSqft: 'Floor insulation',
    garageSeparationInsulationSqft: 'Garage separation insulation',
    openingDeductionSqft: 'Exterior opening deduction',
  };
  if (insulationLabels[key]) return { label: insulationLabels[key] };

  const drywallLabels: Record<string, { label: string; subtext?: string | null }> =
    {
      drywallSqft: {
        label: 'Total drywall package',
        subtext: 'Net wall + ceiling surface SF',
      },
      drywallWallSqft: {
        label: 'House walls',
        subtext: 'Conditioned wall surface · suggested 1/2" board',
      },
      drywallCeilingSqft: {
        label: 'House ceilings',
        subtext: 'Conditioned ceiling surface · confirm 5/8" board',
      },
      garageWallDrywallSqft: {
        label: 'Garage walls',
        subtext: 'Garage wall surface SF',
      },
      garageCeilingDrywallSqft: {
        label: 'Garage ceiling',
        subtext: 'Garage ceiling surface SF',
      },
      fireRatedDrywallSqft: {
        label: 'Fire-rated board',
        subtext: 'Garage / rated assemblies · typically 5/8" Type X',
      },
      moistureResistantDrywallSqft: {
        label: 'Moisture-resistant board',
        subtext: 'Wet-area walls where specified',
      },
      drywallOpeningDeductionSqft: {
        label: 'Opening deductions',
        subtext: 'Window and door openings removed from wall SF',
      },
      highCeilingDrywallSqft: {
        label: 'High-ceiling drywall',
      },
      vaultedCeilingDrywallSqft: {
        label: 'Vaulted / sloped drywall',
      },
      specialtyDrywallSqft: {
        label: 'Specialty board',
      },
      level5FinishSqft: {
        label: 'Level 5 finish area',
      },
    };
  if (drywallLabels[key]) return drywallLabels[key];

  const hvacLabel = {
    hvacSystemCount: 'HVAC systems',
    hvacSystemTons: 'HVAC capacity',
    hvacServiceCallCount: 'HVAC service calls',
    hvacEquipmentReplacementCount: 'HVAC equipment replacements',
    hvacRefrigerantCount: 'Refrigerant service',
    hvacThermostatCount: 'Thermostats',
    hvacDuctworkLf: 'HVAC ductwork',
    hvacSupplyRegisterCount: 'Supply registers',
    hvacReturnGrilleCount: 'Return grilles',
    hvacVentilationCount: 'HVAC ventilation',
    hvacPermitCount: 'HVAC permits / inspections',
    hvacCleanupCount: 'HVAC cleanup',
  }[key as string];
  if (hvacLabel) return { label: hvacLabel };
  const hvacCard = hvacCardForMeasurementKey(key);
  if (hvacCard) return { label: hvacCard.label, subtext: hvacCard.helper };

  const framingCard = framingCardForMeasurementKey(key);
  if (framingCard)
    return { label: framingCard.label, subtext: framingCard.helper };

  if (!measurementSemanticsV1Enabled()) {
    if (key === 'floorAreaSqft') return { label: 'Living area' };
    return { label: key };
  }
  if (key === 'floorAreaSqft') return { label: 'Living area' };
  if (key === 'flooringSqft') {
    return {
      label: 'Gross interior floor area',
      // Single concise explanation — no second source/explanation line in the UI.
      subtext: 'Derived from declared living area — finish allocation required',
    };
  }
  if (key === 'garageSqft') return { label: 'Garage' };
  if (key === 'deckSqft') return { label: 'Deck / patio' };
  if (key === 'kitchenFloorSqft') return { label: 'Kitchen floor' };
  if (key === 'bathroomFloorSqft') return { label: 'Bathroom floor area' };
  const stuccoLabels: Record<string, string> = {
    stuccoGrossWallSqft: 'Exterior wall area — gross',
    stuccoWindowDoorOpeningSqft: 'Window & door openings',
    stuccoGarageOpeningSqft: 'Garage door openings',
    stuccoOtherFinishDeductionSqft: 'Other finish deductions',
    stuccoNetWallSqft: 'Net stucco wall area',
    stuccoSoffitSqft: 'Soffits / stucco ceilings',
    stuccoParapetSqft: 'Parapets / raised walls',
    stuccoFoamTrimLf: 'Foam trim / architectural bands',
    stuccoControlJointLf: 'Control / expansion joints',
    stuccoAccessAffectedSqft: 'Access premium affected area',
    stuccoRepairAffectedSqft: 'Substrate repair affected area',
    stuccoStories: 'Stories',
    stuccoWallHeightFt: 'Typical wall height / story',
  };
  if (stuccoLabels[key]) return { label: stuccoLabels[key] };
  const concreteLabels: Record<string, string> = {
    concreteDrivewaySqft: 'Driveway area',
    concreteSidewalkSqft: 'Sidewalk area',
    concretePatioSqft: 'Patio area',
    concreteWalkwaySqft: 'Walkway area',
    concreteRvPadSqft: 'RV pad area',
    concreteSqft: 'Total flatwork area',
    concreteCy: 'Footing / foundation concrete',
    excavationCy: 'Excavation',
    concreteDemoSqft: 'Concrete demo / removal',
    concreteReinforcementSqft: 'Rebar / mesh area',
    concreteSubgradePrepSqft: 'Subgrade prep / grading',
    complexFormingLf: 'Complex forming',
    concreteDrivewayThicknessInches: 'Driveway thickness',
    concreteSidewalkThicknessInches: 'Sidewalk thickness',
    concretePatioThicknessInches: 'Patio thickness',
    concreteWalkwayThicknessInches: 'Walkway thickness',
    concreteRvPadThicknessInches: 'RV pad thickness',
    concreteThicknessInches: 'Flatwork thickness',
  };
  if (concreteLabels[key]) return { label: concreteLabels[key] };
  const flooringLabels: Record<string, string> = {
    flooringSqft: 'Total flooring area',
    floorAreaSqft: 'Total floor area',
    flooringLvpSqft: 'LVP install area',
    flooringLaminateSqft: 'Laminate install area',
    flooringEngineeredHardwoodSqft: 'Engineered hardwood install area',
    flooringSolidHardwoodSqft: 'Solid hardwood install area',
    flooringTileSqft: 'Tile install area',
    flooringCarpetSqft: 'Carpet install area',
    flooringSheetVinylSqft: 'Sheet vinyl / VCT install area',
    floorDemoSqft: 'Floor demo / removal',
    floorPrepSqft: 'Affected floor-prep area',
    underlaymentSqft: 'Underlayment',
    moistureBarrierSqft: 'Moisture barrier',
    baseboardLf: 'Baseboards / trim',
    transitionLf: 'Transitions',
    transitionCount: 'Transitions / reducers',
    quarterRoundLf: 'Quarter round',
  };
  if (flooringLabels[key]) return { label: flooringLabels[key] };
  const paintingLabels: Record<string, string> = {
    wallPaintSqft: 'Interior walls',
    ceilingPaintSqft: 'Ceilings',
    paintAreaSqft: 'Combined paintable area',
    combinedPaintableAreaSqft: 'Combined paintable area',
    interiorDoorCount: 'Interior doors',
    cabinetRunLf: 'Cabinet painting',
    cabinetPaintSqft: 'Cabinet painting area',
    exteriorPaintSqft: 'Exterior paint',
  };
  if (paintingLabels[key]) return { label: paintingLabels[key] };
  if (key === 'serviceAmperage') return { label: 'Service amperage' };
  if (key === 'unclassifiedFixtureCount') {
    return { label: 'Unclassified lighting fixtures' };
  }
  const electricalCard = electricalCardForMeasurementKey(key);
  if (electricalCard) return { label: electricalCard.label };
  return { label: key };
}

export type ConcretePlanReviewLine = {
  label: string;
  value: string;
  note?: string | null;
};

function positiveMeasurement(
  value: number | string | null | undefined
): number | null {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const CONCRETE_PLAN_REVIEW_FLATWORK_ROWS = [
  { label: 'Driveway', key: 'concreteDrivewaySqft', unit: 'sqft' },
  { label: 'Patio', key: 'concretePatioSqft', unit: 'sqft' },
  { label: 'Walkway', key: 'concreteWalkwaySqft', unit: 'sqft' },
  { label: 'Sidewalk', key: 'concreteSidewalkSqft', unit: 'sqft' },
  { label: 'RV pad', key: 'concreteRvPadSqft', unit: 'sqft' },
] as const;

const CONCRETE_PLAN_REVIEW_THICKNESS_ROWS = [
  { label: 'Driveway', key: 'concreteDrivewayThicknessInches' },
  { label: 'Patio', key: 'concretePatioThicknessInches' },
  { label: 'Walkway', key: 'concreteWalkwayThicknessInches' },
  { label: 'Sidewalk', key: 'concreteSidewalkThicknessInches' },
  { label: 'RV pad', key: 'concreteRvPadThicknessInches' },
] as const;

export function concreteThicknessReviewSummary(
  measurements: Record<string, number | string | null | undefined>
): string {
  const explicit = CONCRETE_PLAN_REVIEW_THICKNESS_ROWS.map(row => {
    const inches = positiveMeasurement(measurements[row.key]);
    return inches != null ? `${row.label} ${inches}"` : null;
  }).filter(Boolean);
  if (explicit.length) return explicit.join(' · ');
  const shared = positiveMeasurement(measurements.concreteThicknessInches);
  if (shared != null) return `${shared}" flatwork basis`;
  return 'Needs confirmation';
}

/** Grouped Concrete summary for Plan Review before Confirm Scope. */
export function buildConcretePlanReviewSummary(
  measurements: Record<string, number | string | null | undefined>
): ConcretePlanReviewLine[] {
  const lines: ConcretePlanReviewLine[] = [];
  const perTypeValues = CONCRETE_PLAN_REVIEW_FLATWORK_ROWS.map(row => ({
    ...row,
    value: positiveMeasurement(measurements[row.key]),
  }));
  const hasPerType = perTypeValues.some(row => row.value != null);
  const aggregateFlatwork = positiveMeasurement(measurements.concreteSqft);

  if (hasPerType) {
    for (const row of perTypeValues) {
      lines.push({
        label: row.label,
        value:
          row.value != null
            ? `${formatSfWithCommas(row.value)} ${row.unit}`
            : '—',
      });
    }
  } else if (aggregateFlatwork != null) {
    lines.push({
      label: 'Flatwork total',
      value: `${formatSfWithCommas(aggregateFlatwork)} sqft`,
      note: 'Assign driveway / patio / walkway type in Confirm Scope',
    });
  } else {
    for (const row of perTypeValues) {
      lines.push({ label: row.label, value: '—' });
    }
  }

  const footing = positiveMeasurement(measurements.concreteCy);
  lines.push({
    label: 'Footing / foundation',
    value: footing != null ? `${formatSf(footing)} CY` : '—',
  });

  const excavation = positiveMeasurement(measurements.excavationCy);
  if (excavation != null) {
    lines.push({
      label: 'Excavation',
      value: `${formatSf(excavation)} CY`,
    });
  }

  const demo = positiveMeasurement(measurements.concreteDemoSqft);
  if (demo != null) {
    lines.push({
      label: 'Demo / removal',
      value: `${formatSfWithCommas(demo)} sqft`,
    });
  }

  const reinforcement = positiveMeasurement(
    measurements.concreteReinforcementSqft
  );
  if (reinforcement != null) {
    lines.push({
      label: 'Rebar / mesh',
      value: `${formatSfWithCommas(reinforcement)} sqft`,
    });
  }

  lines.push({
    label: 'Thickness',
    value: concreteThicknessReviewSummary(measurements),
    note:
      concreteThicknessReviewSummary(measurements) === 'Needs confirmation'
        ? 'Confirm 4" / 5" / 6" per slab type in Confirm Scope'
        : null,
  });

  return lines;
}

export type FlooringPlanReviewLine = {
  label: string;
  value: string;
  note?: string | null;
};

const FLOORING_PLAN_REVIEW_INSTALL_ROWS = [
  { label: 'LVP', key: 'flooringLvpSqft', product: 'lvp' },
  { label: 'Laminate', key: 'flooringLaminateSqft', product: 'laminate' },
  {
    label: 'Engineered hardwood',
    key: 'flooringEngineeredHardwoodSqft',
    product: 'engineered_hardwood',
  },
  {
    label: 'Solid hardwood',
    key: 'flooringSolidHardwoodSqft',
    product: 'solid_hardwood',
  },
  { label: 'Tile', key: 'flooringTileSqft', product: 'tile' },
  { label: 'Carpet', key: 'flooringCarpetSqft', product: 'carpet' },
  {
    label: 'Sheet vinyl / VCT',
    key: 'flooringSheetVinylSqft',
    product: 'sheet_vinyl_vct',
  },
] as const;

function formatExistingFloorSummary(
  measurements: Record<string, number | string | null | undefined>
): string {
  const types = Array.isArray(measurements.flooringExistingTypes)
    ? measurements.flooringExistingTypes.map(String).filter(Boolean)
    : [];
  if (!types.length) return 'Needs confirmation';
  return types
    .map(type => {
      if (type === 'sheet_vinyl_vct') return 'Sheet vinyl / VCT';
      if (type === 'lvp') return 'LVP';
      if (type === 'unknown') return 'Unknown';
      return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    })
    .join(', ');
}

/** Grouped Flooring summary for Plan Review before Confirm Scope. */
export function buildFlooringPlanReviewSummary(
  measurements: Record<string, number | string | null | undefined>
): FlooringPlanReviewLine[] {
  const lines: FlooringPlanReviewLine[] = [];
  const perTypeValues = FLOORING_PLAN_REVIEW_INSTALL_ROWS.map(row => ({
    ...row,
    value: positiveMeasurement(measurements[row.key]),
  }));
  const hasPerType = perTypeValues.some(row => row.value != null);
  const aggregate =
    positiveMeasurement(measurements.flooringSqft) ??
    positiveMeasurement(measurements.floorAreaSqft);
  const installTotal =
    perTypeValues.reduce((sum, row) => sum + (row.value || 0), 0) ||
    aggregate ||
    null;

  if (installTotal != null) {
    lines.push({
      label: 'Total floor area',
      value: `${formatSfWithCommas(installTotal)} sqft`,
    });
  }

  if (hasPerType) {
    for (const row of perTypeValues) {
      if (row.value == null) continue;
      lines.push({
        label: row.label,
        value: `${formatSfWithCommas(row.value)} sqft`,
      });
    }
  } else if (aggregate != null) {
    lines.push({
      label: 'Flooring type',
      value: 'Needs confirmation',
      note: 'Assign flooring type in Confirm Scope',
    });
  }

  const demo = positiveMeasurement(measurements.floorDemoSqft);
  lines.push({
    label: 'Existing floor',
    value: formatExistingFloorSummary(measurements),
  });
  lines.push({
    label: 'Demo / removal',
    value:
      demo != null ? `${formatSfWithCommas(demo)} sqft` : 'Needs confirmation',
  });
  lines.push({
    label: 'Subfloor prep',
    value:
      positiveMeasurement(measurements.floorPrepSqft) != null
        ? `${formatSfWithCommas(positiveMeasurement(measurements.floorPrepSqft)!)} sqft`
        : 'Needs confirmation',
  });

  const baseboards = positiveMeasurement(measurements.baseboardLf);
  lines.push({
    label: 'Baseboards',
    value: baseboards != null ? `${formatSfWithCommas(baseboards)} LF` : '—',
  });

  const transitions =
    positiveMeasurement(measurements.transitionCount) ??
    positiveMeasurement(measurements.transitionLf);
  lines.push({
    label: 'Transitions',
    value:
      transitions != null
        ? `${formatSfWithCommas(transitions)} ${
            positiveMeasurement(measurements.transitionCount) != null
              ? 'each'
              : 'LF'
          }`
        : '—',
  });

  const quarterRound = positiveMeasurement(measurements.quarterRoundLf);
  lines.push({
    label: 'Quarter round',
    value:
      quarterRound != null ? `${formatSfWithCommas(quarterRound)} LF` : '—',
  });

  return lines;
}

export type PaintingPlanReviewLine = {
  label: string;
  value: string;
  note?: string | null;
};

function occupancyLabel(value: unknown): string {
  if (value === 'occupied') return 'Occupied';
  if (value === 'vacant') return 'Vacant';
  if (value === 'new_construction') return 'New construction';
  return 'Needs confirmation';
}

function applicationLabel(value: unknown): string {
  if (value === 'brush_roll') return 'Brush / roll';
  if (value === 'spray') return 'Spray';
  if (value === 'mixed') return 'Brush/roll + spray';
  return 'Needs confirmation';
}

const PAINTING_PLAN_REVIEW_KEYS = new Set([
  'wallPaintSqft',
  'ceilingPaintSqft',
  'paintAreaSqft',
  'combinedPaintableAreaSqft',
  'baseboardLf',
  'interiorDoorCount',
  'cabinetRunLf',
  'cabinetPaintSqft',
  'exteriorPaintSqft',
]);

const ELECTRICAL_PLAN_REVIEW_KEYS = new Set([
  ...ELECTRICAL_CARDS.map(card => card.measurementKey),
  'serviceAmperage',
]);

const PLUMBING_PLAN_REVIEW_KEYS = new Set([
  'plumbingRoughPointCount',
  'plumbingTrimHookupCount',
  'plumbingFixturesHardwareCount',
  'waterHeaterCount',
  'gasApplianceConnectionCount',
  'waterLineLf',
  'sewerLineLf',
  'gasLineLf',
]);

const FRAMING_PLAN_REVIEW_KEYS = new Set([
  'framedAreaSqft',
  'wallFramingLf',
  'sheathingSqft',
  'framingOpeningCount',
  'framingCleanupCount',
  'floorAreaSqft',
  'garageSqft',
  'stuccoGrossWallSqft',
]);

export function electricalPlanQuantityPricingEligible(
  key: string,
  provenanceEntry?: unknown,
  validationField?: { pricingEligible?: boolean } | null
): boolean {
  if (!ELECTRICAL_PLAN_REVIEW_KEYS.has(key)) return true;
  if (
    validationField != null &&
    typeof validationField.pricingEligible === 'boolean'
  ) {
    return validationField.pricingEligible;
  }
  if (!provenanceEntry || typeof provenanceEntry !== 'object') return false;
  const entry = provenanceEntry as {
    pricingEligible?: unknown;
    normalizedSource?: unknown;
    status?: unknown;
    evidenceKind?: unknown;
  };
  if (typeof entry.pricingEligible === 'boolean') {
    return entry.pricingEligible;
  }
  if (
    entry.normalizedSource === 'FROM_PLAN' ||
    entry.normalizedSource === 'AI_VERIFIED' ||
    entry.status === 'plan_verified' ||
    entry.status === 'ai_verified'
  ) {
    return true;
  }
  if (
    !entry.evidenceKind &&
    (entry as { source?: unknown }).source === 'detected_from_plan'
  ) {
    return true;
  }
  return (
    entry.evidenceKind === 'instance_tags' ||
    entry.evidenceKind === 'explicit_label'
  );
}

function provenanceSourceText(entry: unknown): string {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry.toLowerCase();
  if (typeof entry === 'object') {
    const rec = entry as { source?: string; normalizedSource?: string };
    return String(rec.source || rec.normalizedSource || '').toLowerCase();
  }
  return '';
}

export function planFieldEvidenceLabel(entry: unknown): string | undefined {
  if (!entry || typeof entry !== 'object') return undefined;
  const record = entry as {
    evidence?: Array<{
      page?: number;
      sheet?: string;
      label?: string;
      sourceText?: string;
    }>;
    derivedFrom?: string[];
  };
  const evidence = Array.isArray(record.evidence) ? record.evidence[0] : null;
  const location =
    evidence?.sheet && evidence?.page
      ? `${evidence.sheet} · p.${evidence.page}`
      : evidence?.sheet
        ? evidence.sheet
        : evidence?.page
          ? `p.${evidence.page}`
          : '';
  const source = String(evidence?.label || evidence?.sourceText || '').trim();
  const derived =
    Array.isArray(record.derivedFrom) && record.derivedFrom.length
      ? `Derived from ${record.derivedFrom.join(', ')}`
      : '';
  return [derived, location, source].filter(Boolean).join(' · ') || undefined;
}

export function planReviewProvenanceFlags(input: {
  key: string;
  provenanceEntry?: unknown;
  hasConflict?: boolean;
  pricingEligible?: boolean;
}): {
  hasExplicitPlanSource: boolean;
  hasReliableDimensions: boolean;
  roomDependent: boolean;
  fromPlanSymbols: boolean;
  aiVerified: boolean;
  aiInferred: boolean;
} {
  const source = provenanceSourceText(input.provenanceEntry);
  const evidenceKind =
    typeof input.provenanceEntry === 'object' && input.provenanceEntry != null
      ? String(
          (input.provenanceEntry as { evidenceKind?: string }).evidenceKind ||
            ''
        ).toLowerCase()
      : '';
  const fromGeometry =
    source.includes('geometry') || source.includes('calculated_from_plan');
  const fromInstanceTags =
    source.includes('instance_tag') ||
    source.includes('pdf_text') ||
    evidenceKind === 'instance_tags';
  const fromPlan =
    fromInstanceTags ||
    source.includes('detected_from_plan') ||
    source.includes('labeled') ||
    source === 'from_plan';
  const paintingKey = PAINTING_PLAN_REVIEW_KEYS.has(input.key);
  const electricalKey = ELECTRICAL_PLAN_REVIEW_KEYS.has(input.key);
  const plumbingKey = PLUMBING_PLAN_REVIEW_KEYS.has(input.key);
  const framingKey = FRAMING_PLAN_REVIEW_KEYS.has(input.key);
  const incomplete =
    paintingKey &&
    typeof input.provenanceEntry === 'object' &&
    input.provenanceEntry != null &&
    (input.provenanceEntry as { coverage?: string }).coverage === 'incomplete';
  const derivedFromFixtureInventory =
    plumbingKey &&
    typeof input.provenanceEntry === 'object' &&
    input.provenanceEntry != null &&
    (evidenceKind === 'fixture_inventory_derived' ||
      source.includes('fixture_inventory') ||
      (Array.isArray(
        (input.provenanceEntry as { derivedFrom?: unknown }).derivedFrom
      ) &&
        ((input.provenanceEntry as { derivedFrom?: unknown[] }).derivedFrom
          ?.length || 0) > 0));
  const architecturalLineSegment =
    plumbingKey &&
    typeof input.provenanceEntry === 'object' &&
    input.provenanceEntry != null &&
    (evidenceKind === 'architectural_line_segment' ||
      source.includes('architectural_line') ||
      (Array.isArray(
        (input.provenanceEntry as { evidence?: unknown[] }).evidence
      ) &&
        (
          (
            input.provenanceEntry as {
              evidence?: Array<{ requiresContractorConfirmation?: boolean }>;
            }
          ).evidence || []
        ).some(entry => entry?.requiresContractorConfirmation)));
  const aiInferred =
    (electricalKey &&
      (evidenceKind === 'inference' ||
        source.includes('inferred_from_context'))) ||
    derivedFromFixtureInventory ||
    architecturalLineSegment;
  const methodsAgree =
    typeof input.provenanceEntry === 'object' &&
    input.provenanceEntry != null &&
    (input.provenanceEntry as { methodsAgree?: boolean }).methodsAgree === true;
  const entryPricingEligible =
    typeof input.provenanceEntry === 'object' && input.provenanceEntry != null
      ? (input.provenanceEntry as { pricingEligible?: boolean }).pricingEligible
      : undefined;
  const pricingBlocked =
    input.pricingEligible === false || entryPricingEligible === false;
  const aiVerified =
    !pricingBlocked &&
    electricalKey &&
    typeof input.provenanceEntry === 'object' &&
    input.provenanceEntry != null &&
    ((input.provenanceEntry as { status?: string }).status === 'ai_verified' ||
      (input.provenanceEntry as { normalizedSource?: string })
        .normalizedSource === 'AI_VERIFIED' ||
      ((input.provenanceEntry as { pricingEligible?: boolean })
        .pricingEligible === true &&
        (input.provenanceEntry as { independentVisionAgreement?: boolean })
          .independentVisionAgreement === true));
  const fromPlanSymbols =
    electricalKey &&
    !fromInstanceTags &&
    !aiVerified &&
    (evidenceKind === 'symbols' ||
      source.includes('calculated_from_symbols') ||
      source.includes('symbol'));
  const electricalReview =
    Boolean(input.hasConflict) ||
    aiInferred ||
    (electricalKey &&
      (fromPlanSymbols ||
        source.includes('needs_review') ||
        (typeof input.provenanceEntry === 'object' &&
          input.provenanceEntry != null &&
          Number(
            (input.provenanceEntry as { confidenceTier?: number })
              .confidenceTier
          ) >= 2 &&
          !fromInstanceTags &&
          !methodsAgree &&
          !aiVerified)));
  return {
    hasExplicitPlanSource:
      !input.hasConflict &&
      (input.key === 'floorAreaSqft' ||
        input.key === 'garageSqft' ||
        input.key === 'deckSqft' ||
        (paintingKey && fromPlan && !fromGeometry && !incomplete) ||
        (plumbingKey &&
          fromPlan &&
          !derivedFromFixtureInventory &&
          !architecturalLineSegment) ||
        (framingKey &&
          fromPlan &&
          (input.key === 'framedAreaSqft' ||
            input.key === 'sheathingSqft' ||
            input.key === 'floorAreaSqft' ||
            input.key === 'garageSqft')) ||
        (electricalKey &&
          !aiInferred &&
          !aiVerified &&
          (fromInstanceTags || (fromPlan && !electricalReview)))),
    hasReliableDimensions:
      !input.hasConflict &&
      (input.key === 'kitchenFloorSqft' ||
        input.key === 'bathroomFloorSqft' ||
        (paintingKey && fromGeometry && !incomplete)),
    roomDependent:
      input.key === 'kitchenFloorSqft' ||
      input.key === 'bathroomFloorSqft' ||
      incomplete ||
      electricalReview,
    fromPlanSymbols: !input.hasConflict && fromPlanSymbols,
    aiVerified: !input.hasConflict && aiVerified,
    aiInferred: !input.hasConflict && aiInferred,
  };
}

export function buildPlanReviewMeasurementRowState(input: {
  key: string;
  provenanceEntry?: unknown;
  fieldConfidence?: number | null;
  hasConflict?: boolean;
  reconciliationVariancePercent?: number | null;
  userConfirmed?: boolean;
  validationField?: {
    status?: string;
    pricingEligible?: boolean;
    reason?: string;
    deterministicRepeatedImportStable?: boolean;
  } | null;
  tradeKey?: string | null;
}): {
  pricingEligible: boolean;
  provenance: PlanMeasurementProvenance;
  includeDefault: boolean;
} {
  const pricingEligible =
    input.tradeKey === 'electrical'
      ? electricalPlanQuantityPricingEligible(
          input.key,
          input.provenanceEntry,
          input.validationField
        )
      : typeof input.provenanceEntry === 'object' &&
          input.provenanceEntry != null &&
          (input.provenanceEntry as { pricingEligible?: boolean })
            .pricingEligible === false
        ? false
        : true;
  const provenanceFlags = planReviewProvenanceFlags({
    key: input.key,
    provenanceEntry: input.provenanceEntry,
    hasConflict: input.hasConflict,
    pricingEligible,
  });
  const provenance = resolvePlanMeasurementProvenance({
    key: input.key,
    fieldConfidence: input.fieldConfidence ?? null,
    hasExplicitPlanSource: provenanceFlags.hasExplicitPlanSource,
    hasReliableDimensions: provenanceFlags.hasReliableDimensions,
    roomDependent: provenanceFlags.roomDependent,
    fromPlanSymbols: provenanceFlags.fromPlanSymbols,
    aiVerified: provenanceFlags.aiVerified,
    aiInferred: provenanceFlags.aiInferred,
    reconciliationVariancePercent: input.reconciliationVariancePercent,
    userConfirmed: input.userConfirmed,
    pricingEligible,
  });
  const displayProvenance =
    input.tradeKey === 'insulation'
      ? {
          ...provenance,
          label:
            provenance.status === 'calculated'
              ? 'Calculated'
              : provenance.status === 'planning_estimate'
                ? 'Suggested'
                : provenance.status === 'needs_review' ||
                    provenance.status === 'ai_inferred' ||
                    provenance.status === 'from_plan_symbols'
                  ? 'Needs confirmation'
                  : provenance.status === 'ai_verified' ||
                      provenance.status === 'plan_verified'
                    ? 'Detected'
                    : provenance.label,
        }
      : provenance;
  return {
    pricingEligible,
    provenance: displayProvenance,
    includeDefault:
      !input.hasConflict &&
      (pricingEligible ||
        input.validationField?.deterministicRepeatedImportStable === false ||
        input.tradeKey === 'electrical' ||
        input.tradeKey === 'plumbing' ||
        input.tradeKey === 'framing' ||
        input.tradeKey === 'drywall'),
  };
}

export function planReviewCheckboxBlockedMessage(
  provenance: PlanMeasurementProvenance,
  row: { label: string; value: string; unit: string }
): { title: string; message: string; confirmLabel: string } {
  const formatted = `${row.value} ${row.unit}`.trim();
  switch (provenance.status) {
    case 'from_plan_symbols':
      return {
        title: 'Confirm this count',
        message: `Use ${formatted} for ${row.label}? Symbol counts need confirmation before pricing.`,
        confirmLabel: `Use ${row.value}`,
      };
    case 'ai_inferred':
      return {
        title: 'Confirm this count',
        message: `Use ${formatted} for ${row.label}? This was inferred from context — confirm before pricing.`,
        confirmLabel: `Use ${row.value}`,
      };
    case 'needs_review':
    default:
      return {
        title: 'Confirm this count',
        message:
          provenance.reason ||
          `Confirm ${formatted} before including it in the bid.`,
        confirmLabel: `Use ${row.value}`,
      };
  }
}

function paintingQuantityNote(
  key: string,
  provenance?: Record<string, unknown> | null
): string | undefined {
  const entry = provenance?.[key];
  if (entry == null) return undefined;
  const s = provenanceSourceText(entry);
  if (
    (typeof entry === 'object' &&
      entry != null &&
      (entry as { coverage?: string }).coverage === 'incomplete') ||
    s.includes('incomplete')
  ) {
    return 'Partial room geometry — confirm';
  }
  if (
    s.includes('geometry') ||
    s.includes('measured_from_geometry') ||
    s.includes('calculated_from_plan')
  ) {
    return 'Calculated from plan geometry';
  }
  if (key === 'interiorDoorCount') {
    return s.includes('schedule') ? 'From door schedule' : 'From plan';
  }
  if (
    s.includes('explicit') ||
    s.includes('detected_from_plan') ||
    s === 'from_plan' ||
    s.includes('labeled')
  ) {
    return 'From plan';
  }
  return undefined;
}

/** Grouped Painting summary for Plan Review before Confirm Scope. */
export function buildPaintingPlanReviewSummary(
  measurements: Record<string, number | string | null | undefined>,
  provenance?: Record<string, unknown> | null
): PaintingPlanReviewLine[] {
  const lines: PaintingPlanReviewLine[] = [];
  const walls = positiveMeasurement(measurements.wallPaintSqft);
  const ceilings = positiveMeasurement(measurements.ceilingPaintSqft);
  const combined =
    positiveMeasurement(measurements.combinedPaintableAreaSqft) ??
    positiveMeasurement(measurements.paintAreaSqft);
  const doors = positiveMeasurement(measurements.interiorDoorCount);
  const trim = positiveMeasurement(measurements.baseboardLf);
  const cabinets =
    positiveMeasurement(measurements.cabinetRunLf) ??
    positiveMeasurement(measurements.cabinetPaintSqft);
  const exterior = positiveMeasurement(measurements.exteriorPaintSqft);
  const hasInterior =
    walls != null ||
    ceilings != null ||
    combined != null ||
    doors != null ||
    trim != null ||
    cabinets != null;

  if (hasInterior) {
    if (walls != null) {
      const note = paintingQuantityNote('wallPaintSqft', provenance);
      lines.push({
        label: 'Walls',
        value: `${formatSfWithCommas(walls)} sqft`,
        ...(note ? { note } : {}),
      });
    }
    if (ceilings != null) {
      const note = paintingQuantityNote('ceilingPaintSqft', provenance);
      lines.push({
        label: 'Ceilings',
        value: `${formatSfWithCommas(ceilings)} sqft`,
        ...(note ? { note } : {}),
      });
    }
    if (walls == null && ceilings == null && combined != null) {
      lines.push({
        label: 'Combined paintable area',
        value: `${formatSfWithCommas(combined)} sqft`,
        note: 'Choose combined or separate walls/ceilings in Confirm Scope',
      });
    }
    if (doors != null) {
      const note = paintingQuantityNote('interiorDoorCount', provenance);
      lines.push({
        label: 'Doors',
        value: `${formatSfWithCommas(doors)} EA`,
        ...(note ? { note } : {}),
      });
    }
    if (trim != null) {
      const note = paintingQuantityNote('baseboardLf', provenance);
      lines.push({
        label: 'Baseboard / trim',
        value: `${formatSfWithCommas(trim)} LF`,
        ...(note ? { note } : {}),
      });
    }
    if (cabinets != null) {
      const cabinetKey =
        positiveMeasurement(measurements.cabinetRunLf) != null
          ? 'cabinetRunLf'
          : 'cabinetPaintSqft';
      const note = paintingQuantityNote(cabinetKey, provenance);
      lines.push({
        label: 'Cabinet painting',
        value: `${formatSfWithCommas(cabinets)} ${cabinetKey === 'cabinetRunLf' ? 'LF' : 'sqft'}`,
        ...(note ? { note } : {}),
      });
    }
  }

  if (exterior != null) {
    const note = paintingQuantityNote('exteriorPaintSqft', provenance);
    lines.push({
      label: 'Exterior walls',
      value: `${formatSfWithCommas(exterior)} sqft`,
      ...(note ? { note } : {}),
    });
  }

  lines.push({
    label: 'Job condition',
    value: occupancyLabel(measurements.paintOccupancy),
  });
  lines.push({
    label: 'Application method',
    value: applicationLabel(measurements.paintApplicationMethod),
  });
  lines.push({
    label: 'Prep / masking',
    value: 'Needs confirmation',
  });

  return lines;
}

export type ElectricalPlanReviewLine = {
  label: string;
  value: string;
  note?: string | null;
};

const ELECTRICAL_CIRCUIT_KEYS = new Set([
  'standardCircuitCount',
  'dedicated20aCircuitCount',
  'circuit30aCount',
  'circuit40aCount',
  'circuit50aCount',
  'circuit60aPlusCount',
]);

function electricalConditionLabel(value: unknown): string {
  if (value === 'new_construction') return 'New construction / full rough';
  if (value === 'remodel_open_wall') return 'Remodel / open wall';
  if (value === 'finished_wall_service') return 'Finished-wall service';
  return 'Needs confirmation';
}

function electricalQuantityLabel(
  card: (typeof ELECTRICAL_CARDS)[number],
  quantity: number,
  measurements: Record<string, number | string | null | undefined>
): string {
  if (card.measurementKey === 'mainPanelCount') {
    const amps = positiveMeasurement(measurements.serviceAmperage);
    return amps != null
      ? `${formatSfWithCommas(quantity)} EA · ${amps}A`
      : `${formatSfWithCommas(quantity)} EA`;
  }
  if (card.unit === 'lf') return `${formatSfWithCommas(quantity)} LF`;
  return `${formatSfWithCommas(quantity)} EA`;
}

function electricalQuantityNote(
  key: string,
  provenance?: Record<string, unknown> | null
): string | undefined {
  const entry = provenance?.[key];
  if (
    entry &&
    typeof entry === 'object' &&
    (((entry as { status?: string }).status || '').toLowerCase() ===
      'ai_verified' ||
      (entry as { normalizedSource?: string }).normalizedSource ===
        'AI_VERIFIED')
  ) {
    return 'AI counted twice · full sheet coverage checked';
  }
  if (entry && typeof entry === 'object' && 'note' in entry) {
    const note = String((entry as { note?: unknown }).note || '').trim();
    if (note) return note;
  }
  const s = provenanceSourceText(entry);
  if (!s) return undefined;
  if (key === 'mainPanelCount' || key === 'serviceAmperage') {
    return 'From panel callout';
  }
  if (s.includes('inferred_from_context') || s.includes('ai inferred')) {
    return 'AI inferred — confirm';
  }
  if (s.includes('instance_tag') || s.includes('pdf_text')) {
    return 'Counted from instance tags';
  }
  if (s.includes('ai_verified')) {
    return 'AI counted twice · full sheet coverage checked';
  }
  if (
    s.includes('calculated_from_symbols') ||
    s.includes('needs_review') ||
    s.includes('symbol')
  ) {
    return 'From plan symbols';
  }
  if (key === 'gfciReceptacleCount' || key === 'standardReceptacleCount') {
    return 'From plan symbols';
  }
  if (s.includes('detected_from_plan') || s === 'from_plan') {
    return 'Counted from electrical plan';
  }
  return undefined;
}

export type ElectricalPlanReviewOptions = {
  unresolvedConflictFields?: Array<string | null | undefined> | null;
  unclassifiedFixtureCount?: number | string | null;
  unclassifiedFixtureNote?: string | null;
  electricalValidation?: {
    fields?: Record<
      string,
      { status?: string; pricingEligible?: boolean; reason?: string }
    >;
    priceableFields?: string[];
    blockedFields?: string[];
  } | null;
};

export function electricalPlanReadinessLine(input: {
  measurements: Record<string, unknown>;
  provenance?: Record<string, unknown> | null;
  conflicts?: Array<{ field?: string | null } | null> | null;
  unreadableFields?: Array<{ field?: string | null } | null> | null;
  unclassifiedFixtureCount?: number | string | null;
  validation?: ElectricalPlanReviewOptions['electricalValidation'];
}): { label: string; value: string; note: string } {
  const fields = input.validation?.fields || {};
  const priceable = new Set(
    input.validation?.priceableFields ||
      Object.entries(fields)
        .filter(([, field]) => field?.pricingEligible === true)
        .map(([key]) => key)
  );
  if (!priceable.size) {
    for (const key of Object.keys(input.measurements || {})) {
      if (electricalPlanQuantityPricingEligible(key, input.provenance?.[key])) {
        priceable.add(key);
      }
    }
  }
  const blocked = new Set(
    input.validation?.blockedFields ||
      Object.entries(fields)
        .filter(([, field]) => field?.pricingEligible !== true)
        .map(([key]) => key)
  );
  for (const key of Object.keys(input.measurements || {})) {
    if (!priceable.has(key)) blocked.add(key);
  }
  for (const conflict of input.conflicts || []) {
    const field = String(conflict?.field || '').trim();
    if (field) blocked.add(field);
  }
  for (const unreadable of input.unreadableFields || []) {
    const field = String(unreadable?.field || '').trim();
    if (field) blocked.add(field);
  }
  if (positiveMeasurement(input.unclassifiedFixtureCount) != null) {
    blocked.add('unclassifiedFixtureCount');
  }
  const statusFor = (key: string): string => {
    const validationStatus = fields[key]?.status;
    if (validationStatus) return String(validationStatus).toLowerCase();
    const entry = input.provenance?.[key];
    if (!entry || typeof entry !== 'object') return '';
    const record = entry as {
      status?: unknown;
      normalizedSource?: unknown;
      evidenceKind?: unknown;
    };
    const status = String(record.status || '').toLowerCase();
    if (status) return status;
    const source = String(record.normalizedSource || '').toLowerCase();
    if (
      source === 'from_plan' ||
      record.evidenceKind === 'instance_tags' ||
      record.evidenceKind === 'explicit_label'
    ) {
      return 'plan_verified';
    }
    return source === 'ai_verified' ? 'ai_verified' : '';
  };
  const statusKeys = new Set(
    [...Object.keys(fields), ...Object.keys(input.measurements || {})].filter(
      key => ELECTRICAL_PLAN_REVIEW_KEYS.has(key)
    )
  );
  const planVerified = [...statusKeys].filter(
    key => statusFor(key) === 'plan_verified'
  ).length;
  const aiVerified = [...statusKeys].filter(
    key => statusFor(key) === 'ai_verified'
  ).length;
  return {
    label: 'Electrical readiness',
    value: `${priceable.size} prices ready · ${blocked.size} to confirm`,
    note: `${planVerified} Plan verified · ${aiVerified} AI verified · conflicts and inferred quantities are not priced`,
  };
}

/** Grouped Electrical summary for Plan Review before Confirm Scope. */
export function buildElectricalPlanReviewSummary(
  measurements: Record<string, number | string | null | undefined>,
  provenance?: Record<string, unknown> | null,
  options?: ElectricalPlanReviewOptions | null
): ElectricalPlanReviewLine[] {
  const lines: ElectricalPlanReviewLine[] = [];
  const shownKeys = new Set<string>();
  const unresolved = new Set(
    (options?.unresolvedConflictFields || [])
      .map(field => String(field || '').trim())
      .filter(Boolean)
  );

  for (const group of ELECTRICAL_CARD_GROUPS) {
    for (const card of ELECTRICAL_CARDS) {
      if (card.groupId !== group.id) continue;
      if (card.measurementKey === 'serviceAmperage') continue;
      if (unresolved.has(card.measurementKey)) continue;
      const quantity = positiveMeasurement(measurements[card.measurementKey]);
      if (quantity == null) continue;
      shownKeys.add(card.measurementKey);
      const validation =
        options?.electricalValidation?.fields?.[card.measurementKey];
      const pricingEligible =
        validation?.pricingEligible ??
        (provenance?.[card.measurementKey] == null &&
        options?.electricalValidation == null
          ? true
          : electricalPlanQuantityPricingEligible(
              card.measurementKey,
              provenance?.[card.measurementKey]
            ));
      const note = pricingEligible
        ? electricalQuantityNote(card.measurementKey, provenance)
        : `${formatSfWithCommas(quantity)} EA visible — ${validation?.reason || 'Confirm before pricing'}`;
      lines.push({
        label: card.label,
        value: pricingEligible
          ? electricalQuantityLabel(card, quantity, measurements)
          : 'Needs confirmation',
        ...(note ? { note } : {}),
      });
    }
  }

  if (
    positiveMeasurement(measurements.serviceAmperage) != null &&
    !shownKeys.has('mainPanelCount') &&
    !shownKeys.has('panelUpgradeCount') &&
    !shownKeys.has('serviceUpgradeCount')
  ) {
    const serviceValidation =
      options?.electricalValidation?.fields?.serviceAmperage;
    const servicePricingEligible =
      serviceValidation?.pricingEligible ??
      (provenance?.serviceAmperage == null &&
      options?.electricalValidation == null
        ? true
        : electricalPlanQuantityPricingEligible(
            'serviceAmperage',
            provenance?.serviceAmperage
          ));
    lines.push({
      label: 'Service amperage',
      value: servicePricingEligible
        ? `${positiveMeasurement(measurements.serviceAmperage)}A`
        : 'Needs confirmation',
      ...(servicePricingEligible
        ? {}
        : {
            note:
              serviceValidation?.reason ||
              'Confirm the printed amperage before pricing',
          }),
    });
  }

  const hasCircuitCounts = [...ELECTRICAL_CIRCUIT_KEYS].some(
    key => positiveMeasurement(measurements[key]) != null
  );
  if (!hasCircuitCounts) {
    lines.push({
      label: 'Shared homeruns / unlabeled circuits',
      value: 'Needs confirmation',
      note: 'Device symbols do not invent circuit relationships',
    });
  }

  const conduit = positiveMeasurement(measurements.conduitLf);
  lines.push({
    label: 'Conduit',
    value:
      conduit != null
        ? `${formatSfWithCommas(conduit)} LF`
        : 'Needs confirmation',
  });
  const trench = positiveMeasurement(measurements.trenchingLf);
  lines.push({
    label: 'Trenching',
    value:
      trench != null
        ? `${formatSfWithCommas(trench)} LF`
        : 'Needs confirmation',
  });

  const detailed = hasDetailedElectricalQuantities(measurements);
  lines.push({
    label: 'Rough / trim packages',
    value: detailed
      ? 'Not auto-priced from detailed takeoff'
      : 'Needs confirmation',
  });
  lines.push({
    label: 'Job condition',
    value: electricalConditionLabel(measurements.electricalProjectCondition),
  });

  for (const field of unresolved) {
    if (shownKeys.has(field)) continue;
    // Unclassified fixtures are surfaced once in the dedicated block below.
    if (field === 'unclassifiedFixtureCount') continue;
    const card = electricalCardForMeasurementKey(field);
    lines.push({
      label: card?.label || measurementDisplayLabel(field).label,
      value: 'Needs confirmation',
      note: 'Conflicting plan readings',
    });
  }

  const unclassified = positiveMeasurement(options?.unclassifiedFixtureCount);
  if (unclassified != null || options?.unclassifiedFixtureNote) {
    lines.push({
      label: 'Unclassified lighting fixtures',
      value: 'Needs confirmation',
      note:
        options?.unclassifiedFixtureNote ||
        (unclassified != null
          ? `${formatSfWithCommas(unclassified)} EA visible — no symbol legend`
          : 'Visible on plan — no symbol legend'),
    });
  }

  return lines;
}

function positiveConflictReading(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Keep unresolved Electrical conflicts out of Detected quantities.
 * The priced map already omits them; do not promote selectedValue / the
 * first candidate until the contractor chooses.
 */
export function mergeElectricalConflictReadings(
  measurements: Record<string, number | string | null | undefined>,
  conflicts?: Array<{
    field?: string | null;
    selectedValue?: unknown;
    candidates?: Array<{ value?: unknown } | null> | null;
  }> | null,
  resolutions?: Record<string, number | string | null | undefined> | null
): Record<string, number | string | null | undefined> {
  const next = { ...measurements };
  for (const conflict of conflicts || []) {
    const field = String(conflict?.field || '').trim();
    if (!field) continue;
    const resolved = positiveConflictReading(resolutions?.[field]);
    if (resolved != null) {
      next[field] = resolved;
      continue;
    }
    delete next[field];
  }
  return next;
}

export function isElectricalPlanReviewStatusLine(line: {
  label: string;
  value: string;
}): boolean {
  return (
    line.value === 'Needs confirmation' ||
    line.value === 'Not auto-priced from detailed takeoff'
  );
}

export function electricalPlanReviewDetectedLines(
  lines: Array<{ label: string; value: string; note?: string | null }>
): Array<{ label: string; value: string; note?: string | null }> {
  return lines.filter(line => !isElectricalPlanReviewStatusLine(line));
}

export function electricalPlanReviewStatusLines(
  lines: Array<{ label: string; value: string; note?: string | null }>
): Array<{ label: string; value: string; note?: string | null }> {
  return lines.filter(isElectricalPlanReviewStatusLine);
}

function pageFromAssumptions(
  assumptions: string[] | null | undefined,
  patterns: RegExp[]
): number | null {
  for (const line of assumptions || []) {
    const text = String(line || '');
    if (!patterns.some(p => p.test(text))) continue;
    const match =
      text.match(/pages?\s*(\d+)(?:\s*[–-]\s*(\d+))?/i) ||
      text.match(/sheet\s*(\d+)/i);
    if (match) return Number(match[1]);
  }
  return null;
}

function pageEndFromAssumptions(
  assumptions: string[] | null | undefined,
  patterns: RegExp[]
): number | null {
  for (const line of assumptions || []) {
    const text = String(line || '');
    if (!patterns.some(p => p.test(text))) continue;
    const match = text.match(/pages?\s*(\d+)\s*[–-]\s*(\d+)/i);
    if (match) return Number(match[2]);
  }
  return null;
}

export function measurementSourceLabel(input: {
  key: string;
  value?: number | null;
  livingSf?: number | null;
  assumptions?: string[] | null;
  sourceLabel?: string | null;
  sourcePage?: number | null;
  sourceType?: string | null;
}): string | null {
  if (!measurementSemanticsV1Enabled()) return null;
  if (input.sourceLabel) return input.sourceLabel;

  if (input.key === 'flooringSqft') {
    // Display label already carries the one explanation line for gross floor area.
    return null;
  }

  if (
    input.key === 'exteriorWallInsulationSqft' &&
    !(Number(input.value) > 0)
  ) {
    return 'No complete wall/opening takeoff detected — enter manually';
  }

  const page = input.sourcePage ?? null;

  if (
    input.key === 'floorAreaSqft' ||
    input.key === 'garageSqft' ||
    input.key === 'deckSqft'
  ) {
    const resolvedPage =
      page ??
      pageFromAssumptions(input.assumptions, [
        /building\s*areas?/i,
        /cover\s*sheet/i,
        /schedule/i,
        /living/i,
        /garage/i,
        /patio|porch|deck/i,
      ]);
    return formatPlanSourceLabel({ kind: 'cover_sheet', page: resolvedPage });
  }

  if (input.key === 'kitchenFloorSqft' || input.key === 'bathroomFloorSqft') {
    const resolvedPage =
      page ??
      pageFromAssumptions(input.assumptions, [
        /kitchen|bath|room|dimension|floor\s*plan/i,
      ]);
    return resolvedPage != null
      ? `Derived from room dimensions — page ${resolvedPage}`
      : 'Derived from room dimensions';
  }

  if (ELECTRICAL_PLAN_REVIEW_KEYS.has(input.key)) {
    const resolvedPage =
      page ??
      pageFromAssumptions(input.assumptions, [
        /electrical|panel|receptacle|switch|lighting|e\s*sheet/i,
      ]);
    return formatPlanSourceLabel({
      kind: 'electrical_plan',
      page: resolvedPage,
    });
  }

  if (!(Number(input.value) > 0)) return null;

  return formatPlanSourceLabel({
    kind: 'plan_generic',
    page: page ?? undefined,
  });
}

export function roomSourceLabel(input: {
  name: string;
  lengthFt?: number | null;
  widthFt?: number | null;
  assumptions?: string[] | null;
  sourceLabel?: string | null;
  sourcePage?: number | null;
}): string | null {
  if (!measurementSemanticsV1Enabled()) return null;
  if (input.sourceLabel) return input.sourceLabel;
  if (input.lengthFt != null && input.widthFt != null) {
    const page =
      input.sourcePage ??
      pageFromAssumptions(input.assumptions, [
        /room|dimension|floor\s*plan|pdf text/i,
      ]);
    return page != null
      ? `Derived from room dimensions — page ${page}`
      : 'Derived from room dimensions';
  }
  return formatPlanSourceLabel({ kind: 'plan_generic' });
}

function pageFromText(text: string | null | undefined): number | null {
  const match = String(text || '').match(/pages?\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function isGenericGroundUpEvidence(evidence: string): boolean {
  return /standard\s+for\s+ground-?up|standard\s+ground-?up\s+scope/i.test(
    evidence || ''
  );
}

export function scopeTakeoffStatusLines(input: {
  itemId: string;
  evidence?: string | null;
  hasRoofQuantity?: boolean;
  assumptions?: string[] | null;
  /** True when plan-derived room/floor SF exists (e.g. kitchen floor, rooms from page 4). */
  hasPlanFloorAreas?: boolean;
  /** True when both primary insulation surfaces are available for review. */
  hasInsulationPrimaryTakeoff?: boolean;
  /** True when both primary insulation surfaces were confirmed by the contractor. */
  insulationPrimaryConfirmed?: boolean;
  /** True when a drywall wall/ceiling surface quantity is available for review. */
  hasDrywallPrimaryTakeoff?: boolean;
  /** True when the contractor confirmed the drywall surface quantity. */
  drywallPrimaryConfirmed?: boolean;
}): string[] {
  if (!measurementSemanticsV1Enabled()) {
    return input.evidence ? [String(input.evidence)] : [];
  }

  const id = input.itemId;
  const evidence = String(input.evidence || '').trim();
  const lines: string[] = [];
  const status = missingStatusForScope(id);
  const isTileFlooring =
    id === 'tile_flooring' || id === 'flooring' || id === 'tile';

  if (id === 'mep_rough') {
    const page =
      pageFromText(evidence) ??
      pageFromAssumptions(input.assumptions, [/electrical|mep|plumbing|hvac/i]);
    lines.push(
      page != null
        ? `Electrical detected on page ${page}; plumbing and HVAC require trade review`
        : 'Electrical detected; plumbing and HVAC require trade review'
    );
  } else if (
    isTileFlooring &&
    (input.hasPlanFloorAreas || !isGenericGroundUpEvidence(evidence))
  ) {
    const page =
      pageFromText(evidence) ??
      pageFromAssumptions(input.assumptions, [
        /floor\s*plan|room|dimension|tile|flooring/i,
      ]);
    if (page != null || input.hasPlanFloorAreas) {
      lines.push(
        page != null
          ? `Floor areas detected from page ${page}`
          : 'Floor areas detected from plan'
      );
    } else if (evidence && !isGenericGroundUpEvidence(evidence)) {
      lines.push(evidence);
    } else {
      lines.push('Standard ground-up scope');
    }
  } else if (evidence) {
    lines.push(evidence);
  } else if (id === 'sitework' || id === 'excavation') {
    lines.push('Standard ground-up scope — needs site takeoff');
  } else if (id === 'foundation') {
    const page = pageFromAssumptions(input.assumptions, [/foundation/i]);
    lines.push(formatPlanSourceLabel({ kind: 'foundation_plan', page }));
  } else if (id === 'framing') {
    const page = pageFromAssumptions(input.assumptions, [/framing/i]);
    lines.push(formatPlanSourceLabel({ kind: 'framing_plan', page }));
  } else if (id === 'roofing') {
    const page = pageFromAssumptions(input.assumptions, [/roof/i]);
    lines.push(formatPlanSourceLabel({ kind: 'roof_geometry', page }));
  } else if (id === 'exterior' || id === 'exterior_finishes') {
    const page = pageFromAssumptions(input.assumptions, [/elevation/i]);
    const pageEnd = pageEndFromAssumptions(input.assumptions, [/elevation/i]);
    lines.push(formatPlanSourceLabel({ kind: 'elevations', page, pageEnd }));
  } else {
    lines.push('Standard ground-up scope');
  }

  let statusLine: string | null = null;
  if (id === 'sitework' || id === 'excavation') {
    statusLine = evidence || lines.length ? 'Needs site takeoff' : null;
    if (!evidence && lines[0]?.includes('needs site takeoff'))
      statusLine = null;
  } else if (id === 'foundation') {
    statusLine = 'Needs structural takeoff';
  } else if (id === 'framing') {
    statusLine =
      'Benchmark pricing available — detailed takeoff still required';
  } else if (id === 'roofing') {
    statusLine = input.hasRoofQuantity ? null : 'Needs roof geometry takeoff';
  } else if (id === 'mep_rough') {
    statusLine = 'Needs trade counts / installed-package pricing';
  } else if (isTileFlooring) {
    statusLine = 'Needs finish allocation and material-specific takeoff';
  } else if (id === 'exterior' || id === 'exterior_finishes') {
    statusLine = 'Needs exterior wall and opening takeoff';
  } else if (id === 'insulation') {
    statusLine = input.insulationPrimaryConfirmed
      ? 'Whole-house insulation takeoff confirmed'
      : input.hasInsulationPrimaryTakeoff
        ? 'Insulation takeoff ready for review — confirm wall and ceiling quantities'
        : 'Needs wall and ceiling takeoff';
  } else if (id === 'drywall') {
    statusLine = input.drywallPrimaryConfirmed
      ? 'Drywall wall and ceiling takeoff confirmed'
      : input.hasDrywallPrimaryTakeoff
        ? 'Drywall takeoff ready for review — confirm wall and ceiling quantity'
        : 'Needs wall and ceiling takeoff';
  } else if (
    id === 'cabinets_counters' ||
    id === 'cabinets' ||
    id === 'countertops'
  ) {
    statusLine = 'Needs cabinet LF/count and countertop SF';
  } else if (id === 'appliances') {
    statusLine = 'Needs appliance count';
  } else if (
    status === 'needs_takeoff' ||
    status === 'needs_structural_takeoff' ||
    status === 'needs_count'
  ) {
    statusLine = measurementStatusLabel(status);
  }

  const joinedLower = lines.join(' ').toLowerCase();
  if (
    statusLine &&
    !joinedLower.includes(statusLine.toLowerCase().slice(0, 18))
  ) {
    lines.push(statusLine);
  }
  return lines.filter(Boolean);
}

export function resolvePlanAreaReconciliation(input: {
  areaReconciliation?: AreaReconciliation | null;
  measurements?: Record<string, number | string | null> | null;
  rooms?: Array<{ name?: string | null; areaSqft?: number | null }> | null;
}): AreaReconciliation {
  if (input.areaReconciliation) return input.areaReconciliation;
  return buildAreaReconciliation({
    declaredLivingSf: Number(input.measurements?.floorAreaSqft) || null,
    declaredGarageSf: Number(input.measurements?.garageSqft) || null,
    patioDeckSf: Number(input.measurements?.deckSqft) || null,
    rooms: input.rooms || [],
  });
}

/**
 * Display-only living status. Net detected rooms ≠ gross declared living SF is
 * incomplete room coverage — not a "material variance" between authoritative totals.
 */
export function livingReconciliationStatusLabel(
  recon: AreaReconciliation
): string {
  const unassigned = recon.unassignedLivingSf;
  if (unassigned != null && unassigned > 0.05) {
    return `Room detection incomplete — ${formatSf(unassigned)} SF not assigned`;
  }
  if (recon.status === 'reconciled') return 'Reconciled';
  if (
    recon.livingVariancePercent != null &&
    Math.abs(recon.livingVariancePercent) <= 3
  ) {
    return 'Reconciled';
  }
  return 'Partial room coverage — review missing spaces';
}

/**
 * Display-only garage status. Thresholds unchanged (≤3 reconciled, ≤10 review band).
 */
export function garageReconciliationStatusLabel(
  recon: AreaReconciliation
): string {
  const pct = recon.garageVariancePercent;
  if (pct == null) return 'Needs review';
  const abs = Math.abs(pct);
  if (abs <= 3) return 'Reconciled';
  if (abs <= 10) return 'Minor unreconciled area';
  return 'Needs review';
}

/** @deprecated Prefer living/garage-specific helpers — kept for call-site migration. */
export function varianceStatusLabel(
  status: AreaReconciliation['status'],
  kind: 'living' | 'garage'
): string {
  if (kind === 'living') {
    return status === 'reconciled'
      ? 'Reconciled'
      : 'Partial room coverage — review missing spaces';
  }
  if (status === 'reconciled') return 'Reconciled';
  if (status === 'review') return 'Minor unreconciled area';
  return 'Needs review';
}

export function applyPlanTakeoffButtonLabel(input: {
  includedMeasurementCount: number;
  checkedScopeCount: number;
  semanticsEnabled?: boolean;
}): string {
  const { includedMeasurementCount, checkedScopeCount } = input;
  const semantics =
    input.semanticsEnabled != null
      ? input.semanticsEnabled
      : measurementSemanticsV1Enabled();
  if (includedMeasurementCount > 0 && checkedScopeCount > 0) {
    return semantics ? 'Apply plan takeoff' : 'Apply to bid';
  }
  if (includedMeasurementCount > 0) {
    return `Apply ${includedMeasurementCount} measurement${includedMeasurementCount === 1 ? '' : 's'}`;
  }
  if (checkedScopeCount > 0) {
    return `Add ${checkedScopeCount} scope item${checkedScopeCount === 1 ? '' : 's'}`;
  }
  return 'Nothing selected';
}

/** Short Job notes prefill after plan import when the user has not typed notes yet. */
export function buildPlanReadyJobNotesPrompt(input: {
  livingSf?: number | null;
  measurementCount?: number;
  spaceCount?: number;
  scopeCount?: number;
  tradeLabel?: string | null;
}): string {
  const stats = input.tradeLabel
    ? importedTradePlanSummaryCollapsedSubtitle({
        measurementCount: input.measurementCount,
        scopeCount: input.scopeCount,
      })
    : importedPlanSummaryCollapsedSubtitle({
        livingSf: input.livingSf,
        spaceCount: input.spaceCount,
        scopeCount: input.scopeCount,
      });
  const meas = Number(input.measurementCount) || 0;
  const measBit =
    meas > 0
      ? `${meas} ${input.tradeLabel ? 'plan quantity' : 'project measurement'}${meas === 1 ? '' : 's'}`
      : null;
  const detail = stats || measBit;
  const detailSentence = detail ? ` ${detail}.` : '';
  if (input.tradeLabel) {
    return (
      `${input.tradeLabel} plan imported and ready to generate.${detailSentence} ` +
      `Tap "Generate ${input.tradeLabel} Estimate Draft" below to build the trade scope. ` +
      'Add any extra job details here (allowances, finishes, client notes).'
    );
  }
  return (
    `Ground-up new construction plan imported and ready to generate.${detailSentence} ` +
    'Tap "Generate Estimate Draft" below to build your scope draft. ' +
    'Add any extra job details here (allowances, finishes, client notes).'
  );
}

/** True when Step 1 plan takeoff looks like a whole-home / new-build set. */
export function planImportLooksLikeGroundUp(
  planImport:
    | {
        measurements?: Record<
          string,
          string | number | null | undefined
        > | null;
        rooms?: Array<{ name?: string; areaSqft?: number | null }> | null;
        buildingAreas?: {
          mainFloorLivingSqft?: number | null;
          garageSqft?: number | null;
        } | null;
        planFacts?: {
          buildingAreas?: {
            mainFloorLivingSqft?: number | null;
            garageSqft?: number | null;
          };
        } | null;
        scopeDetections?: Array<{ itemId?: string }> | null;
        estimatingMode?: 'whole_project' | 'selected_trade' | null;
      }
    | null
    | undefined
): boolean {
  if (!planImport) return false;
  if (planImport.estimatingMode === 'selected_trade') return false;
  const rooms = planImport.rooms?.length || 0;
  const living =
    Number(planImport.measurements?.floorAreaSqft) ||
    Number(planImport.buildingAreas?.mainFloorLivingSqft) ||
    Number(planImport.planFacts?.buildingAreas?.mainFloorLivingSqft) ||
    0;
  const garage =
    Number(planImport.measurements?.garageSqft) ||
    Number(planImport.buildingAreas?.garageSqft) ||
    Number(planImport.planFacts?.buildingAreas?.garageSqft) ||
    0;
  const structuralHits = (planImport.scopeDetections || []).filter(d =>
    /^(foundation|framing|roofing|sitework|excavation|exterior|mep_rough|pour_flatwork|utility_taps)$/i.test(
      String(d.itemId || '')
    )
  ).length;
  return (
    rooms >= 4 ||
    structuralHits >= 2 ||
    (living >= 800 && rooms >= 2) ||
    (living >= 800 && garage > 0)
  );
}

/**
 * Ensure Generate uses ground-up classification when a whole-home plan is attached.
 * Does not replace user-authored remodel language.
 */
export function ensureGroundUpPlanNotes(
  notes: string,
  planImportLooksGroundUp: boolean
): string {
  const text = String(notes || '').trim();
  if (!planImportLooksGroundUp) return text;
  if (
    /\b(ground[\s-]?up|new\s+construction|new\s+build|new\s+home|custom\s+home)\b/i.test(
      text
    )
  ) {
    return text;
  }
  if (
    /\b(remodel|renovation|renovate|selective\s+demo|tear[\s-]?out)\b/i.test(
      text
    )
  ) {
    return text;
  }
  const prefix =
    'Ground-up new construction from imported architectural plans.';
  return text ? `${prefix}\n${text}` : prefix;
}

export function importedPlanSummaryCollapsedSubtitle(input: {
  livingSf?: number | null;
  spaceCount?: number;
  scopeCount?: number;
}): string {
  const bits: string[] = [];
  const living = Number(input.livingSf);
  if (Number.isFinite(living) && living > 0) {
    bits.push(`${formatSfWithCommas(living)} SF`);
  }
  if (input.spaceCount) {
    bits.push(
      `${input.spaceCount} detected space${input.spaceCount === 1 ? '' : 's'}`
    );
  }
  if (input.scopeCount) {
    bits.push(
      `${input.scopeCount} scope item${input.scopeCount === 1 ? '' : 's'}`
    );
  }
  return bits.join(' · ');
}

/** Trade-only plan summary — no living SF or room counts. */
export function importedTradePlanSummaryCollapsedSubtitle(input: {
  measurementCount?: number;
  scopeCount?: number;
}): string {
  const bits: string[] = [];
  const meas = Number(input.measurementCount) || 0;
  if (meas > 0) {
    bits.push(`${meas} plan quantit${meas === 1 ? 'y' : 'ies'}`);
  }
  if (input.scopeCount) {
    bits.push(
      `${input.scopeCount} scope item${input.scopeCount === 1 ? '' : 's'}`
    );
  }
  return bits.join(' · ');
}

/** Strip generated plan-takeoff blobs so Job notes stay user-editable. */
export function stripPlanTakeoffFromNotes(notes: string): string {
  const text = String(notes || '');
  if (!text.trim()) return '';
  const stripped = text
    .replace(/\n*---\s*Plan takeoff\s*---[\s\S]*?(?=\n---\s|\s*$)/gi, '')
    .replace(
      /(?:^|\n)(?:Ground-up new construction|[^.\n]+) plan imported and ready to generate\.[\s\S]*?Add any extra job details here \(allowances, finishes, client notes\)\.?/gi,
      ''
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return stripped;
}

export function buildImportedPlanSummaryText(input: {
  notesBlock?: string | null;
  measurements?: Record<string, string | number | null> | null;
  rooms?: Array<{ name: string; areaSqft: number | null }> | null;
  scopeLabels?: string[] | null;
}): string {
  if (input.notesBlock?.trim()) return input.notesBlock.trim();
  const lines: string[] = ['--- Plan takeoff ---'];
  const living = Number(input.measurements?.floorAreaSqft);
  const garage = Number(input.measurements?.garageSqft);
  const deck = Number(input.measurements?.deckSqft);
  if (Number.isFinite(living) && living > 0) {
    lines.push(
      `Total living area is ${living} sqft` +
        (Number.isFinite(garage) && garage > 0
          ? ` with a garage area of ${garage} sqft`
          : '') +
        (Number.isFinite(deck) && deck > 0
          ? ` and a covered patio of ${deck} sqft`
          : '') +
        '.'
    );
  }
  if (input.rooms?.length) {
    lines.push('Room measurements:');
    for (const room of input.rooms) {
      if (room.areaSqft != null)
        lines.push(`- ${room.name}: ${room.areaSqft} sqft`);
    }
  }
  if (input.scopeLabels?.length) {
    lines.push('Suggested scope from plans:');
    lines.push(input.scopeLabels.join(', '));
  }
  return lines.join('\n');
}

export function formatSf(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
}

export function formatSfWithCommas(n: number | null | undefined): string {
  const raw = formatSf(n);
  if (raw === '—') return raw;
  const [whole, frac] = raw.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac != null ? `${withCommas}.${frac}` : withCommas;
}

export const PLUMBING_FIXTURE_INVENTORY_LABELS: Record<string, string> = {
  toilets: 'Toilets',
  lavatories: 'Lavatories',
  showers: 'Showers',
  tubs: 'Tub / tub-shower',
  kitchenSinks: 'Kitchen sink',
  dishwasherConnections: 'Dishwasher connection',
  laundryBoxes: 'Laundry / washer box',
  hoseBibs: 'Hose bibs',
  floorDrains: 'Floor drains',
  waterHeaters: 'Water heaters',
  gasAppliances: 'Gas appliances',
};

export const PLUMBING_FIXTURE_INVENTORY_ORDER = [
  'toilets',
  'lavatories',
  'showers',
  'tubs',
  'kitchenSinks',
  'dishwasherConnections',
  'laundryBoxes',
  'hoseBibs',
  'floorDrains',
  'waterHeaters',
  'gasAppliances',
] as const;

/** Rough/trim fixture connections — excludes WH and gas appliance inventory keys. */
export const PLUMBING_FIXTURE_CONNECTION_KEYS = [
  'toilets',
  'lavatories',
  'showers',
  'tubs',
  'kitchenSinks',
  'dishwasherConnections',
  'laundryBoxes',
  'hoseBibs',
  'floorDrains',
] as const;

export function plumbingFixtureInventoryLabel(key: string): string {
  return (
    PLUMBING_FIXTURE_INVENTORY_LABELS[key] ||
    String(key)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, value => value.toUpperCase())
  );
}

export function sumPlumbingFixtureInventoryPoints(
  inventory: Record<string, number> | null | undefined
): number {
  let total = 0;
  for (const key of PLUMBING_FIXTURE_CONNECTION_KEYS) {
    const count = Number(inventory?.[key]);
    if (Number.isFinite(count) && count > 0) total += Math.round(count);
  }
  return total;
}

export function resolvePlumbingFixturesHardwareCount(
  measurements: Record<string, number | string>,
  inventory: Record<string, number> | null | undefined,
  waterHeaterDetail?: PlumbingWaterHeaterDetail | null
): number {
  const trim = Number(measurements.plumbingTrimHookupCount);
  const rough = Number(measurements.plumbingRoughPointCount);
  const scheduleCount =
    Number.isFinite(trim) && trim > 0 && Number.isFinite(rough) && rough > 0
      ? Math.min(trim, rough)
      : Number.isFinite(trim) && trim > 0
        ? trim
        : Number.isFinite(rough) && rough > 0
          ? rough
          : 0;
  if (scheduleCount > 0) return scheduleCount;

  const fromInventory = sumPlumbingFixturesHardwareCount(inventory);
  const explicit = Number(measurements.plumbingFixturesHardwareCount);
  const whCount = resolvePlumbingWaterHeaterCount(inventory, waterHeaterDetail);
  const raw =
    (Number.isFinite(explicit) && explicit > 0 ? explicit : 0) || fromInventory;
  if (raw <= 0) return 0;
  if (whCount > 0 && raw > whCount && raw <= whCount + 2) {
    return Math.max(1, raw - whCount);
  }
  return raw;
}

export function resolvePlumbingGasApplianceConnectionCount(
  scope: PlumbingGasApplianceScope | null | undefined,
  inventory?: Record<string, number> | null
): number {
  const fromScope = countPlumbingGasApplianceConnections(scope);
  const fromInventory = Number(inventory?.gasAppliances);
  if (fromScope > 0 && Number.isFinite(fromInventory) && fromInventory > 0) {
    return Math.max(fromScope, Math.round(fromInventory));
  }
  if (fromScope > 0) return fromScope;
  if (Number.isFinite(fromInventory) && fromInventory > 0) {
    return Math.round(fromInventory);
  }
  return 0;
}

export const PLUMBING_FIXTURE_HARDWARE_KEYS = [
  'toilets',
  'lavatories',
  'showers',
  'tubs',
  'kitchenSinks',
  'dishwasherConnections',
  'laundryBoxes',
  'hoseBibs',
  'floorDrains',
] as const;

export function sumPlumbingFixturesHardwareCount(
  inventory: Record<string, number> | null | undefined
): number {
  let total = 0;
  for (const key of PLUMBING_FIXTURE_HARDWARE_KEYS) {
    const count = Number(inventory?.[key]);
    if (Number.isFinite(count) && count > 0) total += Math.round(count);
  }
  return total;
}

export function countPlumbingGasApplianceConnections(
  scope: PlumbingGasApplianceScope | null | undefined
): number {
  if (!scope) return 0;
  let total = 0;
  for (const key of ['range', 'fireplace', 'dryer', 'grill'] as const) {
    if (scope[key]) total += 1;
  }
  return total;
}

export function resolvePlumbingWaterHeaterCount(
  inventory: Record<string, number> | null | undefined,
  waterHeaterDetail?: PlumbingWaterHeaterDetail | null
): number {
  const fromInventory = Number(inventory?.waterHeaters);
  if (Number.isFinite(fromInventory) && fromInventory > 0) {
    return Math.round(fromInventory);
  }
  if (!waterHeaterDetail) return 0;
  return Math.max(1, Number(waterHeaterDetail.count) || 1);
}

function hasGasAppliancesComplexityFactor(
  complexityFactors?: Array<{
    key?: string | null;
    label?: string | null;
  }> | null
): boolean {
  return (complexityFactors || []).some(factor => {
    const key = String(factor?.key || '').trim();
    const label = String(factor?.label || '').trim();
    return (
      key === 'gas_appliances' || /\bgas\s*appliance/i.test(`${key} ${label}`)
    );
  });
}

/** Expand partial gas scope to the standard production-home trio when gas piping is documented. */
export function expandResidentialGasApplianceScope(
  scope: PlumbingGasApplianceScope | null | undefined,
  options?: {
    measurements?: Record<string, number | string>;
    complexityFactors?: Array<{
      key?: string | null;
      label?: string | null;
    }> | null;
  }
): PlumbingGasApplianceScope | null {
  const normalized = scope || null;
  const gasLf = Number(options?.measurements?.gasLineLf);
  const count = countPlumbingGasApplianceConnections(normalized);
  if (count >= 3) return normalized;

  const hasGasPiping =
    Boolean(normalized?.gasPipingRequired) ||
    (Number.isFinite(gasLf) && gasLf >= 20);
  if (!hasGasPiping) return normalized;

  return {
    ...(normalized || {}),
    gasPipingRequired: true,
    range: true,
    fireplace: true,
    dryer: true,
  };
}

function inferPlumbingWaterHeaterFromGasPiping(params: {
  inventory?: Record<string, number> | null;
  waterHeaterDetail?: PlumbingWaterHeaterDetail | null;
  gasApplianceScope?: PlumbingGasApplianceScope | null;
  measurements?: Record<string, number | string>;
}): PlumbingWaterHeaterDetail | null {
  const whFromInventory = Number(params.inventory?.waterHeaters);
  if (Number.isFinite(whFromInventory) && whFromInventory > 0) {
    return {
      count: Math.round(whFromInventory),
      ...(params.waterHeaterDetail || {}),
    };
  }
  if (params.waterHeaterDetail) return params.waterHeaterDetail;
  const gasLf = Number(params.measurements?.gasLineLf);
  const gasScope = params.gasApplianceScope;
  if (
    !(Number.isFinite(gasLf) && gasLf >= 20) &&
    !gasScope?.gasPipingRequired
  ) {
    return null;
  }
  return { count: 1, fuel: 'gas' };
}

/** Fill rough/trim counts from fixture inventory when vision omitted canonical keys. */
export function hydratePlumbingPlanMeasurementsFromInventory(
  measurements: Record<string, number | string>,
  inventory: Record<string, number> | null | undefined,
  options?: {
    waterHeaterDetail?: PlumbingWaterHeaterDetail | null;
    gasApplianceScope?: PlumbingGasApplianceScope | null;
    complexityFactors?: Array<{
      key?: string | null;
      label?: string | null;
    }> | null;
  }
): Record<string, number | string> {
  let waterHeaterDetail = options?.waterHeaterDetail ?? null;
  let gasApplianceScope = options?.gasApplianceScope ?? null;
  const whFromInventory = Number(inventory?.waterHeaters);
  if (Number.isFinite(whFromInventory) && whFromInventory > 0) {
    waterHeaterDetail = {
      count: Math.round(whFromInventory),
      ...(waterHeaterDetail || {}),
    };
  }
  for (const factor of options?.complexityFactors || []) {
    const key = String(factor?.key || '').trim();
    const label = String(factor?.label || '').trim();
    const blob = `${key} ${label}`.trim();
    if (!blob) continue;
    if (key === 'tankless_water_heater' || /\btankless\b/i.test(blob)) {
      waterHeaterDetail = {
        ...waterHeaterDetail,
        count: Math.max(1, Number(waterHeaterDetail?.count) || 1),
        type: waterHeaterDetail?.type || 'tankless',
      };
    } else if (/\bwater\s*heater\b/i.test(blob) && key !== 'gas_appliances') {
      waterHeaterDetail = {
        ...waterHeaterDetail,
        count: Math.max(1, Number(waterHeaterDetail?.count) || 1),
      };
    }
    if (key === 'gas_appliances' || /\bgas\s*appliance/i.test(blob)) {
      gasApplianceScope = {
        ...(gasApplianceScope || {}),
        gasPipingRequired: true,
        range:
          gasApplianceScope?.range ||
          /range|cooktop|oven/i.test(blob) ||
          undefined,
        fireplace:
          gasApplianceScope?.fireplace ||
          /fireplace|fire\s*place|gas\s*log|g\.?\s*f\.?|\bfp\b/i.test(blob) ||
          undefined,
        dryer:
          gasApplianceScope?.dryer ||
          /dryer|clothes\s*dryer/i.test(blob) ||
          undefined,
        grill:
          gasApplianceScope?.grill ||
          /grill|bbq|barbecue/i.test(blob) ||
          undefined,
      };
    }
  }
  gasApplianceScope = expandResidentialGasApplianceScope(gasApplianceScope, {
    measurements,
    complexityFactors: options?.complexityFactors,
  });
  waterHeaterDetail =
    inferPlumbingWaterHeaterFromGasPiping({
      inventory,
      waterHeaterDetail,
      gasApplianceScope,
      measurements,
    }) ?? waterHeaterDetail;
  const total = sumPlumbingFixtureInventoryPoints(inventory);
  const next = { ...measurements };
  if (total > 0) {
    if (!Number(next.plumbingRoughPointCount)) {
      next.plumbingRoughPointCount = total;
    }
    if (!Number(next.plumbingTrimHookupCount)) {
      next.plumbingTrimHookupCount = total;
    }
  }
  const resolvedFixtures = resolvePlumbingFixturesHardwareCount(
    next,
    inventory,
    waterHeaterDetail
  );
  if (resolvedFixtures > 0) {
    const existingFixtures = Number(next.plumbingFixturesHardwareCount);
    if (!existingFixtures || existingFixtures !== resolvedFixtures) {
      next.plumbingFixturesHardwareCount = resolvedFixtures;
    }
  }
  const waterHeaterCount = resolvePlumbingWaterHeaterCount(
    inventory,
    waterHeaterDetail
  );
  if (waterHeaterCount > 0 && !Number(next.waterHeaterCount)) {
    next.waterHeaterCount = waterHeaterCount;
  }
  const resolvedGasConnections = resolvePlumbingGasApplianceConnectionCount(
    gasApplianceScope,
    inventory
  );
  if (resolvedGasConnections > 0) {
    const existingGas = Number(next.gasApplianceConnectionCount);
    if (
      !Number.isFinite(existingGas) ||
      existingGas <= 0 ||
      resolvedGasConnections > existingGas
    ) {
      next.gasApplianceConnectionCount = resolvedGasConnections;
    }
  }
  return next;
}

const PLUMBING_EQUIPMENT_RECONCILE_CARDS = [
  {
    itemId: 'gas_appliance_connections',
    measurementKey: 'gasApplianceConnectionCount',
  },
  { itemId: 'water_heater', measurementKey: 'waterHeaterCount' },
  {
    itemId: 'plumbing_fixtures_hardware',
    measurementKey: 'plumbingFixturesHardwareCount',
  },
] as const;

type PlumbingPricingAcceptance = {
  selectionStatus?: string;
  materialAmount?: number;
  laborAmount?: number;
  totalAmount?: number;
};

function scaleAcceptedPricingForQuantity(
  acceptance: PlumbingPricingAcceptance,
  previousQty: number,
  nextQty: number
): PlumbingPricingAcceptance {
  if (!(nextQty > previousQty) || !(previousQty > 0)) return acceptance;
  const ratio = nextQty / previousQty;
  const material =
    acceptance.materialAmount != null
      ? Math.round(acceptance.materialAmount * ratio)
      : undefined;
  const labor =
    acceptance.laborAmount != null
      ? Math.round(acceptance.laborAmount * ratio)
      : undefined;
  const total =
    material != null && labor != null
      ? material + labor
      : acceptance.totalAmount != null
        ? Math.round(acceptance.totalAmount * ratio)
        : undefined;
  return {
    ...acceptance,
    materialAmount: material,
    laborAmount: labor,
    totalAmount: total,
  };
}

function isPlumbingScopeMeasurements(input: Record<string, unknown>): boolean {
  const templateKey = String(input.planImportTradeKey || '').toLowerCase();
  const checklistTemplate = String(input.templateKey || '').toLowerCase();
  return (
    templateKey === 'plumbing' ||
    checklistTemplate === 'plumbing' ||
    checklistTemplate === 'plumbing_service' ||
    Array.isArray(input.plumbingScope) ||
    Number(input.waterLineLf) > 0 ||
    Number(input.sewerLineLf) > 0 ||
    Number(input.gasLineLf) > 0 ||
    Number(input.gasApplianceConnectionCount) > 0 ||
    Number(input.plumbingRoughPointCount) > 0
  );
}

/** Upgrade equipment counts and rescale stale applied pricing on existing plumbing drafts. */
export function reconcilePlumbingEquipmentScopeMeasurements<
  T extends Record<string, unknown>,
>(input: T): T {
  if (!isPlumbingScopeMeasurements(input)) return input;

  const expandedScope = expandResidentialGasApplianceScope(
    (input.plumbingGasApplianceScope as PlumbingGasApplianceScope | null) ??
      null,
    {
      measurements: input as Record<string, number | string>,
      complexityFactors:
        (input.plumbingComplexityFactors as Array<{
          key?: string | null;
          label?: string | null;
        }> | null) ?? null,
    }
  );

  const hydrated = hydratePlumbingPlanMeasurementsFromInventory(
    input as Record<string, number | string>,
    (input.plumbingFixtureInventory as Record<string, number> | null) ?? null,
    {
      waterHeaterDetail:
        (input.plumbingWaterHeaterDetail as PlumbingWaterHeaterDetail | null) ??
        null,
      gasApplianceScope: expandedScope,
      complexityFactors:
        (input.plumbingComplexityFactors as Array<{
          key?: string | null;
          label?: string | null;
        }> | null) ?? null,
    }
  );

  const next = { ...input } as T & Record<string, unknown>;
  for (const key of [
    'plumbingRoughPointCount',
    'plumbingTrimHookupCount',
    'plumbingFixturesHardwareCount',
    'waterHeaterCount',
    'gasApplianceConnectionCount',
  ]) {
    const hydratedValue = Number(hydrated[key]);
    const existing = Number(next[key]);
    if (
      hydratedValue > 0 &&
      (!Number.isFinite(existing) || hydratedValue > existing)
    ) {
      next[key] = hydratedValue;
    }
  }
  if (expandedScope) {
    next.plumbingGasApplianceScope = expandedScope;
  }

  const itemQuantities = {
    ...((next.itemQuantities as Record<string, unknown>) || {}),
  };
  let pricingAcceptance = {
    ...((next.pricingAcceptance as Record<string, PlumbingPricingAcceptance>) ||
      {}),
  };
  let changed = false;

  for (const card of PLUMBING_EQUIPMENT_RECONCILE_CARDS) {
    const targetQty = Number(next[card.measurementKey]);
    if (!(targetQty > 0)) continue;

    const existingEntry = itemQuantities[card.itemId] as
      | { quantity?: string; unit?: string; quantitySource?: string }
      | undefined;
    const existingQty = Number(existingEntry?.quantity);
    const acceptance = pricingAcceptance[card.itemId];
    if (
      acceptance?.selectionStatus === 'manual_adjusted' ||
      acceptance?.selectionStatus === 'user_entered'
    ) {
      continue;
    }

    const needsQtyUpgrade = !(existingQty > 0) || targetQty > existingQty;
    const acceptedTotal =
      Number(acceptance?.totalAmount ?? 0) ||
      Number(acceptance?.materialAmount ?? 0) +
        Number(acceptance?.laborAmount ?? 0);
    const needsPricingRescale =
      Boolean(acceptance) &&
      acceptance?.selectionStatus === 'accepted' &&
      targetQty > 1 &&
      existingQty > 0 &&
      targetQty > existingQty &&
      acceptedTotal > 0;

    if (!needsQtyUpgrade && !needsPricingRescale) continue;

    itemQuantities[card.itemId] = {
      ...(existingEntry || {}),
      quantity: String(targetQty),
      unit: existingEntry?.unit || 'each',
      quantitySource:
        existingEntry?.quantitySource === 'user_entered'
          ? 'user_entered'
          : 'plan_detected',
    };
    changed = true;

    if (needsPricingRescale && acceptance) {
      pricingAcceptance[card.itemId] = scaleAcceptedPricingForQuantity(
        acceptance,
        existingQty,
        targetQty
      );
    }
  }

  if (changed) {
    next.itemQuantities = itemQuantities;
    next.pricingAcceptance = pricingAcceptance;
  }
  return next as T;
}

const PLUMBING_LINE_SCOPE_CARDS = PLUMBING_CARDS.filter(card =>
  ['water_line', 'sewer_line', 'gas_line'].includes(card.itemId)
);

/** Keep LF scope card quantities aligned with quick-measurement LF fields. */
export function reconcilePlumbingLineScopeMeasurements<
  T extends Record<string, unknown>,
>(input: T): T {
  if (!isPlumbingScopeMeasurements(input)) return input;

  const itemQuantities = {
    ...((input.itemQuantities as Record<string, unknown>) || {}),
  };
  let changed = false;

  for (const card of PLUMBING_LINE_SCOPE_CARDS) {
    const qmQty = Number(
      String(input[card.measurementKey] ?? '').replace(/,/g, '')
    );
    if (!(qmQty > 0)) continue;

    const existingEntry = itemQuantities[card.itemId] as
      | { quantity?: string; unit?: string; quantitySource?: string }
      | undefined;
    const existingQty = Number(
      String(existingEntry?.quantity ?? '').replace(/,/g, '')
    );
    if (Number.isFinite(existingQty) && Math.abs(existingQty - qmQty) < 0.01) {
      continue;
    }

    itemQuantities[card.itemId] = {
      ...(existingEntry || {}),
      quantity: String(qmQty),
      unit: 'lf',
      quantitySource:
        existingEntry?.quantitySource === 'user_entered'
          ? 'user_entered'
          : 'plan_detected',
    };
    changed = true;
  }

  if (!changed) return input;
  return { ...input, itemQuantities } as T;
}

export function plumbingInventoryDerivedProvenance(
  inventory: Record<string, number> | null | undefined,
  key: string
): Record<string, unknown> | undefined {
  if (
    key !== 'plumbingRoughPointCount' &&
    key !== 'plumbingTrimHookupCount' &&
    key !== 'plumbingFixturesHardwareCount' &&
    key !== 'waterHeaterCount' &&
    key !== 'gasApplianceConnectionCount'
  ) {
    return undefined;
  }
  const total =
    key === 'plumbingFixturesHardwareCount'
      ? sumPlumbingFixturesHardwareCount(inventory)
      : key === 'waterHeaterCount'
        ? resolvePlumbingWaterHeaterCount(inventory)
        : key === 'gasApplianceConnectionCount'
          ? 0
          : sumPlumbingFixtureInventoryPoints(inventory);
  if (!total) return undefined;
  const derivedFrom = PLUMBING_FIXTURE_INVENTORY_ORDER.filter(
    fixtureKey => Number(inventory?.[fixtureKey]) > 0
  );
  return {
    source: 'inferred_from_fixture_inventory',
    normalizedSource: 'FROM_PLAN_DERIVED',
    evidenceKind: 'fixture_inventory_derived',
    derivedFrom,
    pricingEligible: true,
    value: total,
  };
}

/** Contractor-facing unit for Plumbing plan review and Confirm Scope. */
export function plumbingMeasurementDisplayUnit(
  key: string,
  fallback = ''
): string {
  if (key === 'plumbingRoughPointCount' || key === 'plumbingTrimHookupCount') {
    return 'fixtures';
  }
  if (key === 'plumbingFixturesHardwareCount') return 'fixtures';
  if (key === 'waterHeaterCount' || key === 'gasApplianceConnectionCount') {
    return 'each';
  }
  if (key === 'waterLineLf' || key === 'sewerLineLf' || key === 'gasLineLf') {
    return 'LF';
  }
  return fallback || 'each';
}

export type PlumbingWaterHeaterDetail = {
  count?: number;
  type?: string | null;
  fuel?: string | null;
  location?: string | null;
  confidence?: number;
};

export type PlumbingGasApplianceScope = {
  range?: boolean;
  waterHeater?: boolean;
  fireplace?: boolean;
  dryer?: boolean;
  grill?: boolean;
  gasPipingRequired?: boolean;
  confidence?: number;
};

export function formatPlumbingWaterHeaterDetail(
  detail: PlumbingWaterHeaterDetail | null | undefined
): string | null {
  if (!detail) return null;
  const parts = [
    `${detail.count ?? 1} water heater${detail.count === 1 ? '' : 's'}`,
    detail.type,
    detail.fuel,
    detail.location,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function formatPlumbingGasApplianceScope(
  scope: PlumbingGasApplianceScope | null | undefined
): string[] {
  if (!scope) return [];
  const lines: string[] = [];
  const labels: Record<string, string> = {
    range: 'Range',
    waterHeater: 'Water heater',
    fireplace: 'Fireplace',
    dryer: 'Dryer',
    grill: 'Grill',
  };
  for (const [key, label] of Object.entries(labels)) {
    if (scope[key as keyof PlumbingGasApplianceScope]) {
      lines.push(`${label}: Yes`);
    }
  }
  if (scope.gasPipingRequired) {
    lines.push('Gas piping required: Yes · Length: Confirm');
  }
  return lines;
}

export function hydrateFramingPlanMeasurementsFromAreas<
  T extends Record<string, number | string>,
>(input: T): T {
  const next = { ...input } as T & Record<string, unknown>;
  const framed = resolveCoveredFramedAreaSqft(next);
  if (framed != null && framed > 0) {
    next.framedAreaSqft = framed;
  }
  const sheathing = resolveFramingSheathingSqft(next);
  if (sheathing != null && sheathing > 0) {
    next.sheathingSqft = sheathing;
  }
  return next as T;
}

function isFramingScopeMeasurements(input: Record<string, unknown>): boolean {
  const template = String(input.planImportTradeKey || '').toLowerCase();
  return (
    template === 'framing' ||
    Array.isArray(input.framingScope) ||
    Number(input.framedAreaSqft) > 0 ||
    Number(input.sheathingSqft) > 0 ||
    Number(input.wallFramingLf) > 0
  );
}

export function tagFramingDerivedQuickMeasurementSources(
  input: Record<string, unknown>
): Record<string, string> {
  const sources = {
    ...((input.quickMeasurementSources as Record<string, string> | undefined) ||
      {}),
  };
  const living = Number(input.floorAreaSqft);
  const garage = Number(input.garageSqft) || 0;
  const framed = Number(input.framedAreaSqft);
  const livingFromPlan =
    sources.floorAreaSqft === 'plan_detected' ||
    sources.floorAreaSqft === 'detected_from_plan' ||
    sources.floorAreaSqft === 'plan_verified';
  const garageFromPlan =
    sources.garageSqft === 'plan_detected' ||
    sources.garageSqft === 'detected_from_plan' ||
    sources.garageSqft === 'plan_verified';
  if (
    framed > 0 &&
    livingFromPlan &&
    (garage <= 0 || garageFromPlan) &&
    Math.abs(framed - (living + Math.max(0, garage))) < 1
  ) {
    sources.framedAreaSqft = 'plan_detected';
  } else if (framed > 0 && !sources.framedAreaSqft) {
    sources.framedAreaSqft = 'plan_detected';
  }
  const sheathing = Number(input.sheathingSqft);
  if (sheathing > 0 && !sources.sheathingSqft) {
    sources.sheathingSqft = 'plan_detected';
  }
  return sources;
}

export function framingQuickMeasurementSourceFromProvenance(
  entry: unknown
): QuickMeasurementSourceTag | null {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as {
    normalizedSource?: string;
    source?: string;
    status?: string;
  };
  const normalized = String(record.normalizedSource || '').toUpperCase();
  const source = String(record.source || record.status || '').toLowerCase();
  if (
    normalized === 'FROM_PLAN' ||
    normalized === 'PLAN_VERIFIED' ||
    source === 'detected_from_plan' ||
    source === 'plan_verified'
  ) {
    return 'plan_detected';
  }
  if (
    normalized === 'PLANNING_ESTIMATE' ||
    source === 'calculated_from_components' ||
    source === 'estimated_from_formula'
  ) {
    return 'plan_detected';
  }
  if (normalized === 'NEEDS_REVIEW' || source === 'needs_confirmation') {
    return 'needs_confirmation';
  }
  return null;
}

export function tagFramingQuickMeasurementSourcesFromProvenance(
  measurements: Record<string, unknown>,
  provenance?: Record<string, unknown> | null
): Record<string, string> {
  const sources = tagFramingDerivedQuickMeasurementSources(measurements);
  if (!provenance) return sources;
  for (const key of [
    'framedAreaSqft',
    'sheathingSqft',
    'floorAreaSqft',
    'garageSqft',
  ] as const) {
    if (!(Number(measurements[key]) > 0)) continue;
    const mapped = framingQuickMeasurementSourceFromProvenance(provenance[key]);
    if (mapped) sources[key] = mapped;
  }
  return sources;
}

/** Hydrate framing quantities, scope cards, and itemQuantities for Confirm Scope. */
export function reconcileFramingScopeMeasurements<
  T extends Record<string, unknown>,
>(input: T): T {
  if (!isFramingScopeMeasurements(input)) return input;

  const hydrated = hydrateFramingPlanMeasurementsFromAreas(
    input as Record<string, number | string>
  );
  let next = stripShellFramingComponentMeasurements({
    ...input,
    ...hydrated,
  }) as T & Record<string, unknown>;
  if (isShellFramingPackageBid(next)) {
    const itemQuantities = {
      ...((next.itemQuantities as Record<string, unknown>) || {}),
    };
    const sources = {
      ...((next.quickMeasurementSources as Record<string, string>) || {}),
    };
    for (const key of FRAMING_SHELL_COMPONENT_MEASUREMENT_KEYS) {
      if (!shouldStripShellFramingComponentMeasurement(next, key)) continue;
      delete next[key];
      delete sources[key];
    }
    for (const itemId of FRAMING_SHELL_COMPONENT_ITEM_IDS) {
      const card = FRAMING_CARDS.find(entry => entry.itemId === itemId);
      if (
        card &&
        shouldStripShellFramingComponentMeasurement(next, card.measurementKey)
      ) {
        delete itemQuantities[itemId];
      }
    }
    if (shellPackageIncludesSheathing(next)) {
      delete itemQuantities.shear_sheathing;
    }
    next.itemQuantities = itemQuantities;
    next.quickMeasurementSources = sources;
  }
  next.quickMeasurementSources = tagFramingDerivedQuickMeasurementSources(next);

  const structured = buildFramingStructuredMeasurements(next, 'plan_detected');
  if (structured.framingScope?.length) {
    next.framingScope = structured.framingScope;
  }
  if (structured.itemQuantities) {
    next.itemQuantities = {
      ...((next.itemQuantities as Record<string, unknown>) || {}),
      ...structured.itemQuantities,
    };
  }

  for (const card of FRAMING_CARDS) {
    if (
      isShellFramingPackageBid(next) &&
      ((card.itemId === 'shear_sheathing' &&
        shellPackageIncludesSheathing(next)) ||
        ((card.itemId === 'wall_framing' || card.itemId === 'openings') &&
          !shouldPreserveShellFramingComponentMeasurement(
            next,
            card.measurementKey
          )))
    ) {
      continue;
    }
    const qty = Number(next[card.measurementKey]);
    if (!(qty > 0)) continue;
    const existing = (
      next.itemQuantities as Record<string, { quantity?: unknown }>
    )?.[card.itemId];
    if (Number(existing?.quantity) > 0) continue;
    (next.itemQuantities as Record<string, unknown>)[card.itemId] = {
      quantity: String(qty),
      unit: card.unit,
      quantitySource: 'plan_detected',
    };
  }

  return next as T;
}

export function augmentFramingScopeDetections<
  T extends {
    itemId?: string | null;
    label?: string | null;
    evidence?: string | null;
  },
>(
  detections: T[],
  measurements: Record<string, number | string | null | undefined>
): T[] {
  const hydrated = hydrateFramingPlanMeasurementsFromAreas(measurements);
  const existing = new Set(
    detections.map(row => String(row.itemId || '').trim()).filter(Boolean)
  );
  const additions: T[] = [];
  const push = (itemId: string, label: string, evidence: string) => {
    if (existing.has(itemId)) return;
    additions.push({ itemId, label, evidence } as T);
    existing.add(itemId);
  };
  if (Number(hydrated.framedAreaSqft) > 0) {
    push(
      'framing',
      'Framing (lumber + labor)',
      `Covered framed area ${Number(hydrated.framedAreaSqft).toLocaleString()} SF`
    );
  }
  if (
    Number(hydrated.sheathingSqft) > 0 &&
    !shellPackageIncludesSheathing(measurements)
  ) {
    push(
      'shear_sheathing',
      'Sheathing / shear',
      `Sheathing area ${Number(hydrated.sheathingSqft).toLocaleString()} SF`
    );
  }
  if (
    Number(hydrated.wallFramingLf) > 0 &&
    !isShellFramingPackageBid(measurements)
  ) {
    push(
      'wall_framing',
      'Wall framing',
      `${Number(hydrated.wallFramingLf).toLocaleString()} LF wall framing`
    );
  }
  if (
    Number(hydrated.framingOpeningCount) > 0 &&
    !isShellFramingPackageBid(measurements)
  ) {
    push(
      'openings',
      'Door / window openings',
      `${Number(hydrated.framingOpeningCount)} documented openings`
    );
  }
  return [...detections, ...additions];
}

export function framingMeasurementDisplayUnit(
  key: string,
  fallback = ''
): string {
  const card = framingCardForMeasurementKey(key);
  if (!card) return fallback || 'sqft';
  if (card.unit === 'lf') return 'LF';
  if (card.unit === 'each') return 'each';
  if (card.unit === 'allowance') return 'allowance';
  return 'sqft';
}
