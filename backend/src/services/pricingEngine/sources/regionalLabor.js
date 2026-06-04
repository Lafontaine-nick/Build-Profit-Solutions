const {
  AI_FALLBACK_RATES,
  DEFAULT_LABOR_BURDEN,
  NATIONAL_BASEBOARD_LF_DEFAULTS,
  PRODUCTIVITY_SQFT_PER_HR,
  REGIONAL_MATERIAL_DEFAULTS,
} = require('../constants');

/** Metro hourly wages (OEWS-style benchmarks — not final billing). */
const METRO_HOURLY_WAGES = {
  default: { laborers: 22, carpenters: 28.5, painters: 24.8 },
  las_vegas: { laborers: 22.15, carpenters: 28.5, painters: 24.8 },
  phoenix: { laborers: 21.8, carpenters: 26.8, painters: 23.5 },
  denver: { laborers: 25.2, carpenters: 30.25, painters: 27.9 },
};

function normalizeLocationKey(projectLocation, zipCode) {
  const blob = `${projectLocation || ''} ${zipCode || ''}`.toLowerCase();
  if (/las\s*vegas|henderson|nv/.test(blob)) return 'las_vegas';
  if (/phoenix|scottsdale|mesa|az/.test(blob)) return 'phoenix';
  if (/denver|aurora|co/.test(blob)) return 'denver';
  return 'default';
}

function hourlyToUnitRate(hourly, unitsPerHour, burden = DEFAULT_LABOR_BURDEN) {
  if (!hourly || !unitsPerHour) return null;
  const billableHourly = hourly * burden;
  return Math.round((billableHourly / unitsPerHour) * 100) / 100;
}

function lookupRegionalLabor(scopeItem, context) {
  const key = normalizeLocationKey(context.projectLocation, context.zipCode);
  const wages = METRO_HOURLY_WAGES[key] || METRO_HOURLY_WAGES.default;
  const trade = scopeItem.trade;
  const assumptions = [
    `Regional wage benchmark (${key.replace(/_/g, ' ')}) — not final billing`,
    `Burden multiplier ${DEFAULT_LABOR_BURDEN}× applied (payroll, WC, OH, profit)`,
    'Productivity assumptions used to convert $/hr → $/unit',
  ];
  const rates = [];

  if (trade === 'demo' && scopeItem.unit === 'sqft') {
    const rate = hourlyToUnitRate(wages.laborers, PRODUCTIVITY_SQFT_PER_HR.demo);
    if (rate) {
      rates.push({
        pricingType: 'labor',
        label: 'Demo labor (benchmark)',
        rate,
        unit: 'sqft',
        confidence: 'medium',
        assumptions: [...assumptions, `~${PRODUCTIVITY_SQFT_PER_HR.demo} sqft/hr productivity`],
      });
    }
  } else if (trade === 'flooring' && scopeItem.unit === 'sqft') {
    const lab = hourlyToUnitRate(wages.carpenters, PRODUCTIVITY_SQFT_PER_HR.flooring_install);
    const mat = REGIONAL_MATERIAL_DEFAULTS.flooring.laminateMaterial;
    if (lab) {
      rates.push({
        pricingType: 'labor',
        label: 'Install labor (benchmark)',
        rate: lab,
        unit: 'sqft',
        confidence: 'medium',
        assumptions,
      });
    }
    if (mat) {
      rates.push({
        pricingType: 'material',
        label: 'Material allowance (regional default)',
        rate: mat,
        unit: 'sqft',
        confidence: 'low',
        assumptions: ['Regional material allowance — verify with supplier'],
      });
    }
  } else if (trade === 'baseboard' && scopeItem.unit === 'lf') {
    // National installed midpoints ($/LF) — not wage÷productivity (that understates trim vs market).
    const lab = AI_FALLBACK_RATES.baseboardLaborLf;
    const mat = REGIONAL_MATERIAL_DEFAULTS.flooring.baseboardMaterial;
    const baseboardAssumptions = [
      `National midpoint install labor ≈ $${NATIONAL_BASEBOARD_LF_DEFAULTS.labor}/LF (paint-grade trim, 2026)`,
      `Material allowance ≈ $${NATIONAL_BASEBOARD_LF_DEFAULTS.material}/LF — verify supplier quote`,
      'Caulk, paint, and waste may be additional — review scope',
    ];
    if (lab) {
      rates.push({
        pricingType: 'labor',
        label: 'Baseboard install labor (national midpoint)',
        rate: lab,
        unit: 'lf',
        confidence: 'medium',
        assumptions: baseboardAssumptions,
      });
    }
    if (mat) {
      rates.push({
        pricingType: 'material',
        label: 'Baseboard material (national midpoint)',
        rate: mat,
        unit: 'lf',
        confidence: 'low',
        assumptions: baseboardAssumptions,
      });
    }
  }

  return { available: rates.length > 0, rates, locationKey: key };
}

module.exports = { lookupRegionalLabor, hourlyToUnitRate, normalizeLocationKey };
