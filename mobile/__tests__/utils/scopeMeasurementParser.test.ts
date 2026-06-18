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

  it('keeps flooring demo unit-rate labor as a compact total with budget split', () => {
    const notes =
      'Flooring job demo existing tile which is 850 ft.2 labor is $3 dollars a square foot for tile demo next install LVP flooring which is 850 ft.? material is $4.50 a square foot and $3.25 a square foot for Labor. Also we have baseboard installation 220 linear feet with lump sum of $7 dollars per linear foot.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'flooring',
      projectType: 'flooring',
    });
    const measurements = normalizeScopeMeasurements(parsed);
    const floorDemo = resolveChecklistItemQuantity('floor_demo', measurements, {
      templateKey: 'flooring',
      notes,
    });

    expect(parsed.itemQuantities?.floor_demo).toMatchObject({ quantity: 2550, unit: 'allowance' });
    expect(floorDemo).toMatchObject({
      quantity: 2550,
      unit: 'allowance',
      pricingReady: true,
    });
  });

  it('keeps selected saved-rate pricing primary when notes also priced flooring', () => {
    const notes =
      'Install LVP flooring which is 850 sqft. Material is $4.50 a square foot and $3.25 a square foot for labor.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'flooring',
      projectType: 'flooring',
    });
    const measurements = normalizeScopeMeasurements({
      ...parsed,
      itemQuantities: {
        ...(parsed.itemQuantities || {}),
        flooring: { quantity: 850, unit: 'sqft', quantitySource: 'user_entered' },
        flooring__material: { quantity: 2550, unit: 'allowance', quantitySource: 'user_entered' },
        flooring__labor: { quantity: 3400, unit: 'allowance', quantitySource: 'user_entered' },
        flooring__allowance: { quantity: 5950, unit: 'allowance', quantitySource: 'user_entered' },
      },
    });

    expect(
      resolveChecklistItemQuantity('flooring', measurements, { templateKey: 'flooring', notes })
    ).toMatchObject({
      dualMaterial: { quantity: 2550 },
      dualLabor: { quantity: 3400 },
      dualAllowance: { quantity: 5950 },
    });
  });

  it('persists selected saved-rate split into the backend payload (not notes pricing)', () => {
    const notes =
      'Install LVP flooring which is 850 sqft. Material is $4.50 a square foot and $3.25 a square foot for labor.';
    const input = initialScopeMeasurementInputExtended({
      projectType: 'flooring',
      originalNotes: notes,
      scopeChecklist: { templateKey: 'flooring' },
      scopeMeasurements: { itemQuantities: {} },
    });
    input.itemQuantities = {
      ...input.itemQuantities,
      flooring: { quantity: '850', unit: 'sqft', quantitySource: 'user_entered' },
      flooring__material: { quantity: '2550', unit: 'allowance', quantitySource: 'user_entered' },
      flooring__labor: { quantity: '3400', unit: 'allowance', quantitySource: 'user_entered' },
      flooring__allowance: { quantity: '5950', unit: 'allowance', quantitySource: 'user_entered' },
    };

    const payload = scopeMeasurementsPayloadForPersist(input, {
      notes,
      templateKey: 'flooring',
    });

    expect(payload.itemQuantities?.flooring__allowance).toMatchObject({
      quantity: 5950,
      quantitySource: 'user_entered',
    });
    expect(payload.itemQuantities?.flooring__material).toMatchObject({
      quantity: 2550,
      quantitySource: 'user_entered',
    });
    expect(payload.itemQuantities?.flooring__labor).toMatchObject({
      quantity: 3400,
      quantitySource: 'user_entered',
    });
  });

  it('hydrates selected saved-rate split instead of reverting pricing subkeys to notes', () => {
    const notes =
      'Install LVP flooring which is 850 sqft. Material is $4.50 a square foot and $3.25 a square foot for labor.';
    const input = initialScopeMeasurementInputExtended({
      projectType: 'flooring',
      originalNotes: notes,
      scopeChecklist: { templateKey: 'flooring' },
      scopeMeasurements: {
        floorAreaSqft: 850,
        itemQuantities: {
          flooring: { quantity: 850, unit: 'sqft', quantitySource: 'user_entered' },
          flooring__material: { quantity: 2550, unit: 'allowance', quantitySource: 'user_entered' },
          flooring__labor: { quantity: 3400, unit: 'allowance', quantitySource: 'user_entered' },
          flooring__allowance: { quantity: 5950, unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
    });

    expect(input.itemQuantities.flooring__material).toMatchObject({
      quantity: '2550',
      quantitySource: 'user_entered',
    });
    expect(input.itemQuantities.flooring__labor).toMatchObject({
      quantity: '3400',
      quantitySource: 'user_entered',
    });
    expect(input.itemQuantities.flooring__allowance).toMatchObject({
      quantity: '5950',
      quantitySource: 'user_entered',
    });
  });
});
