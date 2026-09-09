const { parseScopeMeasurementsFromNotes } = require("./scopeMeasurementParser");
const { getScopeCatalogEntry, getCatalogIdentity } = require("./scopeCatalog");

function positive(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

function fact({
  action,
  object,
  quantity = null,
  unit = null,
  certainty = "explicit",
  excluded = false,
  sourceText = "",
}) {
  return {
    action,
    object,
    quantity,
    unit,
    attributes: {},
    certainty,
    excluded,
    source: "job_notes",
    sourceText: String(sourceText || "").trim(),
  };
}

function sourceClause(notes, pattern) {
  const match = String(notes || "").match(pattern);
  return match?.[0] || notes;
}

function actionForScopeId(scopeId) {
  const id = String(scopeId || "").toLowerCase();
  if (/\b(demo|removal|tear|dispose|haul)\b/.test(id)) return "remove";
  if (/\b(install|pour|build|rough|set|hang|replace)\b/.test(id))
    return "install";
  if (/\b(paint|finish|stain|seal)\b/.test(id)) return "paint";
  if (/\b(repair|patch|restore)\b/.test(id)) return "repair";
  if (/\b(prep|grading|clearing|excavat)\b/.test(id)) return "prep";
  return "scope";
}

function objectForScopeId(scopeId) {
  return String(scopeId || "")
    .replace(/__(?:material|labor|allowance|sqft_basis)$/, "")
    .replace(/_(?:install|installation|paint|painting|demo|repair|prep)$/, "");
}

function noteExplicitlyExcludes(notes, object) {
  const aliases = {
    interior_door: "doors?",
    door_casing: "casing|trim",
    window: "windows?",
    baseboard: "baseboards?|trim|molding|moulding",
    cabinets: "cabinets?",
    plumbing: "plumbing",
    electrical: "electrical|outlets?|switches?",
    drywall: "drywall",
    roofing: "roof(?:ing)?|shingles?",
    concrete: "concrete|flatwork|driveway|patio",
    landscaping: "landscap(?:e|ing)|sod|irrigation|pavers?",
  };
  const objectPattern = aliases[object] || String(object || "").replace(/_/g, "\\s+");
  return new RegExp(
    `\\b(?:no|without|exclude(?:d|s|ing)?|not\\s+included)\\b[^.;\\n]{0,60}\\b(?:${objectPattern})\\b`,
    "i",
  ).test(String(notes || ""));
}

function extractScopeFactsFromNotes(notes, ctx = {}) {
  const text = String(notes || "").trim();
  // Callers that already parsed the note can pass the shared result. This
  // keeps checklist construction and fact extraction from diverging because
  // two parser invocations observed different intermediate state.
  const parsed =
    ctx.parsedMeasurements || parseScopeMeasurementsFromNotes(text, ctx);
  const facts = [];
  const paintScope = new Set(parsed.paintScope || []);
  const combinedArea = positive(parsed.combinedPaintableAreaSqft);

  if (paintScope.has("walls") && paintScope.has("ceilings")) {
    facts.push(
      fact({
        action: "paint",
        object: "interior_walls_and_ceilings",
        quantity: combinedArea || positive(parsed.paintAreaSqft),
        unit: "sqft",
        sourceText: sourceClause(
          text,
          /\b(?:paint|painting|repaint)[^.;\n]{0,80}\b(?:walls?|ceilings?)\b/i,
        ),
      }),
    );
  } else {
    if (paintScope.has("walls")) {
      facts.push(
        fact({
          action: "paint",
          object: "interior_walls",
          quantity: positive(parsed.wallPaintSqft),
          unit: "sqft",
          sourceText: "walls",
        }),
      );
    }
    if (paintScope.has("ceilings")) {
      facts.push(
        fact({
          action: "paint",
          object: "ceilings",
          quantity: positive(parsed.ceilingPaintSqft),
          unit: "sqft",
          sourceText: "ceilings",
        }),
      );
    }
  }

  const quantities = parsed.itemQuantities || {};
  const addIntentFact = (
    enabled,
    action,
    object,
    quantityKey,
    unit,
    pattern,
    quantityOverride = undefined,
  ) => {
    if (!enabled) return;
    const quantity =
      quantityOverride === undefined
        ? positive(quantities[quantityKey]?.quantity)
        : positive(quantityOverride);
    facts.push(
      fact({
        action,
        object,
        quantity,
        unit,
        certainty: quantity == null ? "explicit_scope_missing_measurement" : "explicit",
        sourceText: sourceClause(text, pattern),
      }),
    );
    facts[facts.length - 1].quantityKey = quantityKey;
  };

  addIntentFact(
    parsed.baseboardInstallIntent,
    "install",
    "baseboard",
    "baseboard_install",
    "lf",
    /\b(?:install|replace|add|new)\b[^.;\n]{0,50}\b(?:baseboards?|molding|moulding|trim)\b/i,
  );
  addIntentFact(
    parsed.baseboardPaintIntent,
    "paint",
    "baseboard",
    "trim_paint",
    "lf",
    /\b(?:baseboards?|molding|moulding|trim)\b[^.;\n]{0,50}\b(?:prep|prime|paint|finish)\b/i,
  );
  addIntentFact(
    parsed.interiorDoorInstallIntent,
    "install",
    "interior_door",
    "interior_door_install",
    "each",
    /\b(?:install|replace|hang|set)\b[^.;\n]{0,50}\bdoors?\b/i,
  );
  addIntentFact(
    parsed.interiorDoorPaintIntent,
    "paint",
    "interior_door",
    "door_paint",
    "each",
    /\bdoors?\b[^.;\n]{0,50}\b(?:prep|prime|paint|finish)\b/i,
  );
  addIntentFact(
    parsed.interiorDoorInstallIntent,
    "install",
    parsed.interiorDoorCount ? "interior_door_and_casing" : "door_casing",
    parsed.interiorDoorCount
      ? "interior_door_install"
      : "door_casing_install",
    "each",
    /\b(?:install|replace|new)\b[^.;\n]{0,50}\bcasing\b/i,
    parsed.interiorDoorCount ? parsed.interiorDoorCount : undefined,
  );
  addIntentFact(
    parsed.casingPaintIntent,
    "paint",
    /\bwindow(?:\s+(?:siding|and))?\s*[/,&-]?\s*trim\b/i.test(text)
      ? "window_trim"
      : parsed.interiorDoorCount
        ? "interior_door_and_casing"
        : "door_casing",
    /\bwindow(?:\s+(?:siding|and))?\s*[/,&-]?\s*trim\b/i.test(text)
      ? "exterior_trim_paint"
      : parsed.interiorDoorCount
        ? "door_paint"
        : "door_casing_paint",
    "each",
    /(?:\b(?:casing|trim|window\s+(?:siding\s*[/,&-]?\s*)?trim)\b[^.;\n]{0,50}\b(?:prep|prime|paint|finish)\b|\b(?:prep|prime|paint|finish)\b[^.;\n]{0,50}\b(?:casing|trim|window\s+(?:siding\s*[/,&-]?\s*)?trim)\b)/i,
    /\bwindow(?:\s+(?:siding|and))?\s*[/,&-]?\s*trim\b/i.test(text)
      ? parsed.windowCount
      : parsed.interiorDoorCount
        ? parsed.interiorDoorCount
        : undefined,
  );
  addIntentFact(
    parsed.windowInstallIntent,
    "install",
    "window",
    "window_install",
    "each",
    /\b(?:install|replace|set)\b[^.;\n]{0,50}\bwindows?\b/i,
  );

  const explicitQuantityScopeIds = new Set(
    facts
      .map((entry) => entry.quantityKey)
      .filter(Boolean),
  );
  for (const [quantityKey, quantityValue] of Object.entries(quantities)) {
    const scopeId = quantityKey.replace(
      /__(?:material|labor|allowance|sqft_basis)$/,
      "",
    );
    if (explicitQuantityScopeIds.has(scopeId)) continue;
    const quantity = positive(quantityValue?.quantity);
    facts.push(
      fact({
        action: actionForScopeId(scopeId),
        object: objectForScopeId(scopeId),
        quantity,
        unit: quantityValue?.unit || null,
        certainty: quantity == null
          ? "explicit_scope_missing_measurement"
          : "explicit",
        sourceText: text,
      }),
    );
    facts[facts.length - 1].quantityKey = scopeId;
    const identity = getCatalogIdentity(scopeId);
    facts[facts.length - 1].catalogScopeId = identity.canonicalScopeId;
    facts[facts.length - 1].pricingRuleKey = identity.pricingRuleKey;
    facts[facts.length - 1].quantityRuleKey = identity.quantityRuleKey;
  }

  for (const scopeFact of facts) {
    scopeFact.excluded = noteExplicitlyExcludes(text, scopeFact.object);
    if (scopeFact.excluded) scopeFact.certainty = "explicit_exclusion";
  }

  return { facts, parsedMeasurements: parsed };
}

const FACT_TO_SCOPE_ID = {
  "paint:interior_walls_and_ceilings": "interior_paint",
  "paint:interior_walls": "interior_paint",
  "paint:ceilings": "ceiling_paint",
  "install:baseboard": "baseboard_install",
  "paint:baseboard": "trim_paint",
  "install:interior_door": "interior_door_install",
  "paint:interior_door": "door_paint",
  "install:door_casing": "door_casing_install",
  "paint:door_casing_and_window_trim": "exterior_trim_paint",
  "install:window": "window_install",
};

function resolveScopeFactsToCatalog(facts = []) {
  return facts.map((scopeFact) => {
    const mappedScopeId = FACT_TO_SCOPE_ID[
      `${scopeFact.action}:${scopeFact.object}`
    ];
    const directScopeId = getScopeCatalogEntry(scopeFact.quantityKey)
      ? scopeFact.quantityKey
      : null;
    const scopeId = mappedScopeId || directScopeId;
    const catalogEntry = scopeId ? getScopeCatalogEntry(scopeId) : null;
    return {
      ...scopeFact,
      scopeId: catalogEntry?.scopeId || null,
      catalogEntry: catalogEntry
        ? {
            displayName: catalogEntry.displayName,
            category: catalogEntry.category,
            trade: catalogEntry.trade,
            quantityRuleKey: catalogEntry.quantityRuleKey,
            pricingRuleKey: catalogEntry.pricingRuleKey,
          }
        : null,
      status: catalogEntry
        ? scopeFact.excluded
          ? "excluded"
          : scopeFact.quantity == null
          ? "needs_measurement"
          : "matched"
        : "needs_clarification",
    };
  });
}

module.exports = {
  extractScopeFactsFromNotes,
  resolveScopeFactsToCatalog,
};
