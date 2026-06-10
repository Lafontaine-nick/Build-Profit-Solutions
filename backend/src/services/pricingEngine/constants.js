/** Pricing source priority (lower = higher priority). */
const SOURCE_PRIORITY = {
  user_provided: 1,
  saved_pricing: 2,
  saved_template: 3,
  company_default: 4,
  supplier_pricing: 5,
  national_trade_average: 6,
  construction_cost_database: 7,
  ai_rough_estimate_fallback: 8,
};

const SOURCE_LABELS = {
  user_provided: 'User Provided',
  saved_pricing: 'Saved Pricing',
  saved_template: 'Saved Bid Template',
  company_default: 'Company Default',
  supplier_pricing: 'Supplier Pricing',
  national_trade_average: 'National Average',
  construction_cost_database: 'Construction Cost Database',
  ai_rough_estimate_fallback: 'AI Rough Estimate Fallback',
  manually_entered: 'Manually Entered',
};

const PRICING_DISCLAIMER =
  'AI rough estimates are for planning only. Prices are not guaranteed and may not reflect current material costs, labor rates, productivity, site conditions, local codes, permits, taxes, disposal, overhead, insurance, subcontractor pricing, or market changes. Always review and adjust before sending a bid.';

/** Fallback ZIP for HD supplier lookup when notes/bid have no ZIP — still show live + national rates. */
const DEFAULT_SUPPLIER_ZIP = process.env.DEFAULT_SUPPLIER_ZIP || '30339';

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

/** National midpoint per LF for standard paint-grade MDF/primed pine baseboard (2026). */
const NATIONAL_BASEBOARD_LF_DEFAULTS = {
  material: 2,
  labor: 5,
  installedMid: 7,
};

const REGIONAL_MATERIAL_DEFAULTS = {
  flooring: { laminateMaterial: 4, baseboardMaterial: NATIONAL_BASEBOARD_LF_DEFAULTS.material },
  other: { materialPerSqft: 3.5 },
};

const AI_FALLBACK_RATES = {
  demoLaborSqft: 5,
  laminateMaterialSqft: 4,
  laminateLaborSqft: 5,
  baseboardMaterialLf: NATIONAL_BASEBOARD_LF_DEFAULTS.material,
  baseboardLaborLf: NATIONAL_BASEBOARD_LF_DEFAULTS.labor,
};

/**
 * Planning-only national midpoints by trade (material + labor per unit).
 * Not live supplier data — updated via product releases.
 */
const NATIONAL_TRADE_AVERAGES = {
  demo: {
    unit: 'sqft',
    material: 0.5,
    labor: 5,
    materialLabel: 'Disposal / consumables',
    laborLabel: 'Demo labor',
  },
  flooring: {
    unit: 'sqft',
    material: 4,
    labor: 5,
    materialLabel: 'Flooring material allowance',
    laborLabel: 'Flooring install labor',
  },
  baseboard: {
    unit: 'lf',
    material: 2,
    labor: 5,
    materialLabel: 'Baseboard material',
    laborLabel: 'Baseboard install labor',
  },
  bathroom: {
    unit: 'sqft',
    material: 45,
    labor: 85,
    materialLabel: 'Bathroom materials allowance',
    laborLabel: 'Bathroom labor',
  },
  shower_waterproofing: {
    unit: 'sqft',
    material: 5,
    labor: 7,
    materialLabel: 'Backer board, membrane & prep materials',
    laborLabel: 'Waterproofing & backer board labor',
  },
  shower_tile: {
    unit: 'sqft',
    material: 8,
    labor: 14,
    materialLabel: 'Shower tile materials allowance',
    laborLabel: 'Shower tile install labor',
  },
  shower_full_package: {
    unit: 'sqft',
    material: 45,
    labor: 85,
    materialLabel: 'Full shower system materials',
    laborLabel: 'Full shower install labor',
  },
  kitchen: {
    unit: 'sqft',
    material: 55,
    labor: 95,
    materialLabel: 'Kitchen materials allowance',
    laborLabel: 'Kitchen labor',
  },
  painting: {
    unit: 'sqft',
    material: 1.0,
    labor: 2.75,
    materialLabel: 'Paint / primer materials',
    laborLabel: 'Painting labor',
  },
  plumbing: {
    unit: 'hour',
    material: 75,
    labor: 125,
    materialLabel: 'Plumbing materials allowance',
    laborLabel: 'Plumber labor',
    defaultQuantity: 8,
  },
  plumbing_service: {
    unit: 'hour',
    material: 75,
    labor: 125,
    materialLabel: 'Plumbing service materials',
    laborLabel: 'Plumber service labor',
    defaultQuantity: 4,
  },
  electrical: {
    unit: 'hour',
    material: 45,
    labor: 95,
    materialLabel: 'Electrical materials allowance',
    laborLabel: 'Electrician labor',
    defaultQuantity: 8,
  },
  roofing: {
    unit: 'square',
    material: 350,
    labor: 450,
    materialLabel: 'Roofing materials per square',
    laborLabel: 'Roofing labor per square',
    defaultQuantity: 20,
  },
  concrete: {
    unit: 'sqft',
    material: 4,
    labor: 6,
    materialLabel: 'Concrete materials',
    laborLabel: 'Concrete labor',
  },
  other: {
    unit: 'sqft',
    material: 35,
    labor: 50,
    materialLabel: 'Materials allowance',
    laborLabel: 'Labor',
  },
};

const REGIONAL_DEFAULTS_BY_TRADE = Object.fromEntries(
  Object.entries(NATIONAL_TRADE_AVERAGES).map(([trade, band]) => [
    trade,
    { labor: band.labor, material: band.material, unit: band.unit },
  ])
);

module.exports = {
  SOURCE_PRIORITY,
  SOURCE_LABELS,
  PRICING_DISCLAIMER,
  DEFAULT_SUPPLIER_ZIP,
  DEFAULT_LABOR_BURDEN,
  PRODUCTIVITY_SQFT_PER_HR,
  PRODUCTIVITY_LF_PER_HR,
  NATIONAL_BASEBOARD_LF_DEFAULTS,
  NATIONAL_TRADE_AVERAGES,
  REGIONAL_MATERIAL_DEFAULTS,
  AI_FALLBACK_RATES,
  REGIONAL_DEFAULTS_BY_TRADE,
};
