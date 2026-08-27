import {
  composeTrimFinishChoiceId,
  describeTrimFinishLfDerivation,
  deriveTrimFinishLfFromMeasurements,
  parseTrimFinishChoice,
  resolveTrimFinishSuggestedPricing,
  splitTrimFinishChoice,
  TRIM_FINISH_LF_PER_OPENING,
  TRIM_FINISH_NATIONAL_RATES,
} from '@/utils/windowsDoorsTrimFinishPricing';
import {
  getChecklistItemQuantityRule,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';

describe('windowsDoorsTrimFinishPricing', () => {
  const lot39Counts = {
    windowCount: 14,
    exteriorDoorCount: 3,
    slidingDoorCount: 2,
    interiorDoorCount: 10,
  };

  it('derives interior-only LF from opening counts', () => {
    const lf = deriveTrimFinishLfFromMeasurements(
      lot39Counts,
      'interior_paint_grade'
    );
    expect(lf).toBe(
      lot39Counts.windowCount * TRIM_FINISH_LF_PER_OPENING.windowInterior +
        lot39Counts.interiorDoorCount *
          TRIM_FINISH_LF_PER_OPENING.interiorDoorInterior
    );
  });

  it('derives exterior-only LF from opening counts', () => {
    const lf = deriveTrimFinishLfFromMeasurements(
      lot39Counts,
      'exterior_stain_grade'
    );
    expect(lf).toBe(
      lot39Counts.windowCount * TRIM_FINISH_LF_PER_OPENING.windowExterior +
        lot39Counts.exteriorDoorCount *
          TRIM_FINISH_LF_PER_OPENING.exteriorDoorExterior +
        lot39Counts.slidingDoorCount *
          TRIM_FINISH_LF_PER_OPENING.slidingDoorExterior
    );
  });

  it('derives both sides LF as the sum of interior and exterior scopes', () => {
    const both = deriveTrimFinishLfFromMeasurements(
      lot39Counts,
      'both_unfinished'
    );
    const interior = deriveTrimFinishLfFromMeasurements(
      lot39Counts,
      'interior_unfinished'
    );
    const exterior = deriveTrimFinishLfFromMeasurements(
      lot39Counts,
      'exterior_unfinished'
    );
    expect(both).toBe((interior ?? 0) + (exterior ?? 0));
  });

  it('prices stain-grade higher than paint-grade for the same LF', () => {
    const paint = resolveTrimFinishSuggestedPricing({
      choiceId: 'both_paint_grade',
      linearFeet: 200,
      fieldFinishIncluded: true,
    });
    const stain = resolveTrimFinishSuggestedPricing({
      choiceId: 'both_stain_grade',
      linearFeet: 200,
      fieldFinishIncluded: true,
    });
    expect(paint?.total).toBeLessThan(stain?.total ?? 0);
    expect(parseTrimFinishChoice('both_stain_grade')).toEqual({
      coverage: 'both',
      grade: 'stain_grade',
    });
  });

  it('excludes field finish labor when the toggle is off', () => {
    const withFinish = resolveTrimFinishSuggestedPricing({
      choiceId: 'both_paint_grade',
      linearFeet: 200,
      fieldFinishIncluded: true,
    });
    const installOnly = resolveTrimFinishSuggestedPricing({
      choiceId: 'both_paint_grade',
      linearFeet: 200,
      fieldFinishIncluded: false,
    });
    expect(installOnly?.labor).toBeLessThan(withFinish?.labor ?? 0);
    expect(installOnly?.total).toBeLessThan(withFinish?.total ?? 0);
  });

  it('uses national planning defaults per LF', () => {
    const lf = 100;
    expect(
      resolveTrimFinishSuggestedPricing({
        choiceId: 'interior_paint_grade',
        linearFeet: lf,
        fieldFinishIncluded: false,
      })
    ).toMatchObject({
      material: 275,
      labor: 350,
      total: lf * TRIM_FINISH_NATIONAL_RATES.paint_grade.installOnly,
    });
    expect(
      resolveTrimFinishSuggestedPricing({
        choiceId: 'interior_paint_grade',
        linearFeet: lf,
        fieldFinishIncluded: true,
      })
    ).toMatchObject({
      material: 275,
      labor: 575,
      total: lf * TRIM_FINISH_NATIONAL_RATES.paint_grade.withFieldFinish,
    });
    expect(
      resolveTrimFinishSuggestedPricing({
        choiceId: 'interior_stain_grade',
        linearFeet: lf,
        fieldFinishIncluded: false,
      })
    ).toMatchObject({
      total: lf * TRIM_FINISH_NATIONAL_RATES.stain_grade.installOnly,
    });
    expect(
      resolveTrimFinishSuggestedPricing({
        choiceId: 'interior_stain_grade',
        linearFeet: lf,
        fieldFinishIncluded: true,
      })
    ).toMatchObject({
      total: lf * TRIM_FINISH_NATIONAL_RATES.stain_grade.withFieldFinish,
    });
    expect(
      resolveTrimFinishSuggestedPricing({
        choiceId: 'interior_unfinished',
        linearFeet: lf,
        fieldFinishIncluded: false,
      })
    ).toMatchObject({
      total: lf * TRIM_FINISH_NATIONAL_RATES.unfinished.installOnly,
    });
  });

  it('defaults new selections to install-only field finishing', () => {
    expect(
      resolveTrimFinishSuggestedPricing({
        choiceId: 'interior_paint_grade',
        linearFeet: 100,
      })?.total
    ).toBe(100 * TRIM_FINISH_NATIONAL_RATES.paint_grade.installOnly);
  });

  it('describes planning LF derivation from opening counts', () => {
    const derivation = describeTrimFinishLfDerivation(
      {
        windowCount: 18,
        interiorDoorCount: 12,
        exteriorDoorCount: 3,
        slidingDoorCount: 2,
      },
      'interior_paint_grade'
    );
    expect(derivation).toMatchObject({
      totalLf: 492,
      openingSummary: 'Calculated from 18 windows + 12 interior doors',
      breakdownLine: '18 windows × 16 LF + 12 interior doors × 17 LF',
    });

    const exterior = describeTrimFinishLfDerivation(
      {
        windowCount: 14,
        exteriorDoorCount: 3,
        slidingDoorCount: 2,
      },
      'exterior_paint_grade'
    );
    expect(exterior?.breakdownLine).toContain('sliding door');
    expect(exterior?.breakdownLine).toContain('exterior door');
  });

  it('composes and splits location × material choices', () => {
    expect(composeTrimFinishChoiceId('both', 'paint_grade')).toBe(
      'both_paint_grade'
    );
    expect(splitTrimFinishChoice('interior_stain_grade')).toEqual({
      coverage: 'interior',
      grade: 'stain_grade',
    });
  });

  it('declares trim_finish quantity rules and suggested pricing on the windows_doors template', () => {
    expect(getChecklistItemQuantityRule('trim_finish', 'windows_doors')).toMatchObject({
      defaultUnit: 'lf',
    });
    const quantity = resolveChecklistItemQuantity(
      'trim_finish',
      { ...lot39Counts, itemQuantities: {} },
      {
        templateKey: 'windows_doors',
        choiceId: 'both_paint_grade',
      }
    );
    expect(quantity.unit).toBe('lf');
    expect(quantity.quantity).toBeGreaterThan(0);
    const pricing = resolveScopeItemSuggestedPricing(
      'trim_finish',
      { ...lot39Counts, itemQuantities: {} },
      'windows_doors',
      { quantity: quantity.quantity, unit: 'lf', quantitySource: 'inferred' },
      {},
      'both_paint_grade'
    );
    expect(pricing.fill?.basis).toEqual({
      quantity: quantity.quantity,
      unit: 'lf',
    });
    expect(pricing.fill?.total).toBeGreaterThan(0);
  });
});
