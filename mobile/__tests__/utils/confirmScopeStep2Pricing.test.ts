import {
  resolveStep2BenchmarkUnitHint,
  resolveStep2ComponentSuggestedPricing,
  resolveStep2MissingStatusLabel,
  resolveStep2PricingTier,
  step2PricingPromptKey,
  step2TierExpectsSuggestedFill,
  step2TierNeedsInlineTakeoffEntry,
} from '@/utils/confirmScopeStep2Pricing';
import {
  CHECKLIST_ITEM_QUANTITY_RULES,
  getChecklistItemQuantityRuleOrDefault,
  initialScopeMeasurementInputExtended,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';

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

  it('does not show inline takeoff on flat allowance scopes — Suggest card owns pricing', () => {
    expect(step2TierNeedsInlineTakeoffEntry('permits', 'ground_up', { pricingReady: false })).toBe(
      false
    );
    expect(
      step2TierNeedsInlineTakeoffEntry('plans_engineering', 'ground_up', { pricingReady: false })
    ).toBe(false);
  });

  it('does not show a duplicate sqft takeoff for interior door installation', () => {
    expect(
      step2TierNeedsInlineTakeoffEntry('interior_door_install', 'bathroom', {
        pricingReady: false,
        unit: 'each',
        quantity: 2,
        quantitySource: 'default_assumption',
      })
    ).toBe(false);
  });

  it('does not show a sqft box for opening-only exterior prep', () => {
    expect(
      step2TierNeedsInlineTakeoffEntry('exterior_prep', 'bathroom', {
        pricingReady: false,
        unit: 'sqft',
        quantity: 0,
        dualCount: { quantity: 4, unit: 'each' },
      })
    ).toBe(false);
  });

  it('hides measurement boxes on ground-up pricing cards', () => {
    for (const [itemId, unit] of [
      ['excavation', 'cy'],
      ['foundation', 'cy'],
      ['pour_flatwork', 'sqft'],
      ['insulation', 'sqft'],
      ['windows', 'each'],
      ['exterior_doors', 'each'],
      ['interior_doors', 'each'],
      ['landscaping', 'sqft'],
      ['plumbing_rough', 'each'],
      ['roofing', 'squares'],
      ['drywall', 'sqft'],
      ['interior_paint', 'sqft'],
      ['flooring', 'sqft'],
    ] as const) {
      expect(
        step2TierNeedsInlineTakeoffEntry(itemId, 'ground_up', {
          pricingReady: false,
          unit,
          quantity: 0,
        })
      ).toBe(false);
    }
  });

  it('does not add a second wall-area box when the painting plan quantity is already priced', () => {
    expect(
      step2TierNeedsInlineTakeoffEntry('interior_paint', 'painting', {
        pricingReady: true,
        unit: 'sqft',
        quantity: 3734,
        quantitySource: 'plan_vision',
      })
    ).toBe(false);
  });

  it('keeps wall framing quantity on Quick measurements', () => {
    expect(
      step2TierNeedsInlineTakeoffEntry('wall_framing', 'room_remodel', {
        pricingReady: false,
        unit: 'lf',
        quantity: 0,
      })
    ).toBe(false);
  });

  it('classifies ground-up framing as auto_planning without on-card SF box', () => {
    expect(resolveStep2PricingTier('framing', 'ground_up').tier).toBe('auto_planning');
    expect(
      step2TierNeedsInlineTakeoffEntry('framing', 'ground_up', {
        pricingReady: false,
        unit: 'sqft',
      })
    ).toBe(false);
    expect(
      step2TierNeedsInlineTakeoffEntry('framing', 'ground_up', {
        pricingReady: true,
        unit: 'sqft',
      })
    ).toBe(false);
  });

  it('does not show inline allowance box on package scopes — Suggest card owns pricing', () => {
    const packageScopes = [
      'landscaping',
      'plumbing_trim',
      'electrical_trim',
      'interior_trim',
      'cleanup',
      'haul_off',
      'mirror_accessories',
      'service_call',
      'hvac_startup',
    ];
    for (const itemId of packageScopes) {
      expect(
        step2TierNeedsInlineTakeoffEntry(itemId, 'ground_up', {
          pricingReady: false,
          unit: 'allowance',
        })
      ).toBe(false);
    }
  });

  it('never shows allowance/lump-sum inline box for any allowance-default scope rule', () => {
    const templates = ['ground_up', 'bathroom', 'kitchen', 'addition', undefined] as const;
    for (const [itemId, rule] of Object.entries(CHECKLIST_ITEM_QUANTITY_RULES)) {
      const defaultUnit = String(rule.defaultUnit || '').toLowerCase();
      if (defaultUnit !== 'allowance' && defaultUnit !== 'lump_sum') continue;
      for (const templateKey of templates) {
        expect(
          step2TierNeedsInlineTakeoffEntry(itemId, templateKey, {
            pricingReady: false,
            unit: defaultUnit,
          })
        ).toBe(false);
      }
    }
  });

  it('still shows physical takeoff fields when the unit is not allowance', () => {
    expect(
      step2TierNeedsInlineTakeoffEntry('insulation', 'addition', {
        pricingReady: false,
        unit: 'sqft',
      })
    ).toBe(true);
    expect(
      step2TierNeedsInlineTakeoffEntry('windows', 'addition', {
        pricingReady: false,
        unit: 'each',
      })
    ).toBe(true);
    expect(
      step2TierNeedsInlineTakeoffEntry('exterior_doors', 'kitchen', {
        pricingReady: true,
        unit: 'each',
      })
    ).toBe(true);
    expect(
      step2TierNeedsInlineTakeoffEntry('flooring', 'kitchen', {
        pricingReady: true,
        unit: 'sqft',
        quantity: 700,
        quantitySource: 'inferred',
      })
    ).toBe(true);
    expect(
      step2TierNeedsInlineTakeoffEntry('flooring', 'kitchen', {
        pricingReady: true,
        unit: 'sqft',
        quantity: 700,
        quantitySource: 'notes',
      })
    ).toBe(false);
    expect(
      step2TierNeedsInlineTakeoffEntry('flooring_laminate', 'flooring', {
        pricingReady: false,
        unit: 'sqft',
      })
    ).toBe(false);
    expect(
      step2TierNeedsInlineTakeoffEntry('flooring_lvp', 'flooring', {
        pricingReady: false,
        unit: 'sqft',
      })
    ).toBe(false);
    expect(
      step2TierNeedsInlineTakeoffEntry('landscaping', 'addition', {
        pricingReady: false,
        unit: 'sqft',
      })
    ).toBe(true);
    expect(
      step2TierNeedsInlineTakeoffEntry('plumbing_rough', 'addition', {
        pricingReady: false,
        unit: 'each',
      })
    ).toBe(true);
  });

  it('ground-up pricing cards never show an on-card measurement box', () => {
    const groundUpScopes = [
      'landscaping',
      'plumbing_trim',
      'electrical_trim',
      'interior_trim',
      'cleanup',
      'foundation',
      'insulation',
      'windows',
    ];
    for (const itemId of groundUpScopes) {
      const rule = getChecklistItemQuantityRuleOrDefault(itemId, 'ground_up');
      expect(
        step2TierNeedsInlineTakeoffEntry(itemId, 'ground_up', {
          pricingReady: false,
          unit: rule.defaultUnit,
        })
      ).toBe(false);
    }
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

  it('keeps a mud-pan sqft field on the bathroom install card', () => {
    expect(
      step2TierNeedsInlineTakeoffEntry('shower_pan', 'bathroom', {
        pricingReady: false,
        unit: 'sqft',
      })
    ).toBe(true);
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
    expect(resolveStep2MissingStatusLabel('drywall', 'kitchen')).toBe('Needs patch/repair SF');
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
    expect(withQty?.fill?.total).toBe(432);

    const viaMain = resolveScopeItemSuggestedPricing(
      'drywall',
      input,
      'bathroom',
      { quantity: 36, unit: 'sqft', quantitySource: 'user_entered' },
      { checklistItems }
    );
    expect(viaMain.fill?.total).toBe(432);
  });

  it('routes kitchen drywall patch pricing from localized $400 @ 36 SF reference', () => {
    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'kitchen' },
    } as never);

    const withQty = resolveStep2ComponentSuggestedPricing({
      itemId: 'drywall',
      templateKey: 'kitchen',
      measurementsInput: input,
      resolved: { quantity: 80, unit: 'sqft', quantitySource: 'user_entered' },
    });
    expect(withQty?.fill?.total).toBe(889);
    expect(withQty?.fill?.material).toBe(222.25);
    expect(withQty?.fill?.labor).toBe(666.75);
    expect(withQty?.fill?.basis).toEqual({ quantity: 80, unit: 'sqft' });
    expect(withQty?.fill?.pricingRecordId).toBe(
      'bps_national:drywall:kitchen_patch_texture:80sf'
    );

    const viaMain = resolveScopeItemSuggestedPricing(
      'drywall',
      input,
      'kitchen',
      { quantity: 80, unit: 'sqft', quantitySource: 'user_entered' }
    );
    expect(viaMain.fill?.total).toBe(889);
  });

  it('classifies kitchen drywall patch as takeoff_required', () => {
    expect(resolveStep2PricingTier('drywall', 'kitchen').tier).toBe('takeoff_required');
    expect(resolveStep2PricingTier('drywall', 'kitchen').benchmarkUnitHint).toMatch(
      /\$400 localized patch/
    );
  });

  it('classifies bathroom paint repair as prompt_first with patch SF takeoff', () => {
    expect(resolveStep2PricingTier('paint_repair', 'bathroom').tier).toBe('prompt_first');
    expect(step2TierNeedsInlineTakeoffEntry('paint_repair', 'bathroom', { pricingReady: false })).toBe(
      true
    );
    expect(step2TierNeedsInlineTakeoffEntry('paint_repair', 'bathroom', { pricingReady: true })).toBe(
      true
    );
    expect(step2TierNeedsInlineTakeoffEntry('paint_repair', 'bathroom', { pricingReady: true }, true)).toBe(
      false
    );
    expect(step2TierNeedsInlineTakeoffEntry('drywall', 'bathroom', { pricingReady: false })).toBe(
      true
    );
  });

  it('classifies kitchen backsplash demo as prompt_first with difficulty tiers', () => {
    const tier = resolveStep2PricingTier('backsplash_demo', 'kitchen');
    expect(tier.tier).toBe('prompt_first');
    expect(tier.promptKey).toBe('backsplash_demo_difficulty');
    expect(step2PricingPromptKey('backsplash_demo', 'kitchen')).toBe(
      'backsplash_demo_difficulty'
    );
    expect(tier.benchmarkUnitHint).toMatch(/\$7\.50\/SF/);

    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'kitchen' },
    } as never);
    const light = resolveStep2ComponentSuggestedPricing({
      itemId: 'backsplash_demo',
      templateKey: 'kitchen',
      measurementsInput: {
        ...input,
        kitchenBacksplashDemoDifficulty: 'light',
      },
      resolved: { quantity: 28, unit: 'sqft' },
    });
    expect(light?.fill?.total).toBe(126);

    const extensive = resolveStep2ComponentSuggestedPricing({
      itemId: 'backsplash_demo',
      templateKey: 'kitchen',
      measurementsInput: {
        ...input,
        kitchenBacksplashDemoDifficulty: 'extensive',
      },
      resolved: { quantity: 28, unit: 'sqft' },
    });
    expect(extensive?.fill?.total).toBe(336);
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

  it('prices a new frameless shower door at the premium tier from the note', () => {
    const notes =
      'Remodel the bathroom. Tear out the existing shower wall tile, the tile shower pan, and the old shower door. Install new shower wall tile, a new tile shower pan, and a new frameless shower door. Leave the bathroom floor, vanity, and toilet. No paint.';
    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'bathroom' },
    } as never);
    const priced = resolveScopeItemSuggestedPricing(
      'glass_door',
      { ...input, showerDoorCount: 1 },
      'bathroom',
      { quantity: 1, unit: 'each', quantitySource: 'inferred' },
      {},
      null,
      notes
    );
    expect(priced.fill?.total).toBe(2500);
    expect(priced.fill?.material).toBe(1550);
    expect(priced.fill?.labor).toBe(950);

    const kept = resolveScopeItemSuggestedPricing(
      'glass_door',
      {
        ...input,
        showerDoorCount: 1,
        bathroomGlassDoorStyle: 'standard_slider',
        bathroomGlassDoorStyleSource: 'user_selected',
      },
      'bathroom',
      { quantity: 1, unit: 'each', quantitySource: 'inferred' },
      {},
      null,
      notes
    );
    expect(kept.fill?.total).toBe(1450);
  });

  it('does not create a ready paint price until paint scope option is selected', () => {
    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'bathroom' },
      scopeMeasurements: {
        showerWallTileSqft: 80,
        // Sticky flag alone must not count — UI buttons are still unselected.
        bathroomPaintRepairEntireRoom: true,
        bathroomPaintRepairScope: null,
      },
    } as never);
    const checklistItems = [
      { id: 'paint_repair', state: 'included', inputType: 'yes_no' },
      { id: 'shower_tile', state: 'included', inputType: 'yes_no' },
    ];

    const beforeOption = resolveStep2ComponentSuggestedPricing({
      itemId: 'paint_repair',
      templateKey: 'bathroom',
      measurementsInput: {
        ...input,
        itemQuantities: {
          paint_repair: { quantity: '80', unit: 'sqft', quantitySource: 'user_entered' },
        },
      },
      resolved: { quantity: 80, unit: 'sqft', quantitySource: 'user_entered' },
      pricingContext: { checklistItems },
    });
    expect(beforeOption).toEqual({ fill: null, comparison: null });

    const afterFullRoom = resolveStep2ComponentSuggestedPricing({
      itemId: 'paint_repair',
      templateKey: 'bathroom',
      measurementsInput: {
        ...input,
        bathroomPaintRepairScope: 'full_room',
        bathroomPaintRepairEntireRoom: true,
        itemQuantities: {
          paint_repair: { quantity: '80', unit: 'sqft', quantitySource: 'user_entered' },
        },
      },
      resolved: { quantity: 80, unit: 'sqft', quantitySource: 'user_entered' },
      pricingContext: { checklistItems },
    });
    expect(afterFullRoom?.fill?.total).toBe(1400);
  });

  it('does not count an AI-inferred paint option as contractor-selected without Paint SF', () => {
    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'bathroom' },
      scopeMeasurements: {
        bathroomPaintRepairScope: 'full_room',
        bathroomPaintRepairScopeSource: 'ai_inferred',
      },
    } as never);

    const result = resolveStep2ComponentSuggestedPricing({
      itemId: 'paint_repair',
      templateKey: 'bathroom',
      measurementsInput: {
        ...input,
        itemQuantities: {
          paint_repair: { quantity: '80', unit: 'sqft', quantitySource: 'user_entered' },
        },
      },
      resolved: { quantity: 80, unit: 'sqft', quantitySource: 'user_entered' },
      pricingContext: {
        checklistItems: [{ id: 'paint_repair', state: 'included', inputType: 'yes_no' }],
      },
    });

    expect(result).toEqual({ fill: null, comparison: null });
  });

  it('prices combined patch from Paint measurement when scope is ai-inferred', () => {
    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'bathroom' },
      scopeMeasurements: {
        wallPaintSqft: '100',
        bathroomPaintRepairScope: 'affected_area',
        bathroomPaintRepairScopeSource: 'ai_inferred',
        bathroomPaintRepairSeverity: 'moderate',
        bathroomDrywallPaintUseCombinedAssembly: true,
      },
    } as never);
    const checklistItems = [
      { id: 'paint_repair', state: 'included', inputType: 'yes_no' },
      { id: 'shower_tile', state: 'included', inputType: 'yes_no' },
    ];

    const combined = resolveStep2ComponentSuggestedPricing({
      itemId: 'paint_repair',
      templateKey: 'bathroom',
      measurementsInput: {
        ...input,
        itemQuantities: {
          paint_repair: { quantity: '100', unit: 'sqft', quantitySource: 'inferred' },
        },
      },
      resolved: { quantity: 100, unit: 'sqft', quantitySource: 'inferred' },
      pricingContext: { checklistItems },
    });
    // Large inferred paint areas use the same blended localized/full-room curve
    // as the direct bathroom patch resolver.
    expect(combined?.fill?.total).toBe(1675);
    expect(combined?.fill?.pricingRecordId).toBe(
      'bps_national:drywall_paint:bathroom_combined:moderate:100sf'
    );
  });

  it('auto-prices full room when Paint measurement exceeds room threshold', () => {
    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'bathroom' },
      scopeMeasurements: {
        wallPaintSqft: '320',
        bathroomPaintRepairScope: 'full_room',
        bathroomPaintRepairScopeSource: 'ai_inferred',
      },
    } as never);

    const result = resolveStep2ComponentSuggestedPricing({
      itemId: 'paint_repair',
      templateKey: 'bathroom',
      measurementsInput: {
        ...input,
        itemQuantities: {
          paint_repair: { quantity: '320', unit: 'sqft', quantitySource: 'inferred' },
        },
      },
      resolved: { quantity: 320, unit: 'sqft', quantitySource: 'inferred' },
      pricingContext: {
        checklistItems: [{ id: 'paint_repair', state: 'included', inputType: 'yes_no' }],
      },
    });
    expect(result?.fill?.total).toBe(1400);
    expect(result?.fill?.basis).toEqual({ quantity: 320, unit: 'sqft' });
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
        pricingAcceptance: {
          demo: { selectionStatus: 'accepted', totalAmount: 872.5 },
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

  it('prices confirmed shower wall plus floor measurements from their combined basis', () => {
    const suggest = resolveStep2ComponentSuggestedPricing({
      itemId: 'demo',
      templateKey: 'bathroom',
      measurementsInput: {
        demoTileWallCount: 1,
        demoTilePanCount: 1,
        showerWallTileSqft: '95',
        showerFloorTileSqft: '15',
        itemQuantities: {
          demo__sqft_basis: {
            quantity: 110,
            unit: 'sqft',
            quantitySource: 'user_entered',
          },
        },
      },
      resolved: { quantity: 110, unit: 'sqft', quantitySource: 'user_entered' },
      pricingContext: {},
    });

    // 95 sqft wall × $5.50 + 15 sqft pan × $9. The stored 110 is that sum.
    expect(suggest?.fill?.total).toBe(657.5);
    expect(suggest?.fill?.basis).toMatchObject({ quantity: 110, unit: 'sqft' });
  });

  it('prices entered shower wall and pan sqft on the demo card', () => {
    const notes =
      'Remodel the bathroom. Tear out the shower wall tile and the tile shower pan, and demo the bathroom floor tile.';
    const pricing = resolveScopeItemSuggestedPricing(
      'demo',
      {
        showerWallTileSqft: '90',
        showerFloorTileSqft: '25',
        bathroomFloorSqft: '125',
        demoTilePanCount: 1,
        demoTileWallCount: 1,
        itemQuantities: {
          demo__sqft_basis: {
            quantity: 115,
            unit: 'sqft',
            quantitySource: 'user_entered',
          },
        },
      },
      'bathroom',
      { quantity: 240, unit: 'sqft', quantitySource: 'inferred' },
      {},
      null,
      notes
    );

    // 90 sqft wall × $5.50 + 25 sqft pan × $9. Bath floor stays on floor_demo.
    expect(pricing.fill?.total).toBe(720);
  });

  it('prices the old shower door once, on its own card', () => {
    const measurementsInput = {
      showerWallTileSqft: '90',
      showerFloorTileSqft: '25',
      demoTilePanCount: 1,
      demoTileWallCount: 1,
      demoShowerDoorCount: 1,
      itemQuantities: {
        demo__sqft_basis: {
          quantity: 115,
          unit: 'sqft',
          quantitySource: 'user_entered',
        },
      },
    };
    const tileDemo = resolveScopeItemSuggestedPricing(
      'demo',
      measurementsInput,
      'bathroom',
      { quantity: 115, unit: 'sqft', quantitySource: 'user_entered' },
      {},
      null,
      null
    );
    const doorDemo = resolveScopeItemSuggestedPricing(
      'glass_door_demo',
      measurementsInput,
      'bathroom',
      { quantity: 1, unit: 'each', quantitySource: 'user_entered' },
      {},
      null,
      null
    );

    expect(tileDemo.fill?.total).toBe(720);
    expect(tileDemo.fill?.displayQuantityLine).toMatch(/90 sqft wall tile × \$5\.50\/SF/i);
    expect(tileDemo.fill?.displayQuantityLine).toMatch(/25 sqft mud pan × \$9\.00\/SF/i);
    expect(doorDemo.fill?.total).toBe(125);
  });

  it('prices nonstructural wall demolition from the wall demo area', () => {
    const notes =
      'Demolish the existing nonstructural walls. Frame 1,600 sqft of walls with headers, blocking, and structural sheathing, including two rough openings.';
    const priced = resolveScopeItemSuggestedPricing(
      'demo',
      { wallDemoSqft: '200', itemQuantities: {} },
      'framing',
      { quantity: 200, unit: 'sqft', quantitySource: 'user_entered' },
      {},
      null,
      notes
    );
    expect(priced.fill?.total).toBe(300);
    expect(priced.fill?.material).toBe(50);
    expect(priced.fill?.labor).toBe(250);
    expect(priced.fill?.displayUnitRateLabel).toBe('200 sqft × $1.50/sqft');
  });

  it('prices a linear-foot stud wall once at the stud-wall rate', () => {
    const notes = 'Frame 36 LF of stud wall and two rough openings.';
    const resolved = resolveChecklistItemQuantity(
      'wall_framing',
      { wallFramingLf: 36, itemQuantities: {} } as never,
      { templateKey: 'room_remodel', notes }
    );
    const priced = resolveScopeItemSuggestedPricing(
      'wall_framing',
      { wallFramingLf: '36', itemQuantities: {} },
      'framing',
      { quantity: 36, unit: 'lf', quantitySource: 'notes' },
      {},
      null,
      notes
    );

    expect(resolved.quantity).toBe(36);
    expect(resolved.unit).toBe('lf');
    expect(resolved.pricingReady).toBe(true);
    expect(priced.fill?.total).toBe(432);
    expect(priced.fill?.material).toBe(144);
    expect(priced.fill?.labor).toBe(288);
    expect(priced.fill?.displayUnitRateLabel).toBe('36 LF × $12/LF');
  });

  it('prices linear feet stated in the sentence after the wall', () => {
    const notes = 'Frame the wall. 36 linear feet and two rough openings.';
    const resolved = resolveChecklistItemQuantity(
      'wall_framing',
      { itemQuantities: {} } as never,
      { templateKey: 'framing', notes }
    );
    const priced = resolveScopeItemSuggestedPricing(
      'wall_framing',
      { itemQuantities: {} },
      'framing',
      { quantity: 36, unit: 'lf', quantitySource: 'notes' },
      {},
      null,
      notes
    );

    expect(resolved.quantity).toBe(36);
    expect(resolved.unit).toBe('lf');
    expect(priced.fill?.total).toBe(432);
    expect(priced.fill?.material).toBe(144);
    expect(priced.fill?.labor).toBe(288);
  });

  it('prices feet of interior partition as stud wall', () => {
    const notes = 'Build 24 feet of interior partition and one header.';
    const resolved = resolveChecklistItemQuantity(
      'wall_framing',
      { itemQuantities: {} } as never,
      { templateKey: 'room_remodel', notes }
    );
    const priced = resolveScopeItemSuggestedPricing(
      'wall_framing',
      { itemQuantities: {} },
      'room_remodel',
      { quantity: 24, unit: 'lf', quantitySource: 'notes' },
      {},
      null,
      notes
    );

    expect(resolved.quantity).toBe(24);
    expect(resolved.unit).toBe('lf');
    expect(priced.fill?.total).toBe(288);
    expect(priced.fill?.material).toBe(96);
    expect(priced.fill?.labor).toBe(192);
    expect(priced.fill?.displayUnitRateLabel).toBe('24 LF × $12/LF');
  });

  it('prices a wall given as feet long', () => {
    const notes =
      'Frame a new interior wall. It is 18 feet long and needs one rough opening.';
    const resolved = resolveChecklistItemQuantity(
      'wall_framing',
      { itemQuantities: {} } as never,
      { templateKey: 'room_remodel', notes }
    );
    const priced = resolveScopeItemSuggestedPricing(
      'wall_framing',
      { itemQuantities: {} },
      'room_remodel',
      { quantity: 18, unit: 'lf', quantitySource: 'notes' },
      {},
      null,
      notes
    );

    expect(resolved.quantity).toBe(18);
    expect(resolved.unit).toBe('lf');
    expect(priced.fill?.total).toBe(216);
    expect(priced.fill?.material).toBe(72);
    expect(priced.fill?.labor).toBe(144);
    expect(priced.fill?.displayUnitRateLabel).toBe('18 LF × $12/LF');
  });

  it('prices a stated wall demolition quantity on one demolition card', () => {
    const notes =
      'Demolish 120 sqft of nonstructural walls. Frame 960 sqft of walls and 200 sqft of sheathing, including one rough opening.';
    const resolved = resolveChecklistItemQuantity(
      'demo',
      { itemQuantities: {} } as never,
      { templateKey: 'framing', notes }
    );
    expect(resolved.quantity).toBe(120);
    expect(resolved.unit).toBe('sqft');
    expect(resolved.pricingReady).toBe(true);

    const priced = resolveScopeItemSuggestedPricing(
      'demo',
      { itemQuantities: {} },
      'framing',
      resolved,
      {},
      null,
      notes
    );
    expect(priced.fill?.total).toBe(180);
    expect(priced.fill?.material).toBe(30);
    expect(priced.fill?.labor).toBe(150);
    expect(priced.fill?.displayUnitRateLabel).toBe('120 sqft × $1.50/sqft');
  });

  it('prices noted wall sqft as stud wall linear feet, not the house shell rate', () => {
    const notes =
      'Demolish the existing nonstructural walls. Frame 1,600 sqft of walls with headers, blocking, and structural sheathing, including two rough openings.';
    const priced = resolveScopeItemSuggestedPricing(
      'wall_framing',
      { wallFramingSqft: '1600', itemQuantities: {} },
      'framing',
      { quantity: 1600, unit: 'sqft', quantitySource: 'notes' },
      {},
      null,
      notes
    );
    expect(priced.fill?.total).toBe(2400);
    expect(priced.fill?.material).toBe(800);
    expect(priced.fill?.labor).toBe(1600);
    expect(priced.fill?.displayUnitRateLabel).toBe(
      `${(1600).toLocaleString()} sqft at 8 ft · 200 LF × $12/LF`
    );
  });

  it('does not price noted wall sqft as 1,600 linear feet', () => {
    const notes =
      'Demolish the existing nonstructural walls. Frame 1,600 sqft of walls with headers, blocking, and structural sheathing, including two rough openings.';
    const priced = resolveScopeItemSuggestedPricing(
      'wall_framing',
      {
        framedAreaSqft: '1600',
        itemQuantities: {
          wall_framing: {
            quantity: 1600,
            unit: 'lf',
            quantitySource: 'notes',
          },
        },
      },
      'framing',
      { quantity: 1600, unit: 'lf', quantitySource: 'notes' },
      {},
      null,
      notes
    );
    expect(priced.fill?.total).toBe(2400);
    expect(priced.fill?.basis).toMatchObject({ quantity: 200, unit: 'lf' });
  });

  it('prices bathroom wall framing as stud wall linear feet, not the house shell rate', () => {
    const notes =
      'Remodel the bathroom. Frame the bathroom walls to move the shower to the opposite wall. Leave the vanity and the toilet. No paint.';
    const priced = resolveScopeItemSuggestedPricing(
      'framing',
      { framedAreaSqft: '120', itemQuantities: {} },
      'bathroom',
      { quantity: 120, unit: 'sqft', quantitySource: 'user_entered' },
      {},
      null,
      notes
    );
    expect(priced.fill?.total).toBe(180);
    expect(priced.fill?.material).toBe(60);
    expect(priced.fill?.labor).toBe(120);
    expect(priced.fill?.basis).toMatchObject({ quantity: 15, unit: 'lf' });
    expect(priced.fill?.displayUnitRateLabel).toBe(
      '120 sqft at 8 ft · 15 LF × $12/LF'
    );
    const unmeasured = resolveScopeItemSuggestedPricing(
      'framing',
      { itemQuantities: {} },
      'bathroom',
      { quantity: null, unit: 'sqft', quantitySource: 'user_entered' },
      {},
      null,
      notes
    );
    expect(unmeasured.fill).toBeNull();
  });

  it('prices one marble doorway threshold each, apart from the floor sqft', () => {
    const notes =
      'Remodel the bathroom. Demo the bathroom floor tile only. Scrape the thinset and haul off the old tile. Install new bathroom floor tile wall to wall, and set a new marble threshold at the doorway.';
    const measurements = {
      bathroomFloorSqft: '125',
      itemQuantities: {},
    };
    const quantity = resolveChecklistItemQuantity(
      'marble_threshold',
      measurements as never,
      { templateKey: 'bathroom', notes }
    );
    const threshold = resolveScopeItemSuggestedPricing(
      'marble_threshold',
      measurements,
      'bathroom',
      quantity,
      {},
      null,
      notes
    );
    const floorTile = resolveScopeItemSuggestedPricing(
      'floor_tile',
      measurements,
      'bathroom',
      { quantity: 125, unit: 'sqft', quantitySource: 'user_entered' },
      {},
      null,
      notes
    );

    expect(quantity.quantity).toBe(1);
    expect(quantity.unit).toBe('each');
    expect(threshold.fill?.total).toBe(350);
    expect(threshold.fill?.material).toBe(185);
    expect(threshold.fill?.labor).toBe(165);
    expect(threshold.fill?.basis).toMatchObject({ quantity: 1, unit: 'each' });
    expect(floorTile.fill?.total).toBe(1250);
  });

  it('prices a kept shower door as a pull and a rehang, not a new door', () => {
    const notes =
      'Remodel the bathroom. Tear out the existing shower wall tile and the tile shower pan. Install new shower wall tile and a new tile shower pan. Keep the existing shower door. Leave the bathroom floor, vanity, and toilet. No paint.';
    const measurements = { itemQuantities: {} };
    const remove = resolveScopeItemSuggestedPricing(
      'glass_door_reuse_remove',
      measurements,
      'bathroom',
      resolveChecklistItemQuantity('glass_door_reuse_remove', measurements as never, {
        templateKey: 'bathroom',
        notes,
      }),
      {},
      null,
      notes
    );
    const rehang = resolveScopeItemSuggestedPricing(
      'glass_door_reuse_install',
      measurements,
      'bathroom',
      resolveChecklistItemQuantity('glass_door_reuse_install', measurements as never, {
        templateKey: 'bathroom',
        notes,
      }),
      {},
      null,
      notes
    );
    expect(remove.fill?.total).toBe(150);
    expect(remove.fill?.material).toBe(25);
    expect(remove.fill?.labor).toBe(125);
    expect(rehang.fill?.total).toBe(320);
    expect(rehang.fill?.material).toBe(40);
    expect(rehang.fill?.labor).toBe(280);
    expect(rehang.fill?.basis).toMatchObject({ quantity: 1, unit: 'each' });
  });
});
