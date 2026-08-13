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
  'paintAreaSqft',
  'combinedPaintableAreaSqft',
  'baseboardLf',
  'interiorDoorCount',
  'cabinetRunLf',
  'cabinetPaintSqft',
  'exteriorPaintSqft',
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
  const wall =
    positiveNumber(prev.wallPaintSqft) != null
      ? fieldString(prev.wallPaintSqft)
      : fieldString(stashedSplit?.wall);
  const ceiling =
    positiveNumber(prev.ceilingPaintSqft) != null
      ? fieldString(prev.ceilingPaintSqft)
      : fieldString(stashedSplit?.ceiling);
  const splitTotal =
    (positiveNumber(wall) || 0) + (positiveNumber(ceiling) || 0);
  const combinedQuantity =
    splitTotal > 0
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
  } else {
    delete nextItemQuantities.interior_paint;
    delete nextItemQuantities.prep;
  }
  const hasSplit = splitTotal > 0;
  return {
    ...prev,
    paintPricingMethod: method,
    paintAreaSqft:
      method === 'combined'
        ? String(combinedQuantity || prev.paintAreaSqft || '')
        : prev.paintAreaSqft,
    wallPaintSqft: wall,
    ceilingPaintSqft: ceiling,
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
