/**
 * Dedicated bathroom notes only show the checklist rows the note names.
 * Empty notes, mixed scope, plan import, and whole-home stay on the full list.
 */

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
  'floor_tile',
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
]);

/** Drop sentences that name work the note is leaving alone, plus "do not" and "no paint/lighting". */
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

const SHOWER_TILE_WORK =
  /\b(?:shower\s+walls?(?:\s+tile)?|shower\s+wall\s+tile|tile\s+shower|wall\s+tile|shower\s+tile|shower\s+pan|tile\s+pan|mud\s+pan)\b/i;
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
    /\b(?:remove|demo|demolition|tear[\s-]?out|rip[\s-]?out)\b/i.test(
      affirmative
    )
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
  if (namedInNotes('shower_pan')) push('shower_pan', 'Tile shower pan');
  if (namedInNotes('waterproofing')) {
    push('waterproofing', 'Shower waterproofing & backer board');
  }
  if (namedInNotes('shower_niche')) push('shower_niche', 'Shower niche');
  if (namedInNotes('shower_bench')) push('shower_bench', 'Shower bench');
  if (namedInNotes('glass_door')) push('glass_door', 'Shower door');
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
  if (namedInNotes('countertop_demo')) push('countertop_demo', 'Remove vanity top');
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
  if (/\bmarble\s+thresholds?\b/i.test(affirmative)) {
    push('note:marble threshold', 'Marble threshold');
  }
  return lines;
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
      if (
        named(PREFAB, text) &&
        !/\b(?:tile\s+shower|shower\s+walls?|wall\s+tile|shower\s+tile)\b/i.test(
          text
        )
      ) {
        return false;
      }
      return named(SHOWER_TILE_WORK, text);
    case 'floor_demo':
      return named(BATH_FLOOR_DEMO, text);
    case 'tub_demo':
      return named(TUB_TEAR_OUT, text);
    case 'shower_floor_demo':
      return (
        named(TILE_PAN, text) &&
        /\b(?:remove|demo|demolition|tear[\s-]?out)\b/i.test(text)
      );
    case 'vanity_demo':
      return /\b(?:remove|demo|tear[\s-]?out|haul(?:ed)?[\s-]?off)\b[^.]{0,70}\bvanity\b/i.test(
        text
      );
    case 'fixture_demo':
      return /\b(?:remove|demo|tear[\s-]?out)\b[^.]{0,50}\b(?:toilet|fixtures?)\b/i.test(
        text
      );
    case 'countertop_demo':
      return /\b(?:remove|demo|tear[\s-]?out|haul(?:ed)?[\s-]?off)\b[^.]{0,90}\b(?:countertops?|counters?|vanity\s+top)\b/i.test(
        text
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
      return named(TILE_PAN, text);
    case 'shower_tile':
      return named(SHOWER_WALL_TILE, text);
    case 'shower_floor_tile':
      return /\bshower\s+floor\s+tile\b|\btile\s+shower\s+floor\b/i.test(text);
    case 'shower_niche':
      return /\bniche\b/i.test(text);
    case 'shower_bench':
      return /\bbench\b/i.test(text);
    case 'glass_door':
      return /\bshower\s+doors?\b/i.test(text);
    case 'floor_tile':
      return named(BATH_FLOOR_TILE, text);
    case 'toilet':
      return /\btoilet\b/i.test(text);
    case 'vanity':
      return /\bvanity\b/i.test(
        text.replace(/\bvanity\s+(?:lights?|lighting)\b/gi, ' ')
      );
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
      return /\b(?:cleanup|clean[\s-]?up|haul(?:ed)?[\s-]?off|disposal)\b/i.test(
        text
      );
    case 'drywall':
    case 'drywall_demo':
      return /\b(?:drywall|sheetrock|gypsum)\b/i.test(text);
    default:
      return false;
  }
}

/**
 * True when the note is leaving the tub or shower in place.
 * "Leave the alcove ready for the new tub" is a replacement, not a keep.
 */
export function notesKeepExistingWetArea(
  notes: string | null | undefined
): boolean {
  const text = bathroomMeasurementNotes(notes);
  return (
    /\b(?:keep(?:ing)?|reuse)\b[^.;\n]{0,40}\b(?:the\s+)?(?:existing\s+)?(?:tub|shower)\b/i.test(
      text
    ) ||
    /\b(?:tub|shower)\b[^.;\n]{0,30}\bstays?\b/i.test(text) ||
    /\bleave\s+(?:the\s+)?(?:existing\s+)?(?:tub|shower)\b/i.test(text)
  );
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
  if (String(params.scopeMode || '').toLowerCase() !== 'dedicated') return false;
  const notes = String(params.notes || '').trim();
  if (!notes) return false;
  if (/\bfram(?:e|ing|ed)\b/i.test(notes)) return false;
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
  return items.filter(item => {
    const id = String(item.id || '');
    if (id.startsWith('custom_')) return true;
    return Boolean(bathroomScopeLineForId(id, lines));
  });
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
