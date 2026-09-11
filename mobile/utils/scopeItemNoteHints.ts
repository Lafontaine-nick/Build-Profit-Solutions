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
  cabinet_demo:
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,50}\b(?:cabinets?|built[\s-]?ins?)\b|\b(?:cabinets?|built[\s-]?ins?)\b[^.]{0,50}\b(remove|demo|tear[\s-]?out|rip[\s-]?out)\b|\btear[\s-]?out\s+old\s+cabinets?\b/,
  countertop_demo:
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,50}\b(countertops?|counters?)\b|\b(countertops?|counters?)\b[^.]{0,50}\b(remove|demo|tear[\s-]?out|rip[\s-]?out)\b/,
  backsplash_demo:
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,50}\bbacksplash\b|\bbacksplash\b[^.]{0,50}\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b/,
  island_demo:
    /\b(?:demo|remove|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,40}\b(?:island\s+(?:cabinet|base)|island)\b|\b(?:island\s+(?:cabinet|base)|island)\b[^.]{0,40}\b(?:demo|remove|tear[\s-]?out|rip[\s-]?out)\b/,
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
  island:
    /\b(?:new|install|build|add|replace)\b[^.]{0,30}\bisland\b(?!\s+(?:countertops?|counters?)\b)|\bkitchen\s+island\b/,
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
  electrical:
    /\b(electrical|new\s+circuits?|wiring|outlets?|switches?|gfci|panel|recessed\s+(?:lights?|cans?))\b/,
  electrical_rough:
    /\b(electrical\s+rough(?:[\s-]?in)?|rough[\s-]?in(?:\s+electrical)?|new\s+circuits?|rewire|branch\s+(?:circuits?|wiring)|whole[\s-]?house\s+(?:electrical|rewire))\b/,
  electrical_trim:
    /\b(electrical\s+(?:trim|trim[\s-]?out|devices?|fixtures?)|outlets?|switches?|lighting|recessed\s+(?:lights?|cans?)|finish(?:ing)?\s+electrical|devices?\s+and\s+plates|install\s+devices?(?:\s+and\s+plates)?)\b/,
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
  pour_flatwork:
    /\b(?:concrete\s+patio|slab|flatwork|sidewalk|driveway|pour\b[^.]{0,40}\b(?:driveway|slab|patio|sidewalk|walkway))\b/,
  site_prep:
    /\b(site\s+prep|subgrade|gravel\s+base|base\s+gravel|compaction|grade\s+prep)\b/,
  gravel_base:
    /\b(gravel\s+base|base\s+gravel|crushed\s+(?:rock|stone)\s+base|aggregate\s+base)\b/,
  reinforcement: /\b(rebar|re[\s-]?bar|wire\s+mesh|mesh\s+reinforcement|#4\s+bar)\b/,
  complex_forming:
    /\b(?:forms?|formwork|thickened\s+edge|edge\s+thickening|curb\s+form)\b/,
  concrete_pumping:
    /\b(?:pump\s+truck|concrete\s+pump|pump(?:ing)?\s+(?:truck|if\s+needed|may\s+be|might\s+be|required))\b|\bmight\s+need\s+(?:a\s+)?pump\b/,
  decorative_finish:
    /\b(stamped\s+concrete|exposed\s+aggregate|stain(?:ed)?\s+concrete|decorative\s+finish)\b/,
  trenching: /\b(trench(?:ing)?|utility\s+trench)\b/,
  hang: /\b(hang\s+drywall|drywall\s+hang)\b/,
  finish_tape: /\b(tape|mud|finish\s+drywall)\b/,
  interior_paint: /\b(interior\s+paint|paint\s+(?:walls|interior))\b/,
  exterior_paint: /\b(exterior\s+paint|paint\s+exterior)\b/,
  permits:
    /\b(include\s+permits?|permits?\s+included|pull\s+permits?|contractor\s+pulls?\s+permits?|permits?\s+in\s+(?:the\s+)?(?:bid|price|scope)|permit\s+fees?\s+included)\b/i,
  cleanup: /\b(cleanup|disposal|dumpster|debris|final\s+clean)\b/,
  plumbing:
    /\b(plumb(?:ing)?|rough\s+plumb(?:ing)?|water\s+lines?|drain(?:age)?|sewer|bathroom\s+rough)\b/,
  plans_engineering:
    /\b(plans?|drawings?|engineering|architect(?:ural)?|design\s+docs?)\b/,
  utility_coordination:
    /\b(utility\s+coordination|utility\s+coord|coordinate\s+utilities|utility\s+company)\b/,
  sitework: /\b(site\s*work|site\s+prep|lot\s+prep|clearing|grubbing)\b/,
  landscaping:
    /\b(landscap(?:e|ing)|sod|irrigation|site\s+walls?|fence(?:s|ing)?|gates?)\b/,
  excavation:
    /\b(excavat(?:e|ion)|dig(?:ging)?|dig\s+out|trench(?:ing)?|cut\s+foundation)\b/,
  grading: /\b(grading|grade\s+site|rough\s+grade|final\s+grade)\b/,
  utility_trenching:
    /\b(utility\s+trench(?:ing)?|trench(?:ing)?\s+(?:for\s+)?utilities|water\s+line|sewer\s+line|gas\s+line)\b/,
  foundation: /\b(foundation|footings?|stem\s+wall|crawlspace)\b|\b(?:pour|new)\b[^.]{0,30}\bslab\b/,
  concrete: /\b(concrete|slab|footings?|foundation\s+pour)\b/,
  framing: /\b(fram(?:e|ing)|wall\s+framing|roof\s+framing|shell)\b/,
  openings:
    /\b(?:re[-\s]?frame|new\s+(?:window|door)?\s*opening|resize(?:d|ing)?\s+(?:the\s+)?(?:window|door)?\s*opening|enlarge(?:d|ing)?\s+(?:the\s+)?(?:window|door)?\s*opening)\b/,
  roof_tie_in:
    /\b(roof\s+tie[\s-]?in|tie\s+into\s+(?:the\s+)?roof|roofing\s+tie[\s-]?in|roofing)\b/,
  windows: /\bwindows?\b/,
  exterior_doors: /\b(exterior\s+doors?|entry\s+doors?|iron\s+doors?)\b/,
  sliding_doors: /\b(sliding\s+doors?|patio\s+doors?|sliders?)\b/,
  garage_doors: /\bgarage\s+doors?\b/,
  windows_doors:
    /\b(?:windows?|exterior\s+doors?|entry\s+doors?|sliding\s+doors?|patio\s+doors?|sliders?)\b/,
  window_install:
    /\b(?:replace|replacement|install|installation|new)\b[^.;\n]{0,40}\bwindows?\b|\bwindows?\b[^.;\n]{0,40}\b(?:replace|replacement|install|installation)\b/,
  exterior_finishes:
    /\b(exterior\s+finishes|siding|soffit|fascia|exterior\s+trim|sheeting|osb|house\s*wrap|weather\s+barrier|exterior\s+plywood|stucco|eifs)\b/,
  hvac: /\b(hvac|furnace|air\s+condition|heat\s+pump|duct(?:work)?|mini[\s-]?split)\b/,
  insulation: /\b(insulat(?:e|ion)|batt\s+insulation|spray\s+foam)\b/,
  air_sealing:
    /\b(?:air[\s-]?seal(?:ing)?|draft[\s-]?seal(?:ing)?|gap[\s-]?seal(?:ing)?|penetration[\s-]?seal(?:ing)?|gap[\s-]?penetrations?|seal(?:ing)?\s+(?:air\s+)?gaps?|seal(?:ing)?\s+(?:air\s+)?penetrations?)\b/i,
  cabinets_counters:
    /\b(cabinets?|cabinetry|counters?|countertops?|kitchenette|quartz|granite)\b/,
  tile: /\b(tile|shower\s+tile|floor\s+tile|backsplash)\b/,
  interior_trim:
    /\b(finish\s+(?:trim|carpentry)|interior\s+(?:trim|doors?)|baseboards?|casing|closet\s+shelving)\b/,
  hvac_startup:
    /\b(hvac\s+(?:startup|registers?|trim)|registers?|start\s+up\s+hvac)\b/,
  final_inspections:
    /\b(final\s+inspection|final\s+inspections|inspection\s+closeout)\b/,
  contingency: /\b(contingency|contingency\s+allowance)\b/,
  roofing: /\b(roof(?:ing)?|shingles?|roof\s+install)\b/,
  stucco:
    /\b(stucco|exterior\s+wall\s+finish|exterior\s+plaster|synthetic\s+stucco|efis|eifs)\b/,
  exterior: /\b(exterior\s+envelope)\b/,
  mep_rough:
    /\b(mep|mechanical|electrical|plumbing|rough[\s-]?in|rough\s+mechanical)\b/,
  utility_taps:
    /\b(utility\s+taps?|water\s+tap|sewer\s+tap|gas\s+tap|utility\s+connections?)\b/,
  trim_finish:
    /\btrim\s*&?\s*finish\b|\b(?:window|door)\s+casing\b|\bstool\s*(?:\/|and)?\s*apron\b/i,
};

export type OwnerHandledScopeCategory = 'sitework' | 'utilities' | 'landscaping';

const OWNER_HANDLED_SCOPE_KEYWORDS: Record<OwnerHandledScopeCategory, RegExp> = {
  sitework:
    /\b(?:sitework|site\s*work|excavat(?:e|ion)?|grading|site\s+prep)\b/i,
  utilities: /\butilities?\b/i,
  landscaping: /\blandscap(?:e|ing)\b/i,
};

const OWNER_HANDLED_SCOPE_ITEM_CATEGORIES: Partial<
  Record<string, OwnerHandledScopeCategory>
> = {
  sitework: 'sitework',
  excavation: 'sitework',
  grading: 'sitework',
  utility_taps: 'utilities',
  utility_trenching: 'utilities',
  landscaping: 'landscaping',
};

/** True when notes say the owner/customer handles sitework, utilities, or landscaping. */
export function notesOwnerHandlesScopeCategory(
  notes: string | null | undefined,
  category: OwnerHandledScopeCategory
): boolean {
  const text = String(notes || '').trim();
  if (!text) return false;
  const keyword = OWNER_HANDLED_SCOPE_KEYWORDS[category];
  const ownerClause = text.match(
    /\b(?:customer|owner|homeowner|client)\s+(?:is\s+)?(?:handling|doing|providing|taking\s+care\s+of)\s+([^.;]+)/i
  );
  if (ownerClause && keyword.test(ownerClause[1])) return true;
  if (/\bseparate\s+from\s+us\b/i.test(text) && keyword.test(text)) return true;
  if (
    /\b(?:by\s+others|not\s+included|excluded|owner[\s-]provided)\b/i.test(text) &&
    keyword.test(text)
  ) {
    return true;
  }
  return false;
}

const CHECKLIST_NO_HINTS: Record<string, RegExp> = {
  flooring:
    /\b(?:flooring|floors?|finished\s+floor)\s+(?:protection|protect(?:ion|ed|ing))\b|\bprotect(?:ion|ed|ing)\b[^.]{0,40}\b(?:flooring|floors?|finished\s+floor)\b/,
  framing:
    /\b(?:no|without|not)\s+(?:wall\s+removal|structural\s+framing|framing|layout\s+changes?)\b|\b(?:wall\s+removal|structural\s+framing|framing|layout\s+changes?)\s+(?:not\s+included|excluded)\b/,
  walls_moving:
    /\b(?:no|without|not)\s+(?:wall\s+removal|structural\s+framing|framing|layout\s+changes?)\b|\b(?:wall\s+removal|structural\s+framing|framing|layout\s+changes?)\s+(?:not\s+included|excluded)\b/,
  appliances: /\b(no\s+appliances|appliances\s+not\s+included|owner\s+appliances)\b/,
  // Already out of the house — removal is not in this bid.
  appliance_removal:
    /\b(appliances?\s+have\s+(?:all\s+)?(?:already\s+)?been\s+removed|appliances?\s+already\s+(?:been\s+)?(?:removed|out|gone)|already\s+(?:been\s+)?removed\s+(?:the\s+)?appliances?|appliances?\s+(?:are|were)\s+already\s+(?:removed|out|gone))\b/,
  permits: /\b(no\s+permits|permits\s+not\s+included|owner\s+pulls?\s+permits)\b/,
  garage_doors:
    /\b(?:keep(?:ing)?\s+(?:the\s+)?(?:existing\s+)?garage\s+door|existing\s+garage\s+door\s+(?:for\s+now|stays?|remain(?:s|ing)?)|(?:no|without|not)\s+(?:a\s+)?(?:new\s+)?garage\s+door)\b/,
  foundation:
    /\b(no|without|not\s+including)\s+(?:new\s+)?(?:foundation|footings?|slab)\b|\b(?:foundation|footings?|slab)\s+(?:not\s+included|excluded)\b/,
  roof_tie_in:
    /\b(no|without|not\s+including)\b[^.]{0,40}\b(?:roof(?:ing)?|roof\s+tie[\s-]?in|roof\s+work)\b|\b(?:roof(?:ing)?|roof\s+tie[\s-]?in|roof\s+work)\s+(?:not\s+included|excluded)\b/,
  roofing:
    /\b(no|without|not\s+including)\b[^.]{0,40}\b(?:roof(?:ing)?|roof\s+work)\b|\b(?:roof(?:ing)?|roof\s+work)\s+(?:not\s+included|excluded)\b/,
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
  const ownerCategory = OWNER_HANDLED_SCOPE_ITEM_CATEGORIES[itemId];
  if (
    ownerCategory &&
    notesOwnerHandlesScopeCategory(notes, ownerCategory)
  ) {
    return 'excluded';
  }
  if (CHECKLIST_NO_HINTS[itemId]?.test(n)) return 'excluded';
  if (itemId === 'floor_demo') return floorDemoNotesHint(n) ? 'included' : 'unsure';
  if (itemId === 'trim') return inferTrimStateFromNotes(n);
  if (CHECKLIST_YES_HINTS[itemId]?.test(n)) return 'included';
  return 'unsure';
}

/** Primary roofing system choice from job notes (Confirm Scope `roofing_system` card). */
export function inferRoofingSystemFromNotes(
  notes: string | null | undefined
): string | null {
  const n = String(notes || '').toLowerCase();
  if (!n.trim()) return null;

  if (/\b(pricing[\s_-]?gap|custom\s+system|unsupported\s+system)\b/.test(n)) {
    return 'custom_other';
  }
  if (/\b(standing[\s-]?seam|standing\s+seam\s+metal)\b/.test(n)) {
    return 'standing_seam_metal';
  }
  if (
    /\b(exposed[\s-]?fastener|screw[\s-]?down\s+metal|corrugated\s+metal|r[\s-]?panel|ag\s+panel)\b/.test(
      n
    )
  ) {
    return 'exposed_fastener_metal';
  }
  if (/\b(concrete\s+tile|clay\s+tile|tile\s+roof|slate\s+tile)\b/.test(n)) {
    return 'concrete_clay_tile';
  }
  if (/\b(tpo|thermoplastic\s+polyolefin)\b/.test(n)) return 'tpo';
  if (/\b(epdm|rubber\s+roof|rubber\s+membrane)\b/.test(n)) return 'epdm';
  if (/\b(modified\s+bitumen|torch[\s-]?down|mod[\s-]?bit)\b/.test(n)) {
    return 'modified_bitumen';
  }
  if (/\b(3[\s-]?tab|three[\s-]?tab)\b/.test(n)) return 'three_tab_shingles';
  if (
    /\b(architectural|dimensional|laminate)\s+shingles?\b/.test(n) ||
    /\b(asphalt\s+shingles?|shingle\s+roof|new\s+shingles?|shingles?\s+install)\b/.test(
      n
    ) ||
    /\b(re[\s-]?roof|roof\s+replacement|reroof)\b/.test(n)
  ) {
    return 'architectural_shingles';
  }
  if (/\b(metal\s+roof|steel\s+roof)\b/.test(n)) return 'standing_seam_metal';
  return null;
}

/** Tear-off depth / type from job notes (Confirm Scope `tear_off` choice card). */
export function inferRoofingTearOffFromNotes(
  notes: string | null | undefined
): string | null {
  const n = String(notes || '').toLowerCase();
  if (!n.trim()) return null;

  if (
    /\b(new\s+construction|no\s+tear[\s-]?off|without\s+tear[\s-]?off|overlay|recover|roof[\s-]?over)\b/.test(
      n
    )
  ) {
    return 'new_construction';
  }
  if (/\b((?:two|2)\s+layers?|double\s+layer|2x\s+shingle)\b/.test(n)) {
    return 'two_layers';
  }
  if (/\b((?:three|3|4|four)\+?\s+layers?|3\+)\b/.test(n)) {
    return 'three_plus_custom';
  }
  if (/\b(tile\s+removal|remove\s+tile\s+roof|tear[\s-]?off\s+tile)\b/.test(n)) {
    return 'tile_removal';
  }
  if (/\b(metal\s+roof\s+removal|remove\s+metal\s+roof|tear[\s-]?off\s+metal)\b/.test(n)) {
    return 'metal_removal';
  }
  if (
    /\b(membrane\s+removal|tpo\s+removal|epdm\s+removal|tear[\s-]?off\s+(?:tpo|epdm|membrane|flat))\b/.test(
      n
    )
  ) {
    return 'membrane_removal';
  }
  if (/\b(tear[\s-]?off|tear\s+off|remove\s+shingles?|roof\s+demo|strip\s+roof)\b/.test(n)) {
    return 'one_layer';
  }
  if (/\b(re[\s-]?roof|roof\s+replacement|reroof|new\s+roof)\b/.test(n)) {
    return 'one_layer';
  }
  return null;
}

/**
 * Tear-off + install/replace language — price via tear_off + shingles, not the
 * standalone Roof repairs sqft card (even when notes say "roofing repair bid").
 */
export function notesImplyRoofTearOffAndInstall(
  notes: string | null | undefined
): boolean {
  const n = String(notes || '').toLowerCase();
  if (!n.trim()) return false;

  const tearOff = inferRoofingTearOffFromNotes(notes);
  if (!tearOff || tearOff === 'new_construction') return false;

  if (inferRoofingSystemFromNotes(notes)) return true;

  return (
    /\b(?:tear[\s-]?off|tear\s+off|remove\s+shingles?|strip\s+roof)\b[^.]{0,64}\b(?:and\s+)?(?:replace|install|re[\s-]?roof)\b/.test(
      n
    ) ||
    /\b(?:replace|install|re[\s-]?roof)\b[^.]{0,64}\b(?:tear[\s-]?off|tear\s+off|remove\s+shingles?|asphalt\s+shingles?|shingles?)\b/.test(
      n
    ) ||
    /\basphalt\s+shingles?\b[^.]{0,64}\b(?:tear[\s-]?off|tear\s+off|remove)\b/.test(
      n
    ) ||
    /\b(?:tear[\s-]?off|tear\s+off|remove)\b[^.]{0,64}\basphalt\s+shingles?\b/.test(
      n
    )
  );
}

/** Drop roof_repairs from inferred chips when notes route to tear-off + install. */
export function filterRoofingScopeSelectionsForTearOffInstall(
  selections: string[],
  notes: string | null | undefined,
  saved: string[] = []
): string[] {
  if (!notesImplyRoofTearOffAndInstall(notes)) return selections;
  if (saved.includes('roof_repairs')) return selections;
  return selections.filter(id => id !== 'roof_repairs');
}

export function suppressRoofRepairMeasurementsWhenTearOffInstall<
  T extends {
    roofRepairAffectedSqft?: string | number | null;
    itemQuantities?: Record<string, unknown> | null;
    tradeScopeSelections?: Record<string, string[] | null> | null;
  },
>(
  measurements: T,
  notes: string | null | undefined,
  savedRoofingSelections: string[] = []
): T {
  if (
    !notesImplyRoofTearOffAndInstall(notes) ||
    savedRoofingSelections.includes('roof_repairs')
  ) {
    return measurements;
  }

  const next: T = { ...measurements, roofRepairAffectedSqft: '' };
  const roofingSelections = next.tradeScopeSelections?.roofing;
  if (roofingSelections?.length) {
    const filtered = roofingSelections.filter(id => id !== 'roof_repairs');
    next.tradeScopeSelections = {
      ...next.tradeScopeSelections,
      roofing: filtered.length ? filtered : null,
    };
  }
  if (next.itemQuantities?.roof_repairs) {
    const { roof_repairs: _removed, ...rest } = next.itemQuantities;
    next.itemQuantities = rest;
  }
  return next;
}

/** Union every notes field so roofing chip inference cannot miss ice & water in originalNotes. */
export function collectRoofingInferenceNotes(
  draft:
    | {
        originalNotes?: string | null;
        projectDescription?: string | null;
        contractScope?: string | null;
        scopeChecklist?: { intro?: string } | null;
      }
    | null
    | undefined,
  notesFallback?: string | null
): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of [
    notesFallback,
    draft?.originalNotes,
    draft?.projectDescription,
    draft?.contractScope,
    draft?.scopeChecklist?.intro,
  ]) {
    const text = String(raw || '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    parts.push(text);
  }
  return parts.join('\n\n');
}

/** Premium/synthetic upgrade only — standard felt is included in base roofing. */
export function infersRoofingUnderlaymentUpgradeFromNotes(
  notes: string | null | undefined
): boolean {
  const n = String(notes || '').toLowerCase();
  return /\b(synthetic\s+underlayment|premium\s+underlayment|underlayment\s+upgrade)\b/.test(
    n
  );
}

/** Lump-sum decking allowance when notes budget for bad wood / repairs. */
export function parseRoofingDeckingAllowanceFromNotes(
  notes: string | null | undefined
): number | null {
  const text = String(notes || '');
  if (!/\bdeck(?:ing)?\b/i.test(text)) return null;
  if (
    !/\ballowance\b/i.test(text) &&
    !/\bbad\s+wood\b|\brotten\b|\bsoft\s+spot/i.test(text)
  ) {
    return null;
  }
  const patterns = [
    /\$\s*([\d,]+(?:\.\d+)?)\s+allowance\b/i,
    /\ballowance\s*(?:of\s*)?\$\s*([\d,]+(?:\.\d+)?)/i,
    /\$\s*([\d,]+(?:\.\d+)?)[^.]{0,48}\ballowance\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const amount = Number(String(match[1]).replace(/,/g, ''));
    if (Number.isFinite(amount) && amount > 0) return Math.round(amount);
  }
  return null;
}

/** QM roofing chip ids to pre-select from notes when the user has not tapped chips yet. */
export function inferRoofingTradeScopeSelectionsFromNotes(
  notes: string | null | undefined
): string[] {
  const n = String(notes || '').toLowerCase();
  if (!n.trim()) return [];

  const ids = new Set<string>();
  const tearOff = inferRoofingTearOffFromNotes(notes);
  if (tearOff && tearOff !== 'new_construction') ids.add('tear_off');

  const system = inferRoofingSystemFromNotes(notes);
  if (system === 'architectural_shingles' || system === 'three_tab_shingles') {
    ids.add('shingles');
  }

  if (
    /\b(ice\s*[&/-]\s*water|ice\s+and\s+water|ice\s*barrier|eaves?\s+protection)\b/.test(
      n
    ) ||
    /\bice\b[^.]{0,32}\bwater\b/.test(n)
  ) {
    ids.add('ice_water_shield');
  }
  if (infersRoofingUnderlaymentUpgradeFromNotes(notes)) {
    ids.add('underlayment');
  }
  if (/\b(ridge\s+vent)\b/.test(n)) ids.add('ridge_vent');
  if (/\b(drip\s+edge)\b/.test(n)) ids.add('drip_edge');
  if (/\b(pipe\s+boots?)\b/.test(n)) ids.add('pipe_boots');
  if (/\b(cleanup|disposal|dumpster|haul[\s-]?off)\b/.test(n)) ids.add('cleanup');
  if (
    /\bdeck(?:ing)?\b/i.test(n) &&
    (/\ballowance\b/i.test(n) ||
      /\bbad\s+wood\b|\brotten\b|\bsoft\s+spot/i.test(n) ||
      /\bdeck(?:ing)?\b[^.]{0,48}\b(repair|replace|sheath)/i.test(n))
  ) {
    ids.add('decking_repair');
  }

  return [...ids];
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

  if (itemId === 'roofing_system') return inferRoofingSystemFromNotes(notes);
  if (itemId === 'tear_off') return inferRoofingTearOffFromNotes(notes);

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
