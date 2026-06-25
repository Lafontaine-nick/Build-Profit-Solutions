export type TypicalHandling = 'often_separate' | 'often_included' | 'job_dependent';

export type TradeScopeGuidance = {
  trade: string;
  scopeKey: string;
  guidanceText: string;
  typicalHandling?: TypicalHandling;
  recommendedAction?: 'add_separate_item' | 'confirm_conditions' | 'confirm_before_excluding' | 'keep_included';
};

const EXCAVATION_GUIDANCE: TradeScopeGuidance[] = [
  {
    trade: 'excavation',
    scopeKey: 'export',
    guidanceText: 'Often priced separately when excavated material leaves the site.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
  {
    trade: 'excavation',
    scopeKey: 'haul_off',
    guidanceText: 'Often priced separately when excavated material leaves the site.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
  {
    trade: 'excavation',
    scopeKey: 'spoils_export',
    guidanceText: 'Often priced separately when excavated material leaves the site.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
  {
    trade: 'excavation',
    scopeKey: 'dump_fees',
    guidanceText: 'Usually required when exported material is disposed at a landfill or disposal facility.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
  {
    trade: 'excavation',
    scopeKey: 'backfill',
    guidanceText: 'May be included when suitable onsite material is reused; imported fill is commonly separate.',
    typicalHandling: 'job_dependent',
    recommendedAction: 'confirm_conditions',
  },
  {
    trade: 'excavation',
    scopeKey: 'compaction',
    guidanceText: 'Confirm whether placement, moisture conditioning, and compaction are included.',
    typicalHandling: 'job_dependent',
    recommendedAction: 'confirm_conditions',
  },
  {
    trade: 'excavation',
    scopeKey: 'shoring',
    guidanceText: 'Usually depends on excavation depth, soil conditions, access, and safety requirements.',
    typicalHandling: 'job_dependent',
    recommendedAction: 'confirm_before_excluding',
  },
];

const CONCRETE_GUIDANCE: TradeScopeGuidance[] = [
  {
    trade: 'concrete',
    scopeKey: 'pumping',
    guidanceText: 'Pumping may be separate depending on site access and placement method.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
  {
    trade: 'concrete',
    scopeKey: 'reinforcement',
    guidanceText: 'Reinforcement may be separate unless explicitly included in the benchmark.',
    typicalHandling: 'job_dependent',
    recommendedAction: 'confirm_conditions',
  },
  {
    trade: 'concrete',
    scopeKey: 'sawcutting',
    guidanceText: 'Saw cutting and curing may be priced separately from placement.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
];

const FLOORING_GUIDANCE: TradeScopeGuidance[] = [
  {
    trade: 'flooring',
    scopeKey: 'floor_demo',
    guidanceText: 'Existing floor removal is commonly priced as a separate line item.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
  {
    trade: 'flooring',
    scopeKey: 'floor_prep',
    guidanceText: 'Surface preparation may be separate from finished flooring installation.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
  {
    trade: 'flooring',
    scopeKey: 'transitions',
    guidanceText: 'Transitions and baseboards may require separate pricing.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
];

const ROOFING_GUIDANCE: TradeScopeGuidance[] = [
  {
    trade: 'roofing',
    scopeKey: 'tear_off',
    guidanceText: 'Tear-off is commonly separate from new roofing installation.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
  {
    trade: 'roofing',
    scopeKey: 'disposal',
    guidanceText: 'Disposal or dump fees are often tied to tear-off and haul-off scope.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
  {
    trade: 'roofing',
    scopeKey: 'deck_repair',
    guidanceText: 'Deck repair is usually condition-dependent and may need separate allowance.',
    typicalHandling: 'job_dependent',
    recommendedAction: 'confirm_conditions',
  },
  {
    trade: 'roofing',
    scopeKey: 'flashing',
    guidanceText: 'Flashing may be included or separate depending on the benchmark scope.',
    typicalHandling: 'job_dependent',
    recommendedAction: 'confirm_conditions',
  },
];

const PAINT_GUIDANCE: TradeScopeGuidance[] = [
  {
    trade: 'paint',
    scopeKey: 'prep',
    guidanceText: 'Surface prep and patching may be separate from finish coats.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
  {
    trade: 'paint',
    scopeKey: 'repairs',
    guidanceText: 'Wall repairs may require separate pricing before painting.',
    typicalHandling: 'often_separate',
    recommendedAction: 'add_separate_item',
  },
  {
    trade: 'paint',
    scopeKey: 'primer',
    guidanceText: 'Primer may depend on substrate condition and existing coatings.',
    typicalHandling: 'job_dependent',
    recommendedAction: 'confirm_conditions',
  },
];

const GUIDANCE_BY_TRADE: Record<string, readonly TradeScopeGuidance[]> = {
  excavation: EXCAVATION_GUIDANCE,
  utility_trenching: EXCAVATION_GUIDANCE,
  grading: EXCAVATION_GUIDANCE,
  sitework: EXCAVATION_GUIDANCE,
  concrete: CONCRETE_GUIDANCE,
  pour_flatwork: CONCRETE_GUIDANCE,
  foundation: CONCRETE_GUIDANCE,
  flooring: FLOORING_GUIDANCE,
  floor_tile: FLOORING_GUIDANCE,
  roofing: ROOFING_GUIDANCE,
  shingles_roofing: ROOFING_GUIDANCE,
  tear_off: ROOFING_GUIDANCE,
  paint: PAINT_GUIDANCE,
  interior_paint: PAINT_GUIDANCE,
  exterior_paint: PAINT_GUIDANCE,
};

export function getTradeScopeGuidance(tradeOrScopeKey: string, componentKey: string): TradeScopeGuidance | null {
  const entries = GUIDANCE_BY_TRADE[tradeOrScopeKey] || [];
  const direct = entries.find((entry) => entry.scopeKey === componentKey);
  if (direct) return direct;
  const aliasKeys: Record<string, string> = {
    export: 'haul_off',
    spoils_export: 'haul_off',
  };
  const aliased = aliasKeys[componentKey];
  if (aliased) {
    return entries.find((entry) => entry.scopeKey === aliased) || null;
  }
  return null;
}

export function recommendedActionLabel(
  action: TradeScopeGuidance['recommendedAction']
): string | null {
  switch (action) {
    case 'add_separate_item':
      return 'Recommended: Add as separate item';
    case 'confirm_conditions':
      return 'Recommended: Confirm project conditions';
    case 'confirm_before_excluding':
      return 'Recommended: Confirm before excluding';
    case 'keep_included':
      return 'Recommended: Keep included';
    default:
      return null;
  }
}
