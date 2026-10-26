/**
 * Bathroom notes only show the checklist rows the note names.
 * Empty notes, plan import, and whole-home stay on the full list.
 * A mixed note keeps trades that are not bathroom cards.
 */
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import { notesMentionDemoShowerDoor } from '@/utils/wetAreaExistingDemo';

const BATHROOM_TEMPLATE_IDS = new Set([
  'demo',
  'floor_demo',
  'tub_demo',
  'shower_floor_demo',
  'vanity_demo',
  'fixture_demo',
  'countertop_demo',
  'wet_area_install',
  'waterproofing',
  'shower_pan',
  'shower_tile',
  'shower_floor_tile',
  'shower_niche',
  'shower_bench',
  'glass_door',
  'glass_door_reuse_remove',
  'glass_door_reuse_install',
  'floor_tile',
  'marble_threshold',
  'toilet',
  'vanity',
  'sink_faucet',
  'lighting',
  'exhaust_fan',
  'mirror_accessories',
  'plumbing',
  'plumbing_rough',
  'electrical_rough',
  'floor_prep',
  'paint_repair',
  'paint',
  'interior_paint',
  'ceiling_paint',
  'trim',
  'plumbing_trim',
  'electrical_trim',
  'permits',
  'cleanup',
  'drywall',
  'drywall_demo',
  'framing',
  'window_install',
  'insulation',
]);

/** Drop sentences that name work the note is leaving alone, plus "do not" and "no paint/lighting". */
/** A chip list is comma-separated. A removal has to name its own fixture. */
export function bathroomNoteClauseHas(
  notes: string | null | undefined,
  pattern: RegExp
): boolean {
  return String(notes || '')
    .split(/[.\n,;]+/)
    .some(clause => pattern.test(clause));
}

export function bathroomAffirmativeNotes(
  notes: string | null | undefined
): string {
  return String(notes || '')
    .replace(/[^.]*\bstay(?:s|ing)?\s+in\s+place\b[^.]*/gi, ' ')
    .replace(/[^.]*\ball\s+stay\b[^.]*/gi, ' ')
    .replace(
      /[^.]*\bleave\b[^.]{0,80}\b(?:bath(?:room)?\s+floor|vanity|toilet)\b[^.]*/gi,
      ' '
    )
    .replace(/\b(?:do not|don't|dont)\b[^.]*/gi, ' ')
    .replace(/\bno\s+(?:new\s+)?paint(?:ing)?\b/gi, ' ')
    .replace(/\bno\s+(?:new\s+)?(?:lights?|lighting)\b/gi, ' ');
}

/**
 * Card matching text. A prefab pan is not a tile pan, so "prefab shower pan"
 * must not light up mud-pan rows.
 */
export function bathroomMeasurementNotes(
  notes: string | null | undefined
): string {
  return bathroomAffirmativeNotes(notes).replace(
    /\bprefab\s+(?:shower\s+)?pan\b/gi,
    'prefab base'
  );
}

/**
 * A dumpster, a final clean, or hauling debris beyond the pieces being
 * removed. "Haul off the old tile" stays on that demo line.
 */
export function notesAskForSeparateHaulOff(
  notes: string | null | undefined
): boolean {
  const text = bathroomAffirmativeNotes(notes);
  if (/\bdumpsters?\b/i.test(text)) return true;
  if (/\bfinal\s+clean(?:up)?\b/i.test(text)) return true;
  return text.split(/[.!?\n]/).some(sentence => {
    if (!/\b(?:haul(?:ed)?[\s-]?off|disposal)\b/i.test(sentence)) return false;
    if (
      /\b(?:tile|pan|cabinet|vanity|toilet|tub|door|surround|counter(?:top)?|thinset)\b/i.test(
        sentence
      )
    ) {
      return false;
    }
    return /\bdebris\b/i.test(sentence);
  });
}

/**
 * "Waterproof the new mud pan" is the pan. Wall backer stays on wall sqft
 * only when the note actually names the walls or wall tile.
 */
export function notesWaterproofPanNotWalls(
  notes: string | null | undefined
): boolean {
  const text = bathroomAffirmativeNotes(notes);
  if (!/\bwaterproof/i.test(text)) return false;
  if (!/\b(?:mud\s+pan|shower\s+pan|tile\s+shower\s+pan|shower\s+floor)\b/i.test(text)) {
    return false;
  }
  if (
    /\b(?:shower\s+walls?(?:\s+tile)?|shower\s+wall\s+tile|wall\s+tile|backer\s+board|cement\s+board)\b/i.test(
      text
    )
  ) {
    return false;
  }
  return true;
}

const TILE_PAN =
  /\b(?:tile\s+shower\s+pan|shower\s+pan|mud\s+pan|tile\s+pan)\b/i;
const TUB_TEAR_OUT =
  /\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,60}\b(?:existing\s+)?tub\b|\btub\b[^.]{0,40}\b(?:remove|demo|demolition|tear[\s-]?out)\b/i;
const TUB_INSTALL =
  /\b(?:install|new)\b[^.]{0,40}\b(?:a\s+)?(?:new\s+)?tub\b|\bnew\s+tub\b/i;
const PREFAB = /\bprefab\b/i;
const PAINT = /\bpaint(?:ing)?\b/i;
const BATH_FLOOR_DEMO =
  /\b(?:demo|remove|demolition|tear[\s-]?out)\b[^.]{0,50}\b(?:bath(?:room)?\s+floor(?:\s+tile)?|floor\s+tile)\b/i;
const BATH_FLOOR_TILE =
  /\b(?:bath(?:room)?\s+floor\s+tile|tile\s+(?:the\s+)?bath(?:room)?\s+floor)\b/i;
const SHOWER_WALL_TILE =
  /\b(?:shower\s+walls?(?:\s+tile)?|shower\s+wall\s+tile|tile\s+shower|wall\s+tile|shower\s+tile)\b/i;

/** "Put back new tile" covers every surface the same note just tore out. */
function notesPutTileBackGenerically(notes: string): boolean {
  return /\bput\s+back\b[^.]{0,40}\b(?:the\s+|new\s+)?tile\b|\bretile\b|\bre-tile\b/i.test(
    notes
  );
}

function notesTearOutShowerFloor(notes: string): boolean {
  return /\b(?:tear[\s-]?out|remove|demo|demolition|rip[\s-]?out)\b[^.]{0,80}\bshower\s+floor\b|\bshower\s+floor\b[^.]{0,40}\b(?:tear[\s-]?out|remove|demo|demolition|rip[\s-]?out)\b/i.test(
    notes
  );
}

function notesNameBathroomWindowReplacement(notes: string): boolean {
  return (
    /\b(?:remove|demo|tear[\s-]?out|replace|replacement)\b[^.]{0,50}\b(?:bathroom\s+)?windows?\b/i.test(
      notes
    ) && /\b(?:install|replacement|replace|new)\b/i.test(notes)
  );
}

function notesNameWallInsulation(notes: string): boolean {
  return /\binsulat(?:e|ion|ed)\b[^.]{0,40}\bwalls?\b|\bwalls?\b[^.]{0,40}\binsulat(?:e|ion|ed)\b/i.test(
    notes
  );
}

function named(pattern: RegExp, notes: string): boolean {
  return pattern.test(notes);
}

export type BathroomScopeLine = {
  id: string;
  label: string;
};

/**
 * The one read of a dedicated bathroom note. Scope found, the measurement
 * card, and the pricing cards keep a line only when it is in this list.
 */
export function bathroomScopeLines(
  notes: string | null | undefined
): BathroomScopeLine[] {
  const text = bathroomMeasurementNotes(notes);
  const affirmative = bathroomAffirmativeNotes(notes);
  const lines: BathroomScopeLine[] = [];
  const push = (id: string, label: string) => {
    if (lines.some(line => line.id === id)) return;
    lines.push({ id, label });
  };
  const namedInNotes = (id: string) =>
    bathroomChecklistItemNamedInNotes(id, notes);

  if (namedInNotes('floor_demo')) push('floor_demo', 'Demo bath floor tile');
  if (namedInNotes('tub_demo')) push('tub_demo', 'Remove tub');
  if (
    namedInNotes('demo') &&
    (notesReplaceShowerTile(notes) ||
      /\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/i.test(
        affirmative
      ))
  ) {
    push('demo', 'Shower tile demo / tear-out');
  }
  if (namedInNotes('shower_floor_demo')) {
    push('shower_floor_demo', 'Remove tile shower pan');
  }
  if (
    /\b(?:demo|haul(?:ed)?[\s-]?off|remove|tear[\s-]?out)\b[^.]{0,70}\bprefab\s+(?:shower\s+)?pan\b/i.test(
      affirmative
    ) ||
    /\bprefab\s+(?:shower\s+)?pan\b[^.]{0,40}\bcoming out\b/i.test(affirmative)
  ) {
    push('shower_floor_demo', 'Remove existing prefab shower pan');
  }
  if (
    (/\bprefab\s+surround\b/i.test(affirmative) &&
      /\bcoming out\b/i.test(affirmative)) ||
    /\b(?:remove|demo|tear[\s-]?out)\b[^.]{0,80}\b(?:existing\s+)?prefab\s+(?:shower(?:\s+enclosure)?|enclosure|surround)\b/i.test(
      affirmative
    )
  ) {
    push('shower_enclosure_demo', 'Remove existing prefab shower enclosure');
  }
  if (namedInNotes('shower_tile')) push('shower_tile', 'Shower wall tile');
  if (namedInNotes('shower_floor_tile')) {
    push('shower_floor_tile', 'Shower floor tile');
  }
  if (namedInNotes('shower_pan')) push('shower_pan', 'Build shower pan');
  if (namedInNotes('waterproofing')) {
    push(
      'waterproofing',
      notesWaterproofPanNotWalls(notes)
        ? 'Shower pan waterproofing'
        : 'Shower waterproofing & backer board'
    );
  }
  if (namedInNotes('shower_niche')) push('shower_niche', 'Shower niche');
  if (namedInNotes('shower_bench')) push('shower_bench', 'Shower bench');
  if (namedInNotes('glass_door')) push('glass_door', 'Shower door');
  if (notesReuseExistingShowerDoor(notes)) {
    push('glass_door_reuse_remove', 'Remove existing shower door');
    push('glass_door_reuse_install', 'Reinstall existing shower door');
  }
  if (notesMentionDemoShowerDoor(affirmative)) {
    push('glass_door_demo', 'Remove shower door');
  }
  if (namedInNotes('floor_tile')) push('floor_tile', 'Bath floor tile');
  if (namedInNotes('wet_area_install')) {
    const installsPrefabPan =
      /\b(?:install|new)\b[^.]{0,50}\bprefab\s+(?:shower\s+)?pan\b/i.test(
        affirmative
      );
    const installsPrefabEnclosure =
      /\b(?:install|new)\b[^.]{0,60}\bprefab\s+(?:shower\s+)?(?:enclosure|surround)\b/i.test(
        affirmative
      );
    const installsTub =
      named(TUB_INSTALL, affirmative) &&
      !installsPrefabPan &&
      !installsPrefabEnclosure &&
      !named(TILE_PAN, text);
    if (installsPrefabPan) push('prefab_shower_pan', 'Prefab shower pan');
    if (installsPrefabEnclosure) {
      push('prefab_shower_enclosure', 'Prefab shower enclosure');
    }
    if (installsTub) push('tub_install', 'Tub install');
    else if (!installsPrefabPan && !installsPrefabEnclosure) {
      push('wet_area_install', 'Wet area install');
    }
  }
  if (namedInNotes('paint_repair') || namedInNotes('paint') || namedInNotes('interior_paint')) {
    push(
      'paint_repair',
      /\bwalls?\b/i.test(affirmative) ? 'Bathroom wall paint' : 'Paint'
    );
  }
  if (namedInNotes('vanity_demo')) push('vanity_demo', 'Remove vanity');
  if (namedInNotes('countertop_demo')) {
    const topOnly =
      /\bvanity\s+top\b/i.test(affirmative) &&
      !/\bcountertops?\b/i.test(affirmative);
    push(
      'countertop_demo',
      topOnly ? 'Remove vanity top' : 'Remove countertop'
    );
  }
  if (namedInNotes('vanity')) push('vanity', 'Vanity');
  if (
    /\bquartz\s+top\b/i.test(affirmative) ||
    /\b(?:new|install)\b[^.]{0,40}\b(?:vanity\s+top|countertops?)\b/i.test(
      affirmative
    )
  ) {
    push('countertops', 'Vanity top');
  }
  if (namedInNotes('sink_faucet')) push('sink_faucet', 'Faucet');
  if (namedInNotes('lighting')) {
    const fixtureCount = affirmative.match(
      /\b(\d+|two|three|four)\s+fixtures?\b/i
    );
    const fixtureCountLabel =
      fixtureCount?.[1]?.toLowerCase() === 'two'
        ? '2'
        : fixtureCount?.[1]?.toLowerCase() === 'three'
          ? '3'
          : fixtureCount?.[1]?.toLowerCase() === 'four'
            ? '4'
            : fixtureCount?.[1];
    const vanityLights = /\bvanity\s+(?:lights?|lighting)\b/i.test(affirmative);
    push(
      'lighting',
      vanityLights
        ? fixtureCountLabel
          ? `Vanity lighting · ${fixtureCountLabel} fixtures`
          : 'Vanity lighting'
        : 'Lighting'
    );
  }
  if (namedInNotes('exhaust_fan')) push('exhaust_fan', 'Bath exhaust fan');
  if (namedInNotes('toilet')) push('toilet', 'Toilet');
  if (namedInNotes('cleanup')) push('cleanup', 'Haul-off / dump fees');
  if (namedInNotes('framing')) push('framing', 'Wall framing');
  if (namedInNotes('drywall')) push('drywall', 'Drywall');
  if (/\bmarble\s+thresholds?\b/i.test(affirmative)) {
    push('marble_threshold', 'Marble threshold');
  }
  if (namedInNotes('window_install')) {
    push('window_install', 'Window removal and install');
  }
  if (namedInNotes('insulation')) push('insulation', 'Wall insulation');
  return lines;
}

/**
 * Measurement boxes that must appear because a scope line is on the bid.
 * Cards, Quick Measurements, and Confirm scope all read this. A second
 * phrase list must not hide a box for a line this note already kept.
 */
export type BathroomNoteTakeoff = {
  showerWallDemo: boolean;
  showerWallSqft: boolean;
  showerFloorSqft: boolean;
  bathFloorDemo: boolean;
  bathFloorSqft: boolean;
  wallInsulationSqft: boolean;
  windowCount: boolean;
};

export function bathroomNoteTakeoff(
  notes: string | null | undefined
): BathroomNoteTakeoff {
  const ids = new Set(bathroomScopeLines(notes).map(line => line.id));
  return {
    showerWallDemo: ids.has('demo'),
    showerWallSqft: ids.has('shower_tile'),
    showerFloorSqft:
      ids.has('shower_floor_tile') || ids.has('shower_pan'),
    bathFloorDemo: ids.has('floor_demo'),
    bathFloorSqft: ids.has('floor_tile'),
    wallInsulationSqft: ids.has('insulation'),
    windowCount: ids.has('window_install'),
  };
}

export function bathroomChecklistItemNamedInNotes(
  itemId: string,
  notes: string | null | undefined
): boolean {
  const id = String(itemId || '').trim();
  if (!BATHROOM_TEMPLATE_IDS.has(id)) return false;
  const text = bathroomMeasurementNotes(notes);
  switch (id) {
    case 'demo':
      // A mud-pan tear-out is the pan line. This card is wall tile coming out.
      if (
        named(PREFAB, text) &&
        !named(SHOWER_WALL_TILE, text)
      ) {
        return false;
      }
      return named(SHOWER_WALL_TILE, text);
    case 'floor_demo':
      return bathroomNoteClauseHas(text, BATH_FLOOR_DEMO);
    case 'tub_demo':
      return named(TUB_TEAR_OUT, text);
    case 'shower_floor_demo':
      return (
        named(TILE_PAN, text) &&
        /\b(?:remove|demo|demolition|tear[\s-]?out)\b/i.test(text)
      );
    case 'vanity_demo':
      return bathroomNoteClauseHas(
        text,
        /\b(?:remove|demo|tear[\s-]?out|haul(?:ed)?[\s-]?off)\b[^.]{0,70}\bvanity\b/i
      );
    case 'fixture_demo':
      return /\b(?:remove|demo|tear[\s-]?out)\b[^.]{0,50}\b(?:toilet|fixtures?)\b/i.test(
        text
      );
    case 'countertop_demo':
      return bathroomNoteClauseHas(
        text,
        /\b(?:remove|demo|tear[\s-]?out|haul(?:ed)?[\s-]?off)\b[^.]{0,90}\b(?:countertops?|counters?|vanity\s+top)\b/i
      );
    case 'wet_area_install':
      return (
        named(TUB_INSTALL, text) ||
        named(PREFAB, text) ||
        named(TILE_PAN, text) ||
        named(SHOWER_WALL_TILE, text) ||
        /\bwet\s+area\b/i.test(text)
      );
    case 'waterproofing':
      return /\b(?:waterproof(?:ing)?|redgard|backer\s+board|cement\s+board)\b/i.test(
        text
      );
    case 'shower_pan':
      // A new tile shower floor is a mud pan. A prefab pan is a different card.
      if (/\bprefab\b/i.test(text)) return named(TILE_PAN, text);
      return (
        named(TILE_PAN, text) ||
        (notesPutTileBackGenerically(text) && notesTearOutShowerFloor(text)) ||
        /\bshower\s+floor\s+tile\b|\btile\s+shower\s+floor\b|\b(?:tile|tiled)\b[^.]{0,40}\bshower\s+floor\b|\bshower\s+floor\b[^.]{0,30}\b(?:tile|tiled)\b/i.test(
          text
        )
      );
    case 'shower_tile':
      return named(SHOWER_WALL_TILE, text);
    case 'shower_floor_tile':
      return (
        /\bshower\s+floor\s+tile\b|\btile\s+shower\s+floor\b|\b(?:tile|tiled)\b[^.]{0,40}\bshower\s+floor\b|\bshower\s+floor\b[^.]{0,30}\b(?:tile|tiled)\b/i.test(
          text
        ) ||
        (notesPutTileBackGenerically(text) && notesTearOutShowerFloor(text))
      );
    case 'shower_niche':
      return /\bniche\b/i.test(text);
    case 'shower_bench':
      return /\bbench\b/i.test(text);
    case 'glass_door':
      return notesInstallNewShowerDoor(text);
    case 'glass_door_reuse_remove':
    case 'glass_door_reuse_install':
      return notesReuseExistingShowerDoor(notes);
    case 'floor_tile':
      return (
        named(BATH_FLOOR_TILE, text) ||
        (notesPutTileBackGenerically(text) && named(BATH_FLOOR_DEMO, text))
      );
    case 'window_install':
      return notesNameBathroomWindowReplacement(text);
    case 'insulation':
      return notesNameWallInsulation(text);
    case 'marble_threshold':
      return /\bmarble\s+thresholds?\b/i.test(text);
    case 'toilet':
      return /\btoilet\b/i.test(text);
    case 'vanity': {
      const vanityText = text.replace(/\bvanity\s+(?:lights?|lighting)\b/gi, ' ');
      if (!/\bvanit(?:y|ies)\b/i.test(vanityText)) return false;
      const vanitySentences = vanityText
        .split(/[.!\n]/)
        .filter(sentence => /\bvanit(?:y|ies)\b/i.test(sentence));
      if (
        vanitySentences.some(sentence =>
          /\b(?:new|install|replace)\b/i.test(sentence)
        )
      ) {
        return true;
      }
      return !vanitySentences.every(sentence =>
        /\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out|haul(?:ed)?[\s-]?off)\b/i.test(
          sentence
        )
      );
    }
    case 'sink_faucet':
      return /\b(?:sink|faucet)\b/i.test(text);
    case 'lighting':
      return /\b(?:lights?|lighting|sconces?)\b/i.test(text);
    case 'exhaust_fan':
      return /\b(?:exhaust\s+fan|bath\s+fan)\b/i.test(text);
    case 'mirror_accessories':
      return /\b(?:mirror|towel\s+bars?|accessories)\b/i.test(text);
    case 'plumbing':
      return /\b(?:plumb(?:ing)?|rough[\s-]?in|repipe|water\s+lines?)\b/i.test(
        text
      );
    case 'plumbing_rough':
      return /\b(?:plumbing\s+rough|rough[\s-]?in)\b/i.test(text);
    case 'electrical_rough':
      return /\b(?:electrical|circuits?|wiring|gfci)\b/i.test(text);
    case 'floor_prep':
      return /\b(?:floor\s+prep|subfloor|underlayment)\b/i.test(text);
    case 'ceiling_paint':
      return /\bpaint(?:ing)?\b[^.;\n]{0,40}\bceilings?\b|\bceilings?\b[^.;\n]{0,40}\bpaint(?:ing)?\b/i.test(
        text
      );
    case 'paint_repair':
    case 'paint':
    case 'interior_paint':
      return named(PAINT, text);
    case 'trim':
      return /\bbaseboards?\b|\btrim\s+(?:&|and)\s+baseboard\b|\binstall\b[^.]{0,20}\btrim\b/i.test(
        text
      );
    case 'plumbing_trim':
      return /\bplumbing\s+trim\b|\bfixture\s+hookups?\b/i.test(text);
    case 'electrical_trim':
      return /\belectrical\s+trim\b|\bswitch\s+plates?\b/i.test(text);
    case 'permits':
      return /\bpermits?\b/i.test(text);
    case 'cleanup':
      return (
        notesAskForSeparateHaulOff(notes) ||
        /\b(?:cleanup|clean[\s-]?up|haul(?:ed)?[\s-]?off|disposal)\b/i.test(
          text
        )
      );
    case 'drywall':
    case 'drywall_demo':
      return /\b(?:drywall|sheetrock|gypsum)\b/i.test(text);
    case 'framing':
      return notesMentionStructuralFraming(text);
    default:
      return false;
  }
}

/**
 * The existing door stays on the job. It comes off for the tile and goes back on.
 * A door that is torn out, or a new door, is not a reuse.
 */
export function notesReuseExistingShowerDoor(
  notes: string | null | undefined
): boolean {
  if (notesInstallNewShowerDoor(notes) || notesMentionDemoShowerDoor(notes)) {
    return false;
  }
  return String(notes || '')
    .split(/[.!?\n]/)
    .some(sentence => {
      if (!/\bshower\s+doors?\b/i.test(sentence)) return false;
      return (
        /\b(?:keep(?:ing)?|reuse|reinstall|leave)\b/i.test(sentence) &&
        /\b(?:existing|old|current)\b/i.test(sentence)
      );
    });
}

/**
 * A new shower door install. Keeping or reusing the old door is not one.
 */
export function notesInstallNewShowerDoor(
  notes: string | null | undefined
): boolean {
  return String(notes || '')
    .split(/[.!?\n]/)
    .some(sentence => {
      if (!/\bshower\s+doors?\b/i.test(sentence)) return false;
      if (
        /\b(?:keep(?:ing)?|reuse|leave|stay(?:s|ing)?)\b/i.test(sentence) &&
        /\b(?:existing|old|current)\b/i.test(sentence) &&
        !/\b(?:install|replace)\b/i.test(sentence)
      ) {
        return false;
      }
      if (
        /\b(?:remove|demo|tear[\s-]?out|rip[\s-]?out)\b/i.test(sentence) &&
        !/\b(?:install|new|replace)\b/i.test(sentence)
      ) {
        return false;
      }
      return (
        /\b(?:install|new|replace)\b/i.test(sentence) ||
        /\b(?:frameless|slider|sliding)\s+shower\s+doors?\b/i.test(sentence)
      );
    });
}

/**
 * True when the note is leaving the tub or shower in place.
 * "Leave the alcove ready for the new tub" is a replacement, not a keep.
 * "Keep the existing shower door" is the door, not the wet area.
 */
export function notesKeepExistingWetArea(
  notes: string | null | undefined
): boolean {
  const text = bathroomMeasurementNotes(notes).replace(
    /\bshower\s+doors?\b/gi,
    ' '
  );
  return (
    /\b(?:keep(?:ing)?|reuse)\b[^.;\n]{0,40}\b(?:the\s+)?(?:existing\s+)?(?:tub|shower)\b/i.test(
      text
    ) ||
    /\b(?:tub|shower)\b[^.;\n]{0,30}\bstays?\b/i.test(text) ||
    /\bleave\s+(?:the\s+)?(?:existing\s+)?(?:tub|shower)\b/i.test(text)
  );
}

/**
 * Framing a shower niche or bench is wet-area work. Drop those phrases
 * before any check that treats "frame" as structural wall framing.
 */
export function notesWithoutWetAreaFraming(
  notes: string | null | undefined
): string {
  return String(notes || '').replace(
    /\b(?:frame|framing|framed)\b[^.;\n]{0,80}\b(?:a\s+)?(?:tiled\s+|shower\s+)?(?:niche|bench)\b/gi,
    ' '
  );
}

/** True when the note frames walls, not a shower niche or bench. */
export function notesMentionStructuralFraming(
  notes: string | null | undefined
): boolean {
  return /\bfram(?:e|ing|ed)\b/i.test(notesWithoutWetAreaFraming(notes));
}

const LVP_PRODUCT_RE = /\b(?:lvp|luxury\s+vinyl|vinyl\s+plank)\b/i;
const LVP_AREA_RE =
  /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:foot|feet))\s+of\s+(?:lvp|luxury\s+vinyl|vinyl\s+plank)\b/i;
const SHOWER_TILE_AREA_BEFORE_RE =
  /(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:foot|feet))\s+of\s+(?:shower\s+(?:wall\s+)?tile|shower\s+walls?)\b/i;
const SHOWER_TILE_AREA_AFTER_RE =
  /(?:shower\s+(?:wall\s+)?tile|shower\s+walls?)\s*[:\-–]?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sf|square\s+(?:foot|feet))/i;

function positiveNoteQuantity(raw: string | undefined): number | null {
  const value = Number(String(raw || '').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * "Replace the shower tile and install 80 sqft of LVP" is two jobs.
 * A bathroom remodel that also names a pan, vanity, toilet, or paint stays
 * on that checklist.
 */
export function notesNameShowerTileWithFlooring(
  notes: string | null | undefined
): boolean {
  const text = bathroomAffirmativeNotes(notes);
  if (!SHOWER_WALL_TILE.test(text) || !LVP_PRODUCT_RE.test(text)) return false;
  if (!/\b(?:install|replace|new)\b/i.test(text)) return false;
  return !/\b(?:vanity|toilet|tub|bathtub|shower\s+pan|mud\s+pan|prefab|paint(?:ing)?|waterproof|niche|bench|shower\s+door|exhaust|backer)\b/i.test(
    text
  );
}

/** Surfaces and fixtures that belong on the bathroom checklist. */
const NAMED_BATHROOM_ASSEMBLY_IDS = new Set([
  'floor_tile',
  'floor_demo',
  'demo',
  'shower_tile',
  'shower_floor_tile',
  'shower_floor_demo',
  'shower_pan',
  'shower_enclosure_demo',
  'prefab_shower_pan',
  'prefab_shower_enclosure',
  'tub_install',
  'tub_demo',
  'vanity',
  'vanity_demo',
  'countertop_demo',
  'countertops',
  'glass_door',
  'glass_door_demo',
  'glass_door_reuse_remove',
  'glass_door_reuse_install',
  'waterproofing',
  'wet_area_install',
]);

/**
 * "Tile the bathroom floor, 45 sqft. New toilet." names bathroom work.
 * A flooring simple-unit bid must not swallow it.
 */
export function notesNameBathroomAssembly(
  notes: string | null | undefined
): boolean {
  return bathroomScopeLines(notes).some(line =>
    NAMED_BATHROOM_ASSEMBLY_IDS.has(line.id)
  );
}

export function namedBathroomConfirmScopeItems(
  notes: string | null | undefined
): ScopeChecklistItem[] {
  const choice = toiletChoiceNamedInNote(notes);
  return bathroomScopeLines(notes).map(line => {
    if (line.id === 'toilet') {
      return {
        id: 'toilet',
        inputType: 'choice' as const,
        label: line.label,
        helperText: 'Toilet named in the note.',
        category: 'fixtures',
        state: 'included' as const,
        choiceId: choice,
        noteBacked: true,
      };
    }
    return {
      id: line.id,
      inputType: 'yes_no' as const,
      label: line.label,
      helperText: 'Named in the note.',
      category:
        line.id.includes('tile') || line.id.includes('shower')
          ? 'shower'
          : 'fixtures',
      state: 'included' as const,
      noteBacked: true,
    };
  });
}

/**
 * Install LVP is the new floor. Floor demo only when the note names that removal.
 */
export function notesNameBathroomFloorRemoval(
  notes: string | null | undefined
): boolean {
  return /\b(?:remove|removal|demo|demolition|tear[\s-]?out)\b[^.;\n]{0,50}\b(?:existing\s+)?(?:bathroom\s+)?(?:floor(?:ing)?|lvp)\b|\breplac(?:e|ing)\b[^.;\n]{0,30}\b(?:the\s+)?(?:existing\s+)?(?:bathroom\s+)?(?:floor(?:ing)?|lvp)\b/i.test(
    bathroomAffirmativeNotes(notes)
  );
}

/**
 * "Replace the shower tile" is tear-out plus new tile.
 * "Install new shower tile" is the new tile only.
 */
export function notesReplaceShowerTile(
  notes: string | null | undefined
): boolean {
  const text = bathroomAffirmativeNotes(notes);
  if (!SHOWER_WALL_TILE.test(text)) return false;
  return /[^.;\n]*\breplac(?:e|ing|ement)\b[^.;\n]*\b(?:shower\s+(?:wall\s+)?tile|shower\s+walls?)\b|[^.;\n]*\b(?:shower\s+(?:wall\s+)?tile|shower\s+walls?)\b[^.;\n]*\breplac(?:e|ing|ement)\b/i.test(
    text
  );
}

export function showerTileWithFlooringChecklistItems(
  notes: string | null | undefined
): Array<{
  id: string;
  inputType: 'yes_no';
  label: string;
  helperText: string;
  category: string;
  state: 'included';
  noteBacked: true;
}> {
  const items: Array<{
    id: string;
    inputType: 'yes_no';
    label: string;
    helperText: string;
    category: string;
    state: 'included';
    noteBacked: true;
  }> = [];
  if (notesReplaceShowerTile(notes)) {
    items.push({
      id: 'demo',
      inputType: 'yes_no',
      label: 'Shower tile demo',
      helperText: 'Tear out the existing shower tile. Uses the new shower wall area.',
      category: 'demo',
      state: 'included',
      noteBacked: true,
    });
  }
  items.push(
    {
      id: 'shower_tile',
      inputType: 'yes_no',
      label: 'Shower wall tile',
      helperText: notesReplaceShowerTile(notes)
        ? 'New shower wall tile. Tear-out uses this same area.'
        : 'New shower wall tile area — enter sqft for pricing.',
      category: 'wet_area',
      state: 'included',
      noteBacked: true,
    },
    {
      id: 'waterproofing',
      inputType: 'yes_no',
      label: 'Shower waterproofing',
      helperText:
        'Backer and membrane for the new shower tile. Uses the shower wall area.',
      category: 'wet_area',
      state: 'included',
      noteBacked: true,
    },
    ...(notesNameBathroomFloorRemoval(notes)
      ? [
          {
            id: 'floor_demo' as const,
            inputType: 'yes_no' as const,
            label: 'Bathroom floor demo',
            helperText:
              'Tear out the existing bathroom floor so the new LVP can go down. Uses the LVP area.',
            category: 'demo',
            state: 'included' as const,
            noteBacked: true as const,
          },
        ]
      : []),
    {
      id: 'flooring_lvp',
      inputType: 'yes_no',
      label: 'LVP flooring',
      helperText: 'Install the LVP area named in the notes.',
      category: 'flooring',
      state: 'included',
      noteBacked: true,
    }
  );
  return items;
}

/** Shower sqft only when the note gives it. "80 sqft of LVP" stays on the floor. */
export function showerTileWithFlooringAreas(notes: string | null | undefined): {
  showerWallTileSqft: number | null;
  flooringSqft: number | null;
} {
  const text = String(notes || '');
  const floor = text.match(LVP_AREA_RE);
  const shower =
    text.match(SHOWER_TILE_AREA_BEFORE_RE) ||
    text.match(SHOWER_TILE_AREA_AFTER_RE);
  return {
    showerWallTileSqft: positiveNoteQuantity(shower?.[1]),
    flooringSqft: positiveNoteQuantity(floor?.[1]),
  };
}

export function shouldLimitBathroomChecklistToNotes(params: {
  notes?: string | null;
  templateKey?: string | null;
  projectType?: string | null;
  scopeMode?: string | null;
  planBacked?: boolean;
  wholeHome?: boolean;
}): boolean {
  if (params.planBacked || params.wholeHome) return false;
  const notes = String(params.notes || '').trim();
  if (!notes) return false;
  const template = String(params.templateKey || params.projectType || '')
    .toLowerCase();
  return (
    template === 'bathroom' ||
    /\b(?:bathroom|bath)\s+(?:remodel|renovation)\b/i.test(notes) ||
    /\bremodel(?:\s+\w+){0,4}\s+bathroom\b/i.test(notes)
  );
}

export function filterDedicatedBathroomConfirmItems<T extends { id?: string | null }>(
  items: T[],
  params: {
    notes?: string | null;
    templateKey?: string | null;
    projectType?: string | null;
    scopeMode?: string | null;
    planBacked?: boolean;
    wholeHome?: boolean;
  }
): T[] {
  if (!shouldLimitBathroomChecklistToNotes(params)) return items;
  const lines = bathroomScopeLines(params.notes);
  const mixed = String(params.scopeMode || '').toLowerCase() === 'mixed';
  return items.filter(item => {
    const id = String(item.id || '');
    if (id.startsWith('custom_')) return true;
    if (mixed && !BATHROOM_TEMPLATE_IDS.has(id)) return true;
    return Boolean(bathroomScopeLineForId(id, lines));
  });
}

/** Step 3 and the initial estimate use the same note lines Step 2 priced. */
export function applyDedicatedBathroomConfirmScope<
  T extends { id?: string | null; label?: string | null },
>(
  items: T[],
  params: {
    notes?: string | null;
    templateKey?: string | null;
    projectType?: string | null;
    scopeMode?: string | null;
    planBacked?: boolean;
    wholeHome?: boolean;
  }
): T[] {
  const kept = filterDedicatedBathroomConfirmItems(items, params);
  if (!shouldLimitBathroomChecklistToNotes(params)) return kept;
  const lines = bathroomScopeLines(params.notes);
  return kept.map(item => {
    const line = bathroomScopeLineForId(String(item.id || ''), lines);
    if (!line?.label || line.label === item.label) return item;
    return { ...item, label: line.label };
  });
}

/**
 * A new toilet or wall paint named after the checklist loaded still belongs
 * on Confirm Scope. The choice stays inside one sentence so "new shower door"
 * does not mark a later "leave the toilet".
 */
function toiletChoiceNamedInNote(notes: string | null | undefined): string | null {
  const n = bathroomAffirmativeNotes(notes).toLowerCase();
  if (
    /\b(?:move|relocat(?:e|ing))\b[^.]{0,40}\btoilet\b|\btoilet\b[^.]{0,40}\b(?:move|relocat(?:e|ing))\b/.test(
      n
    )
  ) {
    return 'relocating';
  }
  if (
    /\b(?:replace|new|install)\b[^.]{0,40}\btoilet\b|\btoilet\b[^.]{0,40}\b(?:replace|new|install)\b|\bnew\s+toilet\b/.test(
      n
    )
  ) {
    return 'replacing';
  }
  if (
    /\b(?:reset|re-set|reinstall)\b[^.]{0,40}\btoilet\b|\btoilet\b[^.]{0,40}\b(?:reset|re-set|reinstall)\b/.test(
      n
    )
  ) {
    return 'reset';
  }
  return null;
}

export function applyNamedBathroomConfirmChoices(
  items: ScopeChecklistItem[],
  notes: string | null | undefined,
  templateKey?: string | null
): ScopeChecklistItem[] {
  if (!shouldLimitBathroomChecklistToNotes({ notes, templateKey })) return items;
  const lines = bathroomScopeLines(notes);
  const ids = new Set(lines.map(line => line.id));
  if (!ids.size) return items;
  let next = items.map(item => {
    if (item.contractorRemoved) return item;
    if (item.id === 'toilet' && ids.has('toilet')) {
      const choice = toiletChoiceNamedInNote(notes);
      if (!choice) return item;
      if (item.choiceId && item.choiceId !== 'unsure') return item;
      return {
        ...item,
        inputType: 'choice' as const,
        choiceId: choice,
        state: 'included' as const,
        noteBacked: true,
      };
    }
    if (
      (item.id === 'paint_repair' ||
        item.id === 'paint' ||
        item.id === 'interior_paint') &&
      ids.has('paint_repair') &&
      item.state !== 'included' &&
      item.state !== 'excluded'
    ) {
      return { ...item, state: 'included' as const, noteBacked: true };
    }
    return item;
  });
  if (ids.has('toilet') && !next.some(item => item.id === 'toilet')) {
    const choice = toiletChoiceNamedInNote(notes);
    if (choice) {
      next = [
        ...next,
        {
          id: 'toilet',
          label: 'Toilet',
          helperText: 'New toilet — fixture and set.',
          category: 'fixtures',
          inputType: 'choice',
          state: 'included',
          choiceId: choice,
          noteBacked: true,
        },
      ];
    }
  }
  if (
    ids.has('paint_repair') &&
    !next.some(item =>
      item.id === 'paint_repair' || item.id === 'paint' || item.id === 'interior_paint'
    )
  ) {
    const paint = lines.find(line => line.id === 'paint_repair');
    next = [
      ...next,
      {
        id: 'paint_repair',
        label: paint?.label || 'Bathroom wall paint',
        helperText: 'Bathroom wall paint — enter the area to price it.',
        category: 'trades',
        inputType: 'yes_no',
        state: 'included',
        noteBacked: true,
      },
    ];
  }
  return next;
}

function bathroomScopeLineForId(
  id: string,
  lines: BathroomScopeLine[]
): BathroomScopeLine | undefined {
  const direct = lines.find(line => line.id === id);
  if (direct) return direct;
  if (id === 'paint' || id === 'interior_paint') {
    return lines.find(line => line.id === 'paint_repair');
  }
  if (id === 'windows' || id === 'windows_doors') {
    return lines.find(line => line.id === 'window_install');
  }
  return undefined;
}

/** Scope found uses the same lines, including removals the checklist has no id for. */
export function alignDedicatedBathroomScopeRows<
  T extends { id?: string | null; name?: string | null },
>(
  rows: T[],
  params: {
    notes?: string | null;
    templateKey?: string | null;
    projectType?: string | null;
    scopeMode?: string | null;
    planBacked?: boolean;
    wholeHome?: boolean;
  }
): T[] {
  if (!shouldLimitBathroomChecklistToNotes(params)) return rows;
  const lines = bathroomScopeLines(params.notes);
  const aligned = rows.map(row => {
    const line = bathroomScopeLineForId(String(row.id || ''), lines);
    return line ? { ...row, name: line.label } : row;
  });
  const present = new Set(aligned.map(row => String(row.id || '')));
  const presentLabels = new Set(
    aligned.map(row => String(row.name || '').trim().toLowerCase())
  );
  for (const line of lines) {
    if (present.has(line.id) || presentLabels.has(line.label.toLowerCase())) {
      continue;
    }
    aligned.push({ id: line.id, name: line.label } as T);
    present.add(line.id);
    presentLabels.add(line.label.toLowerCase());
  }
  return aligned;
}
