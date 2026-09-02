import {
  formatCategoriesLinkedLabel,
  formatCategoriesLinkedSublabel,
  formatCostBudgetVsBidNote,
  formatEstimateVarianceDisplay,
  formatSpendDollarsLine,
  formatSpendProgress,
  formatVarianceDollarsLine,
  getEstimateVsActualCardMessage,
  getLinkedCategoryLabels,
  resolveEstimateTipCount,
  resolveUnlinkedCategoryLabel,
  shouldShowEstimateVsActualCard,
  shouldShowReviewRateTipsCta,
  shouldShowTipsRow,
  shouldShowVarianceRow,
} from '@/utils/estimateVsActualCard';
import type { EstimateFeedbackResult } from '@/utils/estimateFeedback';

function feedback(overrides: Partial<EstimateFeedbackResult> = {}): EstimateFeedbackResult {
  return {
    algorithmVersion: 'v1',
    estimateId: 'est-1',
    projectId: 'proj-1',
    status: 'partial',
    confidence: 'medium',
    projectSummary: {
      mappedActualCoveragePercent: 22,
      directCostVariancePercent: null,
      varianceIsReliable: false,
      mappedDirectCostEstimated: 6006,
      mappedDirectCostActual: 1000,
      estimatedDirectCost: 26952.83,
    },
    scopeComparisons: [],
    unresolvedMappings: [],
    rateSuggestions: [],
    assumptionSuggestions: [],
    assumptionFindings: [],
    formulaFindings: [],
    benchmarkFindings: [],
    formulaPerformance: [],
    benchmarkPerformance: [],
    analytics: {
      scopeCount: 0,
      comparableScopeCount: 0,
      highConfidenceScopeCount: 0,
      suggestionCount: 0,
      unresolvedMappingCount: 0,
    },
    ...overrides,
  } as EstimateFeedbackResult;
}

describe('estimateVsActualCard', () => {
  it('shows em dash variance when coverage is too low', () => {
    const display = formatEstimateVarianceDisplay(feedback().projectSummary);
    expect(display.value).toBe('—');
    expect(display.reliable).toBe(false);
    expect(display.hint).toMatch(/Log expenses in each budget category/);
  });

  it('uses spend progress for the bar, not category-link coverage', () => {
    const summary = {
      mappedActualCoveragePercent: 94.4,
      mappedDirectCostActual: 6000,
      estimatedDirectCost: 26952.83,
    };
    expect(formatSpendProgress(summary).percentLabel).toBe('22.3%');
    expect(formatSpendProgress(summary).progressPercent).toBeCloseTo(22.3, 1);
    expect(formatSpendDollarsLine(summary, (n) => `$${n.toFixed(2)}`)).toBe(
      '$6000.00 of $26952.83 cost budget'
    );
  });

  it('shows signed variance when mapped subset is reliable', () => {
    const display = formatEstimateVarianceDisplay({
      ...feedback().projectSummary,
      mappedActualCoveragePercent: 72,
      directCostVariancePercent: 8.5,
      varianceIsReliable: true,
    });
    expect(display.value).toBe('+8.5%');
    expect(display.reliable).toBe(true);
    expect(display.tone).toBe('over');
  });

  it('formats category linkage labels separately from spend', () => {
    expect(formatCategoriesLinkedLabel(2, 2)).toBe('2 of 2');
    expect(formatCategoriesLinkedSublabel(['Materials/Equipment', 'Labor'])).toBe(
      'Materials/Equipment · Labor'
    );
    expect(formatCostBudgetVsBidNote(26952.83, 32273.23, (n) => `$${n.toFixed(2)}`)).toMatch(
      /materials \+ labor.*markup & profit/
    );
  });

  it('lists linked category names from scope comparisons', () => {
    const linked = getLinkedCategoryLabels({
      ...feedback(),
      scopeComparisons: [
        { scopeItemKey: 'mat', actualDirectCost: 1000, estimateItem: { name: 'Materials/Equipment' } },
        { scopeItemKey: 'lab', actualDirectCost: 5000, estimateItem: { name: 'Labor' } },
      ],
    } as any);
    expect(linked).toEqual(['Materials/Equipment', 'Labor']);
  });

  it('resolves the next unlinked category', () => {
    const target = resolveUnlinkedCategoryLabel(
      {
        ...feedback(),
        scopeComparisons: [
          { scopeItemKey: 'mat', actualDirectCost: 1000, estimateItem: { name: 'Materials/Equipment' } },
        ],
      } as any,
      ['Materials/Equipment', 'Labor']
    );
    expect(target).toBe('Labor');
  });

  it('uses the higher of client and server tip counts', () => {
    const result = feedback({ rateSuggestions: [{ key: 'a' } as any] });
    expect(resolveEstimateTipCount(result, 3)).toBe(3);
    expect(resolveEstimateTipCount(result, 0)).toBe(1);
    expect(resolveEstimateTipCount(result, null)).toBe(1);
  });

  it('hides review CTA without tips, coverage, or unresolved mappings', () => {
    const lowCoverage = feedback();
    expect(shouldShowReviewRateTipsCta(lowCoverage, 2)).toBe(false);

    const ready = feedback({
      projectSummary: {
        ...feedback().projectSummary,
        mappedActualCoveragePercent: 80,
        varianceIsReliable: true,
      },
      rateSuggestions: [{ key: 'tip-1' } as any],
    });
    expect(shouldShowReviewRateTipsCta(ready, 1)).toBe(true);

    const unresolved = feedback({
      unresolvedMappings: [{ id: 'map-1' } as any],
      projectSummary: {
        ...feedback().projectSummary,
        mappedActualCoveragePercent: 80,
      },
    });
    expect(shouldShowReviewRateTipsCta(unresolved, 1)).toBe(false);
  });

  it('progressively discloses rows based on coverage and tips', () => {
    expect(shouldShowVarianceRow(feedback())).toBe(false);
    expect(shouldShowTipsRow(feedback(), 0)).toBe(false);
    expect(
      shouldShowVarianceRow(
        feedback({
          projectSummary: { ...feedback().projectSummary, mappedActualCoveragePercent: 94.4 },
        })
      )
    ).toBe(true);
    expect(
      shouldShowTipsRow(
        feedback({
          projectSummary: { ...feedback().projectSummary, mappedActualCoveragePercent: 94.4 },
        }),
        2
      )
    ).toBe(true);
  });

  it('returns coverage-aware card messages', () => {
    expect(getEstimateVsActualCardMessage(feedback(), 0).text).toMatch(/Log expenses in each category/);
    expect(
      getEstimateVsActualCardMessage(
        feedback({
          projectSummary: {
            ...feedback().projectSummary,
            mappedActualCoveragePercent: 80,
          },
        }),
        2
      ).text
    ).toMatch(/2 rate insights available/);
    expect(
      getEstimateVsActualCardMessage(
        feedback({ unresolvedMappings: [{ id: 'x' } as any] }),
        1
      ).text
    ).toMatch(/still need mapping/);
  });

  it('shows the card when there is mapped coverage or suggestions', () => {
    expect(shouldShowEstimateVsActualCard(feedback({ status: 'insufficient_data' }))).toBe(false);
    expect(shouldShowEstimateVsActualCard(feedback())).toBe(true);
    expect(
      shouldShowEstimateVsActualCard(
        feedback({
          projectSummary: { ...feedback().projectSummary, mappedActualCoveragePercent: 0 },
          rateSuggestions: [{ key: 'tip' } as any],
        })
      )
    ).toBe(true);
  });
});
