export type ProjectConstructionType =
  | 'production'
  | 'standard'
  | 'custom'
  | 'luxury';

export type ProjectAccessibility = 'normal' | 'difficult';

export type ProjectComplexityMode = 'automatic' | 'manual';

export type ProjectComplexitySettings = {
  mode?: ProjectComplexityMode;
  squareFootage?: number | null;
  stories?: 1 | 2 | 3 | null;
  constructionType?: ProjectConstructionType | null;
  accessibility?: ProjectAccessibility | null;
  /** Manual override as decimal multiplier (e.g. 1.25 = +25%). */
  manualMultiplier?: number | null;
};

export type ProjectComplexityFactorInput = {
  squareFootage?: number | null;
  stories?: number | null;
  constructionType?: ProjectConstructionType | null;
  accessibility?: ProjectAccessibility | null;
  mode?: ProjectComplexityMode | null;
  manualMultiplier?: number | null;
};

export type ProjectComplexityMultiplierBreakdown = {
  squareFootMultiplier: number;
  storyMultiplier: number;
  constructionMultiplier: number;
  accessibilityMultiplier: number;
  totalMultiplier: number;
  capped: boolean;
  mode: ProjectComplexityMode;
};

export const PROJECT_COMPLEXITY_AUTOMATIC_MIN = 0.85;
export const PROJECT_COMPLEXITY_AUTOMATIC_MAX = 1.35;
export const PROJECT_COMPLEXITY_MANUAL_MIN = 0.75;
export const PROJECT_COMPLEXITY_MANUAL_MAX = 1.5;

export const PROJECT_COMPLEXITY_ADJUSTMENTS = {
  squareFootage: [
    { min: 0, max: 1999, multiplier: 1.0 },
    { min: 2000, max: 2999, multiplier: 1.1 },
    { min: 3000, max: 3999, multiplier: 1.15 },
    { min: 4000, max: Number.POSITIVE_INFINITY, multiplier: 1.25 },
  ],
  stories: {
    oneStory: 1.0,
    twoStory: 1.1,
    threeStory: 1.15,
  },
  constructionType: {
    production: 0.9,
    standard: 1.0,
    custom: 1.15,
    luxury: 1.25,
  },
  accessibility: {
    normal: 1.0,
    difficult: 1.1,
  },
} as const;

const PLUMBING_COMPLEXITY_ITEM_IDS = new Set([
  'plumbing_rough',
  'plumbing_trim',
  'plumbing_fixtures_hardware',
  'water_heater',
  'water_line',
  'sewer_line',
  'gas_line',
  'gas_appliance_connections',
  'plumbing',
  'fixture_replace',
  'fixture_repair',
  'drain_cleaning',
  'service_call',
]);

const ELECTRICAL_COMPLEXITY_ITEM_IDS = new Set([
  'electrical_rough',
  'electrical_trim',
  'electrical',
  'conduit',
  'trenching',
  'panel_upgrade',
  'service_upgrade',
  'subpanel',
]);

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function positive(value: unknown): number | null {
  const number = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function resolveStories(stories: number | null | undefined): 1 | 2 | 3 {
  const value = Math.round(Number(stories) || 0);
  if (value >= 3) return 3;
  if (value >= 2) return 2;
  return 1;
}

export function resolveSquareFootageMultiplier(squareFootage: number | null | undefined): number {
  const sf = positive(squareFootage);
  if (sf == null) return 1;
  for (const band of PROJECT_COMPLEXITY_ADJUSTMENTS.squareFootage) {
    if (sf >= band.min && sf <= band.max) return band.multiplier;
  }
  return 1;
}

export function resolveStoryMultiplier(stories: number | null | undefined): number {
  const normalized = resolveStories(stories);
  if (normalized === 3) return PROJECT_COMPLEXITY_ADJUSTMENTS.stories.threeStory;
  if (normalized === 2) return PROJECT_COMPLEXITY_ADJUSTMENTS.stories.twoStory;
  return PROJECT_COMPLEXITY_ADJUSTMENTS.stories.oneStory;
}

export function resolveConstructionMultiplier(
  constructionType: ProjectConstructionType | null | undefined
): number {
  const key = constructionType || 'standard';
  return PROJECT_COMPLEXITY_ADJUSTMENTS.constructionType[key] ?? 1;
}

export function resolveAccessibilityMultiplier(
  accessibility: ProjectAccessibility | null | undefined
): number {
  const key = accessibility || 'normal';
  return PROJECT_COMPLEXITY_ADJUSTMENTS.accessibility[key] ?? 1;
}

export function calculateProjectComplexityMultiplier(
  input: ProjectComplexityFactorInput = {}
): ProjectComplexityMultiplierBreakdown {
  const mode: ProjectComplexityMode =
    input.mode === 'manual' ? 'manual' : 'automatic';
  if (mode === 'manual') {
    const manual = clamp(
      positive(input.manualMultiplier) ?? 1,
      PROJECT_COMPLEXITY_MANUAL_MIN,
      PROJECT_COMPLEXITY_MANUAL_MAX
    );
    return {
      squareFootMultiplier: 1,
      storyMultiplier: 1,
      constructionMultiplier: 1,
      accessibilityMultiplier: 1,
      totalMultiplier: round2(manual),
      capped: manual !== positive(input.manualMultiplier),
      mode,
    };
  }

  const squareFootMultiplier = resolveSquareFootageMultiplier(input.squareFootage);
  const storyMultiplier = resolveStoryMultiplier(input.stories);
  const constructionMultiplier = resolveConstructionMultiplier(input.constructionType);
  const accessibilityMultiplier = resolveAccessibilityMultiplier(input.accessibility);
  const raw =
    squareFootMultiplier *
    storyMultiplier *
    constructionMultiplier *
    accessibilityMultiplier;
  const totalMultiplier = round2(
    clamp(raw, PROJECT_COMPLEXITY_AUTOMATIC_MIN, PROJECT_COMPLEXITY_AUTOMATIC_MAX)
  );
  return {
    squareFootMultiplier,
    storyMultiplier,
    constructionMultiplier,
    accessibilityMultiplier,
    totalMultiplier,
    capped: Math.abs(totalMultiplier - raw) > 0.001,
    mode,
  };
}

export function inferProjectComplexitySettings(input: {
  floorAreaSqft?: unknown;
  storyCount?: unknown;
  projectComplexity?: ProjectComplexitySettings | null;
  plumbingComplexityFactors?: Array<{ key?: string; label?: string }> | null;
}): ProjectComplexitySettings {
  const stored = input.projectComplexity || {};
  const inferredStories = (() => {
    const fromField = positive(input.storyCount);
    if (fromField != null) return resolveStories(fromField);
    const fromPlan = (input.plumbingComplexityFactors || []).some(
      factor =>
        factor.key === 'two_story_plumbing' ||
        /two[\s-]?story/i.test(String(factor.label || ''))
    );
    return fromPlan ? 2 : 1;
  })();

  return {
    mode: stored.mode === 'manual' ? 'manual' : 'automatic',
    squareFootage:
      positive(stored.squareFootage) ??
      positive(input.floorAreaSqft) ??
      null,
    stories:
      stored.stories != null
        ? resolveStories(stored.stories)
        : inferredStories,
    constructionType: stored.constructionType || 'standard',
    accessibility: stored.accessibility || 'normal',
    manualMultiplier:
      stored.manualMultiplier != null
        ? clamp(
            Number(stored.manualMultiplier) || 1,
            PROJECT_COMPLEXITY_MANUAL_MIN,
            PROJECT_COMPLEXITY_MANUAL_MAX
          )
        : null,
  };
}

export function projectComplexityEligibleTemplate(
  templateKey?: string | null
): boolean {
  const template = String(templateKey || '').toLowerCase();
  return (
    template === 'plumbing_service' ||
    template === 'plumbing' ||
    template === 'electrical' ||
    template === 'ground_up' ||
    template === 'addition'
  );
}

export function isProjectComplexityEligibleItem(
  itemId: string,
  templateKey?: string | null
): boolean {
  if (!projectComplexityEligibleTemplate(templateKey)) return false;
  const id = String(itemId || '').trim();
  if (PLUMBING_COMPLEXITY_ITEM_IDS.has(id)) return true;
  if (ELECTRICAL_COMPLEXITY_ITEM_IDS.has(id)) return true;
  if (id.startsWith('electrical_')) return true;
  return false;
}

export function complexityAppliesLaborOnly(itemId: string): boolean {
  const id = String(itemId || '').trim();
  if (
    PLUMBING_COMPLEXITY_ITEM_IDS.has(id) ||
    ELECTRICAL_COMPLEXITY_ITEM_IDS.has(id) ||
    id.startsWith('electrical_')
  ) {
    return true;
  }
  return false;
}

export function formatComplexityPercent(multiplier: number): string {
  const delta = Math.round((multiplier - 1) * 100);
  if (delta === 0) return '0%';
  return delta > 0 ? `+${delta}%` : `${delta}%`;
}

export type SuggestedPricingComplexityMeta = {
  baseMaterial: number;
  baseLabor: number;
  baseTotal: number;
  laborMultiplier: number;
  totalMultiplier: number;
  breakdown: ProjectComplexityMultiplierBreakdown;
};

type ComplexityPricingBlock = {
  material: number;
  labor: number;
  total: number;
  helper?: string;
  rateSourceLabel?: string;
  storedTotalExact?: number | null;
  costBuckets?: Array<{ key?: string; amount?: number }> | null;
  complexityAdjustment?: SuggestedPricingComplexityMeta;
  isComparison?: boolean;
};

type ComplexityPricingResult = {
  fill: ComplexityPricingBlock | null;
  comparison?: ComplexityPricingBlock | null;
};

export function applyComplexityToSuggestedBlock<T extends ComplexityPricingBlock>(
  block: T,
  breakdown: ProjectComplexityMultiplierBreakdown,
  options?: { laborOnly?: boolean }
): T {
  if (!(breakdown.totalMultiplier > 0) || breakdown.totalMultiplier === 1) {
    return block;
  }
  const laborOnly = options?.laborOnly !== false;
  const laborMultiplier = breakdown.totalMultiplier;
  const materialMultiplier = laborOnly ? 1 : breakdown.totalMultiplier;
  const baseMaterial = block.material;
  const baseLabor = block.labor;
  const material = round2(baseMaterial * materialMultiplier);
  const labor = round2(baseLabor * laborMultiplier);
  const total = round2(material + labor);
  const pct = formatComplexityPercent(breakdown.totalMultiplier);
  const helperSuffix = laborOnly
    ? ` · Project complexity ${pct} on labor`
    : ` · Project complexity ${pct}`;
  const helper = String(block.helper || '').includes('Project complexity')
    ? block.helper
    : `${block.helper || ''}${helperSuffix}`.trim();

  return {
    ...block,
    material,
    labor,
    total,
    storedTotalExact: total,
    rateSourceLabel: block.rateSourceLabel?.includes('complexity')
      ? block.rateSourceLabel
      : `${block.rateSourceLabel || 'Suggested pricing'} · complexity adjusted`,
    helper,
    costBuckets: Array.isArray(block.costBuckets)
      ? block.costBuckets.map(bucket =>
          bucket.key === 'labor'
            ? { ...bucket, amount: labor }
            : bucket.key === 'material'
              ? { ...bucket, amount: material }
              : bucket
        )
      : block.costBuckets,
    complexityAdjustment: {
      baseMaterial,
      baseLabor,
      baseTotal: round2(baseMaterial + baseLabor),
      laborMultiplier,
      totalMultiplier: breakdown.totalMultiplier,
      breakdown,
    },
  };
}

export function applyProjectComplexityToSuggestedPricing(
  itemId: string,
  templateKey: string | null | undefined,
  measurementsInput: {
    floorAreaSqft?: unknown;
    storyCount?: unknown;
    projectComplexity?: ProjectComplexitySettings | null;
    plumbingComplexityFactors?: Array<{ key?: string; label?: string }> | null;
  },
  result: ComplexityPricingResult
): ComplexityPricingResult {
  if (!result.fill || result.fill.isComparison) return result;
  if (!isProjectComplexityEligibleItem(itemId, templateKey)) return result;

  const settings = inferProjectComplexitySettings({
    floorAreaSqft: measurementsInput.floorAreaSqft,
    storyCount: measurementsInput.storyCount,
    projectComplexity: measurementsInput.projectComplexity,
    plumbingComplexityFactors: measurementsInput.plumbingComplexityFactors,
  });
  const breakdown = calculateProjectComplexityMultiplier(settings);
  if (breakdown.totalMultiplier === 1) return result;

  return {
    ...result,
    fill: applyComplexityToSuggestedBlock(result.fill, breakdown, {
      laborOnly: complexityAppliesLaborOnly(itemId),
    }),
  };
}

export function summarizeProjectComplexity(
  settings: ProjectComplexitySettings
): Array<{ label: string; detail: string; percent: string }> {
  const breakdown = calculateProjectComplexityMultiplier(settings);
  if (breakdown.mode === 'manual') {
    return [
      {
        label: 'Manual adjustment',
        detail: 'Contractor override',
        percent: formatComplexityPercent(breakdown.totalMultiplier),
      },
    ];
  }
  const rows = [
    {
      label: 'Home size',
      detail:
        settings.squareFootage != null
          ? `${Math.round(settings.squareFootage).toLocaleString()} SF`
          : 'Not set',
      percent: formatComplexityPercent(breakdown.squareFootMultiplier),
    },
    {
      label: 'Stories',
      detail:
        settings.stories === 3
          ? '3+ story'
          : settings.stories === 2
            ? '2 story'
            : '1 story',
      percent: formatComplexityPercent(breakdown.storyMultiplier),
    },
    {
      label: 'Construction type',
      detail: String(settings.constructionType || 'standard'),
      percent: formatComplexityPercent(breakdown.constructionMultiplier),
    },
    {
      label: 'Site access',
      detail: settings.accessibility === 'difficult' ? 'Difficult' : 'Normal',
      percent: formatComplexityPercent(breakdown.accessibilityMultiplier),
    },
  ];
  return rows.filter(row => row.percent !== '0%');
}
