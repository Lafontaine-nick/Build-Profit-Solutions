import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { listScopeItemsNeedingConfirmation } from '@/utils/estimateScopeChecklistUi';
import { buildNormalizedScopeMeasurementsFromInput } from '@/utils/scopeItemQuantities';

const emptyMeasurements = buildNormalizedScopeMeasurementsFromInput({ itemQuantities: {} });

describe('listScopeItemsNeedingConfirmation', () => {
  test('flags toilet when fixture choice is not selected', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'toilet',
        label: 'Toilet',
        inputType: 'choice',
        state: 'unsure',
        choiceId: null,
      },
    ];
    const pending = listScopeItemsNeedingConfirmation(items, emptyMeasurements, {
      templateKey: 'bathroom',
    });
    expect(pending.map((row) => row.itemId)).toEqual(['toilet']);
  });

  test('flags paint repair when paint scope is missing', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'paint_repair',
        label: 'Interior painting/patch and repair',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const pending = listScopeItemsNeedingConfirmation(items, emptyMeasurements, {
      templateKey: 'bathroom',
      bathroomPaintRepairScope: null,
    });
    expect(pending.map((row) => row.itemId)).toEqual(['paint_repair']);
  });

  test('does not flag wet-area demo lines that only need sqft takeoff', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'shower_floor_demo',
        label: 'Remove existing shower pan / shower floor',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const pending = listScopeItemsNeedingConfirmation(items, emptyMeasurements, {
      templateKey: 'bathroom',
    });
    expect(pending).toEqual([]);
  });

  test('does not flag paint repair when scope is selected but SF is missing', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'paint_repair',
        label: 'Interior painting/patch and repair',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const pending = listScopeItemsNeedingConfirmation(items, emptyMeasurements, {
      templateKey: 'bathroom',
      bathroomPaintRepairScope: 'full_room',
    });
    expect(pending).toEqual([]);
  });

  test('does not flag plumbing rough that only needs takeoff or Apply', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'plumbing_rough',
        label: 'Plumbing rough-in (shower / tub)',
        inputType: 'yes_no',
        state: 'included',
      },
    ];
    const pending = listScopeItemsNeedingConfirmation(items, emptyMeasurements, {
      templateKey: 'bathroom',
    });
    expect(pending).toEqual([]);
  });

  test('does not flag yes/no unsure items that only need scope confirmation', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'glass_door',
        label: 'Shower doors',
        inputType: 'yes_no',
        state: 'unsure',
      },
    ];
    const pending = listScopeItemsNeedingConfirmation(items, emptyMeasurements, {
      templateKey: 'bathroom',
      notes: 'Install new frameless shower door',
    });
    expect(pending).toEqual([]);
  });

  test('flags relocating toilet when floor type is missing', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'toilet',
        label: 'Toilet',
        inputType: 'choice',
        state: 'included',
        choiceId: 'relocating',
      },
    ];
    const pending = listScopeItemsNeedingConfirmation(items, emptyMeasurements, {
      templateKey: 'bathroom',
    });
    expect(pending.map((row) => row.itemId)).toEqual(['toilet']);
  });

  test('skips rows that already have applied pricing', () => {
    const items: ScopeChecklistItem[] = [
      {
        id: 'toilet',
        label: 'Toilet',
        inputType: 'choice',
        state: 'unsure',
        choiceId: null,
      },
    ];
    const measurements = buildNormalizedScopeMeasurementsFromInput({
      itemQuantities: {
        toilet: { quantity: 900, unit: 'allowance', quantitySource: 'user_entered' },
        toilet__material: { quantity: 425, unit: 'allowance', quantitySource: 'user_entered' },
        toilet__labor: { quantity: 475, unit: 'allowance', quantitySource: 'user_entered' },
      },
    });
    const pending = listScopeItemsNeedingConfirmation(items, measurements, {
      templateKey: 'bathroom',
    });
    expect(pending).toEqual([]);
  });
});
