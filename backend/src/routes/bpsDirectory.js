const express = require('express');
const bpsDirectory = require('../services/bpsContractorDirectory');

const router = express.Router();

/**
 * POST /api/contractors/directory/register
 * Opt in/out and set service ZIP + trades for Find Subcontractors.
 */
router.post('/directory/register', (req, res) => {
  try {
    const {
      id,
      companyName,
      contactName,
      email,
      phone,
      website,
      trades,
      zip: zipRaw,
      listOnFindSubcontractors,
    } = req.body || {};

    const cleanId = String(id || '').trim();
    if (!cleanId) {
      return res.status(400).json({ success: false, error: 'id is required (e.g. Clerk user id).' });
    }

    const listOn = Boolean(listOnFindSubcontractors);
    const zip = String(zipRaw || '')
      .replace(/\D/g, '')
      .slice(0, 5);

    if (listOn && zip.length !== 5) {
      return res.status(400).json({
        success: false,
        error: 'A valid 5-digit US service ZIP is required when listing on Find Subcontractors.',
      });
    }

    const tradeArr = Array.isArray(trades)
      ? trades.map((t) => String(t || '').trim()).filter(Boolean)
      : [];

    const row = bpsDirectory.upsert({
      id: cleanId,
      companyName: companyName != null ? String(companyName).trim() : '',
      contactName: contactName != null ? String(contactName).trim() : '',
      email: email != null ? String(email).trim() : '',
      phone: phone != null ? String(phone).trim() : '',
      website: website != null ? String(website).trim() : '',
      trades: tradeArr,
      zip: listOn ? zip : '',
      listOnFindSubcontractors: listOn,
    });

    return res.json({ success: true, listing: row });
  } catch (e) {
    console.error('POST /contractors/directory/register', e.message);
    return res.status(500).json({ success: false, error: e.message || 'Failed to save listing.' });
  }
});

module.exports = router;
