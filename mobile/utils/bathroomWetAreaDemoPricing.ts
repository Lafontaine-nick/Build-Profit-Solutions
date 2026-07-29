import type { BenchmarkScopeAssumption, BenchmarkScopeAssumptionProfile } from '@/utils/benchmarkScopeAssumptions';
import type { ScopeMeasurementsInputExtended } from '@/utils/scopeItemQuantities';
import { readWetAreaDemoCounts } from '@/utils/wetAreaExistingDemo';

export const BATHROOM_WET_AREA_DEMO_HELPER =
  'Remove shower wall tile, shower base or pan (tile or prefab), and tub when present — bathroom floor demo is a separate line.';

const TILE_DEMO_MATERIAL_RATE = 0.5;
const TILE_DEMO_LABOR_RATE = 5;
const TILE_DEMO_INSTALLED_RATE = 5.5;

const TUB_DEMO_EACH = { material: 50, labor: 300, total: 350 } as const;
const PREFAB_PAN_DEMO_EACH = { material: 50, labor: 300, total: 350 } as const;
const PREFAB_ENCLOSURE_DEMO_EACH = { material: 100, labor: 500, total: 600 } as const;

export type BathroomWetAreaDemoSuggestedFill = {
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
  costBuckets?: Array<{
    key: 'material' | 'labor';
    label: string;
    amount: number;
    rate?: number | null;
    source: 'national_average';
  }>;
  benchmarkScopeProfile?: BenchmarkScopeAssumptionProfile;
  pricingRecordId?: string;
  productionStatus?: 'production_ready' | 'review_required';
  storedTotalExact?: number | null;
};

export type BathroomWetAreaDemoSuggestedPricing = {
  fill: BathroomWetAreaDemoSuggestedFill | null;
  comparison: null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function stepperActive(value: number | null | undefined): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
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
    sourceReference: 'Build Profit bathroom wet-area demo scope model',
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

function buildBathroomWetAreaDemoAssumptions(params: {
  includesTub: boolean;
  includesPrefabPan: boolean;
  includesPrefabEnclosure: boolean;
  includesTilePan: boolean;
}): BenchmarkScopeAssumption[] {
  return [
    scopeAssumption(
      'shower_wall_tile',
      'included',
      'Shower wall tile removal',
      'Removal of existing shower wall tile and backing is included.'
    ),
    scopeAssumption(
      'shower_floor_tile',
      params.includesTilePan ? 'included' : 'conditional',
      'Tile shower floor / mud pan removal',
      params.includesTilePan
        ? 'Removal of existing tile shower floor or mud pan is included.'
        : 'Tile shower floor removal applies when a tile pan is being removed.',
      params.includesTilePan
        ? undefined
        : { conditionText: 'Confirm whether a tile shower floor or mud pan is being removed.' }
    ),
    scopeAssumption(
      'prefab_pan',
      params.includesPrefabPan ? 'included' : 'conditional',
      'Prefab shower pan / base removal',
      params.includesPrefabPan
        ? 'Removal of an existing prefabricated shower pan or acrylic base is included.'
        : 'Prefab pan removal applies when an existing prefab base is being removed.',
      params.includesPrefabPan
        ? undefined
        : { conditionText: 'Confirm whether an existing prefab shower pan or base is in scope.' }
    ),
    scopeAssumption(
      'prefab_enclosure',
      params.includesPrefabEnclosure ? 'included' : 'conditional',
      'Prefab shower enclosure removal',
      params.includesPrefabEnclosure
        ? 'Removal of an existing prefab surround or one-piece enclosure is included.'
        : 'Prefab enclosure removal applies when a surround unit is being removed.',
      params.includesPrefabEnclosure
        ? undefined
        : { conditionText: 'Confirm whether a prefab shower surround is being removed.' }
    ),
    scopeAssumption(
      'tub',
      params.includesTub ? 'included' : 'conditional',
      'Bathtub removal',
      params.includesTub
        ? 'Demo and haul-off of the existing bathtub (alcove, drop-in, or freestanding) is included.'
        : 'Tub removal applies when an existing tub is being removed.',
      params.includesTub
        ? undefined
        : { conditionText: 'Confirm whether an existing tub is being removed.' }
    ),
    scopeAssumption(
      'bath_floor',
      'excluded',
      'Bathroom floor demo',
      'Bathroom floor tile or LVP removal is priced on the separate floor demo line.'
    ),
    scopeAssumption('dump_fees', 'excluded', 'Dump fees', 'Dump fees and disposal facility costs are not included.'),
    scopeAssumption(
      'plumbing_cap',
      'excluded',
      'Plumbing capping / rough-in',
      'Plumbing capping, relocation, or rough-in is not included.'
    ),
  ];
}

function buildHelper(params: {
  tileSqft: number;
  includesTub: boolean;
  includesPrefabPan: boolean;
  includesPrefabEnclosure: boolean;
  sourceLabel?: string | null;
}): string {
  const parts: string[] = [];
  if (params.tileSqft > 0) {
    parts.push(
      `${params.tileSqft.toLocaleString()} sqft shower tile @ $${TILE_DEMO_INSTALLED_RATE.toFixed(2)}/SF`
    );
  }
  if (params.includesTub) parts.push('tub removal');
  if (params.includesPrefabEnclosure) parts.push('prefab enclosure');
  else if (params.includesPrefabPan) parts.push('prefab pan');
  const basis = parts.length ? parts.join(' · ') : 'Wet-area tear-out';
  const source = params.sourceLabel ? ` · ${params.sourceLabel}` : '';
  return `${basis}${source}`.trim();
}

export function resolveBathroomWetAreaDemoSuggestedPricing(params: {
  measurementsInput: ScopeMeasurementsInputExtended;
  tileSqft: number;
  sourceLabel?: string | null;
}): BathroomWetAreaDemoSuggestedPricing {
  const demo = readWetAreaDemoCounts(params.measurementsInput as Record<string, unknown>);
  const includesTub = stepperActive(demo.demoTubCount);
  const includesTilePan = stepperActive(demo.demoTilePanCount);
  const includesPrefabPan = stepperActive(demo.demoPrefabPanCount);
  const includesPrefabEnclosure = stepperActive(demo.demoPrefabEnclosureCount);

  const tileSqft = Math.max(0, Number(params.tileSqft) || 0);
  let material = round2(tileSqft * TILE_DEMO_MATERIAL_RATE);
  let labor = round2(tileSqft * TILE_DEMO_LABOR_RATE);

  if (includesTub) {
    material = round2(material + TUB_DEMO_EACH.material);
    labor = round2(labor + TUB_DEMO_EACH.labor);
  }
  if (includesPrefabPan) {
    material = round2(material + PREFAB_PAN_DEMO_EACH.material);
    labor = round2(labor + PREFAB_PAN_DEMO_EACH.labor);
  }
  if (includesPrefabEnclosure) {
    material = round2(material + PREFAB_ENCLOSURE_DEMO_EACH.material);
    labor = round2(labor + PREFAB_ENCLOSURE_DEMO_EACH.labor);
  }

  const total = round2(material + labor);
  if (!(total > 0)) {
    return { fill: null, comparison: null };
  }

  const assumptions = buildBathroomWetAreaDemoAssumptions({
    includesTub,
    includesPrefabPan,
    includesPrefabEnclosure,
    includesTilePan,
  });
  const confidence =
    tileSqft > 0 && (includesTub || includesTilePan || includesPrefabPan || includesPrefabEnclosure)
      ? 'high'
      : tileSqft > 0
        ? 'medium'
        : 'low';

  const costBuckets: BathroomWetAreaDemoSuggestedFill['costBuckets'] = [];
  if (tileSqft > 0) {
    costBuckets.push({
      key: 'material',
      label: 'Shower tile demo · material',
      amount: round2(tileSqft * TILE_DEMO_MATERIAL_RATE),
      rate: TILE_DEMO_MATERIAL_RATE,
      source: 'national_average',
    });
    costBuckets.push({
      key: 'labor',
      label: 'Shower tile demo · labor',
      amount: round2(tileSqft * TILE_DEMO_LABOR_RATE),
      rate: TILE_DEMO_LABOR_RATE,
      source: 'national_average',
    });
  }
  if (includesTub) {
    costBuckets.push({
      key: 'labor',
      label: 'Tub removal',
      amount: TUB_DEMO_EACH.total,
      source: 'national_average',
    });
  }
  if (includesPrefabPan) {
    costBuckets.push({
      key: 'labor',
      label: 'Prefab pan removal',
      amount: PREFAB_PAN_DEMO_EACH.total,
      source: 'national_average',
    });
  }
  if (includesPrefabEnclosure) {
    costBuckets.push({
      key: 'labor',
      label: 'Prefab enclosure removal',
      amount: PREFAB_ENCLOSURE_DEMO_EACH.total,
      source: 'national_average',
    });
  }

  return {
    fill: {
      material,
      labor,
      total,
      materialSource: 'national_average',
      laborSource: 'national_average',
      rateSourceLabel: 'Suggested budget split · National Average · bathroom wet-area demo',
      helper: buildHelper({
        tileSqft,
        includesTub,
        includesPrefabPan,
        includesPrefabEnclosure,
        sourceLabel: params.sourceLabel,
      }),
      mode: 'suggested_price',
      basis: tileSqft > 0 ? { quantity: tileSqft, unit: 'sqft' } : null,
      splitSource: 'source',
      splitConfidence: confidence,
      costBuckets,
      benchmarkScopeProfile: {
        scopeAssumptionsDefined: true,
        scopeAssumptions: assumptions,
        scopeProfileSource: 'bps_standard_assumption',
        rateSource: 'bps_national_benchmark',
        rateSourceReference: 'Build Profit bathroom wet-area demo national-average profile',
        geographicBasis: 'national',
        confidence,
        productionStatus: confidence === 'high' ? 'production_ready' : 'review_required',
      },
      pricingRecordId: `bps_bathroom_wet_area_demo:${tileSqft}:${includesTub ? 'tub' : ''}:${includesPrefabPan ? 'pan' : ''}:${includesPrefabEnclosure ? 'enc' : ''}`,
      productionStatus: confidence === 'high' ? 'production_ready' : 'review_required',
      storedTotalExact: total,
    },
    comparison: null,
  };
}
