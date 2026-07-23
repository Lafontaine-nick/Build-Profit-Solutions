import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import {
  buildNormalizedScopeMeasurementsFromInput,
  DEFAULT_SCOPE_ALLOWANCE_QUANTITY_RULE,
  getChecklistItemQuantityRuleOrDefault,
  isPlaceholderAllowancePricing,
  isStaleLivingSfPricingBasis,
  resolveAllowanceEditorDefaultBasisUnit,
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
  it('audits the current excavation national-average suggestion with a defined base-scope profile', () => {
    const input = inputWith({ excavationCy: '50' });
    const resolved = {
      quantity: 50,
      unit: 'cy',
      quantitySource: 'inferred' as const,
    };
    const { fill } = resolveScopeItemSuggestedPricing('excavation', input, 'addition', resolved);
    expect(fill).toMatchObject({
      material: 250,
      labor: 2250,
      total: 2500,
      materialSource: 'national_average',
      laborSource: 'national_average',
      basis: { quantity: 50, unit: 'cy' },
    });
    expect(fill?.benchmarkScopeProfile).toMatchObject({
      pricingSource: 'national_average',
      geographicBasis: 'national',
      scopeAssumptionsDefined: true,
      audit: {
        quantity: 50,
        unit: 'cy',
        materialRate: 5,
        laborRate: 45,
        equipmentRate: null,
        total: 2500,
      },
    });
    expect(fill?.benchmarkScopeProfile?.scopeAssumptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scopeKey: 'excavation', status: 'included' }),
        expect.objectContaining({ scopeKey: 'haul_off', status: 'excluded' }),
        expect.objectContaining({ scopeKey: 'dump_fees', status: 'excluded' }),
        expect.objectContaining({ scopeKey: 'backfill', status: 'excluded' }),
        expect.objectContaining({ scopeKey: 'compaction', status: 'excluded' }),
        expect.objectContaining({ scopeKey: 'shoring', status: 'excluded' }),
      ])
    );
    expect(fill?.benchmarkScopeProfile?.audit?.rootCause).toMatch(/base excavation only/i);
  });

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
      material: 200,
      labor: 500,
      total: 700,
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

  it('suggests cleanup as material + labor split (dumpster material + clean/haul labor)', () => {
    const input = inputWith({});
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('cleanup', measurements, { templateKey: 'addition' });

    const { fill } = resolveScopeItemSuggestedPricing('cleanup', input, 'addition', resolved);
    expect(fill).toMatchObject({
      mode: 'suggested_price',
      lumpSumOnly: false,
      material: 450,
      labor: 550,
      total: 1000,
    });
  });

  it('keeps flat allowance suggestions available after the user enters a different allowance', () => {
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
    // Suggestion stays available so the user can switch back from a manual edit.
    expect(fill).toMatchObject({
      mode: 'suggested_price',
    });
    expect(fill?.total).toBeGreaterThan(0);
    expect(comparison).toBeNull();
  });

  it('keeps ground-up permit suggestion available after editing the allowance', () => {
    const input = inputWith({
      itemQuantities: {
        permits__allowance: {
          quantity: '34000',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
    });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const resolved = resolveChecklistItemQuantity('permits', measurements, { templateKey: 'ground_up' });
    const { fill } = resolveScopeItemSuggestedPricing('permits', input, 'ground_up', resolved);
    expect(fill).toMatchObject({
      lumpSumOnly: true,
      total: 32000,
    });
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

  it('treats soft-cost scopes as flat allowance lines across templates', () => {
    const input = inputWith({ floorAreaSqft: '600' });
    const measurements = buildNormalizedScopeMeasurementsFromInput(input);
    const flatAllowanceItems = [
      'cabinets_counters',
      'final_inspections',
      'contingency',
      'plans_engineering',
      'mobilization',
      'emergency_fee',
      'survey',
      'general_conditions',
      'supervision',
      'overhead_profit',
    ] as const;

    for (const itemId of flatAllowanceItems) {
      const rule = getChecklistItemQuantityRuleOrDefault(itemId, 'addition');
      expect(rule.lumpSumOnly).toBe(true);
      expect(rule.allowanceOrSplit).toBeFalsy();
      expect(resolveAllowanceEditorPricingBasis(itemId, input, 'addition')).toBeNull();
      const resolved = resolveChecklistItemQuantity(itemId, measurements, { templateKey: 'addition' });
      expect(resolved.pricingReady).toBe(false);
    }

    for (const itemId of ['plumbing_trim', 'electrical_trim', 'haul_off'] as const) {
      const rule = getChecklistItemQuantityRuleOrDefault(itemId, 'addition');
      expect(rule.lumpSumOnly).toBe(false);
    }

    // Same soft costs should stay allowance-only outside addition templates.
    expect(getChecklistItemQuantityRuleOrDefault('mobilization', 'excavation').lumpSumOnly).toBe(true);
    expect(getChecklistItemQuantityRuleOrDefault('overhead_profit', 'ground_up').lumpSumOnly).toBe(true);
    expect(getChecklistItemQuantityRuleOrDefault('emergency_fee', 'plumbing_service').lumpSumOnly).toBe(true);
  });

  it('keeps trade scopes on material/labor — allowance toggle only for soft costs', () => {
    const tradeItems = [
      'utility_coordination',
      'utility_trenching',
      'windows_doors',
      'hvac',
      'hvac_startup',
      'appliance_removal',
      'cabinets',
      'countertops',
      'mirror_accessories',
      'service_call',
      'parts_materials',
      'hardware',
      'materials_package',
      'utility_taps',
      'refrigerant',
      'thermostat',
      'roof_tie_in',
    ] as const;

    for (const itemId of tradeItems) {
      const rule = getChecklistItemQuantityRuleOrDefault(itemId, 'addition');
      expect(rule.allowanceOrSplit).toBeFalsy();
      expect(rule.lumpSumOnly).toBeFalsy();
    }

    expect(getChecklistItemQuantityRuleOrDefault('hvac', 'addition').defaultUnit).toBe('sqft');
    expect(getChecklistItemQuantityRuleOrDefault('service_call', 'plumbing_service').allowanceOrSplit).toBeFalsy();
    expect(getChecklistItemQuantityRuleOrDefault('utility_taps', 'ground_up').allowanceOrSplit).toBeFalsy();
    expect(getChecklistItemQuantityRuleOrDefault('permits', 'addition').lumpSumOnly).toBe(true);
    expect(getChecklistItemQuantityRuleOrDefault('appliances', 'addition').lumpSumOnly).toBe(true);
    expect(getChecklistItemQuantityRuleOrDefault('contingency', 'addition').lumpSumOnly).toBe(true);
    expect(DEFAULT_SCOPE_ALLOWANCE_QUANTITY_RULE.allowanceOrSplit).toBeFalsy();
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

  it('uses foundation concrete CY for ground-up Edit basis — not living SF', () => {
    const input = inputWith({
      floorAreaSqft: '3098',
      concreteCy: '68',
      itemQuantities: {
        // Stale Edit session that wrongly stored living SF as the pricing basis.
        foundation__sqft_basis: { quantity: '3098', unit: 'sqft', quantitySource: 'user_entered' },
      },
    });

    expect(resolveAllowanceEditorPricingBasis('foundation', input, 'ground_up')).toEqual({
      quantity: 68,
      unit: 'cy',
    });
    expect(resolveAllowanceEditorDefaultBasisUnit('foundation', 'ground_up')).toBe('cy');
  });

  it('uses covered framed SF (living + garage) for ground-up framing Edit basis', () => {
    const input = inputWith({
      floorAreaSqft: '3098',
      garageSqft: '972',
      itemQuantities: {
        // Stale Edit session that stored living-only SF.
        framing__sqft_basis: { quantity: '3098', unit: 'sqft', quantitySource: 'user_entered' },
      },
    });

    expect(resolveAllowanceEditorPricingBasis('framing', input, 'ground_up')).toEqual({
      quantity: 4070,
      unit: 'sqft',
    });
    expect(
      isStaleLivingSfPricingBasis({
        itemId: 'framing',
        storedQty: 3098,
        storedUnit: 'sqft',
        livingSf: 3098,
        garageSf: 972,
        preferredUnit: 'sqft',
        preferredMeasurementKeys: ['floorAreaSqft', 'garageSqft'],
        sumMeasurementKeys: true,
      })
    ).toBe(true);
  });

  it('aligns Edit basis with Suggest planning for drywall, insulation, paint, HVAC, cabinets', () => {
    const input = inputWith({
      floorAreaSqft: '3098',
      garageSqft: '972',
      // Thin notes takeoff — Suggest expands to living×3.5 (~10,843).
      drywallSqft: '4056',
      // Stale living-SF Edit seeds that must not stick.
      itemQuantities: {
        drywall__sqft_basis: { quantity: '3098', unit: 'sqft', quantitySource: 'user_entered' },
        insulation__sqft_basis: { quantity: '3098', unit: 'sqft', quantitySource: 'user_entered' },
        interior_paint__sqft_basis: { quantity: '3098', unit: 'sqft', quantitySource: 'user_entered' },
      },
    });

    expect(resolveAllowanceEditorPricingBasis('drywall', input, 'ground_up')).toEqual({
      quantity: Math.round(3098 * 3.5),
      unit: 'sqft',
    });
    expect(resolveAllowanceEditorPricingBasis('insulation', input, 'ground_up')?.unit).toBe('sqft');
    expect(resolveAllowanceEditorPricingBasis('insulation', input, 'ground_up')!.quantity).toBeGreaterThan(
      3098
    );
    expect(resolveAllowanceEditorPricingBasis('insulation', input, 'ground_up')!.quantity).not.toBe(3098);
    expect(resolveAllowanceEditorPricingBasis('interior_paint', input, 'ground_up')).toBeNull();
    expect(resolveAllowanceEditorPricingBasis('hvac', input, 'ground_up')).toEqual({
      quantity: 1,
      unit: 'each',
    });
    expect(resolveAllowanceEditorPricingBasis('cabinets', input, 'ground_up')).toEqual({
      quantity: Math.round(3098 / 25),
      unit: 'lf',
    });
    expect(resolveAllowanceEditorPricingBasis('countertops', input, 'ground_up')).toEqual({
      quantity: 80,
      unit: 'sqft',
    });
  });

  it('does not seed living SF as paint Edit basis when paintable SF is present', () => {
    const input = inputWith({
      floorAreaSqft: '3098',
      wallPaintSqft: '10843',
      exteriorPaintSqft: '4200',
    });
    expect(resolveAllowanceEditorPricingBasis('interior_paint', input, 'ground_up')).toEqual({
      quantity: 10843,
      unit: 'sqft',
    });
    expect(resolveAllowanceEditorPricingBasis('exterior_paint', input, 'ground_up')).toEqual({
      quantity: 4200,
      unit: 'sqft',
    });
  });

  it('rejects living-SF Edit basis for CY / squares / each / LF scopes', () => {
    expect(
      isStaleLivingSfPricingBasis({
        itemId: 'roofing',
        storedQty: 3098,
        storedUnit: 'sqft',
        livingSf: 3098,
        preferredUnit: 'squares',
        preferredMeasurementKeys: ['roofSquares'],
      })
    ).toBe(true);
    expect(
      isStaleLivingSfPricingBasis({
        itemId: 'hvac',
        storedQty: 3098,
        storedUnit: 'sqft',
        livingSf: 3098,
        preferredUnit: 'each',
      })
    ).toBe(true);
    expect(
      isStaleLivingSfPricingBasis({
        itemId: 'drywall',
        storedQty: 3098,
        storedUnit: 'sqft',
        livingSf: 3098,
        preferredUnit: 'sqft',
        preferredMeasurementKeys: ['drywallSqft'],
      })
    ).toBe(true);

    const input = inputWith({
      floorAreaSqft: '3098',
      concreteCy: '68',
      excavationCy: '120',
      roofSquares: '46.2',
      drywallSqft: '10843',
      cabinetLf: '90',
      itemQuantities: {
        foundation__sqft_basis: { quantity: '3098', unit: 'sqft' },
        excavation__sqft_basis: { quantity: '3098', unit: 'sqft' },
        roofing__sqft_basis: { quantity: '3098', unit: 'sqft' },
        hvac__sqft_basis: { quantity: '3098', unit: 'sqft' },
        cabinets__sqft_basis: { quantity: '3098', unit: 'sqft' },
        drywall__sqft_basis: { quantity: '3098', unit: 'sqft' },
      },
    });

    expect(resolveAllowanceEditorPricingBasis('foundation', input, 'ground_up')).toEqual({
      quantity: 68,
      unit: 'cy',
    });
    expect(resolveAllowanceEditorPricingBasis('excavation', input, 'ground_up')).toEqual({
      quantity: 120,
      unit: 'cy',
    });
    expect(resolveAllowanceEditorPricingBasis('roofing', input, 'ground_up')).toEqual({
      quantity: 46.2,
      unit: 'squares',
    });
    // HVAC Suggest defaults to 1 system — Edit must match (not living SF, not empty).
    expect(resolveAllowanceEditorPricingBasis('hvac', input, 'ground_up')).toEqual({
      quantity: 1,
      unit: 'each',
    });
    expect(resolveAllowanceEditorPricingBasis('cabinets', input, 'ground_up')).toEqual({
      quantity: 90,
      unit: 'lf',
    });
    expect(resolveAllowanceEditorPricingBasis('drywall', input, 'ground_up')).toEqual({
      quantity: 10843,
      unit: 'sqft',
    });
    expect(resolveAllowanceEditorPricingBasis('foundation', input, 'addition')).toEqual({
      quantity: 68,
      unit: 'cy',
    });
    expect(resolveAllowanceEditorPricingBasis('roof_tie_in', input, 'addition')).toEqual({
      quantity: 46.2,
      unit: 'squares',
    });
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

  it('prices ground-up insulation on thermal envelope SF, not living×3.5 drywall surface', () => {
    const livingSf = 1879;
    const drywallProxy = Math.round(livingSf * 3.5); // 6577 — must not be used
    const input = inputWith({ floorAreaSqft: String(livingSf) });
    const resolved = {
      quantity: livingSf,
      unit: 'sqft' as const,
      quantitySource: 'inferred' as const,
    };
    const { fill } = resolveScopeItemSuggestedPricing('insulation', input, 'ground_up', resolved);
    expect(fill?.basis?.unit).toBe('sqft');
    expect(fill?.basis?.quantity).not.toBe(drywallProxy);
    expect(fill?.basis?.quantity).not.toBe(livingSf);
    // Envelope planning without perimeter still stays well below drywall surface.
    expect(fill?.basis?.quantity).toBeLessThan(5000);
    expect(fill?.basis?.quantity).toBeGreaterThan(2500);
  });

  it('keeps drywall notes surface takeoff (does not expand living SF when qty differs)', () => {
    const input = inputWith({
      floorAreaSqft: '1879',
      drywallSqft: '5469',
    });
    const resolved = {
      quantity: 5469,
      unit: 'sqft' as const,
      quantitySource: 'notes' as const,
    };
    const { fill } = resolveScopeItemSuggestedPricing('drywall', input, 'ground_up', resolved);
    expect(fill?.basis).toEqual({ quantity: 5469, unit: 'sqft' });
  });
});
