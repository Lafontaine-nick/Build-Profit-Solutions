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
  it('parses plan takeoff living area language into floorAreaSqft', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      '--- Plan takeoff ---\nMain Living Area is 1879 Sq Ft with a garage of 994 Sq Ft and a covered patio of 247 Sq Ft.',
      { templateKey: 'ground_up', projectType: 'new_build' }
    );
    expect(parsed.floorAreaSqft).toBe(1879);
    expect(parsed.wallPaintSqft).toBeUndefined();
  });

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

  it('parses bathroom shower tile material/labor rates separately from floor sqft', () => {
    const notes =
      'Bathroom remodel. Shower wall tile 120 sqft material $6/sqft labor $14/sqft. Bathroom floor tile 45 sqft not priced yet.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'bathroom',
      projectType: 'bathroom',
    });
    const measurements = normalizeScopeMeasurements(parsed);
    const showerTile = resolveChecklistItemQuantity('shower_tile', measurements, {
      templateKey: 'bathroom',
      notes,
    });
    const floorTile = resolveChecklistItemQuantity('floor_tile', measurements, {
      templateKey: 'bathroom',
      notes,
    });

    expect(parsed.showerWallTileSqft).toBe(120);
    expect(parsed.bathroomFloorSqft).toBe(45);
    expect(showerTile).toMatchObject({
      dualCount: { quantity: 120, unit: 'sqft' },
      dualMaterial: { quantity: 720 },
      dualLabor: { quantity: 1680 },
      dualAllowance: { quantity: 2400 },
    });
    expect(floorTile).toMatchObject({ quantity: 45, unit: 'sqft', pricingReady: true });
  });

  it('parses kitchen mixed scope without stealing backsplash sqft for paint', () => {
    const notes =
      'Kitchen remodel. Cabinets 20 LF. Countertops 48 sqft allowance $5,000. Backsplash tile 35 sqft material $8/sqft labor $12/sqft. Paint walls and ceiling 320 sqft $1.50/sqft labor. Appliance install allowance $1,200. Demo $850 lump sum.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'kitchen',
      projectType: 'kitchen',
    });
    const measurements = normalizeScopeMeasurements(parsed);
    const backsplash = resolveChecklistItemQuantity('backsplash', measurements, {
      templateKey: 'kitchen',
      notes,
    });
    const paint = resolveChecklistItemQuantity('paint', measurements, {
      templateKey: 'kitchen',
      notes,
    });

    expect(parsed.cabinetLf).toBe(20);
    expect(parsed.countertopSqft).toBe(48);
    expect(parsed.backsplashSqft).toBe(35);
    expect(parsed.wallPaintSqft).toBe(320);
    expect(parsed.itemQuantities?.appliances).toMatchObject({ quantity: 1200, unit: 'allowance' });
    expect(parsed.itemQuantities?.demo).toMatchObject({ quantity: 850, unit: 'lump_sum' });
    expect(backsplash).toMatchObject({
      dualMaterial: { quantity: 280 },
      dualLabor: { quantity: 420 },
      dualAllowance: { quantity: 700 },
    });
    expect(paint).toMatchObject({
      dualCount: { quantity: 320, unit: 'sqft' },
      dualLabor: { quantity: 480 },
      dualAllowance: { quantity: 480 },
    });
  });

  it('parses drywall hang and finish rates from the same drywall quantity', () => {
    const notes =
      'Drywall job. Hang drywall 1200 sqft material $1.50 per sqft labor $3 per sqft. Finish drywall 1200 sqft labor $2.25 per sqft.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'drywall',
      projectType: 'drywall',
    });
    const measurements = normalizeScopeMeasurements(parsed);

    expect(parsed.drywallSqft).toBe(1200);
    expect(parsed.itemQuantities?.hang__material).toMatchObject({ quantity: 1800, unit: 'allowance' });
    expect(parsed.itemQuantities?.hang__labor).toMatchObject({ quantity: 3600, unit: 'allowance' });
    expect(parsed.itemQuantities?.finish_tape__labor).toMatchObject({ quantity: 2700, unit: 'allowance' });
    expect(resolveChecklistItemQuantity('hang', measurements, { templateKey: 'drywall', notes })).toMatchObject({
      quantity: 5400,
      unit: 'allowance',
      pricingReady: true,
    });
  });

  it('parses concrete and landscape unit rates across sqft, CY, and sod sqft', () => {
    const notes =
      'Concrete patio 600 sqft material $4/sqft labor $6/sqft. Excavation 12 CY $95 per CY. New sod 900 sqft $2/sqft.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'landscape',
      projectType: 'landscape',
    });
    const measurements = normalizeScopeMeasurements(parsed);

    expect(parsed.concreteSqft).toBe(600);
    expect(parsed.excavationCy).toBe(12);
    expect(parsed.sodSqft).toBe(900);
    expect(parsed.itemQuantities?.concrete__material).toMatchObject({ quantity: 2400, unit: 'allowance' });
    expect(parsed.itemQuantities?.concrete__labor).toMatchObject({ quantity: 3600, unit: 'allowance' });
    expect(parsed.itemQuantities?.excavation).toMatchObject({ quantity: 1140, unit: 'allowance' });
    expect(parsed.itemQuantities?.sod_turf).toMatchObject({ quantity: 1800, unit: 'allowance' });
    expect(resolveChecklistItemQuantity('concrete', measurements, { templateKey: 'landscape', notes })).toMatchObject({
      quantity: 6000,
      unit: 'allowance',
      pricingReady: true,
    });
  });
});
