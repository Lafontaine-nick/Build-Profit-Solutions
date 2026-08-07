import {
  SIMPLE_TRADE_SPECS,
  simpleTradePanelFor,
} from '@/utils/qmScopePanels/simpleTradeRemodel';

describe('simple trade QM panels', () => {
  it('defines the three remaining simple-trade templates', () => {
    expect(Object.keys(SIMPLE_TRADE_SPECS)).toEqual(
      expect.arrayContaining(['deck_patio', 'hvac', 'roofing'])
    );
    expect(Object.keys(SIMPLE_TRADE_SPECS)).not.toContain('concrete');
  });

  it('keeps the provided scope labels mapped to priceable checklist ids', () => {
    expect(SIMPLE_TRADE_SPECS.deck_patio.options.find((option) => option.id === 'wood_fence')?.canonicalId).toBe(
      'landscaping'
    );
    expect(SIMPLE_TRADE_SPECS.hvac.options.find((option) => option.id === 'furnace')?.canonicalId).toBe(
      'equipment_replace'
    );
    expect(SIMPLE_TRADE_SPECS.roofing.options.find((option) => option.id === 'shingles')?.canonicalId).toBe(
      'shingles_roofing'
    );
  });

  it('registers each template as an active QM panel', () => {
    expect(simpleTradePanelFor('deck_patio').templateKeys).toEqual(['deck_patio']);
    expect(simpleTradePanelFor('hvac').templateKeys).toEqual(['hvac']);
    expect(simpleTradePanelFor('roofing').templateKeys).toEqual(['roofing']);
  });
});

