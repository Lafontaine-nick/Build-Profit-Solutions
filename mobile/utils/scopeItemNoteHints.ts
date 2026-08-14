/** Client mirror of backend scopeChecklistLibrary note inference (keep in sync). */

const CHECKLIST_YES_HINTS: Record<string, RegExp> = {
  demo: /\b(demo|demolition|tear\s*out|gut|remove)\b(?![^.]{0,80}\b(?:tile|floor|flooring|lvp|vinyl|laminate|carpet)\b)/,
  appliance_removal:
    /\b(remove|disconnect|pull|haul).*\b(appliance|ridge|dishwasher|range|refrigerator|oven|microwave|hood)\b|\b(appliance|ridge|dishwasher|range|refrigerator)\b.*\b(remove|disconnect|pull|haul)\b/,
  // Same-clause proximity — "demo the existing tile and tub ... install tile shower pan"
  // must not read as tub/pan demo of things being installed, or cross sentences.
  tub_demo: /\b(remove|demo|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,60}\b(tub|bathtub)\b|\b(tub|bathtub)\b[^.]{0,60}\b(remove|demo|tear[\s-]?out|rip[\s-]?out)\b/,
  shower_floor_demo:
    /\b(remove|demo|tear[\s-]?out)\b[^.]{0,50}\b(shower\s+(?:pan|floor|base)|pan\s+insert|mud\s+pan)\b|\b(shower\s+(?:pan|floor|base)|prefab\s+pan)\b[^.]{0,50}\b(remove|demo|tear[\s-]?out)\b/,
  vanity_demo:
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,50}\bvanity\b|\bvanity\b[^.]{0,50}\b(remove|demo|tear[\s-]?out|rip[\s-]?out)\b/,
  countertop_demo:
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,50}\b(countertops?|counters?)\b|\b(countertops?|counters?)\b[^.]{0,50}\b(remove|demo|tear[\s-]?out|rip[\s-]?out)\b/,
  backsplash_demo:
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,50}\bbacksplash\b|\bbacksplash\b[^.]{0,50}\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b/,
  shower_tile: /\b(shower\s+wall\s+tile|shower\s+tile|tile\s+shower|new\s+shower\s+tile|tile\s+(?:the\s+)?(?:shower\s+)?walls?)\b/,
  wet_area_install: /\b(tub\s+install|new\s+tub|shower\s+pan|prefab\s+pan|tile\s+pan|mud\s+pan|tub[\s-]to[\s-]shower|prefab\s+shower\s+enclosure)\b/,
  shower_floor_tile: /\b(shower\s+floor\s+tile|tile\s+shower\s+floor|tile\s+(?:the\s+)?shower\s+floor)\b/,
  shower_niche: /\b(shower\s+niche|tile\s+niche|niche)\b/,
  shower_bench: /\bshower\s+bench\b/,
  shower_pan: /\b(tile\s+pan|mud\s+pan|mortar\s+bed|shower\s+curb|shower\s+entry\s+curb)\b/,
  floor_tile:
    /\b(tile\s+bath(?:room)?\s+floor|bath(?:room)?\s+floor\s+tile|tile\s+(?:the\s+)?bath(?:room)?\s+floor|new\s+bath(?:room)?\s+floor(?:\s+tile)?|(?<!shower\s)floor\s+tile|(?<!shower\s)tile\s+floor|new\s+floor\s+tile)\b/,
  flooring: /\b(install\s+(?:lvp|laminate|vinyl|carpet|flooring)|(?:lvp|laminate|vinyl|carpet|flooring)\s+(?:install|installation))\b/,
  floor_prep: /\b(floor\s+prep|subfloor|level(?:ing)?|underlayment)\b/,
  exhaust_fan: /\b(exhaust\s+fan|bath\s+fan|ventilation)\b/,
  mirror_accessories: /\b(mirror|towel\s+bar|accessories|robe\s+hook)\b/,
  cabinets: /\b(cabinets?|new\s+cabinets)\b/,
  countertops: /\b(countertops?|counters|quartz|granite|install\s+new\s+countertops?)\b/,
  sink_faucet: /\b(sink|faucet)\b/,
  garbage_disposal: /\b(garbage\s+disposal|disposal\s+install|new\s+disposal)\b/,
  drywall: /\b(drywall|sheetrock|gypsum|hang\s+and\s+finish)\b/,
  paint_trim: /\b(paint|trim|baseboards?|interior\s+paint)\b/,
  trim_paint: /\b(paint|trim|baseboards?|base\s*board|casing|crown|moulding|molding)\b/,
  tile_flooring: /\b(tile\s+(?:and\s+)?flooring|flooring|lvp|laminate|vinyl\s+plank|carpet)\b/,
  backsplash: /\b(backsplash)\b/,
  appliances:
    /\b(appliance\s+reinstall|reinstall(?:ing)?\s+(?:old\s+|existing\s+)?appliances?|appliance\s+install|install\s+appliances?|appliance\s+allowance|hookup\s+appliances?|reconnect\s+appliances?|appliance\s+hookup|appliances?\s+(?:&|and)?\s*hookup)\b/,
  island: /\b(island)\b/,
  paint: /\b(paint(?:ing)?|bathroom\s+paint)\b/,
  prep: /\b(paint(?:ing)?|primer|surface\s+prep|masking|patch(?:ing)?)\b/,
  door_paint:
    /\b(?:paint|painting)\b[^.;]{0,40}\b(?:interior\s+)?doors?\b|\b(?:interior\s+)?doors?\b[^.;]{0,40}\b(?:paint|painting)\b/,
  cabinet_paint:
    /\b(?:paint|painting|refinish(?:ing)?)\b[^.;]{0,40}\bcabinets?\b|\bcabinets?\b[^.;]{0,40}\b(?:paint|painting|refinish(?:ing)?)\b/,
  lighting: /\b(new\s+lighting|lighting|light\s+fixtures?)\b/,
  glass_door: /\b(shower\s+door|glass\s+shower)\b/,
  vanity: /\b(vanity|countertops?\s+and\s+vanity)\b/,
  plumbing_rough: /\b(plumb(?:ing)?\s+rough|rough[\s-]?in|relocat.*plumb)\b/,
  plumbing_trim:
    /\b(?:(?:final\s+)?plumbing\s+(?:fixtures?|trim(?:[\s-]?out)?)|(?:new\s+)?plumbing\s+fixtures?|fixture\s+hookups?|faucets?,?\s+toilet(?:\s+set)?|toilet\s+set(?:\s+and\s+hookups?)?)\b/,
  electrical_rough:
    /\b(electrical\s+rough(?:[\s-]?in)?|rough[\s-]?in(?:\s+electrical)?|new\s+circuits?|rewire|branch\s+(?:circuits?|wiring)|whole[\s-]?house\s+(?:electrical|rewire))\b/,
  electrical_trim:
    /\b(?:electrical\s+(?:trim(?:[\s-]?out)?|fixtures?)|trim[\s-]?out|finish(?:ing)?\s+electrical|devices?\s+and\s+plates|install\s+devices?(?:\s+and\s+plates)?)\b/,
  electrical_recessed_light: /\b(?:recessed|canless)\s+(?:lights?|cans?|fixtures?)\b/,
  electrical_standard_receptacle: /\b(?:standard\s+)?(?:outlets?|receptacles?)\b/,
  electrical_gfci_receptacle: /\bgfci(?:\s+outlets?|\s+receptacles?)?\b/,
  electrical_main_panel: /\b(?:main\s+)?panels?\b|\b\d+\s*amp(?:ere)?s?\s+panel\b/,
  electrical_dedicated_20a: /\bdedicated\s+20\s*amp(?:ere)?s?\s+circuits?\b/,
  electrical_range_hookup: /\brange(?:\s+circuit|\s+hookup)\b/,
  electrical_ceiling_fan: /\bceiling\s+fans?\b/,
  irrigation: /\b(irrigation|sprinkler)\b/,
  sod_turf: /\b(sod|natural\s+grass)\b/,
  artificial_turf: /\b(turf|artificial\s+grass|synthetic\s+grass)\b/,
  pavers: /\b(paver|pavers)\b/,
  rock: /\b(rock|gravel)\b/,
  mulch: /\bmulch\b/,
  plants: /\b(plants?|shrubs?|planting)\b/,
  trees: /\b(trees?)\b/,
  landscape_boulders: /\b(?:landscape\s+)?boulders?\b/,
  tear_off: /\b(tear[\s-]?off|remove\s+shingles?|roof\s+demo)\b/,
  shingles_roofing: /\b(shingle|roof(?:ing)?\s+install|new\s+roof)\b/,
  gutters: /\bgutters?\b/,
  downspouts: /\bdownspouts?\b/,
  equipment_replace: /\b(furnace|heat\s+pump|\bac\b|air\s+condition|hvac\s+replace)\b/,
  ductwork: /\b(duct(?:work)?|ducting)\b/,
  decking: /\b(deck(?:ing)?|composite\s+deck)\b/,
  railing: /\b(rail(?:ing)?|guardrail)\b/,
  pour_flatwork: /\b(concrete\s+patio|slab|flatwork|sidewalk|driveway)\b/,
  trenching: /\b(trench(?:ing)?|utility\s+trench)\b/,
  hang: /\b(hang\s+drywall|drywall\s+hang)\b/,
  finish_tape: /\b(tape|mud|finish\s+drywall)\b/,
  interior_paint: /\b(interior\s+paint|paint\s+(?:walls|interior))\b/,
  exterior_paint: /\b(exterior\s+paint|paint\s+exterior)\b/,
  permits: /\b(permit)\b/,
  cleanup: /\b(cleanup|disposal|dumpster|debris|final\s+clean)\b/,
};

const CHECKLIST_NO_HINTS: Record<string, RegExp> = {
  appliances: /\b(no\s+appliances|appliances\s+not\s+included|owner\s+appliances)\b/,
  // Already out of the house — removal is not in this bid.
  appliance_removal:
    /\b(appliances?\s+have\s+(?:all\s+)?(?:already\s+)?been\s+removed|appliances?\s+already\s+(?:been\s+)?(?:removed|out|gone)|already\s+(?:been\s+)?removed\s+(?:the\s+)?appliances?|appliances?\s+(?:are|were)\s+already\s+(?:removed|out|gone))\b/,
  permits: /\b(no\s+permits|permits\s+not\s+included|owner\s+pulls?\s+permits)\b/,
};

/**
 * Flooring demo requires floor-specific language. Bare "tile" demo only counts
 * when the job has no shower/tub context — "demo the existing tile and tub"
 * means shower wall tile, not flooring. Mirrors backend scopeChecklistLibrary.
 */
export function floorDemoNotesHint(n: string): boolean {
  if (/\bfloor\s+demo\b/.test(n)) return true;
  const verbs = '(?:demo|demolition|remove|removal|tear[\\s-]?out)';
  const floorish = '(?:floor(?:ing)?|lvp|vinyl|laminate|carpet|kitchen\\s+floor|floor\\s+tile|tile\\s+floor)';
  if (
    new RegExp(`\\b${verbs}\\b[^.]{0,80}\\b${floorish}\\b|\\b${floorish}\\b[^.]{0,80}\\b${verbs}\\b`).test(n)
  ) {
    return true;
  }
  const bareTileDemo = new RegExp(`\\b${verbs}\\b[^.]{0,60}\\btile\\b|\\btile\\b[^.]{0,60}\\b${verbs}\\b`);
  return bareTileDemo.test(n) && !/\b(shower|tub|bathtub|wet\s+area)\b/.test(n);
}

/** Trim & baseboard scope — not plumbing/electrical/shower fixture trim-out. */
function inferTrimStateFromNotes(n: string): 'included' | 'unsure' {
  if (
    /\b(?:(?:final\s+)?plumbing\s+trim|plumbing\s+fixtures?|electrical\s+trim|shower\s+trim|trim[\s-]?out)\b/.test(
      n
    ) &&
    !/\b(baseboards?|trim\s+(?:&|and)\s+baseboard|interior\s+trim|finish\s+trim)\b/.test(n)
  ) {
    return 'unsure';
  }
  if (/\b(baseboards?|crown|moulding|molding|casing)\b/.test(n)) return 'included';
  if (
    /\b(?:interior|finish)\s+trim\b|\btrim\s+(?:&|and)\s+(?:baseboards?|doors?)\b|\b(?:baseboards?|doors?)\s+(?:&|and)\s+trim\b|\btrim\s+install(?:ation)?\b|\binstall\s+(?:new\s+)?baseboards?\b/.test(
      n
    )
  ) {
    return 'included';
  }
  return 'unsure';
}

export function inferItemStateFromNotes(
  itemId: string,
  notes: string | null | undefined
): 'included' | 'excluded' | 'unsure' {
  const n = String(notes || '').toLowerCase();
  if (CHECKLIST_NO_HINTS[itemId]?.test(n)) return 'excluded';
  if (itemId === 'floor_demo') return floorDemoNotesHint(n) ? 'included' : 'unsure';
  if (itemId === 'trim') return inferTrimStateFromNotes(n);
  if (CHECKLIST_YES_HINTS[itemId]?.test(n)) return 'included';
  return 'unsure';
}

export function inferChoiceFromNotes(itemId: string, notes: string | null | undefined): string | null {
  const n = String(notes || '').toLowerCase();

  if (itemId === 'toilet') {
    if (/\b(move|relocate|relocating)\b.*\btoilet\b|\btoilet\b.*\b(move|relocate)\b/.test(n)) return 'relocating';
    if (/\b(replace|new|remove\s+and\s+replace)\b.*\btoilet\b|\btoilet\b.*\b(replace|new)\b/.test(n)) {
      return 'replacing';
    }
    if (
      /\b(reset|re[\s-]?set|remove\s+and\s+reinstall|reinstall)\b.*\btoilet\b|\btoilet\b.*\b(reset|re[\s-]?set|remove\s+and\s+reinstall|reinstall)\b/.test(
        n
      )
    ) {
      return 'reset';
    }
    if (/\btoilet\b.*\bstay|\bstay.*\btoilet\b/.test(n)) return 'not_in_scope';
  }

  if (itemId === 'wet_area_install' || itemId === 'tub_shower') {
    if (/\b(stay|staying|keep(?:ing)?\s+existing)\b.*\b(tub|shower)\b|\b(tub|shower)\b.*\b(stay|staying|keep)\b/.test(n)) {
      return 'staying';
    }
    if (/\b(prefab\s+shower\s+enclosure|prefab\s+enclosure|one[\s-]?piece\s+enclosure)\b/.test(n)) {
      return 'prefab_enclosure';
    }
    if (/\b(prefab|pre[\s-]?fab|acrylic|fiberglass|plastic\s+pan|pan\s+insert)\b/.test(n)) return 'prefab';
    if (/\b(tile\s+pan|mud\s+pan|mortar\s+bed|hot\s+mop|custom\s+pan)\b/.test(n)) return 'tile_pan';
    if (/\b(tub\s+install|new\s+tub|bathtub|alcove\s+tub|freestanding\s+tub)\b/.test(n)) return 'tub';
    if (/\b(tub[\s-]to[\s-]shower|new\s+shower|walk[\s-]?in\s+shower)\b/.test(n)) return 'prefab';
  }

  if (itemId === 'vanity') {
    if (/\b(remove\s+and\s+replace|replace|new)\b.*\bvanity\b|\bvanity\b.*\b(replace|new)\b/.test(n)) {
      return 'replacing';
    }
  }

  if (itemId === 'walls_moving') {
    const ids = inferChoicesFromNotes(itemId, notes);
    return ids[0] || null;
  }

  if (itemId === 'shower_pan') {
    if (/\b(prefab|pre[\s-]?fab|acrylic|fiberglass|plastic\s+pan|pan\s+insert)\b/.test(n)) return 'prefab';
    if (/\b(tile\s+pan|mud\s+pan|mortar\s+bed|hot\s+mop|custom\s+pan)\b/.test(n)) return 'tile_pan';
  }

  if (itemId === 'garbage_disposal') {
    if (/\b(no\s+disposal|disposal\s+not\s+included|without\s+disposal)\b/.test(n)) return 'not_in_scope';
    if (
      /\b(reuse|re[\s-]?use|reinstall|re[\s-]?install|existing\s+disposal)\b[^.]{0,50}\bdisposal\b|\bdisposal\b[^.]{0,50}\b(reuse|re[\s-]?use|reinstall|re[\s-]?install|existing)\b/.test(
        n
      )
    ) {
      return 'reuse_install';
    }
    if (/\b(new\s+disposal|replace|replacing)\b[^.]{0,50}\bdisposal\b|\bdisposal\b[^.]{0,50}\b(new|replace|replacing)\b/.test(n)) {
      return 'replace_install';
    }
    if (/\b(garbage\s+disposal|disposal\s+install)\b/.test(n)) return 'replace_install';
  }

  return null;
}

export function inferChoicesFromNotes(itemId: string, notes: string | null | undefined): string[] {
  const n = String(notes || '').toLowerCase();
  if (itemId !== 'walls_moving') return [];

  const ids: string[] = [];
  if (
    /\b(remove|removing|demo|demolish|tear[\s-]?out)\b[^.;]{0,60}\bwalls?\b|\bwalls?\b[^.;]{0,60}\b(remove|removing|demo|demolish|tear[\s-]?out)\b/.test(
      n
    )
  ) {
    ids.push('remove');
  }
  if (
    /\b(add|adding|moving|new|build)\b[^.;]{0,60}\bwalls?\b|\bwalls?\b[^.;]{0,60}\b(add|adding|moving|new|build)\b/.test(
      n
    )
  ) {
    ids.push('add');
  }
  if (!ids.length && /\b(no\s+wall|walls?\s+not\s+moving|no\s+layout\s+changes?)\b/.test(n)) {
    ids.push('no_changes');
  }
  return ids;
}
