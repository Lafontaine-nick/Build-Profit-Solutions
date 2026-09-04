import type { AiInsight, AiNextStep } from '@/types/aiDashboard';
import {
  bucketForNextStep,
  compactActionStepTitle,
  compactInsightBody,
  filterInsightsActionStepsAfterHero,
  formatHeroImpactPhrase,
  frameInsightForDisplay,
  heroKickerForLeakType,
  nextStepMatchesDailyRisk,
  pickOverviewInsightPreview,
  resolveInsightImpactDollars,
  summarizeProjectLineOverruns,
} from '@/utils/aiInsightsUi';

describe('aiInsightsUi refinements', () => {
  const lineInsight: AiInsight = {
    id: 'line-1',
    type: 'alert',
    title: 'Walls over estimate',
    body: 'Logged $1,600 against $1,306 estimated.',
    projectId: 'p1',
    impactScore: 6,
    impactDollars: 293.5,
    leakType: 'line_over_estimate',
    evidence: ['Over by $293.50'],
  };

  it('uses real impact dollars instead of score multiples', () => {
    expect(resolveInsightImpactDollars(lineInsight)).toBe(293.5);
    expect(formatHeroImpactPhrase('line_over_estimate', 293.5)).toBe(
      ' · ~$294 over estimate'
    );
  });

  it('prefers category + line mix in overview preview', () => {
    const insights: AiInsight[] = [
      { ...lineInsight, id: 'line-1', leakType: 'line_over_estimate' },
      {
        ...lineInsight,
        id: 'line-2',
        title: 'Prep over estimate',
        leakType: 'line_over_estimate',
      },
      {
        ...lineInsight,
        id: 'cat-1',
        title: 'Materials over budget',
        leakType: 'category_over_budget',
      },
    ];

    const preview = pickOverviewInsightPreview(insights, 2);
    expect(preview).toHaveLength(2);
    expect(preview.some((i) => i.leakType === 'category_over_budget')).toBe(true);
    expect(preview.some((i) => i.leakType === 'line_over_estimate')).toBe(true);
  });

  it('frames completed-project insights for closeout review', () => {
    const framed = frameInsightForDisplay(lineInsight, true);
    expect(framed.body).toMatch(/closeout/i);
    expect(heroKickerForLeakType('line_over_estimate', { projectCompleted: true })).toBe(
      'Closeout review'
    );
  });

  it('summarizes multi-line project overruns for hero copy', () => {
    const insights: AiInsight[] = [
      {
        ...lineInsight,
        id: 'line-walls',
        impactDollars: 294,
        actionTarget: { kind: 'rate_insights', lineId: 'walls', section: 'materials' },
      },
      {
        ...lineInsight,
        id: 'line-prep',
        title: 'Prep over estimate',
        impactDollars: 10,
        actionTarget: { kind: 'rate_insights', lineId: 'prep', section: 'materials' },
      },
    ];
    const summary = summarizeProjectLineOverruns(insights, 'p1');
    expect(summary.lineCount).toBe(2);
    expect(summary.totalOver).toBe(304);
    expect(formatHeroImpactPhrase('line_over_estimate', summary.totalOver)).toBe(
      ' · ~$304 over estimate'
    );
  });

  it('uses compact action titles and detects duplicate hero/actions', () => {
    const step: AiNextStep = {
      id: 'step-1',
      label: 'Walls — materials',
      chip: 'Closeout review',
      projectId: 'p1',
      priority: 'medium',
      leakType: 'line_over_estimate',
      actionTarget: { kind: 'rate_insights', lineId: 'walls', section: 'materials' },
    };
    expect(compactActionStepTitle(step)).toBe('Walls — materials');
    expect(
      nextStepMatchesDailyRisk(step, {
        projectId: 'p1',
        type: 'line_over_estimate',
        headline: 'Walls — materials over estimate on Interior House Repaint',
      })
    ).toBe(true);
  });

  it('shortens overview insight bodies', () => {
    const compact = compactInsightBody({
      ...lineInsight,
      body: 'Walls — materials: $1,600.00 logged vs $1,306.50 est (+22.46%).',
    });
    expect(compact).toContain('logged vs');
    expect(compact).toContain('rate insights');
  });

  it('keeps per-line actions when hero aggregates multiple line overruns', () => {
    const steps = [
      {
        id: 'walls',
        label: 'Walls — materials',
        projectId: 'p1',
        leakType: 'line_over_estimate',
        priority: 'high',
      },
      {
        id: 'prep',
        label: 'Prep & Masking — materials',
        projectId: 'p1',
        leakType: 'line_over_estimate',
        priority: 'medium',
      },
      {
        id: 'other',
        label: 'Review labor on Other Job',
        projectId: 'p2',
        leakType: 'line_over_estimate',
        priority: 'low',
      },
    ] as const;

    const filtered = filterInsightsActionStepsAfterHero(
      [...steps],
      { projectId: 'p1', type: 'line_over_estimate', headline: '2 lines over' },
      true,
      'p1'
    );

    expect(filtered).toHaveLength(3);
    expect(filtered.map((s) => s.id)).toEqual(['walls', 'prep', 'other']);
  });

  it('buckets small budget overruns as today, not quick win', () => {
    expect(
      bucketForNextStep({
        id: 'prep',
        label: 'Prep & Masking — materials',
        chip: 'Rate insight',
        projectId: 'p1',
        priority: 'low',
        leakType: 'line_over_estimate',
      })
    ).toBe('today');
  });
});
