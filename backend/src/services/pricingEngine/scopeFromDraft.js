const { extractScopeQuantitiesForPackage } = require('../estimateDraftQuantityPrice');

function slugId(name) {
  return String(name || 'scope')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function classifyTrade(name) {
  const n = String(name || '').toLowerCase();
  if (/tile|demo|removal/.test(n)) return 'demo';
  if (/baseboard|trim/.test(n)) return 'baseboard';
  if (/laminate|flooring|lvp|install/.test(n)) return 'flooring';
  if (/paint/.test(n)) return 'painting';
  if (/plumb/.test(n)) return 'plumbing_service';
  if (/electric/.test(n)) return 'electrical';
  return 'other';
}

function scopeItemsFromDraft(draft) {
  const scopePackages = draft.scopePackages || draft.rooms || [];
  const packages =
    Array.isArray(scopePackages) && scopePackages[0]?.scope != null
      ? scopePackages
      : (draft.rooms || []).map((r) => ({
          name: r.name,
          scope: r.scope,
          scopeQuantities: r.scopeQuantities,
          status: r.packageStatus || r.status,
          price: r.price,
        }));

  const notes = draft.originalNotes || '';
  return packages.map((pkg) => {
    const qty =
      (pkg.scopeQuantities || [])[0] ||
      extractScopeQuantitiesForPackage(pkg.name, pkg.scope, notes)[0] ||
      null;
    const unit = qty?.unit || 'lump_sum';
    const quantity = qty?.quantity != null ? Number(qty.quantity) : null;
    return {
      scopeItemId: slugId(pkg.name),
      scopeName: pkg.name,
      scope: pkg.scope || '',
      trade: classifyTrade(pkg.name),
      quantity,
      unit: unit === 'sqft' || unit === 'lf' || unit === 'hr' || unit === 'each' ? unit : 'lump_sum',
      status: pkg.status,
      hasUserPrice: (pkg.price ?? 0) > 0,
    };
  });
}

module.exports = { scopeItemsFromDraft, classifyTrade, slugId };
