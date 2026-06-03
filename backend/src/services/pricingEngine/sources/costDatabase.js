/**
 * Licensed construction cost database — stub until integrated.
 */
function lookupCostDatabase(_scopeItem, _context) {
  return {
    available: false,
    rates: [],
    message: 'Construction cost database not configured',
  };
}

module.exports = { lookupCostDatabase };
