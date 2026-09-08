export type AiGeneratePhaseId =
  | 'reading_notes'
  | 'reading_plan'
  | 'analyzing_photos'
  | 'applying_plan'
  | 'building_scope'
  | 'finalizing';

export const AI_GENERATE_PHASE_LABELS: Record<AiGeneratePhaseId, string> = {
  reading_notes: 'Reading notes…',
  reading_plan: 'Reading plan…',
  analyzing_photos: 'Analyzing site photos…',
  applying_plan: 'Applying plan measurements…',
  building_scope: 'Building scope…',
  finalizing: 'Almost ready…',
};

/** Step 1 plan takeoff — same overlay card as Generate. */
export function buildPlanImportSteps(): AiGeneratePhaseId[] {
  return ['reading_plan', 'building_scope', 'finalizing'];
}

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

/** Minimum time each local bootstrap phase stays visible (standalone trade paths). */
export const AI_LOCAL_GENERATE_PHASE_MIN_DWELL_MS = 420;

export function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Let React paint the generating overlay before synchronous draft work. */
export async function yieldGeneratingOverlayPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Walk generate phases with a minimum dwell so fast local bootstraps
 * (e.g. standalone plumbing) still show the Building your draft card.
 */
export async function runPhasedLocalDraftBootstrap(options: {
  steps: AiGeneratePhaseId[];
  advance: (phase: AiGeneratePhaseId) => void;
  onPhase?: (phase: AiGeneratePhaseId) => void | Promise<void>;
  minDwellMs?: number;
  paintFirst?: boolean;
  shouldContinue?: () => boolean;
}): Promise<void> {
  const dwell = options.minDwellMs ?? AI_LOCAL_GENERATE_PHASE_MIN_DWELL_MS;
  if (options.paintFirst !== false) {
    await yieldGeneratingOverlayPaint();
  }
  for (const phase of options.steps) {
    if (options.shouldContinue && !options.shouldContinue()) return;
    options.advance(phase);
    await options.onPhase?.(phase);
    if (options.shouldContinue && !options.shouldContinue()) return;
    await delayMs(dwell);
  }
}
