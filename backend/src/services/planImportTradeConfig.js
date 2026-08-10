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
  roofing: { key: 'roofing', label: 'Roofing', status: 'stub' },
  concrete: { key: 'concrete', label: 'Concrete', status: 'stub' },
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
    ],
    reviewScopeKeywords: ['stucco'],
    missingInfo: ['Exterior wall area and openings', 'Stucco system and finish', 'Access, scaffolding, and repair conditions'],
  },
  insulation: { key: 'insulation', label: 'Insulation', status: 'stub' },
  flooring: { key: 'flooring', label: 'Flooring', status: 'stub' },
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

const TRADE_SCOPE_ITEM_IDS = {
  electrical: ['electrical_rough'],
  stucco: ['stucco'],
};

function filterPlanScopesForTrade(scope, mode, trade) {
  if (!scope || mode !== 'selected_trade') return scope;
  const tradeKey = trade?.key || null;
  const allowedIds = TRADE_SCOPE_ITEM_IDS[tradeKey];
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
  resolvePlanImportSelection,
  filterPlanMeasurementsForTrade,
  filterPlanScopesForTrade,
};
