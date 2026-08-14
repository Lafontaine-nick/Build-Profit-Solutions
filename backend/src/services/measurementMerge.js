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

function roundCandidateValue(field, value) {
  if (/count|stories?$/i.test(String(field)) || /Amperage$/i.test(String(field))) {
    return Math.round(value);
  }
  return value;
}

/**
 * Merge 2+ independent takeoff sources. Distinct values stay as candidates.
 * Direct-evidence instance tags outrank vision for selectedValue, but a
 * material disagreement still requires contractor confirmation.
 */
function mergeMeasurementCandidateSets(sets = []) {
  const fieldCandidates = new Map();
  for (const set of Array.isArray(sets) ? sets : []) {
    const measurements =
      set?.measurements && typeof set.measurements === 'object' ? set.measurements : {};
    for (const [field, raw] of Object.entries(measurements)) {
      const value = positive(raw);
      if (value == null) continue;
      if (!fieldCandidates.has(field)) fieldCandidates.set(field, []);
      fieldCandidates.get(field).push({
        value,
        source: set.source || 'unknown',
        confidence: Number(
          set.confidence?.[field] ??
            (Number.isFinite(Number(set.defaultConfidence)) ? set.defaultConfidence : 0)
        ),
        directEvidence: Boolean(set.evidence?.[field]),
      });
    }
  }

  const measurements = {};
  const provenance = {};
  const conflicts = [];

  for (const [field, rawCandidates] of fieldCandidates) {
    const candidates = [...rawCandidates].sort(
      (a, b) => candidateScore(b) - candidateScore(a)
    );
    const selected = candidates[0];
    measurements[field] = selected.value;
    const uniqueValues = [
      ...new Set(candidates.map((candidate) => roundCandidateValue(field, candidate.value))),
    ];
    const methodsAgree =
      uniqueValues.length === 1 &&
      new Set(candidates.map((candidate) => candidate.source)).size >= 2;
    provenance[field] = {
      ...selected,
      alternatives: candidates.slice(1).map((candidate) => ({ ...candidate })),
      methodsAgree,
    };

    let hasConflict = false;
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        if (materiallyConflicts(field, candidates[i].value, candidates[j].value)) {
          hasConflict = true;
          break;
        }
      }
      if (hasConflict) break;
    }
    if (hasConflict) {
      conflicts.push({
        field,
        selectedValue: selected.value,
        selectedSource: selected.source,
        threshold: conflictThreshold(
          field,
          Math.min(...candidates.map((c) => c.value)),
          Math.max(...candidates.map((c) => c.value))
        ),
        candidates: candidates.map((candidate) => ({ ...candidate })),
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
  mergeMeasurementCandidateSets,
};
