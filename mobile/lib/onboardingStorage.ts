import AsyncStorage from '@react-native-async-storage/async-storage';

/** Pre–per-user installs used a single global flag. Migrated once per user on read. */
const LEGACY_ONBOARDING_COMPLETE_KEY = 'bps.onboardingComplete';

export function onboardingCompleteKeyForUser(userId: string): string {
  return `bps.onboardingComplete.${userId}`;
}

export function onboardingDataKeyForUser(userId: string): string {
  return `bps.onboardingData.${userId}`;
}

/**
 * Whether this signed-in user should skip app onboarding (completed or skipped for current version).
 * Prefers account-level cache from walkthrough state; falls back to legacy AsyncStorage.
 */
export async function isOnboardingCompleteForUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;

  try {
    const { readWalkthroughCache } = await import('./walkthroughStateService');
    const { shouldShowWalkthrough } = await import('./walkthroughStateTypes');
    const cached = await readWalkthroughCache(userId);
    if (cached) {
      return !shouldShowWalkthrough('appOnboarding', cached);
    }
  } catch {
    /* fall through */
  }

  const perUserKey = onboardingCompleteKeyForUser(userId);
  const perUser = await AsyncStorage.getItem(perUserKey);
  return perUser === 'true';
}

export async function setOnboardingCompleteForUser(userId: string): Promise<void> {
  const { markWalkthroughCompleted } = await import('./walkthroughStateService');
  await markWalkthroughCompleted(userId, 'appOnboarding');
}

export async function clearOnboardingCompleteForUser(userId: string): Promise<void> {
  await AsyncStorage.removeItem(onboardingCompleteKeyForUser(userId));
  await AsyncStorage.removeItem(LEGACY_ONBOARDING_COMPLETE_KEY);
}

/** Reset onboarding for Profile “Reset” when we can’t resolve a user id. */
export async function clearAllOnboardingCompletionKeys(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter(
    (k) => k === LEGACY_ONBOARDING_COMPLETE_KEY || k.startsWith('bps.onboardingComplete.')
  );
  if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
}
