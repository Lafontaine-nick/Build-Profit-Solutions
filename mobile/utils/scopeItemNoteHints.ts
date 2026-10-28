import {
  bathroomNoteClauseHas,
  notesKeepExistingWetArea,
} from '@/utils/bathroomNoteScope';
import { kitchenNoteNamesSurfaceDemo } from '@/utils/kitchenNoteScope';
import {
  notesImplyExteriorFlatwork,
  notesImplyStructuralFoundation,
} from '@/utils/foundationPlanningMeasurements';

/** Client mirror of backend scopeChecklistLibrary note inference (keep in sync). */

const CHECKLIST_YES_HINTS: Record<string, RegExp> = {
  demo: /\b(?<!no\s)(?<!without\s)(demo|demolition|tear\s*out|gut|remove)\b(?![^.]{0,80}\b(?:tile|floor|flooring|lvp|vinyl|laminate|carpet)\b)/,
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
  cabinet_hardware: /\b(?:cabinet\s+hardware|pulls|knobs)\b/,
  haul_off: /\bhaul[\s-]?off\b/,
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
  trim_paint:
    /\b(?:paint(?:ing)?|prime|prep|repaint)\b[^.;\n]{0,40}\b(?:baseboards?|base\s*board|trim|casing|crown|moulding|molding)\b|\b(?:baseboards?|base\s*board|trim|casing|crown|moulding|molding)\b[^.;\n]{0,40}\b(?:paint(?:ing)?|prime|prep|repaint)\b/,
  tile_flooring: /\b(tile\s+(?:and\s+)?flooring|flooring|lvp|laminate|vinyl\s+plank|carpet)\b/,
  backsplash: /\b(backsplash)\b/,
  appliances:
    /\b(appliance\s+reinstall|reinstall(?:ing)?\s+(?:old\s+|existing\s+)?appliances?|appliance\s+install|install\s+appliances?|appliance\s+allowance|hookup\s+appliances?|reconnect\s+appliances?|appliance\s+hookup|appliances?\s+(?:&|and)?\s*hookup)\b/,
  island:
    /\b(?:new|install|build|add|replace)\b[^.]{0,30}\bisland\b(?!\s+(?:countertops?|counters?)\b)|\bkitchen\s+island\b/,
  paint: /\b(paint(?:ing)?|bathroom\s+paint)\b/,
  prep: /\b(?:primers?|masking|patch(?:ing|es)?|(?:surface\s+)?prep(?:ping|ped|aration)?)\b/,
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
    /\b(site\s+prep|subgrade|gravel\s+base|base\s+gravel|compaction|grade\s+prep|prep(?:ping|s|ped)?\s+(?:the\s+)?(?:base|subgrade)|base\s+prep)\b/,
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
  interior_paint:
    /\b(?:interior\s+paint(?:ing)?|paint(?:ing)?\b[^.;\n]{0,40}\b(?:walls?|ceilings?|interior))\b/,
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
  sitework:
    /\b(site\s*work|site\s+prep|lot\s+prep|clearing|clear(?:ing)?\s+(?:and\s+)?(?:demolish|remove)|grubbing|demolish(?:ed|ing)?\s+the\s+existing\s+area)\b/,
  landscaping:
    /\b(landscap(?:e|ing)|sod|irrigation|site\s+walls?|fence(?:s|ing)?|gates?)\b/,
  excavation:
    /\b(excavat(?:e|ion)|dig(?:ging)?|dig\s+out|trench(?:ing)?|cut\s+foundation)\b/,
  grading:
    /\b(grading|(?<!builder[-\s])grade(?!\s+(?:prep|finish(?:es)?))|grade\s+site|rough\s+grade|final\s+grade)\b/i,
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
  hvac: /\b(hvac|furnace|air\s+handler|air\s+condition|condenser|heat\s+pump|duct(?:work)?|mini[\s-]?split)\b/,
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

/** New-home notes such as "New 2,800 sqft two story home". */
export function notesDescribeGroundUpHome(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return (
    /\b(?:new\s+build|new\s+construction|ground[\s-]?up|custom\s+home|spec\s+home)\b/i.test(
      text
    ) ||
    /\bnew\s+[\d,]+\s*(?:sq\.?\s*ft|sqft|square\s+feet)\b[^.]{0,48}\b(?:home|house)\b/i.test(
      text
    )
  );
}

export function notesAskForExteriorPaint(notes?: string | null): boolean {
  return /\bexterior\s+paint(?:ing)?\b|\bpaint(?:ing)?\s+(?:the\s+)?(?:brick\s+|stucco\s+|siding\s+)?exterior\b/i.test(
    String(notes || '')
  );
}

/**
 * Brick, stucco, or siding on a new home prices that wall. Exterior paint
 * stays only when the note asks for it.
 */
export function namedFinishReplacesExteriorPaint(
  notes?: string | null,
  templateKey?: string | null
): boolean {
  const text = String(notes || '');
  const groundUp =
    String(templateKey || '').toLowerCase() === 'ground_up' ||
    notesDescribeGroundUpHome(text);
  if (!groundUp || notesAskForExteriorPaint(text)) return false;
  return /\bstucco\b|\beifs\b|\bsynthetic\s+stucco\b|\bbrick\b|\bsiding\b/i.test(
    text
  );
}

/** Explicitly excluded electrical service work must not become an HVAC add-on. */
export function notesExcludeElectricalServiceUpgrade(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return (
    /\b(?:no|without|exclude(?:d|s|ing)?|not\s+included|not\s+in\s+scope)\b[^.;\n]{0,70}\belectrical\s+service\s+upgrades?\b/i.test(
      text
    ) ||
    /\belectrical\s+service\s+upgrades?\b[^.;\n]{0,70}\b(?:exclude(?:d|s|ing)?|not\s+included|not\s+in\s+scope)\b/i.test(
      text
    )
  );
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
  electrical_standard_fixture:
    /\b(?:light|lighting)\s+fixtures?\b[^.;\n]{0,40}\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b|\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b[^.;\n]{0,120}\b(?:light|lighting)\s+fixtures?\b/i,
  electrical_recessed_light:
    /\b(?:light|lighting)\s+fixtures?\b[^.;\n]{0,40}\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b|\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b[^.;\n]{0,120}\b(?:light|lighting)\s+fixtures?\b/i,
  electrical_pendant_light:
    /\b(?:light|lighting)\s+fixtures?\b[^.;\n]{0,40}\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b|\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b[^.;\n]{0,120}\b(?:light|lighting)\s+fixtures?\b/i,
  electrical_decorative_light:
    /\b(?:light|lighting)\s+fixtures?\b[^.;\n]{0,40}\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b|\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b[^.;\n]{0,120}\b(?:light|lighting)\s+fixtures?\b/i,
  electrical_exterior_light:
    /\b(?:light|lighting)\s+fixtures?\b[^.;\n]{0,40}\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b|\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b[^.;\n]{0,120}\b(?:light|lighting)\s+fixtures?\b/i,
  electrical_undercabinet_light:
    /\b(?:light|lighting)\s+fixtures?\b[^.;\n]{0,40}\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b|\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b[^.;\n]{0,120}\b(?:light|lighting)\s+fixtures?\b/i,
  electrical_trim:
    /\b(?:final\s+)?(?:electrical\s+)?trim(?:[\s-]?out)?\b[^.;\n]{0,40}\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b|\b(?:exclud(?:e|ed|es|ing)|not\s+included)\b[^.;\n]{0,120}\b(?:final\s+)?(?:electrical\s+)?trim(?:[\s-]?out)?\b/i,
  electrical_service_upgrade:
    /\b(?:no|without|exclude(?:d|s|ing)?|not\s+included|not\s+in\s+scope)\b[^.;\n]{0,70}\belectrical\s+service\s+upgrades?\b|\belectrical\s+service\s+upgrades?\b[^.;\n]{0,70}\b(?:exclude(?:d|es|ing)?|not\s+included|not\s+in\s+scope)\b/i,
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
    new RegExp(`\\b${verbs}\\b[^.;,\\n]{0,30}\\b${floorish}\\b|\\b${floorish}\\b[^.;,\\n]{0,30}\\b${verbs}\\b`).test(n)
  ) {
    return true;
  }
  const bareTileDemo = new RegExp(`\\b${verbs}\\b[^.;,\\n]{0,30}\\btile\\b|\\btile\\b[^.;,\\n]{0,30}\\b${verbs}\\b`);
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

const HVAC_LEFT_ALONE_SUBJECTS: Record<string, string> = {
  heat_pump: 'heat[\\s-]*pumps?',
  furnace: 'furnaces?',
  condenser: 'condensers?|air\\s*condition(?:ers?|ing)?',
  air_handler: 'air\\s*handlers?',
  mini_split: 'mini[\\s-]?splits?',
  ductwork: 'duct(?:work|s|ing)?',
  thermostat: 'thermostats?',
  registers: '(?:supply\\s+)?registers?|diffusers?',
  returns: 'return\\s+grilles?',
  hvac_systems:
    'hvac(?:\\s+systems?)?|heating|cooling|furnaces?|heat[\\s-]*pumps?|air\\s*condition(?:ers?|ing)?',
  hvac_capacity:
    'hvac(?:\\s+systems?)?|heating|cooling|furnaces?|heat[\\s-]*pumps?|air\\s*condition(?:ers?|ing)?',
  equipment_replace:
    'furnaces?|heat[\\s-]*pumps?|\\bac\\b|air\\s*condition(?:ers?|ing)?|hvac\\s+replace(?:ment)?|equipment',
  hvac: 'hvac|furnaces?|air\\s*condition(?:ers?|ing)?|heat[\\s-]*pumps?|duct(?:work)?|mini[\\s-]?splits?',
};

const HVAC_EQUIPMENT_LEFT_ALONE_IDS = new Set([
  'heat_pump',
  'furnace',
  'condenser',
  'air_handler',
  'mini_split',
  'hvac_systems',
  'hvac_capacity',
  'equipment_replace',
  'hvac',
]);

function hvacNoteClauses(notes: string): string[] {
  return notes
    .split(/(?<=[.!?])/)
    .map(clause => clause.trim())
    .filter(Boolean);
}

function hvacClauseMentions(clause: string, subject: string): boolean {
  return new RegExp(subject, 'i').test(clause);
}

function hvacClauseLeavesSubject(clause: string, subject: string): boolean {
  return new RegExp(
    `\\b(?:leave|leaving|keep|keeping)\\b[^.]{0,80}(?:${subject})[^.]{0,40}\\bin\\s+place\\b|\\b(?:${subject})\\b[^.]{0,50}\\b(?:stay|stays|remain|remains)\\b|\\b(?:do\\s+not|don'?t|dont)\\s+(?:replace|install|change)\\b[^.]{0,60}(?:${subject})`,
    'i'
  ).test(clause);
}

function hvacClauseAffirmsSubject(clause: string, subject: string): boolean {
  if (hvacClauseLeavesSubject(clause, subject)) return false;
  return new RegExp(
    `\\b(?:replace|replacing|replacement|install|installing|installation|new|add|adding)\\b[^.]{0,60}(?:${subject})|\\b(?:${subject})\\b[^.]{0,40}\\b(?:replacement|install(?:ation)?)\\b`,
    'i'
  ).test(clause);
}

/** A complete system or a stated tonnage. A furnace or heat pump by itself is equipment. */
export function hvacNotesNameInstalledSystem(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  return (
    /\b(?:hvac|heating|cooling|heat[\s-]*pump|furnace|condenser|air\s*handler|mini[\s-]?split)\s+systems?\b/i.test(
      text
    ) || /\b\d[\d,]*(?:\.\d+)?\s*(?:-\s*)?tons?\b/i.test(text)
  );
}

/**
 * Named equipment is the price, and something else stays. The system package
 * and its tonnage chip stay off. A stated system or tonnage still opens them.
 */
export function hvacNotesDropSystemPackage(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (!text.trim() || hvacNotesNameInstalledSystem(text)) return false;
  const leavesEquipment = (
    ['furnace', 'condenser', 'heat_pump', 'mini_split', 'air_handler', 'ductwork'] as const
  ).some(id => hvacNotesLeaveOptionAlone(text, id));
  if (!leavesEquipment) return false;
  return /\b(?:furnaces?|condensers?|heat[\s-]*pumps?|mini[\s-]?splits?|air\s*handlers?|thermostats?)\b/i.test(
    text
  );
}

/**
 * A leave-in-place or do-not-replace clause names the equipment so it stays
 * off the bid. An install or replace clause for the same item still counts.
 */
export function hvacNotesLeaveOptionAlone(
  notes: string | null | undefined,
  optionId: string
): boolean {
  const subject = HVAC_LEFT_ALONE_SUBJECTS[optionId];
  const text = String(notes || '');
  if (!subject || !text.trim()) return false;
  const clauses = hvacNoteClauses(text);
  const affirmed = clauses.some(clause =>
    hvacClauseAffirmsSubject(clause, subject)
  );
  if (affirmed) return false;
  if (
    HVAC_EQUIPMENT_LEFT_ALONE_IDS.has(optionId) &&
    /\b(?:do\s+not|don'?t|dont)\s+replace\b[^.]{0,48}\b(?:the\s+)?equipment\b|\bleave\b[^.]{0,48}\b(?:the\s+)?equipment\b[^.]{0,24}\bin\s+place\b/i.test(
      text
    )
  ) {
    return true;
  }
  const leftAlone = clauses.some(
    clause =>
      hvacClauseMentions(clause, subject) &&
      hvacClauseLeavesSubject(clause, subject)
  );
  if (!leftAlone) return false;
  const namedAsWork = clauses.some(
    clause =>
      hvacClauseMentions(clause, subject) &&
      !hvacClauseLeavesSubject(clause, subject)
  );
  return !namedAsWork;
}

/**
 * The paint verb applies to the doors.
 * "Paint the ceilings and the doors" does. "Replace 3 interior doors and paint the ceilings" does not.
 */
export function notesNameDoorPaintSurface(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (
    /\b(?:paint|repaint|painting|coat|prime)(?:ed|ing)?\s+(?:the\s+|\d[\d,]*\s+)?(?:interior\s+)?doors?\b/i.test(
      text
    )
  ) {
    return true;
  }
  if (
    /\b(?:interior\s+)?doors?\s+(?:to\s+be\s+)?(?:painted|repainted|coated|primed)\b/i.test(
      text
    )
  ) {
    return true;
  }
  const listed = text.match(
    /\b(?:paint|repaint|painting)\b([^.;\n]{0,60}?)\b(?:interior\s+)?doors?\b/i
  );
  if (!listed) return false;
  const gap = listed[1] || '';
  if (
    /\b(?:replace|replacing|install|hang|swap|demo|demolition|drywall|flooring|windows?|insulation|sqft|square)\b/i.test(
      gap
    )
  ) {
    return false;
  }
  const leftover = gap.replace(
    /\b(?:walls?|ceilings?|trim|baseboards?|cabinets?|interior|the|and|plus|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|\d[\d,]*)\b|[, ]+/gi,
    ''
  );
  return leftover.length === 0;
}

/** New or replaced interior doors on a paint job get painted too. */
export function notesReplaceInteriorDoorsBesidePaint(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (notesDoorMentionIsPaintOrKeepOnly(text)) return false;
  const replacesDoors =
    /\b(?:install|replace|replacing|hang|swap|new)\b[^.;\n]{0,40}\b(?:interior\s+)?doors?\b/i.test(
      text
    ) || /\b\d[\d,]*\s+interior\s+doors?\b/i.test(text);
  if (!replacesDoors) return false;
  return /\b(?:paint|repaint|painting|coat|prime)(?:ed|ing)?\b[^.;\n]{0,40}\b(?:walls?|ceilings?|interior|inside)\b|\b(?:walls?|ceilings?)\b[^.;\n]{0,40}\b(?:paint|repaint|painting|coated|primed)\b/i.test(
    text
  );
}

/** "Paint the doors" and "keep the doors" are not a door install. */
export function notesDoorMentionIsPaintOrKeepOnly(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  if (!/\bdoors?\b/i.test(text)) return false;
  const doorSentences = text
    .split(/[.\n;]+/)
    .map(sentence => sentence.trim())
    .filter(sentence => /\bdoors?\b/i.test(sentence));
  if (!doorSentences.length) return false;
  return doorSentences.every(sentence => {
    const paintOrKeepOnDoors =
      /\b(?:keep|keeping|leaving|leave|exclude|excluding|paint|painting|repaint|prime|prep)\b(?:\s+\w+){0,5}\s+doors?\b/i.test(
        sentence
      );
    const installOnDoors =
      /\b(?:install|replace|replacing|hang|swap)\b(?:\s+\w+){0,5}\s+(?:interior\s+)?doors?\b/i.test(
        sentence
      ) || /\b\d+\s+interior\s+doors?\b/i.test(sentence);
    return paintOrKeepOnDoors && !installOnDoors;
  });
}

const LEADING_EXCLUSION_NOTICES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bgutters?\b/i, label: 'Gutters are not in this bid' },
  { pattern: /\bdownspouts?\b/i, label: 'Downspouts are not in this bid' },
  { pattern: /\bsiding\b/i, label: 'Siding is not in this bid' },
  { pattern: /\binterior(?:\s+work)?\b/i, label: 'Interior work is not in this bid' },
  { pattern: /\bpaint(?:ing)?\b/i, label: 'Paint is not in this bid' },
  { pattern: /\btrim\s+replacement\b/i, label: 'Trim replacement is not in this bid' },
  {
    pattern: /\b(?:subfloor|floor)\s+(?:repair|prep)\b/i,
    label: 'Subfloor repair is not in this bid',
  },
  { pattern: /\bpermits?\b/i, label: 'Permits are not in this bid' },
  { pattern: /\bhvac\b/i, label: 'HVAC is not in this bid' },
  { pattern: /\bwindows?\b/i, label: 'Windows are not in this bid' },
  { pattern: /\bdoors?\b/i, label: 'Doors are not in this bid' },
  { pattern: /\belectrical\b/i, label: 'Electrical is not in this bid' },
  { pattern: /\bplumbing\b/i, label: 'Plumbing is not in this bid' },
  { pattern: /\bfixtures?\b/i, label: 'Fixtures are not in this bid' },
];

const NON_SCOPE_EXCLUSION =
  /^(?:pricing|prices?|rates?|costs?|numbers?|totals?|bid\s+totals?|material(?:s)?(?:\s+(?:or|and)\s+labor)?|labor|measurements?|dimensions?|sizes?|quantit(?:y|ies)|info(?:rmation)?|idea|clue|yet)\b/i;

function clauseStartsNegated(clause: string): boolean {
  return /^(?:(?:and|but|also)\s+)?(?:no|not|without|do not|don't|does not|doesn't|excludes?|excluded|not\s+included|not\s+to\s+include)\b/i.test(
    clause.trim()
  );
}

/** Text with "No …" and "Excludes …" clauses removed, so a denied trade is not read as included work. */
export function affirmativeNoteText(notes: string | null | undefined): string {
  const kept: string[] = [];
  for (const sentence of String(notes || '').split(/[.\n;]+/)) {
    let carrying = false;
    const parts: string[] = [];
    for (const raw of sentence.split(',')) {
      const clause = raw.trim();
      if (!clause) continue;
      if (clauseStartsNegated(clause)) {
        carrying = true;
        continue;
      }
      if (carrying) {
        if (
          /^(?:include|including|install|add|replace|remove|with|plus)\b/i.test(
            clause
          )
        ) {
          carrying = false;
        }
        continue;
      }
      parts.push(clause);
    }
    if (parts.length) kept.push(parts.join(', '));
  }
  return kept.join('. ');
}

/** "No gutters, siding, or interior" keeps the "no" across the comma list. */
function expandedNegatedClauses(notes: string | null | undefined): string[] {
  const clauses: string[] = [];
  for (const sentence of String(notes || '').split(/[.\n;]+/)) {
    let carrying = false;
    for (const raw of sentence.split(',')) {
      const clause = raw.trim();
      if (!clause) continue;
      if (clauseStartsNegated(clause)) {
        carrying = true;
        clauses.push(clause);
        continue;
      }
      if (!carrying) continue;
      if (
        /^(?:include|including|install|add|replace|remove|with|plus)\b/i.test(
          clause
        )
      ) {
        carrying = false;
        continue;
      }
      const rest = clause.replace(/^(?:and|or|also)\s+/i, '').trim();
      if (rest) clauses.push(`No ${rest}`);
    }
  }
  return clauses;
}

function genericExclusionLabels(clause: string): string[] {
  const subject = clause
    .replace(
      /^(?:(?:and|but|also)\s+)?(?:no|not|without|do not|don't|does not|doesn't|excludes?|excluded|not\s+included|not\s+to\s+include)\s+/i,
      ''
    )
    .replace(/^(?:include|including)\s+/i, '')
    .replace(/\s+(?:is|are)\s+not\s+included$/i, '')
    .replace(/\s+not\s+included$/i, '')
    .replace(/\s+excluded$/i, '')
    .replace(/^(?:the|a|an|any|new)\s+/i, '')
    .replace(/[.\s]+$/g, '')
    .trim();
  if (!subject || subject.length > 48 || NON_SCOPE_EXCLUSION.test(subject)) {
    return [];
  }
  return subject
    .split(/\s+(?:or|and)\s+/i)
    .map(part => part.trim())
    .filter(part => part && !NON_SCOPE_EXCLUSION.test(part))
    .map(part => {
      const label = part.charAt(0).toUpperCase() + part.slice(1);
      const last = label.split(/\s+/).pop() || label;
      const plural = /s$/i.test(last) && !/(?:ss|glass|work)$/i.test(last);
      return `${label} ${plural ? 'are' : 'is'} not in this bid`;
    });
}

/** Kitchen hookups. Whole-house "plumbing" on a new house is not this card. */
export function notesAskForPlumbingConnections(
  notes: string | null | undefined
): boolean {
  return /\bplumbing\s+connections?\b|\bdishwashers?\b|\bgas\s+shut-?off\b|\bsink\s+hook-?ups?\b/i.test(
    String(notes || '')
  );
}

/**
 * A deck, patio, or porch the note actually includes. "No deck" and a
 * concrete patio (flatwork) do not count.
 */
export function notesNameAffirmativeDeckOrPatio(
  notes: string | null | undefined
): boolean {
  const text = String(notes || '');
  const deck =
    /\bdecks?\b/i.test(text) && !noteMentionIsOnlyNegated(text, /\bdecks?\b/i);
  const coveredPatio = /\bcovered\s+patio\b/i.test(text);
  const patio =
    /\bpatios?\b/i.test(text) &&
    !noteMentionIsOnlyNegated(text, /\bpatios?\b/i) &&
    (coveredPatio || !/\bconcrete\s+patio\b/i.test(text));
  const porch =
    /\bporches?\b/i.test(text) &&
    !noteMentionIsOnlyNegated(text, /\bporches?\b/i);
  return deck || patio || porch;
}

/** A leading "no / not / without" clause is the only mention of this term. */
export function noteMentionIsOnlyNegated(
  notes: string | null | undefined,
  pattern: RegExp
): boolean {
  let positive = false;
  let negated = false;
  for (const raw of String(notes || '').split(/[.;,\n]+/)) {
    const clause = raw.trim();
    if (!clause || !pattern.test(clause)) continue;
    if (
      /^(?:no|not|without|do not|don't|does not|doesn't|excludes?|excluded|not\s+included|not\s+to\s+include)\b/i.test(
        clause
      )
    ) {
      negated = true;
    }
    else positive = true;
  }
  return negated && !positive;
}

function pushExclusionNotice(
  notices: string[],
  seen: Set<string>,
  label: string
) {
  if (!label || seen.has(label)) return;
  seen.add(label);
  notices.push(label);
}

/** Yellow Scope found notices for work the note explicitly left out. */
export function noteExclusionNotices(
  notes: string | null | undefined
): string[] {
  const notices: string[] = [];
  const seen = new Set<string>();
  for (const clause of expandedNegatedClauses(notes)) {
    let matched = false;
    for (const entry of LEADING_EXCLUSION_NOTICES) {
      if (!entry.pattern.test(clause)) continue;
      matched = true;
      pushExclusionNotice(notices, seen, entry.label);
    }
    if (matched) continue;
    for (const label of genericExclusionLabels(clause)) {
      pushExclusionNotice(notices, seen, label);
    }
  }
  const ownerLabels: Array<[OwnerHandledScopeCategory, string]> = [
    ['sitework', 'Sitework is not in this bid'],
    ['utilities', 'Utilities are not in this bid'],
    ['landscaping', 'Landscaping is not in this bid'],
  ];
  for (const [category, label] of ownerLabels) {
    if (notesOwnerHandlesScopeCategory(notes, category)) {
      pushExclusionNotice(notices, seen, label);
    }
  }
  if (
    /\bappliances?\b[^.;\n]{0,48}\b(?:owner|customer)[-\s]?(?:suppl(?:y|ies|ied)|provided|provides|providing)\b|\b(?:owner|customer)[-\s]?(?:suppl(?:y|ies|ied)|provided|provides|providing)\b[^.;\n]{0,48}\bappliances?\b/i.test(
      String(notes || '')
    )
  ) {
    pushExclusionNotice(notices, seen, 'Appliances are not in this bid');
  }
  return notices;
}

export function inferItemStateFromNotes(
  itemId: string,
  notes: string | null | undefined
): 'included' | 'excluded' | 'unsure' {
  if (hvacNotesLeaveOptionAlone(notes, itemId)) return 'excluded';
  const n = String(notes || '').toLowerCase();
  const ownerCategory = OWNER_HANDLED_SCOPE_ITEM_CATEGORIES[itemId];
  if (
    ownerCategory &&
    notesOwnerHandlesScopeCategory(notes, ownerCategory)
  ) {
    return 'excluded';
  }
  if (CHECKLIST_NO_HINTS[itemId]?.test(n)) return 'excluded';
  if (itemId === 'vanity_demo' || itemId === 'countertop_demo') {
    const hint = CHECKLIST_YES_HINTS[itemId];
    return hint && bathroomNoteClauseHas(n, hint) ? 'included' : 'unsure';
  }
  if (
    itemId === 'cabinet_demo' ||
    itemId === 'backsplash_demo' ||
    itemId === 'island_demo'
  ) {
    const surface =
      itemId === 'cabinet_demo'
        ? 'cabinet'
        : itemId === 'backsplash_demo'
          ? 'backsplash'
          : 'island';
    return kitchenNoteNamesSurfaceDemo(notes, surface) ? 'included' : 'unsure';
  }
  if (
    (itemId === 'gutters' || itemId === 'downspouts') &&
    noteMentionIsOnlyNegated(
      notes,
      itemId === 'gutters' ? /\bgutters?\b/i : /\bdownspouts?\b/i
    )
  ) {
    return 'excluded';
  }
  if (itemId === 'floor_demo') return floorDemoNotesHint(n) ? 'included' : 'unsure';
  if (itemId === 'trim') return inferTrimStateFromNotes(n);
  if (itemId === 'interior_door_install') {
    if (notesDoorMentionIsPaintOrKeepOnly(notes)) return 'unsure';
    const hasInteriorDoorMention = /\binterior\s+doors?\b/.test(n);
    const hasGenericDoorMention =
      /\bdoors?\b/.test(n) &&
      !/\b(?:exterior|sliding|patio|garage|shower)\s+doors?\b/.test(n);
    return hasInteriorDoorMention || hasGenericDoorMention
      ? 'included'
      : 'unsure';
  }
  if (itemId === 'door_paint') {
    return notesNameDoorPaintSurface(notes) ||
      notesReplaceInteriorDoorsBesidePaint(notes)
      ? 'included'
      : 'unsure';
  }
  if (itemId === 'doors') {
    const hasDoorMention = /\bdoors?\b/.test(n);
    const hasTypedDoorMention =
      /\b(?:interior|exterior|sliding|patio|garage|shower)\s+doors?\b/.test(n);
    return hasDoorMention && !hasTypedDoorMention ? 'included' : 'unsure';
  }
  if (CHECKLIST_YES_HINTS[itemId]?.test(n)) return 'included';
  if (
    itemId === 'exterior_paint' &&
    namedFinishReplacesExteriorPaint(notes)
  ) {
    return 'excluded';
  }
  if (concreteCatalogItemLeftUnnamed(itemId, notes)) return 'excluded';
  return 'unsure';
}

const CONCRETE_CATALOG_ITEM_IDS = new Set([
  'demo_removal',
  'site_prep',
  'gravel_base',
  'excavation',
  'reinforcement',
  'pour_flatwork',
  'pour_foundation',
  'complex_forming',
  'concrete_sealer',
  'decorative_finish',
  'additional_haul_off',
  'concrete_pumping',
  'retaining_wall',
  'pavers',
  'landscaping',
  'exterior_doors',
  'siding_repairs',
  'exterior_trim_paint',
]);

/** A driveway/flatwork note leaves unnamed concrete catalog rows out of the bid. */
function concreteCatalogItemLeftUnnamed(
  itemId: string,
  notes: string | null | undefined
): boolean {
  if (!CONCRETE_CATALOG_ITEM_IDS.has(itemId)) return false;
  const text = String(notes || '');
  if (!text.trim()) return false;
  if (!notesImplyExteriorFlatwork(text) || notesImplyStructuralFoundation(text)) {
    return false;
  }
  return true;
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
  if (
    /\bremove\s+and\s+replace\b/.test(n) &&
    /\b(?:shingles?|roof(?:ing)?)\b/.test(n)
  ) {
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

/**
 * Contractor note only. A generated description can add drip edge, ridge cap,
 * or cleanup the sentence never named, and those were becoming pricing cards.
 */
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
  for (const raw of [notesFallback, draft?.originalNotes]) {
    const text = String(raw || '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    parts.push(text);
  }
  if (parts.length) return parts.join('\n\n');
  return String(
    draft?.projectDescription || draft?.contractScope || ''
  ).trim();
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
  // A replacement quantity does not, by itself, authorize a tear-off card.
  // Keep tear-off note-backed only when removal is explicit; otherwise the
  // existing-roof card is an empty default in mixed-scope jobs.
  const explicitTearOff =
    /\b(?:tear[\s-]?off|remove|removal|roof\s+demo|strip\s+roof)\b[^.;\n]{0,60}\b(?:existing\s+)?(?:roof|shingles?|tile|metal|membrane)?\b/.test(
      n
    ) ||
    /\b(?:existing\s+)?(?:roof|shingles?|tile|metal|membrane)\b[^.;\n]{0,60}\b(?:tear[\s-]?off|remove|removal|roof\s+demo|strip\s+roof)\b/.test(
      n
    );
  if (tearOff && tearOff !== 'new_construction' && explicitTearOff) {
    ids.add('tear_off');
  }

  const system = inferRoofingSystemFromNotes(notes);
  if (
    system === 'architectural_shingles' ||
    system === 'three_tab_shingles' ||
    /\b\d[\d,]*(?:\.\d+)?\s+(?:roofing\s+)?squares?\b/.test(n)
  ) {
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
  if (/\bridge\s+cap\b/.test(n)) ids.add('ridge_cap');
  if (/\bvalley\s+flashing\b/.test(n)) ids.add('valley_flashing');
  if (/\b(drip\s+edge)\b/.test(n)) ids.add('drip_edge');
  if (/\b(pipe\s+boots?)\b/.test(n)) ids.add('pipe_boots');
  if (/\bgutters?\b/.test(n) && !noteMentionIsOnlyNegated(notes, /\bgutters?\b/i)) {
    ids.add('gutters');
  }
  if (
    /\bdownspouts?\b/.test(n) &&
    !noteMentionIsOnlyNegated(notes, /\bdownspouts?\b/i)
  ) {
    ids.add('downspouts');
  }
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

const ROOFING_CHECKLIST_ID_FOR_SELECTION: Record<string, string> = {
  shingles: 'shingles_roofing',
};

/** Dedicated re-roof notes that name the install and at least one accessory. */
export function shouldLimitRoofingChecklistToNotes(params: {
  notes?: string | null;
  templateKey?: string | null;
  projectType?: string | null;
  scopeMode?: string | null;
  planBacked?: boolean;
  wholeHome?: boolean;
}): boolean {
  if (params.planBacked || params.wholeHome) return false;
  const template = String(params.templateKey || params.projectType || '')
    .toLowerCase();
  if (template !== 'roofing') return false;
  const notes = String(params.notes || '').trim();
  if (!notes) return false;
  const ids = inferRoofingTradeScopeSelectionsFromNotes(notes);
  const hasInstall = ids.includes('tear_off') || ids.includes('shingles');
  const namedAccessories = ids.filter(
    id => id !== 'tear_off' && id !== 'shingles' && id !== 'cleanup'
  );
  return hasInstall && namedAccessories.length > 0;
}

/** Hide roofing template rows the note never names. */
export function filterDedicatedRoofingConfirmItems<
  T extends { id?: string | null; choiceId?: string | null },
>(
  items: T[],
  params: {
    notes?: string | null;
    templateKey?: string | null;
    projectType?: string | null;
    scopeMode?: string | null;
    planBacked?: boolean;
    wholeHome?: boolean;
    selectedIds?: readonly string[] | null;
  }
): T[] {
  if (!shouldLimitRoofingChecklistToNotes(params)) return items;
  const selected = new Set(
    inferRoofingTradeScopeSelectionsFromNotes(params.notes)
  );
  const keep = new Set<string>();
  for (const id of selected) {
    if (id === 'shingles') {
      keep.add('roofing_system');
      continue;
    }
    keep.add(id);
    const checklistId = ROOFING_CHECKLIST_ID_FOR_SELECTION[id];
    if (checklistId && checklistId !== 'shingles_roofing') keep.add(checklistId);
  }
  return items.filter(item => {
    const id = String(item.id || '');
    if (id.startsWith('custom_')) return true;
    if (id === 'shingles_roofing' && keep.has('roofing_system')) return false;
    return keep.has(id);
  });
}

const ROOFING_CONFIRM_CARD_LABELS: Record<string, string> = {
  roofing_system: 'Roofing system',
  tear_off: 'Existing roof / tear-off',
  shingles_roofing: 'Shingles / roofing install',
  underlayment: 'Premium / synthetic underlayment upgrade',
  ice_water_shield: 'Ice & water shield',
  drip_edge: 'Drip edge',
  ridge_cap: 'Ridge cap',
  valley_flashing: 'Valley flashing',
  pipe_boots: 'Pipe boots',
  gutters: 'Gutters',
  downspouts: 'Downspouts',
};

/**
 * Selected roofing chips still need a checklist row to become a pricing card.
 * A short draft can leave only gutters on the list while the other chips are on.
 */
export function ensureNamedRoofingConfirmItems<
  T extends {
    id?: string | null;
    label?: string | null;
    choiceId?: string | null;
    state?: string | null;
    inputType?: string | null;
    noteBacked?: boolean | null;
  },
>(
  items: T[],
  params: {
    notes?: string | null;
    templateKey?: string | null;
    projectType?: string | null;
    scopeMode?: string | null;
    planBacked?: boolean;
    wholeHome?: boolean;
    selectedIds?: readonly string[] | null;
  }
): T[] {
  if (params.planBacked || params.wholeHome) return items;
  const template = String(params.templateKey || params.projectType || '')
    .toLowerCase();
  if (template !== 'roofing') return items;
  const selected = new Set(
    inferRoofingTradeScopeSelectionsFromNotes(params.notes)
  );
  const hasInstall =
    selected.has('tear_off') ||
    selected.has('shingles') ||
    selected.has('shingles_roofing');
  if (!hasInstall) return items;
  const wanted = new Set<string>();
  for (const id of selected) {
    if (id === 'shingles') wanted.add('roofing_system');
    else if (id === 'cleanup') continue;
    else wanted.add(ROOFING_CHECKLIST_ID_FOR_SELECTION[id] || id);
  }
  const choiceFor = (id: string): string | null => {
    if (id === 'roofing_system') {
      return inferRoofingSystemFromNotes(params.notes);
    }
    if (id === 'tear_off') {
      const tearOff = inferRoofingTearOffFromNotes(params.notes);
      return tearOff && tearOff !== 'new_construction' ? tearOff : null;
    }
    return null;
  };
  let next = items.map(item => {
    const id = String(item.id || '');
    if (!wanted.has(id)) return item;
    const choice = choiceFor(id);
    if (choice) {
      const staleChoice =
        !item.choiceId ||
        item.choiceId === 'unsure' ||
        item.choiceId === 'not_in_scope' ||
        (id === 'tear_off' &&
          choice === 'two_layers' &&
          item.choiceId === 'one_layer');
      if (staleChoice) {
        return {
          ...item,
          inputType: item.inputType || 'choice',
          choiceId: choice,
          state: 'included',
          noteBacked: true,
        };
      }
      return item;
    }
    if (item.state !== 'included') {
      return {
        ...item,
        inputType: item.inputType || 'yes_no',
        state: 'included',
        noteBacked: true,
      };
    }
    return item;
  });
  for (const id of wanted) {
    if (id === 'shingles_roofing' && wanted.has('roofing_system')) continue;
    if (next.some(item => item.id === id)) continue;
    const choice = choiceFor(id);
    next = [
      ...next,
      {
        id,
        label: ROOFING_CONFIRM_CARD_LABELS[id] || id,
        inputType: choice ? 'choice' : 'yes_no',
        state: 'included',
        noteBacked: true,
        ...(choice ? { choiceId: choice } : {}),
      } as T,
    ];
  }
  return next;
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
    if (notesKeepExistingWetArea(notes)) return 'staying';
    if (/\b(prefab\s+shower\s+enclosure|prefab\s+enclosure|one[\s-]?piece\s+enclosure)\b/.test(n)) {
      return 'prefab_enclosure';
    }
    if (/\b(prefab|pre[\s-]?fab|acrylic|fiberglass|plastic\s+pan|pan\s+insert)\b/.test(n)) return 'prefab';
    if (/\b(tile\s+pan|mud\s+pan|mortar\s+bed|hot\s+mop|custom\s+pan)\b/.test(n)) return 'tile_pan';
    if (/\b(tub\s+install|new\s+tub|bathtub|alcove\s+tub|freestanding\s+tub)\b/.test(n)) return 'tub';
    if (/\b(tub[\s-]to[\s-]shower|new\s+shower|walk[\s-]?in\s+shower)\b/.test(n)) return 'prefab';
  }

  if (itemId === 'vanity') {
    const vanityText = n
      .replace(/[^.]*\ball\s+stay\b[^.]*/g, ' ')
      .replace(/\bvanity\s+(?:lights?|lighting)\b/g, ' ');
    if (
      /\b(remove\s+and\s+replace|replace|new)\b.*\bvanity\b|\bvanity\b.*\b(replace|new)\b/.test(
        vanityText
      )
    ) {
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
