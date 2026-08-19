/**
 * Framing Plan Export adapter — derives covered framed SF and sheathing from plan facts.
 * Never infers stud counts or hardware from living area alone.
 */

const FRAMING_MEASUREMENT_KEYS = [
  'framedAreaSqft',
  'wallFramingLf',
  'sheathingSqft',
  'framingOpeningCount',
  'framingCleanupCount',
  'floorAreaSqft',
  'garageSqft',
  'stuccoGrossWallSqft',
];

const FRAMING_PLAN_ALIASES = {
  framingSqft: 'framedAreaSqft',
  framedSqft: 'framedAreaSqft',
  coveredFramedSqft: 'framedAreaSqft',
  framingAreaSqft: 'framedAreaSqft',
  wallFramingLinearFeet: 'wallFramingLf',
  framingWallLf: 'wallFramingLf',
  shearSheathingSqft: 'sheathingSqft',
  sheathingAreaSqft: 'sheathingSqft',
  framingOpenings: 'framingOpeningCount',
  openingCount: 'framingOpeningCount',
};

const FRAMING_SCOPE_BY_KEY = {
  framedAreaSqft: 'framing',
  wallFramingLf: 'wall_framing',
  sheathingSqft: 'shear_sheathing',
  framingOpeningCount: 'openings',
  framingCleanupCount: 'cleanup',
};

function positiveNumber(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isShellFramingPackageBid(input = {}) {
  return positiveNumber(input.floorAreaSqft) != null;
}

function stripShellFramingComponentMeasurements(input = {}) {
  if (!isShellFramingPackageBid(input)) return input;
  const next = { ...input };
  delete next.wallFramingLf;
  delete next.framingOpeningCount;
  return next;
}

function normalizeAliasedInput(input = {}) {
  const out = { ...input };
  for (const [alias, canonical] of Object.entries(FRAMING_PLAN_ALIASES)) {
    if (positiveNumber(out[canonical]) != null) continue;
    const value = positiveNumber(out[alias]);
    if (value != null) out[canonical] = value;
  }
  return out;
}

function resolveCoveredFramedAreaSqft(input = {}) {
  const aliased = normalizeAliasedInput(input);
  const direct = positiveNumber(aliased.framedAreaSqft);
  if (direct != null) return Math.round(direct);
  const living = positiveNumber(aliased.floorAreaSqft);
  if (living == null) return null;
  const garage = positiveNumber(aliased.garageSqft) ?? 0;
  return Math.round(living + Math.max(0, garage));
}

function resolveFramingSheathingSqft(input = {}) {
  const aliased = normalizeAliasedInput(input);
  const direct = positiveNumber(aliased.sheathingSqft);
  if (direct != null) return Math.round(direct);
  const grossWall = positiveNumber(aliased.stuccoGrossWallSqft);
  if (grossWall != null) return Math.round(grossWall);
  return null;
}

function normalizeFramingPlanMeasurements(input = {}) {
  const aliased = normalizeAliasedInput(input);
  const out = {};
  for (const key of FRAMING_MEASUREMENT_KEYS) {
    const quantity = positiveNumber(aliased[key]);
    if (quantity != null) out[key] = quantity;
  }
  const framed = resolveCoveredFramedAreaSqft(aliased);
  if (framed != null) out.framedAreaSqft = framed;
  const sheathing = resolveFramingSheathingSqft(aliased);
  if (sheathing != null) out.sheathingSqft = sheathing;
  return stripShellFramingComponentMeasurements(out);
}

function deriveFramingScope(measurements = {}) {
  const scope = [];
  const shellBid = isShellFramingPackageBid(measurements);
  for (const [key, itemId] of Object.entries(FRAMING_SCOPE_BY_KEY)) {
    if (shellBid && (itemId === 'wall_framing' || itemId === 'openings')) {
      continue;
    }
    const quantity =
      key === 'framedAreaSqft'
        ? resolveCoveredFramedAreaSqft(measurements)
        : key === 'sheathingSqft'
          ? resolveFramingSheathingSqft(measurements)
          : positiveNumber(measurements[key]);
    if (quantity != null && quantity > 0) scope.push(itemId);
  }
  return scope;
}

function finalizeFramingTakeoff(input = {}) {
  const measurements = normalizeFramingPlanMeasurements(input.measurements || {});
  const derivedKeys = [];
  const fieldEvidence = { ...(input.fieldEvidence || {}) };
  const fieldConfidence = { ...(input.fieldConfidence || {}) };
  const inferredKeys = new Set(Array.isArray(input.inferredKeys) ? input.inferredKeys : []);

  const framedBefore = positiveNumber(input.measurements?.framedAreaSqft);
  if (measurements.framedAreaSqft != null && framedBefore == null) {
    derivedKeys.push('framedAreaSqft');
    inferredKeys.add('framedAreaSqft');
    fieldEvidence.framedAreaSqft =
      fieldEvidence.framedAreaSqft ||
      'Derived covered framed SF from living plus garage plan areas.';
    fieldConfidence.framedAreaSqft = Math.max(
      Number(fieldConfidence.framedAreaSqft || 0),
      0.72
    );
  }

  const sheathingBefore = positiveNumber(input.measurements?.sheathingSqft);
  if (measurements.sheathingSqft != null && sheathingBefore == null) {
    derivedKeys.push('sheathingSqft');
    inferredKeys.add('sheathingSqft');
    fieldEvidence.sheathingSqft =
      fieldEvidence.sheathingSqft ||
      'Derived sheathing area from documented gross wall area.';
    fieldConfidence.sheathingSqft = Math.max(
      Number(fieldConfidence.sheathingSqft || 0),
      0.68
    );
  }

  return {
    measurements,
    framingScope: deriveFramingScope(measurements),
    derivedKeys,
    fieldEvidence,
    fieldConfidence,
    inferredKeys: [...inferredKeys],
  };
}

module.exports = {
  FRAMING_MEASUREMENT_KEYS,
  FRAMING_PLAN_ALIASES,
  normalizeFramingPlanMeasurements,
  resolveCoveredFramedAreaSqft,
  resolveFramingSheathingSqft,
  deriveFramingScope,
  finalizeFramingTakeoff,
};
