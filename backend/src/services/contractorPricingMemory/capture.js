/**
 * Extract pricing memory entries from applied/submitted/won bids — never from raw unapplied drafts.
 */

const { parseSquareFeetFromText, parseLinearFeetFromText } = require('../estimateDraftFromNotes');

/** Pricing library only stores rates the contractor typed or confirmed manually. */
const CAPTURE_SOURCES = new Set(['user_provided']);

function packagePricingWasManuallyEntered(pkg, draft) {
  const itemId = String(pkg?.checklistItemId || pkg?.costCode || '').trim();
  const acceptance = itemId ? draft?.scopeMeasurements?.pricingAcceptance?.[itemId] : null;
  if (!acceptance) return null;
  const sourceKind = String(acceptance.pricingSourceKind || '').toLowerCase();
  const selectionStatus = String(acceptance.selectionStatus || '').toLowerCase();
  return (
    sourceKind === 'user_entered' ||
    selectionStatus === 'manual_adjusted'
  );
}

function isManuallyProvidedPackage(pkg, draft) {
  if (!pkg) return false;
  const acceptanceManual = packagePricingWasManuallyEntered(pkg, draft);
  // Confirm Scope metadata is authoritative when available. Applying a
  // national-average/saved-rate suggestion marks the package user-provided
  // for bid application, but it is not a contractor-entered library rate.
  if (acceptanceManual === false) return false;
  if (
    pkg.status === 'calculated' ||
    pkg.status === 'rough_price' ||
    pkg.status === 'missing_price'
  ) {
    return false;
  }
  if (pkg.status === 'ai_suggested' && !pkg.splitApprovedByUser) return false;
  if (pkg.priceProvidedByUser) return true;
  if (pkg.status === 'user_provided') return true;
  const src = String(pkg.priceSource || '').toLowerCase();
  if (src === 'user_provided' || src === 'manual') return true;
  return pkg.status === 'confirmed' && Boolean(pkg.priceProvidedByUser);
}

const CAPTURE_BID_STATUSES = new Set(['applied', 'submitted', 'won', 'completed', 'lost']);

/** Checklist items priced as flat allowances (permits, plans, fees). */
const LUMP_SUM_CHECKLIST_IDS = new Set([
  'permits',
  'plans_engineering',
  'contingency',
  'appliances',
  'cleanup',
  'haul_off',
  'survey',
  'mobilization',
  'general_conditions',
  'supervision',
  'overhead_profit',
  'final_inspections',
  'emergency_fee',
  'interior_finishes',
  'mirror_accessories',
]);

function isTestBid(meta = {}) {
  if (meta.isTestBid || meta.isDemo) return true;
  const title = `${meta.projectTitle || ''} ${meta.bidTitle || ''}`.toLowerCase();
  return /\b(test|demo|sample|example)\b/.test(title);
}

function shouldCapturePackage(pkg, draft) {
  if (!isManuallyProvidedPackage(pkg, draft)) return false;
  if (pkg.laborPrice != null && pkg.laborPrice > 0) return true;
  if (pkg.materialPrice != null && pkg.materialPrice > 0) return true;
  if (pkg.price != null && pkg.price > 0) return true;
  if (pkg.knownSubtotal != null && pkg.knownSubtotal > 0) return true;
  if (Array.isArray(pkg.pricingItems)) {
    return pkg.pricingItems.some(
      (item) =>
        item.amount != null &&
        item.amount > 0 &&
        item.status !== 'rough_price' &&
        item.status !== 'ai_suggested'
    );
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
  const fromMeasurements = sqftFromDraftMeasurements(pkg, draft);
  if (fromMeasurements) return fromMeasurements;
  return { quantity: null, unitType: null };
}

/** Sqft takeoff from persisted scope measurements when package text omits area. */
function sqftFromDraftMeasurements(pkg, draft) {
  const id = String(pkg.checklistItemId || '').trim();
  const sm = draft.scopeMeasurements || {};
  const byChecklist = {
    waterproofing: ['showerWallTileSqft'],
    shower_tile: ['showerWallTileSqft'],
    shower_floor_tile: ['showerFloorTileSqft'],
    shower_pan: ['showerFloorTileSqft'],
    floor_tile: ['bathroomFloorSqft', 'kitchenFloorSqft', 'floorAreaSqft'],
    floor_demo: ['bathroomFloorSqft', 'kitchenFloorSqft', 'floorAreaSqft', 'flooringSqft'],
    flooring: ['bathroomFloorSqft', 'kitchenFloorSqft', 'floorAreaSqft', 'flooringSqft'],
    demo: ['bathroomFloorSqft', 'kitchenFloorSqft', 'floorAreaSqft'],
    interior_paint: ['wallPaintSqft'],
    patch_repair: ['drywallSqft'],
    drywall: ['drywallSqft'],
  };
  const keys = byChecklist[id];
  if (keys) {
    for (const key of keys) {
      const raw = sm[key];
      const n = Number(String(raw ?? '').replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) return { quantity: n, unitType: 'sqft' };
    }
  }
  const iq = sm.itemQuantities?.[id];
  if (iq) {
    const unit = String(iq.unit || '').toLowerCase();
    if (/sqft|sf|sq\.?\s*ft/.test(unit)) {
      const n = Number(String(iq.quantity ?? '').replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) return { quantity: n, unitType: 'sqft' };
    }
  }
  return null;
}

function entriesFromPackage(pkg, draft, meta) {
  if (!isManuallyProvidedPackage(pkg, draft)) return [];
  const entries = [];
  const { quantity: parsedQty, unitType: parsedUnit } = parseQuantityFromPackage(pkg, draft);
  const trade = pkg.trade || draft.projectType || 'other';
  const checklistItemId = pkg.checklistItemId || pkg.costCode || null;
  const pricingSource = 'user_provided';

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
      checklistItemId,
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
    const lumpId = String(checklistItemId || '').trim();
    const lumpUnitType = LUMP_SUM_CHECKLIST_IDS.has(lumpId) ? 'allowance' : 'lump_sum';
    entries.push({
      projectType: draft.projectType || 'other',
      trade,
      category: 'lump_sum',
      scopeItemName: pkg.name,
      checklistItemId,
      unitType: lumpUnitType,
      quantity: lumpUnitType === 'allowance' ? 1 : null,
      unitRate: lumpUnitType === 'allowance' ? Math.round(pkg.price) : null,
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
    if (item.status === 'calculated') continue;
    const itemManual =
      item.priceProvidedByUser ||
      item.status === 'user_provided' ||
      ['user_provided', 'manual'].includes(String(item.priceSource || '').toLowerCase());
    if (!itemManual) continue;
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

function entriesFromBidLineItems(bid, meta) {
  const entries = [];
  const labor = Array.isArray(bid?.laborLineItems) ? bid.laborLineItems : [];
  const materials = Array.isArray(bid?.materialLineItems) ? bid.materialLineItems : [];

  for (const line of labor) {
    if (!line.priceProvidedByUser) continue;
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
      pricingSource: 'user_provided',
      bidStatus: meta.bidStatus || 'applied',
      projectId: bid.id || meta.projectId,
      isTestBid: isTestBid(meta),
    });
  }

  for (const line of materials) {
    if (!line.priceProvidedByUser) continue;
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
      if (!shouldCapturePackage(pkg, draft)) continue;
      entries.push(...entriesFromPackage(pkg, draft, meta));
    }
  }

  if (entries.length === 0 && bid) {
    entries.push(...entriesFromBidLineItems(bid, meta));
  }

  return entries.filter((e) => {
    if (!e.scopeItemName) return false;
    if (!CAPTURE_SOURCES.has(e.pricingSource)) return false;
    return (e.unitRate != null && e.unitRate > 0) || (e.totalAmount != null && e.totalAmount > 0);
  });
}

module.exports = {
  extractCaptureEntries,
  isTestBid,
  isManuallyProvidedPackage,
  shouldCapturePackage,
};
