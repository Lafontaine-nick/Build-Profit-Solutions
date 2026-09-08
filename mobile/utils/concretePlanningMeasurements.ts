import {
  applyFoundationPlanningMeasurements,
  notesImplyExteriorFlatwork,
  notesImplyMixedConcreteJob,
  notesImplyStructuralFoundation,
  splitConcreteNoteSections,
} from '@/utils/foundationPlanningMeasurements';
import { detectAdditionConversionIntent } from '@/utils/additionConversionPlanning';

const FLATWORK_TYPE_PATTERNS = [
  { id: 'driveways' as const, re: /\bdriveway\b/i },
  { id: 'sidewalks' as const, re: /\bsidewalk\b/i },
  { id: 'patios' as const, re: /\bpatio\b/i },
  { id: 'rv_pads' as const, re: /\brv\s+pad\b/i },
  { id: 'walkways' as const, re: /\bwalkway\b/i },
];

const DEPTH_INCHES_RE = /(\d[\d,]*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?|["″])/i;

const PER_TYPE_SQFT_KEYS: Record<string, string> = {
  driveways: 'concreteDrivewaySqft',
  sidewalks: 'concreteSidewalkSqft',
  patios: 'concretePatioSqft',
  walkways: 'concreteWalkwaySqft',
  rv_pads: 'concreteRvPadSqft',
};

/** Default gravel base depth when notes mention gravel but no depth is stated. */
export const DEFAULT_GRAVEL_BASE_DEPTH_INCHES = 4;

/** Residential driveway thickened-edge planning defaults (verify on site). */
export const DEFAULT_THICKENED_EDGE_WIDTH_INCHES = 12;
export const DEFAULT_THICKENED_EDGE_DEPTH_INCHES = 8;

/** Planning allowance when notes mention a conditional pump truck. */
export const DEFAULT_CONCRETE_PUMP_ALLOWANCE = 950;
export const DEFAULT_CONCRETE_PUMP_COUNT = 1;

const CONCRETE_REVEAL_LABEL_TO_ITEM_ID: Array<{ re: RegExp; itemId: string }> = [
  { re: /^pour flatwork|^driveway|^sidewalk|^patio|^walkway|^rv pad/i, itemId: 'pour_flatwork' },
  { re: /^basic subgrade|^site prep|^subgrade/i, itemId: 'site_prep' },
  { re: /^excavat/i, itemId: 'excavation' },
  { re: /^rebar|^reinforc/i, itemId: 'reinforcement' },
  { re: /^complex form|^thickened edge/i, itemId: 'complex_forming' },
  { re: /^footing|^foundation/i, itemId: 'pour_foundation' },
  { re: /^demo/i, itemId: 'demo_removal' },
  { re: /^sealer/i, itemId: 'concrete_sealer' },
  { re: /^decorative/i, itemId: 'decorative_finish' },
  { re: /^haul-?off|^disposal/i, itemId: 'additional_haul_off' },
  { re: /^gravel base|^imported gravel/i, itemId: 'gravel_base' },
  { re: /^concrete pump|^pump truck|^pumping/i, itemId: 'concrete_pumping' },
];

const FLATWORK_TYPE_KEYWORDS: Record<string, string> = {
  driveways: 'driveway',
  sidewalks: 'sidewalk',
  patios: 'patio',
  rv_pads: 'rv\\s+pad',
  walkways: 'walkway',
};

function positiveNumber(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sumPositiveNumbers(...values: Array<number | null | undefined>): number | null {
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

export function finalizeMixedConcreteZoneMeasurements(
  next: Record<string, unknown>
): void {
  const structuralSubgrade = positiveNumber(next.concreteStructuralSubgradePrepSqft);
  const flatworkSubgrade = positiveNumber(next.concreteFlatworkSubgradePrepSqft);
  if (structuralSubgrade != null || flatworkSubgrade != null) {
    next.concreteSubgradePrepSqft = sumPositiveNumbers(
      structuralSubgrade,
      flatworkSubgrade
    );
  }

  const structuralRebar = positiveNumber(next.concreteStructuralReinforcementSqft);
  const flatworkRebar = positiveNumber(next.concreteFlatworkReinforcementSqft);
  if (structuralRebar != null || flatworkRebar != null) {
    next.concreteReinforcementSqft = sumPositiveNumbers(
      structuralRebar,
      flatworkRebar
    );
  }

  const structuralGravel = positiveNumber(next.concreteStructuralGravelBaseCy);
  const flatworkGravel = positiveNumber(next.concreteFlatworkGravelBaseCy);
  if (structuralGravel != null || flatworkGravel != null) {
    next.gravelBaseCy = sumPositiveNumbers(structuralGravel, flatworkGravel);
  }
}

export type MixedConcreteChecklistQuantity = {
  quantity: number;
  unit: 'sqft' | 'cy';
  sourceLabel: string;
  quantityHelper: string;
};

function formatMixedConcreteZoneParts(
  parts: Array<{ label: string; value: number; unit: 'sqft' | 'cy' }>
): string {
  return parts
    .map(({ label, value, unit }) =>
      unit === 'cy'
        ? `${label} ${roundConcreteCy(value)} CY`
        : `${label} ${value.toLocaleString()} sf`
    )
    .join(' + ');
}

export function hasMixedConcreteZoneSplit(
  measurements: Record<string, unknown>
): boolean {
  return (
    positiveNumber(measurements.concreteStructuralSubgradePrepSqft) != null ||
    positiveNumber(measurements.concreteFlatworkSubgradePrepSqft) != null ||
    positiveNumber(measurements.concreteStructuralReinforcementSqft) != null ||
    positiveNumber(measurements.concreteFlatworkReinforcementSqft) != null ||
    positiveNumber(measurements.concreteStructuralGravelBaseCy) != null ||
    positiveNumber(measurements.concreteFlatworkGravelBaseCy) != null
  );
}

/** Pricing-card quantity + attribution when structural pad and exterior flatwork are split. */
export function resolveMixedConcreteChecklistQuantity(
  itemId: string,
  measurements: Record<string, unknown>
): MixedConcreteChecklistQuantity | null {
  if (!hasMixedConcreteZoneSplit(measurements)) return null;

  if (itemId === 'site_prep') {
    const structural = positiveNumber(measurements.concreteStructuralSubgradePrepSqft);
    const flatwork = positiveNumber(measurements.concreteFlatworkSubgradePrepSqft);
    const total = sumPositiveNumbers(structural, flatwork);
    if (total == null) return null;
    const parts: Array<{ label: string; value: number; unit: 'sqft' | 'cy' }> = [];
    if (structural) parts.push({ label: 'structural pad', value: structural, unit: 'sqft' });
    if (flatwork) parts.push({ label: 'exterior flatwork', value: flatwork, unit: 'sqft' });
    return {
      quantity: total,
      unit: 'sqft',
      sourceLabel: `Subgrade prep · ${formatMixedConcreteZoneParts(parts)}`,
      quantityHelper:
        'Structural pad and exterior flatwork subgrade are priced together on this line.',
    };
  }

  if (itemId === 'reinforcement') {
    const structural = positiveNumber(measurements.concreteStructuralReinforcementSqft);
    const flatwork = positiveNumber(measurements.concreteFlatworkReinforcementSqft);
    const total = sumPositiveNumbers(structural, flatwork);
    if (total == null) return null;
    const parts: Array<{ label: string; value: number; unit: 'sqft' | 'cy' }> = [];
    if (structural) parts.push({ label: 'structural pad', value: structural, unit: 'sqft' });
    if (flatwork) parts.push({ label: 'exterior flatwork', value: flatwork, unit: 'sqft' });
    return {
      quantity: total,
      unit: 'sqft',
      sourceLabel: `Rebar / mesh · ${formatMixedConcreteZoneParts(parts)}`,
      quantityHelper:
        'Structural pad and exterior flatwork reinforcement are priced together on this line.',
    };
  }

  if (itemId === 'gravel_base') {
    const structural = positiveNumber(measurements.concreteStructuralGravelBaseCy);
    const flatwork = positiveNumber(measurements.concreteFlatworkGravelBaseCy);
    const total = sumPositiveNumbers(structural, flatwork);
    if (total == null) return null;
    const parts: Array<{ label: string; value: number; unit: 'sqft' | 'cy' }> = [];
    if (structural) parts.push({ label: 'structural pad', value: structural, unit: 'cy' });
    if (flatwork) parts.push({ label: 'exterior flatwork', value: flatwork, unit: 'cy' });
    return {
      quantity: total,
      unit: 'cy',
      sourceLabel: `Gravel base · ${formatMixedConcreteZoneParts(parts)}`,
      quantityHelper:
        'Structural pad and exterior flatwork gravel base are priced together on this line.',
    };
  }

  return null;
}

function mergeUniqueScopeIds(
  ...scopeLists: Array<string[] | null | undefined>
): string[] {
  const ids = new Set<string>();
  for (const scope of scopeLists) {
    for (const id of scope || []) ids.add(id);
  }
  return [...ids];
}

export function parseExteriorFlatworkSqftFromNotes(
  notes: string | null | undefined,
  typeId: keyof typeof FLATWORK_TYPE_KEYWORDS
): number | null {
  const mixed = notesImplyMixedConcreteJob(notes);
  const section = mixed
    ? splitConcreteNoteSections(notes).exterior
    : String(notes || '');
  const keyword = FLATWORK_TYPE_KEYWORDS[typeId];
  if (!keyword) return null;
  const patterns = [
    new RegExp(
      `\\b(?:new\\s+)?${keyword}\\s+(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:sq\\.?\\s*ft|sqft|sf)\\b`,
      'i'
    ),
    new RegExp(
      `\\b(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:sq\\.?\\s*ft|sqft|sf)\\b[^.;]{0,50}\\b${keyword}\\b`,
      'i'
    ),
    new RegExp(
      `\\b${keyword}\\b[^.;]{0,50}\\b(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?:sq\\.?\\s*ft|sqft|sf)\\b`,
      'i'
    ),
  ];
  for (const pattern of patterns) {
    const match = section.match(pattern);
    if (!match) continue;
    const n = Number(String(match[1]).replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function resolveExteriorFlatworkSqft(
  notes: string | null | undefined,
  blob: string,
  out: Record<string, unknown>
): number | null {
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
  return match ? Number(String(match[1]).replace(/,/g, '')) : null;
}

function applyExteriorFlatworkPlanningMeasurements<T extends Record<string, unknown>>(
  out: T,
  notes: string | null | undefined
): T {
  if (!notesImplyConcreteFlatwork(notes) && !notesImplyExteriorFlatwork(notes)) {
    return out;
  }
  const mixed = notesImplyMixedConcreteJob(notes);
  const workSection = mixed ? splitConcreteNoteSections(notes).exterior : String(notes || '');
  const blob = workSection.toLowerCase();
  const next = { ...out } as T & Record<string, unknown>;

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
    const areaByType = {
      ...((next.concreteAreaByType as Record<string, unknown>) || {}),
    };
    const thicknessByType = {
      ...((next.concreteThicknessByType as Record<string, unknown>) || {}),
    };
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
    if (!next.thickenedEdgeCy) {
      next.thickenedEdgeCy = computeThickenedEdgeCy(thickenedLf);
    }
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
      gravelDepth
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

  const pumpSource = mixed ? workSection : String(notes || '');
  if (notesMentionConcretePump(pumpSource)) {
    next.concretePumpReviewNeeded = true;
    if (!next.concretePumpCount) {
      next.concretePumpCount = DEFAULT_CONCRETE_PUMP_COUNT;
    }
  }

  const scope = inferConcreteScopeIds(notes, next);
  if (scope.length) next.concreteScope = scope;

  return next;
}

export function roundConcreteCy(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeCyFromAreaDepth(sqft: number, depthInches: number): number {
  if (!(sqft > 0) || !(depthInches > 0)) return 0;
  return roundConcreteCy((sqft * (depthInches / 12)) / 27);
}

export function computeThickenedEdgeCy(
  lf: number,
  widthInches = DEFAULT_THICKENED_EDGE_WIDTH_INCHES,
  depthInches = DEFAULT_THICKENED_EDGE_DEPTH_INCHES
): number {
  if (!(lf > 0) || !(widthInches > 0) || !(depthInches > 0)) return 0;
  return roundConcreteCy((lf * (widthInches / 12) * (depthInches / 12)) / 27);
}

export function notesMentionGravelBase(notes: string | null | undefined): boolean {
  return /\b(?:gravel\s+base|base\s+gravel|crushed\s+(?:rock|stone)\s+base|aggregate\s+base)\b/i.test(
    String(notes || '')
  );
}

export function notesMentionConcretePump(notes: string | null | undefined): boolean {
  const blob = String(notes || '');
  return (
    /\b(?:pump\s+truck|concrete\s+pump|pump(?:ing)?\s+(?:truck|if\s+needed|may\s+be|might\s+be|required))\b/i.test(
      blob
    ) || /\bmight\s+need\s+(?:a\s+)?pump\b/i.test(blob)
  );
}

export function notesImplyConcreteFlatwork(notes: string | null | undefined): boolean {
  const n = String(notes || '');
  if (!n.trim()) return false;
  if (detectAdditionConversionIntent(undefined, n)) return false;
  if (notesImplyStructuralFoundation(n) && !notesImplyExteriorFlatwork(n)) {
    return false;
  }
  return (
    /\b(?:concrete|flat[\s-]?work|driveway|sidewalk|walkway|patio|pour\b)/i.test(n) ||
    notesImplyStructuralFoundation(n) ||
    (/\b\d{2,4}\s*(?:sq\.?\s*ft|sf)\b/i.test(n) &&
      /\b(?:\d\s*(?:inch|in)\b[^.]{0,20}thick|thickened\s+edge|rebar|broom\s+finish|gravel\s+base|dig\s+out)\b/i.test(
        n
      ))
  );
}

export function parseFlatworkThicknessInches(text: string | null | undefined): number | null {
  const source = String(text || '');
  const thickMatch = source.match(
    /(\d[\d,]*(?:\.\d+)?)\s*(?:inch(?:es)?|in\.?|["″])\s*thick/i
  );
  if (thickMatch) {
    const n = Number(String(thickMatch[1]).replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  const depthMatch = source.match(DEPTH_INCHES_RE);
  if (depthMatch) {
    const n = Number(String(depthMatch[1]).replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function parseThickenedEdgeLf(text: string | null | undefined): number | null {
  const source = String(text || '');
  const patterns = [
    /(\d[\d,]*(?:\.\d+)?)\s*(?:ft|feet|foot|lf)\s+of\s+thickened\s+edge/i,
    /(\d[\d,]*(?:\.\d+)?)\s*(?:ft|feet|foot|lf)\b[^.;]{0,40}\bthickened\s+edge/i,
    /\bthickened\s+edge\b[^.;]{0,40}(\d[\d,]*(?:\.\d+)?)\s*(?:ft|feet|foot|lf)\b/i,
    /(\d[\d,]*(?:\.\d+)?)\s*lf\s+thickened\s+edge/i,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const n = Number(String(match[1]).replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function resolveFlatworkExcavationDepthInches(
  slabThicknessInches: number,
  hasGravelBase: boolean,
  gravelDepthInches = DEFAULT_GRAVEL_BASE_DEPTH_INCHES
): number {
  const slab = slabThicknessInches > 0 ? slabThicknessInches : 4;
  if (!hasGravelBase) return slab;
  const gravel = gravelDepthInches > 0 ? gravelDepthInches : DEFAULT_GRAVEL_BASE_DEPTH_INCHES;
  return slab + gravel;
}

export function inferConcreteScopeIds(
  notes: string | null | undefined,
  measurements: Record<string, unknown> = {}
): string[] {
  const blob = String(notes || '').toLowerCase();
  const ids = new Set<string>();
  const areaByType =
    measurements.concreteAreaByType && typeof measurements.concreteAreaByType === 'object'
      ? (measurements.concreteAreaByType as Record<string, unknown>)
      : {};

  for (const [typeId, area] of Object.entries(areaByType)) {
    if (positiveNumber(area)) ids.add(typeId);
  }

  const structuralOnly =
    notesImplyStructuralFoundation(blob) && !notesImplyExteriorFlatwork(blob);
  if (
    !structuralOnly &&
    (/\b(?:concrete\s+patio|flatwork|sidewalk|driveway|pour\b[^.]{0,40}\b(?:driveway|slab|patio|sidewalk|walkway))\b/.test(
      blob
    ) ||
      (!/\b(?:house|garage|building|monolithic)\s+slab\b/.test(blob) &&
        /\bslab\b/.test(blob) &&
        positiveNumber(measurements.concreteSqft)) ||
      positiveNumber(measurements.concreteSqft))
  ) {
    ids.add('pour_flatwork');
    if (/\bdriveway\b/.test(blob)) ids.add('driveways');
    if (/\bsidewalk\b/.test(blob)) ids.add('sidewalks');
    if (/\bpatio\b/.test(blob)) ids.add('patios');
    if (/\brv\s+pad\b/.test(blob)) ids.add('rv_pads');
    if (/\bwalkway\b/.test(blob)) ids.add('walkways');
  }

  if (
    /\b(?:excavat(?:e|ion)|dig(?:ging)?|dig\s+out|trench(?:ing)?)\b/.test(blob) ||
    positiveNumber(measurements.excavationCy)
  ) {
    ids.add('excavation');
  }

  if (
    notesMentionGravelBase(blob) ||
    positiveNumber(measurements.gravelBaseCy)
  ) {
    ids.add('gravel_base');
  }

  if (
    /\b(?:site\s+prep|subgrade|compaction|grade\s+prep)\b/.test(blob) ||
    /\b(?:gravel\s+base|base\s+gravel)\b/.test(blob) ||
    positiveNumber(measurements.concreteSubgradePrepSqft)
  ) {
    ids.add('site_prep');
  }

  if (
    /\b(?:rebar|re[\s-]?bar|wire\s+mesh|mesh\s+reinforcement|#4\s+bar|reinforc)/.test(
      blob
    ) ||
    positiveNumber(measurements.concreteReinforcementSqft)
  ) {
    ids.add('reinforcement');
  }

  if (
    /\b(?:forms?|formwork|thickened\s+edge|edge\s+thickening|curb\s+form)\b/.test(blob) ||
    positiveNumber(measurements.complexFormingLf) ||
    positiveNumber(measurements.thickenedEdgeLf)
  ) {
    ids.add('complex_forming');
  }

  if (
    notesMentionConcretePump(blob) ||
    measurements.concretePumpReviewNeeded === true ||
    positiveNumber(measurements.concretePumpCount)
  ) {
    ids.add('concrete_pumping');
  }

  if (structuralOnly || positiveNumber(measurements.concreteCy)) {
    ids.add('pour_foundation');
  }

  return [...ids];
}

export function applyConcretePlanningMeasurements<T extends Record<string, unknown>>(
  out: T,
  notes: string | null | undefined
): T {
  const mixed = notesImplyMixedConcreteJob(notes);
  const structuralFoundation =
    notesImplyStructuralFoundation(notes) && !notesImplyExteriorFlatwork(notes);

  if (mixed) {
    let next = { ...out } as T & Record<string, unknown>;
    const foundation = applyFoundationPlanningMeasurements(next, notes, {
      preserveFlatwork: true,
    });
    if (foundation) next = { ...next, ...foundation };
    next = applyExteriorFlatworkPlanningMeasurements(next, notes) as T & Record<string, unknown>;
    const scope = mergeUniqueScopeIds(
      (foundation as Record<string, unknown> | null)?.concreteScope as string[],
      next.concreteScope as string[]
    );
    if (scope.length) next.concreteScope = scope;
    finalizeMixedConcreteZoneMeasurements(next);
    return next as T;
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
      } = out as Record<string, unknown>;
      return { ...withoutFlatwork, ...foundation } as T;
    }
  }

  return applyExteriorFlatworkPlanningMeasurements(out, notes);
}

/** Map Scope found "Pricing for …" copy back to a concrete checklist item id. */
export function resolveConcreteRevealAttentionItemId(
  pricingLabel: string
): string | null {
  const norm = pricingLabel.trim();
  for (const { re, itemId } of CONCRETE_REVEAL_LABEL_TO_ITEM_ID) {
    if (re.test(norm)) return itemId;
  }
  return null;
}

/** Checklist rows with note-backed quantities for concrete reveal. */
export function concreteRevealNoteBackedItemIds(draft: {
  originalNotes?: string | null;
  scopeChecklist?: {
    items?: Array<{ id: string; state?: string; noteBacked?: boolean }>;
  } | null;
  scopeMeasurements?: Record<string, unknown> | null;
}): Set<string> {
  const ids = new Set<string>();
  for (const item of draft.scopeChecklist?.items || []) {
    if (item.state === 'included' || item.noteBacked) ids.add(item.id);
  }
  const notes = String(draft.originalNotes || '').trim();
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const parsed = notes ? applyConcretePlanningMeasurements({}, notes) : {};
  const merged = { ...parsed, ...measurements };

  if (positiveNumber(merged.concreteSqft) != null) ids.add('pour_flatwork');
  if (positiveNumber(merged.excavationCy) != null) ids.add('excavation');
  if (positiveNumber(merged.concreteSubgradePrepSqft) != null) ids.add('site_prep');
  if (positiveNumber(merged.concreteReinforcementSqft) != null) ids.add('reinforcement');
  if (
    positiveNumber(merged.complexFormingLf) != null ||
    positiveNumber(merged.thickenedEdgeLf) != null
  ) {
    ids.add('complex_forming');
  }
  if (positiveNumber(merged.concreteCy) != null) ids.add('pour_foundation');
  if (positiveNumber(merged.concreteDemoSqft) != null) ids.add('demo_removal');
  if (positiveNumber(merged.gravelBaseCy) != null) ids.add('gravel_base');
  if (
    merged.concretePumpReviewNeeded === true ||
    positiveNumber(merged.concretePumpCount) != null
  ) {
    ids.add('concrete_pumping');
  }

  return ids;
}

export function concreteRevealHasPlanningInputs(draft: {
  scopeChecklist?: { templateKey?: string | null } | null;
  projectType?: string | null;
  scopeMeasurements?: Record<string, unknown> | null;
  originalNotes?: string | null;
}): boolean {
  const templateKey = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  if (templateKey !== 'concrete') return false;
  const notes = String(draft.originalNotes || '').trim();
  const measurements = (draft.scopeMeasurements || {}) as Record<string, unknown>;
  const parsed = notes ? applyConcretePlanningMeasurements({}, notes) : {};
  const merged = { ...parsed, ...measurements };
  return (
    positiveNumber(merged.concreteSqft) != null ||
    positiveNumber(merged.concreteCy) != null
  );
}

/** Plain-language bullets for Scope found on concrete flatwork notes. */
export function summarizeConcreteNoteBullets(
  notes: string | null | undefined,
  max = 6
): string[] {
  const parsed = applyConcretePlanningMeasurements({}, notes);
  const mixed = notesImplyMixedConcreteJob(notes);
  const bullets: string[] = [];
  const foundationCy = positiveNumber(parsed.concreteCy);
  if (mixed && foundationCy) {
    bullets.push(`Foundation / structural pour ~${foundationCy} CY`);
  }
  const sqft = positiveNumber(parsed.concreteSqft);
  const thickness = positiveNumber(parsed.concreteThicknessInches);
  if (sqft) {
    bullets.push(
      thickness
        ? `${sqft.toLocaleString()} sqft exterior flatwork · ${thickness}" thick`
        : `${sqft.toLocaleString()} sqft exterior flatwork`
    );
  }
  if (positiveNumber(parsed.excavationCy)) {
    const depth = positiveNumber(parsed.excavationDepthInches);
    bullets.push(
      mixed
        ? `Excavation ~${parsed.excavationCy} CY (foundation trench + flatwork pad)`
        : depth
          ? `Excavation ~${parsed.excavationCy} CY (${depth}" dig depth)`
          : `Excavation ~${parsed.excavationCy} CY`
    );
  }
  if (hasMixedConcreteZoneSplit(parsed)) {
    const structuralGravel = positiveNumber(parsed.concreteStructuralGravelBaseCy);
    const flatworkGravel = positiveNumber(parsed.concreteFlatworkGravelBaseCy);
    if (structuralGravel != null || flatworkGravel != null) {
      bullets.push(
        `Gravel base · structural ${structuralGravel ?? 0} CY + flatwork ${flatworkGravel ?? 0} CY`
      );
    }
    const structuralRebar = positiveNumber(parsed.concreteStructuralReinforcementSqft);
    const flatworkRebar = positiveNumber(parsed.concreteFlatworkReinforcementSqft);
    if (structuralRebar != null || flatworkRebar != null) {
      bullets.push(
        `Rebar · structural ${(structuralRebar ?? 0).toLocaleString()} sf + flatwork ${(flatworkRebar ?? 0).toLocaleString()} sf`
      );
    }
  } else if (positiveNumber(parsed.gravelBaseCy)) {
    bullets.push(`Gravel base ~${parsed.gravelBaseCy} CY (planning assumption)`);
  }
  if (positiveNumber(parsed.thickenedEdgeLf)) {
    const edgeCy = positiveNumber(parsed.thickenedEdgeCy);
    bullets.push(
      edgeCy
        ? `Thickened edge ${parsed.thickenedEdgeLf} LF · ~${edgeCy} CY extra concrete`
        : `Thickened edge ${parsed.thickenedEdgeLf} LF`
    );
  }
  if (!hasMixedConcreteZoneSplit(parsed) && positiveNumber(parsed.concreteReinforcementSqft)) {
    bullets.push('Rebar / mesh noted');
  }
  if (parsed.concretePumpReviewNeeded === true) {
    bullets.push('Pump truck may be needed — confirm access');
  }
  return bullets.slice(0, max);
}

/** Drop pre-Confirm Scope pricing noise when note-backed concrete qty exists. */
export function filterConcreteRevealAttentionItems(
  draft: {
    scopeChecklist?: { templateKey?: string | null } | null;
    projectType?: string | null;
    scopeMeasurements?: Record<string, unknown> | null;
    originalNotes?: string | null;
    scopeAssumptionsConfirmed?: boolean;
    confirmedAssumptions?: string[];
  },
  items: string[]
): string[] {
  const templateKey = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  if (templateKey !== 'concrete') return items;

  const scopeConfirmed = Boolean(
    draft.scopeAssumptionsConfirmed || draft.confirmedAssumptions?.length
  );
  const noteBacked = concreteRevealNoteBackedItemIds(draft);
  const hasPlanning = concreteRevealHasPlanningInputs(draft);

  return items.filter((item) => {
    const text = item.trim().toLowerCase();

    if (!scopeConfirmed && hasPlanning) {
      if (/pricing total not found|overall bid total|no overall bid total/.test(text)) {
        return false;
      }
      if (/permit requirements|permit fees|permit responsibility/.test(text)) {
        return false;
      }
      if (/^payment terms\b/.test(text)) return false;
      if (
        /^(?:house|garage)\s+(?:monolithic\s+)?slab\b/i.test(text) ||
        /^monolithic\s+house\s+slab\b/i.test(text)
      ) {
        return false;
      }
    }

    if (!noteBacked.size) return true;

    const pricingMatch = item.match(/^pricing for (.+?)(?:\s*\(|$)/i);
    if (!pricingMatch) return true;
    const itemId = resolveConcreteRevealAttentionItemId(pricingMatch[1]);
    return !(itemId && noteBacked.has(itemId));
  });
}
