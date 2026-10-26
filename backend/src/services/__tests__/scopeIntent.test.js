const { normalizeDraft } = require('../estimateDraftFromNotes');
const { buildScopeChecklist } = require('../estimateDraftComplexity');
const {
  normalizeScopeIntent,
  applyScopeIntentToChecklist,
  draftNeedsScopeIntentPass,
  mergeScopeIntentPass,
} = require('../scopeIntent');

describe('scopeIntent', () => {
  test('a whole-house read keeps house size off LVP and leaves windows, doors, and appliance install unconfirmed', () => {
    const notes =
      'Whole house remodel. The house is 2,400 sqft. LVP flooring. Keep the windows and doors. Appliances are owner-supplied.';
    const checklist = buildScopeChecklist(
      {
        projectType: 'other',
        originalNotes: notes,
        rooms: [],
        scopeIntent: {
          items: [
            {
              id: 'flooring',
              state: 'uncertain',
              quantity: null,
              evidence: 'LVP flooring',
            },
            {
              id: 'windows',
              state: 'excluded',
              quantity: null,
              evidence: 'Keep the windows and doors',
            },
            {
              id: 'interior_door_install',
              state: 'excluded',
              quantity: null,
              evidence: 'Keep the windows and doors',
            },
            {
              id: 'appliances',
              state: 'uncertain',
              quantity: null,
              evidence: 'Appliances are owner-supplied',
            },
          ],
        },
      },
      'room_remodel',
      notes
    );

    expect(checklist.templateKey).toBe('room_remodel');
    expect(checklist.suggestedMeasurements?.flooringLvpSqft).toBeUndefined();
    expect(checklist.suggestedMeasurements?.flooringSqft).toBeUndefined();
    const state = (id) => checklist.items.find((item) => item.id === id)?.state;
    expect(state('window_install') || state('windows')).not.toBe('included');
    expect(state('interior_door_install') || state('interior_doors') || state('doors')).not.toBe(
      'included'
    );
    const appliances = checklist.items.find((item) => item.id === 'appliances');
    if (appliances) expect(appliances.state).not.toBe('included');
  });

  test('reads the same whole-house note without a model scope intent', () => {
    const {
      checklistTemplateKey,
      notesDescribeMeasuredWholeHomeRemodel,
      statedWholeHomeSizeSqft,
    } = require('../scopeChecklistLibrary');
    const notes =
      'Whole house remodel. The house is 2,400 sqft. LVP flooring. Keep the windows and doors. Appliances are owner-supplied.';
    expect(statedWholeHomeSizeSqft(notes)).toBe(2400);
    expect(notesDescribeMeasuredWholeHomeRemodel(notes)).toBe(true);
    expect(
      checklistTemplateKey(
        { projectType: 'other', originalNotes: notes },
        null,
        notes
      )
    ).toBe('room_remodel');
    const checklist = buildScopeChecklist(
      {
        projectType: 'other',
        originalNotes: notes,
        rooms: [],
      },
      'room_remodel',
      notes
    );
    expect(checklist.templateKey).toBe('room_remodel');
    expect(checklist.suggestedMeasurements?.flooringLvpSqft).toBeUndefined();
    expect(checklist.suggestedMeasurements?.flooringSqft).toBeUndefined();
    expect(checklist.suggestedMeasurements?.floorAreaSqft).not.toBe(2400);
  });

  test('keeps a stated quantity and drops a number the note never wrote', () => {
    const notes = 'Replace 3 interior doors.';
    const intent = normalizeScopeIntent(
      {
        items: [
          {
            id: 'interior_door_install',
            state: 'included',
            quantity: 3,
            unit: 'each',
            evidence: 'Replace 3 interior doors',
          },
          {
            id: 'interior_door_install',
            state: 'included',
            quantity: 999,
            unit: 'each',
            evidence: 'not in the note at all',
          },
        ],
      },
      notes
    );

    expect(intent.items).toEqual([
      {
        id: 'interior_door_install',
        state: 'included',
        quantity: 3,
        unit: 'each',
        evidence: 'Replace 3 interior doors',
      },
    ]);
  });

  test('does not let an exclusion without keep or exclude language remove a rule include', () => {
    const measurements = { paintAreaSqft: 800, paintAreaBasis: 'combined' };
    const applied = applyScopeIntentToChecklist({
      notes: 'Paint walls and ceiling 800 sqft.',
      items: [{ id: 'paint', label: 'Interior paint', inputType: 'yes_no', state: 'included' }],
      scopeIntent: {
        items: [
          {
            id: 'paint',
            state: 'excluded',
            quantity: null,
            evidence: 'Paint walls and ceiling',
          },
        ],
      },
      measurements,
    });

    expect(applied.items[0].state).toBe('included');
    expect(measurements.paintAreaSqft).toBe(800);
  });

  test('a keep-the-doors read leaves the door install unconfirmed', () => {
    const draft = normalizeDraft(
      {
        projectType: 'other',
        rooms: [],
        scopeIntent: {
          items: [
            {
              id: 'interior_door_install',
              state: 'uncertain',
              quantity: null,
              evidence: 'Keep the windows and doors',
            },
          ],
        },
      },
      {
        originalNotes:
          'Whole house remodel. Paint all walls and ceilings. Keep the windows and doors.',
      }
    );
    const doors = (draft.scopeChecklist?.items || []).find(
      (item) => item.id === 'interior_door_install'
    );
    expect(doors?.state).not.toBe('included');
  });

  test('an ambiguous paint area stays blank', () => {
    const draft = normalizeDraft(
      {
        projectType: 'painting',
        rooms: [],
        scopeIntent: {
          items: [
            {
              id: 'paint',
              state: 'uncertain',
              quantity: null,
              evidence: 'Paint the room, about 250 sqft',
            },
          ],
        },
      },
      { originalNotes: 'Paint the room, about 250 sqft.' }
    );

    expect(draft.scopeMeasurements?.paintAreaSqft).toBeUndefined();
    expect(draft.scopeChecklist?.suggestedMeasurements?.paintAreaSqft).toBeUndefined();
    expect(draft.scopeIntent.items[0]).toMatchObject({
      id: 'paint',
      state: 'uncertain',
      quantity: null,
    });
  });

  test('an explicit paintable area is kept', () => {
    const draft = normalizeDraft(
      {
        projectType: 'painting',
        rooms: [],
        scopeIntent: {
          items: [
            {
              id: 'paint',
              state: 'included',
              quantity: 800,
              unit: 'sqft',
              evidence: 'Paint walls and ceiling 800 sqft',
            },
          ],
        },
      },
      { originalNotes: 'Paint walls and ceiling 800 sqft lump sum $2,400.' }
    );

    const paintArea =
      draft.scopeMeasurements?.paintAreaSqft ||
      draft.scopeMeasurements?.combinedPaintableAreaSqft ||
      draft.scopeChecklist?.suggestedMeasurements?.paintAreaSqft ||
      draft.scopeChecklist?.suggestedMeasurements?.combinedPaintableAreaSqft;
    expect(paintArea).toBe(800);
  });

  test('asks for a second intent pass only when the note is uncertain and intent is missing', () => {
    expect(
      draftNeedsScopeIntentPass({
        extractionConfidence: { requiresAiFallback: true },
        scopeIntent: { items: [] },
      })
    ).toBe(true);
    expect(
      draftNeedsScopeIntentPass({
        extractionConfidence: { requiresAiFallback: true },
        scopeIntent: {
          items: [{ id: 'paint', state: 'uncertain', quantity: null, evidence: 'about 250 sqft' }],
        },
      })
    ).toBe(false);
    expect(
      draftNeedsScopeIntentPass({
        extractionConfidence: { requiresAiFallback: false },
        scopeIntent: { items: [] },
      })
    ).toBe(false);

    const merged = mergeScopeIntentPass(
      {
        originalNotes: 'Keep the windows and doors. Paint the walls.',
        scopeChecklist: {
          items: [
            {
              id: 'interior_door_install',
              label: 'Interior door installation',
              inputType: 'yes_no',
              state: 'included',
            },
          ],
        },
        scopeMeasurements: {},
      },
      {
        items: [
          {
            id: 'interior_door_install',
            state: 'excluded',
            quantity: null,
            evidence: 'Keep the windows and doors',
          },
        ],
      },
      'Keep the windows and doors. Paint the walls.'
    );
    expect(merged.scopeChecklist.items[0].state).toBe('excluded');
  });
});
