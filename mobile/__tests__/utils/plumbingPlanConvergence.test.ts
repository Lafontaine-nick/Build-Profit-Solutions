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
  buildStandalonePlumbingChecklistItems,
  inferPlumbingRoomContextFromNotes,
  inferPlumbingWorkflowModeFromNotes,
  notesSuggestPlumbingBid,
  notesDescribeGeneralContractorProject,
  notesDescribeRoomRemodel,
  plumbingStateFromNotesScopeMode,
  resolveNotesScopeModeFromPlumbingState,
  stripNonPlumbingTradeBleedFromMeasurements,
  plumbingQuickMeasurementKeysForIncludedScope,
  resolvePlumbingRevealAttentionItemId,
  plumbingRevealNoteBackedItemIds,
  notesExcludePlumbingScopePhrase,
  notesExplicitPlumbingFixtureAllowance,
  notesSuggestStandalonePlumbingTrade,
  standalonePlumbingProjectTitle,
  parsePlumbingProjectContextFromNotes,
  tagPlumbingNotesMeasurementSources,
  restrictPlumbingMeasurementsForServiceMode,
  summarizePlumbingNoteBullets,
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
import { applyPlanImportToDraft, createStandalonePlumbingDraft, planImportPayloadFromDraft } from '@/utils/estimateAiDraft';
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

  it('bootstraps a first-class plumbing remodel bid without a bathroom template', () => {
    const draft = createStandalonePlumbingDraft('Kitchen sink rough-in and gas line', {
      plumbingWorkflowMode: 'bathroom_remodel',
    });
    expect(draft.projectType).toBe('plumbing');
    expect(draft.scopeChecklist?.templateKey).toBe('plumbing');
    expect(draft.scopeChecklist?.items.length).toBe(PLUMBING_CARDS.length);
    expect(draft.scopeChecklist?.items.map(item => item.id)).toEqual(
      PLUMBING_CARDS.map(card => card.itemId)
    );
    expect(draft.scopeMeasurements?.tradeWorkflowSource).toBe('standalone_trade');
  });

  it('bootstraps new-construction plumbing with the plumbing template key', () => {
    const draft = createStandalonePlumbingDraft('Whole-house rough-in', {
      plumbingWorkflowMode: 'new_construction',
    });
    expect(draft.scopeChecklist?.templateKey).toBe('plumbing');
    expect(draft.scopeMeasurements?.plumbingWorkflowMode).toBe('new_construction');
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

describe('plumbing notes routing', () => {
  const gcNotesShouldNotRouteToPlumbing = [
    'Hall bath remodel, 45 sqft. New tile floor, vanity, toilet, paint. Homeowner bought the plumbing fixtures.',
    'Kitchen remodel with tile backsplash, new cabinets, counters, and paint.',
    'Whole house remodel — new floors, paint, two bathrooms, and kitchen update.',
    'Full home gut remodel. Demo, framing, MEP, drywall, paint, new kitchen and baths.',
    '400 SF rear addition with full bath, kitchenette, and tie-in to existing HVAC.',
    'Master bath refresh — new shower tile, vanity, toilet, mirror. Customer-supplied plumbing fixtures.',
    'Powder room update, new vanity and toilet, paint only.',
  ];

  it('does not route bathroom, kitchen, home remodel, or addition notes to plumbing', () => {
    for (const notes of gcNotesShouldNotRouteToPlumbing) {
      expect(notesSuggestPlumbingBid(notes)).toBe(false);
      expect(notesDescribeGeneralContractorProject(notes)).toBe(true);
    }
  });

  it('detects explicit and trade-language plumbing notes', () => {
    expect(
      notesSuggestPlumbingBid(
        'Whole-house plumbing rough-in for 2,400 SF new build. 12 rough-in points. 150 LF water line.'
      )
    ).toBe(true);
    expect(notesSuggestPlumbingBid('Kitchen remodel with tile and vanity.')).toBe(
      false
    );
    expect(
      notesSuggestPlumbingBid(
        'Hall bath remodel, 45 sqft. New tile floor, vanity, toilet, paint. Homeowner bought the plumbing fixtures.'
      )
    ).toBe(false);
    expect(notesDescribeRoomRemodel('Hall bath remodel with tile and vanity')).toBe(
      true
    );
    expect(
      notesSuggestPlumbingBid(
        'Bathroom remodel — need 80 LF sewer line repipe only, no tile.'
      )
    ).toBe(true);
  });

  it('infers workflow and room context from notes', () => {
    expect(
      inferPlumbingWorkflowModeFromNotes(
        'Whole-house plumbing rough-in for 2,400 SF new build.'
      )
    ).toBe('new_construction');
    expect(
      inferPlumbingRoomContextFromNotes(
        'Whole-house plumbing rough-in for 2,400 SF new build.'
      )
    ).toBe('whole_house');
    expect(
      inferPlumbingRoomContextFromNotes('Kitchen sink and dishwasher hookups.')
    ).toBe('kitchen');
  });

  it('maps scope mode choices onto plumbing state', () => {
    expect(plumbingStateFromNotesScopeMode('plumbing_kitchen')).toMatchObject({
      tradeWorkflowSource: 'standalone_trade',
      plumbingRoomContext: 'kitchen',
      checklistMode: 'bathroom_remodel',
    });
    expect(
      resolveNotesScopeModeFromPlumbingState({
        tradeWorkflowSource: 'standalone_trade',
        plumbingWorkflowMode: 'new_construction',
        plumbingRoomContext: 'whole_house',
      })
    ).toBe('plumbing_new_construction');
    const kitchenNotes =
      'Kitchen plumbing only — not a full remodel. Relocate sink and dishwasher: 3 plumbing rough-in points.';
    expect(
      resolveNotesScopeModeFromPlumbingState({
        tradeWorkflowSource: 'standalone_trade',
        plumbingWorkflowMode: 'bathroom_remodel',
        plumbingRoomContext: null,
        notes: kitchenNotes,
      })
    ).toBe('plumbing_kitchen');
  });

  it('strips roofing bleed such as drip edge from plumbing measurements', () => {
    const stripped = stripNonPlumbingTradeBleedFromMeasurements({
      plumbingRoughPointCount: 3,
      roofDripEdgeLf: '120',
      tradeScopeSelections: { roofing: ['drip_edge', 'shingles'] },
      itemQuantities: {
        drip_edge: { quantity: '120', unit: 'lf', quantitySource: 'notes' },
        plumbing_rough: { quantity: '3', unit: 'each', quantitySource: 'notes' },
      },
    });
    expect(stripped.roofDripEdgeLf).toBe('');
    expect(stripped.itemQuantities?.drip_edge).toBeUndefined();
    expect(stripped.itemQuantities?.plumbing_rough).toBeDefined();
    expect(stripped.tradeScopeSelections?.roofing).toBeUndefined();
  });

  it('defaults kitchen plumbing notes to included scope and excludes noise cards', () => {
    const notes =
      'Kitchen plumbing only — not a full remodel.\n' +
      'Relocate sink and dishwasher: 3 plumbing rough-in points.\n' +
      '4 trim hookups (sink, dishwasher, disposal, ice maker line).\n' +
      '25 LF of water line from manifold to kitchen.\n' +
      '1 gas appliance hookup for range.\n' +
      'Customer supplies fixtures; we provide labor, pipe, fittings, and permits if required.\n' +
      '2-story home; access through finished ceiling in adjacent pantry.';
    const items = buildStandalonePlumbingChecklistItems('bathroom_remodel', notes);
    const byId = new Map(items.map(item => [item.id, item.state]));
    expect(byId.get('plumbing_rough')).toBe('included');
    expect(byId.get('plumbing_trim')).toBe('included');
    expect(byId.get('water_line')).toBe('included');
    expect(byId.get('gas_appliance_connections')).toBe('included');
    expect(byId.get('plumbing_fixtures_hardware')).toBe('excluded');
    expect(byId.get('sewer_line')).toBe('excluded');
    expect(byId.get('gas_line')).toBe('excluded');
    expect(byId.get('water_heater')).toBe('excluded');
    expect(byId.get('service_call')).toBe('excluded');
    expect(byId.get('drain_cleaning')).toBe('excluded');
    expect(
      resolveNotesScopeModeFromPlumbingState({
        tradeWorkflowSource: 'standalone_trade',
        plumbingWorkflowMode: 'bathroom_remodel',
        plumbingRoomContext: null,
        notes,
      })
    ).toBe('plumbing_kitchen');
    const draft = createStandalonePlumbingDraft(notes, {
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      tradeWorkflowSource: 'standalone_trade',
      plumbingWorkflowMode: inferPlumbingWorkflowModeFromNotes(notes),
      plumbingRoomContext: inferPlumbingRoomContextFromNotes(notes),
    });
    expect(draft.scopeMeasurements?.plumbingRoughPointCount).toBe('3');
    expect(draft.scopeMeasurements?.roofDripEdgeLf).toBeFalsy();
    const draftById = new Map(
      (draft.scopeChecklist?.items || []).map(item => [item.id, item.state])
    );
    expect(draftById.get('plumbing_rough')).toBe('included');
    expect(draftById.get('service_call')).toBe('excluded');
  });

  it('bootstraps standalone plumbing drafts from whole-house notes', () => {
    const notes =
      'Whole-house plumbing rough-in for 2,400 SF new build. 12 plumbing rough-in points. 150 LF of water line.';
    const draft = createStandalonePlumbingDraft(notes, {
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      tradeWorkflowSource: 'standalone_trade',
      plumbingWorkflowMode: inferPlumbingWorkflowModeFromNotes(notes),
      plumbingRoomContext: inferPlumbingRoomContextFromNotes(notes),
    });
    expect(draft.scopeChecklist?.templateKey).toBe('plumbing');
    expect(draft.scopeMeasurements?.tradeWorkflowSource).toBe('standalone_trade');
    expect(draft.scopeMeasurements?.plumbingWorkflowMode).toBe('new_construction');
    expect(draft.scopeMeasurements?.plumbingRoomContext).toBe('whole_house');
    expect(buildStandalonePlumbingChecklistItems('new_construction').length).toBeGreaterThan(
      4
    );
  });

  it('limits quick measurements to included plumbing scope cards', () => {
    const keys = plumbingQuickMeasurementKeysForIncludedScope([
      'plumbing_rough',
      'plumbing_trim',
      'water_line',
      'gas_appliance_connections',
    ]);
    expect(keys).toEqual(
      new Set([
        'plumbingRoughPointCount',
        'plumbingTrimHookupCount',
        'waterLineLf',
        'gasApplianceConnectionCount',
      ])
    );
    expect(keys.has('sewerLineLf')).toBe(false);
    expect(keys.has('fixtureReplacementCount')).toBe(false);
  });

  it('maps reveal pricing labels back to plumbing checklist ids', () => {
    expect(resolvePlumbingRevealAttentionItemId('Water line piping')).toBe(
      'water_line'
    );
    expect(
      resolvePlumbingRevealAttentionItemId('Plumbing trim / hookups (material + labor)')
    ).toBe('plumbing_trim');
    expect(resolvePlumbingRevealAttentionItemId('Gas appliance connections')).toBe(
      'gas_appliance_connections'
    );
  });

  it('collects note-backed plumbing reveal item ids from notes and checklist', () => {
    const notes =
      'Kitchen plumbing only. 3 plumbing rough-in points. 4 trim hookups. 25 LF water line. 1 gas appliance hookup.';
    const ids = plumbingRevealNoteBackedItemIds({
      originalNotes: notes,
      scopeChecklist: {
        items: [
          { id: 'plumbing_rough', state: 'included', noteBacked: true },
          { id: 'service_call', state: 'excluded' },
        ],
      },
    });
    expect([...ids]).toEqual(
      expect.arrayContaining([
        'plumbing_rough',
        'plumbing_trim',
        'water_line',
        'gas_appliance_connections',
      ])
    );
    expect(ids.has('service_call')).toBe(false);
  });

  const MASTER_BATH_NOTES = `Master bath plumbing — shower valve relocate and new toilet location.

4 plumbing rough-in points (shower valve/head, tub drain, toilet, lav).
4 trim hookups.
30 LF of drain line for relocated toilet (slab on grade — core drill, not included unless noted).
1 water heater tie-in not included.`;

  it('respects not-included exclusions and skips inferred fixture allowance', () => {
    expect(
      notesExcludePlumbingScopePhrase(
        MASTER_BATH_NOTES,
        /\b(?:water\s+)?heater(?:\s+tie[\s-]?in)?\b/i
      )
    ).toBe(true);
    expect(notesExplicitPlumbingFixtureAllowance(MASTER_BATH_NOTES)).toBe(false);
    expect(notesSuggestStandalonePlumbingTrade(MASTER_BATH_NOTES)).toBe(true);
    expect(standalonePlumbingProjectTitle(MASTER_BATH_NOTES)).toBe(
      'Master bath plumbing'
    );

    const parsed = parsePlumbingMeasurementsFromNotes(MASTER_BATH_NOTES);
    expect(parsed).toMatchObject({
      plumbingRoughPointCount: 4,
      plumbingTrimHookupCount: 4,
      sewerLineLf: 30,
    });
    expect(parsed.waterHeaterCount).toBeUndefined();
    expect(parsed.plumbingFixturesHardwareCount).toBeUndefined();

    const items = buildStandalonePlumbingChecklistItems(
      'bathroom_remodel',
      MASTER_BATH_NOTES
    );
    const byId = new Map(items.map(item => [item.id, item.state]));
    expect(byId.get('plumbing_rough')).toBe('included');
    expect(byId.get('plumbing_trim')).toBe('included');
    expect(byId.get('sewer_line')).toBe('included');
    expect(byId.get('water_heater')).toBe('excluded');
    expect(byId.get('plumbing_fixtures_hardware')).toBe('excluded');
  });

  it('bootstraps master bath standalone drafts without water heater or fixtures', () => {
    const draft = createStandalonePlumbingDraft(MASTER_BATH_NOTES, {
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      tradeWorkflowSource: 'standalone_trade',
      plumbingWorkflowMode: inferPlumbingWorkflowModeFromNotes(MASTER_BATH_NOTES),
      plumbingRoomContext: inferPlumbingRoomContextFromNotes(MASTER_BATH_NOTES),
    });
    expect(draft.projectTitle).toBe('Master bath plumbing');
    expect(draft.scopeMeasurements?.sewerLineLf).toBe('30');
    expect(draft.scopeMeasurements?.waterHeaterCount).toBeFalsy();
    expect(draft.scopeMeasurements?.plumbingFixturesHardwareCount).toBeFalsy();
    const roughQty = draft.scopeMeasurements?.itemQuantities?.plumbing_rough;
    expect(roughQty?.quantity).toBe(4);
    expect(roughQty?.quantitySource).toBe('notes');
    const included = (draft.scopeChecklist?.items || []).filter(
      item => item.state === 'included'
    );
    expect(included.map(item => item.id).sort()).toEqual(
      ['plumbing_rough', 'plumbing_trim', 'sewer_line'].sort()
    );
  });

  const WHOLE_HOUSE_NOTES = `Single-story; demo exposes plumbing in wall. Whole-house plumbing rough-in for 2,400 SF new build, 2 stories.

12 plumbing rough-in points.
12 trim hookups at fixture schedule.
150 LF of water line (under-slab and branch runs).
80 LF of sewer line.
100 LF of gas piping (enter manually in measurements if not parsed).
2 water heaters.
6 plumbing fixtures & hardware allowance per schedule.
3 gas appliance hookups (range, dryer, fireplace).`;

  it('parses whole-house new-build plumbing notes including gas LF and living area', () => {
    expect(inferPlumbingWorkflowModeFromNotes(WHOLE_HOUSE_NOTES)).toBe(
      'new_construction'
    );
    expect(inferPlumbingRoomContextFromNotes(WHOLE_HOUSE_NOTES)).toBe(
      'whole_house'
    );
    expect(standalonePlumbingProjectTitle(WHOLE_HOUSE_NOTES)).toBe(
      'Whole-house plumbing'
    );
    expect(parsePlumbingProjectContextFromNotes(WHOLE_HOUSE_NOTES)).toEqual({
      floorAreaSqft: 2400,
      storyCount: 2,
    });
    expect(parsePlumbingMeasurementsFromNotes(WHOLE_HOUSE_NOTES)).toMatchObject({
      plumbingRoughPointCount: 12,
      plumbingTrimHookupCount: 12,
      waterLineLf: 150,
      sewerLineLf: 80,
      gasLineLf: 100,
      waterHeaterCount: 2,
      plumbingFixturesHardwareCount: 6,
      gasApplianceConnectionCount: 3,
    });
    expect(summarizePlumbingNoteBullets(WHOLE_HOUSE_NOTES, 8)).toEqual([
      '12 rough-in points',
      '12 trim hookups',
      '150 LF water line',
      '80 LF sewer line',
      '100 LF gas piping',
      '2 water heaters',
      '3 gas appliance hookups',
      '6 fixtures & hardware',
    ]);
  });

  it('bootstraps whole-house new-build drafts with eight scope cards from notes', () => {
    const draft = createStandalonePlumbingDraft(WHOLE_HOUSE_NOTES, {
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      tradeWorkflowSource: 'standalone_trade',
      plumbingWorkflowMode: inferPlumbingWorkflowModeFromNotes(WHOLE_HOUSE_NOTES),
      plumbingRoomContext: inferPlumbingRoomContextFromNotes(WHOLE_HOUSE_NOTES),
    });
    expect(draft.projectTitle).toBe('Whole-house plumbing');
    expect(draft.scopeMeasurements?.floorAreaSqft).toBe('2400');
    expect(draft.scopeMeasurements?.storyCount).toBe('2');
    expect(draft.scopeMeasurements?.gasLineLf).toBe('100');
    expect(
      draft.scopeMeasurements?.quickMeasurementSources?.gasLineLf
    ).toBe('notes');
    expect(
      draft.scopeMeasurements?.itemQuantities?.gas_line?.quantitySource
    ).toBe('notes');
    const included = (draft.scopeChecklist?.items || []).filter(
      item => item.state === 'included'
    );
    expect(included.map(item => item.id).sort()).toEqual(
      [
        'gas_appliance_connections',
        'gas_line',
        'plumbing_fixtures_hardware',
        'plumbing_rough',
        'plumbing_trim',
        'sewer_line',
        'water_heater',
        'water_line',
      ].sort()
    );

    const normalized = normalizeScopeMeasurements(draft.scopeMeasurements as never);
    expect(
      resolveChecklistItemQuantity('water_line', normalized, {
        templateKey: 'plumbing',
        notes: WHOLE_HOUSE_NOTES,
      })
    ).toMatchObject({
      quantity: 150,
      unit: 'lf',
      quantitySource: 'notes',
    });
    expect(
      resolveChecklistItemQuantity('water_heater', normalized, {
        templateKey: 'plumbing',
        notes: WHOLE_HOUSE_NOTES,
      })
    ).toMatchObject({
      quantity: 2,
      unit: 'each',
      quantitySource: 'notes',
    });
  });

  const SERVICE_CALL_NOTES = `Service call for kitchen sink leak and slow tub drain.

1 service call.
1 fixture repair (kitchen faucet cartridge / supply line).
1 drain cleaning (main bath tub).
No rough-in or repipe.`;

  it('parses service-call plumbing notes without rough-in or fixture allowance bleed', () => {
    expect(inferPlumbingWorkflowModeFromNotes(SERVICE_CALL_NOTES)).toBe(
      'service'
    );
    expect(standalonePlumbingProjectTitle(SERVICE_CALL_NOTES)).toBe(
      'Plumbing service call'
    );
    expect(notesExcludePlumbingScopePhrase(SERVICE_CALL_NOTES, /\brough(?:-in| in)\b/i)).toBe(
      true
    );
    expect(notesExplicitPlumbingFixtureAllowance(SERVICE_CALL_NOTES)).toBe(
      false
    );
    expect(parsePlumbingMeasurementsFromNotes(SERVICE_CALL_NOTES)).toEqual({
      serviceCallCount: 1,
      fixtureRepairCount: 1,
      drainCleaningCount: 1,
    });
    expect(
      restrictPlumbingMeasurementsForServiceMode(
        parsePlumbingMeasurementsFromNotes(SERVICE_CALL_NOTES)
      )
    ).toEqual({
      serviceCallCount: 1,
      fixtureRepairCount: 1,
      drainCleaningCount: 1,
    });
    expect(summarizePlumbingNoteBullets(SERVICE_CALL_NOTES, 6)).toEqual([
      '1 service call',
      '1 fixture repair',
      '1 drain cleaning',
    ]);
  });

  it('bootstraps service-call drafts with three scope cards and ~$850 pricing', () => {
    const draft = createStandalonePlumbingDraft(SERVICE_CALL_NOTES, {
      estimatingMode: 'selected_trade',
      selectedTrade: 'plumbing',
      tradeWorkflowSource: 'standalone_trade',
      plumbingWorkflowMode: inferPlumbingWorkflowModeFromNotes(SERVICE_CALL_NOTES),
      plumbingRoomContext: inferPlumbingRoomContextFromNotes(SERVICE_CALL_NOTES),
    });
    expect(draft.projectTitle).toBe('Plumbing service call');
    expect(draft.scopeChecklist?.templateKey).toBe('plumbing_service');
    const included = (draft.scopeChecklist?.items || []).filter(
      item => item.state === 'included'
    );
    expect(included.map(item => item.id).sort()).toEqual(
      ['drain_cleaning', 'fixture_repair', 'service_call'].sort()
    );
    expect(
      Number(draft.scopeMeasurements?.plumbingRoughPointCount || 0)
    ).toBe(0);
    expect(
      Number(draft.scopeMeasurements?.plumbingFixturesHardwareCount || 0)
    ).toBe(0);
    expect(
      draft.scopeMeasurements?.quickMeasurementSources?.serviceCallCount
    ).toBe('notes');

    const normalized = normalizeScopeMeasurements(draft.scopeMeasurements as never);
    const priceFor = (itemId: string) => {
      const resolved = resolveChecklistItemQuantity(itemId, normalized, {
        templateKey: 'plumbing_service',
        notes: SERVICE_CALL_NOTES,
      });
      return resolveScopeItemSuggestedPricing(
        itemId,
        draft.scopeMeasurements as never,
        'plumbing_service',
        resolved
      ).fill?.total;
    };
    expect(priceFor('service_call')).toBe(250);
    expect(priceFor('fixture_repair')).toBe(300);
    expect(priceFor('drain_cleaning')).toBe(300);
    expect(
      (priceFor('service_call') || 0) +
        (priceFor('fixture_repair') || 0) +
        (priceFor('drain_cleaning') || 0)
    ).toBe(850);
  });
});
