const { parseScopeMeasurementsFromNotes } = require("./scopeMeasurementParser");
const {
  getScopeCatalogEntry,
  getCatalogIdentity,
  getCatalogShadowMatches,
} = require("./scopeCatalog");

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

function catalogAliasPattern(alias) {
  return new RegExp(
    `(^|[^a-z0-9])${String(alias || "")
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+")}(?=$|[^a-z0-9])`,
    "i",
  );
}

function catalogMentionIsExplicit(notes, alias, entry) {
  const aliasMatch = catalogAliasPattern(alias).exec(String(notes || ""));
  if (!aliasMatch) return false;
  const start = Math.max(0, aliasMatch.index - 90);
  const end = Math.min(String(notes || "").length, aliasMatch.index + alias.length + 90);
  const context = String(notes || "").slice(start, end);
  if (
    /\b(?:no|without|exclude(?:d|s|ing)?|not\s+included)\b[^.;\n]{0,60}\b(?:the\s+)?(?:work|scope|item)?\b/i.test(
      context,
    )
  ) {
    return false;
  }
  if (entry.category === "demolition") {
    return /\b(?:demo(?:lition)?|remove|removal|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b/i.test(
      context,
    );
  }
  return (
    /\b(?:install|replace|add|new|relocat(?:e|ion)|reroute|repair|paint|include|perform|insulat(?:e|ion))\b/i.test(
      context,
    ) ||
    (entry.scopeId === "insulation" && /\bR[-\s]?\d{2,3}\b/i.test(context))
  );
}

function semanticObjectKey(scopeId) {
  return String(scopeId || "")
    .toLowerCase()
    .replace(/^interior_/, "")
    .replace(/^exterior_/, "")
    .replace(/_(?:lvp|vinyl|tile|install|installation|paint|painting)$/, "")
    .replace(/s$/, "");
}

function quantityFromCatalogAlias(notes, alias, defaultUnit) {
  const escapedAlias = String(alias || "")
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  const unitPattern =
    "(lf|linear\\s+(?:feet|foot)|sq\\.?\\s*ft\\.?|sqft|sf|each|ea)?";
  const before = String(notes || "").match(
    new RegExp(
      `(\\d[\\d,]*(?:\\.\\d+)?)\\s*${unitPattern}\\s+(?:of\\s+)?${escapedAlias}\\b`,
      "i",
    ),
  );
  if (!before) return null;
  const rawUnit = String(before[2] || defaultUnit || "each").toLowerCase();
  const unit = /lf|linear/.test(rawUnit)
    ? "lf"
    : /sq|sf/.test(rawUnit)
      ? "sqft"
      : "each";
  return {
    quantity: positive(before[1].replace(/,/g, "")),
    unit,
  };
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
    countertops: "countertops?|counters?",
    backsplash: "backsplash",
    flooring: "floor(?:ing)?|lvp|vinyl|laminate|carpet",
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
  const addExplicitDemoFact = ({
    scopeId,
    object,
    pattern,
    unit,
  }) => {
    const demoMatch = String(text).match(pattern);
    if (!demoMatch) return;
    const quantity = positive(quantities[scopeId]?.quantity);
    facts.push(
      fact({
        action: "remove",
        object,
        quantity,
        unit,
        certainty:
          quantity == null
            ? "explicit_scope_missing_measurement"
            : "explicit",
        sourceText: demoMatch[0],
      }),
    );
    facts[facts.length - 1].quantityKey = scopeId;
  };
  // Keep component demolition separate. A combined phrase such as
  // "demolition of existing cabinets, counters, backsplash, and flooring"
  // represents four independently priceable scope cards, not one generic
  // kitchen-demolition allowance.
  addExplicitDemoFact({
    scopeId: "cabinet_demo",
    object: "cabinets",
    unit: "lf",
    pattern:
      /\b(?:demo(?:lition)?|remove|removal|tear[\s-]?out|rip[\s-]?out)\b[^.;\n]{0,80}\bcabinets?\b|\bcabinets?\b[^.;\n]{0,80}\b(?:demo(?:lition)?|remove|removal|tear[\s-]?out|rip[\s-]?out)\b/i,
  });
  addExplicitDemoFact({
    scopeId: "countertop_demo",
    object: "countertops",
    unit: "sqft",
    pattern:
      /\b(?:demo(?:lition)?|remove|removal|tear[\s-]?out|rip[\s-]?out)\b[^.;\n]{0,80}\b(?:countertops?|counters?)\b|\b(?:countertops?|counters?)\b[^.;\n]{0,80}\b(?:demo(?:lition)?|remove|removal|tear[\s-]?out|rip[\s-]?out)\b/i,
  });
  addExplicitDemoFact({
    scopeId: "backsplash_demo",
    object: "backsplash",
    unit: "sqft",
    pattern:
      /\b(?:demo(?:lition)?|remove|removal|tear[\s-]?out|rip[\s-]?out)\b[^.;\n]{0,80}\bbacksplash\b|\bbacksplash\b[^.;\n]{0,80}\b(?:demo(?:lition)?|remove|removal|tear[\s-]?out|rip[\s-]?out)\b/i,
  });
  addExplicitDemoFact({
    scopeId: "floor_demo",
    object: "flooring",
    unit: "sqft",
    pattern:
      /\b(?:demo(?:lition)?|remove|removal|tear[\s-]?out|rip[\s-]?out)\b[^.;\n]{0,80}\b(?:floor(?:ing)?|lvp|vinyl|laminate|carpet)\b|\b(?:floor(?:ing)?|lvp|vinyl|laminate|carpet)\b[^.;\n]{0,80}\b(?:demo(?:lition)?|remove|removal|tear[\s-]?out|rip[\s-]?out)\b/i,
  });
  const explicitQuantityKeys = new Set(
    facts.map((entry) => entry.quantityKey).filter(Boolean),
  );
  const explicitSemanticActions = new Set(
    facts.map((entry) => `${semanticObjectKey(entry.quantityKey)}:${entry.action}`),
  );
  for (const match of getCatalogShadowMatches(text)) {
    if (!match.scopeId || explicitQuantityKeys.has(match.scopeId)) continue;
    if (
      match.category === "finish" &&
      !/\b(?:paint|finish|stain|refinish)\b/i.test(match.matchedAlias)
    ) {
      continue;
    }
    if (match.scopeId === "exterior" && match.matchedAlias === "exterior") {
      continue;
    }
    const semanticAction = `${semanticObjectKey(match.scopeId)}:${match.action}`;
    if (explicitSemanticActions.has(semanticAction)) continue;
    if (!catalogMentionIsExplicit(text, match.matchedAlias, match)) continue;
    const quantityValue =
      quantities[match.scopeId] || quantities[match.quantityRuleKey] || null;
    const noteQuantity = quantityFromCatalogAlias(
      text,
      match.matchedAlias,
      match.defaultUnit,
    );
    const quantity = positive(quantityValue?.quantity) || noteQuantity?.quantity;
    facts.push(
      fact({
        action: match.action || "scope",
        object: objectForScopeId(match.scopeId),
        quantity,
        unit:
          quantityValue?.unit ||
          noteQuantity?.unit ||
          match.defaultUnit ||
          null,
        certainty:
          quantity == null
            ? "explicit_scope_missing_measurement"
            : "explicit",
        sourceText: sourceClause(text, catalogAliasPattern(match.matchedAlias)),
      }),
    );
    facts[facts.length - 1].quantityKey = match.scopeId;
    explicitQuantityKeys.add(match.scopeId);
    explicitSemanticActions.add(semanticAction);
  }

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

function resolveScopeFactsToCatalog(facts = [], ctx = {}) {
  return facts.map((scopeFact) => {
    const mappedScopeId = FACT_TO_SCOPE_ID[
      `${scopeFact.action}:${scopeFact.object}`
    ];
    const directScopeId = getScopeCatalogEntry(scopeFact.quantityKey)
      ? scopeFact.quantityKey
      : null;
    const scopeId = mappedScopeId || directScopeId;
    const catalogEntry = scopeId ? getScopeCatalogEntry(scopeId) : null;
    const displayName =
      catalogEntry?.scopeId === "floor_demo" &&
      String(ctx.templateKey || "").toLowerCase() === "kitchen"
        ? "Kitchen flooring demo / removal"
        : catalogEntry?.displayName;
    return {
      ...scopeFact,
      scopeId: catalogEntry?.scopeId || null,
      catalogEntry: catalogEntry
        ? {
            displayName,
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
