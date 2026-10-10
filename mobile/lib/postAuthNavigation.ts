import { hydrateWalkthroughState } from './walkthroughStateService';
import { shouldShowWalkthrough } from './walkthroughStateTypes';
import { applyWorkspaceMemberFirstRunIfNeeded } from './workspaceMemberOnboarding';

/**
 * Intended first-run flow: Landing (Get started) → Create account →
 * Onboarding → sample tour → required plan. Returning users who finished or skipped onboarding go to the dashboard, and iOS still requires a subscription.
 *
 * Invited workspace members skip owner-style onboarding and go straight to shared projects.
 */
export async function getPostAuthHref(
  userId: string | null | undefined
): Promise<'/(tabs)/dashboard' | '/onboarding'> {
  if (!userId) return '/onboarding';

  const memberFirstRun = await applyWorkspaceMemberFirstRunIfNeeded(userId);
  if (memberFirstRun.applied) {
    return '/(tabs)/dashboard';
  }

  const state = await hydrateWalkthroughState(userId);
  return shouldShowWalkthrough('appOnboarding', state) ? '/onboarding' : '/(tabs)/dashboard';
}
