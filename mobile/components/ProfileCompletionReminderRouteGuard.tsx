import { useEffect } from 'react';
import { useSegments } from 'expo-router';
import { useNotification } from '@/contexts/NotificationContext';
import { useWalkthroughState } from '@/contexts/WalkthroughStateContext';
import { isPostOnboardingAppRoute } from '@/lib/profileCompletionReminderEligibility';

/**
 * Clears the profile-completion banner when the user is on landing, auth, or onboarding.
 * Hiding here does not snooze it; a swipe or close is what waits 24 hours.
 */
export default function ProfileCompletionReminderRouteGuard() {
  const segments = useSegments();
  const { hideNotification } = useNotification();
  const { hydrated, shouldShowAppOnboarding } = useWalkthroughState();

  const eligible =
    hydrated && !shouldShowAppOnboarding && isPostOnboardingAppRoute(segments);

  useEffect(() => {
    if (!eligible) {
      hideNotification({ snooze: false });
    }
  }, [eligible, hideNotification]);

  return null;
}
