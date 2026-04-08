import { hydrateWalkthroughState } from './walkthroughStateService';
import { shouldShowWalkthrough } from './walkthroughStateTypes';

/**
 * Intended first-run flow: Landing (Get started) → Auth (sign in / create account) →
 * Onboarding → Dashboard. Returning users who completed or skipped onboarding skip straight to the dashboard.
 */
export async function getPostAuthHref(
  userId: string | null | undefined
): Promise<'/(tabs)/dashboard' | '/onboarding'> {
  if (!userId) return '/onboarding';
  const state = await hydrateWalkthroughState(userId);
  return shouldShowWalkthrough('appOnboarding', state) ? '/onboarding' : '/(tabs)/dashboard';
}
