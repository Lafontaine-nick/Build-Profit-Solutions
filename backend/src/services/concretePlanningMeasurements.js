const {
  applyFoundationPlanningMeasurements,
  notesImplyExteriorFlatwork,
  notesImplyMixedConcreteJob,
  notesImplyStructuralFoundation,
  splitConcreteNoteSections,
} = require("./foundationPlanningMeasurements");

const FLATWORK_TYPE_PATTERNS = [
  { id: "driveways", re: /\bdriveway\b/i },
  { id: "sidewalks", re: /\bsidewalk\b/i },
  { id: "patios", re: /\bpatio\b/i },
  { id: "rv_pads", re: /\brv\s+pad\b/i },
  { id: "walkways", re: /\bwalkway\b/i },
];

const DEPTH_INCHES_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?|["″])/i;

const PER_TYPE_SQFT_KEYS = {
  driveways: "concreteDrivewaySqft",
  sidewalks: "concreteSidewalkSqft",
  patios: "concretePatioSqft",
  walkways: "concreteWalkwaySqft",
  rv_pads: "concreteRvPadSqft",
};

const DEFAULT_GRAVEL_BASE_DEPTH_INCHES = 4;
const DEFAULT_THICKENED_EDGE_WIDTH_INCHES = 12;
const DEFAULT_THICKENED_EDGE_DEPTH_INCHES = 8;
const DEFAULT_CONCRETE_PUMP_COUNT = 1;

const FLATWORK_TYPE_KEYWORDS = {
  driveways: "driveway",
  sidewalks: "sidewalk",
  patios: "patio",
  rv_pads: "rv\\s+pad",
  walkways: "walkway",
};

function positiveNumber(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function roundConcreteCy(value) {
  return Math.round(value * 100) / 100;
}

function computeCyFromAreaDepth(sqft, depthInches) {
  if (!(sqft > 0) || !(depthInches > 0)) return 0;
  return roundConcreteCy((sqft * (depthInches / 12)) / 27);
}

function computeThickenedEdgeCy(
  lf,
  widthInches = DEFAULT_THICKENED_EDGE_WIDTH_INCHES,
  depthInches = DEFAULT_THICKENED_EDGE_DEPTH_INCHES,
) {
  if (!(lf > 0) || !(widthInches > 0) || !(depthInches > 0)) return 0;
  return roundConcreteCy((lf * (widthInches / 12) * (depthInches / 12)) / 27);
}

function notesMentionGravelBase(notes) {
  return /\b(?:gravel\s+base|base\s+gravel|crushed\s+(?:rock|stone)\s+base|aggregate\s+base)\b/i.test(
    String(notes || ""),
  );
}

function notesMentionConcretePump(notes) {
  const blob = String(notes || "");
  return (
    /\b(?:pump\s+truck|concrete\s+pump|pump(?:ing)?\s+(?:truck|if\s+needed|may\s+be|might\s+be|required))\b/i.test(
      blob,
    ) || /\bmight\s+need\s+(?:a\s+)?pump\b/i.test(blob)
  );
}

function notesImplyConcreteFlatwork(notes) {
  const n = String(notes || "");
  if (!n.trim()) return false;
  if (notesImplyStructuralFoundation(n) && !notesImplyExteriorFlatwork(n)) {
    return false;
  }
  return (
    /\b(?:concrete|flat[\s-]?work|driveway|sidewalk|walkway|patio|pour\b)/i.test(n) ||
    notesImplyStructuralFoundation(n) ||
    (/\b\d{2,4}\s*(?:sq\.?\s*ft|sf)\b/i.test(n) &&
      /\b(?:\d\s*(?:inch|in)\b[^.]{0,20}thick|thickened\s+edge|rebar|broom\s+finish|gravel\s+base|dig\s+out)\b/i.test(
        n,
      ))
  );
}

function parseFlatworkThicknessInches(text) {
  const source = String(text || "");
  const thickMatch = source.match(
    /(\d[\d,]*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?|["″])\s*thick/i,
  );
  if (thickMatch) {
    const n = Number(String(thickMatch[1]).replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  const depthMatch = source.match(DEPTH_INCHES_RE);
  if (depthMatch) {
    const n = Number(String(depthMatch[1]).replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function parseThickenedEdgeLf(text) {
  const source = String(text || "");
  const patterns = [
    /(\d[\d,]*(?:\.\d+)?)\s*(?:ft|feet|foot|lf)\s+of\s+thickened\s+edge/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(?:ft|feet|foot|lf)\b[^.;]{0,40}\bthickened\s+edge/i,
    /\bthickened\s+edge\b[^.;]{0,40}(\d[\d,]*(?:\.\d+)?)\s*(?:ft|feet|foot|lf)\b/i,
    /(\d[\d,]*(?:\.\d+)?)\s*lf\s+thickened\s+edge/i,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const n = Number(String(match[1]).replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function resolveFlatworkExcavationDepthInches(
  slabThicknessInches,
  hasGravelBase,
  gravelDepthInches = DEFAULT_GRAVEL_BASE_DEPTH_INCHES,
) {
  const slab = slabThicknessInches > 0 ? slabThicknessInches : 4;
  if (!hasGravelBase) return slab;
  const gravel =
    gravelDepthInches > 0 ? gravelDepthInches : DEFAULT_GRAVEL_BASE_DEPTH_INCHES;
  return slab + gravel;
}

function inferConcreteScopeIds(notes, measurements = {}) {
  const blob = String(notes || "").toLowerCase();
  const ids = new Set();
  const areaByType =
    measurements.concreteAreaByType && typeof measurements.concreteAreaByType === "object"
      ? measurements.concreteAreaByType
      : {};

  for (const [typeId, area] of Object.entries(areaByType)) {
    if (positiveNumber(area)) ids.add(typeId);
  }

  const structuralOnly =
    notesImplyStructuralFoundation(blob) && !notesImplyExteriorFlatwork(blob);
  if (
    !structuralOnly &&
    (/\b(?:concrete\s+patio|flatwork|sidewalk|driveway|pour\b[^.]{0,40}\b(?:driveway|slab|patio|sidewalk|walkway))\b/.test(
      blob,
    ) ||
      (!/\b(?:house|garage|building|monolithic)\s+slab\b/.test(blob) &&
        /\bslab\b/.test(blob) &&
        positiveNumber(measurements.concreteSqft)) ||
      positiveNumber(measurements.concreteSqft))
  ) {
    ids.add("pour_flatwork");
    if (/\bdriveway\b/.test(blob)) ids.add("driveways");
    if (/\bsidewalk\b/.test(blob)) ids.add("sidewalks");
    if (/\bpatio\b/.test(blob)) ids.add("patios");
    if (/\brv\s+pad\b/.test(blob)) ids.add("rv_pads");
    if (/\bwalkway\b/.test(blob)) ids.add("walkways");
  }

  if (
    /\b(?:excavat(?:e|ion)|dig(?:ging)?|dig\s+out|trench(?:ing)?)\b/.test(blob) ||
    positiveNumber(measurements.excavationCy)
  ) {
    ids.add("excavation");
  }

  if (
    notesMentionGravelBase(blob) ||
    positiveNumber(measurements.gravelBaseCy)
  ) {
    ids.add("gravel_base");
  }

  if (
    /\b(?:site\s+prep|subgrade|compaction|grade\s+prep)\b/.test(blob) ||
    /\b(?:gravel\s+base|base\s+gravel)\b/.test(blob) ||
    positiveNumber(measurements.concreteSubgradePrepSqft)
  ) {
    ids.add("site_prep");
  }

  if (
    /\b(?:rebar|re[\s-]?bar|wire\s+mesh|mesh\s+reinforcement|#4\s+bar|reinforc)/.test(
      blob,
    ) ||
    positiveNumber(measurements.concreteReinforcementSqft)
  ) {
    ids.add("reinforcement");
  }

  if (
    /\b(?:forms?|formwork|thickened\s+edge|edge\s+thickening|curb\s+form)\b/.test(blob) ||
    positiveNumber(measurements.complexFormingLf) ||
    positiveNumber(measurements.thickenedEdgeLf)
  ) {
    ids.add("complex_forming");
  }

  if (
    notesMentionConcretePump(blob) ||
    measurements.concretePumpReviewNeeded === true ||
    positiveNumber(measurements.concretePumpCount)
  ) {
    ids.add("concrete_pumping");
  }

  if (structuralOnly || positiveNumber(measurements.concreteCy)) {
    ids.add("pour_foundation");
  }

  return [...ids];
}

function sumPositiveNumbers(...values) {
  let total = 0;
  let seen = false;
  for (const value of values) {
    const n = positiveNumber(value);
    if (n == null) continue;
    total += n;
    seen = true;
  }
  return seen ? roundConcreteCy(total) : null;
}

function finalizeMixedConcreteZoneMeasurements(next) {
  const structuralSubgrade = positiveNumber(next.concreteStructuralSubgradePrepSqft);
  const flatworkSubgrade = positiveNumber(next.concreteFlatworkSubgradePrepSqft);
  if (structuralSubgrade != null || flatworkSubgrade != null) {
    next.concreteSubgradePrepSqft = sumPositiveNumbers(
      structuralSubgrade,
      flatworkSubgrade,
    );
  }

  const structuralRebar = positiveNumber(next.concreteStructuralReinforcementSqft);
  const flatworkRebar = positiveNumber(next.concreteFlatworkReinforcementSqft);
  if (structuralRebar != null || flatworkRebar != null) {
    next.concreteReinforcementSqft = sumPositiveNumbers(
      structuralRebar,
      flatworkRebar,
    );
  }

  const structuralGravel = positiveNumber(next.concreteStructuralGravelBaseCy);
  const flatworkGravel = positiveNumber(next.concreteFlatworkGravelBaseCy);
  if (structuralGravel != null || flatworkGravel != null) {
    next.gravelBaseCy = sumPositiveNumbers(structuralGravel, flatworkGravel);
  }
}

function mergeUniqueScopeIds(...scopeLists) {
  const ids = new Set();
  for (const scope of scopeLists) {
    for (const id of scope || []) ids.add(id);
  }
  return [...ids];
}

function parseExteriorFlatworkSqftFromNotes(notes, typeId) {
  const mixed = notesImplyMixedConcreteJob(notes);
  const section = mixed
    ? splitConcreteNoteSections(notes).exterior
    : String(notes || "");
  const keyword = FLATWORK_TYPE_KEYWORDS[typeId];
  if (!keyword) return null;
  const patterns = [
    new RegExp(
      `\\b(?:new\\s+)?${keyword}\\s+(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:sq\\.?\\s*ft|sqft|sf)\\b`,
      "i",
    ),
    new RegExp(
      `\\b(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:sq\\.?\\s*ft|sqft|sf)\\b[^.;]{0,50}\\b${keyword}\\b`,
      "i",
    ),
    new RegExp(
      `\\b${keyword}\\b[^.;]{0,50}\\b(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:sq\\.?\\s*ft|sqft|sf)\\b`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = section.match(pattern);
    if (!match) continue;
    const n = Number(String(match[1]).replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function resolveExteriorFlatworkSqft(notes, blob, out) {
  const existing = positiveNumber(out.concreteSqft);
  const matchedTypes = FLATWORK_TYPE_PATTERNS.filter(({ re }) => re.test(blob));
  if (matchedTypes.length === 1) {
    const fromType = parseExteriorFlatworkSqftFromNotes(notes, matchedTypes[0].id);
    if (fromType) return fromType;
  }
  if (matchedTypes.length > 1) {
    let total = 0;
    let found = false;
    for (const { id } of matchedTypes) {
      const sqft = parseExteriorFlatworkSqftFromNotes(notes, id);
      if (!sqft) continue;
      total += sqft;
      found = true;
    }
    if (found) return total;
  }
  if (existing) return existing;
  const workBlob = notesImplyMixedConcreteJob(notes)
    ? splitConcreteNoteSections(notes).exterior.toLowerCase()
    : blob;
  const match = workBlob.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\b/);
  return match ? Number(String(match[1]).replace(/,/g, "")) : null;
}

function applyExteriorFlatworkPlanningMeasurements(out, notes) {
  if (!notesImplyConcreteFlatwork(notes) && !notesImplyExteriorFlatwork(notes)) {
    return out;
  }
  const mixed = notesImplyMixedConcreteJob(notes);
  const workSection = mixed ? splitConcreteNoteSections(notes).exterior : String(notes || "");
  const blob = workSection.toLowerCase();
  const next = { ...out };

  const flatworkSqft = resolveExteriorFlatworkSqft(notes, blob, next);
  if (flatworkSqft && !next.concreteSqft) next.concreteSqft = flatworkSqft;

  const thickness = parseFlatworkThicknessInches(workSection);
  const slabThickness = thickness || positiveNumber(next.concreteThicknessInches) || 4;
  if (
    thickness != null &&
    thickness >= 3 &&
    thickness <= 12 &&
    !mixed &&
    !next.concreteThicknessInches
  ) {
    next.concreteThicknessInches = thickness;
  }

  const matchedTypes = FLATWORK_TYPE_PATTERNS.filter(({ re }) => re.test(blob));
  if (flatworkSqft && matchedTypes.length) {
    const areaByType = { ...(next.concreteAreaByType || {}) };
    const thicknessByType = { ...(next.concreteThicknessByType || {}) };
    for (const { id } of matchedTypes) {
      const typeSqft = parseExteriorFlatworkSqftFromNotes(notes, id) || flatworkSqft;
      if (!areaByType[id]) areaByType[id] = typeSqft;
      if (thickness && !thicknessByType[id]) thicknessByType[id] = thickness;
      const perTypeKey = PER_TYPE_SQFT_KEYS[id];
      if (perTypeKey && !next[perTypeKey]) next[perTypeKey] = typeSqft;
    }
    next.concreteAreaByType = areaByType;
    if (Object.keys(thicknessByType).length) next.concreteThicknessByType = thicknessByType;
  }

  const thickenedLf = parseThickenedEdgeLf(workSection);
  if (thickenedLf) {
    if (!next.thickenedEdgeLf) next.thickenedEdgeLf = thickenedLf;
    if (!next.complexFormingLf) next.complexFormingLf = thickenedLf;
    if (!next.thickenedEdgeCy) next.thickenedEdgeCy = computeThickenedEdgeCy(thickenedLf);
    if (!next.thickenedEdgeWidthInches) {
      next.thickenedEdgeWidthInches = DEFAULT_THICKENED_EDGE_WIDTH_INCHES;
    }
    if (!next.thickenedEdgeDepthInches) {
      next.thickenedEdgeDepthInches = DEFAULT_THICKENED_EDGE_DEPTH_INCHES;
    }
  }

  const hasGravelBase = notesMentionGravelBase(blob);
  if (hasGravelBase && flatworkSqft) {
    const gravelDepth =
      positiveNumber(next.gravelBaseDepthInches) || DEFAULT_GRAVEL_BASE_DEPTH_INCHES;
    if (!next.gravelBaseDepthInches) next.gravelBaseDepthInches = gravelDepth;
    const flatworkGravelCy = computeCyFromAreaDepth(flatworkSqft, gravelDepth);
    if (mixed) {
      if (!next.concreteFlatworkGravelBaseCy) {
        next.concreteFlatworkGravelBaseCy = flatworkGravelCy;
      }
      if (!next.concreteFlatworkSubgradePrepSqft) {
        next.concreteFlatworkSubgradePrepSqft = flatworkSqft;
      }
    } else {
      if (!next.gravelBaseCy) next.gravelBaseCy = flatworkGravelCy;
      if (!next.concreteSubgradePrepSqft) {
        next.concreteSubgradePrepSqft = flatworkSqft;
      }
    }
  } else if (
    /\b(?:subgrade\s+prep|site\s+prep|compaction|grade\s+prep)\b/.test(blob) &&
    flatworkSqft
  ) {
    if (mixed) {
      if (!next.concreteFlatworkSubgradePrepSqft) {
        next.concreteFlatworkSubgradePrepSqft = flatworkSqft;
      }
    } else if (!next.concreteSubgradePrepSqft) {
      next.concreteSubgradePrepSqft = flatworkSqft;
    }
  }

  if (
    /\b(?:rebar|re[\s-]?bar|wire\s+mesh|mesh\s+reinforcement)\b/.test(blob) &&
    flatworkSqft
  ) {
    if (mixed) {
      if (!next.concreteFlatworkReinforcementSqft) {
        next.concreteFlatworkReinforcementSqft = flatworkSqft;
      }
    } else if (!next.concreteReinforcementSqft) {
      next.concreteReinforcementSqft = flatworkSqft;
    }
  }

  if (/\b(?:dig\s+out|excavat)/.test(blob) && flatworkSqft) {
    const gravelDepth = hasGravelBase
      ? positiveNumber(next.gravelBaseDepthInches) || DEFAULT_GRAVEL_BASE_DEPTH_INCHES
      : 0;
    const digDepth = resolveFlatworkExcavationDepthInches(
      slabThickness,
      hasGravelBase,
      gravelDepth,
    );
    if (!next.excavationAreaSqft) next.excavationAreaSqft = flatworkSqft;
    if (!next.excavationDepthInches) next.excavationDepthInches = digDepth;
    const flatworkExcavationCy = computeCyFromAreaDepth(flatworkSqft, digDepth);
    if (!next.excavationCy) {
      next.excavationCy = flatworkExcavationCy;
    } else if (mixed) {
      next.excavationCy = sumPositiveNumbers(next.excavationCy, flatworkExcavationCy);
    }
  }

  const pumpSource = mixed ? workSection : String(notes || "");
  if (notesMentionConcretePump(pumpSource)) {
    next.concretePumpReviewNeeded = true;
    if (!next.concretePumpCount) next.concretePumpCount = DEFAULT_CONCRETE_PUMP_COUNT;
  }

  const scope = inferConcreteScopeIds(notes, next);
  if (scope.length) next.concreteScope = scope;

  return next;
}

function applyConcretePlanningMeasurements(out, notes) {
  const mixed = notesImplyMixedConcreteJob(notes);
  const structuralFoundation =
    notesImplyStructuralFoundation(notes) && !notesImplyExteriorFlatwork(notes);

  if (mixed) {
    let next = { ...out };
    const foundation = applyFoundationPlanningMeasurements(next, notes, {
      preserveFlatwork: true,
    });
    if (foundation) next = { ...next, ...foundation };
    next = applyExteriorFlatworkPlanningMeasurements(next, notes);
    const scope = mergeUniqueScopeIds(foundation?.concreteScope, next.concreteScope);
    if (scope.length) next.concreteScope = scope;
    finalizeMixedConcreteZoneMeasurements(next);
    return next;
  }

  if (structuralFoundation) {
    const foundation = applyFoundationPlanningMeasurements(out, notes);
    if (foundation) {
      const {
        concreteSqft: _concreteSqft,
        concreteAreaByType: _concreteAreaByType,
        concreteThicknessByType: _concreteThicknessByType,
        concreteDrivewaySqft: _concreteDrivewaySqft,
        concreteSidewalkSqft: _concreteSidewalkSqft,
        concretePatioSqft: _concretePatioSqft,
        concreteWalkwaySqft: _concreteWalkwaySqft,
        concreteRvPadSqft: _concreteRvPadSqft,
        ...withoutFlatwork
      } = out;
      return { ...withoutFlatwork, ...foundation };
    }
  }

  return applyExteriorFlatworkPlanningMeasurements(out, notes);
}

module.exports = {
  applyConcretePlanningMeasurements,
  computeCyFromAreaDepth,
  computeThickenedEdgeCy,
  inferConcreteScopeIds,
  notesImplyConcreteFlatwork,
  notesMentionConcretePump,
  notesMentionGravelBase,
  parseExteriorFlatworkSqftFromNotes,
  parseThickenedEdgeLf,
  parseFlatworkThicknessInches,
  resolveFlatworkExcavationDepthInches,
};
