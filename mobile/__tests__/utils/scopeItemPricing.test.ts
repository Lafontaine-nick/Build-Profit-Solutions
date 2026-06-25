import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  buildNormalizedScopeMeasurementsFromInput,
  isPlaceholderAllowancePricing,
  resolveAllowanceEditorPricingBasis,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
  resolveTemplateRateForItem,
  resolveDualRatePricingDisplayFromNotes,
  type ScopeMeasurementsInputExtended,
  type ScopePricingContext,
} from '@/utils/scopeItemQuantities';

function inputWith(
  fields: Partial<ScopeMeasurementsInputExtended>
): ScopeMeasurementsInputExtended {
  return {
    ...emptyQuickMeasurementInput(),
    ...fields,
    itemQuantities: fields.itemQuantities ?? {},
  } as ScopeMeasurementsInputExtended;
}

// National-average flooring rate: material $4/sqft, labor $5/sqft.
describe('resolveScopeItemSuggestedPricing', () => {
  it('splits a lump-sum total into material + labor using the national ratio', () => {
    const input = inputWith({ floorAreaSqft: '1000' });
    const resolved = {
      quantity: 5000,
      unit: 'allowance',
      quantitySource: 'notes' as const,
      dualAllowance: { quantity: 5000, unit: 'allowance' },
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved);
    expect(comparison).toBeNull();
    expect(fill).toMatchObject({ mode: 'note_total_split', material: 4000, labor: 1000, total: 5000 });
    expect(fill?.materialSource).toBe('national_average');
  });

  it('shows saved flooring rates as a comparison instead of splitting a note total into saved material plus remainder', () => {
    const input = inputWith({ floorAreaSqft: '850' });
    const resolved = {
      quantity: 3825,
      unit: 'allowance',
      quantitySource: 'notes' as const,
      dualAllowance: { quantity: 3825, unit: 'allowance' },
    };
    const pricingContext: ScopePricingContext = {
      templates: [
        {
          name: 'LVP Floors',
          materialLineItems: [{ name: 'LVP plank flooring', unit: 'sqft', unitPrice: 3 }],
          laborLineItems: [{ name: 'LVP install labor', unit: 'sqft', unitPrice: 4 }],
        },
      ],
    };

    const { fill, comparison } = resolveScopeItemSuggestedPricing(
      'flooring',
      input,
      'flooring',
      resolved,
      pricingContext
    );

    expect(fill).toBeNull();
    expect(comparison).toMatchObject({
      material: 2550,
      labor: 3400,
      total: 5950,
      materialSource: 'template',
      laborSource: 'template',
      isComparison: true,
    });
  });

  it('fills the missing labor leg when notes priced only material', () => {
    const input = inputWith({ floorAreaSqft: '1000' });
    const resolved = {
      quantity: 1000,
      unit: 'sqft',
      quantitySource: 'notes' as const,
      dualMaterial: { quantity: 4000, unit: 'allowance' },
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved);
    expect(comparison).toBeNull();
    expect(fill).toMatchObject({ mode: 'fill_missing', material: 4000, labor: 5000 });
    expect(fill?.materialSource).toBe('notes');
    expect(fill?.laborSource).toBe('national_average');
  });

  it('fills the missing material leg when notes priced only labor', () => {
    const input = inputWith({ floorAreaSqft: '1000' });
    const resolved = {
      quantity: 1000,
      unit: 'sqft',
      quantitySource: 'notes' as const,
      dualLabor: { quantity: 3000, unit: 'allowance' },
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved);
    expect(comparison).toBeNull();
    expect(fill).toMatchObject({ mode: 'fill_missing', material: 4000, labor: 3000 });
    expect(fill?.materialSource).toBe('national_average');
    expect(fill?.laborSource).toBe('notes');
  });

  it('splits flooring demo lump totals into material + labor budget tracking', () => {
    const input = inputWith({ floorAreaSqft: '850' });
    const resolved = {
      quantity: 2550,
      unit: 'allowance',
      quantitySource: 'notes' as const,
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing('floor_demo', input, 'flooring', resolved);
    expect(comparison).toBeNull();
    expect(fill).toMatchObject({
      mode: 'note_total_split',
      material: 425,
      labor: 2125,
      total: 2550,
      materialSource: 'national_average',
    });
  });

  it('shows only a comparison when notes priced both legs', () => {
    const input = inputWith({ floorAreaSqft: '850' });
    const resolved = {
      quantity: 850,
      unit: 'sqft',
      quantitySource: 'notes' as const,
      dualMaterial: { quantity: 4500, unit: 'allowance' },
      dualLabor: { quantity: 3250, unit: 'allowance' },
    };
    const { fill, comparison } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved);
    expect(fill).toBeNull();
    expect(comparison).toMatchObject({
      material: 3400,
      labor: 4250,
      total: 7650,
      isComparison: true,
    });
  });

  it('prefers a saved template rate over the national average for quantity-only items', () => {
    const input = inputWith({ floorAreaSqft: '1000' });
    const resolved = { quantity: 1000, unit: 'sqft', quantitySource: 'inferred' as const };
    const pricingContext: ScopePricingContext = {
      templates: [
        {
          name: 'LVP Floors',
          materialLineItems: [{ name: 'LVP plank flooring', unit: 'sqft', unitPrice: 6 }],
          laborLineItems: [{ name: 'LVP install labor', unit: 'sqft', unitPrice: 4 }],
        },
      ],
    };
    const { fill } = resolveScopeItemSuggestedPricing('flooring', input, 'flooring', resolved, pricingContext);
    expect(fill).toMatchObject({ material: 6000, labor: 4000, mode: 'suggested_price' });
    expect(fill?.materialSource).toBe('template');
    expect(fill?.laborSource).toBe('template');
    expect(fill?.rateSourceLabel).toContain('Saved rate');
  });

  it('uses CY national average rates when concrete is measured in cubic yards', () => {
    const input = inputWith({ concreteCy: '18' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('concrete', measurements, { templateKey: 'addition' });

    expect(resolved.unit).toBe('cy');

    const { fill } = resolveScopeItemSuggestedPricing('concrete', input, 'addition', resolved);
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      material: 2970,
      labor: 3330,
      total: 6300,
      basis: { quantity: 18, unit: 'cy' },
    });
  });

  it('defaults addition concrete pricing basis to CY before a measurement is entered', () => {
    const input = inputWith({});
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('concrete', measurements, { templateKey: 'addition' });

    expect(resolved.unit).toBe('cy');
    expect(resolved.pricingReady).toBe(false);
  });

  it('migrates stale addition concrete card entries from sqft to CY', () => {
    const input = inputWith({});
    input.itemQuantities = {
      concrete: { quantity: '250', unit: 'sqft', quantitySource: 'user_entered' },
    };
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('concrete', measurements, { templateKey: 'addition' });

    expect(resolved.quantity).toBe(250);
    expect(resolved.unit).toBe('cy');
  });

  it('suggests rough plumbing pricing from rough-in points', () => {
    const input = inputWith({});
    input.itemQuantities = {
      plumbing_rough: { quantity: '3', unit: 'each', quantitySource: 'user_entered' },
    };
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('plumbing_rough', measurements, { templateKey: 'addition' });

    const { fill } = resolveScopeItemSuggestedPricing('plumbing_rough', input, 'addition', resolved);
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      material: 450,
      labor: 1050,
      total: 1500,
      basis: { quantity: 3, unit: 'each' },
    });
  });

  it('suggests electrical rough-in pricing from device counts', () => {
    const input = inputWith({});
    input.itemQuantities = {
      electrical_rough: { quantity: '4', unit: 'each', quantitySource: 'user_entered' },
    };
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('electrical_rough', measurements, { templateKey: 'addition' });

    const { fill } = resolveScopeItemSuggestedPricing('electrical_rough', input, 'addition', resolved);
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      material: 140,
      labor: 360,
      total: 500,
      basis: { quantity: 4, unit: 'each' },
    });
  });

  it('treats stale permit placeholder $1 as missing pricing', () => {
    const input = inputWith({});
    input.itemQuantities = {
      permits: { quantity: '1', unit: 'allowance', quantitySource: 'user_entered' },
    };
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('permits', measurements, { templateKey: 'addition' });

    expect(resolved.pricingReady).toBe(false);
    expect(resolved.quantity).toBeNull();
    expect(isPlaceholderAllowancePricing(1, 'allowance', 'permits')).toBe(true);
  });

  it('suggests flat permit allowance pricing for ADU scope', () => {
    const input = inputWith({});
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('permits', measurements, { templateKey: 'addition' });

    const { fill } = resolveScopeItemSuggestedPricing('permits', input, 'addition', resolved);
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      lumpSumOnly: true,
      material: 0,
      labor: 3500,
      total: 3500,
    });
  });

  it('suggests cleanup as a flat allowance, not a material/labor lump-sum split', () => {
    const input = inputWith({});
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('cleanup', measurements, { templateKey: 'addition' });

    const { fill } = resolveScopeItemSuggestedPricing('cleanup', input, 'addition', resolved);
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      lumpSumOnly: true,
      material: 0,
      labor: 1000,
      total: 1000,
    });
  });

  it('hides flat allowance suggestions after the user enters an allowance', () => {
    const input = inputWith({});
    input.itemQuantities = {
      cleanup__allowance: {
        quantity: '1000',
        unit: 'allowance',
        quantitySource: 'user_entered',
      },
    };
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('cleanup', measurements, { templateKey: 'addition' });

    const { fill, comparison } = resolveScopeItemSuggestedPricing('cleanup', input, 'addition', resolved);
    expect(fill).toBeNull();
    expect(comparison).toBeNull();
  });

  it('shows pricing entry for addition items without explicit quantity rules', () => {
    const input = inputWith({});
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('framing', measurements, { templateKey: 'addition' });

    expect(resolved).toMatchObject({
      pricingReady: false,
      showInput: true,
      missingMessage: 'Enter framing sqft or pricing.',
    });
  });

  it('marks allowance split items priced when lump sum subkey is entered', () => {
    const input = inputWith({
      itemQuantities: {
        permits__allowance: {
          quantity: '3500',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('permits', measurements, { templateKey: 'addition' });

    expect(resolved).toMatchObject({
      pricingReady: true,
      quantity: 3500,
      unit: 'allowance',
    });
  });

  it('marks default-rule allowance split items priced when lump sum subkey is entered', () => {
    const input = inputWith({
      itemQuantities: {
        plans_engineering__allowance: {
          quantity: '8500',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('plans_engineering', measurements, {
      templateKey: 'addition',
    });

    expect(resolved).toMatchObject({
      pricingReady: true,
      quantity: 8500,
      unit: 'allowance',
    });
  });

  it('treats plans/engineering as a flat allowance line without sqft pricing basis', () => {
    const input = inputWith({ floorAreaSqft: '500' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('plans_engineering', measurements, {
      templateKey: 'addition',
    });

    expect(resolved).toMatchObject({
      pricingReady: false,
      unit: 'allowance',
    });
    expect(resolveAllowanceEditorPricingBasis('plans_engineering', input, 'addition')).toBeNull();
    expect(resolveScopeItemSuggestedPricing('plans_engineering', input, 'addition', resolved)).toEqual({
      fill: null,
      comparison: null,
    });
  });

  it('treats trim-out, cabinets, and final inspections as flat allowance lines', () => {
    const input = inputWith({ floorAreaSqft: '600' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const flatAllowanceItems = [
      'plumbing_trim',
      'electrical_trim',
      'cabinets_counters',
      'final_inspections',
    ] as const;

    for (const itemId of flatAllowanceItems) {
      const resolved = resolveChecklistItemQuantity(itemId, measurements, { templateKey: 'addition' });
      expect(resolved.pricingReady).toBe(false);
      expect(resolveAllowanceEditorPricingBasis(itemId, input, 'addition')).toBeNull();
      expect(resolveScopeItemSuggestedPricing(itemId, input, 'addition', resolved)).toEqual({
        fill: null,
        comparison: null,
      });
    }
  });

  it('uses ADU-specific pricing basis units for missing-price scope cards', () => {
    const input = inputWith({
      floorAreaSqft: '500',
      excavationCy: '50',
    });

    expect(resolveAllowanceEditorPricingBasis('permits', input, 'addition')).toBeNull();
    expect(resolveAllowanceEditorPricingBasis('grading', input, 'addition')).toEqual({
      quantity: 500,
      unit: 'sqft',
    });
    expect(resolveAllowanceEditorPricingBasis('excavation', input, 'addition')).toEqual({
      quantity: 50,
      unit: 'cy',
    });
    expect(resolveAllowanceEditorPricingBasis('utility_trenching', input, 'addition')).toBeNull();
  });

  it('uses scenario-specific pricing basis units outside ADU', () => {
    const input = inputWith({
      floorAreaSqft: '800',
      kitchenFloorSqft: '220',
      roofSquares: '18',
      deckSqft: '320',
      railingLf: '42',
      landscapeSqft: '1200',
      excavationCy: '75',
      cabinetLf: '24',
    });

    expect(resolveAllowanceEditorPricingBasis('flooring', input, 'kitchen')).toEqual({
      quantity: 220,
      unit: 'sqft',
    });
    expect(resolveAllowanceEditorPricingBasis('cabinets', input, 'kitchen')).toEqual({
      quantity: 24,
      unit: 'lf',
    });
    expect(resolveAllowanceEditorPricingBasis('shingles_roofing', input, 'roofing')).toEqual({
      quantity: 18,
      unit: 'squares',
    });
    expect(resolveAllowanceEditorPricingBasis('decking', input, 'deck_patio')).toEqual({
      quantity: 320,
      unit: 'sqft',
    });
    expect(resolveAllowanceEditorPricingBasis('railing', input, 'deck_patio')).toEqual({
      quantity: 42,
      unit: 'lf',
    });
    expect(resolveAllowanceEditorPricingBasis('sod_turf', input, 'landscaping')).toEqual({
      quantity: 1200,
      unit: 'sqft',
    });
    expect(resolveAllowanceEditorPricingBasis('backfill', input, 'excavation')).toEqual({
      quantity: 75,
      unit: 'cy',
    });
    expect(resolveAllowanceEditorPricingBasis('water_line', input, 'plumbing_service')).toBeNull();
  });

  it('uses sqft national average rates when concrete is measured in square feet', () => {
    const input = inputWith({ concreteSqft: '500' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('concrete', measurements, { templateKey: 'addition' });

    expect(resolved.unit).toBe('sqft');

    const { fill } = resolveScopeItemSuggestedPricing('concrete', input, 'addition', resolved);
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      material: 2000,
      labor: 3000,
      total: 5000,
      basis: { quantity: 500, unit: 'sqft' },
    });
  });
});

describe('resolveTemplateRateForItem', () => {
  it('matches saved line items within the same trade family and unit', () => {
    const ctx: ScopePricingContext = {
      templates: [
        {
          name: 'LVP Floors',
          materialLineItems: [{ name: 'Vinyl plank flooring', unit: 'sqft', unitPrice: 5.5 }],
          laborLineItems: [{ name: 'Flooring install labor', unit: 'sqft', unitPrice: 3.25 }],
        },
      ],
    };
    expect(resolveTemplateRateForItem('flooring', 'sqft', ctx)).toMatchObject({
      materialRate: 5.5,
      laborRate: 3.25,
      source: 'LVP Floors',
    });
  });

  it('matches saved sqft labor lines stored as hours and rate', () => {
    const ctx: ScopePricingContext = {
      templates: [
        {
          name: 'Nick',
          materialLineItems: [{ name: 'LVP flooring', unit: 'sqft', unitPrice: 3 }],
          laborLineItems: [{ name: 'LVP install', mode: 'sqft', hours: 1200, rate: 4, total: 4800 }],
        },
      ],
    };
    expect(resolveTemplateRateForItem('flooring', 'sqft', ctx)).toMatchObject({
      materialRate: 3,
      laborRate: 4,
      source: 'Nick',
    });
  });

  it('does not borrow a wall-tile rate for a flooring scope', () => {
    const ctx: ScopePricingContext = {
      templates: [
        {
          name: 'Bath Tile',
          materialLineItems: [{ name: 'Wall tile', unit: 'sqft', unitPrice: 8 }],
          laborLineItems: [{ name: 'Wall tile setting', unit: 'sqft', unitPrice: 14 }],
        },
      ],
    };
    expect(resolveTemplateRateForItem('flooring', 'sqft', ctx)).toBeNull();
  });

  it('ignores rates whose unit does not match the scope unit', () => {
    const ctx: ScopePricingContext = {
      bid: {
        name: 'This bid',
        materialLineItems: [{ name: 'LVP flooring', unit: 'ea', unitPrice: 200 }],
        laborLineItems: [],
      },
    };
    expect(resolveTemplateRateForItem('flooring', 'sqft', ctx)).toBeNull();
  });

  it('rehydrates notes material/labor split when only a partial user_entered allowance is stored', () => {
    const notes =
      'Install LVP flooring which is 850 sqft. Material is $4.50 a square foot and $3.25 a square foot for labor.';
    const input = inputWith({ floorAreaSqft: '850' });
    input.itemQuantities = {
      ...input.itemQuantities,
      flooring__allowance: { quantity: '3825', unit: 'allowance', quantitySource: 'user_entered' },
    };
    const fromNotes = resolveDualRatePricingDisplayFromNotes('flooring', input, notes, 'flooring');
    expect(fromNotes).toMatchObject({
      dualMaterial: { quantity: 3825 },
      dualLabor: { quantity: 2762.5 },
      dualAllowance: { quantity: 6587.5 },
    });
  });
});
