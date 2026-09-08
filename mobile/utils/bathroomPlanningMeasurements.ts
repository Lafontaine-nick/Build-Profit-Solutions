import { defaultBathroomEntireRoomPaintSqft } from '@/utils/bathroomDrywallPaintScope';
import type { ParsedScopeMeasurements } from '@/utils/scopeMeasurementParser';
import type { ScopeMeasurementsInputExtended } from '@/utils/scopeItemQuantities';

function isBathroomContext(ctx: {
  templateKey?: string | null;
  projectType?: string | null;
}): boolean {
  const templateKey = String(ctx.templateKey || '').toLowerCase();
  const projectType = String(ctx.projectType || '').toLowerCase();
  return templateKey === 'bathroom' || projectType === 'bathroom';
}

/** Paint the full room when notes mention paint without patch-only language. */
export function notesImplyBathroomFullRoomPaint(
  notes: string | null | undefined
): boolean {
  const blob = String(notes || '').toLowerCase();
  if (!/\bpaint(?:ing)?\b/.test(blob)) return false;
  if (
    /\bpatch\b|\btouch[\s-]?up\b|\bspot\s+prime\b|\blocalized\b|\bdrywall\s+repair\b/.test(
      blob
    )
  ) {
    return false;
  }
  return true;
}

/** Parse vanity width from notes — e.g. 36" vanity or 48" double vanity → LF cabinet run. */
export function parseVanityCabinetLfFromNotes(
  notes: string | null | undefined
): number | null {
  const text = String(notes || '');
  const match =
    text.match(
      /\b(\d{2,3})\s*(?:"|''|inch(?:es)?|in\.?)\s*(?:(?:wide|double|single)\s+)?vanity\b/i
    ) ||
    text.match(
      /\b(\d{2,3})\s*(?:"|''|inch(?:es)?|in\.?)\s+\w+\s+vanity\b/i
    ) ||
    text.match(/\bvanity\s*(\d{2,3})\s*(?:"|''|inch(?:es)?|in\.?)\b/i) ||
    text.match(/\b(\d{2,3})\s*[-\s]?inch\s+(?:double|single\s+)?vanity\b/i);
  if (!match) return null;
  const inches = Number(match[1]);
  if (!(inches >= 24 && inches <= 96)) return null;
  return Math.round((inches / 12) * 10) / 10;
}

/** Homeowner/customer provides vanity and/or toilet fixtures — labor-only install bid. */
export function notesCustomerSuppliesBathroomFixtures(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '').toLowerCase();
  return (
    /\b(?:customer|homeowner|owner|client)\s+supply(?:ing|s)?\b[^.;]{0,100}\b(?:vanity|toilet|fixtures?)\b/.test(
      text
    ) ||
    /\b(?:vanity|toilet)\s+fixtures?\b[^.;]{0,60}\b(?:customer|homeowner|owner|client)\s+supply/.test(
      text
    ) ||
    /\bfixtures?\s+(?:are\s+)?(?:customer|owner|homeowner)[\s-]supplied\b/.test(
      text
    ) ||
    (/\bwe\s+install\s+only\b/.test(text) &&
      /\b(?:customer|homeowner|owner|client)\s+supply/.test(text))
  );
}

function parseMeasurementNumber(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Clear paint QM bleed from unrelated nearest-neighbor sqft parses (floor, shower, etc.). */
function clearBathroomPaintMeasurementBleed(
  out: ParsedScopeMeasurements,
  notes: string
): void {
  if (!notesImplyBathroomFullRoomPaint(notes)) return;
  const bathFloor = out.bathroomFloorSqft ?? null;
  const roomSqft = defaultBathroomEntireRoomPaintSqft({
    wallPaintSqft: null,
    bathroomFloorSqft: bathFloor,
  });

  if (bathFloor != null && out.ceilingPaintSqft === bathFloor) {
    delete out.ceilingPaintSqft;
  }
  if (
    bathFloor != null &&
    (out.combinedPaintableAreaSqft === bathFloor ||
      out.paintAreaSqft === bathFloor)
  ) {
    delete out.combinedPaintableAreaSqft;
    delete out.paintAreaSqft;
    delete out.originalPaintAreaReferenceSqft;
    out.paintAreaNeedsConfirmation = false;
  }

  if (roomSqft == null || !(roomSqft > 0)) return;

  const wallPaint = out.wallPaintSqft ?? null;
  if (
    wallPaint == null ||
    wallPaint === bathFloor ||
    wallPaint === out.showerWallTileSqft ||
    (wallPaint < roomSqft * 0.9 && bathFloor != null)
  ) {
    out.wallPaintSqft = roomSqft;
  }
}

function livingAreaLanguageInNotes(notes: string): boolean {
  return /\bliving\s+area\b|\btotal\s+living\b|\bwhole[\s-]?(?:house|home)\b|\b\d[\d,]*\s*(?:sq\.?\s*ft|sqft).{0,40}\b(?:house|home)\b/i.test(
    notes
  );
}

function clearBathroomLivingAreaBleed(
  out: ParsedScopeMeasurements,
  notes: string
): void {
  if (out.floorAreaSqft == null) return;
  if (livingAreaLanguageInNotes(notes)) return;
  if (
    out.bathroomFloorSqft != null &&
    out.floorAreaSqft === out.bathroomFloorSqft
  ) {
    delete out.floorAreaSqft;
    return;
  }
  if (out.floorAreaSqft <= 200) {
    delete out.floorAreaSqft;
  }
}

function clearShowerWallPaintBleed(out: ParsedScopeMeasurements): void {
  if (
    out.wallPaintSqft != null &&
    out.showerWallTileSqft != null &&
    out.wallPaintSqft === out.showerWallTileSqft
  ) {
    delete out.wallPaintSqft;
  }
}

function clearBathroomPaintSqftBleed(
  out: ParsedScopeMeasurements,
  notes: string
): void {
  if (!notesImplyBathroomFullRoomPaint(notes)) return;
  if (
    out.wallPaintSqft != null &&
    out.bathroomFloorSqft != null &&
    out.wallPaintSqft === out.bathroomFloorSqft
  ) {
    delete out.wallPaintSqft;
  }
}

function applyBathroomFullRoomPaintDefault(
  out: ParsedScopeMeasurements,
  notes: string
): void {
  clearBathroomPaintMeasurementBleed(out, notes);
}

/** Reconcile parsed note measurements for single-bath remodel jobs. */
export function applyBathroomPlanningMeasurements(
  parsed: ParsedScopeMeasurements,
  notes: string,
  ctx: { templateKey?: string | null; projectType?: string | null } = {}
): ParsedScopeMeasurements {
  if (!isBathroomContext(ctx)) return parsed;
  const out = { ...parsed };
  const noteText = String(notes || '');

  clearBathroomLivingAreaBleed(out, noteText);
  clearShowerWallPaintBleed(out);
  clearBathroomPaintSqftBleed(out, noteText);
  applyBathroomFullRoomPaintDefault(out, noteText);

  const vanityLf = parseVanityCabinetLfFromNotes(noteText);
  if (vanityLf != null && !(Number(out.cabinetLf) > 0)) {
    out.cabinetLf = vanityLf;
  }

  return out;
}

/** Strip living-area QM bleed on restore/hydrate for bathroom bids. */
export function reconcileBathroomQuickMeasurements<
  T extends ScopeMeasurementsInputExtended | Record<string, unknown>,
>(measurements: T, notes?: string | null): T {
  const noteText = String(notes || '');
  let next = { ...measurements } as T & Record<string, unknown>;

  const floorArea = parseMeasurementNumber(next.floorAreaSqft);
  const bathFloor = parseMeasurementNumber(next.bathroomFloorSqft);
  if (Number.isFinite(floorArea) && floorArea > 0) {
    const livingBleed =
      (bathFloor != null && floorArea === bathFloor) ||
      (floorArea <= 200 && !livingAreaLanguageInNotes(noteText));
    if (livingBleed) {
      delete next.floorAreaSqft;
    }
  }

  if (!notesImplyBathroomFullRoomPaint(noteText)) {
    return next as T;
  }

  const roomPaint = defaultBathroomEntireRoomPaintSqft({
    wallPaintSqft: null,
    bathroomFloorSqft: bathFloor,
  });
  if (roomPaint == null || !(roomPaint > 0)) {
    return next as T;
  }

  const wallPaint = parseMeasurementNumber(next.wallPaintSqft);
  const ceilingPaint = parseMeasurementNumber(next.ceilingPaintSqft);
  const combinedPaint = parseMeasurementNumber(next.combinedPaintableAreaSqft);

  if (
    wallPaint == null ||
    (bathFloor != null && wallPaint === bathFloor) ||
    wallPaint < roomPaint * 0.9
  ) {
    next.wallPaintSqft = String(roomPaint);
  }
  if (bathFloor != null && ceilingPaint === bathFloor) {
    delete next.ceilingPaintSqft;
  }
  if (bathFloor != null && combinedPaint === bathFloor) {
    delete next.combinedPaintableAreaSqft;
    delete next.paintAreaSqft;
  }

  return next as T;
}

/** Scope-found / attention noise that does not belong on bathroom remodel bids. */
export const BATHROOM_REVEAL_EXCLUDED_SCOPE_PATTERN =
  /\bgutters?\b|\bdownspouts?\b|\bmoisture\s+barrier\b|\bwater\s+mitigation\b|\bvapor\s+barrier\b/i;

export function filterBathroomRevealAttentionItems(
  draft: { scopeChecklist?: { templateKey?: string | null }; projectType?: string | null },
  items: string[]
): string[] {
  const templateKey = String(
    draft.scopeChecklist?.templateKey || draft.projectType || ''
  ).toLowerCase();
  if (templateKey !== 'bathroom') return items;
  return items.filter((item) => !BATHROOM_REVEAL_EXCLUDED_SCOPE_PATTERN.test(item));
}
