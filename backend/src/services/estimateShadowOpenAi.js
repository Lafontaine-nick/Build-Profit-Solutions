/**
 * OpenAI adapter for estimate shadow mode.
 *
 * Shadow mode is opt-in and proposal-only. It never applies pricing, changes
 * a draft, or becomes the source of truth for the estimate pipeline.
 */

const {
  createOpenAiChatCompletion,
} = require('../utils/openaiChatCompletionParams');

const SHADOW_ENABLED_ENV = 'AI_ESTIMATE_SHADOW_ENABLED';
const DEFAULT_MAX_TOKENS = 1400;

function shadowModeEnabled(env = process.env) {
  return env[SHADOW_ENABLED_ENV] === 'true' || env[SHADOW_ENABLED_ENV] === '1';
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseJsonContent(content) {
  let text = String(content || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('OpenAI shadow proposal was not valid JSON');
  }
}

function catalogMap(catalog) {
  const map = new Map();
  for (const item of Array.isArray(catalog) ? catalog : []) {
    const id = normalizeId(item?.id || item?.itemId);
    if (!id) continue;
    map.set(id, {
      id,
      label: String(item?.label || item?.name || id),
      units: Array.isArray(item?.units)
        ? item.units.map((unit) => String(unit).toLowerCase())
        : [],
    });
  }
  return map;
}

/**
 * Remove anything the model returned that is not in the approved BPS catalog.
 * Invalid output is retained in rejectedItems for evaluation and debugging,
 * but is never eligible to enter the estimate.
 */
function validateShadowProposal(proposal, catalog) {
  const approved = catalogMap(catalog);
  const rejectedItems = [];
  const scopeItems = [];
  const seenScope = new Set();

  for (const raw of Array.isArray(proposal?.scopeItems)
    ? proposal.scopeItems
    : []) {
    const id = normalizeId(raw?.id || raw?.itemId || raw?.scopeId);
    const entry = approved.get(id);
    if (!entry) {
      if (id) rejectedItems.push({ type: 'scope', id, reason: 'not_in_catalog' });
      continue;
    }
    if (seenScope.has(id)) {
      rejectedItems.push({ type: 'scope', id, reason: 'duplicate' });
      continue;
    }
    const unit = String(raw?.unit || '').trim().toLowerCase();
    if (entry.units.length && unit && !entry.units.includes(unit)) {
      rejectedItems.push({ type: 'scope', id, reason: 'unit_not_allowed' });
      continue;
    }
    const quantity = finitePositive(raw?.quantity);
    scopeItems.push({
      id,
      quantity,
      unit: unit || null,
      evidence: String(raw?.evidence || '').trim() || null,
    });
    seenScope.add(id);
  }

  const exclusions = [];
  const seenExclusions = new Set();
  for (const raw of Array.isArray(proposal?.exclusions)
    ? proposal.exclusions
    : []) {
    const id = normalizeId(typeof raw === 'string' ? raw : raw?.id);
    if (!id || seenExclusions.has(id)) continue;
    if (!approved.has(id)) {
      rejectedItems.push({ type: 'exclusion', id, reason: 'not_in_catalog' });
      continue;
    }
    exclusions.push(id);
    seenExclusions.add(id);
  }
  if (seenScope.has('service_call') && exclusions.includes('hvac')) {
    exclusions.splice(exclusions.indexOf('hvac'), 1);
    rejectedItems.push({
      type: 'exclusion',
      id: 'hvac',
      reason: 'service_call_does_not_imply_hvac_exclusion',
    });
  }

  const clarifications = [];
  const seenClarifications = new Set();
  for (const raw of Array.isArray(proposal?.clarifications)
    ? proposal.clarifications
    : []) {
    const id =
      typeof raw === 'string'
        ? normalizeId(raw)
        : normalizeId(raw?.id || raw?.scopeId || raw?.targetKey);
    if (!id || seenClarifications.has(id)) continue;
    clarifications.push({
      id,
      question: String(raw?.question || '').trim() || null,
      options: Array.isArray(raw?.options)
        ? raw.options.map((option) => String(option).trim()).filter(Boolean)
        : [],
    });
    seenClarifications.add(id);
  }

  return {
    scopeItems,
    exclusions,
    clarifications,
    confidence: ['low', 'medium', 'high'].includes(
      String(proposal?.confidence || '').toLowerCase()
    )
      ? String(proposal.confidence).toLowerCase()
      : null,
    rejectedItems,
  };
}

function buildShadowPrompt({ notes, context = {}, catalog = [] }) {
  const catalogText = catalog
    .map((item) => {
      const units = Array.isArray(item.units) && item.units.length
        ? `; units=${item.units.join(',')}`
        : '';
      return `- ${item.id}: ${item.label || item.id}${units}`;
    })
    .join('\n');

  return [
    'Interpret contractor notes for an estimating benchmark.',
    'Return JSON only. Do not price anything and do not invent work.',
    'Use only catalog IDs provided below.',
    'Include a scope item only when the note explicitly requests it.',
    'Keep explicit exclusions in exclusions and do not add them to scopeItems.',
    'Replacement language alone (for example, "replace carpet with LVP") identifies the existing material but does not authorize demolition. Put demolition in clarifications unless the note explicitly says demo, remove, tear off, or that the owner is removing it.',
    'A clarification candidate must not also appear in scopeItems. Unconfirmed work belongs only in clarifications until the user confirms it.',
    'For flooring installation without explicit demolition, removal, or owner-removal language, ask for the floor_demo clarification because existing-floor preparation can materially change the bid.',
    'For a new shower pan or shower wall tile with no existing-condition statement, ask exactly one shower_demo clarification about existing shower removal; do not add demolition scope, do not ask separate shower_pan or shower_tile questions, and do not ask floor_demo when no flooring work is stated.',
    'When explicit flooring removal is paired with an installation quantity and no separate demo quantity is given, reuse the installation quantity for floor_demo.',
    'Use the generic paint catalog ID when the note only says "paint"; use interior_paint only when walls, interiors, or an interior paint area are explicitly identified.',
    'A named high-level scope such as kitchen, bathrooms, flooring, paint, doors, or baseboard is still an explicit scope item when its quantity or material is unknown. Include the matching generic catalog item with null quantity and ask a clarification only in addition to it when needed.',
    'Map generic "flooring" to the flooring catalog ID, generic "doors" to interior_door_install, and generic "baseboard" to baseboard_install. Do not turn a generic flooring mention into a floor_demo question unless installation or a flooring material is explicitly stated.',
    'Map HVAC service call, diagnosis, troubleshooting, or furnace diagnostic language only to service_call. Use hvac only for HVAC equipment installation, replacement, or a stated HVAC system scope; never return both for one service-call phrase.',
    'Do not put hvac in exclusions merely because a note requests a service call; absence of equipment installation is not an explicit exclusion.',
    'When the note says architectural shingles, shingle reroof, or reroof with shingles, use shingles_roofing. Use broad roofing only when no roofing material is identified, and never return both for one reroof scope.',
    'A singular service call or diagnostic visit has quantity 1 and unit each unless a different count is explicitly stated.',
    'For drywall patch/repair notes that say no new hang, keep patch_repair in scope and exclude only hang. Do not exclude the generic drywall scope or the patch itself.',
    'Ask a clarification only when the missing fact could materially change scope or quantity.',
    '',
    'JSON shape:',
    '{',
    '  "scopeItems": [{"id": "...", "quantity": number|null, "unit": "..."|null, "evidence": "exact note phrase"}],',
    '  "exclusions": ["catalog_id"],',
    '  "clarifications": [{"id": "catalog_id", "question": "...", "options": ["..."]}],',
    '  "confidence": "low"|"medium"|"high"',
    '}',
    '',
    `Context: ${JSON.stringify(context)}`,
    `Approved catalog:\n${catalogText}`,
    `Contractor notes:\n${String(notes || '').trim()}`,
  ].join('\n');
}

async function requestOpenAiShadowProposal({
  openai,
  model,
  runtime = {},
  notes,
  context,
  catalog,
  env = process.env,
}) {
  if (!shadowModeEnabled(env)) {
    return {
      enabled: false,
      proposal: null,
      reason: 'shadow_mode_disabled',
    };
  }
  if (!openai) {
    return {
      enabled: false,
      proposal: null,
      reason: 'openai_client_unavailable',
    };
  }
  if (!String(notes || '').trim()) {
    throw new Error('Notes are required for shadow evaluation');
  }

  const completion = await createOpenAiChatCompletion(openai, {
    model,
    response_format: runtime.responseFormat || { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a conservative construction-scope interpretation evaluator. BPS pricing and scope validation remain authoritative.',
      },
      {
        role: 'user',
        content: buildShadowPrompt({ notes, context, catalog }),
      },
    ],
    ...(runtime.maxTokens != null
      ? { max_tokens: runtime.maxTokens }
      : { max_tokens: DEFAULT_MAX_TOKENS }),
    ...(runtime.temperature != null
      ? { temperature: runtime.temperature }
      : {}),
  });

  const content = completion?.choices?.[0]?.message?.content;
  const rawProposal = parseJsonContent(content);
  return {
    enabled: true,
    proposal: validateShadowProposal(rawProposal, catalog),
    usage: completion?.usage || null,
    model,
  };
}

module.exports = {
  SHADOW_ENABLED_ENV,
  shadowModeEnabled,
  buildShadowPrompt,
  parseJsonContent,
  validateShadowProposal,
  requestOpenAiShadowProposal,
};
