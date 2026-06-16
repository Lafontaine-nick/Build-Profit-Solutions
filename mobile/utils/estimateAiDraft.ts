import { postAiAssistantJson } from '@/utils/resolveAiBackendUrl';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { resolveScopePackageBudgetBreakdown } from '@/utils/scopeBudgetBreakdown';

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
  quantitySource?: 'notes' | 'user_entered' | 'inferred' | 'default_assumption' | 'missing' | 'not_applicable';
  /** Cabinets allowance in notes also covered countertops on the same line. */
  includesCountertops?: boolean;
};

export type ScopeMeasurements = {
  /** Bathroom floor sqft — used for floor tile, demo, etc. */
  bathroomFloorSqft?: number | null;
  kitchenFloorSqft?: number | null;
  /** Flooring / multi-area floor jobs (tile demo, laminate install, etc.) */
  floorAreaSqft?: number | null;
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
  /** Per-checklist-item overrides keyed by checklist id */
  itemQuantities?: Record<string, ScopeItemQuantity>;
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

export type ClarifyDraftResult = {
  questions: string[];
  needsReviewCount: number;
  missingInfoCount: number;
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

  return payload.draft;
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

export function isComplexEstimateTier(draft: EstimateAiDraft | null | undefined): boolean {
  return Boolean(draft?.estimateTier && draft.estimateTier !== 'simple_unit');
}

export function aiFlowStepTotal(draft: EstimateAiDraft | null | undefined): 2 | 3 {
  return isComplexEstimateTier(draft) ? 3 : 2;
}

export async function applyScopeAssumptionsToDraft(
  draft: EstimateAiDraft,
  confirmedItems: ScopeChecklistItem[],
  scopeMeasurements?: ScopeMeasurements | null
): Promise<EstimateAiDraft> {
  const payload = await postAiAssistantJson<{ draft?: EstimateAiDraft; error?: string; message?: string }>(
    '/estimate-draft-apply-scope-assumptions',
    { draft, confirmedItems, scopeMeasurements: scopeMeasurements ?? undefined },
    60000
  );

  if (!payload?.draft) {
    throw new Error(payload?.message || payload?.error || 'Failed to apply scope assumptions');
  }

  return payload.draft;
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

export function roomIsApplyEligible(
  room: EstimateDraftRoom,
  draft: EstimateAiDraft,
  applyConfirmedOnly = false
): boolean {
  const pkg = getScopePackageForRoom(draft, room.name);
  if (pkg?.status === 'missing_price') return false;
  if (applyConfirmedOnly && (pkg?.status === 'ai_suggested' || pkg?.status === 'rough_price')) {
    return false;
  }
  if (pkg?.applyEligible) return true;
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

  if (draft.rooms.length > 0) {
    const roomBlocks = draft.rooms.map((room) => {
      const header = room.name.trim();
      const body = room.scope.trim();
      return body ? `${header}\n${body}` : header;
    });
    parts.push(roomBlocks.join('\n\n'));
  }

  if (draft.allowances.length > 0) {
    const allowanceLines = draft.allowances.map((allowance) => {
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

  if (draft.inclusions.length > 0) {
    parts.push(['Inclusions', ...draft.inclusions.map((line) => `• ${line}`)].join('\n'));
  }

  if (draft.exclusions.length > 0) {
    parts.push(['Exclusions', ...draft.exclusions.map((line) => `• ${line}`)].join('\n'));
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
  if (pkg?.status === 'partial_pricing' && (pkg.knownSubtotal || 0) > 0) {
    const materialFromItems = (pkg.pricingItems || [])
      .filter((i) => i.pricingType === 'material' && i.amount != null)
      .reduce((s, i) => s + (i.amount || 0), 0);
    return Math.max(0, (pkg.knownSubtotal || 0) - materialFromItems);
  }
  const total = laborPortion(resolved);
  return total > 0 ? total : null;
}

function packageIsApplyEligible(pkg: EstimateDraftScopePackage, applyConfirmedOnly: boolean): boolean {
  if (pkg.status === 'missing_price') return false;
  if (applyConfirmedOnly && (pkg.status === 'ai_suggested' || pkg.status === 'rough_price')) {
    return false;
  }
  if (pkg.applyEligible) return true;
  const amount = pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0;
  return amount > 0;
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
  return type === 'material' ? 'Material from notes' : 'Labor from notes';
}

function laborLineItemsFromDraft(
  draft: EstimateAiDraft,
  applyConfirmedOnly: boolean
): Record<string, unknown>[] {
  const lines: Record<string, unknown>[] = [];

  if (draft.scopePackages?.length) {
    for (const pkg of draft.scopePackages) {
      if (!packageIsApplyEligible(pkg, applyConfirmedOnly)) continue;

      const parsedSplit = parsedNoteSplitForPackage(pkg, draft);
      const total =
        parsedSplit?.labor ??
        (pkg.laborPrice != null
          ? pkg.laborPrice
          : pkg.priceIncludesLaborAndMaterials || (pkg.includesLabor && pkg.includesMaterials)
            ? pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0
            : pkg.price ?? pkg.knownSubtotal ?? pkg.calculatedSubtotal ?? 0);
      if (total == null || total <= 0) continue;

      const isCombinedOnly = !parsedSplit && (pkg.priceIncludesLaborAndMaterials || (pkg.includesLabor && pkg.includesMaterials));
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

  if (draft.scopePackages?.length) {
    for (const pkg of draft.scopePackages) {
      if (!packageIsApplyEligible(pkg, applyConfirmedOnly)) continue;

      const parsedSplit = parsedNoteSplitForPackage(pkg, draft);
      if (!parsedSplit && pkg.pricingItems?.length) {
        for (const item of pkg.pricingItems) {
          if (item.pricingType !== 'material' || item.amount == null || item.amount <= 0) continue;
          if (applyConfirmedOnly && item.status === 'ai_suggested' && !item.approvedByUser) continue;
          lines.push({
            id: newLineItemId(),
            name: `${pkg.name} — ${item.name}`,
            description: item.description || `From notes (${item.status || 'confirmed'})`,
            quantity: 1,
            qty: 1,
            unit: 'lot',
            unitPrice: item.amount,
            cost: item.amount,
            total: item.amount,
            section: pkg.name,
            source: 'ai-draft',
            isManual: true,
          });
        }
      }

      const splitMaterial = parsedSplit ? parsedSplit.material : Number(pkg.materialPrice ?? 0);
      const splitIsSuggested = parsedSplit?.splitIsSuggested ?? Boolean(pkg.splitIsSuggested);
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
          isManual: true,
          displaySubtitle: budgetSplitDisplaySubtitle(parsedSplit, 'material'),
        });
      }
    }
    return lines;
  }

  for (const room of draft.rooms) {
    if (!roomIsApplyEligible(room, draft, applyConfirmedOnly)) continue;

    const pkg = getScopePackageForRoom(draft, room.name);
    const resolved = resolveRoomForApply(room, draft);
    const parsedSplit = parsedNoteSplitForPackage(pkg, draft);

    if (!parsedSplit && pkg?.pricingItems?.length) {
      for (const item of pkg.pricingItems) {
        if (item.pricingType !== 'material' || item.amount == null || item.amount <= 0) continue;
        if (applyConfirmedOnly && item.status === 'ai_suggested' && !item.approvedByUser) continue;
        lines.push({
          id: newLineItemId(),
          name: `${room.name} — ${item.name}`,
          description: item.description || `From notes (${item.status || 'confirmed'})`,
          quantity: 1,
          qty: 1,
          unit: 'lot',
          unitPrice: item.amount,
          cost: item.amount,
          total: item.amount,
          section: room.name,
          source: 'ai-draft',
          isManual: true,
          displaySubtitle: budgetSplitDisplaySubtitle(parsedSplit, 'material'),
        });
      }
    }

    const splitMaterial = parsedSplit ? parsedSplit.material : materialPortion(resolved);
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
        isManual: true,
      });
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
  if (options.scopeOnly) {
    return applyScopeDraftOnly(bid, draft);
  }

  const applyConfirmedOnly = Boolean(options.applyConfirmedOnly);
  const draftForApply: EstimateAiDraft = {
    ...draft,
    applySuggestedSplits: applyConfirmedOnly
      ? true
      : options.applySuggestedSplits ?? Boolean(draft.applySuggestedSplits),
  };

  const projectType = draftForApply.projectType || 'other';
  const category = PROJECT_CATEGORY_SLUGS[projectType] || PROJECT_CATEGORY_SLUGS.other;
  const scopeDescription = buildScopeDescription(draftForApply);
  const laborLineItems = laborLineItemsFromDraft(draftForApply, applyConfirmedOnly);
  const materialLineItems = materialLineItemsFromDraft(draftForApply, applyConfirmedOnly);
  const materialsCart = materialLineItems.map(cartItemFromMaterialLine);

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

export function draftHasApprovedSuggestions(draft: EstimateAiDraft | null): boolean {
  if (!draft) return false;
  const approvedSplit = (draft.suggestedSplits || []).some((s) => s.approvedByUser);
  const approvedRoom = (draft.rooms || []).some((r) => r.splitApprovedByUser);
  return approvedSplit || approvedRoom;
}

export function getScopePackages(draft: EstimateAiDraft): EstimateDraftScopePackage[] {
  if (draft.scopePackages?.length) return draft.scopePackages;
  return draft.rooms.map((room) => ({
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
  }));
}
