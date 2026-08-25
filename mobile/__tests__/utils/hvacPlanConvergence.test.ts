import {
  applyHvacProvenanceGuardToScopeMeasurements,
  buildHvacStructuredMeasurements,
  copyHvacQuantityFields,
  hvacQuickMeasurementSourcesFromProvenance,
  hvacSystemTierBudgetSplit,
  HVAC_PLAN_EXPORT_SCOPE_ITEM_IDS,
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
});
