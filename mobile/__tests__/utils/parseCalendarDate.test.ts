import { parseCalendarDate } from '@/utils/formatters';

describe('parseCalendarDate', () => {
  it('keeps a midnight UTC timestamp on the calendar day in the string', () => {
    const date = parseCalendarDate('2026-09-08T00:00:00.000Z');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(8);
  });

  it('keeps a date-only string on that calendar day', () => {
    const date = parseCalendarDate('2026-09-08');
    expect(date.getDate()).toBe(8);
  });
});
