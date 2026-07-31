import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import { checklistItemInScope } from '@/utils/scopeItemQuantities';

export const BATHROOM_DRYWALL_PATCH_REF_SQFT = 36;

export const DRYWALL_PATCH_TEXTURE_INCLUDES_SCOPE =
  'Includes drywall patching and basic texture only. Primer and paint are priced separately.';

export const DRYWALL_PATCH_PRIMER_PAINT_EXCLUDED = 'Primer and paint excluded';

export const PAINT_REPAIR_TOUCH_UP_INCLUDES =
  'Includes spot primer and localized paint touch-up';

export const PAINT_REPAIR_FULL_WALL_EXCLUDED = 'Full-wall and full-room painting excluded';

export const PAINT_REPAIR_MATCH_ASSUMPTION =
  'Assumes the existing paint color and sheen can be reasonably matched. Touch-up may remain visible on aged, faded, or specialty finishes.';

export const PAINT_REPAIR_UNSURE_STATUS =
  'Planning assumption — pricing includes localized priming and touch-up only. Repainting the full wall or room may increase the cost.';

export const DRYWALL_PAINT_WET_AREA_NOTE =
  'Shower wet-area substrate, backer board, waterproofing, and tile are priced separately.';

export const DRYWALL_PAINT_PRICING_DISCLAIMER =
  'Localized repair pricing is subject to minimum labor and mobilization charges. Painting only the patch may not produce an invisible color or sheen match, so repainting the affected wall may be recommended.';

export const DRYWALL_PAINT_INTERIOR_OVERLAP_WARNING =
  'Possible scope overlap: Painting of the repaired area may already be included in Interior painting. Review before applying both prices.';

export const DRYWALL_PAINT_COMBINED_OVERLAP_WARNING =
  'Possible scope overlap: The combined drywall repair assembly already includes patching, texture, primer, and localized paint.';

export const DRYWALL_PAINT_COMBINED_SUMMARY_LABEL =
  'Combined allowance includes localized drywall repair, basic texture blending, primer, and localized painting.';

/** @deprecated Legacy localized values — migrate to `affected_area`. */
export type BathroomPaintRepairLocalizedScope = 'touch_up' | 'affected_wall' | 'unsure';

export type BathroomPaintRepairScope = 'affected_area' | 'full_room';

export const BATHROOM_PAINT_REPAIR_SCOPE_OPTIONS: Array<{
  id: BathroomPaintRepairScope;
  label: string;
}> = [
  { id: 'affected_area', label: 'Prime, repair and paint affected area' },
  { id: 'full_room', label: 'Paint full room, patch included' },
];

/** @deprecated Use BATHROOM_PAINT_REPAIR_SCOPE_OPTIONS. */
export const BATHROOM_PAINT_REPAIR_LOCALIZED_SCOPE_OPTIONS = BATHROOM_PAINT_REPAIR_SCOPE_OPTIONS;

export const PAINT_REPAIR_FULL_ROOM_NOTE =
  'Drywall patch, texture, primer, and paint are included in the full-room scope. Enter room SF in the count field below.';

/** @deprecated Use PAINT_REPAIR_FULL_ROOM_NOTE. */
export const PAINT_REPAIR_ENTIRE_ROOM_NOTE = PAINT_REPAIR_FULL_ROOM_NOTE;

/** Paintable SF already covered by localized repair scope — deducted from entire-room quantity. */
export function estimateLocalizedPaintOverlapSqft(params: {
  localizedScope: BathroomPaintRepairLocalizedScope;
  patchSqft: number;
  showerWallTileSqft?: number | null;
}): number {
  const patch = Math.max(1, params.patchSqft);
  if (params.localizedScope === 'affected_wall') {
    const showerWall =
      params.showerWallTileSqft != null && params.showerWallTileSqft > 0
        ? params.showerWallTileSqft
        : null;
    return Math.round(Math.min(showerWall ?? Math.max(patch * 4, 80), 160));
  }
  return Math.round(patch);
}

export function resolveEntireRoomIncrementalPaintSqft(params: {
  entireRoomSqft: number;
  localizedScope?: BathroomPaintRepairLocalizedScope | null;
  patchSqft?: number | null;
  showerWallTileSqft?: number | null;
}): number {
  if (!(params.entireRoomSqft > 0)) return 0;
  if (!params.localizedScope) return Math.round(params.entireRoomSqft);
  const overlap = estimateLocalizedPaintOverlapSqft({
    localizedScope: params.localizedScope,
    patchSqft: params.patchSqft ?? BATHROOM_DRYWALL_PATCH_REF_SQFT,
    showerWallTileSqft: params.showerWallTileSqft,
  });
  return Math.max(0, Math.round(params.entireRoomSqft - overlap));
}

export function defaultBathroomEntireRoomPaintSqft(params: {
  wallPaintSqft?: string | number | null;
  bathroomFloorSqft?: string | number | null;
}): number | null {
  const fromWall = Number(String(params.wallPaintSqft ?? '').replace(/,/g, ''));
  if (Number.isFinite(fromWall) && fromWall > 0) return Math.round(fromWall);
  const floor = Number(String(params.bathroomFloorSqft ?? '').replace(/,/g, ''));
  if (Number.isFinite(floor) && floor > 0) return Math.round(floor * 3.2);
  return null;
}

export function formatBathroomFullRoomPaintSqftHint(params: {
  wallPaintSqft?: string | number | null;
  bathroomFloorSqft?: string | number | null;
}): string {
  const suggested = defaultBathroomEntireRoomPaintSqft(params);
  if (suggested != null && suggested > 0) {
    return `Enter room wall/ceiling SF in the field below. Planning suggestion: ~${suggested} SF based on your room measurements.`;
  }
  return 'Enter room wall/ceiling SF in the field below. Typical bathroom walls and ceiling: 250–450 SF.';
}

export function resolveLocalizedPaintRepairScope(
  value: string | null | undefined
): BathroomPaintRepairLocalizedScope | null {
  if (value === 'touch_up' || value === 'affected_wall' || value === 'unsure') return value;
  return null;
}

function legacyLocalizedToAffectedArea(
  value: string | null | undefined
): BathroomPaintRepairScope | null {
  const legacy = resolveLocalizedPaintRepairScope(value);
  if (legacy) return 'affected_area';
  if (value === 'affected_area' || value === 'full_room') return value;
  if (value === 'entire_room') return 'full_room';
  return null;
}

export function resolvePaintRepairEntireRoom(params: {
  entireRoom?: boolean | null;
  legacyScope?: string | null;
}): boolean {
  if (legacyLocalizedToAffectedArea(params.legacyScope) === 'full_room') return true;
  if (params.entireRoom === true) return true;
  return params.legacyScope === 'entire_room';
}

export function resolveBathroomPaintRepairScope(
  value: string | null | undefined
): BathroomPaintRepairScope | null {
  return legacyLocalizedToAffectedArea(value);
}

export function formatPaintRepairScopeSummary(params: {
  localizedScope?: string | null;
  entireRoom?: boolean | null;
  legacyScope?: string | null;
}): string {
  const scope = resolveBathroomPaintRepairScope(
    params.localizedScope ?? params.legacyScope
  );
  if (scope) {
    const label = BATHROOM_PAINT_REPAIR_SCOPE_OPTIONS.find((opt) => opt.id === scope)?.label;
    if (label) return label;
  }
  if (
    resolvePaintRepairEntireRoom({
      entireRoom: params.entireRoom,
      legacyScope: params.legacyScope ?? params.localizedScope,
    })
  ) {
    return BATHROOM_PAINT_REPAIR_SCOPE_OPTIONS.find((opt) => opt.id === 'full_room')!.label;
  }
  return 'Paint scope selected';
}

export function hasPaintRepairScopeSelection(params: {
  localizedScope?: string | null;
  entireRoom?: boolean | null;
  legacyScope?: string | null;
  scopeSource?: 'user_selected' | 'ai_inferred' | null;
}): boolean {
  // Match the Step 2 buttons: only an explicit affected-area / full-room choice
  // counts. A sticky entireRoom boolean alone must not pre-select paint pricing.
  void params.entireRoom;
  if (params.scopeSource === 'ai_inferred') return false;
  return resolveBathroomPaintRepairScope(params.localizedScope ?? params.legacyScope) != null;
}

export function sanitizeBathroomPaintRepairScopeForPersist(
  scope: string | null | undefined
): string | null {
  return resolveBathroomPaintRepairScope(scope);
}

export function sanitizeBathroomPaintRepairEntireRoom(
  entireRoom: boolean | null | undefined,
  legacyScope?: string | null
): boolean | null {
  if (resolveBathroomPaintRepairScope(legacyScope) === 'full_room') return true;
  if (resolveBathroomPaintRepairScope(legacyScope) === 'affected_area') return false;
  if (entireRoom === true || entireRoom === false) return entireRoom;
  if (legacyScope === 'entire_room') return true;
  return null;
}

export function mergeBathroomPaintRepairEntireRoom(
  saved?: boolean | null,
  suggested?: boolean | null,
  legacyScope?: string | null
): boolean | null {
  const scope = resolveBathroomPaintRepairScope(legacyScope);
  if (scope === 'full_room') return true;
  if (scope === 'affected_area') return false;
  if (saved === true || saved === false) return saved;
  if (suggested === true || suggested === false) return suggested;
  return legacyScope === 'entire_room' ? true : null;
}

export function mergeBathroomPaintRepairLocalizedScope(
  saved?: string | null,
  suggested?: string | null
): string | null {
  const fromSaved = sanitizeBathroomPaintRepairScopeForPersist(saved);
  if (fromSaved) return fromSaved;
  const fromSuggested = sanitizeBathroomPaintRepairScopeForPersist(suggested);
  if (fromSuggested) return fromSuggested;
  if (saved === 'entire_room' || suggested === 'entire_room') return 'full_room';
  return null;
}

export function scaleBathroomRepairAllowance(baseTotal: number, sqft: number): number {
  const safeSqft = Math.max(1, sqft);
  return Math.round(baseTotal * (safeSqft / BATHROOM_DRYWALL_PATCH_REF_SQFT));
}

export function splitMaterialLabor(total: number, materialRatio = 0.25): {
  material: number;
  labor: number;
} {
  const material = Math.round(total * materialRatio * 100) / 100;
  const labor = Math.round((total - material) * 100) / 100;
  return { material, labor };
}

export function drywallPatchInScope(
  items?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null
): boolean {
  if (!items?.length) return false;
  if (paintRepairInScope(items)) return true;
  return items.some(
    (row) =>
      (row.id === 'drywall' || row.id === 'patch_repair') && checklistItemInScope(row)
  );
}

export function paintRepairInScope(
  items?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null
): boolean {
  if (!items?.length) return false;
  return items.some((row) => row.id === 'paint_repair' && checklistItemInScope(row));
}

export function interiorPaintingInScope(
  items?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null
): boolean {
  if (!items?.length) return false;
  return items.some(
    (row) => (row.id === 'paint' || row.id === 'interior_paint') && checklistItemInScope(row)
  );
}

export function detectDrywallPaintInteriorOverlap(params: {
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
  paintRepairScope?: string | null;
  paintRepairEntireRoom?: boolean | null;
}): boolean {
  if (!paintRepairInScope(params.checklistItems)) return false;
  if (!interiorPaintingInScope(params.checklistItems)) return false;
  const scope = resolveBathroomPaintRepairScope(params.paintRepairScope);
  if (scope === 'full_room') return false;
  if (
    resolvePaintRepairEntireRoom({
      entireRoom: params.paintRepairEntireRoom,
      legacyScope: params.paintRepairScope,
    })
  ) {
    return false;
  }
  return scope === 'affected_area';
}

export function detectDrywallPaintCombinedOverlap(params: {
  useCombinedAssembly?: boolean | null;
  checklistItems?: Array<Pick<ScopeChecklistItem, 'id' | 'state' | 'choiceId'>> | null;
}): boolean {
  if (params.useCombinedAssembly === false) return false;
  return paintRepairInScope(params.checklistItems);
}

export function shouldUseCombinedDrywallPaintAssembly(params: {
  useCombinedAssembly?: boolean | null;
  paintRepairScope?: string | null;
}): boolean {
  if (params.useCombinedAssembly === false) return false;
  if (resolveBathroomPaintRepairScope(params.paintRepairScope) !== 'affected_area') return false;
  return params.useCombinedAssembly === true || params.useCombinedAssembly == null;
}

export function formatDrywallPatchQuantityLine(sqft: number, sourceLabel?: string | null): string {
  const base = `${sqft} sq. ft. · ${sourceLabel || 'AI-estimated repair area'}`;
  return base;
}

export function formatPaintRepairQuantityLine(scope: BathroomPaintRepairScope): string {
  if (scope === 'full_room') return 'Full room wall and ceiling';
  return 'Affected repair area';
}

/** Step 2 missing-status copy when scope is selected but no suggested total yet. */
export function resolveBathroomPaintRepairMissingLabel(params: {
  bathroomPaintRepairScope?: string | null;
  bathroomPaintRepairEntireRoom?: boolean | null;
  enteredTakeoffSqft?: number | null;
}): string | null {
  if (
    !hasPaintRepairScopeSelection({
      localizedScope: params.bathroomPaintRepairScope,
      entireRoom: params.bathroomPaintRepairEntireRoom,
      legacyScope: params.bathroomPaintRepairScope,
    })
  ) {
    return 'Select paint scope';
  }
  const scope = resolveBathroomPaintRepairScope(params.bathroomPaintRepairScope);
  if (scope === 'full_room') {
    if (!(params.enteredTakeoffSqft != null && params.enteredTakeoffSqft > 0)) {
      return 'Enter room wall/ceiling SF';
    }
  }
  return null;
}
