import { clerkAuthService } from './clerkAuth';
import * as SecureStore from 'expo-secure-store';
import { resolveBackendRestApiBaseUrl } from '@/utils/resolveBackendRestApiUrl';

interface CheckoutSession {
  sessionId: string;
  url: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  stripePriceId: string;
  description?: string;
  tag?: string;
  cta?: string;
  recommended?: boolean;
}

/** Render cold start + Stripe can exceed 30s; align with checkout timeout expectations. */
const SUBSCRIPTION_FETCH_TIMEOUT_MS = 60000;
/** Plan verification reads should fail fast instead of waiting on a stale LAN backend. */
const SUBSCRIPTION_READ_TIMEOUT_MS = 12000;
/** Customer + checkout-session are two sequential fetches — abort if either hangs (wrong API URL / offline). */
const CHECKOUT_FETCH_TIMEOUT_MS = 60000;
/** Plan change is a single POST — fail fast enough to retry alternate backend. */
const CHANGE_PLAN_TIMEOUT_MS = 30000;
const RENDER_API_BASE = 'https://build-profit-solutions-backend.onrender.com/api';

/** Invalid legacy/env Business price on Render — live Stripe price that works for checkout/upgrades. */
const LIVE_BUSINESS_STRIPE_PRICE_ID = 'price_1THzFnAEo74nL2FWaVZo8JXA';
const LIVE_PREMIUM_STRIPE_PRICE_ID = 'price_1THzkTAEo74nL2FWxRsZvwXL';
const INVALID_BUSINESS_STRIPE_PRICE_IDS = new Set([
  'price_1SwOqmAEo74nL2FW6vCf983W',
  'price_business_monthly',
]);
const INVALID_PREMIUM_STRIPE_PRICE_IDS = new Set([
  'price_1SVnzKAEo74nL2FWI9JR5mW7',
  'price_premium_monthly',
]);

export function resolveLiveStripePriceId(planId: string, stripePriceId: string): string {
  if (
    planId === 'business' &&
    (!stripePriceId || INVALID_BUSINESS_STRIPE_PRICE_IDS.has(stripePriceId))
  ) {
    return LIVE_BUSINESS_STRIPE_PRICE_ID;
  }
  if (
    planId === 'premium' &&
    (!stripePriceId || INVALID_PREMIUM_STRIPE_PRICE_IDS.has(stripePriceId))
  ) {
    return LIVE_PREMIUM_STRIPE_PRICE_ID;
  }
  return stripePriceId;
}

function normalizeSubscriptionPlans(plans: SubscriptionPlan[]): SubscriptionPlan[] {
  return plans.map((plan) => ({
    ...plan,
    stripePriceId: resolveLiveStripePriceId(plan.id, plan.stripePriceId),
  }));
}

function isPrivateOrLocalApiUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
    url.trim()
  );
}

function isLiveStripePriceId(priceId: unknown): boolean {
  if (typeof priceId !== 'string') return false;
  const id = priceId.trim();
  return id.startsWith('price_') && !/_monthly$/i.test(id) && id.length > 12;
}

function catalogHasLivePriceIds(plans: SubscriptionPlan[]): boolean {
  return (
    plans.length > 0 &&
    plans.every((plan) => isLiveStripePriceId(plan.stripePriceId))
  );
}

function isNetworkFetchError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || error || '');
  return (
    message.includes('Network') ||
    message.includes('Failed to connect') ||
    message.includes('Network request failed') ||
    (error as { name?: string })?.name === 'AbortError' ||
    message.includes('aborted') ||
    message.includes('timed out')
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
  label: string,
): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => {
    controller.abort();
  }, ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(
        `${label} timed out after ${ms / 1000}s. Check EXPO_PUBLIC_API_BASE_URL matches a running backend (LAN IP on device, not localhost).`,
      );
    }
    throw e;
  } finally {
    clearTimeout(tid);
  }
}

class StripeService {
  /** Same host as AI / REST; avoids defaulting to Render when only EXPO_PUBLIC_AI_API_URL is set. */
  private get baseUrl(): string {
    return resolveBackendRestApiBaseUrl();
  }

  async createCheckoutSession(
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    userEmail?: string | null
  ): Promise<CheckoutSession> {
    console.log('🔑 Creating checkout session with:', { priceId, successUrl, cancelUrl });
    return this.createCheckoutSessionWithFallback(priceId, successUrl, cancelUrl, userEmail);
  }

  private async postJsonWithFallback<T>(
    path: string,
    body: unknown,
    token: string | null,
    label: string,
    timeoutMs: number,
    basesToTry: string[],
    retryOnApiError = false,
  ): Promise<{ data: T; baseUrl: string }> {
    const primaryBase = this.baseUrl;
    let lastError: unknown = null;
    let lastLocalNetworkError: unknown = null;

    for (let i = 0; i < basesToTry.length; i += 1) {
      const baseUrl = basesToTry[i];
      try {
        const response = await fetchWithTimeout(
          `${baseUrl.replace(/\/$/, '')}${path}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
          },
          timeoutMs,
          label,
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            (json as { error?: string; message?: string }).error ||
            (json as { message?: string }).message ||
            `${label} failed: HTTP ${response.status}`;
          const err = new Error(message) as Error & { status?: number };
          err.status = response.status;
          throw err;
        }
        if (baseUrl !== primaryBase) {
          console.warn(`⚠️ ${label} succeeded via alternate backend (${baseUrl}).`);
        }
        return { data: json as T, baseUrl };
      } catch (error) {
        lastError = error;
        if (isNetworkFetchError(error) && isPrivateOrLocalApiUrl(baseUrl)) {
          lastLocalNetworkError = error;
        }
        const message = String((error as Error)?.message || '');
        const status = (error as Error & { status?: number })?.status;
        const hasMore = i < basesToTry.length - 1;
        const canRetry =
          hasMore &&
          (isNetworkFetchError(error) ||
            status === 404 ||
            message.includes('Not Found') ||
            (retryOnApiError &&
              message.match(/No such price|inactive|not configured|Invalid API Key/i)));
        if (canRetry) {
          console.warn(`⚠️ ${label} failed on ${baseUrl}. Trying next backend…`);
          continue;
        }
        break;
      }
    }
    if (
      lastLocalNetworkError &&
      lastError instanceof Error &&
      /not found|404/i.test(lastError.message)
    ) {
      throw lastLocalNetworkError instanceof Error
        ? lastLocalNetworkError
        : new Error(String(lastLocalNetworkError));
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError || label));
  }

  private getHostedFirstBillingBases(): string[] {
    const primaryBase = this.baseUrl.replace(/\/$/, '');
    if (isPrivateOrLocalApiUrl(primaryBase)) {
      return [RENDER_API_BASE, primaryBase];
    }
    return [primaryBase];
  }

  /** Plan changes hit production Stripe — prefer hosted API on LAN dev (same as checkout). */
  private getChangePlanBillingBases(): string[] {
    return this.getHostedFirstBillingBases();
  }

  async changeSubscriptionPlan(
    priceId: string,
    userEmail?: string | null,
  ): Promise<{ success: boolean; planName?: string; error?: string }> {
    if (!priceId?.startsWith('price_')) {
      return { success: false, error: 'Invalid plan price configuration' };
    }

    let email = userEmail?.trim() || '';
    let token: string | null = null;
    try {
      token = clerkAuthService.getToken();
      if (!token) {
        const clerkToken = await SecureStore.getItemAsync('__clerk_client_jwt');
        if (clerkToken) token = clerkToken;
      }
      if (!email) {
        const authState = clerkAuthService.getAuthState();
        email = authState?.user?.email || '';
      }
    } catch {
      // optional
    }

    if (!email) {
      return { success: false, error: 'Could not determine account email for plan change.' };
    }

    try {
      const livePriceId = INVALID_BUSINESS_STRIPE_PRICE_IDS.has(priceId)
        ? LIVE_BUSINESS_STRIPE_PRICE_ID
        : priceId;
      const { data } = await this.postJsonWithFallback<{
        success?: boolean;
        planName?: string;
        error?: string;
      }>(
        '/stripe/change-plan',
        { email, priceId: livePriceId },
        token,
        'Subscription plan change',
        CHANGE_PLAN_TIMEOUT_MS,
        this.getChangePlanBillingBases(),
        true,
      );
      if (data.success) {
        return { success: true, planName: data.planName };
      }
      return { success: false, error: data.error || 'Plan change failed' };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Plan change failed' };
    }
  }

  async createCheckoutSessionWithFallback(
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    userEmail?: string | null,
  ): Promise<CheckoutSession> {
    let email = userEmail || 'test@example.com';
    let name = 'Test User';
    let token: string | null = null;

    try {
      token = clerkAuthService.getToken();
      if (!token) {
        const clerkToken = await SecureStore.getItemAsync('__clerk_client_jwt');
        if (clerkToken) token = clerkToken;
      }
      if (!email || email === 'test@example.com') {
        const authState = clerkAuthService.getAuthState();
        if (authState?.user) {
          email = authState.user.email || email;
          name = `${authState.user.firstName || ''} ${authState.user.lastName || ''}`.trim() || name;
        }
      }
    } catch {
      // optional
    }

    const { data: customerData } = await this.postJsonWithFallback<{ customerId: string }>(
      '/stripe/customer',
      { email, name },
      token,
      'Stripe customer request',
      CHECKOUT_FETCH_TIMEOUT_MS,
      this.getHostedFirstBillingBases(),
      true,
    );

    const { data: sessionData } = await this.postJsonWithFallback<{
      sessionId: string;
      url: string;
    }>(
      '/stripe/create-checkout-session',
      {
        customerId: customerData.customerId,
        priceId: INVALID_BUSINESS_STRIPE_PRICE_IDS.has(priceId)
          ? LIVE_BUSINESS_STRIPE_PRICE_ID
          : priceId,
        successUrl,
        cancelUrl,
      },
      token,
      'Stripe checkout session',
      CHECKOUT_FETCH_TIMEOUT_MS,
      this.getHostedFirstBillingBases(),
      true,
    );

    return { sessionId: sessionData.sessionId, url: sessionData.url };
  }

  async getCustomerSubscriptions(
    email?: string | null,
    options?: { preferHosted?: boolean; timeoutMs?: number },
  ): Promise<any[]> {
    if (!email?.trim()) {
      return [];
    }

    let token: string | null = null;
    try {
      token = clerkAuthService.getToken();
      if (!token) {
        const clerkToken = await SecureStore.getItemAsync('__clerk_client_jwt');
        if (clerkToken) token = clerkToken;
      }
    } catch {
      // Token optional for subscription lookup by email.
    }

    const userEmail = email.trim();
    const primaryBase = this.baseUrl;
    const preferHosted = options?.preferHosted !== false;
    const timeoutMs = options?.timeoutMs ?? SUBSCRIPTION_READ_TIMEOUT_MS;

    let basesToTry: string[];
    if (options?.preferHosted === false) {
      basesToTry = isPrivateOrLocalApiUrl(primaryBase)
        ? [primaryBase, RENDER_API_BASE]
        : [primaryBase];
    } else if (isPrivateOrLocalApiUrl(primaryBase)) {
      basesToTry = [RENDER_API_BASE, primaryBase];
    } else {
      basesToTry = [primaryBase];
    }

    let lastError: unknown = null;
    for (const baseUrl of basesToTry) {
      try {
        const subscriptions = await this.fetchSubscriptionsFromBase(
          baseUrl,
          userEmail,
          token,
          timeoutMs,
        );
        if (baseUrl !== primaryBase && preferHosted) {
          console.warn('⚠️ Subscriptions loaded from hosted backend.');
        }
        return subscriptions;
      } catch (error) {
        lastError = error;
        const hasMore = basesToTry.indexOf(baseUrl) < basesToTry.length - 1;
        if (hasMore && isNetworkFetchError(error)) {
          console.warn(`⚠️ Subscription fetch failed on ${baseUrl}. Trying next backend…`);
          continue;
        }
        break;
      }
    }

    if (isNetworkFetchError(lastError)) {
      console.warn(
        '⚠️ Could not verify subscription (backend offline). Using cached plan if available.',
      );
    } else {
      console.warn('⚠️ Could not fetch subscriptions:', (lastError as Error)?.message || lastError);
    }
    return [];
  }

  private async fetchSubscriptionsFromBase(
    baseUrl: string,
    userEmail: string,
    token: string | null,
    timeoutMs: number = SUBSCRIPTION_READ_TIMEOUT_MS,
  ): Promise<any[]> {
    const url = `${baseUrl.replace(/\/$/, '')}/stripe/subscriptions?email=${encodeURIComponent(userEmail)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetchWithTimeout(
      url,
      { method: 'GET', headers },
      timeoutMs,
      'Subscription fetch',
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        (errorData as { error?: string }).error ||
          `Failed to fetch subscriptions: ${response.status}`,
      );
    }

    const data = (await response.json()) as { subscriptions?: unknown[] };
    return Array.isArray(data.subscriptions) ? data.subscriptions : [];
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      let token: string | null = null;
      try {
        token = clerkAuthService.getToken();
        if (!token) {
          const clerkToken = await SecureStore.getItemAsync('__clerk_client_jwt');
          if (clerkToken) {
            token = clerkToken;
            console.log('✅ Got Clerk token from SecureStore for cancel');
          }
        }
      } catch (e) {
        console.log('Could not get Clerk token from SecureStore');
      }

      console.log('🚫 Cancelling subscription:', subscriptionId);
      
      const response = await fetch(
        `${this.baseUrl}/stripe/cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ subscriptionId }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('❌ Cancel subscription error:', error);
        throw new Error(error.error || 'Failed to cancel subscription');
      }

      const data = await response.json();
      console.log('✅ Subscription cancelled successfully');
      return data.success === true;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Stripe Checkout only allows https:// success/cancel URLs (not custom schemes).
   * These hit our API, which returns HTML that opens `buildprofitsolutions://payment/…`.
   * Include Stripe’s session placeholder on success so the app can verify if needed later.
   */
  getCheckoutRedirectUrls(): { successUrl: string; cancelUrl: string } {
    return {
      successUrl: `${this.baseUrl}/stripe/checkout-return?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${this.baseUrl}/stripe/checkout-cancel`,
    };
  }

  /**
   * Loads plans from the backend (Render env STRIPE_PRICE_* + live Stripe amounts).
   * Falls back to getMockSubscriptionPlans() if the API is unreachable or misconfigured.
   */
  async fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const primaryBase = this.baseUrl;
    // Billing catalog should prefer hosted Stripe env when developing against a local API.
    const basesToTry = isPrivateOrLocalApiUrl(primaryBase)
      ? [RENDER_API_BASE, primaryBase]
      : [primaryBase];

    for (const baseUrl of basesToTry) {
      const url = `${baseUrl.replace(/\/$/, '')}/stripe/mobile-plans`;
      try {
        const response = await fetchWithTimeout(
          url,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } },
          SUBSCRIPTION_FETCH_TIMEOUT_MS,
          'Subscription plans catalog',
        );
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          console.warn('⚠️ mobile-plans HTTP', response.status, err);
          continue;
        }
        const data = (await response.json()) as { success?: boolean; plans?: SubscriptionPlan[] };
        if (data.success && Array.isArray(data.plans) && data.plans.length > 0) {
          if (!catalogHasLivePriceIds(data.plans)) {
            if (baseUrl === primaryBase && basesToTry.length > 1) {
              console.warn('⚠️ Plan catalog has placeholder Stripe price IDs. Trying hosted backend…');
              continue;
            }
          }
          if (baseUrl !== primaryBase) {
            console.warn('⚠️ Plan catalog loaded from hosted backend.');
          }
          return normalizeSubscriptionPlans(data.plans);
        }
      } catch (e) {
        if (baseUrl !== basesToTry[basesToTry.length - 1] && isNetworkFetchError(e)) {
          console.warn('⚠️ Plan catalog fetch failed, trying next backend…');
          continue;
        }
        console.warn('⚠️ fetchSubscriptionPlans failed, using embedded catalog:', e);
      }
    }
    return normalizeSubscriptionPlans(this.getMockSubscriptionPlans());
  }

  /** Same as getCheckoutRedirectUrls but for payment-method setup flows (manage-cards screen). */
  getPaymentMethodCheckoutRedirectUrls(): { successUrl: string; cancelUrl: string } {
    return {
      successUrl: `${this.baseUrl}/stripe/checkout-return-manage-cards?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${this.baseUrl}/stripe/checkout-cancel-manage-cards`,
    };
  }

  getMockSubscriptionPlans(): SubscriptionPlan[] {
    return [
      {
        id: 'basic',
        name: 'Basic Plan',
        price: 45,
        description: 'Get started with essential tools for solo contractors.',
        tag: 'Starter',
        cta: 'Start with Basic',
        features: [
          '3–5 active projects',
          'Basic project dashboard',
          'Material & labor costing',
          'AI Estimate Assistant (lite usage)',
          'Save/export estimates (BPS branding)',
          'Leads tab (view only)',
          'Simple customer CRM',
          'Email support',
        ],
        stripePriceId: 'price_1THzBgAEo74nL2FWYjwMWqcX',
      },
      {
        id: 'premium',
        name: 'Professional Plan',
        price: 89,
        description: 'Built to protect margins and scale profitably.',
        tag: 'Most Popular',
        recommended: true,
        cta: 'Upgrade to Professional',
        features: [
          'Unlimited projects',
          'Full AI Estimator',
          'Custom branded estimate PDFs',
          'Live job costing & profitability tracking',
          'Overhead & markup automation',
          'Full Leads tab (filters + management)',
          'Budget vs. actuals tracking',
          'Find Subcontractors & verified directory (full access)',
          'Price spike alerts',
          'Supplier integrations',
          'Priority support',
        ],
        stripePriceId: 'price_1THzkTAEo74nL2FWxRsZvwXL',
      },
      {
        id: 'business',
        name: 'Business Plan',
        price: 179,
        description:
          'One company workspace with up to 5 team seats, individual logins, shared project records, and role-based access for growing construction teams.',
        tag: 'Business Team Workspace',
        cta: 'Upgrade to Business',
        features: [
          'Company workspace',
          'Up to 5 team seats',
          'Individual team logins',
          'Shared project records',
          'Notes, expenses, logs, and calendar events',
          'Role-based access foundation',
          'Activity tracking foundation',
        ],
        stripePriceId: 'price_1THzFnAEo74nL2FWaVZo8JXA',
      },
    ];
  }
}

export const stripeService = new StripeService();
