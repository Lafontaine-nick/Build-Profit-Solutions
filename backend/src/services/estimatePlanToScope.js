/**
 * Plan → draft scope: GPT-4o reads plan pages (floor plans, elevations, finish
 * schedules) and proposes scope checklist detections the contractor can confirm.
 *
 * Complements estimatePlanToMeasurements (quantities / SF). Contract:
 * - Read SF on the takeoff pass; this pass owns necessary scope for the job type.
 * - Ground-up full plan sets → majority of build checklist (contractor unchecks).
 * - Bath / kitchen / trade plans → typical package for that job, not a whole house.
 * - Soft costs (contingency, OH&P) never auto-included from plans alone.
 * - Never invent measurements or prices.
 *
 * Detections must use the ACTIVE checklist template's item ids
 * (e.g. ground_up uses `exterior` / `mep_rough` / `paint_trim`).
 */

const {
  collectAllowedItems,
  sanitizeDetections,
  guessTemplateKey,
} = require('./estimatePhotoToScope');
const { CHECKLIST_TEMPLATES } = require('./scopeChecklistLibrary');

/**
 * Map common cross-template ids onto the active checklist when the model (or an
 * older broad catalog) returns a sibling id that means the same trade.
 */
const PLAN_SCOPE_ID_ALIASES = {
  exterior_finishes: ['exterior', 'exterior_finishes'],
  exterior: ['exterior', 'exterior_finishes'],
  roof_tie_in: ['roofing', 'roof_tie_in', 'shingles_roofing'],
  roofing: ['roofing', 'roof_tie_in', 'shingles_roofing'],
  framing_structure: ['framing', 'framing_structure', 'wall_framing'],
  framing: ['framing', 'framing_structure'],
  // room_remodel / addition sibling ids → ground_up
  electrical: ['mep_rough', 'electrical', 'electrical_rough'],
  plumbing: ['mep_rough', 'plumbing', 'plumbing_rough'],
  electrical_rough: ['mep_rough', 'electrical_rough', 'electrical'],
  plumbing_rough: ['mep_rough', 'plumbing_rough', 'plumbing'],
  hvac: ['mep_rough', 'hvac'],
  mep_rough: ['mep_rough', 'electrical_rough', 'plumbing_rough', 'hvac', 'electrical', 'plumbing'],
  paint: ['paint_trim', 'paint', 'exterior_paint'],
  paint_trim: ['paint_trim', 'paint', 'interior_trim', 'trim'],
  interior_trim: ['paint_trim', 'interior_trim', 'trim'],
  trim: ['paint_trim', 'trim', 'interior_trim'],
  flooring: ['tile_flooring', 'flooring'],
  tile: ['tile_flooring', 'tile', 'flooring'],
  tile_flooring: ['tile_flooring', 'flooring', 'tile'],
  site_prep: ['sitework', 'site_prep', 'excavation'],
  sitework: ['sitework', 'site_prep', 'excavation'],
  excavation: ['sitework', 'excavation'],
  grading: ['sitework', 'grading'],
  cabinets: ['cabinets_counters', 'cabinets'],
  countertops: ['cabinets_counters', 'countertops'],
  cabinets_counters: ['cabinets_counters', 'cabinets', 'countertops'],
  windows_doors: ['windows_doors', 'exterior'],
  concrete: ['foundation', 'concrete'],
  pour_foundation: ['foundation', 'pour_foundation'],
  // Remodel-only "demo existing" has no ground_up equivalent — drop on remap.
  demo: [],
};

/** Never auto-include from plans — business/soft costs, not sheet callouts. */
const SOFT_COST_IDS = new Set([
  'contingency',
  'overhead_profit',
  'plans_engineering',
  'permits',
]);

/**
 * Core build package for a full residential architectural set (ground-up).
 * Filled when the model under-proposes; contractor unchecks what's not in their bid.
 */
const GROUND_UP_CORE_IDS = [
  'sitework',
  'foundation',
  'framing',
  'roofing',
  'exterior',
  'mep_rough',
  'insulation',
  'drywall',
  'cabinets_counters',
  'tile_flooring',
  'paint_trim',
  'appliances',
  'cleanup',
];

/** Typical bath remodel package when sheets show a bathroom layout. */
const BATHROOM_CORE_IDS = [
  'demo',
  'floor_demo',
  'waterproofing',
  'shower_tile',
  'floor_tile',
  'plumbing_rough',
  'electrical_rough',
  'drywall',
  'paint',
  'cleanup',
];

/** Typical kitchen remodel package when sheets show a kitchen layout. */
const KITCHEN_CORE_IDS = [
  'demo',
  'cabinets',
  'countertops',
  'sink_faucet',
  'backsplash',
  'flooring',
  'plumbing',
  'electrical',
  'paint',
  'cleanup',
];

const TEMPLATE_CORE_IDS = {
  ground_up: GROUND_UP_CORE_IDS,
  bathroom: BATHROOM_CORE_IDS,
  kitchen: KITCHEN_CORE_IDS,
};

const INFERRED_JOB_TYPES = new Set([
  'ground_up',
  'addition',
  'bathroom',
  'kitchen',
  'flooring',
  'roofing',
  'deck_patio',
  'hvac',
  'landscaping',
  'concrete',
  'room_remodel',
  'other',
]);

function remapDetectionToTemplate(detection, allowedIds) {
  if (!detection?.itemId) return null;
  if (allowedIds.has(detection.itemId)) return detection;
  const aliases = PLAN_SCOPE_ID_ALIASES[detection.itemId] || [];
  for (const alt of aliases) {
    if (allowedIds.has(alt)) {
      return { ...detection, itemId: alt };
    }
  }
  return null;
}

function templateScopeGuidance(templateKey) {
  switch (templateKey) {
    case 'ground_up':
      return [
        'JOB TYPE: GROUND-UP / NEW CONSTRUCTION (building a house from plans — NOT a remodel).',
        'Architectural plan sets (cover sheet, floor plans, elevations, foundation, framing, MEP, schedules) = new build.',
        'Propose the MAJORITY of build checklist items as "included": sitework, foundation, framing, roofing, exterior, mep_rough, insulation, drywall, cabinets_counters, tile_flooring, paint_trim, appliances (if kitchen shown), cleanup.',
        'scopeText and evidence must say NEW CONSTRUCTION / ground-up build — NEVER "remodel", "updates to existing", "demo existing", or "layout changes to existing spaces".',
        'Do NOT propose remodel-only items (selective tear-out of existing finishes). There is no existing house to remodel.',
        'Do NOT include contingency, overhead_profit, plans_engineering, or permits unless notes say the GC carries them.',
      ].join('\n');
    case 'addition':
      return [
        'JOB TYPE: addition / expansion onto an existing structure.',
        'Propose structural + finishes the addition sheets support (foundation/framing/roof tie-in/exterior/MEP/insulation/drywall/finishes as shown).',
        'Do not invent whole-house remodel trades for rooms not on the addition sheets.',
      ].join('\n');
    case 'bathroom':
      return [
        'JOB TYPE: bathroom remodel (or bath-focused sheets).',
        'Propose the typical bath package the layout supports: demo, wet area / waterproofing / tile, floor tile, fixtures (toilet/vanity), plumbing + electrical rough, drywall, paint, cleanup.',
        'Mark fixture choice items when the plan shows tub vs shower clearly; otherwise omit choice items or use unsure.',
        'Do not propose ground-up house trades (foundation, roofing, sitework).',
      ].join('\n');
    case 'kitchen':
      return [
        'JOB TYPE: kitchen remodel (or kitchen layout sheets).',
        'Propose the typical kitchen package: demo, cabinets, counters, sink/faucet, backsplash, flooring, plumbing, electrical, lighting, paint, cleanup — when the plan shows those elements.',
        'Island only if drawn. Wall layout changes only if walls are marked to move/remove.',
        'Do not propose ground-up house trades.',
      ].join('\n');
    case 'flooring':
      return 'JOB TYPE: flooring. Propose floor demo/install/prep/trim/cleanup only as the sheets support. Skip unrelated trades.';
    case 'roofing':
      return 'JOB TYPE: roofing. Propose tear-off/shingles/gutters only as elevations or roof plans support.';
    case 'deck_patio':
      return 'JOB TYPE: deck/patio. Propose decking/railings/related flatwork only as shown.';
    default:
      return [
        'FIRST classify the sheets: full residential architectural plan set (lot, foundation, floor plans, elevations, framing, MEP) = ground_up NEW CONSTRUCTION — not a remodel.',
        'Single-room bath/kitchen remodel sheets → bathroom/kitchen. Trade sheets → that trade only.',
        'If ground_up: never use remodel/demo-existing language; propose the full new-build package.',
      ].join('\n');
  }
}

/**
 * Plan import must NOT inherit the notes-draft default of room_remodel when
 * Job notes are empty — that mislabels full house architectural sets as remotes.
 */
function guessPlanScopeTemplateKey({ existingNotes, projectTypeHint, templateKeyHint }) {
  if (templateKeyHint && CHECKLIST_TEMPLATES[templateKeyHint]) return templateKeyHint;
  if (projectTypeHint && CHECKLIST_TEMPLATES[projectTypeHint]) {
    return projectTypeHint === 'other' ? null : projectTypeHint;
  }

  const notes = String(existingNotes || '').trim();
  if (!notes) return null;

  if (/\b(ground[\s-]?up|new\s+build|new\s+construction|new\s+home|new\s+house)\b/i.test(notes)) {
    return 'ground_up';
  }

  const guessed = guessTemplateKey({
    existingNotes: notes,
    projectTypeHint,
    templateKeyHint: null,
  });

  // Library defaults unknown jobs to room_remodel — only keep that when notes
  // clearly say remodel/renovation (not when notes are just SF/takeoff text).
  if (guessed === 'room_remodel') {
    const remodelIntent = /\b(remodel|renovation|renovate|interior\s+update|selective\s+demo|tear[\s-]?out)\b/i.test(
      notes
    );
    if (!remodelIntent) return null;
  }

  return guessed;
}

/**
 * Pick the checklist to apply detections onto. Vision inferredJobType wins over
 * a weak room_remodel default; architectural new-build language forces ground_up.
 */
function resolveEffectivePlanTemplate({ fallbackTemplate, inferredJobType, scopeText, detections }) {
  const inferred = sanitizeInferredJobType(inferredJobType);
  const text = `${scopeText || ''} ${(detections || []).map((d) => `${d.evidence || ''} ${d.itemId || ''}`).join(' ')}`.toLowerCase();

  const architecturalSheetSignals =
    /\b(foundation\s+plan|framing\s+plan|electrical\s+plan|plumbing\s+plan|building\s+areas?|title\s+block|elevations?|architectural\s+plan|floor\s+plan)\b/i.test(
      text
    );

  const looksNewBuild =
    inferred === 'ground_up' ||
    /\b(ground[\s-]?up|new\s+construction|new\s+build|new\s+home|new\s+house)\b/i.test(text) ||
    (architecturalSheetSignals &&
      !/\b(bath(?:room)?\s+only|kitchen\s+only|single[\s-]room\s+remodel)\b/i.test(text));

  const remodelItemHits = (detections || []).filter((d) =>
    ['demo', 'trim', 'electrical', 'plumbing', 'paint', 'flooring'].includes(String(d.itemId || ''))
  ).length;
  const structuralHits = (detections || []).filter((d) =>
    ['foundation', 'framing', 'roofing', 'sitework', 'exterior', 'mep_rough'].includes(String(d.itemId || ''))
  ).length;

  // Full house plan sets often get mislabeled "remodel" by the model — upgrade.
  if (looksNewBuild || structuralHits >= 2 || (architecturalSheetSignals && remodelItemHits >= 3)) {
    return 'ground_up';
  }

  // Multi-trade remodel checklist hits with no bath/kitchen-only signal → treat as
  // misclassified architectural set (common when Job notes were empty).
  if (
    remodelItemHits >= 3 &&
    (!fallbackTemplate || fallbackTemplate === 'room_remodel') &&
    inferred !== 'bathroom' &&
    inferred !== 'kitchen'
  ) {
    return 'ground_up';
  }

  if (inferred === 'bathroom' || inferred === 'kitchen') return inferred;
  if (inferred && CHECKLIST_TEMPLATES[inferred] && inferred !== 'other' && inferred !== 'room_remodel') {
    return inferred;
  }
  if (fallbackTemplate && fallbackTemplate !== 'room_remodel') return fallbackTemplate;

  if (
    inferred === 'room_remodel' ||
    (/\b(remodel|updates?\s+to\s+existing|existing\s+spaces?)\b/i.test(text) && !architecturalSheetSignals)
  ) {
    return 'room_remodel';
  }

  return fallbackTemplate || null;
}

function buildScopeSystemPrompt(catalog, templateKey) {
  const idList = catalog.map((c) => `${c.id} (${c.label})`).join(', ');
  const templateHint = templateKey
    ? `This job uses the "${templateKey}" checklist — only propose itemIds from that list.`
    : 'Only propose itemIds from the allowed list. Set inferredJobType from the sheets (ground_up for full house architectural sets).';
  return `You are a construction estimator reading architectural or trade plan sheets for a residential contractor.

Your job: propose the SCOPE OF WORK that belongs with these plans for this job type — not a thin subset of structural sheets, and not invented trades.

CRITICAL: A full residential architectural plan PDF (lot/cover, floor plans, elevations, foundation, framing, electrical/plumbing) is GROUND-UP NEW CONSTRUCTION. Do not classify it as an interior remodel. Do not write "remodeling", "updates to existing", or "demo existing spaces".

Return ONLY valid JSON (no markdown). Never invent measurements, quantities, or prices (SF is handled on a separate takeoff pass).

${templateScopeGuidance(templateKey)}

How to read the sheets:
- Floor plans: rooms and fixtures imply build-out / remodel scope for that job type.
- Elevations: exterior finishes, roofing, openings.
- Finish schedules / notes: flooring, paint, tile, trim, appliances, fixtures.
- Job notes state contractor intent — focus detections on what they are bidding.

Rules:
1. Propose necessary scope for the job + what the sheets support. Prefer a complete package over 3–4 thin trades when the plan set clearly is that job.
2. Never invent trades with zero sheet support (e.g. landscaping on a bath floor plan).
3. ${templateHint} itemId MUST be one of: ${idList}
4. For choice items, choiceId must be one of that item's options when provided; omit the item if you cannot choose.
5. state "included" when the job type + sheets make that work expected; "unsure" when ambiguous; "excluded" only if sheets/notes explicitly exclude it.
6. confidence 0-1 = how clearly job type + sheets support the detection (0.7+ for standard package items on a clear plan set).
7. evidence = short reason (sheet callout OR "standard for ground-up new construction") — never remodel wording on new builds.
8. scopeText: 2-8 short contractor-readable bullets of the scope package (trades + key rooms/finishes) — not just SF. For ground-up say "new construction" / "ground-up build".
9. inferredJobType: one of ground_up|addition|bathroom|kitchen|flooring|roofing|deck_patio|hvac|landscaping|concrete|room_remodel|other — use ground_up for full house plan sets.
10. success false only if pages are not construction plans / too illegible — set reason.

Schema:
{
  "success": true | false,
  "reason": "string | null",
  "inferredJobType": "ground_up|addition|bathroom|kitchen|flooring|roofing|deck_patio|hvac|landscaping|concrete|room_remodel|other",
  "scopeText": "string",
  "detections": [
    {
      "itemId": "checklist id from the allowed list",
      "state": "included|excluded|unsure",
      "choiceId": "string | null",
      "confidence": 0-1,
      "evidence": "what on the plan or job type supports this"
    }
  ]
}`;
}

/**
 * Prefer the job's checklist template so detections apply cleanly on Confirm Scope.
 * Fall back to the broad catalog only when we cannot resolve a template.
 */
function resolvePlanScopeCatalog(templateKey) {
  if (templateKey && CHECKLIST_TEMPLATES[templateKey]) {
    return { catalog: collectAllowedItems(templateKey), templateKey };
  }
  return { catalog: collectAllowedItems(null), templateKey: null };
}

function sanitizeInferredJobType(value) {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (key === 'new_build' || key === 'new_construction' || key === 'house') return 'ground_up';
  if (INFERRED_JOB_TYPES.has(key)) return key;
  return null;
}

/**
 * When the model under-proposes for a known job package, fill missing core
 * yes/no items so Confirm Scope starts closer to a complete bid checklist.
 * Soft costs and choice/multi items are never auto-filled.
 */
function ensureCoreDetections(detections, catalog, templateKey) {
  const coreIds = TEMPLATE_CORE_IDS[templateKey];
  if (!coreIds?.length || !Array.isArray(catalog)) return detections || [];

  const allowed = new Set(catalog.map((c) => c.id));
  const byId = new Map();
  for (const d of detections || []) {
    if (d?.itemId) byId.set(d.itemId, d);
  }

  const evidenceByTemplate = {
    ground_up: 'Standard ground-up scope for a full residential plan set — confirm what is in your bid',
    bathroom: 'Typical bathroom remodel package for bath layout sheets — confirm what is in your bid',
    kitchen: 'Typical kitchen remodel package for kitchen layout sheets — confirm what is in your bid',
  };
  const evidence = evidenceByTemplate[templateKey] || 'Typical scope for this plan job type — confirm';

  for (const id of coreIds) {
    if (!allowed.has(id) || SOFT_COST_IDS.has(id) || byId.has(id)) continue;
    const meta = catalog.find((c) => c.id === id);
    if (!meta || meta.inputType === 'choice' || meta.inputType === 'multi_choice') continue;
    byId.set(id, {
      itemId: id,
      label: meta.label,
      state: 'included',
      choiceId: null,
      confidence: 0.72,
      evidence,
    });
  }

  // Drop any soft-cost detections the model may have included without notes.
  for (const softId of SOFT_COST_IDS) {
    const existing = byId.get(softId);
    if (existing && existing.state === 'included' && !(existing.confidence >= 0.95)) {
      byId.delete(softId);
    }
  }

  return Array.from(byId.values());
}

function finalizeDetections(rawDetections, catalog, templateKey) {
  const allowedIds = new Set(catalog.map((c) => c.id));
  const detections = [];
  const seen = new Set();
  for (const d of rawDetections || []) {
    const remapped = remapDetectionToTemplate(d, allowedIds);
    if (!remapped || seen.has(remapped.itemId)) continue;
    if (SOFT_COST_IDS.has(remapped.itemId) && remapped.state === 'included') {
      // Soft costs stay out unless we later add an explicit notes path.
      continue;
    }
    seen.add(remapped.itemId);
    const meta = catalog.find((c) => c.id === remapped.itemId);
    detections.push({
      ...remapped,
      label: meta?.label || remapped.label,
    });
  }
  return ensureCoreDetections(detections, catalog, templateKey);
}

/**
 * Append scope package bullets under the SF takeoff notes for Job notes.
 */
function appendScopeTextToNotesBlock(notesBlock, scopeText) {
  const base = String(notesBlock || '').trim();
  const scope = String(scopeText || '').trim();
  if (!scope) return base;
  if (!base) return scope.slice(0, 2500);
  if (base.includes(scope.slice(0, 40))) return base;
  return `${base}\n\nSuggested scope from plans:\n${scope}`.slice(0, 3500);
}

/**
 * @param {object} params
 * @param {Array<{ mimeType: string, base64: string, filename?: string }>} params.pages
 *   Pre-validated vision content pages (from estimatePlanToMeasurements pipeline).
 * @param {Function} params.toVisionContentPart page → OpenAI content part
 */
async function analyzePlanForScope({
  pages,
  toVisionContentPart,
  existingNotes = '',
  templateKeyHint = null,
  projectTypeHint = null,
  openai,
  aiModels,
  aiRuntime,
}) {
  const templateKeyFallback = guessPlanScopeTemplateKey({
    existingNotes,
    projectTypeHint,
    templateKeyHint,
  });
  let { catalog, templateKey } = resolvePlanScopeCatalog(templateKeyFallback);

  const userBits = [
    'Read these plan sheets and propose the full necessary scope package for this job as checklist detections.',
    templateKey
      ? `Active checklist: "${templateKey}". Propose a complete package for that job type — not a thin subset.`
      : 'No checklist hint — if this is a full house architectural plan set, inferredJobType MUST be ground_up (new construction), not room_remodel.',
    'Uncertain line items may be "unsure". Soft costs (contingency, overhead) stay out unless notes say the GC carries them.',
  ];
  if (existingNotes?.trim()) {
    userBits.push(
      `Contractor job notes (intent — focus detections accordingly):\n${String(existingNotes).trim().slice(0, 1500)}`
    );
  }

  const completion = await openai.chat.completions.create({
    model: aiModels.assistant.vision,
    response_format: aiRuntime.assistant.vision.responseFormat,
    temperature: Math.min(aiRuntime.assistant.vision.temperature ?? 0.2, 0.15),
    max_tokens: Math.max(aiRuntime.assistant.vision.maxTokens || 900, 2200),
    messages: [
      { role: 'system', content: buildScopeSystemPrompt(catalog, templateKey) },
      {
        role: 'user',
        content: [
          { type: 'text', text: userBits.join('\n\n') },
          ...pages.map(toVisionContentPart),
        ],
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, reason: 'Scope pass returned invalid JSON.', scopeText: '', detections: [] };
  }

  const inferredJobType = sanitizeInferredJobType(parsed?.inferredJobType);
  const scopeText = String(parsed?.scopeText || '').trim().slice(0, 3000);
  const preliminaryDetections = Array.isArray(parsed?.detections) ? parsed.detections : [];

  const effectiveTemplate = resolveEffectivePlanTemplate({
    fallbackTemplate: templateKey,
    inferredJobType,
    scopeText,
    detections: preliminaryDetections,
  });

  if (effectiveTemplate && effectiveTemplate !== templateKey) {
    const resolved = resolvePlanScopeCatalog(effectiveTemplate);
    catalog = resolved.catalog;
    templateKey = resolved.templateKey;
  }

  // Remap remodel/addition sibling ids onto the effective catalog BEFORE sanitize
  // (sanitize drops unknown ids — electrical/plumbing would vanish on ground_up).
  const allowedIds = new Set(catalog.map((c) => c.id));
  const remappedRaw = [];
  for (const d of preliminaryDetections) {
    const remapped = remapDetectionToTemplate(d, allowedIds);
    if (!remapped) continue;
    remappedRaw.push({ ...d, itemId: remapped.itemId });
  }

  const rawDetections = sanitizeDetections(remappedRaw, catalog);
  const detections = finalizeDetections(rawDetections, catalog, templateKey);

  // Prefer new-construction wording in notes when we corrected to ground_up.
  let finalScopeText = scopeText;
  if (templateKey === 'ground_up' && /\bremodel/i.test(finalScopeText)) {
    finalScopeText = finalScopeText
      .replace(/\b[Rr]emodeling\b/g, 'New construction of')
      .replace(/\b[Rr]emodel\b/g, 'new construction')
      .replace(/\bupdates to existing\b/gi, 'build-out of')
      .replace(/\bexisting spaces\b/gi, 'rooms');
  }
  if (templateKey === 'ground_up' && !finalScopeText) {
    finalScopeText =
      'Ground-up new construction from architectural plans — sitework through finishes (confirm what is in your bid).';
  }

  if (parsed?.success === false || (!detections.length && !finalScopeText)) {
    return {
      success: false,
      reason: parsed?.reason || 'No scope could be read from the plans.',
      scopeText: '',
      detections: [],
      inferredJobType: inferredJobType || effectiveTemplate,
    };
  }

  return {
    success: true,
    reason: null,
    scopeText: finalScopeText,
    detections,
    inferredJobType: inferredJobType || templateKey,
    templateKeyFallback: templateKey || templateKeyFallback,
  };
}

module.exports = {
  analyzePlanForScope,
  remapDetectionToTemplate,
  PLAN_SCOPE_ID_ALIASES,
  resolvePlanScopeCatalog,
  ensureCoreDetections,
  finalizeDetections,
  appendScopeTextToNotesBlock,
  guessPlanScopeTemplateKey,
  resolveEffectivePlanTemplate,
  GROUND_UP_CORE_IDS,
  BATHROOM_CORE_IDS,
  KITCHEN_CORE_IDS,
  SOFT_COST_IDS,
};
