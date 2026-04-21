describe('leadScoring service', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.resetModules();
    jest.clearAllMocks();
    jest.unmock('../../config/aiConfig');
  });

  function loadService({ client, models }) {
    jest.doMock('../../config/aiConfig', () => ({
      createOpenAiClient: jest.fn(() => client),
      getAiModels: jest.fn(() => models),
      getAiRuntimeSettings: jest.fn(() => ({
        leadScoring: {
          scoring: { temperature: 0.11, maxTokens: 501 },
          insights: { temperature: 0.22, maxTokens: 502 },
          followUp: { temperature: 0.33, maxTokens: 503 },
          prioritize: { temperature: 0.44, maxTokens: 504 },
        },
      })),
    }));

    return require('../leadScoring');
  }

  test('scoreLead uses the configured scoring model slot', async () => {
    const createMock = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              score: 84.6,
              reasoning: 'Strong fit',
              priority: 'high',
              factors: {
                budget: 20,
                timeline: 16,
                projectSize: 12,
                location: 14,
                requirements: 13,
                source: 8,
              },
              recommendations: ['Call this lead today'],
            }),
          },
        },
      ],
    });

    const service = loadService({
      client: {
        chat: {
          completions: {
            create: createMock,
          },
        },
      },
      models: {
        leadScoring: {
          scoring: 'gpt-test-score',
          insights: 'gpt-test-insights',
          followUp: 'gpt-test-follow-up',
          prioritize: 'gpt-test-prioritize',
        },
      },
    });

    const result = await service.scoreLead({
      name: 'Jane Doe',
      budget: { min: 100000, max: 150000, currency: 'USD' },
      timeline: { startDate: '2026-05-01', duration: 8, urgency: 'high' },
    });

    expect(result.score).toBe(85);
    expect(result.priority).toBe('high');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-test-score',
        temperature: 0.11,
        max_tokens: 501,
      })
    );
  });

  test('dedicated lead scoring methods use their own configured model slots', async () => {
    const createMock = jest
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ marketOpportunity: 'High', competitivePosition: 'Strong', riskFactors: ['Timing'], recommendedApproach: 'Move fast', followUpStrategy: 'Call tomorrow' }) } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ subject: 'Quick follow-up', message: 'Checking in.', nextSteps: 'Send estimate' }) } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ prioritizedLeads: [{ id: 'lead-1', priority: 'high', reasoning: 'Best fit', recommendedAction: 'Call now' }] }) } }],
      });

    const service = loadService({
      client: {
        chat: {
          completions: {
            create: createMock,
          },
        },
      },
      models: {
        leadScoring: {
          scoring: 'gpt-test-score',
          insights: 'gpt-test-insights',
          followUp: 'gpt-test-follow-up',
          prioritize: 'gpt-test-prioritize',
        },
      },
    });

    await service.getLeadInsights({ projectType: 'Kitchen remodel' });
    await service.generateFollowUpMessage({ name: 'Jane Doe' }, 'email');
    await service.prioritizeLeads([{ id: 'lead-1' }]);

    expect(createMock.mock.calls[0][0].model).toBe('gpt-test-insights');
    expect(createMock.mock.calls[0][0].temperature).toBe(0.22);
    expect(createMock.mock.calls[0][0].max_tokens).toBe(502);
    expect(createMock.mock.calls[1][0].model).toBe('gpt-test-follow-up');
    expect(createMock.mock.calls[1][0].temperature).toBe(0.33);
    expect(createMock.mock.calls[1][0].max_tokens).toBe(503);
    expect(createMock.mock.calls[2][0].model).toBe('gpt-test-prioritize');
    expect(createMock.mock.calls[2][0].temperature).toBe(0.44);
    expect(createMock.mock.calls[2][0].max_tokens).toBe(504);
  });

  test('scoreLead throws OpenAIError when no client is configured', async () => {
    const service = loadService({
      client: null,
      models: {
        leadScoring: {
          scoring: 'gpt-test-score',
          insights: 'gpt-test-insights',
          followUp: 'gpt-test-follow-up',
          prioritize: 'gpt-test-prioritize',
        },
      },
    });

    await expect(service.scoreLead({ name: 'Jane Doe' })).rejects.toMatchObject({
      name: 'OpenAIError',
      message: 'Failed to score lead with AI',
    });
  });
});
