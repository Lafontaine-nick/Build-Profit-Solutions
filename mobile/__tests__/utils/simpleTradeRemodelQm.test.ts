import {
  SIMPLE_TRADE_SPECS,
  simpleTradePanelFor,
} from '@/utils/qmScopePanels/simpleTradeRemodel';

describe('simple trade QM panels', () => {
  it('defines the four requested trade templates', () => {
    expect(Object.keys(SIMPLE_TRADE_SPECS)).toEqual(
      expect.arrayContaining(['concrete', 'deck_patio', 'hvac', 'roofing'])
    );
  });

  it('keeps the provided scope labels mapped to priceable checklist ids', () => {
    expect(SIMPLE_TRADE_SPECS.concrete.options.find((option) => option.id === 'driveways')?.canonicalId).toBe(
      'pour_flatwork'
    );
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
    expect(simpleTradePanelFor('concrete').templateKeys).toEqual(['concrete']);
    expect(simpleTradePanelFor('deck_patio').templateKeys).toEqual(['deck_patio']);
    expect(simpleTradePanelFor('hvac').templateKeys).toEqual(['hvac']);
    expect(simpleTradePanelFor('roofing').templateKeys).toEqual(['roofing']);
  });
});

