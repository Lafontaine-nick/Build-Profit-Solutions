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
    expect(pricing.fill?.material).toBe(1500);
    expect(pricing.fill?.labor).toBe(3000);
    expect(pricing.fill?.total).toBe(4500);
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
