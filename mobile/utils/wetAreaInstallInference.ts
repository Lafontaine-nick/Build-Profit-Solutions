import {
  bathroomAffirmativeNotes,
  notesInstallNewShowerDoor,
  notesKeepExistingWetArea,
} from '@/utils/bathroomNoteScope';
import type { WetAreaStepperCounts } from '@/utils/planBathRooms';

function positiveCount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

const EMPTY_STEPPERS: WetAreaStepperCounts = {
  bathCount: null,
  tilePanBathCount: null,
  prefabBathCount: null,
  prefabEnclosureBathCount: null,
  tubBathCount: null,
  bathFloorTileCount: null,
  showerDoorCount: null,
};

function showerJobContext(n: string): boolean {
  return /\b(shower|tub[\s-]to[\s-]shower|wet\s+area|bathroom\s+remodel)\b/.test(n);
}

function notesMentionTileShowerWalls(n: string): boolean {
  return (
    /\b(shower\s+wall\s+tile|shower\s+tile|tile\s+shower(?:\s+walls?)?|new\s+shower\s+tile)\b/.test(n) ||
    (showerJobContext(n) && /\btile\s+(?:the\s+)?(?:shower\s+)?walls?\b/.test(n))
  );
}

function notesMentionDemoTileShowerPan(n: string): boolean {
  return (
    /\b(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\s+(?:the\s+)?(?:existing\s+)?tile\s+(?:shower\s+)?pan\b/.test(
      n
    ) ||
    /\btile\s+(?:shower\s+)?pan\s+(?:to\s+)?(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/.test(
      n
    )
  );
}

function notesMentionDemoPrefabPan(n: string): boolean {
  return (
    /\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out|haul(?:ed)?[\s-]?off)\b[^.]{0,70}\bprefab\s+(?:shower\s+)?pan\b/.test(
      n
    ) ||
    /\bprefab\s+(?:shower\s+)?pan\b[^.]{0,80}\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out|coming out)\b/.test(
      n
    )
  );
}

function notesMentionTileShowerPan(n: string): boolean {
  // Tear-out "demo tile shower pan" is existing condition — not new install.
  if (notesMentionDemoTileShowerPan(n) && !/\b(and|install|new|retile)\s+tile\s+shower\s+pan\b/.test(n)) {
    return false;
  }
  return (
    /\b(shower\s+floor\s+tile|tile\s+shower\s+floor|tile\s+shower\s+pan)\b/.test(n) ||
    /\b(tile\s+pan|mud\s+pan|mortar\s+bed|hot\s+mop|custom\s+pan)\b/.test(n) ||
    (notesMentionTileShowerWalls(n) &&
      /\b(?:install|new|with|and)\b[^.]{0,45}\bshower\s+pan\b/.test(n) &&
      !notesMentionPrefabPan(n)) ||
    (showerJobContext(n) && /\btile\s+(?:the\s+)?shower\s+floor\b/.test(n))
  );
}

function notesMentionPrefabEnclosure(n: string): boolean {
  return /\b(prefab\s+shower\s+enclosure|prefab\s+enclosure|one[\s-]?piece\s+(?:shower\s+)?enclosure|prefab\s+surround)\b/.test(
    n
  );
}

/** Install count only. A surround that is coming out is demo, not a new enclosure. */
function notesMentionPrefabEnclosureInstall(n: string): boolean {
  if (
    /\b(?:install|new|replace)\b[^.]{0,60}\bprefab\s+(?:shower\s+)?(?:enclosure|surround)\b/.test(
      n
    )
  ) {
    return true;
  }
  if (
    /\bprefab\s+(?:shower\s+)?(?:enclosure|surround)\b[^.]{0,40}\b(?:install|new)\b/.test(
      n
    )
  ) {
    return true;
  }
  return (
    /\b(?:prefab\s+shower\s+enclosure|prefab\s+enclosure)\b/.test(n) &&
    !/\bprefab\s+(?:shower\s+)?pan\b/.test(n)
  );
}

function notesMentionPrefabPan(n: string): boolean {
  if (/\b(?:install|new)\b[^.]{0,50}\bprefab\s+(?:shower\s+)?pan\b/.test(n)) {
    return true;
  }
  if (notesMentionPrefabEnclosure(n)) return false;
  // "demo prefab shower pan" is tear-out — do not treat as installing a new prefab pan.
  if (notesMentionDemoPrefabPan(n) && !/\b(install|new)\b[^.]{0,50}\bprefab\s+(?:shower\s+)?pan\b/.test(n)) {
    return false;
  }
  return /\b(prefab\s+shower\s+pan|prefab\s+pan|install\s+(?:a\s+)?prefab|acrylic\s+(?:shower\s+)?pan|fiberglass\s+pan|pan\s+insert)\b/.test(
    n
  );
}

function notesMentionTubInstall(n: string): boolean {
  if (
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,50}\b(tub|bathtub)\b/.test(n) &&
    !/\b(install|new)\b[^.]{0,50}\b(tub|bathtub)\b/.test(n)
  ) {
    return false;
  }
  return /\b(tub\s+install|install\s+(?:a\s+)?(?:new\s+)?(?:alcove\s+|freestanding\s+)?tub|new\s+tub(?:\s+install)?)\b/.test(
    n
  );
}

function notesMentionBathFloorTile(n: string): boolean {
  // Explicit bath-floor install only — never treat shower floor tile as bath floor.
  if (/\b(tile\s+bath(?:room)?\s+floor|bath(?:room)?\s+floor\s+tile|tile\s+(?:the\s+)?bath(?:room)?\s+floor)\b/.test(n)) {
    return true;
  }
  if (/\b(?:install|retile|new)\b[^.]{0,40}\bbath(?:room)?\s+floor(?:\s+tile)?\b/.test(n)) {
    return true;
  }
  // Bare "floor tile" / "tile floor" only when notes have no shower context.
  if (/\bshower\b/.test(n)) return false;
  if (/\b(?:new\s+)?floor\s+tile\b/.test(n) || /\btile\s+floor\b/.test(n)) {
    if (/\b(demo|remove|tear[\s-]?out)\b[^.]{0,40}\b(?:floor\s+tile|tile\s+floor)\b/.test(n)) {
      return false;
    }
    return true;
  }
  return false;
}

function notesMentionShowerDoor(n: string): boolean {
  return notesInstallNewShowerDoor(n);
}

export type WetAreaInstallInferenceInput = {
  notes?: string | null;
  wetAreaInstallChoiceId?: string | null;
  showerTileIncluded?: boolean;
  showerFloorTileIncluded?: boolean;
  bathFloorTileIncluded?: boolean;
  glassDoorIncluded?: boolean;
};

/** Infer QM wet-area install steppers from notes + scope checklist (photo or notes-only). */
export function inferWetAreaInstallSteppersFromIntent(
  input: WetAreaInstallInferenceInput
): WetAreaStepperCounts {
  const n = bathroomAffirmativeNotes(input.notes).toLowerCase();
  const choice = input.wetAreaInstallChoiceId;

  if (
    choice === 'staying' ||
    choice === 'not_in_scope' ||
    notesKeepExistingWetArea(input.notes)
  ) {
    return { ...EMPTY_STEPPERS };
  }

  const out: WetAreaStepperCounts = { ...EMPTY_STEPPERS };
  const notesPresent = Boolean(n);
  // A saved bathroom checklist marks tile rows included by default.
  // Once the note is present, only the note can turn those steppers on.
  if (notesMentionTileShowerWalls(n) || (!notesPresent && input.showerTileIncluded)) {
    out.bathCount = 1;
  }
  if (notesMentionTileShowerPan(n) || (!notesPresent && input.showerFloorTileIncluded)) {
    out.tilePanBathCount = 1;
  }
  if (notesMentionPrefabEnclosureInstall(n) || choice === 'prefab_enclosure') {
    out.prefabEnclosureBathCount = 1;
  }
  if (notesMentionPrefabPan(n) || choice === 'prefab') {
    if (
      !out.prefabEnclosureBathCount ||
      /\b(?:install|new)\b[^.]{0,50}\bprefab\s+(?:shower\s+)?pan\b/.test(n)
    ) {
      out.prefabBathCount = 1;
    }
  }
  if (notesMentionTubInstall(n) || choice === 'tub') {
    out.tubBathCount = 1;
  }
  if (
    choice === 'tile_pan' &&
    !out.tilePanBathCount &&
    !notesMentionPrefabPan(n)
  ) {
    out.tilePanBathCount = 1;
  }
  if (notesMentionBathFloorTile(n)) {
    out.bathFloorTileCount = 1;
  }

  if ((!notesPresent && input.glassDoorIncluded) || notesMentionShowerDoor(n)) {
    out.showerDoorCount = 1;
  }

  return reconcileExclusiveShowerPanSteppers(
    out,
    notesMentionPrefabPan(n) && !notesMentionTileShowerPan(n)
      ? 'prefab_pan'
      : undefined
  );
}

/** Tile mud pan and prefab pan are mutually exclusive — one floor finish per shower. */
export function reconcileExclusiveShowerPanSteppers(
  counts: WetAreaStepperCounts,
  prefer?: 'tile_pan' | 'prefab_pan'
): WetAreaStepperCounts {
  const tilePan = positiveCount(counts.tilePanBathCount);
  const prefabPan = positiveCount(counts.prefabBathCount);
  if (!tilePan || !prefabPan) return counts;
  if (prefer === 'prefab_pan') {
    return { ...counts, tilePanBathCount: null };
  }
  return { ...counts, prefabBathCount: null };
}

/** Fill unset install steppers from inferred intent — saved/user counts win. */
export function mergeInferredWetAreaInstallSteppers(
  base: WetAreaStepperCounts,
  inferred: WetAreaStepperCounts
): WetAreaStepperCounts {
  const keys = Object.keys(EMPTY_STEPPERS) as (keyof WetAreaStepperCounts)[];
  const out = { ...base };
  for (const key of keys) {
    if (positiveCount(out[key]) == null && positiveCount(inferred[key]) != null) {
      out[key] = inferred[key];
    }
  }
  return reconcileExclusiveShowerPanSteppers(out);
}

/** Merge inference into saved counts, then drop steppers notes no longer support (stale draft fields). */
export function applyNotesInferredWetAreaInstallSteppers(
  base: WetAreaStepperCounts,
  inferred: WetAreaStepperCounts,
  options?: { notes?: string | null }
): WetAreaStepperCounts {
  const notesDriven = Boolean(String(options?.notes ?? '').trim());
  const merged = mergeInferredWetAreaInstallSteppers(base, inferred);
  if (!notesDriven) return merged;
  const keys = Object.keys(EMPTY_STEPPERS) as (keyof WetAreaStepperCounts)[];
  const out = { ...merged };
  for (const key of keys) {
    if (positiveCount(inferred[key]) == null) {
      out[key] = null;
    }
  }
  return reconcileExclusiveShowerPanSteppers(out);
}
