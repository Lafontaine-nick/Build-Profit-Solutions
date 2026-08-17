import type { PlanMeasurementConflict } from '@/utils/estimateAiDraft';
import { electricalCardForMeasurementKey } from '@/utils/subcontractorTrade/electricalPlanConvergence';

export type PlanTakeoffUnit = 'EA' | 'LF' | 'A' | 'sqft';
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
  if (/Count$/i.test(field)) return 'EA';
  return 'sqft';
}

export function conflictFieldLabel(field: string): string {
  return (
    electricalCardForMeasurementKey(field)?.label ||
    (field === 'serviceAmperage' ? 'Service amperage' : field)
  );
}

export function formatPlanTakeoffQuantity(
  field: string,
  value: number
): string {
  const unit = planTakeoffUnit(field);
  const n = unit === 'EA' || unit === 'A' ? Math.round(value) : value;
  if (unit === 'A') return `${n}A`;
  return `${n.toLocaleString()} ${unit}`;
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
