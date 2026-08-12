const {
  getTradeScopeAllowlist,
  PLAN_EXPORT_TRADE_KEYS,
} = require('./subcontractorTrade/tradeKeys');

const TRADE_CONFIGS = {
  electrical: {
    key: 'electrical',
    label: 'Electrical',
    status: 'reference',
    scopeHint: 'Focus on electrical sheets, panels, circuits, devices, lighting, and electrical notes.',
    missingInfo: ['Device and fixture counts', 'Panel/circuit schedule', 'Service size and utility scope'],
    reviewMeasurementKeys: [],
    reviewScopeKeywords: ['electrical', 'receptacle', 'switch', 'lighting', 'panel', 'circuit', 'smoke', 'detector'],
  },
  plumbing: { key: 'plumbing', label: 'Plumbing', status: 'stub' },
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
  painting: { key: 'painting', label: 'Painting', status: 'stub' },
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

function filterPlanScopesForTrade(scope, mode, trade) {
  if (!scope || mode !== 'selected_trade') return scope;
  const tradeKey = trade?.key || null;
  const allowedIds = getTradeScopeAllowlist(tradeKey);
  const detections = (scope.detections || []).filter((detection) => {
    if (allowedIds?.length) {
      return allowedIds.includes(String(detection.itemId || '').trim());
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
