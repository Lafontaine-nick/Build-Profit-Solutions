/**
 * Licensed county-level construction cost database (e.g. 1build) — stub until
 * integrated. Interim regional adjustment is applied as a multiplier over the
 * national averages in `sources/nationalTradeAverage.js`
 * (see `regionalCostFactors.js`); this slot is reserved for real county-level
 * live cost data once a provider is wired in.
 */
function lookupCostDatabase(_scopeItem, _context) {
  return {
    available: false,
    rates: [],
    message: 'Licensed county-level cost database not configured (using regional-adjusted national averages)',
  };
}

module.exports = { lookupCostDatabase };
