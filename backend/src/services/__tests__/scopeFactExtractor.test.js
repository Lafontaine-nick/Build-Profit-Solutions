const {
  extractScopeFactsFromNotes,
  resolveScopeFactsToCatalog,
} = require("../scopeFactExtractor");
const { parseScopeMeasurementsFromNotes } = require("../scopeMeasurementParser");

describe("scope fact extraction", () => {
  const notes =
    "Paint walls and ceilings about 2,000 sqft. Hang 5 new doors and casing, " +
    "prep and paint everything. Replace 2 windows and paint the new trim. " +
    "Patch drywall around them.";

  test("splits mixed landscaping into specific priced cards", () => {
    const mixedNotes =
      "Remove existing landscaping, pavers, and concrete as needed, then install 1,000 sqft sod, 400 sqft pavers, 12 shrubs, 30 tons decorative rock, irrigation adjustments, edging, a retaining wall, a 500 sqft concrete patio, and two exterior doors.";
    const parsed = parseScopeMeasurementsFromNotes(mixedNotes, {
      templateKey: "concrete",
      projectType: "other",
    });
    const { facts } = extractScopeFactsFromNotes(mixedNotes, {
      templateKey: "concrete",
      projectType: "other",
      parsedMeasurements: parsed,
    });
    const resolved = resolveScopeFactsToCatalog(facts, {
      templateKey: "concrete",
    });

    expect(resolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeId: "sod_turf",
          quantity: 1000,
          unit: "sqft",
        }),
        expect.objectContaining({
          scopeId: "pavers",
          quantity: 400,
          unit: "sqft",
        }),
        expect.objectContaining({
          scopeId: "plants",
          quantity: 12,
          unit: "each",
        }),
        expect.objectContaining({
          scopeId: "rock",
          quantity: 30,
          unit: "ton",
        }),
        expect.objectContaining({ scopeId: "concrete_edging" }),
        expect.objectContaining({
          scopeId: "exterior_doors",
          quantity: 2,
          unit: "each",
        }),
      ]),
    );
    expect(resolved.map(fact => fact.scopeId)).not.toContain("landscaping");
  });

  test("maps additional landscaping work to quantity-backed pricing cards", () => {
    const notes =
      "Clear 1,200 sqft of brush, grade 1,500 sqft, soil prep 900 sqft, install 180 LF drainage, 6 irrigation zones, and 8 landscape lights.";
    const { facts } = extractScopeFactsFromNotes(notes, {
      templateKey: "landscaping",
      projectType: "landscaping",
    });
    const resolved = resolveScopeFactsToCatalog(facts, {
      templateKey: "landscaping",
    });

    expect(resolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeId: "demo_clearing",
          quantity: 1200,
          unit: "sqft",
        }),
        expect.objectContaining({
          scopeId: "grading",
          quantity: 1500,
          unit: "sqft",
        }),
        expect.objectContaining({
          scopeId: "soil_prep",
          quantity: 900,
          unit: "sqft",
        }),
        expect.objectContaining({
          scopeId: "drainage",
          quantity: 180,
          unit: "lf",
        }),
        expect.objectContaining({
          scopeId: "irrigation",
          quantity: 6,
          unit: "each",
        }),
        expect.objectContaining({
          scopeId: "landscape_lighting",
          quantity: 8,
          unit: "each",
        }),
      ]),
    );
  });

  test("extracts independent action/object facts and quantities", () => {
    const { facts } = extractScopeFactsFromNotes(notes, {
      templateKey: "painting",
      projectType: "painting",
    });

    expect(facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "paint",
          object: "interior_walls_and_ceilings",
          quantity: 2000,
          unit: "sqft",
        }),
        expect.objectContaining({
          action: "install",
          object: "interior_door",
          quantity: 5,
          unit: "each",
        }),
        expect.objectContaining({
          action: "install",
          object: "window",
          quantity: 2,
          unit: "each",
        }),
      ]),
    );
  });

  test("resolves facts to existing catalog and marks missing measurements", () => {
    const { facts } = extractScopeFactsFromNotes(
      "Install new baseboards and paint them.",
      { templateKey: "painting", projectType: "painting" },
    );
    const resolved = resolveScopeFactsToCatalog(facts);

    expect(resolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeId: "baseboard_install",
          status: "needs_measurement",
        }),
        expect.objectContaining({
          scopeId: "trim_paint",
          status: "needs_measurement",
        }),
      ]),
    );
  });

  test("normalizes non-painting parser quantities through the same adapter", () => {
    const resolved = resolveScopeFactsToCatalog([
      {
        action: "remove",
        object: "floor",
        quantity: 1200,
        unit: "sqft",
        quantityKey: "floor_demo",
      },
      {
        action: "install",
        object: "tile",
        quantity: 1200,
        unit: "sqft",
        quantityKey: "tile_flooring",
      },
    ]);

    expect(resolved.some((entry) => entry.scopeId === "floor_demo")).toBe(true);
    expect(resolved.some((entry) => entry.scopeId === "tile_flooring")).toBe(
      true,
    );
  });

  test("splits combined kitchen demolition into separately priced catalog facts", () => {
    const note =
      "Remodel kitchen with demolition of existing cabinets, counters, backsplash, and flooring; install new cabinets, quartz counters, backsplash, and LVP.";
    const { facts } = extractScopeFactsFromNotes(note, {
      templateKey: "kitchen",
      projectType: "kitchen",
    });
    const resolved = resolveScopeFactsToCatalog(facts);

    expect(resolved.map((entry) => entry.scopeId)).toEqual(
      expect.arrayContaining([
        "cabinet_demo",
        "countertop_demo",
        "backsplash_demo",
        "floor_demo",
      ]),
    );
    expect(
      resolved
        .filter((entry) => entry.scopeId?.endsWith("_demo"))
        .every((entry) => entry.status === "needs_measurement"),
    ).toBe(true);
  });

  test("uses the kitchen label for shared flooring demo facts", () => {
    const { facts } = extractScopeFactsFromNotes(
      "Kitchen remodel. Remove existing flooring and install LVP.",
      { templateKey: "kitchen", projectType: "kitchen" },
    );
    const resolved = resolveScopeFactsToCatalog(facts, {
      templateKey: "kitchen",
    });

    expect(
      resolved.find((entry) => entry.scopeId === "floor_demo")?.catalogEntry
        ?.displayName,
    ).toBe("Kitchen flooring demo / removal");
  });

  test("promotes explicit cross-trade catalog aliases without duplicate variants", () => {
    const note =
      "Install 12 LF plumbing relocation, 8 receptacles, R-21 wall insulation, new lights, 48 sqft quartz counters, and backsplash.";
    const { facts } = extractScopeFactsFromNotes(note, {
      templateKey: "kitchen",
      projectType: "kitchen",
    });
    const resolved = resolveScopeFactsToCatalog(facts);
    const ids = resolved.map((entry) => entry.scopeId).filter(Boolean);

    expect(ids).toEqual(
      expect.arrayContaining([
        "plumbing",
        "electrical",
        "insulation",
        "lighting",
        "countertops",
        "backsplash",
      ]),
    );
    expect(ids).not.toContain("interior_paint");
    expect(ids).not.toContain("cabinet_paint");
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      resolved.find((entry) => entry.scopeId === "plumbing"),
    ).toMatchObject({ quantity: 12, unit: "lf", status: "matched" });
    expect(
      resolved.find((entry) => entry.scopeId === "electrical"),
    ).toMatchObject({ quantity: 8, unit: "each", status: "matched" });
    expect(
      resolved.find((entry) => entry.scopeId === "countertops"),
    ).toMatchObject({ quantity: 48, unit: "sqft", status: "matched" });
  });

  test("keeps roof decking repair and siding repair separate from install scope", () => {
    const note =
      "Tear off and remove the existing roof, then replace 28 roofing squares, repair 180 sqft decking, install gutters and downspouts, replace four windows, repair siding, install R-38 attic insulation, repair drywall, and paint ceilings.";
    const parsed = parseScopeMeasurementsFromNotes(note, {
      templateKey: "room_remodel",
      projectType: "other",
    });
    const resolved = resolveScopeFactsToCatalog(
      extractScopeFactsFromNotes(note, {
        templateKey: "room_remodel",
        projectType: "other",
        parsedMeasurements: parsed,
      }).facts,
    );

    expect(resolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeId: "decking_repair",
          action: "repair",
          quantity: 180,
          unit: "sqft",
          status: "matched",
        }),
        expect.objectContaining({
          scopeId: "tear_off",
          quantity: 28,
          unit: "squares",
          status: "matched",
        }),
        expect.objectContaining({
          scopeId: "roofing",
          quantity: 28,
          unit: "squares",
          status: "matched",
        }),
        expect.objectContaining({
          scopeId: "siding_repairs",
          status: "needs_measurement",
        }),
      ]),
    );
    expect(resolved.map((entry) => entry.scopeId)).not.toContain("decking");
  });

  test("preserves explicit exclusions as excluded facts", () => {
    const { facts } = extractScopeFactsFromNotes(
      "Paint 5 doors but do not install them. Exclude cabinets.",
      { templateKey: "painting", projectType: "painting" },
    );
    const resolved = resolveScopeFactsToCatalog(facts);

    expect(resolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "paint",
          object: "interior_door",
          excluded: false,
        }),
      ]),
    );
    expect(
      resolved.filter((entry) => entry.object === "interior_door"),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "install",
          excluded: false,
        }),
      ]),
    );
  });

  test("maps window siding slash trim paint to two exterior trim assemblies", () => {
    const note = "Install 2 windows and paint window siding / trim.";
    const parsed = parseScopeMeasurementsFromNotes(note, {
      templateKey: "painting",
      projectType: "painting",
    });
    const { facts } = extractScopeFactsFromNotes(note, {
      templateKey: "painting",
      projectType: "painting",
      parsedMeasurements: parsed,
    });
    const resolved = resolveScopeFactsToCatalog(facts);

    expect(parsed.casingPaintIntent).toBe(true);
    expect(resolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeId: "exterior_trim_paint",
          quantity: 2,
          status: "matched",
        }),
      ]),
    );
  });

  test("does not turn exterior trim paint into interior baseboard paint", () => {
    const note =
      "Demolish and remove the existing patio, then excavate and pour a 750 sqft patio with gravel base, rebar, thickened edge, retaining wall, 400 sqft pavers, landscaping, two exterior doors, siding repairs, and exterior trim paint.";
    const parsed = parseScopeMeasurementsFromNotes(note, {
      templateKey: "concrete",
      projectType: "other",
    });
    const { facts } = extractScopeFactsFromNotes(note, {
      templateKey: "concrete",
      projectType: "other",
      parsedMeasurements: parsed,
    });

    expect(parsed.baseboardPaintIntent).toBeUndefined();
    expect(facts).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "paint",
          object: "baseboard",
        }),
      ]),
    );
  });
});
