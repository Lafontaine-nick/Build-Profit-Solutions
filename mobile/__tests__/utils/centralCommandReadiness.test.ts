import { isCentralCommandContextReady } from '@/utils/centralCommandReadiness';

describe('isCentralCommandContextReady', () => {
  test('stays closed while projects or the timeline read are still loading', () => {
    expect(
      isCentralCommandContextReady({
        projectsReady: false,
        timelineLoaded: true,
        totalProjectCount: 2,
        projectOptionCount: 2,
      })
    ).toBe(false);
    expect(
      isCentralCommandContextReady({
        projectsReady: true,
        timelineLoaded: false,
        totalProjectCount: 2,
        projectOptionCount: 2,
      })
    ).toBe(false);
  });

  test('opens when the load finished even if nothing is comparable', () => {
    expect(
      isCentralCommandContextReady({
        projectsReady: true,
        timelineLoaded: true,
        totalProjectCount: 3,
        projectOptionCount: 3,
      })
    ).toBe(true);
  });

  test('opens for an empty portfolio', () => {
    expect(
      isCentralCommandContextReady({
        projectsReady: true,
        timelineLoaded: true,
        totalProjectCount: 0,
        projectOptionCount: 0,
      })
    ).toBe(true);
  });
});
