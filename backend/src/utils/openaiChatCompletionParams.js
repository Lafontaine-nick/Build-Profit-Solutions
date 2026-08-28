/**
 * Normalize chat completion params for OpenAI model API differences.
 * GPT-5 / o-series models require max_completion_tokens (not max_tokens) and
 * reject custom temperature (default 1 only).
 */

function isNewOpenAiChatModel(model) {
  const id = String(model || '').trim().toLowerCase();
  if (!id) return false;
  if (/^gpt-5(?:[.-]|$)/.test(id)) return true;
  if (/^o[134]/.test(id)) return true;
  return false;
}

/** @deprecated use isNewOpenAiChatModel */
function modelUsesMaxCompletionTokens(model) {
  return isNewOpenAiChatModel(model);
}

function normalizeOpenAiChatCompletionParams(params = {}) {
  if (!params || typeof params !== 'object') return params;

  const next = { ...params };
  const tokenLimit =
    next.max_completion_tokens != null ? next.max_completion_tokens : next.max_tokens;

  delete next.max_tokens;
  delete next.max_completion_tokens;

  if (isNewOpenAiChatModel(next.model)) {
    delete next.temperature;
    delete next.top_p;
    if (tokenLimit != null) {
      next.max_completion_tokens = tokenLimit;
    }
  } else if (tokenLimit != null) {
    next.max_tokens = tokenLimit;
  }

  return next;
}

async function createOpenAiChatCompletion(openai, params) {
  return openai.chat.completions.create(normalizeOpenAiChatCompletionParams(params));
}

module.exports = {
  isNewOpenAiChatModel,
  modelUsesMaxCompletionTokens,
  normalizeOpenAiChatCompletionParams,
  createOpenAiChatCompletion,
};
