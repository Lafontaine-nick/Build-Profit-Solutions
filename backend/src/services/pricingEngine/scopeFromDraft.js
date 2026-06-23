const { extractScopeQuantitiesForPackage } = require('../estimateDraftQuantityPrice');
const { expandJobScopeRooms } = require('../estimateDraftScopeSplit');
const { parseLinearFeetFromText } = require('../estimateDraftFromNotes');
const { classifyTradeForPricing } = require('./tradeClassifier');
const { inferPlanningQuantity } = require('./planningQuantities');
const {
  normalizeScopeMeasurements,
  resolveQuantityForPackage,
  isPlaceholderAllowancePricing,
  isQuantityValidForPricing,
  getRuleForPackage,
  lookupRuleKeyForPackage,
} = require('../scopeItemQuantityCatalog');

function slugId(name) {
  return String(name || 'scope')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function classifyTrade(name, scope = '', notes = '', projectType = '') {
  return classifyTradeForPricing(name, scope, notes, projectType);
}

function pickScopeQuantity(pkg, notes, draft = {}) {
  const measurements = normalizeScopeMeasurements(draft.scopeMeasurements || {});
  const ctx = { measurements, notes };
  const ruleKey = lookupRuleKeyForPackage(pkg.name, pkg.scope || '');

  const fromPkg = pkg.scopeQuantities || [];
  if (fromPkg.length) {
    const catalogResolved = resolveQuantityForPackage(pkg.name, pkg.scope, {
      ...ctx,
      existingQuantities: fromPkg,
    });
    if (catalogResolved.pricingReady && catalogResolved.quantity != null) {
      return {
        quantity: catalogResolved.quantity,
        unit: catalogResolved.unit,
        label: catalogResolved.label,
        quantitySource: catalogResolved.quantitySource,
      };
    }
    const rule = getRuleForPackage(pkg.name, pkg.scope);
    const q = fromPkg[0];
    if (
      q &&
      !isPlaceholderAllowancePricing(q.quantity, q.unit, ruleKey) &&
      isQuantityValidForPricing({ quantity: q.quantity, unit: q.unit }, rule)
    ) {
      return { quantity: q.quantity, unit: q.unit, label: q.label, quantitySource: q.quantitySource };
    }
  }

  const catalogQty = resolveQuantityForPackage(pkg.name, pkg.scope, ctx);
  if (catalogQty.pricingReady && catalogQty.quantity != null) {
    return {
      quantity: catalogQty.quantity,
      unit: catalogQty.unit,
      label: catalogQty.label,
      quantitySource: catalogQty.quantitySource,
    };
  }

  const extracted = extractScopeQuantitiesForPackage(pkg.name, pkg.scope, notes);
  if (extracted.length) {
    const name = String(pkg.name || '').toLowerCase();
    const rule = getRuleForPackage(pkg.name, pkg.scope);
    if (/baseboard|trim/.test(name)) {
      const lfQty = extracted.find((q) => q.unit === 'lf');
      if (lfQty && (!rule || rule.allowedUnits.includes('lf'))) return lfQty;
      const lfFromNotes = parseLinearFeetFromText(notes, pkg.scope, pkg.name);
      if (lfFromNotes) return { quantity: lfFromNotes, unit: 'lf', label: 'length' };
      return null;
    }
    const match = rule
      ? extracted.find((q) => rule.allowedUnits.includes(q.unit))
      : extracted[0];
    if (match) return match;
  }

  const planning = inferPlanningQuantity(pkg.name, pkg.scope, draft);
  if (planning) {
    const rule = getRuleForPackage(pkg.name, pkg.scope);
    if (rule && !rule.allowedUnits.includes(planning.unit)) return null;
    if (
      rule?.requiresUserQuantity &&
      planning.isPlanningDefault &&
      draft.scopeAssumptionsConfirmed
    ) {
      return null;
    }
    return planning;
  }

  return null;
}

function scopeItemsFromDraft(draft) {
  const notes = draft.originalNotes || '';
  const projectType = draft.projectType || '';
  const expandedRooms = expandJobScopeRooms(draft.rooms || [], notes, { aggressive: true });
  const scopePkgByName = new Map((draft.scopePackages || []).map((p) => [p.name, p]));
  const packages = expandedRooms.map((r) => {
    const fromScopePkg = scopePkgByName.get(r.name);
    const scopeQuantities =
      (r.scopeQuantities?.length ? r.scopeQuantities : null) ??
      (fromScopePkg?.scopeQuantities?.length ? fromScopePkg.scopeQuantities : null) ??
      undefined;
    return {
      name: r.name,
      scope: r.scope || fromScopePkg?.scope || '',
      scopeQuantities,
      status: r.packageStatus || r.status || fromScopePkg?.status,
      price: r.price ?? fromScopePkg?.price,
    };
  });
  return packages.map((pkg) => {
    const qty = pickScopeQuantity(pkg, notes, draft);
    const unit = qty?.unit || 'lump_sum';
    const quantity = qty?.quantity != null ? Number(qty.quantity) : null;
    const pricingReady = quantity != null && quantity > 0;
    const normalizedUnit = String(unit || '').toLowerCase();
    const supportedUnit = ['sqft', 'lf', 'hr', 'hour', 'each', 'cy', 'squares', 'square', 'allowance', 'lump_sum'].includes(
      normalizedUnit
    )
      ? normalizedUnit
      : 'lump_sum';
    return {
      scopeItemId: slugId(pkg.name),
      scopeName: pkg.name,
      scope: pkg.scope || '',
      trade: classifyTrade(pkg.name, pkg.scope, notes, projectType),
      quantity,
      unit: supportedUnit === 'hour' ? 'hr' : supportedUnit === 'square' ? 'squares' : supportedUnit,
      status: pkg.status,
      hasUserPrice: (pkg.price ?? 0) > 0,
      pricingReady,
      quantitySource: qty?.quantitySource || null,
    };
  });
}

module.exports = { scopeItemsFromDraft, classifyTrade, slugId, pickScopeQuantity };
