const { AI_FALLBACK_RATES } = require('../constants');
const {
  isPlumbingTrimScope,
  isElectricalTrimScope,
  isBaseboardTrimScope,
} = require('../sourceValidation');

function lookupAiFallback(scopeItem) {
  const name = scopeItem.scopeName.toLowerCase();
  const rates = [];
  const assumptions = [
    'No verified saved or live source matched',
    'AI rough estimate — planning only, not guaranteed accurate',
  ];

  if (isPlumbingTrimScope(scopeItem) || isElectricalTrimScope(scopeItem)) {
    return { available: false, rates: [] };
  }

  if (/tile|demo/.test(name) && scopeItem.unit === 'sqft') {
    rates.push({
      pricingType: 'labor',
      label: 'Tile demo (fallback)',
      rate: AI_FALLBACK_RATES.demoLaborSqft,
      unit: 'sqft',
      confidence: 'low',
      assumptions,
    });
  } else if (
    (/laminate|flooring/.test(name) || /install/.test(name)) &&
    !/baseboard/.test(name) &&
    scopeItem.unit === 'sqft'
  ) {
    rates.push({
      pricingType: 'material',
      label: 'Laminate material (fallback)',
      rate: AI_FALLBACK_RATES.laminateMaterialSqft,
      unit: 'sqft',
      confidence: 'low',
      assumptions,
    });
    rates.push({
      pricingType: 'labor',
      label: 'Laminate install (fallback)',
      rate: AI_FALLBACK_RATES.laminateLaborSqft,
      unit: 'sqft',
      confidence: 'low',
      assumptions,
    });
  } else if (isBaseboardTrimScope(scopeItem) && scopeItem.unit === 'lf') {
    rates.push({
      pricingType: 'material',
      label: 'Baseboard material (fallback)',
      rate: AI_FALLBACK_RATES.baseboardMaterialLf,
      unit: 'lf',
      confidence: 'low',
      assumptions,
    });
    rates.push({
      pricingType: 'labor',
      label: 'Baseboard labor (fallback)',
      rate: AI_FALLBACK_RATES.baseboardLaborLf,
      unit: 'lf',
      confidence: 'low',
      assumptions,
    });
  } else if (/paint/.test(name) && scopeItem.unit === 'lf') {
    rates.push({
      pricingType: 'material',
      label: 'Trim/baseboard material (fallback)',
      rate: AI_FALLBACK_RATES.baseboardMaterialLf,
      unit: 'lf',
      confidence: 'low',
      assumptions: [...assumptions, 'Linear-foot paint/trim scope priced as baseboard install'],
    });
    rates.push({
      pricingType: 'labor',
      label: 'Trim/baseboard labor (fallback)',
      rate: AI_FALLBACK_RATES.baseboardLaborLf,
      unit: 'lf',
      confidence: 'low',
      assumptions,
    });
  }

  return { available: rates.length > 0, rates };
}

module.exports = { lookupAiFallback };
