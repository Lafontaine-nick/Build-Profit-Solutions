const express = require('express');
const router = express.Router();
const { enrichDraft } = require('../services/estimateDraftEnrichment');
const { getPricingProposal, toLegacyProposal } = require('../services/pricingEngine');
const { authenticateToken } = require('../middleware/authenticateToken');

router.use(authenticateToken);

router.post('/proposal', async (req, res) => {
  try {
    const draft = req.body.draft ? enrichDraft(req.body.draft) : null;
    if (!draft) return res.status(400).json({ error: 'Draft is required' });

    const mode = req.body.mode === 'saved_only' ? 'saved_only' : 'suggest';
    const engineResult = await getPricingProposal({
      draft,
      userId: req.user.userId,
      companyId: req.body.companyId,
      projectLocation: req.body.projectLocation,
      zipCode: req.body.zipCode,
      savedTemplates: req.body.savedTemplates || [],
      companyDefaultRates: req.body.companyDefaultRates,
      mode,
    });

    const proposal = toLegacyProposal(engineResult, { forSaved: mode === 'saved_only' });

    return res.json({
      success: true,
      proposal,
      engine: engineResult,
    });
  } catch (err) {
    console.error('pricing-engine/proposal:', err);
    res.status(500).json({ error: 'Pricing proposal failed', message: err.message });
  }
});

module.exports = router;
