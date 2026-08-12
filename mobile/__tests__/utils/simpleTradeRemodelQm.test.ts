import {
  ROOFING_ACCESSORY_OPTION_IDS,
  ROOFING_DEMO_OPTION_IDS,
  ROOFING_DRAINAGE_OPTION_IDS,
  ROOFING_INSTALL_OPTION_IDS,
  SIMPLE_TRADE_SPECS,
  roofingOptionsForIds,
  simpleTradePanelFor,
} from '@/utils/qmScopePanels/simpleTradeRemodel';
import { getChecklistItemQuantityRule } from '@/utils/scopeItemQuantities';

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

  it('syncs Roofing selector deselection to excluded checklist scope items', () => {
    const panel = simpleTradePanelFor('roofing');
    const items = [
      { id: 'shingles_roofing', state: 'included' as const },
      { id: 'drip_edge', state: 'included' as const },
      { id: 'ridge_cap', state: 'included' as const },
    ];

    const selected = panel.syncScopeItems(items, {
      tradeScopeSelections: { roofing: ['shingles', 'drip_edge'] },
    });
    expect(selected.find(item => item.id === 'shingles_roofing')?.state).toBe(
      'included'
    );
    expect(selected.find(item => item.id === 'drip_edge')?.state).toBe(
      'included'
    );
    expect(selected.find(item => item.id === 'ridge_cap')?.state).toBe(
      'excluded'
    );

    const deselected = panel.syncScopeItems(selected, {
      tradeScopeSelections: { roofing: null },
    });
    expect(deselected.find(item => item.id === 'shingles_roofing')?.state).toBe(
      'excluded'
    );
    expect(deselected.find(item => item.id === 'drip_edge')?.state).toBe(
      'excluded'
    );
  });

  it('adds the Underlayment upgrade to the canonical roofing scope card', () => {
    const panel = simpleTradePanelFor('roofing');
    const items = [
      { id: 'underlayment', state: 'excluded' as const },
      { id: 'shingles_roofing', state: 'excluded' as const },
    ];

    const selected = panel.syncScopeItems(items, {
      tradeScopeSelections: { roofing: ['underlayment'] },
      roofAreaSqft: 2500,
    });

    expect(selected.find(item => item.id === 'underlayment')).toMatchObject({
      state: 'included',
      noteBacked: true,
    });
  });

  it('maps Ice & water shield selections onto the dedicated card', () => {
    const panel = simpleTradePanelFor('roofing');
    const selected = panel.syncScopeItems(
      [{ id: 'ice_water_shield', state: 'excluded' as const }],
      { tradeScopeSelections: { roofing: ['ice_water_shield'] } }
    );

    expect(selected.find(item => item.id === 'ice_water_shield')?.state).toBe(
      'included'
    );
  });

  it('partitions roofing QM options into install, tear-off, accessory, and drainage cards', () => {
    const allIds = SIMPLE_TRADE_SPECS.roofing.options.map((option) => option.id);
    const grouped = [
      ...ROOFING_DEMO_OPTION_IDS,
      ...ROOFING_INSTALL_OPTION_IDS,
      ...ROOFING_ACCESSORY_OPTION_IDS,
      ...ROOFING_DRAINAGE_OPTION_IDS,
    ];
    expect(grouped).toEqual(expect.arrayContaining(allIds));
    expect(new Set(grouped).size).toBe(allIds.length);
    expect(roofingOptionsForIds(ROOFING_DEMO_OPTION_IDS).map((option) => option.id)).toEqual([
      'tear_off',
    ]);
    expect(roofingOptionsForIds(ROOFING_DRAINAGE_OPTION_IDS)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'gutters', measurementKey: 'roofGutterLf', unit: 'LF' }),
        expect.objectContaining({
          id: 'downspouts',
          measurementKey: 'roofDownspoutCount',
          unit: 'EA',
        }),
      ])
    );
  });

  it('syncs gutters and downspouts independently from QM selections', () => {
    const panel = simpleTradePanelFor('roofing');
    const items = [
      { id: 'gutters', state: 'excluded' as const },
      { id: 'downspouts', state: 'excluded' as const },
    ];
    const selected = panel.syncScopeItems(items, {
      tradeScopeSelections: { roofing: ['gutters', 'downspouts'] },
      roofGutterLf: 150,
      roofDownspoutCount: 4,
    });
    expect(selected.find(item => item.id === 'gutters')?.state).toBe('included');
    expect(selected.find(item => item.id === 'downspouts')?.state).toBe('included');

    const guttersOnly = panel.syncScopeItems(selected, {
      tradeScopeSelections: { roofing: ['gutters'] },
      roofGutterLf: 150,
      roofDownspoutCount: 4,
    });
    expect(guttersOnly.find(item => item.id === 'gutters')?.state).toBe('included');
    expect(guttersOnly.find(item => item.id === 'downspouts')?.state).toBe('excluded');
  });

  it('uses LF for gutters and EA for downspouts quantity rules', () => {
    expect(getChecklistItemQuantityRule('gutters', 'roofing')).toMatchObject({
      defaultUnit: 'lf',
      measurementKey: 'roofGutterLf',
    });
    expect(getChecklistItemQuantityRule('downspouts', 'roofing')).toMatchObject({
      defaultUnit: 'each',
      measurementKey: 'roofDownspoutCount',
    });
  });
});

