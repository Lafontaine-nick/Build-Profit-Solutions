import {
  calculateFormulaForScope,
  executeFormula,
  resolveFormulaQuantityApplyTarget,
  shouldShowFormulaQuantityButton,
  shouldSkipCountertopCabinetLfFormula,
  usesAutoFlatworkSqftPricing,
} from '@/utils/scopeFormulaRegistry';
import {
  initialScopeMeasurementInputExtended,
  resolveScopeItemSuggestedPricing,
  resolveChecklistItemQuantity,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import { syncSelectedScopePricing, getScopePackages, type EstimateAiDraft } from '@/utils/estimateAiDraft';
import { emptyQuickMeasurementInput } from '@/utils/scopeQuickMeasurements';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';

describe('resolveFormulaQuantityApplyTarget', () => {
  it('applies slab sqft for flatwork pricing instead of converted CY volume', () => {
    const formula = executeFormula('flatwork_cy_from_area_thickness', { areaSqft: 300 });
    expect(formula).not.toBeNull();
    expect(formula?.roundedValue).toBe(3.7);

    const applyTarget = resolveFormulaQuantityApplyTarget({
      scopeKey: 'concrete',
      formula: formula!,
    });

    expect(applyTarget.unit).toBe('sqft');
    expect(applyTarget.quantity).toBe(300);
    expect(applyTarget.buttonLabel).toMatch(/300 sqft slab area for pricing/i);
  });

  it('uses the selected slab thickness for the concrete volume cross-check', () => {
    const formula = executeFormula('flatwork_cy_from_area_thickness', {
      areaSqft: 300,
      thicknessInches: 5,
    });

    expect(formula?.roundedValue).toBe(4.6);
    expect(formula?.formulaExplanation).toMatch(/5 in thick/);
    expect(formula?.assumptionsUsed).toHaveLength(0);
  });

  it('prices concrete at national-average sqft rates after applying slab sqft', () => {
    const draft = {
      scopeChecklist: { templateKey: 'addition' },
      originalNotes: '25 CY concrete for ADU slab.',
      scopeMeasurements: { concreteCy: 25, concreteSqft: 300, itemQuantities: {} },
    } as unknown as EstimateAiDraft;

    const input = initialScopeMeasurementInputExtended(draft);
    const resolved = resolveChecklistItemQuantity('concrete', input, {
      templateKey: 'addition',
      notes: draft.originalNotes,
    });
    const resolvedSqft = {
      ...resolved,
      quantity: 300,
      unit: 'sqft',
      quantitySource: 'calculated_confirmed' as const,
      dualCount: { quantity: 300, unit: 'sqft' },
    };

    const pricing = resolveScopeItemSuggestedPricing(
      'concrete',
      input,
      'addition',
      resolvedSqft
    );

    expect(pricing.fill?.total).toBe(3000);
    expect(pricing.fill?.material).toBe(1200);
    expect(pricing.fill?.labor).toBe(1800);
    expect(pricing.fill?.basis).toEqual({ quantity: 300, unit: 'sqft' });
  });

  it('scales the concrete material leg by selected slab thickness', () => {
    const draft = {
      scopeChecklist: { templateKey: 'concrete' },
      originalNotes: '100 sqft driveway.',
      scopeMeasurements: {
        concreteSqft: 100,
        concreteThicknessInches: 5,
        itemQuantities: {},
      },
    } as unknown as EstimateAiDraft;

    const input = initialScopeMeasurementInputExtended(draft);
    const resolved = resolveChecklistItemQuantity('pour_flatwork', input, {
      templateKey: 'concrete',
      notes: draft.originalNotes,
    });
    const pricing = resolveScopeItemSuggestedPricing('pour_flatwork', input, 'concrete', resolved);

    expect(pricing.fill).toMatchObject({
      material: 795.45,
      labor: 954.55,
      total: 1750,
    });
    expect(pricing.fill?.rateSourceLabel).toMatch(/5" slab basis/i);
  });

  it('applies one small-job minimum to standard flatwork only', () => {
    const draft = {
      scopeChecklist: { templateKey: 'concrete' },
      scopeMeasurements: { concreteSqft: 100, concreteThicknessInches: 4, itemQuantities: {} },
    } as unknown as EstimateAiDraft;
    const input = initialScopeMeasurementInputExtended(draft);
    const resolved = resolveChecklistItemQuantity('pour_flatwork', input, { templateKey: 'concrete' });
    const pricing = resolveScopeItemSuggestedPricing('pour_flatwork', input, 'concrete', resolved);

    expect(pricing.fill?.total).toBe(1750);
    expect(pricing.fill?.helper).toMatch(/minimum charge/i);
  });

  it('prices sealer and selected decorative finish as additive upgrades', () => {
    const draft = {
      scopeChecklist: { templateKey: 'concrete' },
      scopeMeasurements: {
        concreteSqft: 100,
        concreteSealerSqft: 100,
        concreteDecorativeFinish: 'basic_stamped',
        itemQuantities: {},
      },
    } as unknown as EstimateAiDraft;
    const input = initialScopeMeasurementInputExtended(draft);
    const sealer = resolveScopeItemSuggestedPricing(
      'concrete_sealer',
      input,
      'concrete',
      resolveChecklistItemQuantity('concrete_sealer', input, { templateKey: 'concrete' })
    );
    const decorative = resolveScopeItemSuggestedPricing(
      'decorative_finish',
      input,
      'concrete',
      resolveChecklistItemQuantity('decorative_finish', input, { templateKey: 'concrete' })
    );

    expect(sealer.fill?.total).toBe(150);
    expect(sealer.fill?.material).toBe(60);
    expect(sealer.fill?.labor).toBe(90);
    expect(decorative.fill?.total).toBe(500);
  });

  it('separates basic subgrade prep from CY excavation', () => {
    const draft = {
      scopeChecklist: { templateKey: 'concrete' },
      scopeMeasurements: { concreteSubgradePrepSqft: 500, excavationCy: 20, itemQuantities: {} },
    } as unknown as EstimateAiDraft;
    const input = initialScopeMeasurementInputExtended(draft);
    const prep = resolveScopeItemSuggestedPricing(
      'site_prep',
      input,
      'concrete',
      resolveChecklistItemQuantity('site_prep', input, { templateKey: 'concrete' })
    );
    const excavation = resolveScopeItemSuggestedPricing(
      'excavation',
      input,
      'concrete',
      resolveChecklistItemQuantity('excavation', input, { templateKey: 'concrete' })
    );

    expect(prep.fill?.total).toBe(1000);
    expect(excavation.fill?.total).toBe(1900);
  });

  it('uses excavation quantity bands and applies the small-volume minimum', () => {
    const inputFor = (excavationCy: number) =>
      initialScopeMeasurementInputExtended({
        scopeChecklist: { templateKey: 'concrete' },
        scopeMeasurements: { excavationCy, itemQuantities: {} },
      } as unknown as EstimateAiDraft);
    const smallInput = inputFor(1.85);
    const largeInput = inputFor(50);
    const small = resolveScopeItemSuggestedPricing(
      'excavation',
      smallInput,
      'concrete',
      resolveChecklistItemQuantity('excavation', smallInput, { templateKey: 'concrete' })
    );
    const large = resolveScopeItemSuggestedPricing(
      'excavation',
      largeInput,
      'concrete',
      resolveChecklistItemQuantity('excavation', largeInput, { templateKey: 'concrete' })
    );

    expect(small.fill?.total).toBe(350);
    expect(large.fill?.total).toBe(4250);
    expect(small.fill?.helper).toMatch(/minimum applied/i);
  });

  it('prices footing concrete by CY without flatwork minimums or sqft rates', () => {
    const draft = {
      scopeChecklist: { templateKey: 'concrete' },
      scopeMeasurements: { concreteCy: 50, itemQuantities: {} },
    } as unknown as EstimateAiDraft;
    const input = initialScopeMeasurementInputExtended(draft);
    const footing = resolveScopeItemSuggestedPricing(
      'pour_foundation',
      input,
      'concrete',
      resolveChecklistItemQuantity('pour_foundation', input, { templateKey: 'concrete' })
    );

    expect(footing.fill?.total).toBe(17500);
    expect(footing.fill?.helper).not.toMatch(/minimum charge/i);
  });

  it('prices selected flatwork types at their own thickness and applies one combined minimum', () => {
    const draft = {
      scopeChecklist: { templateKey: 'concrete' },
      scopeMeasurements: {
        concreteSqft: 200,
        concreteAreaByType: { driveways: 100, sidewalks: 50, walkways: 50 },
        concreteThicknessByType: { driveways: 6, sidewalks: 4, walkways: 4 },
        itemQuantities: {},
      },
    } as unknown as EstimateAiDraft;
    const input = initialScopeMeasurementInputExtended(draft);
    const flatwork = resolveScopeItemSuggestedPricing(
      'pour_flatwork',
      input,
      'concrete',
      resolveChecklistItemQuantity('pour_flatwork', input, { templateKey: 'concrete' })
    );

    expect(flatwork.fill?.total).toBe(2200);
  });

  it('prices concrete demo by thickness band and optional removal conditions', () => {
    const draft = {
      scopeChecklist: { templateKey: 'concrete' },
      scopeMeasurements: {
        concreteDemoSqft: 500,
        concreteDemoThicknessBand: 'standard_4',
        concreteDemoReinforced: true,
        concreteDemoLimitedAccess: true,
        itemQuantities: {},
      },
    } as unknown as EstimateAiDraft;
    const input = initialScopeMeasurementInputExtended(draft);
    const demo = resolveScopeItemSuggestedPricing(
      'demo_removal',
      input,
      'concrete',
      resolveChecklistItemQuantity('demo_removal', input, { templateKey: 'concrete' })
    );

    expect(demo.fill).toMatchObject({
      material: 2125,
      labor: 1250,
      total: 3375,
    });
  });

  it('uses the thin and heavy concrete demo planning bands', () => {
    const draft = {
      scopeChecklist: { templateKey: 'concrete' },
      scopeMeasurements: { concreteDemoSqft: 100, concreteDemoThicknessBand: 'thin_2_3', itemQuantities: {} },
    } as unknown as EstimateAiDraft;
    const input = initialScopeMeasurementInputExtended(draft);
    const thin = resolveScopeItemSuggestedPricing(
      'demo_removal',
      input,
      'concrete',
      resolveChecklistItemQuantity('demo_removal', input, { templateKey: 'concrete' })
    );
    const heavyInput = initialScopeMeasurementInputExtended({
      ...draft,
      scopeMeasurements: { concreteDemoSqft: 100, concreteDemoThicknessBand: 'heavy_5_6', itemQuantities: {} },
    } as unknown as EstimateAiDraft);
    const heavy = resolveScopeItemSuggestedPricing(
      'demo_removal',
      heavyInput,
      'concrete',
      resolveChecklistItemQuantity('demo_removal', heavyInput, { templateKey: 'concrete' })
    );

    expect(thin.fill?.total).toBe(300);
    expect(heavy.fill?.total).toBe(550);
  });

  it('requires CY review pricing for structural concrete demo', () => {
    const draft = {
      scopeChecklist: { templateKey: 'concrete' },
      scopeMeasurements: {
        concreteDemoThicknessBand: 'structural_7_plus',
        concreteDemoCy: 10,
        itemQuantities: {},
      },
    } as unknown as EstimateAiDraft;
    const input = initialScopeMeasurementInputExtended(draft);
    const demo = resolveScopeItemSuggestedPricing(
      'demo_removal',
      input,
      'concrete',
      resolveChecklistItemQuantity('demo_removal', input, { templateKey: 'concrete' })
    );

    expect(demo.fill?.total).toBe(1750);
    expect(demo.fill?.isComparison).toBe(true);
  });

  it('prices multiple concrete demo thickness bands together without separate minimums', () => {
    const draft = {
      scopeChecklist: { templateKey: 'concrete' },
      scopeMeasurements: {
        concreteDemoSqft: 150,
        concreteDemoThicknessBands: ['standard_4', 'heavy_5_6'],
        concreteDemoAreaByThickness: { standard_4: 100, heavy_5_6: 50 },
        itemQuantities: {},
      },
    } as unknown as EstimateAiDraft;
    const input = initialScopeMeasurementInputExtended(draft);
    const demo = resolveScopeItemSuggestedPricing(
      'demo_removal',
      input,
      'concrete',
      resolveChecklistItemQuantity('demo_removal', input, { templateKey: 'concrete' })
    );

    expect(demo.fill?.total).toBe(675);
    expect(demo.fill?.basis).toEqual({ quantity: 150, unit: 'sqft' });
  });

  it('derives dirt excavation CY without creating concrete demo pricing', () => {
    const draft = {
      scopeChecklist: { templateKey: 'concrete' },
      scopeMeasurements: {
        excavationAreaSqft: 500,
        excavationDepthInches: 6,
        itemQuantities: {},
      },
    } as unknown as EstimateAiDraft;
    const input = initialScopeMeasurementInputExtended(draft);
    const excavation = resolveChecklistItemQuantity('excavation', input, { templateKey: 'concrete' });
    const pricing = resolveScopeItemSuggestedPricing('excavation', input, 'concrete', excavation);
    const demo = resolveChecklistItemQuantity('demo_removal', input, { templateKey: 'concrete' });

    expect(excavation.quantity).toBe(9.26);
    expect(pricing.fill?.total).toBe(787.1);
    expect(demo.quantity).toBeNull();
  });

  it('parses dirt depth separately from concrete demolition thickness', () => {
    const parsed = parseScopeMeasurementsFromNotes('Excavate 6 inches of dirt over a 500 sqft patio area.');
    expect(parsed.excavationAreaSqft).toBe(500);
    expect(parsed.excavationDepthInches).toBe(6);
    expect(parsed.excavationCy).toBe(9.26);
    expect(parsed.concreteDemoSqft).toBeUndefined();
  });

  it('does not price legacy standard forming or finish add-ons for concrete', () => {
    const draft = {
      scopeChecklist: { templateKey: 'concrete' },
      scopeMeasurements: { concreteSqft: 100, itemQuantities: {} },
    } as unknown as EstimateAiDraft;
    const input = initialScopeMeasurementInputExtended(draft);

    for (const itemId of ['forms', 'finish_seal', 'cleanup']) {
      const resolved = resolveChecklistItemQuantity(itemId, input, { templateKey: 'concrete' });
      expect(resolveScopeItemSuggestedPricing(itemId, input, 'concrete', resolved).fill).toBeNull();
    }
  });

  it('does not auto-preview drywall formula quantity in suggested pricing basis', () => {
    const formula = executeFormula('surface_area_from_floor_area_benchmark', { floorAreaSqft: 700 });
    expect(formula).not.toBeNull();
    expect(formula?.roundedValue).toBe(2450);
    expect(
      usesAutoFlatworkSqftPricing({ scopeKey: 'drywall', formula: formula! })
    ).toBe(false);

    const draft = {
      scopeChecklist: { templateKey: 'addition' },
      originalNotes: '1000 sqft drywall patch and hang.',
      scopeMeasurements: {
        drywallSqft: 1000,
        floorAreaSqft: 700,
        itemQuantities: {},
      },
    } as unknown as EstimateAiDraft;

    const input = initialScopeMeasurementInputExtended(draft);
    const resolved = resolveChecklistItemQuantity('drywall', input, {
      templateKey: 'addition',
      notes: draft.originalNotes,
    });
    const pricing = resolveScopeItemSuggestedPricing('drywall', input, 'addition', resolved);

    expect(Number(resolved.quantity)).toBe(1000);
    // National hang/finish ~$2.10/SF (+ light geo) — not the old $4.50/SF band.
    expect(pricing.fill?.material).toBe(880);
    expect(pricing.fill?.labor).toBe(1290);
    expect(pricing.fill?.total).toBe(2170);
    expect(pricing.fill?.basis).toEqual({ quantity: 1000, unit: 'sqft' });
  });

  it('preserves applied sqft overrides for addition concrete instead of coercing to CY', () => {
    const draft = {
      scopeChecklist: { templateKey: 'addition' },
      originalNotes: '25 CY concrete for ADU slab.',
      scopeMeasurements: {
        concreteCy: 25,
        concreteSqft: 300,
        itemQuantities: {
          concrete: { quantity: 300, unit: 'sqft', quantitySource: 'calculated_confirmed' },
        },
      },
    } as unknown as EstimateAiDraft;

    const input = initialScopeMeasurementInputExtended(draft);
    const resolved = resolveChecklistItemQuantity('concrete', input, {
      templateKey: 'addition',
      notes: draft.originalNotes,
    });

    expect(Number(resolved.quantity)).toBe(300);
    expect(resolved.unit).toBe('sqft');
    expect(resolved.quantitySource).toBe('calculated_confirmed');
  });

  it('auto-applies slab sqft for addition concrete when concreteSqft is available', () => {
    const draft = {
      scopeChecklist: { templateKey: 'addition' },
      originalNotes: '25 CY concrete for ADU slab.',
      scopeMeasurements: {
        concreteCy: 25,
        concreteSqft: 300,
        itemQuantities: {},
      },
    } as unknown as EstimateAiDraft;

    const input = initialScopeMeasurementInputExtended(draft);
    const resolved = resolveChecklistItemQuantity('concrete', input, {
      templateKey: 'addition',
      notes: draft.originalNotes,
    });

    expect(Number(resolved.quantity)).toBe(300);
    expect(resolved.unit).toBe('sqft');
    expect(resolved.quantitySource).toBe('inferred');
  });

  it('hides the calculated-quantity button for auto-applied flatwork sqft pricing', () => {
    const formula = executeFormula('flatwork_cy_from_area_thickness', { areaSqft: 300 });
    expect(formula).not.toBeNull();
    expect(
      shouldShowFormulaQuantityButton({ scopeKey: 'concrete', formula: formula! })
    ).toBe(false);
    expect(
      usesAutoFlatworkSqftPricing({ scopeKey: 'concrete', formula: formula! })
    ).toBe(true);
  });

  it('keeps calculated_confirmed paint sqft over notes-backed quick measurements', () => {
    const input = initialScopeMeasurementInputExtended({
      scopeChecklist: { templateKey: 'addition' },
      originalNotes: '1000 sqft interior paint.',
      scopeMeasurements: {
        wallPaintSqft: 1000,
        floorAreaSqft: 800,
        itemQuantities: {
          paint: { quantity: 2560, unit: 'sqft', quantitySource: 'calculated_confirmed' },
        },
      },
    } as unknown as EstimateAiDraft);

    const resolved = resolveChecklistItemQuantity('paint', input, {
      templateKey: 'addition',
      notes: '1000 sqft interior paint.',
    });
    const payload = scopeMeasurementsPayloadForPersist(input, {
      templateKey: 'addition',
      notes: '1000 sqft interior paint.',
    });

    expect(Number(resolved.quantity)).toBe(2560);
    expect(payload.wallPaintSqft).toBe(2560);
  });

  it('syncs calculated quantities into Step 3 scope package quantities', () => {
    const draft = {
      scopeChecklist: { templateKey: 'addition' },
      originalNotes: '1000 sqft drywall and 1000 sqft paint for ADU.',
      scopePackages: [
        {
          name: 'Interior Painting',
          scope: 'Prep, labor, and paint for walls/ceiling.',
          scopeQuantities: [{ quantity: 1000, unit: 'sqft' }],
          price: 3350,
          knownSubtotal: 3350,
          materialPrice: 850,
          laborPrice: 2500,
          priceSource: 'user_provided',
          status: 'user_provided',
        },
      ],
      scopeMeasurements: {
        wallPaintSqft: 1000,
        drywallSqft: 1000,
        floorAreaSqft: 800,
        itemQuantities: {
          paint: { quantity: 2560, unit: 'sqft', quantitySource: 'calculated_confirmed' },
        },
      },
    } as unknown as EstimateAiDraft;

    const synced = syncSelectedScopePricing(draft);
    const paintPkg = getScopePackages(synced).find((pkg) => /paint/i.test(pkg.name));

    expect(paintPkg?.scopeQuantities?.[0]).toEqual({ quantity: 2560, unit: 'sqft' });
  });

  it('does not offer cabinet-LF × depth countertop formula on ground_up (whole-home LF)', () => {
    expect(shouldSkipCountertopCabinetLfFormula('ground_up')).toBe(true);
    expect(shouldSkipCountertopCabinetLfFormula('kitchen')).toBe(false);

    const measurements = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '1879',
      cabinetLf: '120',
      itemQuantities: {},
    } as any;

    expect(
      calculateFormulaForScope({
        scopeKey: 'countertops',
        measurements,
        projectContext: 'ground_up',
      })
    ).toBeNull();

    // Kitchen remodel still uses topped-run LF × depth.
    expect(
      calculateFormulaForScope({
        scopeKey: 'countertops',
        measurements: { ...measurements, cabinetLf: '24' } as any,
        projectContext: 'kitchen',
      })
    ).toMatchObject({ roundedValue: 50, unit: 'sqft' });

    const formula = executeFormula('countertop_area_from_cabinet_lf', {
      cabinetLf: 120,
      countertopDepthFt: 2.083,
    });
    expect(formula?.roundedValue).toBe(250);
    expect(
      shouldShowFormulaQuantityButton({
        scopeKey: 'countertops',
        formula: formula!,
        projectContext: 'ground_up',
      })
    ).toBe(false);
  });

  it('prioritizes an entered countertop sqft takeoff over cabinet-LF planning math', () => {
    const formula = calculateFormulaForScope({
      scopeKey: 'countertops',
      measurements: {
        ...emptyQuickMeasurementInput(),
        countertopSqft: '50',
        cabinetLf: '100',
      } as any,
      projectContext: 'kitchen',
    });

    expect(formula).toMatchObject({
      formulaKey: 'countertop_area_from_explicit_takeoff',
      roundedValue: 50,
      unit: 'sqft',
    });
  });

  it('prices kitchen backsplash demo from the backsplash sqft takeoff', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      backsplashSqft: '40',
      itemQuantities: {},
    } as any;
    const resolved = resolveChecklistItemQuantity('backsplash_demo', input, {
      templateKey: 'kitchen',
    });
    const pricing = resolveScopeItemSuggestedPricing('backsplash_demo', input, 'kitchen', resolved);

    expect(resolved.quantity).toBe(40);
    expect(pricing.fill).toMatchObject({
      material: 20,
      labor: 200,
      total: 220,
      basis: { quantity: 40, unit: 'sqft' },
    });
  });

  it('prices generic plumbing connections by connection count, not sqft', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      itemQuantities: {},
    } as any;
    const resolved = resolveChecklistItemQuantity('plumbing', input, {
      templateKey: 'kitchen',
    });
    const pricing = resolveScopeItemSuggestedPricing('plumbing', input, 'kitchen', resolved);

    expect(resolved).toMatchObject({ quantity: 1, unit: 'each' });
    expect(pricing.fill).toMatchObject({
      material: 100,
      labor: 200,
      total: 300,
      basis: { quantity: 1, unit: 'each' },
    });
  });

  it('prices kitchen plumbing connections by selected connection type', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      itemQuantities: {},
    } as any;
    const resolved = resolveChecklistItemQuantity('plumbing', input, {
      templateKey: 'kitchen',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'plumbing',
      input,
      'kitchen',
      resolved,
      undefined,
      'gas_existing_shutoff'
    );

    expect(pricing.fill).toMatchObject({
      material: 50,
      labor: 175,
      total: 225,
      basis: { quantity: 1, unit: 'each' },
    });
  });

  it('adds pricing when multiple plumbing connection types are selected', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      itemQuantities: {
        plumbing: { quantity: '2', unit: 'each', quantitySource: 'user_entered' },
      },
    } as any;
    const resolved = resolveChecklistItemQuantity('plumbing', input, {
      templateKey: 'kitchen',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'plumbing',
      input,
      'kitchen',
      resolved,
      undefined,
      'gas_existing_shutoff,gas_branch_line'
    );

    expect(pricing.fill).toMatchObject({
      material: 450,
      labor: 1500,
      total: 1950,
      basis: { quantity: 2, unit: 'each' },
    });
  });

  it('prices each selected plumbing connection with its own count', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      itemQuantities: {
        plumbing: { quantity: '1', unit: 'each', quantitySource: 'user_entered' },
        plumbing__dishwasher_hookup: { quantity: '2', unit: 'each', quantitySource: 'user_entered' },
        plumbing__gas_existing_shutoff: { quantity: '1', unit: 'each', quantitySource: 'user_entered' },
      },
    } as any;
    const resolved = resolveChecklistItemQuantity('plumbing', input, {
      templateKey: 'kitchen',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'plumbing',
      input,
      'kitchen',
      resolved,
      undefined,
      'dishwasher_hookup,gas_existing_shutoff'
    );

    expect(pricing.fill).toMatchObject({
      material: 150,
      labor: 625,
      total: 775,
      basis: { quantity: 3, unit: 'each' },
    });
  });

  it('adds pricing when multiple lighting types are selected', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      itemQuantities: {
        lighting: { quantity: '2', unit: 'each', quantitySource: 'user_entered' },
      },
    } as any;
    const resolved = resolveChecklistItemQuantity('lighting', input, {
      templateKey: 'bathroom',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'lighting',
      input,
      'bathroom',
      resolved,
      undefined,
      'standard_existing_location,new_recessed_led'
    );

    expect(pricing.fill).toMatchObject({
      material: 400,
      labor: 750,
      total: 1150,
      basis: { quantity: 2, unit: 'each' },
    });
  });

  it('prices wall removal and wall construction as separate linear-foot rates', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      itemQuantities: {
        walls_moving__remove: { quantity: '10', unit: 'lf', quantitySource: 'user_entered' },
        walls_moving__add: { quantity: '10', unit: 'lf', quantitySource: 'user_entered' },
      },
    } as any;
    const resolved = resolveChecklistItemQuantity('walls_moving', input, {
      templateKey: 'kitchen',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'walls_moving',
      input,
      'kitchen',
      resolved,
      undefined,
      'remove,add'
    );

    expect(pricing.fill).toMatchObject({
      material: 280,
      labor: 630,
      total: 910,
      basis: { quantity: 20, unit: 'lf' },
    });
  });

  it('does not show wall pricing until linear feet are entered', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      itemQuantities: {},
    } as any;
    const pricingInput = {
      ...input,
      itemQuantities: {},
    };
    const resolved = resolveChecklistItemQuantity('walls_moving', input, {
      templateKey: 'kitchen',
    });
    const pricing = resolveScopeItemSuggestedPricing(
      'walls_moving',
      pricingInput,
      'kitchen',
      resolved,
      undefined,
      'remove'
    );

    expect(pricing.fill).toBeNull();
  });

  it('hides paintable-SF takeoff button for interior paint installed budgets', () => {
    const formula = executeFormula('paintable_area_from_floor_area_benchmark', {
      floorAreaSqft: 1879,
      surfaceMultiplier: 3.2,
    });
    expect(formula?.roundedValue).toBe(6013);
    expect(
      shouldShowFormulaQuantityButton({
        scopeKey: 'interior_paint',
        formula: formula!,
      })
    ).toBe(false);
    expect(
      shouldShowFormulaQuantityButton({
        scopeKey: 'paint',
        formula: formula!,
      })
    ).toBe(false);
  });

  it('hides drywall surface-multiplier button (auto-applied on ground-up)', () => {
    const formula = executeFormula('surface_area_from_floor_area_benchmark', {
      floorAreaSqft: 3098,
    });
    expect(formula?.roundedValue).toBe(10843);
    expect(
      shouldShowFormulaQuantityButton({
        scopeKey: 'drywall',
        formula: formula!,
      })
    ).toBe(false);
  });

  it('prices ground-up counters on ~80 SF planning, not 120 LF × depth = 250 SF', () => {
    const input = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '1879',
      cabinetLf: '120',
      itemQuantities: {
        countertops: {
          quantity: '250',
          unit: 'sqft',
          quantitySource: 'calculated_confirmed',
        },
      },
    } as any;
    const resolved = resolveChecklistItemQuantity('countertops', input, {
      templateKey: 'ground_up',
    });
    const { fill } = resolveScopeItemSuggestedPricing('countertops', input, 'ground_up', resolved);
    expect(fill?.basis).toEqual({ quantity: 80, unit: 'sqft' });
    expect(fill?.basis?.quantity).not.toBe(250);
  });

  it('does not calculate bath floor tile from whole-home living SF', () => {
    const livingOnly = {
      ...emptyQuickMeasurementInput(),
      floorAreaSqft: '1879',
      flooringSqft: '1879',
      itemQuantities: {},
    } as any;

    expect(
      calculateFormulaForScope({
        scopeKey: 'floor_tile',
        measurements: livingOnly,
        projectContext: 'ground_up',
      })
    ).toBeNull();

    const withBathFloor = {
      ...livingOnly,
      bathroomFloorSqft: '95',
    };
    const formula = calculateFormulaForScope({
      scopeKey: 'floor_tile',
      measurements: withBathFloor,
      projectContext: 'ground_up',
    });
    expect(formula).toMatchObject({
      formulaKey: 'bath_floor_tile_with_waste',
      // 95 × 1.10 tile waste
      roundedValue: 105,
      unit: 'sqft',
    });
    expect(formula?.formulaExplanation).toMatch(/bathroom floor/i);
    expect(formula?.roundedValue).not.toBe(2029);
  });
});
