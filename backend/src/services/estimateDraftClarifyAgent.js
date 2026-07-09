/**
 * Agentic clarify loop for estimate drafts.
 *
 * A second LLM pass inspects the enriched draft (not the raw notes) and asks
 * a handful of job-specific questions. Contractor answers come back as free
 * text; another LLM pass converts them into a structured patch, and
 * deterministic code validates and applies that patch before re-enriching.
 *
 * The LLM only ever proposes. Deterministic code decides what is applied:
 * measurement keys are whitelisted, package names must match existing rooms,
 * and prices must be explicit positive numbers.
 *
 * Falls back to the static rule-based questions (estimateDraftClarify) when
 * no OpenAI client is available or the model call fails.
 */

const { enrichDraft } = require('./estimateDraftEnrichment');
const { applyScopeMeasurements } = require('./estimateDraftComplexity');
const { buildClarifyQuestions } = require('./estimateDraftClarify');

/** Top-level measurement keys accepted from LLM patches (mirrors applyScopeMeasurements). */
const MEASUREMENT_KEY_WHITELIST = new Set([
  'bathroomFloorSqft',
  'kitchenFloorSqft',
  'floorAreaSqft',
  'backsplashSqft',
  'countertopSqft',
  'cabinetLf',
  'landscapeSqft',
  'sodSqft',
  'paverSqft',
  'rockMulchSqft',
  'landscapeTons',
  'roofSquares',
  'drywallSqft',
  'concreteSqft',
  'concreteCy',
  'excavationCy',
  'deckSqft',
  'exteriorPaintSqft',
  'railingLf',
  'baseboardLf',
  'showerWallTileSqft',
  'showerFloorTileSqft',
  'wallPaintSqft',
]);

const QUESTION_KINDS = new Set(['measurement', 'pricing', 'scope', 'project_info']);
const MAX_QUESTIONS = 5;

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findRoomForPackageName(draft, packageName) {
  const target = normalizeName(packageName);
  if (!target) return null;
  const rooms = draft.rooms || [];
  let match = rooms.find((r) => normalizeName(r.name) === target);
  if (match) return match;
  match = rooms.find((r) => {
    const name = normalizeName(r.name);
    return name.includes(target) || target.includes(name);
  });
  return match || null;
}

function formatMoney(amount) {
  return `$${Math.round(Number(amount) || 0).toLocaleString()}`;
}

/**
 * Compact, deterministic text summary of the draft the LLM reviews.
 * Keeps token usage predictable regardless of draft size.
 */
function buildDraftStateSummary(draft) {
  const lines = [];
  lines.push(`Project type: ${draft.projectType || 'unknown'}`);
  if (draft.estimateTier) lines.push(`Complexity tier: ${draft.estimateTier}`);
  if (draft.projectAddress) lines.push(`Address: ${draft.projectAddress}`);
  lines.push(`Customer name: ${draft.customerName || 'MISSING'}`);

  const packages = draft.scopePackages || [];
  lines.push(`\nScope packages (${packages.length}):`);
  for (const pkg of packages.slice(0, 30)) {
    const qty = pkg.scopeQuantities?.[0];
    const qtyText = qty ? ` · ${qty.quantity} ${qty.unit}` : ' · NO MEASUREMENT';
    const amount = pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal;
    const priceText =
      amount != null && amount > 0 ? ` · ${formatMoney(amount)}` : ' · NO PRICE';
    lines.push(`- ${pkg.name} [${pkg.status || 'unknown'}]${qtyText}${priceText}`);
  }

  const m = draft.scopeMeasurements || {};
  const measurementEntries = Object.entries(m).filter(
    ([key, value]) =>
      MEASUREMENT_KEY_WHITELIST.has(key) && Number.isFinite(Number(value)) && Number(value) > 0
  );
  if (measurementEntries.length) {
    lines.push(`\nKnown measurements:`);
    for (const [key, value] of measurementEntries) lines.push(`- ${key}: ${value}`);
  }

  if (draft.allowances?.length) {
    lines.push(`\nAllowances:`);
    for (const a of draft.allowances.slice(0, 10)) {
      lines.push(
        `- ${a.name || a.description || 'allowance'}: ${a.amount != null ? formatMoney(a.amount) : 'no amount'}${a.unit ? ` ${a.unit}` : ''} [${a.status || ''}]`
      );
    }
  }

  if (draft.inclusions?.length) lines.push(`\nInclusions: ${draft.inclusions.slice(0, 10).join('; ')}`);
  if (draft.exclusions?.length) lines.push(`Exclusions: ${draft.exclusions.slice(0, 10).join('; ')}`);
  if (draft.missingInfo?.length) lines.push(`\nMissing info flags: ${draft.missingInfo.slice(0, 12).join('; ')}`);

  const notes = String(draft.originalNotes || '').trim();
  if (notes) {
    lines.push(`\nOriginal notes (excerpt):\n${notes.slice(0, 1200)}`);
  }
  return lines.join('\n');
}

const QUESTION_SYSTEM_PROMPT = `You are a senior construction estimator reviewing a draft estimate before it goes to a contractor for final review.

You will receive a structured summary of the draft: scope packages with their pricing/measurement status, known measurements, allowances, and the original job notes.

Ask ONLY the highest-impact clarifying questions — the ones whose answers would most improve this specific estimate. Prioritize:
1. Missing measurements that block pricing (sqft, LF, CY) for scopes marked NO MEASUREMENT
2. Missing prices on significant scopes marked NO PRICE (ask for the price or allowance)
3. Genuine scope ambiguity from the notes (e.g. "cabinets" — stock or custom? supplied by whom?)
4. Missing project info only if nothing more important remains

Rules:
- Maximum ${MAX_QUESTIONS} questions. Fewer is better if the draft is mostly complete.
- Every question must reference this specific job. Never ask generic checklist questions.
- Never ask about something already answered in the notes or summary.
- One fact per question. Answerable in a short phrase or number.

Return ONLY valid JSON:
{
  "questions": [
    {
      "id": "q1",
      "question": "string — the question to show the contractor",
      "why": "string — one short clause on why this matters for the estimate",
      "kind": "measurement" | "pricing" | "scope" | "project_info",
      "targetKey": "one of the measurement keys provided, or null",
      "targetPackage": "exact scope package name this concerns, or null"
    }
  ]
}`;

const ANSWER_SYSTEM_PROMPT = `You convert a contractor's answers to clarifying questions into a structured patch for a draft estimate. You never invent information — only extract what the contractor's answers state.

CRITICAL RULES (same as the estimate parser):
1. Numbers with sqft, sq ft, LF, linear feet, CY, squares are QUANTITIES, never dollar amounts.
2. Only report a price when the answer has a $ sign or clear price words (cost, price, allowance, budget, total).
3. Preserve stated numbers exactly. If an answer is vague ("not sure", "probably fine"), extract nothing from it.
4. packageName must be copied exactly from the question's targetPackage or the package named in the question.

Return ONLY valid JSON:
{
  "measurements": [{ "key": "whitelisted measurement key", "quantity": number, "unit": "sqft|lf|cy|squares|tons" }],
  "packagePrices": [{ "packageName": "string", "amount": number, "kind": "lump_sum" | "labor" | "material" }],
  "inclusions": ["short statements now confirmed included"],
  "exclusions": ["short statements now confirmed excluded"],
  "projectInfo": { "customerName": "string or null", "projectAddress": "string or null", "customerPhone": "string or null" },
  "notesAddendum": "one or two sentences capturing any remaining clarified facts, or null"
}
Use empty arrays / null when a section has nothing. Omit nothing that the answers clearly state.`;

function sanitizeQuestionItems(rawItems, draft) {
  if (!Array.isArray(rawItems)) return [];
  const items = [];
  const seen = new Set();
  for (const raw of rawItems) {
    const question = String(raw?.question || '').trim();
    if (!question || question.length > 240) continue;
    const dedupeKey = question.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const kind = QUESTION_KINDS.has(raw?.kind) ? raw.kind : 'scope';
    const targetKey =
      typeof raw?.targetKey === 'string' && MEASUREMENT_KEY_WHITELIST.has(raw.targetKey)
        ? raw.targetKey
        : null;
    const targetPackage =
      typeof raw?.targetPackage === 'string' && findRoomForPackageName(draft, raw.targetPackage)
        ? raw.targetPackage
        : null;
    items.push({
      id: `clarify-${items.length + 1}`,
      question,
      why: typeof raw?.why === 'string' ? raw.why.trim().slice(0, 160) : null,
      kind,
      targetKey,
      targetPackage,
    });
    if (items.length >= MAX_QUESTIONS) break;
  }
  return items;
}

async function generateClarifyQuestions(draftInput, deps = {}) {
  const { openai, aiModels, aiRuntime } = deps;
  const enriched = enrichDraft(draftInput);

  const fallback = () => {
    const staticResult = buildClarifyQuestions(enriched);
    return {
      ...staticResult,
      questionItems: staticResult.questions.map((question, index) => ({
        id: `clarify-static-${index + 1}`,
        question,
        why: null,
        kind: 'scope',
        targetKey: null,
        targetPackage: null,
      })),
      source: 'rules',
    };
  };

  if (!openai || !aiModels?.assistant?.estimate) return fallback();

  try {
    const summary = buildDraftStateSummary(enriched);
    const completion = await openai.chat.completions.create({
      model: aiModels.assistant.estimate,
      response_format: aiRuntime?.assistant?.estimate?.responseFormat || { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: QUESTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Measurement keys you may use for targetKey: ${[...MEASUREMENT_KEY_WHITELIST].join(', ')}\n\nDraft estimate summary:\n\n${summary}`,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return fallback();
    const parsed = JSON.parse(content);
    const questionItems = sanitizeQuestionItems(parsed?.questions, enriched);
    if (!questionItems.length) return fallback();

    return {
      questions: questionItems.map((item) => item.question),
      questionItems,
      needsReviewCount: (enriched.needsReviewItems || []).length,
      missingInfoCount: (enriched.missingInfo || []).length,
      detectedTrades: enriched.detectedTrades || [],
      source: 'ai',
    };
  } catch (err) {
    console.warn('generateClarifyQuestions LLM pass failed, using static questions:', err?.message);
    return fallback();
  }
}

/**
 * Deterministically apply a validated patch to the draft, then re-enrich.
 * Returns { draft, appliedSummary } — appliedSummary lists what changed so
 * the mobile UI can show "Applied: drywall 1,200 sqft, Permits $2,000".
 */
function applyClarifyPatch(draftInput, patch) {
  const draft = { ...(draftInput || {}) };
  const appliedSummary = [];

  // 1. Package prices → rooms (enrichDraft rebuilds scopePackages from rooms).
  const priceUpdates = Array.isArray(patch?.packagePrices) ? patch.packagePrices : [];
  let rooms = [...(draft.rooms || [])];
  for (const update of priceUpdates) {
    const amount = Number(update?.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const room = findRoomForPackageName({ rooms }, update?.packageName);
    if (!room) continue;
    const kind = update?.kind === 'labor' || update?.kind === 'material' ? update.kind : 'lump_sum';
    rooms = rooms.map((r) => {
      if (r !== room) return r;
      if (kind === 'labor') {
        const material = Number(r.materialPrice) || 0;
        return {
          ...r,
          laborPrice: amount,
          price: material > 0 ? Math.round((material + amount) * 100) / 100 : amount,
          priceIncludesLaborAndMaterials: false,
          priceProvidedByUser: true,
        };
      }
      if (kind === 'material') {
        const labor = Number(r.laborPrice) || 0;
        return {
          ...r,
          materialPrice: amount,
          price: labor > 0 ? Math.round((labor + amount) * 100) / 100 : amount,
          priceIncludesLaborAndMaterials: false,
          priceProvidedByUser: true,
        };
      }
      return {
        ...r,
        price: amount,
        laborPrice: null,
        materialPrice: null,
        priceIncludesLaborAndMaterials: true,
        priceProvidedByUser: true,
      };
    });
    appliedSummary.push(`${room.name}: ${formatMoney(amount)}${kind === 'lump_sum' ? '' : ` ${kind}`}`);
  }
  draft.rooms = rooms;

  // 2. Inclusions / exclusions.
  const addStrings = (existing, incoming, label) => {
    const clean = (Array.isArray(incoming) ? incoming : [])
      .map((s) => String(s || '').trim())
      .filter((s) => s && s.length <= 200);
    if (!clean.length) return existing || [];
    appliedSummary.push(`${clean.length} ${label} noted`);
    return [...new Set([...(existing || []), ...clean])];
  };
  draft.inclusions = addStrings(draft.inclusions, patch?.inclusions, 'inclusion(s)');
  draft.exclusions = addStrings(draft.exclusions, patch?.exclusions, 'exclusion(s)');

  // 3. Project info — only fill blanks; never overwrite what the user set.
  const info = patch?.projectInfo || {};
  if (!draft.customerName && typeof info.customerName === 'string' && info.customerName.trim()) {
    draft.customerName = info.customerName.trim().slice(0, 120);
    appliedSummary.push(`Customer: ${draft.customerName}`);
  }
  if (!draft.projectAddress && typeof info.projectAddress === 'string' && info.projectAddress.trim()) {
    draft.projectAddress = info.projectAddress.trim().slice(0, 200);
    appliedSummary.push('Project address added');
  }
  if (!draft.customerPhone && typeof info.customerPhone === 'string' && info.customerPhone.trim()) {
    draft.customerPhone = info.customerPhone.trim().slice(0, 40);
    appliedSummary.push('Customer phone added');
  }

  // 4. Notes addendum — traceability plus re-parse fodder for enrichment.
  const addendum = typeof patch?.notesAddendum === 'string' ? patch.notesAddendum.trim().slice(0, 600) : '';
  if (addendum) {
    const existingNotes = String(draft.originalNotes || '').trim();
    draft.originalNotes = existingNotes ? `${existingNotes}\nClarified: ${addendum}` : `Clarified: ${addendum}`;
  }

  // 5. Measurements — whitelisted keys only. applyScopeMeasurements replaces
  // draft.scopeMeasurements wholesale, so merge over the existing values to
  // preserve prior (including user-entered) measurements and itemQuantities.
  const measurementPatch = {};
  for (const entry of Array.isArray(patch?.measurements) ? patch.measurements : []) {
    const key = String(entry?.key || '');
    const quantity = Number(entry?.quantity);
    if (!MEASUREMENT_KEY_WHITELIST.has(key)) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    measurementPatch[key] = quantity;
    appliedSummary.push(`${key}: ${quantity.toLocaleString()}`);
  }

  const withMeasurements = Object.keys(measurementPatch).length
    ? applyScopeMeasurements(draft, {
        ...(draft.scopeMeasurements || {}),
        ...measurementPatch,
        itemQuantities: draft.scopeMeasurements?.itemQuantities || {},
      })
    : draft;

  return { draft: enrichDraft(withMeasurements), appliedSummary };
}

function sanitizeAnswers(answers) {
  return (Array.isArray(answers) ? answers : [])
    .map((a) => ({
      question: String(a?.question || '').trim().slice(0, 300),
      answer: String(a?.answer || '').trim().slice(0, 500),
      targetKey:
        typeof a?.targetKey === 'string' && MEASUREMENT_KEY_WHITELIST.has(a.targetKey)
          ? a.targetKey
          : null,
      targetPackage: typeof a?.targetPackage === 'string' ? a.targetPackage.slice(0, 120) : null,
    }))
    .filter((a) => a.question && a.answer);
}

async function applyClarifyAnswers(draftInput, answersInput, deps = {}) {
  const { openai, aiModels, aiRuntime } = deps;
  const answers = sanitizeAnswers(answersInput);
  if (!answers.length) {
    throw new Error('At least one answered question is required');
  }
  const enriched = enrichDraft(draftInput);

  // No-LLM fallback: append Q&A to notes and re-enrich. The measurement
  // parser picks quantities (sqft/LF/CY) out of the appended text.
  const fallback = () => {
    const qaLines = answers.map((a) => `Clarified — ${a.question}: ${a.answer}`).join('\n');
    const existingNotes = String(enriched.originalNotes || '').trim();
    const draft = enrichDraft({
      ...enriched,
      originalNotes: existingNotes ? `${existingNotes}\n${qaLines}` : qaLines,
    });
    return {
      draft,
      appliedSummary: [`${answers.length} answer(s) added to job notes`],
      source: 'rules',
    };
  };

  if (!openai || !aiModels?.assistant?.estimate) return fallback();

  try {
    const qaText = answers
      .map(
        (a, i) =>
          `Q${i + 1}${a.targetPackage ? ` (about "${a.targetPackage}")` : ''}${a.targetKey ? ` [targetKey: ${a.targetKey}]` : ''}: ${a.question}\nA${i + 1}: ${a.answer}`
      )
      .join('\n\n');
    const completion = await openai.chat.completions.create({
      model: aiModels.assistant.estimate,
      response_format: aiRuntime?.assistant?.estimate?.responseFormat || { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: ANSWER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Measurement keys allowed: ${[...MEASUREMENT_KEY_WHITELIST].join(', ')}\n\nScope package names in this draft: ${(enriched.scopePackages || [])
            .map((p) => p.name)
            .join(' | ')}\n\nContractor's answers:\n\n${qaText}`,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return fallback();
    const patch = JSON.parse(content);
    const { draft, appliedSummary } = applyClarifyPatch(enriched, patch);
    if (!appliedSummary.length) return fallback();
    return { draft, appliedSummary, source: 'ai' };
  } catch (err) {
    console.warn('applyClarifyAnswers LLM pass failed, appending to notes instead:', err?.message);
    return fallback();
  }
}

module.exports = {
  generateClarifyQuestions,
  applyClarifyAnswers,
  applyClarifyPatch,
  buildDraftStateSummary,
  sanitizeQuestionItems,
  MEASUREMENT_KEY_WHITELIST,
};
