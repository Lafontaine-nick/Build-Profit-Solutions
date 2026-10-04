import { suggestedExpenseTrade } from '@/utils/expenseTradePrefill';

describe('suggestedExpenseTrade', () => {
  it('reads electrical work from the linked line', () => {
    expect(suggestedExpenseTrade({ lineName: 'Ceiling fan' })).toBe('Electrical');
    expect(suggestedExpenseTrade({ lineName: 'Main panel' })).toBe('Electrical');
    expect(suggestedExpenseTrade({ lineName: 'GFCI receptacles' })).toBe('Electrical');
    expect(suggestedExpenseTrade({ lineName: 'Single-pole switch' })).toBe('Electrical');
    expect(suggestedExpenseTrade({ costCode: 'electrical_recessed_light', lineName: 'Recessed / canless / wafer light' })).toBe('Electrical');
  });

  it('distinguishes tile, flooring, and landscaping', () => {
    expect(suggestedExpenseTrade({ lineName: 'Floor tile' })).toBe('Tile');
    expect(suggestedExpenseTrade({ lineName: 'LVP plank' })).toBe('Flooring');
    expect(suggestedExpenseTrade({ lineName: 'Irrigation and sod' })).toBe('Landscaping');
  });

  it('uses the project trade when the line name does not name one', () => {
    expect(
      suggestedExpenseTrade({
        lineName: 'Extra work',
        projectLike: {
          estimateData: {
            aiEstimateDraftSnapshot: {
              draft: { scopeMeasurements: { planImportTradeKey: 'electrical' } },
            },
          },
        },
      })
    ).toBe('Electrical');
  });

  it('uses a single trade detected from notes', () => {
    expect(
      suggestedExpenseTrade({
        lineName: 'Extra work',
        projectLike: {
          estimateData: {
            aiEstimateDraftSnapshot: {
              draft: {
                originalNotes: 'Rewire the house and add recessed lights',
                classification: {
                  scopeMode: 'dedicated',
                  primaryTrade: 'electrical',
                  detectedTrades: ['electrical'],
                },
              },
            },
          },
        },
      })
    ).toBe('Electrical');
  });

  it('does not guess one trade when notes detected several', () => {
    expect(
      suggestedExpenseTrade({
        lineName: 'Extra work',
        projectLike: {
          estimateData: {
            aiEstimateDraftSnapshot: {
              draft: {
                originalNotes: 'New floors and paint',
                detectedTrades: ['flooring', 'painting'],
              },
            },
          },
        },
      })
    ).toBe('');
    expect(suggestedExpenseTrade({ lineName: 'Electrical rough-in', costCode: 'electrical_rough' })).toBe(
      'Electrical'
    );
    expect(suggestedExpenseTrade({ lineName: 'Flooring', costCode: 'flooring' })).toBe('Flooring');
  });

  it('lets the linked line win over the project trade', () => {
    expect(
      suggestedExpenseTrade({
        lineName: 'LVP plank',
        projectLike: {
          estimateData: { planImportTradeKey: 'electrical' },
        },
      })
    ).toBe('Flooring');
  });
});
