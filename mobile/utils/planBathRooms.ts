import type { PlanRoomMeasurement } from '@/utils/estimateAiDraft';
import {
  inferWetAreaInstallSteppersFromIntent,
  mergeInferredWetAreaInstallSteppers,
  reconcileExclusiveShowerPanSteppers,
} from '@/utils/wetAreaInstallInference';

/** Wet-area finish choice that gates shower tile Quick Measurements. */
export type WetAreaFinishChoice = 'tile' | 'tub' | 'prefab';

export const WET_AREA_FINISH_OPTIONS: Array<{ id: WetAreaFinishChoice; label: string }> = [
  { id: 'tile', label: 'Tile shower' },
  { id: 'tub', label: 'Tub' },
  { id: 'prefab', label: 'Prefab' },
];

/** Typical planning allowances when tile showers are in scope (per bath). */
export const TYPICAL_SHOWER_WALL_SQFT_PER_BATH = 80;
export const TYPICAL_SHOWER_FLOOR_SQFT_PER_BATH = 15;

/**
 * Room-name patterns for baths / powders. Intentionally excludes "Primary Suite"
 * (bedroom) so ensuite baths must be labeled as baths on the plan.
 */
export const BATH_ROOM_NAME_RE =
  /\b(bath|powder|ensuite|en-suite|water\s*closet|\bw\.?\s*c\.?\b)\b/i;

export function isBathPlanRoom(name: string | null | undefined): boolean {
  return BATH_ROOM_NAME_RE.test(String(name || ''));
}

export function listBathPlanRooms(
  rooms: PlanRoomMeasurement[] | null | undefined
): PlanRoomMeasurement[] {
  return (rooms || []).filter((room) => isBathPlanRoom(room.name));
}

export function countBathPlanRooms(rooms: PlanRoomMeasurement[] | null | undefined): number {
  return listBathPlanRooms(rooms).length;
}

export function sumBathFloorSqft(rooms: PlanRoomMeasurement[] | null | undefined): number | null {
  let sum = 0;
  let hits = 0;
  for (const room of listBathPlanRooms(rooms)) {
    const area = Number(room.areaSqft);
    if (!(area > 0)) continue;
    sum += area;
    hits += 1;
  }
  return hits ? Math.round(sum * 10) / 10 : null;
}

function positiveCount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/** Photo/notes single-bath jobs split tile walls vs tile pan steppers. */
export function isSplitTileWetAreaCounts(params: {
  templateKey?: string | null;
  wholeHomeLayout?: boolean;
}): boolean {
  if (params.wholeHomeLayout) return false;
  return String(params.templateKey || '').toLowerCase() === 'bathroom';
}

/**
 * Effective wet-area finish for gating shower tile SF.
 * Tile baths win when present so prefab/tub counts can coexist without clearing tile SF.
 * Split bathroom mode: bathCount = tile walls only; tilePanBathCount drives floor finish.
 */
export function resolveEffectiveWetAreaFinish(params: {
  bathCount?: number | null;
  tilePanBathCount?: number | null;
  prefabBathCount?: number | null;
  prefabEnclosureBathCount?: number | null;
  tubBathCount?: number | null;
  wetAreaFinish?: WetAreaFinishChoice | null;
  templateKey?: string | null;
  wholeHomeLayout?: boolean;
}): WetAreaFinishChoice | null {
  const split = isSplitTileWetAreaCounts(params);
  if (split) {
    if (positiveCount(params.tilePanBathCount)) return 'tile';
    if (positiveCount(params.prefabBathCount) || positiveCount(params.prefabEnclosureBathCount)) {
      return 'prefab';
    }
    if (positiveCount(params.tubBathCount)) return 'tub';
    return params.wetAreaFinish ?? null;
  }
  if (positiveCount(params.bathCount)) return 'tile';
  if (positiveCount(params.prefabBathCount)) return 'prefab';
  if (positiveCount(params.tubBathCount)) return 'tub';
  return params.wetAreaFinish ?? null;
}

/** Shower wall planning count — split mode uses tile-wall stepper, with finish fallback. */
export function resolveShowerWallBathCount(params: {
  planRooms?: PlanRoomMeasurement[] | null;
  bathCount?: number | null;
  tilePanBathCount?: number | null;
  prefabBathCount?: number | null;
  prefabEnclosureBathCount?: number | null;
  tubBathCount?: number | null;
  bathroomFloorSqft?: number | string | null;
  wetAreaFinish?: WetAreaFinishChoice | null;
  templateKey?: string | null;
  wholeHomeLayout?: boolean;
}): number | null {
  if (isSplitTileWetAreaCounts(params)) {
    const explicit = positiveCount(params.bathCount);
    if (explicit) return explicit;
    const finish = resolveEffectiveWetAreaFinish(params);
    if (finish === 'prefab' || finish === 'tile') {
      return resolveBathCount({ ...params, wetAreaFinish: finish });
    }
    return null;
  }
  return resolveBathCount(params);
}

/** Tile shower pan count for floor SF — split mode uses tilePanBathCount stepper. */
export function resolveTilePanBathCount(params: {
  planRooms?: PlanRoomMeasurement[] | null;
  bathCount?: number | null;
  tilePanBathCount?: number | null;
  bathroomFloorSqft?: number | string | null;
  wetAreaFinish?: WetAreaFinishChoice | null;
  templateKey?: string | null;
  wholeHomeLayout?: boolean;
}): number | null {
  if (isSplitTileWetAreaCounts(params)) {
    return positiveCount(params.tilePanBathCount);
  }
  const finish = resolveEffectiveWetAreaFinish(params);
  if (finish !== 'tile') return null;
  return resolveBathCount(params);
}

/**
 * Tile-bath count for shower planning: contractor tile count first, else 1 when
 * bath floor SF is already known. Does not use labeled plan room count — that
 * can include powders/tubs and must not invent tile showers.
 */
export function resolveBathCount(params: {
  planRooms?: PlanRoomMeasurement[] | null;
  bathCount?: number | null;
  bathroomFloorSqft?: number | string | null;
  /** Single-bathroom photo/notes jobs — wet area choice implies one bath for shower estimates. */
  wetAreaFinish?: WetAreaFinishChoice | null;
  templateKey?: string | null;
}): number | null {
  const explicit = positiveCount(params.bathCount);
  if (explicit) return explicit;
  const floor = Number(String(params.bathroomFloorSqft ?? '').replace(/,/g, ''));
  if (Number.isFinite(floor) && floor > 0) return 1;
  if (
    String(params.templateKey || '').toLowerCase() === 'bathroom' &&
    params.wetAreaFinish &&
    (params.wetAreaFinish === 'tile' ||
      params.wetAreaFinish === 'prefab' ||
      params.wetAreaFinish === 'tub')
  ) {
    return 1;
  }
  return null;
}

/**
 * Shower door count for Wet area finish: explicit door count first, else
 * tile showers + prefab (tubs usually do not get glass doors).
 */
export function resolveShowerDoorCount(params: {
  showerDoorCount?: number | null;
  bathCount?: number | null;
  prefabBathCount?: number | null;
}): number | null {
  const explicit = positiveCount(params.showerDoorCount);
  if (explicit) return explicit;
  const tile = positiveCount(params.bathCount) ?? 0;
  const prefab = positiveCount(params.prefabBathCount) ?? 0;
  const sum = tile + prefab;
  return sum > 0 ? sum : null;
}

/** Map checklist wet_area_install choiceId → Quick Measurement finish. */
export function wetAreaFinishFromChecklistChoice(
  choiceId: string | null | undefined
): WetAreaFinishChoice | null {
  if (choiceId === 'tile_pan') return 'tile';
  if (choiceId === 'tub') return 'tub';
  if (choiceId === 'prefab' || choiceId === 'prefab_enclosure') return 'prefab';
  return null;
}

/** Map Quick Measurement finish → checklist wet_area_install choiceId. */
export function checklistChoiceFromWetAreaFinish(
  finish: WetAreaFinishChoice | null | undefined
): string | null {
  if (finish === 'tile') return 'tile_pan';
  if (finish === 'tub') return 'tub';
  if (finish === 'prefab') return 'prefab';
  return null;
}

/**
 * Plan-style wet-area steppers — ground-up, plan imports, and photo/notes bathroom remodels.
 */
export function shouldShowPlanWetAreaFinishSteppers(params: {
  templateKey?: string | null;
  planBathRoomCount?: number;
  wholeHomeLayout?: boolean;
  /** Single-bath photo/notes bathroom template (not whole-home plan import). */
  bathroomPhotoJob?: boolean;
}): boolean {
  if (params.bathroomPhotoJob) return true;
  if (params.wholeHomeLayout) return true;
  if ((params.planBathRoomCount ?? 0) > 0) return true;
  if (params.templateKey === 'bathroom') return false;
  return params.templateKey === 'ground_up' || params.templateKey === 'addition';
}

export type WetAreaStepperCounts = {
  bathCount: number | null;
  tilePanBathCount: number | null;
  prefabBathCount: number | null;
  prefabEnclosureBathCount: number | null;
  tubBathCount: number | null;
  showerDoorCount: number | null;
};

/** Seed stepper counts from persisted measurements, scope checklist, and notes intent. */
export function hydrateWetAreaStepperCounts(params: {
  measurements: Partial<WetAreaStepperCounts> & { wetAreaFinish?: WetAreaFinishChoice | null };
  wetAreaInstallChoiceId?: string | null;
  showerTileIncluded?: boolean;
  showerFloorTileIncluded?: boolean;
  glassDoorIncluded?: boolean;
  notes?: string | null;
  templateKey?: string | null;
  wholeHomeLayout?: boolean;
}): WetAreaStepperCounts {
  const split = isSplitTileWetAreaCounts(params);
  const base: WetAreaStepperCounts = {
    bathCount: positiveCount(params.measurements.bathCount),
    tilePanBathCount: positiveCount(params.measurements.tilePanBathCount),
    prefabBathCount: positiveCount(params.measurements.prefabBathCount),
    prefabEnclosureBathCount: positiveCount(params.measurements.prefabEnclosureBathCount),
    tubBathCount: positiveCount(params.measurements.tubBathCount),
    showerDoorCount: positiveCount(params.measurements.showerDoorCount),
  };
  if (!split) return base;
  const choice = params.wetAreaInstallChoiceId;
  if (choice === 'staying' || choice === 'not_in_scope') return base;

  const inferred = inferWetAreaInstallSteppersFromIntent({
    notes: params.notes,
    wetAreaInstallChoiceId: choice,
    showerTileIncluded: params.showerTileIncluded,
    showerFloorTileIncluded: params.showerFloorTileIncluded,
    glassDoorIncluded: params.glassDoorIncluded,
  });
  return reconcileExclusiveShowerPanSteppers(
    mergeInferredWetAreaInstallSteppers(base, inferred)
  );
}

/** Primary wet_area_install choice for legacy single-select sync. */
export function primaryWetAreaInstallChoiceFromSteppers(params: {
  counts: WetAreaStepperCounts;
  keepingExisting?: boolean;
}): string | null {
  if (params.keepingExisting) return 'staying';
  const { counts } = params;
  if (positiveCount(counts.tilePanBathCount)) return 'tile_pan';
  if (positiveCount(counts.prefabBathCount)) return 'prefab';
  if (positiveCount(counts.prefabEnclosureBathCount)) return 'prefab_enclosure';
  if (positiveCount(counts.tubBathCount)) return 'tub';
  if (positiveCount(counts.bathCount)) return null;
  return 'not_in_scope';
}
