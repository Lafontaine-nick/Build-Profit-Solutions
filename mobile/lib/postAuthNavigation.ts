import { isOnboardingCompleteForUser } from './onboardingStorage';

/**
 * Intended first-run flow: Landing (Get started) → Auth (sign in / create account) →
 * Onboarding → Dashboard. Returning users who completed onboarding skip straight to the dashboard.
 */
export async function getPostAuthHref(
  userId: string | null | undefined
): Promise<'/(tabs)/dashboard' | '/onboarding'> {
  if (!userId) return '/onboarding';
  const done = await isOnboardingCompleteForUser(userId);
  return done ? '/(tabs)/dashboard' : '/onboarding';
}
