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
 * Whether this signed-in user has completed or skipped onboarding on this device.
 * Migrates legacy global `bps.onboardingComplete` to this userId the first time we see it.
 */
export async function isOnboardingCompleteForUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;

  const perUserKey = onboardingCompleteKeyForUser(userId);
  const perUser = await AsyncStorage.getItem(perUserKey);
  if (perUser === 'true') return true;

  const legacy = await AsyncStorage.getItem(LEGACY_ONBOARDING_COMPLETE_KEY);
  if (legacy === 'true') {
    await AsyncStorage.setItem(perUserKey, 'true');
    await AsyncStorage.removeItem(LEGACY_ONBOARDING_COMPLETE_KEY);
    return true;
  }

  return false;
}

export async function setOnboardingCompleteForUser(userId: string): Promise<void> {
  await AsyncStorage.setItem(onboardingCompleteKeyForUser(userId), 'true');
  await AsyncStorage.removeItem(LEGACY_ONBOARDING_COMPLETE_KEY);
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
