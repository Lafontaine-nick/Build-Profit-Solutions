/**
 * Foundation/slab/footing planning quantities — shared by plan quick-measurement
 * suggestions and concrete/foundation note hydration.
 */

export const FOOTING_TRENCH_WIDTH_FT = 3;
export const FOOTING_TRENCH_DEPTH_FT = 3;
export const SLAB_OVEREX_DEPTH_FT = 0.5;
export const FOOTING_WIDTH_FT = 1.5;
export const FOOTING_DEPTH_FT = 1;
export const STEM_WALL_HEIGHT_FT = 2.5;
export const STEM_WALL_THICKNESS_FT = 0.667;
export const DEFAULT_SLAB_THICKNESS_FT = 4 / 12;
export const FOUNDATION_WASTE_FACTOR = 0.1;
export const INTERIOR_FOOTING_RATIO = 0.15;

export type FoundationFootprintInput = {
  livingFootprintSqft: number;
  garageSqft?: number;
  coveredPatioSqft?: number;
  includeCoveredPatioSlab?: boolean;
  perimeterLf?: number | null;
  slabThicknessFt?: number;
  /** When garage slab is thinner/thicker than the main house slab. */
  garageSlabThicknessFt?: number | null;
};

export type FoundationCyBreakdown = {
  totalCy: number;
  footingCy: number;
  interiorFootingCy: number;
  stemWallCy: number;
  slabCy: number;
  wasteCy: number;
  perimeterLf: number;
  slabFootprintSqft: number;
};

export type ExcavationCyBreakdown = {
  totalCy: number;
  trenchCy: number;
  padCutCy: number;
  workingRoomCy: number;
  perimeterLf: number;
  footprintSqft: number;
};

export function estimatedPerimeterFt(footprintSqft: number): number {
  return 4 * Math.sqrt(footprintSqft);
}

function roundCy(value: number): number {
  return Math.round(value * 100) / 100;
}

/** House/garage slabs + continuous/interior footings + stem walls + waste. */
export function computeFoundationCyFromFootprint(
  input: FoundationFootprintInput
): FoundationCyBreakdown {
  const living = input.livingFootprintSqft;
  const garage = input.garageSqft || 0;
  const patio =
    input.includeCoveredPatioSlab && input.coveredPatioSqft
      ? input.coveredPatioSqft
      : 0;
  const slabFootprint = living + garage + patio;
  const perimeter =
    input.perimeterLf && input.perimeterLf > 0
      ? input.perimeterLf
      : estimatedPerimeterFt(living + garage);
  const slabThicknessFt = input.slabThicknessFt ?? DEFAULT_SLAB_THICKNESS_FT;
  const garageSlabThicknessFt =
    input.garageSlabThicknessFt != null && input.garageSlabThicknessFt > 0
      ? input.garageSlabThicknessFt
      : slabThicknessFt;
  const interiorFootingLf = perimeter * INTERIOR_FOOTING_RATIO;
  const footingCf = perimeter * FOOTING_WIDTH_FT * FOOTING_DEPTH_FT;
  const interiorFootingCf =
    interiorFootingLf * FOOTING_WIDTH_FT * FOOTING_DEPTH_FT;
  const stemCf = perimeter * STEM_WALL_HEIGHT_FT * STEM_WALL_THICKNESS_FT;
  const slabCf =
    living * slabThicknessFt +
    garage * garageSlabThicknessFt +
    patio * slabThicknessFt;
  const subtotalCf = footingCf + interiorFootingCf + stemCf + slabCf;
  const wasteCf = subtotalCf * FOUNDATION_WASTE_FACTOR;
  const totalCy = roundCy((subtotalCf + wasteCf) / 27);
  return {
    totalCy,
    footingCy: roundCy(footingCf / 27),
    interiorFootingCy: roundCy(interiorFootingCf / 27),
    stemWallCy: roundCy(stemCf / 27),
    slabCy: roundCy(slabCf / 27),
    wasteCy: roundCy(wasteCf / 27),
    perimeterLf: perimeter,
    slabFootprintSqft: slabFootprint,
  };
}

/** Shallow pad cut + perimeter footing trench + working room — not full-building dig. */
export function computeExcavationCyFromFootingTrench(
  input: FoundationFootprintInput
): ExcavationCyBreakdown {
  const living = input.livingFootprintSqft;
  const garage = input.garageSqft || 0;
  const footprint = living + garage;
  const perimeter =
    input.perimeterLf && input.perimeterLf > 0
      ? input.perimeterLf
      : estimatedPerimeterFt(footprint);
  const trenchCy = roundCy(
    (perimeter * FOOTING_TRENCH_WIDTH_FT * FOOTING_TRENCH_DEPTH_FT) / 27
  );
  const padCutCy = roundCy((footprint * SLAB_OVEREX_DEPTH_FT) / 27);
  const workingRoomCy = roundCy(trenchCy * 0.1);
  const totalCy = roundCy(trenchCy + padCutCy + workingRoomCy);
  return {
    totalCy,
    trenchCy,
    padCutCy,
    workingRoomCy,
    perimeterLf: perimeter,
    footprintSqft: footprint,
  };
}

const EXTERIOR_FLATWORK_RE =
  /\b(?:driveway|sidewalk|walkway|patio\s+slab|rv\s+pad|porch\s+slab)\b/i;

const STRUCTURAL_FOUNDATION_RE =
  /\b(?:house|garage|building|monolithic)\s+slab\b|\b(?:slab\s+on\s+grade|foundation\s+pour|footings?|stem\s+wall|continuous\s+footings?|piers?)\b/i;

export function notesImplyStructuralFoundation(
  notes: string | null | undefined
): boolean {
  const n = String(notes || '');
  if (!n.trim()) return false;
  if (STRUCTURAL_FOUNDATION_RE.test(n)) return true;
  if (
    /\bfirst\s+floor\b/i.test(n) &&
    /\b(?:footings?|foundation|slab)\b/i.test(n)
  ) {
    return true;
  }
  if (
    /\bnew\s+build\b/i.test(n) &&
    /\b(?:footings?|foundation|slab)\b/i.test(n)
  ) {
    return true;
  }
  return false;
}

export function notesImplyExteriorFlatwork(
  notes: string | null | undefined
): boolean {
  const n = String(notes || '');
  if (!n.trim()) return false;
  return (
    EXTERIOR_FLATWORK_RE.test(n) ||
    /\bpour\s+new\s+(?:driveway|sidewalk|walkway|patio)\b/i.test(n)
  );
}

export function notesImplyMixedConcreteJob(
  notes: string | null | undefined
): boolean {
  return (
    notesImplyStructuralFoundation(notes) && notesImplyExteriorFlatwork(notes)
  );
}

/** Split house/garage foundation notes from exterior flatwork sections when present. */
export function splitConcreteNoteSections(notes: string | null | undefined): {
  structural: string;
  exterior: string;
} {
  const text = String(notes || '');
  const headerMatch = text.match(/\bexterior\s+flatwork\b[^:\n]*:?\s*/i);
  if (headerMatch && headerMatch.index != null) {
    return {
      structural: text.slice(0, headerMatch.index),
      exterior: text.slice(headerMatch.index + headerMatch[0].length),
    };
  }

  const exteriorLeadPatterns = [
    /\n\s*[-•*]?\s*(?:new\s+)?driveway\b/i,
    /\n\s*[-•*]?\s*(?:new\s+)?(?:sidewalk|walkway|patio)\b/i,
    /\n\s*(?:exterior|flatwork)\s*(?:\(separate\))?\s*:\s*/i,
  ];
  for (const pattern of exteriorLeadPatterns) {
    const match = text.match(pattern);
    if (match?.index == null || match.index <= 0) continue;
    const structural = text.slice(0, match.index);
    const exterior = text.slice(match.index);
    if (
      notesImplyStructuralFoundation(structural) &&
      notesImplyExteriorFlatwork(exterior) &&
      !/\b(?:driveway|sidewalk|walkway|patio\s+slab)\b/i.test(structural)
    ) {
      return { structural, exterior };
    }
  }

  return { structural: text, exterior: text };
}

function structuralNotesBlob(notes: string | null | undefined): string {
  const { structural } = splitConcreteNoteSections(notes);
  return structural;
}

export function parseFoundationFootprintSqftFromNotes(
  notes: string | null | undefined
): number | null {
  const text = notesImplyMixedConcreteJob(notes)
    ? structuralNotesBlob(notes)
    : String(notes || '');
  const patterns = [
    /\bmonolithic\s+(?:house|building)\s+slab\s+(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\b/i,
    /\b(?:house|building)\s+slab\s+(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\b/i,
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\b[^.;]{0,40}\b(?:house|building|monolithic)\s+slab\b/i,
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\b[^.;]{0,40}\b(?:first\s+floor|slab\s+on\s+grade)\b/i,
    /\bfirst\s+floor[^.;]{0,30}(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\b/i,
    /\bfoundation[^.;]{0,30}(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\b/i,
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\b[^.;]{0,40}\b(?:footings?|foundation)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const n = Number(String(match[1]).replace(/,/g, ''));
    if (Number.isFinite(n) && n >= 200) return n;
  }
  const generic = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\b/i);
  if (generic && notesImplyStructuralFoundation(text) && !notesImplyExteriorFlatwork(text)) {
    const n = Number(String(generic[1]).replace(/,/g, ''));
    if (Number.isFinite(n) && n >= 200) return n;
  }
  return null;
}

export function parseGarageSlabThicknessFromNotes(
  notes: string | null | undefined
): number | null {
  const text = notesImplyMixedConcreteJob(notes)
    ? structuralNotesBlob(notes)
    : String(notes || '');
  const patterns = [
    /\bgarage\s+slab\s+\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft|sqft|sf)\b[^.;]{0,60}(\d[\d,]*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?|["″])\s*thick/i,
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\s+garage\b[^.;]{0,60}(\d[\d,]*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?|["″])\s*thick/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const raw = match[2] ?? match[1];
    const n = Number(String(raw).replace(/,/g, ''));
    if (Number.isFinite(n) && n >= 3 && n <= 12) return n;
  }
  return null;
}

export function parseGarageSqftFromNotes(notes: string | null | undefined): number | null {
  const text = notesImplyMixedConcreteJob(notes)
    ? structuralNotesBlob(notes)
    : String(notes || '');
  const match =
    text.match(/\bgarage\s+slab\s+(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\b/i) ||
    text.match(/\b(?:garage|rv\s+garage)\s+(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\b/i) ||
    text.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)\s+garage\b/i);
  if (!match) return null;
  const n = Number(String(match[1]).replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function inferFoundationScopeIds(
  notes: string | null | undefined,
  measurements: Record<string, unknown> = {}
): string[] {
  const blob = String(notes || '').toLowerCase();
  const ids = new Set<string>();
  if (
    /\b(?:footings?|foundation|piers?|stem\s+wall|monolithic|house\s+slab|garage\s+slab)\b/.test(
      blob
    ) ||
    Number(measurements.concreteCy) > 0
  ) {
    ids.add('pour_foundation');
  }
  if (
    /\b(?:excavat(?:e|ion)|dig(?:ging)?|dig\s+out|trench(?:ing)?)\b/.test(blob) ||
    Number(measurements.excavationCy) > 0
  ) {
    ids.add('excavation');
  }
  if (
    /\b(?:site\s+prep|subgrade|gravel\s+base|base\s+gravel)\b/.test(blob) ||
    Number(measurements.concreteSubgradePrepSqft) > 0
  ) {
    ids.add('site_prep');
  }
  if (
    /\b(?:rebar|re[\s-]?bar|wire\s+mesh|mesh\s+reinforcement|reinforc)/.test(blob) ||
    Number(measurements.concreteReinforcementSqft) > 0
  ) {
    ids.add('reinforcement');
  }
  if (
    /\b(?:forms?|formwork|thickened\s+edge|complex\s+forming)\b/.test(blob) ||
    Number(measurements.complexFormingLf) > 0
  ) {
    ids.add('complex_forming');
  }
  return [...ids];
}

export function parseStructuralSlabThicknessFromNotes(
  notes: string | null | undefined
): number | null {
  const text = notesImplyMixedConcreteJob(notes)
    ? structuralNotesBlob(notes)
    : String(notes || '');
  const patterns = [
    /\bmonolithic\s+(?:house|building)\s+slab\b[^.\n;]{0,80}(\d[\d,]*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?|["″])\s*thick/i,
    /\b(?:house|building)\s+slab\b[^.\n;]{0,60}(\d[\d,]*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?|["″])\s*thick/i,
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?|["″])\s*thick[^.\n;]{0,80}\b(?:house|building|monolithic)\s+slab\b/i,
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?|["″])\s*thick\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const n = Number(String(match[1]).replace(/,/g, ''));
    if (Number.isFinite(n) && n >= 3 && n <= 12) return n;
  }
  return null;
}

export type FoundationPlanningOptions = {
  /** Keep exterior flatwork keys when house + driveway are in the same note. */
  preserveFlatwork?: boolean;
};

export function applyFoundationPlanningMeasurements<T extends Record<string, unknown>>(
  out: T,
  notes: string | null | undefined,
  options: FoundationPlanningOptions = {}
): T | null {
  if (!notesImplyStructuralFoundation(notes)) return null;
  const blob = String(notes || '').toLowerCase();
  const structuralBlob = structuralNotesBlob(notes).toLowerCase();
  const next = { ...out } as T & Record<string, unknown>;

  const livingFootprint =
    Number(next.floorAreaSqft) ||
    Number(next.foundationFootprintSqft) ||
    parseFoundationFootprintSqftFromNotes(notes);
  if (!livingFootprint || livingFootprint < 200) return null;

  const garageSqft = parseGarageSqftFromNotes(notes) || Number(next.garageSqft) || 0;
  const thicknessIn =
    Number(next.concreteThicknessInches) ||
    parseStructuralSlabThicknessFromNotes(notes) ||
    (() => {
      const match = String(notes || '').match(
        /(\d[\d,]*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?|["″])\s*(?:thick|slab)?/i
      );
      return match ? Number(match[1]) : null;
    })();
  const slabThicknessFt =
    thicknessIn && thicknessIn >= 3 && thicknessIn <= 12
      ? thicknessIn / 12
      : DEFAULT_SLAB_THICKNESS_FT;
  const garageThicknessIn = parseGarageSlabThicknessFromNotes(notes);
  const garageSlabThicknessFt =
    garageThicknessIn && garageThicknessIn >= 3 && garageThicknessIn <= 12
      ? garageThicknessIn / 12
      : null;

  if (!next.foundationFootprintSqft) next.foundationFootprintSqft = livingFootprint;
  if (!options.preserveFlatwork && !next.floorAreaSqft) {
    next.floorAreaSqft = livingFootprint;
  }
  if (thicknessIn && !next.concreteThicknessInches && !options.preserveFlatwork) {
    next.concreteThicknessInches = thicknessIn;
  }

  if (!next.concreteCy) {
    const foundation = computeFoundationCyFromFootprint({
      livingFootprintSqft: livingFootprint,
      garageSqft,
      slabThicknessFt,
      garageSlabThicknessFt,
    });
    next.concreteCy = foundation.totalCy;
    next.foundationPerimeterLf = foundation.perimeterLf;
  }

  if (
    !next.excavationCy &&
    /\b(?:excavat(?:e|ion|ing)?|dig\s+out|digging)\b/.test(structuralBlob)
  ) {
    const excavation = computeExcavationCyFromFootingTrench({
      livingFootprintSqft: livingFootprint,
      garageSqft,
      perimeterLf: Number(next.foundationPerimeterLf) || null,
    });
    next.excavationCy = excavation.totalCy;
  }

  const slabFootprint = livingFootprint + garageSqft;
  if (
    /\b(?:rebar|re[\s-]?bar|wire\s+mesh|mesh\s+reinforcement)\b/.test(structuralBlob)
  ) {
    if (options.preserveFlatwork) {
      if (!next.concreteStructuralReinforcementSqft) {
        next.concreteStructuralReinforcementSqft = slabFootprint;
      }
    } else if (!next.concreteReinforcementSqft) {
      next.concreteReinforcementSqft = slabFootprint;
    }
  }
  if (
    /\b(?:gravel\s+base|base\s+gravel|subgrade\s+prep)\b/.test(structuralBlob)
  ) {
    if (options.preserveFlatwork) {
      if (!next.concreteStructuralSubgradePrepSqft) {
        next.concreteStructuralSubgradePrepSqft = slabFootprint;
      }
    } else if (!next.concreteSubgradePrepSqft) {
      next.concreteSubgradePrepSqft = slabFootprint;
    }
  }
  if (
    /\b(?:gravel\s+base|base\s+gravel|crushed\s+(?:rock|stone)\s+base|aggregate\s+base)\b/.test(
      structuralBlob
    )
  ) {
    const gravelDepth = 4;
    if (!next.gravelBaseDepthInches) next.gravelBaseDepthInches = gravelDepth;
    const structuralGravelCy = roundCy((slabFootprint * (gravelDepth / 12)) / 27);
    if (options.preserveFlatwork) {
      if (!next.concreteStructuralGravelBaseCy) {
        next.concreteStructuralGravelBaseCy = structuralGravelCy;
      }
    } else if (!next.gravelBaseCy) {
      next.gravelBaseCy = structuralGravelCy;
    }
  }

  if (!options.preserveFlatwork) {
    // Structural foundation uses CY — do not bleed footprint into exterior flatwork sqft.
    delete next.concreteSqft;
    delete next.concreteAreaByType;
    delete next.concreteThicknessByType;
    delete next.concreteDrivewaySqft;
    delete next.concreteSidewalkSqft;
    delete next.concretePatioSqft;
    delete next.concreteWalkwaySqft;
    delete next.concreteRvPadSqft;
  }

  const scope = inferFoundationScopeIds(notes, next);
  if (scope.length) next.concreteScope = scope;

  return next;
}
