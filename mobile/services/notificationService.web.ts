/**
 * Web implementation: no `expo-notifications` (Metro web + Worklets cannot load it).
 * Import path stays `@/services/notificationService`; Metro picks this file on web
 * because there is no `notificationService.ts` — only `.native.ts` and `.web.ts`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_TOKEN_KEY = 'expo_push_notification_token';

/** Subset of expo-notifications.PermissionStatus values used by the app UI. */
export type WebPushPermissionStatus = 'undetermined' | 'denied' | 'granted';

export interface NotificationPermissionResult {
  granted: boolean;
  canAskAgain: boolean;
  status: WebPushPermissionStatus;
}

export async function requestNotificationPermissions(): Promise<NotificationPermissionResult> {
  return {
    granted: false,
    canAskAgain: false,
    status: 'undetermined',
  };
}

export async function getNotificationPermissionStatus(): Promise<NotificationPermissionResult> {
  return {
    granted: false,
    canAskAgain: false,
    status: 'undetermined',
  };
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  return null;
}

export async function unregisterFromPushNotifications(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function scheduleLocalNotification(
  _title: string,
  _body: string,
  _data?: unknown,
  _trigger?: unknown
): Promise<string> {
  return '';
}

export async function cancelNotification(_identifier: string): Promise<void> {}

export async function cancelAllNotifications(): Promise<void> {}

export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(NOTIFICATION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function initializeNotificationService(): Promise<void> {}

const notificationService = {
  initialize: initializeNotificationService,
  requestPermissions: requestNotificationPermissions,
  getPermissionStatus: getNotificationPermissionStatus,
  register: registerForPushNotificationsAsync,
  unregister: unregisterFromPushNotifications,
  schedule: scheduleLocalNotification,
  cancel: cancelNotification,
  cancelAll: cancelAllNotifications,
  getToken: getStoredPushToken,
};

export default notificationService;
