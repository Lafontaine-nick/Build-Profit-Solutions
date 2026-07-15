import type { PlanRoomMeasurement } from '@/utils/estimateAiDraft';

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

/**
 * Effective wet-area finish for gating shower tile SF.
 * Tile baths win when present so prefab/tub counts can coexist without clearing tile SF.
 */
export function resolveEffectiveWetAreaFinish(params: {
  bathCount?: number | null;
  prefabBathCount?: number | null;
  tubBathCount?: number | null;
  wetAreaFinish?: WetAreaFinishChoice | null;
}): WetAreaFinishChoice | null {
  if (positiveCount(params.bathCount)) return 'tile';
  if (positiveCount(params.prefabBathCount)) return 'prefab';
  if (positiveCount(params.tubBathCount)) return 'tub';
  return params.wetAreaFinish ?? null;
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
}): number | null {
  const explicit = positiveCount(params.bathCount);
  if (explicit) return explicit;
  const floor = Number(String(params.bathroomFloorSqft ?? '').replace(/,/g, ''));
  if (Number.isFinite(floor) && floor > 0) return 1;
  return null;
}

/** Map checklist wet_area_install choiceId → Quick Measurement finish. */
export function wetAreaFinishFromChecklistChoice(
  choiceId: string | null | undefined
): WetAreaFinishChoice | null {
  if (choiceId === 'tile_pan') return 'tile';
  if (choiceId === 'tub') return 'tub';
  if (choiceId === 'prefab') return 'prefab';
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
