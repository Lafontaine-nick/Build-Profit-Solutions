import React, { useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-react';
import { useNotification } from '@/contexts/NotificationContext';
import { isClerkEnabled } from '@/lib/isClerkEnabled';
import {
  buildProfileCompletionReminderCopy,
  evaluateContractorProfileCompletion,
  type ContractorProfileLike,
} from '@/lib/profileCompletion';
import {
  clearProfileCompletionReminderDismissed,
  recordProfileCompletionReminderDismissed,
  shouldShowProfileCompletionReminder,
} from '@/lib/profileCompletionReminderStorage';

const INITIAL_DELAY_MS = 3200;

function ProfileCompletionReminderCore({ userId }: { userId: string }) {
  const router = useRouter();
  const { showNotification } = useNotification();
  const shownThisSessionRef = useRef(false);
  const pendingRef = useRef(false);

  const maybeShowReminder = useCallback(async () => {
    if (pendingRef.current || shownThisSessionRef.current) return;
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
          onPress: () => {
            router.push('/profile');
          },
        },
        onPress: () => {
          router.push('/profile');
        },
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
  }, [router, showNotification, userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void maybeShowReminder();
    }, INITIAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [maybeShowReminder]);

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
 * Gentle in-app banner for signed-in users with an incomplete contractor profile.
 * Mount once under the main tab shell (not on auth/onboarding routes).
 */
export default function ProfileCompletionReminder() {
  if (!isClerkEnabled()) {
    return <ProfileCompletionReminderCore userId="local" />;
  }
  return <ProfileCompletionReminderWithClerk />;
}
