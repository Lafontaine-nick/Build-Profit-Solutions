const {
  sanitizeDetections,
  formatScopeNotesFromVision,
  mergePhotoNotesIntoJobNotes,
  collectAllowedItems,
  isSpuriousTradeMismatchRejection,
  normalizeVisionParsed,
  guessTemplateKey,
} = require('../estimatePhotoToScope');
const { checklistTemplateKey } = require('../scopeChecklistLibrary');

describe('estimatePhotoToScope', () => {
  test('collectAllowedItems returns bathroom ids for bathroom template', () => {
    const catalog = collectAllowedItems('bathroom');
    const ids = catalog.map((c) => c.id);
    expect(ids).toContain('shower_tile');
    expect(ids).toContain('vanity');
    expect(ids).not.toContain('cabinets');
  });

  test('sanitizeDetections drops unknown ids and invalid choices', () => {
    const catalog = collectAllowedItems('bathroom');
    const cleaned = sanitizeDetections(
      [
        { itemId: 'shower_tile', state: 'included', confidence: 0.9, evidence: 'Tile walls' },
        { itemId: 'not_a_real_item', state: 'included', confidence: 0.99, evidence: 'Nope' },
        { itemId: 'wet_area_install', state: 'included', choiceId: 'bogus', confidence: 0.8 },
        { itemId: 'shower_tile', state: 'included', confidence: 0.5, evidence: 'dup' },
      ],
      catalog
    );
    expect(cleaned.map((d) => d.itemId)).toEqual(['shower_tile', 'wet_area_install']);
    expect(cleaned[0].evidence).toBe('Tile walls');
    expect(cleaned[1].choiceId).toBeNull();
  });

  test('formatScopeNotesFromVision lists included detections', () => {
    const text = formatScopeNotesFromVision({
      scopeText: 'Master bath with tile shower.',
      detections: [
        {
          itemId: 'shower_tile',
          label: 'Shower wall tile installation',
          state: 'included',
          confidence: 0.9,
          evidence: 'Tile walls visible',
        },
      ],
    });
    expect(text).toContain('Master bath with tile shower.');
    expect(text).toContain('Detected from site photos');
    expect(text).toContain('Shower wall tile installation');
  });

  test('mergePhotoNotesIntoJobNotes replaces prior photo block', () => {
    const first = mergePhotoNotesIntoJobNotes('Kitchen remodel notes', 'Photo A findings');
    expect(first).toContain('Kitchen remodel notes');
    expect(first).toContain('--- Site photos ---');
    expect(first).toContain('Photo A findings');

    const second = mergePhotoNotesIntoJobNotes(first, 'Photo B findings');
    expect(second).toContain('Kitchen remodel notes');
    expect(second).toContain('Photo B findings');
    expect(second).not.toContain('Photo A findings');
  });

  test('collectAllowedItems(null) covers bath, kitchen, roof, deck', () => {
    const catalog = collectAllowedItems(null);
    const ids = catalog.map((c) => c.id);
    expect(ids).toContain('shower_tile');
    expect(ids).toContain('cabinets');
    expect(ids).toContain('shingles_roofing');
    expect(ids).toContain('decking');
  });
});

describe('photo-to-scope rejection recovery', () => {
  const catalog = collectAllowedItems(null);

  test('flags the bathroom-vs-roofing rejection as spurious', () => {
    expect(
      isSpuriousTradeMismatchRejection('The photos depict a bathroom interior, not a roofing context.')
    ).toBe(true);
  });

  test('does not flag clear non-jobsite rejections as spurious', () => {
    expect(isSpuriousTradeMismatchRejection('This is a selfie with no jobsite visible.')).toBe(false);
    expect(isSpuriousTradeMismatchRejection('Photo shows food on a plate.')).toBe(false);
  });

  test('salvages success:false when scopeText is present', () => {
    const result = normalizeVisionParsed(
      {
        success: false,
        reason: 'The photos depict a bathroom interior, not a roofing context.',
        projectTypeHint: 'bathroom',
        scopeText: 'Existing tub/shower surround with white tile walls.',
        detections: [
          { itemId: 'shower_tile', state: 'included', confidence: 0.9, evidence: 'Tile walls' },
        ],
      },
      catalog,
      'roofing'
    );
    expect(result.success).toBe(true);
    expect(result.scopeText).toContain('tub/shower');
    expect(result.detections[0].itemId).toBe('shower_tile');
    expect(result.templateKey).toBe('bathroom');
    expect(result.notesBlock).toContain('Detected from site photos');
  });

  test('requests retry when spurious reject has no content', () => {
    const result = normalizeVisionParsed(
      {
        success: false,
        reason: 'Photos are a kitchen, not a flooring context.',
        scopeText: '',
        detections: [],
      },
      catalog,
      'flooring'
    );
    expect(result.success).toBe(false);
    expect(result.shouldRetryWithoutNotes).toBe(true);
  });

  test('keeps hard non-jobsite failures', () => {
    const result = normalizeVisionParsed(
      {
        success: false,
        reason: 'This is a selfie with no room or exterior visible.',
        scopeText: '',
        detections: [],
      },
      catalog,
      null
    );
    expect(result.success).toBe(false);
    expect(result.shouldRetryWithoutNotes).toBe(false);
  });
});

describe('template guess does not misread area language', () => {
  test('shower + square feet notes classify as bathroom, not roofing', () => {
    const notes =
      'Demo existing shower, roughly 60 square feet, demo, tub, and build a new tile shower pan. Demo existing walls, new tile.';
    expect(checklistTemplateKey({ projectType: 'other', originalNotes: notes }, null)).toBe('bathroom');
    expect(guessTemplateKey({ existingNotes: notes })).toBe('bathroom');
  });

  test('roofing squares still classify as roofing', () => {
    expect(
      checklistTemplateKey(
        { projectType: 'other', originalNotes: 'Tear off and install 28 squares architectural shingles' },
        null
      )
    ).toBe('roofing');
  });

  test('kitchen cabinet notes classify as kitchen', () => {
    expect(
      checklistTemplateKey(
        { projectType: 'other', originalNotes: 'Replace upper cabinets and quartz countertops' },
        null
      )
    ).toBe('kitchen');
  });

  test('paint square footage does not become roofing', () => {
    expect(
      checklistTemplateKey(
        { projectType: 'other', originalNotes: 'Interior paint about 60 square feet of accent wall' },
        null
      )
    ).toBe('painting');
  });
});
