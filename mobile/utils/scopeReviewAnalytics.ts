import type { ScopeGapResolutionStatus } from '@/utils/scopeReviewUi';

type ScopeReviewAnalyticsProps = {
  tradeOrCategory?: string;
  gapIdentifier?: string;
  previousStatus?: ScopeGapResolutionStatus;
  newStatus?: ScopeGapResolutionStatus;
  unresolvedCount?: number;
};

/** Non-sensitive Build with AI scope-review analytics (console in dev until product analytics wired). */
export function trackScopeReviewOpened(props: ScopeReviewAnalyticsProps): void {
  if (__DEV__) {
    console.log('[analytics] ai_scope_review_opened', sanitize(props));
  }
}

export function trackScopeReviewClosed(props: ScopeReviewAnalyticsProps): void {
  if (__DEV__) {
    console.log('[analytics] ai_scope_review_closed', sanitize(props));
  }
}

export function trackScopeGapResolved(props: ScopeReviewAnalyticsProps): void {
  if (__DEV__) {
    console.log('[analytics] ai_scope_gap_resolved', sanitize(props));
  }
}

export function trackScopeGapStatusChanged(props: ScopeReviewAnalyticsProps): void {
  if (__DEV__) {
    console.log('[analytics] ai_scope_gap_status_changed', sanitize(props));
  }
}

function sanitize(props: ScopeReviewAnalyticsProps): ScopeReviewAnalyticsProps {
  return {
    tradeOrCategory: props.tradeOrCategory,
    gapIdentifier: props.gapIdentifier,
    previousStatus: props.previousStatus,
    newStatus: props.newStatus,
    unresolvedCount: props.unresolvedCount,
  };
}
