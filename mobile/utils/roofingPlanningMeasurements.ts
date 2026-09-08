import type { ParsedScopeMeasurements } from '@/utils/scopeMeasurementParser';

export type RoofingPlanningMeasurementKey =
  | 'roofDripEdgeLf'
  | 'roofIceWaterShieldSqft'
  | 'roofRidgeCapLf'
  | 'roofPipeBootCount';

/** Rough perimeter from roof footprint area (square-footprint planning assumption). */
export function estimatedRoofPerimeterLf(roofSquares: number): number {
  const footprintSqft = roofSquares * 100;
  return Math.round(4 * Math.sqrt(footprintSqft));
}

/** Eave-only ice & water strip: ~half the perimeter × 3 ft width. */
export function estimatedIceWaterShieldSqft(roofSquares: number): number {
  const perimeter = estimatedRoofPerimeterLf(roofSquares);
  return Math.round((perimeter / 2) * 3);
}

/** Ridge length planning guess for a roughly square footprint. */
export function estimatedRidgeCapLf(roofSquares: number): number {
  return Math.round(Math.sqrt(roofSquares * 100));
}

const ICE_WATER_RE =
  /\b(ice\s*[&/-]\s*water(?:\s*(?:shield|membrane)?)?|ice\s+and\s+water\s*(?:shield|membrane)?|ice\s+barrier|eaves?\s+protection)\b/i;
const ICE_WATER_CONTEXT_RE = /\bice\b[^.]{0,32}\bwater\b/i;
const DRIP_EDGE_RE = /\bdrip\s*edge\b/i;
const RIDGE_CAP_RE = /\bridge\s*cap\b/i;
const PIPE_BOOTS_RE = /\bpipe\s+boots?\b/i;

const SQUARES_IN_NOTES_RE =
  /\b\d[\d,]*(?:\.\d+)?[\s-]*(?:roofing\s+)?squares?\b/i;
const SQFT_IN_NOTES_RE =
  /\b\d[\d,]*(?:\.\d+)?\s*(?:sq\.?\s*ft\.?|sqft|\bsf\b)\b/i;

function parseMeasurementNumber(
  value: string | number | null | undefined
): number | null {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Convert roof surface sqft to roofing squares (1 square = 100 sqft). */
export function squaresFromRoofAreaSqft(sqft: number): number {
  return Math.round((sqft / 100) * 100) / 100;
}

/**
 * Detect when sqft was copied into the roofSquares field (e.g. 50 sqft → 50 squares).
 */
export function roofSquaresLooksLikeSqftBleed(
  roofSquares: number,
  roofAreaSqft: number
): boolean {
  if (!(roofAreaSqft > 0) || !(roofSquares > 0)) return false;
  const expected = squaresFromRoofAreaSqft(roofAreaSqft);
  if (Math.abs(roofSquares - roofAreaSqft) < 0.01) return true;
  if (roofAreaSqft < 100 && roofSquares >= 1 && Math.abs(roofSquares - expected) > 0.1) {
    return Math.abs(roofSquares - roofAreaSqft) < 1 || roofSquares >= expected * 5;
  }
  return false;
}

function roofAreaSqftFromNotes(notes: string | null | undefined): number | null {
  const text = String(notes || '');
  if (!text.trim()) return null;
  const match = text.match(
    /\b(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sqft|\bsf\b)\b/i
  );
  if (!match) return null;
  return parseMeasurementNumber(match[1]);
}

function roofSquaresFromNotes(notes: string | null | undefined): number | null {
  const text = String(notes || '');
  if (!text.trim()) return null;
  const match = text.match(
    /\b(\d[\d,]*(?:\.\d+)?)[\s-]*(?:roofing\s+)?squares?\b/i
  );
  if (!match) return null;
  return parseMeasurementNumber(match[1]);
}

/**
 * Fix roofSquares when notes or paired roofAreaSqft show sqft was stored as squares.
 */
export function reconcileRoofSquaresFromRoofAreaSqft(
  input: {
    roofSquares?: string | number | null;
    roofAreaSqft?: string | number | null;
  },
  notes?: string | null
): { roofSquares?: string; roofAreaSqft?: string; changed: boolean } {
  const sqft =
    parseMeasurementNumber(input.roofAreaSqft) ?? roofAreaSqftFromNotes(notes);
  const squares = parseMeasurementNumber(input.roofSquares);
  if (sqft == null && squares == null) return { changed: false };

  // Notes parsed sqft but squares field was never filled (common after stale draft merge).
  if (sqft != null && squares == null) {
    const filled = squaresFromRoofAreaSqft(sqft);
    return {
      roofSquares: String(filled),
      roofAreaSqft: String(sqft),
      changed: true,
    };
  }

  if (sqft == null || squares == null) return { changed: false };

  const notesText = String(notes || '');
  const notesSaySqft = SQFT_IN_NOTES_RE.test(notesText);
  const notesSaySquares = SQUARES_IN_NOTES_RE.test(notesText);

  const shouldReconcile =
    roofSquaresLooksLikeSqftBleed(squares, sqft) ||
    (notesSaySqft &&
      !notesSaySquares &&
      squares >= 1 &&
      sqft < 100 &&
      Math.abs(squares - squaresFromRoofAreaSqft(sqft)) > 0.1);

  if (!shouldReconcile) return { changed: false };

  const fixed = squaresFromRoofAreaSqft(sqft);
  if (Math.abs(fixed - squares) < 0.001) return { changed: false };
  return {
    roofSquares: String(fixed),
    roofAreaSqft: String(sqft),
    changed: true,
  };
}

/** Apply roofing square reconciliation on scope measurement payloads. */
export function reconcileRoofingQuickMeasurements<
  T extends {
    roofSquares?: string | number | null;
    roofAreaSqft?: string | number | null;
    quickMeasurementSources?: Record<string, string> | null;
  },
>(measurements: T, notes?: string | null): T {
  let next: T = { ...measurements };
  const hadSquares = parseMeasurementNumber(measurements.roofSquares) != null;
  const hadSqft = parseMeasurementNumber(measurements.roofAreaSqft) != null;

  if (!hadSquares) {
    const squaresFromNotes = roofSquaresFromNotes(notes);
    if (squaresFromNotes != null) {
      next = { ...next, roofSquares: String(squaresFromNotes) };
    }
  }

  const reconciled = reconcileRoofSquaresFromRoofAreaSqft(next, notes);
  if (reconciled.changed) {
    next = {
      ...next,
      ...(reconciled.roofSquares != null ? { roofSquares: reconciled.roofSquares } : {}),
      ...(reconciled.roofAreaSqft != null ? { roofAreaSqft: reconciled.roofAreaSqft } : {}),
    };
  }

  const filledFromNotes =
    reconciled.changed &&
    (!hadSquares || (!hadSqft && reconciled.roofAreaSqft != null));
  if (!filledFromNotes && !reconciled.changed) return measurements;

  const sources = { ...(next.quickMeasurementSources || {}) };
  if (
    parseMeasurementNumber(next.roofSquares) != null &&
    (!sources.roofSquares || sources.roofSquares === 'calculated_from_components')
  ) {
    sources.roofSquares = 'notes';
  }
  if (
    parseMeasurementNumber(next.roofAreaSqft) != null &&
    !sources.roofAreaSqft
  ) {
    sources.roofAreaSqft = 'notes';
  }
  return {
    ...next,
    quickMeasurementSources: sources,
  };
}

/**
 * Fill roofing LF/sqft/count gaps from notes when quantities are omitted.
 * Does not override parsed note values.
 */
export function applyRoofingPlanningMeasurements(
  parsed: ParsedScopeMeasurements,
  notes: string
): ParsedScopeMeasurements & { roofingPlanningKeys?: RoofingPlanningMeasurementKey[] } {
  const text = String(notes || '').trim();
  if (!text) return parsed;

  const planningKeys: RoofingPlanningMeasurementKey[] = [
    ...((parsed as { roofingPlanningKeys?: RoofingPlanningMeasurementKey[] })
      .roofingPlanningKeys || []),
  ];
  const out: ParsedScopeMeasurements & {
    roofingPlanningKeys?: RoofingPlanningMeasurementKey[];
  } = { ...parsed };

  if (PIPE_BOOTS_RE.test(text) && !out.roofPipeBootCount) {
    out.roofPipeBootCount = 1;
    planningKeys.push('roofPipeBootCount');
  }

  const squares = Number(parsed.roofSquares);
  if (!(squares > 0)) {
    if (planningKeys.length) out.roofingPlanningKeys = planningKeys;
    return out;
  }

  if (DRIP_EDGE_RE.test(text) && !out.roofDripEdgeLf) {
    out.roofDripEdgeLf = estimatedRoofPerimeterLf(squares);
    planningKeys.push('roofDripEdgeLf');
  }
  if (
    (ICE_WATER_RE.test(text) || ICE_WATER_CONTEXT_RE.test(text)) &&
    !out.roofIceWaterShieldSqft
  ) {
    out.roofIceWaterShieldSqft = estimatedIceWaterShieldSqft(squares);
    planningKeys.push('roofIceWaterShieldSqft');
  }
  if (RIDGE_CAP_RE.test(text) && !out.roofRidgeCapLf) {
    out.roofRidgeCapLf = estimatedRidgeCapLf(squares);
    planningKeys.push('roofRidgeCapLf');
  }

  if (planningKeys.length) out.roofingPlanningKeys = planningKeys;
  return out;
}

/** Tag formula-filled roofing measurements for QM provenance (needs confirmation). */
export function mergeRoofingPlanningMeasurementSources(
  sources: Record<string, string> | null | undefined,
  planningKeys: readonly RoofingPlanningMeasurementKey[] | null | undefined
): Record<string, string> {
  if (!planningKeys?.length) return { ...(sources || {}) };
  const next = { ...(sources || {}) };
  for (const key of planningKeys) {
    if (!next[key]) next[key] = 'estimated_from_formula';
  }
  return next;
}
