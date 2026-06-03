const { AI_FALLBACK_RATES } = require('../constants');

function lookupAiFallback(scopeItem) {
  const name = scopeItem.scopeName.toLowerCase();
  const rates = [];
  const assumptions = [
    'No verified saved or live source matched',
    'Planning-only fallback — not guaranteed accurate',
  ];

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
  } else if (/baseboard|trim/.test(name) && scopeItem.unit === 'lf') {
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
  }

  return { available: rates.length > 0, rates };
}

module.exports = { lookupAiFallback };
