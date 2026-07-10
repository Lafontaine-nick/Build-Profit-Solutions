/**
 * Plan/blueprint takeoff — GPT-4o vision extracts rooms + labeled dimensions
 * from plan images and maps them into Quick Measurement field keys.
 *
 * MVP: image pages only (client can render PDF page 1 to PNG). Not pricing.
 */

const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

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

Priority (highest first):
1. Building Areas / Area Schedule / square-footage tables in the title block.
   - totalLivingSqft = "Total Living Area" or Main Floor Living + Upstairs Living (living only — exclude garage, patio, roof deck unless labeled living).
   - mainFloorLivingSqft, upstairsLivingSqft, garageSqft, coveredPatioSqft, coveredOutdoorSqft, roofDeckSqft when labeled.
2. Individual rooms with length×width or labeled SF on floor-plan pages.
3. Elevations / sections: use for notes (ceiling heights, materials) only — NEVER use elevations to invent floor square footage.

Rules:
1. Only report numbers you can read on the sheet. Never invent sizes. Never estimate paint, drywall, or trim from floor area.
2. If length×width are labeled (including feet-inches like 12'-0" x 10'-6"), convert to decimal feet and set areaSqft = lengthFt × widthFt.
3. Map rooms:
   - bathroom / bath / powder / M. Bath → bathroomFloorSqft (sum all baths into measurements.bathroomFloorSqft)
   - kitchen → kitchenFloorSqft
   - deck / patio / covered patio / roof deck → deckSqft
   - bedrooms, living, family, great room, dining, office, laundry, hallway → list in rooms; do NOT put a single bedroom into floorAreaSqft
4. measurements.floorAreaSqft MUST be total living area from the Building Areas table when present. Do not use one room (e.g. a bath) as floorAreaSqft.
5. measurements.flooringSqft = same as floorAreaSqft when living SF is known.
6. measurements.deckSqft = covered patio + roof deck (+ covered outdoor when no patio) from the schedule. NEVER put covered patio / roof deck into concreteSqft.
7. measurements.garageSqft = Garage Area from the schedule when labeled (not living SF).
8. measurements.concreteSqft ONLY for labeled concrete slab / driveway / sidewalk / flatwork — omit for covered patio or wood deck. Put concreteSqft in explicitlyLabeled when used.
9. wallPaintSqft, drywallSqft, exteriorPaintSqft, baseboardLf, railingLf: omit unless the plan explicitly labels that quantity. Set explicitlyLabeled to those keys only when true. Never invent them.
10. Multi-page sets: merge all floor-plan pages; ignore duplicate title-block totals; elevations do not add living SF.
11. success false only if none of the images are plans/blueprints.
12. notesBlock: contractor-readable summary including Building Areas totals and key rooms.

Schema:
{
  "success": true | false,
  "reason": "string | null",
  "buildingAreas": {
    "totalLivingSqft": 2418,
    "mainFloorLivingSqft": 1373,
    "upstairsLivingSqft": 1045,
    "garageSqft": 483,
    "coveredPatioSqft": 375,
    "coveredOutdoorSqft": 73,
    "roofDeckSqft": 331
  },
  "rooms": [
    {
      "name": "Kitchen",
      "lengthFt": 12,
      "widthFt": 10,
      "areaSqft": 120,
      "measurementKey": "kitchenFloorSqft",
      "confidence": 0.85
    }
  ],
  "measurements": {
    "kitchenFloorSqft": 120,
    "bathroomFloorSqft": 90,
    "floorAreaSqft": 2418,
    "flooringSqft": 2418,
    "deckSqft": 375,
    "garageSqft": 483
  },
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
    out.push({
      name,
      lengthFt,
      widthFt,
      areaSqft,
      measurementKey,
      confidence: Math.max(0, Math.min(1, Number(room.confidence) || 0)),
    });
  }
  return out.slice(0, 40);
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
  if (out.totalLivingSqft == null) {
    const parts = [out.mainFloorLivingSqft, out.upstairsLivingSqft].filter((v) => v != null);
    if (parts.length) {
      out.totalLivingSqft = Math.round(parts.reduce((s, v) => s + v, 0) * 10) / 10;
    }
  }
  return out;
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

function formatNotesBlock({ notesBlock, rooms, measurements, buildingAreas }) {
  if (notesBlock) return String(notesBlock).trim().slice(0, 2000);
  const lines = ['Plan takeoff (confirm measurements):'];
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
  for (const room of rooms.slice(0, 16)) {
    const dims =
      room.areaSqft != null
        ? `${room.areaSqft} sqft`
        : room.lengthFt != null && room.widthFt != null
          ? `${room.lengthFt}×${room.widthFt} ft`
          : 'size unclear';
    lines.push(`- ${room.name}: ${dims}`);
  }
  const keys = Object.keys(measurements);
  if (keys.length) {
    lines.push(`Mapped fields: ${keys.join(', ')}`);
  }
  return lines.join('\n');
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

async function ensureCompatibleImage(img) {
  const rawB64 = String(img?.base64 || '').replace(/^data:[^;]+;base64,/, '');
  return { base64: rawB64, mimeType: normalizeMime(img?.mimeType) };
}

/**
 * @param {object} params
 */
async function analyzePlanForMeasurements({
  images,
  existingNotes = '',
  templateKeyHint = null,
  projectTypeHint = null,
  openai,
  aiModels,
  aiRuntime,
}) {
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
      const err = new Error('Each image must include a base64 string');
      err.status = 400;
      throw err;
    }
    if (approxBase64Bytes(img.base64) > MAX_IMAGE_BYTES) {
      const err = new Error('Image too large — keep each plan page under 12MB');
      err.status = 413;
      throw err;
    }
  }

  const compatible = [];
  for (const img of list) {
    compatible.push(await ensureCompatibleImage(img));
  }

  const hintBits = [];
  if (templateKeyHint) hintBits.push(`template: ${templateKeyHint}`);
  if (projectTypeHint) hintBits.push(`project type: ${projectTypeHint}`);
  if (existingNotes?.trim()) {
    hintBits.push(`job notes (context only):\n${String(existingNotes).trim().slice(0, 1200)}`);
  }

  const completion = await openai.chat.completions.create({
    model: aiModels.assistant.vision,
    response_format: aiRuntime.assistant.vision.responseFormat,
    temperature: Math.min(aiRuntime.assistant.vision.temperature ?? 0.2, 0.15),
    max_tokens: Math.max(aiRuntime.assistant.vision.maxTokens || 900, 2500),
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Extract Building Areas / Area Schedule totals first, then room dimensions from these floor plan / blueprint pages.',
              'Photos of printed sheets are OK — read the title-block square footage table carefully.',
              'Do not invent paint, drywall, or trim quantities.',
              'Covered patio / roof deck → deckSqft. Garage → garageSqft. Never map patio to concrete flatwork.',
              hintBits.length ? hintBits.join('\n\n') : 'No extra context.',
            ].join('\n\n'),
          },
          ...compatible.map((img) => ({
            type: 'image_url',
            image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
          })),
        ],
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err = new Error('Vision model returned invalid JSON. Try a clearer plan image.');
    err.status = 502;
    throw err;
  }

  if (parsed?.success === false) {
    return {
      success: false,
      reason: parsed.reason || 'Image does not look like a floor plan or blueprint.',
      rooms: [],
      measurements: {},
      buildingAreas: {},
      itemQuantities: {},
      assumptions: [],
      notesBlock: '',
    };
  }

  const rooms = sanitizeRooms(parsed.rooms);
  const buildingAreas = sanitizeBuildingAreas(parsed.buildingAreas);
  const measurements = sanitizeMeasurements(
    parsed.measurements,
    rooms,
    buildingAreas,
    parsed.explicitlyLabeled
  );
  const assumptions = Array.isArray(parsed.assumptions)
    ? parsed.assumptions.map((a) => String(a).slice(0, 200)).slice(0, 8)
    : [];
  const notesBlock = formatNotesBlock({
    notesBlock: parsed.notesBlock,
    rooms,
    measurements,
    buildingAreas,
  });

  if (!Object.keys(measurements).length && !rooms.length && !Object.keys(buildingAreas).length) {
    return {
      success: false,
      reason: parsed.reason || 'No readable dimensions found on the plan.',
      rooms: [],
      measurements: {},
      buildingAreas: {},
      itemQuantities: {},
      assumptions,
      notesBlock: '',
    };
  }

  return {
    success: true,
    reason: null,
    rooms,
    measurements,
    buildingAreas,
    itemQuantities: buildItemQuantities(measurements),
    assumptions,
    notesBlock,
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
  buildItemQuantities,
  MEASUREMENT_KEYS,
  LABELED_ONLY_KEYS,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
};
