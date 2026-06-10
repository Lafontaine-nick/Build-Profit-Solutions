import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getNetworkInfo } from './networkDetection';

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
    | { appEnv?: string; isDevelopment?: boolean; devApiBaseUrl?: string }
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

  const envBase = process.env.EXPO_PUBLIC_AI_API_URL;
  if (envBase && typeof envBase === 'string') {
    return stripApiBaseSuffix(envBase);
  }

  if (Platform.OS === 'ios' && Constants.isDevice === false) {
    return 'http://localhost:3001';
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:3001';
  }

  if (Platform.OS === 'android' && Constants.isDevice === false) {
    return 'http://10.0.2.2:3001';
  }

  // Physical device / Expo Go: match REST API LAN detection (Metro IP can go stale after DHCP changes).
  if (Platform.OS !== 'web' && Constants.isDevice) {
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
  const primaryBase = `${resolveAiBaseUrl()}/api/ai-assistant`;
  const primaryUrl = `${primaryBase}${path}`;
  const urls = [primaryUrl];

  const isSimulator = Platform.OS === 'ios' && Constants.isDevice === false;
  const isWeb = Platform.OS === 'web';
  const isAndroidEmulator = Platform.OS === 'android' && Constants.isDevice === false;

  if (
    !primaryUrl.includes('localhost') &&
    !primaryUrl.includes('127.0.0.1') &&
    (isSimulator || isWeb || isAndroidEmulator)
  ) {
    urls.push(`http://localhost:3001/api/ai-assistant${path}`);
  }

  if (
    primaryUrl.includes('localhost') ||
    primaryUrl.includes('192.168.') ||
    primaryUrl.includes('10.0.2.2')
  ) {
    urls.push(`${PRODUCTION_AI_API}${path}`);
  }

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
      errors.push(new Error(errMsg));
    } catch (error: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
    }
  }

  const last = errors[errors.length - 1];
  if (last?.message === 'Network request failed') {
    throw new Error(
      'Could not reach the AI backend. Start the backend on your Mac (npm start in backend/) and confirm your phone is on the same Wi‑Fi.'
    );
  }
  throw last || new Error('All connection attempts failed');
}

async function fetchWithFallback(
  urls: string[],
  options: RequestInit,
  timeout = 60000
): Promise<Response> {
  return fetchBackendWithFallback(urls, options, timeout);
}

export async function postAiAssistantJson<T>(
  routePath: string,
  body: unknown,
  timeout = 60000
): Promise<T> {
  const urls = buildAiAssistantEndpointUrls(routePath);
  if (__DEV__) {
    console.log('🤖 AI POST', routePath, '→', urls[0], urls.length > 1 ? `(+${urls.length - 1} fallbacks)` : '');
  }

  const response = await fetchWithFallback(
    urls,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeout
  );

  return response.json() as Promise<T>;
}
