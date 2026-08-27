const OpenAI = require('openai');

const DEFAULT_PROVIDER = 'openai';

const MODEL_DEFAULTS = Object.freeze({
  assistant: Object.freeze({
    router: 'gpt-5.6-luna',
    response: 'gpt-5.6-terra',
    estimate: 'gpt-5.6-terra',
    vision: 'gpt-5.6-terra',
    transcription: 'whisper-1',
  }),
  dashboard: Object.freeze({
    summary: 'gpt-5.6-luna',
  }),
  ocr: Object.freeze({
    receipt: 'gpt-5.6-terra',
  }),
  leadScoring: Object.freeze({
    scoring: 'gpt-5.6-luna',
    insights: 'gpt-5.6-luna',
    followUp: 'gpt-5.6-luna',
    prioritize: 'gpt-5.6-luna',
  }),
});

const JSON_RESPONSE_FORMAT = Object.freeze({ type: 'json_object' });

const RUNTIME_DEFAULTS = Object.freeze({
  assistant: Object.freeze({
    router: Object.freeze({
      temperature: 0,
      maxTokens: 350,
      responseFormat: JSON_RESPONSE_FORMAT,
    }),
    stream: Object.freeze({
      temperature: 0.3,
      maxTokens: 2000,
    }),
    executor: Object.freeze({
      temperature: 0.3,
      maxTokens: 2000,
    }),
    estimate: Object.freeze({
      temperature: 0.3,
      maxTokens: 3000,
      responseFormat: JSON_RESPONSE_FORMAT,
    }),
    followUp: Object.freeze({
      temperature: 0.2,
      maxTokens: 1200,
    }),
    final: Object.freeze({
      temperature: 0.3,
      maxTokens: 2000,
    }),
    vision: Object.freeze({
      temperature: 0.1,
      maxTokens: 900,
      responseFormat: JSON_RESPONSE_FORMAT,
    }),
    transcription: Object.freeze({
      language: 'en',
      responseFormat: 'text',
    }),
  }),
  dashboard: Object.freeze({
    summary: Object.freeze({
      temperature: 0.2,
      responseFormat: JSON_RESPONSE_FORMAT,
    }),
  }),
  ocr: Object.freeze({
    receipt: Object.freeze({
      temperature: 0.1,
      maxTokens: 2048,
    }),
  }),
  leadScoring: Object.freeze({
    scoring: Object.freeze({
      temperature: 0.3,
      maxTokens: 1000,
    }),
    insights: Object.freeze({
      temperature: 0.4,
      maxTokens: 800,
    }),
    followUp: Object.freeze({
      temperature: 0.6,
      maxTokens: 600,
    }),
    prioritize: Object.freeze({
      temperature: 0.3,
      maxTokens: 1000,
    }),
  }),
});

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || '';
}

function hasValidOpenAiKey(apiKey = getOpenAiApiKey()) {
  return Boolean(
    apiKey &&
      !apiKey.includes('YOUR_OPE') &&
      !apiKey.includes('YOUR_OPENAI') &&
      !apiKey.includes('your_openai') &&
      !apiKey.includes('your_openai_api_key') &&
      apiKey.length > 20
  );
}

function createOpenAiClient(apiKey = getOpenAiApiKey()) {
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function getAiProvider() {
  return process.env.AI_PROVIDER || DEFAULT_PROVIDER;
}

function readNumberEnv(envName, fallback) {
  const raw = process.env[envName];
  if (raw == null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAiModels() {
  return {
    assistant: {
      router: process.env.AI_MODEL_ASSISTANT_ROUTER || MODEL_DEFAULTS.assistant.router,
      response: process.env.AI_MODEL_ASSISTANT_RESPONSE || MODEL_DEFAULTS.assistant.response,
      estimate: process.env.AI_MODEL_ASSISTANT_ESTIMATE || process.env.AI_MODEL_ASSISTANT_RESPONSE || MODEL_DEFAULTS.assistant.estimate,
      vision: process.env.AI_MODEL_ASSISTANT_VISION || process.env.AI_MODEL_ASSISTANT_RESPONSE || MODEL_DEFAULTS.assistant.vision,
      transcription:
        process.env.AI_MODEL_ASSISTANT_TRANSCRIPTION || MODEL_DEFAULTS.assistant.transcription,
    },
    dashboard: {
      summary: process.env.AI_MODEL_DASHBOARD_SUMMARY || MODEL_DEFAULTS.dashboard.summary,
    },
    ocr: {
      receipt: process.env.AI_MODEL_OCR_RECEIPT || MODEL_DEFAULTS.ocr.receipt,
    },
    leadScoring: {
      scoring: process.env.AI_MODEL_LEAD_SCORING || MODEL_DEFAULTS.leadScoring.scoring,
      insights: process.env.AI_MODEL_LEAD_INSIGHTS || process.env.AI_MODEL_LEAD_SCORING || MODEL_DEFAULTS.leadScoring.insights,
      followUp: process.env.AI_MODEL_LEAD_FOLLOW_UP || process.env.AI_MODEL_LEAD_SCORING || MODEL_DEFAULTS.leadScoring.followUp,
      prioritize: process.env.AI_MODEL_LEAD_PRIORITIZE || process.env.AI_MODEL_LEAD_SCORING || MODEL_DEFAULTS.leadScoring.prioritize,
    },
  };
}

function getAiRuntimeSettings() {
  return {
    assistant: {
      router: {
        temperature: readNumberEnv('AI_TEMP_ASSISTANT_ROUTER', RUNTIME_DEFAULTS.assistant.router.temperature),
        maxTokens: readNumberEnv('AI_MAX_TOKENS_ASSISTANT_ROUTER', RUNTIME_DEFAULTS.assistant.router.maxTokens),
        responseFormat: JSON_RESPONSE_FORMAT,
      },
      stream: {
        temperature: readNumberEnv('AI_TEMP_ASSISTANT_STREAM', RUNTIME_DEFAULTS.assistant.stream.temperature),
        maxTokens: readNumberEnv('AI_MAX_TOKENS_ASSISTANT_STREAM', RUNTIME_DEFAULTS.assistant.stream.maxTokens),
      },
      executor: {
        temperature: readNumberEnv('AI_TEMP_ASSISTANT_EXECUTOR', RUNTIME_DEFAULTS.assistant.executor.temperature),
        maxTokens: readNumberEnv('AI_MAX_TOKENS_ASSISTANT_EXECUTOR', RUNTIME_DEFAULTS.assistant.executor.maxTokens),
      },
      estimate: {
        temperature: readNumberEnv('AI_TEMP_ASSISTANT_ESTIMATE', RUNTIME_DEFAULTS.assistant.estimate.temperature),
        maxTokens: readNumberEnv('AI_MAX_TOKENS_ASSISTANT_ESTIMATE', RUNTIME_DEFAULTS.assistant.estimate.maxTokens),
        responseFormat: JSON_RESPONSE_FORMAT,
      },
      followUp: {
        temperature: readNumberEnv('AI_TEMP_ASSISTANT_FOLLOW_UP', RUNTIME_DEFAULTS.assistant.followUp.temperature),
        maxTokens: readNumberEnv('AI_MAX_TOKENS_ASSISTANT_FOLLOW_UP', RUNTIME_DEFAULTS.assistant.followUp.maxTokens),
      },
      final: {
        temperature: readNumberEnv('AI_TEMP_ASSISTANT_FINAL', RUNTIME_DEFAULTS.assistant.final.temperature),
        maxTokens: readNumberEnv('AI_MAX_TOKENS_ASSISTANT_FINAL', RUNTIME_DEFAULTS.assistant.final.maxTokens),
      },
      vision: {
        temperature: readNumberEnv('AI_TEMP_ASSISTANT_VISION', RUNTIME_DEFAULTS.assistant.vision.temperature),
        maxTokens: readNumberEnv('AI_MAX_TOKENS_ASSISTANT_VISION', RUNTIME_DEFAULTS.assistant.vision.maxTokens),
        responseFormat: JSON_RESPONSE_FORMAT,
      },
      transcription: {
        language: process.env.AI_TRANSCRIPTION_LANGUAGE || RUNTIME_DEFAULTS.assistant.transcription.language,
        responseFormat:
          process.env.AI_TRANSCRIPTION_RESPONSE_FORMAT || RUNTIME_DEFAULTS.assistant.transcription.responseFormat,
      },
    },
    dashboard: {
      summary: {
        temperature: readNumberEnv('AI_TEMP_DASHBOARD_SUMMARY', RUNTIME_DEFAULTS.dashboard.summary.temperature),
        responseFormat: JSON_RESPONSE_FORMAT,
      },
    },
    ocr: {
      receipt: {
        temperature: readNumberEnv('AI_TEMP_OCR_RECEIPT', RUNTIME_DEFAULTS.ocr.receipt.temperature),
        maxTokens: readNumberEnv('AI_MAX_TOKENS_OCR_RECEIPT', RUNTIME_DEFAULTS.ocr.receipt.maxTokens),
      },
    },
    leadScoring: {
      scoring: {
        temperature: readNumberEnv('AI_TEMP_LEAD_SCORING', RUNTIME_DEFAULTS.leadScoring.scoring.temperature),
        maxTokens: readNumberEnv('AI_MAX_TOKENS_LEAD_SCORING', RUNTIME_DEFAULTS.leadScoring.scoring.maxTokens),
      },
      insights: {
        temperature: readNumberEnv('AI_TEMP_LEAD_INSIGHTS', RUNTIME_DEFAULTS.leadScoring.insights.temperature),
        maxTokens: readNumberEnv('AI_MAX_TOKENS_LEAD_INSIGHTS', RUNTIME_DEFAULTS.leadScoring.insights.maxTokens),
      },
      followUp: {
        temperature: readNumberEnv('AI_TEMP_LEAD_FOLLOW_UP', RUNTIME_DEFAULTS.leadScoring.followUp.temperature),
        maxTokens: readNumberEnv('AI_MAX_TOKENS_LEAD_FOLLOW_UP', RUNTIME_DEFAULTS.leadScoring.followUp.maxTokens),
      },
      prioritize: {
        temperature: readNumberEnv('AI_TEMP_LEAD_PRIORITIZE', RUNTIME_DEFAULTS.leadScoring.prioritize.temperature),
        maxTokens: readNumberEnv('AI_MAX_TOKENS_LEAD_PRIORITIZE', RUNTIME_DEFAULTS.leadScoring.prioritize.maxTokens),
      },
    },
  };
}

module.exports = {
  MODEL_DEFAULTS,
  RUNTIME_DEFAULTS,
  JSON_RESPONSE_FORMAT,
  DEFAULT_PROVIDER,
  getAiProvider,
  getAiModels,
  getAiRuntimeSettings,
  getOpenAiApiKey,
  hasValidOpenAiKey,
  createOpenAiClient,
};
