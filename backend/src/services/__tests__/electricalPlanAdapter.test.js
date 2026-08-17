const {
  applyElectricalVisionTakeoff,
  normalizeElectricalPlanMeasurements,
} = require("../electricalPlanAdapter");

describe("electricalPlanAdapter", () => {
  test("counts the semantic item and applies hookup ownership", () => {
    const normalized = normalizeElectricalPlanMeasurements({
      duplexReceptacleCount: 42,
      gfciCount: 6,
      rangeCircuitCount: 1,
      circuit50aCount: 1,
      singlePoleCount: 12,
      threeWayCount: 4,
      dedicated20aCircuitCount: 1,
      dishwasherCircuitCount: 1,
    });
    expect(normalized.standardReceptacleCount).toBe(42);
    expect(normalized.gfciReceptacleCount).toBe(6);
    expect(normalized.rangeHookupCount).toBe(1);
    expect(normalized.singlePoleSwitchCount).toBe(12);
    expect(normalized.threeWaySwitchCount).toBe(4);
    expect(normalized.dishwasherHookupCount).toBe(1);
    expect(normalized.circuit50aCount).toBeUndefined();
    expect(normalized.dedicated20aCircuitCount).toBeUndefined();
    expect(normalized.duplexReceptacleCount).toBeUndefined();
    expect(normalized.gfciCount).toBeUndefined();
    expect(normalized.standardReceptacleCount).not.toBe(42 + 6);
  });

  test("selected-trade vision keeps tier-1 symbols and drops unlabeled homeruns", () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: true,
      explicitlyLabeled: ["mainPanelCount"],
      electricalFieldEvidence: {
        mainPanelCount: [{ page: 5, sheet: "E1.1", label: "PANEL A" }],
      },
      measurements: {
        recessedLightCount: 34,
        gfciReceptacleCount: 6,
        mainPanelCount: 1,
        serviceAmperage: 200,
        threeWaySwitchCount: 4,
        standardCircuitCount: 18,
        circuit50aCount: 1,
        rangeHookupCount: 1,
        electricalIncludeRough: true,
        floorAreaSqft: 3660,
      },
    });
    expect(result.measurements.recessedLightCount).toBe(34);
    expect(result.measurements.gfciReceptacleCount).toBe(6);
    expect(result.measurements.mainPanelCount).toBe(1);
    expect(result.measurements.serviceAmperage).toBeUndefined();
    expect(result.measurements.threeWaySwitchCount).toBe(4);
    expect(result.measurements.rangeHookupCount).toBe(1);
    expect(result.measurements.standardCircuitCount).toBeUndefined();
    expect(result.measurements.circuit50aCount).toBeUndefined();
    expect(result.measurements.electricalIncludeRough).toBeUndefined();
    expect(result.measurements.floorAreaSqft).toBe(3660);
    expect(result.provenance.recessedLightCount).toMatchObject({
      confidenceTier: 2,
      evidenceKind: "symbols",
      note: "From plan symbols",
      normalizedSource: "NEEDS_REVIEW",
    });
    expect(result.provenance.gfciReceptacleCount).toMatchObject({
      note: "From plan symbols",
      source: "calculated_from_symbols",
      normalizedSource: "NEEDS_REVIEW",
    });
    expect(result.provenance.mainPanelCount.note).toBe("From panel callout");
    expect(result.provenance.threeWaySwitchCount).toMatchObject({
      confidenceTier: 2,
      note: "From plan symbols",
      normalizedSource: "NEEDS_REVIEW",
    });
    expect(result.provenance.standardCircuitCount).toBeUndefined();
  });

  test("keeps labeled service amperage and drops unlabeled 200A inference", () => {
    const labeled = applyElectricalVisionTakeoff({
      electricalSelected: true,
      explicitlyLabeled: ["serviceAmperage"],
      electricalFieldEvidence: {
        serviceAmperage: [{ page: 5, sheet: "E1.1", label: "125A" }],
      },
      measurements: { mainPanelCount: 1, serviceAmperage: 200 },
    });
    expect(labeled.measurements.serviceAmperage).toBe(200);
    const unlabeled = applyElectricalVisionTakeoff({
      electricalSelected: true,
      measurements: { mainPanelCount: 1, serviceAmperage: 200 },
    });
    expect(unlabeled.measurements.serviceAmperage).toBeUndefined();
    expect(unlabeled.measurements.mainPanelCount).toBe(1);
  });

  test("treats an explicit panel callout as Plan verified without requiring a second evidence record", () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: true,
      explicitlyLabeled: ["mainPanelCount"],
      measurements: { mainPanelCount: 1 },
    });
    expect(result.provenance.mainPanelCount).toMatchObject({
      status: "plan_verified",
      normalizedSource: "FROM_PLAN",
      pricingEligible: true,
    });
  });

  test("omits conflicted electrical counts so they are not auto-priced", () => {
    const {
      omitUnresolvedElectricalConflicts,
    } = require("../electricalPlanAdapter");
    const result = omitUnresolvedElectricalConflicts(
      {
        standardReceptacleCount: 50,
        recessedLightCount: 40,
        singlePoleSwitchCount: 15,
        smokeDetectorCount: 6,
      },
      [
        {
          field: "recessedLightCount",
          selectedValue: 40,
          requiresConfirmation: true,
          candidates: [{ value: 40 }, { value: 20 }],
        },
        {
          field: "singlePoleSwitchCount",
          selectedValue: 15,
          requiresConfirmation: true,
          candidates: [{ value: 15 }, { value: 20 }],
        },
        {
          field: "smokeDetectorCount",
          selectedValue: 6,
          requiresConfirmation: true,
          candidates: [{ value: 6 }, { value: 10 }],
        },
      ],
    );
    expect(result.measurements.standardReceptacleCount).toBe(50);
    expect(result.measurements.recessedLightCount).toBeUndefined();
    expect(result.measurements.singlePoleSwitchCount).toBeUndefined();
    expect(result.measurements.smokeDetectorCount).toBeUndefined();
  });

  test("does not keep unlabeled electrical counts on non-electrical takeoff", () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: false,
      measurements: {
        recessedLightCount: 34,
        floorAreaSqft: 3660,
        wallPaintSqft: 5000,
      },
    });
    expect(result.measurements.recessedLightCount).toBeUndefined();
    expect(result.measurements.floorAreaSqft).toBe(3660);
    expect(result.measurements.wallPaintSqft).toBe(5000);
  });

  test("instance-tag recessed lights are Plan verified, symbol GFCI is not", () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: true,
      explicitlyLabeled: ["mainPanelCount"],
      electricalFieldEvidence: {
        mainPanelCount: [{ page: 5, sheet: "E1.1", label: "PANEL A" }],
      },
      instanceTagKeys: ["recessedLightCount"],
      inferredKeys: ["gfciReceptacleCount"],
      measurements: {
        recessedLightCount: 48,
        gfciReceptacleCount: 8,
        ceilingFanCount: 8,
        standardReceptacleCount: 50,
        mainPanelCount: 1,
      },
    });
    expect(result.provenance.recessedLightCount).toMatchObject({
      evidenceKind: "instance_tags",
      source: "pdf_text_instance_tags",
      normalizedSource: "FROM_PLAN",
      note: "Counted from instance tags",
      confidenceTier: 1,
    });
    expect(result.provenance.gfciReceptacleCount).toMatchObject({
      evidenceKind: "inference",
      source: "inferred_from_context",
      normalizedSource: "NEEDS_REVIEW",
      note: "AI inferred — confirm",
    });
    expect(result.provenance.ceilingFanCount).toMatchObject({
      evidenceKind: "symbols",
      note: "From plan symbols",
      normalizedSource: "NEEDS_REVIEW",
    });
    expect(result.provenance.standardReceptacleCount).toMatchObject({
      evidenceKind: "symbols",
      normalizedSource: "NEEDS_REVIEW",
    });
    expect(result.provenance.mainPanelCount).toMatchObject({
      evidenceKind: "explicit_label",
      normalizedSource: "FROM_PLAN",
    });
  });

  test("two agreeing vision passes are AI verified only with full sheet coverage", () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: true,
      methodsAgreeKeys: ["standardReceptacleCount", "gfciReceptacleCount"],
      independentVisionAgreementKeys: [
        "standardReceptacleCount",
        "gfciReceptacleCount",
      ],
      electricalRelevantPages: [{ page: 5 }, { page: 6 }],
      electricalRenderedPages: [{ page: 5 }, { page: 6 }],
      electricalSheetEvidence: {
        sheetSubtotals: [
          {
            page: 5,
            sheet: "E1.1",
            coverage: "complete",
            counts: { standardReceptacleCount: 30, gfciReceptacleCount: 4 },
          },
          {
            page: 6,
            sheet: "E1.2",
            coverage: "complete",
            counts: { standardReceptacleCount: 20, gfciReceptacleCount: 4 },
          },
        ],
      },
      inferredKeys: ["gfciReceptacleCount"],
      measurements: {
        standardReceptacleCount: 50,
        gfciReceptacleCount: 8,
      },
    });
    expect(result.provenance.standardReceptacleCount).toMatchObject({
      methodsAgree: true,
      status: "ai_verified",
      normalizedSource: "AI_VERIFIED",
      pricingEligible: true,
      confidenceTier: 2,
    });
    expect(result.provenance.gfciReceptacleCount).toMatchObject({
      evidenceKind: "inference",
      normalizedSource: "NEEDS_REVIEW",
      pricingEligible: false,
      note: "AI inferred — confirm",
    });
  });

  test("agreeing AI counts without sheet subtotals stay reviewable and unpriced", () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: true,
      methodsAgreeKeys: ["standardReceptacleCount"],
      independentVisionAgreementKeys: ["standardReceptacleCount"],
      measurements: { standardReceptacleCount: 50 },
    });
    expect(result.provenance.standardReceptacleCount).toMatchObject({
      status: "needs_review",
      normalizedSource: "NEEDS_REVIEW",
      pricingEligible: false,
      fullSheetCoverage: false,
    });
  });

  test("Lot 58 confidence output is stable across ten identical imports", () => {
    const run = () =>
      applyElectricalVisionTakeoff({
        electricalSelected: true,
        explicitlyLabeled: ["mainPanelCount", "rangeHookupCount"],
        electricalFieldEvidence: {
          mainPanelCount: [{ page: 5, sheet: "E1.1", label: "PANEL A" }],
          rangeHookupCount: [{ page: 5, sheet: "E1.1", label: "RANGE" }],
        },
        independentVisionAgreementKeys: [
          "standardReceptacleCount",
          "gfciReceptacleCount",
        ],
        methodsAgreeKeys: ["standardReceptacleCount", "gfciReceptacleCount"],
        electricalRelevantPages: [{ page: 5 }, { page: 6 }],
        electricalRenderedPages: [{ page: 5 }, { page: 6 }],
        electricalSheetEvidence: {
          sheetSubtotals: [
            {
              page: 5,
              sheet: "E1.1",
              coverage: "complete",
              counts: {
                standardReceptacleCount: 30,
                gfciReceptacleCount: 4,
              },
            },
            {
              page: 6,
              sheet: "E1.2",
              coverage: "complete",
              counts: {
                standardReceptacleCount: 20,
                gfciReceptacleCount: 4,
              },
            },
          ],
        },
        measurements: {
          mainPanelCount: 1,
          rangeHookupCount: 1,
          standardReceptacleCount: 50,
          gfciReceptacleCount: 8,
          threeWaySwitchCount: 6,
          smokeDetectorCount: 10,
        },
      });
    const signatures = Array.from({ length: 10 }, () => {
      const result = run();
      return JSON.stringify({
        measurements: result.measurements,
        provenance: result.provenance,
        validation: result.electricalValidation,
      });
    });
    expect(new Set(signatures).size).toBe(1);
  });

  test("confidence rules are not tied to Lot 58 quantities", () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: true,
      methodsAgreeKeys: ["standardReceptacleCount"],
      independentVisionAgreementKeys: ["standardReceptacleCount"],
      electricalRelevantPages: [{ page: 2 }],
      electricalRenderedPages: [{ page: 2 }],
      electricalSheetEvidence: {
        sheetSubtotals: [
          {
            page: 2,
            sheet: "E2.0",
            coverage: "complete",
            counts: { standardReceptacleCount: 12 },
          },
        ],
      },
      measurements: { standardReceptacleCount: 12 },
    });
    expect(result.provenance.standardReceptacleCount).toMatchObject({
      status: "ai_verified",
      pricingEligible: true,
    });
  });

  test("materially different electrical plan sets keep their own counts and confidence", () => {
    const makePlan = ({ page, sheet, recessed, receptacles }) =>
      applyElectricalVisionTakeoff({
        electricalSelected: true,
        instanceTagKeys: ["recessedLightCount"],
        independentVisionAgreementKeys: ["standardReceptacleCount"],
        methodsAgreeKeys: ["standardReceptacleCount"],
        electricalRelevantPages: [{ page }],
        electricalRenderedPages: [{ page }],
        electricalSheetEvidence: {
          sheetSubtotals: [
            {
              page,
              sheet,
              coverage: "complete",
              counts: {
                recessedLightCount: recessed,
                standardReceptacleCount: receptacles,
              },
            },
          ],
        },
        measurements: {
          recessedLightCount: recessed,
          standardReceptacleCount: receptacles,
        },
      });

    const lot58Like = makePlan({
      page: 5,
      sheet: "E1.1",
      recessed: 48,
      receptacles: 50,
    });
    const alternate = makePlan({
      page: 12,
      sheet: "E3.0",
      recessed: 12,
      receptacles: 18,
    });

    expect(lot58Like.measurements).toMatchObject({
      recessedLightCount: 48,
      standardReceptacleCount: 50,
    });
    expect(alternate.measurements).toMatchObject({
      recessedLightCount: 12,
      standardReceptacleCount: 18,
    });
    expect(alternate.provenance.recessedLightCount).toMatchObject({
      status: "plan_verified",
      pricingEligible: true,
    });
    expect(alternate.provenance.standardReceptacleCount).toMatchObject({
      status: "ai_verified",
      pricingEligible: true,
    });
  });

  test("structured validation classifies conflicts and missing printed fields", () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: true,
      measurements: {
        threeWaySwitchCount: 6,
        mainPanelCount: 1,
      },
      explicitlyLabeled: ["mainPanelCount"],
      electricalFieldEvidence: {
        mainPanelCount: [{ page: 5, sheet: "E1.1", label: "PANEL A" }],
      },
      measurementConflicts: [
        {
          field: "threeWaySwitchCount",
          requiresConfirmation: true,
          candidates: [{ value: 6 }, { value: 5 }],
        },
      ],
      unreadableFields: [
        { field: "serviceAmperage", reason: "No printed amperage callout" },
      ],
    });
    expect(result.electricalValidation.fields).toMatchObject({
      threeWaySwitchCount: {
        status: "conflict",
        pricingEligible: false,
      },
      serviceAmperage: {
        status: "not_detected",
        pricingEligible: false,
      },
      mainPanelCount: {
        status: "plan_verified",
        pricingEligible: true,
      },
    });
    expect(result.electricalValidation.summary).toMatchObject({
      priceableCount: 1,
      conflictCount: 1,
      notDetectedCount: 1,
    });
  });

  test("low-confidence appliance readings remain visible but unpriced", () => {
    const result = applyElectricalVisionTakeoff({
      electricalSelected: true,
      measurements: {
        rangeHookupCount: 1,
        dryerHookupCount: 1,
      },
      unreadableFields: [
        { field: "rangeHookupCount", reason: "Read 1, confidence too low" },
        { field: "dryerHookupCount", reason: "Read 1, confidence too low" },
      ],
    });

    expect(result.measurements).toMatchObject({
      rangeHookupCount: 1,
      dryerHookupCount: 1,
    });
    expect(result.electricalValidation.fields).toMatchObject({
      rangeHookupCount: {
        status: "needs_review",
        pricingEligible: false,
      },
      dryerHookupCount: {
        status: "needs_review",
        pricingEligible: false,
      },
    });
    expect(result.electricalValidation.priceableFields).not.toEqual(
      expect.arrayContaining(["rangeHookupCount", "dryerHookupCount"]),
    );
    expect(result.provenance.rangeHookupCount).toMatchObject({
      status: "needs_review",
      pricingEligible: false,
    });
  });
});
