export type PlanMeasurementSourceType =
  | 'detected_from_plan'
  | 'ai_verified'
  | 'measured_from_geometry'
  | 'calculated_from_components'
  | 'estimated_from_formula'
  | 'fallback_multiplier'
  | 'user_entered'
  | 'needs_confirmation';

export type PlanMeasurementConfidence =
  'high' | 'medium' | 'low' | 'unresolved';

export type PlanEvidence = {
  page?: number | null;
  sheet?: string | null;
  label?: string | null;
  sourceText?: string | null;
  sourceType?: 'pdf_text' | 'plan_vision' | 'user' | 'unknown';
  confidence?: number | null;
  derivedFrom?: string[];
};

export type PlanPolygonPoint = { x: number; y: number };

/**
 * Optional geometry supplied by a future vector/CAD takeoff. The planning
 * engine consumes this when present, but never fabricates polygon points.
 */
export type PlanGeometryRegion = {
  id: string;
  kind:
    | 'living_footprint'
    | 'garage_footprint'
    | 'covered_patio'
    | 'roof_plane'
    | 'foundation'
    | 'courtyard'
    | 'detached_structure'
    | 'other';
  areaSqft?: number | null;
  perimeterLf?: number | null;
  pitch?: string | null;
  isRoofed?: boolean | null;
  isIncluded?: boolean | null;
  points?: PlanPolygonPoint[];
  evidence?: PlanEvidence[];
};

export type PlanBuildingAreas = {
  totalLivingSqft?: number | null;
  mainFloorLivingSqft?: number | null;
  upstairsLivingSqft?: number | null;
  additionalFloorAreas?: number[];
  garageSqft?: number | null;
  coveredPatioSqft?: number | null;
  coveredOutdoorSqft?: number | null;
  roofDeckSqft?: number | null;
};

export type PlanCeilingBoundary = {
  upperFloorAtticSqft?: number | null;
  mainFloorAtticExposureSqft?: number | null;
  vaultedOpenToBelowSqft?: number | null;
  roofDeckInsulationSqft?: number | null;
  complete?: boolean | null;
  confidence?: PlanMeasurementConfidence;
  fieldEvidence?: Record<string, PlanFieldEvidence>;
};

export type PlanFieldEvidence = {
  value?: number | string | boolean | null;
  sourceType: PlanMeasurementSourceType;
  confidence: PlanMeasurementConfidence;
  evidence?: PlanEvidence[];
};

export type PlanFacts = {
  buildingAreas?: PlanBuildingAreas;
  ceilingBoundary?: PlanCeilingBoundary | null;
  storyCount?: number | null;
  roofPitch?: string | null;
  roofWastePercent?: number | null;
  wallHeightFt?: number | null;
  plateHeightFt?: number | null;
  ceilingHeightFt?: number | null;
  vaultedCeilingDetected?: boolean | null;
  interiorRooms?: Array<{
    name?: string | null;
    lengthFt?: number | null;
    widthFt?: number | null;
    areaSqft?: number | null;
    confidence?: number | null;
  }>;
  elevationFaces?: Array<{
    id?: string | null;
    widthFt?: number | null;
    heightFt?: number | null;
    areaSqft?: number | null;
    windowDoorOpeningsSqft?: number | null;
    garageOpeningsSqft?: number | null;
    openingsSqft?: number | null;
  }> | null;
  exteriorPerimeterLf?: number | null;
  foundationPerimeterLf?: number | null;
  foundationFootprintSqft?: number | null;
  roofedFootprintSqft?: number | null;
  coveredPatioRoofed?: boolean | null;
  includeCoveredPatioSlab?: boolean | null;
  nonPaintedExteriorPercent?: number | null;
  openingsPercent?: number | null;
  insulationMaterialType?: string | null;
  insulationRValue?: string | null;
  garageInsulationIncluded?: boolean | null;
  geometry?: PlanGeometryRegion[];
  fieldEvidence?: Record<string, PlanFieldEvidence>;
  warnings?: string[];
  openingSchedules?: {
    windows?: Array<Record<string, unknown>>;
    exteriorDoors?: Array<Record<string, unknown>>;
    slidingDoors?: Array<Record<string, unknown>>;
    interiorDoors?: Array<Record<string, unknown>>;
    garageDoors?: Array<Record<string, unknown>>;
  } | null;
  openingEvidence?: Array<{
    id?: string;
    category?: 'window' | 'exterior_swing' | 'sliding' | 'interior';
    source?: 'schedule' | 'floor_plan' | 'elevation' | 'section';
    mark?: string;
    level?: string;
    location?: string;
    type?: string;
    interiorSubtype?:
      'room' | 'bath' | 'closet' | 'laundry' | 'pantry' | 'other';
    sheet?: string;
    page?: number;
    sourceText?: string;
    sizeCode?: string;
    widthIn?: number;
    heightIn?: number;
    widthFt?: number;
    heightFt?: number;
    confidence?: number;
  }>;
  openingReconciliation?: {
    duplicates?: Array<Record<string, unknown>>;
    sourceCounts?: Record<string, Record<string, number>>;
    uniqueCounts?: Record<string, number>;
    interiorBreakdown?: Record<string, number>;
    variance?: Record<string, Record<string, number>>;
  };
};

/** Cover-sheet building areas are often attached at takeoff root, not inside planFacts. */
export function mergePlanFactsWithBuildingAreas(
  planFacts?: PlanFacts | null,
  buildingAreas?: PlanBuildingAreas | null
): PlanFacts | null | undefined {
  if (!planFacts && !buildingAreas) return planFacts;
  return {
    ...(planFacts || {}),
    buildingAreas: {
      ...(planFacts?.buildingAreas || {}),
      ...(buildingAreas || {}),
    },
  };
}

export type MeasurementCalculationStep = {
  label: string;
  value: number;
  unit: string;
  operation?: string;
};

export type MeasurementSuggestion = {
  key: string;
  value: number;
  unit: string;
  sourceType: PlanMeasurementSourceType;
  confidence: PlanMeasurementConfidence;
  confidenceReason: string;
  formulaId: string;
  formulaVersion: string;
  inputsUsed: Record<string, number | string | boolean | null>;
  assumptions: string[];
  includedComponents: string[];
  excludedComponents: string[];
  warning?: string | null;
  requiresConfirmation: boolean;
  planEvidence: PlanEvidence[];
  calculationBreakdown: MeasurementCalculationStep[];
};

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function planFirstFloorLivingSqft(
  facts: PlanFacts | null | undefined,
  fallbackLivingSqft?: number | null
): number | null {
  const main = positive(facts?.buildingAreas?.mainFloorLivingSqft);
  const upstairs = positive(facts?.buildingAreas?.upstairsLivingSqft);
  const total =
    positive(facts?.buildingAreas?.totalLivingSqft) ??
    positive(fallbackLivingSqft);
  const multiStory =
    (facts?.storyCount != null && facts.storyCount > 1) || upstairs != null;

  // Cover sheets often label total living as "Main Living Area" — ignore when it
  // equals the cover total on a multi-story plan.
  if (
    main != null &&
    !(multiStory && total != null && Math.abs(main - total) < 1)
  ) {
    return main;
  }
  if (multiStory && total != null && upstairs != null && total > upstairs) {
    return Math.round((total - upstairs) * 10) / 10;
  }
  if (multiStory) return null;
  return total;
}

export function planTotalLivingSqft(
  facts: PlanFacts | null | undefined,
  fallbackLivingSqft?: number | null
): number | null {
  return (
    positive(facts?.buildingAreas?.totalLivingSqft) ??
    positive(fallbackLivingSqft)
  );
}

export function geometryArea(
  facts: PlanFacts | null | undefined,
  kinds: PlanGeometryRegion['kind'][]
): number | null {
  const regions = (facts?.geometry || []).filter(
    region =>
      kinds.includes(region.kind) &&
      region.isIncluded !== false &&
      positive(region.areaSqft)
  );
  if (!regions.length) return null;
  return (
    Math.round(
      regions.reduce((sum, region) => sum + Number(region.areaSqft), 0) * 10
    ) / 10
  );
}

export function geometryPerimeter(
  facts: PlanFacts | null | undefined,
  kinds: PlanGeometryRegion['kind'][]
): number | null {
  const regions = (facts?.geometry || []).filter(
    region =>
      kinds.includes(region.kind) &&
      region.isIncluded !== false &&
      positive(region.perimeterLf)
  );
  if (!regions.length) return null;
  return (
    Math.round(
      regions.reduce((sum, region) => sum + Number(region.perimeterLf), 0) * 10
    ) / 10
  );
}

/** Cover totals remain authoritative while floor-component deltas stay visible. */
export function planAreaReconciliationWarnings(
  facts: PlanFacts | null | undefined
): string[] {
  const areas = facts?.buildingAreas;
  if (!areas) return [];
  const total = positive(areas.totalLivingSqft);
  const floors = [
    positive(areas.mainFloorLivingSqft),
    positive(areas.upstairsLivingSqft),
    ...(areas.additionalFloorAreas || []).map(positive),
  ].filter((value): value is number => value != null);
  if (total == null || floors.length < 2) return facts?.warnings || [];
  const floorTotal = floors.reduce((sum, value) => sum + value, 0);
  const delta = Math.round((floorTotal - total) * 10) / 10;
  if (Math.abs(delta) < 0.6) return facts?.warnings || [];
  return [
    ...(facts?.warnings || []),
    `Cover living area (${total.toLocaleString()} sqft) differs from floor components (${floorTotal.toLocaleString()} sqft) by ${Math.abs(delta).toLocaleString()} sqft.`,
  ];
}
