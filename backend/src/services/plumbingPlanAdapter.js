/**
 * Plumbing Plan Export adapter.
 *
 * Plan extraction may use aliases, but the estimator receives only the
 * canonical Plumbing keys. Unsupported or inferred quantities are omitted;
 * this adapter never creates quantities from living area or room count.
 */

const PLUMBING_MEASUREMENT_KEYS = [
  'serviceCallCount',
  'fixtureRepairCount',
  'fixtureReplacementCount',
  'drainCleaningCount',
  'waterLineLf',
  'sewerLineLf',
  'plumbingRoughPointCount',
  'plumbingTrimHookupCount',
  'partsMaterialsCount',
  'emergencyFeeCount',
  'plumbingCleanupCount',
];

const PLUMBING_PLAN_ALIASES = {
  serviceCalls: 'serviceCallCount',
  plumbingServiceCalls: 'serviceCallCount',
  fixtureRepairs: 'fixtureRepairCount',
  fixtureRepairCount: 'fixtureRepairCount',
  fixtureReplacements: 'fixtureReplacementCount',
  fixtureReplaceCount: 'fixtureReplacementCount',
  drainCleanings: 'drainCleaningCount',
  waterLineFeet: 'waterLineLf',
  waterSupplyLf: 'waterLineLf',
  sewerLineFeet: 'sewerLineLf',
  drainLineLf: 'sewerLineLf',
  roughInPoints: 'plumbingRoughPointCount',
  roughInPointCount: 'plumbingRoughPointCount',
  plumbingRoughPoints: 'plumbingRoughPointCount',
  trimHookupCount: 'plumbingTrimHookupCount',
  plumbingConnections: 'plumbingTrimHookupCount',
  plumbingTrimCount: 'plumbingTrimHookupCount',
  partsCount: 'partsMaterialsCount',
  plumbingPartsCount: 'partsMaterialsCount',
  emergencyCount: 'emergencyFeeCount',
  cleanupCount: 'plumbingCleanupCount',
};

const PLUMBING_EXPLICIT_ONLY_KEYS = new Set([
  'serviceCallCount',
  'fixtureRepairCount',
  'fixtureReplacementCount',
  'drainCleaningCount',
  'waterLineLf',
  'sewerLineLf',
  'plumbingRoughPointCount',
  'plumbingTrimHookupCount',
  'partsMaterialsCount',
  'emergencyFeeCount',
  'plumbingCleanupCount',
]);

const PLUMBING_VISION_INSTRUCTIONS = `
Plumbing takeoff contract:
- Inspect plumbing plans, fixture schedules, risers, details, water/sewer plans, and plumbing notes.
- Return only quantities that are explicitly printed, scheduled, counted from a readable plumbing symbol/fixture schedule, or measured from labeled geometry.
- Use canonical fields only: serviceCallCount, fixtureRepairCount, fixtureReplacementCount, drainCleaningCount, waterLineLf, sewerLineLf, plumbingRoughPointCount, plumbingTrimHookupCount, partsMaterialsCount, emergencyFeeCount, and plumbingCleanupCount.
- WaterLineLf and sewerLineLf require readable dimensions or a labeled length. Do not estimate length from fixture count, room count, or living area.
- Rough-in points require explicit point callouts or a readable fixture/rough-in schedule. Do not invent a whole-house rough package.
- Do not infer service calls, repairs, parts, emergency fees, or cleanup from generic plumbing symbols.
- Put inferred, ambiguous, or unreadable fields in inferredKeys or unreadableFields; they remain confirmation-only and are not priceable.
- Never use living SF, floor SF, bath count, or room area as a Plumbing quantity.
`;

function positive(value) {
  const number = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizePlumbingPlanMeasurements(input) {
  const source = input && typeof input === 'object' ? input : {};
  const withAliases = { ...source };
  for (const [alias, canonical] of Object.entries(PLUMBING_PLAN_ALIASES)) {
    if (positive(withAliases[canonical]) != null) continue;
    const value = positive(withAliases[alias]);
    if (value != null) withAliases[canonical] = value;
  }
  const measurements = {};
  for (const key of PLUMBING_MEASUREMENT_KEYS) {
    const value = positive(withAliases[key]);
    if (value != null) measurements[key] = value;
  }
  return measurements;
}

function remapPlumbingKeys(keys) {
  return (Array.isArray(keys) ? keys : [])
    .map(key => PLUMBING_PLAN_ALIASES[key] || key)
    .filter(key => PLUMBING_MEASUREMENT_KEYS.includes(key));
}

function applyPlumbingVisionTakeoff(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  parsed.measurements = normalizePlumbingPlanMeasurements(parsed.measurements);
  parsed.explicitlyLabeled = remapPlumbingKeys(parsed.explicitlyLabeled);
  parsed.geometryDerived = remapPlumbingKeys(parsed.geometryDerived);
  parsed.inferredKeys = remapPlumbingKeys(parsed.inferredKeys);
  const supportedKeys = new Set([
    ...parsed.explicitlyLabeled,
    ...parsed.geometryDerived,
  ]);
  for (const key of parsed.inferredKeys) {
    if (!supportedKeys.has(key)) delete parsed.measurements[key];
  }
  if (parsed.fieldConfidence && typeof parsed.fieldConfidence === 'object') {
    const next = {};
    for (const [key, value] of Object.entries(parsed.fieldConfidence)) {
      const canonical = PLUMBING_PLAN_ALIASES[key] || key;
      if (PLUMBING_MEASUREMENT_KEYS.includes(canonical)) next[canonical] = value;
    }
    parsed.fieldConfidence = next;
  }
  return parsed;
}

module.exports = {
  PLUMBING_MEASUREMENT_KEYS,
  PLUMBING_PLAN_ALIASES,
  PLUMBING_EXPLICIT_ONLY_KEYS,
  PLUMBING_VISION_INSTRUCTIONS,
  normalizePlumbingPlanMeasurements,
  applyPlumbingVisionTakeoff,
};
