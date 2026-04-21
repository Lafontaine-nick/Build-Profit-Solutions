describe('aiConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  test('returns default provider, model map, and runtime settings', () => {
    const { DEFAULT_PROVIDER, JSON_RESPONSE_FORMAT, getAiModels, getAiProvider, getAiRuntimeSettings } = require('../aiConfig');

    expect(getAiProvider()).toBe(DEFAULT_PROVIDER);
    expect(getAiModels()).toEqual({
      assistant: {
        router: 'gpt-4o-mini',
        response: 'gpt-4o',
        estimate: 'gpt-4o',
        vision: 'gpt-4o',
        transcription: 'whisper-1',
      },
      dashboard: {
        summary: 'gpt-4o-mini',
      },
      ocr: {
        receipt: 'gpt-4o',
      },
      leadScoring: {
        scoring: 'gpt-4',
        insights: 'gpt-4',
        followUp: 'gpt-4',
        prioritize: 'gpt-4',
      },
    });
    expect(getAiRuntimeSettings()).toEqual({
      assistant: {
        router: {
          temperature: 0,
          maxTokens: 350,
          responseFormat: JSON_RESPONSE_FORMAT,
        },
        stream: {
          temperature: 0.3,
          maxTokens: 2000,
        },
        executor: {
          temperature: 0.3,
          maxTokens: 2000,
        },
        estimate: {
          temperature: 0.3,
          maxTokens: 3000,
          responseFormat: JSON_RESPONSE_FORMAT,
        },
        followUp: {
          temperature: 0.2,
          maxTokens: 1200,
        },
        final: {
          temperature: 0.3,
          maxTokens: 2000,
        },
        vision: {
          temperature: 0.1,
          maxTokens: 900,
          responseFormat: JSON_RESPONSE_FORMAT,
        },
        transcription: {
          language: 'en',
          responseFormat: 'text',
        },
      },
      dashboard: {
        summary: {
          temperature: 0.2,
          responseFormat: JSON_RESPONSE_FORMAT,
        },
      },
      ocr: {
        receipt: {
          temperature: 0.1,
          maxTokens: 1000,
        },
      },
      leadScoring: {
        scoring: {
          temperature: 0.3,
          maxTokens: 1000,
        },
        insights: {
          temperature: 0.4,
          maxTokens: 800,
        },
        followUp: {
          temperature: 0.6,
          maxTokens: 600,
        },
        prioritize: {
          temperature: 0.3,
          maxTokens: 1000,
        },
      },
    });
  });

  test('supports env overrides for assistant, dashboard, and runtime settings', () => {
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MODEL_ASSISTANT_ROUTER = 'gpt-test-router';
    process.env.AI_MODEL_ASSISTANT_RESPONSE = 'gpt-test-response';
    process.env.AI_MODEL_ASSISTANT_ESTIMATE = 'gpt-test-estimate';
    process.env.AI_MODEL_ASSISTANT_VISION = 'gpt-test-vision';
    process.env.AI_MODEL_ASSISTANT_TRANSCRIPTION = 'whisper-test';
    process.env.AI_MODEL_DASHBOARD_SUMMARY = 'gpt-test-dashboard';
    process.env.AI_MODEL_OCR_RECEIPT = 'gpt-test-ocr';
    process.env.AI_MODEL_LEAD_SCORING = 'gpt-test-lead';
    process.env.AI_MODEL_LEAD_INSIGHTS = 'gpt-test-insights';
    process.env.AI_MODEL_LEAD_FOLLOW_UP = 'gpt-test-follow-up';
    process.env.AI_MODEL_LEAD_PRIORITIZE = 'gpt-test-prioritize';
    process.env.AI_TEMP_ASSISTANT_ROUTER = '0.15';
    process.env.AI_MAX_TOKENS_ASSISTANT_ROUTER = '777';
    process.env.AI_TEMP_DASHBOARD_SUMMARY = '0.55';
    process.env.AI_TEMP_OCR_RECEIPT = '0.25';
    process.env.AI_MAX_TOKENS_OCR_RECEIPT = '1234';
    process.env.AI_TEMP_LEAD_SCORING = '0.45';
    process.env.AI_MAX_TOKENS_LEAD_SCORING = '999';
    process.env.AI_TRANSCRIPTION_LANGUAGE = 'es';
    process.env.AI_TRANSCRIPTION_RESPONSE_FORMAT = 'json';
    jest.resetModules();

    const { JSON_RESPONSE_FORMAT, getAiModels, getAiProvider, getAiRuntimeSettings } = require('../aiConfig');

    expect(getAiProvider()).toBe('openai');
    expect(getAiModels()).toEqual({
      assistant: {
        router: 'gpt-test-router',
        response: 'gpt-test-response',
        estimate: 'gpt-test-estimate',
        vision: 'gpt-test-vision',
        transcription: 'whisper-test',
      },
      dashboard: {
        summary: 'gpt-test-dashboard',
      },
      ocr: {
        receipt: 'gpt-test-ocr',
      },
      leadScoring: {
        scoring: 'gpt-test-lead',
        insights: 'gpt-test-insights',
        followUp: 'gpt-test-follow-up',
        prioritize: 'gpt-test-prioritize',
      },
    });
    expect(getAiRuntimeSettings().assistant.router).toEqual({
      temperature: 0.15,
      maxTokens: 777,
      responseFormat: JSON_RESPONSE_FORMAT,
    });
    expect(getAiRuntimeSettings().dashboard.summary).toEqual({
      temperature: 0.55,
      responseFormat: JSON_RESPONSE_FORMAT,
    });
    expect(getAiRuntimeSettings().ocr.receipt).toEqual({
      temperature: 0.25,
      maxTokens: 1234,
    });
    expect(getAiRuntimeSettings().leadScoring.scoring).toEqual({
      temperature: 0.45,
      maxTokens: 999,
    });
    expect(getAiRuntimeSettings().assistant.transcription).toEqual({
      language: 'es',
      responseFormat: 'json',
    });
  });
});
