const {
  remapDetectionToTemplate,
  resolvePlanScopeCatalog,
  ensureCoreDetections,
  finalizeDetections,
  appendScopeTextToNotesBlock,
  guessPlanScopeTemplateKey,
  resolveEffectivePlanTemplate,
  GROUND_UP_CORE_IDS,
  BATHROOM_CORE_IDS,
  SOFT_COST_IDS,
} = require('../estimatePlanToScope');

describe('estimatePlanToScope id remapping', () => {
  test('resolvePlanScopeCatalog uses ground_up item ids', () => {
    const { catalog, templateKey } = resolvePlanScopeCatalog('ground_up');
    expect(templateKey).toBe('ground_up');
    const ids = new Set(catalog.map((c) => c.id));
    expect(ids.has('exterior')).toBe(true);
    expect(ids.has('mep_rough')).toBe(true);
    expect(ids.has('paint_trim')).toBe(true);
    expect(ids.has('tile_flooring')).toBe(true);
    // addition-only ids should not be required on ground_up catalog
    expect(ids.has('exterior_finishes')).toBe(false);
  });

  test('remapDetectionToTemplate maps addition ids onto ground_up', () => {
    const allowed = new Set([
      'foundation',
      'framing',
      'roofing',
      'exterior',
      'mep_rough',
      'paint_trim',
      'tile_flooring',
      'sitework',
    ]);
    expect(remapDetectionToTemplate({ itemId: 'exterior_finishes', state: 'included' }, allowed).itemId).toBe(
      'exterior'
    );
    expect(remapDetectionToTemplate({ itemId: 'electrical_rough', state: 'included' }, allowed).itemId).toBe(
      'mep_rough'
    );
    expect(remapDetectionToTemplate({ itemId: 'paint', state: 'included' }, allowed).itemId).toBe('paint_trim');
    expect(remapDetectionToTemplate({ itemId: 'flooring', state: 'included' }, allowed).itemId).toBe(
      'tile_flooring'
    );
    expect(remapDetectionToTemplate({ itemId: 'unknown_trade', state: 'included' }, allowed)).toBeNull();
  });
});

describe('estimatePlanToScope ground-up vs remodel', () => {
  test('guessPlanScopeTemplateKey returns null for empty notes (not room_remodel)', () => {
    expect(guessPlanScopeTemplateKey({ existingNotes: '' })).toBeNull();
    expect(guessPlanScopeTemplateKey({ existingNotes: '   ' })).toBeNull();
  });

  test('guessPlanScopeTemplateKey respects explicit ground-up notes', () => {
    expect(
      guessPlanScopeTemplateKey({ existingNotes: 'SHV Lot 41 ground-up new construction' })
    ).toBe('ground_up');
  });

  test('resolveEffectivePlanTemplate upgrades remodel detections to ground_up', () => {
    const remodelDetections = [
      { itemId: 'demo', evidence: 'Main floor layout indicates changes to existing spaces' },
      { itemId: 'electrical', evidence: 'Electrical plan shows updates to outlets' },
      { itemId: 'plumbing', evidence: 'Plumbing work likely needed for kitchen remodel' },
      { itemId: 'paint', evidence: 'Interior painting standard for remodel' },
      { itemId: 'flooring', evidence: 'Floor plan indicates new flooring installation' },
      { itemId: 'framing', evidence: 'Framing plan suggests layout changes' },
    ];
    expect(
      resolveEffectivePlanTemplate({
        fallbackTemplate: 'room_remodel',
        inferredJobType: 'room_remodel',
        scopeText: 'Remodeling of main living areas including kitchen',
        detections: remodelDetections,
      })
    ).toBe('ground_up');
  });

  test('finalize remaps remodel electrical/plumbing onto ground_up mep_rough and fills core', () => {
    const { catalog } = resolvePlanScopeCatalog('ground_up');
    const raw = [
      { itemId: 'electrical', state: 'included', confidence: 0.9, evidence: 'electrical plan' },
      { itemId: 'plumbing', state: 'included', confidence: 0.9, evidence: 'plumbing' },
      { itemId: 'paint', state: 'included', confidence: 0.8, evidence: 'paint' },
      { itemId: 'demo', state: 'included', confidence: 0.8, evidence: 'demo existing' },
    ];
    // Pretend we already remapped item ids as analyzePlanForScope does
    const allowed = new Set(catalog.map((c) => c.id));
    const remapped = raw
      .map((d) => {
        const r = remapDetectionToTemplate(d, allowed);
        return r ? { ...d, itemId: r.itemId } : null;
      })
      .filter(Boolean);
    const out = finalizeDetections(remapped, catalog, 'ground_up');
    const ids = new Set(out.map((d) => d.itemId));
    expect(ids.has('mep_rough')).toBe(true);
    expect(ids.has('paint_trim')).toBe(true);
    expect(ids.has('foundation')).toBe(true);
    expect(ids.has('demo')).toBe(false);
  });
});

describe('estimatePlanToScope core packages', () => {
  test('ensureCoreDetections fills ground_up build majority when model under-proposes', () => {
    const { catalog } = resolvePlanScopeCatalog('ground_up');
    const thin = [
      { itemId: 'framing', state: 'included', confidence: 0.9, evidence: 'framing plan' },
      { itemId: 'mep_rough', state: 'included', confidence: 0.85, evidence: 'electrical plan' },
    ];
    const filled = ensureCoreDetections(thin, catalog, 'ground_up');
    const ids = new Set(filled.map((d) => d.itemId));
    for (const id of GROUND_UP_CORE_IDS) {
      expect(ids.has(id)).toBe(true);
    }
    expect(ids.has('contingency')).toBe(false);
    expect(ids.has('overhead_profit')).toBe(false);
    expect(ids.has('permits')).toBe(false);
  });

  test('ensureCoreDetections fills bathroom package without house trades', () => {
    const { catalog } = resolvePlanScopeCatalog('bathroom');
    const thin = [{ itemId: 'shower_tile', state: 'included', confidence: 0.9, evidence: 'tile callout' }];
    const filled = ensureCoreDetections(thin, catalog, 'bathroom');
    const ids = new Set(filled.map((d) => d.itemId));
    for (const id of BATHROOM_CORE_IDS) {
      expect(ids.has(id)).toBe(true);
    }
    expect(ids.has('foundation')).toBe(false);
    expect(ids.has('roofing')).toBe(false);
  });

  test('finalizeDetections drops soft costs and remaps + fills ground_up', () => {
    const { catalog } = resolvePlanScopeCatalog('ground_up');
    const raw = [
      { itemId: 'exterior_finishes', state: 'included', confidence: 0.9, evidence: 'elevations' },
      { itemId: 'contingency', state: 'included', confidence: 0.8, evidence: 'guess' },
      { itemId: 'overhead_profit', state: 'included', confidence: 0.8, evidence: 'guess' },
    ];
    const out = finalizeDetections(raw, catalog, 'ground_up');
    const ids = new Set(out.map((d) => d.itemId));
    expect(ids.has('exterior')).toBe(true);
    expect(ids.has('framing')).toBe(true);
    expect(ids.has('tile_flooring')).toBe(true);
    for (const soft of SOFT_COST_IDS) {
      expect(ids.has(soft)).toBe(false);
    }
  });

  test('appendScopeTextToNotesBlock keeps SF notes and adds scope bullets', () => {
    const notes = 'Main living area is 1879 Sq Ft with a garage of 994 Sq Ft.';
    const scope = '- Framing, roofing, exterior, MEP, drywall, finishes\n- Kitchen + primary suite';
    const merged = appendScopeTextToNotesBlock(notes, scope);
    expect(merged).toContain('1879');
    expect(merged).toContain('Suggested scope from plans');
    expect(merged).toContain('Framing, roofing');
  });
});
