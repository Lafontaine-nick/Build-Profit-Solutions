import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * One meaning per haptic. Plain navigation taps get none.
 * - select: a choice changed (chips, toggles, segmented controls, tab switch)
 * - tap: a primary button that starts something (Save, Record payment)
 * - success / warning / error: the outcome of an action
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function run(fn: () => Promise<void>) {
  if (!enabled) return;
  fn().catch(() => {});
}

export const haptic = {
  select: () => run(() => Haptics.selectionAsync()),
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export type HapticKind = keyof typeof haptic;
