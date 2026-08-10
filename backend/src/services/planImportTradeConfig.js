const TRADE_CONFIGS = {
  electrical: {
    key: 'electrical',
    label: 'Electrical',
    status: 'reference',
    scopeHint: 'Focus on electrical sheets, panels, circuits, devices, lighting, and electrical notes.',
    missingInfo: ['Device and fixture counts', 'Panel/circuit schedule', 'Service size and utility scope'],
  },
  plumbing: { key: 'plumbing', label: 'Plumbing', status: 'stub' },
  hvac: { key: 'hvac', label: 'HVAC', status: 'stub' },
  roofing: { key: 'roofing', label: 'Roofing', status: 'stub' },
  concrete: { key: 'concrete', label: 'Concrete', status: 'stub' },
  framing: { key: 'framing', label: 'Framing', status: 'stub' },
  drywall: { key: 'drywall', label: 'Drywall', status: 'stub' },
  painting: { key: 'painting', label: 'Painting', status: 'stub' },
  stucco: { key: 'stucco', label: 'Stucco / Exterior Finish', status: 'stub' },
  insulation: { key: 'insulation', label: 'Insulation', status: 'stub' },
  flooring: { key: 'flooring', label: 'Flooring', status: 'stub' },
  cabinets: { key: 'cabinets', label: 'Cabinets', status: 'stub' },
  windows_doors: { key: 'windows_doors', label: 'Windows & doors', status: 'stub' },
  landscaping: { key: 'landscaping', label: 'Landscaping', status: 'stub' },
  other: { key: 'other', label: 'Other', status: 'stub' },
};

function resolvePlanImportSelection(mode, tradeKey) {
  const trade = TRADE_CONFIGS[String(tradeKey || '').trim().toLowerCase()] || null;
  return {
    mode: mode === 'selected_trade' && trade ? 'selected_trade' : 'whole_project',
    trade: mode === 'selected_trade' ? trade : null,
  };
}

module.exports = { TRADE_CONFIGS, resolvePlanImportSelection };
