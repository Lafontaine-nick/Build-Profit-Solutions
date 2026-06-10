/**
 * Planning price ranges by pricing category.
 * Used for sanity checks — not live market quotes.
 *
 * Rates are per pricingUnit unless noted (lump sums use total fields).
 */

const { NATIONAL_TRADE_AVERAGES } = require('./constants');

/** @typedef {'sqft'|'lf'|'each'|'hour'|'day'|'lump_sum'|'square'|'allowance'} PricingUnit */

/**
 * @typedef {object} RateBand
 * @property {number} low
 * @property {number} typical
 * @property {number} high
 * @property {number} extremeWarning
 */

/**
 * @typedef {object} PricingCategoryRange
 * @property {string} pricingCategory
 * @property {'project'|'assembly'|'subScope'|'materialOnly'|'laborOnly'|'serviceCall'|'allowance'} defaultScopeType
 * @property {string|null} parentAssemblyCategory - sub-scopes should not exceed parent assembly rates
 * @property {PricingUnit} unit
 * @property {PricingUnit[]} allowedUnits
 * @property {RateBand|null} material
 * @property {RateBand|null} labor
 * @property {number|null} maxReasonablePerUnit - combined mat+labor per unit ceiling for sub-scopes
 * @property {string} notes
 */

/** @type {Record<string, PricingCategoryRange>} */
const PRICING_RANGE_CATALOG = {
  shower_waterproofing: {
    pricingCategory: 'shower_waterproofing',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: 'shower_full_package',
    unit: 'sqft',
    allowedUnits: ['sqft'],
    material: { low: 3, typical: 5, high: 7, extremeWarning: 15 },
    labor: { low: 4, typical: 7, high: 10, extremeWarning: 20 },
    maxReasonablePerUnit: 17,
    notes: 'Backer board, membrane, tape, screws — not tile install or full shower package.',
  },
  shower_tile: {
    pricingCategory: 'shower_tile',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: 'shower_full_package',
    unit: 'sqft',
    allowedUnits: ['sqft'],
    material: { low: 4, typical: 8, high: 14, extremeWarning: 25 },
    labor: { low: 8, typical: 14, high: 22, extremeWarning: 35 },
    maxReasonablePerUnit: 36,
    notes: 'Shower wall/floor tile material and setting labor only.',
  },
  shower_full_package: {
    pricingCategory: 'shower_full_package',
    defaultScopeType: 'assembly',
    parentAssemblyCategory: null,
    unit: 'sqft',
    allowedUnits: ['sqft', 'lump_sum'],
    material: { low: 25, typical: 45, high: 65, extremeWarning: 90 },
    labor: { low: 45, typical: 85, high: 120, extremeWarning: 160 },
    maxReasonablePerUnit: 185,
    notes: 'Complete tile shower: pan, waterproofing, tile, drain, trim.',
  },
  demo: {
    pricingCategory: 'demo',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'sqft',
    allowedUnits: ['sqft', 'lump_sum'],
    material: { low: 0, typical: 0.5, high: 1.5, extremeWarning: 4 },
    labor: { low: 2, typical: 5, high: 9, extremeWarning: 15 },
    maxReasonablePerUnit: 16,
    notes: 'Demolition and haul-off allowance.',
  },
  flooring: {
    pricingCategory: 'flooring',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'sqft',
    allowedUnits: ['sqft'],
    material: { low: 2, typical: 4, high: 8, extremeWarning: 15 },
    labor: { low: 3, typical: 5, high: 9, extremeWarning: 15 },
    maxReasonablePerUnit: 20,
    notes: 'LVP, laminate, vinyl, or floor tile install.',
  },
  tile: {
    pricingCategory: 'tile',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'sqft',
    allowedUnits: ['sqft'],
    material: { low: 3, typical: 6, high: 12, extremeWarning: 22 },
    labor: { low: 4, typical: 8, high: 14, extremeWarning: 22 },
    maxReasonablePerUnit: 30,
    notes: 'Floor or wall tile install (non-shower).',
  },
  baseboard: {
    pricingCategory: 'baseboard',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'lf',
    allowedUnits: ['lf'],
    material: { low: 1, typical: 2, high: 4, extremeWarning: 8 },
    labor: { low: 3, typical: 5, high: 8, extremeWarning: 14 },
    maxReasonablePerUnit: 18,
    notes: 'Trim/baseboard material and install per linear foot.',
  },
  bathroom: {
    pricingCategory: 'bathroom',
    defaultScopeType: 'project',
    parentAssemblyCategory: null,
    unit: 'sqft',
    allowedUnits: ['sqft', 'lump_sum'],
    material: { low: 25, typical: 45, high: 70, extremeWarning: 100 },
    labor: { low: 45, typical: 85, high: 120, extremeWarning: 160 },
    maxReasonablePerUnit: 200,
    notes: 'Full bathroom remodel per sqft — not for single sub-tasks.',
  },
  kitchen: {
    pricingCategory: 'kitchen',
    defaultScopeType: 'project',
    parentAssemblyCategory: null,
    unit: 'sqft',
    allowedUnits: ['sqft', 'lump_sum'],
    material: { low: 30, typical: 55, high: 85, extremeWarning: 120 },
    labor: { low: 50, typical: 95, high: 140, extremeWarning: 180 },
    maxReasonablePerUnit: 220,
    notes: 'Full kitchen remodel per sqft — not for single sub-tasks.',
  },
  cabinets: {
    pricingCategory: 'cabinets',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: 'kitchen',
    unit: 'lf',
    allowedUnits: ['lf', 'each', 'lump_sum'],
    material: { low: 80, typical: 200, high: 450, extremeWarning: 800 },
    labor: { low: 40, typical: 100, high: 200, extremeWarning: 350 },
    maxReasonablePerUnit: 900,
    notes: 'Cabinet supply and install per LF or box count.',
  },
  countertops: {
    pricingCategory: 'countertops',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: 'kitchen',
    unit: 'sqft',
    allowedUnits: ['sqft', 'lump_sum', 'allowance'],
    material: { low: 25, typical: 55, high: 95, extremeWarning: 150 },
    labor: { low: 15, typical: 35, high: 60, extremeWarning: 90 },
    maxReasonablePerUnit: 200,
    notes: 'Countertop material and install per sqft.',
  },
  floor_prep: {
    pricingCategory: 'floor_prep',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: 'flooring',
    unit: 'sqft',
    allowedUnits: ['sqft', 'lump_sum', 'each'],
    material: { low: 1, typical: 4, high: 10, extremeWarning: 18 },
    labor: { low: 2, typical: 6, high: 12, extremeWarning: 20 },
    maxReasonablePerUnit: 25,
    notes: 'Floor prep, underlayment, or patching per sqft.',
  },
  painting: {
    pricingCategory: 'painting',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'sqft',
    allowedUnits: ['sqft'],
    material: { low: 0.3, typical: 0.85, high: 1.5, extremeWarning: 3 },
    labor: { low: 1.2, typical: 2.5, high: 4.5, extremeWarning: 8 },
    maxReasonablePerUnit: 10,
    notes: 'Paint and primer per wall/ceiling sqft.',
  },
  drywall: {
    pricingCategory: 'drywall',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'sqft',
    allowedUnits: ['sqft'],
    material: { low: 0.5, typical: 1.2, high: 2.5, extremeWarning: 5 },
    labor: { low: 1.5, typical: 3.5, high: 6, extremeWarning: 10 },
    maxReasonablePerUnit: 14,
    notes: 'Drywall hang, finish, or patch.',
  },
  plumbing: {
    pricingCategory: 'plumbing',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'hour',
    allowedUnits: ['hour', 'each', 'lump_sum'],
    material: { low: 35, typical: 75, high: 150, extremeWarning: 300 },
    labor: { low: 75, typical: 125, high: 175, extremeWarning: 250 },
    maxReasonablePerUnit: 400,
    notes: 'Plumbing rough or trim — hourly or per fixture.',
  },
  plumbing_service: {
    pricingCategory: 'plumbing_service',
    defaultScopeType: 'serviceCall',
    parentAssemblyCategory: null,
    unit: 'hour',
    allowedUnits: ['hour', 'lump_sum'],
    material: { low: 25, typical: 75, high: 150, extremeWarning: 300 },
    labor: { low: 85, typical: 125, high: 185, extremeWarning: 275 },
    maxReasonablePerUnit: 400,
    notes: 'Plumbing service call or repair.',
  },
  electrical: {
    pricingCategory: 'electrical',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'hour',
    allowedUnits: ['hour', 'each', 'lump_sum'],
    material: { low: 25, typical: 45, high: 90, extremeWarning: 200 },
    labor: { low: 65, typical: 95, high: 140, extremeWarning: 200 },
    maxReasonablePerUnit: 300,
    notes: 'Electrical rough or trim.',
  },
  roofing: {
    pricingCategory: 'roofing',
    defaultScopeType: 'assembly',
    parentAssemblyCategory: null,
    unit: 'square',
    allowedUnits: ['square', 'sqft', 'lump_sum'],
    material: { low: 200, typical: 350, high: 550, extremeWarning: 800 },
    labor: { low: 250, typical: 450, high: 700, extremeWarning: 1000 },
    maxReasonablePerUnit: 1200,
    notes: 'Roofing per square (100 sqft).',
  },
  concrete: {
    pricingCategory: 'concrete',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'sqft',
    allowedUnits: ['sqft', 'lump_sum'],
    material: { low: 2, typical: 4, high: 8, extremeWarning: 15 },
    labor: { low: 3, typical: 6, high: 12, extremeWarning: 20 },
    maxReasonablePerUnit: 28,
    notes: 'Flatwork, slab, or patio concrete.',
  },
  framing: {
    pricingCategory: 'framing',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'sqft',
    allowedUnits: ['sqft', 'lf', 'lump_sum'],
    material: { low: 2, typical: 5, high: 10, extremeWarning: 18 },
    labor: { low: 4, typical: 8, high: 15, extremeWarning: 25 },
    maxReasonablePerUnit: 35,
    notes: 'Framing walls or structural carpentry.',
  },
  hvac: {
    pricingCategory: 'hvac',
    defaultScopeType: 'assembly',
    parentAssemblyCategory: null,
    unit: 'each',
    allowedUnits: ['each', 'lump_sum', 'hour'],
    material: { low: 1500, typical: 3500, high: 8000, extremeWarning: 15000 },
    labor: { low: 800, typical: 2000, high: 4500, extremeWarning: 8000 },
    maxReasonablePerUnit: 20000,
    notes: 'HVAC equipment and install per unit.',
  },
  landscaping: {
    pricingCategory: 'landscaping',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'sqft',
    allowedUnits: ['sqft', 'lump_sum'],
    material: { low: 1, typical: 3, high: 8, extremeWarning: 15 },
    labor: { low: 2, typical: 5, high: 12, extremeWarning: 20 },
    maxReasonablePerUnit: 30,
    notes: 'Landscaping, grading, or hardscape allowance.',
  },
  excavation: {
    pricingCategory: 'excavation',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'hour',
    allowedUnits: ['hour', 'lump_sum', 'sqft'],
    material: { low: 0, typical: 0, high: 50, extremeWarning: 200 },
    labor: { low: 75, typical: 150, high: 250, extremeWarning: 400 },
    maxReasonablePerUnit: 450,
    notes: 'Excavation or site work — often lump sum or hourly.',
  },
  general_labor: {
    pricingCategory: 'general_labor',
    defaultScopeType: 'laborOnly',
    parentAssemblyCategory: null,
    unit: 'hour',
    allowedUnits: ['hour', 'day', 'lump_sum'],
    material: { low: 0, typical: 0, high: 25, extremeWarning: 75 },
    labor: { low: 35, typical: 55, high: 85, extremeWarning: 125 },
    maxReasonablePerUnit: 150,
    notes: 'General labor or helper time.',
  },
  cleanup: {
    pricingCategory: 'cleanup',
    defaultScopeType: 'allowance',
    parentAssemblyCategory: null,
    unit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance'],
    material: null,
    labor: { low: 150, typical: 400, high: 1200, extremeWarning: 2500 },
    maxReasonablePerUnit: 3000,
    notes: 'Jobsite cleanup, haul-off, disposal.',
  },
  permits: {
    pricingCategory: 'permits',
    defaultScopeType: 'allowance',
    parentAssemblyCategory: null,
    unit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance'],
    material: null,
    labor: { low: 100, typical: 350, high: 1500, extremeWarning: 5000 },
    maxReasonablePerUnit: 6000,
    notes: 'Permit and inspection fees.',
  },
  bathroom_fixture: {
    pricingCategory: 'bathroom_fixture',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: 'bathroom',
    unit: 'each',
    allowedUnits: ['each', 'lump_sum'],
    material: { low: 200, typical: 650, high: 1500, extremeWarning: 3500 },
    labor: { low: 200, typical: 550, high: 1200, extremeWarning: 2500 },
    maxReasonablePerUnit: 5000,
    notes: 'Single fixture install: toilet, vanity, tub, shower door, pan.',
  },
  other: {
    pricingCategory: 'other',
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: 'sqft',
    allowedUnits: ['sqft', 'lf', 'each', 'hour', 'lump_sum', 'allowance'],
    material: { low: 5, typical: 35, high: 75, extremeWarning: 120 },
    labor: { low: 10, typical: 50, high: 100, extremeWarning: 160 },
    maxReasonablePerUnit: 200,
    notes: 'General allowance when trade is unclear — review recommended.',
  },
};

function bandFromNational(materialTypical, laborTypical) {
  const mk = (typical) =>
    typical == null || typical <= 0
      ? null
      : {
          low: Math.max(0, Math.round(typical * 0.55 * 100) / 100),
          typical,
          high: Math.round(typical * 1.45 * 100) / 100,
          extremeWarning: Math.round(typical * 2.5 * 100) / 100,
        };
  return { material: mk(materialTypical), labor: mk(laborTypical) };
}

function deriveRangeFromNational(trade) {
  const band = NATIONAL_TRADE_AVERAGES[trade] || NATIONAL_TRADE_AVERAGES.other;
  const { material, labor } = bandFromNational(band.material, band.labor);
  const combined = (band.material || 0) + (band.labor || 0);
  return {
    pricingCategory: trade,
    defaultScopeType: 'subScope',
    parentAssemblyCategory: null,
    unit: band.unit || 'sqft',
    allowedUnits: [band.unit || 'sqft', 'lump_sum'],
    material,
    labor,
    maxReasonablePerUnit: combined > 0 ? Math.round(combined * 2.2 * 100) / 100 : null,
    notes: `Derived from national planning average for ${trade.replace(/_/g, ' ')}.`,
  };
}

function getPricingRange(pricingCategory) {
  if (PRICING_RANGE_CATALOG[pricingCategory]) {
    return PRICING_RANGE_CATALOG[pricingCategory];
  }
  if (NATIONAL_TRADE_AVERAGES[pricingCategory]) {
    return deriveRangeFromNational(pricingCategory);
  }
  return PRICING_RANGE_CATALOG.other;
}

function normalizeUnit(unit) {
  const u = String(unit || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (u === 'lf' || u === 'linear_foot' || u === 'linear_ft' || u === 'ln_ft') return 'lf';
  if (u === 'sq_ft' || u === 'sqft' || u === 'square_feet') return 'sqft';
  if (u === 'lump' || u === 'lot' || u === 'allowance') return 'lump_sum';
  if (u === 'hr' || u === 'hrs') return 'hour';
  if (u === 'square') return 'square';
  return u || 'lump_sum';
}

function unitAllowedForCategory(unit, range) {
  const u = normalizeUnit(unit);
  return (range.allowedUnits || []).some((a) => normalizeUnit(a) === u);
}

module.exports = {
  PRICING_RANGE_CATALOG,
  getPricingRange,
  deriveRangeFromNational,
  normalizeUnit,
  unitAllowedForCategory,
  bandFromNational,
};
