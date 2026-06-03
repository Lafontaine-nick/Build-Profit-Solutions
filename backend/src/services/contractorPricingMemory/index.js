const { extractCaptureEntries } = require('./capture');
const {
  getSettings,
  updateSettings,
  listEntries,
  clearMemory,
  upsertEntries,
  tryPersistToPostgres,
  DEFAULT_SETTINGS,
} = require('./storage');
const { buildSuggestionsForDraft, buildActualCostInsights } = require('./suggest');
const { buildMissingPriceSuggestions } = require('./suggestMissing');
const { buildSavedPricingProposal, buildRoughPricingProposal } = require('./proposal');

function shouldLearnForEvent(settings, bidStatus) {
  if (!settings.pricingMemoryEnabled) return false;
  const status = String(bidStatus || '').toLowerCase();
  if (status === 'applied') return settings.learnOnApply !== false;
  if (status === 'submitted') return settings.learnOnSubmit !== false;
  if (status === 'won') return settings.learnOnWon !== false;
  if (status === 'completed') return settings.learnOnCompleted !== false;
  if (status === 'saved_template') return settings.learnOnSavedTemplate !== false;
  return false;
}

function capturePricingMemory(userId, payload) {
  const settings = getSettings(userId);
  const meta = {
    ...(payload.meta || {}),
    excludeTestBids: settings.excludeTestBids,
  };

  if (meta.saveToLibrary === false) {
    return { captured: 0, skipped: 'save_disabled_for_bid' };
  }

  if (settings.excludeTestBids && meta.isTestBid) {
    return { captured: 0, skipped: 'test_bid' };
  }

  if (!shouldLearnForEvent(settings, meta.bidStatus)) {
    return { captured: 0, skipped: 'learning_disabled_for_event' };
  }

  const entries = extractCaptureEntries({
    draft: payload.draft,
    bid: payload.bid,
    meta,
  });

  if (entries.length === 0) {
    return { captured: 0, skipped: 'no_eligible_entries' };
  }

  const result = upsertEntries(userId, entries);
  void tryPersistToPostgres(userId, entries);

  return {
    captured: result.added + result.updated,
    added: result.added,
    updated: result.updated,
    total: result.total,
  };
}

function attachPricingMemoryToDraft(draft, userId, options = {}) {
  if (!userId) return draft;
  const settings = getSettings(userId);
  const memory = buildSuggestionsForDraft(draft, userId);
  const insights = buildActualCostInsights(userId, draft.projectType);
  const missing =
    settings.pricingMemoryEnabled || options.savedTemplates?.length
      ? buildMissingPriceSuggestions(draft, userId, {
          savedTemplates: options.savedTemplates || [],
        })
      : { suggestions: [], message: null };

  return {
    ...draft,
    pricingMemoryEnabled: settings.pricingMemoryEnabled,
    pricingMemorySettings: settings,
    pricingMemorySuggestions: memory.suggestions,
    pricingMemorySummary: memory.summary,
    pricingMemoryMessage: memory.message,
    pricingMemoryMissingSuggestions: missing.suggestions,
    pricingMemoryMissingMessage: missing.message,
    pricingMemoryActualInsights: insights,
    pricingMemoryNote: null,
  };
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettings,
  updateSettings,
  listEntries,
  clearMemory,
  capturePricingMemory,
  attachPricingMemoryToDraft,
  buildSuggestionsForDraft,
  buildMissingPriceSuggestions,
  buildSavedPricingProposal,
  buildRoughPricingProposal,
  extractCaptureEntries,
};
