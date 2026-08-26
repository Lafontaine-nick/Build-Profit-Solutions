const {
  applyHvacProvenanceGuard,
  hvacDeterministicPdfKeys,
  restoreHvacLowConfidenceMeasurements,
} = require('../hvacPlanAdapter');

describe('applyHvacProvenanceGuard', () => {
  it('marks vision-only HVAC reads as NEEDS_REVIEW when the PDF has no mechanical evidence', () => {
    const measurements = {
      hvacSystemCount: 2,
      hvacSystemTons: 5,
      hvacDuctworkLf: 150,
      hvacSupplyRegisterCount: 10,
      hvacReturnGrilleCount: 8,
      hvacThermostatCount: 2,
    };
    const measurementProvenance = {
      hvacSystemCount: { source: 'general_plan_takeoff', value: 2 },
      hvacDuctworkLf: { source: 'vision_takeoff', value: 150 },
    };
    const pdfTakeoff = {
      hvacRelevantPages: [],
      hvacInstanceTags: { measurements: {} },
      hvacEquipmentHints: { measurements: {} },
    };

    const { measurementProvenance: guarded } = applyHvacProvenanceGuard({
      measurements,
      measurementProvenance,
      pdfTakeoff,
    });

    expect(hvacDeterministicPdfKeys(pdfTakeoff).size).toBe(0);
    for (const key of Object.keys(measurements)) {
      expect(guarded[key]).toMatchObject({
        normalizedSource: 'NEEDS_REVIEW',
        status: 'needs_review',
        pricingEligible: false,
      });
    }
  });

  it('keeps register counts plan-verified when PDF text tags exist', () => {
    const pdfTakeoff = {
      hvacRelevantPages: [],
      hvacInstanceTags: {
        measurements: {
          hvacSupplyRegisterCount: 10,
          hvacReturnGrilleCount: 8,
        },
      },
      hvacEquipmentHints: { measurements: {} },
    };
    const measurements = {
      hvacSupplyRegisterCount: 10,
      hvacReturnGrilleCount: 8,
      hvacSystemCount: 2,
    };

    const { measurementProvenance: guarded } = applyHvacProvenanceGuard({
      measurements,
      measurementProvenance: {},
      pdfTakeoff,
    });

    expect(guarded.hvacSupplyRegisterCount).toMatchObject({
      normalizedSource: 'FROM_PLAN',
      status: 'plan_verified',
      pricingEligible: true,
    });
    expect(guarded.hvacReturnGrilleCount).toMatchObject({
      normalizedSource: 'FROM_PLAN',
      pricingEligible: true,
    });
    expect(guarded.hvacSystemCount).toMatchObject({
      normalizedSource: 'NEEDS_REVIEW',
      pricingEligible: false,
    });
  });

  it('keeps ERV/HRV ventilation plan-verified when PDF text tags exist', () => {
    const pdfTakeoff = {
      hvacRelevantPages: [{ page: 8, reasons: ['M sheet'] }],
      hvacInstanceTags: {
        measurements: {
          hvacVentilationCount: 1,
        },
      },
      hvacEquipmentHints: { measurements: {} },
    };

    const { measurementProvenance: guarded } = applyHvacProvenanceGuard({
      measurements: { hvacVentilationCount: 1 },
      measurementProvenance: {},
      pdfTakeoff,
    });

    expect(guarded.hvacVentilationCount).toMatchObject({
      normalizedSource: 'FROM_PLAN',
      status: 'plan_verified',
      pricingEligible: true,
    });
  });

  it('keeps system count plan-verified when equipment schedule documents it', () => {
    const pdfTakeoff = {
      hvacRelevantPages: [3],
      hvacInstanceTags: { measurements: {} },
      hvacEquipmentHints: {
        measurements: {
          hvacSystemCount: 1,
          hvacSystemTons: 4,
        },
      },
    };

    const { measurementProvenance: guarded } = applyHvacProvenanceGuard({
      measurements: { hvacSystemCount: 1, hvacSystemTons: 4 },
      measurementProvenance: {},
      pdfTakeoff,
    });

    expect(guarded.hvacSystemCount).toMatchObject({
      normalizedSource: 'FROM_PLAN',
      pricingEligible: true,
    });
    expect(guarded.hvacSystemTons).toMatchObject({
      normalizedSource: 'FROM_PLAN',
      pricingEligible: true,
    });
  });

  it('discards vision-only whole-house ventilation when PDF has no ERV/HRV evidence', () => {
    const pdfTakeoff = {
      hvacRelevantPages: [],
      hvacInstanceTags: { measurements: {} },
      hvacEquipmentHints: { measurements: {} },
    };

    const { measurements, measurementProvenance } = applyHvacProvenanceGuard({
      measurements: { hvacVentilationCount: 1, hvacSystemCount: 2 },
      measurementProvenance: {
        hvacVentilationCount: { source: 'vision_takeoff', value: 1 },
      },
      pdfTakeoff,
    });

    expect(measurements.hvacVentilationCount).toBeUndefined();
    expect(measurementProvenance.hvacVentilationCount).toBeUndefined();
    expect(measurements.hvacSystemCount).toBe(2);
  });
});

describe('restoreHvacLowConfidenceMeasurements', () => {
  it('puts withheld HVAC vision reads back into measurements for plan review', () => {
    const restored = restoreHvacLowConfidenceMeasurements(
      {},
      [
        { field: 'hvacSystemCount', value: 2, confidence: 0.4 },
        { field: 'hvacDuctworkLf', value: 150, confidence: 0.35 },
        { field: 'floorAreaSqft', value: 3660, confidence: 0.3 },
      ]
    );
    expect(restored).toEqual({
      hvacSystemCount: 2,
      hvacDuctworkLf: 150,
    });
  });

  it('does not restore withheld vision guesses for whole-house ventilation', () => {
    const restored = restoreHvacLowConfidenceMeasurements(
      {},
      [{ field: 'hvacVentilationCount', value: 1, confidence: 0.4 }]
    );
    expect(restored).toEqual({});
  });
});
