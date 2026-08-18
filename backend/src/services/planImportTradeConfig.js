const {
  getTradeScopeAllowlist,
  PLAN_EXPORT_TRADE_KEYS,
} = require('./subcontractorTrade/tradeKeys');

const TRADE_CONFIGS = {
  electrical: {
    key: 'electrical',
    label: 'Electrical',
    status: 'reference',
    scopeHint: 'Focus on electrical sheets, panels, circuits, devices, lighting, and electrical notes. Plan Export maps symbol/schedule counts onto the locked 2A–2K keys.',
    missingInfo: ['Device and fixture counts', 'Panel/circuit schedule', 'Service size and utility scope'],
    reviewMeasurementKeys: [
      'mainPanelCount',
      'subpanelCount',
      'panelUpgradeCount',
      'serviceUpgradeCount',
      'serviceAmperage',
      'standardCircuitCount',
      'dedicated20aCircuitCount',
      'circuit30aCount',
      'circuit40aCount',
      'circuit50aCount',
      'circuit60aPlusCount',
      'standardReceptacleCount',
      'gfciReceptacleCount',
      'afciReceptacleCount',
      'exteriorReceptacleCount',
      'floorReceptacleCount',
      'usbReceptacleCount',
      'receptacle240vCount',
      'singlePoleSwitchCount',
      'threeWaySwitchCount',
      'fourWaySwitchCount',
      'dimmerSwitchCount',
      'occupancySwitchCount',
      'smartSwitchCount',
      'standardFixtureCount',
      'recessedLightCount',
      'pendantLightCount',
      'decorativeLightCount',
      'exteriorLightCount',
      'undercabinetLightCount',
      'ceilingFanCount',
      'bathExhaustFanCount',
      'rangeHookupCount',
      'dryerHookupCount',
      'dishwasherHookupCount',
      'disposalHookupCount',
      'microwaveHookupCount',
      'refrigeratorHookupCount',
      'waterHeaterHookupCount',
      'hvacHookupCount',
      'evChargerHookupCount',
      'smokeDetectorCount',
      'coDetectorCount',
      'doorbellCount',
      'cat6DropCount',
      'tvCoaxCount',
      'securityPrewireCount',
      'cameraPrewireCount',
      'deviceRemovalCount',
      'fixtureRemovalCount',
      'relocateCount',
      'abandonedCircuitCount',
      'conduitLf',
      'trenchingLf',
    ],
    reviewScopeKeywords: ['electrical', 'receptacle', 'switch', 'lighting', 'panel', 'circuit', 'smoke', 'detector'],
  },
  plumbing: {
    key: 'plumbing',
    label: 'Plumbing',
    status: 'reference',
    scopeHint:
      'Focus on plumbing plans, fixture schedules, risers, water/sewer lines, rough-in points, and plumbing notes. Map explicit quantities onto canonical Plumbing keys; do not infer quantities from living area.',
    missingInfo: [
      'Fixture and connection counts',
      'Rough-in points and access conditions',
      'Water, sewer, and drain-line lengths',
      'Repair, service, and allowance details',
    ],
    reviewMeasurementKeys: [
      'serviceCallCount',
      'fixtureRepairCount',
      'fixtureReplacementCount',
      'drainCleaningCount',
      'waterLineLf',
      'sewerLineLf',
      'plumbingRoughPointCount',
      'plumbingTrimHookupCount',
      'partsMaterialsCount',
      'emergencyFeeCount',
      'plumbingCleanupCount',
    ],
    reviewScopeKeywords: [
      'plumbing',
      'plumber',
      'fixture',
      'toilet',
      'sink',
      'faucet',
      'drain',
      'sewer',
      'water line',
      'rough-in',
      'rough in',
    ],
  },
  hvac: { key: 'hvac', label: 'HVAC', status: 'stub' },
  roofing: {
    key: 'roofing',
    label: 'Roofing',
    status: 'stub',
    // Canonical Roofing contract. Unsupported geometry remains excluded, and
    // accessory quantities are carried only when explicitly extracted/provided.
    reviewMeasurementKeys: [
      'roofAreaSqft',
      'roofSquares',
      'roofPitch',
      'storyCount',
      'roofDeckingReplacementSqft',
      'roofDripEdgeLf',
      'roofRidgeCapLf',
      'roofRidgeVentLf',
      'roofValleyFlashingLf',
      'roofStepFlashingLf',
      'roofWallFlashingLf',
      'roofChimneyFlashingCount',
      'roofPipeBootCount',
      'roofVentCount',
      'roofTurbineVentCount',
      'roofSkylightCount',
      'roofPenetrationCount',
      'roofRepairAffectedSqft',
      'roofGutterLf',
      'roofDownspoutCount',
    ],
  },
  concrete: {
    key: 'concrete',
    label: 'Concrete',
    status: 'reference',
    scopeHint:
      'Focus on labeled flatwork areas, footing/foundation CY, excavation, and concrete notes.',
    missingInfo: [
      'Flatwork type areas and slab thickness',
      'Footing / foundation CY when not dimensioned',
      'Demo, excavation, and reinforcement only when explicitly supported',
    ],
    reviewMeasurementKeys: [
      'concreteDrivewaySqft',
      'concreteSidewalkSqft',
      'concretePatioSqft',
      'concreteWalkwaySqft',
      'concreteRvPadSqft',
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
    ],
    reviewScopeKeywords: [
      'concrete',
      'flatwork',
      'driveway',
      'sidewalk',
      'walkway',
      'patio',
      'footing',
      'foundation',
      'excavation',
    ],
  },
  framing: { key: 'framing', label: 'Framing', status: 'stub' },
  drywall: { key: 'drywall', label: 'Drywall', status: 'stub' },
  painting: {
    key: 'painting',
    label: 'Painting',
    status: 'reference',
    scopeHint:
      'Inspect floor plans, reflected ceiling plans, finish schedules, door schedules, interior elevations, cabinet/millwork sheets, and exterior elevations — not only sheets titled Paint. Calculate wall, ceiling, trim, and door quantities from labeled paint totals or from dimensioned plan geometry with an explicit wall/plate height. Never infer paint from living/floor area. Do not infer prep, occupancy, or application method. Cabinets only when the plan supports paint-grade millwork.',
    missingInfo: [
      'Interior wall and ceiling areas when not dimensioned',
      'Job condition and application method',
      'Prep / masking only when explicitly supported',
    ],
    reviewMeasurementKeys: [
      'wallPaintSqft',
      'ceilingPaintSqft',
      'paintAreaSqft',
      'combinedPaintableAreaSqft',
      'baseboardLf',
      'interiorDoorCount',
      'cabinetRunLf',
      'cabinetPaintSqft',
      'exteriorPaintSqft',
    ],
    reviewScopeKeywords: [
      'painting',
      'paint',
      'trim',
      'cabinet',
      'floor plan',
      'finish plan',
      'finish schedule',
      'room finish',
      'rcp',
      'reflected ceiling',
      'door schedule',
      'interior elevation',
      'exterior elevation',
      'elevation',
      'millwork',
      'baseboard',
      'wall finish',
      'ceiling finish',
    ],
  },
  stucco: {
    key: 'stucco',
    label: 'Stucco / Exterior Finish',
    status: 'stub',
    reviewMeasurementKeys: [
      'stuccoSqft',
      'exteriorWallSqft',
      'exteriorFinishSqft',
      'exteriorFinishesSqft',
      'exteriorPaintSqft',
      'stuccoGrossWallSqft',
      'stuccoWindowDoorOpeningSqft',
      'stuccoGarageOpeningSqft',
      'stuccoOtherFinishDeductionSqft',
      'stuccoNetWallSqft',
      'stuccoSoffitSqft',
      'stuccoParapetSqft',
      'stuccoFoamTrimLf',
      'stuccoControlJointLf',
      'stuccoAccessAffectedSqft',
      'stuccoRepairAffectedSqft',
      'stuccoStories',
      'stuccoWallHeightFt',
    ],
    reviewScopeKeywords: ['stucco'],
    missingInfo: ['Exterior wall area and openings', 'Stucco system and finish', 'Access, scaffolding, and repair conditions'],
  },
  insulation: { key: 'insulation', label: 'Insulation', status: 'stub' },
  flooring: {
    key: 'flooring',
    label: 'Flooring',
    status: 'reference',
    scopeHint:
      'Focus on finish schedules, floor areas, and flooring notes. Do not infer demo, prep severity, or accessories without explicit support.',
    missingInfo: [
      'New flooring product types and install areas',
      'Existing floor types when not on finish schedule',
      'Demo, prep severity, and accessories only when explicitly supported',
    ],
    reviewMeasurementKeys: [
      'flooringSqft',
      'floorAreaSqft',
      'flooringLvpSqft',
      'flooringLaminateSqft',
      'flooringEngineeredHardwoodSqft',
      'flooringSolidHardwoodSqft',
      'flooringTileSqft',
      'flooringCarpetSqft',
      'flooringSheetVinylSqft',
      'floorDemoSqft',
      'floorDemoCarpetSqft',
      'floorDemoTileSqft',
      'floorDemoLvpSqft',
      'floorDemoLaminateSqft',
      'floorDemoEngineeredHardwoodSqft',
      'floorDemoSolidHardwoodSqft',
      'floorDemoSheetVinylSqft',
      'floorPrepSqft',
      'underlaymentSqft',
      'moistureBarrierSqft',
      'baseboardLf',
      'transitionLf',
      'transitionCount',
      'quarterRoundLf',
    ],
    reviewScopeKeywords: [
      'flooring',
      'floor',
      'tile',
      'carpet',
      'lvp',
      'vinyl',
      'laminate',
      'hardwood',
    ],
  },
  cabinets: { key: 'cabinets', label: 'Cabinets', status: 'stub' },
  windows_doors: { key: 'windows_doors', label: 'Windows & doors', status: 'stub' },
  landscaping: { key: 'landscaping', label: 'Landscaping', status: 'stub' },
  other: { key: 'other', label: 'Other', status: 'stub' },
};

function filterPlanMeasurementsForTrade(measurements, mode, trade) {
  if (mode !== 'selected_trade') return measurements || {};
  const allowed = trade?.reviewMeasurementKeys || [];
  return Object.fromEntries(
    Object.entries(measurements || {}).filter(([key]) => allowed.includes(key))
  );
}

/** Plan-detected Electrical packages stay confirmation-only until the contractor selects them. */
const ELECTRICAL_PLAN_CONFIRMATION_ONLY_SCOPE_IDS = new Set([
  'electrical_rough',
  'electrical_trim',
  'electrical',
  'cleanup',
]);

function filterPlanScopesForTrade(scope, mode, trade) {
  if (!scope || mode !== 'selected_trade') return scope;
  const tradeKey = trade?.key || null;
  const allowedIds = getTradeScopeAllowlist(tradeKey);
  const detections = (scope.detections || []).filter((detection) => {
    const itemId = String(detection.itemId || '').trim();
    if (tradeKey === 'electrical' && ELECTRICAL_PLAN_CONFIRMATION_ONLY_SCOPE_IDS.has(itemId)) {
      return false;
    }
    if (allowedIds?.length) {
      return allowedIds.includes(itemId);
    }
    const keywords = trade?.reviewScopeKeywords || [];
    if (!keywords.length) return false;
    const haystack = `${detection.itemId || ''} ${detection.label || ''} ${detection.evidence || ''}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
  return { ...scope, detections };
}

function resolvePlanImportSelection(mode, tradeKey) {
  const trade = TRADE_CONFIGS[String(tradeKey || '').trim().toLowerCase()] || null;
  return {
    mode: mode === 'selected_trade' && trade ? 'selected_trade' : 'whole_project',
    trade: mode === 'selected_trade' ? trade : null,
  };
}

module.exports = {
  TRADE_CONFIGS,
  PLAN_EXPORT_TRADE_KEYS,
  resolvePlanImportSelection,
  filterPlanMeasurementsForTrade,
  filterPlanScopesForTrade,
  getTradeScopeAllowlist,
};
