const { extractScopeQuantitiesForPackage } = require('../estimateDraftQuantityPrice');
const { expandJobScopeRooms } = require('../estimateDraftScopeSplit');
const { classifyTradeForPricing } = require('./tradeClassifier');

function slugId(name) {
  return String(name || 'scope')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function classifyTrade(name, scope = '', notes = '', projectType = '') {
  return classifyTradeForPricing(name, scope, notes, projectType);
}

function pickScopeQuantity(pkg, notes) {
  const fromPkg = pkg.scopeQuantities || [];
  const extracted =
    fromPkg.length > 0 ? fromPkg : extractScopeQuantitiesForPackage(pkg.name, pkg.scope, notes);
  if (!extracted.length) return null;

  const name = String(pkg.name || '').toLowerCase();
  if (/baseboard|trim/.test(name)) {
    return extracted.find((q) => q.unit === 'lf') || extracted[0];
  }
  if (/tile|demo|laminate|flooring|lvp|floor/.test(name)) {
    return extracted.find((q) => q.unit === 'sqft') || extracted[0];
  }
  return extracted[0];
}

function scopeItemsFromDraft(draft) {
  const notes = draft.originalNotes || '';
  const projectType = draft.projectType || '';
  const expandedRooms = expandJobScopeRooms(draft.rooms || [], notes, { aggressive: true });
  const packages = expandedRooms.map((r) => ({
    name: r.name,
    scope: r.scope,
    scopeQuantities: r.scopeQuantities,
    status: r.packageStatus || r.status,
    price: r.price,
  }));
  return packages.map((pkg) => {
    const qty = pickScopeQuantity(pkg, notes);
    const unit = qty?.unit || 'lump_sum';
    const quantity = qty?.quantity != null ? Number(qty.quantity) : null;
    return {
      scopeItemId: slugId(pkg.name),
      scopeName: pkg.name,
      scope: pkg.scope || '',
      trade: classifyTrade(pkg.name, pkg.scope, notes, projectType),
      quantity,
      unit: unit === 'sqft' || unit === 'lf' || unit === 'hr' || unit === 'each' ? unit : 'lump_sum',
      status: pkg.status,
      hasUserPrice: (pkg.price ?? 0) > 0,
    };
  });
}

module.exports = { scopeItemsFromDraft, classifyTrade, slugId, pickScopeQuantity };
