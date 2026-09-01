import { getEstimateStep5MarginTargetFeedback } from '../../utils/estimateStep5MarginTarget';

const gcProfile = {
  profitRange: { min: 8, max: 12 },
  safeMarkupRange: { min: 13, max: 21 },
};

describe('getEstimateStep5MarginTargetFeedback', () => {
  it('shows meets target when projected net margin is inside profile range', () => {
    const result = getEstimateStep5MarginTargetFeedback({
      subtotal: 31059.33,
      netProfitPct: 11.6,
      currentMarkupNum: 15,
      recommendedMarkupNum: 17,
      recommendationInfo: gcProfile,
    });

    expect(result.contextualMessage?.text).toBe('Meets your target');
    expect(result.markupStatusText).toBe('11.6% projected net margin');
    expect(result.applyButtonText).toBe('Apply 0%');
  });

  it('shows below target when projected net margin is under profile minimum', () => {
    const result = getEstimateStep5MarginTargetFeedback({
      subtotal: 31059.33,
      netProfitPct: 6.2,
      currentMarkupNum: 12,
      recommendedMarkupNum: 17,
      recommendationInfo: gcProfile,
    });

    expect(result.contextualMessage?.text).toBe('Below your target');
    expect(result.markupStatus).toBe('risk');
    expect(result.applyButtonText).toBe('Apply 5%');
  });

  it('shows above target when projected net margin exceeds profile maximum', () => {
    const result = getEstimateStep5MarginTargetFeedback({
      subtotal: 31059.33,
      netProfitPct: 14.5,
      currentMarkupNum: 20,
      recommendedMarkupNum: 17,
      recommendationInfo: gcProfile,
    });

    expect(result.contextualMessage?.text).toBe('Above your target');
    expect(result.markupStatus).toBe('warn');
  });
});
