import { Platform } from 'react-native';

const dsn = String(process.env.EXPO_PUBLIC_SENTRY_DSN || '').trim();

function loadSentry():
  | {
      init: (options: Record<string, unknown>) => void;
      captureException: (error: unknown) => void;
    }
  | null {
  if (!dsn) return null;
  try {
    return require('@sentry/react-native');
  } catch (error) {
    console.warn('Crash reporting SDK is not installed', error);
    return null;
  }
}

export function initCrashReporting() {
  const Sentry = loadSentry();
  if (!Sentry) return;
  Sentry.init({
    dsn,
    enabled: typeof __DEV__ === 'undefined' ? true : !__DEV__,
    enableNative: Platform.OS !== 'web',
    tracesSampleRate: 0,
  });
}

export function captureCrash(error: unknown) {
  const Sentry = loadSentry();
  if (!Sentry) return;
  Sentry.captureException(error);
}
