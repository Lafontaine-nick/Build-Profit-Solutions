const {
  getScopeCatalogEntry,
  getScopeCatalog,
  getCatalogMatchesForParsedMeasurements,
  getCatalogShadowMatches,
  canonicalScopeId,
  getCatalogIdentity,
} = require("../scopeCatalog");
const {
  getRuleForChecklistItem,
} = require("../scopeItemQuantityCatalog");
const { getPricingRange } = require("../pricingEngine/pricingRangeCatalog");
const { classifyTradeForPricing } = require("../pricingEngine/tradeClassifier");
const {
  resolveScopePricingRule,
} = require("../pricingEngine/scopePricingMatrix");

describe("scope catalog adapter", () => {
  test("uses stable scope IDs and existing quantity rules", () => {
    const entry = getScopeCatalogEntry("interior_door_install");

    expect(entry).toMatchObject({
      scopeId: "interior_door_install",
      quantityRuleKey: "interior_door_install",
      pricingRuleKey: "interior_door_install",
    });
    expect(getRuleForChecklistItem(entry.quantityRuleKey)).toMatchObject({
      defaultUnit: "each",
      pricingMethod: "each",
    });
  });

  test("resolves one note intent to multiple existing scope cards", () => {
    const matches = getCatalogMatchesForParsedMeasurements({
      interiorDoorInstallIntent: true,
      windowInstallIntent: true,
    });

    expect(matches.map((entry) => entry.scopeId)).toEqual([
      "interior_door_install",
      "window_install",
    ]);
  });

  test("resolves door and trim finish intents through existing rules", () => {
    const matches = getCatalogMatchesForParsedMeasurements({
      interiorDoorPaintIntent: true,
      casingPaintIntent: true,
    });

    expect(matches.map((entry) => entry.scopeId)).toEqual([
      "door_paint",
      "door_casing_paint",
      "exterior_trim_paint",
    ]);
  });

  test("includes non-painting trades from existing templates", () => {
    const catalog = new Map(getScopeCatalog().map((entry) => [entry.scopeId, entry]));

    expect(catalog.get("shingles_roofing")).toMatchObject({
      templateKeys: ["roofing"],
      pricingRuleKey: "shingles_roofing",
    });
    expect(catalog.get("pour_flatwork")).toBeTruthy();
    expect(catalog.get("landscaping")).toBeTruthy();
    expect(catalog.get("plans_engineering")).toBeTruthy();
    expect(catalog.get("foundation")).toBeTruthy();
  });

  test("shadow-matches diverse notes without changing checklist output", () => {
    const matches = getCatalogShadowMatches(
      "Complete tear off, pour flatwork, install irrigation, " +
        "electrical rough-in and plumbing rough-in for a kitchen remodel.",
    );
    const ids = matches.map((entry) => entry.scopeId);

    expect(ids).toEqual(
      expect.arrayContaining([
        "tear_off",
        "pour_flatwork",
        "irrigation",
        "electrical_rough",
        "plumbing_rough",
      ]),
    );
  });

  test("canonicalizes legacy pricing identities", () => {
    expect(canonicalScopeId("exterior_trim")).toBe("exterior_trim_paint");
    expect(getCatalogIdentity("exterior_trim")).toMatchObject({
      canonicalScopeId: "exterior_trim_paint",
      pricingRuleKey: "exterior_trim_paint",
    });
  });

  test("matches catalog-backed quantities outside explicit painting intents", () => {
    const matches = getCatalogMatchesForParsedMeasurements({
      itemQuantities: {
        shingles_roofing: { quantity: 12, unit: "squares" },
        pour_flatwork: { quantity: 500, unit: "sqft" },
      },
    });
    expect(matches.map(entry => entry.scopeId)).toEqual(
      expect.arrayContaining(["shingles_roofing", "pour_flatwork"]),
    );
  });

  test("has quantity and planning-price coverage for landscaping checklist items", () => {
    const landscapeRules = {
      demo_clearing: "sqft",
      grading: "sqft",
      soil_prep: "sqft",
      irrigation: "each",
      sod_turf: "sqft",
      artificial_turf: "sqft",
      rock: "sqft",
      mulch: "sqft",
      plants: "each",
      trees: "each",
      landscape_boulders: "each",
      pavers: "sqft",
      concrete_edging: "lf",
      retaining_wall: "lf",
      drainage: "lf",
      landscape_lighting: "each",
    };

    for (const [scopeId, unit] of Object.entries(landscapeRules)) {
      expect(getRuleForChecklistItem(scopeId)).toMatchObject({
        defaultUnit: unit,
        pricingMethod: expect.any(String),
      });
    }

    const pricingCategories = [
      "landscape_clearing",
      "landscape_grading",
      "landscape_soil_prep",
      "landscape_irrigation",
      "landscape_sod",
      "landscape_artificial_turf",
      "landscape_rock",
      "landscape_mulch",
      "landscape_plants",
      "landscape_trees",
      "landscape_boulders",
      "landscape_pavers",
      "landscape_edging",
      "landscape_retaining_wall",
      "landscape_drainage",
      "landscape_lighting",
    ];
    for (const category of pricingCategories) {
      expect(getPricingRange(category)).toMatchObject({
        pricingCategory: category,
        material: expect.any(Object),
        labor: expect.any(Object),
      });
    }

    expect(classifyTradeForPricing("Sod", "Install 1,000 sqft")).toBe(
      "landscape_sod",
    );
    expect(classifyTradeForPricing("Irrigation", "4 zones")).toBe(
      "landscape_irrigation",
    );
    expect(classifyTradeForPricing("Landscape lighting", "6 lights")).toBe(
      "landscape_lighting",
    );
    expect(
      resolveScopePricingRule({
        scopeName: "Landscape lighting",
        scope: "6 lights",
        unit: "each",
      }),
    ).toMatchObject({
      tradeCategory: "landscape_lighting",
      pricingMethod: "each",
    });
  });
});
