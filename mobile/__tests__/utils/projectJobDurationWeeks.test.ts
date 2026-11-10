import {
  defaultWeeklyProjectWeeks,
  getProjectJobDurationWeeks,
} from '../../utils/projectJobDuration';

describe('getProjectJobDurationWeeks', () => {
  it('counts a month as 4 weeks', () => {
    expect(getProjectJobDurationWeeks('2026-10-13', '2026-11-13')).toBe(4);
    expect(getProjectJobDurationWeeks('2026-01-01', '2026-02-01')).toBe(4);
  });

  it('counts an exact 6-week span as 6 weeks', () => {
    expect(getProjectJobDurationWeeks('2026-10-13', '2026-11-24')).toBe(6);
  });

  it('replaces a saved count from the old round-up with the job length', () => {
    expect(defaultWeeklyProjectWeeks('2026-10-13', '2026-11-24', 7)).toBe(6);
  });

  it('keeps a week count someone typed', () => {
    expect(defaultWeeklyProjectWeeks('2026-10-13', '2026-11-24', 10)).toBe(10);
  });
});
