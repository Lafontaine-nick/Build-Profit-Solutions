/**
 * Per-scope-item quantity rules for complex jobs (bathroom remodel, etc.).
 * Room sqft must not be blindly applied to every line item.
 */

const {
  extractScopeQuantitiesForPackage,
} = require("./estimateDraftQuantityPrice");

const QUANTITY_SOURCES = {
  notes: "notes",
  user_entered: "user_entered",
  inferred: "inferred",
  default_assumption: "default_assumption",
  missing: "missing",
  not_applicable: "not_applicable",
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
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    aggregateMeasurementKeys: [
      "bathroomFloorSqft",
      "showerWallTileSqft",
      "showerFloorTileSqft",
    ],
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Sums bathroom floor + shower walls + shower floor for full tear-out.",
  },
  floor_demo: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: [
      "bathroomFloorSqft",
      "showerFloorTileSqft",
      "kitchenFloorSqft",
      "floorAreaSqft",
    ],
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: "unit_rate",
    quantityHelper: "Uses bathroom floor sqft for floor removal.",
  },
  adhesive_mastic_removal: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: ["floorDemoSqft", "floorAreaSqft"],
    canUseRoomSqft: true,
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Uses the affected removal area only; extensive adhesive, mastic, or thinset work is optional.",
    missingMessage: "Enter the affected adhesive or mastic removal sqft.",
  },
  tub_demo: {
    defaultUnit: "each",
    allowedUnits: ["each"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper: "Assuming 1 tub removal. Edit if multiple.",
  },
  shower_floor_demo: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft"],
    measurementKey: "showerFloorTileSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter shower pan / shower floor demo sqft.",
    missingMessage: "Enter shower floor demo sqft.",
  },
  shower_tile: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft"],
    measurementKey: "showerWallTileSqft",
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    dualAllowanceField: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter shower wall tile sqft — not bathroom floor sqft.",
    missingMessage: "Enter shower wall tile sqft.",
  },
  waterproofing: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft"],
    measurementKey: "showerWallTileSqft",
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Shower wall sqft — includes backer, RedGard-class membrane, vapor barrier, tape, screws, and wall-cavity insulation.",
    missingMessage: "Enter shower waterproofing sqft.",
  },
  floor_tile: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "bathroomFloorSqft",
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: "unit_rate",
    quantityHelper: "Uses bathroom floor sqft.",
  },
  shower_pan: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft"],
    measurementKey: "showerFloorTileSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Uses shower floor sqft — liner, mud bed, curb, and drain scale with pan size. Floor tile is separate.",
    missingMessage: "Enter shower floor sqft for mud pan build.",
  },
  wet_area_install: {
    defaultUnit: "each",
    allowedUnits: ["each"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper:
      "Assuming 1 tub or prefab pan. Tile pan qty is on shower floor tile.",
    choiceIds: ["tub", "prefab"],
  },
  tub_install: {
    defaultUnit: "each",
    allowedUnits: ["each"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper: "Assuming 1 tub install (labor + materials).",
  },
  prefab_shower_pan: {
    defaultUnit: "each",
    allowedUnits: ["each"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper: "Assuming 1 prefab pan install (labor + materials).",
  },
  shower_floor_tile: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft"],
    measurementKey: "showerFloorTileSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter shower floor tile sqft — not bathroom floor sqft.",
    missingMessage: "Enter shower floor tile sqft.",
  },
  shower_niche: {
    defaultUnit: "each",
    allowedUnits: ["each"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper: "Assuming 1 niche. Edit count if different.",
  },
  shower_bench: {
    defaultUnit: "each",
    allowedUnits: ["each", "lf"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper: "Assuming 1 shower bench — or enter linear feet.",
  },
  shower_bench_curb: {
    defaultUnit: "each",
    allowedUnits: ["each", "lf"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper: "Assuming 1 shower bench — or enter linear feet.",
  },
  tub_shower: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "each"],
    measurementKey: "showerWallTileSqft",
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter shower wall tile sqft if replacing tile.",
    missingMessage: "Enter shower area sqft or fixture count.",
  },
  vanity: {
    defaultUnit: "each",
    allowedUnits: ["each"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper: "Assuming 1 vanity. Edit if different.",
  },
  toilet: {
    defaultUnit: "each",
    allowedUnits: ["each"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper: "Assuming 1 toilet. Edit if different.",
  },
  plumbing_rough: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    pricingMethod: "allowance",
    quantityHelper:
      "Rough-in points = supply/drain relocations. Fixture hookup is on Toilet, Vanity, or Plumbing trim.",
    missingMessage: "Enter rough-in points and/or a dollar allowance.",
  },
  electrical_rough: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum", "hr"],
    requiresUserQuantity: true,
    dualAllowanceField: true,
    pricingMethod: "allowance",
    quantityHelper:
      "Circuits, boxes, or devices affected. Device trim and plates are on Electrical trim.",
    missingMessage: "Enter circuit/device count and/or a dollar allowance.",
  },
  lighting: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper: "Assuming 1 light fixture. Edit count if different.",
  },
  exhaust_fan: {
    defaultUnit: "each",
    allowedUnits: ["each"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper: "Assuming 1 bath fan. Edit if different.",
  },
  mirror_accessories: {
    defaultUnit: "allowance",
    allowedUnits: ["each", "allowance", "lump_sum"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "allowance",
    quantityHelper: "Assuming 1 accessories allowance.",
  },
  floor_prep: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "bathroomFloorSqft",
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: "unit_rate",
    quantityHelper: "Uses bathroom floor sqft or enter allowance.",
  },
  drywall: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "drywallSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter patch/repair sqft or use a lump sum.",
    missingMessage: "Enter drywall repair sqft or lump sum.",
  },
  paint: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "wallPaintSqft",
    measurementKeys: ["wallPaintSqft", "combinedPaintableAreaSqft"],
    dualAllowanceField: true,
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Enter paint sqft and/or calculated total from notes rates.",
    missingMessage: "Enter wall/ceiling paint sqft.",
  },
  trim: {
    defaultUnit: "lf",
    allowedUnits: ["lf", "allowance", "lump_sum"],
    measurementKey: "baseboardLf",
    canUseRoomSqft: false,
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Linear feet around bathroom perimeter.",
    missingMessage: "Enter baseboard linear feet.",
  },
  glass_door: {
    defaultUnit: "each",
    allowedUnits: ["each"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper:
      "Door count — often matches tile/prefab shower count. Edit if needed.",
  },
  plumbing_trim: {
    defaultUnit: "allowance",
    allowedUnits: ["allowance", "lump_sum"],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    pricingMethod: "allowance",
    quantityHelper: "Enter plumbing trim-out allowance for this job.",
    missingMessage: "Enter plumbing trim allowance.",
  },
  electrical_trim: {
    defaultUnit: "allowance",
    allowedUnits: ["each", "allowance", "lump_sum"],
    requiresUserQuantity: true,
    lumpSumOnly: false,
    pricingMethod: "allowance",
    quantityHelper:
      "Package trim-out allowance, or enter a trim device count. Not living SF. Detailed receptacle / switch / fixture cards own those devices instead.",
    missingMessage: "Enter electrical trim allowance.",
  },
  permits: {
    defaultUnit: "allowance",
    allowedUnits: ["allowance", "lump_sum"],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    pricingMethod: "allowance",
    quantityHelper: "Enter permit and inspection fees for this job.",
    missingMessage: "Enter permit allowance.",
  },
  cleanup: {
    defaultUnit: "lump_sum",
    allowedUnits: ["lump_sum", "allowance"],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    pricingMethod: "lump_sum",
    quantityHelper: "Enter cleanup and disposal allowance for this job.",
    missingMessage: "Enter cleanup/disposal allowance.",
  },
  appliance_removal: {
    defaultUnit: "each",
    allowedUnits: ["each", "lump_sum", "allowance"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper:
      "Assuming 1 appliance set to remove. Edit count if multiple.",
  },
  // Kitchen remodel
  wall_demo: {
    defaultUnit: "lump_sum",
    allowedUnits: ["lump_sum", "allowance", "sqft"],
    defaultQuantity: 1,
    measurementKey: "wallDemoSqft",
    requiresUserQuantity: false,
    pricingMethod: "lump_sum",
    quantityHelper: "Assuming lump sum wall/soffit demo.",
  },
  cabinets: {
    defaultUnit: "lf",
    allowedUnits: ["lf", "each", "allowance", "lump_sum"],
    measurementKey: "cabinetLf",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter cabinet run LF or lump sum.",
    missingMessage: "Enter cabinet LF or allowance.",
  },
  cabinet_hardware: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    requiresUserQuantity: true,
    pricingMethod: "each",
    quantityHelper: "Enter hardware count or allowance (pulls/knobs).",
    missingMessage: "Enter cabinet hardware count or allowance.",
  },
  countertops: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "lf", "allowance", "lump_sum"],
    measurementKey: "countertopSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter countertop sqft.",
    missingMessage: "Enter countertop sqft.",
  },
  flooring: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: [
      "flooringSqft",
      "floorAreaSqft",
      "kitchenFloorSqft",
      "bathroomFloorSqft",
    ],
    dualAllowanceField: true,
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter kitchen or room floor sqft.",
    missingMessage: "Enter floor sqft.",
  },
  flooring_lvp: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "flooringLvpSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter LVP flooring sqft.",
    missingMessage: "Enter LVP sqft.",
  },
  flooring_laminate: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "flooringLaminateSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter laminate flooring sqft.",
    missingMessage: "Enter laminate sqft.",
  },
  flooring_engineered_hardwood: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "flooringEngineeredHardwoodSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter engineered hardwood sqft.",
    missingMessage: "Enter engineered hardwood sqft.",
  },
  flooring_solid_hardwood: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "flooringSolidHardwoodSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter solid hardwood sqft.",
    missingMessage: "Enter solid hardwood sqft.",
  },
  tile_flooring: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "flooringTileSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter floor tile sqft.",
    missingMessage: "Enter floor tile sqft.",
  },
  flooring_carpet: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "flooringCarpetSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter carpet sqft.",
    missingMessage: "Enter carpet sqft.",
  },
  underlayment: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "underlaymentSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter underlayment sqft.",
    missingMessage: "Enter underlayment sqft.",
  },
  moisture_barrier: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "moistureBarrierSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter moisture barrier sqft.",
    missingMessage: "Enter moisture barrier sqft.",
  },
  transitions: {
    defaultUnit: "lf",
    allowedUnits: ["lf", "allowance", "lump_sum"],
    measurementKey: "transitionLf",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter transition and reducer LF.",
    missingMessage: "Enter transition LF.",
  },
  quarter_round: {
    defaultUnit: "lf",
    allowedUnits: ["lf", "allowance", "lump_sum"],
    measurementKey: "quarterRoundLf",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter quarter-round LF.",
    missingMessage: "Enter quarter-round LF.",
  },
  backsplash: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "lf", "allowance"],
    measurementKey: "backsplashSqft",
    dualAllowanceField: true,
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter backsplash sqft and/or calculated total from notes.",
    missingMessage: "Enter backsplash sqft.",
  },
  sink_faucet: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "each",
    quantityHelper: "Assuming 1 sink & faucet set.",
  },
  garbage_disposal: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    defaultQuantity: 1,
    requiresUserQuantity: true,
    pricingMethod: "each",
    quantityHelper:
      "Pick reuse/install or replace/install, then enter disposal count or allowance.",
    missingMessage: "Enter garbage disposal count or allowance.",
  },
  appliances: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance"],
    requiresUserQuantity: true,
    pricingMethod: "each",
    quantityHelper: "Enter appliance count or allowance.",
    missingMessage: "Enter appliance count.",
  },
  // Landscaping
  sod_turf: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: ["sodSqft"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter sod/turf sqft.",
    missingMessage: "Enter sod/turf sqft.",
  },
  artificial_turf: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "artificialTurfSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter artificial turf sqft.",
    missingMessage: "Enter artificial turf sqft.",
  },
  pavers: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: ["paverSqft", "landscapeSqft"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter paver sqft.",
    missingMessage: "Enter paver sqft.",
  },
  rock: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "cy", "ton", "allowance", "lump_sum"],
    measurementKeys: ["rockMulchSqft", "landscapeTons"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter decorative rock coverage sqft, CY, or tons.",
    missingMessage: "Enter rock quantity.",
  },
  mulch: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "cy", "ton", "allowance", "lump_sum"],
    measurementKeys: ["rockMulchSqft", "landscapeTons"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter mulch coverage sqft, CY, or tons.",
    missingMessage: "Enter mulch quantity.",
  },
  plants: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "plantCount",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter plant or shrub quantity.",
    missingMessage: "Enter plant count.",
  },
  trees: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "treeCount",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter tree quantity.",
    missingMessage: "Enter tree count.",
  },
  landscape_boulders: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "boulderCount",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter standard / medium boulder count.",
    missingMessage: "Enter boulder count.",
  },
  concrete: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "cy", "allowance", "lump_sum"],
    measurementKeys: ["concreteSqft", "concreteCy"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter concrete sqft or CY.",
    missingMessage: "Enter concrete quantity.",
  },
  excavation: {
    defaultUnit: "cy",
    allowedUnits: ["cy", "sqft", "lf", "allowance", "lump_sum"],
    measurementKey: "excavationCy",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter excavation CY, sqft, or lump sum.",
    missingMessage: "Enter excavation quantity.",
  },
  tear_off: {
    defaultUnit: "squares",
    allowedUnits: ["squares", "sqft", "lump_sum"],
    measurementKey: "roofSquares",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter roof squares or sqft from notes.",
    missingMessage: "Enter roof squares.",
  },
  shingles_roofing: {
    defaultUnit: "squares",
    allowedUnits: ["squares", "sqft", "lump_sum"],
    measurementKey: "roofSquares",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter roof squares.",
    missingMessage: "Enter roof squares.",
  },
  decking: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "lf", "allowance", "lump_sum"],
    measurementKey: "deckSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter deck surface sqft or LF.",
    missingMessage: "Enter deck sqft or LF.",
  },
  railing: {
    defaultUnit: "lf",
    allowedUnits: ["lf", "allowance", "lump_sum"],
    measurementKey: "railingLf",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter railing linear feet.",
    missingMessage: "Enter railing LF.",
  },
  pour_flatwork: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "cy", "allowance", "lump_sum"],
    measurementKeys: ["concreteSqft", "concreteCy"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter flatwork pour area in sqft.",
    missingMessage: "Enter flatwork pour area.",
  },
  pour_foundation: {
    defaultUnit: "cy",
    allowedUnits: ["cy", "allowance", "lump_sum"],
    measurementKeys: ["concreteCy", "concreteSqft"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Concrete material and placement only in CY. Excavation, forms, reinforcement, waterproofing, and structural accessories are separate.",
    missingMessage: "Enter foundation CY.",
  },
  complex_forming: {
    defaultUnit: "lf",
    allowedUnits: ["lf", "allowance", "lump_sum"],
    measurementKey: "complexFormingLf",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter additional complex forming LF.",
    missingMessage: "Enter complex forming LF.",
  },
  reinforcement: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "concreteReinforcementSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Uses flatwork pour area from Quick Measurements.",
    missingMessage: "Enter flatwork pour area.",
  },
  concrete_sealer: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "concreteSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Uses flatwork pour area for optional sealer.",
    missingMessage: "Enter flatwork pour area.",
  },
  decorative_finish: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "concreteSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Uses flatwork pour area for optional decorative finish.",
    missingMessage: "Enter flatwork pour area.",
  },
  additional_haul_off: {
    defaultUnit: "load",
    allowedUnits: ["load", "allowance", "lump_sum"],
    measurementKey: "additionalHaulOffLoadCount",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter additional disposal loads.",
    missingMessage: "Enter additional haul-off loads.",
  },
  site_prep: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "concreteSubgradePrepSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Enter affected flatwork area for basic subgrade prep / grading.",
    missingMessage: "Enter basic subgrade prep area.",
  },
  hang: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "drywallSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter drywall hang sqft.",
    missingMessage: "Enter drywall sqft.",
  },
  finish_tape: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "drywallSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter drywall finish sqft.",
    missingMessage: "Enter drywall sqft.",
  },
  texture: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "drywallSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter drywall texture or specialty-finish sqft.",
    missingMessage: "Enter texture sqft or pricing.",
  },
  patch_repair: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "drywallSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter patch/repair sqft.",
    missingMessage: "Enter drywall repair sqft.",
  },
  interior_paint: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "wallPaintSqft",
    measurementKeys: ["wallPaintSqft", "combinedPaintableAreaSqft"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter interior paint sqft.",
    missingMessage: "Enter paint sqft.",
  },
  ceiling_paint: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "ceilingPaintSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter ceiling paint sqft.",
    missingMessage: "Enter ceiling paint sqft.",
  },
  trim_paint: {
    defaultUnit: "lf",
    allowedUnits: ["lf", "allowance", "lump_sum"],
    measurementKey: "baseboardLf",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter painted trim linear feet.",
    missingMessage: "Enter painted trim LF.",
  },
  door_paint: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "interiorDoorCount",
    requiresUserQuantity: true,
    pricingMethod: "each",
    quantityHelper: "Enter interior door count.",
    missingMessage: "Enter interior door count.",
  },
  cabinet_paint: {
    defaultUnit: "lf",
    allowedUnits: ["lf", "sqft", "allowance", "lump_sum"],
    measurementKey: "cabinetRunLf",
    measurementKeys: ["cabinetRunLf", "cabinetPaintSqft"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter cabinet run LF.",
    missingMessage: "Enter cabinet run LF.",
  },
  exterior_paint: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "exteriorPaintSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter exterior paint sqft.",
    missingMessage: "Enter exterior paint sqft.",
  },
  exterior_prep: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKey: "exteriorPaintSqft",
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Uses exterior paint area for standard exterior prep.",
    missingMessage: "Enter exterior paint sqft.",
  },
};

/** Electrical Phase 1 — quantities persist, rates are not calibrated. */
const ELECTRICAL_CANONICAL_ITEM_IDS = [
  "electrical_main_panel",
  "electrical_subpanel",
  "electrical_panel_upgrade",
  "electrical_service_upgrade",
  "electrical_standard_circuit",
  "electrical_dedicated_20a",
  "electrical_circuit_30a",
  "electrical_circuit_40a",
  "electrical_circuit_50a",
  "electrical_circuit_60a_plus",
  "electrical_standard_receptacle",
  "electrical_gfci_receptacle",
  "electrical_afci_receptacle",
  "electrical_exterior_receptacle",
  "electrical_floor_receptacle",
  "electrical_usb_receptacle",
  "electrical_240v_receptacle",
  "electrical_single_pole_switch",
  "electrical_3way_switch",
  "electrical_4way_switch",
  "electrical_dimmer_switch",
  "electrical_occupancy_switch",
  "electrical_smart_switch",
  "electrical_standard_fixture",
  "electrical_recessed_light",
  "electrical_pendant_light",
  "electrical_decorative_light",
  "electrical_exterior_light",
  "electrical_undercabinet_light",
  "electrical_ceiling_fan",
  "electrical_bath_exhaust_fan",
  "electrical_range_hookup",
  "electrical_dryer_hookup",
  "electrical_dishwasher_hookup",
  "electrical_disposal_hookup",
  "electrical_microwave_hookup",
  "electrical_refrigerator_hookup",
  "electrical_water_heater_hookup",
  "electrical_hvac_hookup",
  "electrical_ev_charger_hookup",
  "electrical_smoke_detector",
  "electrical_co_detector",
  "electrical_doorbell",
  "electrical_cat6_drop",
  "electrical_tv_coax",
  "electrical_security_prewire",
  "electrical_camera_prewire",
  "electrical_device_removal",
  "electrical_fixture_removal",
  "electrical_relocate",
  "electrical_abandoned_circuit",
  "electrical_conduit",
  "electrical_trenching",
];

const ELECTRICAL_ITEM_MEASUREMENT_KEYS = {
  electrical_main_panel: "mainPanelCount",
  electrical_subpanel: "subpanelCount",
  electrical_panel_upgrade: "panelUpgradeCount",
  electrical_service_upgrade: "serviceUpgradeCount",
  electrical_standard_circuit: "standardCircuitCount",
  electrical_dedicated_20a: "dedicated20aCircuitCount",
  electrical_circuit_30a: "circuit30aCount",
  electrical_circuit_40a: "circuit40aCount",
  electrical_circuit_50a: "circuit50aCount",
  electrical_circuit_60a_plus: "circuit60aPlusCount",
  electrical_standard_receptacle: "standardReceptacleCount",
  electrical_gfci_receptacle: "gfciReceptacleCount",
  electrical_afci_receptacle: "afciReceptacleCount",
  electrical_exterior_receptacle: "exteriorReceptacleCount",
  electrical_floor_receptacle: "floorReceptacleCount",
  electrical_usb_receptacle: "usbReceptacleCount",
  electrical_240v_receptacle: "receptacle240vCount",
  electrical_single_pole_switch: "singlePoleSwitchCount",
  electrical_3way_switch: "threeWaySwitchCount",
  electrical_4way_switch: "fourWaySwitchCount",
  electrical_dimmer_switch: "dimmerSwitchCount",
  electrical_occupancy_switch: "occupancySwitchCount",
  electrical_smart_switch: "smartSwitchCount",
  electrical_standard_fixture: "standardFixtureCount",
  electrical_recessed_light: "recessedLightCount",
  electrical_pendant_light: "pendantLightCount",
  electrical_decorative_light: "decorativeLightCount",
  electrical_exterior_light: "exteriorLightCount",
  electrical_undercabinet_light: "undercabinetLightCount",
  electrical_ceiling_fan: "ceilingFanCount",
  electrical_bath_exhaust_fan: "bathExhaustFanCount",
  electrical_range_hookup: "rangeHookupCount",
  electrical_dryer_hookup: "dryerHookupCount",
  electrical_dishwasher_hookup: "dishwasherHookupCount",
  electrical_disposal_hookup: "disposalHookupCount",
  electrical_microwave_hookup: "microwaveHookupCount",
  electrical_refrigerator_hookup: "refrigeratorHookupCount",
  electrical_water_heater_hookup: "waterHeaterHookupCount",
  electrical_hvac_hookup: "hvacHookupCount",
  electrical_ev_charger_hookup: "evChargerHookupCount",
  electrical_smoke_detector: "smokeDetectorCount",
  electrical_co_detector: "coDetectorCount",
  electrical_doorbell: "doorbellCount",
  electrical_cat6_drop: "cat6DropCount",
  electrical_tv_coax: "tvCoaxCount",
  electrical_security_prewire: "securityPrewireCount",
  electrical_camera_prewire: "cameraPrewireCount",
  electrical_device_removal: "deviceRemovalCount",
  electrical_fixture_removal: "fixtureRemovalCount",
  electrical_relocate: "relocateCount",
  electrical_abandoned_circuit: "abandonedCircuitCount",
  electrical_conduit: "conduitLf",
  electrical_trenching: "trenchingLf",
};

const ELECTRICAL_LF_ITEM_IDS = new Set([
  "electrical_conduit",
  "electrical_trenching",
]);

const ELECTRICAL_CHECKLIST_QUANTITY_RULES = Object.fromEntries(
  ELECTRICAL_CANONICAL_ITEM_IDS.map((id) => [
    id,
    {
      defaultUnit: ELECTRICAL_LF_ITEM_IDS.has(id) ? "lf" : "each",
      allowedUnits: ELECTRICAL_LF_ITEM_IDS.has(id)
        ? ["lf", "allowance", "lump_sum"]
        : ["each", "allowance", "lump_sum"],
      measurementKey: ELECTRICAL_ITEM_MEASUREMENT_KEYS[id],
      requiresUserQuantity: true,
      missingMessage: "Needs pricing",
      quantityHelper: ELECTRICAL_LF_ITEM_IDS.has(id)
        ? "Enter the linear feet. A flag without LF does not invent a length."
        : "Enter the count. Pricing is not calibrated in Phase 1.",
    },
  ]),
);

/** Painting template — combined paintable area must not collapse into walls. */
const PAINTING_CHECKLIST_QUANTITY_RULES = {
  interior_paint: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.interior_paint,
    measurementKeys: ["wallPaintSqft", "combinedPaintableAreaSqft"],
  },
  paint: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.paint,
    measurementKeys: ["wallPaintSqft", "combinedPaintableAreaSqft"],
  },
  prep: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    aggregateMeasurementKeys: ["wallPaintSqft", "ceilingPaintSqft"],
    measurementKeys: ["combinedPaintableAreaSqft", "paintAreaSqft"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Uses the interior wall/ceiling or combined paintable area for prep.",
    missingMessage: "Enter paintable wall/ceiling sqft.",
  },
};

const DEFAULT_SCOPE_ITEM_RULE = {
  defaultUnit: "lump_sum",
  allowedUnits: ["lump_sum", "allowance", "each", "sqft", "lf", "cy", "hr"],
  defaultQuantity: 1,
  requiresUserQuantity: false,
  pricingMethod: "lump_sum",
  quantityHelper: "Assumed lump sum — edit if you price by unit.",
};

/** Package name patterns → checklist rule key.
 * Order matters: specific trade+action rows MUST win before broad word matchers,
 * or unrelated packages inherit the wrong qty/rates (cabinet hardware bleed class).
 */
const PACKAGE_NAME_TO_RULE_KEY = [
  { test: /\bbath(?:room)?\s+demo\b|\bdemo\b.*\bbath/i, key: "demo" },
  {
    test: /\b(carpet|lvp|laminate|vinyl|flooring|floor(?:\s+tile)?|tile\s+floor)\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,40}\b(carpet|lvp|laminate|vinyl|flooring|floor(?:\s+tile)?|tile\s+floor)\b/i,
    key: "floor_demo",
  },
  {
    test: /\b(?:floor\s+tile|tile\s+floor)\s+(?:demo|demolition|removal)\b|\bfloor\s+tile\s+demo/i,
    key: "floor_demo",
  },
  { test: /\bfloor\s+demo|\bflooring\s+demo/i, key: "floor_demo" },
  { test: /^\s*flooring\s*$/i, key: "flooring" },
  {
    test: /\b(lvp|laminate|vinyl|carpet|flooring)\b.*\b(install|installation)\b|\b(install|installation)\b.*\b(lvp|laminate|vinyl|carpet|flooring)\b/i,
    key: "flooring",
  },
  { test: /\b(lvp|laminate|vinyl)\b|\bflooring\s+install/i, key: "flooring" },
  {
    test: /\bshower\s+floor\s+tile|\btile\s+shower\s+floor/i,
    key: "shower_floor_tile",
  },
  {
    test: /\bprefab\s+shower\s+pan|\bshower\s+pan\s+install/i,
    key: "prefab_shower_pan",
  },
  { test: /\btile\s+shower\s+pan|\bmud\s+pan/i, key: "shower_pan" },
  { test: /\bshower\s+pan|\btile\s+pan/i, key: "shower_pan" },
  {
    test: /\b(tub|bathtub)\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,40}\b(tub|bathtub)\b/i,
    key: "tub_demo",
  },
  {
    test: /\btub\s+install|\btub\s+installation|\b(?:new\s+)?bathtub\s+install/i,
    key: "tub_install",
  },
  { test: /\bshower\s+niche\b/i, key: "shower_niche" },
  { test: /\bshower\s+bench\b/i, key: "shower_bench" },
  { test: /\bshower\s+curb\b/i, key: "shower_pan" },
  { test: /\bshower\s+bench\b|\bshower\s+curb\b/i, key: "shower_bench_curb" },
  {
    test: /\b(hvac|furnace|duct|mechanical)\b[^.]{0,40}\bventilation\b|\bventilation\b[^.]{0,40}\b(hvac|duct|mechanical)\b/i,
    key: "ventilation",
  },
  {
    test: /\bexhaust\s+fan\b|\bbath(?:room)?\s+fan\b|\bbath(?:room)?\s+ventilation\b/i,
    key: "exhaust_fan",
  },
  {
    test: /\bmirror\b|\btowel\s+bar\b|\bbath(?:room)?\s+accessories\b/i,
    key: "mirror_accessories",
  },
  {
    test: /\b(roof|shingle|ice\s*(?:&|and)\s*water|felt|synthetic)\b[^.]{0,40}\bunderlayment\b|\bunderlayment\b[^.]{0,40}\b(roof|shingle|ice\s*(?:&|and)\s*water)\b|\bice\s*(?:&|and)\s*water\b/i,
    key: "underlayment",
  },
  {
    test: /\bfloor\s+prep\b|\bsubfloor\b|\bfloor\s+underlayment\b/i,
    key: "floor_prep",
  },
  { test: /\bback\s*splash/i, key: "backsplash" },
  {
    test: /\bcabinet\s*hardware\b|\bhardware\b.*\b(?:pulls?|knobs?)\b|\bpulls?\s*(?:&|and|,)?\s*knobs?\b/i,
    key: "cabinet_hardware",
  },
  {
    test: /\bappliance\s*removal\b|\bremove\s+(?:existing\s+)?appliances?\b/i,
    key: "appliance_removal",
  },
  {
    test: /\bappliance\s*reinstall\b|\breinstall\b.*\bappliances?\b|\bappliances?\s*(?:&|and)?\s*hookup\b|\bappliance\s+hookup\b|\bappliances?\b/i,
    key: "appliances",
  },
  {
    test: /\bcabinet[s\s&/,]*counter.*\bdemo\b|\bdemo\b.*\bcabinets?\b|\bkitchen\s+demo\b/i,
    key: "demo",
  },
  {
    test: /\b(?:paint|painting|stain|refinish)\b[^.]{0,40}\bcabinets?\b|\bcabinets?\b[^.]{0,40}\b(?:paint|painting|stain|refinish)\b/i,
    key: "trim_paint",
  },
  {
    test: /\bkitchen\s+island\b|\bisland\b.*\bcabinet|\bcabinet\b.*\bisland\b/i,
    key: "island",
  },
  {
    test: /\bcabinets?\s*(?:&|and|\/)\s*counters?|\bcounters?\s*(?:&|and|\/)\s*cabinets?/i,
    key: "cabinets_counters",
  },
  {
    test: /(?<!after\s)(?<!before\s)\b(?:new\s+)?cabinets?\b(?!\s*hardware)/i,
    key: "cabinets",
  },
  {
    test: /\bcountertops?\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out)\b[^.]{0,40}\bcountertops?\b/i,
    key: "demo",
  },
  {
    test: /\bcounters?\b|\bcounter\s*tops?\b|\bcountertop/i,
    key: "countertops",
  },
  {
    test: /\bsink\b[^.]{0,50}\b(?:faucet|disposal)\b|\bfaucet\b[^.]{0,50}\bdisposal\b/i,
    key: "sink_faucet",
  },
  {
    test: /\b(?:cleanup|final\s+clean|jobsite\s+clean|haul[\s-]?off|dumpster|debris|trash)\b[^.]{0,50}\bdisposal\b|\bdisposal\b[^.]{0,50}\b(?:cleanup|haul|dumpster|debris|trash)\b/i,
    key: "cleanup",
  },
  { test: /\bgarbage\s+disposal\b|\bdisposals?\b/i, key: "garbage_disposal" },
  { test: /\bsink\b|\bfaucet\b|\bsink[,\s]+faucet/i, key: "sink_faucet" },
  { test: /\brock|\bgravel/i, key: "rock" },
  { test: /\bmulch\b/i, key: "mulch" },
  { test: /\bplant|\bshrub/i, key: "plants" },
  { test: /\btree\b/i, key: "trees" },
  {
    test: /\b(?:artificial|fake|synthetic)\s+(?:grass|turf)\b|\bturf\b/i,
    key: "artificial_turf",
  },
  { test: /\bsod\b|\bnatural\s+grass\b/i, key: "sod_turf" },
  { test: /\bpaver/i, key: "pavers" },
  {
    test: /\blandscap|\bsite\s+walls?\b|\bfences?\s*(?:&|and|\/)\s*gates?\b/i,
    key: "landscaping",
  },
  {
    test: /\bexterior\s+concrete\s+flatwork\b|\b(flatwork|slab\s+pour|concrete\s+patio|patio\s+concrete|driveway|sidewalk)\b/i,
    key: "pour_flatwork",
  },
  {
    test: /\bfootings?\b|\bpiers?\b|\bfoundation\s+pour\b/i,
    key: "pour_foundation",
  },
  {
    test: /\bconcrete\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out|break[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out|break[\s-]?out)\b[^.]{0,40}\bconcrete\b/i,
    key: "demo_removal",
  },
  { test: /\bconcrete\b/i, key: "concrete" },
  { test: /\bexcavat/i, key: "excavation" },
  { test: /\butility\s+trench|\btrench(?:ing)?\b/i, key: "utility_trenching" },
  { test: /\bgrading\b/i, key: "grading" },
  { test: /\bsite\s*(?:prep|work)\b/i, key: "sitework" },
  { test: /\brail(?:ing)?\b|\bguardrail\b/i, key: "railing" },
  {
    test: /\bshower\s+wall\s+tile\b|\bshower\b[^.]{0,30}\bwall\b[^.]{0,20}\btile\b|\btile\b[^.]{0,30}\bshower\s+wall\b/i,
    key: "shower_tile",
  },
  { test: /\bwaterproof|\bbacker\s+board/i, key: "waterproofing" },
  {
    test: /\btile\s*(?:&|and|\/)\s*flooring\b|\btile\s+flooring\b|\bflooring\s+tile\b/i,
    key: "tile_flooring",
  },
  {
    test: /\bbath(?:room)?\s+floor\s+tile\b|\bfloor\s+tile\b|\btile\s+floor\b/i,
    key: "floor_tile",
  },
  { test: /\bvanity\b/i, key: "vanity" },
  { test: /\btoilet\b/i, key: "toilet" },
  {
    test: /\b(framing|structural|connector|fastener|hurricane|simpson)\b[^.]{0,40}\bhardware\b|\bhardware\b[^.]{0,40}\b(connector|framing|structural|fastener)\b/i,
    key: "hardware",
  },
  { test: /\bframing\b(?!\s*hardware)|\bshell\b/i, key: "framing" },
  {
    test: /\b(deck|patio)\b[^.]{0,40}\b(demo|demolition|removal|remove|tear[\s-]?out)\b|\b(demo|demolition|removal|remove|tear[\s-]?out)\b[^.]{0,40}\b(deck|patio)\b/i,
    key: "demo_removal",
  },
  {
    test: /\b(roof|shingle)\b[^.]{0,40}\bdeck(?:ing)?\b|\bdeck(?:ing)?\b[^.]{0,40}\b(repair|replace|sheath|sheathing)\b/i,
    key: "decking_repair",
  },
  {
    test: /\bstain\b[^.]{0,40}\bdeck\b|\bseal\b[^.]{0,40}\bdeck\b|\bdeck\b[^.]{0,40}\b(stain|seal|finish)\b/i,
    key: "staining_sealing",
  },
  {
    test: /\bdeck(?:ing)?\b[^.]{0,40}\b(install|surface|boards?|composite|wood)\b|\b(?:install|build|replace)\b[^.]{0,40}\bdeck(?:ing)?\b/i,
    key: "decking",
  },
  {
    test: /\btear[\s-]?off\b|\bremove\b[^.]{0,30}\bshingles?\b/i,
    key: "tear_off",
  },
  {
    test: /\broof(?:ing)?\s*(?:\/\s*)?tie[\s-]?in\b|\btie[\s-]?in\b[^.]{0,30}\broof\b/i,
    key: "roof_tie_in",
  },
  {
    test: /\bshingles?\b[^.]{0,40}\b(install|installation|replace)\b|\broof(?:ing)?\b[^.]{0,40}\b(install|installation|replace)\b|\bshingle\b|\broof(?:ing)?\b/i,
    key: "shingles_roofing",
  },
  {
    test: /\bshower\s+door\b|\bglass\s+(?:shower\s+)?door\b|\bshower\s+enclosure\b|\bglass\s+door\b/i,
    key: "glass_door",
  },
  {
    test: /\b(?:interior|exterior|entry|patio|sliding|french)\s+doors?\b|\bwindows?\b|\bdoor\b/i,
    key: "windows_doors",
  },
  { test: /\bfooting|\bslab\b|\bfoundation\b/i, key: "foundation" },
  {
    test: /\bplumb.*\brough|\brough[\s-]?in\b.*\bplumb/i,
    key: "plumbing_rough",
  },
  {
    test: /\belectrical\s+fixtures?\b|\belectrical\s+trim\b|\bdevices?.*\bplates?\b/i,
    key: "electrical_trim",
  },
  {
    test: /\belectrical\s+rough|\brough[\s-]?in\b.*\belectrical|\bnew\s+circuits?\b/i,
    key: "electrical_rough",
  },
  { test: /\blight(?:ing)?\s+fix|\bfixture.*\blight/i, key: "lighting" },
  {
    test: /\bhang\b[^.]{0,30}\bdrywall\b|\bdrywall\b[^.]{0,30}\bhang\b/i,
    key: "hang",
  },
  {
    test: /\b(tape|mud|finish)\b[^.]{0,30}\bdrywall\b|\bdrywall\b[^.]{0,30}\b(tape|mud|finish)\b/i,
    key: "finish_tape",
  },
  {
    test: /\bpatch\b[^.]{0,30}\b(drywall|sheetrock|gypsum)\b|\b(drywall|sheetrock)\b[^.]{0,30}\bpatch\b/i,
    key: "patch_repair",
  },
  { test: /\bdrywall\b/i, key: "drywall" },
  {
    test: /\bexterior[\s-]*(?:paint|painting)\b|\b(?:paint|painting)[\s-]*exterior\b|\b(siding|stucco|soffit|fascia)\b[^.]{0,30}\b(?:paint|painting)\b/i,
    key: "exterior_paint",
  },
  {
    test: /\binterior[\s-]*(?:paint|painting)\b|\b(?:paint|painting)[\s-]*interior\b|\bceiling\b[^.]{0,20}\b(?:paint|painting)\b/i,
    key: "interior_paint",
  },
  {
    test: /\b(?:interior\s+)?doors?\s*(?:&|and)?\s*frames?\b|\bdoors?\b[^.]{0,20}\b(?:paint|painting)\b|\b(?:paint|painting)\b[^.]{0,20}\bdoors?\b/i,
    key: "door_paint",
  },
  {
    test: /\btrim\b[^.]{0,30}\b(?:paint|painting)\b|\b(?:paint|painting)\b[^.]{0,30}\btrim\b|\bbaseboards?,?\s*trim\b/i,
    key: "trim_paint",
  },
  { test: /\bpaint|\bpainting/i, key: "paint" },
  { test: /\bfinish\s+carpentry\b|\binterior\s+trim\b/i, key: "interior_trim" },
  { test: /\bbaseboard|\btrim\s+install|\btrim\s+&\s+baseboard/i, key: "trim" },
  {
    test: /\bplumb.*\btrim|\bplumbing\s+trim|\bfinal\s+plumb|\bfixture\s+hookup\b/i,
    key: "plumbing_trim",
  },
  { test: /\bplumbing\s+connections?\b/i, key: "plumbing" },
  { test: /\bpermit|\binspection/i, key: "permits" },
  {
    test: /\bcleanup\b|\bhaul[\s-]?off\b|\bdumpster\b|\bfinal\s+clean\b|\bjob\s+cleanup\b/i,
    key: "cleanup",
  },
  { test: /\bplumb(?!.*trim)/i, key: "plumbing_rough" },
];

function parseMeasurementNumber(value) {
  const n = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim(),
  );
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeScopeMeasurements(measurements = {}) {
  const bathroomFloorSqft =
    parseMeasurementNumber(measurements.bathroomFloorSqft) ??
    parseMeasurementNumber(measurements.sqft);
  const baseboardLf =
    parseMeasurementNumber(measurements.baseboardLf) ??
    parseMeasurementNumber(measurements.lf);
  const showerWallTileSqft = parseMeasurementNumber(
    measurements.showerWallTileSqft,
  );
  const showerFloorTileSqft = parseMeasurementNumber(
    measurements.showerFloorTileSqft,
  );
  const wallPaintSqft = parseMeasurementNumber(measurements.wallPaintSqft);
  const ceilingPaintSqft = parseMeasurementNumber(
    measurements.ceilingPaintSqft,
  );
  const paintAreaSqft = parseMeasurementNumber(measurements.paintAreaSqft);
  const paintPricingMethod =
    measurements.paintPricingMethod === "combined" ||
    measurements.paintPricingMethod === "separate"
      ? measurements.paintPricingMethod
      : null;
  const combinedPaintableAreaSqft =
    parseMeasurementNumber(measurements.combinedPaintableAreaSqft) ??
    (paintPricingMethod === "combined" ? paintAreaSqft : null);
  const interiorDoorCount = parseMeasurementNumber(
    measurements.interiorDoorCount,
  );
  const cabinetRunLf = parseMeasurementNumber(measurements.cabinetRunLf);
  const cabinetPaintSqft = parseMeasurementNumber(
    measurements.cabinetPaintSqft,
  );
  const kitchenFloorSqft = parseMeasurementNumber(
    measurements.kitchenFloorSqft,
  );
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
  const exteriorPaintSqft = parseMeasurementNumber(
    measurements.exteriorPaintSqft,
  );
  const deckSqft = parseMeasurementNumber(measurements.deckSqft);
  const garageSqft = parseMeasurementNumber(measurements.garageSqft);
  const railingLf = parseMeasurementNumber(measurements.railingLf);

  return {
    bathroomFloorSqft,
    baseboardLf,
    showerWallTileSqft,
    showerFloorTileSqft,
    wallPaintSqft,
    ceilingPaintSqft,
    paintAreaSqft,
    paintPricingMethod,
    combinedPaintableAreaSqft,
    interiorDoorCount,
    cabinetRunLf,
    cabinetPaintSqft,
    paintScope: Array.isArray(measurements.paintScope)
      ? measurements.paintScope
      : undefined,
    paintOccupancy: measurements.paintOccupancy || undefined,
    paintApplicationMethod: measurements.paintApplicationMethod || undefined,
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
    garageSqft,
    railingLf,
    sqft: bathroomFloorSqft,
    lf: baseboardLf,
    itemQuantities: measurements.itemQuantities || {},
    // Confirm Scope Applied totals — keep so stamp can sync M/L without a takeoff qty.
    pricingAcceptance: measurements.pricingAcceptance || undefined,
  };
}

function lookupRuleKeyForPackage(name, scope = "") {
  const nameStr = String(name || "");
  const fullBlob = `${nameStr} ${scope || ""}`;
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
    defaultUnit: "lump_sum",
    allowedUnits: ["lump_sum", "allowance", "lf"],
    defaultQuantity: 1,
    requiresUserQuantity: false,
    pricingMethod: "lump_sum",
    quantityHelper:
      "Assuming 1 cabinet/counter demo lump sum. Edit LF if priced by run.",
  },
  floor_demo: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: ["kitchenFloorSqft", "floorAreaSqft"],
    canUseRoomSqft: true,
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper: "Enter kitchen floor sqft for flooring removal.",
    missingMessage: "Enter kitchen floor demo sqft.",
  },
};

/** Bathroom shares checklist ids with kitchen — shower demo vs bath floor demo are separate lines. */
const BATHROOM_CHECKLIST_QUANTITY_RULES = {
  demo: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    aggregateMeasurementKeys: ["showerWallTileSqft", "showerFloorTileSqft"],
    canUseRoomSqft: false,
    requiresUserQuantity: false,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Sums shower wall + shower floor tile for shower tear-out (bath floor is a separate line).",
  },
  floor_demo: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: ["bathroomFloorSqft"],
    canUseRoomSqft: false,
    requiresUserQuantity: false,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Uses bathroom floor sqft — often includes thinset removal (separate from shower demo).",
    missingMessage: "Enter bathroom floor demo sqft.",
  },
  plumbing_rough: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.plumbing_rough,
    quantityHelper:
      "Shower/tub supply and drain relocation — pick access condition below. Toilet and lav rough-in are on Toilet and Vanity.",
    missingMessage:
      "Select access condition or enter shower/tub rough-in pricing.",
  },
};

const HVAC_CHECKLIST_QUANTITY_RULES = {
  hvac: {
    defaultUnit: "each",
    allowedUnits: ["each", "ton", "allowance", "lump_sum"],
    measurementKeys: ["hvacSystemCount", "hvacSystemTons"],
    requiresUserQuantity: true,
    pricingMethod: "each",
    quantityHelper:
      "Enter HVAC system count (or labeled tons) — never living SF.",
    missingMessage: "Enter HVAC system count, tons, or pricing.",
  },
  service_call: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "hvacServiceCallCount",
    requiresUserQuantity: true,
    quantityHelper: "Enter explicit HVAC service or diagnostic visit count.",
    missingMessage: "Enter HVAC service-call quantity or pricing.",
  },
  equipment_replace: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "hvacEquipmentReplacementCount",
    requiresUserQuantity: true,
    quantityHelper: "Enter documented HVAC equipment replacement count.",
    missingMessage: "Enter HVAC equipment-replacement quantity or pricing.",
  },
  refrigerant: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "hvacRefrigerantCount",
    requiresUserQuantity: true,
    quantityHelper: "Enter documented refrigerant service quantity.",
    missingMessage: "Enter refrigerant quantity or pricing.",
  },
  thermostat: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "hvacThermostatCount",
    requiresUserQuantity: true,
    quantityHelper: "Enter documented thermostat count.",
    missingMessage: "Enter thermostat quantity or pricing.",
  },
  ductwork: {
    defaultUnit: "lf",
    allowedUnits: ["lf", "allowance", "lump_sum"],
    measurementKey: "hvacDuctworkLf",
    requiresUserQuantity: true,
    quantityHelper: "Enter labeled or dimensioned HVAC ductwork LF.",
    missingMessage: "Enter ductwork LF or pricing.",
  },
  supply_registers: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "hvacSupplyRegisterCount",
    requiresUserQuantity: true,
    quantityHelper: "Enter documented supply register or diffuser count.",
    missingMessage: "Enter supply register count or pricing.",
  },
  return_grilles: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "hvacReturnGrilleCount",
    requiresUserQuantity: true,
    quantityHelper: "Enter documented return grille count.",
    missingMessage: "Enter return grille count or pricing.",
  },
  ventilation: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "hvacVentilationCount",
    requiresUserQuantity: true,
    quantityHelper:
      "ERV, HRV, or dedicated fresh-air ventilation equipment shown on the plans.",
    missingMessage: "Enter whole-house ventilation quantity or pricing.",
  },
  permits: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.permits,
    defaultUnit: "allowance",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "hvacPermitCount",
    quantityHelper: "Enter HVAC permit / inspection allowance.",
    missingMessage: "Enter HVAC permit / inspection pricing.",
  },
  cleanup: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.cleanup,
    defaultUnit: "allowance",
    allowedUnits: ["each", "allowance", "lump_sum"],
    measurementKey: "hvacCleanupCount",
    quantityHelper: "Enter HVAC cleanup / disposal allowance.",
    missingMessage: "Enter HVAC cleanup pricing.",
  },
};

function additionFloorAreaRule(
  quantityHelper,
  missingMessage = "Enter pricing basis or lump sum.",
) {
  return {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: ["floorAreaSqft"],
    pricingBasisMeasurementKey: "floorAreaSqft",
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: "unit_rate",
    quantityHelper,
    missingMessage,
  };
}

function additionAllowanceByFloorAreaRule(
  quantityHelper,
  missingMessage = "Needs pricing",
) {
  return {
    defaultUnit: "allowance",
    allowedUnits: ["allowance", "lump_sum", "sqft"],
    pricingBasisMeasurementKey: "floorAreaSqft",
    requiresUserQuantity: true,
    pricingMethod: "allowance",
    quantityHelper,
    missingMessage,
  };
}

function additionFlatAllowanceRule(
  quantityHelper,
  missingMessage = "Enter allowance.",
) {
  return {
    defaultUnit: "allowance",
    allowedUnits: ["allowance", "lump_sum"],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    pricingMethod: "allowance",
    quantityHelper,
    missingMessage,
  };
}

const ADDITION_CHECKLIST_QUANTITY_RULES = {
  plans_engineering: additionFlatAllowanceRule(
    "Enter plans and engineering allowance for this job.",
    "Enter plans/engineering allowance.",
  ),
  permits: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.permits,
    quantityHelper: "Enter permit and inspection allowance for this job.",
  },
  utility_coordination: {
    defaultUnit: "lf",
    allowedUnits: ["lf", "allowance", "lump_sum"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Enter utility coordination lump sum, or utility run LF if known.",
    missingMessage: "Enter utility coordination pricing.",
  },
  sitework: additionFloorAreaRule(
    "Enter site prep sqft, or price site prep with lump sum/material/labor.",
    "Enter site prep sqft or pricing.",
  ),
  grading: additionFloorAreaRule(
    "Finish/rough grading is usually priced by sqft; use CY for mass cut/fill.",
    "Enter grading sqft or pricing.",
  ),
  utility_trenching: {
    defaultUnit: "lf",
    allowedUnits: ["lf", "cy", "allowance", "lump_sum"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Utility trenching is usually priced by LF; use CY for trench excavation volume.",
    missingMessage: "Enter utility trenching LF or pricing.",
  },
  foundation: additionFloorAreaRule(
    "Enter foundation/slab footprint sqft, or use concrete CY on the concrete line.",
    "Enter foundation sqft or pricing.",
  ),
  concrete: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.concrete,
    defaultUnit: "cy",
    measurementKeys: ["concreteCy", "concreteSqft"],
    quantityHelper:
      "Enter foundation concrete CY, or flatwork sqft if this is slab/flatwork.",
    missingMessage: "Enter foundation concrete CY or flatwork sqft.",
  },
  framing: additionFloorAreaRule(
    "Enter framed floor area sqft, or price framing with lump sum/material/labor.",
    "Enter framing sqft or pricing.",
  ),
  roof_tie_in: additionFloorAreaRule(
    "Enter roof/tie-in area sqft, or price as a lump sum.",
    "Enter roof/tie-in sqft or pricing.",
  ),
  windows_doors: {
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum", "sqft"],
    requiresUserQuantity: true,
    pricingMethod: "each",
    quantityHelper:
      "Enter window/door count, or use lump sum/material/labor if count is unknown.",
    missingMessage: "Enter window/door count or pricing.",
  },
  trim_finish: {
    defaultUnit: "lf",
    allowedUnits: ["lf", "allowance", "lump_sum"],
    measurementKeys: [
      "trimFinishLf",
      "windowCount",
      "exteriorDoorCount",
      "slidingDoorCount",
      "interiorDoorCount",
    ],
    requiresUserQuantity: true,
    pricingMethod: "lf",
    quantityHelper:
      "Opening-specific casing and trim. Jamb extensions, stools, and aprons included where applicable. Whole-house trim and wall painting excluded.",
    missingMessage: "Select trim coverage/grade and confirm LF or pricing.",
  },
  exterior_finishes: additionFloorAreaRule(
    "Enter exterior finish area sqft, or price with lump sum/material/labor.",
    "Enter exterior finish sqft or pricing.",
  ),
  hvac: {
    ...HVAC_CHECKLIST_QUANTITY_RULES.hvac,
  },
  insulation: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: ["floorAreaSqft"],
    requiresUserQuantity: true,
    quantityHelper:
      "Enter thermal-envelope SF (exterior walls + attic − openings). Planning estimate when takeoff is missing — not drywall surface.",
    missingMessage: "Needs thermal-envelope insulation SF",
  },
  drywall: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.drywall,
    measurementKey: "drywallSqft",
    quantityHelper:
      "Enter drywall sqft, or price drywall with lump sum/material/labor.",
  },
  paint: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.paint,
    measurementKey: "wallPaintSqft",
    quantityHelper: "Enter paint sqft and/or calculated material/labor totals.",
  },
  flooring: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.flooring,
    measurementKeys: ["flooringSqft", "floorAreaSqft"],
    quantityHelper:
      "Enter flooring sqft and/or calculated material/labor totals.",
  },
  cabinets_counters: additionFlatAllowanceRule(
    "Enter cabinet and counter allowance for this job.",
    "Enter cabinet/counter allowance.",
  ),
  tile: additionFloorAreaRule(
    "Enter tile area sqft, or price tile with lump sum/material/labor.",
    "Enter tile sqft or pricing.",
  ),
  interior_trim: additionFloorAreaRule(
    "Enter trim area sqft, or use lump sum/material/labor.",
    "Enter interior trim pricing.",
  ),
  plumbing_trim: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.plumbing_trim,
  },
  electrical_trim: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.electrical_trim,
  },
  hvac_startup: additionAllowanceByFloorAreaRule(
    "Enter HVAC startup lump sum, or price by conditioned floor sqft.",
    "Enter HVAC startup pricing.",
  ),
  appliances: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.appliances,
    defaultUnit: "each",
    allowedUnits: ["each", "allowance", "lump_sum"],
    quantityHelper:
      "Enter appliance count/allowance, or material/labor totals.",
  },
  final_inspections: additionFlatAllowanceRule(
    "Enter final inspection allowance for this job.",
    "Enter final inspection allowance.",
  ),
  cleanup: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.cleanup,
    quantityHelper: "Enter cleanup and disposal allowance for this job.",
  },
  contingency: additionAllowanceByFloorAreaRule(
    "Enter contingency allowance, or budget by ADU floor sqft.",
    "Enter contingency pricing.",
  ),
};

const FLOORING_CHECKLIST_QUANTITY_RULES = {
  floor_prep: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.floor_prep,
    measurementKey: "floorPrepSqft",
    measurementKeys: ["floorPrepSqft"],
    quantityHelper: "Enter only the area requiring subfloor or floor prep.",
    missingMessage: "Enter prep area sqft.",
  },
  trim: {
    ...CHECKLIST_ITEM_QUANTITY_RULES.trim,
    measurementKey: "baseboardLf",
    quantityHelper: "Enter baseboard and trim linear feet.",
    missingMessage: "Enter baseboard/trim LF.",
  },
};

/**
 * Ground-up new construction — same living-SF basis as addition for shell/MEP/finishes,
 * with ground_up checklist ids (exterior, mep_rough, roofing, paint_trim, tile_flooring).
 */
const GROUND_UP_CHECKLIST_QUANTITY_RULES = {
  plans_engineering: ADDITION_CHECKLIST_QUANTITY_RULES.plans_engineering,
  permits: ADDITION_CHECKLIST_QUANTITY_RULES.permits,
  sitework: additionFloorAreaRule(
    "Uses living area from the plan for sitework basis — edit if needed.",
    "Enter sitework sqft or pricing.",
  ),
  foundation: additionFloorAreaRule(
    "Uses living area from the plan as slab/foundation footprint basis — edit if needed.",
    "Enter foundation sqft or pricing.",
  ),
  pour_flatwork: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "cy", "allowance", "lump_sum"],
    measurementKeys: ["concreteSqft"],
    requiresUserQuantity: true,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Enter exterior flatwork SF (driveway, walks, porch) — not house/garage slab. Local allowance when SF is unknown.",
    missingMessage:
      "Needs exterior flatwork SF (driveway / walks / porch), or use local allowance.",
  },
  framing: additionFloorAreaRule(
    "Uses living area from the plan as framed floor area — edit if needed.",
    "Enter framing sqft or pricing.",
  ),
  roofing: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "squares", "allowance", "lump_sum"],
    measurementKeys: ["roofSquares", "floorAreaSqft"],
    pricingBasisMeasurementKey: "floorAreaSqft",
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Uses roof squares when known, otherwise living area from the plan — edit if needed.",
    missingMessage: "Enter roofing sqft/squares or pricing.",
  },
  exterior: additionFloorAreaRule(
    "Uses living area from the plan as exterior finish basis — edit if needed.",
    "Enter exterior finish sqft or pricing.",
  ),
  mep_rough: additionFloorAreaRule(
    "Uses living area from the plan as MEP rough-in basis — edit if needed.",
    "Enter MEP rough-in sqft or pricing.",
  ),
  hvac: {
    ...HVAC_CHECKLIST_QUANTITY_RULES.hvac,
  },
  insulation: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: ["floorAreaSqft"],
    requiresUserQuantity: true,
    quantityHelper:
      "Planning estimate from exterior walls + conditioned attic/ceiling (thermal envelope) — not drywall living×3.5.",
    missingMessage: "Needs thermal-envelope insulation SF",
  },
  drywall: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: [
      "drywallSqft",
      "drywallWallSqft",
      "drywallCeilingSqft",
      "drywallOpeningDeductionSqft",
      "drywallGarageFireRatedSqft",
      "drywallMoistureResistantSqft",
      "drywallVaultedSlopedSqft",
      "drywallHighCeilingSqft",
      "drywallFinishLevel",
      "garageWallDrywallSqft",
      "garageCeilingDrywallSqft",
      "moistureResistantDrywallSqft",
      "fireRatedDrywallSqft",
      "specialtyDrywallSqft",
      "highCeilingDrywallSqft",
      "vaultedCeilingDrywallSqft",
      "level5FinishSqft",
      "floorAreaSqft",
    ],
    pricingBasisMeasurementKey: "floorAreaSqft",
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Uses net wall + ceiling drywall surface SF from the plan; falls back to living area only when a surface takeoff is unavailable.",
    missingMessage: "Enter drywall sqft or pricing.",
  },
  cabinets_counters: ADDITION_CHECKLIST_QUANTITY_RULES.cabinets_counters,
  tile_flooring: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: ["flooringSqft", "floorAreaSqft"],
    pricingBasisMeasurementKey: "floorAreaSqft",
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Uses flooring / living area from the plan — edit if needed.",
    missingMessage: "Enter flooring sqft or pricing.",
  },
  paint_trim: {
    defaultUnit: "sqft",
    allowedUnits: ["sqft", "allowance", "lump_sum"],
    measurementKeys: ["wallPaintSqft", "floorAreaSqft"],
    pricingBasisMeasurementKey: "floorAreaSqft",
    canUseRoomSqft: true,
    requiresUserQuantity: false,
    pricingMethod: "unit_rate",
    quantityHelper:
      "Uses paint sqft when known, otherwise living area from the plan — edit if needed.",
    missingMessage: "Enter paint/trim sqft or pricing.",
  },
  appliances: ADDITION_CHECKLIST_QUANTITY_RULES.appliances,
  utility_taps: {
    defaultUnit: "allowance",
    allowedUnits: ["allowance", "lump_sum", "each"],
    requiresUserQuantity: true,
    lumpSumOnly: true,
    pricingMethod: "allowance",
    quantityHelper: "Enter utility tap / connection allowance for this job.",
    missingMessage: "Enter utility tap pricing.",
  },
  contingency: ADDITION_CHECKLIST_QUANTITY_RULES.contingency,
  overhead_profit: additionFlatAllowanceRule(
    "Enter builder overhead & profit allowance for this job.",
    "Enter overhead & profit allowance.",
  ),
  cleanup: ADDITION_CHECKLIST_QUANTITY_RULES.cleanup,
};

function getRuleForChecklistItem(itemId, templateKey) {
  if (
    templateKey === "ground_up" &&
    GROUND_UP_CHECKLIST_QUANTITY_RULES[itemId]
  ) {
    return GROUND_UP_CHECKLIST_QUANTITY_RULES[itemId];
  }
  if (templateKey === "addition" && ADDITION_CHECKLIST_QUANTITY_RULES[itemId]) {
    return ADDITION_CHECKLIST_QUANTITY_RULES[itemId];
  }
  if (templateKey === "kitchen" && KITCHEN_CHECKLIST_QUANTITY_RULES[itemId]) {
    return KITCHEN_CHECKLIST_QUANTITY_RULES[itemId];
  }
  if (templateKey === "bathroom" && BATHROOM_CHECKLIST_QUANTITY_RULES[itemId]) {
    return BATHROOM_CHECKLIST_QUANTITY_RULES[itemId];
  }
  if (templateKey === "flooring" && FLOORING_CHECKLIST_QUANTITY_RULES[itemId]) {
    return FLOORING_CHECKLIST_QUANTITY_RULES[itemId];
  }
  if (templateKey === "painting" && PAINTING_CHECKLIST_QUANTITY_RULES[itemId]) {
    return PAINTING_CHECKLIST_QUANTITY_RULES[itemId];
  }
  if (templateKey === "hvac" && HVAC_CHECKLIST_QUANTITY_RULES[itemId]) {
    return HVAC_CHECKLIST_QUANTITY_RULES[itemId];
  }
  if (
    templateKey === "electrical" &&
    ELECTRICAL_CHECKLIST_QUANTITY_RULES[itemId]
  ) {
    return ELECTRICAL_CHECKLIST_QUANTITY_RULES[itemId];
  }
  return CHECKLIST_ITEM_QUANTITY_RULES[itemId] || DEFAULT_SCOPE_ITEM_RULE;
}

function getRuleForPackage(name, scope = "", templateKey = null) {
  const key = lookupRuleKeyForPackage(name, scope);
  return key ? getRuleForChecklistItem(key, templateKey) : null;
}

function notesHaveCombinedCabinetsCounters(notes) {
  const n = String(notes || "").toLowerCase();
  const hasCabinets = /\b(cabinets?|cabinetry)\b/.test(n);
  const hasCounters = /\b(counters?|countertops?|quartz|granite)\b/.test(n);
  return hasCabinets && hasCounters;
}

function resolveLinkedCountertopAllowance(itemId, measurements, notes) {
  if (itemId !== "countertops") return null;
  const cabinetEntry = measurements.itemQuantities?.cabinets;
  if (!cabinetEntry?.quantity || cabinetEntry.quantity <= 0) return null;
  if (!["allowance", "lump_sum"].includes(cabinetEntry.unit || "")) return null;
  if (
    !cabinetEntry.includesCountertops &&
    !notesHaveCombinedCabinetsCounters(notes)
  )
    return null;

  return {
    quantity: Number(cabinetEntry.quantity),
    unit: "allowance",
    quantitySource: QUANTITY_SOURCES.notes,
    label: "countertops",
    sourceLabel: "Combined cabinets & counters",
    rule: getRuleForChecklistItem("countertops"),
    pricingReady: true,
    linkedCabinetAllowance: true,
  };
}

function sourceLabel(source) {
  switch (source) {
    case QUANTITY_SOURCES.notes:
      return "Parsed from notes";
    case QUANTITY_SOURCES.user_entered:
      return "Entered";
    case QUANTITY_SOURCES.inferred:
      return "From room measurement";
    case QUANTITY_SOURCES.default_assumption:
      return "Assumed";
    case QUANTITY_SOURCES.missing:
      return "Needs measurement";
    default:
      return "";
  }
}

function measurementUnitForKey(key, fallbackUnit) {
  if (/Sqft$/.test(key)) return "sqft";
  if (/Lf$/.test(key)) return "lf";
  if (/Cy$/.test(key)) return "cy";
  if (/Tons$/.test(key)) return "ton";
  if (/Squares$/.test(key)) return "squares";
  if (/Count$/.test(key)) return "each";
  return fallbackUnit;
}

function isPlaceholderAllowancePricing(quantity, unit, itemId) {
  const PLACEHOLDER_ALLOWANCE_ITEM_IDS = [
    "permits",
    "cleanup",
    "plumbing_trim",
    "electrical_trim",
    "mirror_accessories",
  ];
  if (!itemId || !PLACEHOLDER_ALLOWANCE_ITEM_IDS.includes(itemId)) return false;
  if (quantity == null || !Number.isFinite(Number(quantity))) return false;
  const normalizedUnit = String(unit || "").toLowerCase();
  if (normalizedUnit !== "allowance" && normalizedUnit !== "lump_sum")
    return false;
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

function aggregatedMeasurementSourceLabel(parts, keys = []) {
  const keySet = new Set(keys);
  if (
    keySet.has("showerWallTileSqft") &&
    keySet.has("showerFloorTileSqft") &&
    !keySet.has("bathroomFloorSqft")
  ) {
    if (parts >= 2) return "Shower walls + shower floor";
    return "Shower tile tear-out";
  }
  if (
    keySet.has("bathroomFloorSqft") &&
    !keySet.has("showerWallTileSqft") &&
    !keySet.has("showerFloorTileSqft")
  ) {
    return "Bathroom floor tile";
  }
  if (parts >= 3) return "Floor + shower walls + shower floor";
  if (parts === 2) return "Combined tear-out sqft";
  return "From room measurement";
}

function roughAllowanceSubKey(itemId) {
  return `${itemId}__allowance`;
}

function parseStoredItemQuantity(measurements, key) {
  const override = measurements.itemQuantities?.[key];
  if (override && override.quantity != null && override.quantity > 0) {
    return {
      quantity: Number(override.quantity),
      unit: override.unit || "each",
      quantitySource: override.quantitySource,
    };
  }
  return null;
}

function sqftFromItemQuantities(measurements, itemId) {
  const entry = measurements.itemQuantities?.[itemId];
  if (!entry?.quantity || entry.unit !== "sqft") return undefined;
  const q = Number(entry.quantity);
  return Number.isFinite(q) && q > 0 ? q : undefined;
}

const { resolveItemRatePricingFromNotes } = require("./scopeRatePricingParser");

function measurementsForRatePricing(measurements) {
  return {
    backsplashSqft:
      measurements.backsplashSqft ??
      sqftFromItemQuantities(measurements, "backsplash"),
    wallPaintSqft:
      measurements.wallPaintSqft ??
      sqftFromItemQuantities(measurements, "paint"),
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
    garageSqft: measurements.garageSqft,
    railingLf: measurements.railingLf,
    baseboardLf: measurements.baseboardLf,
  };
}

function measurementsForRatePricingWithCount(measurements, itemId, countEntry) {
  const base = measurementsForRatePricing(measurements);
  if (!countEntry || countEntry.unit !== "sqft" || !countEntry.quantity)
    return base;
  if (itemId === "backsplash" && !base.backsplashSqft) {
    return { ...base, backsplashSqft: countEntry.quantity };
  }
  if (itemId === "paint" && !base.wallPaintSqft) {
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
  legacyAllowance,
) {
  let effectiveAllowance = allowanceEntry || legacyAllowance;
  let materialEntry = parseStoredItemQuantity(
    measurements,
    `${itemId}__material`,
  );
  let laborEntry = parseStoredItemQuantity(measurements, `${itemId}__labor`);
  const sqft = countEntry?.quantity ?? null;

  if (!notes?.trim()) {
    if (materialEntry || laborEntry) {
      effectiveAllowance = finalizeRateAllowanceTotal(
        effectiveAllowance,
        materialEntry,
        laborEntry,
        countEntry,
      );
    } else if (
      effectiveAllowance &&
      sqft != null &&
      effectiveAllowance.quantity > 0 &&
      effectiveAllowance.quantity < sqft
    ) {
      effectiveAllowance = {
        quantity: Math.round(effectiveAllowance.quantity * sqft * 100) / 100,
        unit: "allowance",
        quantitySource:
          effectiveAllowance.quantitySource || QUANTITY_SOURCES.notes,
      };
    }
    return { effectiveAllowance, materialEntry, laborEntry };
  }

  const rateBreakdown = resolveItemRatePricingFromNotes(
    itemId,
    measurementsForRatePricingWithCount(measurements, itemId, countEntry),
    notes,
    { templateKey },
  );
  if (!rateBreakdown) {
    effectiveAllowance = finalizeRateAllowanceTotal(
      effectiveAllowance,
      materialEntry,
      laborEntry,
      countEntry,
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
      countEntry,
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
      countEntry,
    );
    return { effectiveAllowance, materialEntry, laborEntry };
  }

  effectiveAllowance = {
    quantity: rateBreakdown.total,
    unit: "allowance",
    quantitySource: QUANTITY_SOURCES.notes,
  };
  if (rateBreakdown.material != null) {
    materialEntry = {
      quantity: rateBreakdown.material,
      unit: "allowance",
      quantitySource: QUANTITY_SOURCES.notes,
    };
  }
  if (rateBreakdown.labor != null) {
    laborEntry = {
      quantity: rateBreakdown.labor,
      unit: "allowance",
      quantitySource: QUANTITY_SOURCES.notes,
    };
  }
  effectiveAllowance = finalizeRateAllowanceTotal(
    effectiveAllowance,
    materialEntry,
    laborEntry,
    countEntry,
  );
  return { effectiveAllowance, materialEntry, laborEntry };
}

function finalizeRateAllowanceTotal(
  effectiveAllowance,
  materialEntry,
  laborEntry,
  countEntry,
) {
  const sqft = countEntry?.quantity ?? null;
  const splitTotal =
    (materialEntry?.quantity || 0) + (laborEntry?.quantity || 0);
  const looksLikeUnitRate =
    effectiveAllowance &&
    sqft != null &&
    effectiveAllowance.quantity > 0 &&
    effectiveAllowance.quantity < sqft;
  if (
    splitTotal > 0 &&
    (!effectiveAllowance ||
      looksLikeUnitRate ||
      effectiveAllowance.quantity < splitTotal)
  ) {
    return {
      quantity: splitTotal,
      unit: "allowance",
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
      unit: "allowance",
      quantitySource:
        effectiveAllowance.quantitySource || QUANTITY_SOURCES.notes,
    };
  }
  return effectiveAllowance;
}

function resolveDualAllowanceQuantity(
  itemId,
  rule,
  measurements,
  notes,
  templateKey,
) {
  const storedItemEntry = parseStoredItemQuantity(measurements, itemId);
  let countEntry =
    storedItemEntry && !["allowance", "lump_sum"].includes(storedItemEntry.unit)
      ? storedItemEntry
      : null;
  if (!countEntry && rule.measurementKey && measurements[rule.measurementKey]) {
    countEntry = {
      quantity: measurements[rule.measurementKey],
      unit: measurementUnitForKey(rule.measurementKey, rule.defaultUnit),
      quantitySource: QUANTITY_SOURCES.inferred,
    };
  }
  if (!countEntry && itemId === "floor_demo" && measurements.floorAreaSqft) {
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
          ? {
              quantity: measurements[key],
              unit: measurementUnitForKey(key, rule.defaultUnit),
            }
          : null,
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
  const allowanceEntry = parseStoredItemQuantity(
    measurements,
    roughAllowanceSubKey(itemId),
  );
  const legacyAllowance =
    !allowanceEntry &&
    storedItemEntry &&
    ["allowance", "lump_sum"].includes(storedItemEntry.unit || "")
      ? storedItemEntry
      : null;

  const { effectiveAllowance, materialEntry, laborEntry } =
    applyRatePricingBreakdown(
      itemId,
      measurements,
      notes,
      templateKey,
      countEntry,
      allowanceEntry,
      legacyAllowance,
    );

  if (!countEntry && !effectiveAllowance) return null;

  const primary = countEntry || effectiveAllowance;
  const summaryParts = [];
  if (countEntry) {
    const unitLabel =
      itemId === "plumbing_rough"
        ? "rough-in points"
        : countEntry.unit === "sqft"
          ? "sqft"
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
        : summaryParts.join(" · "),
    rule,
    pricingReady: true,
    dualCount: countEntry,
    dualMaterial: materialEntry,
    dualLabor: laborEntry,
    dualAllowance: effectiveAllowance,
  };
}

function normalizedOverrideUnitForRule(itemId, templateKey, unit, rule) {
  if (templateKey === "addition" && itemId === "concrete" && unit === "sqft") {
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
  if (
    rule?.choiceIds?.length &&
    choiceId &&
    !rule.choiceIds.includes(choiceId)
  ) {
    return {
      quantity: null,
      unit: rule.defaultUnit,
      quantitySource: QUANTITY_SOURCES.not_applicable,
      label: itemId,
      sourceLabel: "",
      rule,
      pricingReady: false,
    };
  }
  if (
    itemId === "wet_area_install" &&
    choiceId &&
    ["tub", "prefab", "tile_pan", "staying", "not_in_scope", "unsure"].includes(
      choiceId,
    )
  ) {
    return {
      quantity: null,
      unit: "each",
      quantitySource: QUANTITY_SOURCES.not_applicable,
      label: itemId,
      sourceLabel: "",
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
      ctx.notes || "",
      templateKey,
    );
    if (dual) return dual;
  }

  const linkedCountertop = resolveLinkedCountertopAllowance(
    itemId,
    measurements,
    ctx.notes || "",
  );
  if (linkedCountertop) return linkedCountertop;

  if (
    itemOverride &&
    itemOverride.quantity != null &&
    itemOverride.quantity > 0 &&
    !isPlaceholderAllowancePricing(
      itemOverride.quantity,
      itemOverride.unit,
      itemId,
    )
  ) {
    const unit = normalizedOverrideUnitForRule(
      itemId,
      templateKey,
      itemOverride.unit,
      rule,
    );
    return {
      quantity: Number(itemOverride.quantity),
      unit,
      quantitySource:
        itemOverride.quantitySource || QUANTITY_SOURCES.user_entered,
      label: itemId,
      sourceLabel: sourceLabel(
        itemOverride.quantitySource || QUANTITY_SOURCES.user_entered,
      ),
      rule,
      pricingReady: isQuantityValidForPricing(
        { quantity: itemOverride.quantity, unit },
        rule,
      ),
    };
  }

  const notes = String(ctx.notes || "");
  const packageName = ctx.packageName || itemId;
  const extracted =
    templateKey === "painting"
      ? []
      : extractScopeQuantitiesForPackage(packageName, "", notes);
  if (extracted.length) {
    const match =
      extracted.find((q) => rule.allowedUnits.includes(q.unit)) ||
      (rule.defaultUnit === "sqft"
        ? extracted.find((q) => q.unit === "sqft")
        : null) ||
      (rule.defaultUnit === "lf"
        ? extracted.find((q) => q.unit === "lf")
        : null) ||
      (rule.defaultUnit === "each"
        ? extracted.find((q) => q.unit === "each")
        : null);
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
        sourceLabel: aggregatedMeasurementSourceLabel(
          agg.parts,
          rule.aggregateMeasurementKeys,
        ),
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
        rule.measurementKey === "bathroomFloorSqft"
          ? "From room floor sqft"
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
        ctx,
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
        rule,
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

function resolveQuantityForPackage(name, scope = "", ctx = {}) {
  const ruleKey = ctx.checklistItemId || lookupRuleKeyForPackage(name, scope);
  if (ruleKey) {
    return resolveQuantityForChecklistItem(ruleKey, {
      ...ctx,
      packageName: name,
    });
  }

  const notes = String(ctx.notes || "");
  const fromPkg = ctx.existingQuantities || [];
  if (fromPkg.length) {
    const q = fromPkg[0];
    return {
      quantity: q.quantity,
      unit: q.unit,
      quantitySource: q.quantitySource || QUANTITY_SOURCES.user_entered,
      label: q.label || name,
      sourceLabel: sourceLabel(
        q.quantitySource || QUANTITY_SOURCES.user_entered,
      ),
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
    unit: "lump_sum",
    quantitySource: QUANTITY_SOURCES.missing,
    label: name,
    sourceLabel: sourceLabel(QUANTITY_SOURCES.missing),
    rule: null,
    pricingReady: false,
  };
}

function notesExplicitlyUnpriced(itemId, notes) {
  const n = String(notes || "").toLowerCase();
  if (
    !/\b(?:not\s+priced(?:\s+yet|)|unpriced|no\s+pric(?:e|ing)(?:\s+yet|)|pricing\s+tbd|tbd\s+on\s+pric(?:e|ing))\b/i.test(
      n,
    )
  ) {
    return false;
  }
  const itemPatterns = {
    flooring:
      /\b(?:install|lvp|laminate|vinyl|carpet|flooring|floor\s+install)\b/i,
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
  if (
    rule.requiresUserQuantity &&
    qty.quantitySource === QUANTITY_SOURCES.missing
  )
    return false;
  if (
    qty.unit === "sqft" &&
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
      {
        quantity: resolved.quantity,
        unit: resolved.unit,
        quantitySource: resolved.quantitySource,
      },
      resolved.rule,
    );
  }
  return resolved.quantity != null && resolved.quantity > 0;
}

function parsedTotalForPackage(name, scope, measurements = {}) {
  const text = `${name || ""} ${scope || ""}`;
  const ruleKey =
    lookupRuleKeyForPackage(name, scope) ||
    (/\b(?:demo|demolition|remove|removal|tear[\s-]?out)\b/i.test(text) &&
    /\b(?:tile|floor|flooring|lvp|vinyl|laminate|carpet)\b/i.test(text)
      ? "floor_demo"
      : null);
  if (!ruleKey) return null;

  const itemQuantities =
    normalizeScopeMeasurements(measurements).itemQuantities || {};
  const aliases = [ruleKey];
  if (ruleKey === "demo") aliases.push("floor_demo");
  if (ruleKey === "interior_paint") aliases.push("paint");
  if (ruleKey === "rock" || ruleKey === "mulch") aliases.push("rock_mulch");
  const direct = aliases.map((key) => itemQuantities[key]).find(Boolean);
  const allowance = aliases
    .map((key) => itemQuantities[`${key}__allowance`])
    .find(Boolean);
  const total = allowance?.quantity ?? direct?.quantity;
  const unit = allowance?.unit ?? direct?.unit;

  if ((unit === "allowance" || unit === "lump_sum") && Number(total) > 0) {
    return Number(total);
  }

  return null;
}

function selectedPricingForPackage(
  name,
  scope,
  measurements = {},
  checklistItemId = null,
) {
  const ruleKey = checklistItemId || lookupRuleKeyForPackage(name, scope);
  if (!ruleKey) return null;

  const normalized = normalizeScopeMeasurements(measurements);
  const itemQuantities = normalized.itemQuantities || {};
  const acceptance =
    normalized.pricingAcceptance?.[ruleKey] ||
    measurements.pricingAcceptance?.[ruleKey];
  const base = itemQuantities[ruleKey];
  const allowance = itemQuantities[`${ruleKey}__allowance`];
  const material = itemQuantities[`${ruleKey}__material`];
  const labor = itemQuantities[`${ruleKey}__labor`];
  const materialPrice = Number(material?.quantity || 0);
  const laborPrice = Number(labor?.quantity || 0);
  const splitTotal = materialPrice + laborPrice;
  const hasSplitLegs = Boolean(material || labor);
  const splitLegsEmpty = !(materialPrice > 0) && !(laborPrice > 0);
  const userSelected =
    base?.quantitySource === QUANTITY_SOURCES.user_entered ||
    allowance?.quantitySource === QUANTITY_SOURCES.user_entered ||
    material?.quantitySource === QUANTITY_SOURCES.user_entered ||
    labor?.quantitySource === QUANTITY_SOURCES.user_entered ||
    acceptance?.selectionStatus === "accepted" ||
    acceptance?.selectionStatus === "manual_adjusted";
  if (!userSelected) return null;

  const physicalBasis =
    base?.quantity > 0 &&
    base.unit &&
    !["allowance", "lump_sum"].includes(base.unit)
      ? { quantity: Number(base.quantity), unit: base.unit }
      : null;

  if (
    acceptance &&
    Number(acceptance.totalAmount) > 0 &&
    (acceptance.selectionStatus === "accepted" ||
      acceptance.selectionStatus === "manual_adjusted")
  ) {
    // Orphan sticky acceptance after Material/Labor wipe — do not stamp stale dollars.
    if (hasSplitLegs && splitLegsEmpty && !(splitTotal > 0)) {
      return null;
    }
    const acceptedMaterial =
      materialPrice > 0
        ? materialPrice
        : acceptance.materialAmount != null
          ? Number(acceptance.materialAmount)
          : null;
    const acceptedLabor =
      laborPrice > 0
        ? laborPrice
        : acceptance.laborAmount != null
          ? Number(acceptance.laborAmount)
          : null;
    // Prefer live Confirm Scope M+L so Step 3 totals match the split editors.
    const liveTotal =
      splitTotal > 0 ? splitTotal : Number(acceptance.totalAmount);
    return {
      total: liveTotal,
      materialPrice:
        acceptedMaterial != null && acceptedMaterial > 0
          ? acceptedMaterial
          : null,
      laborPrice:
        acceptedLabor != null && acceptedLabor > 0 ? acceptedLabor : null,
      basis: physicalBasis,
    };
  }

  const allowanceTotal = Number(allowance?.quantity || 0);
  const baseTotal = ["allowance", "lump_sum"].includes(base?.unit || "")
    ? Number(base?.quantity || 0)
    : 0;
  // Split legs present but empty → ignore orphan __allowance leftover.
  const total =
    splitTotal > 0
      ? splitTotal
      : hasSplitLegs && splitLegsEmpty
        ? 0
        : allowanceTotal || baseTotal;
  if (!Number.isFinite(total) || total <= 0) return null;

  return {
    total,
    materialPrice: materialPrice > 0 ? materialPrice : null,
    laborPrice: laborPrice > 0 ? laborPrice : null,
    basis: physicalBasis,
  };
}

function applySelectedPricingFields(pkg, selectedPricing) {
  return {
    ...pkg,
    price: selectedPricing.total,
    knownSubtotal: selectedPricing.total,
    calculatedSubtotal: selectedPricing.total,
    finalApprovedTotal: selectedPricing.total,
    materialPrice: selectedPricing.materialPrice,
    laborPrice: selectedPricing.laborPrice,
    priceIncludesLaborAndMaterials: Boolean(
      selectedPricing.total &&
      !(selectedPricing.materialPrice && selectedPricing.laborPrice),
    ),
    priceProvidedByUser: true,
    pricedFromSqftAllowances: false,
    status: "user_provided",
    packageStatus: "user_provided",
    pricingType:
      selectedPricing.materialPrice || selectedPricing.laborPrice
        ? "split"
        : "lump_sum",
    priceSource: "user_provided",
    applyEligible: true,
    missingPriceItems: [],
    budgetSplitBasis: selectedPricing.basis,
    scopeQuantities: selectedPricing.basis
      ? [
          {
            quantity: selectedPricing.basis.quantity,
            unit: selectedPricing.basis.unit,
          },
        ]
      : pkg.scopeQuantities,
    splitIsSuggested: false,
  };
}

function stampPackageWithCatalogRules(pkg, ctx = {}) {
  const name = pkg.name || "";
  const scope = pkg.scope || "";
  const existing = pkg.scopeQuantities || [];
  const parsedTotal = parsedTotalForPackage(name, scope, ctx.measurements);
  const selectedPricing = selectedPricingForPackage(
    name,
    scope,
    ctx.measurements,
    pkg.checklistItemId || null,
  );

  const resolved = resolveQuantityForPackage(name, scope, {
    ...ctx,
    existingQuantities: existing,
    checklistItemId: pkg.checklistItemId || null,
  });

  // Soft-cost / allowance scopes often have Applied M/L without a takeoff qty.
  // Still stamp Confirm Scope pricing so Step 3 stays accurate.
  if (!resolved.pricingReady || resolved.quantity == null) {
    if (selectedPricing) {
      const kept = existing.filter((q) => q.quantity > 0);
      return applySelectedPricingFields(
        {
          ...pkg,
          checklistItemId:
            pkg.checklistItemId || lookupRuleKeyForPackage(name, scope) || null,
          scopeQuantities: selectedPricing.basis
            ? [
                {
                  quantity: selectedPricing.basis.quantity,
                  unit: selectedPricing.basis.unit,
                },
              ]
            : kept.length
              ? kept
              : undefined,
        },
        selectedPricing,
      );
    }
    const kept = existing.filter((q) => q.quantity > 0);
    return kept.length
      ? { ...pkg, scopeQuantities: kept }
      : { ...pkg, scopeQuantities: undefined };
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
    return applySelectedPricingFields(next, selectedPricing);
  }

  const currentTotal = Number(
    pkg.price || pkg.knownSubtotal || pkg.calculatedSubtotal || 0,
  );
  const splitTotal =
    Number(pkg.materialPrice || 0) + Number(pkg.laborPrice || 0);
  const existingSplitMatchesCurrent =
    splitTotal > 0 &&
    currentTotal > 0 &&
    Math.abs(splitTotal - currentTotal) < 0.01;
  const existingLooksCalculated =
    pkg.pricedFromSqftAllowances ||
    pkg.priceSource === "calculated" ||
    pkg.status === "calculated" ||
    pkg.packageStatus === "calculated" ||
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
    next.status = "calculated";
    next.packageStatus = "calculated";
    next.pricingType = "unit_rate";
    next.priceSource = "notes";
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
  GROUND_UP_CHECKLIST_QUANTITY_RULES,
  HVAC_CHECKLIST_QUANTITY_RULES,
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
