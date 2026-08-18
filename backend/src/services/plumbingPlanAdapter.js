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
  'gasLineLf',
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
  gasLineFeet: 'gasLineLf',
  gasPipingLf: 'gasLineLf',
  gasLineLf: 'gasLineLf',
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
  'gasLineLf',
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
- Build fixtureInventory when the plans support it: bathrooms, toilets, lavatories, showers, tubs, kitchen sinks, dishwasher connections, laundry boxes, hose bibs, floor drains, water heaters, and gas appliances. Each count needs fieldEvidence.
- Derive plumbingRoughPointCount and plumbingTrimHookupCount only from an explicit fixture schedule or clearly counted fixture inventory. Mark those fields geometryDerived and include derivedFrom in fieldEvidence. Never derive them from living area, room count, or a generic bathroom count.
- Use canonical fields only: serviceCallCount, fixtureRepairCount, fixtureReplacementCount, drainCleaningCount, waterLineLf, sewerLineLf, gasLineLf, plumbingRoughPointCount, plumbingTrimHookupCount, partsMaterialsCount, emergencyFeeCount, and plumbingCleanupCount.
- WaterLineLf and sewerLineLf require readable dimensions or a labeled length. Do not estimate length from fixture count, room count, or living area.
- GasLineLf requires a readable gas-piping dimension or labeled length. Appliance symbols identify gas scope only; they do not establish LF.
- Return utilityConnections as scope/allowance confirmations (for example municipal water, sewer, gas, tap, meter, or utility-provider work). Do not convert utility connections into LF or EA measurements.
- Rough-in points require explicit point callouts or a readable fixture/rough-in schedule. Do not invent a whole-house rough package.
- Do not infer service calls, repairs, parts, emergency fees, or cleanup from generic plumbing symbols.
- Put inferred, ambiguous, or unreadable fields in inferredKeys or unreadableFields; they remain confirmation-only and are not priceable.
- For every Plumbing measurement, return fieldEvidence[key] as an array of objects with page, sheet, label, sourceText, sourceType, confidence, and optional derivedFrom. Use sourceType plan_vision or pdf_text.
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

function normalizePlumbingFieldEvidence(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [rawKey, rawEntries] of Object.entries(raw)) {
    const key = PLUMBING_PLAN_ALIASES[rawKey] || rawKey;
    if (!PLUMBING_MEASUREMENT_KEYS.includes(key)) continue;
    const entries = Array.isArray(rawEntries)
      ? rawEntries
      : Array.isArray(rawEntries?.evidence)
        ? rawEntries.evidence.map(entry => ({
            ...entry,
            evidenceKind: rawEntries.evidenceKind || entry?.evidenceKind,
            derivedFrom: rawEntries.derivedFrom || entry?.derivedFrom,
          }))
        : [rawEntries];
    const normalized = entries
      .filter(entry => entry && typeof entry === 'object')
      .map(entry => {
        const next = {};
        const page = Number(entry.page ?? entry.sourcePage);
        if (Number.isInteger(page) && page > 0 && page <= 1000) next.page = page;
        const sheet = String(entry.sheet ?? entry.sourceSheet ?? '').trim();
        if (sheet) next.sheet = sheet.slice(0, 30);
        for (const field of ['label', 'sourceText', 'sourceType', 'evidenceKind']) {
          const value = String(entry[field] || '').trim();
          if (value) next[field] = value.slice(0, 200);
        }
        const confidence = Number(entry.confidence);
        if (Number.isFinite(confidence)) {
          next.confidence = Math.max(0, Math.min(1, confidence));
        }
        const derivedFrom = Array.isArray(entry.derivedFrom)
          ? entry.derivedFrom
              .map(value => String(value).trim())
              .filter(Boolean)
              .slice(0, 12)
          : [];
        if (derivedFrom.length) next.derivedFrom = derivedFrom;
        return next;
      })
      .filter(entry => Object.keys(entry).length > 0)
      .slice(0, 16);
    if (normalized.length) out[key] = normalized;
  }
  return out;
}

function normalizePlumbingUtilityConnections(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map(entry => {
      if (typeof entry === 'string') return { label: entry.slice(0, 120) };
      if (!entry || typeof entry !== 'object') return null;
      const label = String(entry.label || entry.name || '').trim();
      if (!label) return null;
      const next = {
        label: label.slice(0, 120),
        status: String(entry.status || 'scope_only').trim() === 'confirmed' ? 'confirmed' : 'scope_only',
      };
      const evidence = normalizePlumbingFieldEvidence({
        gasLineLf: entry.evidence || [],
      }).gasLineLf;
      if (evidence?.length) next.evidence = evidence;
      return next;
    })
    .filter(Boolean)
    .slice(0, 16);
}

function applyPlumbingVisionTakeoff(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  parsed.measurements = normalizePlumbingPlanMeasurements(parsed.measurements);
  parsed.explicitlyLabeled = remapPlumbingKeys(parsed.explicitlyLabeled);
  parsed.geometryDerived = remapPlumbingKeys(parsed.geometryDerived);
  parsed.inferredKeys = remapPlumbingKeys(parsed.inferredKeys);
  parsed.fieldEvidence = normalizePlumbingFieldEvidence(parsed.fieldEvidence || parsed.planFacts?.fieldEvidence);
  const supportedKeys = new Set([...parsed.explicitlyLabeled, ...parsed.geometryDerived]);
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
  if (parsed.fixtureInventory && typeof parsed.fixtureInventory === 'object') {
    const inventory = {};
    for (const [key, value] of Object.entries(parsed.fixtureInventory)) {
      const count = positive(value);
      if (count != null) inventory[key] = Math.round(count);
    }
    parsed.fixtureInventory = inventory;
  }
  parsed.utilityConnections = normalizePlumbingUtilityConnections(parsed.utilityConnections);
  return parsed;
}

module.exports = {
  PLUMBING_MEASUREMENT_KEYS,
  PLUMBING_PLAN_ALIASES,
  PLUMBING_EXPLICIT_ONLY_KEYS,
  PLUMBING_VISION_INSTRUCTIONS,
  normalizePlumbingPlanMeasurements,
  normalizePlumbingFieldEvidence,
  normalizePlumbingUtilityConnections,
  applyPlumbingVisionTakeoff,
};
