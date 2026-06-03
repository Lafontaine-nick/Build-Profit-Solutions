/**
 * Enriches normalized estimate drafts with status labels, scope packages,
 * allowance metadata, suggested splits, partial pricing, and review warnings.
 */

const {
  parseSquareFeetFromText,
  parseLinearFeetFromText,
  isPerSqftAllowance,
  isPerLfAllowance,
  isUnitRateAllowance,
  classifyAllowanceKind,
  extractProjectSquareFeet,
  allowanceMatchesRoom,
  extractRoomQuantities,
} = require('./estimateDraftFromNotes');
const {
  buildScopePackage,
  computeBidCompleteness,
  detectTrades,
  syncRoomsFromScopePackages,
  recomputeDraftTotals,
} = require('./estimateDraftPartialPricing');
const { enrichDraftPhase2 } = require('./estimateDraftPhase2');
const { attachPricingMemoryToDraft } = require('./contractorPricingMemory');
const { enrichDraftReviewSections } = require('./estimateDraftReviewSections');

const VALID_BUILDER_MODES = new Set(['organize_only', 'organize_calculate', 'suggest_breakdown']);

function inferBuilderMode(notes, parsedDraft = null) {
  const notesLower = String(notes || '').toLowerCase();
  if (
    /\b(organize only|no calculations?|don't calculate|do not calculate|without calculating)\b/.test(
      notesLower
    )
  ) {
    return 'organize_only';
  }
  const draft = parsedDraft && typeof parsedDraft === 'object' ? parsedDraft : {};
  const allowances = Array.isArray(draft.allowances) ? draft.allowances : [];
  const rooms = Array.isArray(draft.rooms) ? draft.rooms : [];
  const hasPerSqft = allowances.some(isPerSqftAllowance);
  const hasUnpricedRoom = rooms.some((r) => r.price == null || r.price === '');
  if (hasPerSqft || hasUnpricedRoom) return 'organize_calculate';
  return 'organize_calculate';
}

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

function normalizeBuilderMode(mode) {
  const m = String(mode || 'organize_calculate').trim().toLowerCase();
  return VALID_BUILDER_MODES.has(m) ? m : 'organize_calculate';
}

function formatMoney(amount) {
  return `$${roundMoney(amount).toLocaleString()}`;
}

function enrichAllowances(draft, builderMode) {
  const projectSqft = extractProjectSquareFeet(draft);
  const rooms = draft.rooms || [];
  const skipCalc = builderMode === 'organize_only';
  const originalNotes = draft.originalNotes || '';

  return (draft.allowances || []).map((a) => {
    const rate = a.amount != null ? Number(a.amount) : null;
    const perUnit = isUnitRateAllowance(a, draft);
    const perLf = isPerLfAllowance(a);
    const perSqft = isPerSqftAllowance(a);
    const kind = classifyAllowanceKind(a);
    const matchedRooms = rooms.filter((r) => allowanceMatchesRoom(a, r, rooms));
    const appliesTo =
      matchedRooms.length > 0
        ? matchedRooms.map((r) => r.name).join(', ')
        : rooms.length === 1
          ? rooms[0].name
          : rooms.map((r) => r.name).join(', ') || null;

    let quantity = null;
    let quantityUnit = null;
    let calculatedAmount = null;
    let status = 'confirmed';
    const allowanceMissing = [];

    if (perUnit && rate != null) {
      const targetRoom = matchedRooms[0] || (rooms.length === 1 ? rooms[0] : null);
      const fromAllowanceText = parseSquareFeetFromText(a.description, a.name);
      const fromLfText = parseLinearFeetFromText(a.description, a.name);

      if (targetRoom) {
        const q = extractRoomQuantities(targetRoom, projectSqft, originalNotes);
        if (perLf || fromLfText) {
          quantity = fromLfText || q.lf;
          quantityUnit = 'lf';
        } else {
          quantity = fromAllowanceText || q.sqft;
          quantityUnit = 'sqft';
        }
      } else {
        quantity = fromLfText || fromAllowanceText || projectSqft;
        quantityUnit = fromLfText || perLf ? 'lf' : 'sqft';
      }

      if (!skipCalc && quantity != null && quantity > 0) {
        calculatedAmount = roundMoney(quantity * rate);
        const roomPricedFromSqft = rooms.some((r) => r.pricedFromSqftAllowances && r.price != null);
        status = roomPricedFromSqft ? 'calculated' : 'confirmed';
      } else if (skipCalc && quantity != null && quantity > 0) {
        status = 'needs_review';
        allowanceMissing.push(
          `${a.name || 'Allowance'}: $${rate}/${quantityUnit || 'unit'} × ${quantity} not calculated (Organize Only mode)`
        );
      } else if (quantity == null || quantity <= 0) {
        status = 'needs_review';
        allowanceMissing.push(
          `${a.name || 'Allowance'}: $${rate}/${quantityUnit || 'unit'} saved — add quantity in notes to calculate total`
        );
        if (kind === 'unknown' || kind === 'material') {
          allowanceMissing.push(
            `Is $${rate}/${quantityUnit || 'unit'} for ${a.name || 'this item'} material-only or does it include labor?`
          );
        }
      }
    } else if (rate != null) {
      calculatedAmount = rate;
      status = 'confirmed';
    }

    return {
      name: a.name,
      description: a.description,
      rate,
      unit: a.unit || (perLf ? '/lf' : perSqft ? '/sqft' : null),
      quantity,
      quantityUnit,
      calculatedAmount,
      appliesTo,
      kind,
      status,
      missingInfo: allowanceMissing,
      amount: a.amount,
    };
  });
}

function buildSuggestedSplits(draft) {
  const { heuristicSplit, estimateMaterialSharePct } = require('./estimateDraftSuggestSplits');
  const projectType = draft.projectType || 'other';
  const splits = [];

  for (const room of draft.rooms || []) {
    if (room.price == null || roundMoney(room.price) <= 0) continue;
    if (room.partialPricing) continue;

    if (room.splitIsSuggested && room.laborPrice != null && room.materialPrice != null) {
      splits.push({
        parentItemName: room.name,
        total: roundMoney(room.price),
        suggestedLabor: roundMoney(room.laborPrice),
        suggestedMaterials: roundMoney(room.materialPrice),
        confidence: 'medium',
        approvedByUser: Boolean(room.splitApprovedByUser),
        status: 'ai_suggested',
      });
      continue;
    }

    if (room.priceIncludesLaborAndMaterials && !room.splitIsSuggested) {
      const h = heuristicSplit(room, projectType);
      const materialPct = estimateMaterialSharePct(room, projectType);
      splits.push({
        parentItemName: room.name,
        total: roundMoney(room.price),
        suggestedLabor: h.laborPrice,
        suggestedMaterials: h.materialPrice,
        confidence: materialPct >= 0.45 && materialPct <= 0.6 ? 'medium' : 'low',
        approvedByUser: false,
        status: 'ai_suggested',
        previewOnly: true,
      });
    }
  }

  return splits;
}

function collectStandardMissingInfo(draft) {
  const missing = [...(draft.missingInfo || [])];
  const add = (msg) => {
    if (!missing.some((m) => m.toLowerCase() === msg.toLowerCase())) missing.push(msg);
  };

  if (!missing.some((m) => /phone/i.test(m))) add('Customer phone missing');
  if (!draft.customerName && !missing.some((m) => /customer name/i.test(m))) {
    add('Customer name may need confirmation');
  }
  if (!/address|street|city/i.test(`${draft.projectDescription || ''} ${draft.contractScope || ''}`)) {
    add('Project address missing');
  }
  if (!draft.missingInfo?.some((m) => /start date/i.test(m))) add('Start date missing');
  if (!draft.suggestedPaymentSchedule?.length) add('Payment terms not provided');
  if (
    !/permit/i.test(
      `${draft.projectDescription || ''} ${draft.contractScope || ''} ${(draft.exclusions || []).join(' ')}`
    )
  ) {
    add('Permit responsibility not mentioned');
  }

  return missing;
}

function buildStillNeededReview(draft, scopePackages) {
  const items = [];
  const add = (s) => {
    const t = String(s || '').trim();
    if (!t) return;
    const norm = t.toLowerCase();
    if (!items.some((x) => x.toLowerCase() === norm)) items.push(t);
  };

  for (const pkg of scopePackages || []) {
    if (pkg.status !== 'missing_price' && pkg.status !== 'needs_review') continue;
    const key = String(pkg.name || '').toLowerCase();
    if (/tile|demo/.test(key)) add('Pricing for tile demo');
    else if (/laminate|flooring|lvp/.test(key) && !/baseboard/.test(key)) {
      add('Material/labor pricing for laminate flooring');
    } else if (/baseboard|trim/.test(key)) add('Material/labor pricing for baseboard');
    else add(`Pricing for ${pkg.name}`);
  }

  if (!draft.customerName) add('Customer name');
  if (!draft.projectAddress) add('Project address');
  if (!draft.missingInfo?.some((m) => /payment/i.test(m))) add('Payment terms');
  if (!draft.missingInfo?.some((m) => /permit/i.test(m))) add('Permit responsibility');

  return items;
}

function packageStatusMessage(pkg) {
  switch (pkg.status) {
    case 'confirmed':
      return `${pkg.name}: complete price ${formatMoney(pkg.price || pkg.knownSubtotal)} from notes`;
    case 'user_provided':
      return `${pkg.name}: user-provided total ${formatMoney(pkg.price)} preserved from notes`;
    case 'rough_price':
      return `${pkg.name}: rough price(s) in notes — confirm before bidding`;
    case 'partial_pricing':
      return `${pkg.name}: partial pricing ${formatMoney(pkg.knownSubtotal)} known — ${(pkg.missingPriceItems || []).length} item(s) still need pricing`;
    case 'calculated':
      return `${pkg.name}: calculated ${formatMoney(pkg.price || pkg.calculatedSubtotal)}${pkg.formula ? ` (${pkg.formula})` : ''}`;
    case 'ai_suggested':
      return `${pkg.name}: AI-suggested values — approval required`;
    case 'missing_price':
      return `${pkg.name}: scope found, pricing needed`;
    default:
      return `${pkg.name}: needs review`;
  }
}

function enrichDraft(draftInput, options = {}) {
  const draft = draftInput && typeof draftInput === 'object' ? { ...draftInput } : {};
  const builderMode = normalizeBuilderMode(options.builderMode || draft.builderMode);
  const userId = options.userId || draft.userId || null;
  const originalNotes =
    options.originalNotes != null ? String(options.originalNotes) : draft.originalNotes || '';

  const scopePackages = (draft.rooms || []).map((room) =>
    buildScopePackage(room, draft, originalNotes)
  );
  const detectedTrades = detectTrades(
    draft.projectType,
    scopePackages.map((p) => `${p.name} ${p.scope}`).join(' ')
  );
  const allowances = enrichAllowances(draft, builderMode);
  const suggestedSplits = buildSuggestedSplits(draft);
  const rooms = syncRoomsFromScopePackages(draft, scopePackages);

  const allowanceMissing = allowances.flatMap((a) => a.missingInfo || []);
  const packageMissing = scopePackages.flatMap((p) => p.missingPriceItems || []);
  const packageWarnings = scopePackages.flatMap((p) => p.warnings || []);

  const missingInfo = collectStandardMissingInfo({
    ...draft,
    missingInfo: [
      ...new Set([...(draft.missingInfo || []), ...allowanceMissing, ...packageMissing]),
    ],
  });

  const noPricing =
    !(draft.calculatedLineItemTotal > 0) &&
    scopePackages.every((p) => !p.knownSubtotal && !p.price && p.status === 'missing_price');

  const needsReviewItems = noPricing
    ? []
    : [
        ...missingInfo,
        ...scopePackages
          .filter((p) =>
            ['needs_review', 'ai_suggested', 'partial_pricing', 'rough_price'].includes(p.status)
          )
          .map(packageStatusMessage),
        ...allowances
          .filter((a) => a.status === 'needs_review')
          .map((a) => (a.missingInfo || [])[0])
          .filter(Boolean),
      ].filter(Boolean);

  const stillNeededReview = buildStillNeededReview(draft, scopePackages);

  const knownSubtotal = scopePackages.reduce(
    (sum, p) => sum + (p.knownSubtotal != null ? p.knownSubtotal : 0),
    0
  );
  const calculatedTotal = recomputeDraftTotals(
    { ...draft, calculatedLineItemTotal: draft.calculatedLineItemTotal },
    scopePackages
  );
  const statedTotal = draft.statedTotal != null ? roundMoney(draft.statedTotal) : null;
  let totalMatches = null;
  if (statedTotal != null && calculatedTotal != null && calculatedTotal > 0) {
    totalMatches = Math.abs(calculatedTotal - statedTotal) <= 1;
  }

  const completeness = computeBidCompleteness({ ...draft, rooms }, scopePackages);
  const warnings = [...new Set([...(draft.pricingWarnings || []), ...packageWarnings])];

  const pricingWarnings = warnings.filter(
    (w) =>
      !/combined labor \+ materials total|Suggested labor\/material splits|estimated split/i.test(
        String(w)
      )
  );

  const combinedPriceRoomCount = scopePackages.filter(
    (p) =>
      p.priceIncludesLaborAndMaterials &&
      (p.status === 'confirmed' || p.status === 'user_provided')
  ).length;
  const suggestedSplitRoomCount = rooms.filter((r) => r.splitIsSuggested).length;
  const partialPricingCount = scopePackages.filter((p) => p.status === 'partial_pricing').length;

  if (partialPricingCount > 0 && !pricingWarnings.some((w) => /partial pricing/i.test(w))) {
    pricingWarnings.push(
      `${partialPricingCount} scope package(s) have partial pricing — known subtotal only; missing items are not applied as $0.`
    );
  }

  if (combinedPriceRoomCount > 0 && suggestedSplitRoomCount === 0) {
    pricingWarnings.push(
      `${combinedPriceRoomCount} lump-sum package(s) from notes — tap "Suggest material & labor split" if you want a breakdown (optional).`
    );
  }

  const base = {
    ...draft,
    rooms,
    originalNotes: originalNotes.trim() || draft.originalNotes || null,
    builderMode,
    detectedProjectType: draft.projectType || null,
    detectedTrades,
    scopePackages,
    allowances,
    suggestedSplits,
    missingInfo,
    needsReviewItems: [...new Set(needsReviewItems)],
    stillNeededReview,
    warnings: pricingWarnings,
    pricingWarnings,
    knownSubtotal: knownSubtotal > 0 ? knownSubtotal : null,
    calculatedTotal: calculatedTotal > 0 ? calculatedTotal : null,
    calculatedLineItemTotal: calculatedTotal > 0 ? calculatedTotal : draft.calculatedLineItemTotal,
    statedTotal,
    totalMatches,
    partialPricingCount,
    applySuggestedSplits: Boolean(draft.applySuggestedSplits),
    bidCompletenessScore: completeness.bidCompletenessScore,
    bidCompletenessGood: completeness.bidCompletenessGood,
    bidCompletenessNeedsReview: completeness.bidCompletenessNeedsReview,
    combinedPriceRoomCount: combinedPriceRoomCount > 0 ? combinedPriceRoomCount : 0,
    suggestedSplitRoomCount: suggestedSplitRoomCount > 0 ? suggestedSplitRoomCount : 0,
  };

  const phase2 = enrichDraftPhase2(base, scopePackages, {
    roughEstimateRequested: Boolean(draft.roughEstimateRequested),
  });

  let merged = enrichDraftReviewSections({ ...base, ...phase2 });
  if (userId) {
    merged = attachPricingMemoryToDraft(merged, userId, {
      savedTemplates: options.savedTemplates || [],
    });
  }
  return merged;
}

module.exports = {
  enrichDraft,
  inferBuilderMode,
  normalizeBuilderMode,
  VALID_BUILDER_MODES,
};
