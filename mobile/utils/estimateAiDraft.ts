import { postAiAssistantJson } from '@/utils/resolveAiBackendUrl';
import {
  clearStalePricingWhenNotesUnpriced,
  parseScopeMeasurementsFromNotes,
} from '@/utils/scopeMeasurementParser';
import { resolveScopePackageBudgetBreakdown } from '@/utils/scopeBudgetBreakdown';
import {
  ruleKeysToTryForPackage,
  lookupRuleKeyForPackage,
  normalizeScopeMeasurements,
  resolveChecklistItemQuantity,
} from '@/utils/scopeItemQuantities';
import { isSoftCostScopePackage } from '@/utils/softCostScope';
import { hasAcceptedScopePricing } from '@/utils/acceptedPricingSummaryUi';
import {
  SCOPE_MATERIAL_PARSED_FROM_NOTES_LABEL,
  SCOPE_LABOR_PARSED_FROM_NOTES_LABEL,
  SCOPE_PARSED_FROM_NOTES_LABEL,
} from '@/constants/scopeNoteSourceLabels';
import {
  NO_LIVING_SF_PRIMARY_SEED_KEYS,
  buildAreaReconciliation,
  buildSemanticsStateForScope,
  measurementSemanticsV1Enabled,
  preferredPrimaryUnit,
  type MeasurementUnit,
} from '@/utils/measurementSemantics';
import { tagPlanDetectedQuickMeasurementKeys } from '@/utils/quickMeasurementProvenance';
import { syncMeasurementsWithSouthernUtahPlanFacts } from '@/utils/quickMeasurementEstimates';
import { sumBathFloorSqft } from '@/utils/planBathRooms';
import type {
  MeasurementSuggestion,
  PlanBuildingAreas,
  PlanFacts,
} from '@/utils/planMeasurementFacts';

export type DraftItemStatus =
  | 'confirmed'
  | 'user_provided'
  | 'rough_price'
  | 'partial_pricing'
  | 'calculated'
  | 'ai_suggested'
  | 'needs_review'
  | 'missing_price';

export type EstimateConfidenceLevel = 'high' | 'medium' | 'low';

export type EstimateNoteProfile = {
  primary: 'exact_rate' | 'lump_sum' | 'scope_only' | 'mixed';
  calculatedCount?: number;
  lumpSumCount?: number;
  scopeOnlyCount?: number;
  partialCount?: number;
  roughCount?: number;
};

export type EstimateDraftConfidence = {
  level: EstimateConfidenceLevel;
  label: string;
  summary: string;
  reasons?: string[];
};

export type EstimateRoughEstimateRange = {
  enabled: boolean;
  label: string;
  confidence: EstimateConfidenceLevel;
  low: number;
  mid: number;
  high: number;
  assumptions: string[];
  disclaimer: string;
};

export type EstimateBuilderMode = 'organize_only' | 'organize_calculate' | 'suggest_breakdown';

export type EstimateTier = 'simple_unit' | 'room_remodel' | 'addition' | 'ground_up';

export type ScopeAssumptionState = 'included' | 'excluded' | 'unsure';

/** yes_no = is this work part of the bid? choice = pick a specific answer (e.g. staying vs replacing). */
export type ScopeChecklistInputType = 'yes_no' | 'choice' | 'multi_choice';

export type ScopeChecklistOption = {
  id: string;
  label: string;
};

export type ScopeChecklistItem = {
  id: string;
  label: string;
  helperText?: string;
  category?: string;
  inputType?: ScopeChecklistInputType;
  options?: ScopeChecklistOption[];
  /** yes_no: included = Yes in scope, excluded = No, unsure = Not sure */
  state: ScopeAssumptionState;
  /** choice: selected option id */
  choiceId?: string | null;
  /** multi_choice: selected option ids (e.g. wall remove + add) */
  choiceIds?: string[];
  /** UI-only line injected from wet_area_install picker (not sent to server). */
  derivedFrom?: string;
  /** Server-added custom row created from a priced/mentioned note outside the selected template. */
  noteBacked?: boolean;
};

export type ScopeChecklist = {
  estimateTier: EstimateTier;
  templateKey: string;
  title: string;
  intro: string;
  items: ScopeChecklistItem[];
  legend?: string;
  options?: Array<{ id: string; label: string }>;
  summary?: string;
  requiresConfirmation?: boolean;
  /** Parsed from job notes — used to prefill quick measurements */
  suggestedMeasurements?: ScopeMeasurements | null;
};

/** Area (tile, paint, concrete, framing) and length (baseboard, trim) for scope pricing. */
export type ScopeItemQuantity = {
  quantity: number | null;
  unit: string;
  quantitySource?:
    | 'notes'
    | 'user_entered'
    | 'calculated_confirmed'
    | 'manual_override'
    | 'inferred'
    | 'default_assumption'
    | 'missing'
    | 'not_applicable'
    | 'plan_vision';
  /** Cabinets allowance in notes also covered countertops on the same line. */
  includesCountertops?: boolean;
  /**
   * Optional durable measurement roles (primary / pricing / benchmark).
   * Present only when BUILD_AI_MEASUREMENT_SEMANTICS_V1 is enabled for new writes.
   * Legacy records without this field continue to load unchanged.
   */
  measurementState?: import('@/utils/measurementSemantics').ScopeMeasurementState | null;
};

/** Persisted accepted-pricing metadata for Confirm Scope cards. */
export type ScopePricingAcceptanceMetadata = {
  selectionStatus: 'accepted' | 'user_entered' | 'manual_adjusted';
  pricingSourceLabel: string;
  pricingSourceKind:
    | 'national_average'
    | 'local_benchmark'
    | 'saved_rate'
    | 'parsed_from_notes'
    | 'user_entered'
    | 'allowance'
    | 'unknown';
  pricingTypeLabel: string;
  geographicBasis?: string;
  originalSuggestionLabel?: string;
  originalPricingSourceLabel?: string;
  rateSourceLabel?: string;
  lumpSumOnly?: boolean;
  materialAmount?: number;
  laborAmount?: number;
  allowanceAmount?: number;
  subcontractorAmount?: number;
  totalAmount: number;
  benchmarkProvenance?: import('@/utils/benchmarkEngine').BenchmarkProvenance;
};

export type PlanRoomMeasurement = {
  name: string;
  areaSqft: number | null;
  lengthFt?: number | null;
  widthFt?: number | null;
  sourcePage?: number | null;
  sourceSheet?: string | null;
  sourceLabel?: string | null;
  sourceType?: 'plan_explicit' | 'plan_derived' | 'user_entered' | 'unknown';
  confidence?: number | null;
};

export type ScopeMeasurements = {
  /** Bathroom floor sqft — used for floor tile, demo, etc. */
  bathroomFloorSqft?: number | null;
  kitchenFloorSqft?: number | null;
  /** Flooring / multi-area floor jobs (tile demo, laminate install, etc.) */
  floorAreaSqft?: number | null;
  /** Finished floor install area — separate from building/ADU sqft on addition jobs */
  flooringSqft?: number | null;
  backsplashSqft?: number | null;
  countertopSqft?: number | null;
  cabinetLf?: number | null;
  showerWallTileSqft?: number | null;
  showerFloorTileSqft?: number | null;
  wallPaintSqft?: number | null;
  exteriorPaintSqft?: number | null;
  baseboardLf?: number | null;
  railingLf?: number | null;
  landscapeSqft?: number | null;
  sodSqft?: number | null;
  paverSqft?: number | null;
  rockMulchSqft?: number | null;
  landscapeTons?: number | null;
  roofSquares?: number | null;
  drywallSqft?: number | null;
  concreteSqft?: number | null;
  concreteCy?: number | null;
  excavationCy?: number | null;
  deckSqft?: number | null;
  /** Detached/attached garage area from plan schedule (not living SF). */
  garageSqft?: number | null;
  /** Named rooms read from the plan (for Quick measurements display). */
  planRooms?: PlanRoomMeasurement[];
  /**
   * Wet-area finish for Quick Measurements. Gates shower wall/floor tile fields
   * and optional planning estimates. Independent of checklist choiceId but can sync.
   * Prefer bathCount / prefabBathCount / tubBathCount when mixed finishes are used.
   */
  wetAreaFinish?: import('@/utils/planBathRooms').WetAreaFinishChoice | null;
  /** Tile shower / tiled wet-area bath count (drives shower SF planning). */
  bathCount?: number | null;
  /** Prefab pan baths — does not clear or replace tile shower SF. */
  prefabBathCount?: number | null;
  /** Tub baths — does not clear or replace tile shower SF. */
  tubBathCount?: number | null;
  /** Glass shower door / enclosure count (Wet area finish). */
  showerDoorCount?: number | null;
  /** Garage door schedule by type (Confirm Scope openings). */
  garageDoorSingleCount?: number | null;
  garageDoorDoubleCount?: number | null;
  garageDoorRvCount?: number | null;
  /** Structured, sheet-aware facts retained after plan review for planning formulas. */
  planFacts?: PlanFacts;
  /** Original metadata for accepted planning suggestions, retained after edits. */
  quickMeasurementSuggestionMetadata?: Partial<Record<string, MeasurementSuggestion>>;
  /** Per-field numeric confidence from the original takeoff. */
  quickMeasurementFieldConfidence?: Record<string, number>;
  /** Declared vs detected living/garage reconciliation (measurement-semantics). */
  areaReconciliation?: import('@/utils/measurementSemantics').AreaReconciliation | null;
  /**
   * Per-Quick-Measurement-field provenance: which fields were populated
   * directly from plan takeoff vs accepted from a planning estimate.
   * Absent/undefined for a key means "typed/legacy" — rendered as a plain
   * confirmed value, matching pre-provenance behavior.
   */
  quickMeasurementSources?: import('@/utils/quickMeasurementProvenance').QuickMeasurementSourceMap;
  /**
   * Quick Measurement keys the contractor has explicitly edited or accepted
   * a suggestion for. Original detected/estimated provenance in
   * quickMeasurementSources is preserved even after an override.
   */
  quickMeasurementUserOverrides?: import('@/utils/quickMeasurementProvenance').QuickMeasurementOverrideMap;
  /** Per-checklist-item overrides keyed by checklist id */
  itemQuantities?: Record<string, ScopeItemQuantity>;
  /** Accepted pricing metadata keyed by checklist item id */
  pricingAcceptance?: Record<string, ScopePricingAcceptanceMetadata>;
  /** Item-specific scope gap resolutions keyed by `${scopeItemId}::${componentKey}` */
  scopeGapResolutions?: Record<string, import('@/utils/scopeReviewUi').ScopeGapResolutionRecord>;
  /** Explicit pricing override confirmations (measurement-semantics). */
  pricingOverrideLog?: import('@/utils/measurementSemantics').PricingOverrideLog[];
  /** @deprecated use bathroomFloorSqft */
  sqft?: number | null;
  /** @deprecated use baseboardLf */
  lf?: number | null;
};

export type EstimateDraftRoom = {
  name: string;
  scope: string;
  scopeQuantities?: Array<{ label: string; quantity: number; unit: string }>;
  price: number | null;
  laborPrice: number | null;
  materialPrice: number | null;
  priceIncludesLaborAndMaterials: boolean;
  splitIsSuggested?: boolean;
  splitApprovedByUser?: boolean;
  priceProvidedByUser: boolean;
  pricedFromSqftAllowances?: boolean;
  partialPricing?: boolean;
  knownSubtotal?: number | null;
  packageStatus?: DraftItemStatus;
  applyEligible?: boolean;
  roughPricePendingApproval?: boolean;
  pricingItems?: EstimateDraftPricingItem[];
  missingPriceItems?: string[];
};

export type EstimateDraftPricingItem = {
  name: string;
  description?: string;
  quantity?: number | null;
  unit?: string | null;
  unitRate?: number | null;
  amount?: number | null;
  pricingType?: string;
  priceSource?: string;
  status?: DraftItemStatus;
  formula?: string | null;
  includedInSubtotal?: boolean;
  approvedByUser?: boolean;
  needsReview?: boolean;
};

export type EstimateDraftScopePackage = {
  name: string;
  category?: string;
  trade?: string | null;
  /** Checklist / Confirm Scope item id (excavation, roofing, drywall, …). */
  checklistItemId?: string | null;
  /** Stable cost-code alias for Projects (defaults to checklistItemId). */
  costCode?: string | null;
  scope: string;
  price: number | null;
  laborPrice: number | null;
  materialPrice: number | null;
  pricingType: string;
  includesLabor: boolean | null;
  includesMaterials: boolean | null;
  priceSource: string;
  status: DraftItemStatus;
  knownSubtotal?: number | null;
  calculatedSubtotal?: number | null;
  aiSuggestedSubtotal?: number | null;
  finalApprovedTotal?: number | null;
  formula: string | null;
  pricingItems?: EstimateDraftPricingItem[];
  scopeQuantities?: Array<{ label: string; quantity: number; unit: string }>;
  budgetSplitBasis?: { quantity: number; unit: string } | null;
  missingPriceItems?: string[];
  missingInfo: string[];
  warnings?: string[];
  priceIncludesLaborAndMaterials: boolean;
  splitIsSuggested: boolean;
  priceProvidedByUser: boolean;
  applyEligible?: boolean;
  roughPricePendingApproval?: boolean;
};

export type EstimateDraftAllowance = {
  name: string;
  amount: number | null;
  unit: string | null;
  description: string;
  rate?: number | null;
  quantity?: number | null;
  calculatedAmount?: number | null;
  appliesTo?: string | null;
  kind?: string;
  status?: DraftItemStatus;
  missingInfo?: string[];
};

export type EstimateDraftSuggestedSplit = {
  parentItemName: string;
  total: number;
  suggestedLabor: number;
  suggestedMaterials: number;
  confidence: 'low' | 'medium' | 'high';
  approvedByUser: boolean;
  status?: string;
  previewOnly?: boolean;
};

export type EstimateDraftPayment = {
  label: string;
  amount: number | null;
  percentage: number | null;
  dueTiming: string;
};

export type EstimateAiDraft = {
  originalNotes?: string | null;
  builderMode?: EstimateBuilderMode;
  customerName: string | null;
  projectTitle: string | null;
  projectType: string;
  projectDescription: string | null;
  rooms: EstimateDraftRoom[];
  scopePackages?: EstimateDraftScopePackage[];
  allowances: EstimateDraftAllowance[];
  suggestedSplits?: EstimateDraftSuggestedSplit[];
  inclusions: string[];
  exclusions: string[];
  statedTotal: number | null;
  calculatedLineItemTotal: number | null;
  calculatedLaborTotal: number | null;
  calculatedMaterialTotal: number | null;
  calculatedTotal?: number | null;
  totalMatches?: boolean | null;
  combinedPriceRoomCount?: number;
  suggestedSplitRoomCount?: number;
  pricingWarnings: string[];
  warnings?: string[];
  missingInfo: string[];
  needsReviewItems?: string[];
  contractScope: string | null;
  suggestedPaymentSchedule: EstimateDraftPayment[] | null;
  applySuggestedSplits?: boolean;
  detectedTrades?: string[];
  knownSubtotal?: number | null;
  partialPricingCount?: number;
  bidCompletenessScore?: number | null;
  bidCompletenessGood?: string[];
  bidCompletenessNeedsReview?: string[];
  estimateConfidence?: EstimateDraftConfidence | null;
  whatAiDid?: string[];
  noteProfile?: EstimateNoteProfile | null;
  noPricingDetected?: boolean;
  stillNeededReview?: string[];
  pendingPricingProposal?: {
    empty: boolean;
    source: string;
    sourceLabel: string;
    lines: Array<{ packageName: string; formula: string; total: number; sourceLabel: string }>;
    totalSuggested: number;
  } | null;
  pricingProposalApproved?: boolean;
  roughEstimate?: EstimateRoughEstimateRange | null;
  roughEstimateRequested?: boolean;
  pricingMemoryEnabled?: boolean;
  pricingMemoryNote?: string | null;
  pricingMemorySettings?: Record<string, unknown> | null;
  pricingMemorySuggestions?: PricingMemorySuggestion[];
  pricingMemorySummary?: {
    label: string;
    lines: string[];
  } | null;
  pricingMemoryMessage?: string | null;
  pricingMemoryActualInsights?: Array<{
    scopeItemName: string;
    message: string;
    historicalBidRate?: number;
    actualAverageRate?: number;
  }>;
  pricingMemoryMissingSuggestions?: Array<{
    missingItem: string;
    scopeItemName: string;
    suggestedUnitRate?: number;
    estimatedTotal?: number | null;
    unitType?: string;
    sourceLabel: string;
    label: string;
    confidence: string;
    requiresApproval: boolean;
  }>;
  pricingMemoryMissingMessage?: string | null;
  /** Shown on review after applying saved pricing from the modal. */
  savedPricingApplySummary?: {
    appliedCount: number;
    stillNeedCount: number;
  } | null;
  /** simple_unit skips scope checklist; complex tiers require confirmation before pricing. */
  estimateTier?: EstimateTier;
  scopeChecklist?: ScopeChecklist | null;
  scopeAssumptionsConfirmed?: boolean;
  requiresScopeConfirmation?: boolean;
  confirmedAssumptions?: ScopeChecklistItem[];
  scopeMeasurements?: ScopeMeasurements | null;
  projectAddress?: string | null;
  addressMissing?: boolean;
  laborTradeItems?: Array<{
    packageName?: string;
    name: string;
    amount: number | null;
    status?: string;
    missing?: boolean;
    missingItems?: string[];
  }>;
  totalValidation?: {
    materialsTotal: number | null;
    laborTotal: number | null;
    calculatedLineItemsTotal: number | null;
    knownSubtotal: number | null;
    aiSuggestedSubtotal: number | null;
    statedTotal: number | null;
    totalMatches?: boolean | null;
    warnings?: string[];
  };
};

export type PricingMemorySuggestion = {
  scopeItemName: string;
  category: string;
  unitType: string;
  suggestedUnitRate: number;
  quantity?: number | null;
  estimatedTotal?: number | null;
  source: string;
  sourceLabel: string;
  sourcePriority: number;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  sampleCount: number;
  requiresApproval: boolean;
  status: string;
};

export type ApplyDraftOptions = {
  applySuggestedSplits?: boolean;
  /** When true, skip AI-suggested splits and packages with no applyable pricing. */
  applyConfirmedOnly?: boolean;
  /** Scope, inclusions, exclusions, and notes only — no labor/material line items. */
  scopeOnly?: boolean;
};

export type ApplyDraftResult = {
  bid: Record<string, unknown>;
  materialsCart: Record<string, unknown>[];
};

export type ClarifyQuestionItem = {
  id: string;
  question: string;
  why?: string | null;
  kind: 'measurement' | 'pricing' | 'scope' | 'project_info';
  targetKey?: string | null;
  targetPackage?: string | null;
};

export type ClarifyDraftResult = {
  questions: string[];
  questionItems?: ClarifyQuestionItem[];
  needsReviewCount: number;
  missingInfoCount: number;
  source?: 'ai' | 'rules';
};

export type ClarifyAnswer = {
  question: string;
  answer: string;
  targetKey?: string | null;
  targetPackage?: string | null;
};

export type ClarifyApplyResult = {
  draft: EstimateAiDraft;
  appliedSummary: string[];
  source: 'ai' | 'rules';
};

export type RefineDraftResult = {
  draft: EstimateAiDraft;
  appliedSummary: string[];
  source: 'ai' | 'rules';
  command?: string;
};

const PROJECT_CATEGORY_SLUGS: Record<string, string> = {
  kitchen: 'kitchen-remodel',
  bathroom: 'bathroom-remodel',
  room_addition: 'addition',
  home_addition: 'home-renovation',
  adu: 'adu',
  garage_conversion: 'garage-conversion',
  new_build: 'new-build',
  roofing: 'roofing',
  deck_patio: 'deck-patio',
  plumbing_service: 'plumbing-service',
  landscaping: 'landscaping',
  other: 'other',
};

function newLineItemId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatDraftMoney(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const value = Math.round(Number(amount) * 100) / 100;
  const hasCents = Math.abs(value % 1) > 0.0001;
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

export const BUILDER_MODE_LABELS: Record<EstimateBuilderMode, { title: string; subtitle: string }> = {
  organize_only: {
    title: 'Organize Only',
    subtitle: 'Keep your numbers; sort scope only',
  },
  organize_calculate: {
    title: 'Organize + Calculate',
    subtitle: 'Calculate sqft × rate when clear',
  },
  suggest_breakdown: {
    title: 'Suggest Breakdown',
    subtitle: 'Lump sums + optional L/M splits',
  },
};

function stripRatePricingSubkeys(
  itemQuantities?: ScopeMeasurements['itemQuantities']
): ScopeMeasurements['itemQuantities'] {
  const out: NonNullable<ScopeMeasurements['itemQuantities']> = {};
  for (const [id, val] of Object.entries(itemQuantities || {})) {
    if (/__(?:material|labor|allowance)$/.test(id)) continue;
    out[id] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

export function repairDraftRatePricingFromNotes(draft: EstimateAiDraft, notes: string): EstimateAiDraft {
  const text = String(notes || draft.originalNotes || '').trim();
  if (!text) return draft;

  const parsed = parseScopeMeasurementsFromNotes(text, {
    templateKey: draft.scopeChecklist?.templateKey,
    projectType: draft.projectType,
  });
  if (!Object.keys(parsed).length) {
    return { ...draft, originalNotes: draft.originalNotes || text };
  }

  const mergedItemQuantities = {
    ...stripRatePricingSubkeys(draft.scopeMeasurements?.itemQuantities),
    ...stripRatePricingSubkeys(draft.scopeChecklist?.suggestedMeasurements?.itemQuantities),
    ...(parsed.itemQuantities || {}),
  };
  if (parsed.itemQuantities?.floor_demo && !parsed.itemQuantities?.demo) {
    delete mergedItemQuantities.demo;
  }
  clearStalePricingWhenNotesUnpriced(mergedItemQuantities, text, parsed.itemQuantities);

  const mergedScopeMeasurements: ScopeMeasurements = {
    ...(draft.scopeMeasurements || {}),
    ...parsed,
    itemQuantities: mergedItemQuantities,
  };

  if (__DEV__) {
    const serverIq = draft.scopeChecklist?.suggestedMeasurements?.itemQuantities || {};
    console.log('🧮 AI draft backsplash repair', {
      server: {
        material: serverIq.backsplash__material?.quantity,
        labor: serverIq.backsplash__labor?.quantity,
        total: serverIq.backsplash__allowance?.quantity,
      },
      parsed: {
        material: parsed.itemQuantities?.backsplash__material?.quantity,
        labor: parsed.itemQuantities?.backsplash__labor?.quantity,
        total: parsed.itemQuantities?.backsplash__allowance?.quantity,
      },
      merged: {
        material: mergedItemQuantities.backsplash__material?.quantity,
        labor: mergedItemQuantities.backsplash__labor?.quantity,
        total: mergedItemQuantities.backsplash__allowance?.quantity,
      },
    });
  }

  return {
    ...draft,
    originalNotes: draft.originalNotes || text,
    scopeMeasurements: mergedScopeMeasurements,
    scopeChecklist: draft.scopeChecklist
      ? {
          ...draft.scopeChecklist,
          suggestedMeasurements: {
            ...(draft.scopeChecklist.suggestedMeasurements || {}),
            ...parsed,
            itemQuantities: mergedItemQuantities,
          },
        }
      : draft.scopeChecklist,
  };
}

export async function fetchEstimateDraftFromNotes(
  notes: string,
  savedTemplates: unknown[] = []
): Promise<EstimateAiDraft> {
  const payload = await postAiAssistantJson<{ draft?: EstimateAiDraft; error?: string; message?: string }>(
    '/estimate-draft-from-notes',
    { notes, savedTemplates }
  );

  if (!payload?.draft) {
    throw new Error(payload?.message || payload?.error || 'Failed to generate estimate draft');
  }

  return repairDraftRatePricingFromNotes(payload.draft, notes);
}

export async function fetchSuggestedDraftSplits(
  draft: EstimateAiDraft,
  applySuggestedSplits = false
): Promise<EstimateAiDraft> {
  const payload = await postAiAssistantJson<{ draft?: EstimateAiDraft; error?: string; message?: string }>(
    '/estimate-draft-suggest-splits',
    { draft, applySuggestedSplits },
    90000
  );

  if (!payload?.draft) {
    throw new Error(payload?.message || payload?.error || 'Failed to suggest splits');
  }

  return syncSelectedScopePricing(payload.draft);
}

export async function fetchRoughEstimateRange(
  draft: EstimateAiDraft
): Promise<{ draft: EstimateAiDraft; roughEstimate: EstimateRoughEstimateRange }> {
  const payload = await postAiAssistantJson<{
    draft?: EstimateAiDraft;
    roughEstimate?: EstimateRoughEstimateRange;
    error?: string;
    message?: string;
  }>('/estimate-draft-rough-range', { draft }, 60000);

  if (!payload?.roughEstimate) {
    throw new Error(payload?.message || payload?.error || 'Failed to generate rough budget range');
  }

  return {
    draft: payload.draft || { ...draft, roughEstimate: payload.roughEstimate },
    roughEstimate: payload.roughEstimate,
  };
}

export async function fetchClarifyDraftQuestions(draft: EstimateAiDraft): Promise<ClarifyDraftResult> {
  const payload = await postAiAssistantJson<ClarifyDraftResult & { error?: string; message?: string }>(
    '/estimate-draft-clarify',
    { draft },
    60000
  );

  if (!payload?.questions) {
    throw new Error(payload?.message || payload?.error || 'Failed to load clarification questions');
  }

  return payload;
}

export async function applyClarifyAnswersToDraft(
  draft: EstimateAiDraft,
  answers: ClarifyAnswer[]
): Promise<ClarifyApplyResult> {
  const payload = await postAiAssistantJson<
    Partial<ClarifyApplyResult> & { error?: string; message?: string }
  >('/estimate-draft-clarify-apply', { draft, answers }, 90000);

  if (!payload?.draft) {
    throw new Error(payload?.message || payload?.error || 'Failed to apply answers');
  }

  return {
    draft: syncSelectedScopePricing(payload.draft),
    appliedSummary: payload.appliedSummary || [],
    source: payload.source === 'ai' ? 'ai' : 'rules',
  };
}

export async function refineDraftWithCommand(
  draft: EstimateAiDraft,
  command: string
): Promise<RefineDraftResult> {
  const payload = await postAiAssistantJson<
    Partial<RefineDraftResult> & { error?: string; message?: string }
  >('/estimate-draft-refine', { draft, command }, 90000);

  if (!payload?.draft) {
    throw new Error(payload?.message || payload?.error || 'Failed to apply revision');
  }

  return {
    draft: syncSelectedScopePricing(payload.draft),
    appliedSummary: payload.appliedSummary || [],
    source: payload.source === 'ai' ? 'ai' : 'rules',
    command: payload.command,
  };
}

export type PhotoScopeImage = {
  base64: string;
  mimeType?: string;
  /** Filename hint — used for PDF plan uploads. */
  name?: string;
};

export type PhotoScopeDetection = {
  itemId: string;
  label?: string;
  state: 'included' | 'excluded' | 'unsure';
  choiceId?: string | null;
  confidence: number;
  evidence?: string | null;
};

export type PhotoToScopeResult = {
  success: boolean;
  reason?: string | null;
  scopeText: string;
  notesBlock: string;
  mergedNotes: string;
  detections: PhotoScopeDetection[];
  templateKey?: string | null;
  projectTypeHint?: string | null;
};

/** Analyze site photos → scope notes block (client merges into Job notes before Generate). */
export async function fetchPhotoToScope(params: {
  images: PhotoScopeImage[];
  existingNotes?: string;
  projectTypeHint?: string | null;
  templateKeyHint?: string | null;
}): Promise<PhotoToScopeResult> {
  const payload = await postAiAssistantJson<
    Partial<PhotoToScopeResult> & { error?: string; message?: string }
  >(
    '/photo-to-scope',
    {
      images: params.images,
      existingNotes: params.existingNotes || '',
      projectTypeHint: params.projectTypeHint || null,
      templateKeyHint: params.templateKeyHint || null,
      mergeIntoNotes: true,
    },
    120000
  );

  if (payload?.error && payload.success !== true && payload.success !== false) {
    throw new Error(payload.message || payload.error || 'Photo analysis failed');
  }

  return {
    success: payload.success !== false,
    reason: payload.reason ?? null,
    scopeText: payload.scopeText || '',
    notesBlock: payload.notesBlock || '',
    mergedNotes: payload.mergedNotes || params.existingNotes || '',
    detections: Array.isArray(payload.detections) ? (payload.detections as PhotoScopeDetection[]) : [],
    templateKey: payload.templateKey ?? null,
    projectTypeHint: payload.projectTypeHint ?? null,
  };
}

export type PlanLowConfidenceField = {
  field: string;
  value: number;
  confidence: number;
};

export type PlanUnreadableField = {
  field: string;
  reason: string;
};

export type PlanScopeResult = {
  scopeText: string;
  detections: PhotoScopeDetection[];
};

export type PlanToMeasurementsResult = {
  success: boolean;
  reason?: string | null;
  /** Vision's own read of the pages: good | partial | unreadable. */
  imageQuality?: string | null;
  rooms: Array<{
    name: string;
    lengthFt?: number | null;
    widthFt?: number | null;
    areaSqft?: number | null;
    measurementKey?: string | null;
    confidence: number;
  }>;
  measurements: Record<string, number>;
  buildingAreas?: PlanBuildingAreas;
  planFacts?: PlanFacts;
  /** Per-field 0-1 confidence that the value was read (not guessed). */
  fieldConfidence: Record<string, number>;
  /** Fields the AI read but withheld because confidence was too low. */
  lowConfidence: PlanLowConfidenceField[];
  /** Fields the AI saw on the plan but could not read (blurry/cut off). */
  unreadableFields: PlanUnreadableField[];
  itemQuantities: Record<string, { quantity: number; unit: string; quantitySource?: string }>;
  assumptions: string[];
  notesBlock: string;
  mergedNotes: string;
  /** Draft scope detections read from the plan sheets (confirm before applying). */
  scope: PlanScopeResult | null;
  /** Declared vs detected living/garage reconciliation (measurement-semantics). */
  areaReconciliation?: import('@/utils/measurementSemantics').AreaReconciliation | null;
};

/** Analyze floor plan / blueprint pages (images or PDF) → Quick Measurement fields + draft scope. */
export async function fetchPlanToMeasurements(params: {
  images: PhotoScopeImage[];
  existingNotes?: string;
  projectTypeHint?: string | null;
  templateKeyHint?: string | null;
  includeScope?: boolean;
}): Promise<PlanToMeasurementsResult> {
  const payload = await postAiAssistantJson<
    Partial<PlanToMeasurementsResult> & { error?: string; message?: string }
  >(
    '/plan-to-measurements',
    {
      images: params.images,
      existingNotes: params.existingNotes || '',
      projectTypeHint: params.projectTypeHint || null,
      templateKeyHint: params.templateKeyHint || null,
      mergeIntoNotes: true,
      includeScope: params.includeScope !== false,
    },
    180000
  );

  if (payload?.error && payload.success !== true && payload.success !== false) {
    throw new Error(payload.message || payload.error || 'Plan takeoff failed');
  }

  return {
    success: payload.success !== false,
    reason: payload.reason ?? null,
    imageQuality: payload.imageQuality ?? null,
    rooms: Array.isArray(payload.rooms) ? payload.rooms : [],
    measurements:
      payload.measurements && typeof payload.measurements === 'object'
        ? (payload.measurements as Record<string, number>)
        : {},
    buildingAreas:
      payload.buildingAreas && typeof payload.buildingAreas === 'object'
        ? (payload.buildingAreas as PlanBuildingAreas)
        : undefined,
    planFacts:
      payload.planFacts && typeof payload.planFacts === 'object'
        ? (payload.planFacts as PlanFacts)
        : undefined,
    fieldConfidence:
      payload.fieldConfidence && typeof payload.fieldConfidence === 'object'
        ? (payload.fieldConfidence as Record<string, number>)
        : {},
    lowConfidence: Array.isArray(payload.lowConfidence)
      ? (payload.lowConfidence as PlanLowConfidenceField[])
      : [],
    unreadableFields: Array.isArray(payload.unreadableFields)
      ? (payload.unreadableFields as PlanUnreadableField[])
      : [],
    itemQuantities:
      payload.itemQuantities && typeof payload.itemQuantities === 'object'
        ? (payload.itemQuantities as PlanToMeasurementsResult['itemQuantities'])
        : {},
    assumptions: Array.isArray(payload.assumptions) ? payload.assumptions.map(String) : [],
    notesBlock: payload.notesBlock || '',
    mergedNotes: payload.mergedNotes || params.existingNotes || '',
    scope:
      payload.scope && typeof payload.scope === 'object' && Array.isArray((payload.scope as PlanScopeResult).detections)
        ? (payload.scope as PlanScopeResult)
        : null,
    areaReconciliation:
      payload.areaReconciliation && typeof payload.areaReconciliation === 'object'
        ? (payload.areaReconciliation as PlanToMeasurementsResult['areaReconciliation'])
        : null,
  };
}

const PHOTO_DETECTION_MIN_CONFIDENCE = 0.45;

/**
 * Plan/photo detections sometimes use sibling ids from another checklist
 * template (e.g. exterior_finishes vs exterior). Remap onto ids that exist
 * in the current Confirm Scope checklist before applying.
 */
const PLAN_SCOPE_ID_ALIASES: Record<string, string[]> = {
  exterior_finishes: ['exterior', 'exterior_finishes'],
  exterior: ['exterior', 'exterior_finishes'],
  roof_tie_in: ['roofing', 'roof_tie_in', 'shingles_roofing'],
  roofing: ['roofing', 'roof_tie_in', 'shingles_roofing'],
  framing_structure: ['framing', 'framing_structure', 'wall_framing'],
  framing: ['framing', 'framing_structure'],
  electrical_rough: ['mep_rough', 'electrical_rough', 'electrical'],
  plumbing_rough: ['mep_rough', 'plumbing_rough', 'plumbing'],
  hvac: ['mep_rough', 'hvac'],
  mep_rough: ['mep_rough', 'electrical_rough', 'plumbing_rough', 'hvac'],
  paint: ['paint_trim', 'paint', 'exterior_paint'],
  paint_trim: ['paint_trim', 'paint', 'interior_trim'],
  interior_trim: ['paint_trim', 'interior_trim'],
  flooring: ['tile_flooring', 'flooring'],
  tile: ['tile_flooring', 'tile', 'flooring'],
  tile_flooring: ['tile_flooring', 'flooring', 'tile'],
  site_prep: ['sitework', 'site_prep', 'excavation'],
  sitework: ['sitework', 'site_prep', 'excavation'],
  excavation: ['sitework', 'excavation'],
  grading: ['sitework', 'grading'],
  cabinets: ['cabinets_counters', 'cabinets'],
  countertops: ['cabinets_counters', 'countertops'],
  cabinets_counters: ['cabinets_counters', 'cabinets', 'countertops'],
  windows_doors: ['windows', 'exterior_doors', 'sliding_doors', 'garage_doors', 'exterior'],
  windows: ['windows', 'exterior'],
  exterior_doors: ['exterior_doors', 'exterior'],
  sliding_doors: ['sliding_doors', 'exterior'],
  garage_doors: ['garage_doors', 'exterior'],
  concrete: ['foundation', 'concrete'],
  pour_foundation: ['foundation', 'pour_foundation'],
  pour_flatwork: ['pour_flatwork'],
  flatwork: ['pour_flatwork'],
  landscaping: ['landscaping'],
  landscape: ['landscaping'],
  plumbing_trim: ['plumbing_trim'],
  electrical_trim: ['electrical_trim'],
};

function remapDetectionItemId(itemId: string, allowedIds: Set<string>): string | null {
  if (allowedIds.has(itemId)) return itemId;
  for (const alt of PLAN_SCOPE_ID_ALIASES[itemId] || []) {
    if (allowedIds.has(alt)) return alt;
  }
  return null;
}

/**
 * Apply structured vision detections directly onto the draft's Step 2 checklist,
 * so photo scope doesn't depend on notes-text regex re-parsing. Only fills items
 * the notes/AI left "unsure" — never overrides explicit states.
 */
export function applyPhotoDetectionsToDraft(
  draft: EstimateAiDraft,
  detections: PhotoScopeDetection[] | null | undefined
): EstimateAiDraft {
  const items = draft?.scopeChecklist?.items;
  if (!items?.length || !detections?.length) return draft;

  const byId = new Map<string, PhotoScopeDetection>();
  for (const d of detections) {
    if (!d?.itemId || (d.confidence ?? 0) < PHOTO_DETECTION_MIN_CONFIDENCE) continue;
    if (d.state !== 'included' && d.state !== 'excluded') continue;
    if (!byId.has(d.itemId)) byId.set(d.itemId, d);
  }
  if (!byId.size) return draft;

  let changed = false;
  const nextItems = items.map((item) => {
    const detection = byId.get(item.id);
    if (!detection) return item;

    if (item.inputType === 'choice') {
      if (item.choiceId && item.choiceId !== 'unsure') return item;
      const validChoice =
        detection.choiceId && (item.options || []).some((o) => o.id === detection.choiceId)
          ? detection.choiceId
          : null;
      if (!validChoice) return item;
      changed = true;
      return { ...item, choiceId: validChoice, state: 'included' as const, noteBacked: true };
    }

    if (item.inputType === 'multi_choice') return item;

    if (item.state !== 'unsure') return item;
    changed = true;
    return { ...item, state: detection.state, noteBacked: true };
  });

  if (!changed) return draft;
  return {
    ...draft,
    scopeChecklist: { ...draft.scopeChecklist!, items: nextItems },
  };
}

/**
 * Apply plan/photo scope detections to a local checklist items array (Confirm
 * Scope modal state). Same rules as applyPhotoDetectionsToDraft: only fills
 * "unsure" items, never overrides explicit states. Remaps cross-template ids
 * so ground_up jobs receive exterior / mep_rough / paint_trim / etc.
 */
export function applyScopeDetectionsToChecklistItems(
  items: ScopeChecklistItem[],
  detections: PhotoScopeDetection[] | null | undefined
): { items: ScopeChecklistItem[]; appliedCount: number; appliedLabels: string[] } {
  if (!items?.length || !detections?.length) {
    return { items, appliedCount: 0, appliedLabels: [] };
  }

  const allowedIds = new Set(items.map((i) => i.id));
  const byId = new Map<string, PhotoScopeDetection>();
  for (const d of detections) {
    if (!d?.itemId || (d.confidence ?? 0) < PHOTO_DETECTION_MIN_CONFIDENCE) continue;
    if (d.state !== 'included' && d.state !== 'excluded') continue;
    const mappedId = remapDetectionItemId(d.itemId, allowedIds);
    if (!mappedId || byId.has(mappedId)) continue;
    byId.set(mappedId, { ...d, itemId: mappedId });
  }
  if (!byId.size) return { items, appliedCount: 0, appliedLabels: [] };

  const appliedLabels: string[] = [];
  const nextItems = items.map((item) => {
    const detection = byId.get(item.id);
    if (!detection) return item;

    if (item.inputType === 'choice') {
      if (item.choiceId && item.choiceId !== 'unsure') return item;
      const validChoice =
        detection.choiceId && (item.options || []).some((o) => o.id === detection.choiceId)
          ? detection.choiceId
          : null;
      if (!validChoice) return item;
      appliedLabels.push(item.label);
      return { ...item, choiceId: validChoice, state: 'included' as const, noteBacked: true };
    }

    if (item.inputType === 'multi_choice') return item;

    if (item.state !== 'unsure') return item;
    appliedLabels.push(item.label);
    return { ...item, state: detection.state, noteBacked: true };
  });

  return { items: nextItems, appliedCount: appliedLabels.length, appliedLabels };
}

export type PlanImportPayload = {
  measurements?: Record<string, number | string>;
  scopeDetections?: PhotoScopeDetection[];
  rooms?: PlanRoomMeasurement[];
  /** Read-only plan takeoff summary text (kept separate from editable Job notes). */
  notesBlock?: string | null;
  areaReconciliation?: import('@/utils/measurementSemantics').AreaReconciliation | null;
  buildingAreas?: PlanBuildingAreas;
  planFacts?: PlanFacts;
  fieldConfidence?: Record<string, number>;
};

/** Normalize vision room list for Quick measurements + field mapping. */
export function normalizePlanRooms(
  rooms: Array<{
    name?: string;
    areaSqft?: number | null;
    lengthFt?: number | null;
    widthFt?: number | null;
    sourcePage?: number | null;
    sourceSheet?: string | null;
    sourceLabel?: string | null;
    sourceType?: PlanRoomMeasurement['sourceType'];
    confidence?: number | null;
  }> | null | undefined
): PlanRoomMeasurement[] {
  const out: PlanRoomMeasurement[] = [];
  for (const room of rooms || []) {
    const name = String(room?.name || '').trim();
    if (!name) continue;
    let areaSqft =
      room?.areaSqft != null && Number.isFinite(Number(room.areaSqft)) && Number(room.areaSqft) > 0
        ? Math.round(Number(room.areaSqft) * 10) / 10
        : null;
    const lengthFt =
      room?.lengthFt != null && Number.isFinite(Number(room.lengthFt)) && Number(room.lengthFt) > 0
        ? Number(room.lengthFt)
        : null;
    const widthFt =
      room?.widthFt != null && Number.isFinite(Number(room.widthFt)) && Number(room.widthFt) > 0
        ? Number(room.widthFt)
        : null;
    if (areaSqft == null && lengthFt != null && widthFt != null) {
      areaSqft = Math.round(lengthFt * widthFt * 10) / 10;
    }
    out.push({
      name,
      areaSqft,
      lengthFt,
      widthFt,
      sourcePage: room.sourcePage ?? null,
      sourceSheet: room.sourceSheet ?? null,
      sourceLabel: room.sourceLabel ?? null,
      sourceType: room.sourceType || 'plan_explicit',
      confidence:
        room.confidence != null && Number.isFinite(Number(room.confidence))
          ? Math.max(0, Math.min(1, Number(room.confidence)))
          : null,
    });
  }
  return out.slice(0, 48);
}

/** Fold named plan rooms into kitchen/bath/garage/deck quick fields when empty. */
export function applyPlanRoomsToScopeMeasurements(
  scopeMeasurements: ScopeMeasurements,
  rooms: PlanRoomMeasurement[]
): ScopeMeasurements {
  if (!rooms.length) return scopeMeasurements;
  const next: ScopeMeasurements = {
    ...scopeMeasurements,
    planRooms: rooms,
  };
  const detectedKeys: string[] = [];
  const sumMatching = (test: RegExp) => {
    let sum = 0;
    let hits = 0;
    for (const room of rooms) {
      if (!test.test(room.name) || !(Number(room.areaSqft) > 0)) continue;
      sum += Number(room.areaSqft);
      hits += 1;
    }
    return hits ? Math.round(sum * 10) / 10 : null;
  };

  if (!(Number(next.kitchenFloorSqft) > 0)) {
    const kitchen = sumMatching(/\bkitchen\b/i);
    if (kitchen) {
      next.kitchenFloorSqft = kitchen;
      detectedKeys.push('kitchenFloorSqft');
    }
  }
  if (!(Number(next.bathroomFloorSqft) > 0)) {
    const baths = sumBathFloorSqft(rooms);
    if (baths) {
      next.bathroomFloorSqft = baths;
      detectedKeys.push('bathroomFloorSqft');
    }
  }
  // Do not auto-fill bathCount from labeled rooms — tile/prefab/tub counts are
  // contractor choices and must not invent tile showers for every bath label.
  if (!(Number(next.garageSqft) > 0)) {
    const garage = sumMatching(/\bgarage\b/i);
    if (garage) {
      next.garageSqft = garage;
      detectedKeys.push('garageSqft');
    }
  }
  if (!(Number(next.deckSqft) > 0)) {
    const deck = sumMatching(/\b(deck|patio|porch)\b/i);
    if (deck) {
      next.deckSqft = deck;
      detectedKeys.push('deckSqft');
    }
  }
  if (detectedKeys.length) {
    next.quickMeasurementSources = tagPlanDetectedQuickMeasurementKeys(
      scopeMeasurements.quickMeasurementSources,
      detectedKeys
    );
  }
  return next;
}

/** Convert plan review string/number map into ScopeMeasurements numbers. */
export function planMeasurementsToScopeMeasurements(
  measurements: Record<string, number | string> | null | undefined
): ScopeMeasurements {
  const out: ScopeMeasurements = {};
  if (!measurements) return out;
  const detectedKeys: string[] = [];
  for (const [key, value] of Object.entries(measurements)) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) continue;
    (out as Record<string, number>)[key] = n;
    detectedKeys.push(key);
  }
  // Living SF from plans also drives flooring when the takeoff didn't send a separate field.
  const living = Number(out.floorAreaSqft);
  if (Number.isFinite(living) && living > 0) {
    if (!(Number(out.flooringSqft) > 0)) {
      out.flooringSqft = living;
      detectedKeys.push('flooringSqft');
    }
  }
  if (detectedKeys.length) {
    out.quickMeasurementSources = tagPlanDetectedQuickMeasurementKeys(undefined, detectedKeys);
  }
  return out;
}

/**
 * When plan takeoff has living SF, seed itemQuantities for included ground-up
 * (or addition) checklist items so Confirm Scope no longer shows "Needs sqft".
 *
 * When measurement-semantics is enabled, living SF is NOT copied into primary
 * takeoff for physical trades — it is stored as benchmark (+ optional pricing)
 * roles and physical quantities only when truly available.
 */
export function seedPlanFloorAreaItemQuantities(
  draft: EstimateAiDraft,
  scopeMeasurements: ScopeMeasurements
): ScopeMeasurements {
  const living = Number(scopeMeasurements.floorAreaSqft);
  if (!Number.isFinite(living) || living <= 0) return scopeMeasurements;

  const includedIds = new Set(
    (draft.scopeChecklist?.items || [])
      .filter((i) => i.state === 'included')
      .map((i) => i.id)
  );
  if (!includedIds.size) return scopeMeasurements;

  const FLOOR_AREA_ITEMS = [
    'sitework',
    'excavation',
    'foundation',
    'framing',
    'roofing',
    'exterior',
    'exterior_finishes',
    'stucco',
    'mep_rough',
    'insulation',
    'drywall',
    'cabinets',
    'countertops',
    'tile_flooring',
    'flooring',
    'floor_tile',
    'shower_tile',
    'shower_floor_tile',
    'hvac',
  ] as const;

  const semanticsOn = measurementSemanticsV1Enabled();
  const areaReconciliation = semanticsOn
    ? buildAreaReconciliation({
        declaredLivingSf: living,
        declaredGarageSf: scopeMeasurements.garageSqft,
        patioDeckSf: scopeMeasurements.deckSqft,
        rooms: scopeMeasurements.planRooms,
      })
    : scopeMeasurements.areaReconciliation ?? null;

  const nextIq = { ...(scopeMeasurements.itemQuantities || {}) };
  for (const id of FLOOR_AREA_ITEMS) {
    if (!includedIds.has(id)) continue;
    const existing = nextIq[id];
    const hasExistingPrimary = Boolean(existing?.quantity && Number(existing.quantity) > 0);

    if (semanticsOn && NO_LIVING_SF_PRIMARY_SEED_KEYS.has(id)) {
      let primaryQuantity: number | null = null;
      let primaryUnit: MeasurementUnit | null = null;
      if (id === 'drywall' && Number(scopeMeasurements.drywallSqft) > 0) {
        primaryQuantity = Number(scopeMeasurements.drywallSqft);
        primaryUnit = 'surface_sqft';
      } else if (id === 'roofing' && Number(scopeMeasurements.roofSquares) > 0) {
        primaryQuantity = Number(scopeMeasurements.roofSquares);
        primaryUnit = 'roof_square';
      } else if (id === 'stucco' && Number(scopeMeasurements.exteriorPaintSqft) > 0) {
        primaryQuantity = Number(scopeMeasurements.exteriorPaintSqft);
        primaryUnit = 'surface_sqft';
      } else if (id === 'foundation' && Number(scopeMeasurements.concreteCy) > 0) {
        primaryQuantity = Number(scopeMeasurements.concreteCy);
        primaryUnit = 'cy';
      } else if (id === 'pour_flatwork' && Number(scopeMeasurements.concreteSqft) > 0) {
        primaryQuantity = Number(scopeMeasurements.concreteSqft);
        primaryUnit = 'sqft';
      } else if (id === 'excavation' && Number(scopeMeasurements.excavationCy) > 0) {
        primaryQuantity = Number(scopeMeasurements.excavationCy);
        primaryUnit = 'cy';
      } else if (id === 'cabinets' && Number(scopeMeasurements.cabinetLf) > 0) {
        primaryQuantity = Number(scopeMeasurements.cabinetLf);
        primaryUnit = 'lf';
      } else if (id === 'countertops' && Number(scopeMeasurements.countertopSqft) > 0) {
        primaryQuantity = Number(scopeMeasurements.countertopSqft);
        primaryUnit = 'sqft';
      } else if (id === 'shower_tile' && Number(scopeMeasurements.showerWallTileSqft) > 0) {
        primaryQuantity = Number(scopeMeasurements.showerWallTileSqft);
        primaryUnit = 'sqft';
      } else if (id === 'shower_floor_tile' && Number(scopeMeasurements.showerFloorTileSqft) > 0) {
        primaryQuantity = Number(scopeMeasurements.showerFloorTileSqft);
        primaryUnit = 'sqft';
      } else if (id === 'floor_tile' && Number(scopeMeasurements.bathroomFloorSqft) > 0) {
        primaryQuantity = Number(scopeMeasurements.bathroomFloorSqft);
        primaryUnit = 'floor_sqft';
      } else if (
        (id === 'tile_flooring' || id === 'flooring') &&
        Number(scopeMeasurements.flooringSqft) > 0
      ) {
        primaryQuantity = Number(scopeMeasurements.flooringSqft);
        primaryUnit = 'floor_sqft';
      } else if (hasExistingPrimary && String(existing.unit || '') !== 'sqft') {
        // Preserve non-living physical quantities already present.
        primaryQuantity = Number(existing.quantity);
        primaryUnit = String(existing.unit || preferredPrimaryUnit(id)) as MeasurementUnit;
      } else if (
        hasExistingPrimary &&
        existing?.quantitySource === 'user_entered'
      ) {
        primaryQuantity = Number(existing.quantity);
        primaryUnit = String(existing.unit || 'unknown') as MeasurementUnit;
      }

      const measurementState = buildSemanticsStateForScope({
        scopeKey: id,
        livingSf: living,
        primaryQuantity,
        primaryUnit,
        drywallSf: scopeMeasurements.drywallSqft,
        roofSquares: scopeMeasurements.roofSquares,
        flooringSf: scopeMeasurements.flooringSqft,
        concreteCy: scopeMeasurements.concreteCy,
        excavationCy: scopeMeasurements.excavationCy,
        cabinetLf: scopeMeasurements.cabinetLf,
        countertopSqft: scopeMeasurements.countertopSqft,
        showerWallTileSqft: scopeMeasurements.showerWallTileSqft,
        showerFloorTileSqft: scopeMeasurements.showerFloorTileSqft,
        bathroomFloorSqft: scopeMeasurements.bathroomFloorSqft,
        primarySourceType: 'plan_explicit',
        primarySourceLabel:
          primaryQuantity != null ? 'Detected from plan' : 'Needs takeoff',
      });

      // Do not seed living SF into legacy quantity for these scopes.
      if (primaryQuantity != null && primaryQuantity > 0) {
        nextIq[id] = {
          quantity: primaryQuantity,
          unit: primaryUnit || preferredPrimaryUnit(id),
          quantitySource: existing?.quantitySource || 'plan_vision',
          measurementState,
          includesCountertops: existing?.includesCountertops,
        };
      } else {
        nextIq[id] = {
          quantity: null,
          unit: preferredPrimaryUnit(id),
          quantitySource: 'missing',
          measurementState,
          includesCountertops: existing?.includesCountertops,
        };
      }
      continue;
    }

    if (hasExistingPrimary) continue;

    let qty = living;
    let unit = 'sqft';
    if (id === 'tile_flooring' || id === 'flooring') {
      qty = Number(scopeMeasurements.flooringSqft) > 0 ? Number(scopeMeasurements.flooringSqft) : living;
    } else if (id === 'drywall' && Number(scopeMeasurements.drywallSqft) > 0) {
      qty = Number(scopeMeasurements.drywallSqft);
    } else if (id === 'roofing' && Number(scopeMeasurements.roofSquares) > 0) {
      qty = Number(scopeMeasurements.roofSquares);
      unit = 'squares';
    } else if (id === 'foundation' && Number(scopeMeasurements.concreteCy) > 0) {
      qty = Number(scopeMeasurements.concreteCy);
      unit = 'cy';
    } else if (id === 'excavation' && Number(scopeMeasurements.excavationCy) > 0) {
      qty = Number(scopeMeasurements.excavationCy);
      unit = 'cy';
    } else if (id === 'cabinets' && Number(scopeMeasurements.cabinetLf) > 0) {
      qty = Number(scopeMeasurements.cabinetLf);
      unit = 'lf';
    } else if (id === 'countertops' && Number(scopeMeasurements.countertopSqft) > 0) {
      qty = Number(scopeMeasurements.countertopSqft);
    } else if (id === 'shower_tile' && Number(scopeMeasurements.showerWallTileSqft) > 0) {
      qty = Number(scopeMeasurements.showerWallTileSqft);
    } else if (id === 'shower_floor_tile' && Number(scopeMeasurements.showerFloorTileSqft) > 0) {
      qty = Number(scopeMeasurements.showerFloorTileSqft);
    } else if (id === 'floor_tile' && Number(scopeMeasurements.bathroomFloorSqft) > 0) {
      qty = Number(scopeMeasurements.bathroomFloorSqft);
    } else if (
      id === 'excavation' ||
      id === 'foundation' ||
      id === 'cabinets' ||
      id === 'countertops' ||
      id === 'stucco' ||
      id === 'shower_tile' ||
      id === 'shower_floor_tile' ||
      id === 'floor_tile'
    ) {
      // No physical takeoff yet — do not seed living SF.
      continue;
    }
    nextIq[id] = {
      quantity: qty,
      unit,
      quantitySource: 'plan_vision',
    };
  }

  return {
    ...scopeMeasurements,
    itemQuantities: nextIq,
    areaReconciliation: areaReconciliation ?? undefined,
  };
}

/** Whether Step 3 should prefetch clarifying questions without waiting for a tap. */
export function shouldAutoClarifyDraft(draft: EstimateAiDraft | null | undefined): boolean {
  if (!draft) return false;
  if (draft.noPricingDetected) return true;
  if (draft.estimateConfidence?.level === 'low') return true;
  const packages = draft.scopePackages || draft.rooms || [];
  const unpriced = packages.some((p) => {
    const price = Number(p.price ?? p.knownSubtotal ?? p.calculatedSubtotal ?? 0) || 0;
    return price <= 0;
  });
  if (unpriced) return true;
  if ((draft.missingInfo || []).length >= 2) return true;
  return false;
}

export function isComplexEstimateTier(draft: EstimateAiDraft | null | undefined): boolean {
  return Boolean(draft?.estimateTier && draft.estimateTier !== 'simple_unit');
}

export function aiFlowStepTotal(draft: EstimateAiDraft | null | undefined): 2 | 3 {
  return isComplexEstimateTier(draft) ? 3 : 2;
}

function overlayScopeMeasurements(
  draft: EstimateAiDraft,
  scopeMeasurements?: ScopeMeasurements | null
): EstimateAiDraft {
  if (!scopeMeasurements) return draft;
  return {
    ...draft,
    scopeMeasurements: {
      ...(draft.scopeMeasurements || {}),
      ...scopeMeasurements,
      planRooms: scopeMeasurements.planRooms?.length
        ? scopeMeasurements.planRooms
        : draft.scopeMeasurements?.planRooms,
      planFacts: scopeMeasurements.planFacts
        ? {
            ...(draft.scopeMeasurements?.planFacts || {}),
            ...scopeMeasurements.planFacts,
            buildingAreas: {
              ...(draft.scopeMeasurements?.planFacts?.buildingAreas || {}),
              ...(scopeMeasurements.planFacts.buildingAreas || {}),
            },
            fieldEvidence: {
              ...(draft.scopeMeasurements?.planFacts?.fieldEvidence || {}),
              ...(scopeMeasurements.planFacts.fieldEvidence || {}),
            },
          }
        : draft.scopeMeasurements?.planFacts,
      itemQuantities: {
        ...(draft.scopeMeasurements?.itemQuantities || {}),
        ...(scopeMeasurements.itemQuantities || {}),
      },
      quickMeasurementSources: {
        ...(draft.scopeMeasurements?.quickMeasurementSources || {}),
        ...(scopeMeasurements.quickMeasurementSources || {}),
      },
      quickMeasurementUserOverrides: {
        ...(draft.scopeMeasurements?.quickMeasurementUserOverrides || {}),
        ...(scopeMeasurements.quickMeasurementUserOverrides || {}),
      },
      quickMeasurementSuggestionMetadata: {
        ...(draft.scopeMeasurements?.quickMeasurementSuggestionMetadata || {}),
        ...(scopeMeasurements.quickMeasurementSuggestionMetadata || {}),
      },
      quickMeasurementFieldConfidence: {
        ...(draft.scopeMeasurements?.quickMeasurementFieldConfidence || {}),
        ...(scopeMeasurements.quickMeasurementFieldConfidence || {}),
      },
      pricingAcceptance: {
        ...(draft.scopeMeasurements?.pricingAcceptance || {}),
        ...(scopeMeasurements.pricingAcceptance || {}),
      },
    },
  };
}

/**
 * Apply Step 1 plan import onto a freshly generated draft: seed Quick
 * measurements and fill unsure checklist items from plan scope detections.
 */
export function applyPlanImportToDraft(
  draft: EstimateAiDraft,
  payload: PlanImportPayload | null | undefined
): EstimateAiDraft {
  if (!draft || !payload) return draft;
  let next = draft;

  let scopeMeasurements = planMeasurementsToScopeMeasurements(payload.measurements);
  const importedPlanFacts: PlanFacts | undefined =
    payload.planFacts || payload.buildingAreas
      ? {
          ...(payload.planFacts || {}),
          buildingAreas: {
            ...(payload.buildingAreas || {}),
            ...(payload.planFacts?.buildingAreas || {}),
          },
        }
      : undefined;
  if (importedPlanFacts) scopeMeasurements.planFacts = importedPlanFacts;
  if (payload.fieldConfidence && Object.keys(payload.fieldConfidence).length) {
    scopeMeasurements.quickMeasurementFieldConfidence = { ...payload.fieldConfidence };
  }
  if (payload.areaReconciliation) {
    scopeMeasurements.areaReconciliation = payload.areaReconciliation;
  }
  const rooms = normalizePlanRooms(payload.rooms);
  if (rooms.length) {
    scopeMeasurements = applyPlanRoomsToScopeMeasurements(scopeMeasurements, rooms);
  }

  const detections = payload.scopeDetections;
  const items = next.scopeChecklist?.items;
  if (detections?.length && items?.length) {
    const { items: nextItems } = applyScopeDetectionsToChecklistItems(items, detections);
    next = {
      ...next,
      scopeChecklist: { ...next.scopeChecklist!, items: nextItems },
    };
  }

  if (Object.keys(scopeMeasurements).length || rooms.length) {
    scopeMeasurements = seedPlanFloorAreaItemQuantities(next, scopeMeasurements);
    scopeMeasurements = syncMeasurementsWithSouthernUtahPlanFacts(scopeMeasurements, {
      templateKey: next.scopeChecklist?.templateKey,
    });
    next = overlayScopeMeasurements(next, scopeMeasurements);
  }

  return next;
}

export async function applyScopeAssumptionsToDraft(
  draft: EstimateAiDraft,
  confirmedItems: ScopeChecklistItem[],
  scopeMeasurements?: ScopeMeasurements | null
): Promise<EstimateAiDraft> {
  const draftForApply = overlayScopeMeasurements(draft, scopeMeasurements);
  const payload = await postAiAssistantJson<{ draft?: EstimateAiDraft; error?: string; message?: string }>(
    '/estimate-draft-apply-scope-assumptions',
    { draft: draftForApply, confirmedItems, scopeMeasurements: scopeMeasurements ?? undefined },
    60000
  );

  if (!payload?.draft) {
    throw new Error(payload?.message || payload?.error || 'Failed to apply scope assumptions');
  }

  return syncSelectedScopePricing(overlayScopeMeasurements(payload.draft, scopeMeasurements));
}

export function draftHasCombinedRoomPrices(draft: EstimateAiDraft | null): boolean {
  return (draft?.combinedPriceRoomCount || 0) > 0;
}

export function getScopePackageForRoom(
  draft: EstimateAiDraft,
  roomName: string
): EstimateDraftScopePackage | undefined {
  const exact = draft.scopePackages?.find((p) => p.name === roomName);
  if (exact) return exact;
  if (!draft.scopePackages?.length) {
    return getScopePackages(draft).find((p) => p.name === roomName);
  }
  const normalizedRoom = roomName.toLowerCase();
  return draft.scopePackages.find((p) => {
    const normalizedPkg = p.name.toLowerCase();
    if (normalizedPkg === normalizedRoom) return true;
    const roomIsDemo = /\bdemo|removal\b/.test(normalizedRoom);
    const pkgIsDemo = /\bdemo|removal\b/.test(normalizedPkg);
    if (roomIsDemo || pkgIsDemo) return roomIsDemo && pkgIsDemo;
    if (/\bbaseboard|trim\b/.test(normalizedRoom) && /\bbaseboard|trim\b/.test(normalizedPkg)) return true;
    if (
      /\blvp|flooring|floor\b/.test(normalizedRoom) &&
      /\blvp|flooring|floor\b/.test(normalizedPkg)
    ) {
      return true;
    }
    return false;
  });
}

type SelectedScopePricing = {
  total: number;
  materialPrice: number | null;
  laborPrice: number | null;
  basis: { quantity: number; unit: string } | null;
  ruleKey: string;
};

function selectedPricingForRuleKey(
  draft: EstimateAiDraft,
  ruleKey: string
): SelectedScopePricing | null {
  const itemQuantities = draft.scopeMeasurements?.itemQuantities || {};
  const acceptance = draft.scopeMeasurements?.pricingAcceptance?.[ruleKey];
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
    base?.quantitySource === 'user_entered' ||
    allowance?.quantitySource === 'user_entered' ||
    material?.quantitySource === 'user_entered' ||
    labor?.quantitySource === 'user_entered' ||
    acceptance?.selectionStatus === 'accepted' ||
    acceptance?.selectionStatus === 'manual_adjusted';

  // Only sync splits the user confirmed in Confirm Scope / Step 3.
  // Auto national-average amounts must not rewrite packages on apply.
  if (!userSelected) return null;

  const physicalBasis =
    base?.quantity && base.unit && !['allowance', 'lump_sum'].includes(base.unit)
      ? { quantity: Number(base.quantity), unit: base.unit }
      : null;

  if (
    acceptance &&
    Number(acceptance.totalAmount) > 0 &&
    (acceptance.selectionStatus === 'accepted' || acceptance.selectionStatus === 'manual_adjusted')
  ) {
    // Match Step 2: wiped Material/Labor with orphan __allowance must not stamp stale acceptance.
    if (hasSplitLegs && splitLegsEmpty) {
      return null;
    }
    // Prefer live Confirm Scope M/L over sticky acceptance amounts so Step 3 stays accurate.
    const acceptedMaterial =
      materialPrice > 0
        ? materialPrice
        : acceptance.materialAmount != null && Number(acceptance.materialAmount) > 0
          ? Number(acceptance.materialAmount)
          : null;
    const acceptedLabor =
      laborPrice > 0
        ? laborPrice
        : acceptance.laborAmount != null && Number(acceptance.laborAmount) > 0
          ? Number(acceptance.laborAmount)
          : null;
    const liveTotal = splitTotal > 0 ? splitTotal : Number(acceptance.totalAmount);
    // Dollar totals stored as unit "allowance" are not a takeoff qty — omit basis so Step 3
    // does not show "10,118 allowance" under finish carpentry / similar packages.
    const basis =
      physicalBasis &&
      !(
        Number(physicalBasis.quantity) > 0 &&
        Math.abs(Number(physicalBasis.quantity) - liveTotal) < 0.02
      )
        ? physicalBasis
        : null;
    return {
      total: liveTotal,
      materialPrice: acceptedMaterial,
      laborPrice: acceptedLabor,
      basis,
      ruleKey,
    };
  }

  const allowanceTotal = Number(allowance?.quantity || 0);
  const baseTotal = ['allowance', 'lump_sum'].includes(base?.unit || '') ? Number(base?.quantity || 0) : 0;
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
    ruleKey,
  };
}

function selectedPricingForScopeName(
  draft: EstimateAiDraft,
  name: string,
  scope = '',
  checklistItemId?: string | null
): SelectedScopePricing | null {
  // Prefer Confirm Scope checklist id when packages already carry it — name regex
  // has repeatedly mapped Electrical fixtures → electrical_rough, etc.
  if (checklistItemId) {
    const byId = selectedPricingForRuleKey(draft, checklistItemId);
    if (byId) return byId;
  }
  for (const ruleKey of ruleKeysToTryForPackage(name, scope)) {
    if (checklistItemId && ruleKey === checklistItemId) continue;
    const selected = selectedPricingForRuleKey(draft, ruleKey);
    if (selected) return selected;
  }
  return null;
}

function resolvedScopeQuantityBasis(
  draft: EstimateAiDraft,
  ruleKey: string
): { quantity: number; unit: string } | null {
  const resolved = resolveChecklistItemQuantity(
    ruleKey,
    normalizeScopeMeasurements(draft.scopeMeasurements),
    {
      templateKey: draft.scopeChecklist?.templateKey,
      notes: draft.originalNotes,
    }
  );
  if (resolved.quantity == null || resolved.quantity <= 0 || !resolved.unit) return null;
  return { quantity: Number(resolved.quantity), unit: resolved.unit };
}

function packageMoneyTotal(pkg: {
  finalApprovedTotal?: number | null;
  knownSubtotal?: number | null;
  calculatedSubtotal?: number | null;
  price?: number | null;
}): number {
  const candidates = [
    pkg.finalApprovedTotal,
    pkg.knownSubtotal,
    pkg.calculatedSubtotal,
    pkg.price,
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

const SOFT_COST_SYNC_KEYS = new Set([
  'cleanup',
  'haul_off',
  'permits',
  'contingency',
  'mobilization',
  'emergency_fee',
  'final_inspections',
]);

/**
 * Keep Ask AI / manual soft-cost line prices when Confirm Scope sync would
 * rewrite them via a shared/sibling rule key (e.g. trash haul-off ≠ cleanup).
 * Same checklist key still receives Confirm Scope updates.
 */
function isAutoCalculatedUnconfirmedPackage(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft,
  ruleKey: string | null
): boolean {
  if (!(packageMoneyTotal(pkg) > 0)) return false;
  if (pkg.priceProvidedByUser || pkg.status === 'user_provided' || pkg.priceSource === 'user_provided') {
    return false;
  }
  if (
    ruleKey &&
    hasAcceptedScopePricing(
      ruleKey,
      draft.scopeMeasurements?.itemQuantities || {},
      draft.scopeMeasurements?.pricingAcceptance
    )
  ) {
    return false;
  }
  return (
    pkg.status === 'calculated' ||
    pkg.status === 'rough_price' ||
    pkg.status === 'ai_suggested' ||
    pkg.priceSource === 'notes' ||
    pkg.pricedFromSqftAllowances === true ||
    pkg.priceSource === 'national_trade_average' ||
    pkg.priceSource === 'national_high_side_planning'
  );
}

/** Drop takeoff/backend prices that never got Applied on Confirm Scope. */
function stripUnconfirmedAutoPackagePricing<T extends EstimateDraftScopePackage>(
  pkg: T,
  draft: EstimateAiDraft,
  base: T,
  basis: { quantity: number; unit: string } | null
): T {
  const ruleKey =
    base.checklistItemId ||
    lookupRuleKeyForPackage(pkg.name, pkg.scope || '') ||
    null;
  if (!isAutoCalculatedUnconfirmedPackage(pkg, draft, ruleKey)) {
    return basis
      ? {
          ...base,
          scopeQuantities: [{ quantity: basis.quantity, unit: basis.unit }],
          budgetSplitBasis: basis,
        }
      : base;
  }

  return {
    ...base,
    price: null,
    knownSubtotal: null,
    calculatedSubtotal: null,
    finalApprovedTotal: null,
    materialPrice: null,
    laborPrice: null,
    priceSource: 'missing',
    status: 'missing_price',
    packageStatus: 'missing_price',
    applyEligible: false,
    priceProvidedByUser: false,
    pricedFromSqftAllowances: false,
    scopeQuantities: basis
      ? [{ quantity: basis.quantity, unit: basis.unit }]
      : pkg.scopeQuantities,
    budgetSplitBasis: basis ?? pkg.budgetSplitBasis ?? null,
    missingPriceItems: pkg.missingPriceItems?.length
      ? pkg.missingPriceItems
      : ['Materials / supplies', 'Install labor'],
  };
}

function shouldPreserveUserPackagePrice(
  pkg: { priceProvidedByUser?: boolean; price?: number | null; checklistItemId?: string | null },
  selected: SelectedScopePricing
): boolean {
  if (!pkg.priceProvidedByUser) return false;
  const current = Number(pkg.price);
  if (!(current > 0) || Math.abs(current - selected.total) < 0.01) return false;
  if (!SOFT_COST_SYNC_KEYS.has(selected.ruleKey)) return false;
  if (pkg.checklistItemId && pkg.checklistItemId === selected.ruleKey) return false;
  return true;
}

function applySelectedPricingToScopePackage(
  pkg: EstimateDraftScopePackage,
  draft: EstimateAiDraft
): EstimateDraftScopePackage {
  const selected = selectedPricingForScopeName(
    draft,
    pkg.name,
    pkg.scope,
    pkg.checklistItemId
  );
  // Keep a stable checklist identity; do not overwrite with a wrong regex match.
  const ruleKey =
    pkg.checklistItemId ||
    selected?.ruleKey ||
    lookupRuleKeyForPackage(pkg.name, pkg.scope || '') ||
    null;
  // When Confirm Scope already selected a price, honor its basis only (null = no
  // takeoff qty). Do not fall back to resolvedScopeQuantityBasis — that re-reads
  // dollar "allowance" itemQuantities as 10,118 lump sum under finish carpentry.
  const basis = selected
    ? selected.basis
    : (ruleKey ? resolvedScopeQuantityBasis(draft, ruleKey) : null) ??
      pkg.budgetSplitBasis ??
      pkg.scopeQuantities?.[0] ??
      null;
  const withIdentity: EstimateDraftScopePackage = {
    ...pkg,
    checklistItemId: ruleKey,
    costCode: pkg.costCode || ruleKey,
  };
  if (!selected) {
    return stripUnconfirmedAutoPackagePricing(pkg, draft, withIdentity, basis);
  }
  if (shouldPreserveUserPackagePrice(pkg, selected)) {
    return {
      ...withIdentity,
      checklistItemId: pkg.checklistItemId || ruleKey,
      budgetSplitBasis: basis ?? pkg.budgetSplitBasis ?? null,
      scopeQuantities: basis
        ? [{ quantity: basis.quantity, unit: basis.unit }]
        : undefined,
    };
  }
  return {
    ...withIdentity,
    price: selected.total,
    knownSubtotal: selected.total,
    calculatedSubtotal: selected.total,
    finalApprovedTotal: selected.total,
    materialPrice: selected.materialPrice,
    laborPrice: selected.laborPrice,
    includesLabor: selected.laborPrice != null ? true : pkg.includesLabor,
    includesMaterials: selected.materialPrice != null ? true : pkg.includesMaterials,
    priceSource: 'user_provided',
    status: 'user_provided',
    pricingType: selected.materialPrice || selected.laborPrice ? 'split' : 'lump_sum',
    priceIncludesLaborAndMaterials: Boolean(selected.total && !(selected.materialPrice && selected.laborPrice)),
    splitIsSuggested: false,
    priceProvidedByUser: true,
    applyEligible: true,
    budgetSplitBasis: basis,
    scopeQuantities: basis ? [{ quantity: basis.quantity, unit: basis.unit }] : undefined,
    missingPriceItems: [],
  };
}

function applySelectedPricingToRoom(room: EstimateDraftRoom, draft: EstimateAiDraft): EstimateDraftRoom {
  const checklistItemId =
    (room as { checklistItemId?: string | null }).checklistItemId ||
    lookupRuleKeyForPackage(room.name, room.scope || '');
  const selected = selectedPricingForScopeName(draft, room.name, room.scope, checklistItemId);
  if (!selected) {
    const asPkg = {
      name: room.name,
      scope: room.scope,
      checklistItemId,
      price: room.price,
      knownSubtotal: room.knownSubtotal,
      calculatedSubtotal: room.calculatedSubtotal,
      materialPrice: room.materialPrice,
      laborPrice: room.laborPrice,
      priceProvidedByUser: room.priceProvidedByUser,
      status: room.packageStatus || room.status,
      scopeQuantities: room.scopeQuantities,
      budgetSplitBasis: room.budgetSplitBasis,
      missingPriceItems: room.missingPriceItems,
      pricedFromSqftAllowances: room.pricedFromSqftAllowances,
    } as EstimateDraftScopePackage;
    const basis =
      (checklistItemId ? resolvedScopeQuantityBasis(draft, checklistItemId) : null) ??
      room.budgetSplitBasis ??
      room.scopeQuantities?.[0] ??
      null;
    const stripped = stripUnconfirmedAutoPackagePricing(asPkg, draft, asPkg, basis);
    return {
      ...room,
      price: stripped.price ?? null,
      knownSubtotal: stripped.knownSubtotal ?? null,
      calculatedSubtotal: stripped.calculatedSubtotal ?? null,
      materialPrice: stripped.materialPrice ?? null,
      laborPrice: stripped.laborPrice ?? null,
      priceProvidedByUser: stripped.priceProvidedByUser,
      packageStatus: stripped.packageStatus ?? room.packageStatus,
      pricedFromSqftAllowances: stripped.pricedFromSqftAllowances,
      scopeQuantities: stripped.scopeQuantities,
      budgetSplitBasis: stripped.budgetSplitBasis ?? null,
      missingPriceItems: stripped.missingPriceItems,
      applyEligible: stripped.applyEligible,
    };
  }
  if (
    shouldPreserveUserPackagePrice(
      {
        priceProvidedByUser: room.priceProvidedByUser,
        price: room.price,
        checklistItemId,
      },
      selected
    )
  ) {
    return room;
  }
  return {
    ...room,
    price: selected.total,
    knownSubtotal: selected.total,
    materialPrice: selected.materialPrice,
    laborPrice: selected.laborPrice,
    priceIncludesLaborAndMaterials: Boolean(selected.total && !(selected.materialPrice && selected.laborPrice)),
    splitIsSuggested: false,
    priceProvidedByUser: true,
    pricedFromSqftAllowances: false,
    packageStatus: 'user_provided',
    applyEligible: true,
    missingPriceItems: [],
  };
}

function recomputeClientDraftTotals(draft: EstimateAiDraft): EstimateAiDraft {
  const packages = draft.scopePackages || [];
  if (!packages.length) return draft;
  let lineTotal = 0;
  let laborTotal = 0;
  let materialTotal = 0;
  for (const pkg of packages) {
    const amount = packageMoneyTotal(pkg);
    if (!(amount > 0)) continue;
    lineTotal += amount;
    materialTotal += Number(pkg.materialPrice) > 0 ? Number(pkg.materialPrice) : 0;
    laborTotal += Number(pkg.laborPrice) > 0 ? Number(pkg.laborPrice) : 0;
  }
  if (!(lineTotal > 0)) return draft;
  return {
    ...draft,
    calculatedLineItemTotal: Math.round(lineTotal * 100) / 100,
    calculatedLaborTotal:
      laborTotal > 0 ? Math.round(laborTotal * 100) / 100 : draft.calculatedLaborTotal,
    calculatedMaterialTotal:
      materialTotal > 0 ? Math.round(materialTotal * 100) / 100 : draft.calculatedMaterialTotal,
    calculatedTotal: Math.round(lineTotal * 100) / 100,
  };
}

export function syncSelectedScopePricing(draft: EstimateAiDraft): EstimateAiDraft {
  if (!draft?.scopeMeasurements?.itemQuantities && !draft?.scopeMeasurements?.pricingAcceptance) {
    return recomputeClientDraftTotals(draft);
  }
  const nextDraft = { ...draft };
  if (draft.scopePackages?.length) {
    nextDraft.scopePackages = draft.scopePackages.map((pkg) => applySelectedPricingToScopePackage(pkg, draft));
  }
  if (draft.rooms?.length) {
    nextDraft.rooms = draft.rooms.map((room) => applySelectedPricingToRoom(room, draft));
  }
  return recomputeClientDraftTotals(nextDraft);
}

/** Remove a scope package/room from the Step 3 draft and drop its Confirm Scope pricing. */
export function removeScopePackageFromDraft(
  draft: EstimateAiDraft,
  packageName: string
): EstimateAiDraft {
  const name = String(packageName || '').trim();
  if (!draft || !name) return draft;

  const matchPkg = (pkg: { name?: string | null; scope?: string | null }) =>
    pkg.name === name || pkg.scope === name;

  const removed =
    (draft.scopePackages || []).find(matchPkg) || (draft.rooms || []).find(matchPkg) || null;
  const ruleKey =
    (removed as { checklistItemId?: string | null } | null)?.checklistItemId ||
    lookupRuleKeyForPackage(removed?.name || name, removed?.scope || '') ||
    null;

  const nextScopePackages = (draft.scopePackages || []).filter((pkg) => !matchPkg(pkg));
  const nextRooms = (draft.rooms || []).filter((room) => !matchPkg(room));

  let nextMeasurements = draft.scopeMeasurements;
  if (ruleKey && draft.scopeMeasurements) {
    const itemQuantities = { ...(draft.scopeMeasurements.itemQuantities || {}) };
    delete itemQuantities[ruleKey];
    delete itemQuantities[`${ruleKey}__material`];
    delete itemQuantities[`${ruleKey}__labor`];
    delete itemQuantities[`${ruleKey}__allowance`];
    const pricingAcceptance = { ...(draft.scopeMeasurements.pricingAcceptance || {}) };
    delete pricingAcceptance[ruleKey];
    nextMeasurements = {
      ...draft.scopeMeasurements,
      itemQuantities,
      pricingAcceptance,
    };
  }

  let nextChecklist = draft.scopeChecklist;
  if (ruleKey && draft.scopeChecklist?.items?.length) {
    nextChecklist = {
      ...draft.scopeChecklist,
      items: draft.scopeChecklist.items.map((item) =>
        item.id === ruleKey
          ? {
              ...item,
              state: 'excluded',
              choiceId: item.inputType === 'choice' ? 'not_in_scope' : item.choiceId,
            }
          : item
      ),
    };
  }

  const nextDraft: EstimateAiDraft = {
    ...draft,
    scopePackages: draft.scopePackages?.length ? nextScopePackages : draft.scopePackages,
    rooms: nextRooms,
    scopeMeasurements: nextMeasurements,
    scopeChecklist: nextChecklist,
  };

  if (nextScopePackages.length > 0) {
    return recomputeClientDraftTotals({ ...nextDraft, scopePackages: nextScopePackages });
  }

  // Rooms-only drafts: recompute from remaining rooms.
  let lineTotal = 0;
  for (const room of nextRooms) {
    lineTotal += packageMoneyTotal(room);
  }
  const rounded = Math.round(lineTotal * 100) / 100;
  return {
    ...nextDraft,
    calculatedLineItemTotal: rounded > 0 ? rounded : 0,
    calculatedTotal: rounded > 0 ? rounded : 0,
  };
}

export function roomIsApplyEligible(
  room: EstimateDraftRoom,
  draft: EstimateAiDraft,
  applyConfirmedOnly = false
): boolean {
  const pkg = getScopePackageForRoom(draft, room.name);
  if (pkg?.status === 'missing_price') return false;
  if (
    applyConfirmedOnly &&
    (pkg?.status === 'ai_suggested' || pkg?.status === 'rough_price') &&
    !pkg?.applyEligible &&
    !pkg?.priceProvidedByUser &&
    !room.applyEligible &&
    !room.priceProvidedByUser
  ) {
    return false;
  }
  if (pkg?.applyEligible || room.applyEligible) return true;
  if (room.price != null && room.price > 0) return true;
  if ((pkg?.knownSubtotal || room.knownSubtotal || 0) > 0) return true;
  return false;
}

/** Resolve effective room pricing for apply (respects split approval). */
export function resolveRoomForApply(
  room: EstimateDraftRoom,
  draft: EstimateAiDraft
): EstimateDraftRoom {
  const applySplits = Boolean(draft.applySuggestedSplits);
  if (room.splitIsSuggested && room.laborPrice != null && room.materialPrice != null && applySplits) {
    return { ...room, splitApprovedByUser: true };
  }

  const approvedPreview = (draft.suggestedSplits || []).find(
    (s) => s.parentItemName === room.name && s.approvedByUser && s.previewOnly
  );
  if (approvedPreview && applySplits) {
    return {
      ...room,
      laborPrice: approvedPreview.suggestedLabor,
      materialPrice: approvedPreview.suggestedMaterials,
      priceIncludesLaborAndMaterials: false,
      splitIsSuggested: true,
      splitApprovedByUser: true,
    };
  }

  if (room.splitIsSuggested && !applySplits) {
    return {
      ...room,
      laborPrice: null,
      materialPrice: null,
      priceIncludesLaborAndMaterials: true,
    };
  }

  return room;
}

/** Job notes blob for scope parsing — prefers originalNotes, then description / rooms. */
export function resolveDraftScopeNotes(
  draft: {
    originalNotes?: string | null;
    projectDescription?: string | null;
    contractScope?: string | null;
    rooms?: Array<{ name?: string; scope?: string }>;
    scopeChecklist?: { intro?: string } | null;
  } | null | undefined
): string {
  const direct = String(draft?.originalNotes || '').trim();
  if (direct) return direct;

  const parts: string[] = [];
  const desc = String(draft?.projectDescription || '').trim();
  if (desc) parts.push(desc);
  const contract = String(draft?.contractScope || '').trim();
  if (contract) parts.push(contract);
  for (const room of draft?.rooms || []) {
    const body = String(room?.scope || '').trim();
    if (!body) continue;
    const header = String(room?.name || '').trim();
    parts.push(header ? `${header}\n${body}` : body);
  }
  if (!parts.length) {
    const intro = String(draft?.scopeChecklist?.intro || '').trim();
    if (intro) parts.push(intro);
  }
  return parts.join('\n\n').trim();
}

function buildScopeDescription(draft: EstimateAiDraft): string {
  const parts: string[] = [];

  if (draft.projectDescription) {
    parts.push(draft.projectDescription.trim());
  }

  if (draft.contractScope) {
    parts.push(draft.contractScope.trim());
  }

  const rooms = draft.rooms || [];
  if (rooms.length > 0) {
    const roomBlocks = rooms.map((room) => {
      const header = room.name.trim();
      const body = room.scope.trim();
      return body ? `${header}\n${body}` : header;
    });
    parts.push(roomBlocks.join('\n\n'));
  }

  const allowances = draft.allowances || [];
  if (allowances.length > 0) {
    const allowanceLines = allowances.map((allowance) => {
      const label = allowance.name || allowance.description || 'Allowance';
      const rate = allowance.rate ?? allowance.amount;
      const amount =
        rate != null
          ? formatDraftMoney(rate) + (allowance.unit ? ` ${allowance.unit}` : '')
          : allowance.unit || '';
      const calc =
        allowance.calculatedAmount != null
          ? ` → ${formatDraftMoney(allowance.calculatedAmount)}`
          : '';
      const detail = allowance.description?.trim();
      return [label, amount, calc, detail].filter(Boolean).join(' — ');
    });
    parts.push(['Allowances', ...allowanceLines.map((line) => `• ${line}`)].join('\n'));
  }

  const inclusions = draft.inclusions || [];
  if (inclusions.length > 0) {
    parts.push(['Inclusions', ...inclusions.map((line) => `• ${line}`)].join('\n'));
  }

  const exclusions = draft.exclusions || [];
  if (exclusions.length > 0) {
    parts.push(['Exclusions', ...exclusions.map((line) => `• ${line}`)].join('\n'));
  }

  return parts.filter(Boolean).join('\n\n').trim();
}

function laborPortion(room: EstimateDraftRoom): number {
  if (room.laborPrice != null) return room.laborPrice;
  if (room.priceIncludesLaborAndMaterials && room.price != null) return room.price;
  if (room.price != null) return room.price;
  return 0;
}

function materialPortion(room: EstimateDraftRoom): number {
  if (room.materialPrice != null) return room.materialPrice;
  return 0;
}

function parsedNoteSplitForPackage(
  pkg: EstimateDraftScopePackage | undefined,
  draft: EstimateAiDraft
): { material: number; labor: number; total: number; splitIsSuggested?: boolean } | null {
  if (!pkg) return null;
  const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft);
  if (!breakdown) return null;
  if (breakdown.material <= 0 && breakdown.labor <= 0) return null;

  const isSuggested =
    breakdown.materialSource === 'suggested' && breakdown.laborSource === 'suggested';
  const hasApprovedPkgSplit =
    Number(pkg.materialPrice ?? 0) > 0 && Number(pkg.laborPrice ?? 0) > 0;
  if (isSuggested && !draft.applySuggestedSplits && !hasApprovedPkgSplit) {
    return null;
  }

  return {
    material: breakdown.material,
    labor: breakdown.labor,
    total: breakdown.total,
    splitIsSuggested: isSuggested,
  };
}

function laborDescription(
  room: EstimateDraftRoom,
  pkg?: EstimateDraftScopePackage,
  parsedSplit?: { splitIsSuggested?: boolean } | null
): string {
  const scope = room.scope?.trim() || room.name;
  const parts = [scope];
  if (pkg?.status === 'partial_pricing') {
    const priced = (pkg.pricingItems || [])
      .filter((i) => i.amount != null && i.amount > 0)
      .map((i) => `• ${i.name}: ${formatDraftMoney(i.amount)}${i.status === 'rough_price' ? ' (rough)' : ''}`)
      .join('\n');
    if (priced) parts.push(`\nKnown pricing from notes:\n${priced}`);
    const missing = (pkg.missingPriceItems || []).slice(0, 8).map((m) => `• ${m}`).join('\n');
    if (missing) {
      parts.push(`\nStill needs pricing (not included in line total):\n${missing}`);
    }
    parts.push('\n(Partial package — add remaining scope on Labor/Materials steps.)');
  }
  if (parsedSplit) {
    parts.push(
      parsedSplit.splitIsSuggested
        ? '\n(National Average budget split applied — review on Labor step.)'
        : '\n(Material/labor split from notes — review on Labor step.)'
    );
  } else if (room.splitIsSuggested && room.splitApprovedByUser) {
    parts.push('\n(AI-suggested labor split — review on Labor step.)');
  } else if (room.priceIncludesLaborAndMaterials && !room.splitIsSuggested) {
    parts.push('\n(Price from notes includes labor and materials — split on steps if needed.)');
  }
  return parts.join('');
}

function effectiveLaborTotal(
  room: EstimateDraftRoom,
  pkg: EstimateDraftScopePackage | undefined,
  draft: EstimateAiDraft
): number | null {
  const resolved = resolveRoomForApply(room, draft);
  const parsedSplit = parsedNoteSplitForPackage(pkg, draft);
  if (parsedSplit) {
    return parsedSplit.labor > 0 ? parsedSplit.labor : null;
  }
  if (pkg) {
    return laborAmountForPackage(pkg, null, Boolean(draft.applySuggestedSplits));
  }
  if (resolved.priceIncludesLaborAndMaterials && !resolved.splitIsSuggested) {
    const total = Number(resolved.price) || 0;
    return total > 0 ? total : null;
  }
  const total = laborPortion(resolved);
  return total > 0 ? total : null;
}

function packageIsApplyEligible(pkg: EstimateDraftScopePackage, applyConfirmedOnly: boolean): boolean {
  if (pkg.status === 'missing_price') return false;
  // Approved rough/AI pricing is apply-eligible once the user confirmed it in Step 3.
  if (
    applyConfirmedOnly &&
    (pkg.status === 'ai_suggested' || pkg.status === 'rough_price') &&
    !pkg.applyEligible &&
    !pkg.priceProvidedByUser
  ) {
    return false;
  }
  if (pkg.applyEligible) return true;
  const amount = pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0;
  return amount > 0;
}

function packageAllowanceAmount(pkg: EstimateDraftScopePackage): number {
  const amount = Number(pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function resolvePackageCostCode(
  pkg: EstimateDraftScopePackage | null | undefined,
  name?: string,
  scope?: string
): string | undefined {
  if (pkg?.costCode) return String(pkg.costCode);
  if (pkg?.checklistItemId) return String(pkg.checklistItemId);
  const ruleKey = lookupRuleKeyForPackage(name || pkg?.name || '', scope || pkg?.scope || '');
  return ruleKey || undefined;
}

function allowanceLineItemsFromDraft(
  draft: EstimateAiDraft,
  applyConfirmedOnly: boolean
): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];
  if (!draft.scopePackages?.length) return lines;

  for (const pkg of draft.scopePackages) {
    if (!packageIsApplyEligible(pkg, applyConfirmedOnly)) continue;
    if (!isSoftCostScopePackage(pkg, draft)) continue;
    const total = packageAllowanceAmount(pkg);
    if (total <= 0) continue;
    const ruleKey = resolvePackageCostCode(pkg);
    lines.push({
      id: newLineItemId(),
      name: pkg.name,
      description: pkg.scope?.trim() || 'Soft-cost allowance',
      amount: total,
      total,
      totalCost: total,
      category: 'Allowance',
      section: pkg.name,
      source: 'ai-draft',
      sourceItemId: ruleKey,
      costCode: ruleKey,
      checklistItemId: ruleKey,
      priceProvidedByUser: true,
    });
  }
  return lines;
}

function laborDescriptionForPackage(
  pkg: EstimateDraftScopePackage,
  parsedSplit?: { splitIsSuggested?: boolean } | null
): string {
  const parts = [pkg.scope?.trim() || pkg.name];
  if (parsedSplit) {
    parts.push(
      parsedSplit.splitIsSuggested
        ? '\n(National Average budget split applied — review on Labor step.)'
        : '\n(Material/labor split from notes — review on Labor step.)'
    );
  } else if (pkg.priceIncludesLaborAndMaterials || (pkg.includesLabor && pkg.includesMaterials)) {
    parts.push('\n(Price from notes includes labor and materials — split on steps if needed.)');
  }
  return parts.join('');
}

function budgetSplitDisplaySubtitle(
  parsedSplit: { splitIsSuggested?: boolean } | null | undefined,
  type: 'material' | 'labor'
): string | null {
  if (!parsedSplit) return null;
  if (parsedSplit.splitIsSuggested) {
    return type === 'material'
      ? 'National Average material budget split'
      : 'National Average labor remainder';
  }
  return type === 'material' ? SCOPE_MATERIAL_PARSED_FROM_NOTES_LABEL : SCOPE_LABOR_PARSED_FROM_NOTES_LABEL;
}

/** True when package material/labor fields are only a suggested national split, not confirmed. */
function packageSplitIsSuggestedOnly(pkg: EstimateDraftScopePackage): boolean {
  if (pkg.splitIsSuggested) return true;
  // Approved rough proposals store real material/labor — those are confirmed, not suggested.
  if (pkg.priceSource === 'ai_rough_estimate' && pkg.applyEligible) return false;
  if (pkg.priceSource === 'manual' || pkg.priceSource === 'user' || pkg.priceSource === 'user_provided') {
    return false;
  }
  return false;
}

/** Labor amount for a package without double-counting material already on the package. */
function laborAmountForPackage(
  pkg: EstimateDraftScopePackage,
  parsedSplit: { labor: number; material?: number; splitIsSuggested?: boolean } | null,
  applySuggestedSplits = false
): number {
  const pkgPrice = Number(pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0);

  if (parsedSplit && (parsedSplit.labor > 0 || (parsedSplit.material || 0) > 0)) {
    if (parsedSplit.splitIsSuggested && !applySuggestedSplits) {
      return pkgPrice > 0 ? pkgPrice : 0;
    }
    const splitMat = Number(parsedSplit.material || 0);
    const splitLab = Number(parsedSplit.labor || 0);
    const splitTotal = splitMat + splitLab;
    // Confirmed split may be only a portion (Step 3 puts the rest in Allowances).
    // Keep the remainder on labor so the package total is preserved.
    if (pkgPrice > splitTotal + 1) {
      return Math.max(0, splitLab + (pkgPrice - splitTotal));
    }
    return splitLab > 0 ? splitLab : 0;
  }

  // Unconfirmed suggested splits stay as a combined trade package (Step 3 Allowances).
  if (packageSplitIsSuggestedOnly(pkg) && !applySuggestedSplits) {
    return pkgPrice > 0 ? pkgPrice : 0;
  }
  const pkgLab = Number(pkg.laborPrice ?? 0);
  const pkgMat = Number(pkg.materialPrice ?? 0);
  const materialFromItems = (pkg.pricingItems || [])
    .filter((i) => i.pricingType === 'material' && (i.amount || 0) > 0)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const separateMaterial = pkgMat > 0 ? pkgMat : materialFromItems;

  // Explicit labor+material split on the package.
  if (pkgLab > 0 && separateMaterial > 0) {
    const splitTotal = pkgLab + separateMaterial;
    if (pkgPrice > splitTotal + 1) {
      return Math.max(0, pkgLab + (pkgPrice - splitTotal));
    }
    // laborPrice sometimes stores the combined total — never add materials on top of that.
    if (pkgPrice > 0 && Math.abs(pkgLab - pkgPrice) <= 1) {
      return Math.max(0, pkgPrice - separateMaterial);
    }
    return pkgLab;
  }
  if (pkgLab > 0) return pkgLab;

  // If materials are priced separately, labor is the remainder — never the full package total.
  if (separateMaterial > 0 && pkgPrice > separateMaterial) {
    return Math.max(0, pkgPrice - separateMaterial);
  }
  if (pkgPrice > 0) return pkgPrice;
  const laborFromItems = (pkg.pricingItems || [])
    .filter((i) => i.pricingType === 'labor' && (i.amount || 0) > 0)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  return laborFromItems > 0 ? laborFromItems : 0;
}

/** Material amount for a package — only confirmed Step 2–3 splits, not invented national averages. */
function materialAmountForPackage(
  pkg: EstimateDraftScopePackage,
  parsedSplit: { material: number; splitIsSuggested?: boolean } | null,
  applySuggestedSplits = false
): number {
  if (parsedSplit && parsedSplit.material > 0) {
    if (parsedSplit.splitIsSuggested && !applySuggestedSplits) return 0;
    return parsedSplit.material;
  }
  if (packageSplitIsSuggestedOnly(pkg) && !applySuggestedSplits) return 0;
  const pkgMat = Number(pkg.materialPrice ?? 0);
  if (pkgMat > 0) return pkgMat;
  return 0;
}

function laborLineItemsFromDraft(
  draft: EstimateAiDraft,
  applyConfirmedOnly: boolean
): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];
  const applySuggestedSplits = Boolean(draft.applySuggestedSplits);

  if (draft.scopePackages?.length) {
    for (const pkg of draft.scopePackages) {
      if (!packageIsApplyEligible(pkg, applyConfirmedOnly)) continue;
      if (isSoftCostScopePackage(pkg, draft)) continue;

      const parsedSplit = parsedNoteSplitForPackage(pkg, draft);
      const total = laborAmountForPackage(pkg, parsedSplit, applySuggestedSplits);
      if (total <= 0) continue;

      const splitMaterial = materialAmountForPackage(pkg, parsedSplit, applySuggestedSplits);
      const materialFromItems =
        splitMaterial > 0
          ? 0
          : (pkg.pricingItems || [])
              .filter((i) => i.pricingType === 'material' && (i.amount || 0) > 0)
              .reduce((s, i) => s + (Number(i.amount) || 0), 0);
      const hasSeparateMaterial = splitMaterial > 0 || materialFromItems > 0;
      const isCombinedOnly =
        !hasSeparateMaterial &&
        (pkg.priceIncludesLaborAndMaterials ||
          (pkg.includesLabor && pkg.includesMaterials) ||
          (packageSplitIsSuggestedOnly(pkg) && !applySuggestedSplits));
      const costCode = resolvePackageCostCode(pkg);
      lines.push({
        id: newLineItemId(),
        name: pkg.name,
        description: laborDescriptionForPackage(pkg, parsedSplit),
        hours: 1,
        rate: total,
        total,
        totalCost: total,
        category: isCombinedOnly ? 'Trade package' : 'Labor',
        section: pkg.name,
        source: 'ai-draft',
        sourceItemId: costCode,
        costCode,
        checklistItemId: costCode,
        priceProvidedByUser: true,
        priceIncludesLaborAndMaterials: isCombinedOnly,
        splitIsSuggested: Boolean(parsedSplit?.splitIsSuggested || pkg.splitIsSuggested),
        displaySubtitle: budgetSplitDisplaySubtitle(parsedSplit, 'labor'),
        partialPricing: pkg.status === 'partial_pricing',
      });
    }
    return lines;
  }

  for (const room of draft.rooms) {
    if (!roomIsApplyEligible(room, draft, applyConfirmedOnly)) continue;

    const pkg = getScopePackageForRoom(draft, room.name);
    const total = effectiveLaborTotal(room, pkg, draft);
    if (total == null || total <= 0) continue;

    const resolved = resolveRoomForApply(room, draft);
    const parsedSplit = parsedNoteSplitForPackage(pkg, draft);
    const isCombinedOnly =
      resolved.priceIncludesLaborAndMaterials &&
      !resolved.splitIsSuggested &&
      pkg?.status !== 'partial_pricing';
    const costCode = resolvePackageCostCode(pkg, resolved.name, resolved.scope);

    lines.push({
      id: newLineItemId(),
      name: resolved.name,
      description: laborDescription(resolved, pkg, parsedSplit),
      hours: 1,
      rate: total,
      total,
      totalCost: total,
      category:
        pkg?.status === 'partial_pricing'
          ? 'Partial package'
          : isCombinedOnly
            ? 'Trade package'
            : 'Labor',
      section: resolved.name,
      source: 'ai-draft',
      sourceItemId: costCode,
      costCode,
      checklistItemId: costCode,
      priceProvidedByUser: true,
      priceIncludesLaborAndMaterials:
        pkg?.status === 'partial_pricing' ? false : resolved.priceIncludesLaborAndMaterials,
      splitIsSuggested: Boolean(resolved.splitIsSuggested),
      displaySubtitle: budgetSplitDisplaySubtitle(parsedSplit, 'labor'),
      partialPricing: pkg?.status === 'partial_pricing',
    });
  }

  return lines;
}

function materialLineItemsFromDraft(
  draft: EstimateAiDraft,
  applyConfirmedOnly: boolean
): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];
  const applySuggestedSplits = Boolean(draft.applySuggestedSplits);

  if (draft.scopePackages?.length) {
    for (const pkg of draft.scopePackages) {
      if (!packageIsApplyEligible(pkg, applyConfirmedOnly)) continue;
      if (isSoftCostScopePackage(pkg, draft)) continue;

      const parsedSplit = parsedNoteSplitForPackage(pkg, draft);
      const splitMaterial = materialAmountForPackage(pkg, parsedSplit, applySuggestedSplits);
      const splitIsSuggested = parsedSplit?.splitIsSuggested ?? Boolean(pkg.splitIsSuggested);
      const costCode = resolvePackageCostCode(pkg);

      // Prefer package/split material amount. Only fall back to pricingItems when no package material exists.
      if (splitMaterial > 0) {
        lines.push({
          id: newLineItemId(),
          name: `${pkg.name} — materials`,
          description: splitIsSuggested
            ? `Suggested materials split for ${pkg.name} — adjust after applying.`
            : `Materials for ${pkg.name}`,
          quantity: 1,
          qty: 1,
          unit: 'lot',
          unitPrice: splitMaterial,
          cost: splitMaterial,
          total: splitMaterial,
          section: pkg.name,
          source: 'ai-draft',
          sourceItemId: costCode,
          costCode,
          checklistItemId: costCode,
          isManual: true,
          displaySubtitle: budgetSplitDisplaySubtitle(parsedSplit, 'material'),
        });
        continue;
      }

      if (pkg.pricingItems?.length) {
        for (const item of pkg.pricingItems) {
          if (item.pricingType !== 'material' || item.amount == null || item.amount <= 0) continue;
          if (applyConfirmedOnly && item.status === 'ai_suggested' && !item.approvedByUser) continue;
          lines.push({
            id: newLineItemId(),
            name: `${pkg.name} — ${item.name}`,
            description: item.description || `${SCOPE_PARSED_FROM_NOTES_LABEL} (${item.status || 'confirmed'})`,
            quantity: 1,
            qty: 1,
            unit: 'lot',
            unitPrice: item.amount,
            cost: item.amount,
            total: item.amount,
            section: pkg.name,
            source: 'ai-draft',
            sourceItemId: costCode,
            costCode,
            checklistItemId: costCode,
            isManual: true,
          });
        }
      }
    }
    return lines;
  }

  for (const room of draft.rooms) {
    if (!roomIsApplyEligible(room, draft, applyConfirmedOnly)) continue;

    const pkg = getScopePackageForRoom(draft, room.name);
    const resolved = resolveRoomForApply(room, draft);
    const parsedSplit = parsedNoteSplitForPackage(pkg, draft);
    const costCode = resolvePackageCostCode(pkg, resolved.name, resolved.scope);

    const splitMaterial =
      materialAmountForPackage(
        pkg || ({ materialPrice: resolved.materialPrice } as EstimateDraftScopePackage),
        parsedSplit,
        applySuggestedSplits
      ) || (parsedSplit ? 0 : materialPortion(resolved));
    const splitIsSuggested = parsedSplit?.splitIsSuggested ?? Boolean(resolved.splitIsSuggested);

    if (splitMaterial > 0) {
      lines.push({
        id: newLineItemId(),
        name: `${room.name} — materials`,
        description: splitIsSuggested
          ? `Suggested materials split for ${room.name} — adjust after applying.`
          : `Materials for ${room.name}`,
        quantity: 1,
        qty: 1,
        unit: 'lot',
        unitPrice: splitMaterial,
        cost: splitMaterial,
        total: splitMaterial,
        section: room.name,
        source: 'ai-draft',
        sourceItemId: costCode,
        costCode,
        checklistItemId: costCode,
        isManual: true,
        displaySubtitle: budgetSplitDisplaySubtitle(parsedSplit, 'material'),
      });
      continue;
    }

    if (pkg?.pricingItems?.length) {
      for (const item of pkg.pricingItems) {
        if (item.pricingType !== 'material' || item.amount == null || item.amount <= 0) continue;
        if (applyConfirmedOnly && item.status === 'ai_suggested' && !item.approvedByUser) continue;
        lines.push({
          id: newLineItemId(),
          name: `${room.name} — ${item.name}`,
          description: item.description || `${SCOPE_PARSED_FROM_NOTES_LABEL} (${item.status || 'confirmed'})`,
          quantity: 1,
          qty: 1,
          unit: 'lot',
          unitPrice: item.amount,
          cost: item.amount,
          total: item.amount,
          section: room.name,
          source: 'ai-draft',
          sourceItemId: costCode,
          costCode,
          checklistItemId: costCode,
          isManual: true,
        });
      }
    }
  }

  return lines;
}

function cartItemFromMaterialLine(item: Record<string, unknown>): Record<string, unknown> {
  const qty = Number(item.quantity || item.qty || 1);
  const unitPrice = Number(item.unitPrice || item.cost || 0);
  const total = Number(item.total) || qty * unitPrice;
  return {
    ...item,
    id: item.id || newLineItemId(),
    name: item.name || item.description || 'Material',
    description: item.description || item.name || 'Material',
    quantity: qty,
    qty,
    unitPrice,
    cost: Number(item.cost) || unitPrice,
    total,
    unit: item.unit || 'ea',
    section: item.section || 'General Materials',
    isManual: item.isManual ?? true,
  };
}

export function applyDraftToEstimate(
  bid: Record<string, unknown>,
  draft: EstimateAiDraft,
  options: ApplyDraftOptions = {}
): ApplyDraftResult {
  draft = syncSelectedScopePricing(draft);
  if (options.scopeOnly) {
    return applyScopeDraftOnly(bid, draft);
  }

  const applyConfirmedOnly = Boolean(options.applyConfirmedOnly);
  const draftForApply: EstimateAiDraft = {
    ...draft,
    // Never invent National Average splits on apply unless the user opted in.
    applySuggestedSplits: options.applySuggestedSplits ?? Boolean(draft.applySuggestedSplits),
  };

  const projectType = draftForApply.projectType || 'other';
  const category = PROJECT_CATEGORY_SLUGS[projectType] || PROJECT_CATEGORY_SLUGS.other;
  const scopeDescription = buildScopeDescription(draftForApply);
  const laborLineItems = laborLineItemsFromDraft(draftForApply, applyConfirmedOnly);
  const materialLineItems = materialLineItemsFromDraft(draftForApply, applyConfirmedOnly);
  const allowanceLineItems = allowanceLineItemsFromDraft(draftForApply, applyConfirmedOnly);
  const materialsCart = materialLineItems.map(cartItemFromMaterialLine);
  const tradeBudgetRollup = tradeBudgetRollupFromEstimate({
    laborLineItems,
    materialLineItems,
    allowanceLineItems,
  });

  const nextBid: Record<string, unknown> = {
    ...bid,
    _isNewBid: false,
    title: draftForApply.projectTitle?.trim() || bid.title || '',
    projectType,
    projectCategory: category,
    category,
    scopeDescription: scopeDescription || bid.scopeDescription || '',
    laborLineItems,
    materialLineItems,
    allowanceLineItems,
    tradeBudgetRollup,
    aiEstimateOriginalNotes: draftForApply.originalNotes || null,
    aiEstimateDraftSnapshot: {
      savedAt: new Date().toISOString(),
      builderMode: draftForApply.builderMode || 'organize_calculate',
      draft: draftForApply,
    },
  };

  if (draftForApply.customerName?.trim()) {
    nextBid.customerName = draftForApply.customerName.trim();
    nextBid.clientName = draftForApply.customerName.trim();
  }

  return { bid: nextBid, materialsCart };
}

/** Saves scope and project context without applying labor/material pricing. */
export function applyScopeDraftOnly(
  bid: Record<string, unknown>,
  draft: EstimateAiDraft
): ApplyDraftResult {
  const scopeDescription = buildScopeDescription(draft);
  const nextBid: Record<string, unknown> = {
    ...bid,
    _isNewBid: false,
    title: draft.projectTitle?.trim() || bid.title || '',
    projectType: draft.projectType || bid.projectType || 'other',
    scopeDescription: scopeDescription || bid.scopeDescription || '',
    aiEstimateOriginalNotes: draft.originalNotes || null,
    aiEstimateDraftSnapshot: {
      savedAt: new Date().toISOString(),
      builderMode: draft.builderMode || 'organize_only',
      applyMode: 'scope_only',
      draft,
    },
  };

  if (draft.customerName?.trim()) {
    nextBid.customerName = draft.customerName.trim();
    nextBid.clientName = draft.customerName.trim();
  }

  return { bid: nextBid, materialsCart: [] };
}

export type TradeBudgetRollupLine = {
  costCode: string;
  label: string;
  material: number;
  labor: number;
  allowance: number;
  total: number;
};

/**
 * Group applied estimate lines by Confirm Scope cost code for Projects
 * trade budgets (materials + labor + allowances per trade).
 */
export function tradeBudgetRollupFromEstimate(bid: {
  laborLineItems?: Array<Record<string, unknown>> | null;
  materialLineItems?: Array<Record<string, unknown>> | null;
  allowanceLineItems?: Array<Record<string, unknown>> | null;
}): TradeBudgetRollupLine[] {
  const byCode = new Map<string, TradeBudgetRollupLine>();

  const ensure = (rawCode: unknown, label: string): TradeBudgetRollupLine => {
    const costCode = String(rawCode || label || 'uncategorized').trim() || 'uncategorized';
    let row = byCode.get(costCode);
    if (!row) {
      row = { costCode, label, material: 0, labor: 0, allowance: 0, total: 0 };
      byCode.set(costCode, row);
    }
    return row;
  };

  for (const item of bid.materialLineItems || []) {
    const amount = Number(item.total ?? item.cost ?? item.unitPrice ?? 0) || 0;
    if (amount <= 0) continue;
    const label = String(item.section || item.name || 'Materials');
    const row = ensure(item.costCode || item.sourceItemId || item.checklistItemId, label);
    row.material += amount;
    row.total += amount;
  }

  for (const item of bid.laborLineItems || []) {
    const amount = Number(item.total ?? item.totalCost ?? item.rate ?? 0) || 0;
    if (amount <= 0) continue;
    const label = String(item.section || item.name || 'Labor');
    const row = ensure(item.costCode || item.sourceItemId || item.checklistItemId, label);
    row.labor += amount;
    row.total += amount;
  }

  for (const item of bid.allowanceLineItems || []) {
    const amount = Number(item.amount ?? item.total ?? item.totalCost ?? 0) || 0;
    if (amount <= 0) continue;
    const label = String(item.section || item.name || 'Allowance');
    const row = ensure(item.costCode || item.sourceItemId || item.checklistItemId, label);
    row.allowance += amount;
    row.total += amount;
  }

  return Array.from(byCode.values()).sort((a, b) => a.costCode.localeCompare(b.costCode));
}

export function draftHasApprovedSuggestions(draft: EstimateAiDraft | null): boolean {
  if (!draft) return false;
  const approvedSplit = (draft.suggestedSplits || []).some((s) => s.approvedByUser);
  const approvedRoom = (draft.rooms || []).some((r) => r.splitApprovedByUser);
  return approvedSplit || approvedRoom;
}

/** Step 3 inline edits → Confirm Scope itemQuantities for back-navigation restore. */
export function syncConfirmScopeMeasurementsFromPackages(draft: EstimateAiDraft): EstimateAiDraft {
  if (!draft.scopePackages?.length) return draft;

  const itemQuantities = { ...(draft.scopeMeasurements?.itemQuantities || {}) };
  let changed = false;

  for (const pkg of draft.scopePackages) {
    if (pkg.status === 'missing_price') continue;
    if (
      !pkg.priceProvidedByUser &&
      pkg.status !== 'user_provided' &&
      pkg.priceSource !== 'manual' &&
      pkg.priceSource !== 'user_provided'
    ) {
      continue;
    }
    const ruleKey = pkg.checklistItemId || lookupRuleKeyForPackage(pkg.name, pkg.scope || '');
    if (!ruleKey) continue;
    const total = Number(pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0);
    if (!(total > 0)) continue;

    const mat = Number(pkg.materialPrice ?? 0);
    const lab = Number(pkg.laborPrice ?? 0);
    if (mat > 0 || lab > 0) {
      itemQuantities[`${ruleKey}__material`] = {
        quantity: String(Math.round(mat * 100) / 100),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
      itemQuantities[`${ruleKey}__labor`] = {
        quantity: String(Math.round(lab * 100) / 100),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
    } else {
      itemQuantities[`${ruleKey}__allowance`] = {
        quantity: String(Math.round(total * 100) / 100),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
    }
    changed = true;
  }

  if (!changed) return draft;
  return {
    ...draft,
    scopeMeasurements: {
      ...(draft.scopeMeasurements || {}),
      itemQuantities,
    },
  };
}

export function getScopePackages(draft: EstimateAiDraft): EstimateDraftScopePackage[] {
  if (draft.scopePackages?.length) {
    return draft.scopePackages.map((pkg) => applySelectedPricingToScopePackage(pkg, draft));
  }
  return (draft.rooms || []).map((room) => applySelectedPricingToScopePackage({
    name: room.name,
    scope: room.scope,
    scopeQuantities: room.scopeQuantities,
    price: room.price,
    laborPrice: room.laborPrice,
    materialPrice: room.materialPrice,
    pricingType: room.price != null ? 'lump_sum' : 'unknown',
    includesLabor: room.priceIncludesLaborAndMaterials ? true : room.laborPrice != null ? true : null,
    includesMaterials: room.materialPrice != null ? true : room.priceIncludesLaborAndMaterials ? true : null,
    priceSource: room.priceProvidedByUser ? 'user_provided' : 'missing',
    status: (room.packageStatus ||
      (room.price != null
        ? room.splitIsSuggested
          ? 'ai_suggested'
          : room.pricedFromSqftAllowances
            ? 'calculated'
            : room.priceIncludesLaborAndMaterials
              ? 'user_provided'
              : 'confirmed'
        : room.knownSubtotal
          ? 'partial_pricing'
          : 'missing_price')) as DraftItemStatus,
    knownSubtotal: room.knownSubtotal ?? null,
    formula: null,
    missingInfo: [],
    missingPriceItems: room.missingPriceItems || [],
    pricingItems: room.pricingItems || [],
    priceIncludesLaborAndMaterials: room.priceIncludesLaborAndMaterials,
    splitIsSuggested: Boolean(room.splitIsSuggested),
    priceProvidedByUser: Boolean(room.priceProvidedByUser),
    applyEligible: room.applyEligible ?? (room.price != null || (room.knownSubtotal || 0) > 0),
  }, draft));
}
