const { getPricingProposal } = require('./getPricingProposal');
const { toLegacyProposal } = require('./toLegacyProposal');
const { SOURCE_LABELS, PRICING_DISCLAIMER, SOURCE_PRIORITY } = require('./constants');

module.exports = {
  getPricingProposal,
  toLegacyProposal,
  SOURCE_LABELS,
  PRICING_DISCLAIMER,
  SOURCE_PRIORITY,
  classifyScopeItem: require('./scopeClassification').classifyScopeItem,
  validateScopeItemPricing: require('./globalPricingValidation').validateScopeItemPricing,
  runGlobalPricingPipeline: require('./validateSuggestedPrice').runGlobalPricingPipeline,
  resolveScopePricingRule: require('./scopePricingMatrix').resolveScopePricingRule,
  REVIEW_STATUS: require('./globalPricingValidation').REVIEW_STATUS,
};
