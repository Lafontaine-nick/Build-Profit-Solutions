/**
 * Google Places API (New) — contractor discovery for Find Subcontractors.
 * Uses official HTTP APIs only (no scraping). Requires GOOGLE_PLACES_API_KEY.
 *
 * GET /api/places/contractors/search?trade=Plumbing&zip=89141&limit=15
 * GET /api/places/contractors/details?placeId=places%2FChIJ...
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const cache = new Map();

function cacheKey(trade, zip) {
  return `${String(trade || '').trim().toLowerCase()}|${String(zip || '').trim()}`;
}

function getCached(trade, zip) {
  const k = cacheKey(trade, zip);
  const row = cache.get(k);
  if (!row) return null;
  if (Date.now() - row.at > CACHE_TTL_MS) {
    cache.delete(k);
    return null;
  }
  return row.payload;
}

function setCached(trade, zip, payload) {
  cache.set(cacheKey(trade, zip), { at: Date.now(), payload });
}

function buildTextQuery(trade, zip) {
  const z = String(zip || '').replace(/\D/g, '').slice(0, 5);
  const t = (trade || 'All Trades').trim();
  const map = {
    'All Trades': `general contractor near ${z}`,
    Plumbing: `plumbing contractor near ${z}`,
    Electrical: `electrical contractor near ${z}`,
    HVAC: `HVAC contractor near ${z}`,
    Framing: `framing contractor near ${z}`,
    Drywall: `drywall contractor near ${z}`,
    Painting: `painting contractor near ${z}`,
    Roofing: `roofing contractor near ${z}`,
    Flooring: `flooring contractor near ${z}`,
    Concrete: `concrete contractor near ${z}`,
    Landscaping: `landscaping contractor near ${z}`,
  };
  return map[t] || `${t.toLowerCase()} contractor near ${z}`;
}

function mapPlaceToResult(place) {
  const id = place.name || place.id;
  const name = place.displayName?.text || place.displayName || 'Unknown';
  const primaryType =
    place.primaryTypeDisplayName?.text ||
    (Array.isArray(place.types) && place.types[0]) ||
    'establishment';
  return {
    placeId: id,
    name,
    rating: typeof place.rating === 'number' ? place.rating : null,
    reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : 0,
    formattedAddress: place.formattedAddress || '',
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    website: place.websiteUri || null,
    googleMapsUri: place.googleMapsUri || null,
    businessStatus: place.businessStatus || null,
    primaryTypeDisplayName: primaryType,
    types: Array.isArray(place.types) ? place.types.slice(0, 8) : [],
    fetchedAt: new Date().toISOString(),
    source: 'google_places',
  };
}

/**
 * GET /api/places/contractors/search
 */
router.get('/contractors/search', async (req, res) => {
  const trade = (req.query.trade || 'All Trades').toString();
  const zip = (req.query.zip || '').toString().replace(/\D/g, '').slice(0, 5);
  let limit = parseInt(req.query.limit, 10) || 15;
  limit = Math.min(Math.max(limit, 5), 20);

  if (zip.length < 5) {
    return res.status(400).json({ error: 'A valid 5-digit ZIP is required.' });
  }

  const apiKey = (process.env.GOOGLE_PLACES_API_KEY || '').trim();
  if (!apiKey || apiKey === 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
    return res.json({
      results: [],
      metadata: {
        disabled: true,
        message:
          'Google Places search is not configured. Set GOOGLE_PLACES_API_KEY on the Render web service (Environment tab), then redeploy.',
        dataSource: 'none',
      },
    });
  }

  const cached = getCached(trade, zip);
  if (cached) {
    return res.json({
      ...cached,
      metadata: { ...(cached.metadata || {}), cached: true },
    });
  }

  const textQuery = buildTextQuery(trade, zip);

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.rating',
    'places.userRatingCount',
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.googleMapsUri',
    'places.businessStatus',
    'places.types',
    'places.primaryTypeDisplayName',
    'places.location',
  ].join(',');

  try {
    const { data } = await axios.post(
      PLACES_TEXT_SEARCH_URL,
      {
        textQuery,
        maxResultCount: limit,
        languageCode: 'en',
        regionCode: 'us',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        timeout: 12000,
      }
    );

    const places = Array.isArray(data.places) ? data.places : [];
    const results = places.map(mapPlaceToResult);

    const payload = {
      results,
      metadata: {
        dataSource: 'google_places',
        textQuery,
        count: results.length,
      },
    };
    setCached(trade, zip, payload);
    res.json({ ...payload, metadata: { ...payload.metadata, cached: false } });
  } catch (err) {
    const status = err.response?.status;
    const msg =
      err.response?.data?.error?.message ||
      err.response?.data?.error_message ||
      err.message ||
      'Google Places search failed';
    console.error('Google Places search error:', status, msg);
    res.status(status && status < 500 ? status : 502).json({
      error: msg,
      results: [],
      metadata: { dataSource: 'error', status },
    });
  }
});

/**
 * GET /api/places/contractors/details?placeId=places%2FChIJ...
 * Field masks keep cost down — only call when opening profile / request flow.
 */
router.get('/contractors/details', async (req, res) => {
  let resource = (req.query.placeId || '').toString().trim();
  if (!resource) {
    return res.status(400).json({ error: 'placeId is required' });
  }
  if (!resource.startsWith('places/')) {
    resource = `places/${resource}`;
  }

  const apiKey = (process.env.GOOGLE_PLACES_API_KEY || '').trim();
  if (!apiKey || apiKey === 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
    return res.status(503).json({ error: 'Google Places API key not configured.' });
  }

  const fieldMask = [
    'id',
    'displayName',
    'formattedAddress',
    'nationalPhoneNumber',
    'internationalPhoneNumber',
    'websiteUri',
    'googleMapsUri',
    'rating',
    'userRatingCount',
    'businessStatus',
    'types',
    'primaryTypeDisplayName',
    'currentOpeningHours',
    'adrFormatAddress',
    'location',
    'editorialSummary',
  ].join(',');

  const url = `https://places.googleapis.com/v1/${resource}`;

  try {
    const { data } = await axios.get(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      timeout: 12000,
    });

    res.json({
      details: mapPlaceToResult(data),
      editorialSummary: data.editorialSummary?.text || null,
      currentOpeningHours: data.currentOpeningHours || null,
      location: data.location || null,
    });
  } catch (err) {
    const status = err.response?.status;
    const msg =
      err.response?.data?.error?.message ||
      err.response?.data?.error_message ||
      err.message ||
      'Place details failed';
    console.error('Google Place details error:', status, msg);
    res.status(status && status < 500 ? status : 502).json({ error: msg });
  }
});

module.exports = router;
