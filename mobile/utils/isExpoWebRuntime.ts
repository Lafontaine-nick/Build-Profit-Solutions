import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * True in a real browser running the Metro web bundle.
 *
 * Some dev-client + `--web` setups still report `Platform.OS` as something other
 * than `'web'` and omit `Constants.platform.web`, while `expo-device` reports
 * `Device.isDevice === false` (same as a simulator). In that case we must detect
 * the actual browser or `expo-notifications` / Worklets will crash on load.
 */
export function isExpoWebRuntime(): boolean {
  if (Platform.OS === 'web') return true;

  const plat = Constants.platform as { web?: unknown } | undefined;
  if (plat?.web != null) return true;

  // Metro web: real browser document. Do not rely on `constructor.name` — Safari
  // privacy settings can mask it so it is not `"HTMLDocument"`.
  if (typeof window !== 'undefined' && window.document?.nodeType === 9) {
    const p = window.location?.protocol;
    if (p === 'http:' || p === 'https:' || p === 'file:') {
      return true;
    }
  }

  // Metro / Expo often inject this for the active bundle target.
  if (typeof process !== 'undefined' && process.env?.EXPO_OS === 'web') {
    return true;
  }

  return false;
}
