/**
 * Per-scope-item quantity rules for complex jobs (bathroom remodel, etc.).
 * Room sqft must not be blindly applied to every line item.
 */

const { extractScopeQuantitiesForPackage } = require('./estimateDraftQuantityPrice');

const QUANTITY_SOURCES = {
  notes: 'notes',
  user_entered: 'user_entered',
  inferred: 'inferred',
  default_assumption: 'default_assumption',
  missing: 'missing',
  not_applicable: 'not_applicable',
};

/** @typedef {'sqft'|'lf'|'each'|'hr'|'allowance'|'lump_sum'} ScopeQtyUnit */

/**
 * @typedef {object} ScopeItemQuantityRule
 * @property {ScopeQtyUnit} defaultUnit
 * @property {ScopeQtyUnit[]} allowedUnits
 * @property {string} [measurementKey] - key on normalized room measurements
 * @property {string[]} [measurementKeys] - first available key wins (e.g. kitchen or bath floor)
 * @property {string[]} [aggregateMeasurementKeys] - sum all present keys (e.g. full bath tear-out)
 * @property {boolean} [canUseRoomSqft]
 * @property {boolean} [requiresUserQuantity]
 * @property {boolean} [dualAllowanceField]
 * @property {boolean} [lumpSumOnly]
 * @property {number} [defaultQuantity]
 * @property {'unit_rate'|'each'|'lump_sum'|'allowance'|'hourly'|'scope_only'} pricingMethod
 * @property {string} [quantityHelper]
 * @property {string} [missingMessage]
 */

/** Checklist item id → quantity rule (bathroom remodel primary). */
const CHECKLIST_ITEM_QUANTITY_RULES = {
  demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    aggregateMeasurementKeys: ['bathroomFloorSqft', 'showerWallTileSqft', 'showerFloorTileSqft'],
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Sums bathroom floor + shower walls + shower floor for full tear-out.',
  },
  floor_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['bathroomFloorSqft', 'showerFloorTileSqft', 'kitchenFloorSqft', 'floorAreaSqft'],
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Uses bathroom floor sqft for floor removal.',
  },
  tub_demo: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 tub removal. Edit if multiple.',
  },
  shower_floor_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerFloorTileSqft',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter shower pan / shower floor demo sqft.',
    missingMessage: 'Enter shower floor demo sqft.',
  },
  shower_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerWallTileSqft',
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    dualAllowanceField: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter shower wall tile sqft — not bathroom floor sqft.',
    missingMessage: 'Enter shower wall tile sqft.',
  },
  waterproofing: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerWallTileSqft',
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Usually same as shower wall tile sqft.',
    missingMessage: 'Enter shower waterproofing sqft.',
  },
  floor_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'bathroomFloorSqft',
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Uses bathroom floor sqft.',
  },
  shower_pan: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Mud pan build — labor + materials (1 shower).',
  },
  wet_area_install: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 tub or prefab pan. Tile pan qty is on shower floor tile.',
    choiceIds: ['tub', 'prefab'],
  },
  tub_install: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 tub install (labor + materials).',
  },
  prefab_shower_pan: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 prefab pan install (labor + materials).',
  },
  shower_floor_tile: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft'],
    measurementKey: 'showerFloorTileSqft',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter shower floor tile sqft — not bathroom floor sqft.',
    missingMessage: 'Enter shower floor tile sqft.',
  },
  shower_niche: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 niche. Edit count if different.',
  },
  shower_bench_curb: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'lf'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 bench/curb — or enter linear feet.',
  },
  tub_shower: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'each'],
    measurementKey: 'showerWallTileSqft',
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter shower wall tile sqft if replacing tile.',
    missingMessage: 'Enter shower area sqft or fixture count.',
  },
  vanity: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 vanity. Edit if different.',
  },
  toilet: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 toilet. Edit if different.',
  },
  plumbing_rough: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    pricingMethod: 'allowance',
    quantityHelper:
      'Rough-in points = supply/drain relocations. Fixture hookup is on Toilet, Vanity, or Plumbing trim.',
    missingMessage: 'Enter rough-in points and/or a dollar allowance.',
  },
  electrical_rough: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum', 'hr'],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    pricingMethod: 'allowance',
    quantityHelper:
      'Circuits, boxes, or devices affected. Device trim and plates are on Electrical trim.',
    missingMessage: 'Enter circuit/device count and/or a dollar allowance.',
  },
  lighting: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 light fixture. Edit count if different.',
  },
  exhaust_fan: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 bath fan. Edit if different.',
  },
  mirror_accessories: {
    defaultUnit: 'allowance',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'allowance',
    quantityHelper: 'Assuming 1 accessories allowance.',
  },
  floor_prep: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'bathroomFloorSqft',
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Uses bathroom floor sqft or enter allowance.',
  },
  drywall: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'drywallSqft',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter patch/repair sqft or use a lump sum.',
    missingMessage: 'Enter drywall repair sqft or lump sum.',
  },
  paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'wallPaintSqft',
    dualAllowanceField: true,
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter paint sqft and/or calculated total from notes rates.',
    missingMessage: 'Enter wall/ceiling paint sqft.',
  },
  trim: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'baseboardLf',
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Linear feet around bathroom perimeter.',
    missingMessage: 'Enter baseboard linear feet.',
  },
  glass_door: {
    defaultUnit: 'each',
    allowedUnits: ['each'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 shower door.',
  },
  plumbing_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    pricingMethod: 'allowance',
    quantityHelper: 'Enter plumbing trim-out allowance for this job.',
    missingMessage: 'Enter plumbing trim allowance.',
  },
  electrical_trim: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    pricingMethod: 'allowance',
    quantityHelper: 'Enter electrical trim-out allowance for this job.',
    missingMessage: 'Enter electrical trim allowance.',
  },
  permits: {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    pricingMethod: 'allowance',
    quantityHelper: 'Enter permit and inspection fees for this job.',
    missingMessage: 'Enter permit allowance.',
  },
  cleanup: {
    defaultUnit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    pricingMethod: 'lump_sum',
    quantityHelper: 'Enter cleanup and disposal allowance for this job.',
    missingMessage: 'Enter cleanup/disposal allowance.',
  },
  appliance_removal: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'lump_sum', 'allowance'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 appliance set to remove. Edit count if multiple.',
  },
  // Kitchen remodel
  wall_demo: {
    defaultUnit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance', 'sqft'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'lump_sum',
    quantityHelper: 'Assuming lump sum wall/soffit demo.',
  },
  cabinets: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'each', 'allowance', 'lump_sum'],
    measurementKey: 'cabinetLf',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter cabinet run LF or lump sum.',
    missingMessage: 'Enter cabinet LF or allowance.',
  },
  countertops: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'lf', 'allowance', 'lump_sum'],
    measurementKey: 'countertopSqft',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter countertop sqft.',
    missingMessage: 'Enter countertop sqft.',
  },
  flooring: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['flooringSqft', 'floorAreaSqft', 'kitchenFloorSqft', 'bathroomFloorSqft'],
    dualAllowanceField: true,
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter kitchen or room floor sqft.',
    missingMessage: 'Enter floor sqft.',
  },
  backsplash: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'lf', 'allowance'],
    measurementKey: 'backsplashSqft',
    dualAllowanceField: true,
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter backsplash sqft and/or calculated total from notes.',
    missingMessage: 'Enter backsplash sqft.',
  },
  sink_faucet: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'each',
    quantityHelper: 'Assuming 1 sink/faucet set.',
  },
  appliances: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance'],
    requiresUserQuantity: true,
    pricingMethod: 'each',
    quantityHelper: 'Enter appliance count or allowance.',
    missingMessage: 'Enter appliance count.',
  },
  // Landscaping
  sod_turf: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['sodSqft', 'landscapeSqft'],
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter sod/turf sqft.',
    missingMessage: 'Enter sod/turf sqft.',
  },
  pavers: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['paverSqft', 'landscapeSqft'],
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter paver sqft.',
    missingMessage: 'Enter paver sqft.',
  },
  rock_mulch: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'ton', 'allowance', 'lump_sum'],
    measurementKeys: ['rockMulchSqft', 'landscapeSqft'],
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter coverage sqft, CY, or tons.',
    missingMessage: 'Enter rock/mulch quantity.',
  },
  concrete: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'allowance', 'lump_sum'],
    measurementKeys: ['concreteSqft', 'concreteCy'],
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter concrete sqft or CY.',
    missingMessage: 'Enter concrete quantity.',
  },
  excavation: {
    defaultUnit: 'cy',
    allowedUnits: ['cy', 'sqft', 'lf', 'allowance', 'lump_sum'],
    measurementKey: 'excavationCy',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter excavation CY, sqft, or lump sum.',
    missingMessage: 'Enter excavation quantity.',
  },
  tear_off: {
    defaultUnit: 'squares',
    allowedUnits: ['squares', 'sqft', 'lump_sum'],
    measurementKey: 'roofSquares',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter roof squares or sqft from notes.',
    missingMessage: 'Enter roof squares.',
  },
  shingles_roofing: {
    defaultUnit: 'squares',
    allowedUnits: ['squares', 'sqft', 'lump_sum'],
    measurementKey: 'roofSquares',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter roof squares.',
    missingMessage: 'Enter roof squares.',
  },
  decking: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'lf', 'allowance', 'lump_sum'],
    measurementKey: 'deckSqft',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter deck surface sqft or LF.',
    missingMessage: 'Enter deck sqft or LF.',
  },
  railing: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    measurementKey: 'railingLf',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter railing linear feet.',
    missingMessage: 'Enter railing LF.',
  },
  pour_flatwork: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'cy', 'allowance', 'lump_sum'],
    measurementKeys: ['concreteSqft', 'concreteCy'],
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter concrete sqft or CY.',
    missingMessage: 'Enter concrete quantity.',
  },
  hang: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'drywallSqft',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter drywall hang sqft.',
    missingMessage: 'Enter drywall sqft.',
  },
  finish_tape: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'drywallSqft',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter drywall finish sqft.',
    missingMessage: 'Enter drywall sqft.',
  },
  patch_repair: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'drywallSqft',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter patch/repair sqft.',
    missingMessage: 'Enter drywall repair sqft.',
  },
  interior_paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'wallPaintSqft',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter interior paint sqft.',
    missingMessage: 'Enter paint sqft.',
  },
  exterior_paint: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKey: 'exteriorPaintSqft',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter exterior paint sqft.',
    missingMessage: 'Enter exterior paint sqft.',
  },
};

const DEFAULT_SCOPE_ITEM_RULE = {
  defaultUnit: 'lump_sum',
  allowedUnits: ['lump_sum', 'allowance', 'each', 'sqft', 'lf', 'cy', 'hr'],
  defaultQuantity: 1,
  requiresUserQuantity: false,
  pricingMethod: 'lump_sum',
  quantityHelper: 'Assumed lump sum — edit if you price by unit.',
};

/** Package name patterns → checklist rule key */
const PACKAGE_NAME_TO_RULE_KEY = [
  { test: /\bbath(?:room)?\s+demo\b|\bdemo\b.*\bbath/i, key: 'demo' },
  { test: /\btile\s+demo|\btile\s+removal|\btile\s+demolition/i, key: 'floor_demo' },
  { test: /\bfloor\s+demo|\bflooring\s+demo/i, key: 'floor_demo' },
  { test: /^\s*flooring\s*$/i, key: 'flooring' },
  { test: /\b(lvp|laminate|vinyl|carpet|flooring)\b.*\b(install|installation)\b|\b(install|installation)\b.*\b(lvp|laminate|vinyl|carpet|flooring)\b/i, key: 'flooring' },
  { test: /\bshower\s+floor\s+tile|\btile\s+shower\s+floor/i, key: 'shower_floor_tile' },
  { test: /\bprefab\s+shower\s+pan|\bshower\s+pan\s+install/i, key: 'prefab_shower_pan' },
  { test: /\btile\s+shower\s+pan|\bmud\s+pan/i, key: 'shower_pan' },
  { test: /\bshower\s+pan|\btile\s+pan/i, key: 'shower_pan' },
  { test: /\btub\s+install|\btub\s+installation|\bbathtub/i, key: 'tub_install' },
  { test: /\bshower\s+niche|\bniche/i, key: 'shower_niche' },
  { test: /\bshower\s+bench|\bcurb/i, key: 'shower_bench_curb' },
  { test: /\bexhaust\s+fan|\bbath\s+fan|\bventilation/i, key: 'exhaust_fan' },
  { test: /\bmirror|\baccessories|\btowel\s+bar/i, key: 'mirror_accessories' },
  { test: /\bfloor\s+prep|\bsubfloor|\bunderlayment/i, key: 'floor_prep' },
  { test: /\bback\s*splash/i, key: 'backsplash' },
  { test: /\bcabinet/i, key: 'cabinets' },
  { test: /\bcountertop/i, key: 'countertops' },
  { test: /\brock|\bmulch|\bgravel/i, key: 'rock_mulch' },
  { test: /\bsod|\bturf/i, key: 'sod_turf' },
  { test: /\bpaver/i, key: 'pavers' },
  { test: /\bconcrete\b/i, key: 'concrete' },
  { test: /\bexcavat/i, key: 'excavation' },
  { test: /\brail(?:ing)?\b|\bguardrail\b/i, key: 'railing' },
  { test: /\bshower\b.*\btile\b|\btile\b.*\bshower\b|\bshower\s+wall\s+tile/i, key: 'shower_tile' },
  { test: /\bwaterproof|\bbacker\s+board/i, key: 'waterproofing' },
  { test: /\bfloor\b.*\btile\b|\btile\b.*\bfloor\b/i, key: 'floor_tile' },
  { test: /\bvanity\b/i, key: 'vanity' },
  { test: /\btoilet\b/i, key: 'toilet' },
  { test: /\bplumb.*\brough|\brough[\s-]?in\b.*\bplumb/i, key: 'plumbing_rough' },
  { test: /\belectrical\b(?!.*trim)|\bnew\s+circuits\b/i, key: 'electrical_rough' },
  { test: /\blight(?:ing)?\s+fix|\bfixture.*\blight/i, key: 'lighting' },
  { test: /\bdrywall\b|\bpatch/i, key: 'drywall' },
  { test: /\bpaint|\bpainting/i, key: 'paint' },
  { test: /\bbaseboard|\btrim\s+install|\btrim\s+&\s+baseboard/i, key: 'trim' },
  { test: /\bshower\s+door|\bglass\s+door|\benclosure/i, key: 'glass_door' },
  { test: /\bplumb.*\btrim|\bplumbing\s+trim|\bfinal\s+plumb/i, key: 'plumbing_trim' },
  { test: /\belectrical\s+trim|\bdevices.*\bplates/i, key: 'electrical_trim' },
  { test: /\bpermit|\binspection/i, key: 'permits' },
  { test: /\bcleanup|\bdisposal|\bhaul[\s-]?off|\bdumpster/i, key: 'cleanup' },
  { test: /\bplumb(?!.*trim)/i, key: 'plumbing_rough' },
];

function parseMeasurementNumber(value) {
  const n = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeScopeMeasurements(measurements = {}) {
  const bathroomFloorSqft =
    parseMeasurementNumber(measurements.bathroomFloorSqft) ??
    parseMeasurementNumber(measurements.sqft);
  const baseboardLf =
    parseMeasurementNumber(measurements.baseboardLf) ?? parseMeasurementNumber(measurements.lf);
  const showerWallTileSqft = parseMeasurementNumber(measurements.showerWallTileSqft);
  const showerFloorTileSqft = parseMeasurementNumber(measurements.showerFloorTileSqft);
  const wallPaintSqft = parseMeasurementNumber(measurements.wallPaintSqft);
  const kitchenFloorSqft = parseMeasurementNumber(measurements.kitchenFloorSqft);
  const backsplashSqft = parseMeasurementNumber(measurements.backsplashSqft);
  const landscapeSqft = parseMeasurementNumber(measurements.landscapeSqft);
  const roofSquares = parseMeasurementNumber(measurements.roofSquares);
  const drywallSqft = parseMeasurementNumber(measurements.drywallSqft);
  const concreteSqft = parseMeasurementNumber(measurements.concreteSqft);
  const concreteCy = parseMeasurementNumber(measurements.concreteCy);
  const excavationCy = parseMeasurementNumber(measurements.excavationCy);
  const landscapeTons = parseMeasurementNumber(measurements.landscapeTons);
  const countertopSqft = parseMeasurementNumber(measurements.countertopSqft);
  const cabinetLf = parseMeasurementNumber(measurements.cabinetLf);
  const floorAreaSqft = parseMeasurementNumber(measurements.floorAreaSqft);
  const flooringSqft = parseMeasurementNumber(measurements.flooringSqft);
  const sodSqft = parseMeasurementNumber(measurements.sodSqft);
  const paverSqft = parseMeasurementNumber(measurements.paverSqft);
  const rockMulchSqft = parseMeasurementNumber(measurements.rockMulchSqft);
  const exteriorPaintSqft = parseMeasurementNumber(measurements.exteriorPaintSqft);
  const deckSqft = parseMeasurementNumber(measurements.deckSqft);
  const railingLf = parseMeasurementNumber(measurements.railingLf);

  return {
    bathroomFloorSqft,
    baseboardLf,
    showerWallTileSqft,
    showerFloorTileSqft,
    wallPaintSqft,
    kitchenFloorSqft,
    backsplashSqft,
    countertopSqft,
    cabinetLf,
    floorAreaSqft,
    flooringSqft,
    landscapeSqft,
    sodSqft,
    paverSqft,
    rockMulchSqft,
    roofSquares,
    drywallSqft,
    concreteSqft,
    concreteCy,
    excavationCy,
    landscapeTons,
    exteriorPaintSqft,
    deckSqft,
    railingLf,
    sqft: bathroomFloorSqft,
    lf: baseboardLf,
    itemQuantities: measurements.itemQuantities || {},
  };
}

function lookupRuleKeyForPackage(name, scope = '') {
  const nameStr = String(name || '');
  const fullBlob = `${nameStr} ${scope || ''}`;
  for (const row of PACKAGE_NAME_TO_RULE_KEY) {
    if (row.test.test(nameStr)) return row.key;
  }
  for (const row of PACKAGE_NAME_TO_RULE_KEY) {
    if (row.test.test(fullBlob)) return row.key;
  }
  return null;
}

/** Kitchen shares checklist ids with bathroom — override quantity semantics per template. */
const KITCHEN_CHECKLIST_QUANTITY_RULES = {
  demo: {
    defaultUnit: 'lump_sum',
    allowedUnits: ['lump_sum', 'allowance', 'lf'],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: 'lump_sum',
    quantityHelper: 'Assuming 1 cabinet/counter demo lump sum. Edit LF if priced by run.',
  },
  floor_demo: {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    measurementKeys: ['kitchenFloorSqft', 'floorAreaSqft'],
    canUseRoomSqft: true,
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter kitchen floor sqft for flooring removal.',
    missingMessage: 'Enter kitchen floor demo sqft.',
  },
};

function additionFloorAreaRule(quantityHelper, missingMessage = 'Enter pricing basis or lump sum.') {
  return {
    defaultUnit: 'sqft',
    allowedUnits: ['sqft', 'allowance', 'lump_sum'],
    pricingBasisMeasurementKey: 'floorAreaSqft',
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper,
    missingMessage,
  };
}

function additionAllowanceByFloorAreaRule(quantityHelper, missingMessage = 'Needs pricing') {
  return {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum', 'sqft'],
    pricingBasisMeasurementKey: 'floorAreaSqft',
    requiresUserQuantity: true,
    pricingMethod: 'allowance',
    quantityHelper,
    missingMessage,
  };
}

function additionFlatAllowanceRule(quantityHelper, missingMessage = 'Enter allowance.') {
  return {
    defaultUnit: 'allowance',
    allowedUnits: ['allowance', 'lump_sum'],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    pricingMethod: 'allowance',
    quantityHelper,
    missingMessage,
  };
}

const ADDITION_CHECKLIST_QUANTITY_RULES = {
  plans_engineering: additionFlatAllowanceRule(
    'Enter plans and engineering allowance for this job.',
    'Enter plans/engineering allowance.'
  ),
  permits: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.permits,
    quantityHelper: 'Enter permit and inspection allowance for this job.',
  },
  utility_coordination: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Enter utility coordination lump sum, or utility run LF if known.',
    missingMessage: 'Enter utility coordination pricing.',
  },
  sitework: additionFloorAreaRule(
    'Enter site prep sqft, or price site prep with lump sum/material/labor.',
    'Enter site prep sqft or pricing.'
  ),
  grading: additionFloorAreaRule(
    'Finish/rough grading is usually priced by sqft; use CY for mass cut/fill.',
    'Enter grading sqft or pricing.'
  ),
  utility_trenching: {
    defaultUnit: 'lf',
    allowedUnits: ['lf', 'cy', 'allowance', 'lump_sum'],
    requiresUserQuantity: true,
    pricingMethod: 'unit_rate',
    quantityHelper: 'Utility trenching is usually priced by LF; use CY for trench excavation volume.',
    missingMessage: 'Enter utility trenching LF or pricing.',
  },
  foundation: additionFloorAreaRule(
    'Enter foundation/slab footprint sqft, or use concrete CY on the concrete line.',
    'Enter foundation sqft or pricing.'
  ),
  concrete: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.concrete,
    defaultUnit: 'cy',
    measurementKeys: ['concreteCy', 'concreteSqft'],
    quantityHelper: 'Enter foundation concrete CY, or flatwork sqft if this is slab/flatwork.',
    missingMessage: 'Enter foundation concrete CY or flatwork sqft.',
  },
  framing: additionFloorAreaRule(
    'Enter framed floor area sqft, or price framing with lump sum/material/labor.',
    'Enter framing sqft or pricing.'
  ),
  roof_tie_in: additionFloorAreaRule(
    'Enter roof/tie-in area sqft, or price as a lump sum.',
    'Enter roof/tie-in sqft or pricing.'
  ),
  windows_doors: {
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum', 'sqft'],
    requiresUserQuantity: true,
    pricingMethod: 'each',
    quantityHelper: 'Enter window/door count, or use lump sum/material/labor if count is unknown.',
    missingMessage: 'Enter window/door count or pricing.',
  },
  exterior_finishes: additionFloorAreaRule(
    'Enter exterior finish area sqft, or price with lump sum/material/labor.',
    'Enter exterior finish sqft or pricing.'
  ),
  hvac: additionFloorAreaRule(
    'Enter conditioned floor sqft, or price HVAC with lump sum/material/labor.',
    'Enter HVAC sqft or pricing.'
  ),
  insulation: additionFloorAreaRule(
    'Enter insulation area sqft, or price insulation with lump sum/material/labor.',
    'Enter insulation sqft or pricing.'
  ),
  drywall: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.drywall,
    measurementKey: 'drywallSqft',
    quantityHelper: 'Enter drywall sqft, or price drywall with lump sum/material/labor.',
  },
  paint: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.paint,
    measurementKey: 'wallPaintSqft',
    quantityHelper: 'Enter paint sqft and/or calculated material/labor totals.',
  },
  flooring: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.flooring,
    measurementKeys: ['flooringSqft', 'floorAreaSqft'],
    quantityHelper: 'Enter flooring sqft and/or calculated material/labor totals.',
  },
  cabinets_counters: additionFlatAllowanceRule(
    'Enter cabinet and counter allowance for this job.',
    'Enter cabinet/counter allowance.'
  ),
  tile: additionFloorAreaRule(
    'Enter tile area sqft, or price tile with lump sum/material/labor.',
    'Enter tile sqft or pricing.'
  ),
  interior_trim: additionFloorAreaRule(
    'Enter trim area sqft, or use lump sum/material/labor.',
    'Enter interior trim pricing.'
  ),
  plumbing_trim: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.plumbing_trim,
  },
  electrical_trim: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.electrical_trim,
  },
  hvac_startup: additionAllowanceByFloorAreaRule(
    'Enter HVAC startup lump sum, or price by conditioned floor sqft.',
    'Enter HVAC startup pricing.'
  ),
  appliances: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.appliances,
    defaultUnit: 'each',
    allowedUnits: ['each', 'allowance', 'lump_sum'],
    quantityHelper: 'Enter appliance count/allowance, or material/labor totals.',
  },
  final_inspections: additionFlatAllowanceRule(
    'Enter final inspection allowance for this job.',
    'Enter final inspection allowance.'
  ),
  cleanup: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.cleanup,
    quantityHelper: 'Enter cleanup and disposal allowance for this job.',
  },
  contingency: additionAllowanceByFloorAreaRule(
    'Enter contingency allowance, or budget by ADU floor sqft.',
    'Enter contingency pricing.'
  ),
};

function getRuleForChecklistItem(itemId, templateKey) {
  if (templateKey === 'addition' && ADDITION_CHECKLIST_QUANTITY_RULES[itemId]) {
    return ADDITION_CHECKLIST_QUANTITY_RULES[itemId];
  }
  if (templateKey === 'kitchen' && KITCHEN_CHECKLIST_QUANTITY_RULES[itemId]) {
    return KITCHEN_CHECKLIST_QUANTITY_RULES[itemId];
  }
  return CHECKLIST_ITEM_QUANTITY_RULES[itemId] || DEFAULT_SCOPE_ITEM_RULE;
}

function getRuleForPackage(name, scope = '') {
  const key = lookupRuleKeyForPackage(name, scope);
  return key ? CHECKLIST_ITEM_QUANTITY_RULES[key] : null;
}

function notesHaveCombinedCabinetsCounters(notes) {
  const n = String(notes || '').toLowerCase();
  const hasCabinets = /\b(cabinets?|cabinetry)\b/.test(n);
  const hasCounters = /\b(counters?|countertops?|quartz|granite)\b/.test(n);
  return hasCabinets && hasCounters;
}

function resolveLinkedCountertopAllowance(itemId, measurements, notes) {
  if (itemId !== 'countertops') return null;
  const cabinetEntry = measurements.itemQuantities?.cabinets;
  if (!cabinetEntry?.quantity || cabinetEntry.quantity <= 0) return null;
  if (!['allowance', 'lump_sum'].includes(cabinetEntry.unit || '')) return null;
  if (!cabinetEntry.includesCountertops && !notesHaveCombinedCabinetsCounters(notes)) return null;

  return {
    quantity: Number(cabinetEntry.quantity),
    unit: 'allowance',
    quantitySource: QUANTITY_SOURCES.notes,
    label: 'countertops',
    sourceLabel: 'Combined cabinets & counters',
    rule: getRuleForChecklistItem('countertops'),
    pricingReady: true,
    linkedCabinetAllowance: true,
  };
}

function sourceLabel(source) {
  switch (source) {
    case QUANTITY_SOURCES.notes:
      return 'Parsed from notes';
    case QUANTITY_SOURCES.user_entered:
      return 'Entered';
    case QUANTITY_SOURCES.inferred:
      return 'From room measurement';
    case QUANTITY_SOURCES.default_assumption:
      return 'Assumed';
    case QUANTITY_SOURCES.missing:
      return 'Needs measurement';
    default:
      return '';
  }
}

function measurementUnitForKey(key, fallbackUnit) {
  if (/Sqft$/.test(key)) return 'sqft';
  if (/Lf$/.test(key)) return 'lf';
  if (/Cy$/.test(key)) return 'cy';
  if (/Tons$/.test(key)) return 'ton';
  if (/Squares$/.test(key)) return 'squares';
  return fallbackUnit;
}

function isPlaceholderAllowancePricing(quantity, unit, itemId) {
  const PLACEHOLDER_ALLOWANCE_ITEM_IDS = [
    'permits',
    'cleanup',
    'plumbing_trim',
    'electrical_trim',
    'mirror_accessories',
  ];
  if (!itemId || !PLACEHOLDER_ALLOWANCE_ITEM_IDS.includes(itemId)) return false;
  if (quantity == null || !Number.isFinite(Number(quantity))) return false;
  const normalizedUnit = String(unit || '').toLowerCase();
  if (normalizedUnit !== 'allowance' && normalizedUnit !== 'lump_sum') return false;
  return Number(quantity) === 1;
}

function sumMeasurementKeys(measurements, keys) {
  let total = 0;
  let parts = 0;
  for (const key of keys) {
    const v = measurements[key];
    if (v != null && v > 0) {
      total += v;
      parts += 1;
    }
  }
  if (parts === 0) return null;
  return { quantity: total, parts };
}

function aggregatedMeasurementSourceLabel(parts) {
  if (parts >= 3) return 'Floor + shower walls + shower floor';
  if (parts === 2) return 'Combined tear-out sqft';
  return 'From room measurement';
}

function roughAllowanceSubKey(itemId) {
  return `${itemId}__allowance`;
}

function parseStoredItemQuantity(measurements, key) {
  const override = measurements.itemQuantities?.[key];
  if (override && override.quantity != null && override.quantity > 0) {
    return {
      quantity: Number(override.quantity),
      unit: override.unit || 'each',
      quantitySource: override.quantitySource,
    };
  }
  return null;
}

function sqftFromItemQuantities(measurements, itemId) {
  const entry = measurements.itemQuantities?.[itemId];
  if (!entry?.quantity || entry.unit !== 'sqft') return undefined;
  const q = Number(entry.quantity);
  return Number.isFinite(q) && q > 0 ? q : undefined;
}

const { resolveItemRatePricingFromNotes } = require('./scopeRatePricingParser');

function measurementsForRatePricing(measurements) {
  return {
    backsplashSqft: measurements.backsplashSqft ?? sqftFromItemQuantities(measurements, 'backsplash'),
    wallPaintSqft: measurements.wallPaintSqft ?? sqftFromItemQuantities(measurements, 'paint'),
    kitchenFloorSqft: measurements.kitchenFloorSqft,
    bathroomFloorSqft: measurements.bathroomFloorSqft,
    floorAreaSqft: measurements.floorAreaSqft,
    flooringSqft: measurements.flooringSqft,
    drywallSqft: measurements.drywallSqft,
    exteriorPaintSqft: measurements.exteriorPaintSqft,
    landscapeSqft: measurements.landscapeSqft,
    sodSqft: measurements.sodSqft,
    paverSqft: measurements.paverSqft,
    rockMulchSqft: measurements.rockMulchSqft,
    landscapeTons: measurements.landscapeTons,
    roofSquares: measurements.roofSquares,
    concreteSqft: measurements.concreteSqft,
    concreteCy: measurements.concreteCy,
    excavationCy: measurements.excavationCy,
    deckSqft: measurements.deckSqft,
    railingLf: measurements.railingLf,
    baseboardLf: measurements.baseboardLf,
  };
}

function measurementsForRatePricingWithCount(measurements, itemId, countEntry) {
  const base = measurementsForRatePricing(measurements);
  if (!countEntry || countEntry.unit !== 'sqft' || !countEntry.quantity) return base;
  if (itemId === 'backsplash' && !base.backsplashSqft) {
    return { ...base, backsplashSqft: countEntry.quantity };
  }
  if (itemId === 'paint' && !base.wallPaintSqft) {
    return { ...base, wallPaintSqft: countEntry.quantity };
  }
  return base;
}

function applyRatePricingBreakdown(
  itemId,
  measurements,
  notes,
  templateKey,
  countEntry,
  allowanceEntry,
  legacyAllowance
) {
  let effectiveAllowance = allowanceEntry || legacyAllowance;
  let materialEntry = parseStoredItemQuantity(measurements, `${itemId}__material`);
  let laborEntry = parseStoredItemQuantity(measurements, `${itemId}__labor`);
  const sqft = countEntry?.quantity ?? null;

  if (!notes?.trim()) {
    if (materialEntry || laborEntry) {
      effectiveAllowance = finalizeRateAllowanceTotal(
        effectiveAllowance,
        materialEntry,
        laborEntry,
        countEntry
      );
    } else if (
      effectiveAllowance &&
      sqft != null &&
      effectiveAllowance.quantity > 0 &&
      effectiveAllowance.quantity < sqft
    ) {
      effectiveAllowance = {
        quantity: Math.round(effectiveAllowance.quantity * sqft * 100) / 100,
        unit: 'allowance',
        quantitySource: effectiveAllowance.quantitySource || QUANTITY_SOURCES.notes,
      };
    }
    return { effectiveAllowance, materialEntry, laborEntry };
  }

  const rateBreakdown = resolveItemRatePricingFromNotes(
    itemId,
    measurementsForRatePricingWithCount(measurements, itemId, countEntry),
    notes,
    { templateKey }
  );
  if (!rateBreakdown) {
    effectiveAllowance = finalizeRateAllowanceTotal(
      effectiveAllowance,
      materialEntry,
      laborEntry,
      countEntry
    );
    return { effectiveAllowance, materialEntry, laborEntry };
  }

  const storedLooksLikeUnitRate =
    effectiveAllowance &&
    sqft != null &&
    effectiveAllowance.quantity > 0 &&
    effectiveAllowance.quantity < sqft;

  const hasUserEnteredSplit =
    materialEntry?.quantitySource === QUANTITY_SOURCES.user_entered ||
    laborEntry?.quantitySource === QUANTITY_SOURCES.user_entered;
  const hasUserEnteredAllowance =
    allowanceEntry?.quantitySource === QUANTITY_SOURCES.user_entered &&
    effectiveAllowance &&
    !storedLooksLikeUnitRate;

  if (hasUserEnteredSplit || hasUserEnteredAllowance) {
    effectiveAllowance = finalizeRateAllowanceTotal(
      effectiveAllowance,
      materialEntry,
      laborEntry,
      countEntry
    );
    return { effectiveAllowance, materialEntry, laborEntry };
  }

  const shouldUseComputed =
    !effectiveAllowance ||
    storedLooksLikeUnitRate ||
    rateBreakdown.total > effectiveAllowance.quantity;

  if (!shouldUseComputed) {
    effectiveAllowance = finalizeRateAllowanceTotal(
      effectiveAllowance,
      materialEntry,
      laborEntry,
      countEntry
    );
    return { effectiveAllowance, materialEntry, laborEntry };
  }

  effectiveAllowance = {
    quantity: rateBreakdown.total,
    unit: 'allowance',
    quantitySource: QUANTITY_SOURCES.notes,
  };
  if (rateBreakdown.material != null) {
    materialEntry = {
      quantity: rateBreakdown.material,
      unit: 'allowance',
      quantitySource: QUANTITY_SOURCES.notes,
    };
  }
  if (rateBreakdown.labor != null) {
    laborEntry = {
      quantity: rateBreakdown.labor,
      unit: 'allowance',
      quantitySource: QUANTITY_SOURCES.notes,
    };
  }
  effectiveAllowance = finalizeRateAllowanceTotal(
    effectiveAllowance,
    materialEntry,
    laborEntry,
    countEntry
  );
  return { effectiveAllowance, materialEntry, laborEntry };
}

function finalizeRateAllowanceTotal(
  effectiveAllowance,
  materialEntry,
  laborEntry,
  countEntry
) {
  const sqft = countEntry?.quantity ?? null;
  const splitTotal = (materialEntry?.quantity || 0) + (laborEntry?.quantity || 0);
  const looksLikeUnitRate =
    effectiveAllowance &&
    sqft != null &&
    effectiveAllowance.quantity > 0 &&
    effectiveAllowance.quantity < sqft;
  if (
    splitTotal > 0 &&
    (!effectiveAllowance || looksLikeUnitRate || effectiveAllowance.quantity < splitTotal)
  ) {
    return {
      quantity: splitTotal,
      unit: 'allowance',
      quantitySource:
        materialEntry?.quantitySource ||
        laborEntry?.quantitySource ||
        effectiveAllowance?.quantitySource ||
        QUANTITY_SOURCES.notes,
    };
  }
  if (looksLikeUnitRate && effectiveAllowance && sqft != null) {
    return {
      quantity: Math.round(effectiveAllowance.quantity * sqft * 100) / 100,
      unit: 'allowance',
      quantitySource: effectiveAllowance.quantitySource || QUANTITY_SOURCES.notes,
    };
  }
  return effectiveAllowance;
}

function resolveDualAllowanceQuantity(itemId, rule, measurements, notes, templateKey) {
  const storedItemEntry = parseStoredItemQuantity(measurements, itemId);
  let countEntry =
    storedItemEntry && !['allowance', 'lump_sum'].includes(storedItemEntry.unit)
      ? storedItemEntry
      : null;
  if (!countEntry && rule.measurementKey && measurements[rule.measurementKey]) {
    countEntry = {
      quantity: measurements[rule.measurementKey],
      unit: measurementUnitForKey(rule.measurementKey, rule.defaultUnit),
      quantitySource: QUANTITY_SOURCES.inferred,
    };
  }
  if (!countEntry && itemId === 'floor_demo' && measurements.floorAreaSqft) {
    countEntry = {
      quantity: measurements.floorAreaSqft,
      unit: rule.defaultUnit,
      quantitySource: QUANTITY_SOURCES.inferred,
    };
  }
  if (!countEntry && Array.isArray(rule.measurementKeys)) {
    const match = rule.measurementKeys
      .map((key) =>
        measurements[key]
          ? { quantity: measurements[key], unit: measurementUnitForKey(key, rule.defaultUnit) }
          : null
      )
      .find((entry) => entry?.quantity != null && entry.quantity > 0);
    if (match) {
      countEntry = {
        quantity: match.quantity,
        unit: match.unit,
        quantitySource: QUANTITY_SOURCES.inferred,
      };
    }
  }
  const allowanceEntry = parseStoredItemQuantity(measurements, roughAllowanceSubKey(itemId));
  const legacyAllowance =
    !allowanceEntry &&
    storedItemEntry &&
    ['allowance', 'lump_sum'].includes(storedItemEntry.unit || '')
      ? storedItemEntry
      : null;

  const { effectiveAllowance, materialEntry, laborEntry } = applyRatePricingBreakdown(
    itemId,
    measurements,
    notes,
    templateKey,
    countEntry,
    allowanceEntry,
    legacyAllowance
  );

  if (!countEntry && !effectiveAllowance) return null;

  const primary = countEntry || effectiveAllowance;
  const summaryParts = [];
  if (countEntry) {
    const unitLabel =
      itemId === 'plumbing_rough'
        ? 'rough-in points'
        : countEntry.unit === 'sqft'
          ? 'sqft'
          : countEntry.unit;
    summaryParts.push(`${countEntry.quantity} ${unitLabel}`);
  }
  if (materialEntry) summaryParts.push(`$${materialEntry.quantity} material`);
  if (laborEntry) summaryParts.push(`$${laborEntry.quantity} labor`);
  if (effectiveAllowance && (materialEntry || laborEntry)) {
    summaryParts.push(`$${effectiveAllowance.quantity} total`);
  } else if (effectiveAllowance) {
    summaryParts.push(`$${effectiveAllowance.quantity} allowance`);
  }

  const quantitySource =
    allowanceEntry?.quantitySource === QUANTITY_SOURCES.notes ||
    countEntry?.quantitySource === QUANTITY_SOURCES.notes ||
    materialEntry?.quantitySource === QUANTITY_SOURCES.notes ||
    laborEntry?.quantitySource === QUANTITY_SOURCES.notes ||
    effectiveAllowance?.quantitySource === QUANTITY_SOURCES.notes
      ? QUANTITY_SOURCES.notes
      : QUANTITY_SOURCES.user_entered;

  return {
    quantity: primary.quantity,
    unit: primary.unit,
    quantitySource,
    label: itemId,
    sourceLabel:
      quantitySource === QUANTITY_SOURCES.notes
        ? sourceLabel(QUANTITY_SOURCES.notes)
        : summaryParts.join(' · '),
    rule,
    pricingReady: true,
    dualCount: countEntry,
    dualMaterial: materialEntry,
    dualLabor: laborEntry,
    dualAllowance: effectiveAllowance,
  };
}

function normalizedOverrideUnitForRule(itemId, templateKey, unit, rule) {
  if (templateKey === 'addition' && itemId === 'concrete' && unit === 'sqft') {
    return rule.defaultUnit;
  }
  return unit || rule.defaultUnit;
}

/**
 * @returns {{ quantity: number|null, unit: string, quantitySource: string, label: string, sourceLabel: string, rule: ScopeItemQuantityRule|null, pricingReady: boolean, missingMessage?: string }}
 */
function resolveQuantityForChecklistItem(itemId, ctx = {}) {
  const choiceId = ctx.choiceId || null;
  const templateKey = ctx.templateKey || null;
  let rule = getRuleForChecklistItem(itemId, templateKey);
  if (rule?.choiceIds?.length && choiceId && !rule.choiceIds.includes(choiceId)) {
    return {
      quantity: null,
      unit: rule.defaultUnit,
      quantitySource: QUANTITY_SOURCES.not_applicable,
      label: itemId,
      sourceLabel: '',
      rule,
      pricingReady: false,
    };
  }
  if (
    itemId === 'wet_area_install' &&
    choiceId &&
    ['tub', 'prefab', 'tile_pan', 'staying', 'not_in_scope', 'unsure'].includes(choiceId)
  ) {
    return {
      quantity: null,
      unit: 'each',
      quantitySource: QUANTITY_SOURCES.not_applicable,
      label: itemId,
      sourceLabel: '',
      rule: getRuleForChecklistItem(itemId, templateKey),
      pricingReady: false,
    };
  }
  const measurements = normalizeScopeMeasurements(ctx.measurements);
  const itemOverride = measurements.itemQuantities?.[itemId];

  if (rule.dualAllowanceField) {
    const dual = resolveDualAllowanceQuantity(
      itemId,
      rule,
      measurements,
      ctx.notes || '',
      templateKey
    );
    if (dual) return dual;
  }

  const linkedCountertop = resolveLinkedCountertopAllowance(itemId, measurements, ctx.notes || '');
  if (linkedCountertop) return linkedCountertop;

  if (
    itemOverride &&
    itemOverride.quantity != null &&
    itemOverride.quantity > 0 &&
    !isPlaceholderAllowancePricing(itemOverride.quantity, itemOverride.unit, itemId)
  ) {
    const unit = normalizedOverrideUnitForRule(itemId, templateKey, itemOverride.unit, rule);
    return {
      quantity: Number(itemOverride.quantity),
      unit,
      quantitySource: itemOverride.quantitySource || QUANTITY_SOURCES.user_entered,
      label: itemId,
      sourceLabel: sourceLabel(itemOverride.quantitySource || QUANTITY_SOURCES.user_entered),
      rule,
      pricingReady: isQuantityValidForPricing({ quantity: itemOverride.quantity, unit }, rule),
    };
  }

  const notes = String(ctx.notes || '');
  const packageName = ctx.packageName || itemId;
  const extracted = extractScopeQuantitiesForPackage(packageName, '', notes);
  if (extracted.length) {
    const match =
      extracted.find((q) => rule.allowedUnits.includes(q.unit)) ||
      (rule.defaultUnit === 'sqft' ? extracted.find((q) => q.unit === 'sqft') : null) ||
      (rule.defaultUnit === 'lf' ? extracted.find((q) => q.unit === 'lf') : null) ||
      (rule.defaultUnit === 'each' ? extracted.find((q) => q.unit === 'each') : null);
    if (match && rule.allowedUnits.includes(match.unit)) {
      return {
        quantity: match.quantity,
        unit: match.unit,
        quantitySource: QUANTITY_SOURCES.notes,
        label: match.label || packageName,
        sourceLabel: sourceLabel(QUANTITY_SOURCES.notes),
        rule,
        pricingReady: true,
      };
    }
  }

  if (rule.aggregateMeasurementKeys?.length) {
    const agg = sumMeasurementKeys(measurements, rule.aggregateMeasurementKeys);
    if (agg) {
      return {
        quantity: agg.quantity,
        unit: rule.defaultUnit,
        quantitySource: QUANTITY_SOURCES.inferred,
        label: packageName,
        sourceLabel: aggregatedMeasurementSourceLabel(agg.parts),
        rule,
        pricingReady: true,
      };
    }
  }

  if (rule.measurementKey && measurements[rule.measurementKey]) {
    return {
      quantity: measurements[rule.measurementKey],
      unit: measurementUnitForKey(rule.measurementKey, rule.defaultUnit),
      quantitySource: QUANTITY_SOURCES.inferred,
      label: packageName,
      sourceLabel:
        rule.measurementKey === 'bathroomFloorSqft'
          ? 'From room floor sqft'
          : sourceLabel(QUANTITY_SOURCES.inferred),
      rule,
      pricingReady: true,
    };
  }

  const altKeys = rule.measurementKeys || [];
  for (const key of altKeys) {
    if (measurements[key]) {
      return applyPricingReadyFlags(
        {
          quantity: measurements[key],
          unit: measurementUnitForKey(key, rule.defaultUnit),
          quantitySource: QUANTITY_SOURCES.inferred,
          label: packageName,
          sourceLabel: sourceLabel(QUANTITY_SOURCES.inferred),
          rule,
          pricingReady: true,
        },
        itemId,
        ctx
      );
    }
  }

  if (rule.defaultQuantity != null && !rule.requiresUserQuantity) {
    return {
      quantity: rule.defaultQuantity,
      unit: rule.defaultUnit,
      quantitySource: QUANTITY_SOURCES.default_assumption,
      label: packageName,
      sourceLabel: sourceLabel(QUANTITY_SOURCES.default_assumption),
      rule,
      pricingReady: isQuantityValidForPricing(
        { quantity: rule.defaultQuantity, unit: rule.defaultUnit },
        rule
      ),
    };
  }

  return {
    quantity: null,
    unit: rule.defaultUnit,
    quantitySource: QUANTITY_SOURCES.missing,
    label: packageName,
    sourceLabel: sourceLabel(QUANTITY_SOURCES.missing),
    rule,
    pricingReady: false,
    missingMessage: rule.missingMessage || rule.quantityHelper,
  };
}

function resolveQuantityForPackage(name, scope = '', ctx = {}) {
  const ruleKey = lookupRuleKeyForPackage(name, scope);
  if (ruleKey) {
    return resolveQuantityForChecklistItem(ruleKey, { ...ctx, packageName: name });
  }

  const notes = String(ctx.notes || '');
  const fromPkg = ctx.existingQuantities || [];
  if (fromPkg.length) {
    const q = fromPkg[0];
    return {
      quantity: q.quantity,
      unit: q.unit,
      quantitySource: q.quantitySource || QUANTITY_SOURCES.user_entered,
      label: q.label || name,
      sourceLabel: sourceLabel(q.quantitySource || QUANTITY_SOURCES.user_entered),
      rule: null,
      pricingReady: q.quantity > 0,
    };
  }

  const extracted = extractScopeQuantitiesForPackage(name, scope, notes);
  if (extracted.length) {
    const q = extracted[0];
    return {
      quantity: q.quantity,
      unit: q.unit,
      quantitySource: QUANTITY_SOURCES.notes,
      label: q.label || name,
      sourceLabel: sourceLabel(QUANTITY_SOURCES.notes),
      rule: null,
      pricingReady: q.quantity > 0,
    };
  }

  return {
    quantity: null,
    unit: 'lump_sum',
    quantitySource: QUANTITY_SOURCES.missing,
    label: name,
    sourceLabel: sourceLabel(QUANTITY_SOURCES.missing),
    rule: null,
    pricingReady: false,
  };
}

function notesExplicitlyUnpriced(itemId, notes) {
  const n = String(notes || '').toLowerCase();
  if (!/\b(?:not\s+priced(?:\s+yet|)|unpriced|no\s+pric(?:e|ing)(?:\s+yet|)|pricing\s+tbd|tbd\s+on\s+pric(?:e|ing))\b/i.test(n)) {
    return false;
  }
  const itemPatterns = {
    flooring: /\b(?:install|lvp|laminate|vinyl|carpet|flooring|floor\s+install)\b/i,
    floor_tile: /\b(?:floor\s+tile|tile\s+floor)\b/i,
  };
  const pattern = itemPatterns[itemId];
  return Boolean(pattern && pattern.test(n));
}

function applyPricingReadyFlags(resolved, itemId, ctx = {}) {
  void itemId;
  void ctx;
  return resolved;
}

function isQuantityValidForPricing(qty, rule) {
  if (!qty || qty.quantity == null || qty.quantity <= 0) return false;
  if (!rule) return true;
  if (!rule.allowedUnits.includes(qty.unit)) return false;
  if (rule.requiresUserQuantity && qty.quantitySource === QUANTITY_SOURCES.missing) return false;
  if (
    qty.unit === 'sqft' &&
    !rule.canUseRoomSqft &&
    !rule.measurementKey &&
    qty.quantitySource === QUANTITY_SOURCES.inferred
  ) {
    return false;
  }
  return true;
}

function isPricingReadyForPackage(name, scope, ctx = {}) {
  const resolved = resolveQuantityForPackage(name, scope, ctx);
  if (!resolved.pricingReady) return false;
  if (resolved.rule) {
    return isQuantityValidForPricing(
      { quantity: resolved.quantity, unit: resolved.unit, quantitySource: resolved.quantitySource },
      resolved.rule
    );
  }
  return resolved.quantity != null && resolved.quantity > 0;
}

function parsedTotalForPackage(name, scope, measurements = {}) {
  const ruleKey = lookupRuleKeyForPackage(name, scope);
  if (!ruleKey) return null;

  const itemQuantities = normalizeScopeMeasurements(measurements).itemQuantities || {};
  const direct = itemQuantities[ruleKey];
  const allowance = itemQuantities[`${ruleKey}__allowance`];
  const total = allowance?.quantity ?? direct?.quantity;
  const unit = allowance?.unit ?? direct?.unit;

  if ((unit === 'allowance' || unit === 'lump_sum') && Number(total) > 0) {
    return Number(total);
  }

  return null;
}

function selectedPricingForPackage(name, scope, measurements = {}) {
  const ruleKey = lookupRuleKeyForPackage(name, scope);
  if (!ruleKey) return null;

  const itemQuantities = normalizeScopeMeasurements(measurements).itemQuantities || {};
  const base = itemQuantities[ruleKey];
  const allowance = itemQuantities[`${ruleKey}__allowance`];
  const material = itemQuantities[`${ruleKey}__material`];
  const labor = itemQuantities[`${ruleKey}__labor`];
  const userSelected =
    base?.quantitySource === QUANTITY_SOURCES.user_entered ||
    allowance?.quantitySource === QUANTITY_SOURCES.user_entered ||
    material?.quantitySource === QUANTITY_SOURCES.user_entered ||
    labor?.quantitySource === QUANTITY_SOURCES.user_entered;
  if (!userSelected) return null;

  const materialPrice = Number(material?.quantity || 0);
  const laborPrice = Number(labor?.quantity || 0);
  const splitTotal = materialPrice + laborPrice;
  const allowanceTotal = Number(allowance?.quantity || 0);
  const baseTotal = ['allowance', 'lump_sum'].includes(base?.unit || '') ? Number(base?.quantity || 0) : 0;
  const total = allowanceTotal || baseTotal || splitTotal;
  if (!Number.isFinite(total) || total <= 0) return null;

  const basis =
    base?.quantity > 0 && base.unit && !['allowance', 'lump_sum'].includes(base.unit)
      ? { quantity: Number(base.quantity), unit: base.unit }
      : null;

  return {
    total,
    materialPrice: materialPrice > 0 ? materialPrice : null,
    laborPrice: laborPrice > 0 ? laborPrice : null,
    basis,
  };
}

function stampPackageWithCatalogRules(pkg, ctx = {}) {
  const name = pkg.name || '';
  const scope = pkg.scope || '';
  const existing = pkg.scopeQuantities || [];
  const parsedTotal = parsedTotalForPackage(name, scope, ctx.measurements);
  const selectedPricing = selectedPricingForPackage(name, scope, ctx.measurements);

  const resolved = resolveQuantityForPackage(name, scope, {
    ...ctx,
    existingQuantities: existing,
  });

  if (!resolved.pricingReady || resolved.quantity == null) {
    const kept = existing.filter((q) => q.quantity > 0);
    return kept.length ? { ...pkg, scopeQuantities: kept } : { ...pkg, scopeQuantities: undefined };
  }

  const next = {
    ...pkg,
    scopeQuantities: [
      {
        label: resolved.label || name,
        quantity: resolved.quantity,
        unit: resolved.unit,
        quantitySource: resolved.quantitySource,
      },
    ],
    quantityMeta: {
      quantitySource: resolved.quantitySource,
      sourceLabel: resolved.sourceLabel,
      pricingReady: resolved.pricingReady,
      missingMessage: resolved.missingMessage,
    },
  };

  if (selectedPricing) {
    next.price = selectedPricing.total;
    next.knownSubtotal = selectedPricing.total;
    next.calculatedSubtotal = selectedPricing.total;
    next.finalApprovedTotal = selectedPricing.total;
    next.materialPrice = selectedPricing.materialPrice;
    next.laborPrice = selectedPricing.laborPrice;
    next.priceIncludesLaborAndMaterials = Boolean(
      selectedPricing.total && !(selectedPricing.materialPrice && selectedPricing.laborPrice)
    );
    next.priceProvidedByUser = true;
    next.pricedFromSqftAllowances = false;
    next.status = 'user_provided';
    next.packageStatus = 'user_provided';
    next.pricingType = selectedPricing.materialPrice || selectedPricing.laborPrice ? 'split' : 'lump_sum';
    next.priceSource = 'user_provided';
    next.applyEligible = true;
    next.missingPriceItems = [];
    next.budgetSplitBasis = selectedPricing.basis;
    next.splitIsSuggested = false;
    return next;
  }

  const currentTotal = Number(pkg.price || pkg.knownSubtotal || pkg.calculatedSubtotal || 0);
  const splitTotal = Number(pkg.materialPrice || 0) + Number(pkg.laborPrice || 0);
  const existingSplitMatchesCurrent =
    splitTotal > 0 && currentTotal > 0 && Math.abs(splitTotal - currentTotal) < 0.01;
  const existingLooksCalculated =
    pkg.pricedFromSqftAllowances ||
    pkg.priceSource === 'calculated' ||
    pkg.status === 'calculated' ||
    pkg.packageStatus === 'calculated' ||
    pkg.priceProvidedByUser === false;
  const shouldApplyParsedTotal =
    parsedTotal &&
    !existingSplitMatchesCurrent &&
    (parsedTotal > currentTotal || existingLooksCalculated);

  if (shouldApplyParsedTotal) {
    next.price = parsedTotal;
    next.knownSubtotal = parsedTotal;
    next.calculatedSubtotal = parsedTotal;
    next.priceIncludesLaborAndMaterials = false;
    next.priceProvidedByUser = false;
    next.pricedFromSqftAllowances = true;
    next.status = 'calculated';
    next.packageStatus = 'calculated';
    next.pricingType = 'unit_rate';
    next.priceSource = 'notes';
    next.applyEligible = true;
    next.missingPriceItems = [];
  }

  return next;
}

function countPricingReadiness(packages, ctx = {}) {
  let ready = 0;
  let needsMeasurement = 0;
  for (const pkg of packages || []) {
    if (isPricingReadyForPackage(pkg.name, pkg.scope, ctx)) ready += 1;
    else needsMeasurement += 1;
  }
  return { ready, needsMeasurement, total: ready + needsMeasurement };
}

module.exports = {
  QUANTITY_SOURCES,
  CHECKLIST_ITEM_QUANTITY_RULES,
  KITCHEN_CHECKLIST_QUANTITY_RULES,
  ADDITION_CHECKLIST_QUANTITY_RULES,
  normalizeScopeMeasurements,
  getRuleForChecklistItem,
  getRuleForPackage,
  lookupRuleKeyForPackage,
  resolveQuantityForChecklistItem,
  resolveQuantityForPackage,
  isPlaceholderAllowancePricing,
  isQuantityValidForPricing,
  isPricingReadyForPackage,
  stampPackageWithCatalogRules,
  countPricingReadiness,
  sourceLabel,
};
