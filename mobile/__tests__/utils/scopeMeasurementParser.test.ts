import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import {
  initialScopeMeasurementInputExtended,
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
  resolveSuggestedBudgetSplitDisplay,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';

const SMITH_NOTES =
  'Floor job at Smith residence. Demo existing tile in main bath 850 sqft lump sum $2,550. Demo kitchen vinyl 180 sqft allowance $900. Install LVP in both areas 1030 total sqft not priced yet. Baseboards throughout 220 LF lump sum $1,540. Final clean and haul off $650 lump sum.';

describe('mobile scope measurement parser', () => {
  it('parses Smith flooring notes for Step 2 without duplicating bath sqft into kitchen/floor area', () => {
    const parsed = parseScopeMeasurementsFromNotes(SMITH_NOTES, {
      templateKey: 'flooring',
      projectType: 'flooring',
    });

    expect(parsed.bathroomFloorSqft).toBe(850);
    expect(parsed.kitchenFloorSqft).toBe(180);
    expect(parsed.floorAreaSqft).toBe(1030);
    expect(parsed.baseboardLf).toBe(220);
    expect(parsed.itemQuantities?.floor_demo).toMatchObject({ quantity: 3450, unit: 'allowance' });
    expect(parsed.itemQuantities?.flooring).toBeUndefined();
    expect(parsed.itemQuantities?.trim).toMatchObject({ quantity: 1540, unit: 'allowance' });
    expect(parsed.itemQuantities?.cleanup).toMatchObject({ quantity: 650, unit: 'lump_sum' });
    expect(parsed.itemQuantities?.demo).toBeUndefined();
  });

  it('hydrates Step 2 from current notes instead of stale saved floor measurements', () => {
    const input = initialScopeMeasurementInputExtended({
      projectType: 'flooring',
      originalNotes: SMITH_NOTES,
      scopeChecklist: { templateKey: 'flooring' },
      scopeMeasurements: {
        floorAreaSqft: '850',
        kitchenFloorSqft: '850',
        baseboardLf: '220',
        itemQuantities: {},
      },
    });
    const measurements = normalizeScopeMeasurements(scopeMeasurementsPayloadForPersist(input));

    expect(input.bathroomFloorSqft).toBe('850');
    expect(input.kitchenFloorSqft).toBe('180');
    expect(input.floorAreaSqft).toBe('1030');
    expect(input.baseboardLf).toBe('220');

    expect(inferItemStateFromNotes('floor_demo', SMITH_NOTES)).toBe('included');
    expect(inferItemStateFromNotes('flooring', SMITH_NOTES)).toBe('included');
    expect(inferItemStateFromNotes('floor_prep', SMITH_NOTES)).toBe('unsure');
    expect(inferItemStateFromNotes('trim', SMITH_NOTES)).toBe('included');
    expect(inferItemStateFromNotes('cleanup', SMITH_NOTES)).toBe('included');
    expect(inferItemStateFromNotes('demo', SMITH_NOTES)).toBe('unsure');

    expect(
      resolveChecklistItemQuantity('floor_demo', measurements, { templateKey: 'flooring', notes: SMITH_NOTES })
    ).toMatchObject({ quantity: 3450, unit: 'allowance', pricingReady: true });
    const flooringQty = resolveChecklistItemQuantity('flooring', {
      ...measurements,
      itemQuantities: {},
    }, { templateKey: 'flooring', notes: SMITH_NOTES });
    expect(flooringQty).toMatchObject({ quantity: 1030, unit: 'sqft', pricingReady: true });
    expect(resolveSuggestedBudgetSplitDisplay('flooring', input, 'flooring', flooringQty)).toMatchObject({
      material: 4120,
      labor: 5150,
      total: 9270,
      mode: 'suggested_price',
      basis: { quantity: 1030, unit: 'sqft' },
    });
    expect(
      resolveChecklistItemQuantity('trim', measurements, { templateKey: 'flooring', notes: SMITH_NOTES })
    ).toMatchObject({ quantity: 1540, unit: 'allowance', pricingReady: true });
    expect(
      resolveChecklistItemQuantity('cleanup', measurements, { templateKey: 'flooring', notes: SMITH_NOTES })
    ).toMatchObject({ quantity: 650, unit: 'lump_sum', pricingReady: true });
  });
});
