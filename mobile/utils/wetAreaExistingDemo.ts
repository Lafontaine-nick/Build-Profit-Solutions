import type { WetAreaStepperCounts } from '@/utils/planBathRooms';

function positiveCount(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export type WetAreaExistingCounts = {
  existingTubCount: number | null;
  existingTileWallCount: number | null;
  existingTilePanCount: number | null;
  existingPrefabPanCount: number | null;
  existingPrefabEnclosureCount: number | null;
  existingShowerDoorCount: number | null;
  /** Existing bathroom floor tile / finish (not shower floor). */
  existingBathFloorTileCount: number | null;
};

export type WetAreaDemoCounts = {
  demoTubCount: number | null;
  demoTileWallCount: number | null;
  demoTilePanCount: number | null;
  demoPrefabPanCount: number | null;
  demoPrefabEnclosureCount: number | null;
  demoShowerDoorCount: number | null;
  /** Demo bathroom floor tile — syncs to floor_demo scope. */
  demoBathFloorTileCount: number | null;
};

export type WetAreaDemoOverrideKey = keyof WetAreaDemoCounts;

export type PhotoExistingWetAreaFeature =
  | 'tub'
  | 'tile_shower_walls'
  | 'tile_shower_pan'
  | 'prefab_shower_pan'
  | 'prefab_shower_enclosure'
  | 'shower_door'
  | 'bath_floor_tile';

export type PhotoExistingFeature = {
  feature: PhotoExistingWetAreaFeature | string;
  confidence?: number;
  evidence?: string | null;
};

const PHOTO_EXISTING_MIN_CONFIDENCE = 0.45;

const FEATURE_TO_EXISTING: Record<
  PhotoExistingWetAreaFeature,
  Partial<WetAreaExistingCounts>
> = {
  tub: { existingTubCount: 1 },
  tile_shower_walls: { existingTileWallCount: 1 },
  tile_shower_pan: { existingTilePanCount: 1 },
  prefab_shower_pan: { existingPrefabPanCount: 1 },
  prefab_shower_enclosure: { existingPrefabEnclosureCount: 1 },
  shower_door: { existingShowerDoorCount: 1 },
  bath_floor_tile: { existingBathFloorTileCount: 1 },
};

export function readWetAreaExistingCounts(
  measurements: Partial<WetAreaExistingCounts> | null | undefined
): WetAreaExistingCounts {
  return {
    existingTubCount: positiveCount(measurements?.existingTubCount),
    existingTileWallCount: positiveCount(measurements?.existingTileWallCount),
    existingTilePanCount: positiveCount(measurements?.existingTilePanCount),
    existingPrefabPanCount: positiveCount(measurements?.existingPrefabPanCount),
    existingPrefabEnclosureCount: positiveCount(measurements?.existingPrefabEnclosureCount),
    existingShowerDoorCount: positiveCount(measurements?.existingShowerDoorCount),
    existingBathFloorTileCount: positiveCount(measurements?.existingBathFloorTileCount),
  };
}

/** Blank existing steppers — notes-only jobs start with nothing selected. */
export function emptyWetAreaExistingCounts(): WetAreaExistingCounts {
  return {
    existingTubCount: null,
    existingTileWallCount: null,
    existingTilePanCount: null,
    existingPrefabPanCount: null,
    existingPrefabEnclosureCount: null,
    existingShowerDoorCount: null,
    existingBathFloorTileCount: null,
  };
}

export function readWetAreaDemoCounts(
  measurements: Partial<WetAreaDemoCounts> | null | undefined
): WetAreaDemoCounts {
  return {
    demoTubCount: positiveCount(measurements?.demoTubCount),
    demoTileWallCount: positiveCount(measurements?.demoTileWallCount),
    demoTilePanCount: positiveCount(measurements?.demoTilePanCount),
    demoPrefabPanCount: positiveCount(measurements?.demoPrefabPanCount),
    demoPrefabEnclosureCount: positiveCount(measurements?.demoPrefabEnclosureCount),
    demoShowerDoorCount: positiveCount(measurements?.demoShowerDoorCount),
    demoBathFloorTileCount: positiveCount(measurements?.demoBathFloorTileCount),
  };
}

function installingNewWetArea(install: WetAreaStepperCounts): boolean {
  return Boolean(
    positiveCount(install.bathCount) ||
      positiveCount(install.tilePanBathCount) ||
      positiveCount(install.prefabBathCount) ||
      positiveCount(install.prefabEnclosureBathCount) ||
      positiveCount(install.tubBathCount)
  );
}

function showerJobContext(n: string): boolean {
  return /\b(shower|tub[\s-]to[\s-]shower|wet\s+area|bathroom\s+remodel|tub\s+and\s+tile\s+surround)\b/.test(
    n
  );
}

function notesMentionExistingTub(n: string): boolean {
  return (
    /\b(existing|current|alcove|drop[\s-]?in)\s+(?:tub|bathtub)\b/.test(n) ||
    /\b(tub|bathtub)\s+(?:and|with)\s+tile\s+surround\b/.test(n)
  );
}

function notesMentionDemoTilePan(n: string): boolean {
  // Keep clause-local — do not let an earlier "demo …" jump across commas to install "tile shower pan".
  return (
    /\b(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\s+(?:the\s+)?(?:existing\s+)?tile\s+(?:shower\s+)?pan\b/.test(
      n
    ) ||
    /\btile\s+(?:shower\s+)?pan\s+(?:to\s+)?(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/.test(
      n
    ) ||
    /\b(remove|demo|demolition|tear[\s-]?out)\s+(?:the\s+)?(?:existing\s+)?mud\s+pan\b/.test(n)
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

function notesMentionInstallTileShowerWalls(n: string): boolean {
  // "…and tile shower walls" / "install tile shower walls" is new finish, not existing condition.
  return /\b(and|install|new|retile)\s+tile\s+shower\s+walls?\b/.test(n);
}

function notesMentionInstallTileShowerPan(n: string): boolean {
  return /\b(and|install|new|retile)\s+tile\s+shower\s+pan\b/.test(n);
}

function notesMentionExistingTileWalls(n: string): boolean {
  if (/\b(existing|current|old)\s+tile\s+(?:shower\s+)?walls?\b/.test(n)) return true;
  if (/\b(tile\s+surround|tile\s+shower\s+surround)\b/.test(n)) return true;
  if (!/\btiled?\s+shower\s+walls?\b/.test(n)) return false;
  // Bare "tile shower walls" is usually install language when demo/prefab tear-out is also stated.
  if (notesMentionInstallTileShowerWalls(n)) return false;
  if (notesMentionDemoPrefabPan(n) && !notesMentionDemoTilePan(n)) return false;
  return true;
}

function notesMentionExistingTilePan(n: string): boolean {
  // Explicit prefab tear-out must not be overwritten by install "tile shower pan".
  if (notesMentionDemoPrefabPan(n) && !notesMentionDemoTilePan(n)) return false;
  if (notesMentionInstallTileShowerPan(n) && !notesMentionDemoTilePan(n)) return false;
  if (/\b(existing|current|old)\s+tile\s+(?:shower\s+)?pan\b/.test(n)) return true;
  if (notesMentionDemoTilePan(n)) return true;
  if (/\bmud\s+pan\b/.test(n) && !/\b(install|new)\b[^.]{0,40}\bmud\s+pan\b/.test(n)) return true;
  if (
    /\btiled?\s+shower\s+floor\b/.test(n) &&
    !/\b(install|new|and)\b[^.]{0,40}\btiled?\s+shower\s+floor\b/.test(n)
  ) {
    return true;
  }
  // Do not treat bare "tile shower pan" as existing — that phrase is install language in BPS notes.
  return false;
}

function notesMentionExistingPrefabPan(n: string): boolean {
  // "demo prefab shower pan" and bare "prefab shower pan" both imply existing prefab to remove/replace.
  // Install-only "install prefab pan" is handled by wetAreaInstallInference, not existing condition.
  if (
    /\b(install|new)\b[^.]{0,40}\bprefab\s+(?:shower\s+)?pan\b/.test(n) &&
    !notesMentionDemoPrefabPan(n)
  ) {
    return false;
  }
  return /\b(prefab\s+shower\s+pan|prefab\s+pan|acrylic\s+pan|fiberglass\s+pan|pan\s+insert)\b/.test(n);
}

function notesMentionExistingPrefabEnclosure(n: string): boolean {
  return /\b(prefab\s+shower\s+enclosure|prefab\s+enclosure|one[\s-]?piece\s+enclosure|fiberglass\s+surround)\b/.test(
    n
  );
}

function notesMentionExistingShowerDoor(n: string): boolean {
  if (/\b(install|new)\b[^.]{0,40}\b(shower\s+door|glass\s+door)\b/.test(n)) {
    return false;
  }
  return (
    /\b(existing|current|old)\s+(?:glass\s+)?shower\s+door\b/.test(n) ||
    /\b(existing|current|old)\b[^.]{0,50}\b(shower\s+door|glass\s+door)\b/.test(n) ||
    /\bglass\s+shower\s+door\b/.test(n) ||
    notesMentionDemoShowerDoor(n)
  );
}

function notesMentionExistingBathFloorTile(n: string): boolean {
  if (/\bshower\s+floor\b/.test(n)) return false;
  return (
    /\b(existing|current|old)\s+(?:bath(?:room)?\s+)?floor\s+tile\b/.test(n) ||
    /\b(existing|current|old)\s+bath(?:room)?\s+floor(?:ing| tile)?\b/.test(n) ||
    /\b(existing|current)\s+floor\s+tile\b[^.]{0,30}\bbath/.test(n)
  );
}

function notesMentionDemoBathFloorTile(n: string): boolean {
  if (/\bshower\s+floor\b/.test(n)) return false;
  return (
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,50}\b(bath(?:room)?\s+floor(?:\s+tile)?|floor\s+tile)\b/.test(
      n
    ) ||
    /\b(bath(?:room)?\s+floor(?:\s+tile)?|floor\s+tile)\b[^.]{0,50}\b(remove|demo|tear[\s-]?out)\b/.test(n)
  );
}

function positiveSqft(value: string | number | null | undefined): boolean {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0;
}

/** Background existing condition from job notes (photo jobs — not shown in QM). */
export function inferExistingWetAreaFromNotes(
  notes: string | null | undefined
): WetAreaExistingCounts {
  const n = String(notes || '').toLowerCase();
  const out = emptyWetAreaExistingCounts();
  if (notesMentionExistingTub(n)) out.existingTubCount = 1;
  if (notesMentionExistingTileWalls(n)) out.existingTileWallCount = 1;
  if (notesMentionExistingTilePan(n)) out.existingTilePanCount = 1;
  if (notesMentionExistingPrefabEnclosure(n)) out.existingPrefabEnclosureCount = 1;
  else if (notesMentionExistingPrefabPan(n)) out.existingPrefabPanCount = 1;
  if (notesMentionExistingShowerDoor(n)) out.existingShowerDoorCount = 1;
  if (notesMentionExistingBathFloorTile(n)) out.existingBathFloorTileCount = 1;
  return reconcileExistingWetAreaCounts(out);
}

function mergeExistingCounts(
  ...layers: Array<Partial<WetAreaExistingCounts>>
): WetAreaExistingCounts {
  const out = emptyWetAreaExistingCounts();
  const keys = Object.keys(out) as (keyof WetAreaExistingCounts)[];
  for (const layer of layers) {
    for (const key of keys) {
      if (positiveCount(layer[key])) out[key] = 1;
    }
  }
  return out;
}

/**
 * One floor fixture per wet area — tub alcoves are not tile/prefab shower pans.
 * Photo AI often tags tub jobs with both tub + tile_shower_pan; tub wins.
 */
export function reconcileExistingWetAreaCounts(
  existing: WetAreaExistingCounts
): WetAreaExistingCounts {
  const out = { ...existing };
  if (positiveCount(out.existingTubCount)) {
    out.existingTilePanCount = null;
    out.existingPrefabPanCount = null;
    out.existingPrefabEnclosureCount = null;
    return out;
  }
  if (positiveCount(out.existingTilePanCount)) {
    out.existingTubCount = null;
    out.existingPrefabPanCount = null;
    out.existingPrefabEnclosureCount = null;
    return out;
  }
  if (positiveCount(out.existingPrefabEnclosureCount)) {
    out.existingTubCount = null;
    out.existingTilePanCount = null;
    out.existingPrefabPanCount = null;
    return out;
  }
  if (positiveCount(out.existingPrefabPanCount)) {
    out.existingTubCount = null;
    out.existingTilePanCount = null;
  }
  return out;
}

export type EffectiveExistingWetAreaInput = {
  measurements: Partial<WetAreaExistingCounts>;
  notes?: string | null;
  hasSitePhotos?: boolean;
  tubDemoIncluded?: boolean;
  showerFloorDemoIncluded?: boolean;
  floorDemoIncluded?: boolean;
  glassDoorIncluded?: boolean;
};

/**
 * When notes explicitly tear out a prefab pan (and not a tile pan), prefer that over a photo
 * mis-tag of tile_shower_pan — tile currently wins in reconcileExistingWetAreaCounts.
 */
function preferNotesExplicitPrefabPanDemo(
  existing: WetAreaExistingCounts,
  notes?: string | null
): WetAreaExistingCounts {
  const n = String(notes || '').toLowerCase();
  if (!notesMentionDemoPrefabPan(n) || notesMentionDemoTilePan(n)) return existing;
  return reconcileExistingWetAreaCounts({
    ...existing,
    existingPrefabPanCount: existing.existingPrefabPanCount ?? 1,
    existingTilePanCount: null,
    existingTubCount: null,
  });
}

/** Effective existing condition for demo inference (photos seed silently; notes-only uses QM manual entry). */
export function resolveEffectiveExistingWetArea(
  input: EffectiveExistingWetAreaInput
): WetAreaExistingCounts {
  const fromMeasurements = readWetAreaExistingCounts(input.measurements);
  if (!input.hasSitePhotos) {
    return preferNotesExplicitPrefabPanDemo(
      reconcileExistingWetAreaCounts(fromMeasurements),
      input.notes
    );
  }
  return preferNotesExplicitPrefabPanDemo(
    reconcileExistingWetAreaCounts(
      mergeExistingCounts(
        fromMeasurements,
        inferExistingWetAreaFromNotes(input.notes),
        hydrateExistingFromChecklistDemo({
          measurements: fromMeasurements,
          tubDemoIncluded: input.tubDemoIncluded,
          showerFloorDemoIncluded: input.showerFloorDemoIncluded,
          floorDemoIncluded: input.floorDemoIncluded,
          glassDoorIncluded: input.glassDoorIncluded,
        })
      )
    ),
    input.notes
  );
}

function notesMentionDemoTub(n: string): boolean {
  return (
    /\b(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,60}\b(tub|bathtub)\b/.test(n) ||
    /\b(tub|bathtub)\b[^.]{0,60}\b(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/.test(n)
  );
}

function notesMentionDemoTileWalls(n: string): boolean {
  return (
    /\b(remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,60}\b(tile\s+surround|shower\s+walls?|wall\s+tile)\b/.test(
      n
    ) ||
    /\b(tile\s+surround|shower\s+walls?)\b[^.]{0,60}\b(remove|demo|demolition|tear[\s-]?out)\b/.test(n)
  );
}

function notesMentionDemoShowerFloor(n: string): boolean {
  return (
    /\b(remove|demo|demolition|tear[\s-]?out)\b[^.]{0,50}\b(shower\s+(?:pan|floor|base)|pan\s+insert|mud\s+pan)\b/.test(
      n
    ) ||
    /\b(shower\s+(?:pan|floor|base)|prefab\s+pan)\b[^.]{0,50}\b(remove|demo|demolition|tear[\s-]?out)\b/.test(
      n
    )
  );
}

function notesMentionDemoShowerDoor(n: string): boolean {
  return (
    /\b(remove|demo|tear[\s-]?out|replace)\b[^.]{0,50}\b(shower\s+door|glass\s+door)\b/.test(n) ||
    /\b(shower\s+door|glass\s+door)\b[^.]{0,50}\b(remove|demo|tear[\s-]?out|replace)\b/.test(n)
  );
}

function notesMentionWetAreaConversionDemo(n: string): boolean {
  return (
    /\b(demo|demolition|tear[\s-]?out|remove|gut)\b[^.]{0,50}\b(existing\s+)?(shower|tub[\s-]to[\s-]shower)\b/.test(
      n
    ) || /\btub[\s-]to[\s-]shower\b/.test(n)
  );
}

export type DemoWetAreaInferenceInput = {
  notes?: string | null;
  existing: WetAreaExistingCounts;
  install: WetAreaStepperCounts;
  keepingExisting?: boolean;
  reuseExistingShowerDoor?: boolean;
  tubDemoIncluded?: boolean;
  showerFloorDemoIncluded?: boolean;
  floorDemoIncluded?: boolean;
  floorTileIncluded?: boolean;
  bathroomFloorSqft?: string | number | null;
};

function setDemoIf(
  demo: WetAreaDemoCounts,
  key: keyof WetAreaDemoCounts,
  condition: boolean
): void {
  if (condition) demo[key] = 1;
}

/** Derive demo tear-out counts from photos, notes, checklist, existing, and new install.
 *
 * Manual Wet area install → Demo / tear-out (like-for-like even without photo existing):
 * - Tile shower walls → Remove tile shower walls
 * - Mud pan → Remove tile shower pan (or existing prefab pan/enclosure when known)
 * - Prefab pan → Remove prefab pan (or existing tile pan when known)
 * - Prefab enclosure → Remove prefab enclosure
 * - Tub install → Remove tub
 * - Bath floor → Remove bathroom floor tile
 * - Shower doors → never from install alone (notes / reuse toggle)
 */
export function resolveDemoWetAreaFromIntent(input: DemoWetAreaInferenceInput): WetAreaDemoCounts {
  const empty: WetAreaDemoCounts = {
    demoTubCount: null,
    demoTileWallCount: null,
    demoTilePanCount: null,
    demoPrefabPanCount: null,
    demoPrefabEnclosureCount: null,
    demoShowerDoorCount: null,
    demoBathFloorTileCount: null,
  };
  if (input.keepingExisting) return empty;

  const n = String(input.notes || '').toLowerCase();
  const ex = reconcileExistingWetAreaCounts(input.existing);
  const ins = input.install;
  const newWet = installingNewWetArea(ins);
  const conversionDemo = notesMentionWetAreaConversionDemo(n);
  const installingTileWalls = positiveCount(ins.bathCount);
  const installingTilePan = positiveCount(ins.tilePanBathCount);
  const installingPrefabPan = positiveCount(ins.prefabBathCount);
  const installingPrefabEnclosure = positiveCount(ins.prefabEnclosureBathCount);
  const installingTub = positiveCount(ins.tubBathCount);
  const installingNewShowerFloor = Boolean(
    installingTilePan || installingPrefabPan || installingPrefabEnclosure || installingTub
  );
  const hasExistingTub = positiveCount(ex.existingTubCount);
  const hasExistingTilePan = positiveCount(ex.existingTilePanCount);
  const hasExistingPrefabPan = positiveCount(ex.existingPrefabPanCount);
  const hasExistingEnclosure = positiveCount(ex.existingPrefabEnclosureCount);
  const hasExistingTileWalls = positiveCount(ex.existingTileWallCount);

  const demo: WetAreaDemoCounts = { ...empty };

  setDemoIf(
    demo,
    'demoTubCount',
    Boolean(
      input.tubDemoIncluded ||
        installingTub ||
        (notesMentionDemoTub(n) && hasExistingTub) ||
        (conversionDemo && hasExistingTub) ||
        (hasExistingTub && newWet)
    )
  );

  setDemoIf(
    demo,
    'demoTileWallCount',
    Boolean(
      notesMentionDemoTileWalls(n) ||
        installingTileWalls ||
        (conversionDemo && hasExistingTileWalls)
    )
  );

  const floorDemoFromNotes =
    input.showerFloorDemoIncluded ||
    (notesMentionDemoShowerFloor(n) &&
      (hasExistingTilePan || hasExistingPrefabPan || hasExistingEnclosure));

  // New shower floor displaces whatever pan/enclosure exists (conversion).
  const displaceExistingShowerFloor = installingNewShowerFloor && !hasExistingTub;

  // Like-for-like when existing type is unknown — don't invent the wrong pan demo during conversion.
  const otherFloorExisting = hasExistingPrefabPan || hasExistingEnclosure;
  const otherThanTilePanExisting = hasExistingTilePan || hasExistingEnclosure;
  const otherThanEnclosureExisting = hasExistingTilePan || hasExistingPrefabPan;

  setDemoIf(
    demo,
    'demoTilePanCount',
    Boolean(
      !hasExistingTub &&
        ((hasExistingTilePan &&
          (floorDemoFromNotes || displaceExistingShowerFloor || installingTilePan)) ||
          (installingTilePan && !otherFloorExisting))
    )
  );

  setDemoIf(
    demo,
    'demoPrefabPanCount',
    Boolean(
      !hasExistingTub &&
        ((hasExistingPrefabPan &&
          !hasExistingEnclosure &&
          (floorDemoFromNotes || displaceExistingShowerFloor || installingPrefabPan)) ||
          (installingPrefabPan && !otherThanTilePanExisting))
    )
  );

  setDemoIf(
    demo,
    'demoPrefabEnclosureCount',
    Boolean(
      !hasExistingTub &&
        ((hasExistingEnclosure &&
          (floorDemoFromNotes ||
            displaceExistingShowerFloor ||
            installingPrefabEnclosure ||
            installingTileWalls ||
            (notesMentionDemoTileWalls(n) && installingTileWalls))) ||
          (installingPrefabEnclosure && !otherThanEnclosureExisting))
    )
  );

  // Door demo only when notes/photos confirm an existing door to remove — not because
  // a new door is being installed (curtain/open showers often have no door to demo).
  setDemoIf(
    demo,
    'demoShowerDoorCount',
    Boolean(
      notesMentionDemoShowerDoor(n) &&
        positiveCount(ex.existingShowerDoorCount) &&
        !input.reuseExistingShowerDoor
    )
  );

  // Bath floor: Wet area "Bath floor" stepper always implies tear-out of the old finish.
  const notesWantBathFloorDemo = notesMentionDemoBathFloorTile(n);
  const installingBathFloorStepper = positiveCount(ins.bathFloorTileCount);
  const installingBathFloorOtherwise =
    Boolean(input.floorTileIncluded) || positiveSqft(input.bathroomFloorSqft);
  setDemoIf(
    demo,
    'demoBathFloorTileCount',
    Boolean(
      notesWantBathFloorDemo ||
        installingBathFloorStepper ||
        (positiveCount(ex.existingBathFloorTileCount) && installingBathFloorOtherwise)
    )
  );

  return demo;
}

/** Derive demo tear-out counts from existing condition + new install selections. */
export function resolveAutoDemoWetAreaCounts(params: {
  existing: WetAreaExistingCounts;
  install: WetAreaStepperCounts;
  keepingExisting?: boolean;
  reuseExistingShowerDoor?: boolean;
}): WetAreaDemoCounts {
  return resolveDemoWetAreaFromIntent({
    existing: params.existing,
    install: params.install,
    keepingExisting: params.keepingExisting,
    reuseExistingShowerDoor: params.reuseExistingShowerDoor,
  });
}

export function mergeDemoCountsWithOverrides(params: {
  auto: WetAreaDemoCounts;
  stored: WetAreaDemoCounts;
  overrides?: Partial<Record<WetAreaDemoOverrideKey, boolean>> | null;
}): WetAreaDemoCounts {
  const keys = Object.keys(params.auto) as WetAreaDemoOverrideKey[];
  const merged = { ...params.auto };
  for (const key of keys) {
    if (params.overrides?.[key]) {
      merged[key] = params.stored[key] ?? null;
    }
  }
  return merged;
}

export function anyDemoWetAreaActive(demo: WetAreaDemoCounts): boolean {
  return Object.values(demo).some((v) => positiveCount(v) != null);
}

/** Seed existing counts from photo vision existingFeatures. */
export function applyExistingFeaturesToMeasurements<
  T extends Partial<WetAreaExistingCounts>,
>(measurements: T, features: PhotoExistingFeature[] | null | undefined): T {
  if (!features?.length) return measurements;
  const next = { ...measurements };
  for (const row of features) {
    if ((row.confidence ?? 0) < PHOTO_EXISTING_MIN_CONFIDENCE) continue;
    const key = String(row.feature || '').toLowerCase() as PhotoExistingWetAreaFeature;
    const patch = FEATURE_TO_EXISTING[key];
    if (!patch) continue;
    Object.assign(next, patch);
  }
  const reconciled = reconcileExistingWetAreaCounts(readWetAreaExistingCounts(next));
  return { ...next, ...reconciled };
}

/** Infer existing tub from checklist demo when reopening photo jobs (not notes-only QM). */
export function hydrateExistingFromChecklistDemo(params: {
  measurements: Partial<WetAreaExistingCounts>;
  tubDemoIncluded?: boolean;
  showerFloorDemoIncluded?: boolean;
  floorDemoIncluded?: boolean;
  glassDoorIncluded?: boolean;
}): WetAreaExistingCounts {
  const base = readWetAreaExistingCounts(params.measurements);
  if (!base.existingTubCount && params.tubDemoIncluded) {
    base.existingTubCount = 1;
  }
  if (
    !base.existingTilePanCount &&
    !base.existingPrefabPanCount &&
    !base.existingTubCount &&
    !params.tubDemoIncluded &&
    params.showerFloorDemoIncluded
  ) {
    base.existingTilePanCount = 1;
  }
  // Do not seed existing bath floor from checklist floor_demo — wet-area-only jobs often
  // get a false-positive floor_demo flag that then auto-turns on bath floor tear-out.
  return reconcileExistingWetAreaCounts(base);
}
