/**
 * Electrical Plan Export adapter (Phase 3A/3B).
 *
 * Vision / schedule counts fold onto the locked 2A–2K canonical keys.
 * Does not invent Plan Export rates, homeruns, packages, or living-SF quantities.
 */

const ELECTRICAL_PLAN_ALIASES = {
  panelCount: "mainPanelCount",
  duplexReceptacleCount: "standardReceptacleCount",
  duplexCount: "standardReceptacleCount",
  outletCount: "standardReceptacleCount",
  gfciCount: "gfciReceptacleCount",
  gfciOutletCount: "gfciReceptacleCount",
  wrReceptacleCount: "exteriorReceptacleCount",
  weatherResistantReceptacleCount: "exteriorReceptacleCount",
  exteriorGfciCount: "exteriorReceptacleCount",
  exteriorWrReceptacleCount: "exteriorReceptacleCount",
  singlePoleCount: "singlePoleSwitchCount",
  singlePoleSwitches: "singlePoleSwitchCount",
  threeWayCount: "threeWaySwitchCount",
  "3waySwitchCount": "threeWaySwitchCount",
  fourWayCount: "fourWaySwitchCount",
  canLightCount: "recessedLightCount",
  canlessCount: "recessedLightCount",
  canlessLightCount: "recessedLightCount",
  waferLightCount: "recessedLightCount",
  recessedCanCount: "recessedLightCount",
  pendantCount: "pendantLightCount",
  exteriorFixtureCount: "exteriorLightCount",
  smokeCount: "smokeDetectorCount",
  smokeAlarmCount: "smokeDetectorCount",
  coCount: "coDetectorCount",
  coAlarmCount: "coDetectorCount",
  rangeCircuitCount: "rangeHookupCount",
  range50aCount: "rangeHookupCount",
  dryerCircuitCount: "dryerHookupCount",
  dryer30aCount: "dryerHookupCount",
  dishwasherCircuitCount: "dishwasherHookupCount",
  serviceAmps: "serviceAmperage",
  panelAmperage: "serviceAmperage",
  amperage: "serviceAmperage",
};

/** Canonical keys Plan Export may emit. */
const ELECTRICAL_MEASUREMENT_KEYS = [
  "mainPanelCount",
  "subpanelCount",
  "panelUpgradeCount",
  "serviceUpgradeCount",
  "serviceAmperage",
  "standardCircuitCount",
  "dedicated20aCircuitCount",
  "circuit30aCount",
  "circuit40aCount",
  "circuit50aCount",
  "circuit60aPlusCount",
  "standardReceptacleCount",
  "gfciReceptacleCount",
  "afciReceptacleCount",
  "exteriorReceptacleCount",
  "floorReceptacleCount",
  "usbReceptacleCount",
  "receptacle240vCount",
  "singlePoleSwitchCount",
  "threeWaySwitchCount",
  "fourWaySwitchCount",
  "dimmerSwitchCount",
  "occupancySwitchCount",
  "smartSwitchCount",
  "standardFixtureCount",
  "recessedLightCount",
  "pendantLightCount",
  "decorativeLightCount",
  "exteriorLightCount",
  "undercabinetLightCount",
  "ceilingFanCount",
  "bathExhaustFanCount",
  "rangeHookupCount",
  "dryerHookupCount",
  "dishwasherHookupCount",
  "disposalHookupCount",
  "microwaveHookupCount",
  "refrigeratorHookupCount",
  "waterHeaterHookupCount",
  "hvacHookupCount",
  "evChargerHookupCount",
  "smokeDetectorCount",
  "coDetectorCount",
  "doorbellCount",
  "cat6DropCount",
  "tvCoaxCount",
  "securityPrewireCount",
  "cameraPrewireCount",
  "deviceRemovalCount",
  "fixtureRemovalCount",
  "relocateCount",
  "abandonedCircuitCount",
  "conduitLf",
  "trenchingLf",
];

const ELECTRICAL_COUNT_KEYS = new Set(
  ELECTRICAL_MEASUREMENT_KEYS.filter(
    (key) => key !== "conduitLf" && key !== "trenchingLf",
  ),
);

/** Highest-confidence symbol / label extraction. */
const ELECTRICAL_TIER1_KEYS = new Set([
  "mainPanelCount",
  "subpanelCount",
  "standardReceptacleCount",
  "gfciReceptacleCount",
  "recessedLightCount",
  "standardFixtureCount",
  "ceilingFanCount",
  "smokeDetectorCount",
  "coDetectorCount",
  "rangeHookupCount",
  "dryerHookupCount",
  "dishwasherHookupCount",
]);

/** Count when recognizable, but mark review-required. */
const ELECTRICAL_TIER2_KEYS = new Set([
  "singlePoleSwitchCount",
  "threeWaySwitchCount",
  "fourWaySwitchCount",
  "exteriorReceptacleCount",
  "pendantLightCount",
  "exteriorLightCount",
  "bathExhaustFanCount",
  "doorbellCount",
  "cat6DropCount",
  "tvCoaxCount",
  "afciReceptacleCount",
  "usbReceptacleCount",
  "dimmerSwitchCount",
  "occupancySwitchCount",
  "smartSwitchCount",
  "undercabinetLightCount",
  "disposalHookupCount",
  "microwaveHookupCount",
  "refrigeratorHookupCount",
  "waterHeaterHookupCount",
]);

/**
 * Only when a panel schedule or labeled callout exists.
 * Never infer from device symbols.
 */
const ELECTRICAL_EXPLICIT_ONLY_KEYS = new Set([
  "standardCircuitCount",
  "dedicated20aCircuitCount",
  "circuit30aCount",
  "circuit40aCount",
  "circuit50aCount",
  "circuit60aPlusCount",
  "conduitLf",
  "trenchingLf",
  "evChargerHookupCount",
  "hvacHookupCount",
  "decorativeLightCount",
  "panelUpgradeCount",
  "serviceUpgradeCount",
  "floorReceptacleCount",
  "receptacle240vCount",
  "securityPrewireCount",
  "cameraPrewireCount",
  "deviceRemovalCount",
  "fixtureRemovalCount",
  "relocateCount",
  "abandonedCircuitCount",
  "serviceAmperage",
]);

const GENERIC_CIRCUIT_OWNED_BY_HOOKUP = [
  { hookupKeys: ["rangeHookupCount"], circuitKey: "circuit50aCount" },
  {
    hookupKeys: ["dryerHookupCount", "waterHeaterHookupCount"],
    circuitKey: "circuit30aCount",
  },
  {
    hookupKeys: [
      "dishwasherHookupCount",
      "disposalHookupCount",
      "microwaveHookupCount",
      "refrigeratorHookupCount",
    ],
    circuitKey: "dedicated20aCircuitCount",
  },
  { hookupKeys: ["evChargerHookupCount"], circuitKey: "circuit60aPlusCount" },
];

function positiveNumber(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function electricalExtractionTier(key) {
  if (ELECTRICAL_TIER1_KEYS.has(key)) return 1;
  if (ELECTRICAL_TIER2_KEYS.has(key)) return 2;
  if (ELECTRICAL_EXPLICIT_ONLY_KEYS.has(key)) return 3;
  return 2;
}

const ELECTRICAL_EXPLICIT_CALLOUT_KEYS = new Set([
  "mainPanelCount",
  "subpanelCount",
  "serviceAmperage",
  "rangeHookupCount",
  "dryerHookupCount",
  "dishwasherHookupCount",
]);

function electricalEvidenceKind(
  key,
  { instanceTagKeys, inferredKeys, explicitlyLabeled } = {},
) {
  const instance = new Set(instanceTagKeys || []);
  const inferred = new Set(inferredKeys || []);
  const labeled = new Set(explicitlyLabeled || []);
  if (inferred.has(key) && !instance.has(key) && !labeled.has(key))
    return "inference";
  if (instance.has(key)) return "instance_tags";
  if (labeled.has(key)) return "explicit_label";
  return "symbols";
}

function electricalProvenanceNote(key, tier, { evidenceKind } = {}) {
  if (evidenceKind === "inference") return "AI inferred — confirm";
  if (evidenceKind === "instance_tags") return "Counted from instance tags";
  if (
    key === "mainPanelCount" ||
    key === "serviceAmperage" ||
    key === "subpanelCount"
  ) {
    return "From panel callout";
  }
  if (
    key === "rangeHookupCount" ||
    key === "dryerHookupCount" ||
    key === "dishwasherHookupCount"
  ) {
    return "From labeled appliance circuit";
  }
  if (tier === 3) return "From panel schedule / labeled callout";
  return "From plan symbols";
}

function readAliasedElectricalPlanInput(input) {
  const out = { ...(input || {}) };
  for (const [alias, canonical] of Object.entries(ELECTRICAL_PLAN_ALIASES)) {
    if (positiveNumber(out[canonical]) == null) {
      const aliased = positiveNumber(out[alias]);
      if (aliased != null) out[canonical] = aliased;
    }
    delete out[alias];
  }
  return out;
}

function remapElectricalLabeledKeys(keys) {
  return [
    ...new Set(
      (Array.isArray(keys) ? keys : [])
        .map((key) => {
          const trimmed = String(key || "").trim();
          return ELECTRICAL_PLAN_ALIASES[trimmed] || trimmed;
        })
        .filter(Boolean),
    ),
  ];
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
  const next = applyElectricalPlanHookupOwnership(
    readAliasedElectricalPlanInput(input),
  );
  delete next.electricalIncludeRough;
  delete next.electricalIncludeTrim;
  delete next.electricalProjectCondition;
  return next;
}

function normalizeElectricalSheetEvidence(input) {
  const source = input && typeof input === "object" ? input : {};
  const rawSheets = Array.isArray(source.sheetSubtotals)
    ? source.sheetSubtotals
    : Array.isArray(source.sheets)
      ? source.sheets
      : [];
  const sheetSubtotals = rawSheets
    .map((sheet) => {
      if (!sheet || typeof sheet !== "object") return null;
      const page = Number(sheet.page);
      if (!Number.isInteger(page) || page < 1) return null;
      const rawCounts =
        sheet.counts && typeof sheet.counts === "object" ? sheet.counts : {};
      const counts = {};
      for (const key of ELECTRICAL_MEASUREMENT_KEYS) {
        const raw = rawCounts[key];
        const value = Number(String(raw ?? "").replace(/,/g, ""));
        if (!Number.isFinite(value) || value < 0) continue;
        counts[key] = Math.round(value);
      }
      return {
        page,
        sheet:
          String(sheet.sheet || "")
            .trim()
            .slice(0, 40) || null,
        level:
          String(sheet.level || "")
            .trim()
            .slice(0, 20) || "unknown",
        kind:
          String(sheet.kind || "")
            .trim()
            .slice(0, 20) || "other",
        coverage:
          String(sheet.coverage || "").toLowerCase() === "complete"
            ? "complete"
            : "incomplete",
        counts,
        evidence: Array.isArray(sheet.evidence)
          ? sheet.evidence
              .filter((item) => item && typeof item === "object")
              .slice(0, 8)
              .map((item) => ({
                label: String(item.label || "").slice(0, 120),
                page: Number.isInteger(Number(item.page))
                  ? Number(item.page)
                  : page,
                sheet: String(item.sheet || "").slice(0, 40) || null,
              }))
          : [],
      };
    })
    .filter(Boolean);
  return {
    sheetSubtotals,
    omittedPages: Array.isArray(source.omittedPages)
      ? source.omittedPages
          .map((page) => Number(page))
          .filter((page) => Number.isInteger(page) && page > 0)
      : [],
  };
}

function normalizeElectricalFieldEvidence(input) {
  const source = input && typeof input === "object" ? input : {};
  const out = {};
  for (const [rawKey, rawEntries] of Object.entries(source)) {
    const key = ELECTRICAL_PLAN_ALIASES[rawKey] || rawKey;
    if (!ELECTRICAL_MEASUREMENT_KEYS.includes(key)) continue;
    const entries = Array.isArray(rawEntries) ? rawEntries : [rawEntries];
    const normalized = entries
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => {
        const page = Number(entry.page);
        return {
          page: Number.isInteger(page) && page > 0 ? page : null,
          sheet:
            String(entry.sheet || "")
              .trim()
              .slice(0, 40) || null,
          label:
            String(entry.label || "")
              .trim()
              .slice(0, 120) || null,
          method:
            String(entry.method || "")
              .trim()
              .slice(0, 40) || null,
          sourceText:
            String(entry.sourceText || "")
              .trim()
              .slice(0, 180) || null,
        };
      })
      .filter(
        (entry) => entry.page || entry.sheet || entry.label || entry.sourceText,
      );
    if (normalized.length) out[key] = normalized.slice(0, 12);
  }
  return out;
}

function buildElectricalSheetCoverage({
  evidence,
  relevantPages = [],
  renderedPages = [],
} = {}) {
  const normalized = normalizeElectricalSheetEvidence(evidence);
  const expectedPages = [
    ...new Set(
      (Array.isArray(relevantPages) ? relevantPages : [])
        .map((page) => Number(page?.page ?? page))
        .filter((page) => Number.isInteger(page) && page > 0),
    ),
  ].sort((a, b) => a - b);
  const rendered = new Set(
    (Array.isArray(renderedPages) ? renderedPages : [])
      .map((page) => Number(page?.page ?? page))
      .filter((page) => Number.isInteger(page) && page > 0),
  );
  const subtotalsByPage = new Map(
    normalized.sheetSubtotals.map((sheet) => [sheet.page, sheet]),
  );
  const evidencePages = normalized.sheetSubtotals.map((sheet) => sheet.page);
  const pagesToCheck = expectedPages.length
    ? expectedPages
    : [...new Set(evidencePages)].sort((a, b) => a - b);
  const missingPages = pagesToCheck.filter(
    (page) =>
      !subtotalsByPage.has(page) ||
      normalized.sheetSubtotals.find((sheet) => sheet.page === page)
        ?.coverage !== "complete" ||
      (rendered.size > 0 && !rendered.has(page)),
  );
  return {
    expectedPages: pagesToCheck,
    renderedPages: [...rendered].sort((a, b) => a - b),
    coveredPages: pagesToCheck.filter((page) => !missingPages.includes(page)),
    missingPages,
    complete:
      pagesToCheck.length > 0 &&
      missingPages.length === 0 &&
      normalized.omittedPages.length === 0,
    sheetSubtotals: normalized.sheetSubtotals,
    omittedPages: normalized.omittedPages,
  };
}

function electricalFieldHasValidatedSubtotals(field, value, coverage) {
  if (!coverage?.complete) return false;
  const sheets = Array.isArray(coverage.sheetSubtotals)
    ? coverage.sheetSubtotals
    : [];
  if (!sheets.length) return false;
  const subtotal = sheets.reduce(
    (sum, sheet) => sum + Number(sheet?.counts?.[field] || 0),
    0,
  );
  return Math.round(subtotal) === Math.round(Number(value));
}

function validateElectricalSemanticRules(measurements = {}) {
  const issues = [];
  for (const rule of GENERIC_CIRCUIT_OWNED_BY_HOOKUP) {
    const hookupPresent = rule.hookupKeys.some(
      (key) => positiveNumber(measurements[key]) != null,
    );
    if (
      !hookupPresent ||
      positiveNumber(measurements[rule.circuitKey]) == null
    ) {
      continue;
    }
    issues.push({
      field: rule.circuitKey,
      reason: `${rule.circuitKey} duplicates an appliance hookup-owned circuit`,
    });
  }
  return issues;
}

function omitUnresolvedElectricalConflicts(measurements, conflicts) {
  const next = { ...(measurements || {}) };
  for (const conflict of Array.isArray(conflicts) ? conflicts : []) {
    const field = String(conflict?.field || "").trim();
    if (!field || !conflict?.requiresConfirmation) continue;
    if (
      !ELECTRICAL_MEASUREMENT_KEYS.includes(field) &&
      !ELECTRICAL_PLAN_ALIASES[field]
    ) {
      continue;
    }
    delete next[field];
  }
  return { measurements: next, conflicts };
}

function labeledKeySet(explicitlyLabeled, geometryDerived) {
  return new Set(
    [...(explicitlyLabeled || []), ...(geometryDerived || [])]
      .map((key) => String(key || "").trim())
      .filter(Boolean),
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
  instanceTagKeys = [],
  inferredKeys = [],
  methodsAgreeKeys = [],
  independentVisionAgreementKeys = [],
  electricalSheetEvidence = null,
  electricalRelevantPages = [],
  electricalRenderedPages = [],
  measurementConflicts = [],
  unreadableFields = [],
  electricalFieldEvidence = null,
  deterministicRepeatedImportStable = true,
} = {}) {
  const labeled = labeledKeySet(explicitlyLabeled, geometryDerived);
  const instance = new Set(
    [...(instanceTagKeys || [])]
      .map((key) => String(key || "").trim())
      .filter(Boolean),
  );
  const inferred = remapElectricalLabeledKeys(inferredKeys);
  const inferredSet = new Set(inferred);
  const agreed = new Set(
    (Array.isArray(methodsAgreeKeys) ? methodsAgreeKeys : []).map((key) =>
      String(key || "").trim(),
    ),
  );
  const independentVisionAgreement = new Set(
    (Array.isArray(independentVisionAgreementKeys)
      ? independentVisionAgreementKeys
      : []
    )
      .map((key) => String(key || "").trim())
      .filter(Boolean),
  );
  const sheetCoverage = buildElectricalSheetCoverage({
    evidence: electricalSheetEvidence,
    relevantPages: electricalRelevantPages,
    renderedPages: electricalRenderedPages,
  });
  const fieldEvidence = normalizeElectricalFieldEvidence(
    electricalFieldEvidence,
  );
  const semanticIssues = validateElectricalSemanticRules(measurements);
  const semanticIssueFields = new Set(
    semanticIssues.map((issue) => issue.field),
  );
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
  const fieldValidation = {};
  const priceableFields = [];
  const blockedFields = [];
  for (const key of ELECTRICAL_MEASUREMENT_KEYS) {
    const value = positiveNumber(next[key]);
    const inferredOnly =
      inferredSet.has(key) && !instance.has(key) && !labeled.has(key);
    if (value == null) {
      if (inferredOnly) {
        fieldValidation[key] = {
          status: "needs_review",
          pricingEligible: false,
          reason:
            "AI inferred from context without a counted symbol or printed label",
        };
        blockedFields.push(key);
      }
      continue;
    }
    const tier = electricalExtractionTier(key);
    const evidenceKind = electricalEvidenceKind(key, {
      instanceTagKeys: instance,
      inferredKeys: inferred,
      explicitlyLabeled: labeled,
    });
    // An explicit label is already direct plan evidence. The field-evidence
    // list is supplemental audit detail; requiring it here could demote a
    // panel callout to AI verified even though the plan-review summary says
    // the quantity came from a printed callout.
    const planVerified =
      evidenceKind === "instance_tags" || evidenceKind === "explicit_label";
    const aiVerified =
      deterministicRepeatedImportStable !== false &&
      !planVerified &&
      evidenceKind !== "inference" &&
      agreed.has(key) &&
      independentVisionAgreement.has(key) &&
      electricalFieldHasValidatedSubtotals(key, value, sheetCoverage) &&
      !semanticIssueFields.has(key);
    const pricingEligible = planVerified || aiVerified;
    const status = planVerified
      ? "plan_verified"
      : aiVerified
        ? "ai_verified"
        : "needs_review";
    const normalizedSource = planVerified
      ? "FROM_PLAN"
      : aiVerified
        ? "AI_VERIFIED"
        : "NEEDS_REVIEW";
    const reason = planVerified
      ? "Explicit plan evidence or parsed fixture tags support this quantity."
      : aiVerified
        ? "Two independent AI counts agree, and sheet coverage/subtotals reconcile."
        : evidenceKind === "inference"
          ? "AI inferred this quantity from context rather than a counted symbol."
          : evidenceKind === "explicit_label" && !planVerified
            ? "The model supplied a label without a traceable page or sheet reference."
            : deterministicRepeatedImportStable === false
              ? "The same imported plan was not stable across repeated imports."
              : !agreed.has(key)
                ? "Only one AI count supports this quantity."
                : !sheetCoverage.complete
                  ? "The AI counts agree, but full electrical sheet coverage was not proven."
                  : !electricalFieldHasValidatedSubtotals(
                        key,
                        value,
                        sheetCoverage,
                      )
                    ? "Sheet-level subtotals do not reconcile to the final quantity."
                    : "The quantity requires review before pricing.";
    fieldValidation[key] = {
      status,
      pricingEligible,
      evidenceKind,
      methodsAgree: agreed.has(key),
      independentVisionAgreement: independentVisionAgreement.has(key),
      fullSheetCoverage: sheetCoverage.complete,
      subtotalValidated: electricalFieldHasValidatedSubtotals(
        key,
        value,
        sheetCoverage,
      ),
      deterministicRepeatedImportStable,
      reason,
    };
    if (pricingEligible) priceableFields.push(key);
    else blockedFields.push(key);
    provenance[key] = {
      value,
      source:
        evidenceKind === "inference"
          ? "inferred_from_context"
          : evidenceKind === "instance_tags"
            ? "pdf_text_instance_tags"
            : planVerified
              ? "detected_from_plan"
              : aiVerified
                ? "ai_verified_symbols"
                : "calculated_from_symbols",
      normalizedSource,
      status,
      pricingEligible,
      confidenceTier: planVerified ? 1 : aiVerified ? 2 : Math.max(tier, 2),
      evidenceKind,
      methodsAgree: agreed.has(key),
      independentVisionAgreement: independentVisionAgreement.has(key),
      fullSheetCoverage: sheetCoverage.complete,
      subtotalValidated: electricalFieldHasValidatedSubtotals(
        key,
        value,
        sheetCoverage,
      ),
      deterministicRepeatedImportStable,
      reason,
      evidence: fieldEvidence[key] || [],
      note: electricalProvenanceNote(key, tier, { evidenceKind }),
    };
  }

  for (const conflict of semanticIssues) {
    fieldValidation[conflict.field] = {
      ...(fieldValidation[conflict.field] || {}),
      status: "needs_review",
      pricingEligible: false,
      reason: conflict.reason,
    };
  }
  for (const conflict of Array.isArray(measurementConflicts)
    ? measurementConflicts
    : []) {
    const field = String(conflict?.field || "").trim();
    if (!field) continue;
    fieldValidation[field] = {
      ...(fieldValidation[field] || {}),
      status: "conflict",
      pricingEligible: false,
      reason:
        "Independent plan readings disagree — contractor confirmation required.",
    };
    blockedFields.push(field);
  }
  for (const unreadable of Array.isArray(unreadableFields)
    ? unreadableFields
    : []) {
    const field = String(unreadable?.field || "").trim();
    if (!field) continue;
    if (fieldValidation[field]?.status === "conflict") {
      blockedFields.push(field);
      continue;
    }
    const status =
      positiveNumber(next[field]) != null ||
      field === "unclassifiedFixtureCount"
        ? "needs_review"
        : "not_detected";
    fieldValidation[field] = {
      ...(fieldValidation[field] || {}),
      status,
      pricingEligible: false,
      reason: String(unreadable?.reason || "Not readable on the plan").trim(),
    };
    const priceableIndex = priceableFields.indexOf(field);
    if (priceableIndex >= 0) priceableFields.splice(priceableIndex, 1);
    if (provenance[field]) {
      provenance[field] = {
        ...provenance[field],
        status,
        normalizedSource: "NEEDS_REVIEW",
        pricingEligible: false,
        reason: fieldValidation[field].reason,
      };
    }
    blockedFields.push(field);
  }
  const fieldStatuses = Object.values(fieldValidation);
  return {
    measurements: next,
    provenance,
    electricalValidation: electricalSelected
      ? {
          sheetCoverage,
          semanticIssues,
          fields: fieldValidation,
          priceableFields,
          blockedFields: [...new Set(blockedFields)],
          summary: {
            priceableCount: priceableFields.length,
            aiVerifiedCount: fieldStatuses.filter(
              (field) => field.status === "ai_verified",
            ).length,
            planVerifiedCount: fieldStatuses.filter(
              (field) => field.status === "plan_verified",
            ).length,
            conflictCount: fieldStatuses.filter(
              (field) => field.status === "conflict",
            ).length,
            needsReviewCount: fieldStatuses.filter(
              (field) => field.status === "needs_review",
            ).length,
            notDetectedCount: fieldStatuses.filter(
              (field) => field.status === "not_detected",
            ).length,
          },
        }
      : null,
  };
}

const ELECTRICAL_VISION_INSTRUCTIONS = [
  "For Electrical, the attached images are Electrical sheets (or E sheets inside the plan file). Device, fixture, panel, and legend symbols MUST be counted. Counting those glyphs is required takeoff, not estimating, not inventing, and not a readability violation.",
  "Count the semantic item, not every visual mark. A GFCI symbol is one GFCI receptacle, not a GFCI plus a standard receptacle. A labeled range circuit is rangeHookupCount only — do not also add circuit50aCount. Count actual 3-way switch devices, not an extra branch circuit for the pair.",
  "Tier 1 — report when symbols or labels are visible: mainPanelCount, standardReceptacleCount, gfciReceptacleCount, recessedLightCount, standardFixtureCount, ceilingFanCount, smokeDetectorCount, coDetectorCount, and labeled range/dryer/dishwasher hookups.",
  "Count every ceiling-fan symbol on every lighting sheet, including covered patio, primary suite, all bedrooms, and upstairs living. Sum main-level and upper-level sheets. Do not stop after the first living-area cluster.",
  "Lighting fixtures that are not recessed/canless (R4) and not ceiling fans still count. If the set has no symbol legend, report unclassifiedFixtureCount and list it in unreadableFields. Do not guess pendant, vanity, garage, or standard fixture.",
  "Tier 2 — report when recognizable, and the contractor will confirm: singlePoleSwitchCount, threeWaySwitchCount, fourWaySwitchCount, exteriorReceptacleCount, pendantLightCount, exteriorLightCount, bathExhaustFanCount, doorbellCount, cat6DropCount, tvCoaxCount.",
  "Tier 3 — explicit only. Do NOT invent serviceAmperage, standardCircuitCount, dedicated20aCircuitCount, other homerun/breaker counts, conduitLf, trenchingLf, EV, or specialty equipment unless a printed amperage/panel callout or panel schedule exists. Put those keys in explicitlyLabeled when used. Never infer 200A from house size or a panel box.",
  "Never derive electricalIncludeRough, electricalIncludeTrim, job condition, concealed routing, access difficulty, wire length/gauge, or circuit relationships from device counts. Living SF is not an Electrical quantity. Leave rooms[] empty.",
  "If a PDF text-layer block lists fixture instance tags (for example repeated R4 callouts), treat those as counted fixtures — not legend entries. Prefer those instance-tag totals over a lower symbol estimate. Put wet-location guesses (probable GFCI because a room is a bath) in inferredKeys, not as Plan-verified counts.",
].join("\n");

function instanceTagMeasurementsFromTakeoff(pdfTakeoff) {
  const measurements = pdfTakeoff?.electricalInstanceTags?.measurements;
  if (!measurements || typeof measurements !== "object") return {};
  const out = {};
  for (const [key, raw] of Object.entries(measurements)) {
    const value = positiveNumber(raw);
    if (value == null) continue;
    out[key] = Math.round(value);
  }
  return out;
}

module.exports = {
  ELECTRICAL_PLAN_ALIASES,
  ELECTRICAL_MEASUREMENT_KEYS,
  ELECTRICAL_COUNT_KEYS,
  ELECTRICAL_TIER1_KEYS,
  ELECTRICAL_TIER2_KEYS,
  ELECTRICAL_EXPLICIT_ONLY_KEYS,
  ELECTRICAL_EXPLICIT_CALLOUT_KEYS,
  ELECTRICAL_VISION_INSTRUCTIONS,
  electricalExtractionTier,
  electricalProvenanceNote,
  electricalEvidenceKind,
  remapElectricalLabeledKeys,
  omitUnresolvedElectricalConflicts,
  normalizeElectricalPlanMeasurements,
  normalizeElectricalSheetEvidence,
  normalizeElectricalFieldEvidence,
  buildElectricalSheetCoverage,
  validateElectricalSemanticRules,
  electricalFieldHasValidatedSubtotals,
  applyElectricalVisionTakeoff,
  instanceTagMeasurementsFromTakeoff,
};
