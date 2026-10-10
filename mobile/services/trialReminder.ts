import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CustomerInfo } from 'react-native-purchases';
import { REVENUECAT_ENTITLEMENT_ID } from '@/constants/billingCatalog';

const STORAGE_KEY = 'bps.trialReminder';
/** Apple requires cancelling at least 24 hours before renewal, so remind two days out. */
const REMIND_BEFORE_MS = 2 * 24 * 60 * 60 * 1000;

type StoredReminder = { notificationId: string; expirationDate: string };

async function readStored(): Promise<StoredReminder | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredReminder) : null;
  } catch {
    return null;
  }
}

async function cancelStored(Notifications: typeof import('expo-notifications')): Promise<void> {
  const stored = await readStored();
  if (!stored) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(stored.notificationId);
  } catch {
    /* already fired or removed */
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Keeps one local "your free trial ends in 2 days" notification in sync with the App Store trial.
 * Schedules it while the user is on a trial that will renew, and cancels it once they cancel,
 * convert to paid, or lose access.
 */
export async function syncTrialReminder(customerInfo: CustomerInfo | null | undefined): Promise<void> {
  if (Platform.OS !== 'ios' || !customerInfo) return;
  const Notifications = await import('expo-notifications');

  const entitlement = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
  const expirationDate = entitlement?.expirationDate ?? null;
  const onRenewingTrial =
    Boolean(entitlement?.isActive) &&
    String(entitlement?.periodType).toUpperCase() === 'TRIAL' &&
    Boolean(entitlement?.willRenew) &&
    Boolean(expirationDate);

  if (!onRenewingTrial || !expirationDate) {
    await cancelStored(Notifications);
    return;
  }

  const stored = await readStored();
  if (stored?.expirationDate === expirationDate) return;
  await cancelStored(Notifications);

  const endsAt = new Date(expirationDate);
  const fireAt = new Date(endsAt.getTime() - REMIND_BEFORE_MS);
  if (fireAt.getTime() <= Date.now() + 60 * 1000) return;

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return;

  const endsLabel = endsAt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Your free trial ends in 2 days',
      body: `Your Professional subscription starts ${endsLabel} and your Apple ID will be charged. To cancel, open Settings → your name → Subscriptions.`,
      data: { type: 'trial-reminder' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ notificationId, expirationDate }));
}
