/**
 * Parse rough contractor job notes into a structured estimate draft.
 * Preserves user-provided prices; does not invent pricing unless explicitly missing.
 */

const VALID_PROJECT_TYPES = new Set([
  'kitchen',
  'bathroom',
  'room_addition',
  'home_addition',
  'adu',
  'garage_conversion',
  'new_build',
  'roofing',
  'flooring',
  'deck_patio',
  'plumbing_service',
  'landscaping',
  'other',
]);

function roundMoney(n) {
  return Math.round(Number(n) || 0);
}

/** Preserve cents on $/sqft and $/lf rates from notes (e.g. $2.50, $0.85). */
function roundUnitRate(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

const SQFT_PATTERN =
  /(\d{1,6}(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|square\s*feet|square\s*foot|sf\b|ft\.?\s*²|ft\.?\s*2\b)/i;

const LF_PATTERN =
  /(\d{1,6}(?:\.\d+)?)\s*(?:linear\s*feet|linear\s*foot|ln\.?\s*ft\.?|\blf\b|lineal\s*feet?)/i;

function parseSquareFeetFromText(...texts) {
  for (const raw of texts) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const match = text.match(SQFT_PATTERN);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function parseLinearFeetFromText(...texts) {
  for (const raw of texts) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const match = text.match(LF_PATTERN);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function isPerSqftUnit(unit) {
  const u = String(unit || '').toLowerCase();
  return (
    /sq\.?\s*ft|square\s*feet|square\s*foot|\bsf\b/.test(u) ||
    /\/\s*sq|per\s*sq|@\s*sq|\$.*\/\s*sf/.test(u)
  );
}

function isPerSqftAllowance(allowance) {
  if (!allowance || allowance.amount == null) return false;
  const rate = Number(allowance.amount);
  if (!Number.isFinite(rate) || rate <= 0) return false;

  if (isPerSqftUnit(allowance.unit)) return true;

  const blob = `${allowance.name || ''} ${allowance.description || ''} ${allowance.unit || ''}`.toLowerCase();
  if (/\$?\d+(?:\.\d+)?\s*(?:\/|per|@)\s*(?:sq\.?\s*ft|sf\b|square\s*feet?)/.test(blob)) {
    return true;
  }
  if (/\b(?:per|\/)\s*sq\.?\s*ft\b/.test(blob)) return true;

  // Small unit rates without an explicit lump-sum total in the label.
  if (rate <= 500 && /\b(tile|lvp|labor|install|flooring|paint|material)\b/.test(blob)) {
    return /\bsq\.?\s*ft|\bsf\b|square\s*feet?/.test(blob);
  }

  return false;
}

function classifyAllowanceKind(allowance) {
  const blob = `${allowance.name || ''} ${allowance.description || ''}`.toLowerCase();
  if (/\b(demo|demolition|demolish|tear\s*out|remove|haul)\b/.test(blob)) {
    return 'labor';
  }
  if (/\b(material\s*(?:cost|allowance)|allowance)\b/.test(blob) && !/\blabor\b/.test(blob)) {
    return 'material';
  }
  if (
    /\b(labor|labour|labor\s*budget|install(?:ation)?|workmanship|trade\s*labor)\b/.test(blob)
  ) {
    return 'labor';
  }
  if (
    /\b(material|materials|laminate|tile|lvp|flooring|supply|supplies|fixture|vanity|cabinet|countertop|paint|lumber|baseboard)\b/.test(
      blob
    ) &&
    !/\b(labor|labour|install|demo)\b/.test(blob)
  ) {
    return 'material';
  }
  return 'unknown';
}

const TRIM_KEYWORDS = /\b(baseboard|crown|trim|moulding|molding|casing|quarter\s*round)\b/;
const FLOORING_KEYWORDS =
  /\b(flooring|laminate|tile|lvp|floor|demo|demolish|carpet|hardwood|vinyl)\b/;

function roomCategory(room) {
  const blob = `${room.name || ''} ${room.scope || ''}`.toLowerCase();
  if (TRIM_KEYWORDS.test(blob) && !FLOORING_KEYWORDS.test(blob)) return 'trim';
  if (FLOORING_KEYWORDS.test(blob)) return 'flooring';
  return 'general';
}

function allowanceMatchesRoom(allowance, room, allRooms) {
  const aBlob = `${allowance.name || ''} ${allowance.description || ''}`.toLowerCase();
  const rBlob = `${room.name || ''} ${room.scope || ''}`.toLowerCase();
  const rCat = roomCategory(room);

  if (TRIM_KEYWORDS.test(aBlob)) {
    return rCat === 'trim' || TRIM_KEYWORDS.test(rBlob);
  }
  if (rCat === 'trim') {
    return TRIM_KEYWORDS.test(aBlob);
  }

  if (/\b(demo|demolition|demolish|tear\s*out|remove)\b/.test(aBlob)) {
    return rCat === 'flooring' || FLOORING_KEYWORDS.test(rBlob);
  }

  if (FLOORING_KEYWORDS.test(aBlob) || /\b(material\s*(cost|allowance)|labor\s*budget)\b/.test(aBlob)) {
    if (rCat === 'trim') return false;
    return rCat === 'flooring' || FLOORING_KEYWORDS.test(rBlob);
  }

  if (allRooms.length === 1) return true;

  const stopWords = new Set([
    'install',
    'labor',
    'budget',
    'material',
    'allowance',
    'flooring',
    'approximately',
    'linear',
  ]);
  const tokens = aBlob.split(/\W+/).filter((w) => w.length > 3 && !stopWords.has(w));
  return tokens.length > 0 && tokens.some((w) => rBlob.includes(w));
}

function isPerLfUnit(unit) {
  const u = String(unit || '').toLowerCase();
  return /\blf\b|linear\s*ft|linear\s*feet?|lineal\s*feet?|\/\s*lf|per\s*lf/.test(u);
}

function isPerLfAllowance(allowance) {
  if (!allowance || allowance.amount == null) return false;
  const rate = Number(allowance.amount);
  if (!Number.isFinite(rate) || rate <= 0) return false;
  if (isPerLfUnit(allowance.unit)) return true;

  const blob = `${allowance.name || ''} ${allowance.description || ''} ${allowance.unit || ''}`.toLowerCase();
  if (/\$?\d+(?:\.\d+)?\s*(?:\/|per|@)\s*(?:lf|linear\s*ft)/.test(blob)) return true;
  if (/\b(?:per|a)\s*linear\s*foot\b/.test(blob)) return true;
  if (TRIM_KEYWORDS.test(blob) && rate <= 100) return true;
  return false;
}

function isUnitRateAllowance(allowance, draft) {
  if (isPerSqftAllowance(allowance) || isPerLfAllowance(allowance)) return true;
  const rate = Number(allowance.amount);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 500) return false;

  const blob = `${allowance.name || ''} ${allowance.description || ''} ${allowance.unit || ''}`.toLowerCase();
  if (/\b(?:sq\.?\s*ft|sf\b|square\s*feet?|linear\s*feet?|\blf\b|\/\s*sq|per\s*sq|a\s*square\s*foot)\b/.test(blob)) {
    return true;
  }
  if (rate <= 100 && /\b(tile|lvp|labor|install|flooring|demo|baseboard|allowance|budget|laminate)\b/.test(blob)) {
    const rooms = draft?.rooms || [];
    const hasArea =
      extractProjectSquareFeet(draft) != null ||
      rooms.some(
        (r) =>
          parseSquareFeetFromText(r.scope, r.name, r.sqftArea) != null ||
          parseLinearFeetFromText(r.scope, r.name) != null
      );
    return hasArea;
  }
  return false;
}

function extractRoomQuantities(room, projectSqft, originalNotes) {
  const rCat = roomCategory(room);
  const scopeFields = [room.scope, room.name, room.sqftArea];

  let sqft = parseSquareFeetFromText(...scopeFields);
  let lf = parseLinearFeetFromText(...scopeFields);

  if (rCat === 'trim') {
    if (!lf) lf = parseLinearFeetFromText(originalNotes, room.scope, room.name);
    return { sqft: null, lf };
  }

  if (rCat === 'flooring') {
    if (!sqft) sqft = parseSquareFeetFromText(originalNotes, room.scope, room.name);
    if (!sqft && projectSqft) sqft = projectSqft;
    return { sqft, lf: lf || null };
  }

  if (!sqft) sqft = parseSquareFeetFromText(originalNotes) || projectSqft;
  if (!lf) lf = parseLinearFeetFromText(originalNotes, room.scope, room.name);
  return { sqft, lf };
}

function computeRoomUnitPricing(room, allowances, allRooms, projectSqft, originalNotes) {
  const matched = allowances.filter((a) => allowanceMatchesRoom(a, room, allRooms));
  if (matched.length === 0) return null;

  const { sqft, lf } = extractRoomQuantities(room, projectSqft, originalNotes);
  const rCat = roomCategory(room);

  let laborTotal = 0;
  let materialTotal = 0;
  const lineFormulas = [];

  for (const allowance of matched) {
    const kind = classifyAllowanceKind(allowance);
    const rate = roundUnitRate(allowance.amount);
    if (rate <= 0) continue;

    const useLf =
      isPerLfAllowance(allowance) || (rCat === 'trim' && lf != null && !isPerSqftAllowance(allowance));
    const qty = useLf ? lf : sqft;
    const unitLabel = useLf ? 'lf' : 'sqft';

    if (qty == null || qty <= 0) continue;

    const lineTotal = roundMoney(rate * qty);
    if (lineTotal <= 0) continue;

    if (kind === 'labor') laborTotal += lineTotal;
    else if (kind === 'material') materialTotal += lineTotal;
    else materialTotal += lineTotal;

    lineFormulas.push(`${qty.toLocaleString()} ${unitLabel} × $${rate}/${unitLabel} ${kind}`);
  }

  if (laborTotal <= 0 && materialTotal <= 0) return null;

  return {
    laborPrice: laborTotal > 0 ? laborTotal : null,
    materialPrice: materialTotal > 0 ? materialTotal : null,
    price: roundMoney(laborTotal + materialTotal),
    formula: lineFormulas.join(' + '),
    sqft,
    lf,
  };
}

function extractProjectSquareFeet(draft) {
  const fromDescription = parseSquareFeetFromText(draft.projectDescription);
  if (fromDescription) return fromDescription;

  const roomSqfts = (draft.rooms || [])
    .map((room) => parseSquareFeetFromText(room.scope, room.name, room.sqftArea))
    .filter((n) => n != null);
  if (roomSqfts.length === 1) return roomSqfts[0];
  if (roomSqfts.length > 1) return null;

  const allowanceText = (draft.allowances || [])
    .map((a) => `${a.description || ''} ${a.name || ''}`)
    .join(' ');
  return parseSquareFeetFromText(allowanceText);
}

/**
 * When notes give area + unit-rate allowances but no lump-sum room price,
 * compute each room from matched rates × that room's sqft or linear feet.
 */
function applySqftAllowancePricing(draft, options = {}) {
  const allowances = Array.isArray(draft.allowances) ? draft.allowances : [];
  const unitRates = allowances.filter((a) => isUnitRateAllowance(a, draft));
  if (unitRates.length === 0) return draft;

  const originalNotes = options.originalNotes != null ? options.originalNotes : draft.originalNotes;
  const rooms = draft.rooms || [];
  const projectSqft = extractProjectSquareFeet(draft);
  const pricingApplied = [];

  const nextRooms = rooms.map((room) => {
    if (room.price != null) return room;

    const computed = computeRoomUnitPricing(
      room,
      unitRates,
      rooms,
      projectSqft,
      originalNotes
    );
    if (!computed) return room;

    pricingApplied.push({
      roomName: room.name,
      ...computed,
    });

    return applyRoomPriceSplit({
      ...room,
      price: computed.price,
      laborPrice: computed.laborPrice,
      materialPrice: computed.materialPrice,
      priceIncludesLaborAndMaterials: false,
      priceProvidedByUser: false,
      priceSource: 'calculated',
      pricedFromSqftAllowances: true,
      formula: computed.formula,
    });
  });

  if (pricingApplied.length === 0) return draft;

  const pricingWarnings = Array.isArray(draft.pricingWarnings) ? [...draft.pricingWarnings] : [];
  const seenWarnings = new Set();
  for (const applied of pricingApplied) {
    const msg = `${applied.roomName}: ${applied.formula} → ${formatMoney(applied.price)} (from your notes).`;
    if (!seenWarnings.has(msg)) {
      seenWarnings.add(msg);
      pricingWarnings.push(msg);
    }
  }

  return {
    ...draft,
    rooms: nextRooms,
    pricingWarnings,
  };
}

function formatMoney(amount) {
  return `$${roundMoney(amount).toLocaleString()}`;
}

/**
 * Only split when notes give explicit labor and/or material amounts.
 * Lump-sum room prices stay combined — we never invent material/labor dollars.
 */
function applyRoomPriceSplit(room) {
  const price = room.price != null ? roundMoney(room.price) : null;
  if (price == null || price <= 0) {
    return {
      ...room,
      price: null,
      laborPrice: null,
      materialPrice: null,
      priceIncludesLaborAndMaterials: false,
    };
  }

  let laborPrice =
    room.laborPrice != null && room.laborPrice !== '' ? roundMoney(room.laborPrice) : null;
  let materialPrice =
    room.materialPrice != null && room.materialPrice !== ''
      ? roundMoney(room.materialPrice)
      : null;
  const splitIsSuggested = Boolean(room.splitIsSuggested);

  if (laborPrice != null && materialPrice != null) {
    const sum = laborPrice + materialPrice;
    if (sum !== price && sum > 0) {
      laborPrice = roundMoney((laborPrice / sum) * price);
      materialPrice = price - laborPrice;
    }
    return {
      ...room,
      price,
      laborPrice,
      materialPrice,
      priceIncludesLaborAndMaterials: false,
      splitIsSuggested,
    };
  }

  if (laborPrice != null) {
    materialPrice = Math.max(0, price - laborPrice);
    return {
      ...room,
      price,
      laborPrice,
      materialPrice,
      priceIncludesLaborAndMaterials: false,
      splitIsSuggested,
    };
  }

  if (materialPrice != null) {
    laborPrice = Math.max(0, price - materialPrice);
    return {
      ...room,
      price,
      laborPrice,
      materialPrice,
      priceIncludesLaborAndMaterials: false,
      splitIsSuggested,
    };
  }

  // Lump sum only — preserve total, do not invent a material/labor breakdown.
  return {
    ...room,
    price,
    laborPrice: null,
    materialPrice: null,
    priceIncludesLaborAndMaterials: true,
    splitIsSuggested: false,
  };
}

/** Recompute totals and pricing warnings on an already-normalized draft. */
function refreshDraftMetrics(draftInput) {
  const draft = draftInput && typeof draftInput === 'object' ? draftInput : {};
  const rooms = Array.isArray(draft.rooms) ? draft.rooms : [];
  const missingInfo = Array.isArray(draft.missingInfo)
    ? [...draft.missingInfo.map((s) => String(s).trim()).filter(Boolean)]
    : [];
  const statedTotal =
    draft.statedTotal != null && draft.statedTotal !== ''
      ? roundMoney(draft.statedTotal)
      : null;

  const calculatedLineItemTotal = rooms.reduce(
    (sum, room) => sum + (room.price != null ? room.price : 0),
    0
  );
  const calculatedLaborTotal = rooms.reduce(
    (sum, room) =>
      sum +
      (room.laborPrice != null
        ? room.laborPrice
        : room.priceIncludesLaborAndMaterials && room.price != null
          ? room.price
          : 0),
    0
  );
  const calculatedMaterialTotal = rooms.reduce(
    (sum, room) => sum + (room.materialPrice != null ? room.materialPrice : 0),
    0
  );
  const combinedPriceRoomCount = rooms.filter((r) => r.priceIncludesLaborAndMaterials).length;
  const suggestedSplitRoomCount = rooms.filter((r) => r.splitIsSuggested).length;

  const pricingWarnings = (Array.isArray(draft.pricingWarnings) ? draft.pricingWarnings : []).filter(
    (w) =>
      !/combined labor \+ materials total|Suggested labor\/material splits|estimated split/i.test(
        String(w)
      )
  );

  const pricedRooms = rooms.filter((r) => r.price != null);
  const unpricedRooms = rooms.filter((r) => r.price == null);
  const allowances = Array.isArray(draft.allowances) ? draft.allowances : [];
  const perSqftAllowances = allowances.filter((a) => isUnitRateAllowance(a, draft));
  const projectSqft = extractProjectSquareFeet(draft);

  if (unpricedRooms.length > 0 && !pricingWarnings.some((w) => /need pricing/i.test(w))) {
    if (perSqftAllowances.length > 0 && projectSqft == null) {
      pricingWarnings.push(
        `${unpricedRooms.length} room/area${unpricedRooms.length === 1 ? '' : 's'} need pricing: add square footage in the notes (e.g. 500 sqft) to calculate from $/sqft allowances.`
      );
      if (!missingInfo.some((m) => /square footage|sqft/i.test(m))) {
        missingInfo.push(
          'Square footage for priced areas (e.g. 500 sqft) — needed to multiply $/sqft allowances'
        );
      }
    } else if (perSqftAllowances.length === 0 && calculatedLineItemTotal <= 0) {
      pricingWarnings.push(
        `${unpricedRooms.length} room/area${unpricedRooms.length === 1 ? '' : 's'} need pricing: ${unpricedRooms.map((r) => r.name).join(', ')}.`
      );
      if (!missingInfo.some((m) => /overall bid total|lump sum|\$\/sqft/i.test(m))) {
        missingInfo.push(
          'Overall bid total or room lump sums (e.g. bathroom $8,500), or $/sqft rates with square footage'
        );
      }
    } else {
      pricingWarnings.push(
        `${unpricedRooms.length} room/area${unpricedRooms.length === 1 ? '' : 's'} need pricing: ${unpricedRooms.map((r) => r.name).join(', ')}.`
      );
    }
  }

  if (calculatedLineItemTotal > 0) {
    const totalIdx = missingInfo.findIndex((m) => /overall bid total was not found/i.test(m));
    if (totalIdx >= 0) missingInfo.splice(totalIdx, 1);
  }

  const scopeBlob = rooms.map((r) => `${r.name} ${r.scope}`).join(' ').toLowerCase();
  if (
    /\b(fixture|vanity|toilet|plumb|permit|sub\s*labor|subcontract)\b/.test(scopeBlob) &&
    !allowances.some((a) => /\b(fixture|vanity|permit|plumb)\b/i.test(`${a.name} ${a.description}`)) &&
    pricedRooms.every((r) => (r.materialPrice || 0) === 0 || r.priceIncludesLaborAndMaterials)
  ) {
    if (!missingInfo.some((m) => /fixture|permit|sub/i.test(m))) {
      missingInfo.push('Fixture, permit, or subcontract allowances if scope includes them');
    }
  }

  if (statedTotal != null && pricedRooms.length > 0) {
    const diff = Math.abs(calculatedLineItemTotal - statedTotal);
    if (diff > 1) {
      if (!pricingWarnings.some((w) => /stated total/i.test(w))) {
        pricingWarnings.push(
          `Line items total $${calculatedLineItemTotal.toLocaleString()}, but the stated total is $${statedTotal.toLocaleString()}. Please confirm which amount to use.`
        );
      }
    } else if (!pricingWarnings.some((w) => /match stated total/i.test(w))) {
      pricingWarnings.push('Line items match stated total.');
    }
  } else if (statedTotal == null && calculatedLineItemTotal > 0) {
    if (!missingInfo.some((m) => /overall bid total/i.test(m))) {
      missingInfo.push('No overall bid total was found in the notes.');
    }
  }

  if (suggestedSplitRoomCount > 0) {
    pricingWarnings.push(
      `Suggested labor/material splits for ${suggestedSplitRoomCount} room${suggestedSplitRoomCount === 1 ? '' : 's'} — standard trade ratios from scope, not from your notes. Adjust before applying.`
    );
    const idx = missingInfo.findIndex((m) => /labor vs material breakdown/i.test(m));
    if (idx >= 0) missingInfo.splice(idx, 1);
  } else if (combinedPriceRoomCount > 0) {
    pricingWarnings.push(
      `${combinedPriceRoomCount} room price${combinedPriceRoomCount === 1 ? '' : 's'} from your notes ${combinedPriceRoomCount === 1 ? 'is' : 'are'} a combined labor + materials total — not split in the notes. Tap "Suggest material & labor split" or split manually after applying.`
    );
    if (!missingInfo.some((m) => /labor.*material|split/i.test(m))) {
      missingInfo.push('Labor vs material breakdown per room (notes only gave combined prices)');
    }
  }

  return {
    ...draft,
    rooms,
    statedTotal,
    calculatedLineItemTotal: calculatedLineItemTotal > 0 ? calculatedLineItemTotal : null,
    calculatedLaborTotal: calculatedLaborTotal > 0 ? calculatedLaborTotal : null,
    calculatedMaterialTotal: calculatedMaterialTotal > 0 ? calculatedMaterialTotal : null,
    combinedPriceRoomCount: combinedPriceRoomCount > 0 ? combinedPriceRoomCount : 0,
    suggestedSplitRoomCount: suggestedSplitRoomCount > 0 ? suggestedSplitRoomCount : 0,
    pricingWarnings,
    missingInfo,
  };
}

function normalizeDraft(raw, options = {}) {
  const { enrichDraft, normalizeBuilderMode, inferBuilderMode } = require('./estimateDraftEnrichment');
  const {
    sanitizePricingItemsList,
    sanitizeRoomPrice,
    inferProjectTypeFromNotes,
  } = require('./estimateDraftQuantityPrice');
  const { extractRoomNotesText } = require('./estimateDraftRoomNotes');
  const { expandJobScopeRooms } = require('./estimateDraftScopeSplit');
  const draft = raw && typeof raw === 'object' ? raw : {};
  const builderMode = options.builderMode
    ? normalizeBuilderMode(options.builderMode)
    : inferBuilderMode(options.originalNotes || draft.originalNotes, draft);
  const originalNotes = options.originalNotes != null ? options.originalNotes : draft.originalNotes;

  let projectType = String(draft.projectType || 'other').trim().toLowerCase();
  if (!VALID_PROJECT_TYPES.has(projectType)) {
    projectType = 'other';
  }
  if (originalNotes) {
    projectType = inferProjectTypeFromNotes(originalNotes, projectType);
    if (!VALID_PROJECT_TYPES.has(projectType)) projectType = 'other';
  }

  const rooms = Array.isArray(draft.rooms)
    ? draft.rooms
        .map((room) => {
          const name = String(room?.name || '').trim();
          if (!name) return null;
          const priceRaw = room?.price;
          const price =
            priceRaw === null || priceRaw === undefined || priceRaw === ''
              ? null
              : roundMoney(priceRaw);
          const priceProvidedByUser = Boolean(room?.priceProvidedByUser);
          const roomNotesText = extractRoomNotesText(originalNotes, name, room?.scope || '');
          const notesBlob = `${roomNotesText}\n${room?.scope || ''}\n${name}`.trim();
          const pricingItems = sanitizePricingItemsList(
            Array.isArray(room?.pricingItems)
              ? room.pricingItems
                  .map((item) => ({
                    name: String(item?.name || '').trim(),
                    amount:
                      item?.amount != null && item?.amount !== '' ? roundMoney(item.amount) : null,
                    unitRate:
                      item?.unitRate != null && item?.unitRate !== ''
                        ? roundMoney(item.unitRate)
                        : null,
                    quantity:
                      item?.quantity != null && item?.quantity !== '' ? Number(item.quantity) : null,
                    unit: item?.unit != null ? String(item.unit).trim() : null,
                    pricingType: String(item?.pricingType || 'unknown').trim(),
                    status: String(item?.status || 'confirmed').trim(),
                    description: String(item?.description || '').trim(),
                    priceSource: item?.priceSource || 'user_provided',
                    includedInSubtotal: item?.includedInSubtotal !== false,
                  }))
                  .filter((item) => item.name)
              : [],
            notesBlob
          );
          const missingPriceItems = Array.isArray(room?.missingPriceItems)
            ? room.missingPriceItems.map((s) => String(s).trim()).filter(Boolean)
            : [];

          const base = sanitizeRoomPrice(
            {
            name,
            scope: String(room?.scope || '').trim(),
            price,
            priceProvidedByUser,
            pricingItems,
            missingPriceItems,
            laborPrice:
              room?.laborPrice != null && room?.laborPrice !== ''
                ? roundMoney(room.laborPrice)
                : null,
            materialPrice:
              room?.materialPrice != null && room?.materialPrice !== ''
                ? roundMoney(room.materialPrice)
                : null,
            priceIncludesLaborAndMaterials: Boolean(room?.priceIncludesLaborAndMaterials),
            splitIsSuggested: Boolean(room?.splitIsSuggested),
          },
            notesBlob
          );
          return applyRoomPriceSplit(base);
        })
        .filter(Boolean)
    : [];

  const expandedRooms = expandJobScopeRooms(rooms, originalNotes, { aggressive: false });

  const allowances = Array.isArray(draft.allowances)
    ? draft.allowances
        .map((a) => ({
          name: String(a?.name || '').trim(),
          amount: a?.amount != null && a?.amount !== '' ? roundUnitRate(a.amount) : null,
          unit: a?.unit != null ? String(a.unit).trim() : null,
          description: String(a?.description || '').trim(),
        }))
        .filter((a) => a.name || a.description)
    : [];

  const inclusions = Array.isArray(draft.inclusions)
    ? draft.inclusions.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const exclusions = Array.isArray(draft.exclusions)
    ? draft.exclusions.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const missingInfo = Array.isArray(draft.missingInfo)
    ? draft.missingInfo.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const statedTotal =
    draft.statedTotal != null && draft.statedTotal !== ''
      ? roundMoney(draft.statedTotal)
      : null;

  const suggestedPaymentSchedule = Array.isArray(draft.suggestedPaymentSchedule)
    ? draft.suggestedPaymentSchedule
        .map((p) => ({
          label: String(p?.label || '').trim(),
          amount: p?.amount != null && p?.amount !== '' ? roundMoney(p.amount) : null,
          percentage: p?.percentage != null && p?.percentage !== '' ? Number(p.percentage) : null,
          dueTiming: String(p?.dueTiming || '').trim(),
        }))
        .filter((p) => p.label)
    : null;

  const baseDraft = {
    customerName: draft.customerName ? String(draft.customerName).trim() : null,
    projectTitle: draft.projectTitle ? String(draft.projectTitle).trim() : null,
    projectType,
    projectDescription: draft.projectDescription ? String(draft.projectDescription).trim() : null,
    rooms: expandedRooms,
    allowances,
    inclusions,
    exclusions,
    statedTotal,
    missingInfo,
    contractScope: draft.contractScope ? String(draft.contractScope).trim() : null,
    suggestedPaymentSchedule,
    pricingWarnings: [],
    scopeAssumptionsConfirmed: Boolean(draft.scopeAssumptionsConfirmed),
  };

  let processed = baseDraft;
  if (builderMode !== 'organize_only') {
    processed = applySqftAllowancePricing(processed, { originalNotes });
  }
  processed = refreshDraftMetrics(processed);
  return enrichDraft(processed, {
    builderMode,
    originalNotes,
    userId: options.userId,
    savedTemplates: options.savedTemplates || [],
  });
}

const SYSTEM_PROMPT = `You are a professional construction estimating assistant for Build Profit Solutions.

Parse rough contractor job notes into structured JSON for a mobile estimate builder.

CRITICAL RULES:
1. Preserve user-provided prices EXACTLY. Never change, round differently, or override a price the user wrote.
2. Do NOT invent prices for rooms/areas. If no full package total is given, set price to null. Extract partial line-item prices into pricingItems[].
2a. QUANTITY vs PRICE (critical): Numbers with sqft, sq ft, ft², square feet, LF, linear feet are QUANTITIES — put them in scope text and pricingItems.quantity, NOT pricingItems.amount. Example: "1200 sqft tile demo" → quantity 1200, unit sqft, amount null. NEVER set amount to 1200 because the note says 1200 sqft. Only set amount when there is $ or clear price words (cost, price, bid, total, allowance, rate, per sqft with $).
2b. PARTIAL PRICING: If notes give some prices but not a full room total (e.g. countertops $5,000, cabinets $8,000, plus unpriced scope), set room price to null, list each priced item in pricingItems with exact amounts, and list unpriced scope in missingPriceItems. Do NOT set the whole room to missing if partial prices exist.
2c. ROUGH PRICE: If user says roughly/around/maybe/let's say/not positive, preserve the exact number and set pricingItem status rough_price.
3. Extract room/area/trade/service sections (kitchen, bath, roof, concrete, plumbing service, addition, etc.) as separate rooms.
4. Each room scope should be the full work description for that area in plain English.
5. Allowances (e.g. $3/sqft tile, $5/sqft install labor, $5/sqft demo labor, $2/lf baseboard material, $5/lf baseboard install labor) go in allowances[] with amount = the unit rate and unit like "/sqft", "per sqft", or "/lf". Use separate allowance entries for demo labor vs install labor vs material allowance. Do NOT multiply by area — the server calculates totals per room.
5b. When notes state square footage (e.g. "1200 sqft") put it in the matching room scope (flooring). Linear feet (e.g. "500 linear feet baseboard") go in the baseboard/trim room scope only — not as flooring sqft.
5c. Classify demo/demolition allowances as labor; material cost allowance as material; baseboard trim as its own room when scope differs from flooring.
6. Global inclusions like "includes all labor and materials" go in inclusions[].
7. LUMP SUM RULE (critical): When the user gives one price per room/area and does NOT state separate labor and material amounts, set price to that exact total, laborPrice null, materialPrice null, priceIncludesLaborAndMaterials true. Do NOT guess or estimate how much is labor vs materials.
8. Only set laborPrice and materialPrice when the notes explicitly state those amounts (e.g. "$8k labor, $11k materials" or "materials $3,200 / labor $2,100"). They must sum to price when both are present. Set priceIncludesLaborAndMaterials false.
9. Extract statedTotal only if the user gives an overall bid total.
10. projectType must be one of: kitchen, bathroom, flooring, room_addition, home_addition, adu, garage_conversion, new_build, roofing, deck_patio, plumbing_service, landscaping, other. Use flooring for floor/tile demo/laminate/baseboard jobs without bath remodel scope.
11. contractScope: write professional contract-ready scope language summarizing all rooms.
12. projectDescription: concise summary of the overall project.
13. customerName: extract if obvious (e.g. "Ruth bid" → customer Ruth, title Ruth bid). Otherwise null.
14. missingInfo: list anything important not provided (customer phone, start date, payment terms, labor vs material breakdown when only lump sums given, etc.)

Return ONLY valid JSON with this shape:
{
  "customerName": string | null,
  "projectTitle": string | null,
  "projectType": string,
  "projectDescription": string | null,
  "rooms": [{ "name": string, "scope": string, "price": number | null, "laborPrice": number | null, "materialPrice": number | null, "priceIncludesLaborAndMaterials": boolean, "priceProvidedByUser": boolean, "pricingItems": [{ "name": string, "amount": number | null, "unitRate": number | null, "quantity": number | null, "unit": string | null, "pricingType": string, "status": string, "description": string }] | null, "missingPriceItems": string[] | null }],
  "allowances": [{ "name": string, "amount": number | null, "unit": string | null, "description": string }],
  "inclusions": string[],
  "exclusions": string[],
  "statedTotal": number | null,
  "missingInfo": string[],
  "contractScope": string | null,
  "suggestedPaymentSchedule": [{ "label": string, "amount": number | null, "percentage": number | null, "dueTiming": string }] | null
}`;

function isRetryableOpenAiError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('premature close') ||
    msg.includes('connection error') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('504')
  );
}

async function createChatCompletionWithRetry(openai, params, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await openai.chat.completions.create(params);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !isRetryableOpenAiError(err)) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

async function createEstimateDraftFromNotes(notes, openai, aiModels, aiRuntime, options = {}) {
  const trimmed = String(notes || '').trim();
  if (!trimmed) {
    throw new Error('Notes are required');
  }
  const { inferBuilderMode } = require('./estimateDraftEnrichment');

  const completion = await createChatCompletionWithRetry(openai, {
    model: aiModels.assistant.estimate,
    response_format: aiRuntime.assistant.estimate.responseFormat,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Parse these contractor job notes into a structured estimate draft:\n\n${trimmed}`,
      },
    ],
    temperature: 0.2,
    max_tokens: aiRuntime.assistant.estimate.maxTokens,
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned an empty response');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error('AI returned invalid JSON');
  }

  const builderMode = inferBuilderMode(trimmed, parsed);
  return normalizeDraft(parsed, {
    builderMode,
    originalNotes: trimmed,
    userId: options.userId,
    savedTemplates: options.savedTemplates || [],
  });
}

module.exports = {
  createEstimateDraftFromNotes,
  normalizeDraft,
  applyRoomPriceSplit,
  applySqftAllowancePricing,
  refreshDraftMetrics,
  parseSquareFeetFromText,
  parseLinearFeetFromText,
  isPerSqftAllowance,
  isPerLfAllowance,
  isUnitRateAllowance,
  classifyAllowanceKind,
  allowanceMatchesRoom,
  extractProjectSquareFeet,
  extractRoomQuantities,
  computeRoomUnitPricing,
  roomCategory,
  VALID_PROJECT_TYPES,
};
