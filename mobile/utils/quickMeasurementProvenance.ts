/**
 * Source-aware UI state for Quick Measurement fields in Confirm Scope.
 *
 * A field's numeric value can come from: the uploaded plan (detected), a
 * planning-estimate formula the contractor hasn't accepted yet, job notes,
 * or the contractor typing/accepting a value directly. This module turns
 * that into one of four UI states so the card stops looking like a blanket
 * alert and instead tells the contractor exactly what to trust vs verify.
 */
import type { QuickMeasurementFieldKey, QuickMeasurementRow } from '@/utils/scopeQuickMeasurements';
import { hasQuickMeasurementValue, resolveQuickMeasurementDisplayValue } from '@/utils/scopeQuickMeasurements';
import { getMeasurementRelevance } from '@/utils/getMeasurementRelevance';
import {
  getQuickMeasurementEstimate,
  type QuickMeasurementEstimate,
} from '@/utils/quickMeasurementEstimates';
import { resolveEffectiveWetAreaFinish } from '@/utils/planBathRooms';
import type {
  MeasurementSuggestion,
  PlanFacts,
  PlanMeasurementSourceType,
} from '@/utils/planMeasurementFacts';

/** Tags stored on the draft (ScopeMeasurements.quickMeasurementSources) — persisted, not recomputed each render. */
export type QuickMeasurementSourceTag =
  | PlanMeasurementSourceType
  | 'plan_detected'
  | 'user_confirmed_suggestion';

export type QuickMeasurementSourceMap = Partial<Record<string, QuickMeasurementSourceTag>>;
export type QuickMeasurementOverrideMap = Partial<Record<string, true>>;

export type QuickMeasurementFieldState =
  | 'detected'
  | 'estimate_available'
  | 'needs_confirmation'
  | 'confirmed'
  | 'not_relevant';

export const QUICK_MEASUREMENT_STATE_LABEL: Record<QuickMeasurementFieldState, string | null> = {
  detected: 'Detected from plan',
  estimate_available: 'Estimate available',
  needs_confirmation: 'Needs confirmation',
  confirmed: 'Confirmed',
  not_relevant: null,
};

export type QuickMeasurementStateBadgeColors = { color: string; bg: string; border: string };

/** Badge + border colors per field state. null = no badge (kept clean, matches pre-provenance UX). */
export const QUICK_MEASUREMENT_STATE_COLORS: Record<QuickMeasurementFieldState, QuickMeasurementStateBadgeColors | null> = {
  detected: { color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)', border: 'rgba(96, 165, 250, 0.32)' },
  estimate_available: { color: '#34d399', bg: 'rgba(52, 211, 153, 0.14)', border: 'rgba(52, 211, 153, 0.32)' },
  needs_confirmation: { color: '#d97706', bg: 'rgba(251, 191, 36, 0.14)', border: 'rgba(217, 119, 6, 0.28)' },
  confirmed: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.24)' },
  not_relevant: null,
};

export type QuickMeasurementFieldResult = {
  key: QuickMeasurementFieldKey;
  state: QuickMeasurementFieldState;
  /** Only true for values just accepted via "Use suggestion" — used to decide whether to show a Confirmed badge. */
  showConfirmedBadge: boolean;
  filled: boolean;
  fromNotes: boolean;
  relevant: boolean;
  blockingPrice: boolean;
  estimate: QuickMeasurementEstimate | null;
  sourceLabel: string | null;
};

export function quickMeasurementSourceLabel(
  sourceType: QuickMeasurementSourceTag | null | undefined
): string | null {
  switch (sourceType) {
    case 'plan_detected':
    case 'detected_from_plan':
      return 'From plan';
    case 'measured_from_geometry':
      return 'Measured from plan geometry';
    case 'calculated_from_components':
      return 'Footprint-based estimate';
    case 'estimated_from_formula':
    case 'fallback_multiplier':
      return 'Planning estimate';
    case 'needs_confirmation':
      return 'Needs confirmation';
    case 'user_entered':
    case 'user_confirmed_suggestion':
      return 'Confirmed';
    default:
      return null;
  }
}

/** Badge line under a suggestion value, including paint↔drywall disclosure. */
export function quickMeasurementEstimateBadgeLabel(
  estimate: QuickMeasurementEstimate | null | undefined
): string | null {
  if (!estimate) return null;
  const base = quickMeasurementSourceLabel(estimate.sourceType);
  if (!base) return null;
  if (
    estimate.key === 'wallPaintSqft' ||
    estimate.formulaId === 'interior_paint_from_drywall_surface_estimate'
  ) {
    return `${base} · derived from drywall surfaces`;
  }
  return base;
}

function resolveFieldState(params: {
  filled: boolean;
  fromNotes: boolean;
  sourceTag?: QuickMeasurementSourceTag;
  relevant: boolean;
  hasEstimate: boolean;
}): QuickMeasurementFieldState {
  if (!params.relevant) return 'not_relevant';
  if (params.filled) {
    if (params.fromNotes) return 'confirmed';
    if (
      params.sourceTag === 'plan_detected' ||
      params.sourceTag === 'detected_from_plan' ||
      params.sourceTag === 'measured_from_geometry'
    ) {
      return 'detected';
    }
    return 'confirmed';
  }
  return params.hasEstimate ? 'estimate_available' : 'needs_confirmation';
}

/**
 * Resolve UI state for every Quick Measurement field currently rendered.
 * Pure — same inputs always produce the same output, so both the card
 * header and the Step 2 footer can call this independently and stay in sync.
 */
export function resolveQuickMeasurementFields(params: {
  rows: QuickMeasurementRow[];
  measurements: Partial<Record<QuickMeasurementFieldKey, string | undefined>> & {
    planFacts?: PlanFacts;
    planRooms?: import('@/utils/estimateAiDraft').PlanRoomMeasurement[];
    wetAreaFinish?: import('@/utils/planBathRooms').WetAreaFinishChoice | null;
    bathCount?: number | null;
    prefabBathCount?: number | null;
    tubBathCount?: number | null;
  };
  noteValues?: Partial<Record<QuickMeasurementFieldKey, string>>;
  noteBackedKeys?: Iterable<QuickMeasurementFieldKey>;
  sourceMap?: QuickMeasurementSourceMap;
  userOverrides?: QuickMeasurementOverrideMap;
  includedScopeKeys: Iterable<string>;
  /** When ground_up / addition, show the full Quick measurements field list. */
  templateKey?: string | null;
}): QuickMeasurementFieldResult[] {
  const noteValues = params.noteValues || {};
  const noteBackedKeys = params.noteBackedKeys || [];
  const noteKeySet = new Set(noteBackedKeys);
  const includedScopeKeys = Array.from(params.includedScopeKeys);
  const fields = params.rows.flat();
  const seen = new Set<QuickMeasurementFieldKey>();
  const results: QuickMeasurementFieldResult[] = [];

  for (const field of fields) {
    if (seen.has(field.key)) continue;
    seen.add(field.key);

    const displayValue = resolveQuickMeasurementDisplayValue(field.key, params.measurements, noteValues);
    const filled = hasQuickMeasurementValue(displayValue);
    const typed = String(params.measurements[field.key] ?? '').trim() !== '';
    const fromNotes = !typed && noteKeySet.has(field.key) && Boolean(noteValues[field.key]);
    const sourceTag = params.sourceMap?.[field.key];
    const isUserOverride = Boolean(params.userOverrides?.[field.key]);

    const relevance = getMeasurementRelevance({
      measurementKey: field.key,
      includedScopeKeys,
      noteBackedKeys: noteKeySet,
      templateKey: params.templateKey,
      wetAreaFinish: resolveEffectiveWetAreaFinish({
        bathCount: params.measurements.bathCount,
        prefabBathCount: params.measurements.prefabBathCount,
        tubBathCount: params.measurements.tubBathCount,
        wetAreaFinish: params.measurements.wetAreaFinish,
      }),
    });

    const estimate = !filled && relevance.relevant ? getQuickMeasurementEstimate(field.key, params.measurements) : null;

    const state = resolveFieldState({
      filled,
      fromNotes,
      sourceTag: isUserOverride ? 'user_confirmed_suggestion' : sourceTag,
      relevant: relevance.relevant,
      hasEstimate: Boolean(estimate),
    });

    results.push({
      key: field.key,
      state,
      showConfirmedBadge: filled && !fromNotes && sourceTag === 'user_confirmed_suggestion',
      filled,
      fromNotes,
      relevant: relevance.relevant,
      blockingPrice: relevance.blockingPrice && !filled,
      estimate,
      sourceLabel: estimate
        ? quickMeasurementEstimateBadgeLabel(estimate)
        : quickMeasurementSourceLabel(isUserOverride ? 'user_confirmed_suggestion' : sourceTag),
    });
  }

  return results;
}

export type QuickMeasurementSummary = {
  detected: number;
  estimateAvailable: number;
  needsConfirmation: number;
  confirmed: number;
  relevantTotal: number;
};

export function summarizeQuickMeasurementFieldStates(
  results: QuickMeasurementFieldResult[]
): QuickMeasurementSummary {
  const summary: QuickMeasurementSummary = {
    detected: 0,
    estimateAvailable: 0,
    needsConfirmation: 0,
    confirmed: 0,
    relevantTotal: 0,
  };
  for (const result of results) {
    if (result.state === 'not_relevant') continue;
    summary.relevantTotal += 1;
    if (result.state === 'detected') summary.detected += 1;
    else if (result.state === 'estimate_available') summary.estimateAvailable += 1;
    else if (result.state === 'needs_confirmation') summary.needsConfirmation += 1;
    else if (result.state === 'confirmed') summary.confirmed += 1;
  }
  return summary;
}

export function quickMeasurementSummaryLine(summary: QuickMeasurementSummary): string {
  return `${summary.detected} from plan · ${summary.estimateAvailable} suggestion${summary.estimateAvailable === 1 ? '' : 's'} · ${summary.needsConfirmation} need confirmation`;
}

export type QuickMeasurementUiGroups = {
  fromPlan: QuickMeasurementFieldResult[];
  suggestions: QuickMeasurementFieldResult[];
  needsConfirmation: QuickMeasurementFieldResult[];
  confirmed: QuickMeasurementFieldResult[];
  /** Irrelevant / inactive blanks — belong under "More measurements", not blockers. */
  more: QuickMeasurementFieldResult[];
};

/** Split resolved fields into scan-friendly UI groups (order preserved within each group). */
export function groupQuickMeasurementFields(results: QuickMeasurementFieldResult[]): QuickMeasurementUiGroups {
  const groups: QuickMeasurementUiGroups = {
    fromPlan: [],
    suggestions: [],
    needsConfirmation: [],
    confirmed: [],
    more: [],
  };
  for (const result of results) {
    switch (result.state) {
      case 'detected':
        groups.fromPlan.push(result);
        break;
      case 'estimate_available':
        groups.suggestions.push(result);
        break;
      case 'needs_confirmation':
        groups.needsConfirmation.push(result);
        break;
      case 'confirmed':
        groups.confirmed.push(result);
        break;
      case 'not_relevant':
        groups.more.push(result);
        break;
      default:
        break;
    }
  }
  return groups;
}

export type QuickMeasurementGroupId = keyof QuickMeasurementUiGroups;

/** Bath / shower takeoff fields that belong under Wet area finish, not general Suggestions. */
export const WET_AREA_QUICK_MEASUREMENT_KEYS: readonly QuickMeasurementFieldKey[] = [
  'bathroomFloorSqft',
  'showerWallTileSqft',
  'showerFloorTileSqft',
];

const WET_AREA_KEY_SET = new Set<string>(WET_AREA_QUICK_MEASUREMENT_KEYS);

function isWetAreaQuickMeasurementKey(key: string): boolean {
  return WET_AREA_KEY_SET.has(key);
}

/**
 * Pull bath/shower fields out of the main groups so the UI can render them
 * under Wet area finish (next to bath count + finish chips).
 */
export function splitWetAreaQuickMeasurementFields(groups: QuickMeasurementUiGroups): {
  groups: QuickMeasurementUiGroups;
  wetArea: QuickMeasurementFieldResult[];
} {
  const wetArea: QuickMeasurementFieldResult[] = [];
  const pull = (list: QuickMeasurementFieldResult[]) => {
    const kept: QuickMeasurementFieldResult[] = [];
    for (const result of list) {
      if (isWetAreaQuickMeasurementKey(result.key)) wetArea.push(result);
      else kept.push(result);
    }
    return kept;
  };

  const next: QuickMeasurementUiGroups = {
    fromPlan: pull(groups.fromPlan),
    suggestions: pull(groups.suggestions),
    needsConfirmation: pull(groups.needsConfirmation),
    confirmed: pull(groups.confirmed),
    more: groups.more,
  };

  const order = new Map(WET_AREA_QUICK_MEASUREMENT_KEYS.map((key, index) => [key, index]));
  wetArea.sort(
    (a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99)
  );

  return { groups: next, wetArea };
}

/**
 * Keep a focused field in its home section while typing so the TextInput does not
 * remount into Confirmed / Suggestions mid-edit (which looks like the box vanished).
 */
export function pinQuickMeasurementFieldInGroup(
  groups: QuickMeasurementUiGroups,
  key: QuickMeasurementFieldKey | null | undefined,
  homeGroup: QuickMeasurementGroupId | null | undefined,
  homeIndex: number | null | undefined = null
): QuickMeasurementUiGroups {
  if (!key || !homeGroup) return groups;

  const homeList = groups[homeGroup];
  const currentHomeIndex = homeList.findIndex((result) => result.key === key);
  const onlyInHome =
    currentHomeIndex >= 0 &&
    (Object.keys(groups) as QuickMeasurementGroupId[]).every(
      (id) => id === homeGroup || !groups[id].some((result) => result.key === key)
    );
  if (
    onlyInHome &&
    (homeIndex == null ||
      !Number.isFinite(homeIndex) ||
      currentHomeIndex === homeIndex ||
      // Already at end and caller asked for "append" past current length.
      (homeIndex > homeList.length - 1 && currentHomeIndex === homeList.length - 1))
  ) {
    return groups;
  }

  let found: QuickMeasurementFieldResult | null = null;
  const next: QuickMeasurementUiGroups = {
    fromPlan: [],
    suggestions: [],
    needsConfirmation: [],
    confirmed: [],
    more: [],
  };
  (Object.keys(next) as QuickMeasurementGroupId[]).forEach((id) => {
    for (const result of groups[id]) {
      if (result.key === key) {
        found = result;
        continue;
      }
      next[id].push(result);
    }
  });
  if (!found) return groups;

  const list = [...next[homeGroup]];
  const idx =
    homeIndex != null && Number.isFinite(homeIndex) && homeIndex >= 0 && homeIndex <= list.length
      ? homeIndex
      : list.length;
  list.splice(idx, 0, found);
  next[homeGroup] = list;
  return next;
}

/** Merge newly plan-detected keys into a source map without clobbering an accepted-suggestion tag. */
export function tagPlanDetectedQuickMeasurementKeys(
  existing: QuickMeasurementSourceMap | undefined,
  detectedKeys: string[]
): QuickMeasurementSourceMap {
  const next: QuickMeasurementSourceMap = { ...(existing || {}) };
  for (const key of detectedKeys) {
    if (next[key] === 'user_confirmed_suggestion') continue;
    next[key] = 'detected_from_plan';
  }
  return next;
}

type SuggestionAcceptState = {
  quickMeasurementSources?: QuickMeasurementSourceMap;
  quickMeasurementUserOverrides?: QuickMeasurementOverrideMap;
  quickMeasurementSuggestionMetadata?: Partial<Record<string, MeasurementSuggestion>>;
  [key: string]: unknown;
};

/** Pure acceptance helper shared by individual and reviewed bulk actions. */
export function acceptQuickMeasurementSuggestion<T extends SuggestionAcceptState>(
  input: T,
  suggestion: QuickMeasurementEstimate
): T {
  return {
    ...input,
    [suggestion.key]: String(suggestion.value),
    quickMeasurementSources: {
      ...(input.quickMeasurementSources || {}),
      [suggestion.key]: 'user_confirmed_suggestion',
    },
    quickMeasurementUserOverrides: {
      ...(input.quickMeasurementUserOverrides || {}),
      [suggestion.key]: true,
    },
    quickMeasurementSuggestionMetadata: {
      ...(input.quickMeasurementSuggestionMetadata || {}),
      [suggestion.key]: { ...suggestion },
    },
  };
}

const REVIEW_REQUIRED_KEYS = new Set<QuickMeasurementFieldKey>([
  'roofSquares',
  'concreteCy',
  'excavationCy',
]);

export function quickMeasurementSuggestionRequiresReview(
  suggestion: QuickMeasurementEstimate
): boolean {
  return (
    REVIEW_REQUIRED_KEYS.has(suggestion.key) ||
    suggestion.sourceType === 'fallback_multiplier' ||
    suggestion.confidence === 'low'
  );
}

export function acceptReviewedQuickMeasurementSuggestions<T extends SuggestionAcceptState>(
  input: T,
  suggestions: QuickMeasurementEstimate[],
  reviewConfirmed: boolean
): T {
  return suggestions.reduce(
    (next, suggestion) =>
      quickMeasurementSuggestionRequiresReview(suggestion) && !reviewConfirmed
        ? next
        : acceptQuickMeasurementSuggestion(next, suggestion),
    input
  );
}
