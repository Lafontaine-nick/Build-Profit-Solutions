import { expenseSubtitleLines } from '@/utils/expenseCardDisplay';

describe('expenseSubtitleLines', () => {
  it('hides duplicate labor subtitle when vendor and description match', () => {
    expect(
      expenseSubtitleLines({
        vendor: 'Cabinets',
        description: 'Cabinets',
      })
    ).toEqual({});
  });

  it('keeps estimate line material when vendor is a store name', () => {
    expect(
      expenseSubtitleLines({
        vendor: 'Home Depot',
        material: 'Prep & Masking',
      })
    ).toEqual({ material: 'Prep & Masking' });
  });

  it('hides description when it duplicates material', () => {
    expect(
      expenseSubtitleLines({
        vendor: 'Home Depot',
        material: 'Walls',
        description: 'Walls',
      })
    ).toEqual({ material: 'Walls' });
  });
});
