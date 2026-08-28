const {
  createOpenAiClient,
  getAiModels,
  getAiProvider,
  getAiRuntimeSettings,
  hasValidOpenAiKey,
  JSON_RESPONSE_FORMAT,
} = require('../src/config/aiConfig');
const { createOpenAiChatCompletion } = require('../src/utils/openaiChatCompletionParams');

function boundedMaxTokens(value, fallback = 80) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, fallback);
}

async function runJsonSmoke({ client, model, runtime, label }) {
  const completion = await createOpenAiChatCompletion(client, {
    model,
    response_format: JSON_RESPONSE_FORMAT,
    temperature: 0,
    max_tokens: boundedMaxTokens(runtime?.maxTokens),
    messages: [
      {
        role: 'system',
        content: 'Return only a compact JSON object.',
      },
      {
        role: 'user',
        content: `Return {"ok":true,"surface":"${label}"}.`,
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  if (parsed.ok !== true) {
    throw new Error(`${label} smoke response was not ok=true`);
  }
  return parsed;
}

async function main() {
  if (process.env.LIVE_AI_SMOKE !== 'true') {
    console.log('Skipping live AI smoke check. Set LIVE_AI_SMOKE=true to run it intentionally.');
    return;
  }

  if (getAiProvider() !== 'openai') {
    throw new Error(`Unsupported AI_PROVIDER for live smoke: ${getAiProvider()}`);
  }

  if (!hasValidOpenAiKey()) {
    throw new Error('OPENAI_API_KEY is missing or invalid for live smoke.');
  }

  const client = createOpenAiClient();
  if (!client) {
    throw new Error('Failed to create OpenAI client for live smoke.');
  }

  const models = getAiModels();
  const runtime = getAiRuntimeSettings();

  console.log('Running live AI smoke checks...');

  const checks = [
    {
      label: 'assistant.router',
      model: models.assistant.router,
      runtime: runtime.assistant.router,
    },
    {
      label: 'dashboard.summary',
      model: models.dashboard.summary,
      runtime: runtime.dashboard.summary,
    },
    {
      label: 'leadScoring.scoring',
      model: models.leadScoring.scoring,
      runtime: runtime.leadScoring.scoring,
    },
  ];

  for (const check of checks) {
    const result = await runJsonSmoke({
      client,
      model: check.model,
      runtime: check.runtime,
      label: check.label,
    });
    console.log(`PASS ${check.label} (${check.model})`, result);
  }

  console.log('Live AI smoke verification passed.');
}

main().catch((error) => {
  console.error('Live AI smoke verification failed:', error.message || error);
  process.exitCode = 1;
});
