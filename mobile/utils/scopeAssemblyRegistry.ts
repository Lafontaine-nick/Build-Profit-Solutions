import type { IntelligenceConfidence, IntelligenceSeverity, MeasurementType, PricingSourceKind, ScopeValidationNotice, UnitCode } from '@/utils/scopeIntelligence';

export type AssemblyCompleteness = 'complete' | 'mostly_complete' | 'incomplete' | 'unknown';
export type AssemblyComponentStatusType =
  | 'included_confirmed'
  | 'included_assumed'
  | 'separately_priced'
  | 'excluded_confirmed'
  | 'missing'
  | 'not_applicable'
  | 'unknown'
  | 'possible_overlap';

export type ScopeInclusionMetadata = {
  includedComponentKeys?: string[];
  excludedComponentKeys?: string[];
  unknownComponentKeys?: string[];
  notes?: string[];
  source:
    | 'project_quote'
    | 'user_entered'
    | 'saved_rate'
    | 'company_rate'
    | 'benchmark'
    | 'national_average'
    | 'unknown';
  confirmedByUser?: boolean;
  lastConfirmedAt?: string;
};

export type AssemblyComponentDefinition = {
  key: string;
  label: string;
  relatedScopeKeys?: string[];
  relatedTrades?: string[];
  normallyIncluded: boolean;
  canBeSeparateLineItem: boolean;
  quantityBasis?: MeasurementType[];
  unitOptions?: UnitCode[];
  description?: string;
  optional?: boolean;
};

export type ConditionalAssemblyComponent = AssemblyComponentDefinition & {
  appliesWhenProjectContexts?: string[];
  appliesWhenScopeKeysPresent?: string[];
};

export type AssemblyDefinition = {
  key: string;
  name: string;
  trade: string;
  applicableScopeKeys: string[];
  applicableProjectContexts?: string[];
  requiredComponents: AssemblyComponentDefinition[];
  optionalComponents?: AssemblyComponentDefinition[];
  conditionalComponents?: ConditionalAssemblyComponent[];
  defaultIncludedComponents?: string[];
  defaultExcludedComponents?: string[];
  overlapGroups?: string[];
  dependencyKeys?: string[];
};

export type AssemblyComponentStatus = {
  key: string;
  label: string;
  status: AssemblyComponentStatusType;
  severity: IntelligenceSeverity;
  relatedScopeKeys: string[];
  message: string;
};

export type ScopeOverlapNotice = {
  key: string;
  componentKey: string;
  componentLabel: string;
  relatedScopeKeys: string[];
  severity: IntelligenceSeverity;
  message: string;
  resolutionOptions: string[];
};

export type ScopeGapNotice = {
  key: string;
  scopeGroupKey: string;
  label: string;
  severity: IntelligenceSeverity;
  message: string;
  suggestedScopeKeys: string[];
};

export type ScopeDependencyNotice = {
  key: string;
  dependencyKey: string;
  label: string;
  severity: IntelligenceSeverity;
  message: string;
  suggestedScopeKeys: string[];
};

export type AssemblyEvaluationResult = {
  assemblyKey?: string;
  scopeItemKey: string;
  completeness: AssemblyCompleteness;
  confidence: IntelligenceConfidence;
  includedComponents: AssemblyComponentStatus[];
  missingComponents: AssemblyComponentStatus[];
  excludedComponents: AssemblyComponentStatus[];
  unknownComponents: AssemblyComponentStatus[];
  possibleOverlaps: ScopeOverlapNotice[];
  dependencies: ScopeDependencyNotice[];
  notices: ScopeValidationNotice[];
};

type ScopeRequirement = {
  key: string;
  label: string;
  scopeKeys: string[];
  severity?: IntelligenceSeverity;
};

type ProjectScopeTemplate = {
  key: string;
  projectContexts: string[];
  requiredScopeGroups: ScopeRequirement[];
  optionalScopeGroups?: ScopeRequirement[];
};

type ScopeOverlapDefinition = {
  key: string;
  componentKey: string;
  componentLabel: string;
  relatedScopeKeys: string[];
  severity: IntelligenceSeverity;
  message: string;
  resolutionOptions: string[];
};

type DependencyDefinition = {
  key: string;
  label: string;
  sourceScopeKeys: string[];
  requiredScopeKeys: string[];
  severity: IntelligenceSeverity;
  message: string;
};

const c = (
  key: string,
  label: string,
  relatedScopeKeys: string[] = [],
  normallyIncluded = true,
  optional = false
): AssemblyComponentDefinition => ({
  key,
  label,
  relatedScopeKeys,
  normallyIncluded,
  canBeSeparateLineItem: relatedScopeKeys.length > 0,
  optional,
});

const req = (key: string, label: string, scopeKeys: string[], severity: IntelligenceSeverity = 'review'): ScopeRequirement => ({
  key,
  label,
  scopeKeys,
  severity,
});

const ASSEMBLIES: AssemblyDefinition[] = [
  {
    key: 'plans_engineering_assembly',
    name: 'Plans and engineering',
    trade: 'preconstruction',
    applicableScopeKeys: ['plans_engineering'],
    requiredComponents: [
      c('architectural_plans', 'Architectural plans'),
      c('structural_engineering', 'Structural engineering'),
      c('site_plan', 'Site plan', ['survey']),
    ],
    optionalComponents: [
      c('mechanical_design', 'Mechanical design', [], false, true),
      c('electrical_design', 'Electrical design', [], false, true),
      c('plumbing_design', 'Plumbing design', [], false, true),
      c('energy_calculations', 'Energy calculations', [], false, true),
      c('civil_engineering', 'Civil engineering', ['survey'], false, true),
      c('permit_responses', 'Permit responses', ['permits'], false, true),
    ],
    defaultIncludedComponents: ['architectural_plans', 'site_plan'],
  },
  {
    key: 'permits_fees_assembly',
    name: 'Permits and fees',
    trade: 'preconstruction',
    applicableScopeKeys: ['permits'],
    requiredComponents: [c('building_permit', 'Building permit'), c('plan_review', 'Plan review')],
    optionalComponents: [
      c('mechanical_permit', 'Mechanical permit', ['hvac'], false, true),
      c('electrical_permit', 'Electrical permit', ['electrical_rough'], false, true),
      c('plumbing_permit', 'Plumbing permit', ['plumbing_rough'], false, true),
      c('impact_fees', 'Impact fees', [], false, true),
      c('utility_connection_fees', 'Utility connection fees', ['utility_coordination'], false, true),
      c('meter_fees', 'Meter fees', ['utility_coordination'], false, true),
    ],
    defaultIncludedComponents: ['building_permit', 'plan_review'],
    defaultExcludedComponents: ['impact_fees', 'utility_connection_fees'],
  },
  {
    key: 'demolition_cleanup_assembly',
    name: 'Clearing and demolition',
    trade: 'demolition',
    applicableScopeKeys: ['demo', 'floor_demo', 'wall_demo', 'appliance_removal'],
    requiredComponents: [c('removal', 'Removal'), c('loading', 'Loading'), c('protection', 'Protection of existing work')],
    optionalComponents: [
      c('site_clearing', 'Site clearing', ['sitework'], false, true),
      c('sawcutting', 'Sawcutting', ['concrete'], false, true),
      c('haul_off', 'Haul-off', ['haul_off', 'cleanup'], false, true),
      c('dump_fees', 'Dump fees', ['haul_off'], false, true),
      c('dust_control', 'Dust control', [], false, true),
    ],
    defaultIncludedComponents: ['removal', 'loading'],
    overlapGroups: ['demolition_cleanup'],
  },
  {
    key: 'excavation_assembly',
    name: 'Excavation',
    trade: 'sitework',
    applicableScopeKeys: ['excavation'],
    requiredComponents: [c('equipment', 'Equipment'), c('operator', 'Operator'), c('excavation', 'Excavation')],
    optionalComponents: [
      c('loading', 'Loading', ['haul_off'], false, true),
      c('stockpiling', 'Stockpiling', [], false, true),
      c('export', 'Export', ['haul_off'], false, true),
      c('dump_fees', 'Dump fees', ['haul_off'], false, true),
      c('backfill', 'Backfill', ['backfill'], false, true),
      c('compaction', 'Compaction', ['compaction'], false, true),
      c('testing', 'Testing', [], false, true),
      c('shoring', 'Shoring', [], false, true),
    ],
    defaultIncludedComponents: ['equipment', 'operator', 'excavation'],
    overlapGroups: ['excavation_trenching'],
  },
  {
    key: 'utility_trenching_assembly',
    name: 'Utility trenching',
    trade: 'sitework',
    applicableScopeKeys: ['utility_trenching'],
    requiredComponents: [c('layout', 'Layout'), c('trench_excavation', 'Trench excavation'), c('backfill', 'Backfill', ['backfill'])],
    optionalComponents: [
      c('sawcutting', 'Sawcutting', ['concrete'], false, true),
      c('bedding', 'Bedding', [], false, true),
      c('compaction', 'Compaction', ['compaction'], false, true),
      c('surface_restoration', 'Surface restoration', ['concrete', 'pavers'], false, true),
      c('spoils_export', 'Spoils export', ['haul_off'], false, true),
      c('utility_coordination', 'Utility coordination', ['utility_coordination'], false, true),
    ],
    defaultIncludedComponents: ['layout', 'trench_excavation'],
    overlapGroups: ['excavation_trenching'],
  },
  {
    key: 'grading_assembly',
    name: 'Grading',
    trade: 'sitework',
    applicableScopeKeys: ['grading', 'sitework'],
    requiredComponents: [c('rough_grading', 'Rough grading'), c('finish_elevation', 'Finish elevation'), c('drainage_shaping', 'Drainage shaping')],
    optionalComponents: [
      c('cut', 'Cut', ['excavation'], false, true),
      c('fill', 'Fill', ['backfill'], false, true),
      c('import', 'Import material', [], false, true),
      c('export', 'Export', ['haul_off'], false, true),
      c('compaction', 'Compaction', ['compaction'], false, true),
      c('testing', 'Testing', [], false, true),
    ],
    defaultIncludedComponents: ['rough_grading', 'finish_elevation', 'drainage_shaping'],
  },
  {
    key: 'foundation_assembly',
    name: 'Foundation',
    trade: 'concrete',
    applicableScopeKeys: ['foundation'],
    requiredComponents: [
      c('layout', 'Layout'),
      c('excavation', 'Excavation', ['excavation']),
      c('base_preparation', 'Base preparation', ['grading', 'compaction']),
      c('formwork', 'Formwork'),
      c('reinforcement', 'Reinforcement'),
      c('concrete', 'Concrete', ['concrete']),
      c('placement', 'Placement'),
    ],
    optionalComponents: [
      c('aggregate_base', 'Aggregate base', ['rock_mulch'], false, true),
      c('footings', 'Footings', ['concrete'], false, true),
      c('stem_walls', 'Stem walls', ['concrete'], false, true),
      c('slab', 'Slab', ['concrete'], false, true),
      c('vapor_barrier', 'Vapor barrier', [], false, true),
      c('insulation', 'Insulation', ['insulation'], false, true),
      c('anchor_bolts', 'Anchor bolts', [], false, true),
      c('pumping', 'Concrete pumping', [], false, true),
      c('finishing', 'Finishing', ['pour_flatwork'], false, true),
      c('testing', 'Testing', [], false, true),
    ],
    defaultIncludedComponents: ['layout', 'formwork', 'reinforcement', 'concrete', 'placement'],
    dependencyKeys: ['foundation_needs_excavation'],
    overlapGroups: ['foundation_concrete'],
  },
  {
    key: 'concrete_flatwork_assembly',
    name: 'Concrete flatwork',
    trade: 'concrete',
    applicableScopeKeys: ['concrete', 'pour_flatwork', 'sidewalk', 'patio', 'driveway'],
    requiredComponents: [c('subgrade_preparation', 'Subgrade preparation'), c('forms', 'Forms'), c('concrete', 'Concrete'), c('placement', 'Placement'), c('finishing', 'Finishing')],
    optionalComponents: [
      c('demolition', 'Demolition', ['demo'], false, true),
      c('aggregate_base', 'Aggregate base', ['rock_mulch'], false, true),
      c('compaction', 'Compaction', ['compaction'], false, true),
      c('reinforcement', 'Reinforcement', [], false, true),
      c('pumping', 'Pumping', [], false, true),
      c('control_joints', 'Control joints', [], false, true),
      c('sealer', 'Sealer', [], false, true),
    ],
    defaultIncludedComponents: ['forms', 'concrete', 'placement', 'finishing'],
    overlapGroups: ['foundation_concrete'],
  },
  {
    key: 'framing_assembly',
    name: 'Framing',
    trade: 'framing',
    applicableScopeKeys: ['framing'],
    requiredComponents: [c('layout', 'Layout'), c('lumber', 'Lumber'), c('hardware', 'Hardware'), c('wall_framing', 'Wall framing'), c('labor', 'Labor')],
    optionalComponents: [
      c('floor_framing', 'Floor framing', [], false, true),
      c('roof_framing', 'Roof framing', ['roof_tie_in'], false, true),
      c('sheathing', 'Sheathing', ['roof_tie_in'], false, true),
      c('blocking', 'Blocking', [], false, true),
      c('headers', 'Headers', ['windows_doors'], false, true),
      c('equipment', 'Equipment', ['general_conditions'], false, true),
    ],
    defaultIncludedComponents: ['layout', 'lumber', 'hardware', 'wall_framing', 'labor'],
    overlapGroups: ['framing_roofing'],
  },
  {
    key: 'roofing_assembly',
    name: 'Roofing',
    trade: 'roofing',
    applicableScopeKeys: ['roof_tie_in', 'shingles_roofing', 'tear_off'],
    requiredComponents: [c('underlayment', 'Underlayment'), c('roofing_material', 'Roofing material'), c('labor', 'Labor'), c('cleanup', 'Cleanup', ['cleanup'])],
    optionalComponents: [
      c('tear_off', 'Tear-off', ['tear_off'], false, true),
      c('disposal', 'Disposal', ['haul_off', 'cleanup'], false, true),
      c('deck_repair', 'Deck repair allowance', ['framing'], false, true),
      c('flashing', 'Flashing', ['exterior_finishes'], false, true),
      c('drip_edge', 'Drip edge', ['exterior_finishes'], false, true),
      c('ventilation', 'Ventilation', ['hvac'], false, true),
      c('ridge_caps', 'Ridge or hip caps', [], false, true),
      c('warranty', 'Warranty', [], false, true),
    ],
    defaultIncludedComponents: ['underlayment', 'roofing_material', 'labor', 'cleanup'],
    dependencyKeys: ['roofing_deck_repair_review'],
    overlapGroups: ['framing_roofing', 'roofing_exterior'],
  },
  {
    key: 'exterior_finish_assembly',
    name: 'Siding or exterior finish',
    trade: 'exterior',
    applicableScopeKeys: ['exterior_finishes', 'exterior_paint'],
    requiredComponents: [c('weather_barrier', 'Weather-resistant barrier'), c('finish_system', 'Siding or finish system'), c('labor', 'Labor')],
    optionalComponents: [
      c('removal', 'Existing finish removal', ['demo'], false, true),
      c('flashing', 'Flashing', ['roof_tie_in'], false, true),
      c('trim', 'Exterior trim', ['trim'], false, true),
      c('painting', 'Painting or finish coat', ['exterior_paint'], false, true),
      c('scaffolding', 'Scaffolding', ['general_conditions'], false, true),
    ],
    defaultIncludedComponents: ['finish_system', 'labor'],
    overlapGroups: ['roofing_exterior'],
  },
  {
    key: 'windows_doors_assembly',
    name: 'Windows and exterior doors',
    trade: 'openings',
    applicableScopeKeys: ['windows_doors', 'windows', 'doors'],
    requiredComponents: [c('unit', 'Unit'), c('installation', 'Installation'), c('flashing', 'Flashing')],
    optionalComponents: [
      c('removal', 'Removal', ['demo'], false, true),
      c('framing_modification', 'Framing modification', ['framing'], false, true),
      c('waterproofing', 'Waterproofing', ['exterior_finishes'], false, true),
      c('interior_trim', 'Interior trim', ['trim', 'interior_trim'], false, true),
      c('painting', 'Painting', ['paint'], false, true),
      c('disposal', 'Disposal', ['haul_off'], false, true),
    ],
    defaultIncludedComponents: ['unit', 'installation'],
  },
  {
    key: 'insulation_assembly',
    name: 'Insulation',
    trade: 'insulation',
    applicableScopeKeys: ['insulation'],
    requiredComponents: [c('wall_insulation', 'Wall insulation'), c('labor', 'Labor')],
    optionalComponents: [
      c('ceiling_insulation', 'Ceiling insulation', [], false, true),
      c('roof_insulation', 'Roof insulation', [], false, true),
      c('floor_insulation', 'Floor insulation', [], false, true),
      c('air_sealing', 'Air sealing', [], false, true),
      c('vapor_retarder', 'Vapor retarder', [], false, true),
      c('sound_insulation', 'Sound insulation', [], false, true),
    ],
    defaultIncludedComponents: ['wall_insulation', 'labor'],
  },
  {
    key: 'drywall_assembly',
    name: 'Drywall',
    trade: 'drywall',
    applicableScopeKeys: ['drywall', 'hang', 'finish_tape', 'patch_repair'],
    requiredComponents: [c('board', 'Board'), c('hanging', 'Hanging'), c('taping', 'Taping'), c('joint_compound', 'Joint compound'), c('sanding', 'Sanding')],
    optionalComponents: [
      c('delivery', 'Delivery', ['general_conditions'], false, true),
      c('moisture_resistant_board', 'Moisture-resistant board', [], false, true),
      c('fire_rated_board', 'Fire-rated board', [], false, true),
      c('corner_bead', 'Corner bead', [], false, true),
      c('finish_level', 'Finish level', [], false, true),
      c('texture', 'Texture', ['paint'], false, true),
      c('cleanup', 'Cleanup', ['cleanup'], false, true),
    ],
    defaultIncludedComponents: ['board', 'hanging', 'taping', 'joint_compound', 'sanding'],
  },
  {
    key: 'painting_assembly',
    name: 'Painting',
    trade: 'painting',
    applicableScopeKeys: ['paint', 'interior_paint', 'exterior_paint'],
    requiredComponents: [c('surface_protection', 'Surface protection'), c('preparation', 'Preparation'), c('paint', 'Paint'), c('labor', 'Labor')],
    optionalComponents: [
      c('patching', 'Patching', ['drywall'], false, true),
      c('primer', 'Primer', [], false, true),
      c('ceiling_paint', 'Ceiling paint', [], false, true),
      c('trim_paint', 'Trim paint', ['trim'], false, true),
      c('door_paint', 'Door paint', ['doors'], false, true),
      c('multiple_coats', 'Multiple coats', [], false, true),
    ],
    defaultIncludedComponents: ['surface_protection', 'preparation', 'paint', 'labor'],
  },
  {
    key: 'flooring_assembly',
    name: 'Flooring',
    trade: 'flooring',
    applicableScopeKeys: ['flooring', 'floor_tile'],
    requiredComponents: [c('flooring_material', 'Flooring material'), c('installation', 'Installation'), c('waste', 'Waste')],
    optionalComponents: [
      c('existing_floor_removal', 'Existing flooring removal', ['floor_demo'], false, true),
      c('disposal', 'Disposal', ['haul_off'], false, true),
      c('subfloor_repair', 'Subfloor repair', [], false, true),
      c('leveling', 'Leveling', [], false, true),
      c('underlayment', 'Underlayment', [], false, true),
      c('transitions', 'Transitions', ['trim'], false, true),
      c('baseboard_removal', 'Baseboard removal', ['baseboard'], false, true),
      c('baseboard_installation', 'Baseboard installation', ['baseboard'], false, true),
    ],
    defaultIncludedComponents: ['flooring_material', 'installation', 'waste'],
    dependencyKeys: ['flooring_subfloor_review'],
    overlapGroups: ['flooring_baseboard'],
  },
  {
    key: 'tile_assembly',
    name: 'Tile',
    trade: 'tile',
    applicableScopeKeys: ['shower_tile', 'shower_floor_tile', 'backsplash'],
    requiredComponents: [c('substrate_preparation', 'Substrate preparation'), c('tile', 'Tile'), c('thinset', 'Thinset'), c('grout', 'Grout'), c('labor', 'Labor')],
    optionalComponents: [
      c('demolition', 'Demolition', ['demo'], false, true),
      c('backer_board', 'Backer board', [], false, true),
      c('waterproofing', 'Waterproofing', ['waterproofing'], false, true),
      c('membrane', 'Membrane', ['waterproofing'], false, true),
      c('edge_trim', 'Edge trim', ['trim'], false, true),
      c('sealer', 'Sealer', [], false, true),
    ],
    defaultIncludedComponents: ['substrate_preparation', 'tile', 'thinset', 'grout', 'labor'],
    dependencyKeys: ['tile_shower_needs_waterproofing'],
  },
  {
    key: 'cabinets_assembly',
    name: 'Cabinets',
    trade: 'cabinets',
    applicableScopeKeys: ['cabinets', 'cabinets_counters'],
    requiredComponents: [c('cabinet_boxes', 'Cabinet boxes'), c('doors_drawers', 'Doors and drawer fronts'), c('installation', 'Installation')],
    optionalComponents: [
      c('hardware', 'Hardware', [], false, true),
      c('panels', 'Panels', [], false, true),
      c('fillers', 'Fillers', ['trim'], false, true),
      c('crown', 'Crown', ['trim'], false, true),
      c('toe_kick', 'Toe kick', ['trim'], false, true),
      c('delivery', 'Delivery', ['general_conditions'], false, true),
      c('removal', 'Removal of existing cabinets', ['demo'], false, true),
      c('countertops', 'Countertops', ['countertops'], false, true),
    ],
    defaultIncludedComponents: ['cabinet_boxes', 'doors_drawers', 'installation'],
    dependencyKeys: ['cabinets_need_countertop_review'],
    overlapGroups: ['cabinets_finish_carpentry', 'cabinets_countertops'],
  },
  {
    key: 'countertops_assembly',
    name: 'Countertops',
    trade: 'countertops',
    applicableScopeKeys: ['countertops'],
    requiredComponents: [c('template', 'Template'), c('material', 'Material'), c('fabrication', 'Fabrication'), c('installation', 'Installation')],
    optionalComponents: [
      c('edge_profile', 'Edge profile', [], false, true),
      c('cutouts', 'Cutouts', ['plumbing_trim'], false, true),
      c('backsplash', 'Backsplash', ['backsplash'], false, true),
      c('support', 'Support', ['cabinets'], false, true),
      c('removal', 'Removal', ['demo'], false, true),
      c('plumbing_reconnect', 'Plumbing disconnect/reconnect', ['plumbing_trim'], false, true),
    ],
    defaultIncludedComponents: ['template', 'material', 'fabrication', 'installation'],
    overlapGroups: ['cabinets_countertops'],
  },
  {
    key: 'plumbing_rough_assembly',
    name: 'Plumbing rough-in',
    trade: 'plumbing',
    applicableScopeKeys: ['plumbing_rough'],
    requiredComponents: [c('layout', 'Layout'), c('water_piping', 'Water piping'), c('dwv_piping', 'Drain, waste, and vent piping'), c('testing', 'Testing')],
    optionalComponents: [
      c('valves', 'Valves', ['plumbing_trim'], false, true),
      c('supports', 'Supports', [], false, true),
      c('insulation', 'Insulation', ['insulation'], false, true),
      c('excavation', 'Excavation or trenching', ['utility_trenching'], false, true),
      c('permit', 'Permit', ['permits'], false, true),
    ],
    defaultIncludedComponents: ['layout', 'water_piping', 'dwv_piping', 'testing'],
    overlapGroups: ['plumbing_rough_fixtures'],
  },
  {
    key: 'plumbing_fixtures_assembly',
    name: 'Plumbing fixtures',
    trade: 'plumbing',
    applicableScopeKeys: ['plumbing_trim', 'sink_faucet', 'toilet', 'vanity'],
    requiredComponents: [c('fixture', 'Fixture'), c('connections', 'Supply and drain connections'), c('installation', 'Installation'), c('testing', 'Testing')],
    optionalComponents: [c('removal', 'Removal', ['demo'], false, true), c('disposal', 'Disposal', ['haul_off'], false, true), c('caulking', 'Caulking', [], false, true)],
    defaultIncludedComponents: ['fixture', 'connections', 'installation', 'testing'],
    dependencyKeys: ['fixtures_need_rough_or_existing'],
    overlapGroups: ['plumbing_rough_fixtures'],
  },
  {
    key: 'electrical_rough_assembly',
    name: 'Electrical rough-in',
    trade: 'electrical',
    applicableScopeKeys: ['electrical_rough'],
    requiredComponents: [c('layout', 'Layout'), c('wire', 'Wire'), c('boxes', 'Boxes'), c('rough_labor', 'Rough-in labor'), c('testing', 'Testing')],
    optionalComponents: [
      c('panels', 'Panels', [], false, true),
      c('breakers', 'Breakers', [], false, true),
      c('conduit', 'Conduit', [], false, true),
      c('grounding', 'Grounding', [], false, true),
      c('permit', 'Permit', ['permits'], false, true),
    ],
    defaultIncludedComponents: ['layout', 'wire', 'boxes', 'rough_labor', 'testing'],
    overlapGroups: ['electrical_rough_fixtures'],
  },
  {
    key: 'electrical_devices_assembly',
    name: 'Devices and fixtures',
    trade: 'electrical',
    applicableScopeKeys: ['electrical_trim', 'lighting'],
    requiredComponents: [c('devices_or_fixtures', 'Devices or fixtures'), c('installation', 'Installation'), c('testing', 'Testing')],
    optionalComponents: [c('cover_plates', 'Cover plates', [], false, true), c('controls', 'Controls', [], false, true), c('lamps', 'Lamps', [], false, true)],
    defaultIncludedComponents: ['devices_or_fixtures', 'installation', 'testing'],
    dependencyKeys: ['electrical_fixtures_need_rough_or_existing'],
    overlapGroups: ['electrical_rough_fixtures'],
  },
  {
    key: 'hvac_assembly',
    name: 'HVAC system',
    trade: 'hvac',
    applicableScopeKeys: ['hvac', 'hvac_startup', 'exhaust_fan'],
    requiredComponents: [c('equipment', 'Equipment'), c('startup', 'Startup'), c('testing', 'Testing')],
    optionalComponents: [
      c('ductwork', 'Ductwork', [], false, true),
      c('registers', 'Registers and grilles', [], false, true),
      c('electrical_connection', 'Electrical connection', ['electrical_rough'], false, true),
      c('thermostat', 'Thermostat', ['electrical_trim'], false, true),
      c('condensate', 'Condensate', ['plumbing_rough'], false, true),
      c('permit', 'Permit', ['permits'], false, true),
      c('disposal', 'Disposal', ['haul_off'], false, true),
    ],
    defaultIncludedComponents: ['equipment', 'startup', 'testing'],
    dependencyKeys: ['hvac_needs_electrical_review'],
    overlapGroups: ['hvac_electrical'],
  },
  {
    key: 'landscaping_assembly',
    name: 'Landscaping',
    trade: 'landscaping',
    applicableScopeKeys: ['sod_turf', 'rock_mulch', 'pavers', 'decking'],
    requiredComponents: [c('fine_grading', 'Fine grading', ['grading']), c('material', 'Material'), c('installation', 'Installation'), c('cleanup', 'Cleanup', ['cleanup'])],
    optionalComponents: [
      c('clearing', 'Clearing', ['sitework'], false, true),
      c('topsoil', 'Topsoil', [], false, true),
      c('plants', 'Plants', [], false, true),
      c('weed_barrier', 'Weed barrier', [], false, true),
      c('irrigation', 'Irrigation', [], false, true),
      c('edging', 'Edging', [], false, true),
    ],
    defaultIncludedComponents: ['material', 'installation'],
    overlapGroups: ['landscaping_irrigation'],
  },
  {
    key: 'fencing_assembly',
    name: 'Fencing and railing',
    trade: 'fencing',
    applicableScopeKeys: ['railing', 'fencing'],
    requiredComponents: [c('layout', 'Layout'), c('posts', 'Posts'), c('rails_or_panels', 'Panels or rails'), c('fasteners', 'Fasteners'), c('installation', 'Installation')],
    optionalComponents: [c('footings', 'Footings', ['concrete'], false, true), c('gates', 'Gates', [], false, true), c('hardware', 'Hardware', [], false, true), c('demolition', 'Demolition', ['demo'], false, true)],
    defaultIncludedComponents: ['layout', 'posts', 'rails_or_panels', 'fasteners', 'installation'],
  },
  {
    key: 'cleanup_disposal_assembly',
    name: 'Cleanup and disposal',
    trade: 'disposal',
    applicableScopeKeys: ['cleanup', 'haul_off'],
    requiredComponents: [c('cleanup_or_hauloff', 'Cleanup or haul-off')],
    optionalComponents: [
      c('dumpster', 'Dumpster', [], false, true),
      c('dump_fees', 'Dump fees', [], false, true),
      c('recycling', 'Recycling', [], false, true),
      c('excavation_spoils', 'Excavation spoils', ['excavation'], false, true),
      c('demolition_disposal', 'Demolition disposal', ['demo'], false, true),
    ],
    defaultIncludedComponents: ['cleanup_or_hauloff'],
    overlapGroups: ['demolition_cleanup', 'general_conditions_trade'],
  },
  {
    key: 'general_conditions_assembly',
    name: 'General conditions',
    trade: 'general_conditions',
    applicableScopeKeys: ['general_conditions', 'mobilization', 'supervision'],
    requiredComponents: [c('project_management', 'Project management'), c('mobilization', 'Mobilization'), c('site_protection', 'Site protection')],
    optionalComponents: [
      c('supervision', 'Supervision', ['supervision'], false, true),
      c('temporary_facilities', 'Temporary facilities', [], false, true),
      c('safety', 'Safety', [], false, true),
      c('small_tools', 'Small tools', [], false, true),
      c('cleanup', 'Cleanup', ['cleanup'], false, true),
    ],
    defaultIncludedComponents: ['project_management', 'mobilization', 'site_protection'],
    overlapGroups: ['general_conditions_trade'],
  },
  {
    key: 'contingency_assembly',
    name: 'Contingency',
    trade: 'allowance',
    applicableScopeKeys: ['contingency'],
    requiredComponents: [c('construction_contingency', 'Construction contingency')],
    optionalComponents: [
      c('unknown_conditions', 'Unknown conditions', [], false, true),
      c('quantity_uncertainty', 'Quantity uncertainty', [], false, true),
      c('price_escalation', 'Price escalation', [], false, true),
      c('owner_changes', 'Owner changes only when defined', [], false, true),
    ],
    defaultIncludedComponents: ['construction_contingency'],
    overlapGroups: ['contingency_duplication'],
  },
];

const OVERLAP_REVIEW_SUFFIX = ' Review these items to avoid duplicate pricing.';

const OVERLAPS: ScopeOverlapDefinition[] = [
  { key: 'excavation_trenching', componentKey: 'trench_excavation', componentLabel: 'Trench excavation/backfill', relatedScopeKeys: ['excavation', 'utility_trenching', 'backfill', 'compaction', 'haul_off'], severity: 'review', message: `Excavation, trenching, backfill, compaction, and haul-off may overlap.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm whether included', 'Keep separate line', 'Exclude from one scope'] },
  { key: 'demolition_cleanup', componentKey: 'disposal', componentLabel: 'Debris removal/disposal', relatedScopeKeys: ['demo', 'floor_demo', 'wall_demo', 'cleanup', 'haul_off'], severity: 'review', message: `Demolition and cleanup/disposal may overlap on debris removal, dumpster, haul-off, or dump fees.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm disposal included', 'Already priced elsewhere', 'Keep as separate allowance'] },
  { key: 'foundation_concrete', componentKey: 'concrete_components', componentLabel: 'Concrete/formwork/reinforcement', relatedScopeKeys: ['foundation', 'concrete', 'pour_flatwork', 'sidewalk', 'patio', 'driveway'], severity: 'review', message: `Foundation and concrete line items may overlap on slab concrete, forms, reinforcement, pumping, or finishing.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm assembly scope', 'Separate concrete component', 'Use one complete assembly'] },
  { key: 'framing_roofing', componentKey: 'roof_structure', componentLabel: 'Roof structural components', relatedScopeKeys: ['framing', 'roof_tie_in', 'shingles_roofing'], severity: 'info', message: `Framing and roofing may overlap on roof sheathing, blocking, fascia, or structural roof framing.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm roofing excludes framing', 'Confirm framing includes structure only'] },
  { key: 'roofing_exterior', componentKey: 'flashing', componentLabel: 'Flashing/drip edge/sealing', relatedScopeKeys: ['roof_tie_in', 'shingles_roofing', 'exterior_finishes', 'exterior_paint'], severity: 'info', message: `Roofing and exterior finish work may overlap on flashing, drip edge, or penetration sealing.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm included scope', 'Keep separate for clarity'] },
  { key: 'flooring_baseboard', componentKey: 'baseboard_transitions', componentLabel: 'Baseboard/transitions', relatedScopeKeys: ['flooring', 'floor_tile', 'baseboard', 'trim', 'interior_trim'], severity: 'review', message: `Flooring and trim/baseboard lines may overlap on baseboard removal, baseboard installation, or transitions.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm baseboard included', 'Price trim separately'] },
  { key: 'cabinets_finish_carpentry', componentKey: 'cabinet_trim', componentLabel: 'Cabinet trim components', relatedScopeKeys: ['cabinets', 'trim', 'interior_trim', 'baseboard'], severity: 'info', message: `Cabinets and finish carpentry may overlap on crown, fillers, panels, toe kick, or trim.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm cabinet trim included', 'Keep trim line separate'] },
  { key: 'cabinets_countertops', componentKey: 'countertop_related', componentLabel: 'Countertop-related work', relatedScopeKeys: ['cabinets', 'cabinets_counters', 'countertops', 'backsplash'], severity: 'review', message: `Cabinets and countertops may overlap on template, backsplash, supports, or sink cutouts.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm countertops included', 'Separate counters from cabinets'] },
  { key: 'plumbing_rough_fixtures', componentKey: 'fixture_connections', componentLabel: 'Fixture connections/testing', relatedScopeKeys: ['plumbing_rough', 'plumbing_trim', 'sink_faucet', 'toilet', 'vanity'], severity: 'review', message: `Plumbing rough-in and fixtures may overlap on fixture connections, valves, trim, or testing.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm rough-in stops at stub-outs', 'Confirm fixture install includes trim'] },
  { key: 'electrical_rough_fixtures', componentKey: 'device_install', componentLabel: 'Device/fixture installation', relatedScopeKeys: ['electrical_rough', 'electrical_trim', 'lighting'], severity: 'review', message: `Electrical rough-in and trim/fixtures may overlap on device installation, plates, lighting, or testing.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm trim included', 'Separate rough and finish electrical'] },
  { key: 'hvac_electrical', componentKey: 'hvac_electrical_connection', componentLabel: 'HVAC electrical connection', relatedScopeKeys: ['hvac', 'hvac_startup', 'electrical_rough', 'electrical_trim'], severity: 'review', message: `HVAC and electrical scopes may overlap on disconnects, branch circuits, controls, or thermostat wiring.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm electrical included by HVAC', 'Keep electrical separate'] },
  { key: 'landscaping_irrigation', componentKey: 'irrigation_trenching', componentLabel: 'Irrigation trenching/restoration', relatedScopeKeys: ['sod_turf', 'rock_mulch', 'pavers', 'utility_trenching'], severity: 'info', message: `Landscaping and irrigation-related work may overlap on trenching, backfill, restoration, or controller wiring.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm irrigation scope', 'Separate restoration'] },
  { key: 'general_conditions_trade', componentKey: 'mobilization_cleanup_supervision', componentLabel: 'Mobilization/equipment/cleanup/supervision', relatedScopeKeys: ['general_conditions', 'mobilization', 'supervision', 'cleanup', 'demo', 'excavation', 'concrete', 'framing'], severity: 'info', message: `General conditions and trade pricing may overlap on mobilization, equipment, supervision, temporary protection, or cleanup.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm embedded trade costs', 'Keep project-level allowance'] },
  { key: 'contingency_duplication', componentKey: 'contingency', componentLabel: 'Contingency/uncertainty', relatedScopeKeys: ['contingency', 'overhead_profit'], severity: 'review', message: `Project contingency and trade-level uncertainty or separate allowances may overlap.${OVERLAP_REVIEW_SUFFIX}`, resolutionOptions: ['Confirm contingency basis', 'Separate owner contingency from internal reserve'] },
];

const DEPENDENCIES: DependencyDefinition[] = [
  { key: 'foundation_needs_excavation', label: 'Foundation excavation/base prep', sourceScopeKeys: ['foundation'], requiredScopeKeys: ['excavation', 'grading', 'compaction'], severity: 'review', message: 'Foundation work usually needs excavation and base preparation reviewed.' },
  { key: 'roofing_deck_repair_review', label: 'Roof deck repair review', sourceScopeKeys: ['shingles_roofing', 'tear_off', 'roof_tie_in'], requiredScopeKeys: ['framing'], severity: 'info', message: 'Roofing replacement should review deck repair or sheathing allowance.' },
  { key: 'flooring_subfloor_review', label: 'Subfloor preparation review', sourceScopeKeys: ['flooring', 'floor_tile'], requiredScopeKeys: ['floor_demo', 'baseboard'], severity: 'info', message: 'Flooring may need removal, subfloor preparation, transitions, or baseboard handling.' },
  { key: 'tile_shower_needs_waterproofing', label: 'Tile waterproofing', sourceScopeKeys: ['shower_tile', 'shower_floor_tile'], requiredScopeKeys: ['waterproofing'], severity: 'warning', message: 'Tile shower work should confirm waterproofing or membrane scope.' },
  { key: 'cabinets_need_countertop_review', label: 'Countertop review', sourceScopeKeys: ['cabinets'], requiredScopeKeys: ['countertops', 'cabinets_counters'], severity: 'review', message: 'New cabinets often require countertop scope or confirmation that counters are excluded.' },
  { key: 'fixtures_need_rough_or_existing', label: 'Plumbing rough-in or existing connections', sourceScopeKeys: ['plumbing_trim', 'sink_faucet', 'toilet', 'vanity'], requiredScopeKeys: ['plumbing_rough'], severity: 'info', message: 'Shower/tub rough-in is on Plumbing rough-in. Toilet and vanity/lav relocations are priced on their own fixture lines — confirm wet-area points only here.' },
  { key: 'electrical_fixtures_need_rough_or_existing', label: 'Electrical rough-in or existing boxes', sourceScopeKeys: ['electrical_trim', 'lighting'], requiredScopeKeys: ['electrical_rough'], severity: 'info', message: 'Electrical fixtures should confirm rough-in/boxes are existing or separately priced.' },
  { key: 'hvac_needs_electrical_review', label: 'HVAC electrical connection', sourceScopeKeys: ['hvac', 'hvac_startup'], requiredScopeKeys: ['electrical_rough', 'electrical_trim'], severity: 'review', message: 'HVAC equipment often requires electrical disconnect, branch circuit, controls, or thermostat wiring.' },
];

const PROJECT_TEMPLATES: ProjectScopeTemplate[] = [
  {
    key: 'new_adu',
    projectContexts: ['adu', 'addition', 'new_adu'],
    requiredScopeGroups: [
      req('plans', 'Plans and engineering', ['plans_engineering']),
      req('permits', 'Permits', ['permits']),
      req('utilities', 'Utility coordination', ['utility_coordination']),
      req('excavation', 'Excavation', ['excavation']),
      req('foundation', 'Foundation', ['foundation', 'concrete']),
      req('framing', 'Framing', ['framing']),
      req('roofing', 'Roofing', ['roof_tie_in', 'shingles_roofing']),
      req('exterior', 'Exterior finish', ['exterior_finishes']),
      req('openings', 'Windows and doors', ['windows_doors', 'windows', 'doors']),
      req('plumbing', 'Plumbing', ['plumbing_rough', 'plumbing_trim']),
      req('electrical', 'Electrical', ['electrical_rough', 'electrical_trim']),
      req('hvac', 'HVAC', ['hvac']),
      req('insulation', 'Insulation', ['insulation']),
      req('drywall', 'Drywall', ['drywall', 'hang', 'finish_tape']),
      req('paint', 'Painting', ['paint', 'interior_paint']),
      req('flooring', 'Flooring', ['flooring', 'floor_tile']),
      req('cleanup', 'Cleanup', ['cleanup', 'haul_off']),
      req('general_conditions', 'General conditions', ['general_conditions', 'mobilization', 'supervision']),
    ],
  },
  {
    key: 'kitchen_remodel',
    projectContexts: ['kitchen', 'kitchen_remodel'],
    requiredScopeGroups: [
      req('demo', 'Demolition', ['demo', 'appliance_removal']),
      req('disposal', 'Disposal', ['cleanup', 'haul_off']),
      req('cabinets', 'Cabinets', ['cabinets', 'cabinets_counters']),
      req('countertops', 'Countertops', ['countertops', 'cabinets_counters']),
      req('plumbing', 'Plumbing modifications', ['plumbing_rough', 'plumbing_trim', 'sink_faucet']),
      req('electrical', 'Electrical modifications', ['electrical_rough', 'electrical_trim', 'lighting']),
      req('backsplash', 'Backsplash', ['backsplash']),
      req('paint', 'Painting', ['paint', 'interior_paint']),
      req('appliances', 'Appliance install', ['appliances']),
      req('cleanup', 'Final cleanup', ['cleanup']),
    ],
    optionalScopeGroups: [req('flooring', 'Flooring repairs', ['flooring', 'floor_tile'], 'info'), req('drywall', 'Drywall repairs', ['drywall', 'patch_repair'], 'info')],
  },
  {
    key: 'bathroom_remodel',
    projectContexts: ['bathroom', 'bathroom_remodel'],
    requiredScopeGroups: [
      req('demo', 'Demolition', ['demo']),
      req('plumbing', 'Plumbing', ['plumbing_rough', 'plumbing_trim', 'sink_faucet', 'toilet', 'vanity']),
      req('electrical', 'Electrical', ['electrical_rough', 'electrical_trim', 'lighting', 'exhaust_fan']),
      req('waterproofing', 'Waterproofing', ['waterproofing']),
      req('tile', 'Tile', ['shower_tile', 'shower_floor_tile', 'floor_tile']),
      req('paint', 'Painting', ['paint', 'interior_paint']),
      req('cleanup', 'Cleanup', ['cleanup', 'haul_off']),
    ],
  },
  {
    key: 'roofing_replacement',
    projectContexts: ['roofing', 'roofing_replacement', 'roof_replacement'],
    requiredScopeGroups: [
      req('tear_off', 'Tear-off', ['tear_off']),
      req('disposal', 'Disposal', ['haul_off', 'cleanup']),
      req('roofing', 'Roofing material/install', ['shingles_roofing', 'roof_tie_in']),
      req('cleanup', 'Cleanup', ['cleanup']),
    ],
    optionalScopeGroups: [req('deck_repair', 'Deck repair allowance', ['framing'], 'info'), req('ventilation', 'Ventilation', ['hvac'], 'info')],
  },
  {
    key: 'flooring_replacement',
    projectContexts: ['flooring', 'flooring_replacement'],
    requiredScopeGroups: [req('demo', 'Floor removal', ['floor_demo']), req('flooring', 'Flooring install', ['flooring', 'floor_tile']), req('cleanup', 'Cleanup/disposal', ['cleanup', 'haul_off'])],
    optionalScopeGroups: [req('baseboard', 'Baseboard handling', ['baseboard', 'trim'], 'info')],
  },
  {
    key: 'sitework_package',
    projectContexts: ['sitework', 'sitework_package'],
    requiredScopeGroups: [req('sitework', 'Sitework', ['sitework', 'grading']), req('excavation', 'Excavation', ['excavation']), req('haul_off', 'Spoils handling', ['haul_off'])],
  },
  {
    key: 'landscaping_package',
    projectContexts: ['landscaping', 'landscape'],
    requiredScopeGroups: [req('grading', 'Fine grading', ['grading', 'sitework']), req('landscape', 'Landscape material/install', ['sod_turf', 'rock_mulch', 'pavers']), req('cleanup', 'Cleanup', ['cleanup'])],
    optionalScopeGroups: [req('irrigation', 'Irrigation', ['utility_trenching'], 'info')],
  },
  {
    key: 'concrete_flatwork',
    projectContexts: ['concrete', 'flatwork', 'concrete_flatwork'],
    requiredScopeGroups: [req('prep', 'Subgrade/base preparation', ['grading', 'compaction']), req('concrete', 'Concrete flatwork', ['concrete', 'pour_flatwork', 'sidewalk', 'patio', 'driveway'])],
  },
  { key: 'plumbing_only', projectContexts: ['plumbing', 'plumbing_only'], requiredScopeGroups: [req('plumbing', 'Plumbing scope', ['plumbing_rough', 'plumbing_trim', 'sink_faucet', 'toilet', 'vanity'])] },
  { key: 'electrical_only', projectContexts: ['electrical', 'electrical_only'], requiredScopeGroups: [req('electrical', 'Electrical scope', ['electrical_rough', 'electrical_trim', 'lighting'])] },
  { key: 'hvac_only', projectContexts: ['hvac', 'hvac_only'], requiredScopeGroups: [req('hvac', 'HVAC scope', ['hvac', 'hvac_startup', 'exhaust_fan'])] },
];

function hasAny(active: Set<string>, keys: string[]): boolean {
  return keys.some((key) => active.has(key));
}

function allComponents(definition: AssemblyDefinition, projectContext?: string | null, activeScopeKeys: string[] = []): AssemblyComponentDefinition[] {
  const active = new Set(activeScopeKeys);
  const context = String(projectContext || '').toLowerCase();
  const conditional = (definition.conditionalComponents || []).filter((component) => {
    const contextMatch = !component.appliesWhenProjectContexts?.length || component.appliesWhenProjectContexts.includes(context);
    const scopeMatch = !component.appliesWhenScopeKeysPresent?.length || hasAny(active, component.appliesWhenScopeKeysPresent);
    return contextMatch && scopeMatch;
  });
  return [...definition.requiredComponents, ...(definition.optionalComponents || []), ...conditional];
}

function notesMention(notes: string, words: string[]): boolean {
  const lower = notes.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

function componentStatus(params: {
  component: AssemblyComponentDefinition;
  definition: AssemblyDefinition;
  activeScopeKeys: Set<string>;
  metadata?: ScopeInclusionMetadata | null;
  notes?: string | null;
}): AssemblyComponentStatus {
  const { component, definition, activeScopeKeys, metadata } = params;
  const explicitIncluded = metadata?.includedComponentKeys?.includes(component.key);
  const explicitExcluded = metadata?.excludedComponentKeys?.includes(component.key);
  const explicitUnknown = metadata?.unknownComponentKeys?.includes(component.key);
  const metadataHasComponentLists = Boolean(
    metadata?.includedComponentKeys?.length ||
      metadata?.excludedComponentKeys?.length ||
      metadata?.unknownComponentKeys?.length
  );
  const separate = component.relatedScopeKeys?.some((key) => activeScopeKeys.has(key) && !definition.applicableScopeKeys.includes(key));
  const noteText = [...(metadata?.notes || []), params.notes || ''].join(' ');
  const includedByNotes = notesMention(noteText, [`include ${component.label}`, `includes ${component.label}`, `${component.label} included`]);
  const excludedByNotes = notesMention(noteText, [`exclude ${component.label}`, `excludes ${component.label}`, `no ${component.label}`, `${component.label} excluded`]);

  let status: AssemblyComponentStatusType = 'unknown';
  if (explicitExcluded || excludedByNotes || definition.defaultExcludedComponents?.includes(component.key)) {
    status = 'excluded_confirmed';
  } else if (separate) {
    status = 'separately_priced';
  } else if (explicitIncluded || includedByNotes || (metadata?.confirmedByUser && !metadataHasComponentLists)) {
    status = 'included_confirmed';
  } else if (explicitUnknown) {
    status = 'unknown';
  } else if (!metadata && (definition.defaultIncludedComponents?.includes(component.key) || component.normallyIncluded)) {
    status = 'included_assumed';
  } else if (!component.optional && component.normallyIncluded) {
    status = 'missing';
  }

  const severity: IntelligenceSeverity =
    status === 'missing'
      ? 'warning'
      : status === 'unknown'
        ? component.optional
          ? 'info'
          : 'review'
        : status === 'included_assumed'
          ? 'info'
          : 'info';

  return {
    key: component.key,
    label: component.label,
    status,
    severity,
    relatedScopeKeys: component.relatedScopeKeys || [],
    message:
      status === 'separately_priced'
        ? `${component.label} appears separately priced.`
        : status === 'missing'
          ? `${component.label} may be missing from this assembly.`
          : status === 'included_assumed'
            ? `${component.label} is normally included but not confirmed by rate metadata.`
            : status === 'excluded_confirmed'
              ? `${component.label} is marked excluded.`
              : `${component.label} inclusion is unknown.`,
  };
}

function overlapNotices(scopeKey: string, activeScopeKeys: string[], groups: string[] = []): ScopeOverlapNotice[] {
  const active = new Set(activeScopeKeys);
  return OVERLAPS.filter((overlap) => {
    if (groups.length && !groups.includes(overlap.key)) return false;
    if (!overlap.relatedScopeKeys.includes(scopeKey)) return false;
    const relatedActive = overlap.relatedScopeKeys.filter((key) => key !== scopeKey && active.has(key));
    return relatedActive.length > 0;
  }).map((overlap) => ({
    key: overlap.key,
    componentKey: overlap.componentKey,
    componentLabel: overlap.componentLabel,
    relatedScopeKeys: overlap.relatedScopeKeys.filter((key) => key !== scopeKey && active.has(key)),
    severity: overlap.severity,
    message: overlap.message,
    resolutionOptions: overlap.resolutionOptions,
  }));
}

function dependencyNotices(scopeKey: string, activeScopeKeys: string[]): ScopeDependencyNotice[] {
  const active = new Set(activeScopeKeys);
  return DEPENDENCIES.filter((dependency) => dependency.sourceScopeKeys.includes(scopeKey))
    .filter((dependency) => !hasAny(active, dependency.requiredScopeKeys))
    .map((dependency) => ({
      key: dependency.key,
      dependencyKey: dependency.key,
      label: dependency.label,
      severity: dependency.severity,
      message: dependency.message,
      suggestedScopeKeys: dependency.requiredScopeKeys,
    }));
}

function confidenceFor(params: {
  metadata?: ScopeInclusionMetadata | null;
  pricingSource?: PricingSourceKind;
  missingCount: number;
  unknownCount: number;
  assumedCount: number;
}): IntelligenceConfidence {
  const { metadata, pricingSource, missingCount, unknownCount, assumedCount } = params;
  if (missingCount > 0 || pricingSource === 'national_average') return 'low';
  if (!metadata) return assumedCount > 2 || unknownCount > 0 ? 'low' : 'medium';
  if (metadata.confirmedByUser || metadata.source === 'project_quote') return unknownCount ? 'medium' : 'high';
  if (metadata.source === 'saved_rate' || metadata.source === 'company_rate') return unknownCount > 2 ? 'low' : 'medium';
  return 'low';
}

export function getAssemblyDefinitionsForScope(scopeKey: string, projectContext?: string | null): AssemblyDefinition[] {
  const context = String(projectContext || '').toLowerCase();
  return ASSEMBLIES.filter((definition) => {
    if (!definition.applicableScopeKeys.includes(scopeKey)) return false;
    if (!definition.applicableProjectContexts?.length) return true;
    return definition.applicableProjectContexts.includes(context);
  });
}

export function evaluateAssemblyForScope(params: {
  scopeKey: string;
  projectContext?: string | null;
  activeScopeKeys?: string[];
  notes?: string | null;
  inclusionMetadata?: ScopeInclusionMetadata | null;
  pricingSource?: PricingSourceKind;
}): AssemblyEvaluationResult | null {
  const definition = getAssemblyDefinitionsForScope(params.scopeKey, params.projectContext)[0];
  if (!definition) {
    return {
      scopeItemKey: params.scopeKey,
      completeness: 'unknown',
      confidence: 'missing',
      includedComponents: [],
      missingComponents: [],
      excludedComponents: [],
      unknownComponents: [],
      possibleOverlaps: [],
      dependencies: [],
      notices: [],
    };
  }

  const active = new Set(params.activeScopeKeys || []);
  const statuses = allComponents(definition, params.projectContext, params.activeScopeKeys).map((component) =>
    componentStatus({
      component,
      definition,
      activeScopeKeys: active,
      metadata: params.inclusionMetadata,
      notes: params.notes,
    })
  );
  const possibleOverlaps = overlapNotices(params.scopeKey, params.activeScopeKeys || [], definition.overlapGroups);
  const dependencies = dependencyNotices(params.scopeKey, params.activeScopeKeys || []);
  const includedComponents = statuses.filter((status) =>
    ['included_confirmed', 'included_assumed', 'separately_priced'].includes(status.status)
  );
  const missingComponents = statuses.filter((status) => status.status === 'missing');
  const excludedComponents = statuses.filter((status) => status.status === 'excluded_confirmed');
  const unknownComponents = statuses.filter((status) => status.status === 'unknown');
  const assumedCount = statuses.filter((status) => status.status === 'included_assumed').length;
  const requiredTotal = definition.requiredComponents.length || 1;
  const coveredRequired = definition.requiredComponents.filter((component) =>
    statuses.some((status) => status.key === component.key && ['included_confirmed', 'included_assumed', 'separately_priced'].includes(status.status))
  ).length;
  const completeness: AssemblyCompleteness =
    missingComponents.length > 0 || dependencies.some((dependency) => dependency.severity === 'warning')
      ? 'incomplete'
      : coveredRequired >= requiredTotal && unknownComponents.length === 0
        ? 'complete'
        : coveredRequired >= Math.max(1, requiredTotal - 1)
          ? 'mostly_complete'
          : 'unknown';
  const confidence = confidenceFor({
    metadata: params.inclusionMetadata,
    pricingSource: params.pricingSource,
    missingCount: missingComponents.length,
    unknownCount: unknownComponents.filter((component) => component.severity !== 'info').length,
    assumedCount,
  });
  const notices: ScopeValidationNotice[] = [
    ...missingComponents.slice(0, 2).map((component) => ({
      ruleKey: 'assembly_component_missing',
      severity: component.severity,
      title: 'Possible scope gap',
      message: component.message,
      recommendedResolution: 'Confirm included, exclude it, or price it separately.',
      pricingMayContinue: true,
    })),
    ...unknownComponents.filter((component) => component.severity === 'review').slice(0, 2).map((component) => ({
      ruleKey: 'assembly_component_unknown',
      severity: component.severity,
      title: 'Inclusion unknown',
      message: component.message,
      recommendedResolution: 'Confirm whether this component is included in the rate.',
      pricingMayContinue: true,
    })),
    ...possibleOverlaps.slice(0, 2).map((overlap) => ({
      ruleKey: 'scope_possible_overlap',
      severity: overlap.severity,
      title: 'Possible overlap',
      message: overlap.message,
      recommendedResolution: overlap.resolutionOptions[0],
      pricingMayContinue: true,
    })),
    ...dependencies.slice(0, 2).map((dependency) => ({
      ruleKey: 'scope_dependency_review',
      severity: dependency.severity,
      title: 'Related scope review',
      message: dependency.message,
      recommendedResolution: 'Confirm existing conditions or price supporting scope separately.',
      pricingMayContinue: true,
    })),
  ];

  return {
    assemblyKey: definition.key,
    scopeItemKey: params.scopeKey,
    completeness,
    confidence,
    includedComponents,
    missingComponents,
    excludedComponents,
    unknownComponents,
    possibleOverlaps,
    dependencies,
    notices,
  };
}

export function evaluateProjectScopeGaps(params: {
  projectContext?: string | null;
  activeScopeKeys?: string[];
  excludedScopeKeys?: string[];
}): ScopeGapNotice[] {
  const context = String(params.projectContext || '').toLowerCase();
  if (!context) return [];
  const template = PROJECT_TEMPLATES.find((item) => item.projectContexts.includes(context));
  if (!template) return [];
  const active = new Set(params.activeScopeKeys || []);
  const excluded = new Set(params.excludedScopeKeys || []);
  return template.requiredScopeGroups
    .filter((requirement) => !hasAny(active, requirement.scopeKeys))
    .filter((requirement) => !hasAny(excluded, requirement.scopeKeys))
    .map((requirement) => ({
      key: `${template.key}_${requirement.key}`,
      scopeGroupKey: requirement.key,
      label: requirement.label,
      severity: requirement.severity || 'review',
      message: `${requirement.label} may be needed for this project type.`,
      suggestedScopeKeys: requirement.scopeKeys,
    }));
}

export function getOverlapDefinitions(): ScopeOverlapDefinition[] {
  return OVERLAPS;
}

export function getProjectScopeTemplates(): ProjectScopeTemplate[] {
  return PROJECT_TEMPLATES;
}
