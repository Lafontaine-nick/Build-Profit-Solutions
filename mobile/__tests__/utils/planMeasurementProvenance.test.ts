import {
  resolvePlanMeasurementProvenance,
} from '@/utils/planMeasurementProvenance';

describe('plan measurement provenance', () => {
  it('labels explicit plan values as verified', () => {
    expect(
      resolvePlanMeasurementProvenance({
        key: 'floorAreaSqft',
        hasExplicitPlanSource: true,
        fieldConfidence: 0.98,
      }).status
    ).toBe('plan_verified');
  });

  it('labels electrical symbol counts and inferences without promoting them to Plan verified', () => {
    expect(
      resolvePlanMeasurementProvenance({
        key: 'standardReceptacleCount',
        fromPlanSymbols: true,
      })
    ).toMatchObject({
      status: 'from_plan_symbols',
      label: 'From plan — confirm',
    });
    expect(
      resolvePlanMeasurementProvenance({
        key: 'gfciReceptacleCount',
        aiInferred: true,
      })
    ).toMatchObject({
      status: 'ai_inferred',
      label: 'AI inferred — confirm',
    });
  });

  it('labels a reconciled dual-pass symbol count as AI verified', () => {
    expect(
      resolvePlanMeasurementProvenance({
        key: 'standardReceptacleCount',
        aiVerified: true,
        fieldConfidence: 0.82,
      })
    ).toMatchObject({
      status: 'ai_verified',
      label: 'AI verified',
      confidence: 'medium',
    });
  });

  it('labels dimension-derived values as calculated', () => {
    expect(
      resolvePlanMeasurementProvenance({
        key: 'kitchenFloorSqft',
        hasReliableDimensions: true,
      }).status
    ).toBe('calculated');
  });

  it('downgrades room-dependent values when coverage is materially incomplete', () => {
    expect(
      resolvePlanMeasurementProvenance({
        key: 'room:Kitchen',
        hasReliableDimensions: true,
        roomDependent: true,
        reconciliationVariancePercent: 63.2,
      }).status
    ).toBe('needs_review');
  });

  it('keeps contractor-confirmed values distinct from plan extraction', () => {
    expect(
      resolvePlanMeasurementProvenance({
        key: 'ceilingHeight',
        userConfirmed: true,
      }).status
    ).toBe('user_confirmed');
  });

  it('does not promote blocked pricing to AI verified', () => {
    expect(
      resolvePlanMeasurementProvenance({
        key: 'threeWaySwitchCount',
        aiVerified: true,
        fromPlanSymbols: true,
        pricingEligible: false,
      })
    ).toMatchObject({
      status: 'from_plan_symbols',
      label: 'From plan — confirm',
    });
  });
});
