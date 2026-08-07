import {
  buildFloorPrepPricingContext,
  demoWorkCodesForType,
  evaluateFlooringDemoPrepOverlap,
  prepWorkCodesForLevel,
  recommendFloorPrepSeverity,
  resolveFloorPrepByProduct,
} from '@/utils/flooringDemoPrepBoundary';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  resolveScopeItemSuggestedPricing,
  type ScopeMeasurementsInputExtended,
} from '@/utils/scopeItemQuantities';

function inputWith(
  fields: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    itemQuantities: {},
    ...fields,
  } as ScopeMeasurementsInputExtended;
}

const mixedCarpetTilePrep = {
  flooringExistingTypes: ['carpet', 'tile'] as const,
  flooringProductScope: ['carpet', 'tile'] as const,
  flooringCarpetSqft: '500',
  flooringTileSqft: '1200',
  floorPrepByProduct: {
    carpet: { sqft: 500, severity: 'light' as const },
    tile: { sqft: 1200, severity: 'heavy' as const },
  },
  itemQuantities: {
    floor_demo__carpet: { quantity: 500, unit: 'sqft', quantitySource: 'user_entered' },
    floor_demo__tile: { quantity: 1200, unit: 'sqft', quantitySource: 'user_entered' },
  },
};

describe('floor prep by product', () => {
  it('does not give carpet the worst recommendation from another existing floor', () => {
    const input = inputWith({
      flooringExistingTypes: ['carpet', 'tile'],
      flooringProductScope: ['carpet', 'tile'],
      flooringNewLvpInstallMethod: null,
    });
    expect(recommendFloorPrepSeverity('carpet', input)).toBe('light');
    expect(recommendFloorPrepSeverity('tile', input)).toBe('heavy');
  });

  it('prices the mixed carpet + tile scenario at $3,975 with $2.34/SF blended', () => {
    const result = buildFloorPrepPricingContext(inputWith(mixedCarpetTilePrep));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalPrepArea).toBe(1700);
    expect(result.totalMaterial + result.totalLabor).toBe(3975);
    expect(result.pricingDetail).toMatch(/\$2\.34\/SF blended/);
    expect(result.pricingDetail).toMatch(/500 SF Carpet prep @ \$0\.75\/SF = \$375/);
    expect(result.pricingDetail).toMatch(/1,200 SF Tile prep @ \$3\.00\/SF = \$3,600/);
  });

  it('does not price the entire job at the highest severity', () => {
    const result = buildFloorPrepPricingContext(inputWith(mixedCarpetTilePrep));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalMaterial + result.totalLabor).not.toBe(1700 * 3);
  });

  it('prices a single product with explicit prep area and severity', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        flooringProductScope: ['lvp'],
        flooringLvpSqft: '400',
        floorPrepByProduct: {
          lvp: { sqft: 400, severity: 'light' },
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalMaterial + result.totalLabor).toBe(400 * 0.75);
  });

  it('applies the severity minimum once for a small prep area', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        flooringProductScope: ['lvp'],
        floorPrepByProduct: {
          lvp: { sqft: 100, severity: 'light' },
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalMaterial + result.totalLabor).toBe(250);
  });

  it('forces $0 when severity is not needed', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        flooringProductScope: ['carpet'],
        flooringCarpetSqft: '500',
        floorPrepByProduct: {
          carpet: { sqft: null, severity: 'none' },
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalMaterial + result.totalLabor).toBe(0);
    expect(result.totalPrepArea).toBe(0);
  });

  it('flags extensive prep for review before bid', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        flooringProductScope: ['tile'],
        flooringTileSqft: '800',
        floorPrepByProduct: {
          tile: { sqft: 800, severity: 'extensive' },
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hasReview).toBe(true);
    expect(result.sourceLabel).toMatch(/Review before bid/i);
    expect(result.totalMaterial + result.totalLabor).toBe(800 * 4.5);
  });

  it('requires prep area when severity is not none', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        flooringProductScope: ['tile'],
        floorPrepByProduct: {
          tile: { sqft: null, severity: 'heavy' },
        },
      })
    );
    expect(result.ok).toBe(false);
  });

  it('warns when prep area exceeds installation area', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        flooringProductScope: ['carpet'],
        flooringCarpetSqft: '400',
        floorPrepByProduct: {
          carpet: { sqft: 500, severity: 'light' },
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hasReview).toBe(true);
    expect(result.pricingDetail).toMatch(/exceeds that product/i);
  });

  it('reconciles material and labor to the displayed prep total', () => {
    const result = buildFloorPrepPricingContext(inputWith(mixedCarpetTilePrep));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalMaterial + result.totalLabor).toBeCloseTo(3975, 2);
  });

  it('keeps demolition and prep work codes separate', () => {
    const demoCodes = demoWorkCodesForType('tile');
    const prepCodes = prepWorkCodesForLevel(3);
    expect(demoCodes).toContain('REMOVE_BULK_THINSET');
    expect(demoCodes).not.toContain('FINAL_GRINDING');
    expect(prepCodes).toContain('FINAL_GRINDING');
    expect(prepCodes).not.toContain('REMOVE_BULK_THINSET');
    const overlap = evaluateFlooringDemoPrepOverlap(
      inputWith({
        ...mixedCarpetTilePrep,
        flooringDemoIncludesSubstratePrep: 'no',
      })
    );
    expect(overlap.hasOverlap).toBe(false);
  });

  it('migrates legacy floorPrepTransitions into per-product prep', () => {
    const migrated = resolveFloorPrepByProduct(
      inputWith({
        flooringProductScope: ['carpet', 'tile'],
        floorPrepTransitions: [
          { existingType: 'carpet', newProduct: 'carpet', sqft: 500 },
          { existingType: 'tile', newProduct: 'tile', sqft: 1200 },
        ],
      })
    );
    expect(migrated.carpet?.sqft).toBe(500);
    expect(migrated.tile?.sqft).toBe(1200);
    const result = buildFloorPrepPricingContext(
      inputWith({
        flooringProductScope: ['carpet', 'tile'],
        flooringCarpetSqft: '500',
        flooringTileSqft: '1200',
        floorPrepTransitions: [
          { existingType: 'carpet', newProduct: 'carpet', sqft: 500 },
          { existingType: 'tile', newProduct: 'tile', sqft: 1200 },
        ],
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalMaterial + result.totalLabor).toBe(3975);
  });

  it('supports legacy single-product floorPrepSqft fallback', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        floorPrepSqft: '400',
        flooringExistingTypes: ['carpet'],
        flooringProductScope: ['lvp'],
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalPrepArea).toBe(400);
    expect(result.totalMaterial + result.totalLabor).toBe(400 * 0.75);
  });

  it('does not auto-price from notes quantity without per-product confirmation', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        flooringExistingTypes: ['carpet', 'tile'],
        flooringProductScope: ['carpet', 'tile'],
        flooringCarpetSqft: '500',
        flooringTileSqft: '1200',
        itemQuantities: {
          floor_prep: { quantity: 1700, unit: 'sqft', quantitySource: 'notes' },
        },
      }),
      { pricingCount: 1700, quantitySource: 'notes' }
    );
    expect(result.ok).toBe(false);
  });

  it('resolves scope pricing for the mixed-product scenario', () => {
    const { fill } = resolveScopeItemSuggestedPricing('floor_prep', inputWith(mixedCarpetTilePrep), 'flooring', {
      quantity: 1700,
      unit: 'sqft',
      quantitySource: 'user_entered',
    });
    expect(fill?.total).toBe(3975);
    expect(fill?.material + fill!.labor).toBeCloseTo(3975, 2);
  });
});
