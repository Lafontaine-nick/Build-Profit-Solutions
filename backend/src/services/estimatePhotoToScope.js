/**
 * Photo-to-scope: GPT-4o vision inspects site photos and returns contractor-readable
 * scope observations + checklist item detections (validated against our templates).
 *
 * Photos add context and scope detection — not measurement or pricing.
 * Vision uses the selected project catalog when the notes already establish a project type.
 */

const { CHECKLIST_TEMPLATES, checklistTemplateKey } = require('./scopeChecklistLibrary');

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const BROAD_TEMPLATE_KEYS = [
  'bathroom',
  'kitchen',
  'flooring',
  'painting',
  'drywall',
  'room_remodel',
  'addition',
  'ground_up',
  'roofing',
  'framing',
  'concrete',
  'excavation',
  'hvac',
  'landscaping',
  'deck_patio',
  'plumbing_service',
];

function normalizeMime(mimeType) {
  const m = String(mimeType || 'image/jpeg').toLowerCase();
  // OpenAI vision rejects HEIC/HEIF — convert those before labeling.
  if (m === 'image/heic' || m === 'image/heif') return 'image/jpeg';
  if (!ALLOWED_MIME.has(m)) return 'image/jpeg';
  return m === 'image/jpg' ? 'image/jpeg' : m;
}

function approxBase64Bytes(b64) {
  return Math.floor((String(b64 || '').length * 3) / 4);
}

/** HEIC/HEIF brand in the ftyp box (bytes 4–8 are 'ftyp', then brand). */
function bufferLooksLikeHeic(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  if (buf.toString('ascii', 4, 8) !== 'ftyp') return false;
  const brand = buf.toString('ascii', 8, 12);
  return /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis)$/i.test(brand);
}

/**
 * OpenAI only accepts jpeg/png/gif/webp. Convert iPhone HEIC payloads to JPEG.
 * @returns {Promise<{ base64: string, mimeType: string }>}
 */
async function ensureOpenAiCompatibleImage(img) {
  const rawB64 = String(img?.base64 || '').replace(/^data:[^;]+;base64,/, '');
  const buf = Buffer.from(rawB64, 'base64');
  const declared = String(img?.mimeType || '').toLowerCase();
  const isHeic =
    declared === 'image/heic' ||
    declared === 'image/heif' ||
    bufferLooksLikeHeic(buf);

  if (!isHeic) {
    return { base64: rawB64, mimeType: normalizeMime(img?.mimeType) };
  }

  try {
    const convert = require('heic-convert');
    const output = await convert({
      buffer: buf,
      format: 'JPEG',
      quality: 0.82,
    });
    const jpegBuf = Buffer.isBuffer(output) ? output : Buffer.from(output);
    return { base64: jpegBuf.toString('base64'), mimeType: 'image/jpeg' };
  } catch (err) {
    console.warn('HEIC→JPEG conversion failed:', err?.message || err);
    const e = new Error(
      'One of the photos is HEIC and could not be converted. Re-take it with the camera or export as JPEG and try again.'
    );
    e.status = 400;
    throw e;
  }
}

function collectAllowedItems(templateKey) {
  const catalog = [];
  const seen = new Set();
  const addFrom = (key) => {
    const t = CHECKLIST_TEMPLATES[key];
    if (!t?.items) return;
    for (const item of t.items) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      catalog.push({
        id: item.id,
        label: item.label,
        inputType: item.inputType || 'yes_no',
        options: (item.options || []).map((o) => o.id),
      });
    }
  };

  if (templateKey && CHECKLIST_TEMPLATES[templateKey]) {
    addFrom(templateKey);
    return catalog;
  }

  for (const key of BROAD_TEMPLATE_KEYS) {
    addFrom(key);
  }
  return catalog;
}

function guessTemplateKey({ existingNotes, projectTypeHint, templateKeyHint }) {
  if (templateKeyHint && CHECKLIST_TEMPLATES[templateKeyHint]) return templateKeyHint;
  const draft = {
    projectType: projectTypeHint || 'other',
    originalNotes: existingNotes || '',
  };
  try {
    return checklistTemplateKey(draft, null);
  } catch {
    return null;
  }
}

function contractorIntentNotes(notes) {
  const marker = '--- Site photos ---';
  const text = String(notes || '');
  return (text.includes(marker) ? text.slice(0, text.indexOf(marker)) : text).trim();
}

function formatCatalogForPrompt(catalog) {
  return catalog.map((c) => `${c.id} (${c.label})`).join(', ');
}

function buildSystemPrompt(catalog) {
  const idList = formatCatalogForPrompt(catalog);
  return `You are a construction estimator reviewing site photos for a residential contractor.

Return ONLY valid JSON (no markdown). Identify visible rooms, finishes, damage, and likely scope of work across ANY residential trade.

Valid photo types (always success true):
- Bathrooms, showers, tubs, vanities, toilets
- Kitchens, cabinets, counters, backsplashes
- Flooring, drywall, paint, framing, unfinished interiors
- Roofs, exteriors, decks, patios, concrete, landscaping, HVAC equipment
- Close-ups of finishes, damage, fixtures, or materials on a jobsite

How to combine photos and job notes:
- PHOTOS show current site conditions (what exists, what stage the work is at, finishes, damage).
- JOB NOTES state the contractor's INTENT (what work they plan to do).
- When notes are provided, interpret the photos in service of that intent. Example: photo shows a framed, waterproofed shower and notes say "tile the shower floor and walls" → detect tile install scope, not demo.
- If the job notes clearly establish a project type (for example, kitchen remodel), that project type is authoritative. Do not introduce a different room or trade (for example, bathroom/shower work) from an ambiguous photo.
- When notes are missing or silent about a photo, describe the visible conditions and the most likely scope, and mark uncertain items "unsure".
- If notes and photos seem to disagree (different room or trade), still return success true: report what is visible and note the mismatch in scopeText so the contractor can clarify.

Rules:
1. Never invent prices, dollar amounts, or exact measurements you cannot see.
2. Never reject or reclassify photos to force a match with notes.
3. Pick checklist itemIds supported by the photos and, when present, the stated intent. itemId MUST be one of: ${idList}
4. For choice items, choiceId must be one of that item's options when provided.
5. scopeText is contractor-readable walkthrough notes (2-8 short bullets or sentences). Start with current condition (e.g. "shower framed and insulated, floor waterproofed"), then the implied work. Mention materials/finishes/damage clearly (e.g. "tile shower walls", "existing vanity staying", "asphalt shingles with granule loss"). If photos show a FINISHED space and notes don't say what to do with it, describe the finishes without assuming demo or replacement.
6. Do NOT claim work is confirmed sold — these are observations for the contractor to confirm.
7. Set success false ONLY for clearly non-jobsite content (selfies with no room, food, memes, pure screenshots/documents, ID cards). NEVER set success false because the room/trade differs from notes, or because photos are a bathroom/kitchen/roof/etc. when notes suggested something else.
8. If unsure about an item, use state "unsure" or omit it — still return success true with whatever you can see.
9. projectTypeHint must reflect the PHOTOS (bathroom, kitchen, roofing, flooring, painting, deck_patio, room_remodel, addition, ground_up, other).
10. For bathroom/shower/tub photos, also return existingFeatures — EXISTING wet-area fixtures visible now (not planned new work). Use feature ids: tub, tile_shower_walls, tile_shower_pan, prefab_shower_pan, prefab_shower_enclosure, shower_door. Omit features you cannot see.

Schema:
{
  "success": true | false,
  "reason": "string | null",
  "projectTypeHint": "bathroom|kitchen|flooring|painting|roofing|deck_patio|room_remodel|addition|ground_up|hvac|landscaping|concrete|other|null",
  "scopeText": "string",
  "detections": [
    {
      "itemId": "checklist id from the allowed list",
      "state": "included|excluded|unsure",
      "choiceId": "string | null",
      "confidence": 0-1,
      "evidence": "what was visible in the photo"
    }
  ],
  "existingFeatures": [
    {
      "feature": "tub|tile_shower_walls|tile_shower_pan|prefab_shower_pan|prefab_shower_enclosure|shower_door",
      "confidence": 0-1,
      "evidence": "what was visible in the photo"
    }
  ]
}`;
}

/**
 * Model sometimes rejects valid jobsite photos when notes biased it toward another trade.
 * Those rejections should be recovered, not shown to the contractor.
 */
function isSpuriousTradeMismatchRejection(reason) {
  const r = String(reason || '').toLowerCase();
  if (!r) return false;
  if (/\b(selfie|food|meal|meme|screenshot|id card|passport|receipt only|invoice only)\b/.test(r)) {
    return false;
  }
  return (
    /\bnot a\b[\s\S]{0,40}\bcontext\b/.test(r) ||
    /\b(?:roofing|kitchen|bathroom|flooring|painting|deck|hvac)\s+context\b/.test(r) ||
    /\bdoes(?:\s+not|n't)\s+match\b/.test(r) ||
    /\bwrong\s+(?:trade|project|context|type|scope)\b/.test(r) ||
    /\binstead of\b/.test(r) ||
    /\bexpected\b[\s\S]{0,40}\b(?:roof|kitchen|bath|floor|paint|deck)\b/.test(r) ||
    /\b(?:photos?|images?)\s+(?:are|depict|show)\b[\s\S]{0,60}\bnot\b/.test(r) ||
    /\bmismatch\b/.test(r)
  );
}

function sanitizeDetections(rawDetections, catalog) {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const out = [];
  const seen = new Set();
  for (const d of Array.isArray(rawDetections) ? rawDetections : []) {
    const itemId = String(d?.itemId || '').trim();
    if (!itemId || !byId.has(itemId) || seen.has(itemId)) continue;
    const meta = byId.get(itemId);
    let state = String(d?.state || 'unsure').toLowerCase();
    if (!['included', 'excluded', 'unsure'].includes(state)) state = 'unsure';
    let choiceId = d?.choiceId != null ? String(d.choiceId).trim() : null;
    if (choiceId && meta.options?.length && !meta.options.includes(choiceId)) {
      choiceId = null;
    }
    const confidence = Math.max(0, Math.min(1, Number(d?.confidence) || 0));
    const evidence = String(d?.evidence || '').trim().slice(0, 240);
    seen.add(itemId);
    out.push({
      itemId,
      label: meta.label,
      state,
      choiceId,
      confidence,
      evidence: evidence || null,
    });
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 24);
}

const EXISTING_WET_AREA_FEATURES = new Set([
  'tub',
  'tile_shower_walls',
  'tile_shower_pan',
  'prefab_shower_pan',
  'prefab_shower_enclosure',
  'shower_door',
]);

function sanitizeExistingFeatures(rawFeatures) {
  const out = [];
  const seen = new Set();
  for (const row of Array.isArray(rawFeatures) ? rawFeatures : []) {
    const feature = String(row?.feature || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (!EXISTING_WET_AREA_FEATURES.has(feature) || seen.has(feature)) continue;
    seen.add(feature);
    out.push({
      feature,
      confidence: Math.max(0, Math.min(1, Number(row?.confidence) || 0)),
      evidence: String(row?.evidence || '').trim().slice(0, 240) || null,
    });
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

function formatScopeNotesFromVision({ scopeText, detections }) {
  const lines = [];
  const prose = String(scopeText || '').trim();
  if (prose) lines.push(prose);

  const included = detections.filter((d) => d.state === 'included' && d.confidence >= 0.45);
  if (included.length) {
    lines.push('');
    lines.push('Detected from site photos (confirm on next step):');
    for (const d of included.slice(0, 12)) {
      const bit = d.evidence ? ` — ${d.evidence}` : '';
      lines.push(`- ${d.label}${bit}`);
    }
  }
  return lines.join('\n').trim();
}

function resolveTemplateKey(visionType, fallback) {
  if (visionType && CHECKLIST_TEMPLATES[visionType]) return visionType;
  return fallback || null;
}

/**
 * If the model said success:false but still returned usable observations, keep them.
 * Also recover spurious "wrong trade context" rejections when any content exists.
 */
function normalizeVisionParsed(parsed, catalog, templateKeyFallback) {
  const detections = sanitizeDetections(parsed?.detections, catalog);
  const existingFeatures = sanitizeExistingFeatures(parsed?.existingFeatures);
  const scopeText = String(parsed?.scopeText || '').trim().slice(0, 4000);
  const visionType = parsed?.projectTypeHint ? String(parsed.projectTypeHint).slice(0, 40) : null;
  const reason = parsed?.reason != null ? String(parsed.reason).slice(0, 300) : null;
  const hasContent = Boolean(scopeText) || detections.length > 0;
  const explicitFail = parsed?.success === false;
  const spurious = explicitFail && isSpuriousTradeMismatchRejection(reason);

  if (explicitFail && !hasContent && !spurious) {
    return {
      success: false,
      reason: reason || 'Photos do not look like a jobsite.',
      scopeText: '',
      notesBlock: '',
      detections: [],
      existingFeatures: [],
      templateKey: templateKeyFallback,
      projectTypeHint: null,
      shouldRetryWithoutNotes: isSpuriousTradeMismatchRejection(reason),
    };
  }

  // Spurious fail with no content → ask caller to retry without notes bias
  if (explicitFail && !hasContent && spurious) {
    return {
      success: false,
      reason: reason || 'Photos do not look like a jobsite.',
      scopeText: '',
      notesBlock: '',
      detections: [],
      existingFeatures: [],
      templateKey: templateKeyFallback,
      projectTypeHint: null,
      shouldRetryWithoutNotes: true,
    };
  }

  // success true, or fail-but-salvageable / spurious-with-content
  const notesBlock = formatScopeNotesFromVision({ scopeText, detections });
  if (!notesBlock) {
    return {
      success: false,
      reason: reason || 'Nothing useful was detected in the photos.',
      scopeText: '',
      notesBlock: '',
      detections: [],
      existingFeatures: [],
      templateKey: templateKeyFallback,
      projectTypeHint: null,
      shouldRetryWithoutNotes: spurious,
    };
  }

  return {
    success: true,
    reason: null,
    scopeText,
    notesBlock,
    detections,
    existingFeatures,
    // An explicit draft/template context is stronger than a model guess from
    // an ambiguous photo. Otherwise a kitchen photo can incorrectly switch
    // the entire confirm step to bathroom scope.
    templateKey: templateKeyFallback || resolveTemplateKey(visionType, null),
    projectTypeHint: templateKeyFallback || visionType,
    shouldRetryWithoutNotes: false,
  };
}

function buildUserContent({ images, existingNotes, includeNotes }) {
  const parts = [
    'Analyze these site photos for construction scope. Report what you see. Do not reject valid jobsite rooms or exteriors.',
  ];
  if (includeNotes && existingNotes?.trim()) {
    parts.push(
      `Job notes describing the intended work (interpret the photos in service of this intent; if they conflict with the photos, report what is visible and flag the mismatch):\n${String(existingNotes).trim().slice(0, 2000)}`
    );
  } else {
    parts.push(
      'No job notes were provided. Describe visible conditions and likely scope; mark uncertain items "unsure".'
    );
  }
  return [
    { type: 'text', text: parts.join('\n\n') },
    ...images.map((img) => ({
      type: 'image_url',
      image_url: {
        url: `data:${normalizeMime(img.mimeType)};base64,${img.base64}`,
      },
    })),
  ];
}

async function runVisionPass({
  openai,
  aiModels,
  aiRuntime,
  catalog,
  systemPrompt,
  images,
  existingNotes,
  includeNotes,
}) {
  const completion = await openai.chat.completions.create({
    model: aiModels.assistant.vision,
    response_format: aiRuntime.assistant.vision.responseFormat,
    temperature: aiRuntime.assistant.vision.temperature,
    max_tokens: Math.max(aiRuntime.assistant.vision.maxTokens || 900, 1600),
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: buildUserContent({ images, existingNotes, includeNotes }),
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error('Vision model returned invalid JSON. Try clearer photos.');
    err.status = 502;
    throw err;
  }
}

/**
 * @param {object} params
 * @param {Array<{ base64: string, mimeType?: string }>} params.images
 * @param {string} [params.existingNotes]
 * @param {string} [params.projectTypeHint]
 * @param {string} [params.templateKeyHint]
 * @param {object} params.openai
 * @param {object} params.aiModels
 * @param {object} params.aiRuntime
 */
async function analyzeSitePhotosForScope({
  images,
  existingNotes = '',
  projectTypeHint = null,
  templateKeyHint = null,
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
    const err = new Error('At least one image is required');
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
      const err = new Error('Image too large — keep each photo under 10MB');
      err.status = 413;
      throw err;
    }
  }

  // Convert HEIC (common from iPhone) to JPEG before calling OpenAI vision.
  const compatibleImages = [];
  for (const img of list) {
    compatibleImages.push(await ensureOpenAiCompatibleImage(img));
  }

  // Never feed a prior generated photo block back into classification. It is
  // model output, not contractor intent, and can make one hallucination
  // reinforce itself on every regeneration.
  const intentNotes = contractorIntentNotes(existingNotes);
  const templateKeyFallback = guessTemplateKey({
    existingNotes: intentNotes,
    projectTypeHint,
    templateKeyHint,
  });
  // Once notes/project context establishes a template, do not let vision
  // hallucinations from another room introduce incompatible scope items.
  const catalog = collectAllowedItems(templateKeyFallback);
  const systemPrompt = buildSystemPrompt(catalog);

  const firstParsed = await runVisionPass({
    openai,
    aiModels,
    aiRuntime,
    catalog,
    systemPrompt,
    images: compatibleImages,
    existingNotes: intentNotes,
    includeNotes: true,
  });
  let normalized = normalizeVisionParsed(firstParsed, catalog, templateKeyFallback);

  // Notes sometimes bias the model into a false "wrong trade" rejection — retry photos only.
  if (!normalized.success && normalized.shouldRetryWithoutNotes && intentNotes) {
    const retryParsed = await runVisionPass({
      openai,
      aiModels,
      aiRuntime,
      catalog,
      systemPrompt,
      images: compatibleImages,
      existingNotes: '',
      includeNotes: false,
    });
    const retryNormalized = normalizeVisionParsed(retryParsed, catalog, templateKeyFallback);
    if (retryNormalized.success) {
      normalized = retryNormalized;
    }
  }

  return {
    success: normalized.success,
    reason: normalized.reason,
    scopeText: normalized.scopeText,
    notesBlock: normalized.notesBlock,
    detections: normalized.detections,
    existingFeatures: normalized.existingFeatures,
    templateKey: normalized.templateKey,
    projectTypeHint: normalized.projectTypeHint,
  };
}

/**
 * Merge photo notes into existing job notes (idempotent-ish: replaces prior photo block).
 */
function mergePhotoNotesIntoJobNotes(existingNotes, notesBlock) {
  const block = String(notesBlock || '').trim();
  if (!block) return String(existingNotes || '').trim();

  const marker = '--- Site photos ---';
  const existing = String(existingNotes || '');
  const withoutOld = existing.includes(marker)
    ? existing.slice(0, existing.indexOf(marker)).trimEnd()
    : existing.trimEnd();

  return [withoutOld, '', marker, block].filter((p, i) => (i === 0 ? true : p !== '')).join('\n').trim();
}

module.exports = {
  analyzeSitePhotosForScope,
  mergePhotoNotesIntoJobNotes,
  formatScopeNotesFromVision,
  sanitizeDetections,
  sanitizeExistingFeatures,
  collectAllowedItems,
  isSpuriousTradeMismatchRejection,
  normalizeVisionParsed,
  guessTemplateKey,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
};
