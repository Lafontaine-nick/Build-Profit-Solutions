import {
  buildPlanReviewLockedProvenance,
  isPlanReviewLockedProvenance,
  planReviewLockProvenanceEntry,
  tagPlanReviewLockedQuickMeasurementSources,
} from '@/utils/planReviewMeasurementLock';

describe('planReviewMeasurementLock', () => {
  it('builds contractor-confirmed provenance for checked review rows', () => {
    const provenance = buildPlanReviewLockedProvenance(
      [
        {
          key: 'exteriorWallInsulationSqft',
          value: '3508.8',
          include: true,
          pricingEligible: true,
        },
        {
          key: 'atticInsulationSqft',
          value: '2260',
          include: true,
          pricingEligible: false,
        },
        {
          key: 'garageSqft',
          value: '781',
          include: false,
          pricingEligible: true,
        },
      ],
      {
        exteriorWallInsulationSqft: { page: 4 },
      }
    );

    expect(provenance.exteriorWallInsulationSqft).toMatchObject({
      value: 3508.8,
      page: 4,
      normalizedSource: 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW',
      confirmedFrom: 'PLAN_REVIEW',
      pricingEligible: true,
    });
    expect(provenance.atticInsulationSqft).toMatchObject({
      value: 2260,
      pricingEligible: false,
    });
    expect(provenance.garageSqft).toBeUndefined();
  });

  it('tags locked provenance for quick measurement sources', () => {
    const entry = planReviewLockProvenanceEntry(2260, {
      pricingEligible: false,
    });
    expect(isPlanReviewLockedProvenance(entry)).toBe(true);
    expect(
      tagPlanReviewLockedQuickMeasurementSources(
        { atticInsulationSqft: entry },
        ['atticInsulationSqft', 'exteriorWallInsulationSqft'],
        { exteriorWallInsulationSqft: 'detected_from_plan' }
      )
    ).toEqual({
      exteriorWallInsulationSqft: 'detected_from_plan',
      atticInsulationSqft: 'contractor_confirmed_from_plan_review',
    });
  });
});
