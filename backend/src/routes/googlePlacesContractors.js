/**
 * Google Places API (New) — contractor discovery for Find Subcontractors.
 * Uses official HTTP APIs only (no scraping). Set GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY (same key).
 *
 * GET /api/places/contractors/search?trade=Plumbing&zip=89141&q=framing&limit=15&radiusMiles=25&anchorLat=36.08&anchorLng=-115.14
 * GET /api/places/contractors/details?placeId=places%2FChIJ...
 */

const express = require('express');
const axios = require('axios');
const bpsDirectory = require('../services/bpsContractorDirectory');
const router = express.Router();

/** Same Maps Platform key works for Places (New) if enabled in Google Cloud. */
function resolveGooglePlacesApiKey() {
  const v =
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';
  return String(v).trim();
}

const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const cache = new Map();
/** Extra Places candidates when filtering by mile radius so we can still return up to `limit` results. */
const PLACES_FETCH_BUFFER = 20;

/** If browser GPS is farther than this from the ZIP centroid, ignore the anchor (Safari/desktop often misplaces). */
const MAX_ANCHOR_ZIP_DRIFT_MILES = 75;

function sanitizePlacesTextQueryInput(q) {
  return String(q || '')
    .trim()
    .slice(0, 64)
    .replace(/[^a-zA-Z0-9 \-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cacheKey(trade, zip, qNorm, radiusMilesRounded, anchorKey) {
  const qPart = qNorm ? `|${qNorm.toLowerCase()}` : '';
  const rPart =
    radiusMilesRounded != null && radiusMilesRounded > 0 ? `|r=${radiusMilesRounded}` : '';
  const aPart = anchorKey ? `|@${anchorKey}` : '';
  return `v9|${String(trade || '').trim().toLowerCase()}|${String(zip || '').trim()}${qPart}${rPart}${aPart}`;
}

function getCached(trade, zip, qNorm, radiusMilesRounded, anchorKey) {
  const k = cacheKey(trade, zip, qNorm, radiusMilesRounded, anchorKey);
  const row = cache.get(k);
  if (!row) return null;
  if (Date.now() - row.at > CACHE_TTL_MS) {
    cache.delete(k);
    return null;
  }
  return row.payload;
}

function setCached(trade, zip, qNorm, radiusMilesRounded, anchorKey, payload) {
  cache.set(cacheKey(trade, zip, qNorm, radiusMilesRounded, anchorKey), { at: Date.now(), payload });
}

/** Great-circle distance in miles (WGS84 approximation). */
function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function geocodeUsZipToLatLng(zip5, apiKey) {
  try {
    const { data } = await axios.get(GEOCODE_URL, {
      params: {
        components: `country:US|postal_code:${zip5}`,
        key: apiKey,
      },
      timeout: 8000,
    });
    if (data.status !== 'OK' || !Array.isArray(data.results) || !data.results.length) {
      return null;
    }
    const loc = data.results[0].geometry?.location;
    if (!loc) return null;
    const lat = typeof loc.lat === 'number' ? loc.lat : parseFloat(loc.lat);
    const lng = typeof loc.lng === 'number' ? loc.lng : parseFloat(loc.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch (e) {
    console.warn('Geocode ZIP failed:', zip5, e.message);
    return null;
  }
}

/**
 * Fallback when Google Geocoding API is disabled or fails (same Maps key does not enable Geocoding).
 * OSM Nominatim — respect usage policy: identify app and cache lightly server-side via route cache.
 */
async function geocodeUsZipNominatim(zip5) {
  const z = String(zip5 || '')
    .replace(/\D/g, '')
    .slice(0, 5);
  if (z.length < 5) return null;
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        postalcode: z,
        country: 'us',
        format: 'json',
        limit: 1,
      },
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BuildProfitSolutions/1.0 (contractor search; contact support@buildprofitsolutions.com)',
      },
      timeout: 12000,
    });
    if (!Array.isArray(data) || !data.length) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch (e) {
    console.warn('Nominatim ZIP geocode failed:', z, e.message);
    return null;
  }
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

/** Text search without "near {zip}" — used with device anchor + locationBias so a wrong reverse-ZIP does not bias Google. */
function buildTextQueryTradeOnly(trade) {
  const t = (trade || 'All Trades').trim();
  const map = {
    'All Trades': 'general contractor',
    Plumbing: 'plumbing contractor',
    Electrical: 'electrical contractor',
    HVAC: 'HVAC contractor',
    Framing: 'framing contractor',
    Drywall: 'drywall contractor',
    Painting: 'painting contractor',
    Roofing: 'roofing contractor',
    Flooring: 'flooring contractor',
    Concrete: 'concrete contractor',
    Landscaping: 'landscaping contractor',
  };
  return map[t] || `${t.toLowerCase()} contractor`;
}

function tradeMatchesDirectory(selectedTrade, entryTrades) {
  const t = (selectedTrade || 'All Trades').trim();
  const arr = Array.isArray(entryTrades) ? entryTrades : [];
  if (!arr.length) return t === 'All Trades';
  if (!t || t === 'All Trades') return true;
  const tl = t.toLowerCase();
  return arr.some((x) => {
    const s = String(x || '').toLowerCase();
    return s.includes(tl) || tl.includes(s);
  });
}

async function mapDirectoryEntryToPlaceResult(entry, zipCenter, radiusMiles, apiKey) {
  const zip = String(entry.zip || '')
    .replace(/\D/g, '')
    .slice(0, 5);
  if (zip.length !== 5) return null;
  let lat = typeof entry.latitude === 'number' ? entry.latitude : null;
  let lng = typeof entry.longitude === 'number' ? entry.longitude : null;
  if (lat == null || lng == null) {
    const g = await geocodeUsZipToLatLng(zip, apiKey);
    if (!g) return null;
    lat = g.lat;
    lng = g.lng;
  }
  const d = haversineMiles(zipCenter.lat, zipCenter.lng, lat, lng);
  if (d > radiusMiles) return null;
  const name = entry.companyName || entry.contactName || 'BPS contractor';
  const primary =
    (Array.isArray(entry.trades) && entry.trades.length && entry.trades[0]) || 'Contractor';
  const typesFromTrades = Array.isArray(entry.trades)
    ? entry.trades.map((x) =>
        String(x || '')
          .toLowerCase()
          .replace(/\s+/g, '_')
      )
    : [];
  return {
    placeId: `bps:${entry.id}`,
    /** Same as suffix of `placeId` — lets clients hide “your own” directory card in Find Subcontractors. */
    directoryId: entry.id,
    directoryEmail: entry.email || null,
    name,
    rating: null,
    reviewCount: 0,
    formattedAddress: `${zip} — Build Profit Solutions member`,
    phone: entry.phone || null,
    website: entry.website || null,
    googleMapsUri: null,
    businessStatus: 'OPERATIONAL',
    primaryTypeDisplayName: primary,
    types: ['establishment', ...typesFromTrades],
    fetchedAt: new Date().toISOString(),
    source: 'bps',
    bpsVerified: true,
    latitude: lat,
    longitude: lng,
    distanceMiles: Math.round(d * 10) / 10,
  };
}

async function fetchBpsDirectoryMatches(zipCenter, radiusMiles, trade, qNorm, apiKey) {
  const entries = bpsDirectory.listPublic();
  const qLower = qNorm ? String(qNorm).toLowerCase().trim() : '';
  const out = [];
  for (const e of entries) {
    if (!tradeMatchesDirectory(trade, e.trades)) continue;
    if (qLower) {
      const hay = `${e.companyName || ''} ${e.contactName || ''}`.toLowerCase();
      if (!hay.includes(qLower)) continue;
    }
    const row = await mapDirectoryEntryToPlaceResult(e, zipCenter, radiusMiles, apiKey);
    if (row) out.push(row);
  }
  out.sort((a, b) => a.distanceMiles - b.distanceMiles);
  return out;
}

async function mergeGoogleAndBps(googleRows, zipCenter, radiusMiles, trade, qNorm, limit, apiKey) {
  if (!zipCenter) return googleRows;
  const bpsRows = await fetchBpsDirectoryMatches(zipCenter, radiusMiles, trade, qNorm, apiKey);
  return [...bpsRows, ...googleRows].slice(0, limit);
}

function mapPlaceToResult(place) {
  const id = place.name || place.id;
  const name = place.displayName?.text || place.displayName || 'Unknown';
  const primaryType =
    place.primaryTypeDisplayName?.text ||
    (Array.isArray(place.types) && place.types[0]) ||
    'establishment';
  const lat =
    place.location && typeof place.location.latitude === 'number'
      ? place.location.latitude
      : null;
  const lng =
    place.location && typeof place.location.longitude === 'number'
      ? place.location.longitude
      : null;
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
    latitude: lat,
    longitude: lng,
  };
}

/**
 * GET /api/places/contractors/search
 */
router.get('/contractors/search', async (req, res) => {
  const trade = (req.query.trade || 'All Trades').toString();
  const zip = (req.query.zip || '').toString().replace(/\D/g, '').slice(0, 5);
  const qNorm = sanitizePlacesTextQueryInput(req.query.q != null ? String(req.query.q) : '');
  let limit = parseInt(req.query.limit, 10) || 15;
  limit = Math.min(Math.max(limit, 1), 15);

  let radiusMiles = parseFloat(String(req.query.radiusMiles != null ? req.query.radiusMiles : '25'));
  if (Number.isNaN(radiusMiles) || radiusMiles <= 0) {
    radiusMiles = 25;
  }
  radiusMiles = Math.min(Math.max(radiusMiles, 5), 100);
  const radiusMilesRounded = Math.round(radiusMiles);

  if (zip.length < 5) {
    return res.status(400).json({ error: 'A valid 5-digit ZIP is required.' });
  }

  const apiKey = resolveGooglePlacesApiKey();
  if (!apiKey || apiKey === 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
    return res.json({
      results: [],
      metadata: {
        disabled: true,
        message:
          'Google Places search is not configured. On Render, set GOOGLE_PLACES_API_KEY (or GOOGLE_MAPS_API_KEY with the same key) on this web service, save, then redeploy.',
        dataSource: 'none',
      },
    });
  }

  const anchorLatRaw =
    req.query.anchorLat != null && req.query.anchorLat !== ''
      ? parseFloat(String(req.query.anchorLat))
      : NaN;
  const anchorLngRaw =
    req.query.anchorLng != null && req.query.anchorLng !== ''
      ? parseFloat(String(req.query.anchorLng))
      : NaN;
  const hasAnchor =
    !Number.isNaN(anchorLatRaw) &&
    !Number.isNaN(anchorLngRaw) &&
    anchorLatRaw >= 17.5 &&
    anchorLatRaw <= 71.5 &&
    anchorLngRaw >= -168.5 &&
    anchorLngRaw <= -64.5;

  /** Geocode ZIP first — needed to compare GPS vs ZIP when anchor is present (wrong metro from desktop Safari). */
  let zipLatLng = await geocodeUsZipToLatLng(zip, apiKey);
  let zipGeocodeSource = zipLatLng ? 'google' : null;
  if (!zipLatLng) {
    zipLatLng = await geocodeUsZipNominatim(zip);
    zipGeocodeSource = zipLatLng ? 'nominatim' : null;
  }

  let searchUsesAnchor = hasAnchor;
  let anchorZipMismatchMiles = null;
  let anchorDroppedForZipMismatch = false;

  if (hasAnchor && zipLatLng) {
    anchorZipMismatchMiles = haversineMiles(
      anchorLatRaw,
      anchorLngRaw,
      zipLatLng.lat,
      zipLatLng.lng
    );
    if (anchorZipMismatchMiles > MAX_ANCHOR_ZIP_DRIFT_MILES) {
      searchUsesAnchor = false;
      anchorDroppedForZipMismatch = true;
    }
  }

  const anchorCacheKey =
    searchUsesAnchor && hasAnchor
      ? `${anchorLatRaw.toFixed(4)},${anchorLngRaw.toFixed(4)}`
      : '';

  const cached = getCached(trade, zip, qNorm, radiusMilesRounded, anchorCacheKey);
  if (cached) {
    const zc = cached.metadata?.zipCenter;
    const merged = await mergeGoogleAndBps(
      cached.results || [],
      zc,
      radiusMiles,
      trade,
      qNorm,
      limit,
      apiKey
    );
    return res.json({
      ...cached,
      results: merged,
      metadata: {
        ...(cached.metadata || {}),
        count: merged.length,
        cached: true,
      },
    });
  }

  /** Without anchor: bias search with "near {zip}". With anchor: trade-only query + circle bias — unless anchor conflicts with ZIP. */
  let textQuery;
  if (searchUsesAnchor) {
    textQuery = qNorm ? `${qNorm} contractor` : buildTextQueryTradeOnly(trade);
  } else {
    textQuery = qNorm ? `${qNorm} contractor near ${zip}` : buildTextQuery(trade, zip);
  }

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

  let zipCenter;
  let geocodeSource;

  if (searchUsesAnchor) {
    zipCenter = { lat: anchorLatRaw, lng: anchorLngRaw };
    geocodeSource = 'device_anchor';
  } else if (zipLatLng) {
    zipCenter = zipLatLng;
    geocodeSource = zipGeocodeSource || 'zip_centroid';
  } else if (hasAnchor) {
    zipCenter = { lat: anchorLatRaw, lng: anchorLngRaw };
    geocodeSource = 'device_anchor_fallback_zip_geocode_failed';
    searchUsesAnchor = true;
  } else {
    zipCenter = null;
    geocodeSource = null;
  }

  /** Never run unfiltered Places text search — without a map origin, radius cannot apply meaningfully. */
  if (!zipCenter) {
    const payload = {
      results: [],
      metadata: {
        dataSource: 'google_places',
        textQuery,
        count: 0,
        ...(qNorm ? { searchQ: qNorm } : {}),
        radiusMiles: radiusMilesRounded,
        geocodeFailed: true,
        radiusApplied: false,
        message:
          'Could not locate this ZIP on the map. Enable Google Geocoding API for the same key as Places, or enter a valid US ZIP.',
      },
    };
    setCached(trade, zip, qNorm, radiusMilesRounded, anchorCacheKey, payload);
    res.json({ ...payload, metadata: { ...payload.metadata, cached: false } });
    return;
  }

  const placesFetchCount = PLACES_FETCH_BUFFER;

  try {
    const requestBody = {
      textQuery,
      maxResultCount: placesFetchCount,
      languageCode: 'en',
      regionCode: 'us',
    };
    const radiusMeters = Math.min(
      Math.max(Math.round(radiusMiles * 1609.34), 2000),
      50000
    );
    if (searchUsesAnchor) {
      requestBody.locationBias = {
        circle: {
          center: { latitude: anchorLatRaw, longitude: anchorLngRaw },
          radius: radiusMeters,
        },
      };
    } else if (zipLatLng) {
      requestBody.locationBias = {
        circle: {
          center: { latitude: zipLatLng.lat, longitude: zipLatLng.lng },
          radius: radiusMeters,
        },
      };
    }

    const { data } = await axios.post(PLACES_TEXT_SEARCH_URL, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      timeout: 12000,
    });

    const places = Array.isArray(data.places) ? data.places : [];
    let results = places.map(mapPlaceToResult);
    let droppedNoCoords = 0;

    const before = results.length;
    const googleCandidates = results
      .map((r) => {
        if (r.latitude == null || r.longitude == null) {
          droppedNoCoords += 1;
          return null;
        }
        const d = haversineMiles(zipCenter.lat, zipCenter.lng, r.latitude, r.longitude);
        const distanceMiles = Math.round(d * 10) / 10;
        return { ...r, distanceMiles };
      })
      .filter((r) => r != null && r.distanceMiles <= radiusMiles)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, limit + PLACES_FETCH_BUFFER);

    const merged = await mergeGoogleAndBps(
      googleCandidates,
      zipCenter,
      radiusMiles,
      trade,
      qNorm,
      limit,
      apiKey
    );
    results = merged;
    const metaExtra = {
      radiusMiles: radiusMilesRounded,
      zipCenter,
      geocodeSource,
      radiusApplied: true,
      candidatesBeforeRadius: before,
      droppedMissingCoordinates: droppedNoCoords,
      ...(searchUsesAnchor ? { searchAnchoredToDevice: true } : {}),
      ...(anchorDroppedForZipMismatch
        ? {
            anchorDroppedDueToZipMismatch: true,
            anchorZipMismatchMiles:
              anchorZipMismatchMiles != null
                ? Math.round(anchorZipMismatchMiles * 10) / 10
                : undefined,
          }
        : {}),
    };
    const payload = {
      results: googleCandidates,
      metadata: {
        dataSource: 'google_places',
        textQuery,
        count: merged.length,
        ...(qNorm ? { searchQ: qNorm } : {}),
        ...metaExtra,
      },
    };
    setCached(trade, zip, qNorm, radiusMilesRounded, anchorCacheKey, payload);
    res.json({
      results: merged,
      metadata: { ...payload.metadata, cached: false },
    });
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

  const apiKey = resolveGooglePlacesApiKey();
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
