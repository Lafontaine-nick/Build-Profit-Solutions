/**
 * Opt-in labor/material split suggestions for combined (lump-sum) room prices.
 * Uses deterministic scope-based ratios only — same input always yields same split.
 */

const { refreshDraftMetrics } = require('./estimateDraftFromNotes');
const { enrichDraft } = require('./estimateDraftEnrichment');

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

function estimateMaterialSharePct(room, projectType) {
  const text = `${room?.name || ''} ${room?.scope || ''}`.toLowerCase();
  if (
    /\b(paint only|paint three|three tone paint)\b/.test(text) &&
    !/\b(tile|quartz|vanity|cabinet|lvp|shower)\b/.test(text)
  ) {
    return 0.22;
  }
  if (/\b(kitchen|cabinet|countertop|quartz top|quartz vanity)\b/.test(text)) return 0.55;
  if (/\b(bath|shower|tile|vanity|toilet|plumb|tub)\b/.test(text)) return 0.48;
  if (/\b(deck|concrete|pour)\b/.test(text)) return 0.42;
  if (/\b(carpet|lvp|flooring|baseboard|crown)\b/.test(text)) return 0.32;
  if (projectType === 'kitchen') return 0.55;
  if (projectType === 'bathroom') return 0.48;
  if (projectType === 'home_addition') return 0.4;
  return 0.38;
}

function heuristicSplit(room, projectType) {
  const price = roundMoney(room.price);
  const materialPct = estimateMaterialSharePct(room, projectType);
  const materialPrice = roundMoney(price * materialPct);
  const laborPrice = price - materialPrice;
  return { laborPrice, materialPrice };
}

function applySplitToRoom(room, laborPrice, materialPrice, projectType) {
  const price = roundMoney(room.price);
  let labor = roundMoney(laborPrice);
  let material = roundMoney(materialPrice);
  const sum = labor + material;
  if (sum !== price && sum > 0) {
    labor = roundMoney((labor / sum) * price);
    material = price - labor;
  } else if (sum === 0) {
    const h = heuristicSplit(room, projectType);
    labor = h.laborPrice;
    material = h.materialPrice;
  }
  return {
    ...room,
    price,
    laborPrice: labor,
    materialPrice: material,
    priceIncludesLaborAndMaterials: false,
    splitIsSuggested: true,
    splitApprovedByUser: Boolean(room.splitApprovedByUser),
  };
}

/**
 * Suggest labor/material splits for combined-price rooms (deterministic heuristics).
 */
async function suggestLaborMaterialSplits(draft) {
  if (!draft || !Array.isArray(draft.rooms)) {
    throw new Error('Draft with rooms is required');
  }

  const projectType = String(draft.projectType || 'other').trim().toLowerCase();
  const toSuggest = draft.rooms.filter(
    (r) =>
      r.price != null &&
      roundMoney(r.price) > 0 &&
      (r.priceIncludesLaborAndMaterials || r.splitIsSuggested)
  );

  if (toSuggest.length === 0) {
    return enrichDraft(refreshDraftMetrics({ ...draft }));
  }

  const nextRooms = draft.rooms.map((room) => {
    const shouldSuggest =
      room.price != null &&
      roundMoney(room.price) > 0 &&
      (room.priceIncludesLaborAndMaterials || room.splitIsSuggested);
    if (!shouldSuggest) return { ...room };

    const h = heuristicSplit(room, projectType);
    return applySplitToRoom(room, h.laborPrice, h.materialPrice, projectType);
  });

  return enrichDraft(
    refreshDraftMetrics({
      ...draft,
      rooms: nextRooms,
      applySuggestedSplits: Boolean(draft.applySuggestedSplits),
    })
  );
}

module.exports = {
  suggestLaborMaterialSplits,
  estimateMaterialSharePct,
  heuristicSplit,
};
