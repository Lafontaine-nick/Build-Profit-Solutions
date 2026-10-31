const {
  buildCanonicalScope,
  canonicalScopeExcludedIds,
} = require("../canonicalScope");

describe("canonicalScope", () => {
  test("owner-handled carpet removal is excluded while LVP stays included", () => {
    const scope = buildCanonicalScope({
      notes:
        "Remove 1,200 sqft of carpet and install 1,200 sqft of LVP. Homeowner is removing the carpet.",
      checklistItems: [
        { id: "floor_demo", state: "included" },
        { id: "flooring_lvp", state: "included" },
      ],
    });
    expect([...canonicalScopeExcludedIds(scope)]).toContain("floor_demo");
    expect(
      scope.items.find((item) => item.id === "flooring_lvp")?.status,
    ).toBe("included");
  });

  test("no new hang is an exclusion", () => {
    const scope = buildCanonicalScope({
      notes: "Patch and texture 300 sqft of drywall. No new hang.",
    });
    expect([...canonicalScopeExcludedIds(scope)]).toContain("drywall_hang");
  });
});
