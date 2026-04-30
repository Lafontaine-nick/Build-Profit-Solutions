import { RuntimeKind } from 'react-native-worklets';

/**
 * Expo Notifications and similar host APIs must run only on the main RN JS runtime.
 * On Reanimated UI / Worker runtimes, `console.*` and native calls can trigger
 * `[Worklets] createSerializableObject should never be called in JSWorklets`.
 */
export function isReactNativeJsRuntime(): boolean {
  const k = (globalThis as { __RUNTIME_KIND?: number }).__RUNTIME_KIND;
  return k === undefined || k === RuntimeKind.ReactNative;
}
