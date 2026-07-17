const {
  resolveQuantityForChecklistItem,
  resolveQuantityForPackage,
  stampPackageWithCatalogRules,
  normalizeScopeMeasurements,
} = require('../scopeItemQuantityCatalog');

describe('scopeItemQuantityCatalog', () => {
  test('floor tile uses bathroom floor sqft, not global stamp on fixtures', () => {
    const ctx = { measurements: normalizeScopeMeasurements({ sqft: 90 }) };
    const floor = resolveQuantityForChecklistItem('floor_tile', ctx);
    expect(floor.quantity).toBe(90);
    expect(floor.unit).toBe('sqft');
    expect(floor.pricingReady).toBe(true);

    const vanity = resolveQuantityForChecklistItem('vanity', ctx);
    expect(vanity.quantity).toBe(1);
    expect(vanity.unit).toBe('each');
    expect(vanity.pricingReady).toBe(true);

    const toilet = resolveQuantityForChecklistItem('toilet', ctx);
    expect(toilet.quantity).toBe(1);
    expect(toilet.unit).toBe('each');

    const electrical = resolveQuantityForChecklistItem('electrical_rough', ctx);
    expect(electrical.pricingReady).toBe(false);
    expect(electrical.quantity).toBeNull();

    const withCount = normalizeScopeMeasurements({
      itemQuantities: {
        electrical_rough: { quantity: 2, unit: 'each', quantitySource: 'user_entered' },
      },
    });
    const electricalCount = resolveQuantityForChecklistItem('electrical_rough', {
      measurements: withCount,
    });
    expect(electricalCount.pricingReady).toBe(true);
    expect(electricalCount.quantity).toBe(2);
    expect(electricalCount.dualCount).toMatchObject({ quantity: 2, unit: 'each' });

    const withAllowance = normalizeScopeMeasurements({
      itemQuantities: {
        'electrical_rough__allowance': { quantity: 1500, unit: 'lump_sum', quantitySource: 'user_entered' },
      },
    });
    const electricalAllowance = resolveQuantityForChecklistItem('electrical_rough', {
      measurements: withAllowance,
    });
    expect(electricalAllowance.pricingReady).toBe(true);
    expect(electricalAllowance.quantity).toBe(1500);
    expect(electricalAllowance.dualAllowance).toMatchObject({ quantity: 1500, unit: 'lump_sum' });
  });

  test('shower tile requires shower wall sqft not bathroom floor', () => {
    const ctx = { measurements: normalizeScopeMeasurements({ sqft: 90 }) };
    const shower = resolveQuantityForChecklistItem('shower_tile', ctx);
    expect(shower.pricingReady).toBe(false);

    const withShower = normalizeScopeMeasurements({ sqft: 90, showerWallTileSqft: 85 });
    const showerReady = resolveQuantityForChecklistItem('shower_tile', { measurements: withShower });
    expect(showerReady.quantity).toBe(85);
    expect(showerReady.pricingReady).toBe(true);
  });

  test('stampPackageWithCatalogRules skips invalid sqft on electrical work', () => {
    const pkg = {
      name: 'Electrical Work (Bathroom)',
      scope: 'New circuits and wiring',
      scopeQuantities: [],
    };
    const ctx = { measurements: normalizeScopeMeasurements({ sqft: 90 }) };
    const next = stampPackageWithCatalogRules(pkg, ctx);
    expect(next.scopeQuantities || []).toHaveLength(0);
  });

  test('stampPackageWithCatalogRules applies Confirm Scope M/L when takeoff is not pricingReady', () => {
    const pkg = {
      name: 'Finish carpentry / interior trim',
      scope: 'Finish trim package',
      checklistItemId: 'interior_trim',
      scopeQuantities: [],
    };
    const ctx = {
      measurements: normalizeScopeMeasurements({
        itemQuantities: {
          interior_trim__material: {
            quantity: 5519,
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          interior_trim__labor: {
            quantity: 4599,
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
        pricingAcceptance: {
          interior_trim: {
            selectionStatus: 'accepted',
            totalAmount: 10118,
            materialAmount: 5519,
            laborAmount: 4599,
          },
        },
      }),
      templateKey: 'ground_up',
    };
    const next = stampPackageWithCatalogRules(pkg, ctx);
    expect(next).toMatchObject({
      price: 10118,
      materialPrice: 5519,
      laborPrice: 4599,
      pricingType: 'split',
      priceSource: 'user_provided',
    });
  });

  test('stampPackageWithCatalogRules applies lf to baseboard only', () => {
    const pkg = { name: 'Baseboard Installation', scope: 'Install baseboard', scopeQuantities: [] };
    const ctx = { measurements: normalizeScopeMeasurements({ sqft: 90, lf: 24 }) };
    const next = stampPackageWithCatalogRules(pkg, ctx);
    expect(next.scopeQuantities[0]).toMatchObject({ quantity: 24, unit: 'lf' });
  });

  test('resolveQuantityForPackage marks cleanup as needing pricing when no amount entered', () => {
    const ctx = { measurements: normalizeScopeMeasurements({ sqft: 90 }) };
    const q = resolveQuantityForPackage('Jobsite Cleanup & Disposal', 'Final clean', ctx);
    expect(q.quantity).toBeNull();
    expect(q.unit).toBe('lump_sum');
    expect(q.pricingReady).toBe(false);
  });

  test('permits ignore stale placeholder allowance of $1', () => {
    const ctx = {
      measurements: normalizeScopeMeasurements({
        itemQuantities: {
          permits: { quantity: 1, unit: 'allowance', quantitySource: 'user_entered' },
        },
      }),
      templateKey: 'addition',
    };
    const permits = resolveQuantityForChecklistItem('permits', ctx);
    expect(permits.quantity).toBeNull();
    expect(permits.pricingReady).toBe(false);
  });

  test('bathroom full demo sums floor + shower wall + shower floor sqft', () => {
    const measurements = normalizeScopeMeasurements({
      bathroomFloorSqft: 50,
      showerWallTileSqft: 90,
      showerFloorTileSqft: 25,
    });
    const demo = resolveQuantityForChecklistItem('demo', { measurements });
    expect(demo.quantity).toBe(165);
    expect(demo.unit).toBe('sqft');
    expect(demo.pricingReady).toBe(true);
    expect(demo.sourceLabel).toContain('Floor + shower');

    const floorDemo = resolveQuantityForChecklistItem('floor_demo', { measurements });
    expect(floorDemo.quantity).toBe(50);
  });

  test('kitchen cabinet demo uses lump sum default, not bathroom tear-out sqft', () => {
    const measurements = normalizeScopeMeasurements({
      bathroomFloorSqft: 50,
      showerWallTileSqft: 90,
      kitchenFloorSqft: 180,
    });
    const demo = resolveQuantityForChecklistItem('demo', { measurements, templateKey: 'kitchen' });
    expect(demo.quantity).toBe(1);
    expect(demo.unit).toBe('lump_sum');
    expect(demo.pricingReady).toBe(true);
    expect(demo.sourceLabel).toBe('Assumed');

    const floorDemo = resolveQuantityForChecklistItem('floor_demo', {
      measurements,
      templateKey: 'kitchen',
    });
    expect(floorDemo.quantity).toBe(180);
    expect(floorDemo.unit).toBe('sqft');
    expect(floorDemo.pricingReady).toBe(true);
  });

  test('addition concrete defaults to CY and preserves entered measurement unit', () => {
    const empty = resolveQuantityForChecklistItem('concrete', {
      measurements: normalizeScopeMeasurements({}),
      templateKey: 'addition',
    });
    expect(empty.unit).toBe('cy');
    expect(empty.pricingReady).toBe(false);

    const cy = resolveQuantityForChecklistItem('concrete', {
      measurements: normalizeScopeMeasurements({ concreteCy: 18 }),
      templateKey: 'addition',
    });
    expect(cy.quantity).toBe(18);
    expect(cy.unit).toBe('cy');
    expect(cy.pricingReady).toBe(true);

    const staleCardEntry = resolveQuantityForChecklistItem('concrete', {
      measurements: normalizeScopeMeasurements({
        itemQuantities: {
          concrete: { quantity: 250, unit: 'sqft', quantitySource: 'user_entered' },
        },
      }),
      templateKey: 'addition',
    });
    expect(staleCardEntry.quantity).toBe(250);
    expect(staleCardEntry.unit).toBe('cy');

    const sqft = resolveQuantityForChecklistItem('concrete', {
      measurements: normalizeScopeMeasurements({ concreteSqft: 500 }),
      templateKey: 'addition',
    });
    expect(sqft.quantity).toBe(500);
    expect(sqft.unit).toBe('sqft');
    expect(sqft.pricingReady).toBe(true);
  });

  test('ground_up shell items use living floorAreaSqft from plan takeoff', () => {
    const measurements = normalizeScopeMeasurements({ floorAreaSqft: 1879, flooringSqft: 1879 });
    const ctx = { measurements, templateKey: 'ground_up' };

    for (const id of ['foundation', 'framing', 'sitework', 'mep_rough', 'exterior', 'insulation']) {
      const q = resolveQuantityForChecklistItem(id, ctx);
      expect(q.quantity).toBe(1879);
      expect(q.unit).toBe('sqft');
      expect(q.pricingReady).toBe(true);
    }

    const flooring = resolveQuantityForChecklistItem('tile_flooring', ctx);
    expect(flooring.quantity).toBe(1879);
    expect(flooring.pricingReady).toBe(true);

    const paint = resolveQuantityForChecklistItem('paint_trim', ctx);
    expect(paint.quantity).toBe(1879);
    expect(paint.pricingReady).toBe(true);

    const drywall = resolveQuantityForChecklistItem('drywall', ctx);
    expect(drywall.quantity).toBe(1879);
    expect(drywall.pricingReady).toBe(true);
    expect(String(drywall.missingMessage || drywall.rule?.quantityHelper || '')).not.toMatch(/repair/i);
  });

  test('addition framing also uses floorAreaSqft when present', () => {
    const q = resolveQuantityForChecklistItem('framing', {
      measurements: normalizeScopeMeasurements({ floorAreaSqft: 240 }),
      templateKey: 'addition',
    });
    expect(q.quantity).toBe(240);
    expect(q.pricingReady).toBe(true);
  });

  test('shower floor tile uses shower floor sqft not bathroom floor', () => {
    const measurements = normalizeScopeMeasurements({
      bathroomFloorSqft: 50,
      showerFloorTileSqft: 25,
    });
    const floor = resolveQuantityForChecklistItem('shower_floor_tile', { measurements });
    expect(floor.quantity).toBe(25);
    expect(floor.pricingReady).toBe(true);

    const prefabPan = resolveQuantityForChecklistItem('prefab_shower_pan', { measurements });
    expect(prefabPan.quantity).toBe(1);
    expect(prefabPan.unit).toBe('each');

    const tilePan = resolveQuantityForChecklistItem('shower_pan', { measurements });
    expect(tilePan.quantity).toBe(1);
    expect(tilePan.pricingReady).toBe(true);

    const wetTub = resolveQuantityForChecklistItem('wet_area_install', {
      measurements,
      choiceId: 'tub',
    });
    expect(wetTub.pricingReady).toBe(false);

    const wetTilePan = resolveQuantityForChecklistItem('wet_area_install', {
      measurements,
      choiceId: 'tile_pan',
    });
    expect(wetTilePan.pricingReady).toBe(false);

    const tubDemo = resolveQuantityForChecklistItem('tub_demo', { measurements });
    expect(tubDemo.quantity).toBe(1);

    const tubInstall = resolveQuantityForChecklistItem('tub_install', { measurements });
    expect(tubInstall.quantity).toBe(1);
    expect(tubInstall.unit).toBe('each');

    const prefabInstall = resolveQuantityForChecklistItem('prefab_shower_pan', { measurements });
    expect(prefabInstall.quantity).toBe(1);

    const showerFloorDemo = resolveQuantityForChecklistItem('shower_floor_demo', {
      measurements,
    });
    expect(showerFloorDemo.quantity).toBe(25);
  });

  test('kitchen backsplash and paint resolve rate pricing from notes', () => {
    const notes = [
      'Kitchen remodel for Martinez - 30339',
      'Backsplash tile 45 sqft - material $8/sqft, labor $12/sqft',
      'Paint walls/ceiling 320 sqft - $1.50/sqft labor',
    ].join('\n');

    const measurements = normalizeScopeMeasurements({
      backsplashSqft: 45,
      wallPaintSqft: 320,
    });

    const backsplash = resolveQuantityForChecklistItem('backsplash', {
      templateKey: 'kitchen',
      notes,
      measurements,
    });
    expect(backsplash.dualAllowance).toMatchObject({ quantity: 900 });
    expect(backsplash.dualMaterial).toMatchObject({ quantity: 360 });
    expect(backsplash.dualLabor).toMatchObject({ quantity: 540 });

    const paint = resolveQuantityForChecklistItem('paint', {
      templateKey: 'kitchen',
      notes,
      measurements,
    });
    expect(paint.dualAllowance).toMatchObject({ quantity: 480 });
    expect(paint.dualLabor).toMatchObject({ quantity: 480 });
  });

  test('paint allowance stored as unit rate upgrades when sqft lives on itemQuantities', () => {
    const notes = 'Paint walls/ceiling 320 sqft - $1.50/sqft labor';
    const measurements = normalizeScopeMeasurements({
      itemQuantities: {
        paint: { quantity: 320, unit: 'sqft', quantitySource: 'notes' },
        paint__allowance: { quantity: 1.5, unit: 'allowance', quantitySource: 'user_entered' },
      },
    });

    const paint = resolveQuantityForChecklistItem('paint', {
      templateKey: 'kitchen',
      notes,
      measurements,
    });
    expect(paint.dualAllowance).toMatchObject({ quantity: 480 });
  });

  test('backsplash rate pricing uses backsplashSqft measurement when itemQuantities empty', () => {
    const notes = 'Backsplash tile 45 sqft - material $8/sqft, labor $12/sqft';
    const measurements = normalizeScopeMeasurements({
      backsplashSqft: 45,
    });

    const backsplash = resolveQuantityForChecklistItem('backsplash', {
      templateKey: 'kitchen',
      notes,
      measurements,
    });
    expect(backsplash.dualAllowance).toMatchObject({ quantity: 900 });
    expect(backsplash.dualMaterial).toMatchObject({ quantity: 360 });
    expect(backsplash.dualLabor).toMatchObject({ quantity: 540 });
  });

  test('backsplash pricing resolves from persisted rate subkeys without notes', () => {
    const measurements = normalizeScopeMeasurements({
      backsplashSqft: 45,
      itemQuantities: {
        backsplash__material: { quantity: 360, unit: 'allowance', quantitySource: 'notes' },
        backsplash__labor: { quantity: 540, unit: 'allowance', quantitySource: 'notes' },
        backsplash__allowance: { quantity: 900, unit: 'allowance', quantitySource: 'notes' },
      },
    });

    const backsplash = resolveQuantityForChecklistItem('backsplash', {
      templateKey: 'kitchen',
      notes: '',
      measurements,
    });
    expect(backsplash.dualAllowance).toMatchObject({ quantity: 900 });
  });
});
