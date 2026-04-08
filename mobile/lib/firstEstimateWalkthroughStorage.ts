import AsyncStorage from '@react-native-async-storage/async-storage';

/** When true, first-estimate contextual walkthrough is permanently off (converted to project or second estimate). */
export const FIRST_ESTIMATE_WALKTHROUGH_COMPLETE_KEY =
  'bps.firstEstimateWalkthroughComplete';

/**
 * In-progress UI state (intro, skip, per-step "Got it") so leaving the app or remounting Estimates
 * does not replay cards the user already dismissed.
 */
export const FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY =
  'bps.firstEstimateWalkthroughProgress';

export type FirstEstimateWalkthroughProgress = {
  introResolved?: boolean;
  started?: boolean;
  skipTips?: boolean;
  dismissed?: Record<string, boolean>;
};

export async function isFirstEstimateWalkthroughComplete(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(FIRST_ESTIMATE_WALKTHROUGH_COMPLETE_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export async function markFirstEstimateWalkthroughComplete(
  userId?: string | null
): Promise<void> {
  try {
    if (userId) {
      const { markWalkthroughCompleted } = await import('./walkthroughStateService');
      await markWalkthroughCompleted(userId, 'firstEstimate');
      return;
    }
    await AsyncStorage.setItem(FIRST_ESTIMATE_WALKTHROUGH_COMPLETE_KEY, 'true');
    await AsyncStorage.removeItem(FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY);
  } catch {
    /* ignore */
  }
}

export async function loadFirstEstimateWalkthroughProgress(): Promise<FirstEstimateWalkthroughProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return null;
    return p as FirstEstimateWalkthroughProgress;
  } catch {
    return null;
  }
}

export async function saveFirstEstimateWalkthroughProgress(
  progress: FirstEstimateWalkthroughProgress
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY,
      JSON.stringify(progress)
    );
  } catch {
    /* ignore */
  }
}

/** Dev / reset-onboarding: clear so the first-estimate walkthrough can run again. */
export async function resetFirstEstimateWalkthroughStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      FIRST_ESTIMATE_WALKTHROUGH_COMPLETE_KEY,
      FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY,
    ]);
  } catch {
    /* ignore */
  }
}
