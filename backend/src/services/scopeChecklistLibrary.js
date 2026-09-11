/**
 * Trade-aware scope checklists for Build with AI Confirm Scope.
 * Each project type loads its own checklist — not one universal list.
 */

const {
  notesImplyStructuralFoundation,
} = require("./foundationPlanningMeasurements");

const FIXTURE_CHOICE_OPTIONS = [
  { id: "staying", label: "Staying" },
  { id: "replacing", label: "Replacing" },
  { id: "relocating", label: "Relocating" },
  { id: "not_in_scope", label: "Not in this bid" },
  { id: "unsure", label: "Not sure yet" },
];

const FIXTURE_CHOICE_NO_RELOCATE = [
  { id: "staying", label: "Staying" },
  { id: "replacing", label: "Replacing" },
  { id: "not_in_scope", label: "Not in this bid" },
  { id: "unsure", label: "Not sure yet" },
];

const GARBAGE_DISPOSAL_CHOICE_OPTIONS = [
  { id: "reuse_install", label: "Reuse / install" },
  { id: "replace_install", label: "Replace / install" },
  { id: "not_in_scope", label: "Not in this bid" },
  { id: "unsure", label: "Not sure yet" },
];

const ROOFING_SYSTEM_OPTIONS = [
  { id: "architectural_shingles", label: "Architectural asphalt shingles" },
  {
    id: "three_tab_shingles",
    label: "3-tab asphalt shingles (review before bid)",
  },
  {
    id: "standing_seam_metal",
    label: "Standing-seam metal (review before bid)",
  },
  {
    id: "exposed_fastener_metal",
    label: "Exposed-fastener metal (review before bid)",
  },
  {
    id: "concrete_clay_tile",
    label: "Concrete / clay tile (review before bid)",
  },
  { id: "tpo", label: "TPO (review before bid)" },
  { id: "epdm", label: "EPDM (review before bid)" },
  { id: "modified_bitumen", label: "Modified bitumen (review before bid)" },
  { id: "custom_other", label: "Custom / other (PRICING_GAP)" },
];

const ROOFING_TEAR_OFF_OPTIONS = [
  { id: "new_construction", label: "New construction / no tear-off" },
  { id: "one_layer", label: "Remove 1 roofing layer" },
  { id: "two_layers", label: "Remove 2 roofing layers" },
  { id: "three_plus_custom", label: "Remove 3+ layers / custom" },
  { id: "tile_removal", label: "Tile roof removal" },
  { id: "metal_removal", label: "Metal roof removal" },
  { id: "membrane_removal", label: "Membrane roof removal" },
];

const ROOFING_REPAIR_OPTIONS = [
  { id: "no_repair", label: "No repair" },
  { id: "light_repair", label: "Light patch / shingle repair" },
  { id: "moderate_repair", label: "Moderate localized repair" },
  { id: "full_depth_repair", label: "Full-depth roofing repair" },
  {
    id: "structural_damage",
    label: "Structural / substrate damage (CUSTOM_PRICE)",
  },
];

const PLUMBING_CONNECTION_CHOICE_OPTIONS = [
  {
    id: "dishwasher_hookup",
    label: "Dishwasher replacement using existing plumbing/electrical",
  },
  {
    id: "gas_existing_shutoff",
    label: "Gas range connection to existing shutoff valve",
  },
  { id: "gas_branch_line", label: "New short gas branch line for range" },
  { id: "rough_in", label: "New plumbing rough-in point" },
  { id: "not_in_scope", label: "Not in this bid" },
  { id: "unsure", label: "Not sure yet" },
];

const ELECTRICAL_WORK_CHOICE_OPTIONS = [
  { id: "replace_outlet_switch", label: "Replace outlets or switches" },
  { id: "replace_gfci", label: "Replace or install GFCI outlets" },
  { id: "add_relocate_outlet_gfci", label: "Add or relocate outlets or GFCIs" },
  { id: "dedicated_120v", label: "Dedicated 120V appliance circuit" },
  { id: "dedicated_240v", label: "Dedicated 240V appliance circuit" },
  { id: "other_electrical", label: "Other electrical work" },
  { id: "unsure", label: "Not sure" },
];

const LIGHTING_WORK_CHOICE_OPTIONS = [
  {
    id: "standard_existing_location",
    label: "Standard fixture — existing location",
  },
  {
    id: "decorative_existing_location",
    label: "Decorative fixture / pendant — existing location",
  },
  { id: "new_recessed_led", label: "New recessed LED light" },
  {
    id: "new_location_with_wiring",
    label: "New lighting location with wiring",
  },
  { id: "not_in_scope", label: "Not in this bid" },
  { id: "unsure", label: "Not sure yet" },
];

const SHOWER_PAN_CHOICE_OPTIONS = [
  { id: "prefab", label: "Prefab pan / base" },
  { id: "tile_pan", label: "Tile shower pan" },
  { id: "not_in_scope", label: "Not in this bid" },
  { id: "unsure", label: "Not sure yet" },
];

/** Tub/shower wet area — pick one install type (not staying + pan at once). */
const WET_AREA_INSTALL_OPTIONS = [
  { id: "tub", label: "Tub install" },
  { id: "prefab", label: "Prefab shower pan / base" },
  { id: "tile_pan", label: "Tile shower pan" },
  { id: "staying", label: "Keeping existing tub/shower" },
  { id: "not_in_scope", label: "Not in this bid" },
  { id: "unsure", label: "Not sure yet" },
];

const CHECKLIST_LEGEND =
  "Yes = this work is part of your bid scope. No = not part of this bid. Not sure = we will not auto-price it.";

const CHECKLIST_TEMPLATES = {
  bathroom: {
    title: "Bathroom remodel — confirm project scope",
    intro: "Confirm what work is in this bid before pricing.",
    items: [
      {
        id: "demo",
        inputType: "yes_no",
        label: "Shower tile demo / tear-out",
        helperText:
          "Remove shower wall tile, shower base or pan (tile or prefab), and tub when present. Bathroom floor demo is a separate line.",
        category: "demo",
      },
      {
        id: "floor_demo",
        inputType: "yes_no",
        label: "Bathroom floor demo / removal",
        helperText:
          "Remove bathroom floor tile, LVP, or vinyl. Standard demo includes ordinary thinset scrape and haul-off.",
        category: "demo",
      },
      {
        id: "tub_demo",
        inputType: "yes_no",
        label: "Remove existing tub",
        helperText:
          "Demo and haul off the existing bathtub (alcove, drop-in, or freestanding).",
        category: "demo",
      },
      {
        id: "shower_floor_demo",
        inputType: "yes_no",
        label: "Remove existing tile shower pan / liner",
        helperText:
          "Demo and haul off the existing tile shower pan or liner. Shower floor tile is separate.",
        category: "demo",
      },
      {
        id: "vanity_demo",
        inputType: "yes_no",
        label: "Remove existing vanity cabinet",
        helperText:
          "Demo and haul off the existing vanity base or cabinet — not the countertop alone.",
        category: "demo",
      },
      {
        id: "fixture_demo",
        inputType: "yes_no",
        label: "Remove existing toilet & plumbing fixtures",
        helperText:
          "Remove the existing toilet and plumbing fixtures called out in the notes. Fixture removal pricing may require confirmation.",
        category: "demo",
      },
      {
        id: "countertop_demo",
        inputType: "yes_no",
        label: "Remove existing countertop",
        helperText:
          "Demo and haul off the existing vanity top, laminate, or stone counter.",
        category: "demo",
      },
      {
        id: "wet_area_install",
        inputType: "choice",
        label: "Wet area install",
        helperText:
          "What is being installed? Tub, prefab pan, or tile pan — includes labor + materials.",
        options: WET_AREA_INSTALL_OPTIONS,
        category: "shower",
      },
      {
        id: "waterproofing",
        inputType: "yes_no",
        label: "Shower waterproofing & backer board",
        helperText:
          "Backer board, RedGard-class membrane, vapor barrier, tape, screws, and wall-cavity insulation at the shower — before tile.",
        category: "shower",
      },
      {
        id: "shower_pan",
        inputType: "yes_no",
        label: "Tile shower pan (mud pan build)",
        helperText:
          "Shower pan liner, concrete/mud-bed materials, entry curb build, drain assembly, and pan labor — before floor tile.",
        category: "shower",
      },
      {
        id: "shower_tile",
        inputType: "yes_no",
        label: "Shower wall tile installation",
        helperText: "Tile labor and materials for shower walls.",
        category: "shower",
      },
      {
        id: "shower_floor_tile",
        inputType: "yes_no",
        label: "Shower floor tile installation",
        helperText:
          "Tile labor and materials for shower floor (tile pan jobs).",
        category: "shower",
      },
      {
        id: "shower_niche",
        inputType: "yes_no",
        label: "Shower niche",
        helperText: "Frame, waterproof, and tile shower niche.",
        category: "shower",
      },
      {
        id: "shower_bench",
        inputType: "yes_no",
        label: "Shower bench",
        helperText:
          "Build, waterproof, and tile a shower bench — not the shower entry curb.",
        category: "shower",
      },
      {
        id: "glass_door",
        inputType: "yes_no",
        label: "Shower doors",
        helperText:
          "Glass shower door / enclosure — material and install. Towel bars/accessories separate.",
        category: "shower",
      },
      {
        id: "floor_tile",
        inputType: "yes_no",
        label: "Bathroom floor tile installation",
        helperText: "Bathroom floor tile labor and materials (outside shower).",
        category: "bathroom_floor",
      },
      {
        id: "toilet",
        inputType: "choice",
        label: "Toilet",
        helperText: "Staying, replacing, or relocating?",
        options: FIXTURE_CHOICE_OPTIONS,
        category: "fixtures",
      },
      {
        id: "vanity",
        inputType: "choice",
        label: "Vanity & countertop",
        helperText: "Staying or replacing?",
        options: FIXTURE_CHOICE_NO_RELOCATE,
        category: "fixtures",
      },
      {
        id: "sink_faucet",
        inputType: "yes_no",
        label: "Sink & faucet",
        helperText:
          "Supply and install the vanity sink and faucet at the existing rough-in.",
        category: "fixtures",
      },
      {
        id: "lighting",
        inputType: "multi_choice",
        label: "New lighting fixtures & install",
        helperText:
          "Choose the fixture type and enter the quantity. Fixture cost and installation are included.",
        options: LIGHTING_WORK_CHOICE_OPTIONS,
        category: "fixtures",
      },
      {
        id: "exhaust_fan",
        inputType: "yes_no",
        label: "Exhaust fan / ventilation",
        helperText: "Replace or install bath fan and ducting if needed.",
        category: "fixtures",
      },
      {
        id: "mirror_accessories",
        inputType: "yes_no",
        label: "Bath accessories",
        helperText:
          "Towel bars, paper holder, hooks, or accessories — not shower doors.",
        category: "fixtures",
      },
      {
        id: "plumbing_rough",
        inputType: "yes_no",
        label: "Plumbing rough-in (shower / tub)",
        helperText:
          "Shower and tub supply/drain rough-in only. Toilet rough-in is on Toilet; lav/sink rough-in is on Vanity.",
        category: "trades",
      },
      {
        id: "electrical_rough",
        inputType: "yes_no",
        label: "Electrical work (new circuits / boxes)",
        helperText: "New circuits, boxes, wiring, or GFCI changes.",
        category: "trades",
      },
      {
        id: "floor_prep",
        inputType: "yes_no",
        label: "Subfloor / floor prep",
        helperText:
          "Leveling, patching, underlayment, or repair before flooring.",
        category: "trades",
      },
      {
        id: "paint_repair",
        inputType: "yes_no",
        label: "Interior painting/patch and repair",
        helperText:
          "Uses your Paint measurement when available — pick patchwork level, then apply pricing.",
        category: "trades",
      },
      {
        id: "trim",
        inputType: "yes_no",
        label: "Trim & baseboard install",
        helperText: "Trim/baseboard labor and materials.",
        category: "trades",
      },
      {
        id: "plumbing_trim",
        inputType: "yes_no",
        label: "Plumbing fixtures (faucets, toilet, hookups)",
        helperText:
          "Set fixtures and finish connections — trim-out, not baseboard or rough-in.",
        category: "closeout",
      },
      {
        id: "electrical_trim",
        inputType: "yes_no",
        label: "Final electrical trim (devices, plates, bulbs)",
        helperText: "Devices, plates, and bulbs.",
        category: "closeout",
      },
      {
        id: "permits",
        inputType: "yes_no",
        label: "Permits & inspections (you pull / include in bid)",
        helperText: "Permit fees and inspections in your price.",
        category: "closeout",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup, haul-off & disposal",
        helperText:
          "Final project cleaning and debris from other scopes. Flooring demolition already includes normal loading, haul-off, and disposal; additional dumpsters, excessive hauling, and hazardous-material handling are separate.",
        category: "closeout",
      },
    ],
  },

  kitchen: {
    title: "Kitchen remodel — confirm project scope",
    intro: "Confirm what work is in this bid before pricing.",
    items: [
      {
        id: "cabinet_demo",
        inputType: "yes_no",
        label: "Cabinet demo / removal",
        helperText:
          "Disconnect, remove, and haul kitchen cabinet boxes — countertop demo is a separate line.",
        category: "demo",
      },
      {
        id: "countertop_demo",
        inputType: "yes_no",
        label: "Countertop demo / removal",
        helperText:
          "Remove and haul existing countertops — cabinet demo is a separate line.",
        category: "demo",
      },
      {
        id: "backsplash_demo",
        inputType: "yes_no",
        label: "Backsplash demo / removal",
        helperText:
          "Remove existing backsplash tile and adhesive; wall repair is separate.",
        category: "demo",
      },
      {
        id: "floor_demo",
        inputType: "yes_no",
        label: "Flooring demo / removal",
        helperText: "Remove existing kitchen flooring.",
        category: "demo",
      },
      {
        id: "island_demo",
        inputType: "yes_no",
        label: "Island demo / removal",
        helperText:
          "Detach, remove, and haul one standard kitchen island cabinet/base. Countertop, appliances, utility disconnections, and floor repair are separate.",
        category: "demo",
      },
      {
        id: "appliance_removal",
        inputType: "yes_no",
        label: "Appliance removal",
        helperText: "Disconnect and remove range, dishwasher, fridge, etc.",
        category: "appliances",
      },
      {
        id: "appliances",
        inputType: "yes_no",
        label: "Appliance reinstall & hookup",
        helperText: "Reconnect and install appliances after cabinets.",
        category: "appliances",
      },
      {
        id: "cabinets",
        inputType: "yes_no",
        label: "Stock cabinet supply & installation",
        helperText:
          "Entry-level stock cabinet boxes, doors, and standard installation priced by cabinet run LF. Count upper and lower runs consistently. Vanities, countertops, demo, hardware, fillers, finished panels, crown, delivery, RTA assembly, and custom modifications are separate unless selected.",
        category: "cabinets",
      },
      {
        id: "countertops",
        inputType: "yes_no",
        label: "Countertop fabrication & install",
        helperText: "Template, fabricate, and install.",
        category: "cabinets",
      },
      {
        id: "sink_faucet",
        inputType: "yes_no",
        label: "Sink & faucet",
        helperText: "Sink and faucet supply and install at existing rough-in.",
        category: "cabinets",
      },
      {
        id: "garbage_disposal",
        inputType: "choice",
        label: "Garbage disposal",
        helperText: "Reuse/install existing disposal or replace/install new?",
        options: GARBAGE_DISPOSAL_CHOICE_OPTIONS,
        category: "cabinets",
      },
      {
        id: "cabinet_hardware",
        inputType: "yes_no",
        label: "Cabinet hardware",
        helperText: "Pulls, knobs, and install.",
        category: "cabinets",
      },
      {
        id: "island",
        inputType: "yes_no",
        label: "Island set & anchor",
        helperText:
          "Set, level, join and secure island base cabinets; install basic finished panels and toe kick. Cabinet boxes, countertop, utilities, appliances, and specialty supports are separate.",
        category: "cabinets",
      },
      {
        id: "backsplash",
        inputType: "yes_no",
        label: "Backsplash tile install",
        helperText: "Backsplash tile labor and materials.",
        category: "tile_flooring",
      },
      {
        id: "flooring",
        inputType: "yes_no",
        label: "Kitchen flooring install",
        helperText: "Floor material and install labor.",
        category: "tile_flooring",
      },
      {
        id: "floor_prep",
        inputType: "yes_no",
        label: "Subfloor / floor prep",
        helperText: "Leveling or underlayment before flooring.",
        category: "tile_flooring",
      },
      {
        id: "plumbing",
        inputType: "multi_choice",
        label: "Plumbing connections",
        helperText:
          "Choose dishwasher replacement, existing gas shutoff, new gas branch line, or new rough-in point; sink, disposal, and other appliance hookups are separate.",
        options: PLUMBING_CONNECTION_CHOICE_OPTIONS,
        category: "trades",
      },
      {
        id: "electrical",
        inputType: "multi_choice",
        label: "Electrical outlets, GFCI & circuits",
        helperText:
          "Outlets, switches, GFCI protection, relocations, and appliance circuits. Lighting fixtures are priced separately.",
        options: ELECTRICAL_WORK_CHOICE_OPTIONS,
        category: "trades",
      },
      {
        id: "lighting",
        inputType: "multi_choice",
        label: "Lighting fixtures & install",
        helperText:
          "Choose the fixture type and enter the quantity. Fixture cost and installation are included.",
        options: LIGHTING_WORK_CHOICE_OPTIONS,
        category: "trades",
      },
      {
        id: "drywall",
        inputType: "yes_no",
        label: "Drywall / patching",
        helperText: "Patch after layout changes.",
        category: "trades",
      },
      {
        id: "paint",
        inputType: "yes_no",
        label: "Interior painting",
        helperText: "Prep, labor, and paint.",
        category: "trades",
      },
      {
        id: "trim",
        inputType: "yes_no",
        label: "Trim & baseboard",
        helperText: "Trim install labor and materials.",
        category: "trades",
      },
      {
        id: "walls_moving",
        inputType: "multi_choice",
        label: "Wall layout changes",
        helperText:
          "Select all that apply — you can remove and add walls on the same job.",
        options: [
          { id: "remove", label: "Removing wall(s)" },
          { id: "add", label: "Adding / moving wall(s)" },
          { id: "no_changes", label: "No wall changes" },
          { id: "not_in_scope", label: "Not in this bid" },
          { id: "unsure", label: "Not sure yet" },
        ],
        category: "trades",
      },
      {
        id: "permits",
        inputType: "yes_no",
        label: "Permits & inspections",
        helperText: "Permit fees if included in bid.",
        category: "closeout",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup, haul-off & disposal",
        helperText: "Final clean and haul-off.",
        category: "closeout",
      },
    ],
  },

  flooring: {
    title: "Flooring — confirm project scope",
    intro: "Confirm flooring scope before pricing.",
    items: [
      {
        id: "floor_demo",
        inputType: "yes_no",
        label: "Demo Existing Flooring",
        helperText:
          "Removes existing flooring and bulk setting material, then cleans the exposed substrate. Includes protection, haul-off, and disposal. Extra residual grinding, patching, skim coating, and leveling are separate under floor prep.",
        category: "demo",
      },
      {
        id: "flooring",
        inputType: "yes_no",
        label: "New flooring",
        helperText:
          "New flooring material and installation labor when the product type is not yet specified.",
        category: "flooring",
      },
      {
        id: "flooring_lvp",
        inputType: "yes_no",
        label: "LVP",
        helperText: "Luxury vinyl plank material and standard installation.",
        category: "flooring",
      },
      {
        id: "flooring_laminate",
        inputType: "yes_no",
        label: "Laminate",
        helperText: "Laminate flooring material and standard installation.",
        category: "flooring",
      },
      {
        id: "flooring_engineered_hardwood",
        inputType: "yes_no",
        label: "Engineered hardwood",
        helperText: "Engineered hardwood material and standard installation.",
        category: "flooring",
      },
      {
        id: "flooring_solid_hardwood",
        inputType: "yes_no",
        label: "Solid hardwood",
        helperText:
          "Solid hardwood material and standard installation. Refinishing is separate.",
        category: "flooring",
      },
      {
        id: "tile_flooring",
        inputType: "yes_no",
        label: "Tile",
        helperText:
          "Floor tile material and standard installation. Specialty patterns and stone upgrades are separate.",
        category: "flooring",
      },
      {
        id: "flooring_carpet",
        inputType: "yes_no",
        label: "Carpet",
        helperText: "Carpet material, pad, seams, and standard installation.",
        category: "flooring",
      },
      {
        id: "floor_prep",
        inputType: "yes_no",
        label: "Subfloor / floor prep",
        helperText:
          "Extra substrate work after demo and cleaning — residual adhesive/thinset grinding, patching, skim coating, or leveling required for the new floor. Ordinary demo cleanup is not included here.",
        category: "flooring",
      },
      {
        id: "underlayment",
        inputType: "yes_no",
        label: "Underlayment",
        helperText:
          "Underlayment material and installation beneath the selected flooring.",
        category: "flooring",
      },
      {
        id: "moisture_barrier",
        inputType: "yes_no",
        label: "Moisture barrier",
        helperText: "Moisture mitigation or vapor barrier beneath flooring.",
        category: "flooring",
      },
      {
        id: "trim",
        inputType: "yes_no",
        label: "Trim & baseboard install",
        helperText: "Trim/baseboard labor and materials.",
        category: "trim",
      },
      {
        id: "transitions",
        inputType: "yes_no",
        label: "Transitions & reducers",
        helperText:
          "Transition strips, reducers, thresholds, and related installation.",
        category: "trim",
      },
      {
        id: "quarter_round",
        inputType: "yes_no",
        label: "Quarter round",
        helperText: "Quarter-round material and installation.",
        category: "trim",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup & disposal",
        helperText: "Final clean, debris haul-off, dump fees.",
        category: "closeout",
      },
    ],
  },

  landscaping: {
    title: "Landscaping — confirm project scope",
    intro: "Confirm landscaping scope before pricing.",
    items: [
      {
        id: "demo_clearing",
        inputType: "yes_no",
        label: "Demo / clearing",
        category: "sitework",
      },
      {
        id: "grading",
        inputType: "yes_no",
        label: "Grading",
        category: "sitework",
      },
      {
        id: "soil_prep",
        inputType: "yes_no",
        label: "Soil prep",
        category: "sitework",
      },
      {
        id: "irrigation",
        inputType: "yes_no",
        label: "Irrigation",
        category: "landscape",
      },
      {
        id: "sod_turf",
        inputType: "yes_no",
        label: "Sod",
        category: "landscape",
      },
      {
        id: "artificial_turf",
        inputType: "yes_no",
        label: "Artificial turf",
        category: "landscape",
      },
      {
        id: "rock",
        inputType: "yes_no",
        label: "Decorative rock",
        category: "landscape",
      },
      {
        id: "mulch",
        inputType: "yes_no",
        label: "Mulch",
        category: "landscape",
      },
      {
        id: "plants",
        inputType: "yes_no",
        label: "Plants / shrubs",
        category: "landscape",
      },
      {
        id: "trees",
        inputType: "yes_no",
        label: "Trees",
        category: "landscape",
      },
      {
        id: "landscape_boulders",
        inputType: "yes_no",
        label: "Decorative boulders",
        category: "landscape",
      },
      {
        id: "pavers",
        inputType: "yes_no",
        label: "Pavers",
        category: "hardscape",
      },
      {
        id: "concrete",
        inputType: "yes_no",
        label: "Concrete flatwork",
        category: "hardscape",
      },
      {
        id: "drainage",
        inputType: "yes_no",
        label: "Drainage",
        category: "sitework",
      },
      {
        id: "landscape_lighting",
        inputType: "yes_no",
        label: "Landscape lighting",
        category: "electrical",
      },
      {
        id: "mobilization",
        inputType: "yes_no",
        label: "Equipment / mobilization",
        category: "soft_costs",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup, haul-off & disposal",
        category: "closeout",
      },
    ],
  },

  plumbing_service: {
    title: "Plumbing service — confirm scope",
    intro: "Confirm plumbing service scope before pricing.",
    items: [
      {
        id: "service_call",
        inputType: "yes_no",
        label: "Service call / diagnosis",
        category: "service",
      },
      {
        id: "fixture_repair",
        inputType: "yes_no",
        label: "Fixture repair",
        category: "service",
      },
      {
        id: "fixture_replace",
        inputType: "yes_no",
        label: "Fixture replacement",
        category: "service",
      },
      {
        id: "drain_cleaning",
        inputType: "yes_no",
        label: "Drain cleaning",
        category: "service",
      },
      {
        id: "water_line",
        inputType: "yes_no",
        label: "Water line repair",
        category: "service",
      },
      {
        id: "sewer_line",
        inputType: "yes_no",
        label: "Sewer line repair",
        category: "service",
      },
      {
        id: "plumbing_rough",
        inputType: "yes_no",
        label: "Rough-in",
        category: "service",
      },
      {
        id: "plumbing_trim",
        inputType: "yes_no",
        label: "Trim-out",
        category: "service",
      },
      {
        id: "parts_materials",
        inputType: "yes_no",
        label: "Parts / materials",
        category: "service",
      },
      {
        id: "emergency_fee",
        inputType: "yes_no",
        label: "Emergency / after-hours fee",
        category: "soft_costs",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup & disposal",
        category: "closeout",
      },
    ],
  },

  framing: {
    title: "Framing — confirm project scope",
    intro: "Confirm framing scope before pricing.",
    items: [
      {
        id: "layout",
        inputType: "yes_no",
        label: "Layout",
        category: "framing",
      },
      {
        id: "wall_framing",
        inputType: "yes_no",
        label: "Wall framing",
        category: "framing",
      },
      {
        id: "openings",
        inputType: "yes_no",
        label: "Door / window openings",
        category: "framing",
      },
      {
        id: "blocking",
        inputType: "yes_no",
        label: "Blocking / backing",
        category: "framing",
      },
      {
        id: "shear_sheathing",
        inputType: "yes_no",
        label: "Shear / sheathing",
        category: "framing",
      },
      {
        id: "hardware",
        inputType: "yes_no",
        label: "Hardware / connectors",
        category: "framing",
      },
      {
        id: "materials_package",
        inputType: "yes_no",
        label: "Material package",
        category: "framing",
      },
      {
        id: "labor",
        inputType: "yes_no",
        label: "Framing labor",
        category: "framing",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup & disposal",
        category: "closeout",
      },
    ],
  },

  roofing: {
    title: "Roofing — confirm project scope",
    intro: "Confirm roofing scope before pricing.",
    items: [
      {
        id: "roofing_system",
        inputType: "choice",
        label: "Roofing system",
        helperText:
          "Select exactly one primary roofing system. Unsupported systems remain PRICING_GAP.",
        options: ROOFING_SYSTEM_OPTIONS,
        category: "roof_system",
      },
      {
        id: "tear_off",
        inputType: "choice",
        label: "Existing roof / tear-off",
        helperText:
          "Tear-off is a separate add-on priced only from roof squares when supported.",
        options: ROOFING_TEAR_OFF_OPTIONS,
        category: "tear_off",
      },
      {
        id: "decking_repair",
        inputType: "yes_no",
        label: "Decking repair / replace",
        helperText:
          "Enter roof decking replacement sqft; $4.00/sqft planning rate with a $300 small-job minimum.",
        category: "roof",
      },
      {
        id: "underlayment",
        inputType: "yes_no",
        label: "Premium / synthetic underlayment upgrade",
        helperText:
          "Incremental upgrade above the standard underlayment included in supported base systems.",
        category: "roof",
      },
      {
        id: "ice_water_shield",
        inputType: "yes_no",
        label: "Ice & water shield",
        helperText:
          "Localized self-adhered waterproofing membrane for explicitly measured roofing protection areas.",
        category: "roof",
      },
      {
        id: "shingles_roofing",
        inputType: "yes_no",
        label: "Shingles / roofing install",
        helperText: "Main roofing material and labor.",
        category: "roof",
      },
      {
        id: "drip_edge",
        inputType: "yes_no",
        label: "Drip edge",
        helperText: "Enter drip-edge LF; $4.00/LF planning rate.",
        category: "flashing",
      },
      {
        id: "ridge_cap",
        inputType: "yes_no",
        label: "Ridge cap",
        helperText: "Enter ridge-cap LF; $7.00/LF planning rate.",
        category: "flashing",
      },
      {
        id: "valley_flashing",
        inputType: "yes_no",
        label: "Valley flashing",
        helperText: "Enter valley flashing LF; $10.00/LF planning rate.",
        category: "flashing",
      },
      {
        id: "step_flashing",
        inputType: "yes_no",
        label: "Step flashing",
        helperText: "Enter step flashing LF; $12.00/LF planning rate.",
        category: "flashing",
      },
      {
        id: "wall_flashing",
        inputType: "yes_no",
        label: "Wall flashing",
        helperText: "Enter wall flashing LF; $10.00/LF planning rate.",
        category: "flashing",
      },
      {
        id: "ridge_vent",
        inputType: "yes_no",
        label: "Ridge vent",
        helperText: "Enter ridge vent EA; $12.00/EA planning rate.",
        category: "ventilation",
      },
      {
        id: "roof_vents",
        inputType: "yes_no",
        label: "Standard roof vents",
        helperText: "Enter standard roof vent EA; $225.00/EA planning rate.",
        category: "ventilation",
      },
      {
        id: "turbine_vents",
        inputType: "yes_no",
        label: "Turbine vents",
        helperText: "Enter turbine vent EA; $350.00/EA planning rate.",
        category: "ventilation",
      },
      {
        id: "pipe_boots",
        inputType: "yes_no",
        label: "Pipe boots",
        helperText: "Enter pipe boot EA; $175.00/EA planning rate.",
        category: "penetrations",
      },
      {
        id: "chimney_flashing",
        inputType: "yes_no",
        label: "Chimney flashing",
        helperText: "Enter chimney flashing EA; $650.00/EA planning rate.",
        category: "penetrations",
      },
      {
        id: "skylight_flashing",
        inputType: "yes_no",
        label: "Skylight flashing",
        helperText: "Enter skylight flashing EA; $500.00/EA planning rate.",
        category: "penetrations",
      },
      {
        id: "roof_penetrations",
        inputType: "yes_no",
        label: "Other roof penetrations",
        helperText: "Enter penetration EA; $200.00/EA planning rate.",
        category: "penetrations",
      },
      {
        id: "roof_pitch_complexity_access",
        inputType: "yes_no",
        label: "Pitch / complexity / access confirmation",
        helperText: "Confirm conditions; no premium is applied in this phase.",
        category: "confirmation",
      },
      {
        id: "roof_repairs",
        inputType: "choice",
        label: "Roof repairs",
        helperText: "Separate repair scope; do not use total replacement area.",
        options: ROOFING_REPAIR_OPTIONS,
        category: "repair",
      },
      {
        id: "roof_exclusions",
        inputType: "yes_no",
        label: "Exclusions / special confirmations",
        helperText:
          "Structural, hazardous, solar, crane, permit, and specialty conditions.",
        category: "confirmation",
      },
      {
        id: "gutters",
        inputType: "yes_no",
        label: "Gutters",
        helperText:
          "Standard seamless aluminum K-style gutter runs priced by LF.",
        category: "drainage",
      },
      {
        id: "downspouts",
        inputType: "yes_no",
        label: "Downspouts",
        helperText: "Standard aluminum downspout drops priced by each.",
        category: "drainage",
      },
      {
        id: "permits",
        inputType: "yes_no",
        label: "Permits & inspections",
        category: "closeout",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup, haul-off & disposal",
        category: "closeout",
      },
    ],
  },

  hvac: {
    title: "HVAC — confirm project scope",
    intro: "Confirm HVAC scope before pricing.",
    items: [
      {
        id: "service_call",
        inputType: "yes_no",
        label: "Service call / diagnosis",
        category: "service",
      },
      {
        id: "equipment_replace",
        inputType: "yes_no",
        label: "Equipment replacement (furnace / AC / heat pump)",
        category: "equipment",
      },
      {
        id: "ductwork",
        inputType: "yes_no",
        label: "Ductwork (new / modify / seal)",
        category: "distribution",
      },
      {
        id: "ventilation",
        inputType: "yes_no",
        label: "Ventilation / exhaust",
        category: "distribution",
      },
      {
        id: "refrigerant",
        inputType: "yes_no",
        label: "Refrigerant / line set",
        category: "equipment",
      },
      {
        id: "thermostat",
        inputType: "yes_no",
        label: "Thermostat / controls",
        category: "equipment",
      },
      {
        id: "permits",
        inputType: "yes_no",
        label: "Permits & inspections",
        category: "closeout",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup & disposal",
        category: "closeout",
      },
    ],
  },

  deck_patio: {
    title: "Deck & patio — confirm project scope",
    intro: "Confirm deck or patio scope before pricing.",
    items: [
      {
        id: "demo_removal",
        inputType: "yes_no",
        label: "Demo / removal of existing deck or patio",
        category: "demo",
      },
      {
        id: "footings_piers",
        inputType: "yes_no",
        label: "Footings / piers / posts",
        category: "structure",
      },
      {
        id: "framing_structure",
        inputType: "yes_no",
        label: "Framing / structure",
        category: "structure",
      },
      {
        id: "decking",
        inputType: "yes_no",
        label: "Decking / surface install",
        category: "surface",
      },
      {
        id: "railing",
        inputType: "yes_no",
        label: "Railing / guardrails",
        category: "surface",
      },
      {
        id: "stairs",
        inputType: "yes_no",
        label: "Stairs / steps",
        category: "surface",
      },
      {
        id: "staining_sealing",
        inputType: "yes_no",
        label: "Stain / seal / finish",
        category: "finish",
      },
      {
        id: "concrete_patio",
        inputType: "yes_no",
        label: "Concrete patio / flatwork",
        category: "hardscape",
      },
      {
        id: "permits",
        inputType: "yes_no",
        label: "Permits & inspections",
        category: "closeout",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup, haul-off & disposal",
        category: "closeout",
      },
    ],
  },

  concrete: {
    title: "Concrete — confirm project scope",
    intro: "Confirm concrete scope before pricing.",
    items: [
      {
        id: "demo_removal",
        inputType: "yes_no",
        label: "Demo / removal",
        category: "demo",
      },
      {
        id: "site_prep",
        inputType: "yes_no",
        label: "Basic subgrade prep / grading",
        category: "sitework",
      },
      {
        id: "gravel_base",
        inputType: "yes_no",
        label: "Imported gravel base material",
        category: "sitework",
      },
      {
        id: "excavation",
        inputType: "yes_no",
        label: "Excavation / soil movement",
        category: "sitework",
      },
      {
        id: "reinforcement",
        inputType: "yes_no",
        label: "Rebar / mesh / reinforcement",
        category: "pour",
      },
      {
        id: "pour_flatwork",
        inputType: "yes_no",
        label: "Pour flatwork (slab / patio / walk)",
        category: "pour",
      },
      {
        id: "pour_foundation",
        inputType: "yes_no",
        label: "Footing / foundation concrete pour",
        category: "pour",
      },
      {
        id: "complex_forming",
        inputType: "yes_no",
        label: "Complex forming",
        category: "pour",
      },
      {
        id: "concrete_sealer",
        inputType: "yes_no",
        label: "Concrete sealer",
        category: "finish",
      },
      {
        id: "decorative_finish",
        inputType: "yes_no",
        label: "Decorative finish",
        category: "finish",
      },
      {
        id: "additional_haul_off",
        inputType: "yes_no",
        label: "Additional haul-off / disposal",
        category: "closeout",
      },
      {
        id: "concrete_pumping",
        inputType: "yes_no",
        label: "Concrete pump truck",
        category: "pour",
      },
    ],
  },

  excavation: {
    title: "Excavation — confirm project scope",
    intro: "Confirm excavation scope before pricing.",
    items: [
      {
        id: "mobilization",
        inputType: "yes_no",
        label: "Mobilization / equipment",
        category: "sitework",
      },
      {
        id: "clearing",
        inputType: "yes_no",
        label: "Clearing / stripping",
        category: "sitework",
      },
      {
        id: "excavation",
        inputType: "yes_no",
        label: "Excavation / cut",
        category: "earthwork",
      },
      {
        id: "trenching",
        inputType: "yes_no",
        label: "Trenching (utilities / drainage)",
        category: "earthwork",
      },
      {
        id: "grading",
        inputType: "yes_no",
        label: "Grading / compaction",
        category: "earthwork",
      },
      {
        id: "backfill",
        inputType: "yes_no",
        label: "Backfill / import fill",
        category: "earthwork",
      },
      {
        id: "haul_off",
        inputType: "yes_no",
        label: "Haul-off / dump fees",
        category: "closeout",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup & restoration",
        category: "closeout",
      },
    ],
  },

  drywall: {
    title: "Drywall — confirm project scope",
    intro: "Confirm drywall scope before pricing.",
    items: [
      {
        id: "demo_removal",
        inputType: "yes_no",
        label: "Demo / removal",
        category: "demo",
      },
      {
        id: "hang",
        inputType: "yes_no",
        label: "Hang drywall",
        category: "drywall",
      },
      {
        id: "finish_tape",
        inputType: "yes_no",
        label: "Tape / mud / finish",
        category: "drywall",
      },
      {
        id: "texture",
        inputType: "yes_no",
        label: "Texture / skim coat",
        category: "drywall",
      },
      {
        id: "patch_repair",
        inputType: "yes_no",
        label: "Patch / repair only",
        category: "drywall",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup & disposal",
        category: "closeout",
      },
    ],
  },

  painting: {
    title: "Painting — confirm project scope",
    intro: "Confirm interior and exterior painting scope before pricing.",
    items: [
      {
        id: "prep",
        inputType: "yes_no",
        label: "Prep & Masking",
        helperText:
          "Floor/furniture protection, masking, fill nail holes, patch minor drywall dents, prime repaired areas, light sanding, minor caulking, and cleanup prep.",
        category: "prep",
      },
      {
        id: "interior_paint",
        inputType: "yes_no",
        label: "Walls",
        helperText:
          "Paintable wall surface area only. Standard preparation, protection, painting, and cleanup are included.",
        category: "paint",
      },
      {
        id: "ceiling_paint",
        inputType: "yes_no",
        label: "Ceilings",
        helperText:
          "Paintable ceiling surface area only. Standard preparation, flat ceiling paint, painting, and cleanup are included.",
        category: "paint",
      },
      {
        id: "trim_paint",
        inputType: "yes_no",
        label: "Baseboards, trim & molding",
        helperText:
          "Baseboards, window casing, door casing, crown, and other interior trim. Use total linear feet. Do not include door slabs or door jambs/frames.",
        category: "paint",
      },
      {
        id: "door_paint",
        inputType: "yes_no",
        label: "Interior door & frame painting",
        helperText:
          "Includes prep and paint for interior door slabs, edges, jambs/frames, and the associated casing. Standard nail-hole filling, minor caulking, and normal prep are included. Major repairs, stripping, or specialty coatings are separate.",
        category: "paint",
      },
      {
        id: "cabinet_paint",
        inputType: "yes_no",
        label: "Cabinets",
        helperText:
          "Includes cabinet boxes, doors, drawer fronts, and face frames. Refinishing and major repairs are separate.",
        category: "paint",
      },
      {
        id: "exterior_prep",
        inputType: "yes_no",
        label: "Exterior Prep & Masking",
        helperText:
          "Pressure washing and exterior surface cleaning, masking around windows, doors, and adjacent surfaces, light scraping, minor caulking, spot priming, and standard prep before exterior painting.",
        category: "prep",
      },
      {
        id: "exterior_paint",
        inputType: "yes_no",
        label: "Exterior Paint",
        helperText:
          "Paintable exterior surface area for siding, stucco, soffits, and fascia. Heavy repairs, access work, and specialty coatings are separate.",
        category: "paint",
      },
      {
        id: "exterior_trim_paint",
        inputType: "yes_no",
        label: "Exterior trim, windows & doors",
        helperText:
          "Paint exterior trim, 12 window trim assemblies, and 2 exterior door surfaces. Masking is included in Exterior Prep & Masking. Window and door replacement or installation are separate.",
        category: "paint",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup & disposal",
        category: "closeout",
      },
    ],
  },

  electrical: {
    title: "Electrical — confirm project scope",
    intro:
      "Confirm panels, circuits, devices, and lighting. Detailed Electrical cards can show approved or proposed pricing; the trim-out and rough-in packages stay off when those counts exist.",
    items: [
      [
        "electrical_main_panel",
        "Main panel",
        "Service / panels",
        "New main-panel install only. Service upgrades own included panel/meter work. Amperage is a separate attribute.",
      ],
      [
        "electrical_subpanel",
        "Subpanel",
        "Service / panels",
        "Branch / subpanel count. Not the main service panel.",
      ],
      [
        "electrical_panel_upgrade",
        "Panel upgrade",
        "Service / panels",
        "In-place panel swap at the same or increased panel capacity. Not service conductors, meter, or utility coordination.",
      ],
      [
        "electrical_service_upgrade",
        "Service upgrade",
        "Service / panels",
        "Service-size change including included panel/meter, grounding/bonding, and utility coordination. Do not also price Main panel or Panel upgrade for the same replacement.",
      ],
      [
        "electrical_standard_circuit",
        "Standard 15/20A circuits",
        "Circuits",
        "General 120V lighting and receptacle homeruns. Dedicated appliance circuits, devices, and hookups are separate.",
      ],
      [
        "electrical_dedicated_20a",
        "Dedicated 20A circuits",
        "Circuits",
        "Dedicated 120V 20A appliance homeruns. Do not also count as standard circuits. Dishwasher / disposal / microwave / refrigerator hookups own those circuits.",
      ],
      [
        "electrical_circuit_30a",
        "30A circuits",
        "Circuits",
        "Generic 30A homeruns, typically 240V. A dryer or water-heater hookup owns that circuit instead.",
      ],
      [
        "electrical_circuit_40a",
        "40A circuits",
        "Circuits",
        "40A circuits, typically 240V. Do not also count a matching appliance hookup here.",
      ],
      [
        "electrical_circuit_50a",
        "50A circuits",
        "Circuits",
        "Generic 50A homeruns. A 50A range circuit belongs on Electric range circuit + hookup, not here.",
      ],
      [
        "electrical_circuit_60a_plus",
        "60A+ circuits",
        "Circuits",
        "60A and larger feeder / equipment homeruns. EV charger circuit + hookup owns that circuit. Specialty / confirm.",
      ],
      [
        "electrical_standard_receptacle",
        "Standard receptacles",
        "Receptacles",
        "120V duplex outlets. Device / box / plate only — the homerun is a circuit card. GFCI, AFCI, exterior, floor, USB, and 240V devices are separate.",
      ],
      [
        "electrical_gfci_receptacle",
        "GFCI receptacles",
        "Receptacles",
        "GFCI / WR kitchen, bath, garage, and wet-location devices. Not a standard receptacle and not the homerun.",
      ],
      [
        "electrical_afci_receptacle",
        "AFCI / dual-function receptacle",
        "Receptacles",
        "Device + box + plate only. Does not include AFCI/dual-function breaker or new circuit wiring. Do not also count as standard or GFCI.",
      ],
      [
        "electrical_exterior_receptacle",
        "Exterior receptacles",
        "Receptacles",
        "Weather-resistant exterior devices, including outdoor GFCI/WR. Distinct from interior GFCI. Homerun is separate.",
      ],
      [
        "electrical_floor_receptacle",
        "Floor receptacles",
        "Receptacles",
        "Floor boxes / floor outlets. Device only — not a standard receptacle and not the homerun.",
      ],
      [
        "electrical_usb_receptacle",
        "USB / specialty receptacles",
        "Receptacles",
        "USB, USB-C, or other specialty 120V devices. Not a standard receptacle. Homerun is separate.",
      ],
      [
        "electrical_240v_receptacle",
        "240V receptacles",
        "Receptacles",
        "240V receptacle devices only. Range / dryer hookups own those connections. Homerun is a circuit or hookup card.",
      ],
      [
        "electrical_single_pole_switch",
        "Single-pole switch",
        "Switches / controls",
        "Device + box + plate only. Does not include homerun, relocation, fishing, or wall repair. 3-way, 4-way, dimmer, occupancy, and smart switches own those locations instead.",
      ],
      [
        "electrical_3way_switch",
        "3-way switch",
        "Switches / controls",
        "3-way switch devices. Count devices, not traveler circuits. Device + box + plate only — not a new circuit and not a relocation.",
      ],
      [
        "electrical_4way_switch",
        "4-way switch",
        "Switches / controls",
        "4-way switch devices. Count devices, not traveler circuits. Device + box + plate only — not a new circuit and not a relocation.",
      ],
      [
        "electrical_dimmer_switch",
        "Dimmer switch",
        "Switches / controls",
        "Dimmer switch device only. Does not include lighting fixture. Owns the switch location — do not also count as a single-pole switch.",
      ],
      [
        "electrical_occupancy_switch",
        "Occupancy / motion sensor switch",
        "Switches / controls",
        "Occupancy or vacancy / motion sensor switch. Owns the switch location — not a single-pole switch. Homerun and relocation are separate.",
      ],
      [
        "electrical_smart_switch",
        "Smart switch",
        "Switches / controls",
        "Smart / wifi / home-automation switch. Owns the switch location — do not also count a single-pole switch. Homerun and relocation are separate.",
      ],
      [
        "electrical_standard_fixture",
        "Standard / vanity fixture",
        "Lighting",
        "Surface, flush, or vanity fixtures. Fixture + hang only — not the homerun and not a dimmer. Recessed, pendant, decorative, exterior, and under-cabinet are separate.",
      ],
      [
        "electrical_recessed_light",
        "Recessed / canless / wafer light",
        "Lighting",
        "Recessed cans, canless, or wafer lights. Fixture + hang only — not the homerun. Do not also count as a standard fixture.",
      ],
      [
        "electrical_pendant_light",
        "Pendant light",
        "Lighting",
        "Pendant fixtures. Fixture + hang only — not the homerun and not a standard fixture.",
      ],
      [
        "electrical_decorative_light",
        "Decorative / chandelier",
        "Lighting",
        "Chandeliers, heavy decorative, or specialty fixtures. Fixture + hang only. Specialty / confirm — not a standard fixture and not the homerun.",
      ],
      [
        "electrical_exterior_light",
        "Exterior light",
        "Lighting",
        "Exterior wall packs, floods, or porch lights. Fixture + hang only — not the homerun.",
      ],
      [
        "electrical_undercabinet_light",
        "Under-cabinet fixture",
        "Lighting",
        "Under-cabinet fixture install only. Does not include a new homerun or cabinet wiring runs. Recessed, pendant, and standard fixtures are separate.",
      ],
      [
        "electrical_ceiling_fan",
        "Ceiling fan",
        "Fans",
        "Ceiling fan fixtures, with or without a light kit. Fixture + hang only — not a new fan-rated box, homerun, or bath exhaust fan.",
      ],
      [
        "electrical_bath_exhaust_fan",
        "Bathroom exhaust fan electrical install",
        "Fans",
        "Fan + electrical connection only. Does not include ducting, roof/wall venting, or HVAC work. Distinct from ceiling fans. Homerun is a circuit card.",
      ],
      [
        "electrical_range_hookup",
        "Electric range circuit + hookup",
        "Appliance circuit + hookup",
        "Includes the dedicated 50A circuit and the connection — not a plug-in only. Do not also count a generic 50A card or a 240V receptacle.",
      ],
      [
        "electrical_dryer_hookup",
        "Electric dryer circuit + hookup",
        "Appliance circuit + hookup",
        "Includes the dedicated 30A circuit and the connection — not a plug-in only. Do not also count a generic 30A card or a 240V receptacle.",
      ],
      [
        "electrical_dishwasher_hookup",
        "Dishwasher circuit + hookup",
        "Appliance circuit + hookup",
        "Includes the dedicated 20A circuit and the connection — not a plug-in only. Do not also count a generic dedicated 20A card.",
      ],
      [
        "electrical_disposal_hookup",
        "Disposal circuit + hookup",
        "Appliance circuit + hookup",
        "Includes the dedicated 20A circuit and the connection — not a plug-in only. An air switch is a switch card, not this hookup.",
      ],
      [
        "electrical_microwave_hookup",
        "Microwave circuit + hookup",
        "Appliance circuit + hookup",
        "Includes the dedicated 20A circuit and the connection — not a plug-in only. Do not also count a generic dedicated 20A card.",
      ],
      [
        "electrical_refrigerator_hookup",
        "Refrigerator circuit + hookup",
        "Appliance circuit + hookup",
        "Includes the dedicated 20A circuit and the connection — not a plug-in only. Do not use this card for a fridge on an existing receptacle — that is a standard receptacle.",
      ],
      [
        "electrical_water_heater_hookup",
        "Electric water heater circuit + hookup",
        "Appliance circuit + hookup",
        "Includes the dedicated 30A circuit and the connection — not a plug-in only. Not a gas water heater. Do not also count a generic 30A card.",
      ],
      [
        "electrical_hvac_hookup",
        "HVAC circuit + hookup",
        "Appliance circuit + hookup",
        "Includes the HVAC electrical circuit and connection — not a plug-in only. Not the HVAC trade package and not a generic circuit card. Specialty / confirm.",
      ],
      [
        "electrical_ev_charger_hookup",
        "EV charger circuit + hookup",
        "Appliance circuit + hookup",
        "Includes the EV charger circuit and connection — not a plug-in only. Owns the 60A+ feeder — do not also count a generic 60A+ card. Specialty / confirm.",
      ],
      [
        "electrical_smoke_detector",
        "Smoke detectors",
        "Life safety / low voltage",
        "Hardwired smoke alarms. Device + interconnect only — not a new homerun.",
      ],
      [
        "electrical_co_detector",
        "CO detectors",
        "Life safety / low voltage",
        "Hardwired carbon-monoxide alarms. Device + interconnect only. Combo units count here only when called out as CO.",
      ],
      [
        "electrical_doorbell",
        "Doorbell",
        "Life safety / low voltage",
        "Standard doorbell / chime wiring and device. Not a video doorbell or camera.",
      ],
      [
        "electrical_cat6_drop",
        "CAT6 / data drops",
        "Life safety / low voltage",
        "Data / CAT6 drops or outlets. Drop only — not a new homerun and not a whole-house structured wiring package. Camera drops are a separate card.",
      ],
      [
        "electrical_tv_coax",
        "TV / coax",
        "Life safety / low voltage",
        "TV, coax, or RG6 outlets. Drop only — not a new homerun.",
      ],
      [
        "electrical_security_prewire",
        "Security prewire",
        "Life safety / low voltage",
        "Security / alarm prewire drops only. Does not include cameras, keypads, or monitoring. Camera drops are a separate card.",
      ],
      [
        "electrical_camera_prewire",
        "Camera prewire / low-voltage drop",
        "Life safety / low voltage",
        "Camera prewire / low-voltage drop only. Does not include cameras or equipment (Ring, Nest, PoE). Drop only — not a new homerun. Do not also count as CAT6 or security prewire.",
      ],
      [
        "electrical_device_removal",
        "Device removal",
        "Rough / modifications",
        "Remove existing receptacles or switches. Cap / make-safe only. Not a relocate and not a new device. Wall repair is a separate trade.",
      ],
      [
        "electrical_fixture_removal",
        "Fixture removal",
        "Rough / modifications",
        "Remove existing light fixtures or fans. Cap / make-safe only. Not a relocate and not a new fixture.",
      ],
      [
        "electrical_relocate",
        "Relocate outlet / switch / fixture",
        "Rough / modifications",
        "Move an existing outlet, switch, or fixture. Not a new device card. Wire modification stays here; wall repair is a separate trade.",
      ],
      [
        "electrical_abandoned_circuit",
        "Abandoned circuits",
        "Rough / modifications",
        "Make-safe / abandon existing circuits. Not a new homerun. Tracing in finished walls is specialty / confirm.",
      ],
      [
        "electrical_conduit",
        "Conduit / raceway only",
        "Rough / modifications",
        "Standard residential PVC raceway. Not conductors, breaker, homerun, trenching, termination, equipment, or rigid/oversized conduit. A conduit flag without LF does not invent a length.",
      ],
      [
        "electrical_trenching",
        "Trenching — normal soil",
        "Rough / modifications",
        "Normal-soil excavation and backfill only. Not conduit, rock, boring, pavement, landscape restoration, or permits. Rocky / difficult trench is specialty / confirm. A trenching flag without LF does not invent a length.",
      ],
      [
        "electrical_rough",
        "Electrical rough-in",
        "Packages",
        "Whole-project electrical rough-in planning allowance — $10,000. Standard residential branch-circuit rough wiring, boxes, cable/conductors, basic supports and rough-in labor. Planning allowance only; confirm detailed device/circuit takeoff before final bid. Does not include service/panel work, trim devices/plates, light fixtures, fans, appliance hookups, low voltage, EV, conduit/trenching, utility work, wall repair, specialty systems, or work already priced on detailed Electrical cards. A rough flag without a point count does not invent a count. Living SF is not the quantity.",
      ],
      [
        "electrical_trim",
        "Electrical trim-out",
        "Packages",
        "Existing box/wiring electrical trim-out — standard receptacles/switches/plates, device installation, testing and labeling. No new circuit/homerun. Does not include light fixtures, fans, appliance hookups, specialty devices, or new circuits. Detailed receptacle / switch / fixture / fan counts own those cards instead. A trim flag without a device count does not invent a count. The $2,500 whole-project figure is a planning allowance only — confirm actual quantity before final bid.",
      ],
      [
        "cleanup",
        "Cleanup & disposal",
        "Closeout",
        "Job cleanup and debris from electrical work.",
      ],
    ].map(([id, label, category, helperText]) => ({
      id,
      inputType: "yes_no",
      label,
      helperText,
      category,
    })),
  },

  room_remodel: {
    title: "Interior remodel — confirm project scope",
    intro: "Multi-trade remodel — confirm scope before pricing.",
    items: [
      {
        id: "demo",
        inputType: "yes_no",
        label: "Demo / selective tear-out",
        category: "scope",
      },
      {
        id: "framing",
        inputType: "yes_no",
        label: "Framing or layout changes",
        category: "structural",
      },
      {
        id: "plumbing",
        inputType: "yes_no",
        label: "Plumbing work",
        category: "plumbing",
      },
      {
        id: "electrical",
        inputType: "yes_no",
        label: "Electrical work",
        category: "electrical",
      },
      { id: "hvac", inputType: "yes_no", label: "HVAC work", category: "hvac" },
      {
        id: "drywall",
        inputType: "yes_no",
        label: "Drywall hang / finish",
        category: "finishes",
      },
      {
        id: "flooring",
        inputType: "yes_no",
        label: "Flooring install",
        category: "flooring",
      },
      {
        id: "paint",
        inputType: "yes_no",
        label: "Interior painting",
        category: "finishes",
      },
      {
        id: "trim",
        inputType: "yes_no",
        label: "Trim & doors",
        category: "finishes",
      },
      {
        id: "permits",
        inputType: "yes_no",
        label: "Permits & inspections",
        category: "soft_costs",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup, haul-off & disposal",
        category: "scope",
      },
    ],
  },

  insulation: {
    title: "Existing Home Insulation Upgrade",
    intro: "Confirm insulation locations, assemblies, and quantities before pricing.",
    items: [
      {
        id: "insulation",
        inputType: "yes_no",
        label: "Insulation",
        helperText:
          "Exterior wall, attic/ceiling, and floor insulation work. Air sealing is shown as a separate scope card. Do not use drywall surface area for insulation quantities.",
        category: "structure",
      },
      {
        id: "air_sealing",
        inputType: "yes_no",
        label: "Standard air sealing",
        helperText:
          "Basic accessible sealing around top plates, attic penetrations, wiring, plumbing, duct openings, rim areas, and attic access using standard caulk, foam, and blocking. Excludes blower-door testing, duct sealing, removals, remediation, and major encapsulation.",
        category: "structure",
      },
    ],
  },

  windows_doors: {
    title: "Windows & doors — confirm installation scope",
    intro:
      "Confirm opening types and whether any structural reframing is actually included.",
    items: [
      {
        id: "windows",
        inputType: "yes_no",
        label: "Windows",
        helperText:
          "Window units, frames, glazing, flashing, shimming, and standard installation. Casing and finish are on the Trim & finish add-on.",
        category: "exterior",
      },
      {
        id: "exterior_doors",
        inputType: "yes_no",
        label: "Exterior swing doors",
        helperText:
          "Entry/exit door units, frames, thresholds, weatherstripping, flashing, and standard installation. Casing and finish are on the Trim & finish add-on.",
        category: "exterior",
      },
      {
        id: "sliding_doors",
        inputType: "yes_no",
        label: "Sliding / patio doors",
        helperText:
          "Sliding or multi-panel patio door units, frames, hardware, flashing, and standard installation. Exterior casing and finish are on the Trim & finish add-on.",
        category: "exterior",
      },
      {
        id: "garage_doors",
        inputType: "yes_no",
        label: "Garage doors",
        helperText:
          "Garage door units, tracks, hardware, and installation. Confirm single, double, or RV/oversized type.",
        category: "exterior",
      },
      {
        id: "interior_doors",
        inputType: "yes_no",
        label: "Interior doors",
        helperText:
          "Includes prehung interior door units, jambs, casing, hinges, standard hardware, and normal nailing-off/installation. Painting and specialty repairs are separate.",
        category: "interior",
      },
      {
        id: "trim_finish",
        inputType: "choice",
        label: "Opening trim & finish",
        helperText:
          "Opening-specific casing and trim. Jamb extensions, stools, and aprons included where applicable. Whole-house trim and wall painting excluded.",
        options: [
          { id: "interior_paint_grade", label: "Interior · paint-grade" },
          { id: "interior_stain_grade", label: "Interior · stain-grade" },
          { id: "interior_unfinished", label: "Interior · unfinished" },
          { id: "exterior_paint_grade", label: "Exterior · paint-grade" },
          { id: "exterior_stain_grade", label: "Exterior · stain-grade" },
          { id: "exterior_unfinished", label: "Exterior · unfinished" },
          {
            id: "both_paint_grade",
            label: "Interior + exterior · paint-grade",
          },
          {
            id: "both_stain_grade",
            label: "Interior + exterior · stain-grade",
          },
          { id: "both_unfinished", label: "Interior + exterior · unfinished" },
          { id: "not_in_scope", label: "Not in this bid" },
          { id: "unsure", label: "Not sure yet" },
        ],
        category: "finish",
      },
      {
        id: "openings",
        inputType: "yes_no",
        label: "Structural reframing / new openings",
        helperText:
          "Separate framing allowance only for an explicitly new, resized, enlarged, or reframed opening.",
        category: "structure",
      },
    ],
  },

  addition: {
    title: "Addition / conversion — confirm scope phases",
    intro: "Mark each phase Yes if it is part of this bid.",
    items: [
      {
        id: "plans_engineering",
        inputType: "yes_no",
        label: "Plans / engineering",
        category: "precon",
      },
      {
        id: "permits",
        inputType: "yes_no",
        label: "Permits / fees",
        category: "precon",
      },
      {
        id: "utility_coordination",
        inputType: "yes_no",
        label: "Utility coordination",
        category: "precon",
      },
      {
        id: "sitework",
        inputType: "yes_no",
        label: "Site prep",
        category: "sitework",
      },
      {
        id: "excavation",
        inputType: "yes_no",
        label: "Excavation",
        category: "sitework",
      },
      {
        id: "grading",
        inputType: "yes_no",
        label: "Grading",
        category: "sitework",
      },
      {
        id: "utility_trenching",
        inputType: "yes_no",
        label: "Utility trenching",
        category: "sitework",
      },
      {
        id: "foundation",
        inputType: "yes_no",
        label: "Footings / slab / foundation",
        category: "foundation",
      },
      {
        id: "concrete",
        inputType: "yes_no",
        label: "Concrete",
        category: "foundation",
      },
      {
        id: "framing",
        inputType: "yes_no",
        label: "Framing / shell",
        category: "shell",
      },
      {
        id: "wall_framing",
        inputType: "yes_no",
        label: "Interior wall framing",
        category: "interior",
      },
      {
        id: "roof_tie_in",
        inputType: "yes_no",
        label: "Roofing / tie-in",
        category: "shell",
      },
      {
        id: "windows_doors",
        inputType: "yes_no",
        label: "Windows & exterior doors",
        category: "shell",
      },
      {
        id: "exterior_finishes",
        inputType: "yes_no",
        label: "Exterior finishes",
        category: "shell",
      },
      {
        id: "plumbing_rough",
        inputType: "yes_no",
        label: "Rough plumbing",
        category: "mep",
      },
      {
        id: "electrical_rough",
        inputType: "yes_no",
        label: "Rough electrical",
        category: "mep",
      },
      { id: "hvac", inputType: "yes_no", label: "HVAC", category: "mep" },
      {
        id: "insulation",
        inputType: "yes_no",
        label: "Insulation",
        category: "interior",
      },
      {
        id: "drywall",
        inputType: "yes_no",
        label: "Drywall",
        category: "interior",
      },
      {
        id: "paint",
        inputType: "yes_no",
        label: "Paint",
        category: "interior",
      },
      {
        id: "flooring",
        inputType: "yes_no",
        label: "Flooring",
        category: "interior",
      },
      {
        id: "cabinets_counters",
        inputType: "yes_no",
        label: "Cabinets & counters",
        category: "interior",
      },
      { id: "tile", inputType: "yes_no", label: "Tile", category: "interior" },
      {
        id: "interior_trim",
        inputType: "yes_no",
        label: "Interior doors / trim",
        category: "interior",
      },
      {
        id: "plumbing_trim",
        inputType: "yes_no",
        label: "Plumbing fixtures / trim-out",
        category: "trimout",
      },
      {
        id: "electrical_trim",
        inputType: "yes_no",
        label: "Electrical devices / fixtures",
        category: "trimout",
      },
      {
        id: "hvac_startup",
        inputType: "yes_no",
        label: "HVAC registers / startup",
        category: "trimout",
      },
      {
        id: "appliances",
        inputType: "yes_no",
        label: "Appliance install",
        category: "trimout",
      },
      {
        id: "final_inspections",
        inputType: "yes_no",
        label: "Final inspections",
        category: "closeout",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup & disposal",
        category: "closeout",
      },
      {
        id: "contingency",
        inputType: "yes_no",
        label: "Contingency allowance",
        category: "closeout",
      },
    ],
  },

  ground_up: {
    title: "Ground-up build — confirm planning scope",
    intro: "New construction — mark Yes only for work in this bid.",
    items: [
      {
        id: "plans_engineering",
        inputType: "yes_no",
        label: "Plans / engineering",
        category: "precon",
      },
      {
        id: "permits",
        inputType: "yes_no",
        label: "Permits / fees (incl. impact)",
        helperText:
          "Inclusive of city impact fee — not permit-only. Fees swing hard by state/city; confirm locally. Water/sewer/fire often extra.",
        category: "precon",
      },
      {
        id: "sitework",
        inputType: "yes_no",
        label: "Sitework",
        category: "sitework",
      },
      {
        id: "excavation",
        inputType: "yes_no",
        label: "Excavation",
        category: "sitework",
      },
      {
        id: "utility_taps",
        inputType: "yes_no",
        label: "Utility taps / connections",
        category: "sitework",
      },
      {
        id: "landscaping",
        inputType: "yes_no",
        label: "Landscaping / site walls & gates",
        helperText:
          "Landscaping, exterior site walls, fences & gates package. Not driveway flatwork or iron entry doors.",
        category: "sitework",
      },
      {
        id: "foundation",
        inputType: "yes_no",
        label: "Foundation",
        category: "structural",
      },
      {
        id: "pour_flatwork",
        inputType: "yes_no",
        label: "Exterior concrete flatwork",
        helperText:
          "Driveway, walkways, porch, and exterior patio slabs — not the house or garage slab. SF takeoff preferred; local allowance when SF is unknown.",
        category: "structural",
      },
      {
        id: "framing",
        inputType: "yes_no",
        label: "Framing",
        category: "structural",
      },
      {
        id: "roofing",
        inputType: "yes_no",
        label: "Roofing",
        category: "exterior",
      },
      {
        id: "windows",
        inputType: "yes_no",
        label: "Windows",
        helperText: "Window count for material and labor.",
        category: "exterior",
      },
      {
        id: "exterior_doors",
        inputType: "yes_no",
        label: "Exterior doors",
        helperText:
          "Swing entry/exit doors including iron/specialty entry — material and install. Not sliding, garage, or site gates.",
        category: "exterior",
      },
      {
        id: "sliding_doors",
        inputType: "yes_no",
        label: "Exterior sliding doors",
        helperText: "Patio / multi-panel sliding doors — material and install.",
        category: "exterior",
      },
      {
        id: "garage_doors",
        inputType: "yes_no",
        label: "Garage doors",
        helperText:
          "Priced by type: single, double, or RV/oversized. Enter counts — double ~$2,400; double+RV ~$10,700 locally.",
        category: "exterior",
      },
      {
        id: "stucco",
        inputType: "yes_no",
        label: "Stucco / exterior wall finish",
        helperText: "Exterior wall surface SF for material and labor.",
        category: "exterior",
      },
      {
        id: "exterior",
        inputType: "yes_no",
        label: "Exterior Envelope",
        helperText:
          "Planning comparison only — price roofing, openings, and stucco separately.",
        category: "exterior",
      },
      {
        id: "mep_rough",
        inputType: "yes_no",
        label: "MEP rough-in",
        helperText:
          "Planning comparison only — price plumbing / electrical / HVAC trades separately.",
        category: "mep",
      },
      {
        id: "plumbing_rough",
        inputType: "yes_no",
        label: "Plumbing rough-in",
        helperText: "Rough-in points (supply/drain) for material and labor.",
        category: "mep",
      },
      {
        id: "electrical_rough",
        inputType: "yes_no",
        label: "Electrical rough-in",
        helperText: "Circuits / boxes / devices for material and labor.",
        category: "mep",
      },
      {
        id: "hvac",
        inputType: "yes_no",
        label: "HVAC",
        helperText: "System count (or tons) for material and labor.",
        category: "mep",
      },
      {
        id: "plumbing_trim",
        inputType: "yes_no",
        label: "Plumbing fixtures & trim",
        helperText:
          "Plumbing fixtures and trim-out package (toilets, faucets, trim). Not plumbing rough-in.",
        category: "mep",
      },
      {
        id: "electrical_trim",
        inputType: "yes_no",
        label: "Electrical fixtures",
        helperText:
          "Light fixtures and finish electrical — material and install. Not electrical rough-in.",
        category: "mep",
      },
      {
        id: "insulation",
        inputType: "yes_no",
        label: "Insulation",
        category: "envelope",
      },
      {
        id: "drywall",
        inputType: "yes_no",
        label: "Drywall",
        category: "finishes",
      },
      {
        id: "cabinets",
        inputType: "yes_no",
        label: "Cabinets / vanity",
        category: "finishes",
      },
      {
        id: "countertops",
        inputType: "yes_no",
        label: "Counters",
        category: "finishes",
      },
      {
        id: "tile_flooring",
        inputType: "yes_no",
        label: "Tile & flooring",
        category: "finishes",
      },
      {
        id: "floor_tile",
        inputType: "yes_no",
        label: "Bath floor tile",
        category: "finishes",
      },
      {
        id: "shower_tile",
        inputType: "yes_no",
        label: "Shower wall tile",
        category: "finishes",
      },
      {
        id: "shower_floor_tile",
        inputType: "yes_no",
        label: "Shower floor tile",
        category: "finishes",
      },
      {
        id: "glass_door",
        inputType: "yes_no",
        label: "Shower doors",
        helperText:
          "Glass shower door / enclosure — material and install. Count matches tile/prefab showers when known.",
        category: "finishes",
      },
      {
        id: "interior_paint",
        inputType: "yes_no",
        label: "Interior paint",
        helperText:
          "Wall/ceiling paint — installed budget from local comparables when available.",
        category: "finishes",
      },
      {
        id: "exterior_paint",
        inputType: "yes_no",
        label: "Exterior paint",
        helperText:
          "Exterior paint application for siding, stucco, soffit, and fascia. Prep, masking, heavy repairs, access work, and specialty coatings are separate.",
        category: "finishes",
      },
      {
        id: "interior_trim",
        inputType: "yes_no",
        label: "Finish carpentry / interior trim",
        helperText:
          "Finish trim, interior doors, door hardware & shelving package until detailed takeoff.",
        category: "finishes",
      },
      {
        id: "appliances",
        inputType: "yes_no",
        label: "Appliance install",
        category: "fixtures",
      },
      {
        id: "contingency",
        inputType: "yes_no",
        label: "Contingency allowance",
        category: "soft_costs",
      },
      {
        id: "cleanup",
        inputType: "yes_no",
        label: "Cleanup & disposal",
        category: "closeout",
      },
    ],
  },
};

/** Note patterns → default Yes for checklist item ids. */
const CHECKLIST_YES_HINTS = {
  demo: /\b(demo|demolition|tear\s*out|gut|remove)\b/,
  appliance_removal:
    /\b(remove|disconnect|pull|haul).*\b(appliance|ridge|dishwasher|range|refrigerator|oven|microwave|hood)\b|\b(appliance|ridge|dishwasher|range|refrigerator)\b.*\b(remove|disconnect|pull|haul)\b/,
  flooring:
    /\bflooring\b|\bnew\s+(?:lvp|laminate|vinyl|carpet)\b|\b(lvp|laminate|vinyl|carpet|floor\s+tile|tile\s+floor)\b.*\binstall(?:ation)?\b|\binstall(?:ation)?\b.*\b(lvp|laminate|vinyl|carpet|flooring|floor\s+tile|tile\s+floor)\b/,
  // Same-clause proximity — "demo the existing tile and tub ... install tile shower pan"
  // must not read as tub/pan demo of things being installed, or cross sentences.
  tub_demo:
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out)\b[^.]{0,60}\b(tub|bathtub)\b|\b(tub|bathtub)\b[^.]{0,60}\b(remove|demo|tear[\s-]?out|rip[\s-]?out)\b/,
  shower_floor_demo:
    /\b(remove|demo|tear[\s-]?out)\b[^.]{0,50}\b(shower\s+(?:pan|floor|base)|pan\s+insert|mud\s+pan)\b|\b(shower\s+(?:pan|floor|base)|prefab\s+pan)\b[^.]{0,50}\b(remove|demo|tear[\s-]?out)\b/,
  vanity_demo:
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,50}\bvanity\b|\bvanity\b[^.]{0,50}\b(remove|demo|tear[\s-]?out|rip[\s-]?out)\b/,
  fixture_demo:
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,70}\b(?:toilet|plumbing\s+fixtures?|fixtures?)\b|\b(?:toilet|plumbing\s+fixtures?|fixtures?)\b[^.]{0,70}\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b/,
  countertop_demo:
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,50}\b(countertops?|counters?)\b|\b(countertops?|counters?)\b[^.]{0,50}\b(remove|demo|tear[\s-]?out|rip[\s-]?out)\b/,
  backsplash_demo:
    /\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b[^.]{0,50}\bbacksplash\b|\bbacksplash\b[^.]{0,50}\b(remove|demo|tear[\s-]?out|rip[\s-]?out|haul[\s-]?off)\b/,
  shower_tile:
    /\b(shower\s+wall\s+tile|shower\s+tile|tile\s+shower|new\s+shower\s+tile)\b/,
  waterproofing:
    /\b(waterproof(?:ing|ed)?|waterproof\s+membrane|redgard|vapor\s+barrier|backer\s+board|cement\s+board)\b/,
  wet_area_install:
    /\b(tub\s+install|new\s+tub|shower\s+pan|prefab\s+pan|tile\s+pan|mud\s+pan|tub[\s-]to[\s-]shower)\b/,
  shower_floor_tile: /\b(shower\s+floor\s+tile|tile\s+shower\s+floor)\b/,
  shower_niche: /\b(shower\s+niche|tile\s+niche|niche)\b/,
  shower_bench: /\b(shower\s+bench)\b/,
  shower_pan:
    /\b(?:shower\s+pan|tile\s+pan|mud\s+pan|mortar\s+bed|shower\s+curb|shower\s+entry\s+curb)\b/,
  floor_tile:
    /\b(tile\s+bath(?:room)?\s+floor|bath(?:room)?\s+floor\s+tile|tile\s+(?:the\s+)?bath(?:room)?\s+floor|new\s+bath(?:room)?\s+floor(?:\s+tile)?|(?<!shower\s)floor\s+tile|(?<!shower\s)tile\s+floor|new\s+floor\s+tile)\b/,
  floor_prep: /\b(floor\s+prep|subfloor|level(?:ing)?|underlayment)\b/,
  adhesive_mastic_removal:
    /\b(adhesive|mastic|thinset|thin\s+set)\b|\b(grind(?:ing)?|scrap(?:e|ing))\b[^.]{0,40}\b(residue|adhesive|mastic|thinset)\b/,
  exhaust_fan: /\b(exhaust\s+fan|bath\s+fan|ventilation)\b/,
  mirror_accessories: /\b(mirror|towel\s+bar|accessories|robe\s+hook)\b/,
  sink_faucet:
    /\b(?:sink\s+and\s+faucet|faucet\s+and\s+sink|vanity\s+sink|lav(?:atory)?\s+sink|sink\b[^.;\n]{0,35}\bfaucet|faucet\b[^.;\n]{0,35}\bsink)\b/,
  toilet:
    /\b(?:new|replace|install|set|remove|demo)\s+(?:a\s+)?toilet\b|\btoilet\b[^.]{0,45}\b(?:new|replace|install|set|remove|demo)\b/,
  cabinets: /\b(cabinets?|new\s+cabinets)\b/,
  countertops:
    /\b(countertops?|counters|quartz|granite|install\s+new\s+countertops?)\b/,
  backsplash: /\b(backsplash)\b/,
  appliances:
    /\b(appliance\s+reinstall|reinstall(?:ing)?\s+(?:old\s+|existing\s+)?appliances?|appliance\s+install|install\s+appliances?|appliance\s+allowance|hookup\s+appliances?|reconnect\s+appliances?|appliance\s+hookup|appliances?\s+(?:&|and)?\s*hookup)\b|\b(?:new|install(?:ation)?)\b[^.;]{0,140}\b(?:range|dishwasher|refrigerator|microwave|oven)\b/,
  island: /\b(island)\b/,
  paint: /\b(paint(?:ing)?|bathroom\s+paint)\b/,
  paint_repair:
    /\b(paint(?:ing)?|bathroom\s+paint|drywall\s+(?:patch|repair)|patch(?:ing)?\s+(?:drywall|sheetrock)|interior\s+painting)\b/,
  lighting: /\b(new\s+lighting|lighting|light\s+fixtures?)\b/,
  glass_door:
    /\b(?:shower\s+door|glass\s+shower|glass\s+door|shower\s+doors?\s*(?:&|and)\s*mirrors?)\b/,
  vanity: /\b(vanity|countertops?\s+and\s+vanity)\b/,
  plumbing:
    /\b(plumb(?:ing)?|rough\s+plumb(?:ing)?|water\s+lines?|drain(?:age)?|sewer|bathroom\s+rough)\b/,
  plumbing_rough:
    /\b(plumb(?:ing)?\s+rough|rough\s+plumb(?:ing)?|rough[\s-]?in|relocat.*plumb)\b/,
  /** Contractor "plumbing trim" = fixture set / trim-out — not baseboard. */
  plumbing_trim:
    /\b(?:(?:final\s+)?plumbing\s+(?:fixtures?|trim(?:[\s-]?out)?)|(?:new\s+)?plumbing\s+fixtures?|fixture\s+hookups?|faucets?,?\s+toilet(?:\s+set)?|toilet\s+set(?:\s+and\s+hookups?)?)\b/,
  cleanup:
    /\b(?:final\s+)?(?:cleanup|clean[\s-]?up|job\s+clean)\b|\bdisposal\b|\bha(?:ul|uling)[\s-]?off\b/,
  electrical:
    /\b(electrical|new\s+circuits?|wiring|outlets?|switches?|gfci|panel)\b/,
  electrical_rough:
    /\b(electrical\s+rough(?:[\s-]?in)?|rough[\s-]?in(?:\s+electrical)?|new\s+circuits?|rewire|branch\s+(?:circuits?|wiring)|whole[\s-]?house\s+(?:electrical|rewire))\b/,
  plans_engineering:
    /\b(plans?|drawings?|engineering|architect(?:ural)?|design\s+docs?)\b/,
  utility_coordination:
    /\b(utility\s+coordination|utility\s+coord|coordinate\s+utilities|utility\s+company)\b/,
  sitework: /\b(site\s*work|site\s+prep|lot\s+prep|clearing|grubbing)\b/,
  landscaping:
    /\b(landscap(?:e|ing)|sod|irrigation|site\s+walls?|fence(?:s|ing)?|gates?)\b/,
  excavation:
    /\b(excavat(?:e|ion)|dig(?:ging)?|dig\s+out|trench(?:ing)?|cut\s+foundation)\b/,
  site_prep:
    /\b(site\s+prep|subgrade|gravel\s+base|base\s+gravel|compaction|grade\s+prep)\b/,
  gravel_base:
    /\b(gravel\s+base|base\s+gravel|crushed\s+(?:rock|stone)\s+base|aggregate\s+base)\b/,
  reinforcement:
    /\b(rebar|re[\s-]?bar|wire\s+mesh|mesh\s+reinforcement|#4\s+bar)\b/,
  complex_forming:
    /\b(?:forms?|formwork|thickened\s+edge|edge\s+thickening|curb\s+form)\b/,
  concrete_pumping:
    /\b(?:pump\s+truck|concrete\s+pump|pump(?:ing)?\s+(?:truck|if\s+needed|may\s+be|might\s+be|required))\b|\bmight\s+need\s+(?:a\s+)?pump\b/,
  decorative_finish:
    /\b(broom\s+finish|stamped\s+concrete|exposed\s+aggregate|stain(?:ed)?\s+concrete|decorative\s+finish)\b/,
  grading: /\b(grading|grade\s+site|rough\s+grade|final\s+grade)\b/,
  utility_trenching:
    /\b(utility\s+trench(?:ing)?|trench(?:ing)?\s+(?:for\s+)?utilities|water\s+line|sewer\s+line|gas\s+line)\b/,
  foundation: /\b(foundation|footings?|slab|stem\s+wall|crawlspace|basement)\b/,
  concrete: /\b(concrete|slab|footings?|foundation\s+pour)\b/,
  framing: /\b(fram(?:e|ing)|wall\s+framing|roof\s+framing|shell)\b/,
  openings:
    /\b(?:re[-\s]?frame|new\s+(?:window|door)?\s*opening|resize(?:d|ing)?\s+(?:the\s+)?(?:window|door)?\s*opening|enlarge(?:d|ing)?\s+(?:the\s+)?(?:window|door)?\s*opening)\b/,
  roof_tie_in:
    /\b(roof\s+tie[\s-]?in|tie\s+into\s+(?:the\s+)?roof|roofing\s+tie[\s-]?in|roofing)\b/,
  windows: /\bwindows?\b/,
  exterior_doors: /\b(exterior\s+doors?|entry\s+doors?|iron\s+doors?)\b/,
  sliding_doors: /\b(sliding\s+doors?|patio\s+doors?|sliders?)\b/,
  trim_finish:
    /\btrim\s*&?\s*finish\b|\b(?:window|door)\s+casing\b|\bstool\s*(?:\/|and)?\s*apron\b/i,
  garage_doors: /\bgarage\s+doors?\b/,
  windows_doors:
    /\b(?:windows?|exterior\s+doors?|entry\s+doors?|sliding\s+doors?|patio\s+doors?|sliders?)\b/,
  exterior_finishes:
    /\b(exterior\s+finishes|siding|soffit|fascia|exterior\s+trim|sheeting|osb|house\s*wrap|weather\s+barrier|exterior\s+plywood|stucco|eifs)\b/,
  hvac: /\b(hvac|furnace|air\s+condition|heat\s+pump|duct(?:work)?|mini\s*split)\b/,
  insulation: /\b(insulat(?:e|ion)|batt\s+insulation|spray\s+foam)\b/,
  drywall: /\b(drywall|sheetrock|gypsum|hang\s+and\s+finish)\b/,
  cabinets_counters:
    /\b(cabinets?|cabinetry|counters?|countertops?|kitchenette|quartz|granite)\b/,
  tile: /\b(tile|shower\s+tile|floor\s+tile|backsplash)\b/,
  trim: /\b(baseboards?|crown|moulding|molding|casing|interior\s+trim|finish\s+trim)\b/,
  interior_trim:
    /\b(interior\s+(?:doors?|trim)|baseboards?|casing|door\s+trim)\b/,
  plumbing_trim:
    /\b(?:(?:final\s+)?plumbing\s+(?:fixtures?|trim(?:[\s-]?out)?)|(?:new\s+)?plumbing\s+fixtures?|fixture\s+hookups?|faucets?,?\s+toilet(?:\s+set)?|toilet\s+set(?:\s+and\s+hookups?)?)\b/,
  electrical_trim:
    /\b(electrical\s+(?:trim|trim[\s-]?out|devices?|fixtures?)|outlets?|switches?|lighting|recessed\s+(?:lights?|cans?)|finish(?:ing)?\s+electrical|devices?\s+and\s+plates|install\s+devices?(?:\s+and\s+plates)?)\b/,
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
  tile_flooring: /\b(tile|flooring|floors?|lvp|laminate|carpet|hardwood)\b/,
  paint_trim: /\b(paint|trim|baseboards?|interior\s+paint)\b/,
  trim_paint:
    /\b(paint|trim|baseboards?|base\s*board|casing|crown|moulding|molding)\b/,
  interior_paint:
    /\b(interior\s+paint|paint\s+(?:walls?|ceilings?|interior)|paint\s*\/\s*stain)\b/,
  prep: /\b(paint(?:ing)?|primer|surface\s+prep|masking|patch(?:ing)?)\b/,
  door_paint:
    /\b(?:paint|painting)\b[^.;]{0,60}\b(?:interior\s+)?doors?\b|\b(?:interior\s+)?doors?\b[^.;]{0,60}\b(?:paint|painting)\b/i,
  cabinet_paint:
    /\b(?:paint|painting|refinish(?:ing)?)\b[^.;]{0,40}\bcabinets?\b|\bcabinets?\b[^.;]{0,40}\b(?:paint|painting|refinish(?:ing)?)\b/,
  exterior_paint: /\b(exterior\s+paint|paint\s+exterior)\b/,
  interior_trim:
    /\b(finish\s+(?:trim|carpentry)|interior\s+(?:trim|doors?)|baseboards?|casing|closet\s+shelving)\b/,
  utility_taps:
    /\b(utility\s+taps?|water\s+tap|sewer\s+tap|gas\s+tap|utility\s+connections?)\b/,
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
  equipment_replace:
    /\b(furnace|heat\s+pump|\bac\b|air\s+condition|hvac\s+replace)\b/,
  ductwork: /\b(duct(?:work)?|ducting)\b/,
  decking: /\b(deck(?:ing)?|composite\s+deck)\b/,
  railing: /\b(rail(?:ing)?|guardrail)\b/,
  pour_flatwork:
    /\b(?:concrete\s+patio|slab|flatwork|sidewalk|driveway|pour\b[^.]{0,40}\b(?:driveway|slab|patio|sidewalk|walkway))\b/,
  trenching: /\b(trench(?:ing)?|utility\s+trench)\b/,
  hang: /\b(hang\s+drywall|drywall\s+hang)\b/,
  finish_tape: /\b(tape|mud|finish\s+drywall)\b/,
  interior_paint: /\b(interior\s+paint|paint\s+(?:walls|interior))\b/,
  exterior_paint: /\b(exterior\s+paint|paint\s+exterior)\b/,
  permits:
    /\b(include\s+permits?|permits?\s+included|pull\s+permits?|contractor\s+pulls?\s+permits?|permits?\s+in\s+(?:the\s+)?(?:bid|price|scope)|permit\s+fees?\s+included)\b/,
  cleanup: /\b(cleanup|disposal|dumpster|debris|final\s+clean)\b/,
};

const CHECKLIST_NO_HINTS = {
  // Protection keeps the finished floor safe during the remodel; it is not
  // evidence that new flooring is being installed.
  flooring:
    /\b(?:flooring|floors?|finished\s+floor)\s+(?:protection|protect(?:ion|ed|ing))\b|\bprotect(?:ion|ed|ing)\b[^.]{0,40}\b(?:flooring|floors?|finished\s+floor)\b/,
  // Explicit exclusions must override broad remodel/framing keywords.
  framing:
    /\b(?:no|without|not)\s+(?:wall\s+removal|structural\s+framing|framing|layout\s+changes?)\b|\b(?:wall\s+removal|structural\s+framing|framing|layout\s+changes?)\s+(?:not\s+included|excluded)\b/,
  walls_moving:
    /\b(?:no|without|not)\s+(?:wall\s+removal|structural\s+framing|framing|layout\s+changes?)\b|\b(?:wall\s+removal|structural\s+framing|framing|layout\s+changes?)\s+(?:not\s+included|excluded)\b/,
  appliances:
    /\b(no\s+appliances|appliances\s+not\s+included|owner\s+appliances)\b/,
  // Already out of the house — removal is not in this bid.
  appliance_removal:
    /\b(appliances?\s+have\s+(?:all\s+)?(?:already\s+)?been\s+removed|appliances?\s+already\s+(?:been\s+)?(?:removed|out|gone)|already\s+(?:been\s+)?removed\s+(?:the\s+)?appliances?|appliances?\s+(?:are|were)\s+already\s+(?:removed|out|gone))\b/,
  permits:
    /\b(no\s+permits|permits\s+not\s+included|owner\s+pulls?\s+permits)\b/,
  garage_doors:
    /\b(?:keep(?:ing)?\s+(?:the\s+)?(?:existing\s+)?garage\s+door|existing\s+garage\s+door\s+(?:for\s+now|stays?|remain(?:s|ing)?)|(?:no|without|not)\s+(?:a\s+)?(?:new\s+)?garage\s+door)\b/,
  foundation:
    /\b(no|without|not\s+including)\s+(?:new\s+)?(?:foundation|footings?|slab)\b|\b(?:foundation|footings?|slab)\s+(?:not\s+included|excluded)\b/,
  roof_tie_in:
    /\b(no|without|not\s+including)\b[^.]{0,40}\b(?:roof(?:ing)?|roof\s+tie[\s-]?in|roof\s+work)\b|\b(?:roof(?:ing)?|roof\s+tie[\s-]?in|roof\s+work)\s+(?:not\s+included|excluded)\b/,
  roofing:
    /\b(no|without|not\s+including)\b[^.]{0,40}\b(?:roof(?:ing)?|roof\s+work)\b|\b(?:roof(?:ing)?|roof\s+work)\s+(?:not\s+included|excluded)\b/,
};

function notesText(draft, originalNotes) {
  return String(originalNotes || draft?.originalNotes || "").toLowerCase();
}

const CONCRETE_FLATWORK_NOTES =
  /\b(?:concrete\s+(?:patio|slab|driveway?|flat[\s-]?work|walkway|sidewalk)|pour\s+(?:new\s+)?(?:concrete|driveway|slab|patio|sidewalk|walkway|flat[\s-]?work)|flat[\s-]?work|new\s+driveway)\b/i;

const CONCRETE_FLATWORK_CONTEXT =
  /\b(?:forms?|rebar|thickened\s+edge|broom\s+finish|pump\s+truck|gravel\s+base|dig\s+out|mesh|control\s+joints?)\b/i;

function notesImplyConcreteFlatwork(notes) {
  const n = String(notes || "");
  if (!n.trim()) return false;
  if (detectAdditionConversionIntent(null, notes)) return false;
  if (CONCRETE_FLATWORK_NOTES.test(n)) return true;
  if (
    /\b(?:driveway|sidewalk|walkway|patio\s+slab)\b/i.test(n) &&
    CONCRETE_FLATWORK_CONTEXT.test(n)
  ) {
    return true;
  }
  if (
    /\b\d{2,4}\s*(?:sq\.?\s*ft|sf)\b/i.test(n) &&
    /\b(?:\d\s*(?:inch|in)\b[^.]{0,20}thick|thickened\s+edge|rebar|broom\s+finish)\b/i.test(
      n,
    ) &&
    !/\b(?:bath(?:room)?|kitchen|shower|interior\s+paint|drywall)\b/i.test(n)
  ) {
    return true;
  }
  return false;
}

function detectAdditionConversionIntent(projectType, notes) {
  const pt = String(projectType || "").toLowerCase();
  if (ADDITION_CONVERSION_PROJECT_TYPES.has(pt)) return true;
  return ADDITION_CONVERSION_NOTES.test(String(notes || ""));
}

function notesImplyMixedInteriorRefresh(notes) {
  const n = String(notes || "");
  if (
    !n.trim() ||
    /\b(?:kitchen|bath(?:room)?|shower|tub|vanity|toilet)\b/i.test(n)
  ) {
    return false;
  }

  const hasPaint = /\bpaint(?:ing)?\b/i.test(n);
  const hasFlooring =
    /\b(?:lvp|laminate|vinyl|carpet|hardwood|flooring)\b/i.test(n);
  const hasDoorsOrTrim =
    /\b(?:interior\s+)?doors?\b|\b(?:baseboard|trim)\b/i.test(n);
  const hasDrywall = /\bdrywall\b|\bpatch(?:ing)?\b/i.test(n);
  const finishCount = [
    hasPaint,
    hasFlooring,
    hasDoorsOrTrim,
    hasDrywall,
  ].filter(Boolean).length;
  if (
    hasPaint &&
    !hasFlooring &&
    /\b(?:interior\s+)?repaint\b|\brepaint\b/i.test(n)
  ) {
    return false;
  }

  // Keep a dedicated paint-and-trim job on the painting checklist. A flooring
  // or drywall component is the signal that this is a mixed interior refresh.
  return finishCount >= 2 && (hasFlooring || hasDrywall);
}

function notesImplyMultiTradeInteriorRemodel(notes) {
  const n = String(notes || "");
  if (
    !/\b(?:remodel|renovat(?:e|ion)|replace|install|update|repair)\b/i.test(
      n,
    ) ||
    /\b(?:new\s+construction|new\s+build|addition)\b/i.test(n)
  ) {
    return false;
  }
  const signals = [
    /\b(?:kitchen|bath(?:room)?s?)\b/i,
    // Floor protection is a protection/finish condition, not a flooring
    // installation or replacement scope signal.
    /\b(?:install|replace|remove|demo|demolition|tear[\s-]?out)\b[^.;]{0,60}\b(?:lvp|laminate|vinyl|carpet|hardwood|flooring)(?!\s+protection)\b|\b(?:lvp|laminate|vinyl|carpet|hardwood|flooring)(?!\s+protection)\b[^.;]{0,60}\b(?:install|replace|remove|demo|demolition|tear[\s-]?out)\b/i,
    /\b(?:cabinet|countertops?|vanit(?:y|ies)|plumbing\s+fixtures?)\b/i,
    /\bdrywall\b|\bpatch(?:ing)?\b/i,
    /\bpaint(?:ing)?|repaint|walls?\s+and\s+ceilings?\b/i,
    /\b(?:baseboard|trim|interior\s+doors?)\b/i,
  ];
  return signals.filter((pattern) => pattern.test(n)).length >= 3;
}

function checklistTemplateKey(draft, estimateTier) {
  const projectType = String(draft.projectType || "other").toLowerCase();
  const notes = notesText(draft, null);

  const dedicatedPaintingIntent =
    /\b(?:paint(?:ing)?|repaint|primer|painted)\b/i.test(notes);
  const explicitRepaintWithoutConstruction =
    /\b(?:repaint|repainting|whole[-\s]?house\s+(?:interior\s+and\s+exterior\s+)?repaint)\b/i.test(
      notes,
    ) &&
    !/\b(?:install|replace|new|build|remodel|renovat(?:e|ion)|add(?:ition)?)\b/i.test(
      notes,
    );
  if (dedicatedPaintingIntent && explicitRepaintWithoutConstruction) {
    return "painting";
  }
  // An explicitly named bathroom remodel is a dedicated multi-trade
  // bathroom workflow, even when the note contains enough plumbing, tile,
  // vanity, and lighting terms to look like a plumbing job upstream.
  if (
    projectType === "bathroom" ||
    /\b(?:bathroom|bath)\s+(?:remodel|renovation)\b/i.test(notes) ||
    /\bremodel(?:\s+\w+){0,4}\s+bathroom\b/i.test(notes)
  ) {
    return "bathroom";
  }
  // An explicitly selected kitchen project should use the kitchen checklist.
  // Kitchen notes often contain several work types (demo, plumbing,
  // electrical, appliances), but that does not make them a whole-home remodel.
  if (projectType === "kitchen") {
    return "kitchen";
  }
  // A whole-home remodel can mention a kitchen as one work area. Route
  // multi-trade notes to the room-remodel checklist before the dedicated
  // kitchen shortcut so flooring, drywall, paint, and baseboard scope remain
  // visible in the review.
  if (notesImplyMultiTradeInteriorRemodel(notes)) {
    return "room_remodel";
  }
  // Prefer the dedicated kitchen checklist whenever the notes name a kitchen
  // or its defining components. This must run before the generic
  // multi-trade interior rule.
  if (
    projectType === "kitchen" ||
    /\bkitchen(?:\s+remodel)?\b/i.test(notes) ||
    /\b(countertops?|backsplash|kitchen\s+island)\b/i.test(notes)
  ) {
    return "kitchen";
  }
  // A multi-trade interior remodel can mention repainting prominently enough
  // that the upstream tier classifier labels it as painting. Let the stronger
  // kitchen/bath/flooring/trade combination override that tier before choosing
  // a dedicated painting checklist.
  if (notesImplyMultiTradeInteriorRemodel(notes)) {
    return "room_remodel";
  }
  if (estimateTier === "ground_up") return "ground_up";
  if (estimateTier === "addition") return "addition";
  if (detectAdditionConversionIntent(projectType, notes)) return "addition";
  const dedicatedWindowsDoorsIntent =
    projectType === "windows_doors" ||
    projectType === "windows_and_doors" ||
    (/\b(?:windows?|fenestration|exterior\s+doors?|sliding\s+doors?|patio\s+doors?|garage\s+doors?)\b/i.test(
      notes,
    ) &&
      !/\b(?:bath(?:room)?|shower|tub|vanity|toilet)\b/i.test(notes));
  if (dedicatedWindowsDoorsIntent) return "windows_doors";
  if (
    estimateTier === "room_remodel" &&
    /\b(basement\s+finish(?:ing)?|finished\s+basement|interior\s+renovation|insurance\s+(?:repair|restoration)|restoration|mixed\s+repair)\b/i.test(
      notes,
    )
  ) {
    return "room_remodel";
  }

  if (
    projectType === "bathroom" ||
    /\bbath(?:room)?\s+remodel\b/i.test(notes) ||
    /\b(shower(?:\s+pan)?|bathtubs?|tubs?|vanity|toilet|tile\s+shower)\b/i.test(
      notes,
    )
  ) {
    return "bathroom";
  }
  // A dedicated repaint that mentions an existing kitchen surface is still a
  // painting job. Route it to the painting checklist unless the notes describe
  // an actual kitchen remodel/renovation or a new kitchen installation.
  const actualKitchenRemodelIntent =
    (/\bkitchen\s+(?:remodel|renovat(?:e|ion)|reface|addition)\b/i.test(
      notes,
    ) &&
      !/\b(?:no|without|not)\s+(?:a\s+)?kitchen\s+(?:remodel|renovation)\b/i.test(
        notes,
      )) ||
    /\b(?:install|replace|new)\b[^.]{0,50}\b(?:kitchen\s+)?(?:cabinet|countertop|backsplash|island|flooring)\b/i.test(
      notes,
    );
  if (
    (projectType === "painting" || dedicatedPaintingIntent) &&
    !actualKitchenRemodelIntent
  ) {
    return "painting";
  }
  if (notesImplyMixedInteriorRefresh(notes)) {
    return "room_remodel";
  }
  if (
    projectType === "flooring" ||
    /\b(lvp|laminate|vinyl|carpet|flooring\s+(?:install|job)|floor\s+demo|baseboards?)\b/i.test(
      notes,
    )
  ) {
    return "flooring";
  }
  if (
    projectType === "landscaping" ||
    /\b(landscap(?:e|ing)|irrigation|sod|mulch|pavers|grading)\b/i.test(notes)
  ) {
    return "landscaping";
  }
  if (
    projectType === "plumbing" ||
    /\b(plumb(?:ing)?\s+(?:bid|only|rough|trim)|kitchen\s+plumb|whole[\s-]?house\s+plumb)\b/i.test(
      notes,
    )
  ) {
    return "plumbing";
  }
  if (
    projectType === "plumbing_service" ||
    /\b(plumb(?:ing)?\s+service|drain\s+clean|water\s+heater)\b/i.test(notes)
  ) {
    return "plumbing_service";
  }
  if (
    projectType === "framing" ||
    /\b(fram(?:e|ing)\s+(?:wall|house|addition))\b/i.test(notes)
  ) {
    return "framing";
  }
  // Roofing "squares" must not match "60 square feet" / "sq ft" area language.
  if (
    projectType === "roofing" ||
    /\b(roof(?:ing)?\s+(?:replace|install|tear)|\bshingle)\b/i.test(notes) ||
    /\b\d+\s*squares?\b(?!\s*(?:feet|foot|ft)\b)/i.test(notes)
  ) {
    return "roofing";
  }
  if (
    projectType === "hvac" ||
    /\b(hvac|furnace|air\s+condition|heat\s+pump|duct(?:work)?)\b/i.test(notes)
  ) {
    return "hvac";
  }
  if (
    projectType === "deck_patio" ||
    /\b(deck\s+build|new\s+deck|patio\s+build|composite\s+deck)\b/i.test(notes)
  ) {
    return "deck_patio";
  }
  if (
    projectType === "concrete" ||
    notesImplyConcreteFlatwork(notes) ||
    notesImplyStructuralFoundation(notes)
  ) {
    return "concrete";
  }
  if (
    projectType === "excavation" ||
    /\b(excavat(?:e|ion)|trench(?:ing)?|grading\s+job)\b/i.test(notes)
  ) {
    return "excavation";
  }
  if (
    projectType === "drywall" ||
    /\b(drywall\s+(?:hang|finish|patch)|sheetrock)\b/i.test(notes)
  ) {
    return "drywall";
  }
  if (
    projectType === "electrical" ||
    projectType === "electrical_service" ||
    /\b(electrical\s+service|recessed\s+lights?|gfci\s+outlets?|dedicated\s+\d+\s*amp|ceiling\s+fans?|\d+\s*amp(?:ere)?s?\s+panel)\b/i.test(
      notes,
    )
  ) {
    return "electrical";
  }
  if (estimateTier === "room_remodel") return "room_remodel";
  return "room_remodel";
}

/**
 * Flooring demo requires floor-specific language. Bare "tile" demo only counts
 * when the job has no shower/tub context — "demo the existing tile and tub"
 * means shower wall tile, not flooring.
 */
function floorDemoNotesHint(n) {
  if (/\bfloor\s+demo\b/.test(n)) return true;
  const verbs = "(?:demo|demolition|remove|removal|tear[\\s-]?out)";
  const floorish =
    "(?:floor(?:ing)?|lvp|vinyl|laminate|carpet|kitchen\\s+floor|floor\\s+tile|tile\\s+floor)";
  if (
    new RegExp(
      `\\b${verbs}\\b[^.]{0,80}\\b${floorish}\\b|\\b${floorish}\\b[^.]{0,80}\\b${verbs}\\b`,
    ).test(n)
  ) {
    return true;
  }
  const bareTileDemo = new RegExp(
    `\\b${verbs}\\b[^.]{0,60}\\btile\\b|\\btile\\b[^.]{0,60}\\b${verbs}\\b`,
  );
  return bareTileDemo.test(n) && !/\b(shower|tub|bathtub|wet\s+area)\b/.test(n);
}

/** Trim & baseboard scope — not plumbing/electrical/shower fixture trim-out. */
function inferTrimStateFromNotes(n) {
  if (
    /\b(?:(?:final\s+)?plumbing\s+trim|plumbing\s+fixtures?|electrical\s+trim|shower\s+trim|trim[\s-]?out)\b/.test(
      n,
    ) &&
    !/\b(baseboards?|trim\s+(?:&|and)\s+baseboard|interior\s+trim|finish\s+trim)\b/.test(
      n,
    )
  ) {
    return "unsure";
  }
  if (/\b(baseboards?|crown|moulding|molding|casing)\b/.test(n))
    return "included";
  if (
    /\b(?:interior|finish)\s+trim\b|\btrim\s+(?:&|and)\s+(?:baseboards?|doors?)\b|\b(?:baseboards?|doors?)\s+(?:&|and)\s+trim\b|\btrim\s+install(?:ation)?\b|\binstall\s+(?:new\s+)?baseboards?\b/.test(
      n,
    )
  ) {
    return "included";
  }
  return "unsure";
}

function inferItemStateFromNotes(itemId, notes) {
  const n = String(notes || "").toLowerCase();
  if (CHECKLIST_NO_HINTS[itemId]?.test(n)) return "excluded";
  if (itemId === "floor_demo")
    return floorDemoNotesHint(n) ? "included" : "unsure";
  if (itemId === "trim") return inferTrimStateFromNotes(n);
  if (CHECKLIST_YES_HINTS[itemId]?.test(n)) return "included";
  return "unsure";
}

function inferRoofingSystemFromNotes(notes) {
  const n = String(notes || "").toLowerCase();
  if (!n.trim()) return null;

  if (/\b(pricing[\s_-]?gap|custom\s+system|unsupported\s+system)\b/.test(n)) {
    return "custom_other";
  }
  if (/\b(standing[\s-]?seam|standing\s+seam\s+metal)\b/.test(n)) {
    return "standing_seam_metal";
  }
  if (
    /\b(exposed[\s-]?fastener|screw[\s-]?down\s+metal|corrugated\s+metal|r[\s-]?panel|ag\s+panel)\b/.test(
      n,
    )
  ) {
    return "exposed_fastener_metal";
  }
  if (/\b(concrete\s+tile|clay\s+tile|tile\s+roof|slate\s+tile)\b/.test(n)) {
    return "concrete_clay_tile";
  }
  if (/\b(tpo|thermoplastic\s+polyolefin)\b/.test(n)) return "tpo";
  if (/\b(epdm|rubber\s+roof|rubber\s+membrane)\b/.test(n)) return "epdm";
  if (/\b(modified\s+bitumen|torch[\s-]?down|mod[\s-]?bit)\b/.test(n)) {
    return "modified_bitumen";
  }
  if (/\b(3[\s-]?tab|three[\s-]?tab)\b/.test(n)) return "three_tab_shingles";
  if (
    /\b(architectural|dimensional|laminate)\s+shingles?\b/.test(n) ||
    /\b(asphalt\s+shingles?|shingle\s+roof|new\s+shingles?|shingles?\s+install)\b/.test(
      n,
    ) ||
    /\b(re[\s-]?roof|roof\s+replacement|reroof)\b/.test(n)
  ) {
    return "architectural_shingles";
  }
  if (/\b(metal\s+roof|steel\s+roof)\b/.test(n)) return "standing_seam_metal";
  return null;
}

function inferRoofingTearOffFromNotes(notes) {
  const n = String(notes || "").toLowerCase();
  if (!n.trim()) return null;

  if (
    /\b(new\s+construction|no\s+tear[\s-]?off|without\s+tear[\s-]?off|overlay|recover|roof[\s-]?over)\b/.test(
      n,
    )
  ) {
    return "new_construction";
  }
  if (/\b((?:two|2)\s+layers?|double\s+layer|2x\s+shingle)\b/.test(n)) {
    return "two_layers";
  }
  if (/\b((?:three|3|4|four)\+?\s+layers?|3\+)\b/.test(n)) {
    return "three_plus_custom";
  }
  if (
    /\b(tile\s+removal|remove\s+tile\s+roof|tear[\s-]?off\s+tile)\b/.test(n)
  ) {
    return "tile_removal";
  }
  if (
    /\b(metal\s+roof\s+removal|remove\s+metal\s+roof|tear[\s-]?off\s+metal)\b/.test(
      n,
    )
  ) {
    return "metal_removal";
  }
  if (
    /\b(membrane\s+removal|tpo\s+removal|epdm\s+removal|tear[\s-]?off\s+(?:tpo|epdm|membrane|flat))\b/.test(
      n,
    )
  ) {
    return "membrane_removal";
  }
  if (
    /\b(tear[\s-]?off|tear\s+off|remove\s+shingles?|roof\s+demo|strip\s+roof)\b/.test(
      n,
    )
  ) {
    return "one_layer";
  }
  if (/\b(re[\s-]?roof|roof\s+replacement|reroof|new\s+roof)\b/.test(n)) {
    return "one_layer";
  }
  return null;
}

function notesImplyRoofTearOffAndInstall(notes) {
  const n = String(notes || "").toLowerCase();
  if (!n.trim()) return false;

  const tearOff = inferRoofingTearOffFromNotes(notes);
  if (!tearOff || tearOff === "new_construction") return false;

  if (inferRoofingSystemFromNotes(notes)) return true;

  return (
    /\b(?:tear[\s-]?off|tear\s+off|remove\s+shingles?|strip\s+roof)\b[^.]{0,64}\b(?:and\s+)?(?:replace|install|re[\s-]?roof)\b/.test(
      n,
    ) ||
    /\b(?:replace|install|re[\s-]?roof)\b[^.]{0,64}\b(?:tear[\s-]?off|tear\s+off|remove\s+shingles?|asphalt\s+shingles?|shingles?)\b/.test(
      n,
    ) ||
    /\basphalt\s+shingles?\b[^.]{0,64}\b(?:tear[\s-]?off|tear\s+off|remove)\b/.test(
      n,
    ) ||
    /\b(?:tear[\s-]?off|tear\s+off|remove)\b[^.]{0,64}\basphalt\s+shingles?\b/.test(
      n,
    )
  );
}

function inferChoiceFromNotes(itemId, notes) {
  const n = String(notes || "").toLowerCase();

  if (itemId === "toilet") {
    if (
      /\b(move|relocate|relocating)\b.*\btoilet\b|\btoilet\b.*\b(move|relocate)\b/.test(
        n,
      )
    )
      return "relocating";
    if (
      /\b(replace|new|remove\s+and\s+replace)\b.*\btoilet\b|\btoilet\b.*\b(replace|new)\b/.test(
        n,
      )
    ) {
      return "replacing";
    }
    if (/\btoilet\b.*\bstay|\bstay.*\btoilet\b/.test(n)) return "staying";
  }

  if (itemId === "wet_area_install" || itemId === "tub_shower") {
    if (
      /\b(stay|staying|keep(?:ing)?\s+existing)\b.*\b(tub|shower)\b|\b(tub|shower)\b.*\b(stay|staying|keep)\b/.test(
        n,
      )
    ) {
      return "staying";
    }
    if (
      /\b(prefab|pre[\s-]?fab|acrylic|fiberglass|plastic\s+pan|pan\s+insert)\b/.test(
        n,
      )
    )
      return "prefab";
    if (
      /\b(tile\s+pan|mud\s+pan|mortar\s+bed|hot\s+mop|custom\s+pan)\b/.test(n)
    )
      return "tile_pan";
    if (
      /\b(tub\s+install|new\s+tub|bathtub|alcove\s+tub|freestanding\s+tub)\b/.test(
        n,
      )
    )
      return "tub";
    if (
      /\b(tub[\s-]to[\s-]shower|new\s+shower|walk[\s-]?in\s+shower)\b/.test(n)
    )
      return "prefab";
  }

  if (itemId === "vanity") {
    if (
      /\b(remove\s+and\s+replace|replace|new)\b.*\bvanity\b|\bvanity\b.*\b(replace|new)\b/.test(
        n,
      )
    ) {
      return "replacing";
    }
  }

  if (itemId === "walls_moving") {
    const ids = inferChoicesFromNotes(itemId, notes);
    return ids[0] || null;
  }

  if (itemId === "shower_pan") {
    if (
      /\b(prefab|pre[\s-]?fab|acrylic|fiberglass|plastic\s+pan|pan\s+insert)\b/.test(
        n,
      )
    )
      return "prefab";
    if (
      /\b(tile\s+pan|mud\s+pan|mortar\s+bed|hot\s+mop|custom\s+pan)\b/.test(n)
    )
      return "tile_pan";
  }

  if (itemId === "garbage_disposal") {
    if (
      /\b(no\s+disposal|disposal\s+not\s+included|without\s+disposal)\b/.test(n)
    )
      return "not_in_scope";
    if (
      /\b(reuse|re[\s-]?use|reinstall|re[\s-]?install|existing\s+disposal)\b[^.]{0,50}\bdisposal\b|\bdisposal\b[^.]{0,50}\b(reuse|re[\s-]?use|reinstall|re[\s-]?install|existing)\b/.test(
        n,
      )
    ) {
      return "reuse_install";
    }
    if (
      /\b(new\s+disposal|replace|replacing)\b[^.]{0,50}\bdisposal\b|\bdisposal\b[^.]{0,50}\b(new|replace|replacing)\b/.test(
        n,
      )
    ) {
      return "replace_install";
    }
    if (/\b(garbage\s+disposal|disposal\s+install)\b/.test(n))
      return "replace_install";
  }

  if (itemId === "roofing_system") return inferRoofingSystemFromNotes(notes);
  if (itemId === "tear_off") return inferRoofingTearOffFromNotes(notes);

  return null;
}

function choiceToState(choiceId) {
  if (!choiceId || choiceId === "unsure") return "unsure";
  if (choiceId === "not_in_scope") return "excluded";
  return "included";
}

const WALL_LAYOUT_WORK_IDS = new Set(["remove", "add"]);

function inferChoicesFromNotes(itemId, notes) {
  const n = String(notes || "").toLowerCase();
  if (itemId === "lighting") {
    if (!/\b(?:light(?:ing)?|fixture|vanity\s+light)\b/.test(n)) return [];
    if (/\b(?:recessed|canless|wafer)\b/.test(n)) return ["new_recessed_led"];
    if (/\b(?:new\s+location|relocat|new\s+wiring)\b/.test(n)) {
      return ["new_location_with_wiring"];
    }
    if (/\b(?:decorative|pendant|chandelier)\b/.test(n)) {
      return ["decorative_existing_location"];
    }
    return ["standard_existing_location"];
  }
  if (itemId !== "walls_moving") return [];

  const ids = [];
  if (
    /\b(remove|removing|demo|demolish|tear[\s-]?out)\b[^.;]{0,60}\bwalls?\b|\bwalls?\b[^.;]{0,60}\b(remove|removing|demo|demolish|tear[\s-]?out)\b/.test(
      n,
    )
  ) {
    ids.push("remove");
  }
  if (
    /\b(add|adding|moving|new|build)\b[^.;]{0,60}\bwalls?\b|\bwalls?\b[^.;]{0,60}\b(add|adding|moving|new|build)\b/.test(
      n,
    )
  ) {
    ids.push("add");
  }
  if (
    !ids.length &&
    /\b(no\s+wall|walls?\s+not\s+moving|no\s+layout\s+changes?)\b/.test(n)
  ) {
    ids.push("no_changes");
  }
  return ids;
}

function choiceIdsToState(choiceIds) {
  const ids = Array.isArray(choiceIds) ? choiceIds : [];
  if (!ids.length) return "unsure";
  if (ids.includes("not_in_scope")) return "excluded";
  if (ids.includes("unsure") && ids.length === 1) return "unsure";
  if (ids.some((id) => WALL_LAYOUT_WORK_IDS.has(id))) return "included";
  if (ids.includes("no_changes")) return "included";
  // Multi-choice cards such as bathroom lighting are actionable as soon as
  // note interpretation selects a concrete option.
  return ids.some((id) => id !== "unsure") ? "included" : "unsure";
}

const ADDITION_CONVERSION_PROJECT_TYPES = new Set([
  "garage_conversion",
  "room_addition",
  "home_addition",
  "addition",
  "adu",
]);

const ADDITION_CONVERSION_NOTES =
  /\b(garage\s+conversion|convert(?:ing)?\s+(?:\d[\d,]*\s*[-\s]?car\s*)?garage|(?:convert(?:ing)?|conversion\s+of)\s+(?:an?\s+)?(?:existing\s+)?(?:room|bedroom|basement|attic|bonus\s+room|office|studio|shop|storage)|room\s+conversion|basement\s+conversion|attic\s+conversion|room\s+addition|home\s+addition|bedroom\s+addition|casita|\badu\b|accessory\s+dwelling|in[\s-]?law\s+suite|add(?:ition)?\s+(?:a\s+)?(?:new\s+)?(?:room|bedroom|bathroom|suite)|(?:new|add)\s+\d[\d,]*\s*sq\.?\s*ft\s+(?:room|addition|bedroom))\b/i;

const EXISTING_SHELL_CONVERSION_NOTES =
  /\b(?:garage\s+conversion|convert(?:ing)?\s+(?:\d[\d,]*\s*[-\s]?car\s*)?garage|(?:convert(?:ing)?|conversion\s+of)\s+(?:an?\s+)?(?:existing\s+)?(?:room|bedroom|basement|attic|bonus\s+room|office|studio|shop|storage|garage)|room\s+conversion|basement\s+conversion|attic\s+conversion)\b/i;

const NEW_STRUCTURE_ADDITION_NOTES =
  /\b(?:room\s+addition|home\s+addition|bedroom\s+addition|(?:add|adding)\s+(?:a\s+)?(?:new\s+)?(?:room|bedroom|bathroom|suite|wing)|(?:new|add)\s+\d[\d,]*\s*sq\.?\s*ft\s+(?:room|addition|bedroom)|detached\s+(?:adu|casita|guest\s+house)|accessory\s+dwelling\s+unit)\b/i;

const NEW_STRUCTURE_ADDITION_PROJECT_TYPES = new Set([
  "room_addition",
  "home_addition",
  "adu",
]);

const EXISTING_SHELL_CONVERSION_INCLUDED = [
  "wall_framing",
  "insulation",
  "drywall",
  "paint",
  "flooring",
  "interior_trim",
  "electrical_rough",
  "cleanup",
];

const NEW_STRUCTURE_CONVERSION_INCLUDED = [
  "framing",
  "exterior_finishes",
  "insulation",
  "drywall",
  "paint",
  "flooring",
  "interior_trim",
  "electrical_rough",
  "cleanup",
];

const GARAGE_CONVERSION_DEFAULT_EXCLUDED = new Set([
  "foundation",
  "roof_tie_in",
  "excavation",
  "sitework",
  "grading",
  "utility_trenching",
  "concrete",
]);

const EXISTING_SHELL_CONVERSION_OUT_OF_SCOPE_IDS = new Set([
  "plans_engineering",
  "permits",
  "utility_coordination",
  ...GARAGE_CONVERSION_DEFAULT_EXCLUDED,
]);

const GARAGE_CONVERSION_NOTES =
  /\b(garage\s+conversion|convert(?:ing)?\s+(?:\d[\d,]*\s*[-\s]?car\s*)?garage)\b/i;

const CONVERSION_CORE_DEFAULT_INCLUDED = [
  "framing",
  "exterior_finishes",
  "insulation",
  "drywall",
  "paint",
  "flooring",
  "interior_trim",
  "electrical_rough",
  "cleanup",
];

const ROOM_ADDITION_EXTRA_DEFAULT_INCLUDED = [
  "foundation",
  "concrete",
  "roof_tie_in",
  "windows_doors",
  "final_inspections",
];

const BATHROOM_CONVERSION_INCLUDED = [
  "plumbing_rough",
  "plumbing_trim",
  "tile",
];

function isNewStructureAdditionJob(projectType, notes) {
  const pt = String(projectType || "").toLowerCase();
  if (pt === "garage_conversion") return false;
  if (NEW_STRUCTURE_ADDITION_PROJECT_TYPES.has(pt)) return true;
  const n = String(notes || "");
  if (EXISTING_SHELL_CONVERSION_NOTES.test(n)) return false;
  return NEW_STRUCTURE_ADDITION_NOTES.test(n);
}

function isExistingShellConversionJob(templateKey, projectType, notes) {
  if (!isAdditionConversionJob(templateKey, projectType, notes)) return false;
  return !isNewStructureAdditionJob(projectType, notes);
}

function isAdditionConversionJob(templateKey, projectType, notes) {
  if (String(templateKey || "").toLowerCase() !== "addition") return false;
  const pt = String(projectType || "").toLowerCase();
  if (ADDITION_CONVERSION_PROJECT_TYPES.has(pt)) return true;
  return ADDITION_CONVERSION_NOTES.test(String(notes || ""));
}

function isGarageConversionJob(projectType, notes) {
  const pt = String(projectType || "").toLowerCase();
  if (pt === "garage_conversion") return true;
  return GARAGE_CONVERSION_NOTES.test(String(notes || ""));
}

function hasExplicitNewStructureScopeNote(itemId, notes) {
  const explicit = {
    framing:
      /\b(?:new|add)\b[^.]{0,50}\b(?:framing|shell|structure)\b|\b(?:framing|shell)\s+(?:package|lumber)\b/i,
    foundation:
      /\b(?:new|add|pour|replace|install)\b[^.]{0,50}\b(?:foundation|footings?|stem\s+wall)\b|\b(?:foundation|footings?)\s+(?:pour|work|replace)\b/i,
    concrete:
      /\b(?:new|pour|add|replace)\b[^.]{0,50}\b(?:concrete|slab\s+pour)\b/i,
    excavation: /\b(?:excavat(?:e|ion|ing)|dig\s+out)\b/i,
    sitework: /\b(?:site\s+prep|clearing|demo\s+site)\b/i,
    grading: /\b(?:grading|regrade|cut\s+fill)\b/i,
    utility_trenching: /\b(?:utility\s+trench|trench(?:ing)?\s+utilities)\b/i,
    roof_tie_in:
      /\b(?:roof\s+tie[\s-]?in|tie[\s-]?in\s+roof|new\s+roof\s+section)\b/i,
  };
  return explicit[itemId]?.test(String(notes)) ?? false;
}

/** Default shell + interior phases for garage conversions and room additions. */
function applyAdditionConversionScopeDefaults(items, options = {}) {
  const { templateKey, projectType, notes } = options;
  if (!isAdditionConversionJob(templateKey, projectType, notes)) return items;

  const n = String(notes || "");
  const garage = isGarageConversionJob(projectType, notes);
  const existingShell = isExistingShellConversionJob(
    templateKey,
    projectType,
    notes,
  );
  const defaultIncluded = new Set(
    existingShell
      ? EXISTING_SHELL_CONVERSION_INCLUDED
      : [
          ...NEW_STRUCTURE_CONVERSION_INCLUDED,
          ...(garage ? [] : ROOM_ADDITION_EXTRA_DEFAULT_INCLUDED),
        ],
  );

  if (/\b(bath(?:room)?|shower|tub|toilet|vanity|wet\s+bar)\b/i.test(n)) {
    BATHROOM_CONVERSION_INCLUDED.forEach((id) => defaultIncluded.add(id));
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  if (
    byId.get("hvac")?.state === "included" ||
    inferItemStateFromNotes("hvac", n) === "included"
  ) {
    defaultIncluded.add("hvac_startup");
  }
  if (
    byId.get("electrical_trim")?.state === "included" ||
    inferItemStateFromNotes("electrical_trim", n) === "included"
  ) {
    defaultIncluded.add("electrical_trim");
  }

  return items.map((item) => {
    if (
      existingShell &&
      EXISTING_SHELL_CONVERSION_OUT_OF_SCOPE_IDS.has(item.id) &&
      !hasExplicitNewStructureScopeNote(item.id, n)
    ) {
      return { ...item, state: "excluded" };
    }

    if (
      existingShell &&
      (item.id === "framing" || item.id === "exterior_finishes") &&
      !hasExplicitNewStructureScopeNote(item.id, n)
    ) {
      return { ...item, state: "excluded" };
    }

    if (item.state !== "unsure") return item;
    if (inferItemStateFromNotes(item.id, n) === "excluded") return item;

    if (
      existingShell &&
      item.id === "windows_doors" &&
      inferItemStateFromNotes(item.id, n) !== "included" &&
      !/\b(?:new|add|install|replace)\b[^.]{0,40}\b(?:window|exterior\s+door|sliding\s+door|entry\s+door)\b/i.test(
        n,
      )
    ) {
      return { ...item, state: "excluded" };
    }

    if (defaultIncluded.has(item.id)) {
      return { ...item, state: "included" };
    }
    return item;
  });
}

module.exports = {
  FIXTURE_CHOICE_OPTIONS,
  FIXTURE_CHOICE_NO_RELOCATE,
  SHOWER_PAN_CHOICE_OPTIONS,
  WET_AREA_INSTALL_OPTIONS,
  CHECKLIST_TEMPLATES,
  CHECKLIST_LEGEND,
  checklistTemplateKey,
  notesImplyMixedInteriorRefresh,
  notesImplyConcreteFlatwork,
  detectAdditionConversionIntent,
  inferItemStateFromNotes,
  inferChoiceFromNotes,
  inferChoicesFromNotes,
  choiceToState,
  choiceIdsToState,
  applyAdditionConversionScopeDefaults,
};
