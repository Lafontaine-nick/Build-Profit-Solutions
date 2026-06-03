/**
 * Extract pricing memory entries from applied/submitted/won bids — never from raw unapplied drafts.
 */

const { parseSquareFeetFromText, parseLinearFeetFromText } = require('../estimateDraftFromNotes');

const CAPTURE_SOURCES = new Set([
  'user_provided',
  'calculated',
  'approved_ai_suggested',
  'saved_template',
]);

const CAPTURE_BID_STATUSES = new Set(['applied', 'submitted', 'won', 'completed', 'lost']);

function isTestBid(meta = {}) {
  if (meta.isTestBid || meta.isDemo) return true;
  const title = `${meta.projectTitle || ''} ${meta.bidTitle || ''}`.toLowerCase();
  return /\b(test|demo|sample|example)\b/.test(title);
}

function shouldCapturePackage(pkg) {
  if (!pkg) return false;
  if (pkg.status === 'missing_price') return false;
  if (pkg.status === 'rough_price') return false;
  if (pkg.status === 'ai_suggested' && !pkg.splitApprovedByUser) return false;
  if (['calculated', 'user_provided', 'confirmed', 'partial_pricing'].includes(pkg.status)) {
    return (pkg.price != null && pkg.price > 0) || (pkg.knownSubtotal != null && pkg.knownSubtotal > 0);
  }
  return false;
}

function inferUnitType(unit, scopeName, formula) {
  const blob = `${unit || ''} ${scopeName || ''} ${formula || ''}`.toLowerCase();
  if (/\blf\b|linear\s*ft|\/lf|per\s*lf/.test(blob)) return 'lf';
  if (/\bsq\.?\s*ft|\bsf\b|\/sqft|per\s*sq/.test(blob)) return 'sqft';
  if (/\bhour|\bhr\b|\/hr/.test(blob)) return 'hour';
  if (/\beach|\bea\b|\/ea/.test(blob)) return 'each';
  if (/\bday\b|\/day/.test(blob)) return 'day';
  if (/\bsquare\b|\bsq\b(?!ft)/.test(blob)) return 'square';
  if (/\byard|\bcy\b/.test(blob)) return 'yard';
  return 'lump_sum';
}

function parseQuantityFromPackage(pkg, draft) {
  const scope = `${pkg.scope || ''} ${pkg.name || ''}`;
  const lf = parseLinearFeetFromText(scope, draft?.projectDescription);
  if (lf) return { quantity: lf, unitType: 'lf' };
  const sqft = parseSquareFeetFromText(scope, draft?.projectDescription);
  if (sqft) return { quantity: sqft, unitType: 'sqft' };
  return { quantity: null, unitType: null };
}

function entriesFromPackage(pkg, draft, meta) {
  const entries = [];
  const { quantity: parsedQty, unitType: parsedUnit } = parseQuantityFromPackage(pkg, draft);
  const trade = pkg.trade || draft.projectType || 'other';
  const pricingSource =
    pkg.status === 'calculated'
      ? 'calculated'
      : pkg.splitIsSuggested && pkg.splitApprovedByUser
        ? 'approved_ai_suggested'
        : 'user_provided';

  const pushRate = (scopeItemName, category, amount, unitType, quantity) => {
    if (amount == null || amount <= 0) return;
    let unitRate = null;
    let qty = quantity;
    const uType = unitType || inferUnitType(null, scopeItemName, pkg.formula);
    if (qty != null && qty > 0 && uType !== 'lump_sum') {
      unitRate = Math.round((amount / qty) * 100) / 100;
    }
    entries.push({
      projectType: draft.projectType || 'other',
      trade,
      category,
      scopeItemName,
      unitType: uType,
      quantity: qty,
      unitRate,
      laborAmount: category === 'labor' ? Math.round(amount) : null,
      materialAmount: category === 'material' ? Math.round(amount) : null,
      totalAmount: Math.round(amount),
      pricingSource,
      bidStatus: meta.bidStatus || 'applied',
      projectId: meta.projectId || null,
      estimateId: meta.estimateId || null,
      region: meta.region || draft.region || null,
      markupPct: meta.markupPct ?? null,
      marginPct: meta.marginPct ?? null,
      isTestBid: isTestBid(meta),
    });
  };

  if (pkg.laborPrice != null && pkg.laborPrice > 0) {
    const name = `${pkg.name} — labor`;
    pushRate(name, 'labor', pkg.laborPrice, parsedUnit, parsedQty);
  }
  if (pkg.materialPrice != null && pkg.materialPrice > 0) {
    const name = `${pkg.name} — materials`;
    pushRate(name, 'material', pkg.materialPrice, parsedUnit, parsedQty);
  }

  if (pkg.laborPrice == null && pkg.materialPrice == null && pkg.price != null && pkg.price > 0) {
    entries.push({
      projectType: draft.projectType || 'other',
      trade,
      category: 'lump_sum',
      scopeItemName: pkg.name,
      unitType: 'lump_sum',
      quantity: null,
      unitRate: null,
      totalAmount: Math.round(pkg.price),
      pricingSource,
      bidStatus: meta.bidStatus || 'applied',
      projectId: meta.projectId || null,
      estimateId: meta.estimateId || null,
      region: meta.region || null,
      markupPct: meta.markupPct ?? null,
      marginPct: meta.marginPct ?? null,
      isTestBid: isTestBid(meta),
    });
  }

  for (const item of pkg.pricingItems || []) {
    if (item.amount == null || item.amount <= 0) continue;
    if (item.status === 'ai_suggested' && !item.approvedByUser) continue;
    if (item.status === 'rough_price') continue;
    const cat =
      item.pricingType === 'material' ? 'material' : item.pricingType === 'labor' ? 'labor' : 'labor';
    pushRate(
      item.name || `${pkg.name} line item`,
      cat,
      item.amount,
      item.unit || inferUnitType(item.unit, item.name),
      item.quantity
    );
  }

  return entries;
}

function entriesFromAllowances(draft, meta) {
  const entries = [];
  for (const a of draft.allowances || []) {
    if (a.status !== 'calculated' && a.status !== 'confirmed') continue;
    const rate = a.rate ?? a.amount;
    if (rate == null || rate <= 0) continue;
    const unitType = inferUnitType(a.unit, a.name, a.description);
    entries.push({
      projectType: draft.projectType || 'other',
      trade: draft.detectedTrades?.[0] || draft.projectType || 'other',
      category: a.kind === 'material' ? 'material' : a.kind === 'labor' ? 'labor' : 'material',
      scopeItemName: a.name || a.description || 'Allowance',
      unitType,
      quantity: a.quantity,
      unitRate: rate,
      materialAmount: a.kind === 'material' && a.calculatedAmount ? a.calculatedAmount : null,
      laborAmount: a.kind === 'labor' && a.calculatedAmount ? a.calculatedAmount : null,
      totalAmount: a.calculatedAmount || null,
      pricingSource: 'calculated',
      bidStatus: meta.bidStatus || 'applied',
      region: meta.region || null,
      isTestBid: isTestBid(meta),
    });
  }
  return entries;
}

function entriesFromBidLineItems(bid, meta) {
  const entries = [];
  const labor = Array.isArray(bid?.laborLineItems) ? bid.laborLineItems : [];
  const materials = Array.isArray(bid?.materialLineItems) ? bid.materialLineItems : [];

  for (const line of labor) {
    const total = Number(line.total || line.totalCost || line.rate || 0);
    if (total <= 0) continue;
    if (line.source === 'ai-draft' && line.splitIsSuggested && !line.splitApprovedByUser) continue;
    entries.push({
      projectType: bid.projectType || 'other',
      trade: bid.projectType || 'other',
      category: 'labor',
      scopeItemName: String(line.name || 'Labor').trim(),
      unitType: 'lump_sum',
      totalAmount: Math.round(total),
      laborAmount: Math.round(total),
      pricingSource: line.priceProvidedByUser ? 'user_provided' : 'calculated',
      bidStatus: meta.bidStatus || 'applied',
      projectId: bid.id || meta.projectId,
      isTestBid: isTestBid(meta),
    });
  }

  for (const line of materials) {
    const total = Number(line.total || line.cost || line.unitPrice || 0);
    if (total <= 0) continue;
    entries.push({
      projectType: bid.projectType || 'other',
      trade: bid.projectType || 'other',
      category: 'material',
      scopeItemName: String(line.name || 'Materials').trim(),
      unitType: 'lump_sum',
      totalAmount: Math.round(total),
      materialAmount: Math.round(total),
      pricingSource: 'user_provided',
      bidStatus: meta.bidStatus || 'applied',
      projectId: bid.id || meta.projectId,
      isTestBid: isTestBid(meta),
    });
  }

  return entries;
}

/**
 * @param {{ draft?: object, bid?: object, meta?: object }} payload
 */
function extractCaptureEntries(payload) {
  const { draft = {}, bid = {}, meta = {} } = payload;
  if (isTestBid(meta) && meta.excludeTestBids !== false) return [];

  const bidStatus = String(meta.bidStatus || 'applied').toLowerCase();
  if (!CAPTURE_BID_STATUSES.has(bidStatus)) return [];

  const entries = [];
  const packages = draft.scopePackages || draft.rooms || [];

  if (Array.isArray(draft.scopePackages)) {
    for (const pkg of draft.scopePackages) {
      if (!shouldCapturePackage(pkg)) continue;
      entries.push(...entriesFromPackage(pkg, draft, meta));
    }
  }

  entries.push(...entriesFromAllowances(draft, meta));

  if (entries.length === 0 && bid) {
    entries.push(...entriesFromBidLineItems(bid, meta));
  }

  return entries.filter((e) => {
    if (!e.scopeItemName) return false;
    if (!CAPTURE_SOURCES.has(e.pricingSource) && e.pricingSource !== 'saved_template') return false;
    return (e.unitRate != null && e.unitRate > 0) || (e.totalAmount != null && e.totalAmount > 0);
  });
}

module.exports = {
  extractCaptureEntries,
  isTestBid,
  shouldCapturePackage,
};
