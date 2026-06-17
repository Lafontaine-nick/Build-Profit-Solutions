/** Client mirror of backend scopeChecklistLibrary note inference (keep in sync). */

const CHECKLIST_YES_HINTS: Record<string, RegExp> = {
  demo: /\b(demo|demolition|tear\s*out|gut|remove)\b(?![^.]{0,80}\b(?:tile|floor|flooring|lvp|vinyl|laminate|carpet)\b)/,
  appliance_removal:
    /\b(remove|disconnect|pull|haul).*\b(appliance|ridge|dishwasher|range|refrigerator|oven|microwave|hood)\b|\b(appliance|ridge|dishwasher|range|refrigerator)\b.*\b(remove|disconnect|pull|haul)\b/,
  floor_demo:
    /\b(?:floor\s+demo|(?:demo|demolition|remove|removal|tear[\s-]?out)[^.]{0,80}\b(?:floor|tile|lvp|vinyl|flooring|kitchen\s+floor)|(?:floor|tile|lvp|vinyl|flooring|kitchen\s+floor)[^.]{0,80}\b(?:demo|demolition|remove|removal|tear[\s-]?out))\b/,
  tub_demo: /\b(remove|demo|tear[\s-]?out|rip[\s-]?out).*\b(tub|bathtub)\b|\b(tub|bathtub)\b.*\b(remove|demo|tear[\s-]?out)\b/,
  shower_floor_demo:
    /\b(remove|demo|tear[\s-]?out).*\b(shower\s+(?:pan|floor|base)|pan\s+insert|mud\s+pan)\b|\b(shower\s+(?:pan|floor|base)|prefab\s+pan)\b.*\b(remove|demo|tear[\s-]?out)\b/,
  shower_tile: /\b(shower\s+wall\s+tile|shower\s+tile|tile\s+shower|new\s+shower\s+tile)\b/,
  wet_area_install: /\b(tub\s+install|new\s+tub|shower\s+pan|prefab\s+pan|tile\s+pan|mud\s+pan|tub[\s-]to[\s-]shower)\b/,
  shower_floor_tile: /\b(shower\s+floor\s+tile|tile\s+shower\s+floor)\b/,
  shower_niche: /\b(shower\s+niche|tile\s+niche|niche)\b/,
  shower_bench_curb: /\b(shower\s+bench|curb|bench)\b/,
  floor_tile: /\b(floor\s+tile|tile\s+floor|new\s+floor\s+tile)\b/,
  flooring: /\b(install\s+(?:lvp|laminate|vinyl|carpet|flooring)|(?:lvp|laminate|vinyl|carpet|flooring)\s+(?:install|installation))\b/,
  floor_prep: /\b(floor\s+prep|subfloor|level(?:ing)?|underlayment)\b/,
  exhaust_fan: /\b(exhaust\s+fan|bath\s+fan|ventilation)\b/,
  mirror_accessories: /\b(mirror|towel\s+bar|accessories|robe\s+hook)\b/,
  cabinets: /\b(cabinets?|new\s+cabinets)\b/,
  countertops: /\b(countertops?|counters|quartz|granite|install\s+new\s+countertops?)\b/,
  backsplash: /\b(backsplash)\b/,
  appliances:
    /\b(appliance\s+install|install\s+appliances?|appliance\s+allowance|hookup\s+appliances?|reconnect\s+appliances?|appliance\s+hookup)\b/,
  island: /\b(island)\b/,
  paint: /\b(paint(?:ing)?|bathroom\s+paint)\b/,
  lighting: /\b(new\s+lighting|lighting|light\s+fixtures?)\b/,
  glass_door: /\b(shower\s+door|glass\s+shower)\b/,
  vanity: /\b(vanity|countertops?\s+and\s+vanity)\b/,
  plumbing_rough: /\b(plumb(?:ing)?\s+rough|rough[\s-]?in|relocat.*plumb)\b/,
  electrical_rough: /\b(electrical|new\s+circuits?|wiring|gfci)\b/,
  irrigation: /\b(irrigation|sprinkler)\b/,
  sod_turf: /\b(sod|turf|grass)\b/,
  pavers: /\b(paver|pavers)\b/,
  rock_mulch: /\b(rock|mulch|gravel)\b/,
  plants_trees: /\b(plants?|trees?|shrubs?|planting)\b/,
  tear_off: /\b(tear[\s-]?off|remove\s+shingles?|roof\s+demo)\b/,
  shingles_roofing: /\b(shingle|roof(?:ing)?\s+install|new\s+roof)\b/,
  gutters_downspouts: /\b(gutter|downspout)\b/,
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
  trim: /\b(baseboards?|trim|crown|moulding|molding|casing)\b/,
  permits: /\b(permit)\b/,
  cleanup: /\b(cleanup|disposal|dumpster|debris|final\s+clean)\b/,
};

const CHECKLIST_NO_HINTS: Record<string, RegExp> = {
  appliances: /\b(no\s+appliances|appliances\s+not\s+included|owner\s+appliances)\b/,
  permits: /\b(no\s+permits|permits\s+not\s+included|owner\s+pulls?\s+permits)\b/,
};

export function inferItemStateFromNotes(
  itemId: string,
  notes: string | null | undefined
): 'included' | 'excluded' | 'unsure' {
  const n = String(notes || '').toLowerCase();
  if (CHECKLIST_NO_HINTS[itemId]?.test(n)) return 'excluded';
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
    if (/\btoilet\b.*\bstay|\bstay.*\btoilet\b/.test(n)) return 'staying';
  }

  if (itemId === 'wet_area_install' || itemId === 'tub_shower') {
    if (/\b(stay|staying|keep(?:ing)?\s+existing)\b.*\b(tub|shower)\b|\b(tub|shower)\b.*\b(stay|staying|keep)\b/.test(n)) {
      return 'staying';
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

  return null;
}

export function inferChoicesFromNotes(itemId: string, notes: string | null | undefined): string[] {
  const n = String(notes || '').toLowerCase();
  if (itemId !== 'walls_moving') return [];

  const ids: string[] = [];
  if (/\b(remove|removing|demo|demolish|tear[\s-]?out)\b.*\bwalls?\b|\bwalls?\b.*\b(remove|removing|demo|demolish|tear[\s-]?out)\b/.test(n)) {
    ids.push('remove');
  }
  if (/\b(add|adding|moving|new|build)\b.*\bwalls?\b|\bwalls?\b.*\b(add|adding|moving|new|build)\b/.test(n)) {
    ids.push('add');
  }
  if (!ids.length && /\b(no\s+wall|walls?\s+not\s+moving|no\s+layout\s+changes?)\b/.test(n)) {
    ids.push('no_changes');
  }
  return ids;
}
