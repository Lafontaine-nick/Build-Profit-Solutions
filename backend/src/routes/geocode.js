/**
 * Server-side geocoding using Google Geocoding API (same key as Places).
 * More accurate US ZIP from lat/lng than free reverse-geocode APIs (boundary snap issues).
 *
 * GET /api/geocode/reverse?lat=&lng=
 * GET /api/geocode/zip-locality?zip=89141 — city + state for subcontractor request posts
 * GET /api/geocode/refine-neighbor-zip?lat=&lng=&zip= — LV metro viewport + legacy 88914/89141 tweak (OSM fallback)
 */

const express = require('express');
const axios = require('axios');

const router = express.Router();
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/** Google's JSON includes `error_message` when status is REQUEST_DENIED, etc. — surfaced for local debugging. */
function firstGoogleGeocodeErrorMessage(...payloads) {
  for (const d of payloads) {
    if (d && typeof d.error_message === 'string' && d.error_message.trim()) {
      return d.error_message.trim();
    }
  }
  return null;
}

function resolveGoogleMapsKey() {
  return String(
    process.env.GOOGLE_PLACES_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      ''
  ).trim();
}

const LOCATION_TYPE_RANK = {
  ROOFTOP: 0,
  RANGE_INTERPOLATED: 1,
  GEOMETRIC_CENTER: 2,
  APPROXIMATE: 3,
};

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

/** USPS centroid for forward geocode — same as Places route. */
async function geocodeUsZipCentroid(zip5, apiKey) {
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
  } catch {
    return null;
  }
}

/** Viewport (or bounds) for a US ZIP from forward geocode — used to test if GPS lies inside 89141's area. */
async function zipPostalViewport(zip5, apiKey) {
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
    const g = data.results[0].geometry;
    return g?.viewport || g?.bounds || null;
  } catch {
    return null;
  }
}

function pointInLatLngViewport(lat, lng, viewport) {
  if (!viewport?.northeast || !viewport?.southwest) return false;
  const { northeast, southwest } = viewport;
  return (
    lat >= southwest.lat &&
    lat <= northeast.lat &&
    lng >= southwest.lng &&
    lng <= northeast.lng
  );
}

function viewportCentroid(viewport) {
  if (!viewport?.northeast || !viewport?.southwest) return null;
  const { northeast, southwest } = viewport;
  return {
    lat: (northeast.lat + southwest.lat) / 2,
    lng: (northeast.lng + southwest.lng) / 2,
  };
}

/** Rough Clark County / Las Vegas valley bounds — used to run postal-viewport refinement only here. */
function inLasVegasMetroBBox(lat, lng) {
  return lat >= 35.88 && lat <= 36.45 && lng >= -115.55 && lng <= -114.85;
}

/**
 * Adjacent ZIPs in SW/Henderson/Enterprise where Google’s postal polygon often disagrees with
 * mailing ZIP or OSM (89074 vs 88914 vs 89141, etc.). Pick the ZIP whose forward-geocoded
 * postal viewport actually contains the GPS point; tie-break by distance to viewport centroid.
 */
const LAS_VEGAS_CLUSTER_ZIPS = [
  '89074',
  '89075',
  '89002',
  '89113',
  '89139',
  '89141',
  '89147',
  '89148',
  '88914',
  '89178',
  '89179',
  '89183',
];

async function refineLasVegasMetroZip(lat, lng, zip, apiKey) {
  if (!inLasVegasMetroBBox(lat, lng)) return zip;

  const viewports = await Promise.all(
    LAS_VEGAS_CLUSTER_ZIPS.map(async (z5) => {
      const vp = await zipPostalViewport(z5, apiKey);
      return { z5, vp };
    })
  );

  const candidates = [];
  for (const { z5, vp } of viewports) {
    if (!vp || !pointInLatLngViewport(lat, lng, vp)) continue;
    const c = viewportCentroid(vp);
    if (!c) continue;
    const d = haversineMiles(lat, lng, c.lat, c.lng);
    candidates.push({ z5, d });
  }

  if (!candidates.length) return zip;

  // Postal viewports overlap: the same GPS point can lie inside 88914 and 89139 (etc.). Tie-breaking
  // by centroid distance often picks 88914 even when mailing/neighborhood aligns with another ZIP.
  // When another cluster ZIP's polygon also contains the point, prefer it over 88914.
  let ranked = candidates;
  if (candidates.length > 1 && candidates.some((c) => c.z5 === '88914')) {
    ranked = candidates.filter((c) => c.z5 !== '88914');
    if (!ranked.length) ranked = candidates;
  }

  ranked.sort((a, b) => a.d - b.d);
  return ranked[0].z5;
}

/**
 * When reverse geocode returns 88914 (neighbor polygon) but the device is actually inside
 * Google’s 89141 postal viewport, return 89141 so “current location” matches mailing ZIP.
 */
async function refineLasVegasNeighborZip(lat, lng, zip, apiKey) {
  if (zip !== '88914') return zip;

  const vp89141 = await zipPostalViewport('89141', apiKey);
  if (vp89141 && pointInLatLngViewport(lat, lng, vp89141)) {
    return '89141';
  }

  const c88914 = await geocodeUsZipCentroid('88914', apiKey);
  const c89141 = await geocodeUsZipCentroid('89141', apiKey);
  if (!c88914 || !c89141) return zip;
  const d88914 = haversineMiles(lat, lng, c88914.lat, c88914.lng);
  const d89141 = haversineMiles(lat, lng, c89141.lat, c89141.lng);
  return d89141 < d88914 ? '89141' : zip;
}

/** Rough US bounds — national ZIP viewport checks (continental + AK + HI approx). */
function inRoughUsBBox(lat, lng) {
  if (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) return true;
  if (lat >= 51 && lat <= 72 && lng >= -170 && lng <= -129) return true;
  if (lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154) return true;
  return false;
}

/**
 * Outside Las Vegas metro-specific logic: if the reverse-geocode ZIP's postal viewport does not
 * contain GPS (common near city/county lines in UT, CO, TX, etc.), prefer `postal_code`-only reverse
 * for that coordinate so search ZIP aligns with Google's polygon for the point.
 */
async function refineUsZipWhenOutsideForwardViewport(lat, lng, zip5, apiKey) {
  if (!zip5 || zip5.length !== 5) return zip5;
  if (!inRoughUsBBox(lat, lng)) return zip5;

  const vp = await zipPostalViewport(zip5, apiKey);
  if (vp && pointInLatLngViewport(lat, lng, vp)) return zip5;

  try {
    const { data } = await axios.get(GEOCODE_URL, {
      params: {
        latlng: `${lat},${lng}`,
        key: apiKey,
        result_type: 'postal_code',
      },
      timeout: 12000,
    });
    if (data.status === 'OK' && Array.isArray(data.results) && data.results.length) {
      const zP = extractUsZipFromGeocodeResults(data.results);
      if (zP && zP.length === 5) return zP;
    }
  } catch {
    /* keep zip5 */
  }
  return zip5;
}

async function applyLasVegasZipRefinements(lat, lng, rawZip, apiKey) {
  const cleaned = String(rawZip ?? '').replace(/\D/g, '').slice(0, 5);
  if (cleaned.length !== 5) return rawZip;
  let z = await refineLasVegasMetroZip(lat, lng, cleaned, apiKey);
  z = await refineLasVegasNeighborZip(lat, lng, z, apiKey);
  if (!inLasVegasMetroBBox(lat, lng)) {
    z = await refineUsZipWhenOutsideForwardViewport(lat, lng, z, apiKey);
  }
  return z;
}

function postalZipFromComponents(comps, requireUs) {
  if (!Array.isArray(comps)) return null;
  let inUS = false;
  for (const c of comps) {
    if (Array.isArray(c.types) && c.types.includes('country') && c.short_name === 'US') {
      inUS = true;
    }
  }
  if (requireUs && !inUS) return null;
  for (const c of comps) {
    if (Array.isArray(c.types) && c.types.includes('postal_code')) {
      const raw = String(c.long_name || c.short_name || '')
        .replace(/\D/g, '')
        .slice(0, 5);
      if (raw.length === 5) return raw;
    }
  }
  return null;
}

/**
 * Prefer street-level / rooftop ZIP — Google's result order is not guaranteed to be best-first.
 * Also used for result_type=postal_code responses (single polygon).
 */
function extractUsZipFromGeocodeResults(results) {
  if (!Array.isArray(results) || !results.length) return null;
  const scored = [];
  for (const r of results) {
    const comps = r.address_components;
    const lt = r.geometry?.location_type || 'APPROXIMATE';
    const base = LOCATION_TYPE_RANK[lt] !== undefined ? LOCATION_TYPE_RANK[lt] : 4;
    const rt = Array.isArray(r.types) ? r.types : [];
    let bump = 0;
    if (rt.includes('street_address')) bump -= 3;
    if (rt.includes('premise')) bump -= 2;
    if (rt.includes('subpremise')) bump -= 1;
    if (rt.includes('postal_code')) bump -= 2;
    const zip = postalZipFromComponents(comps, false);
    if (!zip) continue;
    let inUS = false;
    if (Array.isArray(comps)) {
      for (const c of comps) {
        if (c.types?.includes('country') && c.short_name === 'US') inUS = true;
      }
    }
    scored.push({ score: base + bump, zip, inUS });
  }
  scored.sort((a, b) => {
    if (a.inUS !== b.inUS) return a.inUS ? -1 : 1;
    return a.score - b.score;
  });
  return scored.length ? scored[0].zip : null;
}

/**
 * Prefer ZIP from street-level hits only — mixing in `postal_code`-only Geocoder rows can pick the
 * neighbor polygon (88914) instead of the mailing ZIP on the parcel (89141).
 */
function extractUsZipStreetPreferred(results) {
  if (!Array.isArray(results) || !results.length) return null;
  const pick = (pred) => {
    const filtered = results.filter((r) => pred(r));
    if (!filtered.length) return null;
    return extractUsZipFromGeocodeResults(filtered);
  };
  return (
    pick((r) => (r.types || []).includes('street_address')) ||
    pick((r) => (r.types || []).includes('premise')) ||
    pick((r) => ['ROOFTOP', 'RANGE_INTERPOLATED'].includes(r.geometry?.location_type)) ||
    extractUsZipFromGeocodeResults(results)
  );
}

/**
 * Prefer street-level reverse geocode first — `result_type=postal_code` alone often snaps to a
 * neighboring ZIP polygon (e.g. 88914 vs 89141 for the same driveway). Fall back to postal-only if needed.
 *
 * Helpers below implement googleReverseZipUs → locality/state + sanity-checked LV refinement.
 */
function extractLocalityStateFromGeocodeResults(results) {
  if (!Array.isArray(results) || !results.length) {
    return { locality: null, adminArea1: null };
  }
  const comps = results[0].address_components || [];
  let locality = null;
  let adminArea1 = null;
  for (const c of comps) {
    const types = c.types || [];
    if (types.includes('locality')) locality = c.long_name || c.short_name || locality;
    if (types.includes('administrative_area_level_1')) adminArea1 = c.short_name || adminArea1;
  }
  return { locality, adminArea1 };
}

async function distanceMilesToZipCentroid(lat, lng, zip5, apiKey) {
  const c = await geocodeUsZipCentroid(zip5, apiKey);
  if (!c) return null;
  return haversineMiles(lat, lng, c.lat, c.lng);
}

/** LV polygon refinement can overshoot; pick ZIP whose centroid is closer to GPS when they diverge. */
async function resolveZipWithSanity(lat, lng, rawZip, refinedZip, apiKey) {
  if (!rawZip || !refinedZip || rawZip === refinedZip) return refinedZip;
  // Google's street reverse often snaps to 88914; metro refinement intentionally picks another cluster
  // ZIP when overlapping postal viewports contain the GPS point. Centroid sanity below would otherwise
  // revert to raw 88914 whenever the device is closer to 88914's centroid — undoing that refinement.
  if (rawZip === '88914' && refinedZip !== '88914') return refinedZip;

  const rawVp = await zipPostalViewport(rawZip, apiKey);
  if (rawVp && !pointInLatLngViewport(lat, lng, rawVp) && refinedZip !== rawZip) {
    return refinedZip;
  }

  const dRaw = await distanceMilesToZipCentroid(lat, lng, rawZip, apiKey);
  const dRef = await distanceMilesToZipCentroid(lat, lng, refinedZip, apiKey);
  if (dRaw == null && dRef == null) return refinedZip;
  if (dRef == null) return rawZip;
  if (dRaw == null) return refinedZip;
  if (dRef > dRaw + 18 && dRaw <= 85) return rawZip;
  if (dRef > 110 && dRaw != null && dRaw < dRef) return rawZip;
  return refinedZip;
}

async function googleReverseZipUs(lat, lng, apiKey) {
  const full = await axios.get(GEOCODE_URL, {
    params: {
      latlng: `${lat},${lng}`,
      key: apiKey,
    },
    timeout: 12000,
  });
  const dFull = full.data;
  if (dFull.status === 'OK' && Array.isArray(dFull.results) && dFull.results.length) {
    const zFull =
      extractUsZipStreetPreferred(dFull.results) || extractUsZipFromGeocodeResults(dFull.results);
    if (zFull) {
      return {
        zip: zFull,
        detail: 'full_reverse',
        geocodeStatus: dFull.status,
        results: dFull.results,
      };
    }
  }

  const streetTyped = await axios.get(GEOCODE_URL, {
    params: {
      latlng: `${lat},${lng}`,
      key: apiKey,
      result_type: 'street_address',
    },
    timeout: 12000,
  });
  const dStreet = streetTyped.data;
  if (dStreet.status === 'OK' && Array.isArray(dStreet.results) && dStreet.results.length) {
    const zSt = extractUsZipFromGeocodeResults(dStreet.results);
    if (zSt) {
      return {
        zip: zSt,
        detail: 'street_address_filter',
        geocodeStatus: dStreet.status,
        results: dStreet.results,
      };
    }
  }

  const postalOnly = await axios.get(GEOCODE_URL, {
    params: {
      latlng: `${lat},${lng}`,
      key: apiKey,
      result_type: 'postal_code',
    },
    timeout: 12000,
  });
  const dP = postalOnly.data;
  if (dP.status === 'OK' && Array.isArray(dP.results) && dP.results.length) {
    const zP = extractUsZipFromGeocodeResults(dP.results);
    if (zP) {
      return {
        zip: zP,
        detail: 'postal_polygon_fallback',
        geocodeStatus: dP.status,
        results: dP.results,
      };
    }
  }

  return {
    zip: null,
    detail: 'none',
    geocodeStatus: dFull.status || dP?.status || 'UNKNOWN',
    results: null,
    googleErrorMessage: firstGoogleGeocodeErrorMessage(dFull, dStreet, dP),
  };
}

router.get('/reverse', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng query params are required', zip: null });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'lat or lng out of range', zip: null });
  }

  const apiKey = resolveGoogleMapsKey();
  if (!apiKey || apiKey === 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
    return res.json({
      zip: null,
      source: 'none',
      disabled: true,
      message:
        'Geocoding is not configured. Set GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY on the server.',
    });
  }

  try {
    const geo = await googleReverseZipUs(lat, lng, apiKey);
    const { zip: rawZip, geocodeStatus, results, googleErrorMessage } = geo;

    if (!rawZip) {
      return res.json({
        zip: null,
        source: 'google',
        status: geocodeStatus || 'NO_ZIP',
        ...(googleErrorMessage ? { googleErrorMessage } : {}),
      });
    }

    const refinedZip = await applyLasVegasZipRefinements(lat, lng, rawZip, apiKey);
    const zip = await resolveZipWithSanity(lat, lng, rawZip, refinedZip, apiKey);
    const { locality, adminArea1 } = extractLocalityStateFromGeocodeResults(results || []);

    return res.json({
      zip,
      zipRaw: rawZip,
      zipRefined: refinedZip,
      locality,
      adminArea1,
      source: 'google',
      status: 'OK',
    });
  } catch (err) {
    console.error('GET /geocode/reverse', err.message);
    res.status(502).json({
      zip: null,
      source: 'error',
      error: err.response?.data?.error_message || err.message || 'Geocode failed',
    });
  }
});

/**
 * Forward-resolve a US ZIP to a display city + 2-letter state (for subcontractor requests, etc.).
 * GET /api/geocode/zip-locality?zip=89141
 */
router.get('/zip-locality', async (req, res) => {
  const zip5 = (req.query.zip || '').toString().replace(/\D/g, '').slice(0, 5);
  if (zip5.length !== 5) {
    return res.status(400).json({
      error: 'zip query param must be 5 US digits',
      ok: false,
      zip: zip5 || null,
      city: null,
      state: null,
    });
  }

  const apiKey = resolveGoogleMapsKey();
  if (!apiKey || apiKey === 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
    return res.status(503).json({
      ok: false,
      disabled: true,
      zip: zip5,
      city: null,
      state: null,
      message:
        'Geocoding is not configured. Set GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY on the server.',
    });
  }

  try {
    const { data } = await axios.get(GEOCODE_URL, {
      params: {
        components: `country:US|postal_code:${zip5}`,
        key: apiKey,
      },
      timeout: 8000,
    });

    if (data.status !== 'OK' || !Array.isArray(data.results) || !data.results.length) {
      return res.json({
        ok: false,
        zip: zip5,
        city: null,
        state: null,
        geocodeStatus: data.status || 'EMPTY',
        googleErrorMessage: firstGoogleGeocodeErrorMessage(data),
      });
    }

    let { locality, adminArea1 } = extractLocalityStateFromGeocodeResults(data.results);
    if (!locality) {
      const comps = data.results[0].address_components || [];
      for (const c of comps) {
        const types = c.types || [];
        if (
          types.includes('sublocality_level_1') ||
          types.includes('neighborhood') ||
          types.includes('administrative_area_level_3')
        ) {
          locality = c.long_name || c.short_name || locality;
          if (locality) break;
        }
      }
    }
    if (!locality) {
      locality = `ZIP ${zip5}`;
    }
    if (!adminArea1) {
      return res.json({
        ok: false,
        zip: zip5,
        city: locality,
        state: null,
        geocodeStatus: data.status,
        googleErrorMessage: firstGoogleGeocodeErrorMessage(data),
      });
    }

    return res.json({
      ok: true,
      zip: zip5,
      city: locality,
      state: adminArea1,
      geocodeStatus: data.status,
    });
  } catch (err) {
    console.error('GET /geocode/zip-locality', err.message);
    res.status(502).json({
      ok: false,
      zip: zip5,
      city: null,
      state: null,
      error: err.response?.data?.error_message || err.message || 'Geocode failed',
    });
  }
});

/** Las Vegas metro refinement when client used OSM / wrong polygon ZIP (same logic as /reverse). */
router.get('/refine-neighbor-zip', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const zipIn = (req.query.zip || '').toString().replace(/\D/g, '').slice(0, 5);
  if (Number.isNaN(lat) || Number.isNaN(lng) || zipIn.length !== 5) {
    return res.status(400).json({ error: 'lat, lng, and zip are required', zip: null });
  }

  const apiKey = resolveGoogleMapsKey();
  if (!apiKey || apiKey === 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
    return res.json({ zip: zipIn, refined: false });
  }

  try {
    const zip = await applyLasVegasZipRefinements(lat, lng, zipIn, apiKey);
    res.json({ zip, refined: zip !== zipIn });
  } catch (err) {
    console.error('GET /geocode/refine-neighbor-zip', err.message);
    res.status(502).json({ zip: zipIn, refined: false, error: err.message });
  }
});

module.exports = router;
