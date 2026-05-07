import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getNetworkInfo } from './networkDetection';

const RENDER_DEFAULT = 'https://build-profit-solutions-backend.onrender.com/api';

/** Web / Expo Go may expose `extra` only on `manifest` or `manifest2`. */
function readExtraString(key: string): string | undefined {
  const c = Constants as Record<string, unknown>;
  const tryStr = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;
  const rawExpoExtra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExpo = tryStr(rawExpoExtra?.[key]);
  if (fromExpo) return fromExpo;
  const m = c.manifest as { extra?: Record<string, string> } | undefined;
  const fromManifest = tryStr(m?.extra?.[key]);
  if (fromManifest) return fromManifest;
  const m2 = (c.manifest2 as { extra?: { expoClient?: { extra?: Record<string, string> } } })?.extra;
  const fromManifest2 = tryStr(m2?.expoClient?.extra?.[key]);
  if (fromManifest2) return fromManifest2;
  return undefined;
}

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

/** True when the URL host is localhost or a private LAN address (direct fetch from Expo web). */
function isPrivateOrLocalhostApiUrl(url: string): boolean {
  const t = url.trim();
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(t);
}

/**
 * Backend REST API base (`…/api`) for Stripe, subscriptions, Places search, etc.
 *
 * Order matters: explicit REST URLs win. `EXPO_PUBLIC_AI_API_URL` is only for the AI client —
 * do not route general REST there when `EXPO_PUBLIC_API_BASE_URL` / dev API point at Render.
 *
 * **Optional:** `EXPO_PUBLIC_REST_USE_RENDER=true` on web forces REST back through Metro → Render
 * while `EXPO_PUBLIC_AI_API_URL` can still point at a local backend (AI only).
 */
export function resolveBackendRestApiBaseUrl(): string {
  const envApi = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const envDevOnly = process.env.EXPO_PUBLIC_DEV_API_BASE_URL?.trim();
  const extraApi = readExtraString('apiBaseUrl');
  const primary = envApi || extraApi;
  const devEnv = envDevOnly || readExtraString('devApiBaseUrl');
  const restUseRender =
    process.env.EXPO_PUBLIC_REST_USE_RENDER === '1' ||
    process.env.EXPO_PUBLIC_REST_USE_RENDER === 'true';

  /** If set in `.env`, user chose REST host explicitly — do not override with `EXPO_PUBLIC_AI_API_URL`. */
  const restHostChosenInEnv = !!(envApi || envDevOnly);

  /**
   * Web @ localhost:48000 / :8081 historically returned early with Metro's `__bps_render_api__`
   * → Render, so **local `node src/server.js` was never used** for Places/geocode. Prefer an
   * explicit localhost URL from env when developing the API on this machine.
   */
  const localhostRest =
    [primary, devEnv].find((u) => u && /localhost|127\.0\.0\.1/i.test(u)) || '';

  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    __DEV__ &&
    localhostRest
  ) {
    const u = ensureApiSuffix(localhostRest);
    console.log('🔧 Backend REST API: web dev → localhost from env (not Metro→Render proxy) →', u);
    return u;
  }

  /** Infer REST from AI URL only when REST base was not set in env (AI-only setups). */
  const aiUrlRaw = process.env.EXPO_PUBLIC_AI_API_URL?.trim();
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    __DEV__ &&
    !restUseRender &&
    !restHostChosenInEnv &&
    aiUrlRaw &&
    /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
      aiUrlRaw
    )
  ) {
    const u = ensureApiSuffix(stripToOrigin(aiUrlRaw));
    console.log('🔧 Backend REST API: web dev → EXPO_PUBLIC_AI_API_URL host (local/LAN backend) →', u);
    return u;
  }

  /** Explicit LAN/localhost `EXPO_PUBLIC_*` REST URL — call it directly (Metro proxy targets Render only). */
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    __DEV__ &&
    primary &&
    isPrivateOrLocalhostApiUrl(primary)
  ) {
    const u = ensureApiSuffix(primary);
    console.log('🔧 Backend REST API: web dev → explicit primary (LAN/localhost) →', u);
    return u;
  }

  // Expo web @ localhost cannot read cross-origin JSON from Render until CORS allows it.
  // Metro proxies same-origin `/__bps_render_api__/api/*` → Render (see metro.config.js).
  if (Platform.OS === 'web' && typeof window !== 'undefined' && __DEV__) {
    const origin = window.location.origin.replace(/\/$/, '');
    const u = `${origin}/__bps_render_api__/api`;
    console.log('🔧 Backend REST API: web dev same-origin proxy →', u);
    return u;
  }

  // In Expo Go / Metro / web, `process.env.EXPO_PUBLIC_*` is sometimes missing in the bundle,
  // but `app.config.js` bakes `extra.apiBaseUrl` (defaults to Render when unset).
  if (primary) {
    const u = ensureApiSuffix(primary);
    console.log('🔧 Backend REST API: env|extra.apiBaseUrl →', u, {
      fromProcessEnv: Boolean(envApi),
      fromAppConfigExtra: Boolean(extraApi),
    });
    return u;
  }

  if (devEnv && devEnv.trim()) {
    const u = ensureApiSuffix(devEnv);
    console.log('🔧 Backend REST API: DEV_API_BASE_URL / extra.devApiBaseUrl →', u);
    return u;
  }

  const aiEnv = process.env.EXPO_PUBLIC_AI_API_URL;
  if (aiEnv && aiEnv.trim()) {
    const u = ensureApiSuffix(stripToOrigin(aiEnv));
    console.log('🔧 Backend REST API: EXPO_PUBLIC_AI_API_URL →', u);
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
