const flags = require('./flags');
const registry = require('./tradeMeasurementRegistry');
const { buildAreaReconciliation } = require('./areaReconciliation');
const pricingBasisValidation = require('./pricingBasisValidation');

module.exports = {
  ...flags,
  ...registry,
  buildAreaReconciliation,
  ...pricingBasisValidation,
};
