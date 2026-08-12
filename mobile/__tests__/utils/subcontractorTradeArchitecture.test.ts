import {
  PLAN_EXPORT_TRADE_KEYS,
  SUBCONTRACTOR_TRADE_DEFINITIONS,
  getTradeScopeAllowlist,
  normalizeTradeMeasurements,
  provenanceToStorageTag,
  toNormalizedProvenance,
} from '@/utils/subcontractorTrade';
import {
  PLAN_EXPORT_TRADE_CONFIGURATIONS,
  PLAN_TRADE_CONFIGURATIONS,
  filterChecklistItemsForTrade,
  filterPlanMeasurementsForTrade,
  filterPlanScopesForTrade,
  tradeQuickMeasurementFieldKeys,
} from '@/utils/planImportTradeConfig';
import {
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  scopeMeasurementsInputFromPayload,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import { planMeasurementsToScopeMeasurements } from '@/utils/estimateAiDraft';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { SIMPLE_TRADE_SPECS } from '@/utils/qmScopePanels/simpleTradeRemodel';
import { CHECKLIST_ITEM_QUANTITY_RULES } from '@/utils/scopeItemQuantities';

describe('subcontractor trade architecture (Phase 0)', () => {
  it('exposes exactly 11 Plan Export trades', () => {
    expect(PLAN_EXPORT_TRADE_KEYS).toEqual([
      'electrical',
      'plumbing',
      'hvac',
      'roofing',
      'concrete',
      'framing',
      'drywall',
      'stucco',
      'insulation',
      'flooring',
      'windows_doors',
    ]);
    expect(PLAN_EXPORT_TRADE_CONFIGURATIONS).toHaveLength(11);
    expect(PLAN_EXPORT_TRADE_CONFIGURATIONS.map(t => t.key)).toEqual(
      PLAN_EXPORT_TRADE_KEYS
    );
  });

  it('keeps legacy plan trade keys for persisted draft compatibility', () => {
    const legacyKeys = ['painting', 'cabinets', 'landscaping', 'other'];
    for (const key of legacyKeys) {
      expect(PLAN_TRADE_CONFIGURATIONS.some(trade => trade.key === key)).toBe(
        true
      );
      expect(PLAN_EXPORT_TRADE_CONFIGURATIONS.some(trade => trade.key === key)).toBe(
        false
      );
    }
  });

  it('preserves the Stucco scope allowlist', () => {
    expect(getTradeScopeAllowlist('stucco')).toEqual([
      'stucco',
      'stucco_wrb',
      'stucco_lath',
      'stucco_base_coat',
      'stucco_finish_coat',
      'stucco_foam_trim',
      'stucco_accessories',
      'stucco_soffits',
      'stucco_parapets',
      'stucco_access',
      'stucco_repairs',
      'stucco_other_finish',
    ]);
  });

  it('preserves the Electrical scope allowlist', () => {
    expect(getTradeScopeAllowlist('electrical')).toEqual(['electrical_rough']);
  });

  it('maps Stucco pricing behavior metadata to existing behavior categories', () => {
    const items = SUBCONTRACTOR_TRADE_DEFINITIONS.stucco.scopeItems;
    const byId = Object.fromEntries(
      items.map(item => [item.scopeItemId, item.pricingBehavior])
    );
    expect(byId.stucco).toBe('ALTERNATE_SYSTEM');
    expect(byId.stucco_wrb).toBe('INCLUDED_IN_BASE');
    expect(byId.stucco_soffits).toBe('SEPARATE_ADDON');
    expect(byId.stucco_repairs).toBe('SEPARATE_ADDON');
    expect(byId.stucco_other_finish).toBe('NON_PRICED_CONFIRMATION');
  });

  it('documents Stucco quick measurement keys without changing them', () => {
    expect(tradeQuickMeasurementFieldKeys('stucco')).toEqual([
      'stuccoGrossWallSqft',
      'stuccoWindowDoorOpeningSqft',
      'stuccoGarageOpeningSqft',
      'stuccoOtherFinishDeductionSqft',
      'stuccoNetWallSqft',
      'stuccoSoffitSqft',
      'stuccoParapetSqft',
      'stuccoFoamTrimLf',
      'stuccoControlJointLf',
      'stuccoStories',
      'stuccoWallHeightFt',
      'exteriorPaintSqft',
    ]);
  });

  it('converges plan and notes inputs onto the same canonical measurement keys', () => {
    const raw = {
      stuccoGrossWallSqft: 3450,
      stuccoWindowDoorOpeningSqft: 289.6,
      stuccoGarageOpeningSqft: 225,
      stuccoOtherFinishDeductionSqft: 150,
    };
    const fromPlan = normalizeTradeMeasurements('stucco', raw, 'plan');
    const fromNotes = normalizeTradeMeasurements('stucco', raw, 'notes');

    expect(fromPlan.measurements).toEqual(fromNotes.measurements);
    expect(fromPlan.quickMeasurementSources?.stuccoGrossWallSqft).toBe(
      'plan_detected'
    );
    expect(fromNotes.quickMeasurementSources?.stuccoGrossWallSqft).toBe(
      'user_entered'
    );
  });

  it('maps provenance tags without creating duplicate measurement fields', () => {
    expect(toNormalizedProvenance('plan_detected')).toBe('FROM_PLAN');
    expect(toNormalizedProvenance('user_entered')).toBe('USER_ENTERED');
    expect(provenanceToStorageTag('FROM_PLAN')).toBe('plan_detected');
    expect(provenanceToStorageTag('FROM_NOTES')).toBe('user_entered');
  });

  it('keeps Stucco net wall calculations unchanged through plan import', () => {
    const measurements = planMeasurementsToScopeMeasurements({
      stuccoGrossWallSqft: 3450,
      stuccoWindowDoorOpeningSqft: 289.6,
      stuccoGarageOpeningSqft: 225,
      stuccoOtherFinishDeductionSqft: 150,
    });
    expect(measurements.stuccoNetWallSqft).toBe(2785.4);
  });

  it('keeps Stucco pricing totals unchanged', () => {
    const saved = scopeMeasurementsPayloadForPersist({
      stuccoGrossWallSqft: '3450',
      stuccoWindowDoorOpeningSqft: '289.6',
      stuccoGarageOpeningSqft: '225',
      stuccoOtherFinishDeductionSqft: '150',
      stuccoNetWallSqft: '3016.2',
    });
    const restored = scopeMeasurementsInputFromPayload(saved);
    const resolved = resolveChecklistItemQuantity(
      'stucco',
      normalizeScopeMeasurements(saved),
      { templateKey: 'stucco', choiceId: 'three_coat' }
    );
    const pricing = resolveScopeItemSuggestedPricing(
      'stucco',
      restored as any,
      'stucco',
      resolved,
      {
        checklistItems: [
          { id: 'stucco', state: 'included', choiceId: 'three_coat' },
        ],
      },
      'three_coat'
    );
    expect(pricing.fill?.total).toBe(27145.8);
  });

  it('filters Stucco checklist items the same as before', () => {
    const items = [
      { id: 'stucco', label: 'Stucco' },
      { id: 'stucco_soffits', label: 'Soffits' },
      { id: 'roofing', label: 'Roofing' },
      { id: 'drywall', label: 'Drywall' },
    ];
    const filtered = filterChecklistItemsForTrade(
      items,
      'selected_trade',
      'stucco'
    );
    expect(filtered.map(item => item.id)).toEqual(['stucco', 'stucco_soffits']);
  });

  it('filters Electrical checklist items the same as before', () => {
    const items = [
      { id: 'electrical_rough', label: 'Electrical' },
      { id: 'plumbing_rough', label: 'Plumbing' },
    ];
    const filtered = filterChecklistItemsForTrade(
      items,
      'selected_trade',
      'electrical'
    );
    expect(filtered.map(item => item.id)).toEqual(['electrical_rough']);
  });

  it('uses explicit allowlists for scaffolded trades instead of unrelated scope', () => {
    expect(getTradeScopeAllowlist('roofing')).toContain('tear_off');
    const items = [
      { id: 'tear_off', label: 'Tear-off' },
      { id: 'drywall', label: 'Drywall' },
    ];
    const filtered = filterChecklistItemsForTrade(
      items,
      'selected_trade',
      'roofing'
    );
    expect(filtered.map(item => item.id)).toEqual(['tear_off']);
  });

  it('filters plan scope detections with explicit allowlists', () => {
    const detections = filterPlanScopesForTrade(
      [
        { itemId: 'stucco_soffits', label: 'Soffits' },
        { itemId: 'drywall', label: 'Drywall' },
      ],
      'selected_trade',
      'stucco'
    );
    expect(detections.map(row => row.itemId)).toEqual(['stucco_soffits']);
  });

  it('declares roofing measurement schema without activating extraction', () => {
    const keys = SUBCONTRACTOR_TRADE_DEFINITIONS.roofing.measurements.map(
      m => m.key
    );
    expect(keys).toEqual([
      'roofAreaSqft',
      'roofSquares',
      'roofPitch',
      'storyCount',
      'roofDeckingReplacementSqft',
      'roofDripEdgeLf',
      'roofRidgeCapLf',
      'roofValleyFlashingLf',
      'roofStepFlashingLf',
      'roofWallFlashingLf',
      'roofRidgeVentLf',
      'roofVentCount',
      'roofTurbineVentCount',
      'roofPipeBootCount',
      'roofChimneyFlashingCount',
      'roofSkylightCount',
      'roofPenetrationCount',
      'roofRepairAffectedSqft',
    ]);
    expect(SUBCONTRACTOR_TRADE_DEFINITIONS.roofing.scopeItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeItemId: 'roofing_system',
          pricingBehavior: 'ALTERNATE_SYSTEM',
        }),
        expect.objectContaining({
          scopeItemId: 'tear_off',
          pricingBehavior: 'SEPARATE_ADDON',
        }),
      ])
    );
  });

  it('keeps supported Roofing plan measurements through selected-trade filtering', () => {
    const config = PLAN_EXPORT_TRADE_CONFIGURATIONS.find(
      trade => trade.key === 'roofing'
    );
    expect(config?.reviewMeasurementKeys).toEqual(
      expect.arrayContaining(['roofAreaSqft', 'roofSquares', 'roofPitch', 'storyCount'])
    );
    expect(
      filterPlanMeasurementsForTrade(
        {
          roofAreaSqft: 2800,
          roofSquares: 28,
          roofPitch: '5:12',
          storyCount: 2,
          ridgeLf: 80,
        },
        'selected_trade',
        'roofing'
      )
    ).toEqual({
      roofAreaSqft: 2800,
      roofSquares: 28,
      roofPitch: '5:12',
      storyCount: 2,
    });
  });

  it('derives Roofing squares only from explicit roof surface area', () => {
    const normalized = normalizeTradeMeasurements(
      'roofing',
      { roofAreaSqft: 2800 },
      'plan'
    );
    expect(normalized.measurements.roofSquares).toBe(28);
    expect(normalized.quickMeasurementSources?.roofSquares).toBe(
      'calculated_from_components'
    );

    const noArea = normalizeTradeMeasurements(
      'roofing',
      { floorAreaSqft: 2800 },
      'plan'
    );
    expect(noArea.measurements.roofSquares).toBeUndefined();
  });

  it('preserves Roofing pitch provenance and user overrides', () => {
    const plan = normalizeTradeMeasurements(
      'roofing',
      { roofPitch: '5:12' },
      'plan'
    );
    expect(plan.measurements.roofPitch).toBe('5:12');
    expect(plan.quickMeasurementSources?.roofPitch).toBe('plan_detected');

    const manual = normalizeTradeMeasurements(
      'roofing',
      {
        roofSquares: 32,
        quickMeasurementSources: { roofSquares: 'user_entered' },
      },
      'plan'
    );
    expect(manual.measurements.roofSquares).toBe(32);
    expect(manual.quickMeasurementSources?.roofSquares).toBe('user_entered');
  });

  it('does not expose unsupported Roofing takeoff fields as supported plan measurements', () => {
    const config = PLAN_EXPORT_TRADE_CONFIGURATIONS.find(
      trade => trade.key === 'roofing'
    );
    expect(config?.reviewMeasurementKeys).not.toEqual(
      expect.arrayContaining(['ridgeLf', 'hipLf', 'valleyLf', 'eaveLf', 'rakeLf'])
    );
  });

  it('normalizes equivalent Roofing notes and plan values to the same keys', () => {
    const notes = parseScopeMeasurementsFromNotes(
      'Replace 28 squares of architectural shingles on a two-story house, 6/12 pitch, 2800 sqft roof area.',
      { templateKey: 'roofing', projectType: 'roofing' }
    );
    const fromNotes = normalizeTradeMeasurements('roofing', notes, 'notes');
    const fromPlan = normalizeTradeMeasurements(
      'roofing',
      {
        roofAreaSqft: 2800,
        roofSquares: 28,
        roofPitch: '6:12',
        storyCount: 2,
      },
      'plan'
    );
    expect(Object.keys(fromNotes.measurements).sort()).toEqual(
      Object.keys(fromPlan.measurements).sort()
    );
    expect(fromNotes.measurements).toEqual(fromPlan.measurements);
    expect(fromNotes.measurementProvenance?.roofPitch).toBe('FROM_NOTES');
    expect(fromPlan.measurementProvenance?.roofPitch).toBe('FROM_PLAN');
  });

  it('keeps identical supplied Roofing plan and standalone quantities and pricing', () => {
    const supplied = {
      roofAreaSqft: 3000,
      roofSquares: 30,
      roofPitch: '6:12',
      storyCount: 2,
      roofDeckingReplacementSqft: 100,
      roofRidgeCapLf: 60,
      roofDripEdgeLf: 180,
      roofValleyFlashingLf: 40,
      roofStepFlashingLf: 20,
      roofWallFlashingLf: 15,
      roofRidgeVentLf: 40,
      roofVentCount: 3,
      roofTurbineVentCount: 1,
      roofPipeBootCount: 4,
      roofChimneyFlashingCount: 1,
      roofSkylightCount: 1,
      roofPenetrationCount: 2,
      roofRepairAffectedSqft: 50,
    };
    const plan = normalizeTradeMeasurements(
      'roofing',
      filterPlanMeasurementsForTrade(supplied, 'selected_trade', 'roofing'),
      'plan'
    );
    const standalone = normalizeTradeMeasurements('roofing', supplied, 'notes');
    const planInput = { ...plan.measurements, itemQuantities: {} } as any;
    const standaloneInput = {
      ...standalone.measurements,
      itemQuantities: {},
    } as any;

    expect(plan.measurements).toEqual(standalone.measurements);
    expect(plan.measurements.roofSquares).toBe(30);
    expect(plan.measurements.roofDripEdgeLf).toBe(180);
    expect(plan.measurements.roofRepairAffectedSqft).toBe(50);

    const pricingContext = {
      checklistItems: [
        { id: 'roofing_system', state: 'included', choiceId: 'architectural_shingles' },
      ],
    };
    const pricingItems = [
      ['shingles_roofing', undefined],
      ['tear_off', 'two_layers'],
      ['decking_repair', undefined],
      ['drip_edge', undefined],
      ['ridge_cap', undefined],
      ['valley_flashing', undefined],
      ['step_flashing', undefined],
      ['wall_flashing', undefined],
      ['ridge_vent', undefined],
      ['roof_vents', undefined],
      ['turbine_vents', undefined],
      ['pipe_boots', undefined],
      ['chimney_flashing', undefined],
      ['skylight_flashing', undefined],
      ['roof_penetrations', undefined],
      ['roof_repairs', 'light_repair'],
    ] as const;

    for (const [itemId, choiceId] of pricingItems) {
      const planResolved = resolveChecklistItemQuantity(itemId, planInput, {
        templateKey: 'roofing',
        choiceId,
      });
      const standaloneResolved = resolveChecklistItemQuantity(
        itemId,
        standaloneInput,
        { templateKey: 'roofing', choiceId }
      );
      const planPricing = resolveScopeItemSuggestedPricing(
        itemId,
        planInput,
        'roofing',
        planResolved,
        pricingContext,
        choiceId
      );
      const standalonePricing = resolveScopeItemSuggestedPricing(
        itemId,
        standaloneInput,
        'roofing',
        standaloneResolved,
        pricingContext,
        choiceId
      );

      expect(planResolved).toMatchObject({
        quantity: standaloneResolved.quantity,
        unit: standaloneResolved.unit,
      });
      expect(planPricing.fill).toMatchObject({
        material: standalonePricing.fill?.material,
        labor: standalonePricing.fill?.labor,
        total: standalonePricing.fill?.total,
        basis: standalonePricing.fill?.basis,
      });
    }
  });

  it('declares concrete measurement schema and converges plan flatwork keys', () => {
    const keys = SUBCONTRACTOR_TRADE_DEFINITIONS.concrete.measurements.map(
      m => m.key
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        'concreteDrivewaySqft',
        'concretePatioSqft',
        'concreteWalkwaySqft',
        'concreteCy',
        'excavationCy',
      ])
    );
    const normalized = normalizeTradeMeasurements(
      'concrete',
      {
        concreteDrivewaySqft: 800,
        concretePatioSqft: 250,
        concreteWalkwaySqft: 140,
        concreteCy: 32,
      },
      'plan'
    );
    expect(normalized.structuredMeasurements?.concreteAreaByType).toEqual({
      driveways: 800,
      patios: 250,
      walkways: 140,
    });
    expect(normalized.measurements.concreteSqft).toBe(1190);
    expect(normalized.measurements.concreteCy).toBe(32);
    expect(normalized.structuredMeasurements?.concreteScope).toEqual(
      expect.arrayContaining(['pour_foundation', 'pour_flatwork', 'driveways'])
    );
  });

  it('filters concrete plan measurements to supported review keys only', () => {
    expect(
      filterPlanMeasurementsForTrade(
        {
          concreteDrivewaySqft: 500,
          concreteCy: 30,
          floorAreaSqft: 2400,
          concreteDemoSqft: 100,
        },
        'selected_trade',
        'concrete'
      )
    ).toEqual({
      concreteDrivewaySqft: 500,
      concreteCy: 30,
      concreteDemoSqft: 100,
    });
  });

  it('declares flooring measurement schema and converges plan install keys', () => {
    const keys = SUBCONTRACTOR_TRADE_DEFINITIONS.flooring.measurements.map(
      m => m.key
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        'flooringSqft',
        'flooringLvpSqft',
        'flooringTileSqft',
        'flooringCarpetSqft',
        'floorDemoSqft',
        'baseboardLf',
      ])
    );
    const normalized = normalizeTradeMeasurements(
      'flooring',
      {
        flooringCarpetSqft: 500,
        flooringTileSqft: 1500,
        baseboardLf: 200,
      },
      'plan'
    );
    expect(normalized.structuredMeasurements?.flooringProductScope).toEqual(
      expect.arrayContaining(['carpet', 'tile'])
    );
    expect(normalized.measurements.flooringSqft).toBe(2000);
    expect(normalized.measurements.baseboardLf).toBe(200);
    expect(normalized.structuredMeasurements?.flooringInstallScopeCount).toBe(1);
    expect(normalized.structuredMeasurements?.flooringDemoScopeCount).toBeUndefined();
  });

  it('filters flooring plan measurements to supported review keys only', () => {
    expect(
      filterPlanMeasurementsForTrade(
        {
          flooringCarpetSqft: 500,
          flooringTileSqft: 1500,
          floorAreaSqft: 2000,
          wallPaintSqft: 3200,
          baseboardLf: 200,
        },
        'selected_trade',
        'flooring'
      )
    ).toEqual({
      flooringCarpetSqft: 500,
      flooringTileSqft: 1500,
      floorAreaSqft: 2000,
      baseboardLf: 200,
    });
  });

  it('persists and hydrates Roofing canonical fields and provenance', () => {
    const input = normalizeScopeMeasurements({
      roofAreaSqft: 2800,
      roofSquares: 28,
      roofPitch: '6:12',
      storyCount: 2,
      quickMeasurementSources: {
        roofAreaSqft: 'plan_detected',
        roofSquares: 'calculated_from_components',
        roofPitch: 'plan_detected',
        storyCount: 'plan_detected',
      },
      measurementProvenance: {
        roofAreaSqft: 'FROM_PLAN',
        roofSquares: { source: 'PLANNING_ESTIMATE', derivedFrom: ['roofAreaSqft'] },
        roofPitch: 'FROM_PLAN',
        storyCount: 'FROM_PLAN',
      },
    });
    const persisted = scopeMeasurementsPayloadForPersist(input);
    expect(persisted.roofAreaSqft).toBe(2800);
    const restored = scopeMeasurementsInputFromPayload(persisted);
    expect(restored.roofAreaSqft).toBe('2800');
    expect(restored.roofSquares).toBe('28');
    expect(restored.roofPitch).toBe('6:12');
    expect(restored.storyCount).toBe('2');
    expect(restored.measurementProvenance?.roofPitch).toBe('FROM_PLAN');
  });

  it('keeps material Roofing conflicts unresolved', () => {
    const normalized = normalizeTradeMeasurements(
      'roofing',
      {
        roofSquares: 28,
        measurementConflicts: [
          {
            field: 'roofSquares',
            selectedValue: 28,
            candidates: [
              { value: 28, source: 'general_plan_takeoff' },
              { value: 35, source: 'focused_trade_takeoff' },
            ],
            requiresConfirmation: true,
          },
        ],
      },
      'plan'
    );
    expect(normalized.measurementConflicts?.[0].requiresConfirmation).toBe(true);
    expect(normalized.measurementProvenance?.roofSquares).toBe(
      'NEEDS_CONFIRMATION'
    );
    expect(toNormalizedProvenance('needs_confirmation')).toBe(
      'NEEDS_CONFIRMATION'
    );
  });

  it('binds Roofing add-ons to physical units instead of roof squares', () => {
    const roofing = SIMPLE_TRADE_SPECS.roofing;
    const expected = {
      drip_edge: ['roofDripEdgeLf', 'LF'],
      ridge_cap: ['roofRidgeCapLf', 'LF'],
      valley_flashing: ['roofValleyFlashingLf', 'LF'],
      step_flashing: ['roofStepFlashingLf', 'LF'],
      wall_flashing: ['roofWallFlashingLf', 'LF'],
      ridge_vent: ['roofRidgeVentLf', 'EA'],
      roof_vents: ['roofVentCount', 'EA'],
      turbine_vents: ['roofTurbineVentCount', 'EA'],
      pipe_boots: ['roofPipeBootCount', 'EA'],
      chimney_flashing: ['roofChimneyFlashingCount', 'EA'],
      skylight_flashing: ['roofSkylightCount', 'EA'],
      roof_penetrations: ['roofPenetrationCount', 'EA'],
    } as const;
    for (const [id, [measurementKey, unit]] of Object.entries(expected)) {
      expect(roofing.options.find(option => option.id === id)).toMatchObject({
        measurementKey,
        unit,
      });
      expect(CHECKLIST_ITEM_QUANTITY_RULES[id].measurementKey).toBe(
        measurementKey
      );
      expect(CHECKLIST_ITEM_QUANTITY_RULES[id].defaultUnit).toBe(
        unit === 'LF' ? 'lf' : 'each'
      );
    }
    expect(roofing.options.find(option => option.id === 'decking_repair')).toMatchObject({
      measurementKey: 'roofDeckingReplacementSqft',
      unit: 'sqft',
    });
    expect(CHECKLIST_ITEM_QUANTITY_RULES.decking_repair.measurementKey).toBe(
      'roofDeckingReplacementSqft'
    );
    expect(
      Object.values(expected).flatMap(([measurementKey]) => measurementKey)
    ).not.toContain('roofSquares');
  });

  it('keeps Roofing repair area independent from replacement area', () => {
    const normalized = normalizeScopeMeasurements({
      roofAreaSqft: 2800,
      roofSquares: 28,
      roofRepairAffectedSqft: 120,
    });
    expect(normalized.roofAreaSqft).toBe(2800);
    expect(normalized.roofSquares).toBe(28);
    expect(normalized.roofRepairAffectedSqft).toBe(120);
  });

  it('persists Roofing accessory quantities independently', () => {
    const restored = scopeMeasurementsInputFromPayload(
      scopeMeasurementsPayloadForPersist({
        roofDripEdgeLf: 120,
        roofRidgeVentLf: 80,
        roofVentCount: 2,
        roofPipeBootCount: 4,
        roofPenetrationCount: 3,
      })
    );
    expect(restored.roofDripEdgeLf).toBe('120');
    expect(restored.roofRidgeVentLf).toBe('80');
    expect(restored.roofVentCount).toBe('2');
    expect(restored.roofPipeBootCount).toBe('4');
    expect(restored.roofPenetrationCount).toBe('3');
    expect(restored.roofRidgeCapLf).toBe('');
    expect(restored.roofTurbineVentCount).toBe('');
  });

  it('persists Roofing selections, applied pricing, and all canonical quantities', () => {
    const applied = {
      selectionStatus: 'accepted',
      pricingSourceLabel: 'BPS national planning rate',
      pricingSourceKind: 'national_average',
      materialAmount: 8420,
      laborAmount: 12380,
      totalAmount: 20800,
    };
    const payload = scopeMeasurementsPayloadForPersist({
      roofAreaSqft: '3000',
      roofSquares: '30',
      roofPitch: '6:12',
      storyCount: '2',
      roofDeckingReplacementSqft: '100',
      roofDripEdgeLf: '180',
      roofRidgeCapLf: '60',
      roofRidgeVentLf: '40',
      roofValleyFlashingLf: '40',
      roofStepFlashingLf: '20',
      roofWallFlashingLf: '15',
      roofChimneyFlashingCount: '1',
      roofPipeBootCount: '4',
      roofVentCount: '3',
      roofTurbineVentCount: '1',
      roofSkylightCount: '1',
      roofPenetrationCount: '2',
      roofRepairAffectedSqft: '50',
      itemQuantities: {
        shingles_roofing: {
          quantity: '30',
          unit: 'squares',
          quantitySource: 'suggested_prefill',
        },
        tear_off: {
          quantity: '30',
          unit: 'squares',
          quantitySource: 'suggested_prefill',
        },
      },
      pricingAcceptance: {
        shingles_roofing: applied,
        tear_off: applied,
      },
    } as any);
    const restored = scopeMeasurementsInputFromPayload(payload);

    expect(restored).toMatchObject({
      roofAreaSqft: '3000',
      roofSquares: '30',
      roofPitch: '6:12',
      storyCount: '2',
      roofDeckingReplacementSqft: '100',
      roofDripEdgeLf: '180',
      roofRidgeCapLf: '60',
      roofRidgeVentLf: '40',
      roofValleyFlashingLf: '40',
      roofStepFlashingLf: '20',
      roofWallFlashingLf: '15',
      roofChimneyFlashingCount: '1',
      roofPipeBootCount: '4',
      roofVentCount: '3',
      roofTurbineVentCount: '1',
      roofSkylightCount: '1',
      roofPenetrationCount: '2',
      roofRepairAffectedSqft: '50',
    });
    expect(restored.itemQuantities).toMatchObject({
      shingles_roofing: { quantity: '30', unit: 'squares' },
      tear_off: { quantity: '30', unit: 'squares' },
    });
    expect(restored.pricingAcceptance).toMatchObject({
      shingles_roofing: applied,
      tear_off: applied,
    });
  });
});
