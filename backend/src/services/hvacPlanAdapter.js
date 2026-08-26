/**
 * HVAC plan adapter — merges PDF text-layer instance tags and equipment
 * schedule reads into canonical hvac* measurement keys.
 */

const HVAC_MEASUREMENT_KEYS = [
  'hvacSystemCount',
  'hvacSystemTons',
  'hvacServiceCallCount',
  'hvacEquipmentReplacementCount',
  'hvacRefrigerantCount',
  'hvacThermostatCount',
  'hvacDuctworkLf',
  'hvacSupplyRegisterCount',
  'hvacReturnGrilleCount',
  'hvacVentilationCount',
  'hvacPermitCount',
  'hvacCleanupCount',
];

function positiveNumber(raw) {
  const number = Number(String(raw ?? '').replace(/,/g, '').trim());
  return Number.isFinite(number) && number > 0 ? number : null;
}

function measurementsFromObject(source) {
  if (!source || typeof source !== 'object') return {};
  const out = {};
  for (const [key, raw] of Object.entries(source)) {
    if (!HVAC_MEASUREMENT_KEYS.includes(key)) continue;
    const value = positiveNumber(raw);
    if (value == null) continue;
    out[key] = Math.round(value);
  }
  return out;
}

function instanceTagMeasurementsFromTakeoff(pdfTakeoff) {
  return measurementsFromObject(pdfTakeoff?.hvacInstanceTags?.measurements);
}

function scheduleMeasurementsFromTakeoff(pdfTakeoff) {
  return measurementsFromObject(pdfTakeoff?.hvacEquipmentHints?.measurements);
}

/** Combined deterministic HVAC reads from the PDF text layer. */
function hvacPdfTextMeasurementsFromTakeoff(pdfTakeoff) {
  const tags = instanceTagMeasurementsFromTakeoff(pdfTakeoff);
  const schedule = scheduleMeasurementsFromTakeoff(pdfTakeoff);
  const out = { ...schedule, ...tags };
  if (schedule.hvacSystemCount != null && tags.hvacSystemCount != null) {
    out.hvacSystemCount = Math.max(schedule.hvacSystemCount, tags.hvacSystemCount);
  }
  if (schedule.hvacSystemTons != null) {
    out.hvacSystemTons = schedule.hvacSystemTons;
  }
  return out;
}

const HVAC_TAG_VERIFIED_KEYS = new Set([
  'hvacSupplyRegisterCount',
  'hvacReturnGrilleCount',
  'hvacThermostatCount',
  'hvacVentilationCount',
]);

const HVAC_SCHEDULE_VERIFIED_KEYS = new Set([
  'hvacSystemCount',
  'hvacSystemTons',
  'hvacServiceCallCount',
  'hvacEquipmentReplacementCount',
  'hvacRefrigerantCount',
  'hvacVentilationCount',
]);

function isDeterministicHvacProvenance(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const source = String(entry.source || '').toLowerCase();
  const normalized = String(entry.normalizedSource || '').toUpperCase();
  if (source === 'pdf_text_instance_tags') return true;
  if (source.includes('equipment_schedule') || source.includes('pdf_text')) {
    return true;
  }
  if (
    normalized === 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW' ||
    String(entry.confirmedFrom || '').toUpperCase() === 'PLAN_REVIEW'
  ) {
    return true;
  }
  return false;
}

function hvacDeterministicPdfKeys(pdfTakeoff) {
  const tags = instanceTagMeasurementsFromTakeoff(pdfTakeoff);
  const schedule = scheduleMeasurementsFromTakeoff(pdfTakeoff);
  const keys = new Set();
  for (const key of Object.keys(tags)) {
    if (HVAC_TAG_VERIFIED_KEYS.has(key)) keys.add(key);
  }
  for (const key of Object.keys(schedule)) {
    if (HVAC_SCHEDULE_VERIFIED_KEYS.has(key)) keys.add(key);
  }
  return keys;
}

function hvacVisionOnlyReviewReason(pdfTakeoff, field) {
  const deterministic = hvacDeterministicPdfKeys(pdfTakeoff);
  const hasMechanicalPages = (pdfTakeoff?.hvacRelevantPages || []).length > 0;
  if (!deterministic.size && !hasMechanicalPages) {
    return 'No mechanical sheets or HVAC schedules in this plan set; confirm this quantity before pricing.';
  }
  if (field === 'hvacDuctworkLf') {
    return 'Duct LF was not read from labeled plan dimensions or schedules; confirm before pricing.';
  }
  if (HVAC_SCHEDULE_VERIFIED_KEYS.has(field) && !deterministic.has(field)) {
    return 'System or equipment quantity is not backed by an equipment schedule; confirm before pricing.';
  }
  return 'The plan reading is not backed by equipment schedules or PDF text tags; confirm before pricing.';
}

/**
 * Vision-only HVAC reads must not present as verified plan takeoff. Only PDF text
 * tags (registers/returns/thermostats) and equipment-schedule fields stay eligible.
 */
function applyHvacProvenanceGuard({
  measurements = {},
  measurementProvenance = {},
  pdfTakeoff = null,
} = {}) {
  const prov = { ...(measurementProvenance || {}) };
  const meas = { ...(measurements || {}) };
  const deterministicKeys = hvacDeterministicPdfKeys(pdfTakeoff);

  for (const key of HVAC_MEASUREMENT_KEYS) {
    const value = positiveNumber(meas[key]);
    if (value == null) continue;

    const entry = prov[key];
    if (isDeterministicHvacProvenance(entry)) continue;

    if (deterministicKeys.has(key)) {
      prov[key] = {
        ...(entry && typeof entry === 'object' ? entry : {}),
        value,
        source:
          HVAC_SCHEDULE_VERIFIED_KEYS.has(key) &&
          scheduleMeasurementsFromTakeoff(pdfTakeoff)[key] != null
            ? 'pdf_text_equipment_schedule'
            : 'pdf_text_instance_tags',
        normalizedSource: 'FROM_PLAN',
        status: 'plan_verified',
        pricingEligible: true,
        reason:
          HVAC_SCHEDULE_VERIFIED_KEYS.has(key)
            ? 'Read from the mechanical equipment schedule.'
            : 'Counted from PDF text-layer HVAC instance tags.',
      };
      continue;
    }

    prov[key] = {
      ...(entry && typeof entry === 'object' ? entry : {}),
      value,
      source: entry?.source || 'vision_takeoff',
      normalizedSource: 'NEEDS_REVIEW',
      status: 'needs_review',
      pricingEligible: false,
      reason: hvacVisionOnlyReviewReason(pdfTakeoff, key),
    };
  }

  if (!deterministicKeys.has('hvacVentilationCount')) {
    delete meas.hvacVentilationCount;
    delete prov.hvacVentilationCount;
  }

  return { measurements: meas, measurementProvenance: prov };
}

/**
 * Vision HVAC reads below the confidence floor are withheld from measurements but
 * must still appear in plan review and Confirm Scope for contractor confirmation.
 */
function restoreHvacLowConfidenceMeasurements(measurements, lowConfidence) {
  const restored = { ...(measurements || {}) };
  for (const entry of lowConfidence || []) {
    const field = String(entry?.field || '').trim();
    if (!HVAC_MEASUREMENT_KEYS.includes(field)) continue;
    // Whole-house ventilation requires explicit ERV/HRV evidence, not vision guesses.
    if (field === 'hvacVentilationCount') continue;
    const value = positiveNumber(entry?.value);
    if (value == null) continue;
    if (positiveNumber(restored[field]) != null) continue;
    restored[field] = value;
  }
  return restored;
}

module.exports = {
  HVAC_MEASUREMENT_KEYS,
  HVAC_TAG_VERIFIED_KEYS,
  HVAC_SCHEDULE_VERIFIED_KEYS,
  instanceTagMeasurementsFromTakeoff,
  scheduleMeasurementsFromTakeoff,
  hvacPdfTextMeasurementsFromTakeoff,
  hvacDeterministicPdfKeys,
  applyHvacProvenanceGuard,
  restoreHvacLowConfidenceMeasurements,
};
