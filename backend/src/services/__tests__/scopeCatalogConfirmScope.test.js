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

  test("treats generic door notes as interior door installation", () => {
    const notes =
      "Remodel the bathroom with demolition, fixtures, tile, flooring, drywall, doors, insulation, trim, electrical, and paint.";
    const checklist = buildScopeChecklist(
      { projectType: "bathroom", originalNotes: notes, rooms: [] },
      "room_remodel",
      notes,
    );
    const doors = checklist.items.find(
      (item) => item.id === "interior_door_install",
    );

    expect(doors).toMatchObject({
      label: "Interior door installation",
      state: "included",
      noteBacked: true,
    });
  });

  test("paints doors and walls without installing doors or painting trim", () => {
    const notes = "Paint the doors and walls.";
    const checklist = buildScopeChecklist(
      { projectType: "painting", originalNotes: notes, rooms: [] },
      "room_remodel",
      notes,
    );
    const state = (id) => checklist.items.find((item) => item.id === id)?.state;

    expect(state("door_paint")).toBe("included");
    expect(state("interior_paint")).toBe("included");
    expect(state("trim_paint")).not.toBe("included");
    expect(state("interior_door_install")).not.toBe("included");
  });

  test("does not install doors the note only paints or keeps", () => {
    const notes =
      "Whole house remodel. Paint all walls and ceilings. Keep the windows and doors.";
    const checklist = buildScopeChecklist(
      { projectType: "other", originalNotes: notes, rooms: [] },
      "room_remodel",
      notes,
    );
    const doors = checklist.items.find(
      (item) => item.id === "interior_door_install",
    );

    expect(doors?.state).not.toBe("included");
  });
});
