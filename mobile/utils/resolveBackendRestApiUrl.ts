import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getNetworkInfo } from './networkDetection';

const RENDER_DEFAULT = 'https://build-profit-solutions-backend.onrender.com/api';

/** Normalize to a base URL ending with `/api`. */
function ensureApiSuffix(url: string): string {
  const t = url.trim().replace(/\/$/, '');
  return t.endsWith('/api') ? t : `${t}/api`;
}

/** Strip path after origin (e.g. …/api/ai-assistant → origin only). */
function stripToOrigin(url: string): string {
  let u = url.trim();
  u = u.replace(/\/api\/.*$/, '');
  u = u.replace(/\/$/, '');
  return u;
}

/**
 * Backend REST API base (`…/api`) for Stripe, subscriptions, auth helpers, etc.
 *
 * Must match the same host the AI assistant uses in dev; `app.config.js` alone often
 * bakes in Render while `EXPO_PUBLIC_AI_API_URL` points at your Mac — Stripe would
 * then hit a cold/unreachable host and time out.
 */
export function resolveBackendRestApiBaseUrl(): string {
  // In Expo Go / Metro, `process.env.EXPO_PUBLIC_*` is not always defined in the client bundle,
  // but `app.config.js` still bakes `extra.apiBaseUrl` from the same env when the dev server starts.
  // We must prefer that early — otherwise hostUri / networkDetection can pick a wrong LAN IP and
  // requests time out even when `.env.local` is correct.
  const envApi = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const extraApi = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined)?.trim();
  const primary = envApi || extraApi;
  if (primary) {
    const u = ensureApiSuffix(primary);
    console.log('🔧 Backend REST API: env|extra.apiBaseUrl →', u, {
      fromProcessEnv: Boolean(envApi),
      fromAppConfigExtra: Boolean(extraApi),
    });
    return u;
  }

  const aiEnv = process.env.EXPO_PUBLIC_AI_API_URL;
  if (aiEnv && aiEnv.trim()) {
    const u = ensureApiSuffix(stripToOrigin(aiEnv));
    console.log('🔧 Backend REST API: EXPO_PUBLIC_AI_API_URL →', u);
    return u;
  }

  const devEnv =
    process.env.EXPO_PUBLIC_DEV_API_BASE_URL ||
    (Constants.expoConfig?.extra?.devApiBaseUrl as string | undefined);
  if (devEnv && devEnv.trim()) {
    const u = ensureApiSuffix(devEnv);
    console.log('🔧 Backend REST API: DEV_API_BASE_URL / extra.devApiBaseUrl →', u);
    return u;
  }

  if (Platform.OS === 'ios' && Constants.isDevice === false) {
    const u = ensureApiSuffix('http://localhost:3001');
    console.log('🔧 Backend REST API: iOS simulator →', u);
    return u;
  }
  if (Platform.OS === 'web') {
    const u = ensureApiSuffix('http://localhost:3001');
    console.log('🔧 Backend REST API: web →', u);
    return u;
  }
  if (Platform.OS === 'android' && Constants.isDevice === false) {
    const u = ensureApiSuffix('http://10.0.2.2:3001');
    console.log('🔧 Backend REST API: Android emulator →', u);
    return u;
  }

  const expoConfig: any = Constants.expoConfig || (Constants as any).manifest;
  const hostUri: string | undefined =
    expoConfig?.hostUri ||
    expoConfig?.debuggerHost ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri && typeof hostUri === 'string') {
    const maybeIp = hostUri.split(':')[0];
    if (maybeIp && /^\d{1,3}(\.\d{1,3}){3}$/.test(maybeIp)) {
      const u = ensureApiSuffix(`http://${maybeIp}:3001`);
      console.log('🔧 Backend REST API: Expo hostUri →', u);
      return u;
    }
  }

  // Tunnel / non-IP hostUri (e.g. *.exp.direct): LAN IP from Metro/networkDetection still works for dev.
  if (__DEV__ && Constants.isDevice) {
    try {
      const { recommendedApiUrl } = getNetworkInfo();
      if (recommendedApiUrl && !recommendedApiUrl.includes('render.com')) {
        const u = ensureApiSuffix(recommendedApiUrl);
        console.log('🔧 Backend REST API: networkDetection →', u);
        return u;
      }
    } catch {
      /* ignore */
    }
  }

  console.warn('🔧 Backend REST API: fallback →', RENDER_DEFAULT);
  return RENDER_DEFAULT;
}
