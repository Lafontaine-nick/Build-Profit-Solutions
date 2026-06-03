/**
 * Saved pricing / templates should only apply when rates are per-unit (sqft, LF, hr),
 * not flat job totals that cannot scale to scope quantities.
 */

const UNIT_RATE_TYPES = new Set(['sqft', 'sf', 'sq_ft', 'lf', 'lnft', 'linear_ft', 'hr', 'hour', 'each', 'ea']);

const FLAT_UNITS = new Set(['lot', 'lump_sum', 'lump', 'flat', 'job', 'project', 'total']);

function normalizeUnit(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function normalizeScopeUnit(unit) {
  const u = normalizeUnit(unit);
  if (u === 'sq_ft' || u === 'sf') return 'sqft';
  if (u === 'lnft' || u === 'linear_ft') return 'lf';
  return u;
}

/**
 * @param {object} line - template or bid line item
 * @param {string} [scopeUnit] - sqft | lf | hr from scope item
 */
function isUnitBasedLineItem(line, scopeUnit) {
  const mode = String(line.mode || line.pricingMode || '').toLowerCase();
  if (mode === 'flat' || mode === 'lump' || mode === 'lump_sum') return false;
  if (mode === 'sqft' || mode === 'lf' || mode === 'hr') return true;

  const unit = normalizeUnit(line.unit);
  if (FLAT_UNITS.has(unit)) return false;
  if (UNIT_RATE_TYPES.has(unit)) {
    return unitMatchesScope(unit, scopeUnit);
  }

  const qty = Number(line.quantity || line.qty || 0) || 0;
  const unitPrice = Number(line.unitPrice || line.rate || line.cost || 0);
  const total = Number(line.total || 0);

  // Flat amount stored as qty=1, unit lot, total = job price
  if (qty <= 1 && (unit === '' || unit === 'lot') && total > 0) {
    if (unitPrice <= 0 || Math.abs(unitPrice - total) < 1) return false;
  }

  // Derivable per-unit rate when quantity matches scope
  if (qty > 1 && unitPrice > 0 && scopeUnit) {
    const scopeNorm = normalizeScopeUnit(scopeUnit);
    if (unit.includes('sq') && scopeNorm === 'sqft') return unitPrice < 500;
    if (unit.includes('lf') && scopeNorm === 'lf') return unitPrice < 200;
  }

  return false;
}

function unitMatchesScope(lineUnit, scopeUnit) {
  if (!scopeUnit) return true;
  const s = normalizeScopeUnit(scopeUnit);
  const l = normalizeUnit(lineUnit);
  if (s === 'sqft') return l.includes('sq') || l === 'sf';
  if (s === 'lf') return l.includes('lf') || l.includes('linear');
  if (s === 'hr') return l.includes('hr') || l.includes('hour');
  return true;
}

function isUnitBasedMemoryEntry(entry) {
  const unitType = normalizeUnit(entry.unitType);
  if (FLAT_UNITS.has(unitType) || unitType === 'lump_sum') return false;
  if (!entry.unitRate || entry.unitRate <= 0) return false;
  if (UNIT_RATE_TYPES.has(unitType)) return true;
  return unitType === 'sqft' || unitType === 'lf' || unitType === 'hr';
}

/**
 * Build rate row from a unit-based template line scaled to scope quantity.
 */
function rateFromUnitBasedLine(line, scopeItem) {
  const scopeUnit = scopeItem.unit;
  if (!isUnitBasedLineItem(line, scopeUnit)) return null;

  const qty = Number(line.quantity || line.qty || 0);
  const unitPrice = Number(line.unitPrice || line.rate || line.cost || 0);
  const scopeQty = scopeItem.quantity;

  let rate = unitPrice;
  if (rate <= 0 && qty > 1 && Number(line.total) > 0) {
    rate = Number(line.total) / qty;
  }
  if (rate <= 0 || !scopeQty || scopeQty <= 0) return null;

  const lineUnit = normalizeUnit(line.unit);
  const scopeNorm = normalizeScopeUnit(scopeUnit);
  if (!unitMatchesScope(lineUnit, scopeUnit) && String(line.mode || '') !== scopeNorm) {
    return null;
  }

  // Reject absurd derived rates (flat total / 1 sqft mislabeled)
  if (scopeNorm === 'sqft' && rate > 200) return null;
  if (scopeNorm === 'lf' && rate > 100) return null;

  return {
    rate: Math.round(rate * 100) / 100,
    unit: scopeUnit,
    quantity: scopeQty,
  };
}

module.exports = {
  isUnitBasedLineItem,
  isUnitBasedMemoryEntry,
  rateFromUnitBasedLine,
  normalizeScopeUnit,
};
