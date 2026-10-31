/**
 * Opt-in live shadow observer for estimate scope interpretation.
 *
 * This service is deliberately proposal-only:
 * - it never changes the draft or checklist;
 * - it never calls pricing or totals code;
 * - it logs only scope IDs and counts, not contractor notes or evidence.
 */

const {
  createOpenAiClient,
  getAiModels,
} = require("../config/aiConfig");
const { getScopeCatalog, canonicalScopeId } = require("./scopeCatalog");
const { canonicalScopeExcludedIds } = require("./canonicalScope");
const { requestOpenAiShadowProposal } = require("./estimateShadowOpenAi");

const LIVE_ENABLED_ENV = "AI_ESTIMATE_SHADOW_LIVE_ENABLED";

function liveShadowEnabled(env = process.env) {
  return env[LIVE_ENABLED_ENV] === "true" || env[LIVE_ENABLED_ENV] === "1";
}

function catalogForShadow() {
  return getScopeCatalog().map((entry) => ({
    id: entry.scopeId,
    label: entry.displayName,
    // The live observer validates IDs against the canonical catalog. Unit
    // validation stays permissive because many existing cards have legacy or
    // context-specific units that are normalized by BPS downstream.
    units: [],
  }));
}

function currentCandidateFromCanonical(canonicalScope, checklist) {
  if (Array.isArray(canonicalScope?.items) && canonicalScope.items.length) {
    const excluded = canonicalScopeExcludedIds(canonicalScope);
    return {
      scopeItems: canonicalScope.items
        .filter((item) => item?.id && item.status !== "excluded")
        .map((item) => ({
          id: canonicalScopeId(item.catalogMatch || item.id),
          quantity: item.quantity ?? null,
          unit: item.unit || null,
        })),
      exclusions: [...excluded].map((id) => canonicalScopeId(id)),
      clarifications: canonicalScope.items
        .filter((item) => item.status === "unknown")
        .map((item) => ({ id: canonicalScopeId(item.id) })),
    };
  }
  return currentCandidateFromChecklist(checklist);
}

function currentCandidateFromChecklist(checklist) {
  const facts = Array.isArray(checklist?.scopeFacts)
    ? checklist.scopeFacts
    : [];
  return {
    scopeItems: facts
      .filter((fact) => fact?.scopeId && !fact.excluded)
      .map((fact) => ({
        id: canonicalScopeId(fact.scopeId),
        quantity: fact.quantity ?? null,
        unit: fact.unit || null,
      })),
    exclusions: facts
      .filter((fact) => fact?.scopeId && fact.excluded)
      .map((fact) => canonicalScopeId(fact.scopeId)),
    clarifications: [],
  };
}

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function buildShadowDrift(current, proposal) {
  const currentIds = uniqueIds(current.scopeItems.map((item) => item.id));
  const proposalIds = uniqueIds(proposal.scopeItems.map((item) => item.id));
  const currentSet = new Set(currentIds);
  const proposalSet = new Set(proposalIds);

  return {
    currentScopeCount: currentIds.length,
    proposalScopeCount: proposalIds.length,
    proposalOnlyScopeIds: proposalIds.filter((id) => !currentSet.has(id)),
    currentOnlyScopeIds: currentIds.filter((id) => !proposalSet.has(id)),
    proposalExclusionCount: proposal.exclusions.length,
    proposalClarificationIds: uniqueIds(
      proposal.clarifications.map((item) => item.id),
    ),
    rejectedItemCount: proposal.rejectedItems.length,
  };
}

async function runEstimateShadowLive({
  notes,
  context = {},
  checklist,
  canonicalScope,
  env = process.env,
  openai,
  model = getAiModels().assistant.estimate,
  logger = console,
} = {}) {
  if (!liveShadowEnabled(env)) {
    return { enabled: false, reason: "live_shadow_disabled" };
  }

  const client = openai || createOpenAiClient();
  if (!client) {
    return { enabled: false, reason: "openai_client_unavailable" };
  }
  if (!String(notes || "").trim()) {
    return { enabled: false, reason: "notes_missing" };
  }

  try {
    const response = await requestOpenAiShadowProposal({
      openai: client,
      model,
      runtime: { maxTokens: 1800, temperature: 0 },
      notes,
      context,
      catalog: catalogForShadow(),
      env: { ...env, AI_ESTIMATE_SHADOW_ENABLED: "true" },
    });
    const current = currentCandidateFromCanonical(canonicalScope, checklist);
    const drift = buildShadowDrift(current, response.proposal);
    const telemetry = {
      event: "estimate_shadow_live",
      model,
      templateKey: context.templateKey || null,
      ...drift,
      usage: response.usage || null,
    };

    logger.info("[estimate-shadow-live]", JSON.stringify(telemetry));
    return {
      enabled: true,
      telemetry,
      proposal: response.proposal,
    };
  } catch (error) {
    logger.warn("[estimate-shadow-live]", JSON.stringify({
      event: "estimate_shadow_live_error",
      message: error.message,
    }));
    return { enabled: true, error: error.message };
  }
}

module.exports = {
  LIVE_ENABLED_ENV,
  liveShadowEnabled,
  catalogForShadow,
  currentCandidateFromCanonical,
  currentCandidateFromChecklist,
  buildShadowDrift,
  runEstimateShadowLive,
};
