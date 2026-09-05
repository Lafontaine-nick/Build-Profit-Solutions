import { resolveBackendRestApiBaseUrl } from '@/utils/resolveBackendRestApiUrl';
import { clerkAuthService } from '@/services/clerkAuth';
import * as SecureStore from 'expo-secure-store';
import { entitlementToPlanId } from '@/constants/billingCatalog';

export type BillingEntitlementPayload = {
  success?: boolean;
  entitlement: string | null;
  status: string;
  isActive: boolean;
  expiresAt: string | null;
  gracePeriodExpiresAt: string | null;
  cancelAtPeriodEnd: boolean;
  productId: string | null;
  provider: string | null;
  planId: string | null;
};

const READ_TIMEOUT_MS = 15000;
const SYNC_TIMEOUT_MS = 45000;

async function getAuthToken(): Promise<string | null> {
  try {
    let token = clerkAuthService.getToken();
    if (!token) {
      token = await SecureStore.getItemAsync('__clerk_client_jwt');
    }
    return token;
  } catch {
    return null;
  }
}

async function fetchJson<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const base = resolveBackendRestApiBaseUrl().replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
    });
    const json = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) {
      throw new Error((json as { error?: string }).error || `Request failed (${response.status})`);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBillingEntitlement(): Promise<BillingEntitlementPayload> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Sign in required to verify subscription.');
  }

  const data = await fetchJson<BillingEntitlementPayload>(
    '/billing/entitlement',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    READ_TIMEOUT_MS,
  );

  return {
    ...data,
    planId: data.planId || entitlementToPlanId(data.entitlement),
  };
}

export async function syncBillingEntitlement(): Promise<BillingEntitlementPayload> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Sign in required to sync subscription.');
  }

  const data = await fetchJson<BillingEntitlementPayload>(
    '/billing/sync',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
    SYNC_TIMEOUT_MS,
  );

  return {
    ...data,
    planId: data.planId || entitlementToPlanId(data.entitlement),
  };
}
