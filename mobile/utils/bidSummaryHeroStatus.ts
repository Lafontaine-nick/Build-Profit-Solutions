export type BidSummaryHeroStatusTone = 'ready' | 'review' | 'progress';

const SETUP_GAP_LABELS = new Set([
  'Client and job info added',
  'Markup reviewed',
  'Payment schedule set',
  'Final total reviewed',
]);

/**
 * A priced scope should not read as "N items to check" when the remaining
 * checklist rows are customer info, markup review, payment schedule, and the
 * final-total flag. Those stay in Continue the bid.
 */
export function resolveBidSummaryHeroStatus(input: {
  missingLabels: string[];
  setupProgressPct: number;
  healthScore: number;
  hasMaterials: boolean;
  hasLabor: boolean;
  total: number;
}): {
  label: string;
  tone: BidSummaryHeroStatusTone;
  needsReview: boolean;
  showLineCount: boolean;
} {
  const missingCount = input.missingLabels.length;
  const pricedScopeReady =
    input.hasMaterials && input.hasLabor && input.total > 0;
  const onlySetupGaps =
    pricedScopeReady &&
    input.missingLabels.every(label => SETUP_GAP_LABELS.has(label));
  if (onlySetupGaps) {
    if (input.healthScore >= 75) {
      return {
        label: 'Mostly ready',
        tone: 'progress',
        needsReview: false,
        showLineCount: false,
      };
    }
    return {
      label: 'Needs review',
      tone: 'review',
      needsReview: true,
      showLineCount: false,
    };
  }
  const needsReview =
    missingCount > 0 ||
    input.setupProgressPct < 100 ||
    (pricedScopeReady && input.healthScore < 75);
  if (input.setupProgressPct >= 100 && input.healthScore >= 75 && missingCount === 0) {
    return {
      label: 'Ready to send',
      tone: 'ready',
      needsReview: false,
      showLineCount: true,
    };
  }
  if (missingCount > 0) {
    return {
      label:
        missingCount === 1
          ? 'Needs review — 1 item to check'
          : `Needs review — ${missingCount} items to check`,
      tone: 'review',
      needsReview,
      showLineCount: true,
    };
  }
  if (input.setupProgressPct >= 100) {
    return {
      label: 'Needs review',
      tone: 'review',
      needsReview,
      showLineCount: true,
    };
  }
  return {
    label: `Setup ${input.setupProgressPct}%`,
    tone: 'progress',
    needsReview,
    showLineCount: true,
  };
}
