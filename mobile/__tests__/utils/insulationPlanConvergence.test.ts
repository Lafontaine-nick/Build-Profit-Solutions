import { hydrateInsulationPlanMeasurementsFromTakeoff } from '@/utils/subcontractorTrade/insulationPlanConvergence';

describe('insulationPlanConvergence', () => {
  it('maps stucco opening takeoff into insulation opening deduction', () => {
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff({
      stuccoWindowDoorOpeningSqft: '289.6',
    });
    expect(hydrated.openingDeductionSqft).toBe('289.6');
  });

  it('does not overwrite an existing opening deduction', () => {
    const hydrated = hydrateInsulationPlanMeasurementsFromTakeoff({
      openingDeductionSqft: '300',
      stuccoWindowDoorOpeningSqft: '289.6',
    });
    expect(hydrated.openingDeductionSqft).toBe('300');
  });
});
