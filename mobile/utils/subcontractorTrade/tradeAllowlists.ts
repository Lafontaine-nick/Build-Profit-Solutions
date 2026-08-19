import type { SubcontractorTradeKey } from './types';
import { ELECTRICAL_SCOPE_ALLOWLIST } from './electricalPlanConvergence';
import { PLUMBING_SCOPE_ALLOWLIST } from './plumbingPlanConvergence';

/** Flatten scope group item ids (mirrors SCOPE_CHECKLIST_GROUPS — read-only reference). */
function ids(...groups: string[][]): string[] {
  return [...new Set(groups.flat())];
}

/**
 * Explicit single-trade scope allowlists.
 * Electrical Phase 1 expands the canonical estimator; existing rough/trim ids stay for compatibility.
 */

export const TRADE_SCOPE_ALLOWLISTS: Record<SubcontractorTradeKey, string[]> = {
  electrical: [...ELECTRICAL_SCOPE_ALLOWLIST],
  stucco: [
    'stucco',
    'stucco_wrb',
    'stucco_lath',
    'stucco_base_coat',
    'stucco_finish_coat',
    'stucco_foam_trim',
    'stucco_accessories',
    'stucco_soffits',
    'stucco_parapets',
    'stucco_access',
    'stucco_repairs',
    'stucco_other_finish',
  ],
  roofing: ids(
    ['roofing_system'],
    [
      'tear_off',
      'decking_repair',
      'underlayment',
      'ice_water_shield',
      'shingles_roofing',
      'drip_edge',
      'ridge_cap',
      'valley_flashing',
      'step_flashing',
      'wall_flashing',
      'ridge_vent',
      'roof_vents',
      'turbine_vents',
      'pipe_boots',
      'chimney_flashing',
      'skylight_flashing',
      'roof_penetrations',
      'flashing',
      'vents_penetrations',
      'roof_pitch_complexity_access',
      'roof_repairs',
      'roof_exclusions',
      'roof_repairs',
    ],
    ['gutters', 'downspouts'],
    ['permits', 'cleanup']
  ),
  hvac: ids(
    ['service_call'],
    ['equipment_replace', 'refrigerant', 'thermostat'],
    ['ductwork', 'ventilation'],
    ['permits', 'cleanup']
  ),
  concrete: ids(
    [
      'demo_removal',
      'site_prep',
      'excavation',
      'reinforcement',
      'complex_forming',
    ],
    ['pour_flatwork', 'pour_foundation'],
    ['concrete_sealer', 'decorative_finish', 'additional_haul_off']
  ),
  framing: [
    'framing',
    'wall_framing',
    'openings',
    'shear_sheathing',
    'cleanup',
  ],
  drywall: ids(
    ['demo_removal', 'hang', 'finish_tape', 'texture', 'patch_repair'],
    ['cleanup']
  ),
  plumbing: [...PLUMBING_SCOPE_ALLOWLIST],
  insulation: ['insulation'],
  flooring: [
    'floor_demo',
    'floor_prep',
    'flooring',
    'flooring_lvp',
    'flooring_laminate',
    'flooring_engineered_hardwood',
    'flooring_solid_hardwood',
    'tile_flooring',
    'flooring_carpet',
    'underlayment',
    'moisture_barrier',
    'transitions',
    'quarter_round',
    'trim',
    'adhesive_mastic_removal',
    'cleanup',
  ],
  painting: [
    'prep',
    'interior_paint',
    'ceiling_paint',
    'trim_paint',
    'door_paint',
    'cabinet_paint',
    'exterior_prep',
    'exterior_paint',
    'cleanup',
  ],
  windows_doors: [
    'windows',
    'exterior_doors',
    'sliding_doors',
    'garage_doors',
    'windows_doors',
  ],
};

export function getTradeScopeAllowlist(
  tradeKey: string | null | undefined
): string[] | null {
  if (!tradeKey) return null;
  const allowlist =
    TRADE_SCOPE_ALLOWLISTS[tradeKey as SubcontractorTradeKey] || null;
  return allowlist?.length ? allowlist : null;
}
