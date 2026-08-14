/**
 * Electrical Plan Export adapter (Phase 3A/3B).
 *
 * Vision / schedule counts fold onto the locked 2A–2K canonical keys.
 * Does not invent Plan Export rates, homeruns, packages, or living-SF quantities.
 */

const ELECTRICAL_PLAN_ALIASES = {
  panelCount: 'mainPanelCount',
  duplexReceptacleCount: 'standardReceptacleCount',
  duplexCount: 'standardReceptacleCount',
  outletCount: 'standardReceptacleCount',
  gfciCount: 'gfciReceptacleCount',
  gfciOutletCount: 'gfciReceptacleCount',
  wrReceptacleCount: 'exteriorReceptacleCount',
  weatherResistantReceptacleCount: 'exteriorReceptacleCount',
  exteriorGfciCount: 'exteriorReceptacleCount',
  exteriorWrReceptacleCount: 'exteriorReceptacleCount',
  threeWayCount: 'threeWaySwitchCount',
  '3waySwitchCount': 'threeWaySwitchCount',
  fourWayCount: 'fourWaySwitchCount',
  canLightCount: 'recessedLightCount',
  canlessCount: 'recessedLightCount',
  canlessLightCount: 'recessedLightCount',
  waferLightCount: 'recessedLightCount',
  recessedCanCount: 'recessedLightCount',
  pendantCount: 'pendantLightCount',
  exteriorFixtureCount: 'exteriorLightCount',
  smokeCount: 'smokeDetectorCount',
  smokeAlarmCount: 'smokeDetectorCount',
  coCount: 'coDetectorCount',
  coAlarmCount: 'coDetectorCount',
  rangeCircuitCount: 'rangeHookupCount',
  range50aCount: 'rangeHookupCount',
  dryerCircuitCount: 'dryerHookupCount',
  dryer30aCount: 'dryerHookupCount',
  dishwasherCircuitCount: 'dishwasherHookupCount',
  serviceAmps: 'serviceAmperage',
  panelAmperage: 'serviceAmperage',
  amperage: 'serviceAmperage',
};

/** Canonical keys Plan Export may emit. */
const ELECTRICAL_MEASUREMENT_KEYS = [
  'mainPanelCount',
  'subpanelCount',
  'panelUpgradeCount',
  'serviceUpgradeCount',
  'serviceAmperage',
  'standardCircuitCount',
  'dedicated20aCircuitCount',
  'circuit30aCount',
  'circuit40aCount',
  'circuit50aCount',
  'circuit60aPlusCount',
  'standardReceptacleCount',
  'gfciReceptacleCount',
  'afciReceptacleCount',
  'exteriorReceptacleCount',
  'floorReceptacleCount',
  'usbReceptacleCount',
  'receptacle240vCount',
  'singlePoleSwitchCount',
  'threeWaySwitchCount',
  'fourWaySwitchCount',
  'dimmerSwitchCount',
  'occupancySwitchCount',
  'smartSwitchCount',
  'standardFixtureCount',
  'recessedLightCount',
  'pendantLightCount',
  'decorativeLightCount',
  'exteriorLightCount',
  'undercabinetLightCount',
  'ceilingFanCount',
  'bathExhaustFanCount',
  'rangeHookupCount',
  'dryerHookupCount',
  'dishwasherHookupCount',
  'disposalHookupCount',
  'microwaveHookupCount',
  'refrigeratorHookupCount',
  'waterHeaterHookupCount',
  'hvacHookupCount',
  'evChargerHookupCount',
  'smokeDetectorCount',
  'coDetectorCount',
  'doorbellCount',
  'cat6DropCount',
  'tvCoaxCount',
  'securityPrewireCount',
  'cameraPrewireCount',
  'deviceRemovalCount',
  'fixtureRemovalCount',
  'relocateCount',
  'abandonedCircuitCount',
  'conduitLf',
  'trenchingLf',
];

const ELECTRICAL_COUNT_KEYS = new Set(
  ELECTRICAL_MEASUREMENT_KEYS.filter((key) => key !== 'conduitLf' && key !== 'trenchingLf')
);

/** Highest-confidence symbol / label extraction. */
const ELECTRICAL_TIER1_KEYS = new Set([
  'mainPanelCount',
  'subpanelCount',
  'serviceAmperage',
  'standardReceptacleCount',
  'gfciReceptacleCount',
  'recessedLightCount',
  'standardFixtureCount',
  'ceilingFanCount',
  'smokeDetectorCount',
  'coDetectorCount',
  'rangeHookupCount',
  'dryerHookupCount',
  'dishwasherHookupCount',
]);

/** Count when recognizable, but mark review-required. */
const ELECTRICAL_TIER2_KEYS = new Set([
  'singlePoleSwitchCount',
  'threeWaySwitchCount',
  'fourWaySwitchCount',
  'exteriorReceptacleCount',
  'pendantLightCount',
  'exteriorLightCount',
  'bathExhaustFanCount',
  'doorbellCount',
  'cat6DropCount',
  'tvCoaxCount',
  'afciReceptacleCount',
  'usbReceptacleCount',
  'dimmerSwitchCount',
  'occupancySwitchCount',
  'smartSwitchCount',
  'undercabinetLightCount',
  'disposalHookupCount',
  'microwaveHookupCount',
  'refrigeratorHookupCount',
  'waterHeaterHookupCount',
]);

/**
 * Only when a panel schedule or labeled callout exists.
 * Never infer from device symbols.
 */
const ELECTRICAL_EXPLICIT_ONLY_KEYS = new Set([
  'standardCircuitCount',
  'dedicated20aCircuitCount',
  'circuit30aCount',
  'circuit40aCount',
  'circuit50aCount',
  'circuit60aPlusCount',
  'conduitLf',
  'trenchingLf',
  'evChargerHookupCount',
  'hvacHookupCount',
  'decorativeLightCount',
  'panelUpgradeCount',
  'serviceUpgradeCount',
  'floorReceptacleCount',
  'receptacle240vCount',
  'securityPrewireCount',
  'cameraPrewireCount',
  'deviceRemovalCount',
  'fixtureRemovalCount',
  'relocateCount',
  'abandonedCircuitCount',
]);

const GENERIC_CIRCUIT_OWNED_BY_HOOKUP = [
  { hookupKeys: ['rangeHookupCount'], circuitKey: 'circuit50aCount' },
  {
    hookupKeys: ['dryerHookupCount', 'waterHeaterHookupCount'],
    circuitKey: 'circuit30aCount',
  },
  {
    hookupKeys: [
      'dishwasherHookupCount',
      'disposalHookupCount',
      'microwaveHookupCount',
      'refrigeratorHookupCount',
    ],
    circuitKey: 'dedicated20aCircuitCount',
  },
  { hookupKeys: ['evChargerHookupCount'], circuitKey: 'circuit60aPlusCount' },
];

function positiveNumber(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function electricalExtractionTier(key) {
  if (ELECTRICAL_TIER1_KEYS.has(key)) return 1;
  if (ELECTRICAL_TIER2_KEYS.has(key)) return 2;
  if (ELECTRICAL_EXPLICIT_ONLY_KEYS.has(key)) return 3;
  return 2;
}

function electricalProvenanceNote(key, tier) {
  if (key === 'mainPanelCount' || key === 'serviceAmperage' || key === 'subpanelCount') {
    return 'From panel callout';
  }
  if (
    key === 'rangeHookupCount' ||
    key === 'dryerHookupCount' ||
    key === 'dishwasherHookupCount'
  ) {
    return 'From labeled appliance circuit';
  }
  if (key === 'gfciReceptacleCount' || key === 'standardReceptacleCount') {
    return 'Counted from symbols';
  }
  if (tier === 1) return 'Counted from electrical plan';
  if (tier === 3) return 'From panel schedule / labeled callout';
  return 'Calculated from symbols, confirm';
}

function readAliasedElectricalPlanInput(input) {
  const out = { ...(input || {}) };
  for (const [alias, canonical] of Object.entries(ELECTRICAL_PLAN_ALIASES)) {
    if (positiveNumber(out[canonical]) != null) continue;
    const aliased = positiveNumber(out[alias]);
    if (aliased != null) out[canonical] = aliased;
  }
  return out;
}

function applyElectricalPlanHookupOwnership(input) {
  const out = { ...input };
  for (const rule of GENERIC_CIRCUIT_OWNED_BY_HOOKUP) {
    if (rule.hookupKeys.some((key) => positiveNumber(out[key]) != null)) {
      delete out[rule.circuitKey];
    }
  }
  return out;
}

function normalizeElectricalPlanMeasurements(input) {
  const next = applyElectricalPlanHookupOwnership(readAliasedElectricalPlanInput(input));
  delete next.electricalIncludeRough;
  delete next.electricalIncludeTrim;
  delete next.electricalProjectCondition;
  return next;
}

function labeledKeySet(explicitlyLabeled, geometryDerived) {
  return new Set(
    [...(explicitlyLabeled || []), ...(geometryDerived || [])]
      .map((key) => String(key || '').trim())
      .filter(Boolean)
  );
}

/**
 * Apply Phase 3B extraction guardrails to vision output, then the 3A adapter.
 */
function applyElectricalVisionTakeoff({
  measurements,
  explicitlyLabeled = [],
  geometryDerived = [],
  electricalSelected = false,
} = {}) {
  const labeled = labeledKeySet(explicitlyLabeled, geometryDerived);
  let next = { ...(measurements || {}) };

  if (!electricalSelected) {
    for (const key of ELECTRICAL_MEASUREMENT_KEYS) {
      if (!labeled.has(key)) delete next[key];
    }
  }

  next = normalizeElectricalPlanMeasurements(next);

  for (const key of ELECTRICAL_EXPLICIT_ONLY_KEYS) {
    if (!labeled.has(key)) delete next[key];
  }

  const provenance = {};
  for (const key of ELECTRICAL_MEASUREMENT_KEYS) {
    const value = positiveNumber(next[key]);
    if (value == null) continue;
    const tier = electricalExtractionTier(key);
    const review = tier >= 2;
    provenance[key] = {
      value,
      source: review ? 'calculated_from_symbols' : 'detected_from_plan',
      normalizedSource: review ? 'NEEDS_REVIEW' : 'FROM_PLAN',
      confidenceTier: tier,
      note: electricalProvenanceNote(key, tier),
    };
  }

  return { measurements: next, provenance };
}

const ELECTRICAL_VISION_INSTRUCTIONS = [
  'For Electrical, relevant sheets are electrical plans (E sheets), panel schedules, device legends, lighting legends, and labeled appliance circuits — not architectural floor plans alone.',
  'Count the semantic item, not every visual mark. A GFCI symbol is one GFCI receptacle, not a GFCI plus a standard receptacle. A labeled range circuit is rangeHookupCount only — do not also add circuit50aCount. Count actual 3-way switch devices, not an extra branch circuit for the pair.',
  'Tier 1 — report when readable: mainPanelCount, serviceAmperage, standardReceptacleCount, gfciReceptacleCount, recessedLightCount, standardFixtureCount, ceilingFanCount, smokeDetectorCount, coDetectorCount, and labeled range/dryer/dishwasher hookups.',
  'Tier 2 — report when recognizable, and the contractor will confirm: singlePoleSwitchCount, threeWaySwitchCount, fourWaySwitchCount, exteriorReceptacleCount, pendantLightCount, exteriorLightCount, bathExhaustFanCount, doorbellCount, cat6DropCount, tvCoaxCount.',
  'Tier 3 — explicit only. Do NOT invent standardCircuitCount, dedicated20aCircuitCount, other homerun/breaker counts, conduitLf, trenchingLf, EV, or specialty equipment unless a panel schedule or labeled circuit callout exists. Put those keys in explicitlyLabeled when used.',
  'Never derive electricalIncludeRough, electricalIncludeTrim, job condition, concealed routing, access difficulty, wire length/gauge, or circuit relationships from device counts. Living SF is not an Electrical quantity.',
].join('\n');

module.exports = {
  ELECTRICAL_PLAN_ALIASES,
  ELECTRICAL_MEASUREMENT_KEYS,
  ELECTRICAL_COUNT_KEYS,
  ELECTRICAL_TIER1_KEYS,
  ELECTRICAL_TIER2_KEYS,
  ELECTRICAL_EXPLICIT_ONLY_KEYS,
  ELECTRICAL_VISION_INSTRUCTIONS,
  electricalExtractionTier,
  electricalProvenanceNote,
  normalizeElectricalPlanMeasurements,
  applyElectricalVisionTakeoff,
};
