import { estimateLineOptionsFor, resolveEstimateLineOption } from '@/utils/estimateLineOptions';
import { EQUIPMENT_RENTAL_LINE_ID, getEstimateLineSpendSummaries } from '@/utils/rateInsightComparisons';

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

  it('adds equipment rental as its own materials line', () => {
    const options = estimateLineOptionsFor(
      {
        equipment: 600,
        materialLineItems: [{ id: 'panel', name: 'Main panel — materials', total: 850 }],
      },
      'materials'
    );
    expect(options.map((option) => option.id)).toEqual(['panel', EQUIPMENT_RENTAL_LINE_ID]);
    expect(options[1].name).toBe('Equipment rental');
    expect(options[1].budget).toBe(600);
  });

  it('does not add a second equipment line when one is already listed', () => {
    const options = estimateLineOptionsFor(
      {
        equipment: 600,
        materialLineItems: [{ id: 'eq', name: 'Equipment', total: 600 }],
      },
      'materials'
    );
    expect(options).toHaveLength(1);
  });

  it('keeps a linked rental bill on the equipment line', () => {
    const summaries = getEstimateLineSpendSummaries({
      estimateData: {
        equipment: 600,
        materialLineItems: [{ id: 'panel', name: 'Main panel', total: 850 }],
      },
      expenses: [
        {
          id: 'e1',
          amount: 600,
          category: 'Materials/Equipment',
          linkedLineId: EQUIPMENT_RENTAL_LINE_ID,
          material: 'Lift',
        },
      ],
      kind: 'materials',
    });
    expect(summaries[EQUIPMENT_RENTAL_LINE_ID].loggedTotal).toBe(600);
    expect(summaries[EQUIPMENT_RENTAL_LINE_ID].remaining).toBe(0);
    expect(summaries.panel.loggedTotal).toBe(0);
  });
});
