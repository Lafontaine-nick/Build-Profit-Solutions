jest.mock('@/utils/resolveAiBackendUrl', () => ({
  postAiAssistantJson: jest.fn(),
  resolveAiBackendUrl: jest.fn(() => 'http://localhost'),
}));

import {
  applyScopeDetectionsToChecklistItems,
  applyPlanImportToDraft,
  mergeLivePlanImportIntoScopeMeasurements,
} from '../../utils/estimateAiDraft';
import type {
  PhotoScopeDetection,
  ScopeChecklistItem,
} from '../../utils/estimateAiDraft';

const item = (
  overrides: Partial<ScopeChecklistItem> & { id: string }
): ScopeChecklistItem =>
  ({
    label: overrides.id,
    state: 'unsure',
    ...overrides,
  }) as ScopeChecklistItem;

describe('applyScopeDetectionsToChecklistItems (plan → scope)', () => {
  test('fills unsure items, skips low confidence, and reports applied labels', () => {
    const items = [
      item({ id: 'flooring', label: 'New flooring' }),
      item({ id: 'paint', label: 'Interior paint' }),
      item({ id: 'deck', label: 'Deck build' }),
    ];
    const detections: PhotoScopeDetection[] = [
      { itemId: 'flooring', state: 'included', confidence: 0.9 },
      { itemId: 'paint', state: 'excluded', confidence: 0.6 },
      { itemId: 'deck', state: 'included', confidence: 0.3 },
    ];

    const result = applyScopeDetectionsToChecklistItems(items, detections);
    const byId = Object.fromEntries(result.items.map(i => [i.id, i]));

    expect(byId.flooring.state).toBe('included');
    expect(byId.flooring.noteBacked).toBe(true);
    expect(byId.paint.state).toBe('excluded');
    expect(byId.deck.state).toBe('unsure');
    expect(result.appliedCount).toBe(2);
    expect(result.appliedLabels).toEqual(['New flooring', 'Interior paint']);
  });

  test('never overrides explicit user answers', () => {
    const items = [
      item({ id: 'flooring', label: 'New flooring', state: 'excluded' }),
      item({ id: 'paint', label: 'Interior paint', state: 'included' }),
    ];
    const result = applyScopeDetectionsToChecklistItems(items, [
      { itemId: 'flooring', state: 'included', confidence: 0.95 },
      { itemId: 'paint', state: 'excluded', confidence: 0.95 },
    ]);
    const byId = Object.fromEntries(result.items.map(i => [i.id, i]));

    expect(byId.flooring.state).toBe('excluded');
    expect(byId.paint.state).toBe('included');
    expect(result.appliedCount).toBe(0);
  });

  test('remaps addition-style plan ids onto a ground_up checklist', () => {
    const items = [
      item({ id: 'foundation', label: 'Foundation' }),
      item({ id: 'framing', label: 'Framing' }),
      item({ id: 'roofing', label: 'Roofing' }),
      item({ id: 'exterior', label: 'Exterior finishes' }),
      item({ id: 'mep_rough', label: 'MEP rough-in' }),
      item({ id: 'paint_trim', label: 'Paint & trim' }),
      item({ id: 'tile_flooring', label: 'Tile & flooring' }),
      item({ id: 'sitework', label: 'Sitework & excavation' }),
    ];
    const result = applyScopeDetectionsToChecklistItems(items, [
      { itemId: 'foundation', state: 'included', confidence: 0.9 },
      { itemId: 'framing_structure', state: 'included', confidence: 0.9 },
      { itemId: 'roofing', state: 'included', confidence: 0.9 },
      { itemId: 'exterior_finishes', state: 'included', confidence: 0.9 },
      { itemId: 'electrical_rough', state: 'included', confidence: 0.85 },
      { itemId: 'paint', state: 'included', confidence: 0.8 },
      { itemId: 'flooring', state: 'included', confidence: 0.8 },
      { itemId: 'site_prep', state: 'included', confidence: 0.8 },
    ]);
    const byId = Object.fromEntries(result.items.map(i => [i.id, i]));

    expect(byId.foundation.state).toBe('included');
    expect(byId.framing.state).toBe('included');
    expect(byId.roofing.state).toBe('included');
    expect(byId.exterior.state).toBe('included');
    expect(byId.mep_rough.state).toBe('included');
    expect(byId.paint_trim.state).toBe('included');
    expect(byId.tile_flooring.state).toBe('included');
    expect(byId.sitework.state).toBe('included');
    expect(result.appliedCount).toBe(8);
  });

  test('choice items require a valid option id', () => {
    const items = [
      item({
        id: 'wet_area_install',
        label: 'Wet area',
        inputType: 'choice',
        choiceId: null,
        options: [
          { id: 'tile_shower', label: 'Tile shower' },
          { id: 'tub_surround', label: 'Tub + surround' },
        ],
      }),
    ];

    const valid = applyScopeDetectionsToChecklistItems(items, [
      {
        itemId: 'wet_area_install',
        state: 'included',
        choiceId: 'tile_shower',
        confidence: 0.8,
      },
    ]);
    expect(valid.items[0].choiceId).toBe('tile_shower');
    expect(valid.items[0].state).toBe('included');

    const invalid = applyScopeDetectionsToChecklistItems(items, [
      {
        itemId: 'wet_area_install',
        state: 'included',
        choiceId: 'nope',
        confidence: 0.8,
      },
    ]);
    expect(invalid.items[0].choiceId).toBeNull();
    expect(invalid.appliedCount).toBe(0);
  });

  test('returns items unchanged with empty inputs', () => {
    const items = [item({ id: 'flooring', label: 'New flooring' })];
    expect(applyScopeDetectionsToChecklistItems(items, []).items).toBe(items);
    expect(applyScopeDetectionsToChecklistItems(items, null).items).toBe(items);
    expect(
      applyScopeDetectionsToChecklistItems(
        [],
        [{ itemId: 'x', state: 'included', confidence: 1 }]
      ).items
    ).toEqual([]);
  });
});

describe('applyPlanImportToDraft', () => {
  test('seeds measurements and applies remapped scope detections', () => {
    const draft = {
      scopeChecklist: {
        estimateTier: 'standard',
        templateKey: 'ground_up',
        title: 'Confirm scope',
        intro: '',
        items: [
          { id: 'foundation', label: 'Foundation', state: 'unsure' },
          { id: 'exterior', label: 'Exterior finishes', state: 'unsure' },
          { id: 'mep_rough', label: 'MEP rough-in', state: 'unsure' },
          { id: 'framing', label: 'Framing', state: 'unsure' },
          { id: 'tile_flooring', label: 'Tile & flooring', state: 'unsure' },
        ],
      },
    } as any;
    const next = applyPlanImportToDraft(draft, {
      measurements: { floorAreaSqft: '1879', garageSqft: 994 },
      scopeDetections: [
        { itemId: 'foundation', state: 'included', confidence: 0.9 },
        { itemId: 'exterior_finishes', state: 'included', confidence: 0.9 },
        { itemId: 'electrical_rough', state: 'included', confidence: 0.85 },
        { itemId: 'framing', state: 'included', confidence: 0.9 },
        { itemId: 'tile_flooring', state: 'included', confidence: 0.85 },
      ],
      rooms: [
        { name: 'Kitchen', lengthFt: 13.08, widthFt: 14.83, areaSqft: 194 },
        { name: 'Primary Suite', areaSqft: 285 },
        { name: 'Garage', areaSqft: 994 },
      ],
    });
    expect(next.scopeMeasurements?.floorAreaSqft).toBe(1879);
    expect(next.scopeMeasurements?.garageSqft).toBe(994);
    expect(next.scopeMeasurements?.flooringSqft).toBe(1879);
    expect(next.scopeMeasurements?.kitchenFloorSqft).toBe(194);
    expect(next.scopeMeasurements?.planRooms?.map(r => r.name)).toEqual([
      'Kitchen',
      'Primary Suite',
      'Garage',
    ]);
    expect(next.scopeMeasurements?.itemQuantities?.foundation).toMatchObject({
      quantity: 1879,
      unit: 'sqft',
      quantitySource: 'plan_vision',
    });
    expect(next.scopeMeasurements?.itemQuantities?.framing).toMatchObject({
      quantity: 1879,
      unit: 'sqft',
    });
    expect(next.scopeMeasurements?.itemQuantities?.mep_rough).toMatchObject({
      quantity: 1879,
      unit: 'sqft',
    });
    expect(next.scopeMeasurements?.itemQuantities?.tile_flooring).toMatchObject(
      {
        quantity: 1879,
        unit: 'sqft',
      }
    );
    expect(next.scopeMeasurements?.itemQuantities?.paint_trim).toBeUndefined();
    const byId = Object.fromEntries(
      next.scopeChecklist!.items.map(i => [i.id, i])
    );
    expect(byId.foundation.state).toBe('included');
    expect(byId.exterior.state).toBe('included');
    expect(byId.mep_rough.state).toBe('included');
  });

  test('retains silent electrical fields when the same plan is imported again', () => {
    const draft = {
      scopeChecklist: {
        estimateTier: 'standard',
        templateKey: 'electrical',
        title: 'Confirm electrical scope',
        intro: '',
        items: [],
      },
      scopeMeasurements: {
        planImportFingerprint: 'same-plan',
        singlePoleSwitchCount: '12',
        threeWaySwitchCount: '4',
        quickMeasurementSources: {
          singlePoleSwitchCount: 'plan_detected',
          threeWaySwitchCount: 'plan_verified',
        },
        measurementProvenance: {
          singlePoleSwitchCount: { source: 'detected_from_plan', value: 12 },
          threeWaySwitchCount: { source: 'detected_from_plan', value: 4 },
        },
      },
    } as any;

    const next = applyPlanImportToDraft(draft, {
      planImportFingerprint: 'same-plan',
      measurements: { smokeDetectorCount: 7 },
    });

    expect(next.scopeMeasurements?.singlePoleSwitchCount).toBe(12);
    expect(next.scopeMeasurements?.threeWaySwitchCount).toBe(4);
    expect(
      next.scopeMeasurements?.quickMeasurementSources?.singlePoleSwitchCount
    ).toBe('needs_confirmation');
    expect(
      next.scopeMeasurements?.quickMeasurementSources?.threeWaySwitchCount
    ).toBe('needs_confirmation');
    expect(
      next.scopeMeasurements?.measurementProvenance?.threeWaySwitchCount
    ).toMatchObject({
      source: 'detected_from_plan',
      value: 4,
      status: 'needs_review',
      pricingEligible: false,
    });
  });

  test('keeps a prior same-plan switch count visible when the repeat count changes', () => {
    const draft = {
      scopeChecklist: {
        estimateTier: 'standard',
        templateKey: 'electrical',
        title: 'Confirm electrical scope',
        intro: '',
        items: [],
      },
      scopeMeasurements: {
        planImportFingerprint: 'same-plan',
        singlePoleSwitchCount: '12',
        quickMeasurementSources: {
          singlePoleSwitchCount: 'plan_detected',
        },
        measurementProvenance: {
          singlePoleSwitchCount: {
            source: 'detected_from_plan',
            value: 12,
          },
        },
      },
    } as any;

    const next = applyPlanImportToDraft(draft, {
      planImportFingerprint: 'same-plan',
      measurements: { singlePoleSwitchCount: 9 },
      measurementConflicts: [
        {
          field: 'singlePoleSwitchCount',
          requiresConfirmation: true,
        },
      ],
    });

    expect(next.scopeMeasurements?.singlePoleSwitchCount).toBe(12);
    expect(
      next.scopeMeasurements?.quickMeasurementSources?.singlePoleSwitchCount
    ).toBe('needs_confirmation');
    expect(
      next.scopeMeasurements?.electricalValidation?.blockedFields
    ).toContain('singlePoleSwitchCount');
    expect(next.scopeMeasurements?.measurementConflicts).toEqual([]);
  });
});

describe('live plan-review handoff to Confirm Scope', () => {
  test('hydrates plumbing equipment cards from fixture inventory and equipment metadata', () => {
    const next = mergeLivePlanImportIntoScopeMeasurements(
      {
        waterLineLf: '50',
        sewerLineLf: '30',
      },
      {
        estimatingMode: 'selected_trade',
        selectedTrade: 'plumbing',
        measurements: { waterLineLf: '50', sewerLineLf: '30', gasLineLf: '35' },
        fixtureInventory: {
          toilets: 3,
          lavatories: 3,
          showers: 2,
          tubs: 1,
          kitchenSinks: 1,
        },
        waterHeaterDetail: { count: 1, type: 'tank', fuel: 'gas' },
        gasApplianceScope: { range: true, fireplace: true, dryer: true },
      }
    );

    expect(next).toMatchObject({
      plumbingRoughPointCount: '10',
      plumbingTrimHookupCount: '10',
      plumbingFixturesHardwareCount: '10',
      waterHeaterCount: '1',
      gasApplianceConnectionCount: '3',
      gasLineLf: '35',
    });
    expect(next.plumbingScope).toEqual(
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
    expect(next.itemQuantities?.plumbing_fixtures_hardware).toMatchObject({
      quantity: 10,
      unit: 'each',
    });
  });

  test('hydrates drywall quick measurements from total plus plan rooms', () => {
    const next = mergeLivePlanImportIntoScopeMeasurements(
      {
        drywallSqft: '6263',
        quickMeasurementSources: { drywallSqft: 'plan_detected' },
        itemQuantities: {
          drywall: { quantity: 6263, unit: 'sqft', quantitySource: 'plan_detected' },
        },
      },
      {
        estimatingMode: 'selected_trade',
        selectedTrade: 'drywall',
        measurements: { drywallSqft: '6263' },
        rooms: [
          { name: 'Great Room', lengthFt: 20, widthFt: 15 },
          { name: 'Bed 1', lengthFt: 12, widthFt: 10 },
        ],
        planFacts: { wallHeightFt: 10 },
      }
    );

    expect(Number(next.drywallWallSqft)).toBeGreaterThan(0);
    expect(Number(next.drywallCeilingSqft)).toBeGreaterThan(0);
    expect(next.drywallSqft).toBe('6263');
    expect(next.itemQuantities?.drywall).toMatchObject({
      quantity: 6263,
      unit: 'sqft',
    });
  });

  test('clears stale plumbing rough/trim when the live takeoff has no fixture inventory', () => {
    const next = mergeLivePlanImportIntoScopeMeasurements(
      {
        plumbingRoughPointCount: '10',
        plumbingTrimHookupCount: '10',
        waterLineLf: '50',
        sewerLineLf: '30',
        plumbingScope: ['plumbing_rough', 'plumbing_trim', 'water_line', 'sewer_line'],
        itemQuantities: {
          plumbing_rough: { quantity: 10, unit: 'each' },
          plumbing_trim: { quantity: 10, unit: 'each' },
        },
        pricingAcceptance: {
          plumbing_rough: { selectionStatus: 'accepted', totalAmount: 5000 },
        },
      },
      {
        estimatingMode: 'selected_trade',
        selectedTrade: 'plumbing',
        measurements: { waterLineLf: '50', sewerLineLf: '30' },
        fixtureInventory: {},
      }
    );

    expect(next.waterLineLf).toBe('50');
    expect(Number(next.plumbingRoughPointCount) || 0).toBe(0);
    expect(next.itemQuantities?.plumbing_rough).toBeUndefined();
    expect(next.pricingAcceptance?.plumbing_rough).toBeUndefined();
    expect(next.plumbingScope).not.toEqual(expect.arrayContaining(['plumbing_rough']));
  });

  test('preserves unresolved conflicts, provenance, and plan source labels', () => {
    const conflict = {
      field: 'ceilingFanCount',
      requiresConfirmation: true,
      candidates: [
        { value: 6, source: 'symbol_count' },
        { value: 5, source: 'alternate_symbol_count' },
      ],
    };
    const next = mergeLivePlanImportIntoScopeMeasurements(
      {
        mainPanelCount: '1',
        quickMeasurementSources: { mainPanelCount: 'saved_draft' },
      },
      {
        measurements: {
          standardReceptacleCount: '40',
          ceilingFanCount: '',
        },
        quickMeasurementSources: {
          mainPanelCount: 'plan_detected',
          standardReceptacleCount: 'plan_detected',
        },
        fieldConfidence: { standardReceptacleCount: 0.93 },
        measurementProvenance: {
          standardReceptacleCount: { source: 'plan_takeoff' },
        },
        measurementConflicts: [conflict as any],
        estimatingMode: 'selected_trade',
        selectedTrade: 'electrical',
        missingInfo: ['serviceAmperage: No printed amperage callout'],
      }
    );

    expect(next.standardReceptacleCount).toBe('40');
    expect(next.ceilingFanCount).toBeUndefined();
    expect(next.quickMeasurementSources).toEqual({
      mainPanelCount: 'plan_detected',
      standardReceptacleCount: 'plan_detected',
    });
    expect(next.quickMeasurementFieldConfidence).toEqual({
      standardReceptacleCount: 0.93,
    });
    expect(next.measurementProvenance).toEqual({
      standardReceptacleCount: { source: 'plan_takeoff' },
    });
    expect(next.measurementConflicts).toEqual([conflict]);
    expect(next.planImportMode).toBe('selected_trade');
    expect(next.planImportTradeKey).toBe('electrical');
    expect(next.planImportMissingInfo).toEqual([
      'serviceAmperage: No printed amperage callout',
    ]);
  });

  test('an explicit empty conflict list clears stale draft conflicts', () => {
    const next = mergeLivePlanImportIntoScopeMeasurements(
      {
        measurementConflicts: [
          { field: 'singlePoleSwitchCount', requiresConfirmation: true },
        ],
      },
      { measurementConflicts: [] }
    );

    expect(next.measurementConflicts).toEqual([]);
  });

  test('preserves contractor confirmations when the plan fingerprint matches', () => {
    const next = mergeLivePlanImportIntoScopeMeasurements(
      {
        singlePoleSwitchCount: '20',
        planImportFingerprint: 'same-plan',
        quickMeasurementSources: {
          singlePoleSwitchCount: 'contractor_confirmed_from_plan_review',
        },
        quickMeasurementUserOverrides: { singlePoleSwitchCount: true },
        itemQuantities: {
          electrical_single_pole_switch: {
            quantity: 20,
            unit: 'each',
            quantitySource: 'contractor_confirmed_from_plan_review',
          },
        },
      },
      {
        planImportFingerprint: 'same-plan',
        measurements: { singlePoleSwitchCount: '18' },
        quickMeasurementSources: { singlePoleSwitchCount: 'plan_detected' },
        measurementProvenance: {
          singlePoleSwitchCount: { status: 'needs_review' },
        },
        measurementConflicts: [
          { field: 'singlePoleSwitchCount', requiresConfirmation: true },
        ],
      }
    );

    expect(next.singlePoleSwitchCount).toBe('20');
    expect(next.quickMeasurementSources?.singlePoleSwitchCount).toBe(
      'contractor_confirmed_from_plan_review'
    );
    expect(next.quickMeasurementUserOverrides?.singlePoleSwitchCount).toBe(
      true
    );
    expect(next.measurementConflicts).toEqual([]);
  });

  test('preserves insulation takeoff locks when the plan fingerprint matches', () => {
    const next = mergeLivePlanImportIntoScopeMeasurements(
      {
        exteriorWallInsulationSqft: '3508.8',
        atticInsulationSqft: '2260',
        planImportFingerprint: 'same-plan',
        quickMeasurementSources: {
          exteriorWallInsulationSqft: 'contractor_confirmed_from_plan_review',
          atticInsulationSqft: 'contractor_confirmed_from_plan_review',
        },
      },
      {
        planImportFingerprint: 'same-plan',
        measurements: {
          exteriorWallInsulationSqft: '2958.8',
          atticInsulationSqft: '1613',
        },
        quickMeasurementSources: {
          exteriorWallInsulationSqft: 'detected_from_plan',
          atticInsulationSqft: 'calculated_from_components',
        },
      }
    );

    expect(next.exteriorWallInsulationSqft).toBe('3508.8');
    expect(next.atticInsulationSqft).toBe('2260');
    expect(next.quickMeasurementSources?.exteriorWallInsulationSqft).toBe(
      'contractor_confirmed_from_plan_review'
    );
    expect(next.quickMeasurementSources?.atticInsulationSqft).toBe(
      'contractor_confirmed_from_plan_review'
    );
  });

  test('merges Plumbing plan quantities into scope cards and itemQuantities', () => {
    const next = mergeLivePlanImportIntoScopeMeasurements(
      {
        quickMeasurementSources: {},
        itemQuantities: {},
      },
      {
        measurements: {
          waterLineLf: '50',
          sewerLineLf: '30',
          plumbingRoughPointCount: '10',
          plumbingTrimHookupCount: '10',
        },
        quickMeasurementSources: {
          waterLineLf: 'needs_confirmation',
          sewerLineLf: 'needs_confirmation',
          plumbingRoughPointCount: 'plan_verified',
          plumbingTrimHookupCount: 'plan_verified',
        },
        measurementProvenance: {
          waterLineLf: {
            status: 'plan_verified',
            normalizedSource: 'FROM_PLAN',
            pricingEligible: false,
          },
          plumbingRoughPointCount: {
            status: 'plan_verified',
            normalizedSource: 'FROM_PLAN',
            pricingEligible: true,
          },
        },
        estimatingMode: 'selected_trade',
        selectedTrade: 'plumbing',
      }
    );

    expect(next.waterLineLf).toBe('50');
    expect(next.plumbingRoughPointCount).toBe('10');
    expect(next.quickMeasurementSources?.plumbingRoughPointCount).toBe(
      'plan_verified'
    );
    expect(next.itemQuantities).toMatchObject({
      water_line: { quantity: 50, unit: 'lf' },
      sewer_line: { quantity: 30, unit: 'lf' },
      plumbing_rough: { quantity: 10, unit: 'each' },
      plumbing_trim: { quantity: 10, unit: 'each' },
    });
    expect(next.plumbingScope).toEqual(
      expect.arrayContaining([
        'water_line',
        'sewer_line',
        'plumbing_rough',
        'plumbing_trim',
      ])
    );
  });

  test('clears old plan confirmations when a different plan is imported', () => {
    const next = mergeLivePlanImportIntoScopeMeasurements(
      {
        singlePoleSwitchCount: '20',
        planImportFingerprint: 'old-plan',
        quickMeasurementSources: {
          singlePoleSwitchCount: 'contractor_confirmed_from_plan_review',
        },
        quickMeasurementUserOverrides: { singlePoleSwitchCount: true },
        itemQuantities: {
          electrical_single_pole_switch: {
            quantity: 20,
            unit: 'each',
            quantitySource: 'contractor_confirmed_from_plan_review',
          },
        },
        electricalScope: ['electrical_single_pole_switch'],
      },
      {
        planImportFingerprint: 'new-plan',
        measurements: {},
      }
    );

    expect(next.singlePoleSwitchCount).toBeUndefined();
    expect(next.quickMeasurementSources?.singlePoleSwitchCount).toBeUndefined();
    expect(
      next.quickMeasurementUserOverrides?.singlePoleSwitchCount
    ).toBeUndefined();
    expect(next.itemQuantities?.electrical_single_pole_switch).toBeUndefined();
    expect(next.electricalScope).toEqual([]);
  });
});
