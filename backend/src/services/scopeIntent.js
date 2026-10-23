/**
 * Structured scope intent from the draft model.
 * Included, excluded, or uncertain, and a quantity only when the note states it.
 * Keyword rules stay in place when the model did not ground a phrase in the note.
 */

const STATES = new Set(["included", "excluded", "uncertain"]);

const ID_ALIASES = {
  paint: ["paint", "interior_paint", "painting", "interior_painting"],
  interior_door_install: [
    "interior_door_install",
    "interior_door",
    "interior_doors",
    "doors",
    "door_install",
  ],
  door_paint: ["door_paint", "paint_doors"],
  windows: ["windows", "window", "window_install"],
  flooring: ["flooring", "lvp", "flooring_lvp"],
  appliances: ["appliances", "appliance", "appliance_install"],
};

function aliasGroup(id) {
  const key = String(id || "").trim().toLowerCase();
  for (const group of Object.values(ID_ALIASES)) {
    if (group.includes(key)) return group;
  }
  return [key];
}

function idsMatch(itemId, intentId) {
  if (!itemId || !intentId) return false;
  if (itemId === intentId) return true;
  const group = aliasGroup(intentId);
  return group.includes(itemId) && group.includes(intentId);
}

function notesContainEvidence(notes, evidence) {
  const needle = String(evidence || "").trim().toLowerCase();
  if (needle.length < 8) return false;
  return String(notes || "").toLowerCase().includes(needle);
}

function quantityIsStated(notes, quantity) {
  const amount = Number(quantity);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const raw = String(notes || "").replace(/,/g, "");
  const token = String(amount).replace(/\.0$/, "");
  return new RegExp(`\\b${token.replace(".", "\\.")}\\b`).test(raw);
}

function normalizeScopeIntent(raw, notes) {
  const list = Array.isArray(raw) ? raw : raw?.items;
  if (!Array.isArray(list)) return { items: [] };
  const items = [];
  for (const row of list) {
    const state = String(row?.state || "").trim().toLowerCase();
    if (!STATES.has(state)) continue;
    const evidence = String(row?.evidence || "").trim();
    if (!notesContainEvidence(notes, evidence)) continue;
    const id = String(row?.id || row?.scopeId || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (!id) continue;
    const stated = quantityIsStated(notes, row?.quantity);
    items.push({
      id,
      state,
      quantity: stated ? Number(row.quantity) : null,
      unit: stated && row?.unit ? String(row.unit).trim() : null,
      evidence,
    });
  }
  return { items };
}

function evidenceDemotesDoors(item, intent) {
  if (!idsMatch(item?.id, "interior_door_install")) return false;
  const evidence = String(intent?.evidence || "");
  const paintOrKeep = /\b(?:paint|painting|repaint|keep|keeping|leave|leaving|exclude|excluding)\b/i.test(
    evidence
  );
  const install = /\b(?:install|replace|replacing|hang|swap)\b/i.test(evidence);
  return paintOrKeep && !install;
}

function evidenceRequestsItem(item, evidence) {
  const tokens = `${item?.id || ""} ${item?.label || ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
  const text = String(evidence || "").toLowerCase();
  const mentions = tokens.some((token) => text.includes(token));
  const verb = /\b(?:install|replace|replacing|hang|demo|remove|paint|frame|pour|tile|wire)\b/i.test(
    text
  );
  return mentions && verb;
}

function isPaintItem(item) {
  return idsMatch(item?.id, "paint");
}

function clearUnstatedFloorQuantity(item, intent, measurements) {
  if (!measurements || !idsMatch(item?.id, "flooring")) return;
  if (intent.state === "included" || intent.quantity != null) return;
  delete measurements.flooringSqft;
  delete measurements.flooringLvpSqft;
}

function clearUnconfirmedPaintQuantity(item, intent, measurements) {
  if (!measurements || !isPaintItem(item)) return;
  if (intent.state !== "uncertain" || intent.quantity != null) return;
  const basisUnknown =
    measurements.paintAreaBasis === "unknown" ||
    measurements.paintAreaNeedsConfirmation === true;
  if (!basisUnknown) return;
  delete measurements.paintAreaSqft;
  delete measurements.combinedPaintableAreaSqft;
  delete measurements.wallPaintSqft;
  delete measurements.ceilingPaintSqft;
  delete measurements.originalPaintAreaReferenceSqft;
  delete measurements.paintPricingMethod;
}

function fillStatedQuantity(item, intent, measurements) {
  if (!measurements || intent.quantity == null || intent.state === "uncertain") return;
  const quantities = { ...(measurements.itemQuantities || {}) };
  const existing = quantities[item.id];
  if (existing?.quantity != null || existing?.quantitySource === "user_entered") {
    return;
  }
  quantities[item.id] = {
    quantity: intent.quantity,
    unit: intent.unit || null,
    quantitySource: "notes",
  };
  measurements.itemQuantities = quantities;
}

function evidenceLeavesAppliancesOwnerSupplied(item, intent) {
  if (!idsMatch(item?.id, "appliances")) return false;
  return /\b(?:owner|customer)[-\s]?(?:supplied|provided|provides|providing)\b/i.test(
    intent?.evidence || ""
  );
}

function statedExclusion(intent, item) {
  return (
    evidenceDemotesDoors(item, intent) ||
    evidenceLeavesAppliancesOwnerSupplied(item, intent) ||
    /\b(?:keep|keeping|leave|leaving|exclude|excluding|not included|without)\b/i.test(
      intent.evidence || ""
    )
  );
}

function applyIntentToItem(item, intent) {
  if (!item || item.inputType === "choice" || item.inputType === "multi_choice") {
    return item;
  }
  if (item.state === "included" && statedExclusion(intent, item)) {
    return {
      ...item,
      state: intent.state === "excluded" ? "excluded" : "unsure",
      noteBacked: false,
      catalogConfidence: "needs_review",
    };
  }
  if (
    intent.state === "included" &&
    item.state === "unsure" &&
    evidenceRequestsItem(item, intent.evidence)
  ) {
    return {
      ...item,
      state: "included",
      noteBacked: true,
      catalogConfidence: "identified",
    };
  }
  return item;
}

function applyScopeIntentToChecklist({ items, scopeIntent, notes, measurements }) {
  const intent = normalizeScopeIntent(scopeIntent, notes);
  if (!intent.items.length || !Array.isArray(items)) {
    return { items: items || [], scopeIntent: intent };
  }
  const next = items.map((item) => {
    const match = intent.items.find((row) => idsMatch(item.id, row.id));
    if (!match) return item;
    clearUnconfirmedPaintQuantity(item, match, measurements);
    clearUnstatedFloorQuantity(item, match, measurements);
    fillStatedQuantity(item, match, measurements);
    return applyIntentToItem(item, match);
  });
  if (
    measurements &&
    intent.items.some(
      (row) =>
        idsMatch(row.id, "flooring") &&
        row.state !== "included" &&
        row.quantity == null
    )
  ) {
    delete measurements.flooringSqft;
    delete measurements.flooringLvpSqft;
  }
  return { items: next, scopeIntent: intent };
}

function applyScopeIntentToDraft(draft) {
  if (!draft || typeof draft !== "object") return draft;
  const notes = draft.originalNotes || "";
  const measurements = {
    ...(draft.scopeMeasurements || {}),
    ...(draft.scopeChecklist?.suggestedMeasurements || {}),
  };
  const applied = applyScopeIntentToChecklist({
    items: draft.scopeChecklist?.items || [],
    scopeIntent: draft.scopeIntent,
    notes,
    measurements,
  });
  const suggested = {
    ...(draft.scopeChecklist?.suggestedMeasurements || {}),
    ...measurements,
  };
  return {
    ...draft,
    scopeIntent: applied.scopeIntent,
    scopeMeasurements: {
      ...(draft.scopeMeasurements || {}),
      ...measurements,
    },
    scopeChecklist: draft.scopeChecklist
      ? {
          ...draft.scopeChecklist,
          items: applied.items,
          suggestedMeasurements: suggested,
        }
      : draft.scopeChecklist,
  };
}

function draftNeedsScopeIntentPass(draft) {
  return (
    Boolean(draft?.extractionConfidence?.requiresAiFallback) &&
    !(draft?.scopeIntent?.items || []).length
  );
}

function mergeScopeIntentPass(draft, rawIntent, notes) {
  const scopeIntent = normalizeScopeIntent(rawIntent, notes || draft?.originalNotes || "");
  if (!scopeIntent.items.length) return draft;
  return applyScopeIntentToDraft({ ...draft, scopeIntent, originalNotes: notes || draft?.originalNotes });
}

module.exports = {
  normalizeScopeIntent,
  applyScopeIntentToChecklist,
  applyScopeIntentToDraft,
  draftNeedsScopeIntentPass,
  mergeScopeIntentPass,
};
