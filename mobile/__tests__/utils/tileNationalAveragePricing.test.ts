import {
  buildAcceptanceFromSuggestedBlock,
  currentScopePricingTotal,
  hasAcceptedScopePricing,
} from '@/utils/acceptedPricingSummaryUi';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  canonicalTileScopeKey,
  getNationalAverageBudgetSplit,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  TILE_NATIONAL_AVERAGE_ALIASES,
} from '@/utils/scopeItemQuantities';

describe('tile national-average subtype pricing', () => {
  const input = {
    ...emptyQuickMeasurementInput(),
    floorAreaSqft: '1879',
    bathroomFloorSqft: '95',
    showerWallTileSqft: '160',
    showerFloorTileSqft: '40',
    backsplashSqft: '35',
    itemQuantities: {},
  } as any;

  it('maps existing checklist ids to distinct canonical tile keys', () => {
    expect(canonicalTileScopeKey('floor_tile')).toBe('bath_floor_tile');
    expect(canonicalTileScopeKey('tile_floor')).toBe('floor_tile_standard');
    expect(canonicalTileScopeKey('wall_tile')).toBe('wall_tile_dry_area');
    expect(canonicalTileScopeKey('backsplash')).toBe('backsplash_tile');
    expect(canonicalTileScopeKey('shower_tile')).toBe('shower_wall_tile');
    expect(canonicalTileScopeKey('shower_floor')).toBe('shower_floor_tile');
    expect(canonicalTileScopeKey('shower_floor_tile')).toBe('shower_floor_tile');
    expect(TILE_NATIONAL_AVERAGE_ALIASES.shower_tile).not.toBe('floor_tile_standard');
  });

  it('uses distinct material/labor rates per tile subtype', () => {
    expect(getNationalAverageBudgetSplit('floor_tile_standard', 'sqft')).toMatchObject({
      material: 8,
      labor: 11,
    });
    expect(getNationalAverageBudgetSplit('floor_tile', 'sqft')).toMatchObject({
      material: 8,
      labor: 13,
    });
    expect(getNationalAverageBudgetSplit('wall_tile_dry_area', 'sqft')).toMatchObject({
      material: 8,
      labor: 15,
    });
    expect(getNationalAverageBudgetSplit('backsplash', 'sqft')).toMatchObject({
      material: 8,
      labor: 17,
    });
    expect(getNationalAverageBudgetSplit('shower_tile', 'sqft')).toMatchObject({
      material: 8,
      labor: 18,
    });
    expect(getNationalAverageBudgetSplit('shower_floor_tile', 'sqft')).toMatchObject({
      material: 8,
      labor: 17,
    });
  });

  it('prices shower wall tile at $8 material + $18 labor ($26/SF)', () => {
    const resolved = resolveChecklistItemQuantity('shower_tile', input, { templateKey: 'ground_up' });
    expect(Number(resolved.quantity)).toBe(160);
    const pricing = resolveScopeItemSuggestedPricing('shower_tile', input, 'ground_up', resolved);
    expect(pricing.fill).toMatchObject({
      material: 1280,
      labor: 2880,
      total: 4160,
    });
    expect(Number(pricing.fill?.basis?.quantity)).toBe(160);
    expect(pricing.fill?.basis?.unit).toBe('sqft');
    expect(pricing.fill?.rateSourceLabel).toMatch(/National Average/i);
    expect(pricing.fill?.rateSourceLabel).toMatch(/shower wall/i);
    // Must not inherit generic floor-tile $14 labor (160 × 14 = 2240).
    expect(pricing.fill?.labor).not.toBe(2240);
    expect(pricing.fill?.total).not.toBe(3520);
  });

  it('prices shower floor tile at $8 material + $17 labor ($25/SF)', () => {
    const resolved = resolveChecklistItemQuantity('shower_floor_tile', input, {
      templateKey: 'ground_up',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'shower_floor_tile',
      input,
      'ground_up',
      resolved
    );
    // Fixture shower floor SF is 40 → 40 × $25 = $1,000.
    expect(pricing.fill).toMatchObject({ material: 320, labor: 680, total: 1000 });
  });

  it('prices standard floor tile and dry wall tile at their own labor bands', () => {
    expect(getNationalAverageBudgetSplit('floor_tile_standard')!.labor).toBe(11);
    expect(getNationalAverageBudgetSplit('wall_tile_dry_area')!.labor).toBe(15);
    expect(getNationalAverageBudgetSplit('floor_tile_standard')!.labor).not.toBe(
      getNationalAverageBudgetSplit('shower_tile')!.labor
    );
  });

  it('preserves user-entered shower wall quantity (does not replace with living SF)', () => {
    const withUserQty = {
      ...input,
      itemQuantities: {
        shower_tile: {
          quantity: '160',
          unit: 'sqft',
          quantitySource: 'user_entered' as const,
        },
      },
    };
    const resolved = resolveChecklistItemQuantity('shower_tile', withUserQty, {
      templateKey: 'ground_up',
    });
    expect(Number(resolved.quantity)).toBe(160);
    expect(resolved.quantitySource).toBe('user_entered');
    const pricing = resolveScopeItemSuggestedPricing(
      'shower_tile',
      withUserQty,
      'ground_up',
      resolved
    );
    expect(Number(pricing.fill?.basis?.quantity)).toBe(160);
    expect(pricing.fill?.basis?.unit).toBe('sqft');
    expect(pricing.fill?.total).toBe(4160);
  });

  it('excludes waterproofing from the shower-wall benchmark profile', () => {
    const resolved = resolveChecklistItemQuantity('shower_tile', input, { templateKey: 'ground_up' });
    const pricing = resolveScopeItemSuggestedPricing('shower_tile', input, 'ground_up', resolved);
    const waterproofing = pricing.fill?.benchmarkScopeProfile?.scopeAssumptions?.find(
      (a) => a.scopeKey === 'waterproofing'
    );
    expect(waterproofing?.status).toBe('excluded');
    expect(waterproofing?.notes).toMatch(/not included/i);
  });

  it('does not retroactively change accepted shower wall pricing when rates update', () => {
    const acceptedBlock = buildAcceptanceFromSuggestedBlock({
      material: 1280,
      labor: 2240,
      total: 3520,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'Suggested · National Average · shower wall tile',
      helper: 'Prior accepted price',
      mode: 'suggested_price',
      lumpSumOnly: false,
      basis: { quantity: 160, unit: 'sqft' },
    });
    const itemQuantities = {
      shower_tile__material: {
        quantity: '1280',
        unit: 'allowance',
        quantitySource: 'user_entered' as const,
      },
      shower_tile__labor: {
        quantity: '2240',
        unit: 'allowance',
        quantitySource: 'user_entered' as const,
      },
    };
    const pricingAcceptance = { shower_tile: acceptedBlock };
    expect(hasAcceptedScopePricing('shower_tile', itemQuantities, pricingAcceptance)).toBe(true);
    // Accepted total stays at the previously applied amount.
    expect(currentScopePricingTotal('shower_tile', itemQuantities, pricingAcceptance)).toBe(3520);

    // New suggestion is higher, but does not overwrite acceptance until reapply.
    const resolved = resolveChecklistItemQuantity('shower_tile', input, { templateKey: 'ground_up' });
    const suggested = resolveScopeItemSuggestedPricing('shower_tile', input, 'ground_up', resolved);
    expect(suggested.fill?.total).toBe(4160);
    expect(pricingAcceptance.shower_tile.totalAmount).toBe(3520);
  });

  it('keeps shower floor mid-market and above bath floor (pan/waterproofing separate)', () => {
    const wall = getNationalAverageBudgetSplit('shower_tile', 'sqft')!;
    const floor = getNationalAverageBudgetSplit('shower_floor_tile', 'sqft')!;
    const bathFloor = getNationalAverageBudgetSplit('floor_tile', 'sqft')!;
    expect(wall.labor + wall.material).toBe(26);
    expect(floor.labor + floor.material).toBe(25);
    // Tile-only on a prepared pan — above bath floor, near shower wall.
    expect(floor.labor + floor.material).toBeGreaterThan(bathFloor.labor + bathFloor.material);
    expect(floor.labor + floor.material).toBeLessThan(wall.labor + wall.material + 0.01);
  });
});
