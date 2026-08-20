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

type PlanFactsLike = {
  storyCount?: number | null;
  buildingAreas?: {
    totalLivingSqft?: number | null;
    upstairsLivingSqft?: number | null;
  } | null;
} | null | undefined;

export type ProjectComplexityMeasurementContext = {
  floorAreaSqft?: unknown;
  storyCount?: unknown;
  planFacts?: PlanFactsLike;
  plumbingComplexityFactors?: Array<{ key?: string; label?: string }> | null;
  planImportMode?: string | null;
  planImportTradeKey?: string | null;
  planImportFingerprint?: string | null;
  quickMeasurementSources?: Record<string, string> | null;
  quickMeasurementUserOverrides?: Record<string, boolean> | null;
  /** When false, never infer living SF / stories from planFacts (notes-only jobs). */
  allowPlanFactsFallback?: boolean;
};

/** Contractor explicitly entered living area for complexity (not plan-detected). */
export function isMepUserEnteredLivingArea(
  input: ProjectComplexityMeasurementContext = {}
): boolean {
  if (input.quickMeasurementUserOverrides?.floorAreaSqft) return true;
  const source = String(input.quickMeasurementSources?.floorAreaSqft || '');
  return source === 'user_entered' || source === 'manual_override';
}

/**
 * Plan-import plumbing/electrical uses card takeoff for size — apply story labor
 * only unless the contractor opts in to a living-area adjustment.
 */
export function shouldApplySquareFootageComplexity(
  input: ProjectComplexityMeasurementContext = {}
): boolean {
  if (isMepUserEnteredLivingArea(input)) return true;
  const trade = String(input.planImportTradeKey || '').toLowerCase();
  if (
    input.planImportMode === 'selected_trade' &&
    (trade === 'plumbing' || trade === 'electrical')
  ) {
    return false;
  }
  if (!hasPlanProjectComplexityContext(input)) {
    return (
      positive(input.floorAreaSqft) != null ||
      (planFactsFallbackAllowed(input) &&
        positive(input.planFacts?.buildingAreas?.totalLivingSqft) != null)
    );
  }
  return positive(input.floorAreaSqft) != null;
}

const PLAN_COMPLEXITY_QM_SOURCES = new Set([
  'plan_detected',
  'detected_from_plan',
  'plan_verified',
  'ai_verified',
  'contractor_confirmed_from_plan_review',
  'measured_from_geometry',
  'calculated_from_components',
  'estimated_from_formula',
  'fallback_multiplier',
]);

/** True when complexity fields may be seeded from plan takeoff / planFacts. */
export function hasPlanProjectComplexityContext(
  input: ProjectComplexityMeasurementContext = {}
): boolean {
  if (input.planImportMode || input.planImportFingerprint) return true;
  if (input.planImportTradeKey) return true;
  const sources = input.quickMeasurementSources || {};
  if (
    Object.values(sources).some(source =>
      PLAN_COMPLEXITY_QM_SOURCES.has(String(source))
    )
  ) {
    return true;
  }
  const planFacts = input.planFacts;
  if (
    planFacts &&
    (positive(planFacts.buildingAreas?.totalLivingSqft) != null ||
      positive(planFacts.storyCount) != null)
  ) {
    return Boolean(input.planImportMode || input.planImportFingerprint || input.planImportTradeKey);
  }
  return false;
}

function planFactsFallbackAllowed(
  input: ProjectComplexityMeasurementContext = {}
): boolean {
  if (input.allowPlanFactsFallback === false) return false;
  if (input.allowPlanFactsFallback === true) return true;
  return hasPlanProjectComplexityContext(input);
}

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

export function resolveStoryCountFromProjectContext(
  input: ProjectComplexityMeasurementContext = {}
): 1 | 2 | 3 {
  const fromField = positive(input.storyCount);
  if (fromField != null) return resolveStories(fromField);

  if (planFactsFallbackAllowed(input)) {
    const fromPlanFacts = positive(input.planFacts?.storyCount);
    if (fromPlanFacts != null) return resolveStories(fromPlanFacts);

    if (positive(input.planFacts?.buildingAreas?.upstairsLivingSqft) != null) {
      return 2;
    }
  }

  const fromPlumbingFlag = (input.plumbingComplexityFactors || []).some(
    factor =>
      factor.key === 'two_story_plumbing' ||
      /two[\s-]?story/i.test(String(factor.label || ''))
  );
  return fromPlumbingFlag ? 2 : 1;
}

export function resolveFloorAreaFromProjectContext(
  input: ProjectComplexityMeasurementContext = {}
): number | null {
  const fromField = positive(input.floorAreaSqft);
  if (fromField != null) return fromField;
  if (!planFactsFallbackAllowed(input)) return null;
  return positive(input.planFacts?.buildingAreas?.totalLivingSqft) ?? null;
}

/** Copy storyCount / floorAreaSqft from planFacts when missing on persisted measurements. */
export function hydrateProjectComplexityMeasurements<
  T extends Record<string, unknown>,
>(measurements: T): T {
  if (!hasPlanProjectComplexityContext(measurements as ProjectComplexityMeasurementContext)) {
    return measurements;
  }

  const planFacts = measurements.planFacts as PlanFactsLike;
  if (!planFacts && !measurements.plumbingComplexityFactors) return measurements;

  const out = { ...measurements };
  if (!positive(out.storyCount)) {
    const fromPlan = positive(planFacts?.storyCount);
    if (fromPlan != null) {
      out.storyCount = resolveStories(fromPlan);
    } else if (positive(planFacts?.buildingAreas?.upstairsLivingSqft) != null) {
      out.storyCount = 2;
    }
  }
  if (
    !positive(out.floorAreaSqft) &&
    shouldApplySquareFootageComplexity({
      floorAreaSqft: out.floorAreaSqft,
      storyCount: out.storyCount,
      planFacts,
      planImportMode: measurements.planImportMode as string | null | undefined,
      planImportTradeKey: measurements.planImportTradeKey as
        | string
        | null
        | undefined,
      planImportFingerprint: measurements.planImportFingerprint as
        | string
        | null
        | undefined,
      quickMeasurementSources: measurements.quickMeasurementSources as
        | Record<string, string>
        | null
        | undefined,
      quickMeasurementUserOverrides: measurements.quickMeasurementUserOverrides as
        | Record<string, boolean>
        | null
        | undefined,
    })
  ) {
    const resolved = resolveFloorAreaFromProjectContext({
      floorAreaSqft: out.floorAreaSqft,
      planFacts,
      planImportMode: measurements.planImportMode as string | null | undefined,
      planImportTradeKey: measurements.planImportTradeKey as
        | string
        | null
        | undefined,
      planImportFingerprint: measurements.planImportFingerprint as
        | string
        | null
        | undefined,
      quickMeasurementSources: measurements.quickMeasurementSources as
        | Record<string, string>
        | null
        | undefined,
    });
    if (resolved != null) out.floorAreaSqft = resolved;
  }
  return out;
}

export function hydrateProjectComplexityInputFields(
  input: ProjectComplexityMeasurementContext & {
    floorAreaSqft?: string | number | null;
    storyCount?: string | number | null;
  }
): { floorAreaSqft?: string; storyCount?: string } {
  const patches: { floorAreaSqft?: string; storyCount?: string } = {};
  if (!hasPlanProjectComplexityContext(input)) {
    return patches;
  }
  if (!positive(input.storyCount)) {
    const fromPlan = positive(input.planFacts?.storyCount);
    if (fromPlan != null) {
      patches.storyCount = String(resolveStories(fromPlan));
    } else if (
      positive(input.planFacts?.buildingAreas?.upstairsLivingSqft) != null
    ) {
      patches.storyCount = '2';
    }
  }
  if (
    !positive(input.floorAreaSqft) &&
    shouldApplySquareFootageComplexity(input)
  ) {
    const resolved = resolveFloorAreaFromProjectContext(input);
    if (resolved != null) patches.floorAreaSqft = String(Math.round(resolved));
  }
  return patches;
}

/** Seed living SF / stories for MEP selected-trade imports (complexity only). */
export function seedMepProjectComplexityFromPlanImport(
  scopeMeasurements: Record<string, unknown>,
  payload: {
    buildingAreas?: PlanFacts['buildingAreas'] | null;
    planFacts?: PlanFacts | null;
  }
): void {
  const buildingAreas = {
    ...(payload.buildingAreas || {}),
    ...(payload.planFacts?.buildingAreas || {}),
  };
  const planStory = positive(payload.planFacts?.storyCount);
  const totalLiving = positive(buildingAreas.totalLivingSqft);
  const upstairsLiving = positive(buildingAreas.upstairsLivingSqft);
  const resolvedStories =
    planStory != null
      ? resolveStories(planStory)
      : upstairsLiving != null
        ? 2
        : null;

  if (totalLiving != null || resolvedStories != null || upstairsLiving != null) {
    const existingPlanFacts =
      scopeMeasurements.planFacts && typeof scopeMeasurements.planFacts === 'object'
        ? (scopeMeasurements.planFacts as PlanFacts)
        : {};
    scopeMeasurements.planFacts = {
      ...existingPlanFacts,
      ...(resolvedStories != null ? { storyCount: resolvedStories } : {}),
      buildingAreas: {
        ...(existingPlanFacts.buildingAreas || {}),
        ...buildingAreas,
      },
    };
  }

  const overrides =
    (scopeMeasurements.quickMeasurementUserOverrides as
      | Record<string, boolean>
      | undefined) || {};
  const sources =
    (scopeMeasurements.quickMeasurementSources as Record<string, string>) || {};

  if (
    resolvedStories != null &&
    !positive(scopeMeasurements.storyCount) &&
    !overrides.storyCount
  ) {
    scopeMeasurements.storyCount = String(resolvedStories);
    scopeMeasurements.quickMeasurementSources = {
      ...(scopeMeasurements.quickMeasurementSources as Record<string, string>),
      storyCount: 'plan_detected',
    };
  }

  const stories =
    positive(scopeMeasurements.storyCount) ?? resolvedStories ?? null;
  if (stories != null) {
    const existingComplexity =
      scopeMeasurements.projectComplexity &&
      typeof scopeMeasurements.projectComplexity === 'object'
        ? scopeMeasurements.projectComplexity
        : {};
    scopeMeasurements.projectComplexity = {
      ...existingComplexity,
      mode: 'automatic',
      stories: resolveStories(stories) as 1 | 2 | 3,
    };
  }
}

export function inferProjectComplexitySettings(
  input: ProjectComplexityMeasurementContext & {
    projectComplexity?: ProjectComplexitySettings | null;
  }
): ProjectComplexitySettings {
  const stored = input.projectComplexity || {};
  const inferredStories = resolveStoryCountFromProjectContext(input);
  const enteredStories = positive(input.storyCount);
  const storyCountWasEdited =
    input.quickMeasurementUserOverrides?.storyCount === true ||
    String(input.quickMeasurementSources?.storyCount || '') === 'user_entered' ||
    String(input.quickMeasurementSources?.storyCount || '') === 'manual_override';
  let squareFootage =
    positive(stored.squareFootage) ??
    resolveFloorAreaFromProjectContext(input) ??
    null;
  if (!shouldApplySquareFootageComplexity(input)) {
    squareFootage = null;
  }

  return {
    mode: stored.mode === 'manual' ? 'manual' : 'automatic',
    squareFootage,
    stories:
      storyCountWasEdited && enteredStories != null
        ? resolveStories(enteredStories)
        : stored.stories != null
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
  measurementsInput: ProjectComplexityMeasurementContext & {
    projectComplexity?: ProjectComplexitySettings | null;
  },
  result: ComplexityPricingResult
): ComplexityPricingResult {
  if (!result.fill || result.fill.isComparison) return result;
  if (!isProjectComplexityEligibleItem(itemId, templateKey)) return result;

  const settings = inferProjectComplexitySettings({
    floorAreaSqft: measurementsInput.floorAreaSqft,
    storyCount: measurementsInput.storyCount,
    planFacts: measurementsInput.planFacts,
    projectComplexity: measurementsInput.projectComplexity,
    plumbingComplexityFactors: measurementsInput.plumbingComplexityFactors,
    planImportMode: measurementsInput.planImportMode,
    planImportTradeKey: measurementsInput.planImportTradeKey,
    planImportFingerprint: measurementsInput.planImportFingerprint,
    quickMeasurementSources: measurementsInput.quickMeasurementSources,
    quickMeasurementUserOverrides: measurementsInput.quickMeasurementUserOverrides,
    allowPlanFactsFallback: hasPlanProjectComplexityContext({
      floorAreaSqft: measurementsInput.floorAreaSqft,
      storyCount: measurementsInput.storyCount,
      planFacts: measurementsInput.planFacts,
      planImportMode: measurementsInput.planImportMode,
      planImportTradeKey: measurementsInput.planImportTradeKey,
      planImportFingerprint: measurementsInput.planImportFingerprint,
      quickMeasurementSources: measurementsInput.quickMeasurementSources,
    }),
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
