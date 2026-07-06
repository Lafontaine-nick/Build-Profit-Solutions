import {
  executeFormula,
  resolveFormulaQuantityApplyTarget,
  shouldShowFormulaQuantityButton,
  usesAutoFlatworkSqftPricing,
} from '@/utils/scopeFormulaRegistry';
import {
  initialScopeMeasurementInputExtended,
  resolveScopeItemSuggestedPricing,
  resolveChecklistItemQuantity,
} from '@/utils/scopeItemQuantities';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

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
});
