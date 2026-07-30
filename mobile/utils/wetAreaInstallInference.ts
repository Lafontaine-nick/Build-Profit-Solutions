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

function notesWantKeepingExistingWetArea(n: string): boolean {
  return (
    /\b(stay|staying|keep(?:ing)?\s+existing)\b[^.]{0,40}\b(tub|shower)\b/.test(n) ||
    /\b(tub|shower)\b[^.]{0,40}\b(stay|staying|keep)\b/.test(n) ||
    /\bkeeping\s+existing\s+(?:tub|shower)\b/.test(n)
  );
}

function showerJobContext(n: string): boolean {
  return /\b(shower|tub[\s-]to[\s-]shower|wet\s+area|bathroom\s+remodel)\b/.test(n);
}

function notesMentionTileShowerWalls(n: string): boolean {
  return (
    /\b(shower\s+wall\s+tile|shower\s+tile|tile\s+shower\s+walls?|new\s+shower\s+tile)\b/.test(n) ||
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
    /\b(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\s+(?:the\s+)?(?:existing\s+)?prefab\s+(?:shower\s+)?pan\b/.test(
      n
    ) ||
    /\bprefab\s+(?:shower\s+)?pan\s+(?:to\s+)?(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/.test(
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
    (showerJobContext(n) && /\btile\s+(?:the\s+)?shower\s+floor\b/.test(n))
  );
}

function notesMentionPrefabEnclosure(n: string): boolean {
  return /\b(prefab\s+shower\s+enclosure|prefab\s+enclosure|one[\s-]?piece\s+(?:shower\s+)?enclosure|prefab\s+surround)\b/.test(
    n
  );
}

function notesMentionPrefabPan(n: string): boolean {
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
  return /\b(shower\s+door|glass\s+shower\s+door|install\s+(?:a\s+)?shower\s+door)\b/.test(n);
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
  const n = String(input.notes || '').toLowerCase();
  const choice = input.wetAreaInstallChoiceId;

  if (
    choice === 'staying' ||
    choice === 'not_in_scope' ||
    (n && notesWantKeepingExistingWetArea(n))
  ) {
    return { ...EMPTY_STEPPERS };
  }

  const out: WetAreaStepperCounts = { ...EMPTY_STEPPERS };

  if (input.showerTileIncluded || notesMentionTileShowerWalls(n)) {
    out.bathCount = 1;
  }
  if (input.showerFloorTileIncluded || notesMentionTileShowerPan(n)) {
    out.tilePanBathCount = 1;
  }
  if (notesMentionPrefabEnclosure(n) || choice === 'prefab_enclosure') {
    out.prefabEnclosureBathCount = 1;
  }
  if (
    (notesMentionPrefabPan(n) || choice === 'prefab') &&
    !out.prefabEnclosureBathCount
  ) {
    out.prefabBathCount = 1;
  }
  if (notesMentionTubInstall(n) || choice === 'tub') {
    out.tubBathCount = 1;
  }
  if (choice === 'tile_pan' && !out.tilePanBathCount) {
    out.tilePanBathCount = 1;
  }
  if (notesMentionBathFloorTile(n)) {
    out.bathFloorTileCount = 1;
  }

  if (input.glassDoorIncluded || notesMentionShowerDoor(n)) {
    out.showerDoorCount = 1;
  }

  return reconcileExclusiveShowerPanSteppers(out);
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
