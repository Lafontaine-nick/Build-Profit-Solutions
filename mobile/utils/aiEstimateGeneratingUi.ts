export type AiGeneratePhaseId =
  | 'reading_notes'
  | 'analyzing_photos'
  | 'applying_plan'
  | 'building_scope'
  | 'finalizing';

export const AI_GENERATE_PHASE_LABELS: Record<AiGeneratePhaseId, string> = {
  reading_notes: 'Reading notes…',
  analyzing_photos: 'Analyzing site photos…',
  applying_plan: 'Applying plan measurements…',
  building_scope: 'Building scope…',
  finalizing: 'Almost ready…',
};

export function buildAiGenerateSteps(options: {
  hasPhotos?: boolean;
  hasPlanImport?: boolean;
}): AiGeneratePhaseId[] {
  const steps: AiGeneratePhaseId[] = ['reading_notes', 'building_scope'];
  if (options.hasPhotos) steps.push('analyzing_photos');
  if (options.hasPlanImport) steps.push('applying_plan');
  steps.push('finalizing');
  return steps;
}

export function aiGeneratePhaseLabel(phase: AiGeneratePhaseId | null | undefined): string {
  if (!phase) return AI_GENERATE_PHASE_LABELS.building_scope;
  return AI_GENERATE_PHASE_LABELS[phase] ?? AI_GENERATE_PHASE_LABELS.building_scope;
}

export function aiGeneratePhaseIndex(
  steps: AiGeneratePhaseId[],
  phase: AiGeneratePhaseId | null | undefined
): number {
  if (!phase || !steps.length) return 0;
  const idx = steps.indexOf(phase);
  return idx >= 0 ? idx : 0;
}
