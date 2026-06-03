const { REGIONAL_DEFAULTS_BY_TRADE } = require('../constants');

function lookupCompanyDefault(scopeItem, context) {
  const trade = scopeItem.trade || 'other';
  const defs = REGIONAL_DEFAULTS_BY_TRADE[trade] || REGIONAL_DEFAULTS_BY_TRADE.other;
  const rates = [];
  const companyRates = context.companyDefaultRates || {};

  if (companyRates[trade]) {
    const cr = companyRates[trade];
    if (cr.material && scopeItem.unit === (cr.unit || 'sqft')) {
      rates.push({
        pricingType: 'material',
        label: 'Company material default',
        rate: cr.material,
        unit: cr.unit || scopeItem.unit,
        confidence: 'medium',
        assumptions: ['From company default rate table'],
      });
    }
    if (cr.labor && scopeItem.unit === (cr.unit || 'sqft')) {
      rates.push({
        pricingType: 'labor',
        label: 'Company labor default',
        rate: cr.labor,
        unit: cr.unit || scopeItem.unit,
        confidence: 'medium',
        assumptions: ['From company default rate table'],
      });
    }
  }

  if (trade === 'demo' || trade === 'baseboard' || trade === 'flooring') {
    return { available: false, rates: [] };
  }

  if (!rates.length && scopeItem.unit === (defs.unit || 'sqft')) {
    if (defs.material) {
      rates.push({
        pricingType: 'material',
        label: 'Company trade default (material)',
        rate: defs.material,
        unit: defs.unit,
        confidence: 'low',
        assumptions: ['System company default by trade — customize in settings'],
      });
    }
    if (defs.labor) {
      rates.push({
        pricingType: 'labor',
        label: 'Company trade default (labor)',
        rate: defs.labor,
        unit: defs.unit,
        confidence: 'low',
        assumptions: ['System company default by trade — customize in settings'],
      });
    }
  }

  return { available: rates.length > 0, rates };
}

module.exports = { lookupCompanyDefault };
