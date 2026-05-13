const express = require('express');
const request = require('supertest');

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/ocr', require('../ocr'));
  return app;
}

describe('ocr routes', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.clearAllMocks();
    jest.unmock('../../config/aiConfig');
  });

  test('returns 503 when OCR client is unavailable', async () => {
    process.env.ENABLE_MOCK_OCR = 'false';
    jest.doMock('../../config/aiConfig', () => ({
      createOpenAiClient: jest.fn(() => null),
      getAiModels: jest.fn(() => ({ ocr: { receipt: 'gpt-test-ocr' } })),
      getAiRuntimeSettings: jest.fn(() => ({ ocr: { receipt: { temperature: 0.25, maxTokens: 1234 } } })),
      getOpenAiApiKey: jest.fn(() => ''),
      hasValidOpenAiKey: jest.fn(() => false),
    }));

    const app = buildApp();
    const response = await request(app)
      .post('/api/ocr/receipt/openai')
      .send({ image: 'ZmFrZQ==' });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      error: 'OpenAI API key not configured',
    });
  });

  test('uses the configured OCR model slot for receipt parsing', async () => {
    process.env.ENABLE_MOCK_OCR = 'false';
    const createMock = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: '```json\n{"vendor":"Home Depot","amount":127.49,"category":"Materials","confidence":91}\n```',
          },
        },
      ],
    });

    jest.doMock('../../config/aiConfig', () => ({
      createOpenAiClient: jest.fn(() => ({
        chat: {
          completions: {
            create: createMock,
          },
        },
      })),
      getAiModels: jest.fn(() => ({ ocr: { receipt: 'gpt-test-ocr' } })),
      getAiRuntimeSettings: jest.fn(() => ({ ocr: { receipt: { temperature: 0.25, maxTokens: 1234 } } })),
      getOpenAiApiKey: jest.fn(() => 'sk-test-12345678901234567890'),
      hasValidOpenAiKey: jest.fn(() => true),
    }));

    const app = buildApp();
    const response = await request(app)
      .post('/api/ocr/receipt/openai')
      .send({ image: 'ZmFrZQ==' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.vendor).toBe('Home Depot');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-test-ocr',
        temperature: 0.25,
        max_tokens: 1234,
        response_format: { type: 'json_object' },
      })
    );
  });
});
