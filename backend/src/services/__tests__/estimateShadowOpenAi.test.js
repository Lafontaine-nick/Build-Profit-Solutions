const {
  buildShadowPrompt,
  requestOpenAiShadowProposal,
  validateShadowProposal,
} = require('../estimateShadowOpenAi');

const catalog = [
  { id: 'flooring_install', label: 'Flooring installation', units: ['sqft'] },
  { id: 'carpet_demo', label: 'Carpet demolition', units: ['sqft'] },
];

describe('estimate OpenAI shadow adapter', () => {
  test('builds a conservative catalog-constrained prompt', () => {
    const prompt = buildShadowPrompt({
      notes: 'Replace carpet with 900 sqft LVP. Owner removes carpet.',
      context: { templateKey: 'flooring' },
      catalog,
    });

    expect(prompt).toContain('Do not price anything and do not invent work.');
    expect(prompt).toContain('Replacement language alone');
    expect(prompt).toContain('A clarification candidate must not also appear in scopeItems.');
    expect(prompt).toContain('ask for the floor_demo clarification');
    expect(prompt).toContain('exactly one shower_demo clarification');
    expect(prompt).toContain('reuse the installation quantity for floor_demo');
    expect(prompt).toContain('Use the generic paint catalog ID');
    expect(prompt).toContain('A named high-level scope');
    expect(prompt).toContain('Map generic "flooring"');
    expect(prompt).toContain('Map HVAC service call');
    expect(prompt).toContain('Do not put hvac in exclusions');
    expect(prompt).toContain('architectural shingles');
    expect(prompt).toContain('singular service call');
    expect(prompt).toContain('exclude only hang');
    expect(prompt).toContain('flooring_install');
    expect(prompt).toContain('carpet_demo');
    expect(prompt).toContain('Owner removes carpet.');
  });

  test('rejects unknown, duplicate, and invalid-unit model output', () => {
    const proposal = validateShadowProposal(
      {
        scopeItems: [
          { id: 'flooring_install', quantity: 900, unit: 'sqft' },
          { id: 'flooring_install', quantity: 900, unit: 'sqft' },
          { id: 'price_estimate', quantity: 1000, unit: 'dollars' },
          { id: 'carpet_demo', quantity: 900, unit: 'each' },
        ],
        exclusions: ['carpet_demo', 'price_estimate'],
        clarifications: [{ id: 'flooring_install', question: 'Which floor?' }],
        confidence: 'high',
      },
      catalog
    );

    expect(proposal.scopeItems).toEqual([
      {
        id: 'flooring_install',
        quantity: 900,
        unit: 'sqft',
        evidence: null,
        status: 'included',
        responsibility: 'contractor',
      },
    ]);
    expect(proposal.exclusions).toEqual(['carpet_demo']);
    expect(proposal.confidence).toBe('high');
    expect(proposal.rejectedItems).toEqual(
      expect.arrayContaining([
        { type: 'scope', id: 'flooring_install', reason: 'duplicate' },
        { type: 'scope', id: 'price_estimate', reason: 'not_in_catalog' },
        { type: 'scope', id: 'carpet_demo', reason: 'unit_not_allowed' },
        { type: 'exclusion', id: 'price_estimate', reason: 'not_in_catalog' },
      ])
    );
  });

  test('does not call OpenAI while shadow mode is disabled', async () => {
    const openai = {
      chat: { completions: { create: jest.fn() } },
    };

    const result = await requestOpenAiShadowProposal({
      openai,
      model: 'gpt-5.6-terra',
      notes: 'Install 900 sqft LVP.',
      catalog,
      env: { AI_ESTIMATE_SHADOW_ENABLED: 'false' },
    });

    expect(result).toEqual({
      enabled: false,
      proposal: null,
      reason: 'shadow_mode_disabled',
    });
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  test('returns only validated proposal data when enabled', async () => {
    const create = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              scopeItems: [
                {
                  id: 'flooring_install',
                  quantity: 900,
                  unit: 'sqft',
                  evidence: '900 sqft LVP',
                },
                { id: 'unsupported_scope', quantity: 1, unit: 'each' },
              ],
              exclusions: ['carpet_demo'],
              clarifications: [],
              confidence: 'high',
            }),
          },
        },
      ],
      usage: { total_tokens: 42 },
    });
    const openai = { chat: { completions: { create } } };

    const result = await requestOpenAiShadowProposal({
      openai,
      model: 'gpt-5.6-terra',
      runtime: { maxTokens: 600, temperature: 0 },
      notes: 'Replace carpet with 900 sqft LVP. Owner removes carpet.',
      context: { templateKey: 'flooring' },
      catalog,
      env: { AI_ESTIMATE_SHADOW_ENABLED: 'true' },
    });

    expect(result.enabled).toBe(true);
    expect(result.proposal.scopeItems).toEqual([
      {
        id: 'flooring_install',
        quantity: 900,
        unit: 'sqft',
        evidence: '900 sqft LVP',
        status: 'included',
        responsibility: 'contractor',
      },
    ]);
    expect(result.proposal.rejectedItems).toEqual([
      { type: 'scope', id: 'unsupported_scope', reason: 'not_in_catalog' },
    ]);
    expect(result.usage).toEqual({ total_tokens: 42 });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.6-terra',
        max_completion_tokens: 600,
      })
    );
  });

  test('does not treat an HVAC service call as an HVAC exclusion', () => {
    const proposal = validateShadowProposal(
      {
        scopeItems: [{ id: 'service_call', quantity: 1, unit: 'each' }],
        exclusions: ['hvac'],
        clarifications: [],
      },
      [
        { id: 'service_call', label: 'Service call', units: ['each'] },
        { id: 'hvac', label: 'HVAC', units: ['each'] },
      ]
    );

    expect(proposal.exclusions).toEqual([]);
    expect(proposal.rejectedItems).toEqual([
      {
        type: 'exclusion',
        id: 'hvac',
        reason: 'service_call_does_not_imply_hvac_exclusion',
      },
    ]);
  });

  test('maps owner-handled canonical items to exclusions without inventing catalog ids', () => {
    const proposal = validateShadowProposal(
      {
        items: [
          {
            id: 'flooring_install',
            action: 'install',
            object: 'lvp',
            status: 'included',
            responsibility: 'contractor',
            quantity: 1200,
            unit: 'sqft',
          },
          {
            id: 'carpet_demo',
            action: 'remove',
            object: 'carpet',
            status: 'excluded',
            responsibility: 'owner',
          },
          {
            action: 'install',
            object: 'acoustic wood slat wall',
            status: 'included',
            catalogMatch: null,
          },
        ],
      },
      catalog
    );

    expect(proposal.scopeItems.map(item => item.id)).toEqual(['flooring_install']);
    expect(proposal.exclusions).toEqual(['carpet_demo']);
    expect(proposal.unmatchedItems).toEqual([
      {
        type: 'scope',
        id: null,
        reason: 'uncataloged_work',
        action: 'install',
        object: 'acoustic wood slat wall',
      },
    ]);
  });
});
