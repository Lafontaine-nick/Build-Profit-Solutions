const {
  generateClarifyQuestions,
  applyClarifyAnswers,
  refineEstimateDraft,
  applyClarifyPatch,
  buildDraftStateSummary,
  buildDeterministicQuantityPatchFromAnswers,
  buildDeterministicRefinePatchFromCommand,
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
    expect(appliedSummary.some((s) => /Drywall: 1,200 sqft/i.test(s))).toBe(true);
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

  test('removes matching packages and records summary', () => {
    const { draft, appliedSummary } = applyClarifyPatch(enrichDraft(baseDraft()), {
      removePackages: ['Drywall'],
      exclusions: ['Drywall — customer doing hang/tape'],
    });
    expect(draft.rooms.some((r) => /drywall/i.test(r.name))).toBe(false);
    expect(draft.rooms.some((r) => /permit/i.test(r.name))).toBe(true);
    expect(appliedSummary.some((s) => /Removed: Drywall/i.test(s))).toBe(true);
    expect(draft.exclusions.some((e) => /drywall/i.test(e))).toBe(true);
  });

  test('refine mode can overwrite project info', () => {
    const named = baseDraft({ customerName: 'Ruth' });
    const { draft } = applyClarifyPatch(
      enrichDraft(named),
      { projectInfo: { customerName: 'Bob' } },
      { overwriteProjectInfo: true }
    );
    expect(draft.customerName).toBe('Bob');
  });

  test('packageQuantities stamp LF onto utility trenching room', () => {
    const adu = {
      projectType: 'adu',
      originalNotes: 'ADU with utility trenching and roofing',
      rooms: [
        {
          name: 'Utility trenching',
          scope: 'Water and sewer trench',
          price: null,
          laborPrice: null,
          materialPrice: null,
          priceIncludesLaborAndMaterials: false,
          priceProvidedByUser: false,
        },
        {
          name: 'Roofing / tie-in',
          scope: 'Roofing for ADU',
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
    };
    const { draft, appliedSummary } = applyClarifyPatch(enrichDraft(adu), {
      packageQuantities: [
        { packageName: 'Utility trenching', quantity: 50, unit: 'lf' },
        { packageName: 'Roofing / tie-in', quantity: 1100, unit: 'sqft' },
      ],
    });
    const trench = draft.rooms.find((r) => /trench/i.test(r.name));
    const roof = draft.rooms.find((r) => /roof/i.test(r.name));
    expect(trench.scopeQuantities?.[0]).toMatchObject({ quantity: 50, unit: 'lf' });
    expect(roof.scopeQuantities?.[0]).toMatchObject({ quantity: 1100, unit: 'sqft' });
    expect(appliedSummary.some((s) => /Utility trenching: 50 LF/i.test(s))).toBe(true);
    expect(appliedSummary.some((s) => /Roofing.*1,100 sqft/i.test(s))).toBe(true);
    // Must not show 1,100 squares
    expect(roof.scopeQuantities?.[0].unit).not.toBe('squares');
  });

  test('rejects roofing squares when quantity looks like sqft', () => {
    const adu = {
      projectType: 'adu',
      originalNotes: 'ADU roofing',
      rooms: [
        {
          name: 'Roofing / tie-in',
          scope: 'Roofing',
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
    };
    const { draft } = applyClarifyPatch(enrichDraft(adu), {
      packageQuantities: [{ packageName: 'Roofing / tie-in', quantity: 1100, unit: 'squares' }],
    });
    const roof = draft.rooms.find((r) => /roof/i.test(r.name));
    expect(roof.scopeQuantities?.[0]).toMatchObject({ quantity: 1100, unit: 'sqft' });
  });

  test('addPackages creates a new room with optional price', () => {
    const { draft, appliedSummary } = applyClarifyPatch(enrichDraft(baseDraft()), {
      addPackages: [{ name: 'Landscaping', scope: 'Front yard landscaping', amount: 3500 }],
    });
    const landscaping = draft.rooms.find((r) => /landscap/i.test(r.name));
    expect(landscaping).toBeTruthy();
    expect(landscaping.price).toBe(3500);
    expect(landscaping.priceProvidedByUser).toBe(true);
    expect(appliedSummary.some((s) => /Added: Landscaping/i.test(s))).toBe(true);
  });

  test('addPackages does not duplicate an existing package', () => {
    const { draft, appliedSummary } = applyClarifyPatch(enrichDraft(baseDraft()), {
      addPackages: [{ name: 'Drywall', amount: 1000 }],
    });
    expect(draft.rooms.filter((r) => /drywall/i.test(r.name))).toHaveLength(1);
    expect(appliedSummary.some((s) => /Added:/i.test(s))).toBe(false);
  });
});

describe('buildDeterministicQuantityPatchFromAnswers', () => {
  test('builds package quantities from numeric answers', () => {
    const patch = buildDeterministicQuantityPatchFromAnswers([
      {
        question: 'What is the linear footage for utility trenching?',
        answer: '50',
        targetPackage: 'Utility trenching',
      },
      {
        question: 'What is the square footage of roofing required?',
        answer: '1100',
        targetPackage: 'Roofing / tie-in',
        targetKey: 'roofSquares',
      },
    ]);
    expect(patch.packageQuantities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ packageName: 'Utility trenching', quantity: 50, unit: 'lf' }),
        expect.objectContaining({ packageName: 'Roofing / tie-in', quantity: 1100, unit: 'sqft' }),
      ])
    );
    // roofSquares from sqft question should be converted to squares (11)
    expect(patch.measurements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'roofSquares', quantity: 11 }),
      ])
    );
  });
});

describe('refineEstimateDraft', () => {
  test('requires a command', async () => {
    await expect(refineEstimateDraft(baseDraft(), '  ', { openai: null })).rejects.toThrow(/command/i);
  });

  test('no-LLM fallback applies deterministic permit price', async () => {
    const result = await refineEstimateDraft(baseDraft(), 'make permits $2000', { openai: null });
    expect(result.source).toBe('rules');
    const permits = result.draft.rooms.find((r) => /permit/i.test(r.name));
    expect(permits.price).toBe(2000);
    expect(permits.scopeQuantities?.[0]?.unit).not.toBe('sqft');
    expect(['lump_sum', 'allowance']).toContain(permits.scopeQuantities?.[0]?.unit);
    expect(result.appliedSummary.some((s) => /\$2,000/.test(s))).toBe(true);
  });

  test('no-LLM add command creates a new scope package', async () => {
    const result = await refineEstimateDraft(baseDraft(), 'add landscaping $3500', { openai: null });
    expect(result.source).toBe('rules');
    const landscaping = result.draft.rooms.find((r) => /landscap/i.test(r.name));
    expect(landscaping).toBeTruthy();
    expect(landscaping.price).toBe(3500);
    expect(result.appliedSummary.some((s) => /Added:.*Landscap/i.test(s) || /\$3,500/.test(s))).toBe(
      true
    );
  });

  test('disposal price command updates cleanup package and itemQuantities', async () => {
    const draft = enrichDraft({
      ...baseDraft(),
      rooms: [
        ...(baseDraft().rooms || []),
        {
          name: 'Cleanup & disposal',
          scope: 'Final clean and haul-off',
          price: 1000,
          laborPrice: null,
          materialPrice: null,
          priceIncludesLaborAndMaterials: true,
          priceProvidedByUser: true,
          scopeQuantities: [{ label: 'Cleanup & disposal', quantity: 1, unit: 'lump_sum', quantitySource: 'user_entered' }],
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          cleanup: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
          cleanup__allowance: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
    });
    const result = await refineEstimateDraft(draft, 'Add disposal for 8,000', { openai: null });
    const cleanup = result.draft.rooms.find((r) => /cleanup/i.test(r.name));
    expect(cleanup?.price).toBe(8000);
    expect(result.draft.rooms.filter((r) => /disposal/i.test(r.name))).toHaveLength(1);
    expect(result.draft.scopeMeasurements?.itemQuantities?.cleanup?.quantity).toBe(8000);
    expect(result.appliedSummary.some((s) => /Cleanup.*\$8,000/i.test(s))).toBe(true);
  });

  test('priced add pool bid creates one package even when LLM would duplicate', async () => {
    const openai = fakeOpenAi({
      addPackages: [
        { name: 'Pool Installation', amount: 12000 },
        { name: 'Pool Bid', amount: 12000 },
      ],
      packagePrices: [
        { packageName: 'Pool Installation', amount: 12000, kind: 'lump_sum' },
      ],
      notesAddendum: 'Added pool scope',
    });
    const result = await refineEstimateDraft(enrichDraft(baseDraft()), 'Add pool bid for 12000', {
      openai,
      aiModels: AI_DEPS_MODELS,
      aiRuntime: AI_DEPS_RUNTIME,
    });
    const poolRooms = (result.draft.rooms || []).filter((r) => /pool/i.test(r.name));
    expect(result.source).toBe('rules');
    expect(poolRooms).toHaveLength(1);
    expect(poolRooms[0].price).toBe(12000);
    expect(result.appliedSummary.filter((s) => /^Added:/i.test(s))).toHaveLength(1);
  });

  test('material/labor split command does not create duplicate scope rows', async () => {
    const draft = enrichDraft({
      ...baseDraft(),
      rooms: [
        {
          name: 'Cabinet hardware',
          scope: 'Pulls and knobs',
          price: null,
          laborPrice: null,
          materialPrice: null,
          priceIncludesLaborAndMaterials: false,
          priceProvidedByUser: false,
        },
      ],
    });
    const result = await refineEstimateDraft(
      draft,
      'cabinet hardware $300 material and $900 labor',
      { openai: null }
    );
    expect(result.draft.rooms.filter((r) => /cabinet hardware/i.test(r.name))).toHaveLength(1);
    const hardware = result.draft.rooms.find((r) => /cabinet hardware/i.test(r.name));
    expect(hardware?.materialPrice).toBe(300);
    expect(hardware?.laborPrice).toBe(900);
    expect(hardware?.price).toBe(1200);
  });

  test('separate pool budget into material and labor parses both legs', async () => {
    const draft = enrichDraft({
      ...baseDraft(),
      rooms: [
        {
          name: 'Pool',
          scope: 'Pool installation',
          price: 12000,
          laborPrice: null,
          materialPrice: null,
          priceIncludesLaborAndMaterials: true,
          priceProvidedByUser: true,
        },
      ],
    });
    const command =
      "For 'pool' separate the 12,000 budget into 5,000 material and 7,000 for labor";
    const result = await refineEstimateDraft(draft, command, { openai: null });
    expect(result.source).toBe('rules');
    const pool = result.draft.rooms.find((r) => /pool/i.test(r.name));
    expect(pool?.materialPrice).toBe(5000);
    expect(pool?.laborPrice).toBe(7000);
    expect(pool?.price).toBe(12000);
    expect(result.appliedSummary.some((s) => /\$5,000.*material/i.test(s))).toBe(true);
    expect(result.appliedSummary.some((s) => /\$7,000.*labor/i.test(s))).toBe(true);
  });

  test('add pool with parenthetical and split creates package with both legs', async () => {
    const draft = enrichDraft({
      ...baseDraft(),
      rooms: [],
      scopePackages: [],
    });
    const command =
      'Add (pool) to the scope and separate 12,000 into 5000 for material and 7000 for labor';
    const result = await refineEstimateDraft(draft, command, { openai: null });
    expect(result.source).toBe('rules');
    expect(result.appliedSummary.some((s) => /Revision noted/i.test(s))).toBe(false);
    expect(result.appliedSummary.some((s) => /^Added:/i.test(s))).toBe(true);
    const poolRooms = result.draft.rooms.filter((r) => /pool/i.test(r.name));
    expect(poolRooms).toHaveLength(1);
    const pool = poolRooms[0];
    expect(pool.materialPrice).toBe(5000);
    expect(pool.laborPrice).toBe(7000);
    expect(pool.price).toBe(12000);
  });

  test('mergePatchQuantities keeps both material and labor legs for same package', () => {
    const { mergePatchQuantities } = require('../estimateDraftClarifyAgent');
    const merged = mergePatchQuantities(
      {
        packagePrices: [
          { packageName: 'Pool', amount: 5000, kind: 'material' },
        ],
      },
      {
        packagePrices: [
          { packageName: 'Pool', amount: 7000, kind: 'labor' },
        ],
      }
    );
    expect(merged.packagePrices).toHaveLength(2);
    expect(merged.packagePrices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amount: 5000, kind: 'material' }),
        expect.objectContaining({ amount: 7000, kind: 'labor' }),
      ])
    );
  });

  test('Ask AI material/labor split stamps allowance units, not fake sqft', () => {
    const kitchen = enrichDraft({
      projectType: 'kitchen',
      originalNotes: 'Kitchen remodel cabinets and hardware',
      rooms: [
        {
          name: 'Cabinet hardware',
          scope: 'Pulls, knobs, and install.',
          price: null,
          laborPrice: null,
          materialPrice: null,
          priceIncludesLaborAndMaterials: false,
          priceProvidedByUser: false,
          pricingItems: [],
          missingPriceItems: [],
        },
        {
          name: 'Kitchen Demo',
          scope: 'Cabinet & countertop demo',
          price: null,
          laborPrice: null,
          materialPrice: null,
          priceIncludesLaborAndMaterials: false,
          priceProvidedByUser: false,
          pricingItems: [],
          missingPriceItems: [],
        },
      ],
    });

    // Simulate LLM wrongly also emitting quantity=1200 sqft for a $1200 price.
    const { draft, appliedSummary } = applyClarifyPatch(kitchen, {
      packagePrices: [
        { packageName: 'Cabinet hardware', amount: 300, kind: 'material' },
        { packageName: 'Cabinet hardware', amount: 900, kind: 'labor' },
        { packageName: 'Kitchen Demo', amount: 500, kind: 'labor' },
      ],
      packageQuantities: [
        { packageName: 'Cabinet hardware', quantity: 1200, unit: 'sqft' },
        { packageName: 'Kitchen Demo', quantity: 500, unit: 'lump_sum' },
      ],
    });

    const hardware = draft.rooms.find((r) => /hardware/i.test(r.name));
    expect(hardware.materialPrice).toBe(300);
    expect(hardware.laborPrice).toBe(900);
    expect(hardware.price).toBe(1200);
    expect(hardware.scopeQuantities?.[0]?.unit).not.toBe('sqft');
    expect(['lump_sum', 'allowance']).toContain(hardware.scopeQuantities?.[0]?.unit);

    const iq = draft.scopeMeasurements?.itemQuantities || {};
    expect(iq.cabinet_hardware__material).toMatchObject({
      quantity: 300,
      unit: 'allowance',
    });
    expect(iq.cabinet_hardware__labor).toMatchObject({
      quantity: 900,
      unit: 'allowance',
    });
    expect(iq.cabinet_hardware?.unit).toBe('allowance');
    expect(iq.cabinet_hardware?.quantity).toBe(1200);

    const demo = draft.rooms.find((r) => /demo/i.test(r.name));
    expect(demo.laborPrice).toBe(500);
    expect(demo.price).toBe(500);
    expect(demo.scopeQuantities?.[0]?.unit).not.toBe('sqft');
    expect(['lump_sum', 'allowance']).toContain(demo.scopeQuantities?.[0]?.unit);

    expect(appliedSummary.some((s) => /\$300.*material/i.test(s))).toBe(true);
    expect(appliedSummary.some((s) => /\$900.*labor/i.test(s))).toBe(true);
    expect(appliedSummary.some((s) => /\$500.*labor/i.test(s))).toBe(true);
  });

  test('deterministic refine parses material/labor split commands', () => {
    const patch = buildDeterministicRefinePatchFromCommand(
      'For cabinet hardware can you make $300 for material and $900 for Labor'
    );
    expect(patch.packagePrices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amount: 300, kind: 'material' }),
        expect.objectContaining({ amount: 900, kind: 'labor' }),
      ])
    );
    expect(patch.packageQuantities || []).toHaveLength(0);
  });

  test('deterministic refine parses demo labor dollars', () => {
    const patch = buildDeterministicRefinePatchFromCommand('Can you add for demo $500 Labor?');
    expect(patch.packagePrices).toEqual(
      expect.arrayContaining([expect.objectContaining({ amount: 500, kind: 'labor' })])
    );
  });

  test('LLM refine path applies price cut and package removal', async () => {
    const openai = fakeOpenAi({
      measurements: [],
      packagePrices: [{ packageName: 'Permits / fees', amount: 1500, kind: 'lump_sum' }],
      removePackages: ['Drywall'],
      inclusions: [],
      exclusions: ['Drywall excluded — customer doing it'],
      projectInfo: { customerName: null, projectAddress: null, customerPhone: null },
      notesAddendum: 'Removed drywall; permits set to $1500',
    });
    const priced = baseDraft();
    priced.rooms[1].price = 2500;
    priced.rooms[1].priceProvidedByUser = true;
    priced.rooms[1].priceIncludesLaborAndMaterials = true;

    const result = await refineEstimateDraft(priced, 'remove drywall, set permits to $1500', {
      openai,
      aiModels: AI_DEPS_MODELS,
      aiRuntime: AI_DEPS_RUNTIME,
    });
    expect(result.source).toBe('ai');
    expect(result.draft.rooms.some((r) => /drywall/i.test(r.name))).toBe(false);
    const permits = result.draft.rooms.find((r) => /permit/i.test(r.name));
    expect(permits.price).toBe(1500);
    expect(result.appliedSummary.some((s) => /Removed/i.test(s))).toBe(true);
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
