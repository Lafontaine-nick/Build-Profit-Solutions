const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  listEntries,
  clearMemory,
  capturePricingMemory,
  attachPricingMemoryToDraft,
  buildSuggestionsForDraft,
  buildMissingPriceSuggestions,
  DEFAULT_SETTINGS,
} = require('../services/contractorPricingMemory');
const { getPricingProposal, toLegacyProposal } = require('../services/pricingEngine');
const { updateEntry, deleteEntry, getLibraryGrouped } = require('../services/contractorPricingMemory/storage');
const { enrichDraft } = require('../services/estimateDraftEnrichment');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = { userId: 'dev-user-1' };
    return next();
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.warn('contractorPricingMemory: invalid token, dev user', error.message);
    req.user = { userId: 'dev-user-1' };
    next();
  }
};

router.use(authenticateToken);

router.get('/settings', (req, res) => {
  const userId = req.user.userId;
  res.json({ success: true, settings: getSettings(userId) });
});

router.patch('/settings', (req, res) => {
  const userId = req.user.userId;
  const allowed = [
    'pricingMemoryEnabled',
    'excludeTestBids',
    'learnOnApply',
    'learnOnSubmit',
    'learnOnWon',
    'learnOnCompleted',
    'learnOnSavedTemplate',
    'learnOnApprovedAiSuggested',
  ];
  const patch = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = Boolean(req.body[key]);
  }
  const settings = updateSettings(userId, patch);
  res.json({ success: true, settings });
});

router.get('/rates', (req, res) => {
  const userId = req.user.userId;
  const trade = req.query.trade || null;
  const projectType = req.query.projectType || null;
  const entries = listEntries(userId, { trade, projectType });
  res.json({
    success: true,
    count: entries.length,
    rates: entries.map((e) => ({
      id: e.id,
      scopeItemName: e.scopeItemName,
      trade: e.trade,
      projectType: e.projectType,
      category: e.category,
      unitType: e.unitType,
      unitRate: e.unitRate,
      quantity: e.quantity,
      totalAmount: e.totalAmount,
      pricingSource: e.pricingSource,
      bidStatus: e.bidStatus,
      useCount: e.useCount,
      lastUsedAt: e.lastUsedAt,
      region: e.region,
    })),
  });
});

router.delete('/clear', (req, res) => {
  const userId = req.user.userId;
  clearMemory(userId);
  res.json({ success: true, message: 'Pricing memory cleared for this account.' });
});

/**
 * POST /capture — call after apply, submit, won, completed, or saved template.
 * Body: { draft?, bid?, meta: { bidStatus, isTestBid?, projectId?, markupPct?, marginPct?, region? } }
 */
router.post('/capture', (req, res) => {
  try {
    const userId = req.user.userId;
    const result = capturePricingMemory(userId, {
      draft: req.body.draft,
      bid: req.body.bid,
      meta: req.body.meta || {},
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('pricing memory capture:', err);
    res.status(500).json({ error: 'Capture failed', message: err.message });
  }
});

/**
 * POST /suggest-for-draft — pricing history suggestions (does not modify draft prices).
 */
router.post('/suggest-for-draft', (req, res) => {
  try {
    const userId = req.user.userId;
    const draft = req.body.draft ? enrichDraft(req.body.draft) : null;
    if (!draft) {
      return res.status(400).json({ error: 'Draft is required' });
    }
    const attached = attachPricingMemoryToDraft(draft, userId);
    res.json({
      success: true,
      draft: attached,
      memory: buildSuggestionsForDraft(attached, userId),
    });
  } catch (err) {
    console.error('pricing memory suggest:', err);
    res.status(500).json({ error: 'Suggest failed', message: err.message });
  }
});

router.get('/library', (req, res) => {
  const userId = req.user.userId;
  const sections = getLibraryGrouped(userId);
  res.json({ success: true, sections, total: sections.reduce((n, s) => n + s.items.length, 0) });
});

router.patch('/rates/:id', (req, res) => {
  const userId = req.user.userId;
  const { unitRate, scopeItemName, category, unitType } = req.body || {};
  const updated = updateEntry(userId, req.params.id, {
    unitRate: unitRate != null ? Number(unitRate) : undefined,
    scopeItemName,
    category,
    unitType,
  });
  if (!updated) return res.status(404).json({ error: 'Rate not found' });
  res.json({ success: true, rate: updated });
});

router.delete('/rates/:id', (req, res) => {
  const userId = req.user.userId;
  const result = deleteEntry(userId, req.params.id);
  if (!result.deleted) return res.status(404).json({ error: 'Rate not found' });
  res.json({ success: true });
});

router.post('/saved-pricing-proposal', (req, res) => {
  try {
    const userId = req.user.userId;
    const draft = req.body.draft ? enrichDraft(req.body.draft) : null;
    if (!draft) return res.status(400).json({ error: 'Draft is required' });
    const engineResult = getPricingProposal({
      draft,
      userId,
      savedTemplates: req.body.savedTemplates || [],
      projectLocation: req.body.projectLocation,
      zipCode: req.body.zipCode,
      mode: 'saved_only',
    });
    const proposal = toLegacyProposal(engineResult, { forSaved: true });
    return res.json({ success: true, proposal, engine: engineResult });
  } catch (err) {
    console.error('saved-pricing-proposal:', err);
    res.status(500).json({ error: 'Proposal failed', message: err.message });
  }
});

router.post('/rough-pricing-proposal', (req, res) => {
  try {
    const userId = req.user.userId;
    const draft = req.body.draft ? enrichDraft(req.body.draft) : null;
    if (!draft) return res.status(400).json({ error: 'Draft is required' });
    const engineResult = getPricingProposal({
      draft,
      userId,
      savedTemplates: req.body.savedTemplates || [],
      projectLocation: req.body.projectLocation,
      zipCode: req.body.zipCode,
      mode: 'suggest',
    });
    const proposal = toLegacyProposal(engineResult, { forSaved: false });
    return res.json({ success: true, proposal, engine: engineResult });
  } catch (err) {
    console.error('rough-pricing-proposal:', err);
    res.status(500).json({ error: 'Proposal failed', message: err.message });
  }
});

router.post('/suggest-missing', (req, res) => {
  try {
    const userId = req.user.userId;
    const draft = req.body.draft ? enrichDraft(req.body.draft) : null;
    if (!draft) return res.status(400).json({ error: 'Draft is required' });
    const result = buildMissingPriceSuggestions(draft, userId, {
      savedTemplates: req.body.savedTemplates || [],
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('pricing memory suggest-missing:', err);
    res.status(500).json({ error: 'Suggest missing failed', message: err.message });
  }
});

router.get('/defaults', (_req, res) => {
  res.json({ success: true, settings: DEFAULT_SETTINGS });
});

module.exports = router;
