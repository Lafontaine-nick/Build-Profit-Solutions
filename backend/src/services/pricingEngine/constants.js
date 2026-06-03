/** Pricing source priority (lower = higher priority). */
const SOURCE_PRIORITY = {
  user_provided: 1,
  saved_pricing: 2,
  saved_template: 3,
  company_default: 4,
  supplier_pricing: 5,
  regional_labor_benchmark: 6,
  construction_cost_database: 7,
  ai_rough_estimate_fallback: 8,
};

const SOURCE_LABELS = {
  user_provided: 'User Provided',
  saved_pricing: 'Saved Pricing',
  saved_template: 'Saved Bid Template',
  company_default: 'Company Default',
  supplier_pricing: 'Supplier Pricing',
  regional_labor_benchmark: 'Regional Labor Benchmark',
  construction_cost_database: 'Construction Cost Database',
  ai_rough_estimate_fallback: 'AI Rough Estimate Fallback',
  manually_entered: 'Manually Entered',
};

const PRICING_DISCLAIMER =
  'AI rough estimates are for planning only. Prices are not guaranteed and may not reflect current material costs, labor rates, productivity, site conditions, local codes, permits, taxes, disposal, overhead, insurance, subcontractor pricing, or market changes. Always review and adjust before sending a bid.';

/** Burden multiplier: wage → billable labor (payroll, WC, OH, profit). */
const DEFAULT_LABOR_BURDEN = 2.35;

/** Productivity assumptions (units per hour) for converting $/hr → $/unit. */
const PRODUCTIVITY_SQFT_PER_HR = {
  demo: 75,
  flooring_install: 45,
  paint: 120,
};

const PRODUCTIVITY_LF_PER_HR = {
  trim_install: 35,
};

const REGIONAL_MATERIAL_DEFAULTS = {
  flooring: { laminateMaterial: 4, baseboardMaterial: 0.85 },
  other: { materialPerSqft: 3.5 },
};

const AI_FALLBACK_RATES = {
  demoLaborSqft: 5,
  laminateMaterialSqft: 4,
  laminateLaborSqft: 5,
  baseboardMaterialLf: 0.85,
  baseboardLaborLf: 2.5,
};

const REGIONAL_DEFAULTS_BY_TRADE = {
  demo: { labor: 5, material: 0, unit: 'sqft' },
  flooring: { material: 3.5, labor: 4.5, unit: 'sqft' },
  bathroom: { labor: 85, material: 45, unit: 'sqft' },
  kitchen: { labor: 95, material: 55, unit: 'sqft' },
  painting: { labor: 2.5, material: 0.85, unit: 'sqft' },
  other: { labor: 50, material: 35, unit: 'sqft' },
};

module.exports = {
  SOURCE_PRIORITY,
  SOURCE_LABELS,
  PRICING_DISCLAIMER,
  DEFAULT_LABOR_BURDEN,
  PRODUCTIVITY_SQFT_PER_HR,
  PRODUCTIVITY_LF_PER_HR,
  REGIONAL_MATERIAL_DEFAULTS,
  AI_FALLBACK_RATES,
  REGIONAL_DEFAULTS_BY_TRADE,
};
