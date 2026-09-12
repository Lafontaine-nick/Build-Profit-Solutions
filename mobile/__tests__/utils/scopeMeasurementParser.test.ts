import {
  parseInsulationAssembliesFromNotes,
  parseScopeMeasurementsFromNotes,
} from '@/utils/scopeMeasurementParser';
import {
  initialScopeMeasurementInputExtended,
  normalizeScopeMeasurements,
  prepareScopeMeasurementsInputForUi,
  resolveChecklistItemQuantity,
  resolveSuggestedBudgetSplitDisplay,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';

const SMITH_NOTES =
  'Floor job at Smith residence. Demo existing tile in main bath 850 sqft lump sum $2,550. Demo kitchen vinyl 180 sqft allowance $900. Install LVP in both areas 1030 total sqft not priced yet. Baseboards throughout 220 LF lump sum $1,540. Final clean and haul off $650 lump sum.';

describe('mobile scope measurement parser', () => {
  it('does not borrow flooring sqft for an unmeasured interior paint scope', () => {
    const notes =
      'Remodel kitchen with demolition of existing cabinets, counters, backsplash, and flooring; install 38 LF cabinets, 48 sqft quartz counters, new backsplash, cabinet hardware $300, 12 LF plumbing relocation, 8 receptacles, 220 sqft drywall repair, 700 sqft LVP, two new windows, one exterior door, R-21 wall insulation, 120 LF of baseboard installation, and interior paint.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'kitchen',
    });

    expect(parsed.flooringSqft).toBe(700);
    expect(parsed.paintAreaSqft).toBeUndefined();
    expect(parsed.wallPaintSqft).toBeUndefined();
    expect(parsed.ceilingPaintSqft).toBeUndefined();
  });

  it('does not borrow paint sqft for unquantified flooring demolition', () => {
    const notes =
      'Remodel kitchen with demolition of existing cabinets, counters, backsplash, and flooring; install 700 sqft LVP and interior paint 500 sqft.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'kitchen',
    });

    expect(parsed.flooringSqft).toBe(700);
    expect(parsed.floorDemoSqft).toBeUndefined();
    expect(parsed.paintAreaSqft ?? parsed.wallPaintSqft).toBe(500);
  });

  it('keeps explicit paint sqft separate from stale flooring sqft during hydration', () => {
    const notes =
      'Remodel kitchen with demolition of existing cabinets, counters, backsplash, and flooring; install 38 LF cabinets, 48 sqft quartz counters, new backsplash, cabinet hardware $300, 12 LF plumbing relocation, 8 receptacles, 220 sqft drywall repair, 700 sqft LVP, two new windows, one exterior door, R-21 wall insulation, 120 LF of baseboard installation, and interior paint 500 sqft.';
    const prepared = prepareScopeMeasurementsInputForUi(
      {
        ...initialScopeMeasurementInputExtended(
          { scopeChecklist: { templateKey: 'kitchen' } },
          notes
        ),
        // Simulate the stale value that was being restored from the draft.
        paintAreaSqft: '700',
        flooringSqft: '700',
        itemQuantities: {
          paint: { quantity: 700, unit: 'sqft', quantitySource: 'user_entered' },
        },
      },
      { notes, templateKey: 'kitchen' }
    );

    expect(Number(prepared.flooringSqft)).toBe(700);
    expect(Number(prepared.paintAreaSqft)).toBe(500);
    expect(Number(prepared.paintAreaSqft)).not.toBe(
      Number(prepared.flooringSqft)
    );
    const paint = resolveChecklistItemQuantity(
      'paint',
      normalizeScopeMeasurements(prepared),
      { templateKey: 'kitchen', notes }
    );
    expect(paint.quantity).toBe(500);
    expect(paint.quantity).not.toBe(700);
    expect(prepared.itemQuantities?.paint?.quantity).toBe(500);
  });

  it('parses insulation home area and location-specific assemblies', () => {
    const notes =
      'Insulate an existing 1,800 sqft two-story home. Install R-21 fiberglass batt insulation in 2,000 sqft of exterior walls, R-38 blown insulation in 1,200 sqft of attic area, and R-30 batt insulation in 900 sqft of floor area. Include air sealing and normal installation. No drywall removal.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'insulation',
    });

    expect(parsed.floorAreaSqft).toBe(1800);
    expect(parsed.exteriorWallInsulationSqft).toBe(2000);
    expect(parsed.atticInsulationSqft).toBe(1200);
    expect(parsed.floorInsulationSqft).toBe(900);
    expect(parseInsulationAssembliesFromNotes(notes)).toEqual([
      {
        location: 'exterior_wall',
        materialType: 'Batt',
        rValue: 'R-21',
        sqft: 2000,
      },
      {
        location: 'attic_ceiling',
        materialType: 'Blown-in',
        rValue: 'R-38',
        sqft: 1200,
      },
      {
        location: 'floor',
        materialType: 'Batt',
        rValue: 'R-30',
        sqft: 900,
      },
    ]);
  });

  it.each([
    'Include gap sealing for the 1,200 sqft conditioned home.',
    'Include gap seal and seal penetrations throughout the home.',
    'Include draft seal around accessible openings.',
    'Include gap penetration sealing.',
  ])('maps air-sealing synonym to the standard air-sealing card: %s', (notes) => {
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'insulation',
    });

    expect(parsed.airSealingIncluded).toBe(true);
  });

  it('does not infer air sealing from an explicit exclusion', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      'Insulate a 1,200 sqft home. No gap sealing or penetration sealing.',
      { templateKey: 'insulation' }
    );

    expect(parsed.airSealingIncluded).not.toBe(true);
  });

  it('derives a combined wall-and-ceiling paint surface from house area context', () => {
    const notes =
      'Full interior refresh on a 1,900 sqft house. Paint all walls and ceilings, new LVP throughout main floor about 1,100 sqft.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'room_remodel',
      projectType: 'other',
    });

    expect(parsed.paintAreaSqft).toBe(1900);
    expect(parsed.originalPaintAreaReferenceSqft).toBe(1900);
    expect(parsed.combinedPaintableAreaSqft).toBe(6080);
    expect(parsed.wallPaintSqft).toBe(4180);
    expect(parsed.ceilingPaintSqft).toBe(1900);
    expect(parsed.paintAreaNeedsConfirmation).toBe(true);
  });

  it('parses explicit Roofing add-on quantities without deriving them from squares', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      'Roof replacement is 30 squares. Decking replacement 100 sqft. Drip edge 180 LF, ridge cap 60 LF, valley flashing 40 LF, step flashing 20 LF, wall flashing 15 LF, ridge vent 40 LF. 3 roof vents, 1 turbine vent, 4 pipe boots, 1 chimney flashing, 1 skylight, and 2 roof penetrations. Roof repairs affect 50 sqft.',
      { templateKey: 'roofing', projectType: 'roofing' }
    );

    expect(parsed).toMatchObject({
      roofSquares: 30,
      roofDeckingReplacementSqft: 100,
      roofDripEdgeLf: 180,
      roofRidgeCapLf: 60,
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
    });
  });

  it('parses small roofing repair patch as sqft not squares', () => {
    const notes =
      'I need to build a roofing repair bid, about 50 sqft area, asphalt shingles tear off and replace';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'roofing',
      projectType: 'roofing',
    });
    expect(parsed.roofAreaSqft).toBe(50);
    expect(parsed.roofSquares).toBe(0.5);
    const input = initialScopeMeasurementInputExtended(
      { scopeChecklist: { templateKey: 'roofing' }, projectType: 'roofing' },
      notes
    );
    expect(Number(input.roofAreaSqft)).toBe(50);
    expect(Number(input.roofSquares)).toBe(0.5);
    expect(parsed.roofRepairAffectedSqft).toBeUndefined();
  });

  it('does not treat decking dollar allowances as sqft takeoff', () => {
    const notes =
      'Tear off and reroof, 22 squares. Decking looks ok but put $1,000 allowance if we find bad wood.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'roofing',
      projectType: 'roofing',
    });
    expect(parsed.roofDeckingReplacementSqft).toBeUndefined();
    expect(parsed.roofSquares).toBe(22);
  });

  it('does not turn room-addition area into roof squares for a roof tie-in', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      'Frame a new 600 sqft room addition with 8-foot walls. Include exterior wall framing, roof tie-in framing, and headers for 4 windows and 1 exterior door. The foundation and drywall will be priced separately.',
      { templateKey: 'addition', projectType: 'room_addition' }
    );

    expect(parsed.roofSquares).toBeUndefined();
    expect(parsed.roofAreaSqft).toBeUndefined();
  });

  it('parses gutters LF and downspouts EA independently from notes', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      'Install 150 LF gutters and 4 downspouts on the rear elevation.',
      { templateKey: 'roofing', projectType: 'roofing' }
    );
    expect(parsed).toMatchObject({
      roofGutterLf: 150,
      roofDownspoutCount: 4,
    });
    expect(parsed).not.toHaveProperty('roofAreaSqft');
  });

  it('persists gutters and downspouts quantities independently', () => {
    const payload = scopeMeasurementsPayloadForPersist({
      roofGutterLf: '150',
      roofDownspoutCount: '4',
    } as any);
    expect(payload.roofGutterLf).toBe(150);
    expect(payload.roofDownspoutCount).toBe(4);
    const normalized = normalizeScopeMeasurements(payload as any);
    expect(normalized.roofGutterLf).toBe(150);
    expect(normalized.roofDownspoutCount).toBe(4);
  });

  it('parses plan takeoff living area language into floorAreaSqft', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      '--- Plan takeoff ---\nMain Living Area is 1879 Sq Ft with a garage of 994 Sq Ft and a covered patio of 247 Sq Ft.',
      { templateKey: 'ground_up', projectType: 'new_build' }
    );
    expect(parsed.floorAreaSqft).toBe(1879);
    expect(parsed.garageSqft).toBe(994);
    expect(parsed.deckSqft).toBe(247);
    expect(parsed.concreteSqft).toBeUndefined();
    expect(parsed.wallPaintSqft).toBeUndefined();
  });

  it('parses Kitchen room-list lines and keeps plan import fields on hydrate', () => {
    const notes = [
      '--- Plan takeoff ---',
      'Main living area is 1879 SqFt with a garage of 994 SqFt and a covered patio of 247 SqFt.',
      'Room measurements:',
      '- Kitchen: 194.1 sqft',
      '- Garage: 443.7 sqft',
    ].join('\n');
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'ground_up',
      projectType: 'new_build',
    });
    expect(parsed.kitchenFloorSqft).toBe(194.1);
    expect(parsed.garageSqft).toBe(994);

    const input = initialScopeMeasurementInputExtended({
      projectType: 'new_build',
      originalNotes: notes,
      scopeChecklist: { templateKey: 'ground_up' },
      scopeMeasurements: {
        floorAreaSqft: 1879,
        garageSqft: 994,
        deckSqft: 247,
        kitchenFloorSqft: 194.1,
        flooringSqft: 1879,
        planRooms: [{ name: 'Kitchen', areaSqft: 194.1 }],
      },
    });
    expect(input.garageSqft).toBe('994');
    expect(input.deckSqft).toBe('247');
    expect(input.kitchenFloorSqft).toBe('194.1');
    expect(input.flooringSqft).toBe('1879');
    expect(input.concreteSqft).toBe('');
    expect(input.planRooms?.map(r => r.name)).toEqual(['Kitchen']);
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
    expect(parsed.itemQuantities?.floor_demo).toMatchObject({
      quantity: 3450,
      unit: 'allowance',
    });
    expect(parsed.itemQuantities?.flooring).toBeUndefined();
    expect(parsed.itemQuantities?.trim).toMatchObject({
      quantity: 1540,
      unit: 'allowance',
    });
    expect(parsed.itemQuantities?.cleanup).toMatchObject({
      quantity: 650,
      unit: 'lump_sum',
    });
    expect(parsed.itemQuantities?.demo).toBeUndefined();
  });

  it('keeps tear-out flooring out of new-install product totals', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      'Main floor carpet tear out and install LVP, 1,150 sqft. Include demo and disposal. Reinstall existing baseboards about 280 linear feet after flooring.',
      { templateKey: 'flooring', projectType: 'flooring' }
    );

    expect(parsed.flooringSqft).toBe(1150);
    expect(parsed.flooringLvpSqft).toBe(1150);
    expect(parsed.flooringCarpetSqft).toBeUndefined();
    expect(parsed.flooringProductScope).toEqual(['lvp']);
    expect(parsed.floorDemoSqft).toBe(1150);
    expect(parsed.baseboardLf).toBe(280);

    const hydrated = initialScopeMeasurementInputExtended({
      projectType: 'flooring',
      originalNotes:
        'Main floor carpet tear out and install LVP, 1,150 sqft. Include demo and disposal. Reinstall existing baseboards about 280 linear feet after flooring.',
      scopeChecklist: { templateKey: 'flooring' },
      scopeMeasurements: { itemQuantities: {} },
    });
    expect(hydrated.flooringSqft).toBe('1150');
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
    const measurements = normalizeScopeMeasurements(
      scopeMeasurementsPayloadForPersist(input)
    );

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
      resolveChecklistItemQuantity('floor_demo', measurements, {
        templateKey: 'flooring',
        notes: SMITH_NOTES,
      })
    ).toMatchObject({ quantity: 3450, unit: 'allowance', pricingReady: true });
    const flooringQty = resolveChecklistItemQuantity(
      'flooring',
      {
        ...measurements,
        itemQuantities: {},
      },
      { templateKey: 'flooring', notes: SMITH_NOTES }
    );
    expect(flooringQty).toMatchObject({
      quantity: 1030,
      unit: 'sqft',
      pricingReady: true,
    });
    expect(
      resolveSuggestedBudgetSplitDisplay(
        'flooring',
        input,
        'flooring',
        flooringQty
      )
    ).toMatchObject({
      material: 4120,
      labor: 5150,
      total: 9270,
      mode: 'suggested_price',
      basis: { quantity: 1030, unit: 'sqft' },
    });
    expect(
      resolveChecklistItemQuantity('trim', measurements, {
        templateKey: 'flooring',
        notes: SMITH_NOTES,
      })
    ).toMatchObject({ quantity: 1540, unit: 'allowance', pricingReady: true });
    expect(
      resolveChecklistItemQuantity('cleanup', measurements, {
        templateKey: 'flooring',
        notes: SMITH_NOTES,
      })
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

    expect(parsed.itemQuantities?.floor_demo).toMatchObject({
      quantity: 2550,
      unit: 'allowance',
    });
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
        flooring: {
          quantity: 850,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
        flooring__material: {
          quantity: 2550,
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        flooring__labor: {
          quantity: 3400,
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        flooring__allowance: {
          quantity: 5950,
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
    });

    expect(
      resolveChecklistItemQuantity('flooring', measurements, {
        templateKey: 'flooring',
        notes,
      })
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
      flooring: {
        quantity: '850',
        unit: 'sqft',
        quantitySource: 'user_entered',
      },
      flooring__material: {
        quantity: '2550',
        unit: 'allowance',
        quantitySource: 'user_entered',
      },
      flooring__labor: {
        quantity: '3400',
        unit: 'allowance',
        quantitySource: 'user_entered',
      },
      flooring__allowance: {
        quantity: '5950',
        unit: 'allowance',
        quantitySource: 'user_entered',
      },
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
          flooring: {
            quantity: 850,
            unit: 'sqft',
            quantitySource: 'user_entered',
          },
          flooring__material: {
            quantity: 2550,
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          flooring__labor: {
            quantity: 3400,
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          flooring__allowance: {
            quantity: 5950,
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
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
    const showerTile = resolveChecklistItemQuantity(
      'shower_tile',
      measurements,
      {
        templateKey: 'bathroom',
        notes,
      }
    );
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
    expect(floorTile).toMatchObject({
      quantity: 45,
      unit: 'sqft',
      pricingReady: true,
    });
  });

  it('Smith kitchen: backsplash sqft not stolen from earlier countertop sqft', () => {
    const notes =
      'Kitchen remodel at the Smith house. Tear out old cabinets and counters. New cabinets about 18 linear feet, quartz counters roughly 55 sqft, tile backsplash 28 sqft. Customer is handling flooring themselves.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'kitchen',
      projectType: 'kitchen',
    });
    expect(parsed.cabinetLf).toBe(18);
    expect(parsed.countertopSqft).toBe(55);
    expect(parsed.backsplashSqft).toBe(28);
    expect(parsed.kitchenFloorSqft).toBeUndefined();

    const input = initialScopeMeasurementInputExtended({
      projectType: 'kitchen',
      originalNotes: notes,
      scopeChecklist: { templateKey: 'kitchen' },
    });
    expect(input.kitchenFloorSqft).toBe('');
  });

  it('does not reuse flooring sqft as countertop sqft when counters are measured in LF', () => {
    const notes =
      'Interior remodel. Install 900 sqft of LVP and replace 12 linear feet of kitchen countertops.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'room_remodel',
      projectType: 'room_remodel',
    });

    expect(parsed.countertopSqft).toBeUndefined();
  });

  it('does not steal backsplash sqft for kitchen floor when flooring is excluded', () => {
    const notes =
      'Kitchen remodel with 18 LF cabinets, 55 sqft counters, 28 sqft backsplash, flooring by others.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'kitchen',
      projectType: 'kitchen',
    });
    expect(parsed.backsplashSqft).toBe(28);
    expect(parsed.kitchenFloorSqft).toBeUndefined();

    const input = initialScopeMeasurementInputExtended({
      projectType: 'kitchen',
      originalNotes: notes,
      scopeChecklist: { templateKey: 'kitchen' },
      scopeMeasurements: {
        kitchenFloorSqft: 28,
        backsplashSqft: 28,
        cabinetLf: 18,
        countertopSqft: 55,
      },
    });
    expect(input.kitchenFloorSqft).toBe('');
  });

  it('parses 50 sqft kitchen floor and prices flooring from kitchenFloorSqft not stale itemQuantities', () => {
    const notes =
      'Kitchen remodel. New cabinets about 18 linear feet, quartz counters roughly 55 sqft, tile backsplash 28 sqft. Install kitchen floor tile 50 sqft.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'kitchen',
      projectType: 'kitchen',
    });
    expect(parsed.kitchenFloorSqft).toBe(50);

    const input = initialScopeMeasurementInputExtended({
      projectType: 'kitchen',
      originalNotes: notes,
      scopeChecklist: { templateKey: 'kitchen' },
      scopeMeasurements: {
        kitchenFloorSqft: '50',
        itemQuantities: {
          flooring: {
            quantity: '5',
            unit: 'sqft',
            quantitySource: 'user_entered',
          },
        },
      },
    });
    expect(input.itemQuantities?.flooring?.quantity).toBe('50');
    const resolved = resolveChecklistItemQuantity(
      'flooring',
      normalizeScopeMeasurements(input),
      { templateKey: 'kitchen', notes }
    );
    expect(Number(resolved.quantity)).toBe(50);
  });

  it('does not infer kitchen floor from no-kitchen-floor exclusion language', () => {
    const notes =
      'Kitchen: 18 LF cabinets, 55 sqft counters, 28 sqft backsplash. No kitchen floor work.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'kitchen',
      projectType: 'kitchen',
    });
    expect(parsed.backsplashSqft).toBe(28);
    expect(parsed.kitchenFloorSqft).toBeUndefined();
  });

  it('parses kitchen mixed scope without stealing backsplash sqft for paint', () => {
    const notes =
      'Kitchen remodel. Cabinets 20 LF. Countertops 48 sqft allowance $5,000. Backsplash tile 35 sqft material $8/sqft labor $12/sqft. Paint walls and ceiling 320 sqft $1.50/sqft labor. Appliance install allowance $1,200. Demo $850 lump sum.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'kitchen',
      projectType: 'kitchen',
    });
    const measurements = normalizeScopeMeasurements(parsed);
    const backsplash = resolveChecklistItemQuantity(
      'backsplash',
      measurements,
      {
        templateKey: 'kitchen',
        notes,
      }
    );
    const paint = resolveChecklistItemQuantity('paint', measurements, {
      templateKey: 'kitchen',
      notes,
    });

    expect(parsed.cabinetLf).toBe(20);
    expect(parsed.countertopSqft).toBe(48);
    expect(parsed.backsplashSqft).toBe(35);
    expect(parsed.wallPaintSqft).toBe(320);
    expect(parsed.itemQuantities?.appliances).toMatchObject({
      quantity: 1200,
      unit: 'allowance',
    });
    expect(parsed.itemQuantities?.demo).toMatchObject({
      quantity: 850,
      unit: 'lump_sum',
    });
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

  it('uses the explicit LVP takeoff instead of drywall sqft for kitchen flooring', () => {
    const notes =
      'Remodel kitchen with demolition of existing cabinets, counters, backsplash, and flooring; install 38 LF cabinets, 48 sqft quartz counters, new backsplash, 12 LF plumbing relocation, 8 receptacles, 220 sqft drywall repair, 700 sqft LVP, two new windows, one exterior door, R-21 wall insulation, and interior paint.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'kitchen',
      projectType: 'kitchen',
    });
    expect(parsed.drywallSqft).toBe(220);
    expect(parsed.flooringSqft).toBe(700);
    expect(parsed.kitchenFloorSqft).toBe(700);
  });

  it('does not use flooring or drywall sqft as an interior paint takeoff', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      'Remodel kitchen with 220 sqft drywall repair, 700 sqft LVP, and interior paint.',
      { templateKey: 'kitchen', projectType: 'kitchen' }
    );
    expect(parsed.drywallSqft).toBe(220);
    expect(parsed.flooringSqft).toBe(700);
    expect(parsed.wallPaintSqft).toBeUndefined();
    expect(parsed.ceilingPaintSqft).toBeUndefined();
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
    expect(parsed.itemQuantities?.hang__material).toMatchObject({
      quantity: 1800,
      unit: 'allowance',
    });
    expect(parsed.itemQuantities?.hang__labor).toMatchObject({
      quantity: 3600,
      unit: 'allowance',
    });
    expect(parsed.itemQuantities?.finish_tape__labor).toMatchObject({
      quantity: 2700,
      unit: 'allowance',
    });
    expect(
      resolveChecklistItemQuantity('hang', measurements, {
        templateKey: 'drywall',
        notes,
      })
    ).toMatchObject({
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
    expect(parsed.itemQuantities?.concrete__material).toMatchObject({
      quantity: 2400,
      unit: 'allowance',
    });
    expect(parsed.itemQuantities?.concrete__labor).toMatchObject({
      quantity: 3600,
      unit: 'allowance',
    });
    expect(parsed.itemQuantities?.excavation).toMatchObject({
      quantity: 1140,
      unit: 'allowance',
    });
    expect(parsed.itemQuantities?.sod_turf).toMatchObject({
      quantity: 1800,
      unit: 'allowance',
    });
    expect(
      resolveChecklistItemQuantity('concrete', measurements, {
        templateKey: 'landscape',
        notes,
      })
    ).toMatchObject({
      quantity: 6000,
      unit: 'allowance',
      pricingReady: true,
    });
  });

  it('does not treat total yard sqft as sod sqft', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      'Front yard and back yard will have both fake grass and rocks. Backyard is roughly 150 sqft and front yard is 250 sqft.',
      { templateKey: 'landscaping', projectType: 'landscaping' }
    );

    expect(parsed.landscapeSqft).toBe(150);
    expect(parsed.sodSqft).toBeUndefined();
    expect(parsed.rockMulchSqft).toBeUndefined();
  });

  it('clears stale notes-derived sod quantity during landscaping hydration', () => {
    const input = initialScopeMeasurementInputExtended({
      projectType: 'landscaping',
      originalNotes:
        'Front yard and back yard will have both fake grass and rocks. Backyard is roughly 150 sqft and front yard is 250 sqft.',
      scopeChecklist: { templateKey: 'landscaping' },
      scopeMeasurements: {
        sodSqft: 150,
        itemQuantities: {
          sod_turf: { quantity: 150, unit: 'sqft', quantitySource: 'notes' },
        },
      },
    });

    expect(input.sodSqft).toBe('');
    expect(input.itemQuantities?.sod_turf).toBeUndefined();
  });

  it('does not use total landscape sqft as turf sqft for pricing', () => {
    const normalized = normalizeScopeMeasurements({
      landscapeSqft: 150,
      sodSqft: null,
      itemQuantities: {},
    });

    expect(
      resolveChecklistItemQuantity('sod_turf', normalized, {
        templateKey: 'landscaping',
      }).quantity
    ).toBeNull();
  });

  it('routes concrete flatwork notes to demo and pour sqft without living area', () => {
    const notes =
      "Let's create a bid for some concrete flat work. Demo driveway roughly 100 square feet. Demo excavation dirt and installing walkway. So flat work needed roughly 100 square feet for a walkway.";
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'concrete',
      projectType: 'concrete',
    });

    expect(parsed.floorAreaSqft).toBeUndefined();
    expect(parsed.concreteDemoSqft).toBe(100);
    expect(parsed.concreteSqft).toBe(100);
  });

  it('parses combined interior paint notes into one area, not walls', () => {
    const notes =
      'Interior repaint about 1,500 sqft walls and ceilings two coats. 200 LF baseboards/trim, 6 interior doors, and 200 sqft kitchen cabinets. No exterior.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'painting',
      projectType: 'painting',
    });

    expect(parsed.paintAreaSqft).toBe(1500);
    expect(parsed.combinedPaintableAreaSqft).toBe(1500);
    expect(parsed.paintPricingMethod).toBe('combined');
    expect(parsed.wallPaintSqft).toBeUndefined();
    expect(parsed.ceilingPaintSqft).toBeUndefined();
    expect(parsed.baseboardLf).toBe(200);
    expect(parsed.interiorDoorCount).toBe(6);
    expect(parsed.cabinetPaintSqft).toBe(200);
    expect(parsed.cabinetRunLf).toBeUndefined();
    expect(parsed.exteriorPaintSqft).toBeUndefined();
  });

  it('does not dump combined paint notes onto walls when hydrating suggested measurements', () => {
    const notes =
      'Interior repaint 1500 sqft walls and ceilings two coats. Paint 200 sqft kitchen cabinets.';
    const input = initialScopeMeasurementInputExtended({
      projectType: 'painting',
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'painting',
        suggestedMeasurements: {
          wallPaintSqft: 1500,
          paintAreaSqft: 1500,
        } as any,
      },
    });

    expect(input.paintPricingMethod).toBe('combined');
    expect(Number(input.paintAreaSqft)).toBe(1500);
    expect(Number(input.combinedPaintableAreaSqft)).toBe(1500);
    expect(String(input.wallPaintSqft || '')).toBe('');
    expect(String(input.ceilingPaintSqft || '')).toBe('');
    expect(Number(input.cabinetPaintSqft)).toBe(200);
  });

  it('sums labeled multi-floor areas and honors excluded cabinet paint', () => {
    const notes =
      'Interior repaint — occupied 2-story home. Main floor: 1,400 sqft. Upper floor: 1,000 sqft. Paint walls and ceilings throughout both floors. Repaint 14 interior doors and all baseboards. Kitchen cabinets, closets, and exterior surfaces are excluded.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'painting',
      projectType: 'painting',
    });

    expect(parsed.paintAreaSqft).toBe(2400);
    expect(parsed.originalPaintAreaReferenceSqft).toBe(2400);
    expect(parsed.combinedPaintableAreaSqft).toBe(7680);
    expect(parsed.paintPricingMethod).toBe('separate');
    expect(parsed.wallPaintSqft).toBe(5280);
    expect(parsed.ceilingPaintSqft).toBe(2400);
    expect(parsed.paintAreaBasis).toBe('floor_area');
    expect(parsed.interiorDoorCount).toBe(14);
    expect(parsed.paintScope).toEqual(
      expect.arrayContaining(['walls', 'ceilings', 'trim', 'doors'])
    );
    expect(parsed.paintScope).not.toContain('cabinets');
    expect(parsed.paintScope).not.toContain('exterior');
    expect(parsed.cabinetPaintSqft).toBeUndefined();

    const hydrated = initialScopeMeasurementInputExtended({
      projectType: 'painting',
      originalNotes: notes,
      scopeChecklist: {
        templateKey: 'painting',
        suggestedMeasurements: { paintAreaSqft: 1400 } as any,
      },
    });
    expect(Number(hydrated.floorAreaSqft)).toBe(2400);
    expect(Number(hydrated.combinedPaintableAreaSqft)).toBe(7680);
    expect(hydrated.paintPricingMethod).toBe('separate');
    expect(Number(hydrated.wallPaintSqft)).toBe(5280);
    expect(Number(hydrated.ceilingPaintSqft)).toBe(2400);
  });

  it('parses canonical Electrical notes examples onto owned keys', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      'Install 18 recessed lights. Add 12 standard outlets. Add 4 GFCI outlets. Install a 200 amp panel. Run two dedicated 20 amp circuits. Install one 50 amp range circuit. Add 3 ceiling fans. Finished-wall fishing, include rough-in and conduit.',
      { templateKey: 'electrical', projectType: 'electrical' }
    );

    expect(parsed.recessedLightCount).toBe(18);
    expect(parsed.standardReceptacleCount).toBe(12);
    expect(parsed.gfciReceptacleCount).toBe(4);
    expect(parsed.mainPanelCount).toBe(1);
    expect(parsed.serviceAmperage).toBe(200);
    expect(parsed.dedicated20aCircuitCount).toBe(2);
    expect(parsed.rangeHookupCount).toBe(1);
    expect(parsed.circuit50aCount).toBeUndefined();
    expect(parsed.ceilingFanCount).toBe(3);
    expect(parsed.electricalProjectCondition).toBe('finished_wall_service');
    expect(parsed.electricalIncludeRough).toBe(true);
    expect(parsed.electricalConduit).toBe(true);
    expect(parsed.itemQuantities?.electrical_recessed_light?.quantity).toBe(18);
  });

  it('parses Windows & doors counts and aggregates typed garage doors', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      'Replace 12 windows, 2 exterior swing doors, 1 sliding patio door, 1 single garage door, 1 double garage door, and 1 RV garage door.',
      { templateKey: 'windows_doors', projectType: 'windows_doors' }
    );
    expect(parsed).toMatchObject({
      windowCount: 12,
      exteriorDoorCount: 2,
      slidingDoorCount: 1,
      garageDoorSingleCount: 1,
      garageDoorDoubleCount: 1,
      garageDoorRvCount: 1,
    });
    expect(parsed.itemQuantities).toMatchObject({
      windows: { quantity: 12, unit: 'each' },
      exterior_doors: { quantity: 2, unit: 'each' },
      sliding_doors: { quantity: 1, unit: 'each' },
      garage_doors: { quantity: 3, unit: 'each' },
    });
  });

  it('does not activate framing for replacement-only window and door notes', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      'Replace 5 windows and 2 exterior doors; no reframing or new openings.',
      { templateKey: 'windows_doors', projectType: 'windows_doors' }
    );
    expect(parsed.windowCount).toBe(5);
    expect(parsed.exteriorDoorCount).toBe(2);
    expect(parsed.reframingRequested).toBeUndefined();
    expect(parsed.framingOpeningCount).toBeUndefined();
  });

  it('does not borrow a nearby shower dimension as a window count', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      'Install a 60-inch tile shower with waterproofing. Window replacement and install.',
      { templateKey: 'bathroom', projectType: 'bathroom' }
    );
    expect(parsed.windowCount).toBeUndefined();
  });

  it('flags explicit reframing separately from Windows & doors counts', () => {
    const parsed = parseScopeMeasurementsFromNotes(
      'Replace 3 windows and reframe 2 window openings.',
      { templateKey: 'windows_doors', projectType: 'windows_doors' }
    );
    expect(parsed.windowCount).toBe(3);
    expect(parsed.reframingRequested).toBe(true);
    expect(parsed.framingOpeningCount).toBe(2);
    expect(parsed.itemQuantities).not.toHaveProperty('openings');
  });

  const GARAGE_CONVERSION_NOTES =
    'Convert 2-car garage to office/studio, about 400 sqft. Insulate walls and ceiling, drywall hang and finish, paint, add 4 recessed lights and a few outlets, mini split HVAC. Keep existing garage door for now.';

  it('parses convert-garage notes into floor area — not 2-car garage planning default', () => {
    const parsed = parseScopeMeasurementsFromNotes(GARAGE_CONVERSION_NOTES, {
      templateKey: 'addition',
      projectType: 'garage_conversion',
    });
    expect(parsed.floorAreaSqft).toBe(400);
    expect(parsed.garageSqft).toBeUndefined();
    expect(parsed.garageDoorDoubleCount).toBeUndefined();
    expect(parsed.garageDoorSingleCount).toBeUndefined();
    expect(parsed.drywallSqft).toBeUndefined();
  });

  const GROUND_UP_HOME_NOTES = `New 2,800 sqft two story home with attached 2-car garage. Standard builder grade finishes. Owner is taking care of sitework, utilities, and landscaping separate from us.`;

  it('parses new-build home living area without stealing SF into garage', () => {
    const parsed = parseScopeMeasurementsFromNotes(GROUND_UP_HOME_NOTES, {
      templateKey: 'ground_up',
      projectType: 'new_build',
    });
    expect(parsed.floorAreaSqft).toBe(2800);
    expect(parsed.garageSqft).toBe(500);
    expect(parsed.storyCount).toBe(2);
    expect(parsed.garageDoorDoubleCount).toBe(1);
    expect(parsed.garageDoorSingleCount).toBeUndefined();
  });
});
