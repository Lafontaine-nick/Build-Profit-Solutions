/**
 * Plan/blueprint takeoff — GPT-4o vision extracts rooms + labeled dimensions
 * from plan images and maps them into Quick Measurement field keys.
 *
 * MVP: image pages only (client can render PDF page 1 to PNG). Not pricing.
 */

const MAX_IMAGES = 3;
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
]);

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
  return `You are a construction estimator reading architectural floor plans / blueprints.

Return ONLY valid JSON (no markdown). Extract labeled room names and dimensions that are clearly printed or dimensioned on the plan.

Rules:
1. Only report dimensions you can read or that are explicitly labeled. Never invent sizes.
2. Prefer room floor areas in square feet. If length×width are labeled, compute areaSqft = lengthFt × widthFt.
3. Map rooms into measurement keys when clear:
   - bathroom / bath / powder → bathroomFloorSqft
   - kitchen → kitchenFloorSqft
   - living / bedroom / hallway / whole floor / total → floorAreaSqft (and flooringSqft when finish floor)
   - deck / patio → deckSqft
   - garage → floorAreaSqft only if labeled
4. Also extract labeled linear dimensions for baseboardLf, cabinetLf, railingLf when shown.
5. wallPaintSqft / drywallSqft only if wall/ceiling areas are labeled — do not invent from floor area.
6. confidence 0–1 per room. Set success false only if the image is not a plan/blueprint (photo of a finished room, selfie, receipt, etc.).
7. notesBlock: short contractor-readable summary of what was read from the plan.

Schema:
{
  "success": true | false,
  "reason": "string | null",
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
    "bathroomFloorSqft": 45,
    "floorAreaSqft": 1100,
    "baseboardLf": 220
  },
  "assumptions": ["Areas taken from labeled dimensions on plan page 1"],
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
      else if (/deck|patio/.test(n)) measurementKey = 'deckSqft';
      else if (/garage/.test(n)) measurementKey = null;
      else measurementKey = 'floorAreaSqft';
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
  return out.slice(0, 24);
}

function sanitizeMeasurements(raw, rooms) {
  const out = {};
  const src = raw && typeof raw === 'object' ? raw : {};
  for (const key of MEASUREMENT_KEYS) {
    const v = positive(src[key]);
    if (v != null) out[key] = Math.round(v * 10) / 10;
  }

  // Aggregate rooms into keys when vision omitted the measurements map
  const byKey = new Map();
  for (const room of rooms) {
    if (!room.measurementKey || room.areaSqft == null || room.confidence < 0.4) continue;
    byKey.set(room.measurementKey, (byKey.get(room.measurementKey) || 0) + room.areaSqft);
  }
  for (const [key, total] of byKey) {
    if (out[key] == null) out[key] = Math.round(total * 10) / 10;
  }

  // Sum room areas into floorAreaSqft if missing
  if (out.floorAreaSqft == null) {
    const roomSum = rooms
      .filter((r) => r.areaSqft != null && r.confidence >= 0.4)
      .reduce((s, r) => s + r.areaSqft, 0);
    if (roomSum > 0) out.floorAreaSqft = Math.round(roomSum * 10) / 10;
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

function formatNotesBlock({ notesBlock, rooms, measurements }) {
  if (notesBlock) return String(notesBlock).trim().slice(0, 2000);
  const lines = ['Plan takeoff (confirm measurements):'];
  for (const room of rooms.slice(0, 12)) {
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
    temperature: Math.min(aiRuntime.assistant.vision.temperature ?? 0.2, 0.2),
    max_tokens: Math.max(aiRuntime.assistant.vision.maxTokens || 900, 1800),
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Extract rooms and labeled dimensions from this floor plan / blueprint.',
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
      itemQuantities: {},
      assumptions: [],
      notesBlock: '',
    };
  }

  const rooms = sanitizeRooms(parsed.rooms);
  const measurements = sanitizeMeasurements(parsed.measurements, rooms);
  const assumptions = Array.isArray(parsed.assumptions)
    ? parsed.assumptions.map((a) => String(a).slice(0, 200)).slice(0, 8)
    : [];
  const notesBlock = formatNotesBlock({
    notesBlock: parsed.notesBlock,
    rooms,
    measurements,
  });

  if (!Object.keys(measurements).length && !rooms.length) {
    return {
      success: false,
      reason: parsed.reason || 'No readable dimensions found on the plan.',
      rooms: [],
      measurements: {},
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
  buildItemQuantities,
  MEASUREMENT_KEYS,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
};
