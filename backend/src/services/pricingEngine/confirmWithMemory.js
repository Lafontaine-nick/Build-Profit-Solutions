const { lookupSavedPricing } = require('./sources/savedPricing');

/**
 * Cross-check a proposed unit rate against contractor pricing library.
 */
function confirmRateWithMemory(scopeItem, rate, unit, userId) {
  const memory = lookupSavedPricing(scopeItem, userId);
  if (!memory.available || !memory.rates?.length) {
    return {
      confirmed: false,
      confidence: 'medium',
      note: 'No matching unit rate in your pricing library to confirm.',
    };
  }

  const role = unit;
  const relevant = memory.rates.filter((r) => r.unit === unit || !unit);
  if (!relevant.length) {
    return {
      confirmed: false,
      confidence: 'medium',
      note: 'Pricing library has rates for this scope but not this unit type.',
    };
  }

  const memRate = relevant[0].rate;
  if (memRate == null || rate == null) {
    return { confirmed: false, confidence: 'medium', note: null };
  }

  const diff = Math.abs(memRate - rate) / Math.max(memRate, rate, 1);
  if (diff <= 0.15) {
    return {
      confirmed: true,
      confidence: 'high',
      memoryRate: memRate,
      note: `Confirmed by your pricing library (~$${memRate}/${unit}).`,
    };
  }
  if (diff <= 0.35) {
    return {
      confirmed: true,
      confidence: 'medium',
      memoryRate: memRate,
      note: `Similar to your library ($${memRate}/${unit}); review before applying.`,
    };
  }

  return {
    confirmed: false,
    confidence: 'low',
    memoryRate: memRate,
    note: `Template $${rate}/${unit} differs from library $${memRate}/${unit} — review both.`,
  };
}

module.exports = { confirmRateWithMemory };
