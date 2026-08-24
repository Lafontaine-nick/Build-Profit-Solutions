import {
  buildDrywallStructuredMeasurements,
  drywallSurfaceFromComponents,
  drywallSurfacePlanningQuantity,
  isProtectedDrywallQuantity,
  isUndercountedDrywallSurface,
  normalizeDrywallPlanMeasurements,
  parseDrywallMeasurementsFromNotes,
} from '@/utils/subcontractorTrade/drywallPlanConvergence';
import { normalizeTradeMeasurements } from '@/utils/subcontractorTrade/convergence';

describe('drywall plan convergence', () => {
  test('does not turn living area into a plan takeoff', () => {
    expect(
      normalizeDrywallPlanMeasurements({
        floorAreaSqft: 3660,
        drywallSqft: undefined,
      })
    ).toEqual({ floorAreaSqft: 3660 });
  });

  test('normalizes wall and ceiling components into net drywall surface', () => {
    expect(
      drywallSurfaceFromComponents({
        drywallWallSqft: 8200,
        drywallCeilingSqft: 3660,
        drywallOpeningDeductionSqft: 1017,
      })
    ).toBe(10843);

    expect(
      normalizeDrywallPlanMeasurements({
        drywallSqft: 4056,
        drywallWallsSqft: 8200,
        drywallCeilingsSqft: 3660,
        drywallOpeningsSqft: 1017,
        floorAreaSqft: 3098,
      }).drywallSqft
    ).toBe(10843);

    expect(
      normalizeDrywallPlanMeasurements({
        drywallSqft: 4056,
        drywallWallSqft: 8200,
        drywallCeilingSqft: 3660,
        drywallOpeningDeductionSqft: 1017,
        quickMeasurementSources: { drywallSqft: 'user_entered' },
      }).drywallSqft
    ).toBe(4056);
  });

  test('keeps the existing Plan 39 undercount guard and fallback quantity', () => {
    expect(isUndercountedDrywallSurface(4056, 3098)).toBe(true);
    expect(isUndercountedDrywallSurface(10843, 3098)).toBe(false);
    expect(drywallSurfacePlanningQuantity(3098)).toBe(10843);
    expect(drywallSurfacePlanningQuantity(3660)).toBe(12810);
  });

  test('parses explicit notes quantities but ignores unrelated living area', () => {
    expect(
      parseDrywallMeasurementsFromNotes(
        'Two-story home, 3,098 sqft living area. Install 5,469 sqft of drywall.'
      )
    ).toEqual({ drywallSqft: 5469 });

    expect(
      parseDrywallMeasurementsFromNotes(
        'Walls are 8,200 SF and ceilings are 3,660 SF; deduct 1,017 SF openings.'
      )
    ).toEqual({
      drywallWallSqft: 8200,
      drywallCeilingSqft: 3660,
      drywallOpeningDeductionSqft: 1017,
      drywallSqft: 10843,
    });
  });

  test('uses the same normalized keys for plan and notes inputs', () => {
    const plan = normalizeTradeMeasurements(
      'drywall',
      { drywallSqft: 10843 },
      'plan'
    );
    const notes = normalizeTradeMeasurements(
      'drywall',
      { notes: 'Install 10,843 sqft of drywall.' },
      'notes'
    );

    expect(plan.measurements.drywallSqft).toBe(10843);
    expect(notes.measurements.drywallSqft).toBe(10843);
    expect(plan.quickMeasurementSources?.drywallSqft).toBe('plan_detected');
    expect(notes.quickMeasurementSources?.drywallSqft).toBe('user_entered');
    expect(plan.structuredMeasurements?.itemQuantities).toEqual({
      drywall: {
        quantity: 10843,
        unit: 'sqft',
        quantitySource: 'plan_detected',
      },
    });
  });

  test('preserves explicit contractor quantities as protected inputs', () => {
    expect(
      isProtectedDrywallQuantity({
        drywallSqft: 4056,
        quickMeasurementSources: { drywallSqft: 'user_entered' },
      })
    ).toBe(true);
    expect(
      isProtectedDrywallQuantity({
        drywallSqft: 10843,
        quickMeasurementSources: { drywallSqft: 'plan_detected' },
      })
    ).toBe(true);
    expect(
      buildDrywallStructuredMeasurements(
        {
          drywallSqft: 4056,
          quickMeasurementSources: { drywallSqft: 'user_entered' },
        },
        'user_entered'
      ).itemQuantities?.drywall
    ).toEqual({
      quantity: 4056,
      unit: 'sqft',
      quantitySource: 'user_entered',
    });
  });
});
