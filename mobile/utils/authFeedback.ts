import { Alert, Platform } from 'react-native';

/** Alerts on native; `window.alert` on web where RN Alert is easy to miss. */
export function showAuthFeedback(title: string, message?: string): void {
  const body = message ? `${title}\n\n${message}` : title;
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.alert === 'function'
  ) {
    window.alert(body);
    return;
  }
  if (message) {
    Alert.alert(title, message);
  } else {
    Alert.alert(title);
  }
}
