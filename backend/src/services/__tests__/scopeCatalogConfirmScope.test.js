const { buildScopeChecklist } = require("../estimateDraftComplexity");

describe("catalog-driven Confirm Scope pilot", () => {
  test("renders deduplicated painting facts as Confirm Scope cards", () => {
    const notes =
      "Paint walls and ceilings about 2,000 sqft. Install 5 new doors and casing " +
      "and prep and paint. Install 2 windows and trim, prep and paint window trim.";
    const checklist = buildScopeChecklist(
      { projectType: "painting", originalNotes: notes, rooms: [] },
      "room_remodel",
      notes,
    );
    const ids = checklist.items.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining([
      "interior_paint",
      "interior_door_install",
      "door_paint",
      "window_install",
      "exterior_trim_paint",
    ]));
    expect(new Set(ids).size).toBe(ids.length);
    expect(checklist.suggestedMeasurements.interiorDoorCount).toBe(5);
    expect(checklist.suggestedMeasurements.windowCount).toBe(2);
  });
});
