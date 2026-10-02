jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  checklistItemInScope,
  prepareScopeMeasurementsInputForUi,
} from '@/utils/scopeItemQuantities';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  checklistHasWholeHouseOpeningPackage,
  bucketWholeProjectScopeGroups,
  ensureWholeProjectGroundUpScopeItems,
  isWholeProjectPlanExport,
  normalizeScopeChecklistItems,
  shouldSeedWholeProjectShellChecklist,
} from '@/utils/estimateScopeChecklistUi';
import {
  planScopeRecordsHaveGroundUpAllowances,
  withPlanScopeRecordMeasurements,
} from '@/utils/planScopeRecords';
import { syncElectricalScopeItems } from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { confirmScopeDisplayItemsFromDraft } from '@/utils/scopePackagesForReview';

const notes =
  'Ground-up new construction from imported architectural plans.';

function planMeasurements() {
  return {
    ...emptyQuickMeasurementInput(),
    floorAreaSqft: '2571',
    garageSqft: '1427',
    deckSqft: '322',
    windowCount: '31',
    exteriorDoorCount: '4',
    slidingDoorCount: '1',
    interiorDoorCount: '18',
    garageDoorDoubleCount: '1',
    garageDoorRvCount: '1',
    recessedLightCount: '31',
    ceilingFanCount: '5',
    bathExhaustFanCount: '4',
    singlePoleSwitchCount: '47',
    threeWaySwitchCount: '8',
    planImportMode: 'whole_project',
    planImportFingerprint: 'plan-test',
    itemQuantities: {},
    quickMeasurementSources: {
      singlePoleSwitchCount: 'contractor_confirmed_from_plan_review',
      threeWaySwitchCount: 'contractor_confirmed_from_plan_review',
      ceilingFanCount: 'contractor_confirmed_from_plan_review',
      bathExhaustFanCount: 'contractor_confirmed_from_plan_review',
      recessedLightCount: 'contractor_confirmed_from_plan_review',
    },
    measurementProvenance: {
      singlePoleSwitchCount: { status: 'needs_review', pricingEligible: false },
      threeWaySwitchCount: { status: 'needs_review', pricingEligible: false },
      ceilingFanCount: { status: 'needs_review', pricingEligible: false },
      bathExhaustFanCount: { status: 'needs_review', pricingEligible: false },
      recessedLightCount: {
        status: 'plan_verified',
        evidenceKind: 'instance_tags',
        pricingEligible: true,
      },
    },
  } as any;
}

describe('whole project plan pricing gap', () => {
  it('keeps planning prices for shell trades and confirmed electrical counts', () => {
    const measurements = planMeasurements();
    const seeded = normalizeScopeChecklistItems(
      [{ id: 'windows', label: 'Windows', inputType: 'yes_no', state: 'included' }] as any,
      'ground_up',
      { notes }
    );
    const items = syncElectricalScopeItems(
      ensureWholeProjectGroundUpScopeItems(seeded, notes),
      {
        templateKey: 'ground_up',
        notes,
        quantities: measurements,
        electricalScope: measurements.electricalScope,
      }
    );
    const priced = (itemId: string) => {
      const item = items.find(row => row.id === itemId);
      expect(item && checklistItemInScope(item)).toBe(true);
      const resolved = resolveChecklistItemQuantity(itemId, measurements, {
        templateKey: 'ground_up',
        notes,
      });
      const suggestion = resolveScopeItemSuggestedPricing(
        itemId,
        measurements,
        'ground_up',
        resolved,
        { checklistItems: items },
        item?.choiceId,
        notes
      );
      return { resolved, total: suggestion.fill?.total ?? 0 };
    };

    for (const itemId of [
      'framing',
      'drywall',
      'insulation',
      'foundation',
      'excavation',
      'plumbing_rough',
      'hvac',
      'interior_paint',
      'exterior_paint',
      'pour_flatwork',
    ]) {
      const row = priced(itemId);
      expect(row.resolved.pricingReady).toBe(true);
      expect(row.total).toBeGreaterThan(0);
    }

    expect(priced('pour_flatwork').resolved.quantity).toBeNull();
    expect(priced('windows').total).toBeGreaterThan(0);
    expect(priced('electrical_single_pole_switch').total).toBeGreaterThan(0);
    expect(priced('electrical_recessed_light').total).toBeGreaterThan(0);
    expect(items.find(row => row.id === 'electrical_rough')).toBeUndefined();
  });

  it('treats windows, garage doors, and interior doors as a whole-house plan', () => {
    const openings = [
      { id: 'windows', state: 'included' },
      { id: 'exterior_doors', state: 'included' },
      { id: 'sliding_doors', state: 'included' },
      { id: 'garage_doors', state: 'included' },
      { id: 'interior_doors', state: 'included' },
      { id: 'pour_flatwork', state: 'included' },
    ];
    expect(checklistHasWholeHouseOpeningPackage(openings)).toBe(true);
    expect(
      checklistHasWholeHouseOpeningPackage(openings, { singleTradePlan: true })
    ).toBe(false);
    expect(
      checklistHasWholeHouseOpeningPackage([
        { id: 'windows', state: 'included' },
        { id: 'interior_doors', state: 'included' },
      ])
    ).toBe(false);
    expect(
      checklistHasWholeHouseOpeningPackage([
        { id: 'windows', state: 'included' },
        { id: 'interior_doors', state: 'included' },
        { id: 'foundation', state: 'included' },
      ])
    ).toBe(true);
    expect(
      checklistHasWholeHouseOpeningPackage([
        { id: 'window_install', state: 'included' },
        { id: 'interior_door_install', state: 'included' },
        { id: 'flatwork', state: 'included' },
      ])
    ).toBe(true);

    const restored = ensureWholeProjectGroundUpScopeItems(openings as any, notes);
    for (const itemId of [
      'framing',
      'foundation',
      'excavation',
      'drywall',
      'insulation',
      'plumbing_rough',
      'hvac',
      'electrical_rough',
      'electrical_trim',
      'interior_paint',
      'exterior_paint',
    ]) {
      expect(restored.some(row => row.id === itemId && row.state === 'included')).toBe(
        true
      );
    }
  });

  it('keeps the ground-up shell when Scope found already listed the allowances', () => {
    const records = [
      {
        id: 'project',
        title: 'Cover sheet',
        findings: [
          {
            id: 'floorAreaSqft',
            label: 'Living area',
            quantity: 2571,
            unit: 'sqft',
            status: 'read_from_plan' as const,
            sheet: null,
            page: null,
            sourceText: null,
          },
          {
            id: 'recessedLightCount',
            label: 'Recessed lights',
            quantity: 31,
            unit: 'each',
            status: 'read_from_plan' as const,
            sheet: null,
            page: null,
            sourceText: null,
          },
        ],
      },
      {
        id: 'allowances',
        title: 'Not printed on these sheets',
        findings: [
          {
            id: 'allowance-excavation',
            label: 'Excavation',
            quantity: null,
            unit: null,
            status: 'planning_allowance' as const,
            sheet: null,
            page: null,
            sourceText: null,
          },
        ],
      },
    ];
    expect(planScopeRecordsHaveGroundUpAllowances(records)).toBe(true);
    expect(
      isWholeProjectPlanExport({
        planImportMode: 'selected_trade',
        planImportTradeKey: 'electrical',
        planScopeRecords: records,
      })
    ).toBe(false);
    expect(
      shouldSeedWholeProjectShellChecklist({
        planImportMode: 'selected_trade',
        planImportTradeKey: 'electrical',
        singleTradePlan: true,
        templateKey: 'bathroom',
        planScopeRecords: records,
      })
    ).toBe(false);
    const filled = withPlanScopeRecordMeasurements(
      { floorAreaSqft: '', quickMeasurementSources: { recessedLightCount: 'needs_confirmation' } },
      records
    );
    expect(filled.floorAreaSqft).toBe(2571);
    expect(filled.recessedLightCount).toBe(31);
    expect(filled.quickMeasurementSources?.recessedLightCount).toBe(
      'needs_confirmation'
    );
    expect(filled.measurementProvenance?.recessedLightCount).toMatchObject({
      pricingEligible: false,
      status: 'needs_review',
    });

    const confirmed = withPlanScopeRecordMeasurements(
      {
        floorAreaSqft: '',
        quickMeasurementSources: {
          recessedLightCount: 'contractor_confirmed_from_plan_review',
        },
      },
      records
    );
    expect(confirmed.quickMeasurementSources?.recessedLightCount).toBe(
      'contractor_confirmed_from_plan_review'
    );
  });

  it('adds the ground-up trades when confirm scope only kept the openings', () => {
    const grouped = bucketWholeProjectScopeGroups([
      {
        title: 'Openings & trim',
        items: [
          { id: 'windows', label: 'Windows', inputType: 'yes_no', state: 'included' },
          { id: 'exterior_doors', label: 'Exterior doors', inputType: 'yes_no', state: 'included' },
          { id: 'sliding_doors', label: 'Sliding doors', inputType: 'yes_no', state: 'included' },
          { id: 'garage_doors', label: 'Garage doors', inputType: 'yes_no', state: 'included' },
          { id: 'interior_doors', label: 'Interior doors', inputType: 'yes_no', state: 'included' },
          { id: 'pour_flatwork', label: 'Exterior concrete flatwork', inputType: 'yes_no', state: 'included' },
        ] as any,
      },
    ]);
    const ids = grouped.flatMap(group => group.items.map(item => item.id));
    for (const itemId of [
      'framing',
      'drywall',
      'insulation',
      'foundation',
      'excavation',
      'hvac',
      'electrical_rough',
      'electrical_trim',
      'interior_paint',
      'exterior_paint',
      'plumbing_rough',
    ]) {
      expect(ids).toContain(itemId);
    }
    expect(grouped.some(group => group.title === 'Site & structure')).toBe(true);
    expect(grouped.some(group => group.title === 'MEP')).toBe(true);
  });

  it('adds the ground-up trades when the site card is foundation, not flatwork', () => {
    const grouped = bucketWholeProjectScopeGroups([
      {
        title: 'Scope',
        items: [
          { id: 'windows', label: 'Windows', inputType: 'yes_no', state: 'included' },
          { id: 'exterior_doors', label: 'Exterior doors', inputType: 'yes_no', state: 'included' },
          { id: 'sliding_doors', label: 'Sliding doors', inputType: 'yes_no', state: 'included' },
          { id: 'interior_doors', label: 'Interior doors', inputType: 'yes_no', state: 'included' },
          { id: 'foundation', label: 'Foundation', inputType: 'yes_no', state: 'included' },
        ] as any,
      },
    ]);
    const ids = grouped.flatMap(group => group.items.map(item => item.id));
    expect(ids).toEqual(
      expect.arrayContaining([
        'framing',
        'drywall',
        'insulation',
        'hvac',
        'interior_paint',
        'exterior_paint',
        'plumbing_rough',
      ])
    );
    expect(
      grouped.find(group => group.title === 'Site & structure')?.items.length
    ).toBeGreaterThan(1);
  });

  it('restores ground-up trades when Step 3 rebuilds from saved openings', () => {
    const displayItems = confirmScopeDisplayItemsFromDraft({
      originalNotes: notes,
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'ground_up',
        items: [
          { id: 'windows', label: 'Windows', state: 'included' },
          { id: 'interior_doors', label: 'Interior doors', state: 'included' },
          { id: 'garage_doors', label: 'Garage doors', state: 'included' },
          {
            id: 'pour_flatwork',
            label: 'Exterior concrete flatwork',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        planImportMode: 'whole_project',
        floorAreaSqft: '2571',
        garageSqft: '1427',
      },
    } as any);
    const ids = displayItems.map(item => item.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'framing',
        'drywall',
        'insulation',
        'plumbing_rough',
        'hvac',
        'interior_paint',
        'exterior_paint',
      ])
    );
  });

  it('adds the ground-up trades when garage doors are only a measurement stepper', () => {
    const grouped = bucketWholeProjectScopeGroups([
      {
        title: 'Scope',
        items: [
          { id: 'window_install', label: 'Window install', inputType: 'yes_no', state: 'included' },
          { id: 'exterior_doors', label: 'Exterior doors', inputType: 'yes_no', state: 'included' },
          { id: 'sliding_doors', label: 'Sliding doors', inputType: 'yes_no', state: 'included' },
          { id: 'doors', label: 'Interior doors', inputType: 'yes_no', state: 'included' },
          { id: 'pour_flatwork', label: 'Exterior concrete flatwork', inputType: 'yes_no', state: 'included' },
        ] as any,
      },
    ]);
    const ids = grouped.flatMap(group => group.items.map(item => item.id));
    expect(ids).toEqual(expect.arrayContaining(['framing', 'drywall', 'hvac', 'foundation']));
    const site = grouped.find(group => group.title === 'Site & structure');
    expect((site?.items.length || 0) > 1).toBe(true);
  });

  it('keeps the scope-found record when confirm scope rebuilds measurements', () => {
    const records = [
      {
        id: 'allowances',
        title: 'Not printed on these sheets',
        findings: [
          {
            id: 'allowance-drywall',
            label: 'Drywall',
            quantity: null,
            unit: null,
            status: 'planning_allowance' as const,
            sheet: null,
            page: null,
            sourceText: null,
          },
        ],
      },
    ];
    const prepared = prepareScopeMeasurementsInputForUi(
      {
        ...emptyQuickMeasurementInput(),
        planImportMode: 'whole_project',
        floorAreaSqft: '2571',
        planScopeRecords: records,
      },
      { notes: 'Architectural plan takeoff', templateKey: 'ground_up' }
    );
    expect(planScopeRecordsHaveGroundUpAllowances(prepared.planScopeRecords)).toBe(
      true
    );
  });
});
