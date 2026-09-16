import {
  isCanonicalMixedScope,
  mixedScopeQmTradesFromDraft,
  mixedScopeTradesFromDraft,
  orchestrateMixedScopeItems,
} from '@/utils/mixedScopeOrchestrator';

describe('mixedScopeOrchestrator', () => {
  const completedMixedScopeFixtures = [
    ['kitchen', ['kitchen', 'flooring', 'plumbing', 'electrical']],
    ['bathroom', ['bathroom', 'plumbing', 'flooring']],
    ['painting', ['painting', 'drywall', 'flooring']],
    ['framing', ['framing', 'windows_doors', 'insulation', 'drywall']],
    ['drywall', ['drywall', 'painting', 'flooring']],
    ['insulation', ['insulation', 'drywall', 'painting']],
    ['concrete', ['concrete', 'landscaping']],
    ['roofing', ['roofing', 'insulation', 'windows_doors']],
    ['flooring', ['flooring', 'drywall', 'painting']],
    ['hvac', ['hvac', 'insulation', 'drywall']],
    ['plumbing', ['plumbing', 'bathroom', 'drywall']],
    ['landscaping', ['landscaping', 'concrete']],
    ['addition', ['framing', 'roofing', 'hvac', 'plumbing']],
    ['ground_up', ['framing', 'roofing', 'hvac', 'electrical']],
  ] as const;

  const baseInput = {
    templateKey: 'room_remodel',
    projectType: 'room_remodel',
    notes:
      'Frame 1,600 sqft of walls, install 900 sqft flooring, and paint.',
    measurements: {
      framedAreaSqft: 1600,
      flooringSqft: 900,
      framingScope: ['wall_framing'],
    },
    scopeMode: 'mixed',
    detectedTrades: ['framing', 'flooring', 'painting'],
  };

  test('normalizes detected trades from the canonical draft result', () => {
    expect(
      mixedScopeTradesFromDraft({
        classification: {
          scopeMode: 'mixed',
          primaryTrade: 'framing',
          detectedTrades: ['framing', 'hardscape', 'HVAC'],
          scopeSummary: null,
          evidence: [],
          exclusions: [],
          confidence: 'high',
        },
      } as never)
    ).toEqual(['framing', 'concrete', 'hvac']);
  });

  test('recognizes mixed drafts but leaves dedicated drafts unchanged', () => {
    expect(isCanonicalMixedScope(baseInput)).toBe(true);
    expect(
      isCanonicalMixedScope({
        ...baseInput,
        scopeMode: 'dedicated',
        detectedTrades: ['flooring'],
      })
    ).toBe(false);
    expect(
      isCanonicalMixedScope({
        ...baseInput,
        singleTradeImport: true,
      })
    ).toBe(false);
  });

  test('narrows QM trades to canonical checklist item trades', () => {
    const draft = {
      scopeChecklist: {
        canonicalMixedScope: {
          schemaVersion: 1,
          authority: 'checklist',
          mode: 'mixed',
          templateKey: 'room_remodel',
          detectedTrades: ['bathroom', 'kitchen', 'concrete', 'flooring'],
          items: [
            {
              scopeId: 'wet_area_install',
              trade: 'bathroom',
              checklistState: 'included',
            },
            {
              scopeId: 'shower_tile',
              catalog: { trade: 'bathroom' },
              checklistState: 'included',
            },
          ],
          unresolved: [],
        },
      },
    } as never;

    expect(mixedScopeQmTradesFromDraft(draft)).toEqual(['bathroom']);
  });

  test('promotes quantity-backed framing rows without changing unrelated rows', () => {
    const items = [
      { id: 'wall_framing', state: 'unsure' },
      { id: 'flooring', state: 'unsure' },
      { id: 'plumbing', state: 'unsure' },
    ];
    const result = orchestrateMixedScopeItems(items, baseInput);

    expect(result.find(item => item.id === 'wall_framing')?.state).toBe(
      'included'
    );
    expect(result.find(item => item.id === 'flooring')?.state).toBe('unsure');
    expect(result.find(item => item.id === 'plumbing')?.state).toBe('unsure');
  });

  test('preserves explicit exclusions', () => {
    const items = [
      { id: 'wall_framing', state: 'excluded' },
      { id: 'flooring', state: 'unsure' },
    ];
    const result = orchestrateMixedScopeItems(items, baseInput);
    expect(result.find(item => item.id === 'wall_framing')?.state).toBe(
      'excluded'
    );
  });

  test('adds note-backed canonical rows without replacing existing rows', () => {
    const result = orchestrateMixedScopeItems(
      [{ id: 'flooring', state: 'included' }],
      {
        ...baseInput,
        draft: {
          scopeChecklist: {
            canonicalMixedScope: {
              schemaVersion: 1,
              authority: 'checklist',
              mode: 'mixed',
              templateKey: 'room_remodel',
              detectedTrades: ['flooring', 'hvac'],
              items: [
                {
                  scopeId: 'hvac',
                  quantity: null,
                  resolutionStatus: 'needs_measurement',
                  checklistState: 'unsure',
                  catalog: {
                    displayName: 'HVAC install',
                    category: 'hvac',
                    trade: 'hvac',
                    quantityRuleKey: 'hvac',
                    pricingRuleKey: 'hvac',
                  },
                },
              ],
              unresolved: [],
            },
          },
        } as never,
        detectedTrades: ['flooring', 'hvac'],
      }
    );
    expect(result.find(item => item.id === 'hvac')).toMatchObject({
      state: 'unsure',
      noteBacked: true,
      catalogBacked: true,
    });
    expect(result.find(item => item.id === 'flooring')?.state).toBe(
      'included'
    );
  });

  test('is idempotent', () => {
    const items = [
      { id: 'wall_framing', state: 'unsure' },
      { id: 'flooring', state: 'unsure' },
    ];
    const once = orchestrateMixedScopeItems(items, baseInput);
    const twice = orchestrateMixedScopeItems(once, baseInput);
    expect(twice).toEqual(once);
  });

  test.each(completedMixedScopeFixtures)(
    'recognizes the completed %s mixed-scope fixture without changing explicit rows',
    (templateKey, detectedTrades) => {
      const items = [
        { id: 'explicit_scope', state: 'included' },
        { id: 'explicit_exclusion', state: 'excluded' },
      ];
      const input = {
        ...baseInput,
        templateKey,
        detectedTrades: [...detectedTrades],
        scopeMode: 'mixed',
        wholeHomeLayout: templateKey === 'addition' || templateKey === 'ground_up',
      };
      expect(isCanonicalMixedScope(input)).toBe(true);
      const result = orchestrateMixedScopeItems(items, input);
      expect(result.find(item => item.id === 'explicit_scope')?.state).toBe(
        'included'
      );
      expect(
        result.find(item => item.id === 'explicit_exclusion')?.state
      ).toBe('excluded');
      if (input.wholeHomeLayout) expect(result).toEqual(items);
    }
  );
});
