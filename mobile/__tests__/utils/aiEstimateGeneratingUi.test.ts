import {
  AI_GENERATE_PHASE_LABELS,
  buildAiGenerateSteps,
  buildPlanImportSteps,
  aiGeneratePhaseIndex,
  aiGeneratePhaseLabel,
  runPhasedLocalDraftBootstrap,
  yieldGeneratingOverlayPaint,
} from '@/utils/aiEstimateGeneratingUi';

describe('aiEstimateGeneratingUi', () => {
  it('builds minimal steps for notes-only generate', () => {
    expect(buildAiGenerateSteps({})).toEqual([
      'reading_notes',
      'building_scope',
      'finalizing',
    ]);
  });

  it('includes photo and plan steps when provided', () => {
    expect(
      buildAiGenerateSteps({ hasPhotos: true, hasPlanImport: true })
    ).toEqual([
      'reading_notes',
      'building_scope',
      'analyzing_photos',
      'applying_plan',
      'finalizing',
    ]);
  });

  it('builds plan import takeoff steps', () => {
    expect(buildPlanImportSteps()).toEqual([
      'reading_plan',
      'building_scope',
      'finalizing',
    ]);
    expect(aiGeneratePhaseLabel('reading_plan')).toBe('Reading plan…');
  });

  it('resolves phase labels and indexes', () => {
    const steps = buildAiGenerateSteps({ hasPhotos: true });
    expect(aiGeneratePhaseLabel('building_scope')).toBe(
      AI_GENERATE_PHASE_LABELS.building_scope
    );
    expect(aiGeneratePhaseIndex(steps, 'analyzing_photos')).toBe(2);
  });

  it('runs phased local bootstrap with dwell between steps', async () => {
    const phases: string[] = [];
    const started = Date.now();
    await runPhasedLocalDraftBootstrap({
      steps: ['reading_notes', 'building_scope', 'finalizing'],
      advance: (phase) => phases.push(phase),
      paintFirst: false,
      minDwellMs: 30,
    });
    expect(phases).toEqual(['reading_notes', 'building_scope', 'finalizing']);
    expect(Date.now() - started).toBeGreaterThanOrEqual(80);
  });

  it('stops phased bootstrap when shouldContinue returns false', async () => {
    const phases: string[] = [];
    let alive = true;
    await runPhasedLocalDraftBootstrap({
      steps: ['reading_notes', 'building_scope', 'finalizing'],
      advance: (phase) => {
        phases.push(phase);
        if (phase === 'building_scope') alive = false;
      },
      paintFirst: false,
      minDwellMs: 10,
      shouldContinue: () => alive,
    });
    expect(phases).toEqual(['reading_notes', 'building_scope']);
  });
});
