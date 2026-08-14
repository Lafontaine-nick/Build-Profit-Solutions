export type PlanProvenanceStatus =
  | 'plan_verified'
  | 'from_plan_symbols'
  | 'ai_inferred'
  | 'calculated'
  | 'planning_estimate'
  | 'user_confirmed'
  | 'needs_review';

export type PlanProvenanceConfidence = 'high' | 'medium' | 'low';

export type PlanMeasurementProvenance = {
  status: PlanProvenanceStatus;
  label: string;
  confidence: PlanProvenanceConfidence;
  reason: string;
};

export function planProvenanceLabel(status: PlanProvenanceStatus): string {
  switch (status) {
    case 'plan_verified':
      return 'Plan verified';
    case 'from_plan_symbols':
      return 'From plan — confirm';
    case 'ai_inferred':
      return 'AI inferred — confirm';
    case 'calculated':
      return 'Calculated';
    case 'planning_estimate':
      return 'Planning estimate';
    case 'user_confirmed':
      return 'User confirmed';
    case 'needs_review':
      return 'Needs review';
  }
}

export function planProvenanceColor(
  status: PlanProvenanceStatus,
  colors: { text: string; sub: string }
): string {
  switch (status) {
    case 'plan_verified':
      return '#22c55e';
    case 'from_plan_symbols':
      return '#60a5fa';
    case 'ai_inferred':
      return '#fbbf24';
    case 'calculated':
      return '#60a5fa';
    case 'needs_review':
      return '#fbbf24';
    case 'user_confirmed':
      return '#a78bfa';
    default:
      return colors.sub;
  }
}

export function resolvePlanMeasurementProvenance(input: {
  key: string;
  fieldConfidence?: number | null;
  hasExplicitPlanSource?: boolean;
  hasReliableDimensions?: boolean;
  roomDependent?: boolean;
  fromPlanSymbols?: boolean;
  aiInferred?: boolean;
  reconciliationVariancePercent?: number | null;
  userConfirmed?: boolean;
}): PlanMeasurementProvenance {
  if (input.userConfirmed) {
    return {
      status: 'user_confirmed',
      label: planProvenanceLabel('user_confirmed'),
      confidence: 'high',
      reason: 'Accepted or entered by the contractor.',
    };
  }

  const variance = Math.abs(Number(input.reconciliationVariancePercent) || 0);
  if (input.roomDependent && variance > 30) {
    return {
      status: 'needs_review',
      label: planProvenanceLabel('needs_review'),
      confidence: 'low',
      reason: 'Room detection is incomplete and the area does not reconcile.',
    };
  }

  if (input.fieldConfidence != null && input.fieldConfidence < 0.45) {
    return {
      status: 'needs_review',
      label: planProvenanceLabel('needs_review'),
      confidence: 'low',
      reason: 'The plan extraction confidence is low.',
    };
  }

  if (input.aiInferred) {
    return {
      status: 'ai_inferred',
      label: planProvenanceLabel('ai_inferred'),
      confidence: 'low',
      reason: 'Contextual inference from the plan — confirm before pricing.',
    };
  }

  if (input.hasExplicitPlanSource) {
    return {
      status: 'plan_verified',
      label: planProvenanceLabel('plan_verified'),
      confidence:
        input.fieldConfidence != null && input.fieldConfidence < 0.85
          ? 'medium'
          : 'high',
      reason: 'Explicitly stated on the plan.',
    };
  }

  if (input.fromPlanSymbols) {
    return {
      status: 'from_plan_symbols',
      label: planProvenanceLabel('from_plan_symbols'),
      confidence: 'medium',
      reason: 'Counted from plan symbols without an explicit printed quantity.',
    };
  }

  if (input.hasReliableDimensions) {
    return {
      status: 'calculated',
      label: planProvenanceLabel('calculated'),
      confidence:
        input.fieldConfidence != null && input.fieldConfidence < 0.85
          ? 'medium'
          : 'high',
      reason: 'Calculated from reliable plan dimensions.',
    };
  }

  return {
    status: 'planning_estimate',
    label: planProvenanceLabel('planning_estimate'),
    confidence: 'medium',
    reason:
      'Based on a planning assumption or benchmark rather than complete geometry.',
  };
}
