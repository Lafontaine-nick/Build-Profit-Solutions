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
});
