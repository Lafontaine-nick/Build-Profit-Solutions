const SQFT_CONFLICT_PERCENT = 0.05;
const SQFT_CONFLICT_ABSOLUTE = 50;
const LF_CONFLICT_PERCENT = 0.05;
const LF_CONFLICT_ABSOLUTE = 20;

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function conflictThreshold(field, a, b) {
  const isLf = /(?:Lf|LinearFeet)$/i.test(String(field));
  const percent = isLf ? LF_CONFLICT_PERCENT : SQFT_CONFLICT_PERCENT;
  const absolute = isLf ? LF_CONFLICT_ABSOLUTE : SQFT_CONFLICT_ABSOLUTE;
  return Math.max(absolute, Math.max(a, b) * percent);
}

function materiallyConflicts(field, a, b) {
  if (/count|stories?$/i.test(String(field))) {
    return Math.abs(Math.round(a) - Math.round(b)) > 0;
  }
  return Math.abs(a - b) > conflictThreshold(field, a, b);
}

function candidateScore(candidate) {
  return (
    (candidate.directEvidence ? 100 : 0) +
    (Number(candidate.confidence) >= 0 && Number(candidate.confidence) <= 1
      ? Number(candidate.confidence) * 10
      : 0)
  );
}

/**
 * Merge competing plan measurements without silently discarding the loser.
 * Manual candidates can be supplied with directEvidence=true and confidence=1
 * so later AI passes cannot replace them.
 */
function mergeMeasurementCandidates({
  baseMeasurements = {},
  overlayMeasurements = {},
  baseConfidence = {},
  overlayConfidence = {},
  baseSource = 'general_plan_takeoff',
  overlaySource = 'focused_trade_takeoff',
  baseEvidence = {},
  overlayEvidence = {},
} = {}) {
  const measurements = {
    ...(baseMeasurements && typeof baseMeasurements === 'object'
      ? baseMeasurements
      : {}),
  };
  const provenance = {};
  const conflicts = [];
  const keys = new Set([
    ...Object.keys(baseMeasurements || {}),
    ...Object.keys(overlayMeasurements || {}),
  ]);

  for (const field of keys) {
    const baseValue = positive(baseMeasurements?.[field]);
    const overlayValue = positive(overlayMeasurements?.[field]);
    if (baseValue == null && overlayValue == null) continue;

    const candidates = [];
    if (baseValue != null) {
      candidates.push({
        value: baseValue,
        source: baseSource,
        confidence: Number(baseConfidence?.[field] ?? 0),
        directEvidence: Boolean(baseEvidence?.[field]),
      });
    }
    if (overlayValue != null) {
      candidates.push({
        value: overlayValue,
        source: overlaySource,
        confidence: Number(overlayConfidence?.[field] ?? 0),
        directEvidence: Boolean(overlayEvidence?.[field]),
      });
    }

    candidates.sort((a, b) => candidateScore(b) - candidateScore(a));
    const selected = candidates[0];
    measurements[field] = selected.value;
    provenance[field] = {
      ...selected,
      alternatives: candidates
        .slice(1)
        .map(candidate => ({ ...candidate })),
    };

    if (
      candidates.length > 1 &&
      materiallyConflicts(field, baseValue, overlayValue)
    ) {
      conflicts.push({
        field,
        selectedValue: selected.value,
        selectedSource: selected.source,
        threshold: conflictThreshold(field, baseValue, overlayValue),
        candidates: candidates.map(candidate => ({ ...candidate })),
        requiresConfirmation: true,
      });
    }
  }

  return { measurements, provenance, conflicts };
}

module.exports = {
  conflictThreshold,
  materiallyConflicts,
  mergeMeasurementCandidates,
};
