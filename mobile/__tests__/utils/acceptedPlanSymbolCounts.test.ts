import {
  applyAcceptedPlanSymbolCounts,
  loadAcceptedPlanSymbolCounts,
  pickAcceptedPlanSymbolCounts,
  rememberAcceptedPlanSymbolCount,
  rememberAcceptedPlanSymbolCounts,
  resetAcceptedPlanSymbolCountsForTests,
} from '@/utils/acceptedPlanSymbolCounts';

describe('accepted plan symbol counts', () => {
  beforeEach(async () => {
    await resetAcceptedPlanSymbolCountsForTests();
  });

  it('keeps the accepted symbol counts and leaves the cover sheet alone', () => {
    const takeoff = {
      measurements: {
        floorAreaSqft: 2571,
        recessedLightCount: 31,
        garageDoorDoubleCount: 1,
        windowCount: 42,
        singlePoleSwitchCount: 58,
      },
      measurementProvenance: {
        windowCount: {
          evidenceKind: 'elevation_symbols',
          symbolReadsDisagreed: true,
          pricingEligible: false,
        },
        floorAreaSqft: { status: 'plan_verified' },
      },
    };
    const next = applyAcceptedPlanSymbolCounts(takeoff, {
      windowCount: 38,
      singlePoleSwitchCount: 52,
      recessedLightCount: 99,
      floorAreaSqft: 100,
    });
    expect(next.measurements).toMatchObject({
      floorAreaSqft: 2571,
      recessedLightCount: 31,
      garageDoorDoubleCount: 1,
      windowCount: 38,
      singlePoleSwitchCount: 52,
    });
    expect(next.measurementProvenance?.windowCount).toMatchObject({
      value: 38,
      pricingEligible: true,
      symbolReadsDisagreed: false,
      keptFromAcceptedTakeoff: true,
      evidenceKind: 'accepted_takeoff',
    });
    expect(next.measurementProvenance?.floorAreaSqft).toEqual({
      status: 'plan_verified',
    });
  });

  it('leaves a takeoff unchanged when this file has no accepted counts', () => {
    const takeoff = {
      measurements: { windowCount: 40 },
      measurementProvenance: {},
    };
    expect(applyAcceptedPlanSymbolCounts(takeoff, null)).toBe(takeoff);
    expect(applyAcceptedPlanSymbolCounts(takeoff, {})).toBe(takeoff);
  });

  it('remembers an edited count without dropping the rest of the file', async () => {
    rememberAcceptedPlanSymbolCounts('lot-49', {
      windowCount: 38,
      interiorDoorCount: 17,
      singlePoleSwitchCount: 52,
      bathExhaustFanCount: 4,
    });
    rememberAcceptedPlanSymbolCount('lot-49', 'windowCount', 36);
    rememberAcceptedPlanSymbolCount('lot-49', 'floorAreaSqft', 3000);
    const stored = await loadAcceptedPlanSymbolCounts('lot-49');
    expect(stored).toEqual({
      windowCount: 36,
      interiorDoorCount: 17,
      singlePoleSwitchCount: 52,
      bathExhaustFanCount: 4,
    });
    expect(pickAcceptedPlanSymbolCounts(stored)).toEqual(stored);
  });
});
