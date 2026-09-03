import { resolveEstimateLineOption } from '@/utils/estimateLineOptions';

const projectLike = {
  estimateData: {
    materialLineItems: [
      { id: 'walls', name: 'Walls', qty: 1500, unit: 'sq ft', unitPrice: 0.87, total: 1306 },
      { id: 'cabinets', name: 'Cabinets', qty: 200, unit: 'lf', unitPrice: 13.33, total: 2666 },
    ],
  },
};

describe('resolveEstimateLineOption', () => {
  it('resolves by linkedLineId first', () => {
    const line = resolveEstimateLineOption(projectLike.estimateData as Record<string, unknown>, 'materials', {
      linkedLineId: 'walls',
      material: 'Cabinets',
    });
    expect(line?.id).toBe('walls');
    expect(line?.name).toBe('Walls');
    expect(line?.budget).toBe(1306);
  });

  it('falls back to material label when linkedLineId is missing', () => {
    const line = resolveEstimateLineOption(projectLike.estimateData as Record<string, unknown>, 'materials', {
      material: 'Cabinets',
    });
    expect(line?.id).toBe('cabinets');
    expect(line?.budget).toBe(2666);
    expect(line?.quantity).toBe(200);
    expect(line?.unit).toBe('lf');
  });

  it('matches material labels with estimate suffix stripped', () => {
    const line = resolveEstimateLineOption(projectLike.estimateData as Record<string, unknown>, 'materials', {
      material: 'Walls — materials',
    });
    expect(line?.id).toBe('walls');
  });

  it('returns null when no link or material match', () => {
    expect(
      resolveEstimateLineOption(projectLike.estimateData as Record<string, unknown>, 'materials', { material: 'Misc supplies' })
    ).toBeNull();
  });
});
