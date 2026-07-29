import {
  resolveStep2BenchmarkUnitHint,
  resolveStep2ComponentSuggestedPricing,
  resolveStep2MissingStatusLabel,
  resolveStep2PricingTier,
  step2PricingPromptKey,
  step2TierExpectsSuggestedFill,
  step2TierNeedsInlineTakeoffEntry,
} from '@/utils/confirmScopeStep2Pricing';
import { initialScopeMeasurementInputExtended, resolveScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';

describe('confirmScopeStep2Pricing tiers', () => {
  it('classifies bathroom plumbing rough-in as prompt_first', () => {
    const tier = resolveStep2PricingTier('plumbing_rough', 'bathroom');
    expect(tier.tier).toBe('prompt_first');
    expect(tier.promptKey).toBe('bathroom_plumbing_work_type');
    expect(step2PricingPromptKey('plumbing_rough', 'bathroom')).toBe('bathroom_plumbing_work_type');
    expect(tier.benchmarkUnitHint).toMatch(/\$1,150/);
  });

  it('classifies bathroom electrical rough-in as takeoff_required', () => {
    expect(resolveStep2PricingTier('electrical_rough', 'bathroom').tier).toBe('takeoff_required');
    expect(step2TierExpectsSuggestedFill('electrical_rough', 'bathroom')).toBe(false);
  });

  it('classifies bathroom shower demo as takeoff_required without on-card SF (QM owns it)', () => {
    expect(resolveStep2PricingTier('demo', 'bathroom').tier).toBe('takeoff_required');
    expect(resolveStep2PricingTier('demo', 'bathroom').benchmarkUnitHint).toMatch(/\$5\.50\/SF/);
    expect(step2TierNeedsInlineTakeoffEntry('demo', 'bathroom', { pricingReady: false })).toBe(false);
    expect(step2TierNeedsInlineTakeoffEntry('demo', 'bathroom', { pricingReady: true })).toBe(false);
    expect(step2TierNeedsInlineTakeoffEntry('floor_demo', 'bathroom', { pricingReady: false })).toBe(
      false
    );
  });

  it('classifies bathroom drywall patch as takeoff_required', () => {
    expect(resolveStep2PricingTier('drywall', 'bathroom').tier).toBe('takeoff_required');
    expect(step2TierExpectsSuggestedFill('drywall', 'bathroom')).toBe(false);
    expect(step2TierNeedsInlineTakeoffEntry('drywall', 'bathroom', { pricingReady: false })).toBe(
      true
    );
    expect(step2TierNeedsInlineTakeoffEntry('drywall', 'bathroom', { pricingReady: true })).toBe(
      false
    );
  });

  it('classifies bathroom drywall patch as takeoff_required', () => {
    expect(resolveStep2PricingTier('drywall', 'bathroom').tier).toBe('takeoff_required');
    expect(step2TierExpectsSuggestedFill('drywall', 'bathroom')).toBe(false);
  });

  it('uses template-aware missing labels for bathroom drywall patch', () => {
    expect(resolveStep2MissingStatusLabel('drywall', 'bathroom')).toBe('Needs patch/repair SF');
    expect(resolveStep2MissingStatusLabel('drywall', 'kitchen')).toMatch(/wall and ceiling/i);
  });

  it('routes bathroom drywall pricing only after patch SF is entered', () => {
    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'bathroom' },
      scopeMeasurements: { showerWallTileSqft: 80 },
    } as never);
    const checklistItems = [{ id: 'shower_tile', state: 'included', inputType: 'yes_no' }];

    const withoutQty = resolveStep2ComponentSuggestedPricing({
      itemId: 'drywall',
      templateKey: 'bathroom',
      measurementsInput: input,
      resolved: { quantity: 0, unit: 'sqft' },
      pricingContext: { checklistItems },
    });
    expect(withoutQty).toBeUndefined();

    const withQty = resolveStep2ComponentSuggestedPricing({
      itemId: 'drywall',
      templateKey: 'bathroom',
      measurementsInput: input,
      resolved: { quantity: 36, unit: 'sqft', quantitySource: 'user_entered' },
      pricingContext: { checklistItems },
    });
    expect(withQty?.fill?.total).toBe(400);

    const viaMain = resolveScopeItemSuggestedPricing(
      'drywall',
      input,
      'bathroom',
      { quantity: 36, unit: 'sqft', quantitySource: 'user_entered' },
      { checklistItems }
    );
    expect(viaMain.fill?.total).toBe(400);
  });

  it('classifies bathroom paint repair as prompt_first with patch SF takeoff', () => {
    expect(resolveStep2PricingTier('paint_repair', 'bathroom').tier).toBe('prompt_first');
    expect(step2TierNeedsInlineTakeoffEntry('paint_repair', 'bathroom', { pricingReady: false })).toBe(
      true
    );
    expect(step2TierNeedsInlineTakeoffEntry('paint_repair', 'bathroom', { pricingReady: true })).toBe(
      true
    );
    expect(step2TierNeedsInlineTakeoffEntry('drywall', 'bathroom', { pricingReady: false })).toBe(
      true
    );
  });

  it('classifies bathroom glass door as prompt_first with style tiers', () => {
    const tier = resolveStep2PricingTier('glass_door', 'bathroom');
    expect(tier.tier).toBe('prompt_first');
    expect(tier.promptKey).toBe('glass_door_style');
    expect(step2PricingPromptKey('glass_door', 'bathroom')).toBe('glass_door_style');
    expect(tier.benchmarkUnitHint).toMatch(/\$1,450/);

    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'bathroom' },
    } as never);
    const standard = resolveStep2ComponentSuggestedPricing({
      itemId: 'glass_door',
      templateKey: 'bathroom',
      measurementsInput: { ...input, bathroomGlassDoorStyle: 'standard_slider' },
      resolved: { quantity: 1, unit: 'each' },
    });
    expect(standard?.fill?.total).toBe(1450);

    const premium = resolveStep2ComponentSuggestedPricing({
      itemId: 'glass_door',
      templateKey: 'bathroom',
      measurementsInput: { ...input, bathroomGlassDoorStyle: 'premium_frameless' },
      resolved: { quantity: 1, unit: 'each' },
    });
    expect(premium?.fill?.total).toBe(2500);
  });

  it('routes combined patch + paint through paint_repair when SF is entered', () => {
    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'bathroom' },
      scopeMeasurements: {
        showerWallTileSqft: 80,
        bathroomPaintRepairScope: 'affected_area',
      },
    } as never);
    const checklistItems = [
      { id: 'paint_repair', state: 'included', inputType: 'yes_no' },
      { id: 'shower_tile', state: 'included', inputType: 'yes_no' },
    ];

    const combined = resolveStep2ComponentSuggestedPricing({
      itemId: 'paint_repair',
      templateKey: 'bathroom',
      measurementsInput: input,
      resolved: { quantity: 36, unit: 'sqft', quantitySource: 'user_entered' },
      pricingContext: { checklistItems },
    });
    expect(combined?.fill?.total).toBe(700);
    expect(combined?.fill?.benchmarkScopeKey).toBe('paint_repair');
  });

  it('does not show combined pricing for affected area until patch SF is entered', () => {
    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'bathroom' },
      scopeMeasurements: {
        showerWallTileSqft: 80,
        bathroomPaintRepairScope: 'affected_area',
      },
    } as never);
    const checklistItems = [
      { id: 'paint_repair', state: 'included', inputType: 'yes_no' },
      { id: 'shower_tile', state: 'included', inputType: 'yes_no' },
    ];

    const combined = resolveStep2ComponentSuggestedPricing({
      itemId: 'paint_repair',
      templateKey: 'bathroom',
      measurementsInput: input,
      resolved: { quantity: null, unit: 'sqft', quantitySource: 'missing' },
      pricingContext: { checklistItems },
    });
    expect(combined?.fill).toBeNull();
  });

  it('shows paint-only affected area when separate lines is selected', () => {
    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'bathroom' },
      scopeMeasurements: {
        showerWallTileSqft: 80,
        bathroomPaintRepairScope: 'affected_area',
        bathroomDrywallPaintUseCombinedAssembly: false,
      },
    } as never);
    const checklistItems = [
      { id: 'paint_repair', state: 'included', inputType: 'yes_no' },
      { id: 'shower_tile', state: 'included', inputType: 'yes_no' },
    ];

    const paintOnly = resolveStep2ComponentSuggestedPricing({
      itemId: 'paint_repair',
      templateKey: 'bathroom',
      measurementsInput: input,
      resolved: { quantity: 36, unit: 'sqft', quantitySource: 'user_entered' },
      pricingContext: { checklistItems },
    });
    expect(paintOnly?.fill?.total).toBe(500);
  });

  it('exposes benchmark unit hints for takeoff-required trades', () => {
    expect(resolveStep2BenchmarkUnitHint('electrical_rough', 'bathroom')).toMatch(/\$175/);
    expect(resolveStep2PricingTier('mep_rough', 'ground_up').tier).toBe('comparison_only');
  });
});

describe('bathroom shower tile demo suggested pricing', () => {
  it('suppresses a second suggest row after Apply (95 sf + tub = $872.50)', () => {
    const applied = resolveStep2ComponentSuggestedPricing({
      itemId: 'demo',
      templateKey: 'bathroom',
      measurementsInput: {
        demoTileWallCount: 1,
        demoTubCount: 1,
        showerWallTileSqft: '800',
        showerFloorTileSqft: '135',
        itemQuantities: {
          demo__sqft_basis: { quantity: '95', unit: 'sqft', quantitySource: 'user_entered' },
          demo__material: { quantity: '97.5', unit: 'allowance', quantitySource: 'user_entered' },
          demo__labor: { quantity: '775', unit: 'allowance', quantitySource: 'user_entered' },
          demo__allowance: { quantity: '872.5', unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
      resolved: {
        quantity: 935,
        unit: 'sqft',
        quantitySource: 'inferred',
        dualMaterial: { quantity: 97.5, unit: 'allowance' },
        dualLabor: { quantity: 775, unit: 'allowance' },
      },
      pricingContext: {},
    });
    expect(applied).toEqual({ fill: null, comparison: null });
  });

  it('uses stored sqft basis instead of inflated aggregate measurements', () => {
    const suggest = resolveStep2ComponentSuggestedPricing({
      itemId: 'demo',
      templateKey: 'bathroom',
      measurementsInput: {
        demoTileWallCount: 1,
        demoTubCount: 1,
        showerWallTileSqft: '800',
        showerFloorTileSqft: '135',
        itemQuantities: {
          demo__sqft_basis: { quantity: '95', unit: 'sqft', quantitySource: 'user_entered' },
        },
      },
      resolved: { quantity: 935, unit: 'sqft', quantitySource: 'inferred' },
      pricingContext: {},
    });
    expect(suggest?.fill?.total).toBe(872.5);
    expect(suggest?.fill?.basis).toMatchObject({ quantity: 95, unit: 'sqft' });
  });
});
