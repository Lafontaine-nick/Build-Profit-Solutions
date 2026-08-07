import {
  buildFloorPrepPricingContext,
  demoCatalogAssumptionNote,
  evaluateFlooringDemoPrepOverlap,
  prepWorkCodesForLevel,
} from '@/utils/flooringDemoPrepBoundary';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import type { ScopeMeasurementsInputExtended } from '@/utils/scopeItemQuantities';

function inputWith(
  overrides: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    itemQuantities: {},
    ...overrides,
  } as ScopeMeasurementsInputExtended;
}

describe('flooringDemoPrepBoundary', () => {
  it('requires explicit per-product prep area and severity', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        flooringExistingTypes: ['tile'],
        flooringProductScope: ['tile'],
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.pricingDetail).toMatch(/prep area and severity/i);
    }
  });

  it('prices per-product prep from floorPrepByProduct', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        flooringExistingTypes: ['carpet', 'tile'],
        flooringProductScope: ['carpet', 'tile'],
        flooringCarpetSqft: '500',
        flooringTileSqft: '1200',
        floorPrepByProduct: {
          carpet: { sqft: 500, severity: 'light' },
          tile: { sqft: 1200, severity: 'heavy' },
        },
        itemQuantities: {
          floor_demo__carpet: { quantity: 500, unit: 'sqft', quantitySource: 'user_entered' },
          floor_demo__tile: { quantity: 1200, unit: 'sqft', quantitySource: 'user_entered' },
        },
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.totalPrepArea).toBe(1700);
      expect(result.totalMaterial + result.totalLabor).toBe(500 * 0.75 + 1200 * 3);
    }
  });

  it('prices assigned prep transitions migrated from legacy rows', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        flooringExistingTypes: ['carpet', 'tile'],
        flooringProductScope: ['carpet', 'tile'],
        floorPrepTransitions: [
          { existingType: 'carpet', newProduct: 'carpet', sqft: 500 },
          { existingType: 'tile', newProduct: 'tile', sqft: 1200 },
        ],
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.totalPrepArea).toBe(1700);
      expect(result.totalMaterial + result.totalLabor).toBe(500 * 0.75 + 1200 * 3);
    }
  });

  it('ignores stale transition rows from previously selected flooring products', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        floorPrepSqft: '1700',
        flooringExistingTypes: ['solid_hardwood'],
        flooringProductScope: ['lvp'],
        flooringLvpSqft: '1700',
        flooringNewLvpInstallMethod: 'floating',
        floorPrepTransitions: [
          { existingType: 'carpet', newProduct: 'carpet', sqft: 500 },
          { existingType: 'tile', newProduct: 'tile', sqft: 1200 },
        ],
        itemQuantities: {
          floor_demo__solid_hardwood: {
            quantity: 1700,
            unit: 'sqft',
            quantitySource: 'user_entered',
          },
        },
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.totalPrepArea).toBe(1700);
      expect(result.totalMaterial + result.totalLabor).toBe(1700 * 1.5);
    }
  });

  it('does not auto-distribute notes prep SF across inferred transitions', () => {
    const result = buildFloorPrepPricingContext(
      inputWith({
        flooringExistingTypes: ['carpet', 'tile'],
        flooringProductScope: ['carpet', 'tile'],
      }),
      { pricingCount: 1700, quantitySource: 'notes' }
    );
    expect(result.ok).toBe(false);
  });

  it('documents tile demolition catalog assumptions separately from prep work', () => {
    expect(demoCatalogAssumptionNote('tile')).toMatch(/bulk thinset removal/i);
    expect(demoCatalogAssumptionNote('tile')).toMatch(/ordinary substrate cleaning/i);
    expect(demoCatalogAssumptionNote('tile')).toMatch(/Excludes residual grinding/i);
    expect(prepWorkCodesForLevel(3)).toContain('FINAL_GRINDING');
  });

  it('blocks overlap when demolition substrate prep disclosure is unsure', () => {
    const overlap = evaluateFlooringDemoPrepOverlap(
      inputWith({
        flooringDemoIncludesSubstratePrep: 'unsure',
        floorPrepSqft: '400',
      })
    );
    expect(overlap.blockAutoApply).toBe(true);
    expect(overlap.message).toMatch(/duplicate scope/i);
  });
});
