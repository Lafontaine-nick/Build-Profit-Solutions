/**
 * Global trade/category pricing matrix.
 * Every suggested price resolves a rule — no project-type bypass.
 */

const { inferTradeCategory } = require('./scopeClassification');
const { getPricingRange, normalizeUnit } = require('./pricingRangeCatalog');

const VALID_SOURCE_TYPES = {
  saved: ['saved_pricing', 'saved_template', 'company_default', 'user_provided'],
  vendor: ['supplier_pricing'],
  national: ['national_trade_average', 'construction_cost_database', 'regional_labor_benchmark'],
  ai: ['ai_rough_estimate_fallback', 'ai_rough_estimate'],
  all: [
    'saved_pricing',
    'saved_template',
    'company_default',
    'user_provided',
    'supplier_pricing',
    'national_trade_average',
    'construction_cost_database',
    'regional_labor_benchmark',
    'ai_rough_estimate_fallback',
    'ai_rough_estimate',
  ],
};

function scopeBlob(scopeItem) {
  return `${scopeItem.scopeName || ''} ${scopeItem.scope || ''}`.toLowerCase();
}

function bandFromRange(range) {
  const mat = range?.material;
  const lab = range?.labor;
  const low = (mat?.low ?? 0) + (lab?.low ?? 0);
  const typical = (mat?.typical ?? 0) + (lab?.typical ?? 0);
  const high = (mat?.high ?? 0) + (lab?.high ?? 0);
  const extreme = (mat?.extremeWarning ?? 0) + (lab?.extremeWarning ?? 0);
  return { low, typical, high, extremeWarning: extreme || range?.maxReasonablePerUnit || high * 2 };
}

/**
 * @typedef {object} ScopePricingRule
 * @property {string} itemType
 * @property {string} tradeCategory
 * @property {string} scopeCategory
 * @property {string[]} allowedUnits
 * @property {string} pricingMethod
 * @property {string[]} validSourceTypes
 * @property {number} lowRange
 * @property {number} typicalRange
 * @property {number} highRange
 * @property {number} extremeWarningRange
 * @property {boolean} autoSelectAllowed
 * @property {boolean} needsApproval
 * @property {boolean} manualPricingFallback
 * @property {string|null} userWarningText
 */

/** Ordered — first match wins (most specific first). */
const SCOPE_ITEM_RULES = [
  // Manual-pricing-only (no reliable automated source)
  {
    itemType: 'plumbing_trim',
    test: (b) => /\bplumb.*\btrim|\bplumbing\s+trim|\bfinal\s+plumb/.test(b),
    tradeCategory: 'plumbing',
    scopeCategory: 'plumbing_trim',
    allowedUnits: ['each', 'lump_sum', 'allowance'],
    pricingMethod: 'fixture_count',
    validSourceTypes: VALID_SOURCE_TYPES.saved,
    manualPricingFallback: true,
    userWarningText: 'Plumbing trim depends on fixture count and trim scope — use saved pricing or enter manually.',
  },
  {
    itemType: 'electrical_trim',
    test: (b) => /\belectrical\s+trim|\bdevices.*\bplates|\bdevice\s+trim/.test(b),
    tradeCategory: 'electrical',
    scopeCategory: 'electrical_trim',
    allowedUnits: ['each', 'lump_sum', 'allowance'],
    pricingMethod: 'device_count',
    validSourceTypes: VALID_SOURCE_TYPES.saved,
    manualPricingFallback: true,
    userWarningText: 'Electrical trim depends on device count — use saved pricing or enter manually.',
  },
  {
    itemType: 'cleanup_disposal',
    test: (b) => /\bcleanup|\bdisposal|\bhaul[\s-]?off|\bdumpster|\bfinal\s+clean/.test(b),
    tradeCategory: 'cleanup',
    scopeCategory: 'cleanup',
    allowedUnits: ['lump_sum', 'allowance'],
    pricingMethod: 'lump_sum',
    validSourceTypes: VALID_SOURCE_TYPES.saved,
    manualPricingFallback: true,
    userWarningText: 'Cleanup and haul-off depend on load size — use lump sum or saved pricing.',
  },
  {
    itemType: 'permits',
    test: (b) => /\bpermits?\b|\binspection\s+fees?/.test(b),
    tradeCategory: 'permits',
    scopeCategory: 'permits',
    allowedUnits: ['lump_sum', 'allowance'],
    pricingMethod: 'lump_sum',
    validSourceTypes: VALID_SOURCE_TYPES.saved,
    manualPricingFallback: true,
    userWarningText: 'Permit fees vary by jurisdiction — enter manually or use saved allowance.',
  },
  {
    itemType: 'mirror_accessories',
    test: (b) => /\bmirror|\bbath\s+accessories|\btowel\s+bar/.test(b),
    tradeCategory: 'bathroom_fixture',
    scopeCategory: 'mirror_accessories',
    allowedUnits: ['each', 'lump_sum', 'allowance'],
    pricingMethod: 'each',
    validSourceTypes: [...VALID_SOURCE_TYPES.saved, ...VALID_SOURCE_TYPES.national],
    manualPricingFallback: true,
    userWarningText: 'Mirror and accessory install depends on item count and type — price manually or use saved rates.',
  },
  {
    itemType: 'floor_prep_unknown',
    test: (b) =>
      /\bfloor\s+prep|\bsubfloor|\bunderlayment/.test(b) &&
      !/\b(minor|patch|self[\s-]?level|cement\s+board|repair|underlayment\s+only)\b/.test(b),
    tradeCategory: 'flooring',
    scopeCategory: 'floor_prep',
    allowedUnits: ['sqft', 'lump_sum', 'each'],
    pricingMethod: 'unit_rate',
    validSourceTypes: VALID_SOURCE_TYPES.saved,
    manualPricingFallback: true,
    userWarningText: 'Floor prep type is unclear — specify prep type (minor, underlayment, self-level, repair) or price manually.',
  },
  {
    itemType: 'drywall_repair_unknown',
    test: (b) => /\bdrywall\b.*\b(repair|patch)|\bpatch.*\bdrywall|\btexture\s+match/.test(b),
    tradeCategory: 'drywall',
    scopeCategory: 'drywall_repair',
    allowedUnits: ['sqft', 'each', 'lump_sum'],
    pricingMethod: 'unit_rate',
    validSourceTypes: VALID_SOURCE_TYPES.saved,
    manualPricingFallback: true,
    userWarningText: 'Drywall repair complexity is unknown — enter patch count, sqft, or lump sum manually.',
  },
  {
    itemType: 'excavation_unknown',
    test: (b) =>
      /\bexcavat|\btrench|\bgrading\b|\bsite\s+work/.test(b) &&
      !/\b(lf|linear|sqft|cy|cubic|yard)\b/.test(b),
    tradeCategory: 'excavation',
    scopeCategory: 'excavation',
    allowedUnits: ['lump_sum', 'hour', 'sqft', 'lf'],
    pricingMethod: 'lump_sum',
    validSourceTypes: VALID_SOURCE_TYPES.saved,
    manualPricingFallback: true,
    userWarningText: 'Excavation depends on depth, soil, haul-off, and access — price manually or use saved bid.',
  },
  {
    itemType: 'structural_framing',
    test: (b) =>
      /\b(load[\s-]?bearing|structural|engineered|beam|header|post)\b/.test(b) &&
      /\b(fram|structural)\b/.test(b),
    tradeCategory: 'framing',
    scopeCategory: 'structural_framing',
    allowedUnits: ['lump_sum', 'sqft', 'lf'],
    pricingMethod: 'lump_sum',
    validSourceTypes: VALID_SOURCE_TYPES.saved,
    manualPricingFallback: true,
    userWarningText: 'Structural framing requires engineering and scope confirmation — use manual or saved pricing.',
  },
  {
    itemType: 'panel_upgrade',
    test: (b) => /\bpanel\s+upgrade|\bservice\s+upgrade|\b200\s*amp|\b400\s*amp/.test(b),
    tradeCategory: 'electrical',
    scopeCategory: 'panel_upgrade',
    allowedUnits: ['lump_sum', 'allowance'],
    pricingMethod: 'lump_sum',
    validSourceTypes: VALID_SOURCE_TYPES.saved,
    manualPricingFallback: true,
    userWarningText: 'Panel upgrades require scope and permit review — enter lump sum or saved pricing.',
  },
  {
    itemType: 'plumbing_rough_unknown',
    test: (b) =>
      /^plumbing\s*\(/.test(b) ||
      (/\bplumb/.test(b) && /\brough[\s-]?in|\brelocat|\bdrain\s+work/.test(b)),
    tradeCategory: 'plumbing',
    scopeCategory: 'plumbing_rough',
    allowedUnits: ['each', 'lump_sum', 'allowance', 'lf'],
    pricingMethod: 'allowance',
    validSourceTypes: VALID_SOURCE_TYPES.saved,
    manualPricingFallback: true,
    userWarningText: 'Plumbing rough-in and relocation depend on fixture moves — use saved pricing or manual allowance.',
  },

  // Needs approval — valid planning price, scope-dependent
  {
    itemType: 'vanity_install',
    test: (b) => /\bvanity\b/.test(b) && /\binstall/.test(b),
    tradeCategory: 'bathroom_fixture',
    scopeCategory: 'vanity',
    allowedUnits: ['each', 'lump_sum', 'allowance'],
    pricingMethod: 'each',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText:
      'Confirm whether this includes vanity cabinet, countertop, sink, faucet, install, and plumbing hookup.',
  },
  {
    itemType: 'toilet_install',
    test: (b) => /\btoilet\b/.test(b) && /\binstall/.test(b),
    tradeCategory: 'bathroom_fixture',
    scopeCategory: 'toilet',
    allowedUnits: ['each', 'lump_sum'],
    pricingMethod: 'each',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText:
      'Confirm whether this includes toilet material, standard set, supply line, wax ring, and disposal. Rough-in or relocation should be separate.',
  },
  {
    itemType: 'shower_pan',
    test: (b) => /\bmud\s+pan|\btile\s+shower\s+pan|\bshower\s+pan\b/.test(b) && !/\bdemo/.test(b),
    tradeCategory: 'bathroom_fixture',
    scopeCategory: 'shower_pan',
    allowedUnits: ['sqft', 'lump_sum'],
    pricingMethod: 'unit_rate',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText:
      'Confirm whether this includes mud pan build, liner, drain, waterproofing, and tile-ready prep.',
  },
  {
    itemType: 'shower_niche',
    test: (b) => /\bshower\s+niche|\bniche\b/.test(b) && !/kitchen|counter/.test(b),
    tradeCategory: 'bathroom_fixture',
    scopeCategory: 'shower_niche',
    allowedUnits: ['each', 'lump_sum'],
    pricingMethod: 'each',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText: 'Confirm whether this is prefab niche install or custom framed/tiled niche.',
  },
  {
    itemType: 'shower_bench',
    test: (b) => /\bshower\s+bench\b/.test(b),
    tradeCategory: 'bathroom_fixture',
    scopeCategory: 'shower_bench',
    allowedUnits: ['each', 'lf', 'lump_sum'],
    pricingMethod: 'each',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText: 'Confirm whether this is curb only, bench only, or both.',
  },
  {
    itemType: 'glass_shower_door',
    test: (b) => /\bglass\s+shower|\bshower\s+door|\benclosure/.test(b),
    tradeCategory: 'bathroom_fixture',
    scopeCategory: 'shower_door',
    allowedUnits: ['each', 'lump_sum'],
    pricingMethod: 'each',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText: 'Confirm whether this includes glass door material and installation, or labor only.',
  },
  {
    itemType: 'lighting_fixture',
    test: (b) => /\blighting|\blight\s+fixture|\bfixture\s+install/.test(b) && !/\brough/.test(b),
    tradeCategory: 'electrical',
    scopeCategory: 'lighting_fixture',
    allowedUnits: ['each', 'lump_sum'],
    pricingMethod: 'each',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText: 'Confirm whether this is fixture replacement only or includes new box/wiring.',
  },
  {
    itemType: 'exhaust_fan',
    test: (b) => /\bexhaust\s+fan|\bventilation|\bbath\s+fan/.test(b),
    tradeCategory: 'bathroom_fixture',
    scopeCategory: 'exhaust_fan',
    allowedUnits: ['each', 'lump_sum'],
    pricingMethod: 'each',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText: 'Confirm whether this is replacement only or includes new ducting/venting.',
  },
  {
    itemType: 'cabinet_install',
    test: (b) => /\bcabinet/.test(b) && /\binstall/.test(b),
    tradeCategory: 'kitchen',
    scopeCategory: 'cabinets',
    allowedUnits: ['lf', 'each', 'lump_sum'],
    pricingMethod: 'lf',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText:
      'Confirm cabinet run LF, box count, demo, fillers, panels, and whether countertops are included.',
  },
  {
    itemType: 'countertop',
    test: (b) => /\bcountertop|\bgranite|\bquartz|\bsolid\s+surface/.test(b) && !/\bcabinet/.test(b),
    tradeCategory: 'kitchen',
    scopeCategory: 'countertops',
    allowedUnits: ['sqft', 'lump_sum', 'allowance'],
    pricingMethod: 'sqft',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText:
      'Confirm material type, sqft, edge profile, sink cutout, backsplash, demo, and install labor.',
  },
  {
    itemType: 'hvac_equipment',
    test: (b) => /\bhvac|\bfurnace|\bac\s+unit|\bair\s+condition|\bheat\s+pump|\bmini[\s-]?split/.test(b),
    tradeCategory: 'hvac',
    scopeCategory: 'hvac_equipment',
    allowedUnits: ['each', 'lump_sum'],
    pricingMethod: 'each',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText: 'Confirm equipment type, tonnage, ductwork, electrical, permits, and removal of old unit.',
  },
  {
    itemType: 'concrete_complex',
    test: (b) =>
      /\bconcrete|\bslab|\bflatwork|\bfooting|\bstem\s+wall|\bpatio/.test(b) &&
      /\b(rebar|pump|form|finish|stamped|colored|stem|footing)/.test(b),
    tradeCategory: 'concrete',
    scopeCategory: 'concrete',
    allowedUnits: ['sqft', 'lump_sum', 'lf'],
    pricingMethod: 'unit_rate',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText: 'Confirm concrete type, prep, rebar, forming, finish, pump, and excavation scope.',
  },
  {
    itemType: 'roofing_complex',
    test: (b) =>
      /\broof|\bshingle|\bunderlayment|\btear[\s-]?off|\bdecking|\bflashing/.test(b) &&
      !/\brepair\s+only|\bpatch/.test(b),
    tradeCategory: 'roofing',
    scopeCategory: 'roofing',
    allowedUnits: ['square', 'sqft', 'lump_sum'],
    pricingMethod: 'square',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText: 'Confirm tear-off, underlayment, decking repair, flashing, disposal, and permit scope.',
  },
  {
    itemType: 'plumbing_fixture',
    test: (b) =>
      /\b(faucet|sink|water\s+heater|disposal|fixture)\b/.test(b) &&
      /\binstall|\breplac/.test(b) &&
      !/\btrim/.test(b),
    tradeCategory: 'plumbing',
    scopeCategory: 'plumbing_fixture',
    allowedUnits: ['each', 'lump_sum'],
    pricingMethod: 'each',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText: 'Confirm fixture type, rough-in changes, supply lines, and disposal of existing fixture.',
  },
  {
    itemType: 'electrical_fixture',
    test: (b) =>
      /\b(outlet|switch|receptacle|fan|light|fixture|device)\b/.test(b) &&
      /\binstall|\breplac|\badd/.test(b) &&
      !/\btrim|\brough|\bpanel/.test(b),
    tradeCategory: 'electrical',
    scopeCategory: 'electrical_fixture',
    allowedUnits: ['each', 'lump_sum'],
    pricingMethod: 'each',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText: 'Confirm device count, wiring changes, boxes, and whether materials are included.',
  },
  {
    itemType: 'landscape_plants',
    test: (b) => /\bplant|\btree|\bshrub|\bspecimen/.test(b),
    tradeCategory: 'landscaping',
    scopeCategory: 'landscape_plants',
    allowedUnits: ['each', 'lump_sum'],
    pricingMethod: 'each',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText: 'Confirm plant count, sizes, delivery, and planting labor.',
  },

  // Auto-select candidates — quantity-driven, low risk
  {
    itemType: 'baseboard_trim',
    test: (b) => /\bbaseboard|\bcrown|\bmoulding|\bmolding|\bcasing|\btrim\s+install/.test(b),
    tradeCategory: 'baseboard',
    scopeCategory: 'trim',
    allowedUnits: ['lf'],
    pricingMethod: 'lf',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    autoSelectAllowed: true,
  },
  {
    itemType: 'shower_waterproofing',
    test: (b) => /\bwaterproof|\bbacker\s+board|\bhardie|\bredgard|\bmembrane/.test(b) && !/\btile\s+install/.test(b),
    tradeCategory: 'shower_waterproofing',
    scopeCategory: 'waterproofing',
    allowedUnits: ['sqft'],
    pricingMethod: 'sqft',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    autoSelectAllowed: true,
  },
  {
    itemType: 'shower_tile',
    test: (b) => /\bshower\b/.test(b) && /\btile\b/.test(b) && !/\bdemo|\bwaterproof|\bbacker/.test(b),
    tradeCategory: 'shower_tile',
    scopeCategory: 'shower_tile',
    allowedUnits: ['sqft'],
    pricingMethod: 'sqft',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    autoSelectAllowed: true,
  },
  {
    itemType: 'shower_floor_tile',
    test: (b) => /\bshower\s+floor\s+tile/.test(b),
    tradeCategory: 'shower_tile',
    scopeCategory: 'shower_floor_tile',
    allowedUnits: ['sqft'],
    pricingMethod: 'sqft',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    autoSelectAllowed: true,
  },
  {
    itemType: 'flooring_install',
    test: (b) =>
      (/\bflooring|\blvp|\blaminate|\bvinyl|\bcarpet|\btile\b/.test(b) || /\bfloor\b/.test(b)) &&
      /\binstall/.test(b) &&
      !/\bdemo|\bremoval|\bbaseboard|\btrim/.test(b),
    tradeCategory: 'flooring',
    scopeCategory: 'flooring_install',
    allowedUnits: ['sqft'],
    pricingMethod: 'sqft',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    autoSelectAllowed: true,
  },
  {
    itemType: 'flooring_demo',
    test: (b) => /\b(floor|flooring|tile|carpet|lvp|laminate).*\b(demo|removal|tear[\s-]?out)/.test(b),
    tradeCategory: 'demo',
    scopeCategory: 'flooring_demo',
    allowedUnits: ['sqft', 'lump_sum'],
    pricingMethod: 'sqft',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    autoSelectAllowed: true,
  },
  {
    itemType: 'demo_general',
    test: (b) => /\b(demo|demolition|removal|tear[\s-]?out|rip[\s-]?out)\b/.test(b),
    tradeCategory: 'demo',
    scopeCategory: 'demo',
    allowedUnits: ['sqft', 'lump_sum'],
    pricingMethod: 'sqft',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    autoSelectAllowed: true,
  },
  {
    itemType: 'interior_painting',
    test: (b) => /\bpaint|\bpainting|\bprimer|\brepaint/.test(b) && !/\b(baseboard|trim|cabinets)\b/.test(b),
    tradeCategory: 'painting',
    scopeCategory: 'painting',
    allowedUnits: ['sqft'],
    pricingMethod: 'sqft',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    autoSelectAllowed: true,
  },
  {
    itemType: 'drywall_install',
    test: (b) => /\bdrywall|\bsheetrock|\bgypsum/.test(b) && !/\b(repair|patch|texture\s+match)/.test(b),
    tradeCategory: 'drywall',
    scopeCategory: 'drywall',
    allowedUnits: ['sqft'],
    pricingMethod: 'sqft',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    autoSelectAllowed: true,
  },
  {
    itemType: 'landscape_sqft',
    test: (b) => /\b(sod|turf|mulch|rock|gravel|paver|irrigation\s+bed)\b/.test(b),
    tradeCategory: 'landscaping',
    scopeCategory: 'landscaping',
    allowedUnits: ['sqft', 'lump_sum'],
    pricingMethod: 'sqft',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    autoSelectAllowed: true,
  },
  {
    itemType: 'service_call',
    test: (b) => /\bservice\s+call|\btroubleshoot|\bdiagnostic|\bhandyman/.test(b),
    tradeCategory: 'general_labor',
    scopeCategory: 'service_call',
    allowedUnits: ['lump_sum', 'hour'],
    pricingMethod: 'lump_sum',
    validSourceTypes: VALID_SOURCE_TYPES.all,
    needsApproval: true,
    userWarningText: 'Confirm service call scope, hourly vs flat rate, and parts allowance.',
  },
];

const TRADE_FALLBACK_RULES = {
  shower_waterproofing: { pricingMethod: 'sqft', allowedUnits: ['sqft'], autoSelectAllowed: true },
  shower_tile: { pricingMethod: 'sqft', allowedUnits: ['sqft'], autoSelectAllowed: true },
  demo: { pricingMethod: 'sqft', allowedUnits: ['sqft', 'lump_sum'], autoSelectAllowed: true },
  flooring: { pricingMethod: 'sqft', allowedUnits: ['sqft'], autoSelectAllowed: true },
  tile: { pricingMethod: 'sqft', allowedUnits: ['sqft'], autoSelectAllowed: true },
  baseboard: { pricingMethod: 'lf', allowedUnits: ['lf'], autoSelectAllowed: true },
  painting: { pricingMethod: 'sqft', allowedUnits: ['sqft'], autoSelectAllowed: true },
  drywall: { pricingMethod: 'sqft', allowedUnits: ['sqft'], autoSelectAllowed: false },
  plumbing: { pricingMethod: 'each', allowedUnits: ['each', 'hour', 'lump_sum'], autoSelectAllowed: false },
  plumbing_service: { pricingMethod: 'lump_sum', allowedUnits: ['lump_sum', 'hour'], autoSelectAllowed: false },
  electrical: { pricingMethod: 'each', allowedUnits: ['each', 'hour', 'lump_sum'], autoSelectAllowed: false },
  roofing: { pricingMethod: 'square', allowedUnits: ['square', 'sqft', 'lump_sum'], autoSelectAllowed: false },
  concrete: { pricingMethod: 'sqft', allowedUnits: ['sqft', 'lump_sum', 'lf'], autoSelectAllowed: false },
  framing: { pricingMethod: 'sqft', allowedUnits: ['sqft', 'lf', 'lump_sum'], autoSelectAllowed: false },
  hvac: { pricingMethod: 'each', allowedUnits: ['each', 'lump_sum', 'hour'], autoSelectAllowed: false },
  landscaping: { pricingMethod: 'sqft', allowedUnits: ['sqft', 'each', 'lump_sum'], autoSelectAllowed: false },
  excavation: { pricingMethod: 'lump_sum', allowedUnits: ['lump_sum', 'hour', 'sqft', 'lf'], autoSelectAllowed: false },
  kitchen: { pricingMethod: 'sqft', allowedUnits: ['sqft', 'lf', 'lump_sum'], autoSelectAllowed: false },
  bathroom: { pricingMethod: 'sqft', allowedUnits: ['sqft', 'lump_sum'], autoSelectAllowed: false },
  bathroom_fixture: { pricingMethod: 'each', allowedUnits: ['each', 'lump_sum'], autoSelectAllowed: false, needsApproval: true },
  cleanup: { pricingMethod: 'lump_sum', allowedUnits: ['lump_sum', 'allowance'], manualPricingFallback: true },
  permits: { pricingMethod: 'lump_sum', allowedUnits: ['lump_sum', 'allowance'], manualPricingFallback: true },
  general_labor: { pricingMethod: 'hour', allowedUnits: ['hour', 'lump_sum', 'day'], autoSelectAllowed: false },
  other: { pricingMethod: 'unit_rate', allowedUnits: ['sqft', 'lf', 'each', 'hour', 'lump_sum', 'allowance'], autoSelectAllowed: false },
};

function finalizeRule(partial, scopeItem, draft) {
  const trade = partial.tradeCategory || inferTradeCategory(scopeItem, draft);
  const range = getPricingRange(trade);
  const bands = bandFromRange(range);
  return {
    itemType: partial.itemType || trade,
    tradeCategory: trade,
    scopeCategory: partial.scopeCategory || trade,
    allowedUnits: partial.allowedUnits || range.allowedUnits || ['lump_sum'],
    pricingMethod: partial.pricingMethod || range.unit || 'unit_rate',
    validSourceTypes: partial.validSourceTypes || VALID_SOURCE_TYPES.all,
    lowRange: partial.lowRange ?? bands.low,
    typicalRange: partial.typicalRange ?? bands.typical,
    highRange: partial.highRange ?? bands.high,
    extremeWarningRange: partial.extremeWarningRange ?? bands.extremeWarning,
    autoSelectAllowed: partial.autoSelectAllowed === true,
    needsApproval: partial.needsApproval === true,
    manualPricingFallback: partial.manualPricingFallback === true,
    userWarningText: partial.userWarningText || range.notes || null,
  };
}

/**
 * Resolve the pricing matrix rule for any scope item (all trades / project types).
 * @returns {ScopePricingRule}
 */
function resolveScopePricingRule(scopeItem, draft = {}) {
  const blob = scopeBlob(scopeItem);
  for (const partial of SCOPE_ITEM_RULES) {
    if (partial.test(blob, scopeItem)) {
      return finalizeRule(partial, scopeItem, draft);
    }
  }
  const trade = inferTradeCategory(scopeItem, draft);
  const fallback = TRADE_FALLBACK_RULES[trade] || TRADE_FALLBACK_RULES.other;
  return finalizeRule({ itemType: trade, tradeCategory: trade, scopeCategory: trade, ...fallback }, scopeItem, draft);
}

function isManualPricingFallback(scopeItem, draft = {}) {
  return resolveScopePricingRule(scopeItem, draft).manualPricingFallback;
}

function isNeedsApprovalScope(scopeItem, draft = {}) {
  const rule = resolveScopePricingRule(scopeItem, draft);
  return rule.needsApproval && !rule.manualPricingFallback;
}

function isAutoSelectAllowed(scopeItem, draft = {}) {
  const rule = resolveScopePricingRule(scopeItem, draft);
  if (rule.manualPricingFallback || rule.needsApproval) return false;
  return rule.autoSelectAllowed === true;
}

function getScopeApprovalHint(scopeItem, draft = {}) {
  const rule = resolveScopePricingRule(scopeItem, draft);
  return rule.userWarningText || 'Confirm what is included before applying this price.';
}

function isSourceValidForRule(source, rule) {
  return (rule.validSourceTypes || VALID_SOURCE_TYPES.all).includes(source);
}

function isQuantityUnitAllowed(scopeItem, draft = {}) {
  const rule = resolveScopePricingRule(scopeItem, draft);
  const unit = normalizeUnit(scopeItem.unit);
  return rule.allowedUnits.includes(unit) || unit === 'lump_sum';
}

function hasSavedSource(rates) {
  return (rates || []).some((r) => VALID_SOURCE_TYPES.saved.includes(r.source));
}

module.exports = {
  VALID_SOURCE_TYPES,
  SCOPE_ITEM_RULES,
  TRADE_FALLBACK_RULES,
  resolveScopePricingRule,
  isManualPricingFallback,
  isNeedsApprovalScope,
  isAutoSelectAllowed,
  getScopeApprovalHint,
  isSourceValidForRule,
  isQuantityUnitAllowed,
  hasSavedSource,
  scopeBlob,
};
