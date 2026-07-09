const {
  generateClarifyQuestions,
  applyClarifyAnswers,
  applyClarifyPatch,
  buildDraftStateSummary,
  sanitizeQuestionItems,
  MEASUREMENT_KEY_WHITELIST,
} = require('../estimateDraftClarifyAgent');
const { enrichDraft } = require('../estimateDraftEnrichment');

const AI_DEPS_MODELS = {
  assistant: { estimate: 'gpt-4o' },
};
const AI_DEPS_RUNTIME = {
  assistant: { estimate: { responseFormat: { type: 'json_object' } } },
};

function fakeOpenAi(responseContent) {
  return {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(responseContent) } }],
        }),
      },
    },
  };
}

function baseDraft(overrides = {}) {
  return {
    projectType: 'adu',
    originalNotes: 'Detached ADU casita with drywall, permits, and cleanup.',
    rooms: [
      {
        name: 'Drywall',
        scope: 'Hang, tape, texture drywall',
        price: null,
        laborPrice: null,
        materialPrice: null,
        priceIncludesLaborAndMaterials: false,
        priceProvidedByUser: false,
      },
      {
        name: 'Permits / fees',
        scope: 'Permit fees and inspections',
        price: null,
        laborPrice: null,
        materialPrice: null,
        priceIncludesLaborAndMaterials: false,
        priceProvidedByUser: false,
      },
    ],
    allowances: [],
    inclusions: [],
    exclusions: [],
    missingInfo: [],
    ...overrides,
  };
}

describe('buildDraftStateSummary', () => {
  test('summarizes packages with pricing/measurement status', () => {
    const summary = buildDraftStateSummary(enrichDraft(baseDraft()));
    expect(summary).toContain('Project type: adu');
    expect(summary).toContain('Drywall');
    expect(summary).toContain('NO PRICE');
    expect(summary).toContain('Original notes');
  });
});

describe('sanitizeQuestionItems', () => {
  const enriched = enrichDraft(baseDraft());

  test('keeps valid items and drops invalid targets', () => {
    const items = sanitizeQuestionItems(
      [
        {
          question: 'What is the drywall surface sqft?',
          why: 'Needed to price hang and finish',
          kind: 'measurement',
          targetKey: 'drywallSqft',
          targetPackage: 'Drywall',
        },
        {
          question: 'What permit budget should we carry?',
          kind: 'pricing',
          targetKey: 'not_a_real_key',
          targetPackage: 'Nonexistent package',
        },
        { question: '' },
      ],
      enriched
    );
    expect(items).toHaveLength(2);
    expect(items[0].targetKey).toBe('drywallSqft');
    expect(items[0].targetPackage).toBe('Drywall');
    expect(items[1].targetKey).toBeNull();
    expect(items[1].targetPackage).toBeNull();
  });

  test('dedupes and caps at 5 questions', () => {
    const raw = Array.from({ length: 10 }, (_, i) => ({
      question: i < 2 ? 'Same question?' : `Question ${i}?`,
      kind: 'scope',
    }));
    const items = sanitizeQuestionItems(raw, enriched);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(new Set(items.map((i) => i.question)).size).toBe(items.length);
  });
});

describe('generateClarifyQuestions', () => {
  test('falls back to rule-based questions without an OpenAI client', async () => {
    const result = await generateClarifyQuestions(baseDraft(), { openai: null });
    expect(result.source).toBe('rules');
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questionItems.length).toBe(result.questions.length);
  });

  test('uses LLM questions when the model returns valid items', async () => {
    const openai = fakeOpenAi({
      questions: [
        {
          id: 'q1',
          question: 'What is the drywall surface sqft for the ADU?',
          why: 'Blocks drywall pricing',
          kind: 'measurement',
          targetKey: 'drywallSqft',
          targetPackage: 'Drywall',
        },
      ],
    });
    const result = await generateClarifyQuestions(baseDraft(), {
      openai,
      aiModels: AI_DEPS_MODELS,
      aiRuntime: AI_DEPS_RUNTIME,
    });
    expect(result.source).toBe('ai');
    expect(result.questions).toEqual(['What is the drywall surface sqft for the ADU?']);
    expect(result.questionItems[0].targetKey).toBe('drywallSqft');
    expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  test('falls back to rules when the model errors', async () => {
    const openai = {
      chat: { completions: { create: jest.fn().mockRejectedValue(new Error('boom')) } },
    };
    const result = await generateClarifyQuestions(baseDraft(), {
      openai,
      aiModels: AI_DEPS_MODELS,
      aiRuntime: AI_DEPS_RUNTIME,
    });
    expect(result.source).toBe('rules');
    expect(result.questions.length).toBeGreaterThan(0);
  });
});

describe('applyClarifyPatch', () => {
  test('applies whitelisted measurements and re-enriches', () => {
    const { draft, appliedSummary } = applyClarifyPatch(enrichDraft(baseDraft()), {
      measurements: [
        { key: 'drywallSqft', quantity: 1200, unit: 'sqft' },
        { key: 'evil_key', quantity: 999, unit: 'sqft' },
      ],
    });
    expect(draft.scopeMeasurements.drywallSqft).toBe(1200);
    expect(draft.scopeMeasurements.evil_key).toBeUndefined();
    expect(appliedSummary.some((s) => /drywallSqft/.test(s))).toBe(true);
  });

  test('rejects non-positive or non-numeric measurement quantities', () => {
    const { draft, appliedSummary } = applyClarifyPatch(enrichDraft(baseDraft()), {
      measurements: [
        { key: 'drywallSqft', quantity: -5 },
        { key: 'floorAreaSqft', quantity: 'lots' },
      ],
    });
    expect(draft.scopeMeasurements?.drywallSqft).toBeFalsy();
    expect(appliedSummary).toHaveLength(0);
  });

  test('applies lump-sum price to the matching room as user-provided', () => {
    const { draft, appliedSummary } = applyClarifyPatch(enrichDraft(baseDraft()), {
      packagePrices: [{ packageName: 'Permits / fees', amount: 2000, kind: 'lump_sum' }],
    });
    const permits = draft.rooms.find((r) => /permit/i.test(r.name));
    expect(permits.price).toBe(2000);
    expect(permits.priceProvidedByUser).toBe(true);
    expect(permits.priceIncludesLaborAndMaterials).toBe(true);
    expect(appliedSummary.some((s) => /\$2,000/.test(s))).toBe(true);
  });

  test('ignores prices for unknown packages and invalid amounts', () => {
    const { draft } = applyClarifyPatch(enrichDraft(baseDraft()), {
      packagePrices: [
        { packageName: 'Swimming pool', amount: 50000, kind: 'lump_sum' },
        { packageName: 'Drywall', amount: -100, kind: 'lump_sum' },
      ],
    });
    const drywall = draft.rooms.find((r) => /drywall/i.test(r.name));
    expect(drywall.price).toBeNull();
    expect(draft.rooms.some((r) => /swimming/i.test(r.name))).toBe(false);
  });

  test('labor price merges with existing material price', () => {
    const withMaterial = baseDraft();
    withMaterial.rooms[0].materialPrice = 1500;
    const { draft } = applyClarifyPatch(enrichDraft(withMaterial), {
      packagePrices: [{ packageName: 'Drywall', amount: 3000, kind: 'labor' }],
    });
    const drywall = draft.rooms.find((r) => /drywall/i.test(r.name));
    expect(drywall.laborPrice).toBe(3000);
    expect(drywall.price).toBe(4500);
    expect(drywall.priceIncludesLaborAndMaterials).toBe(false);
  });

  test('project info only fills blanks', () => {
    const named = baseDraft({ customerName: 'Ruth' });
    const { draft } = applyClarifyPatch(enrichDraft(named), {
      projectInfo: { customerName: 'Someone Else', projectAddress: '12 Main St' },
    });
    expect(draft.customerName).toBe('Ruth');
    expect(draft.projectAddress).toBe('12 Main St');
  });

  test('notes addendum is appended with Clarified prefix', () => {
    const { draft } = applyClarifyPatch(enrichDraft(baseDraft()), {
      notesAddendum: 'Cabinets are stock, supplied by contractor.',
    });
    expect(draft.originalNotes).toMatch(/Clarified: Cabinets are stock/);
  });
});

describe('applyClarifyAnswers', () => {
  const answers = [
    {
      question: 'What is the drywall surface sqft?',
      answer: '1200 sqft',
      targetKey: 'drywallSqft',
      targetPackage: 'Drywall',
    },
  ];

  test('requires at least one answer', async () => {
    await expect(applyClarifyAnswers(baseDraft(), [], { openai: null })).rejects.toThrow(
      /at least one/i
    );
  });

  test('no-LLM fallback appends answers to notes and re-enriches', async () => {
    const result = await applyClarifyAnswers(baseDraft(), answers, { openai: null });
    expect(result.source).toBe('rules');
    expect(result.draft.originalNotes).toMatch(/Clarified — What is the drywall surface sqft\?: 1200 sqft/);
    expect(result.appliedSummary.length).toBeGreaterThan(0);
  });

  test('LLM patch path applies structured updates', async () => {
    const openai = fakeOpenAi({
      measurements: [{ key: 'drywallSqft', quantity: 1200, unit: 'sqft' }],
      packagePrices: [{ packageName: 'Permits / fees', amount: 2000, kind: 'lump_sum' }],
      inclusions: [],
      exclusions: [],
      projectInfo: { customerName: null, projectAddress: null, customerPhone: null },
      notesAddendum: null,
    });
    const result = await applyClarifyAnswers(
      baseDraft(),
      [
        ...answers,
        { question: 'Permit budget?', answer: '$2,000', targetPackage: 'Permits / fees' },
      ],
      { openai, aiModels: AI_DEPS_MODELS, aiRuntime: AI_DEPS_RUNTIME }
    );
    expect(result.source).toBe('ai');
    expect(result.draft.scopeMeasurements.drywallSqft).toBe(1200);
    const permits = result.draft.rooms.find((r) => /permit/i.test(r.name));
    expect(permits.price).toBe(2000);
  });

  test('falls back to notes append when LLM errors', async () => {
    const openai = {
      chat: { completions: { create: jest.fn().mockRejectedValue(new Error('boom')) } },
    };
    const result = await applyClarifyAnswers(baseDraft(), answers, {
      openai,
      aiModels: AI_DEPS_MODELS,
      aiRuntime: AI_DEPS_RUNTIME,
    });
    expect(result.source).toBe('rules');
    expect(result.draft.originalNotes).toMatch(/Clarified/);
  });
});

describe('MEASUREMENT_KEY_WHITELIST', () => {
  test('covers the core quick-measurement keys', () => {
    for (const key of ['drywallSqft', 'floorAreaSqft', 'concreteCy', 'baseboardLf', 'roofSquares']) {
      expect(MEASUREMENT_KEY_WHITELIST.has(key)).toBe(true);
    }
  });
});
