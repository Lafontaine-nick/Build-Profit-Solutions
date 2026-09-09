/**
 * Canonical scope metadata.
 *
 * This is intentionally an adapter around the existing quantity and pricing
 * registries. It describes how notes map to stable scope IDs without creating
 * a second pricing engine.
 */

const { CHECKLIST_TEMPLATES } = require("./scopeChecklistLibrary");
const {
  CHECKLIST_ITEM_QUANTITY_RULES,
  KITCHEN_CHECKLIST_QUANTITY_RULES,
  BATHROOM_CHECKLIST_QUANTITY_RULES,
  HVAC_CHECKLIST_QUANTITY_RULES,
  ADDITION_CHECKLIST_QUANTITY_RULES,
  GROUND_UP_CHECKLIST_QUANTITY_RULES,
} = require("./scopeItemQuantityCatalog");

const SCOPE_CATALOG = [
  {
    scopeId: "baseboard_install",
    displayName: "Baseboard installation",
    trade: "baseboard",
    category: "installation",
    intentKey: "baseboardInstallIntent",
    quantityRuleKey: "baseboard_install",
    pricingRuleKey: "baseboard_trim",
    aliases: ["install baseboard", "new baseboard", "baseboard installation"],
  },
  {
    scopeId: "interior_door_install",
    displayName: "Interior door installation",
    trade: "doors_and_trim",
    category: "installation",
    intentKey: "interiorDoorInstallIntent",
    quantityRuleKey: "interior_door_install",
    pricingRuleKey: "interior_door_install",
    aliases: ["install door", "hang door", "set door", "new interior door"],
  },
  {
    scopeId: "door_casing_install",
    displayName: "Door casing installation",
    trade: "doors_and_trim",
    category: "installation",
    intentKey: "interiorDoorInstallIntent",
    quantityRuleKey: "door_casing_install",
    pricingRuleKey: "door_casing_install",
    confirmScopeEnabled: false,
    aliases: ["install casing", "door casing", "new casing"],
  },
  {
    scopeId: "window_install",
    displayName: "Window & trim installation",
    trade: "windows",
    category: "installation",
    intentKey: "windowInstallIntent",
    quantityRuleKey: "window_install",
    pricingRuleKey: "window_install",
    aliases: ["install window", "replace window", "new window"],
  },
  {
    scopeId: "door_paint",
    displayName: "Interior door painting",
    trade: "painting",
    category: "finish",
    intentKey: "interiorDoorPaintIntent",
    quantityRuleKey: "door_paint",
    pricingRuleKey: "door_paint",
    confirmScopeEnabled: true,
    aliases: ["paint doors", "prep and paint doors", "paint interior doors"],
  },
  {
    scopeId: "trim_paint",
    displayName: "Baseboard and trim painting",
    trade: "painting",
    category: "finish",
    intentKey: "baseboardPaintIntent",
    quantityRuleKey: "trim_paint",
    pricingRuleKey: "trim_paint",
    confirmScopeEnabled: true,
    aliases: ["paint baseboard", "paint trim", "prep and paint baseboard"],
  },
  {
    scopeId: "door_casing_paint",
    displayName: "Door casing / trim painting",
    trade: "painting",
    category: "finish",
    intentKey: "casingPaintIntent",
    quantityRuleKey: "trim_paint",
    pricingRuleKey: "trim_paint",
    confirmScopeEnabled: true,
    aliases: ["paint door casing", "prep and paint casing"],
  },
  {
    scopeId: "exterior_trim_paint",
    displayName: "Exterior trim, windows & doors",
    trade: "painting",
    category: "finish",
    intentKey: "casingPaintIntent",
    quantityRuleKey: "exterior_trim_paint",
    pricingRuleKey: "exterior_trim_paint",
    confirmScopeEnabled: true,
    aliases: ["paint window casing", "paint window trim", "paint exterior doors"],
  },
];

// These relationships let the catalog remain authoritative while legacy
// checklist IDs continue to be accepted at the API boundary.
const LEGACY_SCOPE_ALIASES = Object.freeze({
  exterior_trim: "exterior_trim_paint",
  interior_doors: "interior_door_install",
  windows_doors: "window_install",
  windows: "window_install",
  paint_trim: "trim_paint",
  interior_trim: "trim_paint",
});

const CATALOG_ORDER = Object.freeze({
  installation: 10,
  prep: 20,
  finish: 30,
  demolition: 40,
  structure: 50,
  general: 90,
});

function canonicalScopeId(scopeId) {
  const raw = String(scopeId || "");
  return LEGACY_SCOPE_ALIASES[raw] || raw;
}

function actionForCatalogEntry(entry) {
  if (entry.category === "installation") return "install";
  if (entry.category === "prep") return "prep";
  if (entry.category === "demolition") return "demolish";
  if (entry.category === "finish") return "paint";
  return "scope";
}

function objectForCatalogEntry(entry) {
  return String(entry.scopeId || "")
    .replace(/_(install|paint|prep|demo|finish|rough|repair)$/g, "")
    .replace(/_/g, " ");
}

const CATALOG_BY_ID = new Map(
  SCOPE_CATALOG.map((entry) => [entry.scopeId, Object.freeze({ ...entry })]),
);

const ALL_QUANTITY_RULES = {
  ...CHECKLIST_ITEM_QUANTITY_RULES,
  ...KITCHEN_CHECKLIST_QUANTITY_RULES,
  ...BATHROOM_CHECKLIST_QUANTITY_RULES,
  ...HVAC_CHECKLIST_QUANTITY_RULES,
  ...ADDITION_CHECKLIST_QUANTITY_RULES,
  ...GROUND_UP_CHECKLIST_QUANTITY_RULES,
};

const SCOPE_ALIAS_OVERRIDES = {
  countertops: ["countertops", "quartz counters", "granite counters", "countertop"],
  pour_flatwork: [
    "concrete driveway",
    "concrete walkway",
    "concrete patio",
    "driveway flatwork",
  ],
  sod_turf: ["sod", "turf"],
  artificial_turf: ["artificial turf"],
  cabinet_install: ["install cabinets", "new cabinets", "cabinet installation"],
  plumbing_rough: ["rough plumbing", "plumbing rough-in"],
  electrical_rough: ["rough electrical", "electrical rough-in"],
};

function labelToAlias(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[&/]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Inventory every existing checklist scope without duplicating its rules.
 * Templates remain presets; these entries are the universal scope registry.
 */
function buildScopeCatalogInventory() {
  const inventory = new Map(CATALOG_BY_ID);
  for (const [templateKey, template] of Object.entries(CHECKLIST_TEMPLATES)) {
    for (const item of template.items || []) {
      if (!item?.id || inventory.has(item.id)) continue;
      const quantityRule = ALL_QUANTITY_RULES[item.id] || null;
      inventory.set(
        item.id,
        Object.freeze({
          scopeId: item.id,
          displayName: item.label || item.id.replace(/_/g, " "),
          trade: templateKey,
          category: item.category || "general",
          quantityRuleKey: quantityRule ? item.id : null,
          pricingRuleKey: item.id,
          action: actionForCatalogEntry({
            scopeId: item.id,
            category: item.category || "general",
          }),
          object: objectForCatalogEntry({ scopeId: item.id }),
          defaultUnit: quantityRule?.defaultUnit || null,
          order: CATALOG_ORDER[item.category] || CATALOG_ORDER.general,
          legacyAliases: [],
          pricingStatus: quantityRule
            ? "existing_quantity_rule"
            : "existing_pricing_pipeline",
          aliases: [
            labelToAlias(item.label || item.id),
            labelToAlias(item.id.replace(/_/g, " ")),
            ...(SCOPE_ALIAS_OVERRIDES[item.id] || []),
          ].filter(Boolean),
          templateKeys: [templateKey],
        }),
      );
    }
  }
  return inventory;
}

function getScopeCatalogEntry(scopeId) {
  const canonicalId = canonicalScopeId(scopeId);
  return buildScopeCatalogInventory().get(canonicalId) || null;
}

/**
 * Return detected catalog scopes in deterministic catalog order.
 * A single intent may intentionally resolve to multiple scopes, such as
 * interior door installation plus door casing installation.
 */
function getCatalogMatchesForParsedMeasurements(parsedMeasurements = {}) {
  const explicitMatches = SCOPE_CATALOG.filter(
    (entry) =>
      entry.confirmScopeEnabled !== false &&
      parsedMeasurements[entry.intentKey] === true &&
      !(
        entry.scopeId === "door_casing_paint" &&
        parsedMeasurements.interiorDoorCount
      ) &&
      !(
        entry.scopeId === "door_casing_install" &&
        parsedMeasurements.interiorDoorCount
      ),
  );
  const itemQuantities = parsedMeasurements.itemQuantities || {};
  const inventoryMatches = [...buildScopeCatalogInventory().values()].filter(
    (entry) =>
      entry.confirmScopeEnabled !== false &&
      !explicitMatches.some(
        (match) => canonicalScopeId(match.scopeId) === canonicalScopeId(entry.scopeId),
      ) &&
      (Boolean(parsedMeasurements[entry.intentKey]) ||
        Boolean(itemQuantities[entry.scopeId]) ||
        Boolean(itemQuantities[entry.quantityRuleKey])),
  );
  return [...explicitMatches, ...inventoryMatches];
}

/**
 * Shadow-only note matching. This intentionally does not change checklist
 * output; callers can compare these matches with the current template result.
 */
function getCatalogShadowMatches(notes = "") {
  const text = String(notes || "").toLowerCase();
  if (!text) return [];
  const matches = [];
  for (const entry of buildScopeCatalogInventory().values()) {
    const matchedAlias = (entry.aliases || []).find((alias) => {
      const normalized = String(alias || "").trim();
      if (!normalized || normalized.length < 3) return false;
      return new RegExp(
        `(^|[^a-z0-9])${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`,
        "i",
      ).test(text);
    });
    if (matchedAlias) {
      matches.push({ ...entry, matchedAlias });
    }
  }
  return matches;
}

function getScopeCatalog() {
  return [...buildScopeCatalogInventory().values()].map((entry) => ({
    ...entry,
    aliases: [...(entry.aliases || [])],
    templateKeys: [...(entry.templateKeys || [])],
  }));
}

function getCatalogPricingGaps() {
  return getScopeCatalog()
    .filter((entry) => !entry.quantityRuleKey)
    .map((entry) => ({
      scopeId: entry.scopeId,
      displayName: entry.displayName,
      trade: entry.trade,
      pricingRuleKey: entry.pricingRuleKey,
      reason: "No dedicated quantity rule is registered yet.",
    }));
}

function getCatalogIdentity(scopeId) {
  const canonicalId = canonicalScopeId(scopeId);
  const entry = getScopeCatalogEntry(canonicalId);
  if (!entry) {
    return {
      scopeId: canonicalId,
      canonicalScopeId: canonicalId,
      pricingRuleKey: canonicalId,
      quantityRuleKey: canonicalId,
      status: "unregistered",
    };
  }
  return {
    ...entry,
    canonicalScopeId: canonicalId,
    legacyAliases: [
      ...(entry.legacyAliases || []),
      ...Object.entries(LEGACY_SCOPE_ALIASES)
        .filter(([, target]) => target === canonicalId)
        .map(([alias]) => alias),
    ],
  };
}

module.exports = {
  SCOPE_CATALOG,
  ALL_QUANTITY_RULES,
  getScopeCatalog,
  getCatalogPricingGaps,
  getScopeCatalogEntry,
  getCatalogMatchesForParsedMeasurements,
  getCatalogShadowMatches,
  canonicalScopeId,
  getCatalogIdentity,
  LEGACY_SCOPE_ALIASES,
};
