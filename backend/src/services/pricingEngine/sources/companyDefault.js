function lookupCompanyDefault(scopeItem, context) {
  const trade = scopeItem.trade || 'other';
  const rates = [];
  const companyRates = context.companyDefaultRates || {};

  // Only explicit company-configured rates — system defaults use national_trade_average.
  if (companyRates[trade]) {
    const cr = companyRates[trade];
    if (cr.material && scopeItem.unit === (cr.unit || 'sqft')) {
      rates.push({
        pricingType: 'material',
        label: 'Company material default',
        rate: cr.material,
        unit: cr.unit || scopeItem.unit,
        confidence: 'medium',
        assumptions: ['From your company default rate table'],
      });
    }
    if (cr.labor && scopeItem.unit === (cr.unit || 'sqft')) {
      rates.push({
        pricingType: 'labor',
        label: 'Company labor default',
        rate: cr.labor,
        unit: cr.unit || scopeItem.unit,
        confidence: 'medium',
        assumptions: ['From your company default rate table'],
      });
    }
  }

  return { available: rates.length > 0, rates };
}

module.exports = { lookupCompanyDefault };
