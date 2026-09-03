const mockCreate = jest.fn();

jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }))
);

describe('AI dashboard OpenAI request', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key-12345678901234567890';
  });

  beforeEach(() => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({ insights: [], nextSteps: [] }),
        },
      }],
    });
  });

  afterAll(() => {
    if (originalKey == null) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  test('normalizes the GPT-5 dashboard request before sending it', async () => {
    jest.resetModules();
    const { buildAiDashboardForUser } = require('../aiDashboardService');

    await buildAiDashboardForUser('user-1', [{
      id: 'p1',
      userId: 'user-1',
      title: 'Kitchen Remodel',
      status: 'active',
      bidPrice: 50000,
      estimatedCost: 30000,
      actualCost: 10000,
      progress: 40,
      expenses: [],
      milestones: [],
    }], true, []);

    expect(mockCreate).toHaveBeenCalled();
    const request = mockCreate.mock.calls[0][0];
    expect(request.model).toBe('gpt-5.6-luna');
    expect(request.temperature).toBeUndefined();
    expect(request.max_tokens).toBeUndefined();
    expect(request.max_completion_tokens).toBeUndefined();
  });
});
