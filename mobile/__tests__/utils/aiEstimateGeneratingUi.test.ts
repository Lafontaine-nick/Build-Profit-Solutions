import {
  AI_GENERATE_PHASE_LABELS,
  buildAiGenerateSteps,
  aiGeneratePhaseIndex,
  aiGeneratePhaseLabel,
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

  it('resolves phase labels and indexes', () => {
    const steps = buildAiGenerateSteps({ hasPhotos: true });
    expect(aiGeneratePhaseLabel('building_scope')).toBe(
      AI_GENERATE_PHASE_LABELS.building_scope
    );
    expect(aiGeneratePhaseIndex(steps, 'analyzing_photos')).toBe(2);
  });
});
