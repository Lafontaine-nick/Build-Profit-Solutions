import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'bps.profileCompletionReminder.v1';
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;

type ReminderState = {
  dismissedAt?: number;
};

function storageKey(userId: string): string {
  return `${KEY_PREFIX}.${userId}`;
}

export async function shouldShowProfileCompletionReminder(
  userId: string | null | undefined
): Promise<boolean> {
  const id = String(userId || '').trim();
  if (!id) return true;
  try {
    const raw = await AsyncStorage.getItem(storageKey(id));
    if (!raw) return true;
    const state = JSON.parse(raw) as ReminderState;
    const dismissedAt = Number(state?.dismissedAt);
    if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return true;
    return Date.now() - dismissedAt >= REMIND_AFTER_MS;
  } catch {
    return true;
  }
}

export async function recordProfileCompletionReminderDismissed(
  userId: string | null | undefined
): Promise<void> {
  const id = String(userId || '').trim();
  if (!id) return;
  try {
    await AsyncStorage.setItem(
      storageKey(id),
      JSON.stringify({ dismissedAt: Date.now() } satisfies ReminderState)
    );
  } catch {
    /* ignore */
  }
}

export async function clearProfileCompletionReminderDismissed(
  userId: string | null | undefined
): Promise<void> {
  const id = String(userId || '').trim();
  if (!id) return;
  try {
    await AsyncStorage.removeItem(storageKey(id));
  } catch {
    /* ignore */
  }
}
