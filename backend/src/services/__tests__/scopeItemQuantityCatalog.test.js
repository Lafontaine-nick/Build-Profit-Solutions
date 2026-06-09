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
});
