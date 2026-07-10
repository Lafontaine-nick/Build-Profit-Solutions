import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getMetroBackendOrigin, getNetworkInfo } from './networkDetection';

/** Hosted backend origin (no path). TestFlight / App Store builds must use this on cellular, not LAN. */
export const PRODUCTION_AI_ORIGIN = 'https://build-profit-solutions-backend.onrender.com';
export const PRODUCTION_AI_API = `${PRODUCTION_AI_ORIGIN}/api/ai-assistant`;

function stripApiBaseSuffix(url: string): string {
  return url.replace(/\/api\/?$/, '').replace(/\/$/, '') || url;
}

function isNonPublicDevBackendBase(base: string): boolean {
  const b = (base || '').trim().toLowerCase();
  if (!b) return true;
  if (b.includes('localhost') || b.includes('127.0.0.1') || b.includes('0.0.0.0')) return true;
  if (b.includes('192.168.')) return true;
  if (b.includes('10.0.2.2')) return true;
  try {
    const normalized = /^[a-z]+:\/\//i.test(b) ? b : `http://${b}`;
    const u = new URL(normalized);
    const h = u.hostname;
    if (/^10\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
    if (/^169\.254\./.test(h)) return true;
  } catch {
    return false;
  }
  return false;
}

/**
 * Backend origin for AI routes (no `/api` suffix).
 * Matches AI Assistant resolution so estimate-draft hits the same host.
 */
export function resolveAiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as
    | { appEnv?: string; isDevelopment?: boolean; devApiBaseUrl?: string; aiApiUrl?: string }
    | undefined;
  const isProductionApp =
    process.env.EXPO_PUBLIC_APP_ENV === 'production' || extra?.appEnv === 'production';

  if (isProductionApp) {
    const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
    if (apiBase) {
      const candidate = stripApiBaseSuffix(apiBase);
      if (candidate.startsWith('https://') && !isNonPublicDevBackendBase(candidate)) {
        return candidate;
      }
    }

    const aiOnly = process.env.EXPO_PUBLIC_AI_API_URL?.trim();
    if (aiOnly && /^https:\/\//i.test(aiOnly) && !isNonPublicDevBackendBase(aiOnly)) {
      try {
        const origin = new URL(aiOnly).origin;
        if (!isNonPublicDevBackendBase(origin)) {
          return origin;
        }
      } catch {
        /* fall through */
      }
    }

    return PRODUCTION_AI_ORIGIN;
  }

  // Simulator/emulator first — baked LAN IPs in .env go stale after DHCP; loopback always works.
  if (Platform.OS === 'ios' && Constants.isDevice === false) {
    return 'http://localhost:3001';
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:3001';
  }

  if (Platform.OS === 'android' && Constants.isDevice === false) {
    return 'http://10.0.2.2:3001';
  }

  const envBase =
    process.env.EXPO_PUBLIC_AI_API_URL?.trim() ||
    extra?.aiApiUrl?.trim();
  if (envBase) {
    return stripApiBaseSuffix(envBase);
  }

  // Physical device: Metro host IP is authoritative — phone already reached the Mac at this address.
  if (Platform.OS !== 'web' && Constants.isDevice) {
    const metroOrigin = getMetroBackendOrigin();
    if (metroOrigin) {
      return metroOrigin;
    }

    const explicitApiBase =
      process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
      process.env.EXPO_PUBLIC_DEV_API_BASE_URL?.trim() ||
      (extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl?.trim() ||
      extra?.devApiBaseUrl?.trim();

    if (explicitApiBase) {
      const configured = stripApiBaseSuffix(explicitApiBase);
      if (isNonPublicDevBackendBase(configured) && !configured.includes('192.168.1.115')) {
        return configured;
      }
    }

    try {
      const { recommendedApiUrl } = getNetworkInfo();
      const origin = stripApiBaseSuffix(String(recommendedApiUrl || ''));
      if (origin && !/render\.com/i.test(origin)) {
        return origin;
      }
    } catch {
      /* fall through */
    }
  }

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_DEV_API_BASE_URL ||
    extra?.devApiBaseUrl;

  if (apiBaseUrl) {
    const base = stripApiBaseSuffix(String(apiBaseUrl));
    if (!base.includes('192.168.1.115')) {
      return base;
    }
  }

  const expoConfig: any = Constants.expoConfig || (Constants as any).manifest;
  const hostUri: string | undefined =
    expoConfig?.hostUri ||
    expoConfig?.debuggerHost ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const maybeIp = typeof hostUri === 'string' ? hostUri.split(':')[0] : undefined;
    if (maybeIp && /^\d{1,3}(\.\d{1,3}){3}$/.test(maybeIp)) {
      return `http://${maybeIp}:3001`;
    }
  }

  const isProdBundle = extra?.isDevelopment !== true;
  if (isProdBundle && Constants.isDevice === true && Platform.OS !== 'web') {
    return PRODUCTION_AI_ORIGIN;
  }

  return 'http://localhost:3001';
}

/** Build candidate URLs for an AI Assistant route (with fallbacks). */
export function buildAiAssistantEndpointUrls(routePath: string): string[] {
  const path = routePath.startsWith('/') ? routePath : `/${routePath}`;
  const urls: string[] = [];
  const extra = Constants.expoConfig?.extra as
    | { apiBaseUrl?: string; devApiBaseUrl?: string; aiApiUrl?: string }
    | undefined;

  const pushOrigin = (base: string) => {
    const origin = stripApiBaseSuffix(String(base || '').trim());
    if (!origin || origin.includes('192.168.1.115')) return;
    urls.push(`${origin}/api/ai-assistant${path}`);
  };

  const isSimulator = Platform.OS === 'ios' && Constants.isDevice === false;
  const isWeb = Platform.OS === 'web';
  const isAndroidEmulator = Platform.OS === 'android' && Constants.isDevice === false;

  if (!isSimulator && !isAndroidEmulator) {
    if (Platform.OS !== 'web' && Constants.isDevice) {
      pushOrigin(getMetroBackendOrigin() || '');
    }
    pushOrigin(process.env.EXPO_PUBLIC_AI_API_URL || extra?.aiApiUrl || '');
    pushOrigin(process.env.EXPO_PUBLIC_API_BASE_URL || '');
    pushOrigin(process.env.EXPO_PUBLIC_DEV_API_BASE_URL || '');
    pushOrigin(extra?.apiBaseUrl || '');
    pushOrigin(extra?.devApiBaseUrl || '');
  }

  pushOrigin(resolveAiBaseUrl());

  if (!isSimulator && !isAndroidEmulator) {
    try {
      const { recommendedApiUrl } = getNetworkInfo();
      pushOrigin(String(recommendedApiUrl || ''));
    } catch {
      /* ignore */
    }
  }

  if (isSimulator || isWeb || isAndroidEmulator) {
    pushOrigin('http://localhost:3001');
    if (Platform.OS === 'android') pushOrigin('http://10.0.2.2:3001');
  }

  const deduped = [...new Set(urls)];
  const hasLanCandidate = deduped.some(
    (u) =>
      /192\.168\.|10\.0\.2\.2|localhost|127\.0\.0\.1/i.test(u) && !/render\.com/i.test(u)
  );
  // Dev + LAN configured: do not fall through to hosted Render (often missing/stale OPENAI_API_KEY).
  if (__DEV__ && hasLanCandidate) {
    return deduped.filter((u) => !/render\.com/i.test(u));
  }

  pushOrigin(PRODUCTION_AI_ORIGIN);

  return [...new Set(urls)];
}

/** Candidate URLs for pricing-engine / contractor-pricing-memory routes. */
export function buildPricingApiEndpointUrls(
  routePath: string,
  apiPath = '/api/contractor-pricing-memory'
): string[] {
  const path = routePath.startsWith('/') ? routePath : `/${routePath}`;
  const normalizedApiPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const urls: string[] = [];

  const pushOrigin = (base: string) => {
    const origin = stripApiBaseSuffix(String(base || '').trim());
    if (!origin) return;
    urls.push(`${origin}${normalizedApiPath}${path}`);
  };

  pushOrigin(resolveAiBaseUrl());

  try {
    const { recommendedApiUrl } = getNetworkInfo();
    pushOrigin(String(recommendedApiUrl || ''));
  } catch {
    /* ignore */
  }

  const isSimulator = Platform.OS === 'ios' && Constants.isDevice === false;
  const isWeb = Platform.OS === 'web';
  const isAndroidEmulator = Platform.OS === 'android' && Constants.isDevice === false;

  if (isSimulator || isWeb || isAndroidEmulator) {
    pushOrigin('http://localhost:3001');
    if (Platform.OS === 'android') pushOrigin('http://10.0.2.2:3001');
  }

  pushOrigin(PRODUCTION_AI_ORIGIN);

  return [...new Set(urls)];
}

/** LAN / loopback: fail fast so we can fall back to production instead of hanging ~60s. */
function timeoutMsForUrl(url: string, defaultTimeout: number, lanTimeout = 8000): number {
  if (/^https:\/\/[^/]*render\.com/i.test(url)) return defaultTimeout;
  if (/192\.168\.|10\.0\.2\.2|localhost|127\.0\.0\.1/i.test(url)) return lanTimeout;
  return defaultTimeout;
}

export async function fetchBackendWithFallback(
  urls: string[],
  options: RequestInit,
  timeout = 60000,
  lanTimeout = 8000
): Promise<Response> {
  const errors: Error[] = [];

  for (const url of urls) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const attemptTimeout = timeoutMsForUrl(url, timeout, lanTimeout);
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), attemptTimeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      let errMsg = `HTTP ${response.status}`;
      try {
        const body = await response.clone().json().catch(() => ({}));
        if (body?.message) errMsg = body.message;
        else if (body?.error) errMsg = body.error;
      } catch {
        /* ignore */
      }
      // 4xx (except 404) means this backend handled the request — don't keep
      // trying other URLs and accidentally mask the real error as "unreachable".
      if (response.status >= 400 && response.status < 500 && response.status !== 404) {
        throw new Error(errMsg);
      }
      errors.push(new Error(errMsg));
    } catch (error: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
    }
  }

  const last = errors[errors.length - 1];
  const hadLanCandidate = urls.some(
    (u) => /192\.168\.|10\.0\.2\.2|localhost|127\.0\.0\.1/i.test(u) && !/render\.com/i.test(u)
  );
  const lanReachabilityError = errors.find(
    (e) =>
      e.message === 'Network request failed' ||
      /^aborted$/i.test(e.message) ||
      e.message.includes('AbortError')
  );
  if (__DEV__ && hadLanCandidate && lanReachabilityError) {
    throw new Error(
      'Could not reach the AI backend. Start the backend on your Mac (npm start in backend/) and confirm your phone is on the same Wi‑Fi.'
    );
  }
  if (last?.message === 'Network request failed') {
    throw new Error(
      'Could not reach the AI backend. Start the backend on your Mac (npm start in backend/) and confirm your phone is on the same Wi‑Fi.'
    );
  }
  throw last || new Error('All connection attempts failed');
}

/** User-facing copy for Build with AI / estimate-draft failures. */
export function formatEstimateAiError(error: unknown): string {
  const raw = String((error instanceof Error ? error.message : error) || '').trim();

  if (
    raw.includes('Could not reach the AI backend') ||
    raw.includes('Network request failed') ||
    raw.includes('Failed to fetch')
  ) {
    return (
      'Could not reach your backend.\n\n' +
      'On your Mac, run: cd backend && npm run dev\n' +
      'Set EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_IP:3001/api in mobile/.env (current Mac IP: check System Settings → Wi‑Fi), restart Expo with npx expo start -c\n' +
      'Keep your phone on the same Wi‑Fi. On iOS: Settings → Privacy & Security → Local Network → enable this app.'
    );
  }

  if (/premature close|api\.openai\.com|OPENAI_API_KEY on the server \(Render/i.test(raw)) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      return (
        'Could not reach your Mac backend on Wi‑Fi.\n\n' +
        'On your Mac, run: cd backend && npm run dev\n' +
        'Set EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_IP:3001/api in mobile/.env, then restart Expo: npx expo start -c\n' +
        'Keep your phone on the same Wi‑Fi. On iOS: Settings → Privacy & Security → Local Network → enable this app.'
      );
    }
    return (
      'The AI service on the server could not reach OpenAI.\n\n' +
      'If you are on a dev build: start the backend on your Mac (npm run dev in backend/) and stay on the same Wi‑Fi.\n\n' +
      'For TestFlight/production: update OPENAI_API_KEY on Render to match a working key, then restart the service.'
    );
  }

  if (/billing|quota|insufficient/i.test(raw)) {
    return 'OpenAI reported a billing or quota issue for the API key on your server. Add credits or update the key on Render.';
  }

  if (/^aborted$/i.test(raw) || raw.includes('AbortError')) {
    return (
      'The draft request timed out or could not reach your backend.\n\n' +
      'On your Mac, run: cd backend && npm run dev\n' +
      'Confirm your phone is on the same Wi‑Fi and EXPO_PUBLIC_API_BASE_URL uses your Mac’s current LAN IP, then try again.'
    );
  }

  return raw || 'Something went wrong while parsing your notes. Please try again.';
}

function originFromAssistantUrl(url: string): string {
  return url.replace(/\/api\/ai-assistant.*$/i, '').replace(/\/$/, '');
}

/** Quick /health probe so unreachable LAN backends fail in ~8s instead of hanging ~90s on POST. */
async function filterReachableAiAssistantUrls(urls: string[], probeMs = 8000): Promise<string[]> {
  const byOrigin = new Map<string, string[]>();
  for (const url of urls) {
    const origin = originFromAssistantUrl(url);
    const list = byOrigin.get(origin) || [];
    list.push(url);
    byOrigin.set(origin, list);
  }

  const reachableOrigins: string[] = [];
  for (const origin of byOrigin.keys()) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), probeMs);
      const res = await fetch(`${origin}/health`, { method: 'GET', signal: controller.signal });
      if (timeoutId) clearTimeout(timeoutId);
      if (res.ok) reachableOrigins.push(origin);
    } catch {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  if (reachableOrigins.length === 0) {
    const lanOnly = [...byOrigin.keys()].every(
      (o) => /192\.168\.|10\.0\.2\.2|localhost|127\.0\.0\.1/i.test(o) && !/render\.com/i.test(o)
    );
    if (lanOnly) {
      throw new Error(
        'Could not reach the AI backend. Start the backend on your Mac (npm start in backend/) and confirm your phone is on the same Wi‑Fi.'
      );
    }
    return urls;
  }

  const reachable = urls.filter((u) => reachableOrigins.includes(originFromAssistantUrl(u)));
  const unreachable = urls.filter((u) => !reachableOrigins.includes(originFromAssistantUrl(u)));
  return [...reachable, ...unreachable];
}

export async function postAiAssistantJson<T>(
  routePath: string,
  body: unknown,
  timeout = 90000
): Promise<T> {
  const urls = buildAiAssistantEndpointUrls(routePath);
  const reachableUrls = await filterReachableAiAssistantUrls(urls);
  if (__DEV__) {
    console.log(
      '🤖 AI POST',
      routePath,
      '→',
      reachableUrls[0],
      reachableUrls.length > 1 ? `(+${reachableUrls.length - 1} fallbacks)` : ''
    );
  }

  // OpenAI-backed routes often exceed the 8s LAN fail-fast window — use the full timeout.
  const response = await fetchBackendWithFallback(
    reachableUrls,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeout,
    timeout
  );

  return response.json() as Promise<T>;
}
