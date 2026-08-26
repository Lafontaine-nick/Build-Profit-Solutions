/**
 * Plan/blueprint takeoff — GPT-4o vision extracts rooms + labeled dimensions
 * from plan images/PDFs and maps them into Quick Measurement field keys.
 *
 * Accuracy contract: the model must only report numbers it can actually read.
 * Every measurement carries a confidence; fields below MIN_FIELD_CONFIDENCE are
 * withheld and reported to the client instead of silently auto-filled. If the
 * pages are too blurry/low-res to read, the whole takeoff fails with a clear
 * "not clear enough" reason rather than inventing square footage.
 */

const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const PDF_MIME = "application/pdf";
const {
  filterPlanMeasurementsForTrade,
  filterPlanScopesForTrade,
} = require("./planImportTradeConfig");
const {
  mergeMeasurementCandidates,
  mergeMeasurementCandidateSets,
} = require("./measurementMerge");
const {
  ELECTRICAL_MEASUREMENT_KEYS,
  ELECTRICAL_PLAN_ALIASES,
  ELECTRICAL_COUNT_KEYS,
  ELECTRICAL_EXPLICIT_ONLY_KEYS,
  ELECTRICAL_VISION_INSTRUCTIONS,
  applyElectricalVisionTakeoff,
  normalizeElectricalPlanMeasurements,
  remapElectricalLabeledKeys,
  omitUnresolvedElectricalConflicts,
  instanceTagMeasurementsFromTakeoff,
} = require("./electricalPlanAdapter");
const {
  PLUMBING_VISION_INSTRUCTIONS,
  applyPlumbingVisionTakeoff,
  normalizePlumbingFieldEvidence,
  normalizePlumbingPlanMeasurements,
  normalizePlumbingComplexityFactors,
  normalizePlumbingUtilityConnections,
  mergePlumbingPdfFixtureSchedule,
  reconcilePlumbingFixtureInventory,
  finalizePlumbingTakeoff,
} = require("./plumbingPlanAdapter");
const {
  FRAMING_MEASUREMENT_KEYS,
  finalizeFramingTakeoff,
} = require("./framingPlanAdapter");
const { hvacPdfTextMeasurementsFromTakeoff } = require("./hvacPlanAdapter");

/** Temporary Lot 58 diagnosis — which pipeline stage drops Electrical counts. */
const ELECTRICAL_DEBUG_KEYS = [
  "standardReceptacleCount",
  "gfciReceptacleCount",
  "recessedLightCount",
  "singlePoleSwitchCount",
  "threeWaySwitchCount",
  "ceilingFanCount",
  "mainPanelCount",
  "serviceAmperage",
];

function electricalDebugSnapshot(measurements) {
  const src =
    measurements && typeof measurements === "object" ? measurements : {};
  const out = {};
  for (const key of ELECTRICAL_DEBUG_KEYS) {
    out[key] = src[key] ?? null;
  }
  return out;
}

function normalizedStringList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value];
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

function normalizedObjectList(value) {
  if (Array.isArray(value)) return value;
  return value && typeof value === "object" ? [value] : [];
}

function electricalishMeasurementKeys(measurements) {
  const src =
    measurements && typeof measurements === "object" ? measurements : {};
  const out = {};
  for (const [key, value] of Object.entries(src)) {
    if (
      ELECTRICAL_DEBUG_KEYS.includes(key) ||
      ELECTRICAL_PLAN_ALIASES[key] ||
      /recept|gfci|switch|light|fan|panel|amp|outlet|duplex|circuit|smoke|hookup|fixture|conduit|trench/i.test(
        key,
      )
    ) {
      out[key] = value;
    }
  }
  return out;
}

function logElectricalTakeoffStage(stage, payload) {
  console.log(`[ELECTRICAL TAKEOFF] ${stage}`, payload);
}

function foldElectricalVisionPayload(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  parsed.measurements = normalizeElectricalPlanMeasurements(
    parsed.measurements,
  );
  parsed.explicitlyLabeled = remapElectricalLabeledKeys(
    parsed.explicitlyLabeled,
  );
  parsed.geometryDerived = remapElectricalLabeledKeys(parsed.geometryDerived);
  parsed.inferredKeys = remapElectricalLabeledKeys(parsed.inferredKeys);
  if (parsed.fieldConfidence && typeof parsed.fieldConfidence === "object") {
    const nextConf = { ...parsed.fieldConfidence };
    for (const [alias, canonical] of Object.entries(ELECTRICAL_PLAN_ALIASES)) {
      if (nextConf[canonical] == null && nextConf[alias] != null) {
        nextConf[canonical] = nextConf[alias];
      }
      delete nextConf[alias];
    }
    parsed.fieldConfidence = nextConf;
  }
  return parsed;
}

function mergeElectricalEvidenceSources({
  generalMeasurements,
  generalConfidence,
  focusedMeasurements = null,
  focusedConfidence = null,
  instanceTagMeasurements = {},
} = {}) {
  const sets = [
    {
      measurements: generalMeasurements,
      confidence: generalConfidence,
      source: "general_plan_takeoff",
    },
  ];
  if (focusedMeasurements && typeof focusedMeasurements === "object") {
    sets.push({
      measurements: focusedMeasurements,
      confidence: focusedConfidence,
      source: "focused_trade_takeoff",
    });
  }
  const tags =
    instanceTagMeasurements && typeof instanceTagMeasurements === "object"
      ? instanceTagMeasurements
      : {};
  if (Object.keys(tags).length) {
    sets.push({
      measurements: tags,
      confidence: Object.fromEntries(Object.keys(tags).map((key) => [key, 1])),
      source: "pdf_text_instance_tags",
      evidence: Object.fromEntries(Object.keys(tags).map((key) => [key, true])),
      defaultConfidence: 1,
    });
  }
  return mergeMeasurementCandidateSets(sets);
}

function mergeElectricalSheetEvidence(...sources) {
  const byPage = new Map();
  for (const source of sources) {
    const sheets = Array.isArray(source?.sheetSubtotals)
      ? source.sheetSubtotals
      : Array.isArray(source?.sheets)
        ? source.sheets
        : [];
    for (const sheet of sheets) {
      const page = Number(sheet?.page);
      if (!Number.isInteger(page) || page < 1) continue;
      const previous = byPage.get(page);
      const previousCounts =
        previous?.counts && typeof previous.counts === "object"
          ? previous.counts
          : {};
      const nextCounts =
        sheet?.counts && typeof sheet.counts === "object" ? sheet.counts : {};
      byPage.set(page, {
        ...(previous || {}),
        ...sheet,
        page,
        counts: { ...previousCounts, ...nextCounts },
        evidence: [
          ...(Array.isArray(previous?.evidence) ? previous.evidence : []),
          ...(Array.isArray(sheet?.evidence) ? sheet.evidence : []),
        ].slice(0, 8),
      });
    }
  }
  const omittedPages = [
    ...new Set(
      sources.flatMap((source) =>
        Array.isArray(source?.omittedPages) ? source.omittedPages : [],
      ),
    ),
  ];
  return {
    sheetSubtotals: [...byPage.values()].sort((a, b) => a.page - b.page),
    omittedPages,
  };
}

function mergeElectricalFieldEvidence(...sources) {
  const out = {};
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const [key, entries] of Object.entries(source)) {
      const list = Array.isArray(entries) ? entries : [entries];
      out[key] = [...(Array.isArray(out[key]) ? out[key] : []), ...list].slice(
        0,
        16,
      );
    }
  }
  return out;
}

function mergePlumbingFieldEvidence(...sources) {
  const out = {};
  for (const source of sources) {
    const normalized = normalizePlumbingFieldEvidence(source);
    for (const [key, entries] of Object.entries(normalized)) {
      out[key] = [
        ...(Array.isArray(out[key]) ? out[key] : []),
        ...entries,
      ].slice(0, 16);
    }
  }
  return out;
}

/** Fields the model read but wasn't sure about are withheld below this. */
const MIN_FIELD_CONFIDENCE = 0.6;

const UNCLEAR_PLAN_REASON =
  "AI could not read square footage — the plan pages are not clear enough. " +
  "Retake the photos closer and in focus (or import the original PDF) and try again.";

/** Quick Measurement keys we accept from vision. */
const MEASUREMENT_KEYS = new Set([
  "bathroomFloorSqft",
  "kitchenFloorSqft",
  "floorAreaSqft",
  "backsplashSqft",
  "countertopSqft",
  "cabinetLf",
  "showerWallTileSqft",
  "showerFloorTileSqft",
  "wallPaintSqft",
  "ceilingPaintSqft",
  "paintAreaSqft",
  "interiorDoorCount",
  "windowCount",
  "exteriorDoorCount",
  "slidingDoorCount",
  "garageDoorSingleCount",
  "garageDoorDoubleCount",
  "garageDoorRvCount",
  "cabinetRunLf",
  "cabinetPaintSqft",
  "exteriorPaintSqft",
  "stuccoGrossWallSqft",
  "stuccoWindowDoorOpeningSqft",
  "stuccoGarageOpeningSqft",
  "stuccoOtherFinishDeductionSqft",
  "stuccoNetWallSqft",
  "stuccoSoffitSqft",
  "stuccoParapetSqft",
  "stuccoFoamTrimLf",
  "stuccoControlJointLf",
  "stuccoAccessAffectedSqft",
  "stuccoRepairAffectedSqft",
  "stuccoStories",
  "stuccoWallHeightFt",
  "baseboardLf",
  "railingLf",
  "landscapeSqft",
  "sodSqft",
  "paverSqft",
  "rockMulchSqft",
  "landscapeTons",
  "roofAreaSqft",
  "roofSquares",
  "roofPitch",
  "storyCount",
  "roofDeckingReplacementSqft",
  "roofDripEdgeLf",
  "roofRidgeCapLf",
  "roofRidgeVentLf",
  "roofValleyFlashingLf",
  "roofStepFlashingLf",
  "roofWallFlashingLf",
  "roofChimneyFlashingCount",
  "roofPipeBootCount",
  "roofVentCount",
  "roofTurbineVentCount",
  "roofSkylightCount",
  "roofPenetrationCount",
  "roofRepairAffectedSqft",
  "roofGutterLf",
  "roofDownspoutCount",
  "drywallSqft",
  "drywallWallSqft",
  "drywallCeilingSqft",
  "drywallOpeningDeductionSqft",
  "drywallGarageFireRatedSqft",
  "drywallMoistureResistantSqft",
  "drywallVaultedSlopedSqft",
  "drywallHighCeilingSqft",
  "drywallFinishLevel",
  "garageWallDrywallSqft",
  "garageCeilingDrywallSqft",
  "moistureResistantDrywallSqft",
  "fireRatedDrywallSqft",
  "specialtyDrywallSqft",
  "highCeilingDrywallSqft",
  "vaultedCeilingDrywallSqft",
  "level5FinishSqft",
  "exteriorWallGrossSqft",
  "exteriorWallInsulationSqft",
  "atticInsulationSqft",
  "insulatedRoofDeckSqft",
  "floorInsulationSqft",
  "garageSeparationInsulationSqft",
  "insulatedGarageWallSqft",
  "insulatedGarageCeilingSqft",
  "openingDeductionSqft",
  "flooringSqft",
  "flooringLvpSqft",
  "flooringLaminateSqft",
  "flooringEngineeredHardwoodSqft",
  "flooringSolidHardwoodSqft",
  "flooringTileSqft",
  "flooringCarpetSqft",
  "flooringSheetVinylSqft",
  "floorDemoSqft",
  "floorDemoCarpetSqft",
  "floorDemoTileSqft",
  "floorDemoLvpSqft",
  "floorPrepSqft",
  "underlaymentSqft",
  "moistureBarrierSqft",
  "baseboardLf",
  "transitionCount",
  "quarterRoundLf",
  "concreteSqft",
  "concreteDrivewaySqft",
  "concreteSidewalkSqft",
  "concretePatioSqft",
  "concreteWalkwaySqft",
  "concreteRvPadSqft",
  "concreteCy",
  "excavationCy",
  "deckSqft",
  "garageSqft",
  ...FRAMING_MEASUREMENT_KEYS,
  ...ELECTRICAL_MEASUREMENT_KEYS,
  ...Object.keys(ELECTRICAL_PLAN_ALIASES),
  "hvacSystemCount",
  "hvacSystemTons",
  "hvacServiceCallCount",
  "hvacEquipmentReplacementCount",
  "hvacRefrigerantCount",
  "hvacThermostatCount",
  "hvacDuctworkLf",
  "hvacSupplyRegisterCount",
  "hvacReturnGrilleCount",
  "hvacVentilationCount",
  "hvacPermitCount",
  "hvacCleanupCount",
]);

/**
 * Floor plans almost never label paint/drywall/trim SF.
 * Accepting unlabeled vision numbers caused invented values (e.g. paint 320
 * on a 1700 SF house). Keep vision auto-fill labeled-only; Painting selected-
 * trade takeoff may still fill wall/ceiling/trim from dimensioned rooms via
 * derivePaintingGeometryMeasurements.
 */
const LABELED_ONLY_KEYS = new Set([
  "wallPaintSqft",
  "ceilingPaintSqft",
  "paintAreaSqft",
  "interiorDoorCount",
  "cabinetRunLf",
  "cabinetPaintSqft",
  "exteriorPaintSqft",
  "drywallSqft",
  "drywallWallSqft",
  "drywallCeilingSqft",
  "drywallOpeningDeductionSqft",
  "baseboardLf",
  "railingLf",
  "stuccoAccessAffectedSqft",
  "stuccoRepairAffectedSqft",
]);

/** Concrete flatwork only when the sheet labels concrete/slab/driveway — not covered patio. */
const CONCRETE_EXPLICIT_KEYS = new Set([
  "concreteSqft",
  "concreteCy",
  "concreteDrivewaySqft",
  "concreteSidewalkSqft",
  "concretePatioSqft",
  "concreteWalkwaySqft",
  "concreteRvPadSqft",
]);

function normalizeMime(mimeType) {
  const m = String(mimeType || "image/jpeg").toLowerCase();
  if (m === "image/heic" || m === "image/heif") return "image/jpeg";
  if (!ALLOWED_MIME.has(m)) return "image/jpeg";
  return m === "image/jpg" ? "image/jpeg" : m;
}

function approxBase64Bytes(b64) {
  return Math.floor((String(b64 || "").length * 3) / 4);
}

function positive(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Keep positive numeric measurement keys from either vision pass. */
function mergePositiveMeasurementMaps(base = {}, overlay = {}) {
  const out = { ...(base && typeof base === "object" ? base : {}) };
  for (const [key, value] of Object.entries(
    overlay && typeof overlay === "object" ? overlay : {},
  )) {
    const next = positive(value);
    if (next == null) continue;
    out[key] = next;
  }
  return out;
}

function stuccoEvidenceByField(planFacts = {}) {
  const hasElevationFaces =
    Array.isArray(planFacts?.elevationFaces) &&
    planFacts.elevationFaces.length > 0;
  const hasPerimeter =
    positive(planFacts?.exteriorPerimeterLf) ||
    positive(planFacts?.foundationPerimeterLf);
  const evidence = {};
  if (hasElevationFaces) {
    for (const field of [
      "stuccoGrossWallSqft",
      "stuccoWindowDoorOpeningSqft",
      "stuccoGarageOpeningSqft",
      "stuccoOtherFinishDeductionSqft",
      "stuccoSoffitSqft",
      "stuccoParapetSqft",
      "stuccoFoamTrimLf",
      "stuccoControlJointLf",
    ]) {
      evidence[field] = true;
    }
  }
  if (hasPerimeter) evidence.stuccoGrossWallSqft = true;
  return evidence;
}

function elevationFacesOpeningScore(faces) {
  if (!Array.isArray(faces) || !faces.length) return 0;
  let score = faces.length;
  for (const face of faces) {
    if (positive(face?.openingsSqft)) score += 2;
    if (positive(face?.windowDoorOpeningsSqft)) score += 3;
    if (positive(face?.garageOpeningsSqft)) score += 3;
  }
  return score;
}

function preferElevationFacesWithOpenings(a, b) {
  const scoreA = elevationFacesOpeningScore(a);
  const scoreB = elevationFacesOpeningScore(b);
  if (scoreB > scoreA) return b;
  if (scoreA > 0) return a;
  return b || a || undefined;
}

function insulationOpeningEvidenceScore(payload = {}) {
  const measurementScore =
    positive(payload?.measurements?.openingDeductionSqft) != null ? 10 : 0;
  const faces = Array.isArray(payload?.planFacts?.elevationFaces)
    ? payload.planFacts.elevationFaces
    : [];
  const facesScore = faces.reduce((score, face) => {
    if (positive(face?.windowDoorOpeningsSqft)) return score + 3;
    if (positive(face?.garageOpeningsSqft)) return score + 3;
    if (positive(face?.openingsSqft)) return score + 2;
    return score;
  }, 0);
  return measurementScore + facesScore;
}

function parseVisionJsonPayload(completion) {
  try {
    return JSON.parse(completion?.choices?.[0]?.message?.content || "{}");
  } catch {
    return {};
  }
}

function mergeInsulationFocusedPayloads(base = {}, overlay = {}) {
  const openingA = positive(base?.measurements?.openingDeductionSqft);
  const openingB = positive(overlay?.measurements?.openingDeductionSqft);
  const measurements = mergePositiveMeasurementMaps(
    base.measurements,
    overlay.measurements,
  );
  if (openingA != null || openingB != null) {
    measurements.openingDeductionSqft = Math.max(openingA || 0, openingB || 0);
  }
  return {
    ...base,
    ...overlay,
    measurements,
    planFacts: {
      ...(base.planFacts || {}),
      ...(overlay.planFacts || {}),
      ceilingBoundary: {
        ...(base.planFacts?.ceilingBoundary || {}),
        ...(overlay.planFacts?.ceilingBoundary || {}),
        fieldEvidence: {
          ...(base.planFacts?.ceilingBoundary?.fieldEvidence || {}),
          ...(overlay.planFacts?.ceilingBoundary?.fieldEvidence || {}),
        },
      },
      elevationFaces: preferElevationFacesWithOpenings(
        base.planFacts?.elevationFaces,
        overlay.planFacts?.elevationFaces,
      ),
      fieldEvidence: {
        ...(base.planFacts?.fieldEvidence || {}),
        ...(overlay.planFacts?.fieldEvidence || {}),
      },
    },
    fieldConfidence: {
      ...(base.fieldConfidence || {}),
      ...(overlay.fieldConfidence || {}),
    },
    unreadableFields: [
      ...(Array.isArray(base.unreadableFields) ? base.unreadableFields : []),
      ...(Array.isArray(overlay.unreadableFields)
        ? overlay.unreadableFields
        : []),
    ],
  };
}

function deriveStuccoElevationMeasurements(measurements = {}, planFacts = {}) {
  const faces = Array.isArray(planFacts?.elevationFaces)
    ? planFacts.elevationFaces
    : [];
  let gross = 0;
  let openings = 0;
  let windowDoorOpenings = 0;
  let garageOpenings = 0;
  let hasCategorizedOpeningData = false;
  let nonStucco = 0;
  let hasOpeningData = false;
  let hasNonStuccoData = false;
  let parapet = 0;
  for (const face of faces) {
    const width = positive(face?.widthFt);
    const height = positive(face?.heightFt);
    const faceArea =
      positive(face?.stuccoAreaSqft) ||
      positive(face?.areaSqft) ||
      (width && height ? width * height : null);
    if (faceArea) gross += faceArea;
    const faceWindowDoorOpenings = positive(face?.windowDoorOpeningsSqft);
    const faceGarageOpenings = positive(face?.garageOpeningsSqft);
    const faceOpenings = positive(face?.openingsSqft);
    if (faceWindowDoorOpenings || faceGarageOpenings) {
      hasCategorizedOpeningData = true;
      windowDoorOpenings += faceWindowDoorOpenings || 0;
      garageOpenings += faceGarageOpenings || 0;
      // If this face also has an uncategorized total and no window/door split,
      // keep the residual as window/door (garage already counted separately).
      if (!faceWindowDoorOpenings && faceOpenings) {
        windowDoorOpenings += faceOpenings;
        hasOpeningData = true;
      }
    } else if (faceOpenings) {
      openings += faceOpenings;
      hasOpeningData = true;
    }
    const faceNonStucco = positive(face?.nonStuccoSqft);
    if (faceNonStucco) {
      nonStucco += faceNonStucco;
      hasNonStuccoData = true;
    }
    const faceParapet = positive(face?.parapetSqft);
    if (faceParapet) parapet += faceParapet;
  }
  const next = { ...measurements };
  const derivedKeys = [];
  if (!(positive(next.stuccoGrossWallSqft) > 0) && gross > 0) {
    next.stuccoGrossWallSqft = Math.round(gross * 10) / 10;
    derivedKeys.push("stuccoGrossWallSqft");
  }
  if (!(positive(next.stuccoParapetSqft) > 0) && parapet > 0) {
    next.stuccoParapetSqft = Math.round(parapet * 10) / 10;
    derivedKeys.push("stuccoParapetSqft");
  }
  if (!(positive(next.stuccoWindowDoorOpeningSqft) > 0)) {
    if (hasCategorizedOpeningData && windowDoorOpenings > 0) {
      next.stuccoWindowDoorOpeningSqft =
        Math.round(windowDoorOpenings * 10) / 10;
      derivedKeys.push("stuccoWindowDoorOpeningSqft");
    } else if (hasOpeningData && openings > 0) {
      // Uncategorized face openingsSqft — treat as window/door when no garage split.
      next.stuccoWindowDoorOpeningSqft = Math.round(openings * 10) / 10;
      derivedKeys.push("stuccoWindowDoorOpeningSqft");
    }
  }
  if (
    !(positive(next.stuccoGarageOpeningSqft) > 0) &&
    hasCategorizedOpeningData &&
    garageOpenings > 0
  ) {
    next.stuccoGarageOpeningSqft = Math.round(garageOpenings * 10) / 10;
    derivedKeys.push("stuccoGarageOpeningSqft");
  }
  if (
    !(positive(next.stuccoOtherFinishDeductionSqft) > 0) &&
    hasNonStuccoData &&
    nonStucco > 0
  ) {
    next.stuccoOtherFinishDeductionSqft = Math.round(nonStucco * 10) / 10;
    derivedKeys.push("stuccoOtherFinishDeductionSqft");
  }
  const grossValue = positive(next.stuccoGrossWallSqft);
  const openingValue = positive(next.stuccoWindowDoorOpeningSqft) || 0;
  const garageValue = positive(next.stuccoGarageOpeningSqft) || 0;
  const finishValue = positive(next.stuccoOtherFinishDeductionSqft) || 0;
  if (
    !(positive(next.stuccoNetWallSqft) > 0) &&
    grossValue &&
    (hasOpeningData ||
      positive(next.stuccoGarageOpeningSqft) ||
      hasNonStuccoData)
  ) {
    next.stuccoNetWallSqft = Math.max(
      0,
      Math.round((grossValue - openingValue - garageValue - finishValue) * 10) /
        10,
    );
    derivedKeys.push("stuccoNetWallSqft");
  }
  return { measurements: next, derivedKeys };
}

const NON_PAINTABLE_INTERIOR_ROOM_RE =
  /\b(garage|rv\s*garage|carport|patio|porch|deck|balcony|terrace|mechanical|unfinished|attic|crawl|exterior|\bshop\b)\b/i;

function isPaintableInteriorRoom(name) {
  const n = String(name || "").trim();
  if (!n) return false;
  return !NON_PAINTABLE_INTERIOR_ROOM_RE.test(n);
}

function roomRectangle(room) {
  const lengthFt = positive(room?.lengthFt);
  const widthFt = positive(room?.widthFt);
  const areaSqft =
    positive(room?.areaSqft) ||
    (lengthFt != null && widthFt != null ? lengthFt * widthFt : null);
  const perimeterLf =
    lengthFt != null && widthFt != null ? 2 * (lengthFt + widthFt) : null;
  return { lengthFt, widthFt, areaSqft, perimeterLf };
}

/** Interior wall/plate height must be explicit and per-story — never assume 9'. */
function explicitInteriorWallHeightFt(planFacts = {}) {
  const wall = positive(planFacts.wallHeightFt);
  const plate = positive(planFacts.plateHeightFt);
  const ceiling = positive(planFacts.ceilingHeightFt);
  if (wall != null && wall >= 7 && wall <= 14) return wall;
  if (plate != null && plate >= 7 && plate <= 14) return plate;
  if (ceiling != null && ceiling >= 7 && ceiling <= 14) return ceiling;
  return null;
}

function roundTenth(n) {
  return Math.round(Number(n) * 10) / 10;
}

/** Use labeled living SF when detected rooms cover less than 70% of it. */
const ROOM_CEILING_COVERAGE_MIN = 0.7;

function pickPaintingCeilingSqft(roomCeilingSqft, livingCeilingSqft) {
  const room = positive(roomCeilingSqft);
  const living = positive(livingCeilingSqft);
  if (living && room && room < living * ROOM_CEILING_COVERAGE_MIN) {
    return {
      value: living,
      usedRooms: false,
      incompleteRooms: true,
      roomSqft: room,
    };
  }
  if (room)
    return {
      value: room,
      usedRooms: true,
      incompleteRooms: false,
      roomSqft: room,
    };
  if (living)
    return {
      value: living,
      usedRooms: false,
      incompleteRooms: false,
      roomSqft: room,
    };
  return {
    value: null,
    usedRooms: false,
    incompleteRooms: false,
    roomSqft: room,
  };
}

function looksLikeLivingAreaProxy(
  value,
  measurements = {},
  buildingAreas = {},
) {
  const living =
    positive(buildingAreas.totalLivingSqft) ||
    positive(measurements.floorAreaSqft) ||
    positive(measurements.flooringSqft);
  if (living == null || value == null) return false;
  if (Math.abs(value - living) < 1) return true;
  const ratio = value / living;
  if (ratio >= 2.2 && ratio <= 4.0) {
    return [2.5, 3, 3.5].some(
      (multiplier) => Math.abs(value - living * multiplier) / living < 0.08,
    );
  }
  return false;
}

function deriveExteriorPaintFromFaces(planFacts = {}) {
  const faces = Array.isArray(planFacts.elevationFaces)
    ? planFacts.elevationFaces
    : [];
  let total = 0;
  let used = 0;
  for (const face of faces) {
    const paintArea = positive(face?.paintAreaSqft);
    if (paintArea) {
      total += paintArea;
      used += 1;
      continue;
    }
    const finish = String(face?.finish || face?.cladding || "").toLowerCase();
    const isMasonry = /brick|stone|masonry|veneer/.test(finish);
    const isStucco =
      /stucco|efis|eifs/.test(finish) || positive(face?.stuccoAreaSqft);
    const isPaintedCladding = /paint|siding|fiber|hardi|wood|lap/.test(finish);
    if (isMasonry || isStucco || !isPaintedCladding) continue;
    const width = positive(face?.widthFt);
    const height = positive(face?.heightFt);
    const area =
      positive(face?.areaSqft) || (width && height ? width * height : null);
    if (!area) continue;
    total += area;
    used += 1;
  }
  return used ? roundTenth(total) : null;
}

/**
 * Painting takeoff from dimensioned rooms + explicit wall/plate height.
 * Ceilings may fall back to labeled conditioned living SF when room geometry
 * is incomplete. Never uses living/floor SF as a wall-paint proxy.
 * Does not invent cabinet paint.
 */
function conditionedLivingCeilingSqft(buildingAreas = {}) {
  const main = positive(buildingAreas.mainFloorLivingSqft);
  const upper = positive(buildingAreas.upstairsLivingSqft);
  const additional = (
    Array.isArray(buildingAreas.additionalFloorAreas)
      ? buildingAreas.additionalFloorAreas
      : []
  )
    .map(positive)
    .filter((value) => value != null);
  if (main != null || upper != null || additional.length) {
    return roundTenth(
      (main || 0) +
        (upper || 0) +
        additional.reduce((sum, value) => sum + value, 0),
    );
  }
  return positive(buildingAreas.totalLivingSqft);
}

function derivePaintingGeometryMeasurements(
  measurements = {},
  rooms = [],
  planFacts = {},
  options = {},
) {
  const next = { ...measurements };
  const derivedKeys = [];
  const explicitKeys = [];
  const assumptions = [];
  const labeled = new Set(
    (Array.isArray(options.explicitlyLabeled)
      ? options.explicitlyLabeled
      : []
    ).map((key) => String(key || "").trim()),
  );
  const geometryDerived = new Set(
    (Array.isArray(options.geometryDerived) ? options.geometryDerived : []).map(
      (key) => String(key || "").trim(),
    ),
  );
  const rawVision =
    options.rawVisionMeasurements &&
    typeof options.rawVisionMeasurements === "object"
      ? options.rawVisionMeasurements
      : {};
  const buildingAreas = options.buildingAreas || planFacts.buildingAreas || {};
  const wallHeightFt =
    explicitInteriorWallHeightFt(planFacts) ||
    explicitInteriorWallHeightFt(options.rawPlanFacts || {});

  const paintable = (Array.isArray(rooms) ? rooms : [])
    .filter(
      (room) =>
        isPaintableInteriorRoom(room?.name) &&
        (Number(room?.confidence) || 0) >= 0.4,
    )
    .map((room) => ({ room, ...roomRectangle(room) }));
  const dimensioned = paintable.filter((entry) => entry.perimeterLf != null);
  const withArea = paintable.filter((entry) => entry.areaSqft != null);
  const MIN_ROOMS = 2;
  const roomCeilingSqft =
    withArea.length >= MIN_ROOMS
      ? withArea.reduce((sum, entry) => sum + entry.areaSqft, 0)
      : null;
  const livingCeilingSqft = conditionedLivingCeilingSqft(buildingAreas);
  const pickedCeiling = pickPaintingCeilingSqft(
    roomCeilingSqft,
    livingCeilingSqft,
  );
  const geometryIncomplete = Boolean(pickedCeiling.incompleteRooms);

  if (
    !(positive(next.wallPaintSqft) > 0) &&
    wallHeightFt &&
    dimensioned.length >= MIN_ROOMS
  ) {
    const wallSqft = dimensioned.reduce(
      (sum, entry) => sum + entry.perimeterLf * wallHeightFt,
      0,
    );
    const rounded = roundTenth(wallSqft);
    if (rounded > 0) {
      next.wallPaintSqft = rounded;
      derivedKeys.push("wallPaintSqft");
      assumptions.push(
        geometryIncomplete
          ? `Interior wall paint ${rounded.toLocaleString()} SF calculated from ${dimensioned.length} dimensioned rooms × ${wallHeightFt} FT wall/plate height (gross, room-perimeter method). Partial room geometry versus labeled living area — confirm remaining walls.`
          : `Interior wall paint ${rounded.toLocaleString()} SF calculated from ${dimensioned.length} dimensioned rooms × ${wallHeightFt} FT wall/plate height (gross, room-perimeter method).`,
      );
    }
  }

  const existingCeiling = positive(next.ceilingPaintSqft);
  const shouldReplaceCeiling =
    pickedCeiling.value != null &&
    (!(existingCeiling > 0) ||
      (geometryIncomplete &&
        livingCeilingSqft != null &&
        existingCeiling < livingCeilingSqft * ROOM_CEILING_COVERAGE_MIN));
  if (shouldReplaceCeiling && pickedCeiling.value) {
    const rounded = roundTenth(pickedCeiling.value);
    next.ceilingPaintSqft = rounded;
    if (!derivedKeys.includes("ceilingPaintSqft"))
      derivedKeys.push("ceilingPaintSqft");
    const ceilingSource = pickedCeiling.incompleteRooms
      ? `labeled conditioned living area (detected rooms ${pickedCeiling.roomSqft.toLocaleString()} SF were incomplete; garage and covered patio excluded)`
      : pickedCeiling.usedRooms
        ? `${withArea.length} dimensioned interior rooms`
        : "labeled conditioned living area (garage and covered patio excluded)";
    assumptions.push(
      `Ceiling paint ${rounded.toLocaleString()} SF calculated from ${ceilingSource}.`,
    );
  }

  if (!(positive(next.baseboardLf) > 0) && dimensioned.length >= MIN_ROOMS) {
    const lf = dimensioned.reduce((sum, entry) => sum + entry.perimeterLf, 0);
    const rounded = roundTenth(lf);
    if (rounded > 0) {
      next.baseboardLf = rounded;
      derivedKeys.push("baseboardLf");
      assumptions.push(
        geometryIncomplete
          ? `Baseboard / trim ${rounded.toLocaleString()} LF calculated from ${dimensioned.length} dimensioned room perimeters (planning LF). Partial room geometry — confirm remaining trim.`
          : `Baseboard / trim ${rounded.toLocaleString()} LF calculated from ${dimensioned.length} dimensioned room perimeters (planning LF).`,
      );
    }
  }

  if (!(positive(next.interiorDoorCount) > 0)) {
    const raw = positive(rawVision.interiorDoorCount);
    const count = raw != null ? Math.round(raw) : null;
    // Painting selected-trade: accept a bounded interior door count even when
    // vision omitted geometryDerived (Lot 58 has swings, no door schedule).
    if (count >= 1 && count <= 80) {
      next.interiorDoorCount = count;
      if (labeled.has("interiorDoorCount"))
        explicitKeys.push("interiorDoorCount");
      else derivedKeys.push("interiorDoorCount");
      assumptions.push(
        labeled.has("interiorDoorCount")
          ? `Interior door count ${count} EA labeled on the plan.`
          : geometryDerived.has("interiorDoorCount")
            ? `Interior door count ${count} EA from door schedule or identifiable interior door symbols.`
            : `Interior door count ${count} EA from identifiable interior door symbols on the plan.`,
      );
    }
  }

  if (!(positive(next.exteriorPaintSqft) > 0)) {
    const fromFaces = deriveExteriorPaintFromFaces(planFacts);
    if (
      fromFaces &&
      !looksLikeLivingAreaProxy(fromFaces, next, buildingAreas)
    ) {
      next.exteriorPaintSqft = fromFaces;
      derivedKeys.push("exteriorPaintSqft");
      assumptions.push(
        `Exterior paint ${fromFaces.toLocaleString()} SF calculated from dimensioned elevation faces with painted cladding.`,
      );
    }
  }

  const incompleteKeys = [];
  if (geometryIncomplete) {
    if (positive(next.wallPaintSqft) > 0) incompleteKeys.push("wallPaintSqft");
    if (positive(next.baseboardLf) > 0) incompleteKeys.push("baseboardLf");
  }

  return {
    measurements: next,
    derivedKeys,
    explicitKeys,
    assumptions,
    incompleteKeys,
  };
}

const INSULATION_VISION_INSTRUCTIONS = `
Insulation takeoff rules:
- Review wall sections, building sections, energy-code notes, insulation schedules, attic plans, roof plans, garage separation details, and exterior elevations.
- Return explicit labeled measurements using these canonical keys:
  exteriorWallInsulationSqft, atticInsulationSqft, insulatedRoofDeckSqft,
  floorInsulationSqft, garageSeparationInsulationSqft,
  insulatedGarageWallSqft, insulatedGarageCeilingSqft, openingDeductionSqft.
- Read exterior elevations like a stucco takeoff: return elevationFaces with readable face width/height or area, windowDoorOpeningsSqft, garageOpeningsSqft, and openingsSqft when categorized totals are unavailable. Also populate measurements.openingDeductionSqft when the summed opening area is readable.
- Return only exteriorWallInsulationSqft as the insulation wall quantity. Keep any gross wall geometry in planFacts for audit; do not expose a second gross-wall measurement in the insulation takeoff.
- For atticInsulationSqft, inspect roof plans, reflected ceiling plans, building sections, and insulation schedules. Use a labeled conditioned ceiling/attic area or calculate it only from readable, dimensioned ceiling geometry. Exclude garages, covered patios, open-to-below areas, and vaulted areas assigned to an insulated roof deck. If living area is the only ceiling proxy, leave this measurement unavailable so the app can show a calculated suggestion for contractor confirmation.
- On a two-story plan, total living area is never the attic/ceiling quantity. Use only the upper-level conditioned ceiling area bordering unconditioned attic space, and subtract any open-to-below or vaulted areas. Populate buildingAreas.mainFloorLivingSqft and buildingAreas.upstairsLivingSqft when those floor totals are printed.
- Return planFacts.ceilingBoundary when the drawings support a ceiling/attic boundary takeoff. Report upperFloorAtticSqft and mainFloorAtticExposureSqft as separate readable areas, plus vaultedOpenToBelowSqft and roofDeckInsulationSqft exclusions when present. Set complete=true only when the relevant roof/ceiling and floor-plan geometry has been reconciled. Do not use total living area as either component.
- Determine mainFloorAtticExposureSqft by comparing the actual first- and second-floor footprints against the roof/ceiling plan. Never calculate it as main-floor living minus upstairs living; offset wings and projections must be measured from the drawings. Every returned boundary component requires fieldEvidence with page, sheet, and readable source text.
- Return vaultedCeilingDetected=true only when a section, ceiling plan, roof plan, or note clearly identifies vaulted/cathedral/open-to-below conditioned ceiling areas. A roof pitch alone is not enough.
- For insulatedRoofDeckSqft, return a quantity only when the roof assembly or energy notes explicitly identify roof-deck insulation (for example spray foam or a vaulted/cathedral roof boundary). Do not substitute roof area merely because a roof plan exists.
- For garage separation and floor insulation, calculate only from readable shared-wall/ceiling or raised-floor/crawlspace geometry. Garage area alone is never a separation quantity, and living area alone is never a floor quantity.
- When a quantity is explicitly labeled, or directly calculated from readable labeled dimensions, put the numeric result in measurements using the canonical key. Do not leave a usable quantity only inside planFacts.
- If the plan gives exterior perimeter, wall/plate height, stories, and opening information but not an explicit insulation SF total, return those facts in planFacts plus measurements.openingDeductionSqft. The app will calculate net exteriorWallInsulationSqft from that geometry. Do not invent wall SF from living area or a single unlabeled elevation.
- If an insulation schedule, wall section, or energy-code note explicitly names the assembly, R-value, material, or garage inclusion, return insulationMaterialType, insulationRValue, and garageInsulationIncluded in planFacts with evidence. Never infer these from typical practice.
- Attic insulation and insulated roof deck are alternative thermal boundaries by default; do not count both unless the plan explicitly requires both.
- Do not use living SF, drywall SF, or visual proportions as an AI-detected insulation SF. If living area is the only possible ceiling proxy, leave atticInsulationSqft unavailable and record the missing/confirmation requirement instead. Do not invent R-values, assembly types, garage inclusion, or material quantities.
- Mark explicit quantities in explicitlyLabeled and calculated quantities in geometryDerived. Put unsupported values in unreadableFields or missingInfo.
`;

const DRYWALL_VISION_INSTRUCTIONS = `
Drywall takeoff rules:
- Review floor plans, room schedules, reflected ceiling plans, interior elevations, sections, and finish schedules.
- When selected trade is Drywall, return drywallSqft only when the plan explicitly labels a drywall surface quantity or when wall and ceiling surfaces can be calculated from readable room dimensions plus an explicit wall/plate height.
- Prefer separate drywallWallSqft and drywallCeilingSqft when both surfaces can be supported. Retain drywallOpeningDeductionSqft as supporting context, but calculate drywallSqft as wall plus ceiling surfaces without requiring an opening deduction.
- Add explicitly labeled quantities to explicitlyLabeled. Add quantities calculated from readable room geometry to geometryDerived and include fieldEvidence describing the source sheets or labels.
- Do not use total living area, floor area, building footprint, visual proportions, or an arbitrary multiplier as drywallSqft. For a selected Drywall pass, return readable dimensioned rooms with source sheet/page in rooms[] and publish supported partial geometry as NEEDS_CONFIRMATION instead of leaving every drywall field blank.
- Distinguish interior drywall from garage/fire-rated, moisture-resistant, vaulted/sloped, high-ceiling, soffit, and shaft areas when the plan documents those boundaries. Return separate area keys for documented specialty areas and do not double-count them in the net total.
- Capture drywall finishLevel only when the finish schedule or notes explicitly identifies Level 4, Level 5, or a specialty finish. Default residential finish is handled during scope confirmation; never guess Level 5.
`;

const WINDOWS_DOORS_VISION_INSTRUCTIONS = `
Windows & doors takeoff rules:
- Review every exterior elevation, window schedule, door schedule, opening schedule, floor plan, section, and relevant detail sheet.
- Return only these canonical counts: windowCount, exteriorDoorCount, slidingDoorCount, garageDoorSingleCount, garageDoorDoubleCount, and garageDoorRvCount.
- Count window units from a readable window schedule, opening tags, or identifiable exterior-elevation symbols. Count exterior swing/hinged doors separately from sliding or multi-panel patio doors. Exclude interior doors from exteriorDoorCount.
- Classify garage openings by documented schedule/type or readable dimensions: single, double, and RV/oversized. Do not infer garage door type from garage area, living area, or visual proportions.
- Count a unit once even when it appears on multiple elevations; reconcile elevations against schedules and note any unresolved duplicate or missing opening.
- Put explicit schedule/label counts in explicitlyLabeled and counts from clearly identifiable, directly counted symbols in geometryDerived. Include fieldEvidence with sheet/page and the readable schedule, tag, symbol, or dimension used.
- Do not invent window/door counts from typical residential layouts. If the schedule or symbols are unreadable, omit that field and list the missing sheet or field in unreadableFields or missingInfo.
`;

const HVAC_VISION_INSTRUCTIONS = `
HVAC takeoff rules:
- Review dedicated M / mechanical sheets, equipment schedules, HVAC legends, duct layouts, ventilation plans, floor plans with mechanical callouts, sections, and HVAC notes.
- Return only these canonical measurements: hvacSystemCount, hvacSystemTons, hvacServiceCallCount, hvacEquipmentReplacementCount, hvacRefrigerantCount, hvacThermostatCount, hvacDuctworkLf, hvacSupplyRegisterCount, hvacReturnGrilleCount, hvacVentilationCount, hvacPermitCount, and hvacCleanupCount.
- Count HVAC systems, furnaces, air handlers, condensers, heat pumps, or mini-splits only when the schedule, tags, or directly countable symbols support the quantity. Return tonnage only when explicitly labeled.
- Count supply registers/diffusers and return grilles separately when documented on mechanical plans or schedules.
- Return ductwork only when linear feet are labeled or directly dimensioned. Do not infer duct LF, system count, tonnage, or HVAC pricing from living area.
- Count thermostats, whole-house ventilation equipment (ERV, HRV, or dedicated fresh-air ventilators), replacement equipment, refrigerant service, permits, and cleanup only when explicitly documented. Do not count electrical bath exhaust-fan work, dryer vents, range hoods, or roof vents as HVAC ventilation.
- If a PDF text-layer block lists HVAC instance tags (for example repeated SA, RA, TSTAT, CU-1, or RTU-1 callouts), treat those as counted devices — not legend entries. Prefer those instance-tag totals over a lower symbol estimate.
- Put schedule/label quantities in explicitlyLabeled and directly counted symbols or measured ductwork in geometryDerived. Include fieldEvidence with page, sheet, and readable source text. Omit unreadable values and list the missing field in unreadableFields or missingInfo.
`;

function buildHvacSystemPrompt() {
  return `You are a construction estimator performing a focused HVAC takeoff from mechanical plans, equipment schedules, HVAC layouts, sections, and notes.

Return ONLY valid JSON (no markdown).

${HVAC_VISION_INSTRUCTIONS}

Return the existing plan-takeoff JSON envelope with measurements, fieldConfidence, explicitlyLabeled, geometryDerived, unreadableFields, fieldEvidence, assumptions, and notesBlock.`;
}

function perStoryWallHeightFromPlanFacts(planFacts = {}, stories = 1) {
  let wallHeightCandidate = positive(planFacts?.wallHeightFt);
  let plateHeightCandidate = positive(planFacts?.plateHeightFt);
  if (stories > 1 && plateHeightCandidate > 14) {
    plateHeightCandidate =
      Math.round((plateHeightCandidate / stories) * 10) / 10;
  }
  if (stories > 1 && wallHeightCandidate > 14) {
    wallHeightCandidate = Math.round((wallHeightCandidate / stories) * 10) / 10;
  }
  return wallHeightCandidate || plateHeightCandidate || null;
}

const INSULATION_MIN_CREDIBLE_OPENING_SHARE_OF_GROSS = 0.08;

function isCredibleInsulationOpeningDeduction(openingSqft, grossWallSqft) {
  if (!(positive(openingSqft) > 0)) return false;
  if (!(positive(grossWallSqft) > 0)) return true;
  return (
    positive(openingSqft) >=
    positive(grossWallSqft) * INSULATION_MIN_CREDIBLE_OPENING_SHARE_OF_GROSS
  );
}

function deriveInsulationMeasurementsFromPlanFacts(
  measurements = {},
  planFacts = {},
) {
  const next = { ...measurements };
  const derivedKeys = [];
  const assumptions = [];
  const faces = Array.isArray(planFacts?.elevationFaces)
    ? planFacts.elevationFaces
    : [];
  let openingDeduction = 0;
  let hasOpeningEvidence = false;
  for (const face of faces) {
    const opening =
      positive(face?.windowDoorOpeningsSqft) ||
      positive(face?.garageOpeningsSqft) ||
      positive(face?.openingsSqft);
    if (opening != null) {
      openingDeduction += opening;
      hasOpeningEvidence = true;
    }
  }
  const stuccoWindowOpenings = positive(next.stuccoWindowDoorOpeningSqft);
  const stuccoGarageOpenings = positive(next.stuccoGarageOpeningSqft);
  const stuccoOpeningTotal =
    (stuccoWindowOpenings || 0) + (stuccoGarageOpenings || 0);
  if (stuccoOpeningTotal > 0) {
    hasOpeningEvidence = true;
    if (!(openingDeduction > 0)) openingDeduction = stuccoOpeningTotal;
  }
  if (
    !(positive(next.openingDeductionSqft) > 0) &&
    hasOpeningEvidence &&
    openingDeduction > 0
  ) {
    next.openingDeductionSqft = roundTenth(openingDeduction);
    derivedKeys.push("openingDeductionSqft");
    assumptions.push(
      stuccoOpeningTotal > 0 && openingDeduction === stuccoOpeningTotal
        ? `Opening deduction ${roundTenth(openingDeduction).toLocaleString()} SF from readable elevation window, door, and garage openings.`
        : `Opening deduction ${roundTenth(openingDeduction).toLocaleString()} SF summed from dimensioned elevation opening areas.`,
    );
  }
  const completeFaceCoverage =
    faces.length >= 2 &&
    faces.every((face) => {
      const area =
        positive(face?.stuccoAreaSqft) ||
        positive(face?.areaSqft) ||
        (() => {
          const width = positive(face?.widthFt);
          const height = positive(face?.heightFt);
          return width && height ? width * height : null;
        })();
      return area > 0;
    });
  const faceGross = faces.reduce((sum, face) => {
    const area =
      positive(face?.stuccoAreaSqft) ||
      positive(face?.areaSqft) ||
      (() => {
        const width = positive(face?.widthFt);
        const height = positive(face?.heightFt);
        return width && height ? width * height : null;
      })();
    return sum + (area || 0);
  }, 0);
  const perimeter =
    positive(planFacts?.exteriorPerimeterLf) ||
    positive(planFacts?.foundationPerimeterLf);
  const stories = positive(planFacts?.storyCount);
  const wallHeight = perStoryWallHeightFromPlanFacts(planFacts, stories || 1);
  const grossWallArea =
    perimeter && stories && wallHeight
      ? perimeter * wallHeight * stories
      : completeFaceCoverage
        ? faceGross
        : null;
  let usableOpeningDeduction =
    positive(next.openingDeductionSqft) ||
    (hasOpeningEvidence && openingDeduction > 0 ? openingDeduction : null);
  if (
    grossWallArea != null &&
    usableOpeningDeduction != null &&
    !isCredibleInsulationOpeningDeduction(usableOpeningDeduction, grossWallArea)
  ) {
    usableOpeningDeduction = null;
  }
  if (grossWallArea != null && usableOpeningDeduction == null) {
    // Vision often omits elevation openings. Keep a reviewable net wall
    // quantity from labeled geometry minus the standard 15% opening share
    // instead of leaving the takeoff blank.
    const assumedOpenings = roundTenth(grossWallArea * 0.15);
    next.openingDeductionSqft = assumedOpenings;
    derivedKeys.push("openingDeductionSqft");
    assumptions.push(
      `Opening deduction ${assumedOpenings.toLocaleString()} SF assumed at 15% of ${roundTenth(grossWallArea).toLocaleString()} SF labeled wall area pending elevation confirmation.`,
    );
  }
  const openingForNet =
    positive(next.openingDeductionSqft) ||
    (hasOpeningEvidence && openingDeduction > 0 ? openingDeduction : null);
  const credibleOpeningForNet =
    grossWallArea != null &&
    openingForNet != null &&
    !isCredibleInsulationOpeningDeduction(openingForNet, grossWallArea)
      ? grossWallArea != null
        ? roundTenth(grossWallArea * 0.15)
        : null
      : openingForNet;
  if (
    positive(next.exteriorWallInsulationSqft) == null &&
    grossWallArea != null &&
    credibleOpeningForNet != null
  ) {
    const netWallArea = Math.max(
      0,
      grossWallArea - Number(credibleOpeningForNet),
    );
    next.exteriorWallInsulationSqft = roundTenth(netWallArea);
    derivedKeys.push("exteriorWallInsulationSqft");
    assumptions.push(
      `Exterior wall insulation ${roundTenth(netWallArea).toLocaleString()} SF calculated from complete labeled wall geometry less readable opening deductions.`,
    );
  } else if (
    grossWallArea != null &&
    credibleOpeningForNet != null &&
    positive(next.exteriorWallInsulationSqft) != null &&
    Math.abs(positive(next.exteriorWallInsulationSqft) - grossWallArea) <=
      Math.max(25, grossWallArea * 0.02)
  ) {
    const netWallArea = Math.max(
      0,
      grossWallArea - Number(credibleOpeningForNet),
    );
    next.exteriorWallInsulationSqft = roundTenth(netWallArea);
    if (!derivedKeys.includes("exteriorWallInsulationSqft")) {
      derivedKeys.push("exteriorWallInsulationSqft");
    }
    assumptions.push(
      `Exterior wall insulation corrected to ${roundTenth(netWallArea).toLocaleString()} SF net after ${roundTenth(credibleOpeningForNet).toLocaleString()} SF readable openings.`,
    );
  } else if (
    grossWallArea == null &&
    openingForNet != null &&
    positive(next.exteriorWallInsulationSqft) != null &&
    positive(next.exteriorWallInsulationSqft) > openingForNet
  ) {
    // Some vision responses provide the wall total and an opening deduction
    // without enough geometry to identify the gross baseline. The insulation
    // contract is net SF, so normalize that unqualified wall total here.
    const netWallArea = Math.max(
      0,
      positive(next.exteriorWallInsulationSqft) - Number(openingForNet),
    );
    next.exteriorWallInsulationSqft = roundTenth(netWallArea);
    if (!derivedKeys.includes("exteriorWallInsulationSqft")) {
      derivedKeys.push("exteriorWallInsulationSqft");
    }
    assumptions.push(
      `Exterior wall insulation normalized to ${roundTenth(netWallArea).toLocaleString()} SF net after ${roundTenth(openingForNet).toLocaleString()} SF readable openings.`,
    );
  }

  const ceilingBoundary = planFacts?.ceilingBoundary;
  const upperAttic = positive(ceilingBoundary?.upperFloorAtticSqft);
  const mainAtticExposure = positive(
    ceilingBoundary?.mainFloorAtticExposureSqft,
  );
  if (upperAttic != null && mainAtticExposure != null) {
    const vaulted = positive(ceilingBoundary?.vaultedOpenToBelowSqft) || 0;
    const vaultedConfirmed =
      vaulted > 0 &&
      String(
        ceilingBoundary?.fieldEvidence?.vaultedOpenToBelowSqft?.confidence ||
          "",
      ) === "high";
    const roofDeck = positive(ceilingBoundary?.roofDeckInsulationSqft) || 0;
    const roofDeckConfirmed =
      roofDeck > 0 &&
      String(
        ceilingBoundary?.fieldEvidence?.roofDeckInsulationSqft?.confidence ||
          "",
      ) === "high";
    const atticTotal = Math.max(
      0,
      upperAttic +
        mainAtticExposure -
        (vaultedConfirmed ? vaulted : 0) -
        (roofDeckConfirmed ? roofDeck : 0),
    );
    if (!(positive(next.atticInsulationSqft) > 0)) {
      next.atticInsulationSqft = roundTenth(atticTotal);
      derivedKeys.push("atticInsulationSqft");
      assumptions.push(
        `Attic / ceiling insulation ${roundTenth(atticTotal).toLocaleString()} SF from measured ceiling-boundary components.`,
      );
    }
  }

  return { measurements: next, derivedKeys, assumptions };
}

function validateInsulationMeasurementsAgainstPlanFacts(
  measurements = {},
  planFacts = {},
) {
  const next = { ...measurements };
  const invalidKeys = [];
  const faces = Array.isArray(planFacts?.elevationFaces)
    ? planFacts.elevationFaces
    : [];
  const faceArea = (face) =>
    positive(face?.stuccoAreaSqft) ||
    positive(face?.areaSqft) ||
    (() => {
      const width = positive(face?.widthFt);
      const height = positive(face?.heightFt);
      return width && height ? width * height : null;
    })();
  const completeFaceCoverage =
    faces.length >= 2 && faces.every((face) => faceArea(face) > 0);
  const faceGross = faces.reduce((sum, face) => sum + (faceArea(face) || 0), 0);
  const faceOpenings = faces.reduce((sum, face) => {
    const categorized =
      positive(face?.windowDoorOpeningsSqft) ||
      positive(face?.garageOpeningsSqft);
    return sum + (categorized || positive(face?.openingsSqft) || 0);
  }, 0);
  const perimeter =
    positive(planFacts?.exteriorPerimeterLf) ||
    positive(planFacts?.foundationPerimeterLf);
  const stories = positive(planFacts?.storyCount);
  const height = perStoryWallHeightFromPlanFacts(
    planFacts,
    stories > 1 ? stories : 1,
  );
  const completeWallGeometry = perimeter && stories && height;
  const expectedGross = completeWallGeometry
    ? perimeter * height * stories
    : completeFaceCoverage
      ? faceGross
      : null;
  const expectedOpenings =
    completeFaceCoverage && faceOpenings > 0
      ? faceOpenings
      : completeWallGeometry
        ? positive(next.openingDeductionSqft) ||
          (faceOpenings > 0 ? faceOpenings : null)
        : null;
  const expectedNet =
    expectedGross != null && expectedOpenings != null
      ? Math.max(0, expectedGross - expectedOpenings)
      : null;
  const materiallyDifferent = (actual, expected) =>
    actual != null &&
    Math.abs(actual - expected) > Math.max(25, expected * 0.15);

  if (expectedGross != null && completeWallGeometry) {
    const actualGross = positive(next.exteriorWallGrossSqft);
    if (materiallyDifferent(actualGross, expectedGross)) {
      next.exteriorWallGrossSqft = roundTenth(expectedGross);
      invalidKeys.push("exteriorWallGrossSqft");
    }
  }
  if (expectedOpenings != null) {
    const actualOpenings = positive(next.openingDeductionSqft);
    if (materiallyDifferent(actualOpenings, expectedOpenings)) {
      next.openingDeductionSqft = roundTenth(expectedOpenings);
      invalidKeys.push("openingDeductionSqft");
    }
  } else if (
    faces.length === 1 &&
    !completeWallGeometry &&
    positive(next.openingDeductionSqft) > 0
  ) {
    delete next.openingDeductionSqft;
    invalidKeys.push("openingDeductionSqft");
  }
  if (expectedNet != null) {
    const actualNet = positive(next.exteriorWallInsulationSqft);
    if (materiallyDifferent(actualNet, expectedNet)) {
      next.exteriorWallInsulationSqft = roundTenth(expectedNet);
      invalidKeys.push("exteriorWallInsulationSqft");
    }
  } else if (
    faces.length === 1 &&
    !completeWallGeometry &&
    positive(next.exteriorWallInsulationSqft) > 0
  ) {
    delete next.exteriorWallInsulationSqft;
    invalidKeys.push("exteriorWallInsulationSqft");
  } else if (
    expectedGross != null &&
    expectedOpenings == null &&
    positive(next.exteriorWallInsulationSqft) != null &&
    Math.abs(positive(next.exteriorWallInsulationSqft) - expectedGross) <=
      Math.max(25, expectedGross * 0.02)
  ) {
    // A gross wall total without an opening basis is not a valid net
    // insulation quantity. Do not let it reach pricing as if it were net.
    delete next.exteriorWallInsulationSqft;
    invalidKeys.push("exteriorWallInsulationSqft");
  }

  return { measurements: next, invalidKeys };
}

function buildSystemPrompt() {
  return `You are a construction estimator reading architectural floor plans / blueprints (often photos of printed sheets).

Return ONLY valid JSON (no markdown). Read printed labels carefully — title blocks, Building Areas / Area Schedule tables, and room dimension strings like 18'-2" x 14'-7".

Extract BOTH:
1. Building Areas / Area Schedule / square-footage tables in the title block.
   - totalLivingSqft = "Total Living Area" or Main Floor Living + Upstairs Living (living only — exclude garage, patio, roof deck unless labeled living).
   - mainFloorLivingSqft, upstairsLivingSqft, garageSqft, coveredPatioSqft, coveredOutdoorSqft, roofDeckSqft when labeled.
2. EVERY individual room / space with a readable length×width or labeled SF on floor-plan pages — not a sample. Estimators need per-room SF when finishes differ (tile vs carpet, etc.).
3. For selected-trade Stucco / Exterior Finish mode, inspect exterior elevations, wall sections, and exterior finish schedules in addition to floor plans. Extract clearly labeled stucco takeoff values: gross exterior wall area, each elevation face width/height, window/door opening area or count × dimensions, garage door opening area or count × dimensions, other finish deduction area, soffit area, parapet/raised wall area, foam trim/bands LF, control/expansion joints LF, story count, and story-specific wall heights. Keep window/door openings separate from garage door openings. For each elevation face, use windowDoorOpeningsSqft and garageOpeningsSqft when those categories can be read; use openingsSqft only when the total cannot be categorized, and do not also populate garage openings from an uncategorized total. When the plan clearly provides the inputs, gross wall area may be derived from labeled elevation face areas, or labeled exterior perimeter × story-specific wall heights; mark it as derived in fieldEvidence. Never use ridge height as wall height. If neither a labeled quantity nor complete labeled inputs exist, omit it and list it in unreadableFields or missingInfo.
   - Treat parapet / raised-wall stucco surface as a separate quantity from the main vertical exterior wall area. Never include the same parapet SF in both quantities. If the parapet surface cannot be confidently read or derived from labeled dimensions, omit it and list stuccoParapetSqft in unreadableFields or missingInfo.
4. Elevations / sections: use them for labeled exterior geometry and materials. Read every elevation separately (front, rear, left, right), identify stucco versus stone/brick/siding/wood/metal cladding, and capture visible openings by labeled dimensions. Do not invent geometry from visual proportions.
5. Structured planFacts with evidence for each fact. Include only printed/labeled facts: story count/floor evidence, roof pitch, wall or plate heights, exterior/foundation perimeter LF, nonPainted exterior finish percent (stone/brick/stucco/masonry), covered-patio roof status, page/sheet, and supplied geometry. Never infer geometry or fabricate a quantity.

Exhaustive rooms (required):
- Include every labeled room you can read: bedrooms, primary suite, den/office, great room / living / family, dining, kitchen, pantry, laundry, mud, foyer/entry, hallways (when dimensioned), closets / WIC, powder, every bathroom (primary bath, guest bath, Jack & Jill, etc.), garage / RV garage / shop, covered patio / porch / deck, and similarly labeled spaces.
- Do NOT stop after a few "key" rooms. Prefer a complete rooms[] list over a short summary.
- Pair each room name with the L×W printed under/inside THAT room only. Never swap dims between Kitchen/Den/Bedrooms/Garage/RV Garage.
- Take room L×W from floor-plan / main-floor layout sheets. Do NOT use foundation-plan overall garage envelopes (e.g. a single ~31'×23' "GARAGE" box) when the floor plan labels separate Garage and RV Garage bays.
- Each bathroom is its OWN rooms[] entry (Primary Bath, Bath 2, Powder, …) AND you also sum all bath areas into measurements.bathroomFloorSqft ONLY when those baths have readable L×W. If baths have no dimensions, omit bathroomFloorSqft (do not invent ~90 SF).
- Rooms without a readable L×W or SF: omit area/length/width (do not invent) and add the room name to unreadableFields with reason "No dimension label on plan" (or blurry/cut off). Still skip inventing sizes.
- If a "PDF text layer" block is provided in the user message, treat those schedule totals and room L×W as ground truth — keep them, do not replace with different numbers.

Readability contract (most important):
- Only report a number when you can actually READ it printed on the sheet. If a dimension string, table cell, or label is blurry, cut off, too small, or ambiguous — OMIT that value entirely and list the field key (or room name) in unreadableFields with a short reason. NEVER estimate, round from visual proportions, or fill a typical value.
- Set imageQuality: "good" (text crisp and legible), "partial" (some labels legible, others not), or "unreadable" (cannot reliably read any dimension or schedule value).
- If imageQuality is "unreadable", set success false with reason "Plan images are not clear enough to read dimensions."
- For every key you put in measurements, add the same key to fieldConfidence with 0-1 confidence that the value was read correctly (1.0 = printed clearly and unambiguous, 0.5 = partially legible / had to interpret). Do not report a field you'd score below 0.4 — put it in unreadableFields instead.

Rules:
1. Only report numbers you can read on the sheet. Never invent sizes. Never estimate paint, drywall, or trim from floor area.
2. If length×width are labeled (including feet-inches like 12'-0" x 10'-6"), convert to decimal feet and set areaSqft = lengthFt × widthFt.
3. Map rooms (still list EVERY room in rooms[] even when mapped):
   - bathroom / bath / powder / M. Bath / Primary Bath → measurementKey bathroomFloorSqft; also sum all baths into measurements.bathroomFloorSqft
   - kitchen → kitchenFloorSqft
   - deck / patio / covered patio / roof deck → deckSqft
   - bedrooms, living, family, great room, dining, office, laundry, hallway, pantry, closet, garage → list in rooms with measurementKey null; do NOT put a single bedroom into floorAreaSqft
4. measurements.floorAreaSqft MUST be total living area from the Building Areas table when present. Do not use one room (e.g. a bath) as floorAreaSqft.
5. measurements.flooringSqft = same as floorAreaSqft when living SF is known.
6. measurements.deckSqft = covered patio + roof deck (+ covered outdoor when no patio) from the schedule. NEVER put covered patio / roof deck into concreteSqft.
7. measurements.garageSqft = Garage Area from the schedule when labeled (not living SF). Still list Garage / RV Garage as separate rooms[] entries with their L×W when labeled.
8. measurements.concreteSqft ONLY for labeled concrete slab / driveway / sidewalk / flatwork when a single total is shown — omit for covered patio or wood deck. Put concreteSqft in explicitlyLabeled when used.
8b. When the plan labels separate flatwork areas, prefer measurements.concreteDrivewaySqft, concretePatioSqft, concreteWalkwaySqft, concreteSidewalkSqft, and concreteRvPadSqft instead of rolling them into concreteSqft. Only use concreteSqft when the sheet gives one combined flatwork total.
8c. measurements.concreteCy ONLY for labeled footing / foundation / structural concrete CY when explicitly dimensioned or scheduled — never estimate CY from flatwork SF.
8d. When the finish schedule or floor plan labels separate new flooring areas by product, prefer measurements.flooringLvpSqft, flooringTileSqft, flooringCarpetSqft, flooringLaminateSqft, flooringEngineeredHardwoodSqft, flooringSolidHardwoodSqft, and flooringSheetVinylSqft instead of rolling them into flooringSqft. Only use flooringSqft when the sheet gives one combined floor total without product breakdown.
8e. measurements.floorDemoSqft ONLY when demolition/removal of existing flooring is explicitly labeled — never infer demo from new flooring alone. Per-type demo keys (floorDemoCarpetSqft, floorDemoTileSqft, etc.) only when explicitly labeled.
8f. Do NOT infer floor-prep severity, existing floor type, underlayment, moisture barrier, baseboards, transitions, or quarter round unless explicitly labeled on the plan.
9. NEVER estimate paint, drywall, or trim from living/floor area, building footprint, or an arbitrary multiplier. Except in the selected Drywall trade pass, drywallSqft, drywallWallSqft, and drywallCeilingSqft remain labeled-only; selected Drywall may use complete, readable room geometry with explicit wall/plate height and must mark those values geometryDerived. railingLf, cabinetRunLf, and cabinetPaintSqft remain labeled-only (cabinets only when paint-grade millwork / painted cabinetry is explicit). Stucco quantities may also be calculated only from complete, clearly labeled elevation face, perimeter/height/story, or opening-dimension inputs; mark those values as plan-derived and never estimate from living area.
9a. Painting takeoff from plan geometry IS allowed when the inputs are explicit: wallPaintSqft = sum of dimensioned room perimeters × explicit wall/plate height (gross; each room's perimeter is a valid finish takeoff — do not use floorAreaSqft). ceilingPaintSqft = sum of dimensioned interior room areas when those rooms have painted ceilings. baseboardLf = sum of dimensioned room perimeters when finish/base geometry supports it. Put those keys in measurements and geometryDerived; set fieldEvidence sourceType to measured_from_geometry. If wall/plate height is not readable, omit wallPaintSqft. If room dimensions are incomplete, omit rather than guess. Never assume 9' ceilings.
9b. Prefer separate measurements.wallPaintSqft and measurements.ceilingPaintSqft when walls and ceilings can be taken off separately. Only use measurements.paintAreaSqft when the sheet gives one combined paintable total without a wall/ceiling split. Do not collapse separate wall and ceiling areas into paintAreaSqft.
9c. interiorDoorCount from a door schedule or reliably identifiable interior door symbols (exclude exterior doors). Prefill the count even without a schedule; do not assume every door is in the bid. Add interiorDoorCount to geometryDerived or explicitlyLabeled. cabinetRunLf / cabinetPaintSqft ONLY when painted cabinetry or paint-grade millwork is explicit — never map generic kitchen cabinet LF into painting.
9d. exteriorPaintSqft from labeled exterior paint/finish area or dimensioned elevation width × supported wall height for painted cladding (set elevationFaces[].paintAreaSqft / finish). Never from footprint or living SF. If the cladding is stucco/brick/stone and paint is trim/eaves/doors only, omit exterior wall paint area.
9e. Do NOT infer paint occupancy, application method, prep severity, or masking complexity from plan geometry.
9f. Electrical takeoff from electrical sheets IS allowed when Electrical is the selected trade. Count device/fixture/panel symbols on E sheets, legends, and panel schedules. Map onto existing keys only: mainPanelCount, serviceAmperage, standardReceptacleCount, gfciReceptacleCount, recessedLightCount, and the other ElectricalQuantityKey values. Never invent electrical_rough or electrical_trim packages, living-SF electrical totals, homeruns from device counts, conduit LF, or trench LF.
9g. Count the semantic item, not every visual mark. GFCI symbol → gfciReceptacleCount only. Labeled range circuit → rangeHookupCount only (not also circuit50aCount). 3-way switch devices → threeWaySwitchCount only (not an extra branch circuit).
9h. Circuit/homerun counts, breaker ampacity, conduitLf, trenchingLf, EV, and specialty equipment are explicit-only: omit unless a panel schedule or labeled callout exists, and add those keys to explicitlyLabeled.
10. Multi-page sets: merge all floor-plan pages; ignore duplicate title-block totals; elevations do not add living SF.
11. success false if none of the images are plans/blueprints, OR if imageQuality is "unreadable".
12. notesBlock: short contractor-readable summary of Building Areas totals (room-by-room SF will be listed separately by the app).

Schema:
The numeric values in the example below are schema placeholders only. Never
copy any example number into the response unless the same number is clearly
printed or calculated from the submitted plan pages.
{
  "success": true | false,
  "reason": "string | null",
  "imageQuality": "good" | "partial" | "unreadable",
  "buildingAreas": {
    "totalLivingSqft": 2418,
    "mainFloorLivingSqft": 1373,
    "upstairsLivingSqft": 1045,
    "garageSqft": 483,
    "coveredPatioSqft": 375,
    "coveredOutdoorSqft": 73,
    "roofDeckSqft": 331
  },
  "planFacts": {
    "storyCount": 2,
    "roofPitch": "5:12",
    "wallHeightFt": 9,
    "plateHeightFt": 9,
    "exteriorPerimeterLf": 214,
    "foundationPerimeterLf": 214,
    "nonPaintedExteriorPercent": 25,
    "coveredPatioRoofed": true,
    "elevationFaces": [
      {
        "id": "front",
        "widthFt": 62,
        "heightFt": 10.2,
        "areaSqft": 632.4,
        "stuccoAreaSqft": 560,
        "paintAreaSqft": 0,
        "finish": "stucco",
        "openingsSqft": null,
        "windowDoorOpeningsSqft": null,
        "garageOpeningsSqft": 0,
        "nonStuccoSqft": 0,
        "evidence": [{ "page": 8, "sheet": "A-7", "label": "FRONT ELEVATION", "sourceText": "readable face dimensions" }]
      }
    ],
    "geometry": [],
    "ceilingBoundary": {
      "upperFloorAtticSqft": 1613,
      "mainFloorAtticExposureSqft": 647,
      "vaultedOpenToBelowSqft": 0,
      "roofDeckInsulationSqft": 0,
      "complete": true,
      "confidence": "medium",
      "fieldEvidence": {}
    },
    "fieldEvidence": {
      "storyCount": {
        "value": 2,
        "sourceType": "detected_from_plan",
        "confidence": "high",
        "evidence": [{ "page": 2, "sheet": "A1.1", "label": "Upper Floor", "sourceText": "UPPER FLOOR LIVING 1209 SF", "sourceType": "plan_vision", "confidence": 0.95 }]
      }
    }
  },
  "rooms": [
    {
      "name": "Kitchen",
      "lengthFt": 12.083,
      "widthFt": 14.167,
      "areaSqft": 171.2,
      "measurementKey": "kitchenFloorSqft",
      "confidence": 0.9
    },
    {
      "name": "Primary Bath",
      "lengthFt": 10,
      "widthFt": 8,
      "areaSqft": 80,
      "measurementKey": "bathroomFloorSqft",
      "confidence": 0.85
    },
    {
      "name": "Great Room",
      "lengthFt": 14.833,
      "widthFt": 17.5,
      "areaSqft": 259.6,
      "measurementKey": null,
      "confidence": 0.9
    },
    {
      "name": "Bed 2",
      "lengthFt": 10.333,
      "widthFt": 10.25,
      "areaSqft": 105.9,
      "measurementKey": null,
      "confidence": 0.9
    }
  ],
  "measurements": {
    "kitchenFloorSqft": 171.2,
    "bathroomFloorSqft": 80,
    "floorAreaSqft": 2418,
    "flooringSqft": 2418,
    "deckSqft": 375,
    "garageSqft": 483
  },
  "fixtureInventory": {
    "toilets": 3,
    "lavatories": 4,
    "showers": 2,
    "tubs": 1,
    "kitchenSinks": 1,
    "dishwasherConnections": 1,
    "laundryBoxes": 1,
    "hoseBibs": 4,
    "floorDrains": 1,
    "waterHeaters": 1,
    "gasAppliances": 2
  },
  "utilityConnections": [
    {
      "label": "Municipal water and sewer tie-in",
      "status": "scope_only",
      "evidence": [{ "page": 3, "sheet": "P0.1", "label": "Utility connection note" }]
    }
  ],
  "complexityFactors": [
    {
      "key": "two_story_plumbing",
      "label": "Two-story plumbing",
      "status": "review",
      "confidence": 0.9,
      "evidence": [{ "page": 2, "sheet": "A1.1", "label": "Upper floor" }]
    }
  ],
  "fieldEvidence": {
    "plumbingRoughPointCount": [
      {
        "page": 5,
        "sheet": "P1.1",
        "label": "Fixture schedule",
        "sourceText": "Fixture inventory derived from schedule",
        "sourceType": "plan_vision",
        "evidenceKind": "fixture_inventory_derived",
        "confidence": 0.82,
        "derivedFrom": ["toilets", "lavatories", "showers", "tubs", "kitchenSinks", "laundryBoxes"]
      }
    ]
  },
  "fieldConfidence": {
    "kitchenFloorSqft": 0.9,
    "floorAreaSqft": 0.95
  },
  "unreadableFields": [
    { "field": "Guest Bath", "reason": "No dimension label on plan" }
  ],
  "explicitlyLabeled": [],
  "geometryDerived": [],
  "assumptions": ["Total living from Building Areas table on sheet 1"],
  "notesBlock": "string"
}`;
}

function buildElectricalSystemPrompt() {
  return `You are a construction estimator counting Electrical devices on Electrical plan sheets (E sheets, panel schedules, device legends, lighting legends).

Return ONLY valid JSON (no markdown).

Counting contract (most important):
- COUNT visible device, fixture, panel, and legend symbols on the attached Electrical sheet images. That count is required takeoff. It is not estimating, not inventing, and not a readability violation.
- A duplex receptacle symbol, GFCI symbol, recessed can, ceiling fan, smoke detector, or panel box that you can see MUST be counted even when no printed numeral sits next to it.
- Printed labels still win when present: "PANEL", "RANGE", "DRYER", "GFCI", "3-WAY".
- Repeated fixture instance tags in the PDF text-layer block (R4, CF) are individual fixtures. Prefer those counts over symbol estimates. Never treat a legend/schedule definition as a quantity. Sum main-level and upper-level lighting sheets.
- Count every ceiling-fan symbol on every lighting sheet, including covered patio, primary suite, all bedrooms, and upstairs living.
- Lighting fixtures that are not recessed/canless and not ceiling fans still count. If there is no symbol legend, report unclassifiedFixtureCount and list it in unreadableFields — do not guess pendant, vanity, garage, or standard fixture.
- Return electricalSheetEvidence.sheetSubtotals with one row for every attached electrical page. Include page, sheet, level, kind, coverage ("complete" only after reviewing the whole page), and counts for every counted canonical field, including zero when that field is absent. The sum of sheet subtotals must equal the final measurements.
- Do not mark a page complete if it is cropped, duplicated, a legend-only view, or not reviewed. Put such pages in electricalSheetEvidence.omittedPages and explain the omission.
- For every non-symbol quantity or explicitly labeled quantity, return electricalFieldEvidence[field] with the page/sheet and the printed label or source text. A quantity without a traceable field evidence reference cannot be Plan verified.
- serviceAmperage ONLY when a printed amperage callout exists (200A, 125A, 150A). Never infer amperage from house size or from seeing a panel box. If it is not printed, omit it and list serviceAmperage in unreadableFields.
- Do NOT invent homeruns, breaker counts, conduit LF, trench LF, rough/trim packages, job condition, or living SF. Device symbols do not create circuit relationships.
- When total living area and/or story count is readable on cover sheets or floor plans, populate planFacts.buildingAreas.totalLivingSqft and planFacts.storyCount (1, 2, or 3) with fieldEvidence. These planFacts drive project-complexity labor adjustment in Confirm Scope only — never use living SF or story count to derive device/circuit quantities.
- Leave rooms[] empty. Do not extract kitchen/bath/living square footage into measurements on this pass.
- imageQuality: "good" if Electrical symbols or labels are visible, "partial" if some are, "unreadable" only if the attached images are blank or not Electrical sheets.
- For every key in measurements, add fieldConfidence 0-1. Symbol counts you can see should be 0.7-0.95.
- inferredKeys: keys guessed from room type or wet-location (probable GFCI in a bath) rather than counted symbols or printed tags.

${ELECTRICAL_VISION_INSTRUCTIONS}

Schema:
{
  "success": true,
  "imageQuality": "good",
  "rooms": [],
  "measurements": {
    "mainPanelCount": 1,
    "standardReceptacleCount": 42,
    "gfciReceptacleCount": 6,
    "recessedLightCount": 34,
    "singlePoleSwitchCount": 18,
    "threeWaySwitchCount": 4,
    "ceilingFanCount": 3,
    "rangeHookupCount": 1,
    "dryerHookupCount": 1,
    "dishwasherHookupCount": 1,
    "smokeDetectorCount": 8,
    "unclassifiedFixtureCount": 4
  },
  "fieldConfidence": {
    "standardReceptacleCount": 0.85,
    "gfciReceptacleCount": 0.9,
    "recessedLightCount": 0.85,
    "mainPanelCount": 0.95
  },
  "electricalSheetEvidence": {
    "sheetSubtotals": [
      {
        "page": 5,
        "sheet": "E1.1",
        "level": "main",
        "kind": "lighting",
        "coverage": "complete",
        "counts": {
          "standardReceptacleCount": 24,
          "gfciReceptacleCount": 3,
          "recessedLightCount": 24,
          "ceilingFanCount": 2
        },
        "evidence": [{ "page": 5, "sheet": "E1.1", "label": "Main-level lighting plan reviewed" }]
      }
    ],
    "omittedPages": []
  },
  "electricalFieldEvidence": {
    "mainPanelCount": [
      {
        "page": 5,
        "sheet": "E1.1",
        "label": "PANEL",
        "method": "explicit_callout",
        "sourceText": "PANEL A"
      }
    ]
  },
  "unreadableFields": [
    { "field": "serviceAmperage", "reason": "No printed amperage callout" },
    { "field": "unclassifiedFixtureCount", "reason": "4 lighting fixtures without a symbol legend" }
  ],
  "explicitlyLabeled": ["mainPanelCount"],
  "geometryDerived": [],
  "inferredKeys": [],
  "assumptions": [],
  "notesBlock": "Counted Electrical symbols from attached E sheets."
}`;
}

function buildPlumbingSystemPrompt() {
  return `You are a construction estimator counting Plumbing quantities on plumbing plans, fixture schedules, risers, details, and plumbing notes.

Return ONLY valid JSON (no markdown).

${PLUMBING_VISION_INSTRUCTIONS}

For every returned measurement, include fieldConfidence from 0 to 1 and a traceable fieldEvidence entry with page, sheet, label, and sourceText when available. Leave rooms[] empty for this focused trade pass.

Schema:
{
  "success": true,
  "imageQuality": "good",
  "rooms": [],
  "measurements": {
    "fixtureReplacementCount": 8,
    "plumbingRoughPointCount": 12,
    "plumbingTrimHookupCount": 12,
    "waterLineLf": 40,
    "sewerLineLf": 18
  },
  "fixtureInventory": {
    "toilets": 3,
    "lavatories": 3,
    "showers": 2,
    "tubs": 1,
    "kitchenSinks": 1,
    "laundryBoxes": 1
  },
  "waterHeaterDetail": {
    "count": 1,
    "type": "tankless",
    "fuel": "gas",
    "location": "Garage",
    "confidence": 0.9
  },
  "gasApplianceScope": {
    "range": true,
    "waterHeater": true,
    "fireplace": true,
    "gasPipingRequired": true
  },
  "fieldConfidence": {
    "fixtureReplacementCount": 0.85,
    "plumbingRoughPointCount": 0.8
  },
  "explicitlyLabeled": ["waterLineLf"],
  "geometryDerived": [],
  "inferredKeys": [],
  "unreadableFields": [],
  "fieldEvidence": {},
  "assumptions": [],
  "notesBlock": "Counted only readable Plumbing quantities."
}`;
}

function visionSystemPrompt(
  electricalSelected,
  plumbingSelected,
  insulationSelected,
  drywallSelected,
  windowsDoorsSelected,
  hvacSelected,
) {
  if (electricalSelected) return buildElectricalSystemPrompt();
  if (plumbingSelected) return buildPlumbingSystemPrompt();
  if (hvacSelected) return buildHvacSystemPrompt();
  return `${buildSystemPrompt()}${
    insulationSelected ? `\n${INSULATION_VISION_INSTRUCTIONS}` : ""
  }${drywallSelected ? `\n${DRYWALL_VISION_INSTRUCTIONS}` : ""}${
    windowsDoorsSelected ? `\n${WINDOWS_DOORS_VISION_INSTRUCTIONS}` : ""
  }`;
}

function sanitizeRooms(rawRooms) {
  const out = [];
  for (const room of Array.isArray(rawRooms) ? rawRooms : []) {
    const name = String(room?.name || "")
      .trim()
      .slice(0, 80);
    if (!name) continue;
    const lengthFt = positive(room.lengthFt);
    const widthFt = positive(room.widthFt);
    let areaSqft = positive(room.areaSqft);
    if (areaSqft == null && lengthFt != null && widthFt != null) {
      areaSqft = Math.round(lengthFt * widthFt * 10) / 10;
    }
    let measurementKey = room.measurementKey
      ? String(room.measurementKey).trim()
      : null;
    if (measurementKey && !MEASUREMENT_KEYS.has(measurementKey))
      measurementKey = null;
    if (!measurementKey) {
      const n = name.toLowerCase();
      if (/bath|powder|toilet/.test(n)) measurementKey = "bathroomFloorSqft";
      else if (/kitchen/.test(n)) measurementKey = "kitchenFloorSqft";
      else if (/deck|patio|roof\s*deck/.test(n)) measurementKey = "deckSqft";
      else if (/garage|storage|mechanical|closet|w\.?i\.?c/.test(n))
        measurementKey = null;
      // Living/bedroom/etc. stay in rooms list for notes — do not map a single room to floorAreaSqft
      else measurementKey = null;
    }
    // Never let a single room claim whole-house floor area
    if (
      measurementKey === "floorAreaSqft" ||
      measurementKey === "flooringSqft"
    ) {
      measurementKey = null;
    }
    const entry = {
      name,
      lengthFt,
      widthFt,
      areaSqft,
      measurementKey,
      confidence: Math.max(0, Math.min(1, Number(room.confidence) || 0)),
    };
    const roomWallHeightFt =
      positive(room.wallHeightFt) || positive(room.plateHeightFt);
    if (roomWallHeightFt != null && roomWallHeightFt >= 7 && roomWallHeightFt <= 14) {
      entry.wallHeightFt = roomWallHeightFt;
    }
    if (room.source) entry.source = String(room.source).slice(0, 40);
    const sourcePage = Number(room.sourcePage);
    if (Number.isInteger(sourcePage) && sourcePage > 0 && sourcePage <= 1000) {
      entry.sourcePage = sourcePage;
    }
    if (room.sourceSheet)
      entry.sourceSheet = String(room.sourceSheet).trim().slice(0, 20);
    out.push(entry);
  }
  return out.slice(0, 60);
}

function roomNameKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Prefer spatially paired PDF rooms; add vision-only rooms that don't collide. */
function mergeRoomsPreferPdf(pdfRooms, visionRooms) {
  const out = [...(Array.isArray(pdfRooms) ? pdfRooms : [])];
  const seen = new Set(out.map((r) => roomNameKey(r.name)));
  for (const room of Array.isArray(visionRooms) ? visionRooms : []) {
    const key = roomNameKey(room.name);
    if (!key || seen.has(key)) continue;
    // Don't let vision re-add a vague "Garage" envelope when PDF already has garage bays
    if (/^garage$/.test(key) && [...seen].some((k) => /garage/.test(k)))
      continue;
    out.push(room);
    seen.add(key);
  }
  return out.slice(0, 60);
}

function isPlainGarageName(name) {
  return /^garages?$/i.test(String(name || "").trim());
}

/**
 * Drop foundation-style combined garage envelopes when individual bays exist.
 * e.g. 31'×23' "Garage" alongside a normal bay / RV garage.
 * Do not drop long thin RV bays (12'×42').
 */
function pruneEnvelopeGarageRooms(rooms) {
  const list = Array.isArray(rooms) ? rooms : [];
  const garageLike = list.filter((r) => /\bgarage\b/i.test(r.name || ""));
  if (garageLike.length < 2) return list;
  const hasNamedBay = garageLike.some(
    (r) =>
      !isPlainGarageName(r.name) || (r.areaSqft != null && r.areaSqft < 700),
  );
  if (!hasNamedBay) return list;
  return list.filter((r) => {
    if (!isPlainGarageName(r.name)) return true;
    const lengthFt = Number(r.lengthFt) || 0;
    const widthFt = Number(r.widthFt) || 0;
    const longSide = Math.max(lengthFt, widthFt);
    const shortSide = Math.min(lengthFt, widthFt) || 0;
    // Combined footprint: both sides large (foundation "GARAGE" box)
    if (longSide >= 28 && shortSide >= 18) return false;
    if (r.areaSqft != null && r.areaSqft >= 700) return false;
    return true;
  });
}

/** Never keep bath SF the model invented when no bath rooms have readable area. */
function reconcileBathroomMeasurement(
  measurements,
  rooms,
  unreadableFields = [],
) {
  const next = { ...measurements };
  const bathRooms = (rooms || []).filter(
    (r) =>
      r.measurementKey === "bathroomFloorSqft" &&
      r.areaSqft != null &&
      r.areaSqft > 0,
  );
  if (!bathRooms.length) {
    if (next.bathroomFloorSqft != null) {
      unreadableFields.push({
        field: "bathroomFloorSqft",
        reason: "No bathroom dimensions labeled on plan",
      });
      delete next.bathroomFloorSqft;
    }
    return next;
  }
  const sum =
    Math.round(bathRooms.reduce((s, r) => s + r.areaSqft, 0) * 10) / 10;
  next.bathroomFloorSqft = sum;
  return next;
}

function sanitizeFieldConfidence(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!MEASUREMENT_KEYS.has(key)) continue;
    const v = Number(value);
    if (!Number.isFinite(v)) continue;
    out[key] = Math.max(0, Math.min(1, v));
  }
  return out;
}

function collectUnclassifiedElectricalFixtures({
  measurements,
  pdfTakeoff,
  unreadableFields,
} = {}) {
  const nextMeasurements = { ...(measurements || {}) };
  const visionCount = Number(nextMeasurements.unclassifiedFixtureCount);
  delete nextMeasurements.unclassifiedFixtureCount;
  const tagCount = Number(
    pdfTakeoff?.electricalInstanceTags?.unclassifiedFixtureCount,
  );
  const count = [visionCount, tagCount]
    .filter((value) => Number.isFinite(value) && value >= 2)
    .reduce((max, value) => Math.max(max, Math.round(value)), 0);
  const nextUnreadable = Array.isArray(unreadableFields)
    ? [...unreadableFields]
    : [];
  const already = nextUnreadable.some(
    (entry) =>
      String(entry?.field || entry?.key || "") === "unclassifiedFixtureCount",
  );
  if (count >= 2 && !already) {
    nextUnreadable.push({
      field: "unclassifiedFixtureCount",
      reason: `${count} lighting fixtures without a symbol legend`,
    });
  }
  return { measurements: nextMeasurements, unreadableFields: nextUnreadable };
}

function sanitizeUnreadableFields(raw) {
  const seen = new Set();
  const out = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    const field = String(entry?.field || entry?.key || "")
      .trim()
      .slice(0, 60);
    if (!field || seen.has(field)) continue;
    seen.add(field);
    out.push({
      field,
      reason: String(entry?.reason || "Not legible on the plan")
        .trim()
        .slice(0, 160),
    });
  }
  return out.slice(0, 40);
}

function sanitizeImageQuality(raw) {
  const q = String(raw || "")
    .trim()
    .toLowerCase();
  return ["good", "partial", "unreadable"].includes(q) ? q : null;
}

/**
 * Withhold measurements the model wasn't confident it actually read.
 * Schedule-derived values (Building Areas) keep their own gating in
 * sanitizeMeasurements, so keys without a confidence score are kept.
 */
function applyConfidenceFloor(measurements, fieldConfidence) {
  const kept = {};
  const lowConfidence = [];
  for (const [key, value] of Object.entries(measurements)) {
    const conf = fieldConfidence[key];
    if (conf != null && conf < MIN_FIELD_CONFIDENCE) {
      lowConfidence.push({
        field: key,
        value,
        confidence: Math.round(conf * 100) / 100,
      });
      continue;
    }
    kept[key] = value;
  }
  return { measurements: kept, lowConfidence };
}

function sanitizeBuildingAreas(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const key of [
    "totalLivingSqft",
    "mainFloorLivingSqft",
    "upstairsLivingSqft",
    "garageSqft",
    "coveredPatioSqft",
    "coveredOutdoorSqft",
    "roofDeckSqft",
  ]) {
    const v = positive(raw[key]);
    if (v != null) out[key] = Math.round(v * 10) / 10;
  }
  const additional = (
    Array.isArray(raw.additionalFloorAreas) ? raw.additionalFloorAreas : []
  )
    .map(positive)
    .filter((v) => v != null)
    .map((v) => Math.round(v * 10) / 10)
    .slice(0, 4);
  if (additional.length) out.additionalFloorAreas = additional;
  if (out.totalLivingSqft == null) {
    const parts = [
      out.mainFloorLivingSqft,
      out.upstairsLivingSqft,
      ...(out.additionalFloorAreas || []),
    ].filter((v) => v != null);
    if (parts.length) {
      out.totalLivingSqft =
        Math.round(parts.reduce((s, v) => s + v, 0) * 10) / 10;
    }
  }
  return out;
}

const EVIDENCE_SOURCE_TYPES = new Set([
  "pdf_text",
  "plan_vision",
  "user",
  "unknown",
]);
const FACT_SOURCE_TYPES = new Set([
  "detected_from_plan",
  "measured_from_geometry",
  "user_entered",
  "needs_confirmation",
]);
const FACT_CONFIDENCE = new Set(["high", "medium", "low", "unresolved"]);
const GEOMETRY_KINDS = new Set([
  "living_footprint",
  "garage_footprint",
  "covered_patio",
  "roof_plane",
  "foundation",
  "courtyard",
  "detached_structure",
  "other",
]);

function sanitizeEvidence(raw) {
  const out = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== "object") continue;
    const entry = {};
    const page = Number(item.page ?? item.sourcePage);
    if (Number.isInteger(page) && page > 0 && page <= 1000) entry.page = page;
    const sheet = String(item.sheet ?? item.sourceSheet ?? "").trim();
    if (sheet) entry.sheet = sheet.slice(0, 20);
    const label = String(item.label || "").trim();
    if (label) entry.label = label.slice(0, 80);
    const sourceText = String(item.sourceText || "").trim();
    if (sourceText) entry.sourceText = sourceText.slice(0, 200);
    const sourceType = String(item.sourceType || "").trim();
    entry.sourceType = EVIDENCE_SOURCE_TYPES.has(sourceType)
      ? sourceType
      : "unknown";
    const confidence = Number(item.confidence);
    if (Number.isFinite(confidence))
      entry.confidence = Math.max(0, Math.min(1, confidence));
    if (entry.page || entry.sheet || entry.label || entry.sourceText)
      out.push(entry);
  }
  return out.slice(0, 12);
}

function sanitizeGeometry(raw) {
  const regions = [];
  for (const region of Array.isArray(raw) ? raw : []) {
    const id = String(region?.id || "")
      .trim()
      .slice(0, 60);
    const kind = String(region?.kind || "").trim();
    if (!id || !GEOMETRY_KINDS.has(kind)) continue;
    const entry = { id, kind };
    for (const key of ["areaSqft", "perimeterLf"]) {
      const value = positive(region[key]);
      if (value != null) entry[key] = Math.round(value * 100) / 100;
    }
    if (
      typeof region.pitch === "string" &&
      /^\d{1,2}\s*[:/]\s*12$/.test(region.pitch.trim())
    ) {
      entry.pitch = region.pitch.trim().replace("/", ":").replace(/\s+/g, "");
    }
    for (const key of ["isRoofed", "isIncluded"]) {
      if (typeof region[key] === "boolean") entry[key] = region[key];
    }
    const points = (Array.isArray(region.points) ? region.points : [])
      .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .slice(0, 500);
    if (points.length >= 3) entry.points = points;
    const evidence = sanitizeEvidence(region.evidence);
    if (evidence.length) entry.evidence = evidence;
    // Geometry is accepted only when it contains supplied dimensions or points.
    if (entry.areaSqft != null || entry.perimeterLf != null || entry.points)
      regions.push(entry);
  }
  return regions.slice(0, 100);
}

function sanitizeCeilingBoundary(rawBoundary) {
  const src =
    rawBoundary && typeof rawBoundary === "object" ? rawBoundary : null;
  if (!src) return null;
  const out = {};
  for (const key of [
    "upperFloorAtticSqft",
    "mainFloorAtticExposureSqft",
    "vaultedOpenToBelowSqft",
    "roofDeckInsulationSqft",
  ]) {
    const value = positive(src[key]);
    if (value != null && value <= 50000) {
      out[key] = Math.round(value * 10) / 10;
    }
  }
  if (typeof src.complete === "boolean") out.complete = src.complete;
  const confidence = String(src.confidence || "");
  if (FACT_CONFIDENCE.has(confidence)) out.confidence = confidence;
  const fieldEvidence = {};
  for (const [key, fact] of Object.entries(src.fieldEvidence || {})) {
    if (!fact || typeof fact !== "object") continue;
    const evidence = sanitizeEvidence(fact.evidence);
    if (!evidence.length) continue;
    fieldEvidence[String(key).slice(0, 80)] = {
      value: ["string", "number", "boolean"].includes(typeof fact.value)
        ? fact.value
        : null,
      sourceType: FACT_SOURCE_TYPES.has(String(fact.sourceType || ""))
        ? String(fact.sourceType)
        : "detected_from_plan",
      confidence: FACT_CONFIDENCE.has(String(fact.confidence || ""))
        ? String(fact.confidence)
        : "medium",
      evidence,
    };
  }
  if (Object.keys(fieldEvidence).length) out.fieldEvidence = fieldEvidence;
  return Object.keys(out).length ? out : null;
}

function sanitizePlanFacts(raw, buildingAreas = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const fieldEvidence = {};
  for (const [key, fact] of Object.entries(src.fieldEvidence || {})) {
    if (!fact || typeof fact !== "object") continue;
    const evidence = sanitizeEvidence(fact.evidence);
    if (!evidence.length) continue;
    const sourceType = String(fact.sourceType || "");
    const confidence = String(fact.confidence || "");
    fieldEvidence[String(key).slice(0, 80)] = {
      value: ["string", "number", "boolean"].includes(typeof fact.value)
        ? fact.value
        : null,
      sourceType: FACT_SOURCE_TYPES.has(sourceType)
        ? sourceType
        : "detected_from_plan",
      confidence: FACT_CONFIDENCE.has(confidence) ? confidence : "medium",
      evidence,
    };
  }
  const out = {
    buildingAreas: sanitizeBuildingAreas(buildingAreas),
    fieldEvidence,
  };
  const ceilingBoundary = sanitizeCeilingBoundary(src.ceilingBoundary);
  if (ceilingBoundary) out.ceilingBoundary = ceilingBoundary;
  const hasEvidence = (key) => Boolean(fieldEvidence[key]?.evidence?.length);
  const storyCount = Number(src.storyCount);
  if (
    hasEvidence("storyCount") &&
    Number.isInteger(storyCount) &&
    storyCount >= 1 &&
    storyCount <= 10
  ) {
    out.storyCount = storyCount;
  }
  if (hasEvidence("roofPitch")) {
    const pitch = String(src.roofPitch || "")
      .trim()
      .toLowerCase();
    if (/^\d{1,2}\s*[:/]\s*12$/.test(pitch))
      out.roofPitch = pitch.replace("/", ":").replace(/\s+/g, "");
    else if (pitch === "low-slope") out.roofPitch = pitch;
  }
  for (const key of ["wallHeightFt", "plateHeightFt", "ceilingHeightFt"]) {
    const value = positive(src[key]);
    if (hasEvidence(key) && value != null && value <= 40)
      out[key] = Math.round(value * 1000) / 1000;
  }
  for (const key of [
    "exteriorPerimeterLf",
    "foundationPerimeterLf",
    "foundationFootprintSqft",
    "roofedFootprintSqft",
  ]) {
    const value = positive(src[key]);
    if (hasEvidence(key) && value != null && value <= 50000) {
      out[key] = Math.round(value * 10) / 10;
    }
  }
  for (const key of [
    "nonPaintedExteriorPercent",
    "openingsPercent",
    "roofWastePercent",
  ]) {
    const value = Number(src[key]);
    if (
      hasEvidence(key) &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 100
    ) {
      out[key] = Math.round(value * 10) / 10;
    }
  }
  for (const key of ["insulationMaterialType", "insulationRValue"]) {
    const value = String(src[key] || "").trim();
    if (hasEvidence(key) && value) out[key] = value.slice(0, 80);
  }
  if (
    hasEvidence("garageInsulationIncluded") &&
    typeof src.garageInsulationIncluded === "boolean"
  ) {
    out.garageInsulationIncluded = src.garageInsulationIncluded;
  }
  if (
    hasEvidence("coveredPatioRoofed") &&
    typeof src.coveredPatioRoofed === "boolean"
  ) {
    out.coveredPatioRoofed = src.coveredPatioRoofed;
  }
  if (
    hasEvidence("includeCoveredPatioSlab") &&
    typeof src.includeCoveredPatioSlab === "boolean"
  ) {
    out.includeCoveredPatioSlab = src.includeCoveredPatioSlab;
  }
  if (
    hasEvidence("vaultedCeilingDetected") &&
    typeof src.vaultedCeilingDetected === "boolean"
  ) {
    out.vaultedCeilingDetected = src.vaultedCeilingDetected;
  }
  const geometry = sanitizeGeometry(src.geometry);
  if (geometry.length) out.geometry = geometry;
  const elevationFaces = (
    Array.isArray(src.elevationFaces) ? src.elevationFaces : []
  )
    .map((face) => {
      const entry = {
        id: String(face?.id || "")
          .trim()
          .slice(0, 40),
      };
      for (const key of [
        "widthFt",
        "heightFt",
        "areaSqft",
        "stuccoAreaSqft",
        "paintAreaSqft",
        "openingsSqft",
        "windowDoorOpeningsSqft",
        "garageOpeningsSqft",
        "nonStuccoSqft",
        "parapetSqft",
      ]) {
        const value = positive(face?.[key]);
        if (value != null && value <= 50000)
          entry[key] = Math.round(value * 10) / 10;
      }
      const evidence = sanitizeEvidence(face?.evidence);
      if (evidence.length) entry.evidence = evidence;
      const finish = String(face?.finish || face?.cladding || "")
        .trim()
        .slice(0, 40);
      if (finish) entry.finish = finish;
      return entry.id &&
        (entry.areaSqft ||
          entry.stuccoAreaSqft ||
          entry.paintAreaSqft ||
          entry.widthFt ||
          entry.windowDoorOpeningsSqft ||
          entry.garageOpeningsSqft ||
          entry.openingsSqft)
        ? entry
        : null;
    })
    .filter(Boolean)
    .slice(0, 8);
  if (elevationFaces.length) out.elevationFaces = elevationFaces;
  const warnings = (Array.isArray(src.warnings) ? src.warnings : [])
    .map((warning) =>
      String(warning || "")
        .trim()
        .slice(0, 200),
    )
    .filter(Boolean)
    .slice(0, 10);
  if (warnings.length) out.warnings = warnings;
  return out;
}

function reconcileLabeledLivingAreas(buildingAreas, current = null) {
  const floors = [
    positive(buildingAreas.mainFloorLivingSqft),
    positive(buildingAreas.upstairsLivingSqft),
    ...(buildingAreas.additionalFloorAreas || []).map(positive),
  ].filter((value) => value != null);
  const cover = positive(buildingAreas.totalLivingSqft);
  if (!cover || !floors.length) return current;
  const floorLivingSqft =
    Math.round(floors.reduce((sum, value) => sum + value, 0) * 10) / 10;
  const floorDeltaSqft = Math.round((floorLivingSqft - cover) * 10) / 10;
  return {
    ...(current || {}),
    coverTotalLivingSqft: cover,
    floorLivingSqft,
    floorDeltaSqft,
    floorAreaStatus: Math.abs(floorDeltaSqft) < 0.6 ? "reconciled" : "review",
    warnings:
      Math.abs(floorDeltaSqft) < 0.6
        ? current?.warnings || []
        : [
            ...(current?.warnings || []),
            `Labeled floor areas differ from the cover total by ${floorDeltaSqft} sqft.`,
          ],
  };
}

function scheduleDeckSqft(buildingAreas) {
  const patio = positive(buildingAreas.coveredPatioSqft);
  const roofDeck = positive(buildingAreas.roofDeckSqft);
  const coveredOutdoor = positive(buildingAreas.coveredOutdoorSqft);
  const parts = [patio, roofDeck].filter((v) => v != null);
  if (parts.length) {
    return Math.round(parts.reduce((s, v) => s + v, 0) * 10) / 10;
  }
  return coveredOutdoor;
}

function isPatioLikeConcreteValue(concreteSqft, buildingAreas) {
  if (concreteSqft == null) return false;
  const patioValues = [
    positive(buildingAreas.coveredPatioSqft),
    positive(buildingAreas.roofDeckSqft),
    positive(buildingAreas.coveredOutdoorSqft),
    scheduleDeckSqft(buildingAreas),
  ].filter((v) => v != null);
  return patioValues.some((v) => Math.abs(v - concreteSqft) < 0.6);
}

function normalizeDrywallPlanMeasurements(raw = {}, supportedKeys = []) {
  const src = raw && typeof raw === "object" ? raw : {};
  const allowed = new Set(supportedKeys);
  const out = {};
  for (const key of [
    "drywallSqft",
    "drywallWallSqft",
    "drywallCeilingSqft",
    "drywallOpeningDeductionSqft",
    "drywallGarageFireRatedSqft",
    "drywallMoistureResistantSqft",
    "drywallVaultedSlopedSqft",
    "drywallHighCeilingSqft",
    "drywallFinishLevel",
    "garageWallDrywallSqft",
    "garageCeilingDrywallSqft",
    "moistureResistantDrywallSqft",
    "fireRatedDrywallSqft",
    "specialtyDrywallSqft",
    "highCeilingDrywallSqft",
    "vaultedCeilingDrywallSqft",
    "level5FinishSqft",
  ]) {
    if (!allowed.has(key)) continue;
    const value = positive(src[key]);
    if (value != null) out[key] = roundTenth(value);
  }
  if (typeof src.drywallFinishLevel === "string" && src.drywallFinishLevel.trim()) {
    out.drywallFinishLevel = src.drywallFinishLevel.trim();
  }
  if (out.drywallSqft == null) {
    const walls = positive(out.drywallWallSqft) || 0;
    const ceilings = positive(out.drywallCeilingSqft) || 0;
    if (walls > 0 || ceilings > 0) {
      out.drywallSqft = roundTenth(walls + ceilings);
    }
  }
  return out;
}

/**
 * Drywall takeoff from dimensioned conditioned rooms + explicit wall height.
 * Room perimeters represent both sides of interior partitions, while the
 * ceiling total is the sum of dimensioned room areas. Opening deductions are
 * only subtracted when they are explicitly reported by the plan pass.
 */
function drywallPlanningSurfaceQuantity(livingSqft) {
  const living = positive(livingSqft);
  return living == null ? null : Math.round(living * 3.5);
}

function isUndercountedDrywallSurface(drywallSqft, livingSqft) {
  const living = positive(livingSqft);
  const drywall = positive(drywallSqft);
  if (!(drywall > 0) || living == null) return false;
  if (Math.abs(drywall - living) < 0.51) return true;
  return drywall / living < 2.5;
}

function resolveConditionedCeilingSqft(buildingAreas = {}, measurements = {}) {
  const main = positive(buildingAreas.mainFloorLivingSqft);
  const upstairs = positive(buildingAreas.upstairsLivingSqft);
  if (main != null || upstairs != null) {
    return roundTenth((main || 0) + (upstairs || 0));
  }
  return (
    positive(buildingAreas.totalLivingSqft) ||
    positive(measurements.floorAreaSqft) ||
    null
  );
}

function reconcileIncompleteDrywallGeometryTakeoff(
  measurements = {},
  buildingAreas = {},
) {
  const next = { ...measurements };
  const assumptions = [];
  const planningEstimateKeys = [];
  let reconciled = false;
  const living = resolveConditionedCeilingSqft(buildingAreas, next);
  const scheduleCeiling = living;
  let wall = positive(next.drywallWallSqft);
  let ceiling = positive(next.drywallCeilingSqft);

  if (
    scheduleCeiling != null &&
    ceiling != null &&
    ceiling < scheduleCeiling * ROOM_CEILING_COVERAGE_MIN
  ) {
    assumptions.push(
      `Ceiling drywall upgraded from ${ceiling.toLocaleString()} SF to ${scheduleCeiling.toLocaleString()} SF using labeled main + upper living areas because dimensioned rooms covered less than 70% of the conditioned ceiling footprint.`,
    );
    ceiling = scheduleCeiling;
    next.drywallCeilingSqft = scheduleCeiling;
    planningEstimateKeys.push("drywallCeilingSqft");
    reconciled = true;
  }

  const updatedTotal = (wall || 0) + (ceiling || 0);
  if (living != null && isUndercountedDrywallSurface(updatedTotal, living)) {
    const planningTotal = drywallPlanningSurfaceQuantity(living);
    if (planningTotal != null) {
      const targetCeiling = scheduleCeiling ?? ceiling ?? living;
      const targetWall = Math.max(wall || 0, planningTotal - targetCeiling);
      if (
        targetWall !== wall ||
        targetCeiling !== ceiling ||
        positive(next.drywallSqft) !== planningTotal
      ) {
        assumptions.push(
          `House drywall upgraded to a ${planningTotal.toLocaleString()} SF planning split (${targetWall.toLocaleString()} SF walls + ${targetCeiling.toLocaleString()} SF ceilings) because readable room geometry did not cover a complete takeoff.`,
        );
        next.drywallWallSqft = roundTenth(targetWall);
        next.drywallCeilingSqft = roundTenth(targetCeiling);
        next.drywallSqft = roundTenth(planningTotal);
        planningEstimateKeys.push(
          "drywallWallSqft",
          "drywallCeilingSqft",
          "drywallSqft",
        );
        reconciled = true;
      }
    }
  } else if (reconciled) {
    next.drywallSqft = roundTenth(
      (positive(next.drywallWallSqft) || 0) +
        (positive(next.drywallCeilingSqft) || 0),
    );
    planningEstimateKeys.push("drywallSqft");
  }

  return {
    measurements: next,
    reconciled,
    assumptions,
    planningEstimateKeys: [...new Set(planningEstimateKeys)],
  };
}

function deriveDrywallGeometryMeasurements(
  measurements = {},
  rooms = [],
  planFacts = {},
  options = {},
) {
  let next = { ...measurements };
  const derivedKeys = [];
  const assumptions = [];
  const buildingAreas = options.buildingAreas || planFacts.buildingAreas || {};
  const wallHeightFt =
    explicitInteriorWallHeightFt(planFacts) ||
    explicitInteriorWallHeightFt(options.rawPlanFacts || {});
  const conditionedCeilingSqft =
    (positive(buildingAreas.mainFloorLivingSqft) || 0) +
    (positive(buildingAreas.upstairsLivingSqft) || 0) ||
    null;
  const allRooms = Array.isArray(rooms) ? rooms : [];
  const garageRooms = allRooms
    .filter(
      (room) =>
        /\bgarage\b|\brv\s*garage\b/i.test(String(room?.name || "")) &&
        ((Number(room?.confidence) || 0) >= 0.4 ||
          (positive(room?.lengthFt) != null && positive(room?.widthFt) != null)),
    )
    .map((room) => ({ room, ...roomRectangle(room) }));
  const eligible = allRooms
    .filter(
      (room) =>
        isPaintableInteriorRoom(room?.name) &&
        ((Number(room?.confidence) || 0) >= 0.4 ||
          (positive(room?.lengthFt) != null && positive(room?.widthFt) != null)),
    )
    .map((room) => ({ room, ...roomRectangle(room) }));
  const dimensioned = eligible.filter((entry) => entry.perimeterLf != null);
  const withArea = eligible.filter((entry) => entry.areaSqft != null);
  const roomAreaSqft =
    withArea.length >= 1
      ? withArea.reduce((sum, entry) => sum + entry.areaSqft, 0)
      : null;
  if (
    !(positive(next.drywallWallSqft) > 0) &&
    wallHeightFt &&
    dimensioned.length >= 1
  ) {
    const wallSqft = dimensioned.reduce(
      (sum, entry) =>
        sum +
        entry.perimeterLf * (explicitInteriorWallHeightFt(entry.room) || wallHeightFt),
      0,
    );
    const rounded = roundTenth(wallSqft);
    if (rounded > 0) {
      next.drywallWallSqft = rounded;
      derivedKeys.push("drywallWallSqft");
      assumptions.push(
        `Drywall wall area ${rounded.toLocaleString()} SF calculated from ${dimensioned.length} dimensioned conditioned rooms × explicit wall/plate height (gross room-perimeter method).`,
      );
      if (
        conditionedCeilingSqft != null &&
        roomAreaSqft != null &&
        roomAreaSqft / conditionedCeilingSqft < ROOM_CEILING_COVERAGE_MIN
      ) {
        assumptions.push(
          "Wall drywall is a partial room-geometry takeoff because the readable dimensioned rooms do not cover the full conditioned plan; confirm remaining partitions and exterior-wall surfaces.",
        );
      }
    }
  }

  if (
    !(positive(next.drywallCeilingSqft) > 0) &&
    roomAreaSqft != null
  ) {
    const rounded = roundTenth(roomAreaSqft);
    if (rounded > 0) {
      next.drywallCeilingSqft = rounded;
      derivedKeys.push("drywallCeilingSqft");
      assumptions.push(
        `Drywall ceiling area ${rounded.toLocaleString()} SF calculated from ${withArea.length} dimensioned conditioned rooms.`,
      );
      if (
        conditionedCeilingSqft != null &&
        roomAreaSqft < conditionedCeilingSqft * ROOM_CEILING_COVERAGE_MIN
      ) {
        assumptions.push(
          "Ceiling drywall is a partial room-geometry takeoff; confirm open-to-below, stairs, vaulted areas, and any unreadable rooms.",
        );
      }
    }
  }
  if (garageRooms.length) {
    const garageArea = garageRooms.reduce(
      (sum, entry) => sum + (entry.areaSqft || 0),
      0,
    );
    if (
      !(positive(next.garageCeilingDrywallSqft) > 0) &&
      garageArea > 0
    ) {
      next.garageCeilingDrywallSqft = roundTenth(garageArea);
      derivedKeys.push("garageCeilingDrywallSqft");
      assumptions.push(
        `Garage ceiling drywall ${next.garageCeilingDrywallSqft.toLocaleString()} SF calculated from ${garageRooms.length} dimensioned garage footprint${garageRooms.length === 1 ? "" : "s"}; confirm whether the garage ceiling is drywalled.`,
      );
    }
    if (
      !(positive(next.garageWallDrywallSqft) > 0) &&
      wallHeightFt
    ) {
      const garageWallArea = garageRooms.reduce((sum, entry) => {
        const perimeter =
          entry.perimeterLf ||
          (entry.areaSqft > 0 ? 4 * Math.sqrt(entry.areaSqft) : 0);
        return sum + perimeter * wallHeightFt;
      }, 0);
      if (garageWallArea > 0) {
        next.garageWallDrywallSqft = roundTenth(garageWallArea);
        derivedKeys.push("garageWallDrywallSqft");
        assumptions.push(
          `Garage wall drywall ${next.garageWallDrywallSqft.toLocaleString()} SF is a gross perimeter × ${wallHeightFt} FT geometry suggestion; confirm rated/separation walls and undrywalled garage faces.`,
        );
      }
    }
  }

  const scheduleGarage =
    positive(buildingAreas.garageSqft) || positive(next.garageSqft);
  if (scheduleGarage != null) {
    if (!(positive(next.garageCeilingDrywallSqft) > 0)) {
      next.garageCeilingDrywallSqft = roundTenth(scheduleGarage);
      derivedKeys.push("garageCeilingDrywallSqft");
      assumptions.push(
        `Garage ceiling drywall ${next.garageCeilingDrywallSqft.toLocaleString()} SF from the labeled garage area schedule; confirm whether the garage ceiling is drywalled.`,
      );
    }
    if (!(positive(next.garageWallDrywallSqft) > 0) && wallHeightFt) {
      const garageWallArea = 4 * Math.sqrt(scheduleGarage) * wallHeightFt;
      if (garageWallArea > 0) {
        next.garageWallDrywallSqft = roundTenth(garageWallArea);
        derivedKeys.push("garageWallDrywallSqft");
        assumptions.push(
          `Garage wall drywall ${next.garageWallDrywallSqft.toLocaleString()} SF is a square-footprint perimeter × ${wallHeightFt} FT planning estimate from the garage area schedule; confirm rated/separation walls.`,
        );
      }
    }
  }

  const componentTotal =
    positive(next.drywallWallSqft) > 0 || positive(next.drywallCeilingSqft) > 0
      ? roundTenth(
          Math.max(
            0,
            (positive(next.drywallWallSqft) || 0) +
              (positive(next.drywallCeilingSqft) || 0),
          ),
        )
      : null;
  const existingTotal = positive(next.drywallSqft);
  const drywallFloorAreaReference =
    conditionedCeilingSqft ?? roomAreaSqft ?? null;
  const existingLooksLikeFloorArea =
    existingTotal != null &&
    drywallFloorAreaReference != null &&
    existingTotal / drywallFloorAreaReference < 2.5;
  if (
    componentTotal != null &&
    (existingTotal == null || existingLooksLikeFloorArea)
  ) {
    next.drywallSqft = componentTotal;
    if (!derivedKeys.includes("drywallSqft")) derivedKeys.push("drywallSqft");
    assumptions.push(
      "Total drywall surface equals calculated wall plus ceiling area; opening geometry is retained as supporting context and is not automatically deducted.",
    );
  }

  const reconciled = reconcileIncompleteDrywallGeometryTakeoff(
    next,
    buildingAreas,
  );
  next = reconciled.measurements;
  if (reconciled.reconciled) {
    assumptions.push(...reconciled.assumptions);
    for (const key of reconciled.planningEstimateKeys) {
      if (!derivedKeys.includes(key)) derivedKeys.push(key);
    }
  }

  return {
    measurements: next,
    derivedKeys,
    assumptions,
    planningEstimateKeys: reconciled.planningEstimateKeys,
  };
}

function sanitizeMeasurements(
  raw,
  rooms,
  buildingAreas = {},
  explicitlyLabeled = [],
) {
  const out = {};
  const src = raw && typeof raw === "object" ? raw : {};
  const labeled = new Set(
    (Array.isArray(explicitlyLabeled) ? explicitlyLabeled : [])
      .map((k) => String(k || "").trim())
      .filter((k) => MEASUREMENT_KEYS.has(k)),
  );

  for (const key of MEASUREMENT_KEYS) {
    if (key === "roofPitch") {
      const pitch = String(src[key] || "")
        .trim()
        .slice(0, 20);
      if (
        /^\d+(?:\s*:\s*|\s*\/\s*)\d+$/.test(pitch) ||
        /^low[- ]slope$/i.test(pitch)
      ) {
        out[key] = pitch.replace(/\s+/g, "");
      }
      continue;
    }
    const v = positive(src[key]);
    if (v == null) continue;
    if (key === "interiorDoorCount") {
      const count = Math.round(v);
      if (count >= 1 && count <= 80) out[key] = count;
      continue;
    }
    if (LABELED_ONLY_KEYS.has(key) && !labeled.has(key)) continue;
    // Concrete flatwork requires explicit label — covered patio must not land here
    if (CONCRETE_EXPLICIT_KEYS.has(key) && !labeled.has(key)) continue;
    if (ELECTRICAL_EXPLICIT_ONLY_KEYS.has(key) && !labeled.has(key)) continue;
    if (ELECTRICAL_COUNT_KEYS.has(key)) {
      out[key] = Math.round(v);
      continue;
    }
    out[key] = Math.round(v * 10) / 10;
  }

  // Prefer Building Areas schedule for whole-house living SF
  const scheduleLiving = positive(buildingAreas.totalLivingSqft);
  if (scheduleLiving != null) {
    out.floorAreaSqft = scheduleLiving;
    if (out.flooringSqft == null) out.flooringSqft = scheduleLiving;
  }

  const scheduleGarage = positive(buildingAreas.garageSqft);
  if (scheduleGarage != null) {
    out.garageSqft = scheduleGarage;
  }

  const scheduleDeck = scheduleDeckSqft(buildingAreas);
  if (scheduleDeck != null) {
    out.deckSqft = scheduleDeck;
  } else if (out.deckSqft == null) {
    // keep room-aggregated deck below
  }

  // If vision stuffed patio SF into concreteSqft, move it to deck
  if (
    out.concreteSqft != null &&
    isPatioLikeConcreteValue(out.concreteSqft, buildingAreas)
  ) {
    if (out.deckSqft == null) out.deckSqft = out.concreteSqft;
    delete out.concreteSqft;
  }
  // Also catch unlabeled concrete that matched patio before we stripped it
  const rawConcrete = positive(src.concreteSqft);
  if (
    out.deckSqft == null &&
    rawConcrete != null &&
    isPatioLikeConcreteValue(rawConcrete, buildingAreas)
  ) {
    out.deckSqft = rawConcrete;
  }
  // Never keep the same number in both deck and concrete — covered patio is deck.
  if (
    out.concreteSqft != null &&
    out.deckSqft != null &&
    Math.abs(out.concreteSqft - out.deckSqft) < 0.6
  ) {
    delete out.concreteSqft;
  }

  // Aggregate kitchen/bath/deck rooms when vision omitted the measurements map
  const byKey = new Map();
  for (const room of rooms) {
    if (!room.measurementKey || room.areaSqft == null || room.confidence < 0.4)
      continue;
    if (
      LABELED_ONLY_KEYS.has(room.measurementKey) &&
      !labeled.has(room.measurementKey)
    )
      continue;
    if (
      CONCRETE_EXPLICIT_KEYS.has(room.measurementKey) &&
      !labeled.has(room.measurementKey)
    )
      continue;
    byKey.set(
      room.measurementKey,
      (byKey.get(room.measurementKey) || 0) + room.areaSqft,
    );
  }
  for (const [key, total] of byKey) {
    if (out[key] == null) out[key] = Math.round(total * 10) / 10;
  }

  // Only sum rooms into floorAreaSqft when no schedule total exists
  if (out.floorAreaSqft == null) {
    const roomSum = rooms
      .filter((r) => r.areaSqft != null && r.confidence >= 0.4)
      .filter((r) => {
        const n = String(r.name || "").toLowerCase();
        return !/garage|patio|deck|storage|mechanical|closet|w\.?i\.?c/.test(n);
      })
      .reduce((s, r) => s + r.areaSqft, 0);
    // Require a meaningful multi-room sum (avoid a single 40 SF bath becoming "Room floor")
    if (roomSum >= 200 && rooms.filter((r) => r.areaSqft != null).length >= 2) {
      out.floorAreaSqft = Math.round(roomSum * 10) / 10;
    }
  }

  if (out.flooringSqft == null && out.floorAreaSqft != null) {
    out.flooringSqft = out.floorAreaSqft;
  }

  return out;
}

function buildItemQuantities(measurements) {
  const itemQuantities = {};
  const map = {
    flooringSqft: { key: "flooring", unit: "sqft" },
    floorAreaSqft: { key: "flooring", unit: "sqft" },
    drywallSqft: { key: "drywall", unit: "sqft" },
    wallPaintSqft: { key: "paint", unit: "sqft" },
    ceilingPaintSqft: { key: "ceiling_paint", unit: "sqft" },
    interiorDoorCount: { key: "door_paint", unit: "each" },
    cabinetRunLf: { key: "cabinet_paint", unit: "lf" },
    exteriorPaintSqft: { key: "exterior_paint", unit: "sqft" },
    baseboardLf: { key: "trim", unit: "lf" },
    cabinetLf: { key: "cabinets", unit: "lf" },
    countertopSqft: { key: "countertops", unit: "sqft" },
    backsplashSqft: { key: "backsplash", unit: "sqft" },
    windowCount: { key: "windows", unit: "each" },
    exteriorDoorCount: { key: "exterior_doors", unit: "each" },
    slidingDoorCount: { key: "sliding_doors", unit: "each" },
    roofSquares: { key: "shingles_roofing", unit: "squares" },
    deckSqft: { key: "deck", unit: "sqft" },
    concreteSqft: { key: "concrete", unit: "sqft" },
    serviceCallCount: { key: "service_call", unit: "each" },
    fixtureRepairCount: { key: "fixture_repair", unit: "each" },
    fixtureReplacementCount: { key: "fixture_replace", unit: "each" },
    drainCleaningCount: { key: "drain_cleaning", unit: "each" },
    waterLineLf: { key: "water_line", unit: "lf" },
    sewerLineLf: { key: "sewer_line", unit: "lf" },
    plumbingRoughPointCount: { key: "plumbing_rough", unit: "each" },
    plumbingTrimHookupCount: { key: "plumbing_trim", unit: "each" },
    partsMaterialsCount: { key: "parts_materials", unit: "allowance" },
    emergencyFeeCount: { key: "emergency_fee", unit: "allowance" },
    plumbingCleanupCount: { key: "cleanup", unit: "allowance" },
    hvacSystemCount: { key: "hvac", unit: "each" },
    hvacSystemTons: { key: "hvac", unit: "ton" },
    hvacServiceCallCount: { key: "service_call", unit: "each" },
    hvacEquipmentReplacementCount: { key: "equipment_replace", unit: "each" },
    hvacRefrigerantCount: { key: "refrigerant", unit: "each" },
    hvacThermostatCount: { key: "thermostat", unit: "each" },
    hvacDuctworkLf: { key: "ductwork", unit: "lf" },
    hvacSupplyRegisterCount: { key: "supply_registers", unit: "each" },
    hvacReturnGrilleCount: { key: "return_grilles", unit: "each" },
    hvacVentilationCount: { key: "ventilation", unit: "each" },
    hvacPermitCount: { key: "permits", unit: "each" },
    hvacCleanupCount: { key: "cleanup", unit: "each" },
  };
  for (const [measKey, meta] of Object.entries(map)) {
    if (measurements[measKey] == null) continue;
    if (itemQuantities[meta.key]) continue;
    itemQuantities[meta.key] = {
      quantity: measurements[measKey],
      unit: meta.unit,
      quantitySource: "plan_vision",
    };
  }
  const garageDoorCount =
    (Number(measurements.garageDoorSingleCount) || 0) +
    (Number(measurements.garageDoorDoubleCount) || 0) +
    (Number(measurements.garageDoorRvCount) || 0);
  if (garageDoorCount > 0 && !itemQuantities.garage_doors) {
    itemQuantities.garage_doors = {
      quantity: garageDoorCount,
      unit: "each",
      quantitySource: "plan_vision",
    };
  }
  return itemQuantities;
}

function formatRoomInventoryLines(rooms) {
  const lines = [];
  for (const room of (Array.isArray(rooms) ? rooms : []).slice(0, 48)) {
    const lengthFt = positive(room.lengthFt);
    const widthFt = positive(room.widthFt);
    const areaSqft = positive(room.areaSqft);
    let dims = "size unclear";
    if (lengthFt != null && widthFt != null) {
      dims = `${lengthFt}×${widthFt} ft`;
      if (areaSqft != null) dims += ` (${areaSqft} sqft)`;
    } else if (areaSqft != null) {
      dims = `${areaSqft} sqft`;
    }
    lines.push(`- ${room.name}: ${dims}`);
  }
  return lines;
}

function formatNotesBlock({ notesBlock, rooms, measurements, buildingAreas }) {
  const lines = [];
  const summary = notesBlock ? String(notesBlock).trim() : "";
  if (summary) {
    lines.push(summary);
  } else {
    lines.push("Plan takeoff (confirm measurements):");
    if (buildingAreas?.totalLivingSqft != null) {
      lines.push(`- Total living: ${buildingAreas.totalLivingSqft} sqft`);
    }
    if (buildingAreas?.mainFloorLivingSqft != null) {
      lines.push(
        `- Main floor living: ${buildingAreas.mainFloorLivingSqft} sqft`,
      );
    }
    if (buildingAreas?.upstairsLivingSqft != null) {
      lines.push(`- Upstairs living: ${buildingAreas.upstairsLivingSqft} sqft`);
    }
    if (buildingAreas?.garageSqft != null) {
      lines.push(`- Garage: ${buildingAreas.garageSqft} sqft`);
    }
    if (buildingAreas?.coveredPatioSqft != null) {
      lines.push(`- Covered patio: ${buildingAreas.coveredPatioSqft} sqft`);
    }
  }

  const roomLines = formatRoomInventoryLines(rooms);
  if (roomLines.length && !/Room measurements:/i.test(summary)) {
    if (lines.length) lines.push("");
    lines.push("Room measurements:");
    lines.push(...roomLines);
  }

  const keys = Object.keys(measurements || {});
  if (keys.length && !summary) {
    lines.push(`Mapped fields: ${keys.join(", ")}`);
  }
  return lines.join("\n").trim().slice(0, 4000);
}

/**
 * Merge plan notes into job notes (idempotent marker).
 */
function mergePlanNotesIntoJobNotes(existingNotes, notesBlock) {
  const block = String(notesBlock || "").trim();
  if (!block) return String(existingNotes || "").trim();
  const marker = "--- Plan takeoff ---";
  const existing = String(existingNotes || "");
  const withoutOld = existing.includes(marker)
    ? existing.slice(0, existing.indexOf(marker)).trimEnd()
    : existing.trimEnd();
  return [withoutOld, "", marker, block]
    .filter((p, i) => (i === 0 ? true : p !== ""))
    .join("\n")
    .trim();
}

function isPdfPayload(img) {
  return String(img?.mimeType || "").toLowerCase() === PDF_MIME;
}

async function ensureCompatibleImage(img) {
  const rawB64 = String(img?.base64 || "").replace(/^data:[^;]+;base64,/, "");
  if (isPdfPayload(img)) {
    return {
      base64: rawB64,
      mimeType: PDF_MIME,
      filename: String(img?.name || "plan.pdf").slice(0, 120),
    };
  }
  return { base64: rawB64, mimeType: normalizeMime(img?.mimeType) };
}

/** GPT-4o accepts PDFs as file content parts; images stay image_url parts. */
function toVisionContentPart(page) {
  if (page.mimeType === PDF_MIME) {
    return {
      type: "file",
      file: {
        filename: page.filename || "plan.pdf",
        file_data: `data:${PDF_MIME};base64,${page.base64}`,
      },
    };
  }
  return {
    type: "image_url",
    image_url: { url: `data:${page.mimeType};base64,${page.base64}` },
  };
}

/**
 * @param {object} params
 */
async function analyzePlanForMeasurements({
  images,
  existingNotes = "",
  templateKeyHint = null,
  projectTypeHint = null,
  includeScope = false,
  estimatingMode = "whole_project",
  selectedTrade = null,
  openai,
  aiModels,
  aiRuntime,
}) {
  const { resolvePlanImportSelection } = require("./planImportTradeConfig");
  const planSelection = resolvePlanImportSelection(
    estimatingMode,
    selectedTrade?.key || selectedTrade,
  );
  const paintingSelected =
    planSelection.mode === "selected_trade" &&
    planSelection.trade?.key === "painting";
  const electricalSelected =
    planSelection.mode === "selected_trade" &&
    planSelection.trade?.key === "electrical";
  const plumbingSelected =
    planSelection.mode === "selected_trade" &&
    planSelection.trade?.key === "plumbing";
  const insulationSelected =
    planSelection.mode === "selected_trade" &&
    planSelection.trade?.key === "insulation";
  const drywallSelected =
    planSelection.mode === "selected_trade" &&
    planSelection.trade?.key === "drywall";
  const windowsDoorsSelected =
    planSelection.mode === "selected_trade" &&
    planSelection.trade?.key === "windows_doors";
  const hvacSelected =
    planSelection.mode === "selected_trade" &&
    planSelection.trade?.key === "hvac";
  const framingSelected =
    planSelection.mode === "selected_trade" &&
    planSelection.trade?.key === "framing";
  if (!openai) {
    const err = new Error("OpenAI client not configured");
    err.status = 503;
    throw err;
  }

  const list = (Array.isArray(images) ? images : []).slice(0, MAX_IMAGES);
  if (!list.length) {
    const err = new Error("At least one plan image is required");
    err.status = 400;
    throw err;
  }

  for (const img of list) {
    if (!img?.base64 || typeof img.base64 !== "string") {
      const err = new Error("Each page must include a base64 string");
      err.status = 400;
      throw err;
    }
    const limit = isPdfPayload(img) ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (approxBase64Bytes(img.base64) > limit) {
      const err = new Error(
        isPdfPayload(img)
          ? "PDF too large — keep the plan set under 20MB"
          : "Image too large — keep each plan page under 12MB",
      );
      err.status = 413;
      throw err;
    }
  }

  const compatible = [];
  for (const img of list) {
    compatible.push(await ensureCompatibleImage(img));
  }

  // Deterministic PDF text takeoff (schedule + spatially paired rooms) when bytes are PDFs.
  let pdfTakeoff = null;
  let pdfBuffers = [];
  try {
    const {
      extractPlanTakeoffFromPdfBuffers,
      formatPdfEvidenceForVision,
    } = require("./planPdfTextTakeoff");
    pdfBuffers = compatible
      .filter((p) => p.mimeType === PDF_MIME && p.base64)
      .map((p) =>
        Buffer.from(
          String(p.base64).replace(/^data:[^;]+;base64,/, ""),
          "base64",
        ),
      );
    if (pdfBuffers.length) {
      pdfTakeoff = await extractPlanTakeoffFromPdfBuffers(pdfBuffers);
      if (pdfTakeoff) {
        pdfTakeoff.evidenceText = formatPdfEvidenceForVision(pdfTakeoff, {
          tradeKey: planSelection.trade?.key,
        });
      }
    }
  } catch (err) {
    console.warn("PDF text takeoff skipped:", err?.message || err);
    pdfTakeoff = null;
  }

  let electricalSheetImages = [];
  if (
    electricalSelected &&
    pdfBuffers.length &&
    pdfTakeoff?.electricalRelevantPages?.length
  ) {
    try {
      const { renderElectricalPlanPages } = require("./planPdfTextTakeoff");
      electricalSheetImages = await renderElectricalPlanPages(
        pdfBuffers,
        pdfTakeoff.electricalRelevantPages,
      );
    } catch (err) {
      console.warn("Electrical sheet raster skipped:", err?.message || err);
      electricalSheetImages = [];
    }
  }

  let plumbingSheetImages = [];
  if (
    plumbingSelected &&
    pdfBuffers.length &&
    pdfTakeoff?.plumbingRelevantPages?.length
  ) {
    try {
      const { renderPlumbingPlanPages } = require("./planPdfTextTakeoff");
      plumbingSheetImages = await renderPlumbingPlanPages(
        pdfBuffers,
        pdfTakeoff.plumbingRelevantPages,
      );
    } catch (err) {
      console.warn("Plumbing sheet raster skipped:", err?.message || err);
      plumbingSheetImages = [];
    }
  }

  let insulationSheetImages = [];
  if (
    insulationSelected &&
    pdfBuffers.length &&
    pdfTakeoff?.insulationRelevantPages?.length
  ) {
    try {
      const { renderInsulationPlanPages } = require("./planPdfTextTakeoff");
      insulationSheetImages = await renderInsulationPlanPages(
        pdfBuffers,
        pdfTakeoff.insulationRelevantPages,
        { maxPages: 12, maxDimension: 4200 },
      );
    } catch (err) {
      console.warn("Insulation sheet raster skipped:", err?.message || err);
      insulationSheetImages = [];
    }
  }

  let hvacSheetImages = [];
  if (
    hvacSelected &&
    pdfBuffers.length &&
    pdfTakeoff?.hvacRelevantPages?.length
  ) {
    try {
      const { renderHvacPlanPages } = require("./planPdfTextTakeoff");
      hvacSheetImages = await renderHvacPlanPages(
        pdfBuffers,
        pdfTakeoff.hvacRelevantPages,
        { maxPages: 12, maxDimension: 4200 },
      );
    } catch (err) {
      console.warn("HVAC sheet raster skipped:", err?.message || err);
      hvacSheetImages = [];
    }
  }

  if (electricalSelected) {
    logElectricalTakeoffStage("ELECTRICAL PAGE SELECTION", {
      pages: (pdfTakeoff?.electricalRelevantPages || []).map(
        (page) => page.page,
      ),
      reasons: (pdfTakeoff?.electricalRelevantPages || []).map((page) => ({
        page: page.page,
        reasons: page.reasons || [],
      })),
      rasterizedPages: electricalSheetImages.map((page) => ({
        page: page.page,
        bytes: page.byteLength || null,
        width: page.width || null,
        height: page.height || null,
      })),
    });
  }

  const hintBits = [];
  if (templateKeyHint) hintBits.push(`template: ${templateKeyHint}`);
  if (projectTypeHint) hintBits.push(`project type: ${projectTypeHint}`);
  if (planSelection.trade) {
    hintBits.push(
      `ESTIMATING MODE: selected trade — ${planSelection.trade.label}. ${
        planSelection.trade.scopeHint ||
        `Route review toward ${planSelection.trade.label.toLowerCase()} only.`
      } Preserve missing information for contractor confirmation. For Stucco / Exterior Finish, always take off window/door and garage openings from elevation drawings even when perimeter/plate facts already support gross wall area.`,
    );
  }
  if (existingNotes?.trim()) {
    hintBits.push(
      `job notes (context only):\n${String(existingNotes).trim().slice(0, 1200)}`,
    );
  }
  if (pdfTakeoff?.evidenceText) {
    hintBits.push(pdfTakeoff.evidenceText);
  }

  const paintingVisionInstructions = [
    "For Painting, relevant sheets are floor plans, RCPs / reflected ceiling plans, finish schedules, door schedules, interior elevations, cabinet/millwork, and exterior elevations — not only sheets that say Paint.",
    "Perform a painting takeoff when geometry supports it. wallPaintSqft = dimensioned room perimeter × explicit wall/plate height (gross). ceilingPaintSqft = dimensioned interior room areas. baseboardLf = dimensioned room perimeters when base/trim is supported. Never use living SF, floor SF, or an arbitrary multiplier. Never assume 9' height if it is not labeled.",
    "Count interiorDoorCount from a door schedule or identifiable interior door symbols (exclude exterior doors) and add it to geometryDerived. Cabinet paint keys only when paint-grade millwork is explicit.",
    "For exterior paint, use labeled paint area or dimensioned elevation width × height for painted cladding. Do not count stucco/brick/stone cladding as painted wall area.",
  ].join("\n");
  const electricalVisionParts = electricalSheetImages.length
    ? electricalSheetImages.map(toVisionContentPart)
    : null;
  const plumbingVisionParts = plumbingSheetImages.length
    ? plumbingSheetImages.map(toVisionContentPart)
    : null;
  const insulationVisionParts = insulationSheetImages.length
    ? insulationSheetImages.map(toVisionContentPart)
    : null;
  const hvacVisionParts = hvacSheetImages.length
    ? hvacSheetImages.map(toVisionContentPart)
    : null;
  if (process.env.NODE_ENV !== "production" && insulationSelected) {
    console.debug("[insulation plan pages]", {
      selectedPages: (pdfTakeoff?.insulationRelevantPages || []).map(
        (page) => page.page,
      ),
      rasterizedPages: insulationSheetImages.map((page) => page.page),
    });
  }
  const visionParts =
    electricalVisionParts ||
    plumbingVisionParts ||
    hvacVisionParts ||
    compatible.map(toVisionContentPart);
  const electricalSheetCountHint = electricalVisionParts
    ? `The attached images are Electrical sheets (pages ${
        (pdfTakeoff?.electricalRelevantPages || [])
          .map((page) => page.page)
          .join(", ") || "E sheets"
      }). Count symbols on every attached page, return a sheet subtotal for every page, and reconcile the final totals to those subtotals. Do not extract living SF or room L×W on this pass.`
    : "Prioritize E sheets and panel schedules inside the attached plan file.";
  const plumbingSheetCountHint = plumbingVisionParts
    ? `The attached images are Plumbing-relevant sheets (pages ${
        (pdfTakeoff?.plumbingRelevantPages || [])
          .map((page) => page.page)
          .join(", ") || "P / floor-plan sheets"
      }). Build fixtureInventory from readable fixture symbols and schedules on every attached page. Derive rough-in and trim only from that inventory. Treat labeled LF on architectural sheets as partial segments that require contractor confirmation.`
    : "Prioritize P sheets, fixture schedules, riser diagrams, floor plans with fixture symbols, and site/utility plans inside the attached plan file.";
  const hvacSheetCountHint = hvacVisionParts
    ? `The attached images are HVAC / mechanical sheets (pages ${
        (pdfTakeoff?.hvacRelevantPages || [])
          .map((page) => page.page)
          .join(", ") || "M / mechanical sheets"
      }). Count supply registers, return grilles, thermostats, ventilation equipment, and labeled ductwork on every attached page. Reconcile equipment schedules with plan tags.`
    : "Prioritize M sheets, equipment schedules, duct layouts, and floor plans with mechanical callouts inside the attached plan file.";

  // Electrical counts are a measurement pass, not creative estimation. Keep
  // repeated imports of the same sheets stable; genuine disagreements still
  // remain as conflict candidates for contractor confirmation.
  const planVisionTemperature =
    electricalSelected || insulationSelected
      ? 0
      : Math.min(aiRuntime.assistant.vision.temperature ?? 0.2, 0.15);
  const measurementsPromise = openai.chat.completions.create({
    model: aiModels.assistant.vision,
    response_format: aiRuntime.assistant.vision.responseFormat,
    temperature: planVisionTemperature,
    max_tokens: Math.max(aiRuntime.assistant.vision.maxTokens || 900, 4000),
    messages: [
      {
        role: "system",
        content: visionSystemPrompt(
          electricalSelected,
          plumbingSelected,
          insulationSelected,
          drywallSelected,
          windowsDoorsSelected,
          hvacSelected,
        ),
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: electricalSelected
              ? [
                  ELECTRICAL_VISION_INSTRUCTIONS,
                  electricalSheetCountHint,
                  "Return Electrical canonical counts only. Add explicit-only circuit/LF keys to explicitlyLabeled. Leave rough/trim packages, job condition, and unlabeled homeruns omitted.",
                  hintBits.length ? hintBits.join("\n\n") : "No extra context.",
                ].join("\n\n")
              : hvacSelected
                ? [
                    HVAC_VISION_INSTRUCTIONS,
                    hvacSheetCountHint,
                    "Return HVAC canonical quantities only. Leave living-area quantities, unsupported values, and inferred system capacities omitted.",
                    hintBits.length
                      ? hintBits.join("\n\n")
                      : "No extra context.",
                  ].join("\n\n")
              : plumbingSelected
                ? [
                    PLUMBING_VISION_INSTRUCTIONS,
                    "Return canonical Plumbing quantities only. Leave packages, living-area quantities, and unsupported/inferred values omitted.",
                    hintBits.length
                      ? hintBits.join("\n\n")
                      : "No extra context.",
                  ].join("\n\n")
                : insulationSelected
                  ? [
                      INSULATION_VISION_INSTRUCTIONS,
                      hintBits.length
                        ? hintBits.join("\n\n")
                        : "No extra context.",
                    ].join("\n\n")
                  : windowsDoorsSelected
                    ? [
                        WINDOWS_DOORS_VISION_INSTRUCTIONS,
                        "Return only Windows & doors canonical counts and evidence. Leave type, finish, hardware, replacement scope, and any unreadable opening omitted.",
                        hintBits.length
                          ? hintBits.join("\n\n")
                          : "No extra context.",
                      ].join("\n\n")
                  : drywallSelected
                    ? [
                        DRYWALL_VISION_INSTRUCTIONS,
                        "Inspect every architectural floor plan, dimensioned room layout, reflected ceiling plan, section, interior elevation, wall-type schedule, and finish schedule attached.",
                        "Return every readable drywall-relevant room in rooms[] with name, lengthFt, widthFt, areaSqft, wallHeightFt or plateHeightFt when shown, sourcePage, sourceSheet, and confidence. Include conditioned rooms and separately labeled Garage/RV Garage rooms.",
                        "For the selected Drywall trade, calculate drywallWallSqft from readable conditioned-room perimeters multiplied by explicit wall/plate height, and drywallCeilingSqft from readable conditioned ceiling/room areas. Add those keys to geometryDerived and explain any incomplete coverage as NEEDS_CONFIRMATION.",
                        "Do not use total living area, garage area, a multiplier, visual proportions, or an arbitrary default height as a drywall surface quantity. Use living and garage schedule areas only as context or a reasonableness check.",
                        "Return garageWallDrywallSqft and garageCeilingDrywallSqft separately when garage geometry and height are readable. Return specialty board, vaulted/sloped, high-ceiling, and Level 5 quantities only when explicitly documented.",
                        hintBits.length
                          ? hintBits.join("\n\n")
                          : "No extra context.",
                      ].join("\n\n")
                  : [
                      "Extract Building Areas / Area Schedule totals AND every labeled room with length×width or SF from these floor plan / blueprint pages.",
                      "For Stucco / Exterior Finish, inspect every front/rear/left/right elevation and wall section. Read elevation face widths/heights, story-specific plate heights, window and door dimensions, garage door dimensions, cladding callouts, soffits, parapets, foam bands, and control joints.",
                      "Calculate gross exterior wall SF only from readable elevation face dimensions or a readable perimeter plus story-specific heights. PDF perimeter/plate facts (when provided) replace living-SF guesses for GROSS only — you must still return window/door opening SF and garage opening SF from the elevations. Subtract only readable opening and non-stucco finish deductions. Never use living SF, floor SF, ridge height, or visual proportions as wall area.",
                      "Include all bedrooms, baths, kitchen, dining, great room/living, laundry, pantry, closets, garage/RV garage, patio/porch — not just a few key rooms.",
                      "Pair each room label with the dimension string printed for that room only — never swap Kitchen/Den/Bedroom/Garage/RV dims.",
                      "Use floor-plan sheets for room L×W, not foundation overall garage envelopes. Each bath needs its own readable L×W; otherwise omit bathroomFloorSqft.",
                      "Photos of printed sheets are OK — read the title-block square footage table carefully.",
                      "Only report numbers you can actually read. If a value is blurry or illegible, omit it and list it in unreadableFields — never guess.",
                      paintingSelected
                        ? paintingVisionInstructions
                        : "Do not invent paint, drywall, or trim quantities. If a Stucco quantity is unavailable, list the exact missing sheet/measurement in unreadableFields or missingInfo.",
                      "Covered patio / roof deck → deckSqft. Garage schedule → garageSqft. Never map patio to concrete flatwork.",
                      hintBits.length
                        ? hintBits.join("\n\n")
                        : "No extra context.",
                    ].join("\n\n"),
          },
          ...visionParts,
        ],
      },
    ],
  });

  // Scope pass runs in parallel — a failed scope pass never blocks the takeoff.
  const scopePromise = includeScope
    ? (async () => {
        try {
          const { analyzePlanForScope } = require("./estimatePlanToScope");
          return await analyzePlanForScope({
            pages: compatible,
            toVisionContentPart,
            existingNotes,
            templateKeyHint,
            projectTypeHint,
            estimatingMode: planSelection.mode,
            selectedTrade: planSelection.trade,
            openai,
            aiModels,
            aiRuntime,
          });
        } catch (err) {
          console.warn("Plan scope pass failed:", err?.message || err);
          return {
            success: false,
            reason: null,
            scopeText: "",
            detections: [],
          };
        }
      })()
    : Promise.resolve(null);
  // A focused trade pass helps PDF file inputs where the general takeoff reads
  // the text layer but does not inspect graphical elevation geometry deeply.
  const createTradeVisualCompletion = () =>
    openai.chat.completions.create({
      model: aiModels.assistant.vision,
      response_format: aiRuntime.assistant.vision.responseFormat,
      temperature: planVisionTemperature,
      max_tokens: Math.max(aiRuntime.assistant.vision.maxTokens || 900, 2500),
      messages: [
        {
          role: "system",
          content:
            visionSystemPrompt(
              electricalSelected,
              plumbingSelected,
              insulationSelected,
              drywallSelected,
              windowsDoorsSelected,
              hvacSelected,
            ) +
            (planSelection.trade &&
            !electricalSelected &&
            !plumbingSelected &&
            !windowsDoorsSelected &&
            !hvacSelected
              ? "\nThis is a focused trade takeoff pass. Prioritize measurable geometry and scope for the selected trade over general room extraction."
              : electricalSelected
                ? "\nThis is a focused Electrical symbol-count pass. Count devices on the attached E-sheet images."
                : insulationSelected
                  ? "\nThis is a focused Insulation thermal-envelope pass. Inspect wall sections, attic/roof details, insulation schedules, and garage separation details."
                  : drywallSelected
                    ? "\nThis is a focused Drywall surface pass. Inspect room dimensions, reflected ceiling plans, wall heights, finish schedules, and labeled wall/ceiling quantities."
                    : windowsDoorsSelected
                      ? "\nThis is a focused Windows & doors opening-count pass. Reconcile schedules and elevations; count each opening once."
                      : hvacSelected
                        ? "\nThis is a focused HVAC quantity pass. Count only readable mechanical equipment, thermostats, ventilation, and labeled ductwork."
                      : plumbingSelected
                      ? "\nThis is a focused Plumbing quantity pass. Count only readable fixtures, schedules, points, and labeled line lengths."
                      : "\nThis is a focused general-contractor takeoff pass. Prioritize measurable quantities across every major scope category."),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                planSelection.trade
                  ? `Focus only on ${planSelection.trade.label}. Inspect every relevant elevation, section, detail, schedule, and takeoff sheet in the plan file.`
                  : "Review the complete plan set for all major building scopes: structure, foundation, concrete, framing, roof, windows/doors, exterior finishes, MEP, insulation, drywall, flooring, cabinets, tile, paint, sitework, patios, and landscaping.",
                insulationSelected
                  ? "For Insulation, return elevationFaces for every readable exterior elevation with face width/height or area and windowDoorOpeningsSqft / garageOpeningsSqft. Read graphical opening dimensions on every elevation, not only the PDF text layer."
                  : drywallSelected
                    ? "For Drywall, return separate drywallWallSqft and drywallCeilingSqft when supported by labeled values or readable room geometry. Do not return a living-area proxy."
                    : windowsDoorsSelected
                      ? "For Windows & doors, return windowCount, exteriorDoorCount, slidingDoorCount, and garage door counts by type from schedules, tags, dimensions, or directly countable elevation symbols. Reconcile duplicate elevations."
                      : hvacSelected
                        ? "For HVAC, return system count, explicitly labeled tonnage, thermostats, ventilation equipment, replacements, refrigerant service, and labeled ductwork LF. Reconcile equipment schedules with plan tags and leave unknown capacity or duct lengths omitted."
                    : "For Stucco / Exterior Finish, return elevationFaces with readable face width/height or area, stucco area, windowDoorOpeningsSqft, garageOpeningsSqft, and non-stucco deductions. Also populate measurements.stuccoWindowDoorOpeningSqft and measurements.stuccoGarageOpeningSqft. Read graphical opening dimensions on every elevation, not only the PDF text layer.",
                insulationSelected
                  ? "For Insulation, do not return a wall quantity from one elevation or perimeter alone. Return all complete labeled wall/opening facts so the app can calculate one net exterior-wall quantity."
                  : drywallSelected
                    ? "For Drywall, do not use living area or a multiplier. Return every supported partial wall/ceiling geometry quantity with geometryDerived provenance and NEEDS_CONFIRMATION evidence when coverage or wall height is incomplete; leave only the unresolved portion out."
                    : "PDF text perimeter/plate/story facts (when present) support gross wall area only. Opening deductions still come from elevation drawings.",
                insulationSelected
                  ? INSULATION_VISION_INSTRUCTIONS
                  : drywallSelected
                    ? DRYWALL_VISION_INSTRUCTIONS
                    : hvacSelected
                      ? HVAC_VISION_INSTRUCTIONS
                    : windowsDoorsSelected
                      ? WINDOWS_DOORS_VISION_INSTRUCTIONS
                    : plumbingSelected
                      ? PLUMBING_VISION_INSTRUCTIONS
                      : paintingSelected
                        ? paintingVisionInstructions
                        : electricalSelected
                          ? ELECTRICAL_VISION_INSTRUCTIONS
                          : "For every applicable scope, return clearly labeled trade-specific measurements and scope evidence using the existing JSON schema.",
                paintingSelected
                  ? "Return wallPaintSqft, ceilingPaintSqft, baseboardLf, interiorDoorCount, and exteriorPaintSqft when geometry or schedules support them. Add geometry-derived keys to geometryDerived. Leave occupancy, application method, and prep omitted."
                  : windowsDoorsSelected
                    ? "Return only the six canonical Windows & doors counts. Use explicit schedule/label counts or directly counted symbols, record evidence, and leave undocumented type/finish/hardware details for contractor confirmation."
                  : insulationSelected
                    ? "The attached pages are rasterized insulation-relevant sheets selected from the PDF. Inspect the actual wall sections, elevations, ceiling/attic plans, roof details, schedules, and notes in those images. Return insulation quantities only when explicitly labeled or directly calculated from readable labeled dimensions. Preserve the wall/attic versus roof-deck boundary distinction."
                    : plumbingSelected
                      ? `${plumbingSheetCountHint} Return Plumbing canonical quantities only. Add only explicit or directly measured fields to explicitlyLabeled/geometryDerived. Leave packages and unsupported values omitted.`
                      : electricalSelected
                        ? `${electricalSheetCountHint} Return Electrical canonical counts only. Add explicit-only circuit/LF keys to explicitlyLabeled. Leave rough/trim packages, job condition, and unlabeled homeruns omitted.`
                        : "Do not use living SF or visual proportions as a substitute. Leave unavailable values out and list the exact missing sheet or dimension.",
              ].join("\n\n"),
            },
            ...(electricalSelected || plumbingSelected || hvacSelected
              ? visionParts
              : insulationSelected && insulationVisionParts
                ? insulationVisionParts
                : compatible.map(toVisionContentPart)),
          ],
        },
      ],
    });
  const tradeVisualPromise =
    planSelection.mode === "whole_project" || planSelection.trade
      ? (async () => {
          if (!insulationSelected) return createTradeVisualCompletion();

          // Two focused reads in parallel: a single empty elevation pass
          // previously wiped a valid 550 SF opening takeoff. Merge both
          // payloads and keep the stronger opening evidence.
          const [first, retry] = await Promise.all([
            createTradeVisualCompletion(),
            createTradeVisualCompletion().catch(() => null),
          ]);
          const merged = mergeInsulationFocusedPayloads(
            parseVisionJsonPayload(first),
            retry ? parseVisionJsonPayload(retry) : {},
          );
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify(merged),
                },
              },
            ],
          };
        })()
      : Promise.resolve(null);

  const [completion, scopeResult, tradeVisualCompletion] = await Promise.all([
    measurementsPromise,
    scopePromise,
    tradeVisualPromise,
  ]);

  const raw = completion.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err = new Error(
      "Vision model returned invalid JSON. Try a clearer plan image.",
    );
    err.status = 502;
    throw err;
  }
  if (plumbingSelected) applyPlumbingVisionTakeoff(parsed);
  const generalElectricalVisionSource = electricalSelected
    ? parsed.measurements
    : null;
  const generalElectricalVision = electricalSelected
    ? electricalDebugSnapshot(parsed.measurements)
    : null;
  if (electricalSelected) foldElectricalVisionPayload(parsed);
  let focusedElectricalVision = null;
  let focusedElectricalVisionSource = null;
  let measurementProvenance = {};
  let measurementConflicts = [];
  let electricalValidation = null;
  let electricalEvidenceMerged = false;
  let hvacEvidenceMerged = false;
  let plumbingFieldEvidence = normalizePlumbingFieldEvidence(
    parsed.fieldEvidence,
  );
  let plumbingFixtureInventory =
    parsed.fixtureInventory && typeof parsed.fixtureInventory === "object"
      ? parsed.fixtureInventory
      : null;
  let plumbingUtilityConnections = normalizePlumbingUtilityConnections(
    parsed.utilityConnections,
  );
  let plumbingComplexityFactors = normalizePlumbingComplexityFactors(
    parsed.complexityFactors,
  );
  let plumbingWaterHeaterDetail = null;
  let plumbingGasApplianceScope = null;
  let plumbingReviewStatus = null;
  const electricalTagMeasurements = electricalSelected
    ? instanceTagMeasurementsFromTakeoff(pdfTakeoff)
    : {};
  const hvacTagMeasurements = hvacSelected
    ? hvacPdfTextMeasurementsFromTakeoff(pdfTakeoff)
    : {};
  if (tradeVisualCompletion) {
    try {
      const focused = JSON.parse(
        tradeVisualCompletion.choices?.[0]?.message?.content || "{}",
      );
      if (electricalSelected) {
        focusedElectricalVisionSource = focused.measurements;
        focusedElectricalVision = electricalDebugSnapshot(focused.measurements);
        foldElectricalVisionPayload(focused);
      }
      if (insulationSelected && process.env.NODE_ENV !== "production") {
        console.debug("[insulation focused pass]", {
          measurementKeys: Object.keys(focused.measurements || {}),
          planFactKeys: Object.keys(focused.planFacts || {}),
          unreadableFields: focused.unreadableFields || [],
        });
      }
      if (plumbingSelected) applyPlumbingVisionTakeoff(focused);
      if (plumbingSelected) {
        plumbingFieldEvidence = mergePlumbingFieldEvidence(
          plumbingFieldEvidence,
          focused.fieldEvidence,
        );
        plumbingFixtureInventory = {
          ...(plumbingFixtureInventory || {}),
          ...(focused.fixtureInventory || {}),
        };
        plumbingUtilityConnections = [
          ...plumbingUtilityConnections,
          ...normalizePlumbingUtilityConnections(focused.utilityConnections),
        ].slice(0, 16);
        plumbingComplexityFactors = [
          ...plumbingComplexityFactors,
          ...normalizePlumbingComplexityFactors(focused.complexityFactors),
        ].slice(0, 16);
        if (focused.waterHeaterDetail) {
          plumbingWaterHeaterDetail = focused.waterHeaterDetail;
        }
        if (focused.gasApplianceScope) {
          plumbingGasApplianceScope = focused.gasApplianceScope;
        }
      }
      const mergedMeasurements = electricalSelected
        ? mergeElectricalEvidenceSources({
            generalMeasurements: parsed.measurements,
            generalConfidence: parsed.fieldConfidence,
            focusedMeasurements: focused.measurements,
            focusedConfidence: focused.fieldConfidence,
            instanceTagMeasurements: electricalTagMeasurements,
          })
        : hvacSelected
          ? mergeElectricalEvidenceSources({
              generalMeasurements: parsed.measurements,
              generalConfidence: parsed.fieldConfidence,
              focusedMeasurements: focused.measurements,
              focusedConfidence: focused.fieldConfidence,
              instanceTagMeasurements: hvacTagMeasurements,
            })
          : mergeMeasurementCandidates({
            baseMeasurements: parsed.measurements,
            overlayMeasurements: focused.measurements,
            baseConfidence: parsed.fieldConfidence,
            overlayConfidence: focused.fieldConfidence,
            baseEvidence: stuccoEvidenceByField(parsed.planFacts),
            overlayEvidence: stuccoEvidenceByField(focused.planFacts),
          });
      if (electricalSelected) electricalEvidenceMerged = true;
      if (hvacSelected) hvacEvidenceMerged = true;
      if (electricalSelected) {
        parsed.electricalSheetEvidence = mergeElectricalSheetEvidence(
          parsed.electricalSheetEvidence,
          focused.electricalSheetEvidence,
        );
        parsed.electricalFieldEvidence = mergeElectricalFieldEvidence(
          parsed.electricalFieldEvidence,
          focused.electricalFieldEvidence,
        );
      }
      const mergedFieldConfidence = {
        ...(parsed.fieldConfidence || {}),
        ...(focused.fieldConfidence || {}),
      };
      for (const [field, selected] of Object.entries(
        mergedMeasurements.provenance,
      )) {
        mergedFieldConfidence[field] = Number(selected.confidence) || 0;
        if (process.env.NODE_ENV !== "production") {
          console.debug("[plan measurement merge]", {
            field,
            candidates: [
              selected,
              ...(Array.isArray(selected.alternatives)
                ? selected.alternatives
                : []),
            ].map((candidate) => ({
              value: candidate.value,
              source: candidate.source,
              confidence: candidate.confidence,
              directEvidence: candidate.directEvidence,
            })),
            selected: {
              value: selected.value,
              source: selected.source,
            },
            conflict: mergedMeasurements.conflicts.some(
              (conflict) => conflict.field === field,
            ),
          });
        }
      }
      measurementProvenance = mergedMeasurements.provenance;
      measurementConflicts = mergedMeasurements.conflicts;
      parsed = {
        ...parsed,
        measurements: mergedMeasurements.measurements,
        planFacts: {
          ...(parsed.planFacts || {}),
          ...(focused.planFacts || {}),
          ceilingBoundary: {
            ...(parsed.planFacts?.ceilingBoundary || {}),
            ...(focused.planFacts?.ceilingBoundary || {}),
            fieldEvidence: {
              ...(parsed.planFacts?.ceilingBoundary?.fieldEvidence || {}),
              ...(focused.planFacts?.ceilingBoundary?.fieldEvidence || {}),
            },
          },
          elevationFaces: preferElevationFacesWithOpenings(
            parsed.planFacts?.elevationFaces,
            focused.planFacts?.elevationFaces,
          ),
          fieldEvidence: {
            ...(parsed.planFacts?.fieldEvidence || {}),
            ...(focused.planFacts?.fieldEvidence || {}),
          },
        },
        fieldConfidence: {
          ...mergedFieldConfidence,
        },
        measurementProvenance,
        measurementConflicts,
        explicitlyLabeled: [
          ...normalizedStringList(parsed.explicitlyLabeled),
          ...normalizedStringList(focused.explicitlyLabeled),
        ],
        geometryDerived: [
          ...normalizedStringList(parsed.geometryDerived),
          ...normalizedStringList(focused.geometryDerived),
        ],
        inferredKeys: [
          ...normalizedStringList(parsed.inferredKeys),
          ...normalizedStringList(focused.inferredKeys),
        ],
        unreadableFields: [
          ...normalizedObjectList(parsed.unreadableFields),
          ...normalizedObjectList(focused.unreadableFields),
        ],
        ...(plumbingSelected
          ? {
              fieldEvidence: plumbingFieldEvidence,
              fixtureInventory: plumbingFixtureInventory,
              utilityConnections: plumbingUtilityConnections,
              complexityFactors: plumbingComplexityFactors,
              waterHeaterDetail: plumbingWaterHeaterDetail,
              gasApplianceScope: plumbingGasApplianceScope,
            }
          : {}),
      };
    } catch (err) {
      console.warn(
        "Focused trade takeoff pass returned invalid JSON:",
        err?.message || err,
      );
    }
  }

  if (plumbingSelected) {
    const mergedPdfSchedule = mergePlumbingPdfFixtureSchedule({
      pdfTakeoff,
      fixtureInventory: plumbingFixtureInventory,
      fieldEvidence: plumbingFieldEvidence,
    });
    plumbingFixtureInventory = mergedPdfSchedule.fixtureInventory;
    plumbingFieldEvidence = mergedPdfSchedule.fieldEvidence;
    const finalized = finalizePlumbingTakeoff({
      fixtureInventory: plumbingFixtureInventory,
      measurements: parsed.measurements,
      fieldEvidence: plumbingFieldEvidence,
      fieldConfidence: parsed.fieldConfidence,
      geometryDerived: parsed.geometryDerived,
      inferredKeys: parsed.inferredKeys,
      utilityConnections: plumbingUtilityConnections,
      complexityFactors: plumbingComplexityFactors,
      plumbingRelevantPages: pdfTakeoff?.plumbingRelevantPages || [],
      pdfTakeoff,
      waterHeaterDetail: plumbingWaterHeaterDetail || parsed.waterHeaterDetail,
      gasApplianceScope: plumbingGasApplianceScope || parsed.gasApplianceScope,
    });
    parsed.measurements = finalized.measurements;
    parsed.fieldEvidence = finalized.fieldEvidence;
    parsed.fieldConfidence = finalized.fieldConfidence;
    parsed.geometryDerived = finalized.geometryDerived;
    parsed.inferredKeys = finalized.inferredKeys;
    plumbingFixtureInventory = finalized.fixtureInventory;
    plumbingFieldEvidence = finalized.fieldEvidence;
    plumbingReviewStatus = finalized.plumbingReviewStatus;
    plumbingWaterHeaterDetail = finalized.waterHeaterDetail;
    plumbingGasApplianceScope = finalized.gasApplianceScope;
  }

  if (electricalSelected && !electricalEvidenceMerged) {
    const mergedMeasurements = mergeElectricalEvidenceSources({
      generalMeasurements: parsed.measurements,
      generalConfidence: parsed.fieldConfidence,
      instanceTagMeasurements: electricalTagMeasurements,
    });
    measurementProvenance = {
      ...measurementProvenance,
      ...mergedMeasurements.provenance,
    };
    measurementConflicts = mergedMeasurements.conflicts;
    parsed.measurements = mergedMeasurements.measurements;
  }

  if (hvacSelected && !hvacEvidenceMerged) {
    const mergedMeasurements = mergeElectricalEvidenceSources({
      generalMeasurements: parsed.measurements,
      generalConfidence: parsed.fieldConfidence,
      instanceTagMeasurements: hvacTagMeasurements,
    });
    measurementProvenance = {
      ...measurementProvenance,
      ...mergedMeasurements.provenance,
    };
    measurementConflicts = mergedMeasurements.conflicts;
    parsed.measurements = mergedMeasurements.measurements;
  }

  if (electricalSelected) {
    logElectricalTakeoffStage("RAW ELECTRICAL VISION EXTRACTION", {
      merged: electricalDebugSnapshot(parsed.measurements),
      mergedAliases: electricalishMeasurementKeys(parsed.measurements),
      general: generalElectricalVision,
      generalAliases: electricalishMeasurementKeys(
        generalElectricalVisionSource,
      ),
      focused: focusedElectricalVision,
      focusedAliases: electricalishMeasurementKeys(
        focusedElectricalVisionSource,
      ),
      instanceTags: electricalTagMeasurements,
      unreadableFields: (parsed.unreadableFields || []).slice(0, 20),
    });
    const omitted = omitUnresolvedElectricalConflicts(
      parsed.measurements,
      measurementConflicts,
    );
    parsed.measurements = omitted.measurements;
    const unclassified = collectUnclassifiedElectricalFixtures({
      measurements: parsed.measurements,
      pdfTakeoff,
      unreadableFields: parsed.unreadableFields,
    });
    parsed.measurements = unclassified.measurements;
    parsed.unreadableFields = unclassified.unreadableFields;
  }

  const imageQuality = sanitizeImageQuality(parsed?.imageQuality);
  const unreadableFields = sanitizeUnreadableFields(parsed?.unreadableFields);
  const scope =
    scopeResult && scopeResult.success
      ? { scopeText: scopeResult.scopeText, detections: scopeResult.detections }
      : null;
  const failurePayload = (reason) => ({
    success: false,
    reason,
    imageQuality,
    rooms: [],
    measurements: {},
    fieldConfidence: {},
    lowConfidence: [],
    unreadableFields,
    buildingAreas: {},
    planFacts: { buildingAreas: {}, fieldEvidence: {} },
    areaReconciliation: null,
    itemQuantities: {},
    assumptions: [],
    notesBlock: "",
    // Scope reads labels/callouts, not dimension strings — it can survive an
    // unreadable-numbers failure and still be worth confirming.
    scope,
  });

  const pdfRoomsEarly = sanitizeRooms(pdfTakeoff?.rooms || []);
  const pdfHasTakeoff =
    pdfRoomsEarly.length >= 3 ||
    Object.keys(pdfTakeoff?.buildingAreas || {}).length > 0;

  // Vision may fail on weird renders; PDF text takeoff can still succeed.
  if (imageQuality === "unreadable" && !pdfHasTakeoff) {
    return failurePayload(UNCLEAR_PLAN_REASON);
  }

  if (parsed?.success === false && !pdfHasTakeoff) {
    return failurePayload(
      parsed.reason || "Image does not look like a floor plan or blueprint.",
    );
  }

  const visionRooms = pruneEnvelopeGarageRooms(sanitizeRooms(parsed?.rooms));
  const pdfRooms = pdfRoomsEarly;
  const rooms =
    pdfRooms.length >= 3
      ? mergeRoomsPreferPdf(pdfRooms, visionRooms)
      : pruneEnvelopeGarageRooms(visionRooms);

  const buildingAreas = sanitizeBuildingAreas({
    ...(parsed.buildingAreas || {}),
    ...(pdfTakeoff?.buildingAreas || {}),
  });
  const pdfPlanFacts = pdfTakeoff?.planFacts || {};
  const visionPlanFacts = parsed.planFacts || {};
  const planFacts = sanitizePlanFacts(
    {
      ...visionPlanFacts,
      ...pdfPlanFacts,
      ceilingBoundary: {
        ...(visionPlanFacts.ceilingBoundary || {}),
        ...(pdfPlanFacts.ceilingBoundary || {}),
        fieldEvidence: {
          ...(visionPlanFacts.ceilingBoundary?.fieldEvidence || {}),
          ...(pdfPlanFacts.ceilingBoundary?.fieldEvidence || {}),
        },
      },
      geometry: visionPlanFacts.geometry,
      warnings: [
        ...(visionPlanFacts.warnings || []),
        ...(pdfPlanFacts.warnings || []),
      ],
      fieldEvidence: {
        ...(visionPlanFacts.fieldEvidence || {}),
        ...(pdfPlanFacts.fieldEvidence || {}),
      },
    },
    buildingAreas,
  );
  const fieldConfidence = sanitizeFieldConfidence(parsed.fieldConfidence);
  // PDF schedule totals are authoritative — mark high confidence so they are kept.
  if (pdfTakeoff?.buildingAreas?.totalLivingSqft != null)
    fieldConfidence.floorAreaSqft = 1;
  if (pdfTakeoff?.buildingAreas?.garageSqft != null)
    fieldConfidence.garageSqft = 1;
  if (
    pdfTakeoff?.buildingAreas?.coveredPatioSqft != null ||
    pdfTakeoff?.buildingAreas?.roofDeckSqft != null
  ) {
    fieldConfidence.deckSqft = 1;
  }

  let rawMeasurements = sanitizeMeasurements(
    parsed.measurements,
    rooms,
    buildingAreas,
    parsed.explicitlyLabeled,
  );
  if (plumbingSelected) {
    rawMeasurements = normalizePlumbingPlanMeasurements(parsed.measurements);
  }
  if (hvacSelected) {
    const normalized = {};
    for (const key of [
      "hvacSystemCount",
      "hvacSystemTons",
      "hvacServiceCallCount",
      "hvacEquipmentReplacementCount",
      "hvacRefrigerantCount",
      "hvacThermostatCount",
      "hvacDuctworkLf",
      "hvacSupplyRegisterCount",
      "hvacReturnGrilleCount",
      "hvacVentilationCount",
      "hvacPermitCount",
      "hvacCleanupCount",
    ]) {
      const value = positive(parsed.measurements?.[key]);
      if (value != null) normalized[key] = value;
    }
    rawMeasurements = normalized;
  }
  if (drywallSelected) {
    const drywallSupportedKeys = [
      ...(Array.isArray(parsed.explicitlyLabeled)
        ? parsed.explicitlyLabeled
        : []),
      ...(Array.isArray(parsed.geometryDerived) ? parsed.geometryDerived : []),
    ];
    rawMeasurements = {
      ...rawMeasurements,
      ...normalizeDrywallPlanMeasurements(
        parsed.measurements,
        drywallSupportedKeys,
      ),
    };
    const drywallDerived = deriveDrywallGeometryMeasurements(
      rawMeasurements,
      rooms,
      planFacts,
      {
        buildingAreas,
        rawPlanFacts: visionPlanFacts,
      },
    );
    rawMeasurements = drywallDerived.measurements;
    parsed.geometryDerived = [
      ...(Array.isArray(parsed.geometryDerived) ? parsed.geometryDerived : []),
      ...drywallDerived.derivedKeys,
    ];
    parsed.assumptions = [
      ...(Array.isArray(parsed.assumptions) ? parsed.assumptions : []),
      ...drywallDerived.assumptions,
    ];
    for (const key of drywallDerived.derivedKeys) {
      fieldConfidence[key] = Math.max(Number(fieldConfidence[key] || 0), 0.75);
      const isPlanningEstimate =
        Array.isArray(drywallDerived.planningEstimateKeys) &&
        drywallDerived.planningEstimateKeys.includes(key);
      measurementProvenance[key] = isPlanningEstimate
        ? {
            value: rawMeasurements[key],
            source: "planning_estimate",
            normalizedSource: "NEEDS_CONFIRMATION",
            pricingEligible: false,
            reason:
              "Readable room geometry did not cover a complete house takeoff; confirm this planning split before pricing.",
          }
        : {
            value: rawMeasurements[key],
            source: "measured_from_geometry",
            normalizedSource: "FROM_PLAN",
          };
    }
  }
  if (electricalSelected) {
    logElectricalTakeoffStage(
      "AFTER SANITIZE",
      electricalDebugSnapshot(rawMeasurements),
    );
  }
  const paintingKeys = [
    "wallPaintSqft",
    "ceilingPaintSqft",
    "paintAreaSqft",
    "interiorDoorCount",
    "baseboardLf",
    "cabinetRunLf",
    "cabinetPaintSqft",
    "exteriorPaintSqft",
  ];
  const paintingKeysFrom = (map) =>
    Object.fromEntries(
      paintingKeys
        .filter((key) => positive(map?.[key]) > 0)
        .map((key) => [key, map[key]]),
    );
  if (process.env.NODE_ENV !== "production" && paintingSelected) {
    console.debug("[painting plan extract]", {
      visionBeforeSanitize: paintingKeysFrom(parsed.measurements),
      explicitlyLabeled: parsed.explicitlyLabeled || [],
      geometryDerived: parsed.geometryDerived || [],
      afterSanitize: paintingKeysFrom(rawMeasurements),
      roomCount: rooms.length,
      wallHeightFt: planFacts.wallHeightFt || null,
      plateHeightFt: planFacts.plateHeightFt || null,
      paintingRelevantPages: pdfTakeoff?.paintingRelevantPages || [],
    });
  }
  const elevationDerived = deriveStuccoElevationMeasurements(
    rawMeasurements,
    parsed.planFacts,
  );
  rawMeasurements = elevationDerived.measurements;
  for (const key of elevationDerived.derivedKeys) {
    fieldConfidence[key] = Math.max(Number(fieldConfidence[key] || 0), 0.75);
  }
  if (insulationSelected) {
    const insulationPlanFacts = {
      ...planFacts,
      elevationFaces: preferElevationFacesWithOpenings(
        planFacts?.elevationFaces,
        parsed.planFacts?.elevationFaces,
      ),
    };
    const insulationDerived = deriveInsulationMeasurementsFromPlanFacts(
      rawMeasurements,
      insulationPlanFacts,
    );
    rawMeasurements = insulationDerived.measurements;
    parsed.geometryDerived = [
      ...(Array.isArray(parsed.geometryDerived) ? parsed.geometryDerived : []),
      ...insulationDerived.derivedKeys,
    ];
    parsed.assumptions = [
      ...(Array.isArray(parsed.assumptions) ? parsed.assumptions : []),
      ...insulationDerived.assumptions,
    ];
    for (const key of insulationDerived.derivedKeys) {
      fieldConfidence[key] = Math.max(Number(fieldConfidence[key] || 0), 0.75);
      measurementProvenance[key] = {
        value: rawMeasurements[key],
        source: "calculated_from_plan_facts",
        normalizedSource: "NEEDS_REVIEW",
      };
    }
  }
  if (framingSelected) {
    const finalized = finalizeFramingTakeoff({
      measurements: rawMeasurements,
      fieldEvidence: parsed.fieldEvidence,
      fieldConfidence,
      inferredKeys: parsed.inferredKeys,
    });
    rawMeasurements = finalized.measurements;
    parsed.framingScope = finalized.framingScope;
    parsed.fieldEvidence = finalized.fieldEvidence;
    for (const key of finalized.derivedKeys) {
      fieldConfidence[key] = Math.max(
        Number(fieldConfidence[key] || 0),
        Number(finalized.fieldConfidence[key] || 0.72),
      );
      measurementProvenance[key] = {
        value: rawMeasurements[key],
        source: "calculated_from_components",
        normalizedSource: "PLANNING_ESTIMATE",
      };
    }
  }
  if (paintingSelected) {
    const paintingDerived = derivePaintingGeometryMeasurements(
      rawMeasurements,
      rooms,
      planFacts,
      {
        rawVisionMeasurements: parsed.measurements,
        explicitlyLabeled: parsed.explicitlyLabeled,
        geometryDerived: parsed.geometryDerived,
        buildingAreas,
        rawPlanFacts: visionPlanFacts,
      },
    );
    rawMeasurements = paintingDerived.measurements;
    for (const key of paintingDerived.derivedKeys) {
      const incomplete = (paintingDerived.incompleteKeys || []).includes(key);
      fieldConfidence[key] = Math.max(
        Number(fieldConfidence[key] || 0),
        incomplete ? 0.55 : 0.75,
      );
      measurementProvenance[key] = {
        value: rawMeasurements[key],
        source: "measured_from_geometry",
        normalizedSource: incomplete ? "NEEDS_REVIEW" : "FROM_PLAN",
        ...(incomplete ? { coverage: "incomplete" } : {}),
      };
    }
    for (const key of paintingDerived.explicitKeys) {
      measurementProvenance[key] = {
        value: rawMeasurements[key],
        source: "detected_from_plan",
        normalizedSource: "FROM_PLAN",
      };
    }
    if (paintingDerived.assumptions.length) {
      parsed.assumptions = [
        ...(Array.isArray(parsed.assumptions) ? parsed.assumptions : []),
        ...paintingDerived.assumptions,
      ];
    }
    if (process.env.NODE_ENV !== "production") {
      console.debug("[painting plan extract]", {
        afterGeometryDerive: paintingKeysFrom(rawMeasurements),
        derivedKeys: paintingDerived.derivedKeys,
      });
    }
    if (pdfTakeoff?.paintingRelevantPages?.length) {
      parsed.assumptions = [
        ...(Array.isArray(parsed.assumptions) ? parsed.assumptions : []),
        `Painting-relevant pages: ${pdfTakeoff.paintingRelevantPages
          .slice(0, 8)
          .map(
            (page) =>
              `${page.page} (${(page.reasons || []).join(", ") || "plan"})`,
          )
          .join("; ")}`,
      ];
    }
  }
  const electricalTakeoff = applyElectricalVisionTakeoff({
    measurements: rawMeasurements,
    explicitlyLabeled: parsed.explicitlyLabeled,
    geometryDerived: parsed.geometryDerived,
    inferredKeys: parsed.inferredKeys,
    instanceTagKeys: Object.keys(electricalTagMeasurements || {}),
    methodsAgreeKeys: Object.entries(measurementProvenance || {})
      .filter(([, entry]) => entry?.methodsAgree)
      .map(([key]) => key),
    independentVisionAgreementKeys: Object.entries(measurementProvenance || {})
      .filter(([, entry]) => entry?.independentVisionAgreement)
      .map(([key]) => key),
    electricalSheetEvidence: parsed.electricalSheetEvidence,
    electricalRelevantPages: pdfTakeoff?.electricalRelevantPages || [],
    electricalRenderedPages: electricalSheetImages,
    measurementConflicts,
    unreadableFields: parsed.unreadableFields,
    electricalFieldEvidence: parsed.electricalFieldEvidence,
    electricalSelected,
  });
  rawMeasurements = electricalTakeoff.measurements;
  electricalValidation = electricalTakeoff.electricalValidation || null;
  measurementProvenance = {
    ...measurementProvenance,
    ...Object.fromEntries(
      Object.entries(electricalTakeoff.provenance || {}).map(([key, entry]) => [
        key,
        {
          ...(measurementProvenance[key] || {}),
          ...entry,
          alternatives: measurementProvenance[key]?.alternatives,
        },
      ]),
    ),
  };
  if (plumbingSelected) {
    const inferredKeys = new Set(
      Array.isArray(parsed.inferredKeys) ? parsed.inferredKeys : [],
    );
    const fieldEvidence = mergePlumbingFieldEvidence(
      plumbingFieldEvidence,
      parsed.fieldEvidence,
      parsed.planFacts?.fieldEvidence,
    );
    plumbingFieldEvidence = fieldEvidence;
    measurementProvenance = {
      ...measurementProvenance,
      ...Object.fromEntries(
        Object.entries(rawMeasurements).map(([key, value]) => [
          key,
          (() => {
            const evidence = fieldEvidence[key] || [];
            const derived =
              evidence.some(
                (entry) =>
                  Array.isArray(entry?.derivedFrom) &&
                  entry.derivedFrom.length > 0,
              ) ||
              evidence.some(
                (entry) => entry?.evidenceKind === "fixture_inventory_derived",
              );
            return {
              ...(measurementProvenance[key] || {}),
              value,
              source: derived
                ? "inferred_from_fixture_inventory"
                : "detected_from_plan",
              normalizedSource: derived ? "FROM_PLAN_DERIVED" : "FROM_PLAN",
              evidence,
              evidenceKind: derived
                ? "fixture_inventory_derived"
                : evidence[0]?.evidenceKind || "explicit_label",
              ...(derived
                ? {
                    derivedFrom: [
                      ...new Set(
                        evidence.flatMap((entry) =>
                          Array.isArray(entry?.derivedFrom)
                            ? entry.derivedFrom
                            : [],
                        ),
                      ),
                    ].slice(0, 12),
                  }
                : {}),
              pricingEligible: !inferredKeys.has(key),
            };
          })(),
        ]),
      ),
    };
    parsed.fieldEvidence = fieldEvidence;
    plumbingUtilityConnections = normalizePlumbingUtilityConnections([
      ...plumbingUtilityConnections,
      ...(parsed.utilityConnections || []),
    ]);
    plumbingComplexityFactors = normalizePlumbingComplexityFactors([
      ...plumbingComplexityFactors,
      ...(parsed.complexityFactors || []),
    ]);
  }
  if (electricalSelected) {
    logElectricalTakeoffStage(
      "AFTER electricalPlanConvergence",
      electricalDebugSnapshot(rawMeasurements),
    );
  }
  if (electricalSelected && pdfTakeoff?.electricalRelevantPages?.length) {
    parsed.assumptions = [
      ...(Array.isArray(parsed.assumptions) ? parsed.assumptions : []),
      `Electrical-relevant pages: ${pdfTakeoff.electricalRelevantPages
        .slice(0, 8)
        .map(
          (page) =>
            `${page.page} (${(page.reasons || []).join(", ") || "electrical plan"})`,
        )
        .join("; ")}`,
    ];
  }
  if (plumbingSelected && pdfTakeoff?.plumbingRelevantPages?.length) {
    parsed.assumptions = [
      ...(Array.isArray(parsed.assumptions) ? parsed.assumptions : []),
      `Plumbing-relevant pages: ${pdfTakeoff.plumbingRelevantPages
        .slice(0, 8)
        .map(
          (page) =>
            `${page.page} (${(page.reasons || []).join(", ") || "plumbing plan"})`,
        )
        .join("; ")}`,
    ];
  }
  const instanceTagAssumption = Object.entries(electricalTagMeasurements || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  if (electricalSelected && instanceTagAssumption) {
    parsed.assumptions = [
      ...(Array.isArray(parsed.assumptions) ? parsed.assumptions : []),
      `Electrical instance tags from PDF text: ${instanceTagAssumption}`,
    ];
  }
  const hvacTagAssumption = Object.entries(hvacTagMeasurements || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  if (hvacSelected && hvacTagAssumption) {
    parsed.assumptions = [
      ...(Array.isArray(parsed.assumptions) ? parsed.assumptions : []),
      `HVAC PDF text reads: ${hvacTagAssumption}`,
    ];
  }
  rawMeasurements = reconcileBathroomMeasurement(
    rawMeasurements,
    rooms,
    unreadableFields,
  );
  let { measurements, lowConfidence } = applyConfidenceFloor(
    rawMeasurements,
    fieldConfidence,
  );
  if (hvacSelected) {
    const {
      applyHvacProvenanceGuard,
      restoreHvacLowConfidenceMeasurements,
    } = require("./hvacPlanAdapter");
    measurements = restoreHvacLowConfidenceMeasurements(
      measurements,
      lowConfidence,
    );
    const guarded = applyHvacProvenanceGuard({
      measurements,
      measurementProvenance,
      pdfTakeoff,
    });
    measurements = guarded.measurements;
    measurementProvenance = guarded.measurementProvenance;
    lowConfidence = (lowConfidence || []).filter(
      (entry) => String(entry?.field || "").trim() !== "hvacVentilationCount",
    );
  }
  const assumptions = [
    ...(Array.isArray(pdfTakeoff?.assumptions) ? pdfTakeoff.assumptions : []),
    ...(Array.isArray(parsed.assumptions)
      ? parsed.assumptions.map((a) => String(a).slice(0, 200))
      : []),
  ]
    .map((a) => String(a).slice(0, 200))
    .filter(Boolean)
    .slice(0, 16);
  let notesBlock = formatNotesBlock({
    notesBlock: parsed.notesBlock,
    rooms,
    measurements,
    buildingAreas,
  });
  if (scope?.scopeText) {
    const { appendScopeTextToNotesBlock } = require("./estimatePlanToScope");
    notesBlock = appendScopeTextToNotesBlock(notesBlock, scope.scopeText);
  }

  if (
    !Object.keys(measurements).length &&
    !rooms.length &&
    !Object.keys(buildingAreas).length
  ) {
    const onlyLowConfidence =
      lowConfidence.length > 0 || unreadableFields.length > 0;
    const failure = failurePayload(
      onlyLowConfidence
        ? UNCLEAR_PLAN_REASON
        : parsed.reason || "No readable dimensions found on the plan.",
    );
    failure.lowConfidence = lowConfidence;
    failure.assumptions = assumptions;
    return failure;
  }

  let areaReconciliation = null;
  try {
    const {
      measurementSemanticsV1Enabled,
      buildAreaReconciliation,
    } = require("./measurementSemantics");
    if (measurementSemanticsV1Enabled()) {
      areaReconciliation = buildAreaReconciliation({
        declaredLivingSf:
          measurements.floorAreaSqft ?? buildingAreas?.totalLivingSqft,
        declaredGarageSf: measurements.garageSqft ?? buildingAreas?.garageSqft,
        patioDeckSf:
          measurements.deckSqft ??
          buildingAreas?.coveredPatioSqft ??
          buildingAreas?.coveredOutdoorSqft,
        rooms,
      });
    }
  } catch {
    areaReconciliation = null;
  }
  areaReconciliation = reconcileLabeledLivingAreas(
    buildingAreas,
    areaReconciliation,
  );
  let tradeMeasurementInput = { ...measurements };
  if (
    planSelection.mode === "selected_trade" &&
    planSelection.trade?.key === "roofing"
  ) {
    if (!tradeMeasurementInput.roofPitch && planFacts?.roofPitch) {
      tradeMeasurementInput.roofPitch = String(planFacts.roofPitch);
      measurementProvenance.roofPitch = {
        value: tradeMeasurementInput.roofPitch,
        source: "plan_facts",
        normalizedSource: "FROM_PLAN",
      };
    }
    if (
      !(positive(tradeMeasurementInput.storyCount) > 0) &&
      positive(planFacts?.storyCount)
    ) {
      tradeMeasurementInput.storyCount = positive(planFacts.storyCount);
      measurementProvenance.storyCount = {
        value: tradeMeasurementInput.storyCount,
        source: "plan_facts",
        normalizedSource: "FROM_PLAN",
      };
    }
  }
  if (
    planSelection.mode === "selected_trade" &&
    planSelection.trade?.key === "stucco"
  ) {
    if (
      !(positive(tradeMeasurementInput.stuccoStories) > 0) &&
      positive(planFacts?.storyCount)
    ) {
      tradeMeasurementInput.stuccoStories = positive(planFacts.storyCount);
    }
    const planStories =
      positive(tradeMeasurementInput.stuccoStories) ||
      positive(planFacts?.storyCount);
    let wallHeightCandidate = positive(planFacts?.wallHeightFt);
    let plateHeightCandidate = positive(planFacts?.plateHeightFt);
    // Cumulative upper-plate elevations (e.g. Lot 58 TOP OF PLATE 20.5') are not
    // per-story wall height. Prefer a true per-story plate/wall, else divide.
    if (planStories > 1 && plateHeightCandidate > 14) {
      plateHeightCandidate =
        Math.round((plateHeightCandidate / planStories) * 10) / 10;
    }
    if (planStories > 1 && wallHeightCandidate > 14) {
      wallHeightCandidate =
        Math.round((wallHeightCandidate / planStories) * 10) / 10;
    }
    const perStoryHeight = wallHeightCandidate || plateHeightCandidate;
    if (
      planStories > 1 &&
      positive(tradeMeasurementInput.stuccoWallHeightFt) > 14 &&
      perStoryHeight
    ) {
      tradeMeasurementInput.stuccoWallHeightFt = perStoryHeight;
    }
    if (
      !(positive(tradeMeasurementInput.stuccoWallHeightFt) > 0) &&
      perStoryHeight
    ) {
      tradeMeasurementInput.stuccoWallHeightFt = perStoryHeight;
    }
    const perimeterLf =
      positive(planFacts?.exteriorPerimeterLf) ||
      positive(planFacts?.foundationPerimeterLf);
    const perimeterSource = positive(planFacts?.exteriorPerimeterLf)
      ? "labeled exterior perimeter"
      : "labeled foundation envelope perimeter used as an exterior proxy";
    const wallHeightFt = positive(tradeMeasurementInput.stuccoWallHeightFt);
    const stories = positive(tradeMeasurementInput.stuccoStories);
    const derivedGross =
      perimeterLf && wallHeightFt && stories
        ? Math.round(perimeterLf * wallHeightFt * stories)
        : null;
    const existingGross = positive(tradeMeasurementInput.stuccoGrossWallSqft);
    // Perimeter × height × stories is the planning takeoff for SHV-style plans.
    // Prefer it when vision/planning gross is missing or looks single-story-low.
    if (
      derivedGross &&
      (!existingGross || existingGross < derivedGross * 0.7)
    ) {
      tradeMeasurementInput.stuccoGrossWallSqft = derivedGross;
      fieldConfidence.stuccoGrossWallSqft = 0.8;
      assumptions.push(
        `Gross stucco wall area derived from ${perimeterSource} (${perimeterLf} LF), wall/plate height (${wallHeightFt} FT), and stories (${stories}); verify upper-floor setbacks and openings.`,
      );
      // Force net recalculation from the corrected gross.
      delete tradeMeasurementInput.stuccoNetWallSqft;
    }
    const grossWallSqft = positive(tradeMeasurementInput.stuccoGrossWallSqft);
    const deductions = [
      positive(tradeMeasurementInput.stuccoWindowDoorOpeningSqft),
      positive(tradeMeasurementInput.stuccoGarageOpeningSqft),
      positive(tradeMeasurementInput.stuccoOtherFinishDeductionSqft),
    ];
    const hasAnyOpeningDeduction =
      positive(tradeMeasurementInput.stuccoWindowDoorOpeningSqft) != null ||
      positive(tradeMeasurementInput.stuccoGarageOpeningSqft) != null ||
      positive(tradeMeasurementInput.stuccoOtherFinishDeductionSqft) != null;
    if (
      !(positive(tradeMeasurementInput.stuccoNetWallSqft) > 0) &&
      grossWallSqft &&
      hasAnyOpeningDeduction
    ) {
      // Only publish net once at least one opening/finish deduction was read.
      // Otherwise net===gross looks "confirmed" while openings are still blank.
      const knownDeductions = deductions.reduce(
        (sum, value) => sum + (value || 0),
        0,
      );
      tradeMeasurementInput.stuccoNetWallSqft = Math.max(
        0,
        Math.round((grossWallSqft - knownDeductions) * 10) / 10,
      );
      fieldConfidence.stuccoNetWallSqft = deductions.every(
        (value) => value != null,
      )
        ? 0.7
        : 0.65;
    }
    if (positive(tradeMeasurementInput.stuccoGrossWallSqft)) {
      notesBlock +=
        `\n\nStucco takeoff: gross wall area ${tradeMeasurementInput.stuccoGrossWallSqft.toLocaleString()} SF` +
        (positive(tradeMeasurementInput.stuccoNetWallSqft)
          ? `; calculated net stucco area ${tradeMeasurementInput.stuccoNetWallSqft.toLocaleString()} SF.`
          : "; opening deductions still need confirmation.");
    }
  }
  if (insulationSelected) {
    const insulationPlanFacts = {
      ...planFacts,
      elevationFaces: preferElevationFacesWithOpenings(
        planFacts?.elevationFaces,
        parsed.planFacts?.elevationFaces,
      ),
    };
    // Confidence filtering can remove a readable-but-low-confidence opening
    // deduction from measurements. Keep it as a review-only calculation input
    // so a gross wall quantity is not returned as net insulation SF.
    if (!(positive(tradeMeasurementInput.openingDeductionSqft) > 0)) {
      const lowConfidenceOpening = (lowConfidence || []).find(
        (entry) =>
          /opening|window|door/i.test(String(entry?.field || "")) &&
          positive(entry?.value) > 0,
      );
      if (lowConfidenceOpening) {
        tradeMeasurementInput.openingDeductionSqft = positive(
          lowConfidenceOpening.value,
        );
      }
    }
    const insulationDerived = deriveInsulationMeasurementsFromPlanFacts(
      tradeMeasurementInput,
      insulationPlanFacts,
    );
    const insulationValidated = validateInsulationMeasurementsAgainstPlanFacts(
      insulationDerived.measurements,
      insulationPlanFacts,
    );
    tradeMeasurementInput = insulationValidated.measurements;
    for (const [key, value] of Object.entries(
      insulationValidated.measurements,
    )) {
      if (positive(value) > 0) tradeMeasurementInput[key] = value;
    }
    for (const key of insulationValidated.invalidKeys) {
      if (!parsed.unreadableFields?.some((entry) => entry?.field === key)) {
        parsed.unreadableFields = [
          ...(parsed.unreadableFields || []),
          {
            field: key,
            reason:
              "AI quantity did not match complete plan evidence; review required",
          },
        ];
      }
    }
    for (const key of insulationDerived.derivedKeys) {
      fieldConfidence[key] = Math.max(Number(fieldConfidence[key] || 0), 0.75);
      measurementProvenance[key] = {
        value: tradeMeasurementInput[key],
        source: "calculated_from_plan_facts",
        normalizedSource: "NEEDS_REVIEW",
      };
    }
    assumptions.push(...insulationDerived.assumptions);
    if (positive(tradeMeasurementInput.openingDeductionSqft)) {
      notesBlock += `\n\nInsulation takeoff: exterior opening deduction ${tradeMeasurementInput.openingDeductionSqft.toLocaleString()} SF from readable elevation openings.`;
    }
    if (positive(tradeMeasurementInput.exteriorWallInsulationSqft)) {
      notesBlock += `\n\nInsulation takeoff: exterior wall insulation ${tradeMeasurementInput.exteriorWallInsulationSqft.toLocaleString()} SF from readable plan geometry.`;
    }
  }
  const tradeMeasurements = filterPlanMeasurementsForTrade(
    tradeMeasurementInput,
    planSelection.mode,
    planSelection.trade,
  );
  const tradeScope = filterPlanScopesForTrade(
    scope,
    planSelection.mode,
    planSelection.trade,
  );
  const keepPaintingRooms =
    planSelection.mode === "selected_trade" &&
    planSelection.trade?.key === "painting";
  const tradeRooms =
    planSelection.mode === "selected_trade" && !keepPaintingRooms ? [] : rooms;
  if (paintingSelected && rooms.length) {
    planFacts.interiorRooms = rooms.slice(0, 80);
  }
  const tradeAreaReconciliation =
    planSelection.mode === "selected_trade" ? null : areaReconciliation;
  const tradeMissingInfo = [...(planSelection.trade?.missingInfo || [])];
  if (plumbingSelected && plumbingReviewStatus) {
    tradeMissingInfo.length = 0;
    tradeMissingInfo.push(
      ...plumbingReviewStatus.needsConfirmation,
      ...plumbingReviewStatus.notFound,
    );
  }
  if (
    planSelection.mode === "selected_trade" &&
    planSelection.trade?.key === "stucco"
  ) {
    if (!(positive(tradeMeasurementInput.stuccoGrossWallSqft) > 0)) {
      tradeMissingInfo.unshift(
        "Gross exterior wall area: no readable elevation-face or perimeter dimensions",
      );
    }
    if (
      !(positive(tradeMeasurementInput.stuccoWindowDoorOpeningSqft) > 0) &&
      !(positive(tradeMeasurementInput.stuccoGarageOpeningSqft) > 0)
    ) {
      tradeMissingInfo.unshift(
        "Opening deductions: no readable window, door, or garage opening dimensions",
      );
    }
  }
  if (paintingSelected) {
    if (!(positive(tradeMeasurementInput.wallPaintSqft) > 0)) {
      tradeMissingInfo.unshift(
        "Interior wall area: no labeled paint SF or dimensioned rooms with explicit wall/plate height",
      );
    }
    if (!(positive(tradeMeasurementInput.ceilingPaintSqft) > 0)) {
      tradeMissingInfo.unshift(
        "Ceiling area: no labeled ceiling finish SF or dimensioned interior rooms",
      );
    }
  }
  if (framingSelected) {
    if (!(positive(tradeMeasurementInput.framedAreaSqft) > 0)) {
      tradeMissingInfo.unshift(
        "Covered framed floor area: no readable living plus garage SF on the plan",
      );
    }
    if (!(positive(tradeMeasurementInput.sheathingSqft) > 0)) {
      tradeMissingInfo.unshift(
        "Sheathing / shear area: no readable wall sheathing SF or gross wall area",
      );
    }
  }
  if (insulationSelected) {
    const insulationMissing = [
      ["exteriorWallInsulationSqft", "Exterior wall insulation SF"],
      ["atticInsulationSqft", "Attic / ceiling insulation SF"],
      ["insulatedRoofDeckSqft", "Insulated roof-deck SF"],
      ["openingDeductionSqft", "Exterior opening deduction SF"],
      ["garageSeparationInsulationSqft", "Garage separation insulation SF"],
      ["floorInsulationSqft", "Floor insulation SF"],
    ];
    for (const [key, label] of insulationMissing) {
      if (!(positive(tradeMeasurementInput[key]) > 0)) {
        tradeMissingInfo.unshift(
          `${label}: no readable labeled quantity or complete dimensioned geometry`,
        );
      }
    }
  }
  if (drywallSelected) {
    if (!(positive(tradeMeasurementInput.drywallSqft) > 0)) {
      tradeMissingInfo.unshift(
        "Drywall surface: no readable wall/ceiling quantity or complete room dimensions with wall height",
      );
    }
    if (!(positive(tradeMeasurementInput.drywallWallSqft) > 0)) {
      tradeMissingInfo.unshift(
        "Drywall walls: no readable wall surface quantity or complete room perimeter geometry",
      );
    }
    if (!(positive(tradeMeasurementInput.drywallCeilingSqft) > 0)) {
      tradeMissingInfo.unshift(
        "Drywall ceilings: no readable ceiling surface quantity or complete room area geometry",
      );
    }
  }
  if (electricalSelected) {
    if (!(positive(tradeMeasurementInput.mainPanelCount) > 0)) {
      tradeMissingInfo.unshift(
        "Panel / service: no readable panel count or amperage callout",
      );
    }
    if (!(positive(tradeMeasurementInput.serviceAmperage) > 0)) {
      tradeMissingInfo.unshift(
        "Service size: no printed amperage callout — confirm 100A/125A/150A/200A",
      );
    }
    if (
      !(positive(tradeMeasurementInput.standardCircuitCount) > 0) &&
      !(positive(tradeMeasurementInput.dedicated20aCircuitCount) > 0)
    ) {
      tradeMissingInfo.unshift(
        "Homeruns / dedicated circuits: confirm from panel schedule — device symbols do not invent circuit counts",
      );
    }
  }
  if (hvacSelected) {
    if (
      !(positive(tradeMeasurementInput.hvacSystemCount) > 0) &&
      !(positive(tradeMeasurementInput.hvacSystemTons) > 0)
    ) {
      tradeMissingInfo.unshift(
        "HVAC system basis: no readable system count or labeled tonnage",
      );
    }
    if (!(positive(tradeMeasurementInput.hvacDuctworkLf) > 0)) {
      tradeMissingInfo.unshift(
        "Ductwork: no labeled ductwork LF — confirm distribution scope",
      );
    }
  }

  return {
    success: true,
    reason: null,
    imageQuality: imageQuality || (pdfRooms.length ? "good" : "partial"),
    rooms: tradeRooms,
    measurements: tradeMeasurements,
    fieldConfidence,
    measurementProvenance,
    ...(plumbingSelected
      ? {
          fieldEvidence: plumbingFieldEvidence,
          fixtureInventory: plumbingFixtureInventory,
          utilityConnections: plumbingUtilityConnections,
          complexityFactors: plumbingComplexityFactors,
          plumbingReviewStatus,
          waterHeaterDetail: plumbingWaterHeaterDetail,
          gasApplianceScope: plumbingGasApplianceScope,
        }
      : {}),
    measurementConflicts,
    electricalValidation,
    lowConfidence,
    unreadableFields,
    buildingAreas,
    planFacts,
    areaReconciliation: tradeAreaReconciliation,
    itemQuantities: buildItemQuantities(tradeMeasurements),
    assumptions,
    notesBlock,
    scope: tradeScope,
    estimatingMode: planSelection.mode,
    selectedTrade: planSelection.trade?.key || null,
    tradeProvenance: {
      source: "plan_import",
      mode: planSelection.mode,
      selectedTrade: planSelection.trade?.key || null,
      routerStatus: planSelection.trade?.status || null,
    },
    missingInfo: [...new Set(tradeMissingInfo)],
  };
}

/**
 * Pure merge helper for tests / mobile mirror.
 * Only fills empty measurement fields (does not overwrite user values).
 */
function mergePlanMeasurementsIntoExisting(
  current = {},
  extracted = {},
  { overwrite = false } = {},
) {
  const next = { ...current };
  let filled = 0;
  for (const [key, value] of Object.entries(extracted || {})) {
    if (!MEASUREMENT_KEYS.has(key)) continue;
    const v = positive(value);
    if (v == null) continue;
    const existing = positive(next[key]);
    if (existing != null && !overwrite) continue;
    next[key] = v;
    filled += 1;
  }
  return { measurements: next, filled };
}

module.exports = {
  analyzePlanForMeasurements,
  mergePlanNotesIntoJobNotes,
  mergePlanMeasurementsIntoExisting,
  mergePositiveMeasurementMaps,
  preferElevationFacesWithOpenings,
  mergeInsulationFocusedPayloads,
  deriveStuccoElevationMeasurements,
  deriveInsulationMeasurementsFromPlanFacts,
  validateInsulationMeasurementsAgainstPlanFacts,
  derivePaintingGeometryMeasurements,
  deriveDrywallGeometryMeasurements,
  sanitizeRooms,
  sanitizeMeasurements,
  sanitizeBuildingAreas,
  sanitizePlanFacts,
  sanitizeEvidence,
  sanitizeGeometry,
  reconcileLabeledLivingAreas,
  sanitizeFieldConfidence,
  sanitizeUnreadableFields,
  collectUnclassifiedElectricalFixtures,
  applyConfidenceFloor,
  buildItemQuantities,
  formatNotesBlock,
  mergeRoomsPreferPdf,
  pruneEnvelopeGarageRooms,
  reconcileBathroomMeasurement,
  normalizeDrywallPlanMeasurements,
  buildSystemPrompt,
  buildElectricalSystemPrompt,
  buildHvacSystemPrompt,
  mergeElectricalEvidenceSources,
  mergeElectricalSheetEvidence,
  mergeElectricalFieldEvidence,
  mergePlumbingFieldEvidence,
  MEASUREMENT_KEYS,
  LABELED_ONLY_KEYS,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_PDF_BYTES,
  MIN_FIELD_CONFIDENCE,
  UNCLEAR_PLAN_REASON,
};
