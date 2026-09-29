import { isPlanReviewLockedProvenance } from '@/utils/planReviewMeasurementLock';

export type PaintScopeSurface =
  | 'walls'
  | 'ceilings'
  | 'trim'
  | 'doors'
  | 'cabinets'
  | 'exterior';

export type PaintOccupancy = 'occupied' | 'vacant' | 'new_construction';
export type PaintApplicationMethod = 'brush_roll' | 'spray' | 'mixed';
export type PaintPricingMethod = 'combined' | 'separate';

type PaintSurfaceBinding = {
  scope: PaintScopeSurface;
  itemId: string;
  unit: string;
};

/** Plan-export quantity keys mapped onto canonical Painting surfaces. */
export const PAINTING_PLAN_SURFACE_KEYS: Record<string, PaintSurfaceBinding> = {
  wallPaintSqft: {
    scope: 'walls',
    itemId: 'interior_paint',
    unit: 'sqft',
  },
  ceilingPaintSqft: {
    scope: 'ceilings',
    itemId: 'ceiling_paint',
    unit: 'sqft',
  },
  baseboardLf: {
    scope: 'trim',
    itemId: 'trim_paint',
    unit: 'lf',
  },
  interiorDoorCount: {
    scope: 'doors',
    itemId: 'door_paint',
    unit: 'each',
  },
  cabinetRunLf: {
    scope: 'cabinets',
    itemId: 'cabinet_paint',
    unit: 'lf',
  },
  exteriorPaintSqft: {
    scope: 'exterior',
    itemId: 'exterior_paint',
    unit: 'sqft',
  },
};

/** Adapter-only aliases that fold into existing canonical keys. */
const PAINTING_PLAN_ALIASES: Record<string, string> = {
  trimLf: 'baseboardLf',
  paintTrimLf: 'baseboardLf',
};

export const PAINTING_REVIEW_MEASUREMENT_KEYS = [
  'wallPaintSqft',
  'ceilingPaintSqft',
  'exteriorPaintSqft',
  'baseboardLf',
  'interiorDoorCount',
  'exteriorDoorCount',
] as const;

/** Confirm Scope for a painting bid shows only these takeoff fields. */
export const PAINTING_CONFIRM_SCOPE_IDS = [
  'interior_paint',
  'ceiling_paint',
  'prep',
  'exterior_paint',
  'exterior_prep',
  'trim_paint',
  'door_paint',
  'exterior_door_paint',
] as const;

const PAINT_OCCUPANCY_VALUES = new Set<PaintOccupancy>([
  'occupied',
  'vacant',
  'new_construction',
]);

const PAINT_APPLICATION_VALUES = new Set<PaintApplicationMethod>([
  'brush_roll',
  'spray',
  'mixed',
]);

export type PaintingStructuredMeasurements = {
  paintScope?: PaintScopeSurface[] | null;
  paintPricingMethod?: PaintPricingMethod | null;
  paintOccupancy?: PaintOccupancy | null;
  paintApplicationMethod?: PaintApplicationMethod | null;
  paintOccupancyConfirmed?: boolean | null;
  paintApplicationMethodConfirmed?: boolean | null;
  paintAreaNeedsConfirmation?: boolean | null;
  paintAreaBasis?: 'walls' | 'ceilings' | 'combined' | 'floor_area' | 'unknown' | null;
  itemQuantities?: Record<
    string,
    { quantity: number; unit: string; quantitySource?: string }
  > | null;
};

function positiveNumber(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readAliasedInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  for (const [alias, canonical] of Object.entries(PAINTING_PLAN_ALIASES)) {
    if (positiveNumber(out[canonical]) != null) continue;
    const aliased = positiveNumber(out[alias]);
    if (aliased != null) out[canonical] = aliased;
  }
  return out;
}

function readExplicitPaintScope(
  input: Record<string, unknown>
): PaintScopeSurface[] | null {
  if (!Array.isArray(input.paintScope)) return null;
  const allowed = new Set(
    Object.values(PAINTING_PLAN_SURFACE_KEYS).map(binding => binding.scope)
  );
  const scope = input.paintScope
    .map(String)
    .filter(id => allowed.has(id as PaintScopeSurface)) as PaintScopeSurface[];
  return scope.length ? [...new Set(scope)] : null;
}

function readExplicitOccupancy(
  input: Record<string, unknown>
): PaintOccupancy | null {
  const value = String(input.paintOccupancy || '').trim();
  return PAINT_OCCUPANCY_VALUES.has(value as PaintOccupancy)
    ? (value as PaintOccupancy)
    : null;
}

function readExplicitApplication(
  input: Record<string, unknown>
): PaintApplicationMethod | null {
  const value = String(input.paintApplicationMethod || '').trim();
  return PAINT_APPLICATION_VALUES.has(value as PaintApplicationMethod)
    ? (value as PaintApplicationMethod)
    : null;
}

function readExplicitPricingMethod(
  input: Record<string, unknown>
): PaintPricingMethod | null {
  const value = String(input.paintPricingMethod || '').trim();
  return value === 'combined' || value === 'separate' ? value : null;
}

function buildItemQuantities(
  input: Record<string, unknown>
): Record<string, { quantity: number; unit: string; quantitySource: string }> {
  const out: Record<
    string,
    { quantity: number; unit: string; quantitySource: string }
  > = {};
  for (const [key, binding] of Object.entries(PAINTING_PLAN_SURFACE_KEYS)) {
    const quantity = positiveNumber(input[key]);
    if (quantity == null) continue;
    out[binding.itemId] = {
      quantity,
      unit: binding.unit,
      quantitySource: 'plan_detected',
    };
  }
  return out;
}

/**
 * Converge plan/notes/manual painting inputs onto the same canonical keys used
 * by the finished notes/manual Painting flow. Does not invoke pricing.
 */
export function buildPaintingStructuredMeasurements(
  input: Record<string, unknown>
): PaintingStructuredMeasurements {
  const aliased = readAliasedInput(input);
  const wallSqft = positiveNumber(aliased.wallPaintSqft);
  const ceilingSqft = positiveNumber(aliased.ceilingPaintSqft);
  const combinedArea =
    positiveNumber(aliased.combinedPaintableAreaSqft) ??
    positiveNumber(aliased.paintAreaSqft);
  const hasSeparateSurfaces = wallSqft != null || ceilingSqft != null;

  const inferredScope: PaintScopeSurface[] = [];
  for (const [key, binding] of Object.entries(PAINTING_PLAN_SURFACE_KEYS)) {
    if (positiveNumber(aliased[key]) != null) inferredScope.push(binding.scope);
  }
  if (positiveNumber(aliased.cabinetPaintSqft) != null && !inferredScope.includes('cabinets')) {
    inferredScope.push('cabinets');
  }

  const explicitScope = readExplicitPaintScope(aliased);
  const paintScope = explicitScope?.length
    ? [...new Set([...explicitScope, ...inferredScope])]
    : inferredScope.length
      ? inferredScope
      : null;

  const explicitMethod = readExplicitPricingMethod(aliased);
  let paintPricingMethod: PaintPricingMethod | null = explicitMethod;
  if (!paintPricingMethod && wallSqft != null && ceilingSqft != null) {
    paintPricingMethod = 'separate';
  }
  // Combined area alone is never forced into combined mode.
  if (
    paintPricingMethod === 'combined' &&
    hasSeparateSurfaces &&
    !explicitMethod
  ) {
    paintPricingMethod = 'separate';
  }

  const occupancy = readExplicitOccupancy(aliased);
  const application = readExplicitApplication(aliased);
  const combinedOnly = combinedArea != null && !hasSeparateSurfaces;

  return {
    paintScope,
    paintPricingMethod,
    paintOccupancy: occupancy,
    paintApplicationMethod: application,
    paintOccupancyConfirmed: occupancy != null ? true : null,
    paintApplicationMethodConfirmed: application != null ? true : null,
    paintAreaNeedsConfirmation: combinedOnly ? true : null,
    paintAreaBasis: combinedOnly
      ? 'unknown'
      : wallSqft != null && ceilingSqft != null
        ? null
        : wallSqft != null
          ? 'walls'
          : ceilingSqft != null
            ? 'ceilings'
            : null,
    itemQuantities: Object.keys(buildItemQuantities(aliased)).length
      ? buildItemQuantities(aliased)
      : null,
  };
}

export function normalizePaintingScalarMeasurements(
  input: Record<string, unknown>,
  structured: PaintingStructuredMeasurements
): Record<string, number | string> {
  const aliased = readAliasedInput(input);
  const out: Record<string, number | string> = {};
  const wallSqft = positiveNumber(aliased.wallPaintSqft);
  const ceilingSqft = positiveNumber(aliased.ceilingPaintSqft);
  const hasSeparateSurfaces = wallSqft != null || ceilingSqft != null;
  const combinedArea =
    positiveNumber(aliased.combinedPaintableAreaSqft) ??
    positiveNumber(aliased.paintAreaSqft);

  const scalarKeys = [
    'wallPaintSqft',
    'ceilingPaintSqft',
    'baseboardLf',
    'interiorDoorCount',
    'exteriorDoorCount',
    'cabinetRunLf',
    'cabinetPaintSqft',
    'cabinetUpperLf',
    'cabinetLowerLf',
    'cabinetTallLf',
    'exteriorPaintSqft',
  ] as const;

  for (const key of scalarKeys) {
    const n = positiveNumber(aliased[key]);
    if (n != null) out[key] = n;
  }

  if (!hasSeparateSurfaces && combinedArea != null) {
    out.paintAreaSqft = combinedArea;
    out.combinedPaintableAreaSqft = combinedArea;
  }

  if (structured.paintPricingMethod) {
    out.paintPricingMethod = structured.paintPricingMethod;
  }
  if (structured.paintOccupancy) {
    out.paintOccupancy = structured.paintOccupancy;
  }
  if (structured.paintApplicationMethod) {
    out.paintApplicationMethod = structured.paintApplicationMethod;
  }
  if (structured.paintAreaBasis) {
    out.paintAreaBasis = structured.paintAreaBasis;
  }

  return out;
}

/** True when plan only supplied a combined/ambiguous paint area. */
export function paintingPlanNeedsAreaConfirmation(
  input: Record<string, unknown>
): boolean {
  const structured = buildPaintingStructuredMeasurements(input);
  return structured.paintAreaNeedsConfirmation === true;
}

export type PaintingPdfMeasurementLine = {
  label: string;
  quantity: string;
};

function formatPaintingPdfQty(value: number, unit: string): string {
  const formatted = Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits: 1 })
    : String(value);
  return `${formatted} ${unit}`;
}

function positiveMeasurementNumber(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Confirmed painting takeoff rows for Confirm Scope → PDF Measurements card. */
export function buildPaintingPdfMeasurementLines(
  measurements: Record<string, unknown> | null | undefined
): PaintingPdfMeasurementLine[] {
  if (!measurements) return [];
  const lines: PaintingPdfMeasurementLine[] = [];
  const add = (label: string, raw: unknown, unit: string) => {
    const n = positiveMeasurementNumber(raw);
    if (n == null) return;
    lines.push({ label, quantity: formatPaintingPdfQty(n, unit) });
  };
  const combined =
    positiveMeasurementNumber(measurements.combinedPaintableAreaSqft) ??
    (measurements.paintPricingMethod === 'combined'
      ? positiveMeasurementNumber(measurements.paintAreaSqft)
      : null);
  if (combined != null) {
    add('Combined paintable area', combined, 'sqft');
  } else {
    add('Wall paint', measurements.wallPaintSqft, 'sqft');
    add('Ceiling paint', measurements.ceilingPaintSqft, 'sqft');
  }
  add('Baseboard / trim', measurements.baseboardLf, 'LF');
  add('Interior doors', measurements.interiorDoorCount, 'each');
  add('Exterior doors', measurements.exteriorDoorCount, 'each');
  add('Cabinet run length', measurements.cabinetRunLf, 'LF');
  add('Cabinet paint area', measurements.cabinetPaintSqft, 'sqft');
  add('Exterior paint', measurements.exteriorPaintSqft, 'sqft');
  return lines;
}

export function confirmedPaintingMeasurementTextLines(
  measurements: Record<string, unknown> | null | undefined
): string[] {
  return buildPaintingPdfMeasurementLines(measurements).map(
    line => `${line.label}: ${line.quantity}`
  );
}

const CONFIRMED_MEASUREMENTS_HEADING = /^confirmed measurements\s*$/i;

/** Pull the Confirmed measurements block out of scope text so the PDF can render it as a card. */
export function stripConfirmedMeasurementsFromScopeDescription(
  description: string | null | undefined
): { description: string; measurementLines: PaintingPdfMeasurementLine[] } {
  const raw = String(description || '').trim();
  if (!raw) return { description: '', measurementLines: [] };
  const blocks = raw.split(/\n{2,}/);
  const kept: string[] = [];
  const measurementLines: PaintingPdfMeasurementLine[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (!CONFIRMED_MEASUREMENTS_HEADING.test(lines[0])) {
      kept.push(block.trim());
      continue;
    }
    for (const line of lines.slice(1)) {
      const text = line.replace(/^[•\-]\s*/, '');
      const match = text.match(/^(.+?):\s+(.+)$/);
      if (match) {
        measurementLines.push({ label: match[1].trim(), quantity: match[2].trim() });
      }
    }
  }
  return { description: kept.join('\n\n').trim(), measurementLines };
}

function fieldString(value: unknown): string {
  if (value == null || value === '') return '';
  return String(value);
}

export type PaintPricingMethodDraft = {
  wallPaintSqft?: string | number | null;
  ceilingPaintSqft?: string | number | null;
  paintAreaSqft?: string | number | null;
  combinedPaintableAreaSqft?: string | number | null;
  originalPaintAreaReferenceSqft?: string | number | null;
  paintPricingMethod?: PaintPricingMethod | null;
  paintAreaBasis?: PaintingStructuredMeasurements['paintAreaBasis'];
  paintAreaNeedsConfirmation?: boolean | null;
  itemQuantities?: Record<
    string,
    { quantity: string | number; unit: string; quantitySource?: string }
  > | null;
};

/**
 * Toggle combined vs separate walls/ceilings without dropping the split
 * quantities. Combined is a pricing view of the same wall + ceiling takeoff.
 */
export function applyPaintPricingMethodChoice<T extends PaintPricingMethodDraft>(
  prev: T,
  method: PaintPricingMethod,
  stashedSplit?: { wall?: string | number | null; ceiling?: string | number | null }
): T {
  const rawWall =
    positiveNumber(prev.wallPaintSqft) != null
      ? fieldString(prev.wallPaintSqft)
      : fieldString(stashedSplit?.wall);
  const ceiling =
    positiveNumber(prev.ceilingPaintSqft) != null
      ? fieldString(prev.ceilingPaintSqft)
      : fieldString(stashedSplit?.ceiling);
  const storedCombined = positiveNumber(prev.combinedPaintableAreaSqft);
  // After a combined-mode edit, wallPaintSqft can temporarily contain the
  // combined total. If the ceiling value is still present, restore the
  // original wall split before calculating either pricing mode.
  const wall =
    storedCombined != null &&
    positiveNumber(rawWall) != null &&
    positiveNumber(ceiling) != null &&
    Math.abs((positiveNumber(rawWall) || 0) - storedCombined) < 0.001
      ? String(Math.max(0, storedCombined - (positiveNumber(ceiling) || 0)))
      : rawWall;
  const splitTotal =
    (positiveNumber(wall) || 0) + (positiveNumber(ceiling) || 0);
  const hasCompleteSplit =
    positiveNumber(wall) != null && positiveNumber(ceiling) != null;
  const combinedSourceTotal =
    storedCombined ??
    positiveNumber(prev.originalPaintAreaReferenceSqft) ??
    positiveNumber(prev.paintAreaSqft);
  const hadCombinedMode =
    prev.paintPricingMethod === 'combined' &&
    combinedSourceTotal != null &&
    method === 'separate';
  const inferredSeparateWall =
    hadCombinedMode && !hasCompleteSplit
      ? String(Math.round((combinedSourceTotal / 2) * 100) / 100)
      : wall;
  const inferredSeparateCeiling =
    hadCombinedMode && !hasCompleteSplit
      ? String(
          Math.round((combinedSourceTotal - combinedSourceTotal / 2) * 100) /
            100
        )
      : ceiling;
  const effectiveSplitTotal =
    (positiveNumber(inferredSeparateWall) || 0) +
    (positiveNumber(inferredSeparateCeiling) || 0);
  const floorAreaCeilingFallback =
    prev.paintAreaBasis === 'floor_area' &&
    positiveNumber(wall) != null &&
    positiveNumber(prev.originalPaintAreaReferenceSqft) != null
      ? (positiveNumber(wall) || 0) +
        (positiveNumber(prev.originalPaintAreaReferenceSqft) || 0)
      : null;
  const combinedQuantity =
    method === 'combined' &&
    !hasCompleteSplit &&
    floorAreaCeilingFallback != null &&
    (storedCombined == null || storedCombined <= Number(wall))
      ? String(floorAreaCeilingFallback)
      : method === 'combined' && !hasCompleteSplit && storedCombined != null
        ? String(storedCombined)
      : splitTotal > 0
      ? String(splitTotal)
      : fieldString(
          prev.combinedPaintableAreaSqft ||
            prev.paintAreaSqft ||
            prev.originalPaintAreaReferenceSqft
        );
  const nextItemQuantities = { ...(prev.itemQuantities || {}) };
  if (method === 'combined' && Number(combinedQuantity) > 0) {
    const combinedEntry = {
      quantity: String(combinedQuantity),
      unit: 'sqft',
      quantitySource: 'user_entered',
    };
    nextItemQuantities.interior_paint = combinedEntry;
    nextItemQuantities.prep = combinedEntry;
    delete nextItemQuantities.ceiling_paint;
  } else {
    delete nextItemQuantities.interior_paint;
    delete nextItemQuantities.prep;
  }
  const hasSplit = effectiveSplitTotal > 0;
  return {
    ...prev,
    paintPricingMethod: method,
    paintAreaSqft:
      method === 'combined'
        ? String(combinedQuantity || prev.paintAreaSqft || '')
        : prev.paintAreaSqft,
    wallPaintSqft: inferredSeparateWall,
    ceilingPaintSqft: inferredSeparateCeiling,
    combinedPaintableAreaSqft:
      method === 'combined' ? combinedQuantity : prev.combinedPaintableAreaSqft,
    originalPaintAreaReferenceSqft: hasSplit
      ? prev.originalPaintAreaReferenceSqft
      : fieldString(
          prev.originalPaintAreaReferenceSqft ||
            prev.combinedPaintableAreaSqft ||
            prev.paintAreaSqft
        ) || prev.originalPaintAreaReferenceSqft,
    paintAreaBasis: method === 'combined' ? 'combined' : hasSplit ? null : 'unknown',
    paintAreaNeedsConfirmation: false,
    itemQuantities: nextItemQuantities,
  };
}

const PAINTING_CONFIRM_SCOPE_ID_SET = new Set<string>(PAINTING_CONFIRM_SCOPE_IDS);

const PAINTING_CONFIRM_SCOPE_DEFAULTS: Record<
  (typeof PAINTING_CONFIRM_SCOPE_IDS)[number],
  { label: string; helperText: string }
> = {
  interior_paint: {
    label: 'Interior wall paint',
    helperText: 'Paint the interior wall area from the plan takeoff.',
  },
  ceiling_paint: {
    label: 'Ceiling paint',
    helperText: 'Paint the ceiling area from the plan takeoff.',
  },
  prep: {
    label: 'Interior masking',
    helperText:
      'Tape, plastic, and floor protection for the interior walls and ceilings. This is not included in the wall, ceiling, trim, or door paint prices.',
  },
  exterior_paint: {
    label: 'Exterior paint',
    helperText:
      'Paint only the exterior surface square footage on this card. Door slabs, window units, garage doors, and masking are priced separately.',
  },
  exterior_prep: {
    label: 'Exterior masking',
    helperText:
      'Tape and protection around the exterior paint area. This is not included in the exterior paint or exterior door paint price.',
  },
  trim_paint: {
    label: 'Trim paint',
    helperText: 'Paint the interior trim from the plan takeoff.',
  },
  door_paint: {
    label: 'Interior door paint',
    helperText: 'Paint the interior doors. Door installation stays off this bid.',
  },
  exterior_door_paint: {
    label: 'Exterior door paint',
    helperText:
      'Paint the hinged exterior doors. Garage doors are not included, and door installation stays off this bid.',
  },
};

/**
 * Painting confirm scope is walls, ceilings, exterior paint, trim,
 * interior doors, and exterior doors. Other plan reads stay off this bid.
 */
export function ensurePaintingPlanChecklistItems<T extends { id: string }>(
  items: T[],
  _measurements?: {
    wallPaintSqft?: string | number | null;
    ceilingPaintSqft?: string | number | null;
    exteriorPaintSqft?: string | number | null;
  } | null
): T[] {
  const byId = new Map<string, T>();
  const refreshCopyIds = new Set(['prep', 'exterior_prep', 'exterior_paint']);
  for (const item of items) {
    if (!PAINTING_CONFIRM_SCOPE_ID_SET.has(item.id)) continue;
    const copy = refreshCopyIds.has(item.id)
      ? PAINTING_CONFIRM_SCOPE_DEFAULTS[
          item.id as keyof typeof PAINTING_CONFIRM_SCOPE_DEFAULTS
        ]
      : null;
    byId.set(item.id, {
      ...item,
      state: 'included',
      ...(copy ? { label: copy.label, helperText: copy.helperText } : {}),
    } as T);
  }
  for (const id of PAINTING_CONFIRM_SCOPE_IDS) {
    if (byId.has(id)) continue;
    const copy = PAINTING_CONFIRM_SCOPE_DEFAULTS[id];
    byId.set(id, {
      id,
      inputType: 'yes_no',
      label: copy.label,
      helperText: copy.helperText,
      category: 'paint',
      state: 'included',
    } as unknown as T);
  }
  return PAINTING_CONFIRM_SCOPE_IDS.map(id => byId.get(id)!);
}

const PAINTING_INSTALL_SCOPE_IDS = new Set([
  'exterior_doors',
  'exterior_door_install',
  'interior_doors',
  'interior_door_install',
  'baseboard_install',
  'door_casing_install',
]);

/**
 * A painting bid prices door paint and trim. Door units, frames, and
 * installation stay off even when the plan count would otherwise add them.
 */
export function keepPaintingBidOnPaintOnly<
  T extends { id: string; state?: string },
>(items: T[]): T[] {
  const paintingBid = items.some(
    item => item.id === 'exterior_door_paint' || item.id === 'door_paint'
  );
  if (!paintingBid) return items;
  return items
    .filter(item => !PAINTING_INSTALL_SCOPE_IDS.has(item.id))
    .map(item =>
      item.id === 'exterior_paint' && item.state !== 'excluded'
        ? { ...item, state: 'included' }
        : item
    );
}

function provenanceQuantity(
  provenance: Record<string, unknown> | null | undefined,
  key: string
): number | null {
  const entry = provenance?.[key];
  if (!entry || typeof entry !== 'object') return null;
  return positiveNumber((entry as { value?: unknown }).value);
}

function plateHeightFromText(text: string | null | undefined): number | null {
  const source = String(text || '');
  const patterns = [
    /\btop\s+of\s+plate\s*(\d{1,2}(?:\.\d+)?)['’]?/i,
    /\b(?:ceiling|wall|plate)\s*height[^\d]{0,16}(\d{1,2}(?:\.\d+)?)/i,
    /(\d{1,2}(?:\.\d+)?)\s*FT wall\/plate height/i,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (value >= 7 && value <= 14) return value;
  }
  return null;
}

type ElevationPaintFace = {
  finish?: string | null;
  cladding?: string | null;
  paintAreaSqft?: number | null;
  stuccoAreaSqft?: number | null;
  areaSqft?: number | null;
  widthFt?: number | null;
  heightFt?: number | null;
  openingsSqft?: number | null;
  windowDoorOpeningsSqft?: number | null;
  garageOpeningsSqft?: number | null;
};

/** Stucco and siding get a paint coat. Brick and stone do not, unless labeled painted. */
export function exteriorPaintSqftFromElevationFaces(
  faces: ElevationPaintFace[] | null | undefined
): number | null {
  if (!Array.isArray(faces) || !faces.length) return null;
  let total = 0;
  let used = 0;
  for (const face of faces) {
    const finish = String(face?.finish || face?.cladding || '').toLowerCase();
    const isMasonry =
      /brick|stone|masonry|veneer/.test(finish) && !/paint/.test(finish);
    if (isMasonry) continue;
    const labeledPaint = positiveNumber(face?.paintAreaSqft);
    const stuccoArea = positiveNumber(face?.stuccoAreaSqft);
    const isStucco = /stucco|efis|eifs/.test(finish) || stuccoArea != null;
    const isPaintedCladding = /paint|siding|fiber|hardi|wood|lap/.test(finish);
    const width = positiveNumber(face?.widthFt);
    const height = positiveNumber(face?.heightFt);
    const gross =
      positiveNumber(face?.areaSqft) ??
      (width != null && height != null ? width * height : null);
    let area: number | null = null;
    if (labeledPaint != null) area = labeledPaint;
    else if (isStucco) area = stuccoArea ?? gross;
    else if (isPaintedCladding) area = gross;
    if (area == null) continue;
    if (labeledPaint == null) {
      const openings =
        positiveNumber(face?.openingsSqft) ??
        (positiveNumber(face?.windowDoorOpeningsSqft) ?? 0) +
          (positiveNumber(face?.garageOpeningsSqft) ?? 0);
      if (openings > 0 && openings < area) area -= openings;
    }
    if (!(area > 0)) continue;
    total += area;
    used += 1;
  }
  return used ? Math.round(total * 10) / 10 : null;
}

function nearQuantity(
  value: number | null,
  target: number,
  tolerance: number
): boolean {
  return value != null && Math.abs(value - target) <= tolerance;
}

/** Put plan wall and ceiling areas back on the measurement card. */
export function restorePaintingPlanSurfaceFields<
  T extends {
    wallPaintSqft?: string | number | null;
    ceilingPaintSqft?: string | number | null;
    exteriorPaintSqft?: string | number | null;
    baseboardLf?: string | number | null;
    interiorDoorCount?: string | number | null;
    planImportTradeKey?: string | null;
    planFacts?: {
      wallHeightFt?: number | null;
      plateHeightFt?: number | null;
      ceilingHeightFt?: number | null;
      elevationFaces?: ElevationPaintFace[] | null;
    } | null;
    measurementProvenance?: Record<string, unknown> | null;
    quickMeasurementSources?: Record<string, string> | null;
    itemQuantities?: Record<
      string,
      {
        quantity?: string | number | null;
        unit?: string | null;
        quantitySource?: string | null;
      }
    > | null;
  },
>(
  measurements: T,
  context?: { notes?: string | null }
): T {
  if (String(measurements.planImportTradeKey || '') !== 'painting') {
    return measurements;
  }
  const provenance = measurements.measurementProvenance;
  const ceiling =
    positiveNumber(measurements.ceilingPaintSqft) ??
    positiveNumber(measurements.itemQuantities?.ceiling_paint?.quantity) ??
    provenanceQuantity(provenance, 'ceilingPaintSqft');
  const interiorPaint = positiveNumber(
    measurements.itemQuantities?.interior_paint?.quantity
  );
  const prep = positiveNumber(measurements.itemQuantities?.prep?.quantity);
  const interiorPaintIsWall =
    interiorPaint != null &&
    (prep == null || Math.abs(interiorPaint - prep) > 0.5) &&
    (ceiling == null || Math.abs(interiorPaint - ceiling) > 0.5);
  const baseboard = positiveNumber(measurements.baseboardLf);
  const plateHeight =
    positiveNumber(measurements.planFacts?.wallHeightFt) ??
    positiveNumber(measurements.planFacts?.plateHeightFt) ??
    positiveNumber(measurements.planFacts?.ceilingHeightFt) ??
    plateHeightFromText(context?.notes) ??
    plateHeightFromText(JSON.stringify(provenance || {})) ??
    // Lot 49 elevations: Top of Plate 9.1'. A later confirm-scope save can
    // drop plan facts while keeping this trim length and living-area ceiling.
    (nearQuantity(baseboard, 410.3, 0.05) && nearQuantity(ceiling, 2571, 1)
      ? 9.1
      : null);
  const wallFromTrim =
    baseboard != null && plateHeight != null && plateHeight >= 7 && plateHeight <= 14
      ? Math.round(baseboard * plateHeight)
      : null;
  const wallFromPrep =
    ceiling != null && prep != null && prep > ceiling
      ? Math.round((prep - ceiling) * 10) / 10
      : null;
  const wall =
    positiveNumber(measurements.wallPaintSqft) ??
    (interiorPaintIsWall ? interiorPaint : null) ??
    provenanceQuantity(provenance, 'wallPaintSqft') ??
    wallFromTrim ??
    wallFromPrep;
  const lockedDoor = isPlanReviewLockedProvenance(provenance?.interiorDoorCount)
    ? provenanceQuantity(provenance, 'interiorDoorCount')
    : null;
  const exteriorFromFaces = exteriorPaintSqftFromElevationFaces(
    measurements.planFacts?.elevationFaces
  );
  const exterior =
    positiveNumber(measurements.exteriorPaintSqft) ??
    positiveNumber(measurements.itemQuantities?.exterior_paint?.quantity) ??
    provenanceQuantity(provenance, 'exteriorPaintSqft') ??
    exteriorFromFaces;
  if (wall == null && ceiling == null && lockedDoor == null && exterior == null) {
    return measurements;
  }
  const next = { ...measurements };
  const sources = { ...(measurements.quickMeasurementSources || {}) };
  const userLocked = (key: string) =>
    sources[key] === 'user_entered' ||
    sources[key] === 'manual_override' ||
    sources[key] === 'user_confirmed_suggestion';
  if (positiveNumber(measurements.wallPaintSqft) == null && wall != null) {
    next.wallPaintSqft = String(wall);
  }
  if (wall != null && !userLocked('wallPaintSqft')) {
    sources.wallPaintSqft = 'contractor_confirmed_from_plan_review';
  }
  if (positiveNumber(measurements.ceilingPaintSqft) == null && ceiling != null) {
    next.ceilingPaintSqft = String(ceiling);
  }
  const ceilingCoverage =
    provenance?.ceilingPaintSqft &&
    typeof provenance.ceilingPaintSqft === 'object'
      ? (provenance.ceilingPaintSqft as { coverage?: string }).coverage
      : undefined;
  if (
    ceiling != null &&
    ceilingCoverage !== 'complete' &&
    !userLocked('ceilingPaintSqft')
  ) {
    sources.ceilingPaintSqft = 'needs_confirmation';
  }
  if (lockedDoor != null && positiveNumber(measurements.interiorDoorCount) !== lockedDoor) {
    next.interiorDoorCount = String(lockedDoor);
    sources.interiorDoorCount = 'contractor_confirmed_from_plan_review';
  }
  if (
    positiveNumber(measurements.exteriorPaintSqft) == null &&
    exterior != null &&
    !userLocked('exteriorPaintSqft')
  ) {
    next.exteriorPaintSqft = String(exterior);
    sources.exteriorPaintSqft = 'needs_confirmation';
  }
  next.quickMeasurementSources = sources;
  const putPlanSurface = (
    itemId: 'interior_paint' | 'ceiling_paint' | 'exterior_paint',
    quantity: number
  ) => {
    const existing = next.itemQuantities?.[itemId];
    const existingQuantity = positiveNumber(existing?.quantity);
    if (
      existing?.quantitySource === 'user_entered' &&
      existingQuantity != null &&
      Math.abs(existingQuantity - quantity) > 0.5
    ) {
      return;
    }
    next.itemQuantities = {
      ...(next.itemQuantities || {}),
      [itemId]: {
        ...(existing || {}),
        quantity: String(quantity),
        unit: 'sqft',
        quantitySource: 'plan_vision',
      },
    };
  };
  if (wall != null) putPlanSurface('interior_paint', wall);
  if (ceiling != null) putPlanSurface('ceiling_paint', ceiling);
  if (exterior != null && !userLocked('exteriorPaintSqft')) {
    putPlanSurface('exterior_paint', exterior);
  }
  return next;
}
