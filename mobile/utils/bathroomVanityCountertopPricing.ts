import type {
  BenchmarkScopeAssumption,
  BenchmarkScopeAssumptionProfile,
} from '@/utils/benchmarkScopeAssumptions';

export type BathroomVanityCountertopMaterialType =
  | 'cultured_marble_prefab'
  | 'prefab_quartz_stone'
  | 'custom_quartz_granite'
  | 'other_manual'
  | 'unknown';

export const BATHROOM_VANITY_COUNTERTOP_MATERIAL_OPTIONS: Array<{
  id: BathroomVanityCountertopMaterialType;
  label: string;
}> = [
  { id: 'cultured_marble_prefab', label: 'Cultured marble / prefabricated' },
  { id: 'prefab_quartz_stone', label: 'Prefabricated quartz or stone' },
  { id: 'custom_quartz_granite', label: 'Custom quartz or granite' },
  { id: 'other_manual', label: 'Other / enter manually' },
];

export const BATHROOM_VANITY_COUNTERTOP_VIEW_DETAILS =
  'Small custom vanity countertops often have higher effective square-foot pricing because fabricators charge minimum amounts for templating, fabrication, sink cutouts, delivery, and installation. The total shown reflects a complete custom quartz or granite countertop allowance rather than material cost alone.';

export type BathroomVanityCountertopSuggestedFill = {
  material: number;
  labor: number;
  total: number;
  materialSource: 'national_average';
  laborSource: 'national_average';
  rateSourceLabel: string;
  helper: string;
  mode: 'suggested_price';
  basis?: { quantity: number; unit: string } | null;
  splitSource?: 'source';
  splitConfidence?: 'high' | 'medium' | 'low';
  comparisonRange?: { low: number; high: number } | null;
  benchmarkScopeProfile?: BenchmarkScopeAssumptionProfile;
  costBuckets?: Array<{
    key: 'material' | 'labor';
    label: string;
    amount: number;
    rate?: number | null;
    source: 'national_average';
  }>;
  pricingRecordId?: string;
  productionStatus?: 'production_ready' | 'review_required';
  storedTotalExact?: number | null;
  impliedUnitRateLabel?: string | null;
};

export type BathroomVanityCountertopSuggestedPricing = {
  fill: BathroomVanityCountertopSuggestedFill | null;
  comparison: null;
};

const CUSTOM_MATERIAL_RATE = 67;
const CUSTOM_LABOR_RATE = 48;
const CUSTOM_INSTALLED_RATE = 115;
const CUSTOM_MINIMUM_PROJECT = 1050;
const CUSTOM_SQFT_RANGE = { low: 90, high: 125 } as const;

const CULTURED_MARBLE_EACH = {
  material: 350,
  labor: 175,
  total: 525,
  range: { low: 350, high: 700 },
} as const;

const PREFAB_QUARTZ_EACH = {
  material: 520,
  labor: 280,
  total: 800,
  range: { low: 600, high: 1000 },
} as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function scopeAssumption(
  scopeKey: string,
  status: BenchmarkScopeAssumption['status'],
  displayLabel: string,
  notes: string,
  options: Partial<BenchmarkScopeAssumption> = {}
): BenchmarkScopeAssumption {
  return {
    scopeKey,
    status,
    displayLabel,
    notes,
    source: 'bps_standard_assumption',
    sourceReference: 'Build Profit bathroom vanity countertop scope model',
    confidence: options.confidence ?? 'medium',
    impact: options.impact ?? (status === 'included' ? 'low' : 'high'),
    riskLevel: options.riskLevel ?? (status === 'included' ? 'low' : 'high'),
    recommendedContractorAction:
      options.recommendedContractorAction ??
      (status === 'included'
        ? 'keep_included'
        : status === 'conditional'
          ? 'confirm_conditions'
          : 'add_separate_item'),
    conditionText: options.conditionText,
  };
}

function customVanityCountertopAssumptions(): BenchmarkScopeAssumption[] {
  return [
    scopeAssumption(
      'countertop_material',
      'included',
      'Standard quartz or granite vanity countertop',
      'Standard quartz or granite vanity countertop material is included.'
    ),
    scopeAssumption(
      'templating',
      'included',
      'Field measurement or templating',
      'Field measurement or templating is included.'
    ),
    scopeAssumption('fabrication', 'included', 'Standard fabrication', 'Standard shop fabrication is included.'),
    scopeAssumption(
      'standard_edge',
      'included',
      'Standard eased edge',
      'Standard eased or comparable basic edge profile is included.'
    ),
    scopeAssumption(
      'sink_cutout',
      'included',
      'One standard sink cutout',
      'One standard sink cutout is included. Cutout labor is built into fabrication — not priced as a separate fixture install.'
    ),
    scopeAssumption(
      'faucet_holes',
      'included',
      'Standard faucet-hole drilling',
      'Standard faucet-hole configuration is included.'
    ),
    scopeAssumption('delivery', 'included', 'Delivery', 'Delivery and handling are included.'),
    scopeAssumption(
      'setting',
      'included',
      'Setting and securing',
      'Setting and securing the countertop is included.'
    ),
    scopeAssumption(
      'install_supplies',
      'included',
      'Standard installation supplies',
      'Standard installation supplies are included.'
    ),
    scopeAssumption('cleanup', 'included', 'Installation cleanup', 'Installation cleanup is included.'),
    scopeAssumption('vanity_cabinet', 'excluded', 'Vanity cabinet', 'Vanity cabinet is not included.'),
    scopeAssumption(
      'sink_fixture',
      'excluded',
      'Sink fixture',
      'Sink fixture is not included unless specifically selected or supplied with a prefabricated top.'
    ),
    scopeAssumption('faucet', 'excluded', 'Faucet', 'Faucet is not included.'),
    scopeAssumption(
      'plumbing',
      'excluded',
      'Plumbing disconnection or reconnection',
      'Plumbing disconnection or reconnection is not included.'
    ),
    scopeAssumption('demo', 'excluded', 'Demolition', 'Demolition or removal of the existing countertop is not included.'),
    scopeAssumption('disposal', 'excluded', 'Disposal', 'Disposal is not included.'),
    scopeAssumption('backsplash', 'excluded', 'Backsplash', 'Backsplash is not included unless separately included.'),
    scopeAssumption(
      'cabinet_repairs',
      'excluded',
      'Wall or cabinet repairs',
      'Wall or cabinet repairs are not included.'
    ),
    scopeAssumption(
      'premium_edge',
      'excluded',
      'Premium edge profiles',
      'Premium edge profiles are not included.'
    ),
    scopeAssumption('waterfall', 'excluded', 'Waterfall edges', 'Waterfall edges are not included.'),
    scopeAssumption('mitered_edge', 'excluded', 'Mitered edges', 'Mitered edges are not included.'),
    scopeAssumption(
      'sealing',
      'excluded',
      'Natural stone sealing',
      'Natural stone sealing beyond normal initial preparation is not included.'
    ),
    scopeAssumption(
      'exotic_stone',
      'excluded',
      'Premium or exotic stone',
      'Premium or exotic stone is not included.'
    ),
    scopeAssumption(
      'extra_cutouts',
      'excluded',
      'Additional cutouts',
      'Additional sink or appliance cutouts are not included.'
    ),
    scopeAssumption(
      'structural_mods',
      'excluded',
      'Structural cabinet modifications',
      'Structural cabinet modifications are not included.'
    ),
    scopeAssumption(
      'undermount_sink',
      'conditional',
      'Undermount sink installation',
      'Undermount sink installation may require separate pricing.',
      { conditionText: 'Confirm sink type and mounting requirements.' }
    ),
    scopeAssumption(
      'vessel_sink',
      'conditional',
      'Vessel sink drilling',
      'Vessel sink drilling may require separate pricing.',
      { conditionText: 'Confirm vessel sink layout and hole placement.' }
    ),
    scopeAssumption(
      'matching_backsplash',
      'conditional',
      'Matching backsplash',
      'Matching backsplash may be priced separately.',
      { conditionText: 'Add backsplash scope when required.' }
    ),
    scopeAssumption(
      'side_splashes',
      'conditional',
      'Side splashes',
      'Side splashes may be priced separately.',
      { conditionText: 'Confirm side-splash requirements.' }
    ),
    scopeAssumption(
      'accessory_holes',
      'conditional',
      'Additional faucet or accessory holes',
      'Additional faucet or accessory holes may require separate pricing.',
      { conditionText: 'Confirm accessory hole count.' }
    ),
    scopeAssumption(
      'access_restrictions',
      'conditional',
      'Jobsite access restrictions',
      'Jobsite access restrictions may affect pricing.',
      { conditionText: 'Confirm stairs, parking, or carry distance.' }
    ),
    scopeAssumption(
      'long_distance_delivery',
      'conditional',
      'Long-distance delivery',
      'Long-distance delivery may require separate pricing.',
      { conditionText: 'Confirm delivery distance.' }
    ),
    scopeAssumption(
      'plumbing_fixture_install',
      'conditional',
      'Plumbing fixture installation',
      'Plumbing fixture installation may require separate pricing.',
      { conditionText: 'Confirm whether fixture hookup is in scope.' }
    ),
  ];
}

function prefabAssumptions(integratedSink: boolean): BenchmarkScopeAssumption[] {
  return [
    scopeAssumption('prefab_top', 'included', 'Prefabricated top', 'Prefabricated vanity top is included.'),
    scopeAssumption(
      'integrated_sink',
      integratedSink ? 'included' : 'conditional',
      'Integrated or standard sink',
      integratedSink
        ? 'Integrated or standard sink supplied with the top is included.'
        : 'Sink inclusion depends on the supplied top.',
      integratedSink
        ? undefined
        : { conditionText: 'Confirm whether the top includes an integrated sink.' }
    ),
    scopeAssumption(
      'basic_install',
      'included',
      'Basic placement and installation',
      'Basic placement and installation are included.'
    ),
    scopeAssumption('vanity_cabinet', 'excluded', 'Vanity cabinet', 'Vanity cabinet is not included.'),
    scopeAssumption('plumbing', 'excluded', 'Plumbing', 'Plumbing disconnection or reconnection is not included.'),
    scopeAssumption('demo', 'excluded', 'Demolition', 'Existing countertop removal is not included.'),
  ];
}

export function isBathroomVanityCountertopScope(
  itemId: string,
  templateKey?: string | null
): boolean {
  return itemId === 'countertops' && String(templateKey || '').toLowerCase() === 'bathroom';
}

export function normalizeBathroomVanityCountertopMaterialType(
  value: unknown
): BathroomVanityCountertopMaterialType | null {
  const v = String(value || '').trim();
  if (
    v === 'cultured_marble_prefab' ||
    v === 'prefab_quartz_stone' ||
    v === 'custom_quartz_granite' ||
    v === 'other_manual'
  ) {
    return v;
  }
  return null;
}

export function inferBathroomVanityCountertopMaterialFromNotes(
  notes?: string | null
): BathroomVanityCountertopMaterialType | null {
  const n = String(notes || '').toLowerCase();
  if (!n.trim()) return null;

  if (
    /\bcultured\s+marble\b/.test(n) ||
    /\bintegrated\s+(?:vanity\s+)?top\b/.test(n) ||
    /\bpremade\s+top\b/.test(n) ||
    /\bprefabricated\s+(?:vanity\s+)?top\b/.test(n) ||
    /\bprefab\s+(?:vanity\s+)?top\b/.test(n) ||
    (/\bvanity\s+top\b/.test(n) && /\bintegrated\s+sink\b/.test(n))
  ) {
    return 'cultured_marble_prefab';
  }

  if (
    /\bprefab(?:ricated)?\s+(?:quartz|stone)\b/.test(n) ||
    (/\bvanity\s+top\b/.test(n) && /\bprefab(?:ricated)?\b/.test(n) && !/\bcustom\b/.test(n))
  ) {
    return 'prefab_quartz_stone';
  }

  if (
    /\bcustom\b[^.]{0,40}\b(quartz|granite|stone|countertops?|vanity)\b/.test(n) ||
    /\b(quartz|granite|custom\s+stone|slab|fabricated\s+top)\b/.test(n) ||
    /\b\d+(?:\.\d+)?\s*(?:sq\.?\s*ft|sf)\b[^.]{0,50}\b(custom|quartz|granite|stone|countertops?|vanity)\b/.test(n)
  ) {
    return 'custom_quartz_granite';
  }

  return null;
}

export function resolveBathroomVanityCountertopMaterialType(params: {
  storedType?: unknown;
  choiceId?: string | null;
  notes?: string | null;
}): BathroomVanityCountertopMaterialType {
  const fromStored = normalizeBathroomVanityCountertopMaterialType(params.storedType);
  if (fromStored) return fromStored;
  const fromChoice = normalizeBathroomVanityCountertopMaterialType(params.choiceId);
  if (fromChoice) return fromChoice;
  const fromNotes = inferBathroomVanityCountertopMaterialFromNotes(params.notes);
  if (fromNotes) return fromNotes;
  return 'unknown';
}

export function bathroomVanityCountertopScopeLabel(
  materialType: BathroomVanityCountertopMaterialType
): { label: string; helperText: string; statusLabel?: string } {
  switch (materialType) {
    case 'custom_quartz_granite':
      return {
        label: 'Custom vanity countertop',
        helperText: 'Custom quartz or granite vanity countertop, fabricated and installed.',
      };
    case 'cultured_marble_prefab':
      return {
        label: 'Prefabricated vanity top',
        helperText: 'Cultured marble or prefabricated vanity top with basic placement and installation.',
      };
    case 'prefab_quartz_stone':
      return {
        label: 'Prefabricated quartz or stone top',
        helperText: 'Prefabricated quartz or stone vanity top with basic placement and installation.',
      };
    case 'other_manual':
      return {
        label: 'Vanity countertop',
        helperText: 'Enter pricing manually for this countertop type.',
      };
    default:
      return {
        label: 'Vanity countertop',
        helperText: 'Select countertop material type to price this line.',
        statusLabel: 'Material type needed',
      };
  }
}

function notesMentionSinkDetails(notes?: string | null): boolean {
  const n = String(notes || '').toLowerCase();
  return (
    /\bundermount\b/.test(n) ||
    /\bvessel\s+sink\b/.test(n) ||
    /\bintegrated\s+sink\b/.test(n) ||
    /\bsink\s+cutout\b/.test(n)
  );
}

export function bathroomVanityCountertopPricingConfidence(params: {
  materialType: BathroomVanityCountertopMaterialType;
  quantitySqft?: number | null;
  quantityEach?: number | null;
  notes?: string | null;
}): 'high' | 'medium' | 'low' {
  const { materialType } = params;
  if (materialType === 'unknown' || materialType === 'other_manual') return 'low';
  if (materialType === 'cultured_marble_prefab' || materialType === 'prefab_quartz_stone') {
    return params.quantityEach != null && params.quantityEach > 0 ? 'high' : 'medium';
  }
  const hasSqft = params.quantitySqft != null && params.quantitySqft > 0;
  const sinkKnown = notesMentionSinkDetails(params.notes);
  if (hasSqft && sinkKnown) return 'high';
  if (hasSqft) return 'medium';
  return 'low';
}

function buildScopeProfile(params: {
  materialType: BathroomVanityCountertopMaterialType;
  confidence: 'high' | 'medium' | 'low';
  integratedSink?: boolean;
}): BenchmarkScopeAssumptionProfile {
  const assumptions =
    params.materialType === 'custom_quartz_granite'
      ? customVanityCountertopAssumptions()
      : prefabAssumptions(Boolean(params.integratedSink));
  return {
    scopeAssumptionsDefined: true,
    scopeAssumptions: assumptions,
    scopeProfileSource: 'bps_standard_assumption',
    rateSource: 'bps_national_benchmark',
    rateSourceReference: 'Build Profit bathroom vanity countertop national-average profile',
    geographicBasis: 'national',
    confidence: params.confidence,
    productionStatus: params.confidence === 'high' ? 'production_ready' : 'review_required',
    audit: {
      rootCause:
        params.materialType === 'custom_quartz_granite'
          ? BATHROOM_VANITY_COUNTERTOP_VIEW_DETAILS
          : 'Prefabricated vanity tops are priced as installed each allowances rather than custom stone square-foot fabrication.',
    },
  };
}

function scaleSplitToTotal(material: number, labor: number, total: number): { material: number; labor: number } {
  const raw = material + labor;
  if (!(raw > 0) || Math.abs(raw - total) < 0.01) {
    return { material: round2(material), labor: round2(labor) };
  }
  const ratio = total / raw;
  return {
    material: round2(material * ratio),
    labor: round2(labor * ratio),
  };
}

function buildCustomFill(params: {
  quantitySqft: number;
  notes?: string | null;
}): BathroomVanityCountertopSuggestedFill {
  const calculatedMaterial = round2(params.quantitySqft * CUSTOM_MATERIAL_RATE);
  const calculatedLabor = round2(params.quantitySqft * CUSTOM_LABOR_RATE);
  const calculatedTotal = round2(params.quantitySqft * CUSTOM_INSTALLED_RATE);
  const minimumApplied = calculatedTotal < CUSTOM_MINIMUM_PROJECT;
  const total = minimumApplied ? CUSTOM_MINIMUM_PROJECT : calculatedTotal;
  const scaled = scaleSplitToTotal(calculatedMaterial, calculatedLabor, total);
  const confidence = bathroomVanityCountertopPricingConfidence({
    materialType: 'custom_quartz_granite',
    quantitySqft: params.quantitySqft,
    notes: params.notes,
  });

  const average = {
    unit: 'sqft',
    material: CUSTOM_MATERIAL_RATE,
    labor: CUSTOM_LABOR_RATE,
    sourceLabel: 'Suggested budget split · National Average · custom vanity countertop',
    materialBucketLabel: 'Material & fabrication',
    laborBucketLabel: 'Labor & installation',
    rateSource: 'bps_national_benchmark' as const,
    scopeProfileSource: 'bps_standard_assumption' as const,
    productionStatus: (confidence === 'high' ? 'production_ready' : 'review_required') as
      | 'production_ready'
      | 'review_required',
    scopeAssumptions: buildScopeProfile({
      materialType: 'custom_quartz_granite',
      confidence,
    }),
  };

  const helper = minimumApplied
    ? `${params.quantitySqft.toLocaleString()} sqft · calculated · small-project minimum applied`
    : `${params.quantitySqft.toLocaleString()} sqft · calculated`;

  return {
    material: scaled.material,
    labor: scaled.labor,
    total,
    materialSource: 'national_average',
    laborSource: 'national_average',
    rateSourceLabel: average.sourceLabel,
    helper,
    mode: 'suggested_price',
    basis: { quantity: params.quantitySqft, unit: 'sqft' },
    splitSource: 'source',
    splitConfidence: confidence,
    comparisonRange: {
      low: round2(params.quantitySqft * CUSTOM_SQFT_RANGE.low),
      high: round2(params.quantitySqft * CUSTOM_SQFT_RANGE.high),
    },
    benchmarkScopeProfile: buildScopeProfile({
      materialType: 'custom_quartz_granite',
      confidence,
    }),
    costBuckets: [
      {
        key: 'material',
        label: 'Material & fabrication',
        amount: scaled.material,
        rate: CUSTOM_MATERIAL_RATE,
        source: 'national_average',
      },
      {
        key: 'labor',
        label: 'Labor & installation',
        amount: scaled.labor,
        rate: CUSTOM_LABOR_RATE,
        source: 'national_average',
      },
    ],
    pricingRecordId: `bps_bathroom_vanity_countertop:custom:${params.quantitySqft}:${minimumApplied ? 'min' : 'calc'}`,
    productionStatus: confidence === 'high' ? 'production_ready' : 'review_required',
    storedTotalExact: total,
    impliedUnitRateLabel: minimumApplied
      ? `$${CUSTOM_INSTALLED_RATE}/sqft · small-project minimum applied`
      : `$${CUSTOM_INSTALLED_RATE}/sqft`,
  };
}

function buildPrefabFill(params: {
  materialType: 'cultured_marble_prefab' | 'prefab_quartz_stone';
  quantityEach: number;
  notes?: string | null;
  integratedSink?: boolean;
}): BathroomVanityCountertopSuggestedFill {
  const profile = params.materialType === 'cultured_marble_prefab' ? CULTURED_MARBLE_EACH : PREFAB_QUARTZ_EACH;
  const material = round2(profile.material * params.quantityEach);
  const labor = round2(profile.labor * params.quantityEach);
  const total = round2(profile.total * params.quantityEach);
  const confidence = bathroomVanityCountertopPricingConfidence({
    materialType: params.materialType,
    quantityEach: params.quantityEach,
    notes: params.notes,
  });

  return {
    material,
    labor,
    total,
    materialSource: 'national_average',
    laborSource: 'national_average',
    rateSourceLabel:
      params.materialType === 'cultured_marble_prefab'
        ? 'Suggested budget split · National Average · cultured marble vanity top'
        : 'Suggested budget split · National Average · prefabricated quartz/stone vanity top',
    helper: `${params.quantityEach.toLocaleString()} each · installed allowance`,
    mode: 'suggested_price',
    basis: { quantity: params.quantityEach, unit: 'each' },
    splitSource: 'source',
    splitConfidence: confidence,
    comparisonRange: {
      low: round2(profile.range.low * params.quantityEach),
      high: round2(profile.range.high * params.quantityEach),
    },
    benchmarkScopeProfile: buildScopeProfile({
      materialType: params.materialType,
      confidence,
      integratedSink: params.integratedSink,
    }),
    costBuckets: [
      {
        key: 'material',
        label: 'Top & sink package',
        amount: material,
        rate: profile.material,
        source: 'national_average',
      },
      {
        key: 'labor',
        label: 'Placement & installation',
        amount: labor,
        rate: profile.labor,
        source: 'national_average',
      },
    ],
    pricingRecordId: `bps_bathroom_vanity_countertop:${params.materialType}:${params.quantityEach}`,
    productionStatus: confidence === 'high' ? 'production_ready' : 'review_required',
    storedTotalExact: total,
  };
}

export function resolveBathroomVanityCountertopSuggestedPricing(params: {
  materialType: BathroomVanityCountertopMaterialType;
  quantitySqft?: number | null;
  quantityEach?: number | null;
  notes?: string | null;
}): BathroomVanityCountertopSuggestedPricing {
  const empty: BathroomVanityCountertopSuggestedPricing = { fill: null, comparison: null };
  const { materialType } = params;

  if (materialType === 'unknown' || materialType === 'other_manual') {
    return empty;
  }

  if (materialType === 'custom_quartz_granite') {
    const sqft = Number(params.quantitySqft);
    if (!(Number.isFinite(sqft) && sqft > 0)) return empty;
    return { fill: buildCustomFill({ quantitySqft: sqft, notes: params.notes }), comparison: null };
  }

  const each = Number(params.quantityEach);
  if (!(Number.isFinite(each) && each > 0)) return empty;
  const integratedSink = /\bintegrated\s+sink\b/i.test(String(params.notes || ''));
  return {
    fill: buildPrefabFill({
      materialType,
      quantityEach: each,
      notes: params.notes,
      integratedSink,
    }),
    comparison: null,
  };
}

export function minimumProjectAppliedForCustomVanityCountertop(quantitySqft: number): boolean {
  return round2(quantitySqft * CUSTOM_INSTALLED_RATE) < CUSTOM_MINIMUM_PROJECT;
}
