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
  'deck_patio',
  'plumbing_service',
  'landscaping',
  'other',
]);

function roundMoney(n) {
  return Math.round(Number(n) || 0);
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

  if (unpricedRooms.length > 0 && !pricingWarnings.some((w) => /need pricing/i.test(w))) {
    pricingWarnings.push(
      `${unpricedRooms.length} room/area${unpricedRooms.length === 1 ? '' : 's'} need pricing: ${unpricedRooms.map((r) => r.name).join(', ')}.`
    );
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

function normalizeDraft(raw) {
  const draft = raw && typeof raw === 'object' ? raw : {};

  let projectType = String(draft.projectType || 'other').trim().toLowerCase();
  if (!VALID_PROJECT_TYPES.has(projectType)) {
    projectType = 'other';
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
          const priceProvidedByUser = Boolean(room?.priceProvidedByUser) || price != null;
          const base = {
            name,
            scope: String(room?.scope || '').trim(),
            price,
            priceProvidedByUser,
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
          };
          return applyRoomPriceSplit(base);
        })
        .filter(Boolean)
    : [];

  const allowances = Array.isArray(draft.allowances)
    ? draft.allowances
        .map((a) => ({
          name: String(a?.name || '').trim(),
          amount: a?.amount != null && a?.amount !== '' ? roundMoney(a.amount) : null,
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

  return refreshDraftMetrics({
    customerName: draft.customerName ? String(draft.customerName).trim() : null,
    projectTitle: draft.projectTitle ? String(draft.projectTitle).trim() : null,
    projectType,
    projectDescription: draft.projectDescription ? String(draft.projectDescription).trim() : null,
    rooms,
    allowances,
    inclusions,
    exclusions,
    statedTotal,
    missingInfo,
    contractScope: draft.contractScope ? String(draft.contractScope).trim() : null,
    suggestedPaymentSchedule,
    pricingWarnings: [],
  });
}

const SYSTEM_PROMPT = `You are a professional construction estimating assistant for Build Profit Solutions.

Parse rough contractor job notes into structured JSON for a mobile estimate builder.

CRITICAL RULES:
1. Preserve user-provided prices EXACTLY. Never change, round differently, or override a price the user wrote.
2. Do NOT invent prices for rooms/areas. If no price is given, set price to null and priceProvidedByUser to false.
3. Extract room/area sections (Master bathroom, Kitchen, Bedroom #1, Back deck, etc.) as separate rooms.
4. Each room scope should be the full work description for that area in plain English.
5. Allowances (e.g. $3/sqft LVP, tile allowances, baseboard specs) go in allowances[], NOT as room prices.
6. Global inclusions like "includes all labor and materials" go in inclusions[].
7. LUMP SUM RULE (critical): When the user gives one price per room/area and does NOT state separate labor and material amounts, set price to that exact total, laborPrice null, materialPrice null, priceIncludesLaborAndMaterials true. Do NOT guess or estimate how much is labor vs materials.
8. Only set laborPrice and materialPrice when the notes explicitly state those amounts (e.g. "$8k labor, $11k materials" or "materials $3,200 / labor $2,100"). They must sum to price when both are present. Set priceIncludesLaborAndMaterials false.
9. Extract statedTotal only if the user gives an overall bid total.
10. projectType must be one of: kitchen, bathroom, room_addition, home_addition, adu, garage_conversion, new_build, roofing, deck_patio, plumbing_service, landscaping, other. Use home_addition for whole-home or multi-room remodels.
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
  "rooms": [{ "name": string, "scope": string, "price": number | null, "laborPrice": number | null, "materialPrice": number | null, "priceIncludesLaborAndMaterials": boolean, "priceProvidedByUser": boolean }],
  "allowances": [{ "name": string, "amount": number | null, "unit": string | null, "description": string }],
  "inclusions": string[],
  "exclusions": string[],
  "statedTotal": number | null,
  "missingInfo": string[],
  "contractScope": string | null,
  "suggestedPaymentSchedule": [{ "label": string, "amount": number | null, "percentage": number | null, "dueTiming": string }] | null
}`;

async function createEstimateDraftFromNotes(notes, openai, aiModels, aiRuntime) {
  const trimmed = String(notes || '').trim();
  if (!trimmed) {
    throw new Error('Notes are required');
  }

  const completion = await openai.chat.completions.create({
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

  return normalizeDraft(parsed);
}

module.exports = {
  createEstimateDraftFromNotes,
  normalizeDraft,
  applyRoomPriceSplit,
  refreshDraftMetrics,
  VALID_PROJECT_TYPES,
};
