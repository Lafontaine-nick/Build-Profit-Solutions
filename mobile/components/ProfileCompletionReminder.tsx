import React, { useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { useUser } from '@clerk/clerk-react';
import { useNotification } from '@/contexts/NotificationContext';
import { useWalkthroughState } from '@/contexts/WalkthroughStateContext';
import { isClerkEnabled } from '@/lib/isClerkEnabled';
import {
  buildProfileCompletionReminderCopy,
  evaluateContractorProfileCompletion,
  type ContractorProfileLike,
} from '@/lib/profileCompletion';
import { isPostOnboardingAppRoute } from '@/lib/profileCompletionReminderEligibility';
import {
  clearProfileCompletionReminderDismissed,
  recordProfileCompletionReminderDismissed,
  shouldShowProfileCompletionReminder,
} from '@/lib/profileCompletionReminderStorage';

const INITIAL_DELAY_MS = 3200;

function ProfileCompletionReminderCore({ userId }: { userId: string }) {
  const router = useRouter();
  const segments = useSegments();
  const { showNotification } = useNotification();
  const { hydrated, shouldShowAppOnboarding } = useWalkthroughState();
  const shownThisSessionRef = useRef(false);
  const pendingRef = useRef(false);

  const routeEligible =
    hydrated && !shouldShowAppOnboarding && isPostOnboardingAppRoute(segments);

  const maybeShowReminder = useCallback(async () => {
    if (!routeEligible || pendingRef.current || shownThisSessionRef.current) return;
    pendingRef.current = true;
    try {
      const raw = await AsyncStorage.getItem('bps.contractorProfile');
      const profile: ContractorProfileLike | null = raw ? JSON.parse(raw) : null;
      const resolvedUserId =
        userId ||
        String(profile?.email || '')
          .trim()
          .toLowerCase() ||
        'local';
      const result = evaluateContractorProfileCompletion(profile);

      if (result.isComplete) {
        await clearProfileCompletionReminderDismissed(resolvedUserId);
        return;
      }

      const shouldShow = await shouldShowProfileCompletionReminder(resolvedUserId);
      if (!shouldShow) return;

      shownThisSessionRef.current = true;
      const copy = buildProfileCompletionReminderCopy(result);

      const openProfile = () => {
        router.push('/profile');
      };

      showNotification({
        id: 'profile-completion-reminder',
        title: copy.title,
        body: copy.body,
        type: 'info',
        icon: 'person',
        iconType: 'material',
        duration: 10000,
        action: {
          label: 'Open Profile',
          onPress: openProfile,
        },
        onPress: openProfile,
        onDismiss: () => {
          void recordProfileCompletionReminderDismissed(resolvedUserId);
        },
      });
    } catch (e) {
      if (__DEV__) {
        console.warn('ProfileCompletionReminder: check failed', e);
      }
    } finally {
      pendingRef.current = false;
    }
  }, [routeEligible, router, showNotification, userId]);

  useEffect(() => {
    if (!routeEligible) return;
    const timer = setTimeout(() => {
      void maybeShowReminder();
    }, INITIAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [routeEligible, maybeShowReminder]);

  return null;
}

function ProfileCompletionReminderWithClerk() {
  const { user } = useUser();
  const userId =
    user?.id ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    'local';
  return <ProfileCompletionReminderCore userId={userId} />;
}

/**
 * In-app banner after account creation + app onboarding — only on dashboard/tabs and
 * other signed-in app screens (not landing or auth).
 */
export default function ProfileCompletionReminder() {
  if (!isClerkEnabled()) {
    return <ProfileCompletionReminderCore userId="local" />;
  }
  return <ProfileCompletionReminderWithClerk />;
}
