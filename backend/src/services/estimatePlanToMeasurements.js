/**
 * Plan/blueprint takeoff — GPT-4o vision extracts rooms + labeled dimensions
 * from plan images/PDFs and maps them into Quick Measurement field keys.
 *
 * Accuracy contract: the model must only report numbers it can actually read.
 * Every measurement carries a confidence; fields below MIN_FIELD_CONFIDENCE are
 * withheld and reported to the client instead of silently auto-filled. If the
 * pages are too blurry/low-res to read, the whole takeoff fails with a clear
 * "not clear enough" reason rather than inventing square footage.
 */

const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const PDF_MIME = 'application/pdf';
const {
  filterPlanMeasurementsForTrade,
  filterPlanScopesForTrade,
} = require('./planImportTradeConfig');

/** Fields the model read but wasn't sure about are withheld below this. */
const MIN_FIELD_CONFIDENCE = 0.6;

const UNCLEAR_PLAN_REASON =
  'AI could not read square footage — the plan pages are not clear enough. ' +
  'Retake the photos closer and in focus (or import the original PDF) and try again.';

/** Quick Measurement keys we accept from vision. */
const MEASUREMENT_KEYS = new Set([
  'bathroomFloorSqft',
  'kitchenFloorSqft',
  'floorAreaSqft',
  'backsplashSqft',
  'countertopSqft',
  'cabinetLf',
  'showerWallTileSqft',
  'showerFloorTileSqft',
  'wallPaintSqft',
  'exteriorPaintSqft',
  'baseboardLf',
  'railingLf',
  'landscapeSqft',
  'sodSqft',
  'paverSqft',
  'rockMulchSqft',
  'landscapeTons',
  'roofSquares',
  'drywallSqft',
  'flooringSqft',
  'concreteSqft',
  'concreteCy',
  'excavationCy',
  'deckSqft',
  'garageSqft',
]);

/**
 * Floor plans almost never label paint/drywall/trim SF.
 * Accepting them caused invented values (e.g. paint 320 on a 1700 SF house).
 * Keep them out of auto-fill unless the model marks them as explicitly labeled.
 */
const LABELED_ONLY_KEYS = new Set([
  'wallPaintSqft',
  'exteriorPaintSqft',
  'drywallSqft',
  'baseboardLf',
  'railingLf',
]);

/** Concrete flatwork only when the sheet labels concrete/slab/driveway — not covered patio. */
const CONCRETE_EXPLICIT_KEYS = new Set(['concreteSqft', 'concreteCy']);

function normalizeMime(mimeType) {
  const m = String(mimeType || 'image/jpeg').toLowerCase();
  if (m === 'image/heic' || m === 'image/heif') return 'image/jpeg';
  if (!ALLOWED_MIME.has(m)) return 'image/jpeg';
  return m === 'image/jpg' ? 'image/jpeg' : m;
}

function approxBase64Bytes(b64) {
  return Math.floor((String(b64 || '').length * 3) / 4);
}

function positive(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function buildSystemPrompt() {
  return `You are a construction estimator reading architectural floor plans / blueprints (often photos of printed sheets).

Return ONLY valid JSON (no markdown). Read printed labels carefully — title blocks, Building Areas / Area Schedule tables, and room dimension strings like 18'-2" x 14'-7".

Extract BOTH:
1. Building Areas / Area Schedule / square-footage tables in the title block.
   - totalLivingSqft = "Total Living Area" or Main Floor Living + Upstairs Living (living only — exclude garage, patio, roof deck unless labeled living).
   - mainFloorLivingSqft, upstairsLivingSqft, garageSqft, coveredPatioSqft, coveredOutdoorSqft, roofDeckSqft when labeled.
2. EVERY individual room / space with a readable length×width or labeled SF on floor-plan pages — not a sample. Estimators need per-room SF when finishes differ (tile vs carpet, etc.).
3. Elevations / sections: use for notes (ceiling heights, materials) only — NEVER use elevations to invent floor square footage.
4. Structured planFacts with evidence for each fact. Include only printed/labeled facts: story count/floor evidence, roof pitch, wall or plate heights, exterior/foundation perimeter LF, non-painted exterior finish percent (stone/brick/stucco/masonry), covered-patio roof status, page/sheet, and supplied geometry. Never infer geometry or fabricate a quantity.

Exhaustive rooms (required):
- Include every labeled room you can read: bedrooms, primary suite, den/office, great room / living / family, dining, kitchen, pantry, laundry, mud, foyer/entry, hallways (when dimensioned), closets / WIC, powder, every bathroom (primary bath, guest bath, Jack & Jill, etc.), garage / RV garage / shop, covered patio / porch / deck, and similarly labeled spaces.
- Do NOT stop after a few "key" rooms. Prefer a complete rooms[] list over a short summary.
- Pair each room name with the L×W printed under/inside THAT room only. Never swap dims between Kitchen/Den/Bedrooms/Garage/RV Garage.
- Take room L×W from floor-plan / main-floor layout sheets. Do NOT use foundation-plan overall garage envelopes (e.g. a single ~31'×23' "GARAGE" box) when the floor plan labels separate Garage and RV Garage bays.
- Each bathroom is its OWN rooms[] entry (Primary Bath, Bath 2, Powder, …) AND you also sum all bath areas into measurements.bathroomFloorSqft ONLY when those baths have readable L×W. If baths have no dimensions, omit bathroomFloorSqft (do not invent ~90 SF).
- Rooms without a readable L×W or SF: omit area/length/width (do not invent) and add the room name to unreadableFields with reason "No dimension label on plan" (or blurry/cut off). Still skip inventing sizes.
- If a "PDF text layer" block is provided in the user message, treat those schedule totals and room L×W as ground truth — keep them, do not replace with different numbers.

Readability contract (most important):
- Only report a number when you can actually READ it printed on the sheet. If a dimension string, table cell, or label is blurry, cut off, too small, or ambiguous — OMIT that value entirely and list the field key (or room name) in unreadableFields with a short reason. NEVER estimate, round from visual proportions, or fill a typical value.
- Set imageQuality: "good" (text crisp and legible), "partial" (some labels legible, others not), or "unreadable" (cannot reliably read any dimension or schedule value).
- If imageQuality is "unreadable", set success false with reason "Plan images are not clear enough to read dimensions."
- For every key you put in measurements, add the same key to fieldConfidence with 0-1 confidence that the value was read correctly (1.0 = printed clearly and unambiguous, 0.5 = partially legible / had to interpret). Do not report a field you'd score below 0.4 — put it in unreadableFields instead.

Rules:
1. Only report numbers you can read on the sheet. Never invent sizes. Never estimate paint, drywall, or trim from floor area.
2. If length×width are labeled (including feet-inches like 12'-0" x 10'-6"), convert to decimal feet and set areaSqft = lengthFt × widthFt.
3. Map rooms (still list EVERY room in rooms[] even when mapped):
   - bathroom / bath / powder / M. Bath / Primary Bath → measurementKey bathroomFloorSqft; also sum all baths into measurements.bathroomFloorSqft
   - kitchen → kitchenFloorSqft
   - deck / patio / covered patio / roof deck → deckSqft
   - bedrooms, living, family, great room, dining, office, laundry, hallway, pantry, closet, garage → list in rooms with measurementKey null; do NOT put a single bedroom into floorAreaSqft
4. measurements.floorAreaSqft MUST be total living area from the Building Areas table when present. Do not use one room (e.g. a bath) as floorAreaSqft.
5. measurements.flooringSqft = same as floorAreaSqft when living SF is known.
6. measurements.deckSqft = covered patio + roof deck (+ covered outdoor when no patio) from the schedule. NEVER put covered patio / roof deck into concreteSqft.
7. measurements.garageSqft = Garage Area from the schedule when labeled (not living SF). Still list Garage / RV Garage as separate rooms[] entries with their L×W when labeled.
8. measurements.concreteSqft ONLY for labeled concrete slab / driveway / sidewalk / flatwork — omit for covered patio or wood deck. Put concreteSqft in explicitlyLabeled when used.
9. wallPaintSqft, drywallSqft, exteriorPaintSqft, baseboardLf, railingLf: omit unless the plan explicitly labels that quantity. Set explicitlyLabeled to those keys only when true. Never invent them.
10. Multi-page sets: merge all floor-plan pages; ignore duplicate title-block totals; elevations do not add living SF.
11. success false if none of the images are plans/blueprints, OR if imageQuality is "unreadable".
12. notesBlock: short contractor-readable summary of Building Areas totals (room-by-room SF will be listed separately by the app).

Schema:
{
  "success": true | false,
  "reason": "string | null",
  "imageQuality": "good" | "partial" | "unreadable",
  "buildingAreas": {
    "totalLivingSqft": 2418,
    "mainFloorLivingSqft": 1373,
    "upstairsLivingSqft": 1045,
    "garageSqft": 483,
    "coveredPatioSqft": 375,
    "coveredOutdoorSqft": 73,
    "roofDeckSqft": 331
  },
  "planFacts": {
    "storyCount": 2,
    "roofPitch": "5:12",
    "wallHeightFt": 9,
    "plateHeightFt": 9,
    "exteriorPerimeterLf": 214,
    "foundationPerimeterLf": 214,
    "nonPaintedExteriorPercent": 25,
    "coveredPatioRoofed": true,
    "geometry": [],
    "fieldEvidence": {
      "storyCount": {
        "value": 2,
        "sourceType": "detected_from_plan",
        "confidence": "high",
        "evidence": [{ "page": 2, "sheet": "A1.1", "label": "Upper Floor", "sourceText": "UPPER FLOOR LIVING 1209 SF", "sourceType": "plan_vision", "confidence": 0.95 }]
      }
    }
  },
  "rooms": [
    {
      "name": "Kitchen",
      "lengthFt": 12.083,
      "widthFt": 14.167,
      "areaSqft": 171.2,
      "measurementKey": "kitchenFloorSqft",
      "confidence": 0.9
    },
    {
      "name": "Primary Bath",
      "lengthFt": 10,
      "widthFt": 8,
      "areaSqft": 80,
      "measurementKey": "bathroomFloorSqft",
      "confidence": 0.85
    },
    {
      "name": "Great Room",
      "lengthFt": 14.833,
      "widthFt": 17.5,
      "areaSqft": 259.6,
      "measurementKey": null,
      "confidence": 0.9
    },
    {
      "name": "Bed 2",
      "lengthFt": 10.333,
      "widthFt": 10.25,
      "areaSqft": 105.9,
      "measurementKey": null,
      "confidence": 0.9
    }
  ],
  "measurements": {
    "kitchenFloorSqft": 171.2,
    "bathroomFloorSqft": 80,
    "floorAreaSqft": 2418,
    "flooringSqft": 2418,
    "deckSqft": 375,
    "garageSqft": 483
  },
  "fieldConfidence": {
    "kitchenFloorSqft": 0.9,
    "floorAreaSqft": 0.95
  },
  "unreadableFields": [
    { "field": "Guest Bath", "reason": "No dimension label on plan" }
  ],
  "explicitlyLabeled": [],
  "assumptions": ["Total living from Building Areas table on sheet 1"],
  "notesBlock": "string"
}`;
}

function sanitizeRooms(rawRooms) {
  const out = [];
  for (const room of Array.isArray(rawRooms) ? rawRooms : []) {
    const name = String(room?.name || '').trim().slice(0, 80);
    if (!name) continue;
    const lengthFt = positive(room.lengthFt);
    const widthFt = positive(room.widthFt);
    let areaSqft = positive(room.areaSqft);
    if (areaSqft == null && lengthFt != null && widthFt != null) {
      areaSqft = Math.round(lengthFt * widthFt * 10) / 10;
    }
    let measurementKey = room.measurementKey ? String(room.measurementKey).trim() : null;
    if (measurementKey && !MEASUREMENT_KEYS.has(measurementKey)) measurementKey = null;
    if (!measurementKey) {
      const n = name.toLowerCase();
      if (/bath|powder|toilet/.test(n)) measurementKey = 'bathroomFloorSqft';
      else if (/kitchen/.test(n)) measurementKey = 'kitchenFloorSqft';
      else if (/deck|patio|roof\s*deck/.test(n)) measurementKey = 'deckSqft';
      else if (/garage|storage|mechanical|closet|w\.?i\.?c/.test(n)) measurementKey = null;
      // Living/bedroom/etc. stay in rooms list for notes — do not map a single room to floorAreaSqft
      else measurementKey = null;
    }
    // Never let a single room claim whole-house floor area
    if (measurementKey === 'floorAreaSqft' || measurementKey === 'flooringSqft') {
      measurementKey = null;
    }
    const entry = {
      name,
      lengthFt,
      widthFt,
      areaSqft,
      measurementKey,
      confidence: Math.max(0, Math.min(1, Number(room.confidence) || 0)),
    };
    if (room.source) entry.source = String(room.source).slice(0, 40);
    const sourcePage = Number(room.sourcePage);
    if (Number.isInteger(sourcePage) && sourcePage > 0 && sourcePage <= 1000) {
      entry.sourcePage = sourcePage;
    }
    if (room.sourceSheet) entry.sourceSheet = String(room.sourceSheet).trim().slice(0, 20);
    out.push(entry);
  }
  return out.slice(0, 60);
}

function roomNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Prefer spatially paired PDF rooms; add vision-only rooms that don't collide. */
function mergeRoomsPreferPdf(pdfRooms, visionRooms) {
  const out = [...(Array.isArray(pdfRooms) ? pdfRooms : [])];
  const seen = new Set(out.map((r) => roomNameKey(r.name)));
  for (const room of Array.isArray(visionRooms) ? visionRooms : []) {
    const key = roomNameKey(room.name);
    if (!key || seen.has(key)) continue;
    // Don't let vision re-add a vague "Garage" envelope when PDF already has garage bays
    if (/^garage$/.test(key) && [...seen].some((k) => /garage/.test(k))) continue;
    out.push(room);
    seen.add(key);
  }
  return out.slice(0, 60);
}

function isPlainGarageName(name) {
  return /^garages?$/i.test(String(name || '').trim());
}

/**
 * Drop foundation-style combined garage envelopes when individual bays exist.
 * e.g. 31'×23' "Garage" alongside a normal bay / RV garage.
 * Do not drop long thin RV bays (12'×42').
 */
function pruneEnvelopeGarageRooms(rooms) {
  const list = Array.isArray(rooms) ? rooms : [];
  const garageLike = list.filter((r) => /\bgarage\b/i.test(r.name || ''));
  if (garageLike.length < 2) return list;
  const hasNamedBay = garageLike.some((r) => !isPlainGarageName(r.name) || (r.areaSqft != null && r.areaSqft < 700));
  if (!hasNamedBay) return list;
  return list.filter((r) => {
    if (!isPlainGarageName(r.name)) return true;
    const lengthFt = Number(r.lengthFt) || 0;
    const widthFt = Number(r.widthFt) || 0;
    const longSide = Math.max(lengthFt, widthFt);
    const shortSide = Math.min(lengthFt, widthFt) || 0;
    // Combined footprint: both sides large (foundation "GARAGE" box)
    if (longSide >= 28 && shortSide >= 18) return false;
    if (r.areaSqft != null && r.areaSqft >= 700) return false;
    return true;
  });
}

/** Never keep bath SF the model invented when no bath rooms have readable area. */
function reconcileBathroomMeasurement(measurements, rooms, unreadableFields = []) {
  const next = { ...measurements };
  const bathRooms = (rooms || []).filter(
    (r) => r.measurementKey === 'bathroomFloorSqft' && r.areaSqft != null && r.areaSqft > 0
  );
  if (!bathRooms.length) {
    if (next.bathroomFloorSqft != null) {
      unreadableFields.push({
        field: 'bathroomFloorSqft',
        reason: 'No bathroom dimensions labeled on plan',
      });
      delete next.bathroomFloorSqft;
    }
    return next;
  }
  const sum = Math.round(bathRooms.reduce((s, r) => s + r.areaSqft, 0) * 10) / 10;
  next.bathroomFloorSqft = sum;
  return next;
}

function sanitizeFieldConfidence(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!MEASUREMENT_KEYS.has(key)) continue;
    const v = Number(value);
    if (!Number.isFinite(v)) continue;
    out[key] = Math.max(0, Math.min(1, v));
  }
  return out;
}

function sanitizeUnreadableFields(raw) {
  const out = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    const field = String(entry?.field || entry?.key || '').trim().slice(0, 60);
    if (!field) continue;
    out.push({
      field,
      reason: String(entry?.reason || 'Not legible on the plan').trim().slice(0, 160),
    });
  }
  return out.slice(0, 40);
}

function sanitizeImageQuality(raw) {
  const q = String(raw || '').trim().toLowerCase();
  return ['good', 'partial', 'unreadable'].includes(q) ? q : null;
}

/**
 * Withhold measurements the model wasn't confident it actually read.
 * Schedule-derived values (Building Areas) keep their own gating in
 * sanitizeMeasurements, so keys without a confidence score are kept.
 */
function applyConfidenceFloor(measurements, fieldConfidence) {
  const kept = {};
  const lowConfidence = [];
  for (const [key, value] of Object.entries(measurements)) {
    const conf = fieldConfidence[key];
    if (conf != null && conf < MIN_FIELD_CONFIDENCE) {
      lowConfidence.push({ field: key, value, confidence: Math.round(conf * 100) / 100 });
      continue;
    }
    kept[key] = value;
  }
  return { measurements: kept, lowConfidence };
}

function sanitizeBuildingAreas(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const key of [
    'totalLivingSqft',
    'mainFloorLivingSqft',
    'upstairsLivingSqft',
    'garageSqft',
    'coveredPatioSqft',
    'coveredOutdoorSqft',
    'roofDeckSqft',
  ]) {
    const v = positive(raw[key]);
    if (v != null) out[key] = Math.round(v * 10) / 10;
  }
  const additional = (Array.isArray(raw.additionalFloorAreas) ? raw.additionalFloorAreas : [])
    .map(positive)
    .filter((v) => v != null)
    .map((v) => Math.round(v * 10) / 10)
    .slice(0, 4);
  if (additional.length) out.additionalFloorAreas = additional;
  if (out.totalLivingSqft == null) {
    const parts = [
      out.mainFloorLivingSqft,
      out.upstairsLivingSqft,
      ...(out.additionalFloorAreas || []),
    ].filter((v) => v != null);
    if (parts.length) {
      out.totalLivingSqft = Math.round(parts.reduce((s, v) => s + v, 0) * 10) / 10;
    }
  }
  return out;
}

const EVIDENCE_SOURCE_TYPES = new Set(['pdf_text', 'plan_vision', 'user', 'unknown']);
const FACT_SOURCE_TYPES = new Set([
  'detected_from_plan',
  'measured_from_geometry',
  'user_entered',
  'needs_confirmation',
]);
const FACT_CONFIDENCE = new Set(['high', 'medium', 'low', 'unresolved']);
const GEOMETRY_KINDS = new Set([
  'living_footprint',
  'garage_footprint',
  'covered_patio',
  'roof_plane',
  'foundation',
  'courtyard',
  'detached_structure',
  'other',
]);

function sanitizeEvidence(raw) {
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object') continue;
    const entry = {};
    const page = Number(item.page ?? item.sourcePage);
    if (Number.isInteger(page) && page > 0 && page <= 1000) entry.page = page;
    const sheet = String(item.sheet ?? item.sourceSheet ?? '').trim();
    if (sheet) entry.sheet = sheet.slice(0, 20);
    const label = String(item.label || '').trim();
    if (label) entry.label = label.slice(0, 80);
    const sourceText = String(item.sourceText || '').trim();
    if (sourceText) entry.sourceText = sourceText.slice(0, 200);
    const sourceType = String(item.sourceType || '').trim();
    entry.sourceType = EVIDENCE_SOURCE_TYPES.has(sourceType) ? sourceType : 'unknown';
    const confidence = Number(item.confidence);
    if (Number.isFinite(confidence)) entry.confidence = Math.max(0, Math.min(1, confidence));
    if (entry.page || entry.sheet || entry.label || entry.sourceText) out.push(entry);
  }
  return out.slice(0, 12);
}

function sanitizeGeometry(raw) {
  const regions = [];
  for (const region of Array.isArray(raw) ? raw : []) {
    const id = String(region?.id || '').trim().slice(0, 60);
    const kind = String(region?.kind || '').trim();
    if (!id || !GEOMETRY_KINDS.has(kind)) continue;
    const entry = { id, kind };
    for (const key of ['areaSqft', 'perimeterLf']) {
      const value = positive(region[key]);
      if (value != null) entry[key] = Math.round(value * 100) / 100;
    }
    if (typeof region.pitch === 'string' && /^\d{1,2}\s*[:/]\s*12$/.test(region.pitch.trim())) {
      entry.pitch = region.pitch.trim().replace('/', ':').replace(/\s+/g, '');
    }
    for (const key of ['isRoofed', 'isIncluded']) {
      if (typeof region[key] === 'boolean') entry[key] = region[key];
    }
    const points = (Array.isArray(region.points) ? region.points : [])
      .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .slice(0, 500);
    if (points.length >= 3) entry.points = points;
    const evidence = sanitizeEvidence(region.evidence);
    if (evidence.length) entry.evidence = evidence;
    // Geometry is accepted only when it contains supplied dimensions or points.
    if (entry.areaSqft != null || entry.perimeterLf != null || entry.points) regions.push(entry);
  }
  return regions.slice(0, 100);
}

function sanitizePlanFacts(raw, buildingAreas = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const fieldEvidence = {};
  for (const [key, fact] of Object.entries(src.fieldEvidence || {})) {
    if (!fact || typeof fact !== 'object') continue;
    const evidence = sanitizeEvidence(fact.evidence);
    if (!evidence.length) continue;
    const sourceType = String(fact.sourceType || '');
    const confidence = String(fact.confidence || '');
    fieldEvidence[String(key).slice(0, 80)] = {
      value:
        ['string', 'number', 'boolean'].includes(typeof fact.value) ? fact.value : null,
      sourceType: FACT_SOURCE_TYPES.has(sourceType) ? sourceType : 'detected_from_plan',
      confidence: FACT_CONFIDENCE.has(confidence) ? confidence : 'medium',
      evidence,
    };
  }
  const out = { buildingAreas: sanitizeBuildingAreas(buildingAreas), fieldEvidence };
  const hasEvidence = (key) => Boolean(fieldEvidence[key]?.evidence?.length);
  const storyCount = Number(src.storyCount);
  if (hasEvidence('storyCount') && Number.isInteger(storyCount) && storyCount >= 1 && storyCount <= 10) {
    out.storyCount = storyCount;
  }
  if (hasEvidence('roofPitch')) {
    const pitch = String(src.roofPitch || '').trim().toLowerCase();
    if (/^\d{1,2}\s*[:/]\s*12$/.test(pitch)) out.roofPitch = pitch.replace('/', ':').replace(/\s+/g, '');
    else if (pitch === 'low-slope') out.roofPitch = pitch;
  }
  for (const key of ['wallHeightFt', 'plateHeightFt']) {
    const value = positive(src[key]);
    if (hasEvidence(key) && value != null && value <= 40) out[key] = Math.round(value * 1000) / 1000;
  }
  for (const key of ['exteriorPerimeterLf', 'foundationPerimeterLf', 'foundationFootprintSqft', 'roofedFootprintSqft']) {
    const value = positive(src[key]);
    if (hasEvidence(key) && value != null && value <= 50000) {
      out[key] = Math.round(value * 10) / 10;
    }
  }
  for (const key of ['nonPaintedExteriorPercent', 'openingsPercent', 'roofWastePercent']) {
    const value = Number(src[key]);
    if (hasEvidence(key) && Number.isFinite(value) && value >= 0 && value <= 100) {
      out[key] = Math.round(value * 10) / 10;
    }
  }
  if (hasEvidence('coveredPatioRoofed') && typeof src.coveredPatioRoofed === 'boolean') {
    out.coveredPatioRoofed = src.coveredPatioRoofed;
  }
  if (hasEvidence('includeCoveredPatioSlab') && typeof src.includeCoveredPatioSlab === 'boolean') {
    out.includeCoveredPatioSlab = src.includeCoveredPatioSlab;
  }
  const geometry = sanitizeGeometry(src.geometry);
  if (geometry.length) out.geometry = geometry;
  const warnings = (Array.isArray(src.warnings) ? src.warnings : [])
    .map((warning) => String(warning || '').trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 10);
  if (warnings.length) out.warnings = warnings;
  return out;
}

function reconcileLabeledLivingAreas(buildingAreas, current = null) {
  const floors = [
    positive(buildingAreas.mainFloorLivingSqft),
    positive(buildingAreas.upstairsLivingSqft),
    ...(buildingAreas.additionalFloorAreas || []).map(positive),
  ].filter((value) => value != null);
  const cover = positive(buildingAreas.totalLivingSqft);
  if (!cover || !floors.length) return current;
  const floorLivingSqft = Math.round(floors.reduce((sum, value) => sum + value, 0) * 10) / 10;
  const floorDeltaSqft = Math.round((floorLivingSqft - cover) * 10) / 10;
  return {
    ...(current || {}),
    coverTotalLivingSqft: cover,
    floorLivingSqft,
    floorDeltaSqft,
    floorAreaStatus: Math.abs(floorDeltaSqft) < 0.6 ? 'reconciled' : 'review',
    warnings:
      Math.abs(floorDeltaSqft) < 0.6
        ? current?.warnings || []
        : [
            ...(current?.warnings || []),
            `Labeled floor areas differ from the cover total by ${floorDeltaSqft} sqft.`,
          ],
  };
}

function scheduleDeckSqft(buildingAreas) {
  const patio = positive(buildingAreas.coveredPatioSqft);
  const roofDeck = positive(buildingAreas.roofDeckSqft);
  const coveredOutdoor = positive(buildingAreas.coveredOutdoorSqft);
  const parts = [patio, roofDeck].filter((v) => v != null);
  if (parts.length) {
    return Math.round(parts.reduce((s, v) => s + v, 0) * 10) / 10;
  }
  return coveredOutdoor;
}

function isPatioLikeConcreteValue(concreteSqft, buildingAreas) {
  if (concreteSqft == null) return false;
  const patioValues = [
    positive(buildingAreas.coveredPatioSqft),
    positive(buildingAreas.roofDeckSqft),
    positive(buildingAreas.coveredOutdoorSqft),
    scheduleDeckSqft(buildingAreas),
  ].filter((v) => v != null);
  return patioValues.some((v) => Math.abs(v - concreteSqft) < 0.6);
}

function sanitizeMeasurements(raw, rooms, buildingAreas = {}, explicitlyLabeled = []) {
  const out = {};
  const src = raw && typeof raw === 'object' ? raw : {};
  const labeled = new Set(
    (Array.isArray(explicitlyLabeled) ? explicitlyLabeled : [])
      .map((k) => String(k || '').trim())
      .filter((k) => MEASUREMENT_KEYS.has(k))
  );

  for (const key of MEASUREMENT_KEYS) {
    const v = positive(src[key]);
    if (v == null) continue;
    if (LABELED_ONLY_KEYS.has(key) && !labeled.has(key)) continue;
    // Concrete flatwork requires explicit label — covered patio must not land here
    if (CONCRETE_EXPLICIT_KEYS.has(key) && !labeled.has(key)) continue;
    out[key] = Math.round(v * 10) / 10;
  }

  // Prefer Building Areas schedule for whole-house living SF
  const scheduleLiving = positive(buildingAreas.totalLivingSqft);
  if (scheduleLiving != null) {
    out.floorAreaSqft = scheduleLiving;
    if (out.flooringSqft == null) out.flooringSqft = scheduleLiving;
  }

  const scheduleGarage = positive(buildingAreas.garageSqft);
  if (scheduleGarage != null) {
    out.garageSqft = scheduleGarage;
  }

  const scheduleDeck = scheduleDeckSqft(buildingAreas);
  if (scheduleDeck != null) {
    out.deckSqft = scheduleDeck;
  } else if (out.deckSqft == null) {
    // keep room-aggregated deck below
  }

  // If vision stuffed patio SF into concreteSqft, move it to deck
  if (out.concreteSqft != null && isPatioLikeConcreteValue(out.concreteSqft, buildingAreas)) {
    if (out.deckSqft == null) out.deckSqft = out.concreteSqft;
    delete out.concreteSqft;
  }
  // Also catch unlabeled concrete that matched patio before we stripped it
  const rawConcrete = positive(src.concreteSqft);
  if (
    out.deckSqft == null &&
    rawConcrete != null &&
    isPatioLikeConcreteValue(rawConcrete, buildingAreas)
  ) {
    out.deckSqft = rawConcrete;
  }
  // Never keep the same number in both deck and concrete — covered patio is deck.
  if (
    out.concreteSqft != null &&
    out.deckSqft != null &&
    Math.abs(out.concreteSqft - out.deckSqft) < 0.6
  ) {
    delete out.concreteSqft;
  }

  // Aggregate kitchen/bath/deck rooms when vision omitted the measurements map
  const byKey = new Map();
  for (const room of rooms) {
    if (!room.measurementKey || room.areaSqft == null || room.confidence < 0.4) continue;
    if (LABELED_ONLY_KEYS.has(room.measurementKey) && !labeled.has(room.measurementKey)) continue;
    if (CONCRETE_EXPLICIT_KEYS.has(room.measurementKey) && !labeled.has(room.measurementKey)) continue;
    byKey.set(room.measurementKey, (byKey.get(room.measurementKey) || 0) + room.areaSqft);
  }
  for (const [key, total] of byKey) {
    if (out[key] == null) out[key] = Math.round(total * 10) / 10;
  }

  // Only sum rooms into floorAreaSqft when no schedule total exists
  if (out.floorAreaSqft == null) {
    const roomSum = rooms
      .filter((r) => r.areaSqft != null && r.confidence >= 0.4)
      .filter((r) => {
        const n = String(r.name || '').toLowerCase();
        return !/garage|patio|deck|storage|mechanical|closet|w\.?i\.?c/.test(n);
      })
      .reduce((s, r) => s + r.areaSqft, 0);
    // Require a meaningful multi-room sum (avoid a single 40 SF bath becoming "Room floor")
    if (roomSum >= 200 && rooms.filter((r) => r.areaSqft != null).length >= 2) {
      out.floorAreaSqft = Math.round(roomSum * 10) / 10;
    }
  }

  if (out.flooringSqft == null && out.floorAreaSqft != null) {
    out.flooringSqft = out.floorAreaSqft;
  }

  return out;
}

function buildItemQuantities(measurements) {
  const itemQuantities = {};
  const map = {
    flooringSqft: { key: 'flooring', unit: 'sqft' },
    floorAreaSqft: { key: 'flooring', unit: 'sqft' },
    drywallSqft: { key: 'drywall', unit: 'sqft' },
    wallPaintSqft: { key: 'paint', unit: 'sqft' },
    baseboardLf: { key: 'trim', unit: 'lf' },
    cabinetLf: { key: 'cabinets', unit: 'lf' },
    countertopSqft: { key: 'countertops', unit: 'sqft' },
    backsplashSqft: { key: 'backsplash', unit: 'sqft' },
    roofSquares: { key: 'tear_off', unit: 'squares' },
    deckSqft: { key: 'deck', unit: 'sqft' },
    concreteSqft: { key: 'concrete', unit: 'sqft' },
  };
  for (const [measKey, meta] of Object.entries(map)) {
    if (measurements[measKey] == null) continue;
    if (itemQuantities[meta.key]) continue;
    itemQuantities[meta.key] = {
      quantity: measurements[measKey],
      unit: meta.unit,
      quantitySource: 'plan_vision',
    };
  }
  return itemQuantities;
}

function formatRoomInventoryLines(rooms) {
  const lines = [];
  for (const room of (Array.isArray(rooms) ? rooms : []).slice(0, 48)) {
    const dims =
      room.areaSqft != null
        ? `${room.areaSqft} sqft`
        : room.lengthFt != null && room.widthFt != null
          ? `${room.lengthFt}×${room.widthFt} ft`
          : 'size unclear';
    lines.push(`- ${room.name}: ${dims}`);
  }
  return lines;
}

function formatNotesBlock({ notesBlock, rooms, measurements, buildingAreas }) {
  const lines = [];
  const summary = notesBlock ? String(notesBlock).trim() : '';
  if (summary) {
    lines.push(summary);
  } else {
    lines.push('Plan takeoff (confirm measurements):');
    if (buildingAreas?.totalLivingSqft != null) {
      lines.push(`- Total living: ${buildingAreas.totalLivingSqft} sqft`);
    }
    if (buildingAreas?.mainFloorLivingSqft != null) {
      lines.push(`- Main floor living: ${buildingAreas.mainFloorLivingSqft} sqft`);
    }
    if (buildingAreas?.upstairsLivingSqft != null) {
      lines.push(`- Upstairs living: ${buildingAreas.upstairsLivingSqft} sqft`);
    }
    if (buildingAreas?.garageSqft != null) {
      lines.push(`- Garage: ${buildingAreas.garageSqft} sqft`);
    }
    if (buildingAreas?.coveredPatioSqft != null) {
      lines.push(`- Covered patio: ${buildingAreas.coveredPatioSqft} sqft`);
    }
  }

  const roomLines = formatRoomInventoryLines(rooms);
  if (roomLines.length && !/Room measurements:/i.test(summary)) {
    if (lines.length) lines.push('');
    lines.push('Room measurements:');
    lines.push(...roomLines);
  }

  const keys = Object.keys(measurements || {});
  if (keys.length && !summary) {
    lines.push(`Mapped fields: ${keys.join(', ')}`);
  }
  return lines.join('\n').trim().slice(0, 4000);
}

/**
 * Merge plan notes into job notes (idempotent marker).
 */
function mergePlanNotesIntoJobNotes(existingNotes, notesBlock) {
  const block = String(notesBlock || '').trim();
  if (!block) return String(existingNotes || '').trim();
  const marker = '--- Plan takeoff ---';
  const existing = String(existingNotes || '');
  const withoutOld = existing.includes(marker)
    ? existing.slice(0, existing.indexOf(marker)).trimEnd()
    : existing.trimEnd();
  return [withoutOld, '', marker, block].filter((p, i) => (i === 0 ? true : p !== '')).join('\n').trim();
}

function isPdfPayload(img) {
  return String(img?.mimeType || '').toLowerCase() === PDF_MIME;
}

async function ensureCompatibleImage(img) {
  const rawB64 = String(img?.base64 || '').replace(/^data:[^;]+;base64,/, '');
  if (isPdfPayload(img)) {
    return {
      base64: rawB64,
      mimeType: PDF_MIME,
      filename: String(img?.name || 'plan.pdf').slice(0, 120),
    };
  }
  return { base64: rawB64, mimeType: normalizeMime(img?.mimeType) };
}

/** GPT-4o accepts PDFs as file content parts; images stay image_url parts. */
function toVisionContentPart(page) {
  if (page.mimeType === PDF_MIME) {
    return {
      type: 'file',
      file: {
        filename: page.filename || 'plan.pdf',
        file_data: `data:${PDF_MIME};base64,${page.base64}`,
      },
    };
  }
  return {
    type: 'image_url',
    image_url: { url: `data:${page.mimeType};base64,${page.base64}` },
  };
}

/**
 * @param {object} params
 */
async function analyzePlanForMeasurements({
  images,
  existingNotes = '',
  templateKeyHint = null,
  projectTypeHint = null,
  includeScope = false,
  estimatingMode = 'whole_project',
  selectedTrade = null,
  openai,
  aiModels,
  aiRuntime,
}) {
  const { resolvePlanImportSelection } = require('./planImportTradeConfig');
  const planSelection = resolvePlanImportSelection(
    estimatingMode,
    selectedTrade?.key || selectedTrade
  );
  if (!openai) {
    const err = new Error('OpenAI client not configured');
    err.status = 503;
    throw err;
  }

  const list = (Array.isArray(images) ? images : []).slice(0, MAX_IMAGES);
  if (!list.length) {
    const err = new Error('At least one plan image is required');
    err.status = 400;
    throw err;
  }

  for (const img of list) {
    if (!img?.base64 || typeof img.base64 !== 'string') {
      const err = new Error('Each page must include a base64 string');
      err.status = 400;
      throw err;
    }
    const limit = isPdfPayload(img) ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (approxBase64Bytes(img.base64) > limit) {
      const err = new Error(
        isPdfPayload(img)
          ? 'PDF too large — keep the plan set under 20MB'
          : 'Image too large — keep each plan page under 12MB'
      );
      err.status = 413;
      throw err;
    }
  }

  const compatible = [];
  for (const img of list) {
    compatible.push(await ensureCompatibleImage(img));
  }

  // Deterministic PDF text takeoff (schedule + spatially paired rooms) when bytes are PDFs.
  let pdfTakeoff = null;
  try {
    const {
      extractPlanTakeoffFromPdfBuffers,
      formatPdfEvidenceForVision,
    } = require('./planPdfTextTakeoff');
    const pdfBuffers = compatible
      .filter((p) => p.mimeType === PDF_MIME && p.base64)
      .map((p) => Buffer.from(String(p.base64).replace(/^data:[^;]+;base64,/, ''), 'base64'));
    if (pdfBuffers.length) {
      pdfTakeoff = await extractPlanTakeoffFromPdfBuffers(pdfBuffers);
      if (pdfTakeoff) pdfTakeoff.evidenceText = formatPdfEvidenceForVision(pdfTakeoff);
    }
  } catch (err) {
    console.warn('PDF text takeoff skipped:', err?.message || err);
    pdfTakeoff = null;
  }

  const hintBits = [];
  if (templateKeyHint) hintBits.push(`template: ${templateKeyHint}`);
  if (projectTypeHint) hintBits.push(`project type: ${projectTypeHint}`);
  if (planSelection.trade) {
    hintBits.push(
      `ESTIMATING MODE: selected trade — ${planSelection.trade.label}. ${
        planSelection.trade.scopeHint || `Route review toward ${planSelection.trade.label.toLowerCase()} only.`
      } Do not invent detailed counts; preserve missing information for contractor confirmation.`
    );
  }
  if (existingNotes?.trim()) {
    hintBits.push(`job notes (context only):\n${String(existingNotes).trim().slice(0, 1200)}`);
  }
  if (pdfTakeoff?.evidenceText) {
    hintBits.push(pdfTakeoff.evidenceText);
  }

  const measurementsPromise = openai.chat.completions.create({
    model: aiModels.assistant.vision,
    response_format: aiRuntime.assistant.vision.responseFormat,
    temperature: Math.min(aiRuntime.assistant.vision.temperature ?? 0.2, 0.15),
    max_tokens: Math.max(aiRuntime.assistant.vision.maxTokens || 900, 4000),
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Extract Building Areas / Area Schedule totals AND every labeled room with length×width or SF from these floor plan / blueprint pages.',
              'Include all bedrooms, baths, kitchen, dining, great room/living, laundry, pantry, closets, garage/RV garage, patio/porch — not just a few key rooms.',
              'Pair each room label with the dimension string printed for that room only — never swap Kitchen/Den/Bedroom/Garage/RV dims.',
              'Use floor-plan sheets for room L×W, not foundation overall garage envelopes. Each bath needs its own readable L×W; otherwise omit bathroomFloorSqft.',
              'Photos of printed sheets are OK — read the title-block square footage table carefully.',
              'Only report numbers you can actually read. If a value is blurry or illegible, omit it and list it in unreadableFields — never guess.',
              'Do not invent paint, drywall, or trim quantities.',
              'Covered patio / roof deck → deckSqft. Garage schedule → garageSqft. Never map patio to concrete flatwork.',
              hintBits.length ? hintBits.join('\n\n') : 'No extra context.',
            ].join('\n\n'),
          },
          ...compatible.map(toVisionContentPart),
        ],
      },
    ],
  });

  // Scope pass runs in parallel — a failed scope pass never blocks the takeoff.
  const scopePromise = includeScope
    ? (async () => {
        try {
          const { analyzePlanForScope } = require('./estimatePlanToScope');
          return await analyzePlanForScope({
            pages: compatible,
            toVisionContentPart,
            existingNotes,
            templateKeyHint,
            projectTypeHint,
            estimatingMode: planSelection.mode,
            selectedTrade: planSelection.trade,
            openai,
            aiModels,
            aiRuntime,
          });
        } catch (err) {
          console.warn('Plan scope pass failed:', err?.message || err);
          return { success: false, reason: null, scopeText: '', detections: [] };
        }
      })()
    : Promise.resolve(null);

  const [completion, scopeResult] = await Promise.all([measurementsPromise, scopePromise]);

  const raw = completion.choices?.[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err = new Error('Vision model returned invalid JSON. Try a clearer plan image.');
    err.status = 502;
    throw err;
  }

  const imageQuality = sanitizeImageQuality(parsed?.imageQuality);
  const unreadableFields = sanitizeUnreadableFields(parsed?.unreadableFields);
  const scope =
    scopeResult && scopeResult.success
      ? { scopeText: scopeResult.scopeText, detections: scopeResult.detections }
      : null;
  const failurePayload = (reason) => ({
    success: false,
    reason,
    imageQuality,
    rooms: [],
    measurements: {},
    fieldConfidence: {},
    lowConfidence: [],
    unreadableFields,
    buildingAreas: {},
    planFacts: { buildingAreas: {}, fieldEvidence: {} },
    areaReconciliation: null,
    itemQuantities: {},
    assumptions: [],
    notesBlock: '',
    // Scope reads labels/callouts, not dimension strings — it can survive an
    // unreadable-numbers failure and still be worth confirming.
    scope,
  });

  const pdfRoomsEarly = sanitizeRooms(pdfTakeoff?.rooms || []);
  const pdfHasTakeoff =
    pdfRoomsEarly.length >= 3 || Object.keys(pdfTakeoff?.buildingAreas || {}).length > 0;

  // Vision may fail on weird renders; PDF text takeoff can still succeed.
  if (imageQuality === 'unreadable' && !pdfHasTakeoff) {
    return failurePayload(UNCLEAR_PLAN_REASON);
  }

  if (parsed?.success === false && !pdfHasTakeoff) {
    return failurePayload(
      parsed.reason || 'Image does not look like a floor plan or blueprint.'
    );
  }

  const visionRooms = pruneEnvelopeGarageRooms(sanitizeRooms(parsed?.rooms));
  const pdfRooms = pdfRoomsEarly;
  const rooms =
    pdfRooms.length >= 3
      ? mergeRoomsPreferPdf(pdfRooms, visionRooms)
      : pruneEnvelopeGarageRooms(visionRooms);

  const buildingAreas = sanitizeBuildingAreas({
    ...(parsed.buildingAreas || {}),
    ...(pdfTakeoff?.buildingAreas || {}),
  });
  const pdfPlanFacts = pdfTakeoff?.planFacts || {};
  const visionPlanFacts = parsed.planFacts || {};
  const planFacts = sanitizePlanFacts(
    {
      ...visionPlanFacts,
      ...pdfPlanFacts,
      geometry: visionPlanFacts.geometry,
      warnings: [...(visionPlanFacts.warnings || []), ...(pdfPlanFacts.warnings || [])],
      fieldEvidence: {
        ...(visionPlanFacts.fieldEvidence || {}),
        ...(pdfPlanFacts.fieldEvidence || {}),
      },
    },
    buildingAreas
  );
  const fieldConfidence = sanitizeFieldConfidence(parsed.fieldConfidence);
  // PDF schedule totals are authoritative — mark high confidence so they are kept.
  if (pdfTakeoff?.buildingAreas?.totalLivingSqft != null) fieldConfidence.floorAreaSqft = 1;
  if (pdfTakeoff?.buildingAreas?.garageSqft != null) fieldConfidence.garageSqft = 1;
  if (
    pdfTakeoff?.buildingAreas?.coveredPatioSqft != null ||
    pdfTakeoff?.buildingAreas?.roofDeckSqft != null
  ) {
    fieldConfidence.deckSqft = 1;
  }

  let rawMeasurements = sanitizeMeasurements(
    parsed.measurements,
    rooms,
    buildingAreas,
    parsed.explicitlyLabeled
  );
  rawMeasurements = reconcileBathroomMeasurement(rawMeasurements, rooms, unreadableFields);
  const { measurements, lowConfidence } = applyConfidenceFloor(rawMeasurements, fieldConfidence);
  const assumptions = [
    ...(Array.isArray(pdfTakeoff?.assumptions) ? pdfTakeoff.assumptions : []),
    ...(Array.isArray(parsed.assumptions)
      ? parsed.assumptions.map((a) => String(a).slice(0, 200))
      : []),
  ]
    .map((a) => String(a).slice(0, 200))
    .filter(Boolean)
    .slice(0, 10);
  let notesBlock = formatNotesBlock({
    notesBlock: parsed.notesBlock,
    rooms,
    measurements,
    buildingAreas,
  });
  if (scope?.scopeText) {
    const { appendScopeTextToNotesBlock } = require('./estimatePlanToScope');
    notesBlock = appendScopeTextToNotesBlock(notesBlock, scope.scopeText);
  }

  if (!Object.keys(measurements).length && !rooms.length && !Object.keys(buildingAreas).length) {
    const onlyLowConfidence = lowConfidence.length > 0 || unreadableFields.length > 0;
    const failure = failurePayload(
      onlyLowConfidence ? UNCLEAR_PLAN_REASON : parsed.reason || 'No readable dimensions found on the plan.'
    );
    failure.lowConfidence = lowConfidence;
    failure.assumptions = assumptions;
    return failure;
  }

  let areaReconciliation = null;
  try {
    const { measurementSemanticsV1Enabled, buildAreaReconciliation } = require('./measurementSemantics');
    if (measurementSemanticsV1Enabled()) {
      areaReconciliation = buildAreaReconciliation({
        declaredLivingSf: measurements.floorAreaSqft ?? buildingAreas?.totalLivingSqft,
        declaredGarageSf: measurements.garageSqft ?? buildingAreas?.garageSqft,
        patioDeckSf:
          measurements.deckSqft ??
          buildingAreas?.coveredPatioSqft ??
          buildingAreas?.coveredOutdoorSqft,
        rooms,
      });
    }
  } catch {
    areaReconciliation = null;
  }
  areaReconciliation = reconcileLabeledLivingAreas(buildingAreas, areaReconciliation);
  const tradeMeasurements = filterPlanMeasurementsForTrade(
    measurements,
    planSelection.mode,
    planSelection.trade
  );
  const tradeScope = filterPlanScopesForTrade(
    scope,
    planSelection.mode,
    planSelection.trade
  );
  const tradeRooms = planSelection.mode === 'selected_trade' ? [] : rooms;
  const tradeAreaReconciliation =
    planSelection.mode === 'selected_trade' ? null : areaReconciliation;

  return {
    success: true,
    reason: null,
    imageQuality: imageQuality || (pdfRooms.length ? 'good' : 'partial'),
    rooms: tradeRooms,
    measurements: tradeMeasurements,
    fieldConfidence,
    lowConfidence,
    unreadableFields,
    buildingAreas,
    planFacts,
    areaReconciliation: tradeAreaReconciliation,
    itemQuantities: buildItemQuantities(tradeMeasurements),
    assumptions,
    notesBlock,
    scope: tradeScope,
    estimatingMode: planSelection.mode,
    selectedTrade: planSelection.trade?.key || null,
    tradeProvenance: {
      source: 'plan_import',
      mode: planSelection.mode,
      selectedTrade: planSelection.trade?.key || null,
      routerStatus: planSelection.trade?.status || null,
    },
    missingInfo: planSelection.trade?.missingInfo || [],
  };
}

/**
 * Pure merge helper for tests / mobile mirror.
 * Only fills empty measurement fields (does not overwrite user values).
 */
function mergePlanMeasurementsIntoExisting(current = {}, extracted = {}, { overwrite = false } = {}) {
  const next = { ...current };
  let filled = 0;
  for (const [key, value] of Object.entries(extracted || {})) {
    if (!MEASUREMENT_KEYS.has(key)) continue;
    const v = positive(value);
    if (v == null) continue;
    const existing = positive(next[key]);
    if (existing != null && !overwrite) continue;
    next[key] = v;
    filled += 1;
  }
  return { measurements: next, filled };
}

module.exports = {
  analyzePlanForMeasurements,
  mergePlanNotesIntoJobNotes,
  mergePlanMeasurementsIntoExisting,
  sanitizeRooms,
  sanitizeMeasurements,
  sanitizeBuildingAreas,
  sanitizePlanFacts,
  sanitizeEvidence,
  sanitizeGeometry,
  reconcileLabeledLivingAreas,
  sanitizeFieldConfidence,
  sanitizeUnreadableFields,
  applyConfidenceFloor,
  buildItemQuantities,
  formatNotesBlock,
  mergeRoomsPreferPdf,
  pruneEnvelopeGarageRooms,
  reconcileBathroomMeasurement,
  MEASUREMENT_KEYS,
  LABELED_ONLY_KEYS,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  MIN_FIELD_CONFIDENCE,
  UNCLEAR_PLAN_REASON,
};
