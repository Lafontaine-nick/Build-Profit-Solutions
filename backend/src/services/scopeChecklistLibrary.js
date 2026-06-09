/**
 * Trade-aware scope checklists for Build with AI Confirm Scope.
 * Each project type loads its own checklist — not one universal list.
 */

const FIXTURE_CHOICE_OPTIONS = [
  { id: 'staying', label: 'Staying' },
  { id: 'replacing', label: 'Replacing' },
  { id: 'relocating', label: 'Relocating' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

const FIXTURE_CHOICE_NO_RELOCATE = [
  { id: 'staying', label: 'Staying' },
  { id: 'replacing', label: 'Replacing' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

const SHOWER_PAN_CHOICE_OPTIONS = [
  { id: 'prefab', label: 'Prefab pan / base' },
  { id: 'tile_pan', label: 'Tile shower pan' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

/** Tub/shower wet area — pick one install type (not staying + pan at once). */
const WET_AREA_INSTALL_OPTIONS = [
  { id: 'tub', label: 'Tub install' },
  { id: 'prefab', label: 'Prefab shower pan / base' },
  { id: 'tile_pan', label: 'Tile shower pan' },
  { id: 'staying', label: 'Keeping existing tub/shower' },
  { id: 'not_in_scope', label: 'Not in this bid' },
  { id: 'unsure', label: 'Not sure yet' },
];

const CHECKLIST_LEGEND =
  'Yes = this work is part of your bid scope. No = not part of this bid. Not sure = we will not auto-price it.';

const CHECKLIST_TEMPLATES = {
  bathroom: {
    title: 'Bathroom remodel — confirm project scope',
    intro: 'Confirm what work is in this bid before pricing.',
    items: [
      {
        id: 'demo',
        inputType: 'yes_no',
        label: 'Demo / tear-out of existing bathroom',
        helperText: 'Remove and dispose of existing fixtures, tile, and finishes.',
        category: 'demo',
      },
      {
        id: 'floor_demo',
        inputType: 'yes_no',
        label: 'Flooring demo / removal',
        helperText: 'Remove existing floor tile, LVP, vinyl, or flooring.',
        category: 'demo',
      },
      {
        id: 'tub_demo',
        inputType: 'yes_no',
        label: 'Remove existing tub',
        helperText: 'Demo and haul off the existing bathtub (alcove, drop-in, or freestanding).',
        category: 'demo',
      },
      {
        id: 'shower_floor_demo',
        inputType: 'yes_no',
        label: 'Remove existing shower pan / shower floor',
        helperText: 'Demo existing shower base, prefab pan, or shower floor tile.',
        category: 'demo',
      },
      {
        id: 'wet_area_install',
        inputType: 'choice',
        label: 'Wet area install',
        helperText: 'What is being installed? Tub, prefab pan, or tile pan — includes labor + materials.',
        options: WET_AREA_INSTALL_OPTIONS,
        category: 'shower',
      },
      {
        id: 'waterproofing',
        inputType: 'yes_no',
        label: 'Shower waterproofing & backer board',
        helperText: 'Membrane, backer, and prep before tile.',
        category: 'shower',
      },
      {
        id: 'shower_tile',
        inputType: 'yes_no',
        label: 'Shower wall tile installation',
        helperText: 'Tile labor and materials for shower walls.',
        category: 'shower',
      },
      {
        id: 'shower_floor_tile',
        inputType: 'yes_no',
        label: 'Shower floor tile installation',
        helperText: 'Tile labor and materials for shower floor (tile pan jobs).',
        category: 'shower',
      },
      {
        id: 'shower_niche',
        inputType: 'yes_no',
        label: 'Shower niche',
        helperText: 'Frame, waterproof, and tile shower niche.',
        category: 'shower',
      },
      {
        id: 'shower_bench_curb',
        inputType: 'yes_no',
        label: 'Shower bench / curb',
        helperText: 'Build, waterproof, and tile bench or curb.',
        category: 'shower',
      },
      {
        id: 'glass_door',
        inputType: 'yes_no',
        label: 'Glass shower door install',
        helperText: 'Door unit plus install.',
        category: 'shower',
      },
      {
        id: 'floor_tile',
        inputType: 'yes_no',
        label: 'Bathroom floor tile installation',
        helperText: 'Bathroom floor tile labor and materials (outside shower).',
        category: 'bathroom_floor',
      },
      {
        id: 'toilet',
        inputType: 'choice',
        label: 'Toilet',
        helperText: 'Staying, replacing, or relocating?',
        options: FIXTURE_CHOICE_OPTIONS,
        category: 'fixtures',
      },
      {
        id: 'vanity',
        inputType: 'choice',
        label: 'Vanity & countertop',
        helperText: 'Staying or replacing?',
        options: FIXTURE_CHOICE_NO_RELOCATE,
        category: 'fixtures',
      },
      {
        id: 'lighting',
        inputType: 'yes_no',
        label: 'New lighting fixtures & install',
        helperText: 'Fixture + install, not fixture cost only.',
        category: 'fixtures',
      },
      {
        id: 'exhaust_fan',
        inputType: 'yes_no',
        label: 'Exhaust fan / ventilation',
        helperText: 'Replace or install bath fan and ducting if needed.',
        category: 'fixtures',
      },
      {
        id: 'mirror_accessories',
        inputType: 'yes_no',
        label: 'Mirror & bath accessories',
        helperText: 'Mirror, towel bars, paper holder, hooks, or accessories.',
        category: 'fixtures',
      },
      {
        id: 'plumbing_rough',
        inputType: 'yes_no',
        label: 'Plumbing rough-in (new lines / relocation)',
        helperText: 'New/relocated lines, not fixture hookup only.',
        category: 'trades',
      },
      {
        id: 'electrical_rough',
        inputType: 'yes_no',
        label: 'Electrical work (new circuits / boxes)',
        helperText: 'New circuits, boxes, wiring, or GFCI changes.',
        category: 'trades',
      },
      {
        id: 'floor_prep',
        inputType: 'yes_no',
        label: 'Subfloor / floor prep',
        helperText: 'Leveling, patching, underlayment, or repair before flooring.',
        category: 'trades',
      },
      {
        id: 'drywall',
        inputType: 'yes_no',
        label: 'Drywall repair / patching',
        helperText: 'Patch or replace after layout changes.',
        category: 'trades',
      },
      {
        id: 'paint',
        inputType: 'yes_no',
        label: 'Interior painting (prep + labor + paint)',
        helperText: 'Prep, labor, and paint for walls/ceiling.',
        category: 'trades',
      },
      {
        id: 'trim',
        inputType: 'yes_no',
        label: 'Trim & baseboard install',
        helperText: 'Trim/baseboard labor and materials.',
        category: 'trades',
      },
      {
        id: 'plumbing_trim',
        inputType: 'yes_no',
        label: 'Final plumbing trim (faucets, toilet set, hookups)',
        helperText: 'Set fixtures and finish connections.',
        category: 'closeout',
      },
      {
        id: 'electrical_trim',
        inputType: 'yes_no',
        label: 'Final electrical trim (devices, plates, bulbs)',
        helperText: 'Devices, plates, and bulbs.',
        category: 'closeout',
      },
      {
        id: 'permits',
        inputType: 'yes_no',
        label: 'Permits & inspections (you pull / include in bid)',
        helperText: 'Permit fees and inspections in your price.',
        category: 'closeout',
      },
      {
        id: 'cleanup',
        inputType: 'yes_no',
        label: 'Cleanup, haul-off & disposal',
        helperText: 'Final clean, debris haul-off, dump fees.',
        category: 'closeout',
      },
    ],
  },

  kitchen: {
    title: 'Kitchen remodel — confirm project scope',
    intro: 'Confirm what work is in this bid before pricing.',
    items: [
      { id: 'demo', inputType: 'yes_no', label: 'Cabinet & appliance demo', helperText: 'Remove cabinets, counters, appliances.', category: 'demo' },
      { id: 'floor_demo', inputType: 'yes_no', label: 'Flooring demo / removal', helperText: 'Remove existing kitchen flooring.', category: 'demo' },
      { id: 'wall_demo', inputType: 'yes_no', label: 'Wall / soffit demo', helperText: 'Remove walls, soffits, or bulkheads.', category: 'demo' },
      { id: 'cabinets', inputType: 'yes_no', label: 'New cabinet install', helperText: 'Cabinet supply and installation.', category: 'cabinets' },
      { id: 'countertops', inputType: 'yes_no', label: 'Countertop fabrication & install', helperText: 'Template, fabricate, and install.', category: 'cabinets' },
      { id: 'sink_faucet', inputType: 'yes_no', label: 'Sink, faucet & disposal', helperText: 'Sink, faucet, and garbage disposal install.', category: 'cabinets' },
      { id: 'cabinet_hardware', inputType: 'yes_no', label: 'Cabinet hardware', helperText: 'Pulls, knobs, and install.', category: 'cabinets' },
      { id: 'island', inputType: 'yes_no', label: 'Kitchen island (cabinet + counter)', helperText: 'New or expanded island.', category: 'cabinets' },
      { id: 'backsplash', inputType: 'yes_no', label: 'Backsplash tile install', helperText: 'Backsplash tile labor and materials.', category: 'tile_flooring' },
      { id: 'flooring', inputType: 'yes_no', label: 'Kitchen flooring install', helperText: 'Floor material and install labor.', category: 'tile_flooring' },
      { id: 'floor_prep', inputType: 'yes_no', label: 'Subfloor / floor prep', helperText: 'Leveling or underlayment before flooring.', category: 'tile_flooring' },
      { id: 'plumbing', inputType: 'yes_no', label: 'Plumbing connections', helperText: 'Sink, dishwasher, gas line, or rough-in.', category: 'trades' },
      { id: 'electrical', inputType: 'yes_no', label: 'Electrical & GFCI / outlets', helperText: 'Circuits, outlets, and lighting.', category: 'trades' },
      { id: 'lighting', inputType: 'yes_no', label: 'Lighting fixtures & install', helperText: 'Fixture + install.', category: 'trades' },
      { id: 'appliances', inputType: 'yes_no', label: 'Appliance install & hookup', helperText: 'Mark No if customer supplies appliances.', category: 'trades' },
      { id: 'drywall', inputType: 'yes_no', label: 'Drywall / patching', helperText: 'Patch after layout changes.', category: 'trades' },
      { id: 'paint', inputType: 'yes_no', label: 'Interior painting', helperText: 'Prep, labor, and paint.', category: 'trades' },
      { id: 'trim', inputType: 'yes_no', label: 'Trim & baseboard', helperText: 'Trim install labor and materials.', category: 'trades' },
      {
        id: 'walls_moving',
        inputType: 'choice',
        label: 'Wall layout changes',
        helperText: 'Any walls removed or moved?',
        options: [
          { id: 'no_changes', label: 'No wall changes' },
          { id: 'remove', label: 'Removing wall(s)' },
          { id: 'add', label: 'Adding / moving wall(s)' },
          { id: 'not_in_scope', label: 'Not in this bid' },
          { id: 'unsure', label: 'Not sure yet' },
        ],
        category: 'trades',
      },
      { id: 'permits', inputType: 'yes_no', label: 'Permits & inspections', helperText: 'Permit fees if included in bid.', category: 'closeout' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup, haul-off & disposal', helperText: 'Final clean and haul-off.', category: 'closeout' },
    ],
  },

  landscaping: {
    title: 'Landscaping — confirm project scope',
    intro: 'Confirm landscaping scope before pricing.',
    items: [
      { id: 'demo_clearing', inputType: 'yes_no', label: 'Demo / clearing', category: 'sitework' },
      { id: 'grading', inputType: 'yes_no', label: 'Grading', category: 'sitework' },
      { id: 'soil_prep', inputType: 'yes_no', label: 'Soil prep', category: 'sitework' },
      { id: 'irrigation', inputType: 'yes_no', label: 'Irrigation', category: 'landscape' },
      { id: 'sod_turf', inputType: 'yes_no', label: 'Sod / turf', category: 'landscape' },
      { id: 'rock_mulch', inputType: 'yes_no', label: 'Rock / mulch', category: 'landscape' },
      { id: 'plants_trees', inputType: 'yes_no', label: 'Plants / trees', category: 'landscape' },
      { id: 'pavers', inputType: 'yes_no', label: 'Pavers', category: 'hardscape' },
      { id: 'concrete', inputType: 'yes_no', label: 'Concrete flatwork', category: 'hardscape' },
      { id: 'drainage', inputType: 'yes_no', label: 'Drainage', category: 'sitework' },
      { id: 'landscape_lighting', inputType: 'yes_no', label: 'Landscape lighting', category: 'electrical' },
      { id: 'mobilization', inputType: 'yes_no', label: 'Equipment / mobilization', category: 'soft_costs' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup, haul-off & disposal', category: 'closeout' },
    ],
  },

  plumbing_service: {
    title: 'Plumbing service — confirm scope',
    intro: 'Confirm plumbing service scope before pricing.',
    items: [
      { id: 'service_call', inputType: 'yes_no', label: 'Service call / diagnosis', category: 'service' },
      { id: 'fixture_repair', inputType: 'yes_no', label: 'Fixture repair', category: 'service' },
      { id: 'fixture_replace', inputType: 'yes_no', label: 'Fixture replacement', category: 'service' },
      { id: 'drain_cleaning', inputType: 'yes_no', label: 'Drain cleaning', category: 'service' },
      { id: 'water_line', inputType: 'yes_no', label: 'Water line repair', category: 'service' },
      { id: 'sewer_line', inputType: 'yes_no', label: 'Sewer line repair', category: 'service' },
      { id: 'plumbing_rough', inputType: 'yes_no', label: 'Rough-in', category: 'service' },
      { id: 'plumbing_trim', inputType: 'yes_no', label: 'Trim-out', category: 'service' },
      { id: 'parts_materials', inputType: 'yes_no', label: 'Parts / materials', category: 'service' },
      { id: 'emergency_fee', inputType: 'yes_no', label: 'Emergency / after-hours fee', category: 'soft_costs' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup & disposal', category: 'closeout' },
    ],
  },

  framing: {
    title: 'Framing — confirm project scope',
    intro: 'Confirm framing scope before pricing.',
    items: [
      { id: 'layout', inputType: 'yes_no', label: 'Layout', category: 'framing' },
      { id: 'wall_framing', inputType: 'yes_no', label: 'Wall framing', category: 'framing' },
      { id: 'openings', inputType: 'yes_no', label: 'Door / window openings', category: 'framing' },
      { id: 'blocking', inputType: 'yes_no', label: 'Blocking / backing', category: 'framing' },
      { id: 'shear_sheathing', inputType: 'yes_no', label: 'Shear / sheathing', category: 'framing' },
      { id: 'hardware', inputType: 'yes_no', label: 'Hardware / connectors', category: 'framing' },
      { id: 'materials_package', inputType: 'yes_no', label: 'Material package', category: 'framing' },
      { id: 'labor', inputType: 'yes_no', label: 'Framing labor', category: 'framing' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup & disposal', category: 'closeout' },
    ],
  },

  roofing: {
    title: 'Roofing — confirm project scope',
    intro: 'Confirm roofing scope before pricing.',
    items: [
      { id: 'tear_off', inputType: 'yes_no', label: 'Tear-off / removal', helperText: 'Remove existing shingles or roofing.', category: 'roof' },
      { id: 'decking_repair', inputType: 'yes_no', label: 'Decking repair / replace', helperText: 'Repair or replace roof sheathing.', category: 'roof' },
      { id: 'underlayment', inputType: 'yes_no', label: 'Underlayment / ice & water', category: 'roof' },
      { id: 'shingles_roofing', inputType: 'yes_no', label: 'Shingles / roofing install', helperText: 'Main roofing material and labor.', category: 'roof' },
      { id: 'flashing', inputType: 'yes_no', label: 'Flashing (valleys, walls, chimneys)', category: 'roof' },
      { id: 'vents_penetrations', inputType: 'yes_no', label: 'Vents & penetrations', category: 'roof' },
      { id: 'gutters_downspouts', inputType: 'yes_no', label: 'Gutters & downspouts', category: 'exterior' },
      { id: 'permits', inputType: 'yes_no', label: 'Permits & inspections', category: 'closeout' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup, haul-off & disposal', category: 'closeout' },
    ],
  },

  hvac: {
    title: 'HVAC — confirm project scope',
    intro: 'Confirm HVAC scope before pricing.',
    items: [
      { id: 'service_call', inputType: 'yes_no', label: 'Service call / diagnosis', category: 'service' },
      { id: 'equipment_replace', inputType: 'yes_no', label: 'Equipment replacement (furnace / AC / heat pump)', category: 'equipment' },
      { id: 'ductwork', inputType: 'yes_no', label: 'Ductwork (new / modify / seal)', category: 'distribution' },
      { id: 'ventilation', inputType: 'yes_no', label: 'Ventilation / exhaust', category: 'distribution' },
      { id: 'refrigerant', inputType: 'yes_no', label: 'Refrigerant / line set', category: 'equipment' },
      { id: 'thermostat', inputType: 'yes_no', label: 'Thermostat / controls', category: 'equipment' },
      { id: 'permits', inputType: 'yes_no', label: 'Permits & inspections', category: 'closeout' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup & disposal', category: 'closeout' },
    ],
  },

  deck_patio: {
    title: 'Deck & patio — confirm project scope',
    intro: 'Confirm deck or patio scope before pricing.',
    items: [
      { id: 'demo_removal', inputType: 'yes_no', label: 'Demo / removal of existing deck or patio', category: 'demo' },
      { id: 'footings_piers', inputType: 'yes_no', label: 'Footings / piers / posts', category: 'structure' },
      { id: 'framing_structure', inputType: 'yes_no', label: 'Framing / structure', category: 'structure' },
      { id: 'decking', inputType: 'yes_no', label: 'Decking / surface install', category: 'surface' },
      { id: 'railing', inputType: 'yes_no', label: 'Railing / guardrails', category: 'surface' },
      { id: 'stairs', inputType: 'yes_no', label: 'Stairs / steps', category: 'surface' },
      { id: 'staining_sealing', inputType: 'yes_no', label: 'Stain / seal / finish', category: 'finish' },
      { id: 'concrete_patio', inputType: 'yes_no', label: 'Concrete patio / flatwork', category: 'hardscape' },
      { id: 'permits', inputType: 'yes_no', label: 'Permits & inspections', category: 'closeout' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup, haul-off & disposal', category: 'closeout' },
    ],
  },

  concrete: {
    title: 'Concrete — confirm project scope',
    intro: 'Confirm concrete scope before pricing.',
    items: [
      { id: 'demo_removal', inputType: 'yes_no', label: 'Demo / removal', category: 'demo' },
      { id: 'site_prep', inputType: 'yes_no', label: 'Site prep / grading', category: 'sitework' },
      { id: 'forms', inputType: 'yes_no', label: 'Forms / layout', category: 'pour' },
      { id: 'reinforcement', inputType: 'yes_no', label: 'Rebar / mesh / reinforcement', category: 'pour' },
      { id: 'pour_flatwork', inputType: 'yes_no', label: 'Pour flatwork (slab / patio / walk)', category: 'pour' },
      { id: 'pour_foundation', inputType: 'yes_no', label: 'Foundation / footings pour', category: 'pour' },
      { id: 'finish_seal', inputType: 'yes_no', label: 'Finish / broom / seal / cure', category: 'finish' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup & disposal', category: 'closeout' },
    ],
  },

  excavation: {
    title: 'Excavation — confirm project scope',
    intro: 'Confirm excavation scope before pricing.',
    items: [
      { id: 'mobilization', inputType: 'yes_no', label: 'Mobilization / equipment', category: 'sitework' },
      { id: 'clearing', inputType: 'yes_no', label: 'Clearing / stripping', category: 'sitework' },
      { id: 'excavation', inputType: 'yes_no', label: 'Excavation / cut', category: 'earthwork' },
      { id: 'trenching', inputType: 'yes_no', label: 'Trenching (utilities / drainage)', category: 'earthwork' },
      { id: 'grading', inputType: 'yes_no', label: 'Grading / compaction', category: 'earthwork' },
      { id: 'backfill', inputType: 'yes_no', label: 'Backfill / import fill', category: 'earthwork' },
      { id: 'haul_off', inputType: 'yes_no', label: 'Haul-off / dump fees', category: 'closeout' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup & restoration', category: 'closeout' },
    ],
  },

  drywall: {
    title: 'Drywall — confirm project scope',
    intro: 'Confirm drywall scope before pricing.',
    items: [
      { id: 'demo_removal', inputType: 'yes_no', label: 'Demo / removal', category: 'demo' },
      { id: 'hang', inputType: 'yes_no', label: 'Hang drywall', category: 'drywall' },
      { id: 'finish_tape', inputType: 'yes_no', label: 'Tape / mud / finish', category: 'drywall' },
      { id: 'texture', inputType: 'yes_no', label: 'Texture / skim coat', category: 'drywall' },
      { id: 'patch_repair', inputType: 'yes_no', label: 'Patch / repair only', category: 'drywall' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup & disposal', category: 'closeout' },
    ],
  },

  painting: {
    title: 'Painting — confirm project scope',
    intro: 'Confirm painting scope before pricing.',
    items: [
      { id: 'prep', inputType: 'yes_no', label: 'Surface prep / masking', category: 'prep' },
      { id: 'interior_paint', inputType: 'yes_no', label: 'Interior paint (walls / ceiling)', category: 'paint' },
      { id: 'exterior_paint', inputType: 'yes_no', label: 'Exterior paint', category: 'paint' },
      { id: 'trim_paint', inputType: 'yes_no', label: 'Trim / doors / cabinets paint', category: 'paint' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup & disposal', category: 'closeout' },
    ],
  },

  room_remodel: {
    title: 'Interior remodel — confirm project scope',
    intro: 'Multi-trade remodel — confirm scope before pricing.',
    items: [
      { id: 'demo', inputType: 'yes_no', label: 'Demo / selective tear-out', category: 'scope' },
      { id: 'framing', inputType: 'yes_no', label: 'Framing or layout changes', category: 'structural' },
      { id: 'plumbing', inputType: 'yes_no', label: 'Plumbing work', category: 'plumbing' },
      { id: 'electrical', inputType: 'yes_no', label: 'Electrical work', category: 'electrical' },
      { id: 'hvac', inputType: 'yes_no', label: 'HVAC work', category: 'hvac' },
      { id: 'drywall', inputType: 'yes_no', label: 'Drywall hang / finish', category: 'finishes' },
      { id: 'flooring', inputType: 'yes_no', label: 'Flooring install', category: 'flooring' },
      { id: 'paint', inputType: 'yes_no', label: 'Interior painting', category: 'finishes' },
      { id: 'trim', inputType: 'yes_no', label: 'Trim & doors', category: 'finishes' },
      { id: 'permits', inputType: 'yes_no', label: 'Permits & inspections', category: 'soft_costs' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup, haul-off & disposal', category: 'scope' },
    ],
  },

  addition: {
    title: 'Addition / conversion — confirm scope phases',
    intro: 'Mark each phase Yes if it is part of this bid.',
    items: [
      { id: 'plans_engineering', inputType: 'yes_no', label: 'Plans / engineering', category: 'precon' },
      { id: 'permits', inputType: 'yes_no', label: 'Permits / fees', category: 'precon' },
      { id: 'utility_coordination', inputType: 'yes_no', label: 'Utility coordination', category: 'precon' },
      { id: 'sitework', inputType: 'yes_no', label: 'Site prep', category: 'sitework' },
      { id: 'excavation', inputType: 'yes_no', label: 'Excavation', category: 'sitework' },
      { id: 'grading', inputType: 'yes_no', label: 'Grading', category: 'sitework' },
      { id: 'utility_trenching', inputType: 'yes_no', label: 'Utility trenching', category: 'sitework' },
      { id: 'foundation', inputType: 'yes_no', label: 'Footings / slab / foundation', category: 'foundation' },
      { id: 'concrete', inputType: 'yes_no', label: 'Concrete', category: 'foundation' },
      { id: 'framing', inputType: 'yes_no', label: 'Framing / shell', category: 'shell' },
      { id: 'roof_tie_in', inputType: 'yes_no', label: 'Roofing / tie-in', category: 'shell' },
      { id: 'windows_doors', inputType: 'yes_no', label: 'Windows & exterior doors', category: 'shell' },
      { id: 'exterior_finishes', inputType: 'yes_no', label: 'Exterior finishes', category: 'shell' },
      { id: 'plumbing_rough', inputType: 'yes_no', label: 'Rough plumbing', category: 'mep' },
      { id: 'electrical_rough', inputType: 'yes_no', label: 'Rough electrical', category: 'mep' },
      { id: 'hvac', inputType: 'yes_no', label: 'HVAC', category: 'mep' },
      { id: 'insulation', inputType: 'yes_no', label: 'Insulation', category: 'interior' },
      { id: 'drywall', inputType: 'yes_no', label: 'Drywall', category: 'interior' },
      { id: 'paint', inputType: 'yes_no', label: 'Paint', category: 'interior' },
      { id: 'flooring', inputType: 'yes_no', label: 'Flooring', category: 'interior' },
      { id: 'cabinets_counters', inputType: 'yes_no', label: 'Cabinets & counters', category: 'interior' },
      { id: 'tile', inputType: 'yes_no', label: 'Tile', category: 'interior' },
      { id: 'interior_trim', inputType: 'yes_no', label: 'Interior doors / trim', category: 'interior' },
      { id: 'plumbing_trim', inputType: 'yes_no', label: 'Plumbing fixtures / trim-out', category: 'trimout' },
      { id: 'electrical_trim', inputType: 'yes_no', label: 'Electrical devices / fixtures', category: 'trimout' },
      { id: 'hvac_startup', inputType: 'yes_no', label: 'HVAC registers / startup', category: 'trimout' },
      { id: 'appliances', inputType: 'yes_no', label: 'Appliances', category: 'trimout' },
      { id: 'final_inspections', inputType: 'yes_no', label: 'Final inspections', category: 'closeout' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup & disposal', category: 'closeout' },
      { id: 'contingency', inputType: 'yes_no', label: 'Contingency allowance', category: 'closeout' },
    ],
  },

  ground_up: {
    title: 'Ground-up build — confirm planning scope',
    intro: 'New construction — mark Yes only for work in this bid.',
    items: [
      { id: 'plans_engineering', inputType: 'yes_no', label: 'Plans / engineering', category: 'precon' },
      { id: 'permits', inputType: 'yes_no', label: 'Permits / fees', category: 'precon' },
      { id: 'sitework', inputType: 'yes_no', label: 'Sitework & excavation', category: 'sitework' },
      { id: 'foundation', inputType: 'yes_no', label: 'Foundation', category: 'structural' },
      { id: 'framing', inputType: 'yes_no', label: 'Framing', category: 'structural' },
      { id: 'roofing', inputType: 'yes_no', label: 'Roofing', category: 'exterior' },
      { id: 'exterior', inputType: 'yes_no', label: 'Exterior finishes', category: 'exterior' },
      { id: 'mep_rough', inputType: 'yes_no', label: 'MEP rough-in', category: 'mep' },
      { id: 'insulation', inputType: 'yes_no', label: 'Insulation', category: 'envelope' },
      { id: 'drywall', inputType: 'yes_no', label: 'Drywall', category: 'finishes' },
      { id: 'cabinets_counters', inputType: 'yes_no', label: 'Cabinets & countertops', category: 'finishes' },
      { id: 'tile_flooring', inputType: 'yes_no', label: 'Tile & flooring', category: 'finishes' },
      { id: 'paint_trim', inputType: 'yes_no', label: 'Paint & trim', category: 'finishes' },
      { id: 'appliances', inputType: 'yes_no', label: 'Appliances', category: 'fixtures' },
      { id: 'utility_taps', inputType: 'yes_no', label: 'Utility taps / connections', category: 'sitework' },
      { id: 'contingency', inputType: 'yes_no', label: 'Contingency allowance', category: 'soft_costs' },
      { id: 'overhead_profit', inputType: 'yes_no', label: 'Builder overhead & profit', category: 'soft_costs' },
      { id: 'cleanup', inputType: 'yes_no', label: 'Cleanup & disposal', category: 'closeout' },
    ],
  },
};

/** Note patterns → default Yes for checklist item ids. */
const CHECKLIST_YES_HINTS = {
  demo: /\b(demo|demolition|tear\s*out|gut|remove)\b/,
  floor_demo: /\b(floor\s+demo|remove\s+(?:floor|tile|lvp|vinyl|flooring))\b/,
  tub_demo: /\b(remove|demo|tear[\s-]?out|rip[\s-]?out).*\b(tub|bathtub)\b|\b(tub|bathtub)\b.*\b(remove|demo|tear[\s-]?out)\b/,
  shower_floor_demo:
    /\b(remove|demo|tear[\s-]?out).*\b(shower\s+(?:pan|floor|base)|pan\s+insert|mud\s+pan)\b|\b(shower\s+(?:pan|floor|base)|prefab\s+pan)\b.*\b(remove|demo|tear[\s-]?out)\b/,
  shower_tile: /\b(shower\s+tile|tile\s+shower|new\s+shower\s+tile)\b/,
  wet_area_install: /\b(tub\s+install|new\s+tub|shower\s+pan|prefab\s+pan|tile\s+pan|mud\s+pan|tub[\s-]to[\s-]shower)\b/,
  shower_floor_tile: /\b(shower\s+floor\s+tile|tile\s+shower\s+floor)\b/,
  shower_niche: /\b(shower\s+niche|tile\s+niche|niche)\b/,
  shower_bench_curb: /\b(shower\s+bench|curb|bench)\b/,
  floor_tile: /\b(floor\s+tile|tile\s+floor|new\s+floor\s+tile)\b/,
  floor_prep: /\b(floor\s+prep|subfloor|level(?:ing)?|underlayment)\b/,
  exhaust_fan: /\b(exhaust\s+fan|bath\s+fan|ventilation)\b/,
  mirror_accessories: /\b(mirror|towel\s+bar|accessories|robe\s+hook)\b/,
  cabinets: /\b(cabinet|new\s+cabinets)\b/,
  countertops: /\b(countertop|quartz|granite|install\s+new\s+countertops?)\b/,
  backsplash: /\b(backsplash)\b/,
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
  permits: /\b(permit)\b/,
  cleanup: /\b(cleanup|disposal|dumpster|haul[\s-]?off)\b/,
};

const CHECKLIST_NO_HINTS = {
  appliances: /\b(no\s+appliances|appliances\s+not\s+included|owner\s+appliances)\b/,
  permits: /\b(no\s+permits|permits\s+not\s+included|owner\s+pulls?\s+permits)\b/,
};

function notesText(draft, originalNotes) {
  return String(originalNotes || draft?.originalNotes || '').toLowerCase();
}

function checklistTemplateKey(draft, estimateTier) {
  const projectType = String(draft.projectType || 'other').toLowerCase();
  const notes = notesText(draft, null);

  if (estimateTier === 'ground_up') return 'ground_up';
  if (estimateTier === 'addition') return 'addition';

  if (projectType === 'bathroom' || /\bbath(?:room)?\s+remodel\b/i.test(notes)) return 'bathroom';
  if (projectType === 'kitchen' || /\bkitchen\s+remodel\b/i.test(notes)) return 'kitchen';
  if (
    projectType === 'landscaping' ||
    /\b(landscap(?:e|ing)|irrigation|sod|mulch|pavers|grading)\b/i.test(notes)
  ) {
    return 'landscaping';
  }
  if (projectType === 'plumbing_service' || /\b(plumb(?:ing)?\s+service|drain\s+clean|water\s+heater)\b/i.test(notes)) {
    return 'plumbing_service';
  }
  if (projectType === 'framing' || /\b(fram(?:e|ing)\s+(?:wall|house|addition))\b/i.test(notes)) {
    return 'framing';
  }
  if (projectType === 'roofing' || /\b(roof(?:ing)?\s+(?:replace|install|tear)|\d+\s*squares?|\bshingle)\b/i.test(notes)) {
    return 'roofing';
  }
  if (projectType === 'hvac' || /\b(hvac|furnace|air\s+condition|heat\s+pump|duct(?:work)?)\b/i.test(notes)) {
    return 'hvac';
  }
  if (
    projectType === 'deck_patio' ||
    /\b(deck\s+build|new\s+deck|patio\s+build|composite\s+deck)\b/i.test(notes)
  ) {
    return 'deck_patio';
  }
  if (
    projectType === 'concrete' ||
    /\b(concrete\s+(?:patio|slab|drive|flatwork)|pour\s+concrete)\b/i.test(notes)
  ) {
    return 'concrete';
  }
  if (projectType === 'excavation' || /\b(excavat(?:e|ion)|trench(?:ing)?|grading\s+job)\b/i.test(notes)) {
    return 'excavation';
  }
  if (projectType === 'drywall' || /\b(drywall\s+(?:hang|finish|patch)|sheetrock)\b/i.test(notes)) {
    return 'drywall';
  }
  if (
    projectType === 'painting' ||
    (/\b(paint(?:ing)?|repaint)\b/i.test(notes) && !/\b(kitchen|bath(?:room)?)\s+remodel\b/i.test(notes))
  ) {
    return 'painting';
  }

  if (estimateTier === 'room_remodel') return 'room_remodel';
  return 'room_remodel';
}

function inferItemStateFromNotes(itemId, notes) {
  const n = String(notes || '').toLowerCase();
  if (CHECKLIST_NO_HINTS[itemId]?.test(n)) return 'excluded';
  if (CHECKLIST_YES_HINTS[itemId]?.test(n)) return 'included';
  return 'unsure';
}

function inferChoiceFromNotes(itemId, notes) {
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
    if (/\b(no\s+wall|walls?\s+not\s+moving)\b/.test(n)) return 'no_changes';
    if (/\b(remove|removing)\b.*\bwall/.test(n)) return 'remove';
    if (/\b(add|adding|moving)\b.*\bwall/.test(n)) return 'add';
  }

  if (itemId === 'shower_pan') {
    if (/\b(prefab|pre[\s-]?fab|acrylic|fiberglass|plastic\s+pan|pan\s+insert)\b/.test(n)) return 'prefab';
    if (/\b(tile\s+pan|mud\s+pan|mortar\s+bed|hot\s+mop|custom\s+pan)\b/.test(n)) return 'tile_pan';
  }

  return null;
}

function choiceToState(choiceId) {
  if (!choiceId || choiceId === 'unsure') return 'unsure';
  if (choiceId === 'not_in_scope') return 'excluded';
  return 'included';
}

module.exports = {
  FIXTURE_CHOICE_OPTIONS,
  FIXTURE_CHOICE_NO_RELOCATE,
  SHOWER_PAN_CHOICE_OPTIONS,
  WET_AREA_INSTALL_OPTIONS,
  CHECKLIST_TEMPLATES,
  CHECKLIST_LEGEND,
  checklistTemplateKey,
  inferItemStateFromNotes,
  inferChoiceFromNotes,
  choiceToState,
};
