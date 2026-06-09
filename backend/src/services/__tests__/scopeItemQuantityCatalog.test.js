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

  test('stampPackageWithCatalogRules applies lf to baseboard only', () => {
    const pkg = { name: 'Baseboard Installation', scope: 'Install baseboard', scopeQuantities: [] };
    const ctx = { measurements: normalizeScopeMeasurements({ sqft: 90, lf: 24 }) };
    const next = stampPackageWithCatalogRules(pkg, ctx);
    expect(next.scopeQuantities[0]).toMatchObject({ quantity: 24, unit: 'lf' });
  });

  test('resolveQuantityForPackage gives cleanup lump sum default', () => {
    const ctx = { measurements: normalizeScopeMeasurements({ sqft: 90 }) };
    const q = resolveQuantityForPackage('Jobsite Cleanup & Disposal', 'Final clean', ctx);
    expect(q.quantity).toBe(1);
    expect(q.unit).toBe('lump_sum');
    expect(q.pricingReady).toBe(true);
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
});
