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
  'plumbingFixturesHardwareCount',
  'waterHeaterCount',
  'gasApplianceConnectionCount',
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
  plumbingTrimHookupCount: 'plumbingTrimHookupCount',
  plumbingFixturesHardwareCount: 'plumbingFixturesHardwareCount',
  fixturesHardwareCount: 'plumbingFixturesHardwareCount',
  waterHeaterCount: 'waterHeaterCount',
  waterHeaters: 'waterHeaterCount',
  gasApplianceConnectionCount: 'gasApplianceConnectionCount',
  gasApplianceConnections: 'gasApplianceConnectionCount',
  partsCount: 'partsMaterialsCount',
  plumbingPartsCount: 'partsMaterialsCount',
  emergencyCount: 'emergencyFeeCount',
  cleanupCount: 'plumbingCleanupCount',
};

/** Each counted fixture connection maps to one rough-in point and one trim hookup. */
const PLUMBING_FIXTURE_ROUGH_IN_KEYS = [
  'toilets',
  'lavatories',
  'showers',
  'tubs',
  'kitchenSinks',
  'dishwasherConnections',
  'laundryBoxes',
  'hoseBibs',
  'floorDrains',
  'waterHeaters',
];

/** Rough/trim counts exclude water heaters — those bill on the WH card. */
const PLUMBING_FIXTURE_CONNECTION_KEYS = PLUMBING_FIXTURE_ROUGH_IN_KEYS.filter(
  key => key !== 'waterHeaters'
);

const PLUMBING_FIXTURE_INVENTORY_ALIASES = {
  toilet: 'toilets',
  toilets: 'toilets',
  lavatory: 'lavatories',
  lavatories: 'lavatories',
  sink: 'lavatories',
  sinks: 'lavatories',
  shower: 'showers',
  showers: 'showers',
  tub: 'tubs',
  tubs: 'tubs',
  tubShower: 'tubs',
  kitchenSink: 'kitchenSinks',
  kitchenSinks: 'kitchenSinks',
  dishwasher: 'dishwasherConnections',
  dishwasherConnections: 'dishwasherConnections',
  laundry: 'laundryBoxes',
  laundryBox: 'laundryBoxes',
  laundryBoxes: 'laundryBoxes',
  washerBox: 'laundryBoxes',
  hoseBib: 'hoseBibs',
  hoseBibs: 'hoseBibs',
  floorDrain: 'floorDrains',
  floorDrains: 'floorDrains',
  waterHeater: 'waterHeaters',
  waterHeaters: 'waterHeaters',
  gasAppliance: 'gasAppliances',
  gasAppliances: 'gasAppliances',
};

const PLUMBING_LINE_LF_KEYS = ['waterLineLf', 'sewerLineLf', 'gasLineLf'];

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
  'plumbingFixturesHardwareCount',
  'waterHeaterCount',
  'gasApplianceConnectionCount',
  'partsMaterialsCount',
  'emergencyFeeCount',
  'plumbingCleanupCount',
]);

const PLUMBING_VISION_INSTRUCTIONS = `
Plumbing takeoff contract:
- Inspect plumbing plans, fixture schedules, risers, details, water/sewer plans, and plumbing notes.
- Return only quantities that are explicitly printed, scheduled, counted from a readable plumbing symbol/fixture schedule, or measured from labeled geometry.
- REQUIRED: Whenever you read a fixture schedule or set plumbingRoughPointCount from fixtures, populate fixtureInventory with per-type counts (toilets, lavatories, showers, tubs, kitchenSinks, dishwasherConnections, laundryBoxes, hoseBibs, floorDrains, waterHeaters). Put the same counts in fieldEvidence.fixtureCounts when helpful. The sum of fixture connection counts must match plumbingRoughPointCount.
- Derive plumbingRoughPointCount and plumbingTrimHookupCount only from an explicit fixture schedule or clearly counted fixture inventory. Mark those fields geometryDerived and include derivedFrom in fieldEvidence. Never derive them from living area, room count, or a generic bathroom count.
- Return waterHeaterDetail when a water heater is shown or scheduled: { count, type (tank|tankless|hybrid), fuel (gas|electric|propane), location, confidence }.
- Return gasApplianceScope when gas appliances appear: { range, waterHeater, fireplace, dryer, grill } booleans plus gasPipingRequired when any gas scope is present. Do not invent gasLineLf from appliance symbols alone.
- Use canonical fields only: serviceCallCount, fixtureRepairCount, fixtureReplacementCount, drainCleaningCount, waterLineLf, sewerLineLf, gasLineLf, plumbingRoughPointCount, plumbingTrimHookupCount, partsMaterialsCount, emergencyFeeCount, and plumbingCleanupCount.
- WaterLineLf and sewerLineLf require readable dimensions or a labeled length. Do not estimate length from fixture count, room count, or living area.
- GasLineLf requires a readable gas-piping dimension or labeled length. Appliance symbols identify gas scope only; they do not establish LF.
- Return utilityConnections as scope/allowance confirmations (for example municipal water, sewer, gas, tap, meter, or utility-provider work). Do not convert utility connections into LF or EA measurements.
- Return complexityFactors only when the plan explicitly shows or notes the condition: two-story plumbing, slab foundation, multiple wet walls, tankless water heater, recirculation loop, outdoor plumbing, or gas appliances. These are review flags only; never change pricing automatically from them.
- When total living area and/or story count is readable on the cover sheet or floor plans, populate planFacts.buildingAreas.totalLivingSqft and planFacts.storyCount (1, 2, or 3) with fieldEvidence. storyCount is required when the plan shows upper/second floor areas or labels the home as two-story. These planFacts drive project-complexity labor adjustment in Confirm Scope only — never use living SF or story count to derive plumbing rough/trim/LF/EA quantities.
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
        if (entry.fixtureCounts && typeof entry.fixtureCounts === 'object') {
          next.fixtureCounts = entry.fixtureCounts;
        }
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

function normalizePlumbingFixtureInventory(raw) {
  const inventory = {};
  if (!raw || typeof raw !== 'object') return inventory;
  for (const [rawKey, value] of Object.entries(raw)) {
    const key = PLUMBING_FIXTURE_INVENTORY_ALIASES[rawKey] || rawKey;
    const count = positive(value);
    if (count == null) continue;
    inventory[key] = (inventory[key] || 0) + Math.round(count);
  }
  return inventory;
}

function sumPlumbingFixtureRoughInPoints(inventory) {
  let total = 0;
  for (const key of PLUMBING_FIXTURE_CONNECTION_KEYS) {
    const count = positive(inventory?.[key]);
    if (count != null) total += Math.round(count);
  }
  return total > 0 ? total : null;
}

function resolvePlumbingFixturesHardwareCount(input = {}) {
  const measurements = input.measurements || {};
  const inventory = input.inventory || input.fixtureInventory || {};
  const trim = positive(measurements.plumbingTrimHookupCount);
  const rough = positive(measurements.plumbingRoughPointCount);
  const scheduleCount = trim != null && rough != null ? Math.min(trim, rough) : trim ?? rough;
  if (scheduleCount != null) return scheduleCount;

  const fromInventory = sumPlumbingFixturesHardwareCount(inventory);
  const explicit = positive(measurements.plumbingFixturesHardwareCount);
  const whCount =
    resolvePlumbingWaterHeaterCount(inventory, input.waterHeaterDetail) || 0;
  const raw = explicit ?? fromInventory;
  if (raw == null) return null;
  if (whCount > 0 && raw > whCount && raw <= whCount + 2) {
    const adjusted = raw - whCount;
    if (adjusted > 0) return adjusted;
  }
  return raw;
}

function resolvePlumbingGasApplianceConnectionCount(gasApplianceScope, inventory) {
  const fromScope = countPlumbingGasApplianceConnections(gasApplianceScope);
  const fromInventory = positive(inventory?.gasAppliances);
  if (fromScope != null && fromInventory != null) {
    return Math.max(fromScope, Math.round(fromInventory));
  }
  return fromScope ?? (fromInventory != null ? Math.round(fromInventory) : null);
}

function mergeFixtureCountObject(target, counts) {
  if (!counts || typeof counts !== 'object') return;
  for (const [rawKey, value] of Object.entries(counts)) {
    const key = PLUMBING_FIXTURE_INVENTORY_ALIASES[rawKey] || rawKey;
    if (!PLUMBING_FIXTURE_ROUGH_IN_KEYS.includes(key) && key !== 'gasAppliances') continue;
    const count = positive(value);
    if (count != null) target[key] = Math.max(target[key] || 0, Math.round(count));
  }
}

/** Backfill fixtureInventory from fieldEvidence when vision returns counts without inventory. */
function reconcilePlumbingFixtureInventory(input = {}) {
  const out = normalizePlumbingFixtureInventory(input.inventory || input.fixtureInventory || {});
  for (const entries of Object.values(input.fieldEvidence || {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      mergeFixtureCountObject(out, entry.fixtureCounts);
      mergeFixtureCountObject(out, entry.inventory);
    }
  }
  return out;
}

function normalizePlumbingWaterHeaterDetail(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const count = positive(raw.count) ?? positive(raw.quantity) ?? 1;
  const type = String(raw.type || raw.heaterType || '').trim() || null;
  const fuel = String(raw.fuel || raw.fuelType || '').trim() || null;
  const location = String(raw.location || '').trim() || null;
  const confidence = Number(raw.confidence);
  if (!type && !fuel && !location && count == null) return null;
  const next = { count: count ?? 1 };
  if (type) next.type = type.slice(0, 40);
  if (fuel) next.fuel = fuel.slice(0, 24);
  if (location) next.location = location.slice(0, 80);
  if (Number.isFinite(confidence)) next.confidence = Math.max(0, Math.min(1, confidence));
  return next;
}

function normalizePlumbingGasApplianceScope(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const bool = value =>
    value === true || value === 'true' || value === 'yes' || value === 'YES' ? true : null;
  const next = {};
  for (const key of ['range', 'waterHeater', 'fireplace', 'dryer', 'grill']) {
    const value = bool(raw[key]);
    if (value != null) next[key] = value;
  }
  const gasPipingRequired =
    raw.gasPipingRequired === true ||
    raw.gasPipingRequired === 'true' ||
    raw.gasPipingRequired === 'yes' ||
    Object.values(next).some(value => value === true);
  if (gasPipingRequired) next.gasPipingRequired = true;
  if (!Object.keys(next).length) return null;
  const confidence = Number(raw.confidence);
  if (Number.isFinite(confidence)) next.confidence = Math.max(0, Math.min(1, confidence));
  return next;
}

function classifyPlumbingSheetKind(sheet) {
  const normalized = String(sheet || '')
    .trim()
    .toUpperCase();
  if (!normalized) return 'unknown';
  if (/^P[\d.-]/.test(normalized) || /\bPLUMB/.test(normalized)) return 'plumbing';
  if (/^A[\d.-]/.test(normalized) || /\bARCH/.test(normalized)) return 'architectural';
  if (/^S[\d.-]/.test(normalized) || /\bSITE/.test(normalized)) return 'site';
  if (/^C[\d.-]/.test(normalized) || /\bCIVIL/.test(normalized)) return 'civil';
  return 'unknown';
}

/** Fixture product keys — excludes water heaters counted on the WH card. */
const PLUMBING_FIXTURE_HARDWARE_KEYS = PLUMBING_FIXTURE_ROUGH_IN_KEYS.filter(
  key => key !== 'waterHeaters'
);

function sumPlumbingFixturesHardwareCount(inventory) {
  let total = 0;
  for (const key of PLUMBING_FIXTURE_HARDWARE_KEYS) {
    const count = positive(inventory?.[key]);
    if (count != null) total += Math.round(count);
  }
  return total > 0 ? total : null;
}

function countPlumbingGasApplianceConnections(scope) {
  if (!scope || typeof scope !== 'object') return null;
  let total = 0;
  for (const key of ['range', 'fireplace', 'dryer', 'grill']) {
    if (scope[key]) total += 1;
  }
  return total > 0 ? total : null;
}

function hasGasAppliancesComplexityFactor(complexityFactors) {
  return (Array.isArray(complexityFactors) ? complexityFactors : []).some(factor => {
    const key = String(factor?.key || '').trim();
    const label = String(factor?.label || '').trim();
    return key === 'gas_appliances' || /\bgas\s*appliance/i.test(`${key} ${label}`);
  });
}

/** Expand partial gas scope to the standard production-home trio when gas piping is documented. */
function expandResidentialGasApplianceScope(scope, options = {}) {
  const normalized = normalizePlumbingGasApplianceScope(scope);
  const gasLf = positive(options.measurements?.gasLineLf);
  const count = countPlumbingGasApplianceConnections(normalized) || 0;
  if (count >= 3) return normalized;

  const hasGasPiping = Boolean(normalized?.gasPipingRequired) || gasLf >= 20;
  if (!hasGasPiping) return normalized;

  return normalizePlumbingGasApplianceScope({
    ...(normalized || {}),
    gasPipingRequired: true,
    range: true,
    fireplace: true,
    dryer: true,
  });
}

function inferPlumbingWaterHeaterFromGasPiping(input = {}) {
  const inventory = normalizePlumbingFixtureInventory(input.fixtureInventory);
  const existing = normalizePlumbingWaterHeaterDetail(input.waterHeaterDetail);
  if (positive(inventory.waterHeaters) > 0 || existing) {
    return existing;
  }
  const gasLf = positive(input.measurements?.gasLineLf);
  const gasScope = normalizePlumbingGasApplianceScope(input.gasApplianceScope);
  if (!(gasLf >= 20 || gasScope?.gasPipingRequired)) return null;
  if (/\belectric\b/i.test(collectPlumbingFieldEvidenceText(input.fieldEvidence))) {
    return normalizePlumbingWaterHeaterDetail({ count: 1, fuel: 'electric' });
  }
  return normalizePlumbingWaterHeaterDetail({ count: 1, fuel: 'gas' });
}

function collectPlumbingFieldEvidenceText(fieldEvidence) {
  const parts = [];
  for (const entries of Object.values(fieldEvidence || {})) {
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry || typeof entry !== 'object') continue;
      for (const key of ['sourceText', 'label', 'sheet']) {
        const value = String(entry[key] || '').trim();
        if (value) parts.push(value);
      }
    }
  }
  return parts.join(' ');
}

function parsePlumbingEquipmentFromTextBlob(blob) {
  const text = String(blob || '');
  if (!text.trim()) {
    return { waterHeaterDetail: null, gasApplianceScope: null };
  }
  const gasApplianceScope = {};
  for (const { key, re } of [
    { key: 'range', re: /\b(?:gas\s*)?(?:range|cooktop|oven)(?:\s*\/\s*oven)?\b/i },
    {
      key: 'fireplace',
      re: /\b(?:gas\s*)?(?:fireplace|fire\s*place|gas\s*log(?:s)?|g\.?\s*f\.?)\b|\bfp\b/i,
    },
    {
      key: 'dryer',
      re: /\b(?:gas\s*)?(?:dryer|clothes\s*dryer)(?:\s*(?:conn(?:ection)?|hookup|outlet))?/i,
    },
    { key: 'grill', re: /\b(?:gas\s*)?(?:grill|bbq|barbecue)\b/i },
  ]) {
    if (re.test(text)) gasApplianceScope[key] = true;
  }
  let waterHeaterDetail = null;
  if (/\b(?:water\s*heaters?|w\.?\s*h\.?)\b/i.test(text)) {
    waterHeaterDetail = { count: 1 };
    if (/\btankless\b/i.test(text)) waterHeaterDetail.type = 'tankless';
    else if (/\btank\b/i.test(text)) waterHeaterDetail.type = 'tank';
    if (/\bgas\b/i.test(text)) waterHeaterDetail.fuel = 'gas';
    else if (/\belectric\b/i.test(text)) waterHeaterDetail.fuel = 'electric';
    const trailing = text.match(
      /\b(?:water\s*heaters?|w\.?\s*h\.?)(?:\s+[^0-9-][^0-9]{0,20}){0,2}\s+(\d{1,2})\b/i
    );
    const leading = text.match(/\b(\d{1,2})\s+(?:water\s*heaters?|w\.?\s*h\.?)\b/i);
    const count = Number(trailing?.[1] || leading?.[1]);
    if (Number.isFinite(count) && count > 0) waterHeaterDetail.count = Math.round(count);
  }
  const hasGas = Object.keys(gasApplianceScope).length > 0;
  return {
    waterHeaterDetail,
    gasApplianceScope: hasGas ? gasApplianceScope : null,
  };
}

function mergePlumbingWaterHeaterDetail(existing, incoming) {
  const left = normalizePlumbingWaterHeaterDetail(existing);
  const right = normalizePlumbingWaterHeaterDetail(incoming);
  if (!left) return right;
  if (!right) return left;
  return normalizePlumbingWaterHeaterDetail({
    count: Math.max(Number(left.count) || 1, Number(right.count) || 1),
    type: left.type || right.type,
    fuel: left.fuel || right.fuel,
    location: left.location || right.location,
    confidence: Math.max(Number(left.confidence) || 0, Number(right.confidence) || 0) || undefined,
  });
}

function mergePlumbingGasApplianceScope(existing, incoming) {
  const left = normalizePlumbingGasApplianceScope(existing) || {};
  const right = normalizePlumbingGasApplianceScope(incoming) || {};
  const next = { ...left, ...right };
  for (const key of ['range', 'waterHeater', 'fireplace', 'dryer', 'grill']) {
    if (left[key] || right[key]) next[key] = true;
  }
  return normalizePlumbingGasApplianceScope(next);
}

function inferPlumbingEquipmentFromComplexityFactors(complexityFactors) {
  let waterHeaterDetail = null;
  let gasApplianceScope = null;
  for (const factor of Array.isArray(complexityFactors) ? complexityFactors : []) {
    const key = String(factor?.key || '').trim();
    const label = String(factor?.label || '').trim();
    const blob = `${key} ${label}`.trim();
    if (!blob) continue;
    if (key === 'tankless_water_heater' || /\btankless\b/i.test(blob)) {
      waterHeaterDetail = mergePlumbingWaterHeaterDetail(waterHeaterDetail, {
        count: 1,
        type: 'tankless',
      });
    } else if (/\bwater\s*heater\b|\bw\.?\s*h\.?\b/i.test(blob) && key !== 'gas_appliances') {
      waterHeaterDetail = mergePlumbingWaterHeaterDetail(waterHeaterDetail, { count: 1 });
    }
    if (key === 'gas_appliances' || /\bgas\s*appliance/i.test(blob)) {
      const parsed = parsePlumbingEquipmentFromTextBlob(blob);
      gasApplianceScope = mergePlumbingGasApplianceScope(
        gasApplianceScope,
        parsed.gasApplianceScope || { gasPipingRequired: true }
      );
    }
  }
  return { waterHeaterDetail, gasApplianceScope };
}

function inferPlumbingEquipmentFromPlanContext(input = {}) {
  const inventory = normalizePlumbingFixtureInventory(input.fixtureInventory);
  let waterHeaterDetail = normalizePlumbingWaterHeaterDetail(input.waterHeaterDetail);
  let gasApplianceScope = normalizePlumbingGasApplianceScope(input.gasApplianceScope);

  if (positive(inventory.waterHeaters) > 0) {
    waterHeaterDetail = mergePlumbingWaterHeaterDetail(waterHeaterDetail, {
      count: Math.round(positive(inventory.waterHeaters)),
    });
  }

  const pdfHints = input.pdfEquipmentHints || input.pdfTakeoff?.plumbingEquipmentHints || null;
  if (pdfHints?.waterHeaterDetail) {
    waterHeaterDetail = mergePlumbingWaterHeaterDetail(waterHeaterDetail, pdfHints.waterHeaterDetail);
  }
  if (pdfHints?.gasApplianceScope) {
    gasApplianceScope = mergePlumbingGasApplianceScope(gasApplianceScope, pdfHints.gasApplianceScope);
  }

  const evidenceParsed = parsePlumbingEquipmentFromTextBlob(
    [
      pdfHints?.textCorpus,
      collectPlumbingFieldEvidenceText(input.fieldEvidence),
    ]
      .filter(Boolean)
      .join(' ')
  );
  if (evidenceParsed.waterHeaterDetail) {
    waterHeaterDetail = mergePlumbingWaterHeaterDetail(waterHeaterDetail, evidenceParsed.waterHeaterDetail);
  }
  if (evidenceParsed.gasApplianceScope) {
    gasApplianceScope = mergePlumbingGasApplianceScope(gasApplianceScope, evidenceParsed.gasApplianceScope);
  }

  const complexityParsed = inferPlumbingEquipmentFromComplexityFactors(input.complexityFactors);
  if (complexityParsed.waterHeaterDetail) {
    waterHeaterDetail = mergePlumbingWaterHeaterDetail(waterHeaterDetail, complexityParsed.waterHeaterDetail);
  }
  if (complexityParsed.gasApplianceScope) {
    gasApplianceScope = mergePlumbingGasApplianceScope(gasApplianceScope, complexityParsed.gasApplianceScope);
  }

  return {
    fixtureInventory: inventory,
    waterHeaterDetail:
      inferPlumbingWaterHeaterFromGasPiping({
        fixtureInventory: inventory,
        waterHeaterDetail,
        gasApplianceScope,
        measurements: input.measurements,
        fieldEvidence: input.fieldEvidence,
      }) || waterHeaterDetail,
    gasApplianceScope: expandResidentialGasApplianceScope(gasApplianceScope, {
      measurements: input.measurements,
      complexityFactors: input.complexityFactors,
    }),
  };
}

function resolvePlumbingWaterHeaterCount(inventory, waterHeaterDetail) {
  const fromInventory = positive(inventory?.waterHeaters);
  if (fromInventory != null) return Math.round(fromInventory);
  if (!waterHeaterDetail) return null;
  return Math.max(1, positive(waterHeaterDetail.count) ?? 1);
}

function derivePlumbingEquipmentCounts(input = {}) {
  const inventory = normalizePlumbingFixtureInventory(input.inventory || input.fixtureInventory);
  const measurements = { ...(input.measurements || {}) };
  const fieldEvidence = { ...(input.fieldEvidence || {}) };
  const fieldConfidence = { ...(input.fieldConfidence || {}) };
  const geometryDerived = [...(Array.isArray(input.geometryDerived) ? input.geometryDerived : [])];
  let changed = false;

  const assignDerived = (key, value, label, { overwrite = false } = {}) => {
    if (value == null) return;
    const existing = positive(measurements[key]);
    if (existing != null && !overwrite && existing !== value) return;
    if (existing === value) return;
    measurements[key] = value;
    fieldEvidence[key] = [
      {
        evidenceKind: 'plan_scope_derived',
        sourceType: 'plan_vision',
        confidence: 0.75,
        label,
        sourceText: `Derived ${value} ${label} from plan takeoff`,
      },
    ];
    fieldConfidence[key] = Math.max(fieldConfidence[key] || 0, 0.75);
    if (!geometryDerived.includes(key)) geometryDerived.push(key);
    changed = true;
  };

  const fixturesHardware = resolvePlumbingFixturesHardwareCount({
    measurements,
    inventory,
    waterHeaterDetail: input.waterHeaterDetail,
  });
  const existingFixtures = positive(measurements.plumbingFixturesHardwareCount);
  assignDerived(
    'plumbingFixturesHardwareCount',
    fixturesHardware,
    'fixture & hardware allowances',
    {
      overwrite:
        fixturesHardware != null &&
        existingFixtures != null &&
        existingFixtures !== fixturesHardware,
    }
  );
  assignDerived(
    'waterHeaterCount',
    resolvePlumbingWaterHeaterCount(inventory, input.waterHeaterDetail),
    'water heater(s)'
  );
  const gasConnections = resolvePlumbingGasApplianceConnectionCount(
    input.gasApplianceScope,
    inventory
  );
  const existingGasConnections = positive(measurements.gasApplianceConnectionCount);
  assignDerived(
    'gasApplianceConnectionCount',
    gasConnections,
    'gas appliance connections',
    {
      overwrite:
        gasConnections != null &&
        (existingGasConnections == null || gasConnections > existingGasConnections),
    }
  );

  return {
    inventory,
    measurements,
    fieldEvidence,
    fieldConfidence,
    geometryDerived,
    changed,
  };
}

function derivePlumbingCountsFromFixtureInventory(input = {}) {
  const inventory = normalizePlumbingFixtureInventory(input.inventory || input.fixtureInventory);
  const total = sumPlumbingFixtureRoughInPoints(inventory);
  const measurements = { ...(input.measurements || {}) };
  const fieldEvidence = { ...(input.fieldEvidence || {}) };
  const fieldConfidence = { ...(input.fieldConfidence || {}) };
  const geometryDerived = [...(Array.isArray(input.geometryDerived) ? input.geometryDerived : [])];
  if (!total) {
    return {
      inventory,
      measurements,
      fieldEvidence,
      fieldConfidence,
      geometryDerived,
      changed: false,
    };
  }

  const derivedFrom = Object.entries(inventory)
    .filter(([, count]) => positive(count) > 0)
    .map(([key]) => key);
  let changed = false;
  for (const [key, label] of [
    ['plumbingRoughPointCount', 'rough-in points'],
    ['plumbingTrimHookupCount', 'trim / hookups'],
  ]) {
    if (positive(measurements[key]) != null) continue;
    measurements[key] = total;
    fieldEvidence[key] = [
      {
        evidenceKind: 'fixture_inventory_derived',
        derivedFrom,
        sourceType: 'plan_vision',
        confidence: 0.75,
        label: 'Fixture inventory',
        sourceText: `Derived ${total} ${label} from fixture inventory`,
      },
    ];
    fieldConfidence[key] = Math.max(fieldConfidence[key] || 0, 0.75);
    if (!geometryDerived.includes(key)) geometryDerived.push(key);
    changed = true;
  }
  return {
    inventory,
    measurements,
    fieldEvidence,
    fieldConfidence,
    geometryDerived,
    changed,
  };
}

function applyPlumbingLineScopeWarnings(input = {}) {
  const measurements = input.measurements || {};
  const fieldEvidence = { ...(input.fieldEvidence || {}) };
  const inferredKeys = new Set(Array.isArray(input.inferredKeys) ? input.inferredKeys : []);
  for (const key of PLUMBING_LINE_LF_KEYS) {
    if (positive(measurements[key]) == null) continue;
    const evidence = Array.isArray(fieldEvidence[key]) ? fieldEvidence[key] : [];
    const sheetKinds = evidence.map(entry => classifyPlumbingSheetKind(entry?.sheet)).filter(Boolean);
    const sheetKind = sheetKinds.includes('plumbing')
      ? 'plumbing'
      : sheetKinds.includes('site') || sheetKinds.includes('civil')
        ? 'site'
        : sheetKinds.includes('architectural')
          ? 'architectural'
          : sheetKinds[0] || 'unknown';
    if (sheetKind === 'architectural' || sheetKind === 'unknown') {
      inferredKeys.add(key);
      fieldEvidence[key] = (evidence.length ? evidence : [{}]).map(entry => ({
        ...entry,
        evidenceKind: entry.evidenceKind || 'architectural_line_segment',
        requiresContractorConfirmation: true,
        sourceText:
          entry.sourceText ||
          'LF may be a partial segment on an architectural sheet — confirm underground scope before pricing',
      }));
    }
  }
  return {
    fieldEvidence,
    inferredKeys: [...inferredKeys],
  };
}

function buildPlumbingReviewStatus(input = {}) {
  const inventory = normalizePlumbingFixtureInventory(input.fixtureInventory);
  const inventoryTotal = sumPlumbingFixtureRoughInPoints(inventory);
  const measurements = input.measurements || {};
  const detected = [];
  const needsConfirmation = [];
  const notFound = [];

  if (inventoryTotal > 0) {
    detected.push(
      `${inventoryTotal} plumbing fixture connection${inventoryTotal === 1 ? '' : 's'} from fixture inventory`
    );
  }
  if (positive(measurements.plumbingRoughPointCount) > 0) {
    detected.push(`${measurements.plumbingRoughPointCount} rough-in points`);
  }
  if (positive(measurements.plumbingTrimHookupCount) > 0) {
    detected.push(`${measurements.plumbingTrimHookupCount} trim / hookups`);
  }
  if (positive(inventory.waterHeaters) > 0) {
    detected.push(`${inventory.waterHeaters} water heater${inventory.waterHeaters === 1 ? '' : 's'}`);
  }
  if (positive(inventory.gasAppliances) > 0) {
    detected.push(`${inventory.gasAppliances} gas appliance${inventory.gasAppliances === 1 ? '' : 's'}`);
  }
  const waterHeaterDetail = normalizePlumbingWaterHeaterDetail(input.waterHeaterDetail);
  if (waterHeaterDetail) {
    const parts = [
      `${waterHeaterDetail.count || 1} water heater${waterHeaterDetail.count === 1 ? '' : 's'}`,
      waterHeaterDetail.type,
      waterHeaterDetail.fuel,
      waterHeaterDetail.location,
    ].filter(Boolean);
    detected.push(parts.join(' · '));
  }
  const gasScope = normalizePlumbingGasApplianceScope(input.gasApplianceScope);
  if (gasScope?.gasPipingRequired) {
    const appliances = ['range', 'waterHeater', 'fireplace', 'dryer', 'grill']
      .filter(key => gasScope[key])
      .map(key => key.replace(/([A-Z])/g, ' $1').trim());
    if (appliances.length) {
      detected.push(`Gas appliances: ${appliances.join(', ')}`);
    }
    if (positive(input.measurements?.gasLineLf) == null) {
      needsConfirmation.push('Gas piping length — confirm LF');
    }
  }

  for (const [key, label] of [
    ['waterLineLf', 'Water line'],
    ['sewerLineLf', 'Sewer / drain line'],
    ['gasLineLf', 'Gas piping'],
  ]) {
    const value = positive(measurements[key]);
    if (value == null) continue;
    const evidence = input.fieldEvidence?.[key] || [];
    const needsConfirm =
      evidence.some(entry => entry?.requiresContractorConfirmation) ||
      evidence.some(entry => entry?.evidenceKind === 'architectural_line_segment') ||
      evidence
        .map(entry => classifyPlumbingSheetKind(entry?.sheet))
        .every(kind => kind === 'architectural' || kind === 'unknown');
    if (needsConfirm) {
      needsConfirmation.push(`${label}: ${value} LF detected — confirm underground / full scope before pricing`);
    } else {
      detected.push(`${label}: ${value} LF`);
    }
  }

  for (const connection of Array.isArray(input.utilityConnections) ? input.utilityConnections : []) {
    if (connection?.label) {
      needsConfirmation.push(`${connection.label} — confirm scope/allowance`);
    }
  }

  for (const factor of Array.isArray(input.complexityFactors) ? input.complexityFactors : []) {
    if (factor?.label) {
      needsConfirmation.push(`${factor.label} — review only`);
    }
  }

  const pages = Array.isArray(input.plumbingRelevantPages) ? input.plumbingRelevantPages : [];
  const pageReasons = pages.flatMap(page => (Array.isArray(page.reasons) ? page.reasons : []));
  const evidenceSheets = Object.values(input.fieldEvidence || {})
    .flat()
    .map(entry => classifyPlumbingSheetKind(entry?.sheet));
  const hasPlumbingSheet =
    pageReasons.some(reason => /P sheet|plumbing plan|plumbing riser/i.test(reason)) ||
    pages.some(page => classifyPlumbingSheetKind(page?.sheet) === 'plumbing') ||
    evidenceSheets.includes('plumbing');
  const hasFixtureSchedule = pageReasons.some(reason => /fixture schedule/i.test(reason));
  const hasRiser = pageReasons.some(reason => /riser|isometric/i.test(reason));

  if (!hasFixtureSchedule && inventoryTotal === 0) {
    notFound.push('Plumbing fixture schedule');
  }
  if (!hasRiser) {
    notFound.push('Plumbing riser diagram');
  }
  if (!hasPlumbingSheet && !hasFixtureSchedule) {
    notFound.push('Dedicated plumbing sheets (P sheets)');
  }

  if (inventoryTotal === 0 && positive(measurements.plumbingRoughPointCount) == null) {
    needsConfirmation.push('Fixture and connection counts');
  }
  if (positive(measurements.plumbingRoughPointCount) == null) {
    needsConfirmation.push('Rough-in points');
  }
  if (positive(measurements.waterLineLf) == null) {
    needsConfirmation.push('Underground water service length');
  }
  if (positive(measurements.sewerLineLf) == null) {
    needsConfirmation.push('Underground sewer / DWV length');
  }
  if (positive(inventory.gasAppliances) > 0 && positive(measurements.gasLineLf) == null) {
    needsConfirmation.push('Gas piping length');
  }

  return {
    detected: [...new Set(detected)].slice(0, 12),
    needsConfirmation: [...new Set(needsConfirmation)].slice(0, 12),
    notFound: [...new Set(notFound)].slice(0, 8),
  };
}

function mergePlumbingPdfFixtureSchedule(input = {}) {
  const schedule = input.pdfTakeoff?.plumbingFixtureSchedule;
  const scheduleInventory = schedule?.inventory;
  if (!scheduleInventory || typeof scheduleInventory !== 'object') {
    return input;
  }
  if (!Object.values(scheduleInventory).some(count => positive(count) > 0)) {
    return input;
  }
  const fieldEvidence = { ...(input.fieldEvidence || {}) };
  const scheduleEvidence = {
    evidenceKind: 'fixture_schedule_pdf_text',
    sourceType: 'pdf_text',
    confidence: 0.9,
    label: 'Fixture schedule',
    sourceText: `Fixture counts from PDF text layer${
      Array.isArray(schedule.pages) && schedule.pages.length
        ? ` (page ${schedule.pages.map(entry => entry.page).filter(Boolean).join(', ')})`
        : ''
    }`,
    fixtureCounts: scheduleInventory,
  };
  for (const key of ['plumbingRoughPointCount', 'plumbingTrimHookupCount']) {
    fieldEvidence[key] = [...(Array.isArray(fieldEvidence[key]) ? fieldEvidence[key] : []), scheduleEvidence].slice(
      0,
      16
    );
  }
  const fixtureInventory = reconcilePlumbingFixtureInventory({
    inventory: { ...(input.fixtureInventory || {}), ...scheduleInventory },
    fieldEvidence,
  });
  return {
    ...input,
    fixtureInventory,
    fieldEvidence,
  };
}

function finalizePlumbingTakeoff(input = {}) {
  const inferredEquipment = inferPlumbingEquipmentFromPlanContext({
    fixtureInventory: input.fixtureInventory,
    waterHeaterDetail: input.waterHeaterDetail,
    gasApplianceScope: input.gasApplianceScope,
    fieldEvidence: input.fieldEvidence,
    complexityFactors: input.complexityFactors,
    measurements: input.measurements,
    pdfTakeoff: input.pdfTakeoff,
    pdfEquipmentHints: input.pdfEquipmentHints,
  });
  const reconciledInventory = reconcilePlumbingFixtureInventory({
    inventory: inferredEquipment.fixtureInventory,
    fieldEvidence: input.fieldEvidence,
  });
  const waterHeaterDetail = inferredEquipment.waterHeaterDetail;
  const gasApplianceScope = inferredEquipment.gasApplianceScope;
  const derived = derivePlumbingCountsFromFixtureInventory({
    inventory: reconciledInventory,
    measurements: input.measurements,
    fieldEvidence: input.fieldEvidence,
    fieldConfidence: input.fieldConfidence,
    geometryDerived: input.geometryDerived,
  });
  const equipment = derivePlumbingEquipmentCounts({
    inventory: derived.inventory,
    measurements: derived.measurements,
    fieldEvidence: derived.fieldEvidence,
    fieldConfidence: derived.fieldConfidence,
    geometryDerived: derived.geometryDerived,
    waterHeaterDetail,
    gasApplianceScope,
  });
  const lineWarnings = applyPlumbingLineScopeWarnings({
    measurements: equipment.measurements,
    fieldEvidence: equipment.fieldEvidence,
    inferredKeys: input.inferredKeys,
  });
  const inferredKeys = remapPlumbingKeys(lineWarnings.inferredKeys);
  const reviewStatus = buildPlumbingReviewStatus({
    fixtureInventory: derived.inventory,
    measurements: equipment.measurements,
    fieldEvidence: lineWarnings.fieldEvidence,
    utilityConnections: input.utilityConnections,
    complexityFactors: input.complexityFactors,
    plumbingRelevantPages: input.plumbingRelevantPages,
    waterHeaterDetail,
    gasApplianceScope,
  });
  return {
    fixtureInventory: derived.inventory,
    waterHeaterDetail,
    gasApplianceScope,
    measurements: normalizePlumbingPlanMeasurements(equipment.measurements),
    fieldEvidence: lineWarnings.fieldEvidence,
    fieldConfidence: equipment.fieldConfidence,
    geometryDerived: remapPlumbingKeys(equipment.geometryDerived),
    inferredKeys,
    plumbingReviewStatus: reviewStatus,
    changed: derived.changed || equipment.changed || lineWarnings.inferredKeys.length > 0,
  };
}

function normalizePlumbingComplexityFactors(raw) {
  const allowed = new Set([
    'two_story_plumbing',
    'slab_foundation',
    'multiple_wet_walls',
    'tankless_water_heater',
    'recirculation_loop',
    'outdoor_plumbing',
    'gas_appliances',
  ]);
  return (Array.isArray(raw) ? raw : [])
    .map(entry => {
      if (typeof entry === 'string') {
        const label = entry.trim();
        if (!label) return null;
        return { label: label.slice(0, 120), status: 'review' };
      }
      if (!entry || typeof entry !== 'object') return null;
      const label = String(entry.label || entry.name || '').trim();
      if (!label) return null;
      const key = String(entry.key || '').trim();
      const next = {
        ...(allowed.has(key) ? { key } : {}),
        label: label.slice(0, 120),
        status: 'review',
      };
      const confidence = Number(entry.confidence);
      if (Number.isFinite(confidence)) {
        next.confidence = Math.max(0, Math.min(1, confidence));
      }
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
    parsed.fixtureInventory = normalizePlumbingFixtureInventory(parsed.fixtureInventory);
  }
  parsed.utilityConnections = normalizePlumbingUtilityConnections(parsed.utilityConnections);
  parsed.complexityFactors = normalizePlumbingComplexityFactors(parsed.complexityFactors);
  parsed.fixtureInventory = reconcilePlumbingFixtureInventory({
    inventory: parsed.fixtureInventory,
    fieldEvidence: parsed.fieldEvidence,
  });
  parsed.waterHeaterDetail = normalizePlumbingWaterHeaterDetail(parsed.waterHeaterDetail);
  parsed.gasApplianceScope = normalizePlumbingGasApplianceScope(parsed.gasApplianceScope);
  return parsed;
}

module.exports = {
  PLUMBING_MEASUREMENT_KEYS,
  PLUMBING_PLAN_ALIASES,
  PLUMBING_EXPLICIT_ONLY_KEYS,
  PLUMBING_FIXTURE_ROUGH_IN_KEYS,
  PLUMBING_VISION_INSTRUCTIONS,
  normalizePlumbingPlanMeasurements,
  normalizePlumbingFixtureInventory,
  normalizePlumbingFieldEvidence,
  normalizePlumbingUtilityConnections,
  normalizePlumbingComplexityFactors,
  classifyPlumbingSheetKind,
  derivePlumbingCountsFromFixtureInventory,
  derivePlumbingEquipmentCounts,
  inferPlumbingEquipmentFromPlanContext,
  resolvePlumbingFixturesHardwareCount,
  resolvePlumbingGasApplianceConnectionCount,
  expandResidentialGasApplianceScope,
  hasGasAppliancesComplexityFactor,
  reconcilePlumbingFixtureInventory,
  sumPlumbingFixtureRoughInPoints,
  normalizePlumbingWaterHeaterDetail,
  normalizePlumbingGasApplianceScope,
  applyPlumbingLineScopeWarnings,
  buildPlumbingReviewStatus,
  mergePlumbingPdfFixtureSchedule,
  finalizePlumbingTakeoff,
  applyPlumbingVisionTakeoff,
};
