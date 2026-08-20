import {
  buildPlumbingStructuredMeasurements,
  hasDetailedPlumbingQuantities,
  normalizePlumbingPlanMeasurements,
  parsePlumbingMeasurementsFromNotes,
  PLUMBING_CARDS,
  PLUMBING_PLAN_EXPORT_CHECKLIST_GROUPS,
  PLUMBING_REVIEW_MEASUREMENT_KEYS,
  syncPlumbingScopeItems,
  plumbingScopeSyncSignature,
} from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import { groupScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';
import { getSubcontractorTradeDefinition } from '@/utils/subcontractorTrade/tradeDefinitions';
import {
  normalizeScopeMeasurements,
  prepareScopeMeasurementsInputForUi,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import { applyPlanImportToDraft, planImportPayloadFromDraft } from '@/utils/estimateAiDraft';
import {
  filterChecklistItemsForTrade,
  filterPlanMeasurementsForTrade,
  filterPlanScopesForTrade,
} from '@/utils/planImportTradeConfig';

describe('plumbing canonical architecture', () => {
  it('defines one canonical owner for every Plumbing quantity', () => {
    const keys = PLUMBING_CARDS.map(card => card.measurementKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(getSubcontractorTradeDefinition('plumbing')).toMatchObject({
      status: 'complete',
      standaloneTemplateKey: 'plumbing_service',
      reviewMeasurementKeys: PLUMBING_REVIEW_MEASUREMENT_KEYS,
    });
  });

  it('names fixture allowance card and groups plan export scopes by construction phase', () => {
    expect(
      PLUMBING_CARDS.find(card => card.itemId === 'plumbing_fixtures_hardware')?.label
    ).toBe('Plumbing fixture allowance');
    expect(PLUMBING_PLAN_EXPORT_CHECKLIST_GROUPS.map(group => group.title)).toEqual([
      'Underground',
      'Rough plumbing',
      'Finish plumbing',
      'Service / repairs',
      'Materials / closeout',
    ]);

    const plan58Items = [
      'water_line',
      'sewer_line',
      'gas_line',
      'plumbing_rough',
      'plumbing_trim',
      'plumbing_fixtures_hardware',
      'water_heater',
      'gas_appliance_connections',
    ].map(id => ({
      id,
      label: id,
      state: 'included' as const,
      inputType: 'yes_no' as const,
    }));
    const grouped = groupScopeChecklistItems(plan58Items, 'plumbing_service');
    expect(grouped.map(group => group.title)).toEqual([
      'Underground',
      'Rough plumbing',
      'Finish plumbing',
    ]);
    expect(grouped.find(group => group.title === 'Other')).toBeUndefined();
    expect(
      grouped.find(group => group.title === 'Finish plumbing')?.items.map(item => item.id)
    ).toEqual([
      'plumbing_trim',
      'plumbing_fixtures_hardware',
      'water_heater',
      'gas_appliance_connections',
    ]);
  });

  it('keeps service and allowance cards out of selected-trade Plan Export', () => {
    expect(
      Object.keys(
        filterPlanMeasurementsForTrade(
          {
            plumbingRoughPointCount: 4,
            fixtureReplacementCount: 3,
            serviceCallCount: 1,
            fixtureRepairCount: 2,
            partsMaterialsCount: 1,
            gasLineLf: 100,
          },
          'selected_trade',
          'plumbing'
        )
      )
    ).toEqual(['plumbingRoughPointCount', 'gasLineLf']);

    expect(
      filterChecklistItemsForTrade(
        [
          { id: 'plumbing_rough' },
          { id: 'fixture_replace' },
          { id: 'service_call' },
          { id: 'fixture_repair' },
          { id: 'parts_materials' },
          { id: 'gas_line' },
        ],
        'selected_trade',
        'plumbing'
      ).map(item => item.id)
    ).toEqual(['plumbing_rough', 'gas_line']);

    expect(
      filterPlanScopesForTrade(
        [
          { itemId: 'plumbing_rough' },
          { itemId: 'water_line' },
          { itemId: 'drain_cleaning' },
          { itemId: 'emergency_fee' },
          { itemId: 'gas_line' },
        ],
        'selected_trade',
        'plumbing'
      ).map(item => item.itemId)
    ).toEqual(['plumbing_rough', 'water_line', 'gas_line']);
  });

  it('routes standalone Plumbing notes into a Plumbing-only checklist', () => {
    const draft = {
      scopeChecklist: {
        templateKey: 'bathroom',
        title: 'Bathroom Remodel',
        intro: 'Confirm bathroom scope.',
        items: [
          { id: 'demo', label: 'Demo', state: 'unsure' },
          { id: 'tile', label: 'Tile', state: 'unsure' },
        ],
      },
      scopeMeasurements: {
        bathroomFloorSqft: 80,
        itemQuantities: {},
      },
      rooms: [],
    } as any;

    const next = applyPlanImportToDraft(draft, {
      tradeWorkflowSource: 'standalone_trade',
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      plumbingWorkflowMode: 'service',
      plumbingPerformerMode: 'subcontracted',
    });

    expect(next.scopeChecklist?.templateKey).toBe('plumbing_service');
    expect(next.scopeChecklist?.items.map(item => item.id)).toEqual([
      'service_call',
      'fixture_repair',
      'fixture_replace',
      'drain_cleaning',
    ]);
    expect(next.scopeMeasurements?.tradeWorkflowSource).toBe(
      'standalone_trade'
    );
    expect(next.scopeMeasurements?.plumbingWorkflowMode).toBe('service');
    expect(next.scopeMeasurements?.plumbingPerformerMode).toBe('subcontracted');
    expect(next.scopeMeasurements?.bathroomFloorSqft).toBeUndefined();
  });

  it('normalizes Plan aliases without using living area', () => {
    expect(
      normalizePlumbingPlanMeasurements({
        roughInPoints: 3,
        waterLineFeet: 42,
        livingSf: 2400,
      })
    ).toEqual({
      plumbingRoughPointCount: 3,
      waterLineLf: 42,
    });
  });

  it('parses explicit Notes quantities and ignores vague plumbing text', () => {
    expect(
      parsePlumbingMeasurementsFromNotes(
        '2 plumbing rough-in points, 40 LF of water line, and 1 drain cleaning.'
      )
    ).toMatchObject({
      plumbingRoughPointCount: 2,
      waterLineLf: 40,
      drainCleaningCount: 1,
    });
    expect(
      parsePlumbingMeasurementsFromNotes('Plumbing work as needed.')
    ).toEqual({});
  });

  it('converges Plan and Notes onto the same canonical keys with different provenance', () => {
    const plan = normalizeTradeMeasurements(
      'plumbing',
      { roughInPoints: 2, waterLineFeet: 40 },
      'plan'
    );
    const notes = normalizeTradeMeasurements(
      'plumbing',
      {
        roughInPoints: 2,
        waterLineFeet: 40,
        notes: '2 plumbing rough-in points, 40 LF of water line.',
      },
      'notes'
    );
    expect(plan.measurements).toMatchObject({
      plumbingRoughPointCount: 2,
      waterLineLf: 40,
    });
    expect(notes.measurements).toMatchObject(plan.measurements);
    expect(plan.quickMeasurementSources).toEqual({
      plumbingRoughPointCount: 'plan_detected',
      waterLineLf: 'plan_detected',
    });
    expect(notes.quickMeasurementSources).toEqual({
      plumbingRoughPointCount: 'user_entered',
      waterLineLf: 'user_entered',
    });
  });

  it('materializes canonical item quantities and recognizes detailed scope', () => {
    const structured = buildPlumbingStructuredMeasurements(
      { plumbingRoughPointCount: 2, plumbingTrimHookupCount: 3 },
      'plan_detected'
    );
    expect(structured.itemQuantities).toMatchObject({
      plumbing_rough: {
        quantity: 2,
        unit: 'each',
        quantitySource: 'plan_detected',
      },
      plumbing_trim: {
        quantity: 3,
        unit: 'each',
        quantitySource: 'plan_detected',
      },
    });
    expect(hasDetailedPlumbingQuantities(structured)).toBe(true);
  });

  it('materializes selected Plumbing quantities as visible Confirm Scope cards', () => {
    const selected = syncPlumbingScopeItems([], {
      quantities: { plumbingRoughPointCount: 2, waterLineLf: 40 },
    });
    expect(selected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'plumbing_rough',
          state: 'included',
        }),
        expect.objectContaining({
          id: 'water_line',
          state: 'included',
        }),
      ])
    );
  });

  it('returns cleared Plumbing cards to review without removing them', () => {
    const selected = syncPlumbingScopeItems(
      [{ id: 'water_line', state: 'included' }],
      {
        plumbingScope: ['water_line'],
        quantities: { waterLineLf: 40 },
      }
    );
    const cleared = syncPlumbingScopeItems(selected, {
      plumbingScope: ['water_line'],
      quantities: { waterLineLf: '' },
    });
    expect(cleared).toEqual([
      expect.objectContaining({ id: 'water_line', state: 'unsure' }),
    ]);
  });

  it('changes plumbingScopeSyncSignature when LF quick measurements move', () => {
    const before = plumbingScopeSyncSignature({
      waterLineLf: '50',
      itemQuantities: { water_line: { quantity: '50' } },
    });
    const after = plumbingScopeSyncSignature({
      waterLineLf: '55',
      itemQuantities: { water_line: { quantity: '55' } },
    });
    expect(before).not.toBe(after);
  });

  it('provides pricing for every measurable Plumbing quantity card', () => {
    for (const card of PLUMBING_CARDS) {
      const normalized = normalizeTradeMeasurements(
        'plumbing',
        { [card.measurementKey]: 1 },
        'plan'
      );
      const fields = {
        ...normalized.measurements,
        itemQuantities: normalized.structuredMeasurements?.itemQuantities,
      };
      const resolved = resolveChecklistItemQuantity(
        card.itemId,
        normalizeScopeMeasurements(fields as never),
        { templateKey: 'plumbing_service' }
      );
      const pricing = resolveScopeItemSuggestedPricing(
        card.itemId,
        fields as never,
        'plumbing_service',
        resolved
      );
      if (card.pricingBehavior === 'ALLOWANCE') {
        if (pricing.fill) expect(pricing.fill.total).toBeGreaterThan(0);
      } else {
        expect(resolved.pricingReady).toBe(true);
        expect(pricing.fill).not.toBeNull();
      }
    }
  });

  it('preserves Plumbing quick measurements through Confirm Scope UI round-trip', () => {
    const input = {
      plumbingRoughPointCount: '10',
      plumbingTrimHookupCount: '10',
      waterLineLf: '50',
      sewerLineLf: '30',
      quickMeasurementSources: {
        plumbingRoughPointCount: 'plan_verified',
        plumbingTrimHookupCount: 'plan_verified',
        waterLineLf: 'needs_confirmation',
        sewerLineLf: 'needs_confirmation',
      },
      plumbingScope: ['plumbing_rough', 'plumbing_trim', 'water_line', 'sewer_line'],
    };
    const roundTrip = prepareScopeMeasurementsInputForUi(input as never, {
      templateKey: 'plumbing_service',
      notes: 'Plumbing takeoff from Plan 58.',
    });
    expect(roundTrip.plumbingRoughPointCount).toBe('10');
    expect(roundTrip.plumbingTrimHookupCount).toBe('10');
    expect(roundTrip.waterLineLf).toBe('50');
    expect(roundTrip.sewerLineLf).toBe('30');
    expect(roundTrip.quickMeasurementSources?.plumbingRoughPointCount).toBe(
      'plan_verified'
    );
    expect(roundTrip.itemQuantities?.plumbing_rough).toMatchObject({
      quantity: '10',
      unit: 'each',
    });
    expect(roundTrip.itemQuantities?.water_line).toMatchObject({
      quantity: '50',
      unit: 'lf',
    });
  });

  it('rebuilds plan import payload from draft plumbing provenance', () => {
    const payload = planImportPayloadFromDraft({
      scopeMeasurements: {
        planImportMode: 'selected_trade',
        planImportTradeKey: 'plumbing',
        plumbingRoughPointCount: 10,
        waterLineLf: 50,
        quickMeasurementSources: {
          plumbingRoughPointCount: 'plan_verified',
          waterLineLf: 'needs_confirmation',
        },
      },
    } as never);
    expect(payload).toMatchObject({
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      measurements: {
        plumbingRoughPointCount: 10,
        waterLineLf: 50,
      },
      quickMeasurementSources: {
        plumbingRoughPointCount: 'plan_verified',
        waterLineLf: 'needs_confirmation',
      },
    });
  });

  it('converts raw Plumbing Quick Measurement input into canonical quantities at persist time', () => {
    const persisted = scopeMeasurementsPayloadForPersist(
      {
        plumbingRoughPointCount: '2',
        waterLineLf: '40',
      },
      { templateKey: 'plumbing_service' }
    );
    expect(persisted.itemQuantities).toMatchObject({
      plumbing_rough: {
        quantity: 2,
        unit: 'each',
        quantitySource: 'user_entered',
      },
      water_line: {
        quantity: 40,
        unit: 'lf',
        quantitySource: 'user_entered',
      },
    });
    const normalized = normalizeScopeMeasurements(persisted);
    expect(
      resolveChecklistItemQuantity('water_line', normalized, {
        templateKey: 'plumbing_service',
      }).pricingReady
    ).toBe(true);
  });

  it('repairs mistaken dollar totals stored as plumbing card quantities', () => {
    const persisted = scopeMeasurementsPayloadForPersist(
      {
        waterLineLf: '50',
        plumbingRoughPointCount: '10',
        itemQuantities: {
          water_line: {
            quantity: '1500',
            unit: 'lf',
            quantitySource: 'user_entered',
          },
          water_line__material: {
            quantity: '400',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          water_line__labor: {
            quantity: '1100',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          plumbing_rough: {
            quantity: '5000',
            unit: 'each',
            quantitySource: 'user_entered',
          },
          plumbing_rough__material: {
            quantity: '2000',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          plumbing_rough__labor: {
            quantity: '3000',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
      },
      { templateKey: 'plumbing_service' }
    );
    expect(persisted.itemQuantities?.water_line).toMatchObject({
      quantity: 50,
      unit: 'lf',
    });
    expect(persisted.itemQuantities?.plumbing_rough).toMatchObject({
      quantity: 10,
      unit: 'each',
    });
    const normalized = normalizeScopeMeasurements(persisted);
    expect(
      resolveChecklistItemQuantity('water_line', normalized, {
        templateKey: 'plumbing_service',
      })
    ).toMatchObject({ quantity: 50, unit: 'lf' });
    expect(
      resolveChecklistItemQuantity('plumbing_rough', normalized, {
        templateKey: 'plumbing_service',
      })
    ).toMatchObject({ quantity: 10, unit: 'each' });
  });

  it('uses the same canonical rough-in pricing for Plan and Notes quantities', () => {
    const plan = normalizeTradeMeasurements(
      'plumbing',
      { plumbingRoughPointCount: 2 },
      'plan'
    );
    const notes = normalizeTradeMeasurements(
      'plumbing',
      { notes: '2 plumbing rough-in points.' },
      'notes'
    );
    const price = (itemId: string, normalized: typeof plan) => {
      const fields = {
        ...normalized.measurements,
        itemQuantities: normalized.structuredMeasurements?.itemQuantities,
      };
      const resolved = resolveChecklistItemQuantity(
        itemId,
        normalizeScopeMeasurements(fields as never),
        { templateKey: 'plumbing_service' }
      );
      return resolveScopeItemSuggestedPricing(
        itemId,
        fields as never,
        'plumbing_service',
        resolved
      ).fill?.total;
    };
    expect(price('plumbing_rough', plan)).toBe(1000);
    expect(price('plumbing_rough', notes)).toBe(1000);
    expect(
      price(
        'plumbing_trim',
        normalizeTradeMeasurements(
          'plumbing',
          { plumbingTrimHookupCount: 2 },
          'plan'
        )
      )
    ).toBe(900);
    expect(
      price(
        'fixture_replace',
        normalizeTradeMeasurements(
          'plumbing',
          { fixtureReplacementCount: 2 },
          'notes'
        )
      )
    ).toBe(600);
    expect(
      price(
        'water_line',
        normalizeTradeMeasurements('plumbing', { waterLineLf: 40 }, 'plan')
      )
    ).toBe(1200);
    expect(
      price(
        'service_call',
        normalizeTradeMeasurements('plumbing', { serviceCallCount: 1 }, 'notes')
      )
    ).toBe(250);
    expect(
      price(
        'fixture_repair',
        normalizeTradeMeasurements(
          'plumbing',
          { fixtureRepairCount: 1 },
          'notes'
        )
      )
    ).toBe(300);
    expect(
      price(
        'drain_cleaning',
        normalizeTradeMeasurements(
          'plumbing',
          { drainCleaningCount: 1 },
          'notes'
        )
      )
    ).toBe(300);
    expect(
      price(
        'sewer_line',
        normalizeTradeMeasurements('plumbing', { sewerLineLf: 10 }, 'notes')
      )
    ).toBe(500);
    expect(
      price(
        'gas_line',
        normalizeTradeMeasurements('plumbing', { gasLineLf: 10 }, 'plan')
      )
    ).toBe(300);
  });

  it('retains a same-plan quantity disagreement for confirmation before pricing', () => {
    const draft = {
      scopeChecklist: {
        templateKey: 'plumbing_service',
        title: 'Confirm Plumbing scope',
        intro: '',
        items: [],
      },
      scopeMeasurements: {
        planImportFingerprint: 'same-plumbing-plan',
        plumbingRoughPointCount: '4',
        quickMeasurementSources: {
          plumbingRoughPointCount: 'plan_detected',
        },
        measurementProvenance: {
          plumbingRoughPointCount: {
            source: 'detected_from_plan',
            value: 4,
          },
        },
      },
    } as any;
    const next = applyPlanImportToDraft(draft, {
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      planImportFingerprint: 'same-plumbing-plan',
      measurements: { plumbingRoughPointCount: 2 },
      scopeDetections: [],
    });
    expect(next.scopeMeasurements?.plumbingRoughPointCount).toBe(4);
    expect(
      next.scopeMeasurements?.quickMeasurementSources?.plumbingRoughPointCount
    ).toBe('needs_confirmation');
    expect(
      next.scopeMeasurements?.measurementProvenance?.plumbingRoughPointCount
    ).toMatchObject({
      value: 4,
      pricingEligible: false,
      status: 'needs_review',
    });
  });

  it('hydrates equipment cards and syncs checklist items on plumbing plan apply', () => {
    const draft = {
      scopeChecklist: {
        templateKey: 'plumbing_service',
        title: 'Confirm Plumbing scope',
        intro: '',
        items: [],
      },
      scopeMeasurements: {},
    } as any;
    const next = applyPlanImportToDraft(draft, {
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      measurements: { waterLineLf: 50, sewerLineLf: 30, gasLineLf: 35 },
      fixtureInventory: {
        toilets: 3,
        lavatories: 3,
        showers: 2,
        tubs: 1,
        kitchenSinks: 1,
      },
      waterHeaterDetail: { count: 1, type: 'tank', fuel: 'gas' },
      gasApplianceScope: { range: true, fireplace: true, dryer: true },
      scopeDetections: [],
    });
    expect(next.scopeMeasurements).toMatchObject({
      plumbingRoughPointCount: 10,
      plumbingTrimHookupCount: 10,
      plumbingFixturesHardwareCount: 10,
      waterHeaterCount: 1,
      gasApplianceConnectionCount: 3,
    });
    expect(next.scopeMeasurements?.plumbingScope).toEqual(
      expect.arrayContaining([
        'plumbing_rough',
        'plumbing_trim',
        'plumbing_fixtures_hardware',
        'water_heater',
        'gas_appliance_connections',
        'water_line',
        'sewer_line',
        'gas_line',
      ])
    );
    expect(next.scopeChecklist?.items.map(item => item.id)).toEqual(
      expect.arrayContaining([
        'plumbing_rough',
        'plumbing_trim',
        'plumbing_fixtures_hardware',
        'water_heater',
        'gas_appliance_connections',
        'water_line',
        'sewer_line',
        'gas_line',
      ])
    );
  });

  it('preserves applied equipment pricing when API payload omits filtered measurement keys', () => {
    const draft = {
      scopeChecklist: {
        templateKey: 'plumbing_service',
        title: 'Confirm Plumbing scope',
        intro: '',
        items: [
          { id: 'water_heater', label: 'Water heater', state: 'included' },
          {
            id: 'gas_appliance_connections',
            label: 'Gas appliance connections',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        planImportFingerprint: 'same-plumbing-plan',
        plumbingRoughPointCount: 10,
        plumbingTrimHookupCount: 10,
        plumbingFixturesHardwareCount: 10,
        waterHeaterCount: 1,
        gasApplianceConnectionCount: 3,
        waterLineLf: 50,
        sewerLineLf: 30,
        gasLineLf: 40,
        plumbingWaterHeaterDetail: { count: 1, type: 'tank', fuel: 'gas' },
        plumbingGasApplianceScope: { range: true, fireplace: true, dryer: true },
        plumbingFixtureInventory: {
          toilets: 3,
          lavatories: 3,
          showers: 2,
          tubs: 1,
          kitchenSinks: 1,
        },
        pricingAcceptance: {
          water_heater: { total: 2000, material: 1200, labor: 800 },
          gas_appliance_connections: { total: 675, material: 225, labor: 450 },
        },
        plumbingScope: [
          'plumbing_rough',
          'plumbing_trim',
          'plumbing_fixtures_hardware',
          'water_heater',
          'gas_appliance_connections',
          'water_line',
          'sewer_line',
          'gas_line',
        ],
      },
    } as any;
    const next = applyPlanImportToDraft(draft, {
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      planImportFingerprint: 'same-plumbing-plan',
      measurements: {
        waterLineLf: 50,
        sewerLineLf: 30,
        gasLineLf: 40,
        plumbingRoughPointCount: 10,
        plumbingTrimHookupCount: 10,
        plumbingFixturesHardwareCount: 10,
      },
      fixtureInventory: {
        toilets: 3,
        lavatories: 3,
        showers: 2,
        tubs: 1,
        kitchenSinks: 1,
      },
      scopeDetections: [],
    });
    expect(next.scopeMeasurements?.waterHeaterCount).toBe(1);
    expect(next.scopeMeasurements?.gasApplianceConnectionCount).toBe(3);
    expect(next.scopeMeasurements?.pricingAcceptance?.water_heater).toMatchObject({
      total: 2000,
    });
    expect(
      next.scopeMeasurements?.pricingAcceptance?.gas_appliance_connections
    ).toMatchObject({ total: 675 });
    expect(next.scopeMeasurements?.plumbingScope).toEqual(
      expect.arrayContaining(['water_heater', 'gas_appliance_connections'])
    );
  });

  it('does not reopen sewer LF conflicts on Confirm Scope after apply', () => {
    const draft = {
      scopeChecklist: {
        templateKey: 'plumbing_service',
        title: 'Confirm Plumbing scope',
        intro: '',
        items: [],
      },
      scopeMeasurements: {
        planImportFingerprint: 'same-plumbing-plan',
        sewerLineLf: 30,
        quickMeasurementSources: {
          sewerLineLf: 'plan_detected',
        },
      },
    } as any;
    const next = applyPlanImportToDraft(draft, {
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      planImportFingerprint: 'same-plumbing-plan',
      measurements: { sewerLineLf: 25 },
      scopeDetections: [],
    });
    expect(next.scopeMeasurements?.sewerLineLf).toBe(25);
    expect(next.scopeMeasurements?.measurementConflicts || []).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'sewerLineLf' })])
    );
  });

  it('drops stale rough/trim when a reimport has no fixture inventory', () => {
    const draft = {
      scopeChecklist: {
        templateKey: 'plumbing_service',
        title: 'Confirm Plumbing scope',
        intro: '',
        items: [
          { id: 'plumbing_rough', label: 'Plumbing rough-in', state: 'included' },
          { id: 'plumbing_trim', label: 'Plumbing trim / hookups', state: 'included' },
          { id: 'water_line', label: 'Water line piping', state: 'included' },
          { id: 'sewer_line', label: 'Sewer / drain piping', state: 'included' },
        ],
      },
      scopeMeasurements: {
        planImportFingerprint: 'same-plumbing-plan',
        plumbingRoughPointCount: 10,
        plumbingTrimHookupCount: 10,
        waterLineLf: 50,
        sewerLineLf: 30,
        plumbingScope: ['plumbing_rough', 'plumbing_trim', 'water_line', 'sewer_line'],
        itemQuantities: {
          plumbing_rough: { quantity: 10, unit: 'each' },
          plumbing_trim: { quantity: 10, unit: 'each' },
          water_line: { quantity: 50, unit: 'lf' },
          sewer_line: { quantity: 30, unit: 'lf' },
        },
        pricingAcceptance: {
          plumbing_rough: { selectionStatus: 'accepted', totalAmount: 5000 },
          plumbing_trim: { selectionStatus: 'accepted', totalAmount: 4500 },
        },
      },
    } as any;
    const next = applyPlanImportToDraft(draft, {
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      planImportFingerprint: 'same-plumbing-plan',
      measurements: { waterLineLf: 50, sewerLineLf: 30 },
      fixtureInventory: {},
      scopeDetections: [],
    });
    expect(next.scopeMeasurements?.waterLineLf).toBe(50);
    expect(next.scopeMeasurements?.sewerLineLf).toBe(30);
    expect(Number(next.scopeMeasurements?.plumbingRoughPointCount) || 0).toBe(0);
    expect(Number(next.scopeMeasurements?.plumbingTrimHookupCount) || 0).toBe(0);
    expect(next.scopeMeasurements?.itemQuantities?.plumbing_rough).toBeUndefined();
    expect(next.scopeMeasurements?.pricingAcceptance?.plumbing_rough).toBeUndefined();
    expect(next.scopeMeasurements?.plumbingScope).toEqual(
      expect.arrayContaining(['water_line', 'sewer_line'])
    );
    expect(next.scopeMeasurements?.plumbingScope).not.toEqual(
      expect.arrayContaining(['plumbing_rough', 'plumbing_trim'])
    );
  });
});
