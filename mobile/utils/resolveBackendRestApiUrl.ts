import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getNetworkInfo } from './networkDetection';

const RENDER_DEFAULT = 'https://build-profit-solutions-backend.onrender.com/api';

/** True when JS is in dev mode or app.config marked development (dev client / Expo profile). */
export function isExpoDevelopmentProfile(): boolean {
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
  const extra = Constants.expoConfig?.extra as { isDevelopment?: boolean } | undefined;
  return extra?.isDevelopment === true;
}

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

/** True when the API host is loopback only (simulator OK; physical phone must use Mac LAN IP). */
function isLoopbackApiHost(url: string): boolean {
  try {
    const u = new URL(url.trim());
    const h = (u.hostname || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1';
  } catch {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(\/|:|\?|$)/i.test(String(url).trim());
  }
}

/** First private LAN IPv4 in a string, excluding loopback (Metro on Mac: 192.168.x.x). */
function extractPrivateLanIpv4(src: string): string | null {
  const ip = extractLanIpv4(src);
  if (!ip || ip === '127.0.0.1') return null;
  if (/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return ip;
  return null;
}

/** First IPv4 in string (handles `192.168.0.142:8081`, `exp://192.168.0.142:8081`). */
function extractLanIpv4(src: string): string | null {
  const m = String(src || '').match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
  return m && m[1] ? m[1] : null;
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
let cachedBackendRestApiBaseUrl: string | null = null;

/** Resolved once per Metro session — avoids console spam on every fetch. */
export function resolveBackendRestApiBaseUrl(): string {
  if (cachedBackendRestApiBaseUrl) {
    return cachedBackendRestApiBaseUrl;
  }
  cachedBackendRestApiBaseUrl = resolveBackendRestApiBaseUrlUncached();
  return cachedBackendRestApiBaseUrl;
}

function resolveBackendRestApiBaseUrlUncached(): string {
  const envApi = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  const envDevOnly = process.env.EXPO_PUBLIC_DEV_API_BASE_URL?.trim();
  const extraApi = readExtraString('apiBaseUrl');
  let primary = envApi || extraApi;
  const devEnv = envDevOnly || readExtraString('devApiBaseUrl');
  const restUseRender =
    process.env.EXPO_PUBLIC_REST_USE_RENDER === '1' ||
    process.env.EXPO_PUBLIC_REST_USE_RENDER === 'true';

  /** If set in `.env`, user chose REST host explicitly — do not override with `EXPO_PUBLIC_AI_API_URL`. */
  const restHostChosenInEnv = !!(envApi || envDevOnly);

  /** Expo web dev on this machine — always use loopback so browser hits the same local API as `npm start`. */
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    __DEV__
  ) {
    const browserHost = window.location.hostname.toLowerCase();
    if (browserHost === 'localhost' || browserHost === '127.0.0.1') {
      const u = ensureApiSuffix('http://localhost:3001');
      console.log('🔧 Backend REST API: web dev browser on localhost →', u);
      return u;
    }
  }

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

  // Physical iOS/Android in dev: `extra.apiBaseUrl` is usually Render, which makes the phone call
  // production while Metro/backend run on the LAN → RN "Network request failed". Prefer a private
  // LAN URL from networkDetection when we would otherwise use Render.
  if (
    isExpoDevelopmentProfile() &&
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
    Constants.isDevice &&
    primary &&
    /render\.com/i.test(primary)
  ) {
    try {
      const { recommendedApiUrl } = getNetworkInfo();
      const host = String(recommendedApiUrl || '').trim().replace(/\/$/, '');
      if (
        host &&
        !/render\.com/i.test(host) &&
        /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(host)
      ) {
        const u = ensureApiSuffix(host);
        console.log('🔧 Backend REST API: dev device → LAN (Render extra overridden) →', u);
        return u;
      }
    } catch {
      /* keep primary */
    }
  }

  // Native iOS/Android: localhost / 127.0.0.1 in env or baked `extra` often means "works on my Mac"
  // but (a) on a phone it targets the device, (b) on Simulator it can be stale while Metro is on
  // 192.168.x.x — fetch then fails with "Network request failed". Replace using Expo hostUri /
  // networkDetection whenever we can derive a non-loopback host. Do not gate on Constants.isDevice
  // (Simulator is false; ImagePicker paths can look like a device).
  if ((Platform.OS === 'ios' || Platform.OS === 'android') && primary && isLoopbackApiHost(primary)) {
    const expoConfig: any = Constants.expoConfig || (Constants as any).manifest;
    const hostUri: string | undefined =
      expoConfig?.hostUri ||
      expoConfig?.debuggerHost ||
      (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;

    let lanBase: string | undefined;
    const ipFromUri = hostUri ? extractPrivateLanIpv4(hostUri) : null;
    if (ipFromUri) {
      lanBase = ensureApiSuffix(`http://${ipFromUri}:3001`);
    }
    if (!lanBase) {
      try {
        const { recommendedApiUrl } = getNetworkInfo();
        const h = String(recommendedApiUrl || '').trim().replace(/\/$/, '');
        if (h && !isLoopbackApiHost(h) && /^https?:\/\//i.test(h)) {
          lanBase = ensureApiSuffix(h);
        }
      } catch {
        /* ignore */
      }
    }
    if (lanBase) {
      console.log('🔧 Backend REST API: native → loopback replaced with LAN (127.0.0.1 is the phone) →', lanBase);
      return lanBase;
    }
    console.warn(
      '🔧 Backend REST API: API URL is loopback but could not infer Mac LAN from Metro (hostUri). Set EXPO_PUBLIC_API_BASE_URL=http://<Mac-LAN-IP>:3001/api and restart Metro with -c — falling through past primary.',
    );
    primary = undefined;
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
    const maybeIp = extractLanIpv4(hostUri);
    if (maybeIp) {
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
