import {
  applyHvacProvenanceGuardToScopeMeasurements,
  buildHvacStructuredMeasurements,
  copyHvacQuantityFields,
  hvacQuickMeasurementSourcesFromProvenance,
  hvacSystemTierBudgetSplit,
  HVAC_PLAN_EXPORT_SCOPE_ITEM_IDS,
  buildHvacPlanReviewLowConfidenceReadings,
  filterHvacPlanReviewReadingsForTakeoff,
  hvacTakeoffSkippedCanonicalReadings,
  isExplicitHvacVentilationEvidence,
  resolveHvacPlanReviewMeasurements,
  stripUnverifiedHvacVentilation,
  snapHvacTonnageTier,
} from '@/utils/subcontractorTrade/hvacPlanConvergence';
import {
  groupQuickMeasurementFields,
  resolveQuickMeasurementFields,
} from '@/utils/quickMeasurementProvenance';
import {
  prepareScopeMeasurementsInputForUi,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';

describe('hvacPlanConvergence', () => {
  it('snaps documented tonnage to standard residential tiers', () => {
    expect(snapHvacTonnageTier(3.2)).toBe(3);
    expect(snapHvacTonnageTier(4.4)).toBe(4);
    expect(snapHvacTonnageTier(5.2)).toBe(5);
  });

  it('returns higher material/labor splits for larger tonnage tiers', () => {
    const twoTon = hvacSystemTierBudgetSplit(2);
    const fiveTon = hvacSystemTierBudgetSplit(5);
    expect(fiveTon.material + fiveTon.labor).toBeGreaterThan(
      twoTon.material + twoTon.labor
    );
    expect(fiveTon.sourceLabel).toContain('5-ton');
  });

  it('maps supply registers and return grilles to structured item quantities', () => {
    expect(
      buildHvacStructuredMeasurements({
        hvacSystemCount: 1,
        hvacSystemTons: 4,
        hvacSupplyRegisterCount: 14,
        hvacReturnGrilleCount: 3,
      }).itemQuantities
    ).toMatchObject({
      hvac: { quantity: 1, unit: 'each' },
      supply_registers: { quantity: 14, unit: 'each' },
      return_grilles: { quantity: 3, unit: 'each' },
    });
  });

  it('limits plan export scope to new-construction distribution cards', () => {
    expect(HVAC_PLAN_EXPORT_SCOPE_ITEM_IDS).not.toContain('service_call');
    expect(HVAC_PLAN_EXPORT_SCOPE_ITEM_IDS).toEqual(
      expect.arrayContaining(['supply_registers', 'return_grilles'])
    );
  });

  it('copyHvacQuantityFields reads canonical HVAC quick-measurement keys', () => {
    expect(
      copyHvacQuantityFields({
        hvacSystemCount: 2,
        hvacSystemTons: 4,
        hvacDuctworkLf: 150,
        hvacSupplyRegisterCount: 10,
        hvacReturnGrilleCount: 8,
        hvacThermostatCount: 2,
        hvacVentilationCount: 1,
      })
    ).toMatchObject({
      hvacSystemCount: 2,
      hvacSystemTons: 4,
      hvacDuctworkLf: 150,
      hvacSupplyRegisterCount: 10,
      hvacReturnGrilleCount: 8,
      hvacThermostatCount: 2,
      hvacVentilationCount: 1,
    });
  });

  it('preserves HVAC plan measurements through Confirm Scope payload round-trip', () => {
    const input = {
      hvacSystemCount: '2',
      hvacSystemTons: '5',
      hvacDuctworkLf: '150',
      hvacSupplyRegisterCount: '10',
      hvacReturnGrilleCount: '8',
      hvacThermostatCount: '2',
      hvacVentilationCount: '1',
      quickMeasurementSources: {
        hvacSystemCount: 'needs_confirmation',
        hvacDuctworkLf: 'needs_confirmation',
      },
      planImportTradeKey: 'hvac',
      planImportMode: 'selected_trade',
    };
    const restored = prepareScopeMeasurementsInputForUi(input, {
      templateKey: 'hvac',
    });
    expect(restored).toMatchObject({
      hvacSystemCount: '2',
      hvacSystemTons: '5',
      hvacDuctworkLf: '150',
      hvacSupplyRegisterCount: '10',
      hvacReturnGrilleCount: '8',
      hvacThermostatCount: '2',
      hvacVentilationCount: '1',
    });
    expect(
      scopeMeasurementsPayloadForPersist(restored, { templateKey: 'hvac' })
    ).toMatchObject({
      hvacSystemCount: 2,
      hvacDuctworkLf: 150,
      hvacSupplyRegisterCount: 10,
    });
  });

  it('maps NEEDS_REVIEW provenance to needs_confirmation quick-measurement sources', () => {
    const provenance = {
      hvacSystemCount: {
        normalizedSource: 'NEEDS_REVIEW',
        status: 'needs_review',
        pricingEligible: false,
      },
      hvacDuctworkLf: {
        normalizedSource: 'NEEDS_REVIEW',
        status: 'needs_review',
        pricingEligible: false,
      },
    };
    expect(
      hvacQuickMeasurementSourcesFromProvenance(
        { hvacSystemCount: 2, hvacDuctworkLf: 150 },
        provenance
      )
    ).toEqual({
      hvacSystemCount: 'needs_confirmation',
      hvacDuctworkLf: 'needs_confirmation',
    });
  });

  it('demotes plan-detected HVAC tags without mechanical evidence', () => {
    const guarded = applyHvacProvenanceGuardToScopeMeasurements({
      hvacSystemCount: '2',
      hvacDuctworkLf: '150',
      quickMeasurementSources: {
        hvacSystemCount: 'detected_from_plan',
        hvacDuctworkLf: 'plan_detected',
      },
    });
    expect(guarded.quickMeasurementSources).toEqual({
      hvacSystemCount: 'needs_confirmation',
      hvacDuctworkLf: 'needs_confirmation',
    });
  });

  it('builds itemQuantities with needs_confirmation when sources require review', () => {
    expect(
      buildHvacStructuredMeasurements(
        {
          hvacSystemCount: 2,
          hvacDuctworkLf: 150,
        },
        {
          hvacSystemCount: 'needs_confirmation',
          hvacDuctworkLf: 'needs_confirmation',
        }
      ).itemQuantities
    ).toMatchObject({
      hvac: { quantity: 2, quantitySource: 'needs_confirmation' },
      ductwork: { quantity: 150, quantitySource: 'needs_confirmation' },
    });
  });

  it('groups vision-only HVAC fields under Needs confirmation in Step 2', () => {
    const results = resolveQuickMeasurementFields({
      rows: [
        [
          { key: 'hvacSystemCount', label: 'HVAC system', unit: 'each' },
          { key: 'hvacDuctworkLf', label: 'Ductwork', unit: 'lf' },
        ],
      ],
      measurements: {
        hvacSystemCount: '2',
        hvacDuctworkLf: '150',
      },
      sourceMap: {
        hvacSystemCount: 'needs_confirmation',
        hvacDuctworkLf: 'needs_confirmation',
      },
      includedScopeKeys: ['hvac', 'ductwork'],
      templateKey: 'hvac',
    });
    const groups = groupQuickMeasurementFields(results);
    expect(groups.fromPlan.map(row => row.key)).toEqual([]);
    expect(groups.needsConfirmation.map(row => row.key)).toEqual([
      'hvacSystemCount',
      'hvacDuctworkLf',
    ]);
  });

  it('resolveHvacPlanReviewMeasurements prefers numeric measurements but falls back to low-confidence and provenance', () => {
    expect(
      resolveHvacPlanReviewMeasurements({
        measurements: {
          hvacSystemCount: '',
          hvacSystemTons: 'needs_confirmation',
        },
        lowConfidence: [
          { field: 'hvacSystemCount', value: 2 },
          { field: 'hvacSystemTons', value: 5 },
          { field: 'hvacDuctworkLf', value: 150 },
          { field: 'hvacVentilationCount', value: 1 },
        ],
        measurementProvenance: {
          hvacSupplyRegisterCount: {
            value: 10,
            normalizedSource: 'NEEDS_REVIEW',
          },
          hvacReturnGrilleCount: {
            value: 8,
            normalizedSource: 'NEEDS_REVIEW',
          },
        },
        itemQuantities: {
          thermostat: { quantity: 2, unit: 'each' },
        },
      })
    ).toEqual({
      hvacSystemCount: '2',
      hvacSystemTons: '5',
      hvacDuctworkLf: '150',
      hvacSupplyRegisterCount: '10',
      hvacReturnGrilleCount: '8',
      hvacThermostatCount: '2',
      hvacVentilationCount: '',
    });
  });

  it('resolveHvacPlanReviewMeasurements keeps explicit ERV/HRV ventilation reads', () => {
    expect(
      resolveHvacPlanReviewMeasurements({
        measurements: { hvacVentilationCount: 1 },
        measurementProvenance: {
          hvacVentilationCount: {
            source: 'pdf_text_instance_tags',
            normalizedSource: 'FROM_PLAN',
            status: 'plan_verified',
            value: 1,
          },
        },
      }).hvacVentilationCount
    ).toBe('1');
  });

  it('resolveHvacPlanReviewMeasurements backfills withheld low-confidence reads when measurements carry placeholders', () => {
    expect(
      resolveHvacPlanReviewMeasurements({
        measurements: {
          hvacSystemCount: 'needs_confirmation',
          hvacThermostatCount: '',
        },
        lowConfidence: [
          { field: 'hvacSystemCount', value: 2, confidence: 0.42 },
          { field: 'hvacThermostatCount', value: 2, confidence: 0.38 },
          { field: 'hvacDuctworkLf', value: 150, confidence: 0.35 },
        ],
      })
    ).toEqual({
      hvacSystemCount: '2',
      hvacSystemTons: '',
      hvacDuctworkLf: '150',
      hvacSupplyRegisterCount: '',
      hvacReturnGrilleCount: '',
      hvacThermostatCount: '2',
      hvacVentilationCount: '',
    });
  });

  it('buildHvacPlanReviewLowConfidenceReadings uses resolved visible measurements as overrides', () => {
    expect(
      buildHvacPlanReviewLowConfidenceReadings(
        {
          measurements: {},
          lowConfidence: [{ field: 'hvacThermostatCount', value: 2, confidence: 0.4 }],
        },
        { hvacThermostatCount: '2' }
      ).find(row => row.field === 'hvacThermostatCount')
    ).toEqual({ field: 'hvacThermostatCount', value: 2 });
  });

  it('buildHvacPlanReviewLowConfidenceReadings merges low-confidence and resolved measurements for all review rows', () => {
    expect(
      buildHvacPlanReviewLowConfidenceReadings({
        measurements: { hvacSystemCount: 2 },
        lowConfidence: [
          { field: 'hvacDuctworkLf', value: 150 },
          { field: 'hvacVentilationCount', value: 1 },
        ],
        measurementProvenance: {
          hvacSupplyRegisterCount: {
            value: 10,
            normalizedSource: 'NEEDS_REVIEW',
          },
        },
      })
    ).toEqual([
      { field: 'hvacSystemCount', value: 2 },
      { field: 'hvacSystemTons', value: 0 },
      { field: 'hvacDuctworkLf', value: 150 },
      { field: 'hvacSupplyRegisterCount', value: 10 },
      { field: 'hvacReturnGrilleCount', value: 0 },
      { field: 'hvacThermostatCount', value: 0 },
      { field: 'hvacVentilationCount', value: 0 },
    ]);
  });

  it('buildHvacPlanReviewLowConfidenceReadings keeps explicit ERV/HRV ventilation rows', () => {
    expect(
      buildHvacPlanReviewLowConfidenceReadings({
        measurements: { hvacVentilationCount: 1 },
        measurementProvenance: {
          hvacVentilationCount: {
            source: 'pdf_text_equipment_schedule',
            normalizedSource: 'FROM_PLAN',
            status: 'plan_verified',
            value: 1,
          },
        },
      }).find(row => row.field === 'hvacVentilationCount')
    ).toEqual({ field: 'hvacVentilationCount', value: 1 });
  });

  it('hvacTakeoffSkippedCanonicalReadings returns unaccepted canonical rows for Step 2', () => {
    const readings = buildHvacPlanReviewLowConfidenceReadings({
      measurements: { hvacSystemCount: 2 },
      lowConfidence: [{ field: 'hvacDuctworkLf', value: 150 }],
    });
    expect(
      hvacTakeoffSkippedCanonicalReadings(readings, {
        hvacSystemCount: true,
      }).map(row => row.field)
    ).toEqual([
      'hvacSystemTons',
      'hvacDuctworkLf',
      'hvacSupplyRegisterCount',
      'hvacReturnGrilleCount',
      'hvacThermostatCount',
    ]);
  });

  it('hvacTakeoffSkippedCanonicalReadings includes unaccepted rows without a plan read', () => {
    const readings = buildHvacPlanReviewLowConfidenceReadings({
      measurements: { hvacThermostatCount: 2 },
    });
    expect(
      hvacTakeoffSkippedCanonicalReadings(readings, {}).map(row => [
        row.field,
        row.value,
      ])
    ).toEqual(
      expect.arrayContaining([['hvacThermostatCount', 2]])
    );
    expect(
      hvacTakeoffSkippedCanonicalReadings(readings, {}).map(row => row.field)
    ).not.toContain('hvacVentilationCount');
  });

  it('filterHvacPlanReviewReadingsForTakeoff omits optional ventilation without a plan read', () => {
    const readings = buildHvacPlanReviewLowConfidenceReadings({
      measurements: { hvacThermostatCount: 2, hvacVentilationCount: 1 },
      measurementProvenance: {
        hvacVentilationCount: {
          source: 'vision_takeoff',
          normalizedSource: 'NEEDS_REVIEW',
          status: 'needs_review',
          value: 1,
        },
      },
    });
    expect(
      filterHvacPlanReviewReadingsForTakeoff(readings, {
        measurements: { hvacVentilationCount: 1 },
        measurementProvenance: readings.length
          ? {
              hvacVentilationCount: {
                source: 'vision_takeoff',
                normalizedSource: 'NEEDS_REVIEW',
                status: 'needs_review',
                value: 1,
              },
            }
          : {},
      }).map(row => row.field)
    ).not.toContain('hvacVentilationCount');

    const explicit = buildHvacPlanReviewLowConfidenceReadings({
      measurements: { hvacVentilationCount: 1 },
      measurementProvenance: {
        hvacVentilationCount: {
          source: 'pdf_text_instance_tags',
          normalizedSource: 'FROM_PLAN',
          status: 'plan_verified',
          value: 1,
        },
      },
    });
    expect(
      filterHvacPlanReviewReadingsForTakeoff(explicit, {
        measurements: { hvacVentilationCount: 1 },
        measurementProvenance: {
          hvacVentilationCount: {
            source: 'pdf_text_instance_tags',
            normalizedSource: 'FROM_PLAN',
            status: 'plan_verified',
            value: 1,
          },
        },
      }).map(row => row.field)
    ).toContain('hvacVentilationCount');
  });

  it('stripUnverifiedHvacVentilation removes vision-only ventilation quantities', () => {
    expect(
      stripUnverifiedHvacVentilation({
        hvacVentilationCount: 1,
        measurementProvenance: {
          hvacVentilationCount: {
            source: 'vision_takeoff',
            normalizedSource: 'NEEDS_REVIEW',
            status: 'needs_review',
            value: 1,
          },
        },
        quickMeasurementSources: {
          hvacVentilationCount: 'needs_confirmation',
        },
        itemQuantities: {
          ventilation: { quantity: 1, unit: 'each', quantitySource: 'plan_detected' },
        },
      }).hvacVentilationCount
    ).toBeUndefined();
  });

  it('applyHvacProvenanceGuard keeps needs_review ahead of deterministic HVAC tags', () => {
    const guarded = applyHvacProvenanceGuardToScopeMeasurements({
      hvacVentilationCount: 1,
      measurementProvenance: {
        hvacVentilationCount: {
          source: 'pdf_text_instance_tags',
          normalizedSource: 'NEEDS_REVIEW',
          status: 'needs_review',
          pricingEligible: false,
          value: 1,
        },
      },
      quickMeasurementSources: {
        hvacVentilationCount: 'plan_verified',
      },
    });
    expect(guarded.quickMeasurementSources).toEqual({
      hvacVentilationCount: 'needs_confirmation',
    });
  });
});
