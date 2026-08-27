import type {
  PlanLowConfidenceField,
  PlanMeasurementConflict,
  PlanUnreadableField,
} from '@/utils/estimateAiDraft';
import { measurementDisplayLabel } from '@/utils/planTakeoffReviewUi';
import { electricalCardForMeasurementKey } from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { PLUMBING_CARDS } from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import { FRAMING_CARDS } from '@/utils/subcontractorTrade/framingPlanConvergence';
import {
  hasDocumentedHvacVentilationCount,
  hvacCardForMeasurementKey,
  HVAC_PLAN_REVIEW_CANONICAL_KEYS,
  HVAC_VENTILATION_MEASUREMENT_KEY,
} from '@/utils/subcontractorTrade/hvacPlanConvergence';
import { WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS } from '@/utils/subcontractorTrade/windowsDoorsPlanConvergence';

export type PlanTakeoffUnit = 'EA' | 'LF' | 'A' | 'sqft' | 'ton';
export type PlanConflictChoice = number | 'manual';

/** Canonical evidence tokens — never shown to the contractor. */
export type PlanEvidenceSource =
  | 'PLAN_TAGS'
  | 'PLAN_TEXT'
  | 'VISION_GENERAL'
  | 'VISION_FOCUSED'
  | 'EXPLICIT_CALLOUT'
  | 'PANEL_SCHEDULE'
  | 'USER_CONFIRMED'
  | 'USER_ENTERED';

export type PlanConflictResolution = {
  value: number;
  provenance: 'USER_CONFIRMED' | 'USER_ENTERED';
  confirmedFrom: PlanEvidenceSource | 'MANUAL';
  candidates: Array<{ value: number; source: string }>;
};

const EVIDENCE_RANK: Record<PlanEvidenceSource, number> = {
  EXPLICIT_CALLOUT: 0,
  PANEL_SCHEDULE: 0,
  PLAN_TAGS: 1,
  PLAN_TEXT: 2,
  VISION_GENERAL: 3,
  VISION_FOCUSED: 3,
  USER_CONFIRMED: 4,
  USER_ENTERED: 4,
};

export function planTakeoffUnit(field: string): PlanTakeoffUnit {
  if (/Amperage$/i.test(field)) return 'A';
  if (/(?:Lf|LinearFeet)$/i.test(field)) return 'LF';
  if (/Tons$/i.test(field)) return 'ton';
  if (/Count$/i.test(field)) return 'EA';
  const hvacCard = hvacCardForMeasurementKey(field);
  if (hvacCard?.unit === 'ton') return 'ton';
  if (hvacCard?.unit === 'lf') return 'LF';
  return 'sqft';
}

export function conflictFieldDisplay(field: string): {
  label: string;
  subtext?: string;
} {
  const electricalCard = electricalCardForMeasurementKey(field);
  if (electricalCard) {
    return { label: electricalCard.label, subtext: electricalCard.helper };
  }
  const plumbingCard = PLUMBING_CARDS.find(
    card => card.measurementKey === field
  );
  if (plumbingCard) {
    return { label: plumbingCard.label, subtext: plumbingCard.helper };
  }
  const framingCard = FRAMING_CARDS.find(card => card.measurementKey === field);
  if (framingCard) {
    return { label: framingCard.label, subtext: framingCard.helper };
  }
  const hvacCard = hvacCardForMeasurementKey(field);
  if (hvacCard) {
    return { label: hvacCard.label, subtext: hvacCard.helper };
  }
  if (field === 'serviceAmperage') {
    return { label: 'Service amperage' };
  }
  const display = measurementDisplayLabel(field, null);
  if (display.label !== field) {
    return display;
  }
  return { label: field };
}

export function conflictFieldLabel(field: string): string {
  return conflictFieldDisplay(field).label;
}

export function formatPlanTakeoffQuantity(
  field: string,
  value: number
): string {
  const unit = planTakeoffUnit(field);
  const n = unit === 'EA' || unit === 'A' ? Math.round(value) : value;
  if (unit === 'A') return `${n}A`;
  if (unit === 'ton') {
    const label = n === 1 ? 'ton' : 'tons';
    return `${n} ${label}`;
  }
  return `${n.toLocaleString()} ${unit}`;
}

/** Copy for takeoff rows with no plan quantity — blank can be the correct answer. */
export function emptyPlanTakeoffReadingDisplay(field: string): {
  statusLine: string;
  chipLabel: string;
  chipSubtitle: string;
} {
  if (field === 'hvacVentilationCount') {
    return {
      statusLine: 'Not found on selected plan pages',
      chipLabel: 'Not found on selected plan pages',
      chipSubtitle: 'Enter quantity only if included in the HVAC bid.',
    };
  }
  const unitHint = formatPlanTakeoffQuantity(field, 1)
    .replace(/^1\s*/, '')
    .replace(/^1/, '');
  return {
    statusLine: 'Needs manual confirmation',
    chipLabel: `Enter ${unitHint}`.trim(),
    chipSubtitle: 'No plan read yet',
  };
}

export function normalizePlanEvidenceSource(
  source?: string | null
): PlanEvidenceSource | null {
  const key = String(source || '').trim();
  if (!key) return null;
  const upper = key.toUpperCase().replace(/-/g, '_');
  if (
    upper === 'PLAN_TAGS' ||
    /pdf_text_instance_tags|instance_tag/i.test(key)
  ) {
    return 'PLAN_TAGS';
  }
  if (upper === 'PLAN_TEXT' || key === 'pdf_text') return 'PLAN_TEXT';
  if (
    upper === 'VISION_GENERAL' ||
    key === 'general_plan_takeoff' ||
    key === 'general_pass'
  ) {
    return 'VISION_GENERAL';
  }
  if (
    upper === 'VISION_FOCUSED' ||
    key === 'focused_trade_takeoff' ||
    key === 'focused_trade'
  ) {
    return 'VISION_FOCUSED';
  }
  if (
    upper === 'PANEL_SCHEDULE' ||
    /panel_schedule|panel schedule/i.test(key)
  ) {
    return 'PANEL_SCHEDULE';
  }
  if (
    upper === 'EXPLICIT_CALLOUT' ||
    /explicit_label|detected_from_plan|labeled_callout/i.test(key)
  ) {
    return 'EXPLICIT_CALLOUT';
  }
  if (upper === 'USER_CONFIRMED' || /user_confirmed/i.test(key)) {
    return 'USER_CONFIRMED';
  }
  if (
    upper === 'USER_ENTERED' ||
    upper === 'MANUAL' ||
    /user_entered|manual/i.test(key)
  ) {
    return 'USER_ENTERED';
  }
  return null;
}

export function planEvidenceSourceLabel(source?: string | null): string | null {
  switch (normalizePlanEvidenceSource(source)) {
    case 'PLAN_TAGS':
      return 'Counted from fixture tags on plan';
    case 'PLAN_TEXT':
      return 'Read from text on plan';
    case 'VISION_GENERAL':
      return 'AI symbol count (first review)';
    case 'VISION_FOCUSED':
      return 'AI symbol count (second review)';
    case 'EXPLICIT_CALLOUT':
      return 'Read from printed callout';
    case 'PANEL_SCHEDULE':
      return 'Panel schedule';
    case 'USER_CONFIRMED':
    case 'USER_ENTERED':
      return 'Manual';
    default:
      return null;
  }
}

/** @deprecated use planEvidenceSourceLabel */
export function conflictCandidateSourceLabel(
  source?: string | null
): string | null {
  return planEvidenceSourceLabel(source);
}

export function planEvidenceRank(source?: string | null): number {
  const token = normalizePlanEvidenceSource(source);
  if (!token) return 9;
  return EVIDENCE_RANK[token];
}

export function conflictEvidenceSubtitle(
  conflict: Pick<PlanMeasurementConflict, 'candidates'>
): string {
  const tokens = new Set(
    (conflict.candidates || [])
      .map(candidate => normalizePlanEvidenceSource(candidate?.source))
      .filter((token): token is PlanEvidenceSource => Boolean(token))
  );
  const hasExplicit =
    tokens.has('EXPLICIT_CALLOUT') || tokens.has('PANEL_SCHEDULE');
  const hasTags = tokens.has('PLAN_TAGS') || tokens.has('PLAN_TEXT');
  const hasVision =
    tokens.has('VISION_GENERAL') || tokens.has('VISION_FOCUSED');
  if (hasExplicit && (hasVision || hasTags)) {
    return 'Plan and AI readings disagree — choose one';
  }
  if (hasTags && hasVision) {
    return 'Plan tag and AI readings disagree — choose one';
  }
  if (hasVision && tokens.size >= 1) {
    return 'Two AI counts disagree — choose one';
  }
  return 'Different plan readings — choose one';
}

export function labeledConflictCandidates(
  conflict: Pick<PlanMeasurementConflict, 'field' | 'candidates'>
): Array<{
  value: number;
  source: string;
  sourceToken: PlanEvidenceSource | null;
  sourceLabel: string | null;
}> {
  const unit = planTakeoffUnit(conflict.field);
  const seen = new Set<number>();
  const out: Array<{
    value: number;
    source: string;
    sourceToken: PlanEvidenceSource | null;
    sourceLabel: string | null;
  }> = [];
  for (const candidate of conflict.candidates || []) {
    const raw = Number(candidate?.value);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const value = unit === 'EA' || unit === 'A' ? Math.round(raw) : raw;
    if (seen.has(value)) continue;
    seen.add(value);
    const source = String(candidate?.source || '');
    const sourceToken = normalizePlanEvidenceSource(source);
    out.push({
      value,
      source,
      sourceToken,
      sourceLabel: planEvidenceSourceLabel(source),
    });
  }
  return out.sort((a, b) => {
    const rankDiff = planEvidenceRank(a.source) - planEvidenceRank(b.source);
    if (rankDiff !== 0) return rankDiff;
    if (
      a.sourceToken === 'VISION_GENERAL' &&
      b.sourceToken === 'VISION_FOCUSED'
    ) {
      return -1;
    }
    if (
      a.sourceToken === 'VISION_FOCUSED' &&
      b.sourceToken === 'VISION_GENERAL'
    ) {
      return 1;
    }
    return b.value - a.value;
  });
}

export function uniqueConflictCandidateValues(
  conflict: Pick<PlanMeasurementConflict, 'field' | 'candidates'>
): number[] {
  return labeledConflictCandidates(conflict).map(candidate => candidate.value);
}

export function formatConflictCandidateChip(
  field: string,
  value: number,
  source?: string | null
): string {
  const quantity = formatPlanTakeoffQuantity(field, value);
  const sourceLabel = planEvidenceSourceLabel(source);
  return sourceLabel ? `${quantity} · ${sourceLabel}` : quantity;
}

function roundConflictValue(field: string, raw: number): number {
  const unit = planTakeoffUnit(field);
  return unit === 'EA' || unit === 'A' ? Math.round(raw) : raw;
}

export function buildConflictResolution(
  conflict: PlanMeasurementConflict,
  choice: PlanConflictChoice,
  manualValue?: string
): PlanConflictResolution | null {
  const candidates = (conflict.candidates || [])
    .map(candidate => ({
      value: Number(candidate?.value),
      source: String(candidate?.source || ''),
    }))
    .filter(
      candidate => Number.isFinite(candidate.value) && candidate.value > 0
    );
  if (choice === 'manual') {
    const n = Number(String(manualValue || '').replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) return null;
    return {
      value: roundConflictValue(conflict.field, n),
      provenance: 'USER_ENTERED',
      confirmedFrom: 'MANUAL',
      candidates,
    };
  }
  if (typeof choice !== 'number' || choice <= 0) return null;
  const value = roundConflictValue(conflict.field, choice);
  const match = candidates.find(
    candidate => roundConflictValue(conflict.field, candidate.value) === value
  );
  return {
    value,
    provenance: 'USER_CONFIRMED',
    confirmedFrom:
      normalizePlanEvidenceSource(match?.source) || 'USER_CONFIRMED',
    candidates,
  };
}

export function conflictResolutionProvenanceEntry(
  resolution: PlanConflictResolution
): Record<string, unknown> {
  return {
    value: resolution.value,
    source:
      resolution.provenance === 'USER_ENTERED'
        ? 'user_entered'
        : 'contractor_confirmed_from_plan_review',
    normalizedSource:
      resolution.provenance === 'USER_ENTERED'
        ? 'USER_ENTERED'
        : 'CONTRACTOR_CONFIRMED_FROM_PLAN_REVIEW',
    evidenceKind: 'user_confirmed',
    confirmedFrom:
      resolution.provenance === 'USER_ENTERED' ? 'MANUAL' : 'PLAN_REVIEW',
    candidates: resolution.candidates,
    note:
      resolution.provenance === 'USER_ENTERED'
        ? 'User entered'
        : 'Contractor confirmed from plan review',
  };
}

export function togglePlanConflictChoice(
  current: PlanConflictChoice | undefined,
  next: PlanConflictChoice,
  options?: { allowClear?: boolean }
): PlanConflictChoice | undefined {
  if (current === next) {
    return options?.allowClear === false ? current : undefined;
  }
  return next;
}

export function availablePlanConflictChoice(
  choice: PlanConflictChoice | undefined,
  candidateValues: Iterable<number>
): PlanConflictChoice | undefined {
  if (choice === 'manual' || choice == null) return choice;
  return new Set(candidateValues).has(choice) ? choice : undefined;
}

/**
 * Keep every Electrical disagreement with two distinct readings.
 * Recover from provenance alternatives when the conflicts array was narrowed.
 */
export function reviewablePlanMeasurementConflicts(input: {
  conflicts?: PlanMeasurementConflict[] | null;
  provenance?: Record<string, unknown> | null;
}): PlanMeasurementConflict[] {
  const byField = new Map<string, PlanMeasurementConflict>();

  for (const conflict of input.conflicts || []) {
    const field = String(conflict?.field || '').trim();
    if (!field || conflict.requiresConfirmation === false) continue;
    if (uniqueConflictCandidateValues(conflict).length < 2) continue;
    byField.set(field, conflict);
  }

  for (const [field, entry] of Object.entries(input.provenance || {})) {
    if (!field || byField.has(field) || !entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as {
      value?: unknown;
      source?: string;
      alternatives?: Array<{ value?: unknown; source?: string } | null> | null;
    };
    const selected = Number(record.value);
    const candidates = [
      ...(Number.isFinite(selected) && selected > 0
        ? [
            {
              value: selected,
              source: String(record.source || ''),
              confidence: 0,
              directEvidence: false,
            },
          ]
        : []),
      ...(record.alternatives || [])
        .map(candidate => ({
          value: Number(candidate?.value),
          source: String(candidate?.source || ''),
          confidence: 0,
          directEvidence: false,
        }))
        .filter(
          candidate => Number.isFinite(candidate.value) && candidate.value > 0
        ),
    ];
    const synthetic: PlanMeasurementConflict = {
      field,
      selectedValue:
        Number.isFinite(selected) && selected > 0
          ? selected
          : candidates[0]?.value || 0,
      selectedSource: String(record.source || ''),
      threshold: 1,
      requiresConfirmation: true,
      candidates,
    };
    if (uniqueConflictCandidateValues(synthetic).length >= 2) {
      byField.set(field, synthetic);
    }
  }

  return [...byField.values()];
}

const PLUMBING_TAKEOFF_LF_CONFLICT_KEYS = [
  'waterLineLf',
  'sewerLineLf',
  'gasLineLf',
] as const;

export function isPlumbingPlanTakeoffConflictField(
  field: string | null | undefined
): boolean {
  return (PLUMBING_TAKEOFF_LF_CONFLICT_KEYS as readonly string[]).includes(
    String(field || '').trim()
  );
}

export function shouldConfirmScopeShowPlanConflict(
  field: string | null | undefined,
  params?: { tradeKey?: string | null; templateKey?: string | null }
): boolean {
  const plumbingFlow =
    params?.tradeKey === 'plumbing' ||
    ['plumbing', 'plumbing_service'].includes(
      String(params?.templateKey || '').toLowerCase()
    );
  return !(plumbingFlow && isPlumbingPlanTakeoffConflictField(field));
}

/** Surface 25 vs 30 LF disagreements on Review Plumbing Takeoff, not Confirm Scope. */
export function applyRepeatedPlumbingImportConflicts<
  T extends {
    measurements?: Record<string, number | string | null | undefined>;
    measurementConflicts?: PlanMeasurementConflict[] | null;
    measurementProvenance?: Record<string, unknown> | null;
  },
>(
  takeoff: T,
  previous: {
    fingerprint: string;
    measurements: Record<string, number | string | null | undefined>;
  } | null,
  fingerprint: string
): T {
  if (!previous || previous.fingerprint !== fingerprint) return takeoff;
  const measurements = { ...(takeoff.measurements || {}) };
  const conflicts = [...(takeoff.measurementConflicts || [])];
  const conflictFields = new Set(
    conflicts.map(conflict => String(conflict.field || ''))
  );
  const provenance = { ...(takeoff.measurementProvenance || {}) };
  let changed = false;

  for (const field of PLUMBING_TAKEOFF_LF_CONFLICT_KEYS) {
    const previousValue = Number(previous.measurements[field]);
    const incomingValue = Number(measurements[field]);
    if (
      !(previousValue > 0) ||
      !(incomingValue > 0) ||
      previousValue === incomingValue
    ) {
      continue;
    }
    if (conflictFields.has(field)) continue;
    const existing =
      provenance[field] && typeof provenance[field] === 'object'
        ? (provenance[field] as Record<string, unknown>)
        : {};
    conflicts.push({
      field,
      selectedValue: incomingValue,
      selectedSource: 'plan_import',
      threshold: 1,
      requiresConfirmation: true,
      candidates: [
        {
          value: previousValue,
          source: 'previous_same_plan_import',
          confidence: 0,
          directEvidence: false,
        },
        {
          value: incomingValue,
          source: String(existing.source || 'plan_import'),
          confidence: 0,
          directEvidence: false,
        },
      ],
    });
    conflictFields.add(field);
    provenance[field] = {
      ...existing,
      value: incomingValue,
      alternatives: [
        ...((Array.isArray(existing.alternatives)
          ? existing.alternatives
          : []) as Array<{
          value?: unknown;
          source?: string;
        }>),
        { value: previousValue, source: 'previous_same_plan_import' },
      ],
    };
    changed = true;
  }

  if (!changed) return takeoff;
  return {
    ...takeoff,
    measurementConflicts: conflicts,
    measurementProvenance: provenance,
  };
}

export function uniqueUnreadablePlanFields(
  fields:
    | Array<{ field?: string | null; reason?: string | null } | null>
    | null
    | undefined
): Array<{ field: string; reason: string }> {
  const seen = new Set<string>();
  const out: Array<{ field: string; reason: string }> = [];
  for (const entry of fields || []) {
    const field = String(entry?.field || '').trim();
    if (!field || seen.has(field)) continue;
    seen.add(field);
    out.push({
      field,
      reason: String(entry?.reason || 'Not legible on the plan').trim(),
    });
  }
  return out;
}

export function planConflictChooserRowsKey(
  conflicts: Array<{
    field?: string | null;
    candidates?: Array<{ value?: unknown } | null> | null;
  }>
): string {
  return conflicts
    .map(conflict => {
      const field = String(conflict?.field || '').trim();
      const values = (conflict?.candidates || [])
        .map(candidate => String(candidate?.value ?? ''))
        .join(',');
      return `${field}:${values}`;
    })
    .join('|');
}

export function retainPlanTakeoffConflicts(
  live: PlanMeasurementConflict[],
  retained: PlanMeasurementConflict[]
): PlanMeasurementConflict[] {
  const byField = new Map<string, PlanMeasurementConflict>();
  for (const row of retained) {
    const field = String(row?.field || '').trim();
    if (field) byField.set(field, row);
  }
  for (const row of live) {
    const field = String(row?.field || '').trim();
    if (field) byField.set(field, row);
  }
  const ordered: PlanMeasurementConflict[] = [];
  const seen = new Set<string>();
  for (const row of retained) {
    const field = String(row?.field || '').trim();
    if (!field || seen.has(field)) continue;
    const current = byField.get(field);
    if (current) {
      ordered.push(current);
      seen.add(field);
    }
  }
  for (const row of live) {
    const field = String(row?.field || '').trim();
    if (!field || seen.has(field)) continue;
    ordered.push(row);
    seen.add(field);
  }
  return ordered;
}

export function conflictChooserConfirmedLine(
  field: string,
  value: number
): string {
  return `Confirmed · ${formatPlanTakeoffQuantity(field, value)}`;
}

export function conflictChooserLowConfidenceAcceptedLine(
  field: string,
  value: number
): string {
  return `AI read — confirm · ${formatPlanTakeoffQuantity(field, value)}`;
}

export function pendingManualConflictFields(
  choices: Record<string, PlanConflictChoice | undefined>,
  manualValues: Record<string, string>,
  committed: Record<string, boolean> = {}
): string[] {
  return Object.entries(choices)
    .filter(([, choice]) => choice === 'manual')
    .map(([field]) => field)
    .filter(field => {
      if (!committed[field]) return true;
      const n = Number(String(manualValues[field] || '').replace(/,/g, ''));
      return !(Number.isFinite(n) && n > 0);
    });
}

export function parseManualConflictValue(
  raw: string | null | undefined
): number | null {
  const n = Number(String(raw || '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function applyPlanConflictChoices(
  conflicts: PlanMeasurementConflict[],
  choices: Record<string, PlanConflictChoice | undefined>,
  manualValues: Record<string, string>
): {
  resolved: Record<string, number>;
  unresolved: PlanMeasurementConflict[];
  resolutions: Record<string, PlanConflictResolution>;
} {
  const resolved: Record<string, number> = {};
  const unresolved: PlanMeasurementConflict[] = [];
  const resolutions: Record<string, PlanConflictResolution> = {};
  for (const conflict of conflicts) {
    const field = String(conflict.field || '').trim();
    if (!field) continue;
    const choice = choices[field];
    const resolution = buildConflictResolution(
      conflict,
      choice as PlanConflictChoice,
      manualValues[field]
    );
    if (resolution) {
      resolved[field] = resolution.value;
      resolutions[field] = resolution;
      continue;
    }
    unresolved.push(conflict);
  }
  return { resolved, unresolved, resolutions };
}

export function conflictedSuggestedItemIds(
  conflicts: Array<{ field?: string | null } | null | undefined>
): Set<string> {
  const ids = new Set<string>();
  for (const conflict of conflicts) {
    const field = String(conflict?.field || '').trim();
    if (!field) continue;
    const itemId = electricalCardForMeasurementKey(field)?.itemId;
    if (itemId) ids.add(itemId);
  }
  return ids;
}

export function planTakeoffConflictFieldSet(
  conflicts: Array<{ field?: string | null } | null | undefined>
): Set<string> {
  return new Set(
    conflicts
      .map(conflict => String(conflict?.field || '').trim())
      .filter(Boolean)
  );
}

export function filterLowConfidenceForReview(
  lowConfidence: PlanLowConfidenceField[],
  excludedFields: Set<string>
): PlanLowConfidenceField[] {
  return (lowConfidence || []).filter(
    reading => !excludedFields.has(String(reading.field || '').trim())
  );
}

export function filterUnreadableForReview(
  unreadable: PlanUnreadableField[],
  excludedFields: Set<string>
): PlanUnreadableField[] {
  return (unreadable || []).filter(
    field => !excludedFields.has(String(field.field || '').trim())
  );
}

export function shortPlanTakeoffHelper(
  text?: string | null
): string | undefined {
  if (!text) return undefined;
  const trimmed = String(text).trim();
  if (!trimmed) return undefined;
  const firstSentence = trimmed.split(/(?<=[.!?])\s+/)[0] || trimmed;
  if (firstSentence.length <= 88) return firstSentence;
  return `${firstSentence.slice(0, 85).trim()}…`;
}

export function lowConfidenceConfirmationProvenance(
  field: string,
  value: number
): {
  value: number;
  status: 'user_confirmed';
  normalizedSource: 'USER_CONFIRMED';
  pricingEligible: true;
  reason: string;
} {
  return {
    value,
    status: 'user_confirmed',
    normalizedSource: 'USER_CONFIRMED',
    pricingEligible: true,
    reason: `Contractor accepted this low-confidence ${conflictFieldLabel(field).toLowerCase()} read during takeoff review.`,
  };
}

export function lowConfidenceNeedsReviewProvenance(
  field: string,
  value: number
): {
  value: number;
  status: 'needs_review';
  normalizedSource: 'NEEDS_REVIEW';
  pricingEligible: false;
  reason: string;
} {
  return {
    value,
    status: 'needs_review',
    normalizedSource: 'NEEDS_REVIEW',
    pricingEligible: false,
    reason:
      'The plan reading confidence is too low; confirm this quantity before pricing.',
  };
}

export type PendingPlanConfirmationRead = {
  field: string;
  value: number;
  label: string;
  subtext?: string;
  alternativeValues?: number[];
};

/** Active quantity for a pending card — measurements win over stale read metadata. */
export function resolvePendingPlanConfirmationDisplayValue(
  measurements: Record<string, unknown> | null | undefined,
  reading: Pick<PendingPlanConfirmationRead, 'field' | 'value'>,
  editedValue?: number | null
): number {
  if (editedValue != null && Number.isFinite(editedValue) && editedValue > 0) {
    return editedValue;
  }
  const fromMeasurement = Number(measurements?.[reading.field]);
  if (Number.isFinite(fromMeasurement) && fromMeasurement > 0) {
    return fromMeasurement;
  }
  return reading.value;
}

export function pendingPlanConfirmationCandidateValues(
  measurements: Record<string, unknown> | null | undefined,
  reading: PendingPlanConfirmationRead
): number[] {
  const activeValue = resolvePendingPlanConfirmationDisplayValue(
    measurements,
    reading
  );
  return [
    reading.value,
    ...(reading.alternativeValues || []),
    activeValue,
  ].filter(
    (value, index, values) =>
      Number.isFinite(value) && value > 0 && values.indexOf(value) === index
  );
}

/** Plan reads the contractor skipped in takeoff review — still need confirmation in QM. */
export function pendingPlanConfirmationReads(
  measurements: Record<string, unknown> | null | undefined,
  allowedFields?: Set<string>,
  includeUnresolvedConflicts = false
): PendingPlanConfirmationRead[] {
  const sources =
    measurements?.quickMeasurementSources &&
    typeof measurements.quickMeasurementSources === 'object'
      ? (measurements.quickMeasurementSources as Record<string, string>)
      : {};
  const provenance =
    measurements?.measurementProvenance &&
    typeof measurements.measurementProvenance === 'object'
      ? (measurements.measurementProvenance as Record<string, unknown>)
      : {};
  const out: PendingPlanConfirmationRead[] = [];
  const seen = new Set<string>();
  const conflicts = includeUnresolvedConflicts
    ? Array.isArray(measurements?.measurementConflicts)
      ? (measurements.measurementConflicts as Array<{
          field?: string | null;
          requiresConfirmation?: boolean;
          selectedValue?: unknown;
          candidates?: Array<{ value?: unknown }>;
        }>)
      : []
    : [];
  const alternativeValuesFor = (field: string, currentValue: number) => {
    const conflict = conflicts.find(
      row =>
        String(row?.field || '').trim() === field &&
        row?.requiresConfirmation !== false
    );
    if (!conflict) return [];
    const values = [
      Number(conflict.selectedValue),
      ...(conflict.candidates || []).map(option => Number(option?.value)),
    ];
    return values.filter(
      (value, index) =>
        Number.isFinite(value) &&
        value > 0 &&
        value !== currentValue &&
        values.indexOf(value) === index
    );
  };
  for (const [field, source] of Object.entries(sources)) {
    if (source !== 'needs_confirmation') continue;
    if (allowedFields?.size && !allowedFields.has(field)) continue;
    if (isPendingPlanReadConfirmed(measurements, field)) continue;
    const value = Number(measurements?.[field]);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (seen.has(field)) continue;
    seen.add(field);
    const { label, subtext } = conflictFieldDisplay(field);
    const alternativeValues = alternativeValuesFor(field, value);
    out.push({
      field,
      value,
      label,
      subtext,
      ...(alternativeValues.length ? { alternativeValues } : {}),
    });
  }
  for (const [field, entry] of Object.entries(provenance)) {
    if (seen.has(field)) continue;
    if (allowedFields?.size && !allowedFields.has(field)) continue;
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as { status?: string; normalizedSource?: string };
    const needsReview =
      String(record.status || '').toLowerCase() === 'needs_review' ||
      String(record.normalizedSource || '').toUpperCase() === 'NEEDS_REVIEW';
    if (!needsReview) continue;
    const value = Number(
      (record as { value?: number }).value ?? measurements?.[field]
    );
    if (!Number.isFinite(value) || value <= 0) continue;
    seen.add(field);
    const { label, subtext } = conflictFieldDisplay(field);
    const alternativeValues = alternativeValuesFor(field, value);
    out.push({
      field,
      value,
      label,
      subtext,
      ...(alternativeValues.length ? { alternativeValues } : {}),
    });
  }
  if (includeUnresolvedConflicts) {
    for (const conflict of conflicts) {
      const field = String(conflict.field || '').trim();
      if (!field || conflict.requiresConfirmation === false) continue;
      if (allowedFields?.size && !allowedFields.has(field)) continue;
      if (seen.has(field) || isPendingPlanReadConfirmed(measurements, field)) {
        continue;
      }
      const candidate =
        Number(conflict.selectedValue) > 0
          ? Number(conflict.selectedValue)
          : Number(
              conflict.candidates?.find(option => Number(option?.value) > 0)
                ?.value
            );
      if (!Number.isFinite(candidate) || candidate <= 0) continue;
      const { label, subtext } = conflictFieldDisplay(field);
      const alternativeValues = [
        candidate,
        ...(conflict.candidates || []).map(option => Number(option?.value)),
      ].filter(
        (option, index, values) =>
          Number.isFinite(option) &&
          option > 0 &&
          values.indexOf(option) === index &&
          option !== candidate
      );
      out.push({
        field,
        value: candidate,
        label,
        subtext,
        ...(alternativeValues.length ? { alternativeValues } : {}),
      });
      seen.add(field);
    }
  }
  return out;
}

/** Opening-count fields already surfaced in Step 2 conflict/pending strips — hide from QM rows. */
export function shouldSuppressPlanReviewQuickMeasurementField(
  field: string | null | undefined,
  measurements: Record<string, unknown> | null | undefined,
  options?: {
    allowedFields?: Set<string>;
    conflicts?: Array<
      Pick<PlanMeasurementConflict, 'field' | 'requiresConfirmation'>
    > | null;
  }
): boolean {
  const key = String(field || '').trim();
  if (!key) return false;
  if (options?.allowedFields?.size && !options.allowedFields.has(key)) {
    return false;
  }
  const conflictRows =
    options?.conflicts ??
    (Array.isArray(measurements?.measurementConflicts)
      ? (measurements?.measurementConflicts as Array<
          Pick<PlanMeasurementConflict, 'field' | 'requiresConfirmation'>
        >)
      : []);
  const unresolved = new Set(
    conflictRows
      .filter(row => row?.requiresConfirmation !== false)
      .map(row => String(row?.field || '').trim())
      .filter(Boolean)
  );
  if (unresolved.has(key)) return true;
  if (isPendingPlanReadConfirmed(measurements, key)) return false;
  return pendingPlanConfirmationReads(
    measurements,
    options?.allowedFields
  ).some(read => read.field === key);
}

export function windowsDoorsPlanReviewFieldSet(): Set<string> {
  return new Set(WINDOWS_DOORS_PLAN_REVIEW_MEASUREMENT_KEYS);
}

function hvacProvenanceNeedsReview(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const record = entry as {
    status?: string;
    normalizedSource?: string;
    pricingEligible?: boolean;
  };
  return (
    String(record.status || '').toLowerCase() === 'needs_review' ||
    String(record.normalizedSource || '').toUpperCase() === 'NEEDS_REVIEW' ||
    record.pricingEligible === false
  );
}

function hvacPendingMeasurementValue(
  measurements: Record<string, unknown> | null | undefined,
  field: string,
  provenanceEntry: unknown
): number | null {
  const direct = Number(measurements?.[field]);
  if (Number.isFinite(direct) && direct > 0) return direct;
  if (!provenanceEntry || typeof provenanceEntry !== 'object') return null;
  const record = provenanceEntry as {
    value?: unknown;
    selectedValue?: unknown;
  };
  const fromProvenance = Number(record.value ?? record.selectedValue);
  return Number.isFinite(fromProvenance) && fromProvenance > 0
    ? fromProvenance
    : null;
}

function hvacPendingReadNeedsStep2Review(
  measurements: Record<string, unknown> | null | undefined,
  field: string,
  provenanceEntry: unknown
): boolean {
  const sources =
    measurements?.quickMeasurementSources &&
    typeof measurements.quickMeasurementSources === 'object'
      ? (measurements.quickMeasurementSources as Record<string, string>)
      : {};
  if (sources[field] === 'needs_confirmation') return true;
  if (!provenanceEntry || typeof provenanceEntry !== 'object') return false;
  const record = provenanceEntry as {
    status?: string;
    normalizedSource?: string;
    pricingEligible?: boolean;
  };
  return (
    String(record.status || '').toLowerCase() === 'needs_review' ||
    String(record.normalizedSource || '').toUpperCase() === 'NEEDS_REVIEW' ||
    record.pricingEligible === false
  );
}

/** HVAC plan reads skipped in takeoff review — surface again at the top of Step 2. */
export function resolveHvacPendingPlanConfirmationReads(
  measurements: Record<string, unknown> | null | undefined
): PendingPlanConfirmationRead[] {
  const provenance =
    measurements?.measurementProvenance &&
    typeof measurements.measurementProvenance === 'object'
      ? (measurements.measurementProvenance as Record<string, unknown>)
      : {};
  const out: PendingPlanConfirmationRead[] = [];
  for (const field of HVAC_PLAN_REVIEW_CANONICAL_KEYS) {
    if (isPendingPlanReadConfirmed(measurements, field)) continue;
    const provenanceEntry = provenance[field];
    const value = resolveHvacPendingMeasurementValue(
      measurements,
      field,
      provenanceEntry
    );
    if (field === HVAC_VENTILATION_MEASUREMENT_KEY && value == null) {
      continue;
    }
    if (
      field === HVAC_VENTILATION_MEASUREMENT_KEY &&
      !hasDocumentedHvacVentilationCount({
        ...(measurements || {}),
        hvacVentilationCount: value ?? 0,
        measurementProvenance: provenance,
      })
    ) {
      continue;
    }
    if (
      value == null &&
      !hvacPendingReadNeedsStep2Review(measurements, field, provenanceEntry)
    ) {
      continue;
    }
    const { label, subtext } = conflictFieldDisplay(field);
    out.push({ field, value: value ?? 0, label, subtext });
  }
  return out;
}

function resolveHvacPendingMeasurementValue(
  measurements: Record<string, unknown> | null | undefined,
  field: string,
  provenanceEntry: unknown
): number | null {
  const direct = hvacPendingMeasurementValue(
    measurements,
    field,
    provenanceEntry
  );
  if (direct != null) return direct;
  const card = hvacCardForMeasurementKey(field);
  if (!card?.itemId) return null;
  const entry = (
    measurements?.itemQuantities as
      | Record<string, { quantity?: unknown } | undefined>
      | undefined
  )?.[card.itemId];
  const quantity = Number(entry?.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

/** Chip highlight: local tap wins; otherwise only a confirmed source. */
export function pendingPlanConfirmationSelectedValue(
  measurements: Record<string, unknown> | null | undefined,
  field: string,
  localSelection?: number | null
): number | null {
  if (localSelection === null) return null;
  if (
    localSelection != null &&
    Number.isFinite(localSelection) &&
    localSelection > 0
  ) {
    return localSelection;
  }
  if (!isPendingPlanReadConfirmed(measurements, field)) return null;
  const current = Number(measurements?.[field]);
  return Number.isFinite(current) && current > 0 ? current : null;
}

export function isPendingPlanReadConfirmed(
  measurements: Record<string, unknown> | null | undefined,
  field: string
): boolean {
  const sources =
    measurements?.quickMeasurementSources &&
    typeof measurements.quickMeasurementSources === 'object'
      ? (measurements.quickMeasurementSources as Record<string, string>)
      : {};
  const source = sources[field];
  if (source === 'needs_confirmation') return false;
  if (source === 'contractor_confirmed_from_plan_review') return true;
  if (source === 'user_entered' || source === 'user_confirmed_suggestion') {
    return true;
  }
  const provenance =
    measurements?.measurementProvenance &&
    typeof measurements.measurementProvenance === 'object'
      ? (measurements.measurementProvenance as Record<string, unknown>)[field]
      : null;
  if (!provenance || typeof provenance !== 'object') return false;
  const record = provenance as { status?: string; normalizedSource?: string };
  const status = String(record.status || '').toLowerCase();
  const normalized = String(record.normalizedSource || '').toUpperCase();
  return status === 'user_confirmed' || normalized === 'USER_CONFIRMED';
}

export function confirmPendingPlanConfirmationRead(
  measurements: Record<string, unknown>,
  field: string,
  value: number
): Record<string, unknown> {
  const provenanceEntry = lowConfidenceConfirmationProvenance(field, value);
  return {
    ...measurements,
    [field]: value,
    quickMeasurementSources: {
      ...((measurements.quickMeasurementSources as Record<string, string>) ||
        {}),
      [field]: 'contractor_confirmed_from_plan_review',
    },
    measurementProvenance: {
      ...((measurements.measurementProvenance as Record<string, unknown>) ||
        {}),
      [field]: {
        ...(((measurements.measurementProvenance as Record<string, unknown>) ||
          {})[field] as Record<string, unknown>),
        ...provenanceEntry,
      },
    },
  };
}

export function unconfirmPendingPlanConfirmationRead(
  measurements: Record<string, unknown>,
  field: string,
  value: number
): Record<string, unknown> {
  const provenanceEntry = lowConfidenceNeedsReviewProvenance(field, value);
  return {
    ...measurements,
    [field]: value,
    quickMeasurementSources: {
      ...((measurements.quickMeasurementSources as Record<string, string>) ||
        {}),
      [field]: 'needs_confirmation',
    },
    measurementProvenance: {
      ...((measurements.measurementProvenance as Record<string, unknown>) ||
        {}),
      [field]: {
        ...(((measurements.measurementProvenance as Record<string, unknown>) ||
          {})[field] as Record<string, unknown>),
        ...provenanceEntry,
      },
    },
  };
}
