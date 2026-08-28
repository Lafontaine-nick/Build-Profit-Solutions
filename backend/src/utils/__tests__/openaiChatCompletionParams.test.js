const {
  modelUsesMaxCompletionTokens,
  normalizeOpenAiChatCompletionParams,
} = require('../openaiChatCompletionParams');

describe('openaiChatCompletionParams', () => {
  it('detects GPT-5 and o-series models', () => {
    expect(modelUsesMaxCompletionTokens('gpt-5.6-terra')).toBe(true);
    expect(modelUsesMaxCompletionTokens('gpt-5.6-luna')).toBe(true);
    expect(modelUsesMaxCompletionTokens('o1-preview')).toBe(true);
    expect(modelUsesMaxCompletionTokens('o3-mini')).toBe(true);
    expect(modelUsesMaxCompletionTokens('gpt-4o')).toBe(false);
  });

  it('maps max_tokens to max_completion_tokens for GPT-5 models', () => {
    expect(
      normalizeOpenAiChatCompletionParams({
        model: 'gpt-5.6-terra',
        max_tokens: 3000,
        temperature: 0.2,
      })
    ).toEqual({
      model: 'gpt-5.6-terra',
      max_completion_tokens: 3000,
    });
  });

  it('keeps max_tokens for legacy models', () => {
    expect(
      normalizeOpenAiChatCompletionParams({
        model: 'gpt-4o',
        max_tokens: 1200,
      })
    ).toEqual({
      model: 'gpt-4o',
      max_tokens: 1200,
    });
  });

  it('preserves explicit max_completion_tokens for GPT-5 models', () => {
    expect(
      normalizeOpenAiChatCompletionParams({
        model: 'gpt-5.6-luna',
        max_completion_tokens: 900,
        temperature: 0,
      })
    ).toEqual({
      model: 'gpt-5.6-luna',
      max_completion_tokens: 900,
    });
  });

  it('preserves temperature for legacy models', () => {
    expect(
      normalizeOpenAiChatCompletionParams({
        model: 'gpt-4o',
        max_tokens: 1200,
        temperature: 0.2,
      })
    ).toEqual({
      model: 'gpt-4o',
      max_tokens: 1200,
      temperature: 0.2,
    });
  });
});
