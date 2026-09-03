import Constants from 'expo-constants';
import { getMetroBackendOrigin, getNetworkInfo } from './networkDetection';
import { resolveBackendRestApiBaseUrl } from './resolveBackendRestApiUrl';

const RENDER_API_BASE = 'https://build-profit-solutions-backend.onrender.com/api';

const normalizeApiBase = (raw?: string | null): string | null => {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

/** Candidate REST bases for product lookup — local/dev hosts first, Render last in dev. */
export const collectProductLookupApiBases = (): string[] => {
  const bases: string[] = [];
  const add = (raw?: string | null) => {
    const normalized = normalizeApiBase(raw);
    if (normalized && !bases.includes(normalized)) {
      bases.push(normalized);
    }
  };

  add(resolveBackendRestApiBaseUrl());
  add(getMetroBackendOrigin() ? `${getMetroBackendOrigin()}/api` : null);
  add(process.env.EXPO_PUBLIC_API_BASE_URL);
  add(process.env.EXPO_PUBLIC_DEV_API_BASE_URL);

  const extra = Constants.expoConfig?.extra as
    | { devApiBaseUrl?: string; apiBaseUrl?: string }
    | undefined;
  add(extra?.devApiBaseUrl);
  add(extra?.apiBaseUrl);

  const { recommendedApiUrl } = getNetworkInfo();
  if (recommendedApiUrl) {
    add(recommendedApiUrl);
  }

  if (__DEV__) {
    add(RENDER_API_BASE);
  } else {
    // Production: prefer deployed backend first if not already listed.
    const renderFirst = [RENDER_API_BASE, ...bases.filter((b) => b !== RENDER_API_BASE)];
    return renderFirst;
  }

  return bases;
};

export type ProductLookupRequestBody = {
  code: string;
  codeType?: string;
  sourceHint?: string;
  zip?: string;
};

export async function postProductsLookup(
  body: ProductLookupRequestBody,
  timeoutMs = 35000,
): Promise<{ product?: unknown; metadata?: unknown } | null> {
  const bases = collectProductLookupApiBases();

  for (const apiBase of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${apiBase}/products/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (data?.product) {
        console.log('✅ Product lookup succeeded via', apiBase);
        return data;
      }
    } catch (error) {
      console.warn(`Product lookup failed via ${apiBase}:`, error);
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
};
