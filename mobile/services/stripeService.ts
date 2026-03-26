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
/** Customer + checkout-session are two sequential fetches — abort if either hangs (wrong API URL / offline). */
const CHECKOUT_FETCH_TIMEOUT_MS = 60000;

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
    try {
      console.log('🔑 Creating checkout session with:', {
        priceId,
        successUrl,
        cancelUrl,
      });
      // Use provided email, or try to get from auth service
      let email = userEmail || 'test@example.com';
      let name = 'Test User';
      let token = null;

      try {
        token = clerkAuthService.getToken();
        
        // If not found, try to get from Clerk's SecureStore
        if (!token) {
          try {
            const clerkToken = await SecureStore.getItemAsync('__clerk_client_jwt');
            if (clerkToken) {
              token = clerkToken;
            }
          } catch (e) {
            // Could not get token
          }
        }
        
        // If email not provided, try to get from auth state
        if (!email || email === 'test@example.com') {
          const authState = clerkAuthService.getAuthState();
          if (authState?.user) {
            email = authState.user.email || email;
            name = `${authState.user.firstName || ''} ${authState.user.lastName || ''}`.trim() || name;
          }
        }
        
        console.log('📧 Using email for checkout:', email);
      } catch (error) {
        console.log('Using provided email or fallback:', email);
      }

      // First, create or get Stripe customer
      const customerResponse = await fetchWithTimeout(
        `${this.baseUrl}/stripe/customer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ email, name }),
        },
        CHECKOUT_FETCH_TIMEOUT_MS,
        'Stripe customer request',
      );

      if (!customerResponse.ok) {
        const error = await customerResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create customer');
      }

      const { customerId } = await customerResponse.json();

      // Then create checkout session
      const sessionResponse = await fetchWithTimeout(
        `${this.baseUrl}/stripe/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            customerId,
            priceId,
            successUrl,
            cancelUrl,
          }),
        },
        CHECKOUT_FETCH_TIMEOUT_MS,
        'Stripe checkout session',
      );

      if (!sessionResponse.ok) {
        const error = await sessionResponse.json().catch(() => ({}));
        const errorMessage = (error as { error?: string }).error || 'Failed to create checkout session';
        console.error('❌ Checkout session error:', errorMessage);
        
        // Check if it's a price not found error
        if (errorMessage.includes('No such price') || errorMessage.includes('resource_missing')) {
          throw new Error(`The ${priceId.includes('Business') ? 'Business' : priceId.includes('Professional') ? 'Professional' : 'plan'} plan has not been created in Stripe yet. Please create it in your Stripe Dashboard or contact support.`);
        }
        
        throw new Error(errorMessage);
      }

      const { sessionId, url } = await sessionResponse.json();
      return { sessionId, url };
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  async getCustomerSubscriptions(email?: string | null): Promise<any[]> {
    try {
      // Try to get Clerk JWT token from SecureStore (optional - backend doesn't require it)
      let token = clerkAuthService.getToken();
      
      // If not found, try to get from Clerk's SecureStore
      if (!token) {
        try {
          // Clerk stores tokens with keys like __clerk_client_jwt
          const clerkToken = await SecureStore.getItemAsync('__clerk_client_jwt');
          if (clerkToken) {
            token = clerkToken;
            console.log('✅ Got Clerk token from SecureStore');
          }
        } catch (e) {
          console.log('Could not get Clerk token from SecureStore');
        }
      }
      
      // Note: Token is optional - backend uses email from query param
      if (!email) {
        console.log('⚠️ No email provided for subscription fetch');
        return [];
      }

      // Use provided email, or try to get from Clerk
      let userEmail = email;
      if (!userEmail) {
        try {
          const authState = clerkAuthService.getAuthState();
          if (authState?.user) {
            userEmail = authState.user.email;
          }
        } catch (error) {
          console.log('Could not get user email from clerkAuthService');
        }
      }

      // Build URL with email query param if available
      let url = `${this.baseUrl}/stripe/subscriptions`;
      if (userEmail) {
        url += `?email=${encodeURIComponent(userEmail)}`;
      }

      console.log('🔍 Fetching subscriptions from:', url);
      console.log('🔍 Base URL being used:', this.baseUrl);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(
          `⏱️ Subscription fetch timeout after ${SUBSCRIPTION_FETCH_TIMEOUT_MS / 1000}s — aborting (host may be cold-starting or unreachable)`,
        );
        controller.abort();
      }, SUBSCRIPTION_FETCH_TIMEOUT_MS);

      try {
        console.log('📡 Making fetch request...');
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('📡 Response received - status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Failed to fetch subscriptions:', response.status, errorData);
          throw new Error(errorData.error || `Failed to fetch subscriptions: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ Subscriptions fetched successfully:', data.subscriptions?.length || 0);
        return data.subscriptions || [];
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
          console.error('⏱️ Subscription fetch was aborted/timed out');
          throw new Error(
            `Request timed out after ${SUBSCRIPTION_FETCH_TIMEOUT_MS / 1000}s. If you use a local backend from a phone, set EXPO_PUBLIC_API_BASE_URL to your Mac’s LAN URL (same as the AI API). Hosted APIs may need a moment to wake up — try again.`,
          );
        }

        if (fetchError.message?.includes('Network') || fetchError.message?.includes('Failed to connect')) {
          console.error('🌐 Network connection error:', fetchError.message);
          throw new Error(
            `Cannot connect to backend at ${this.baseUrl}. Check the server is running, firewall/VPN, and on a real device use your LAN IP (not localhost).`,
          );
        }
        
        console.error('❌ Fetch error details:', {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack?.substring(0, 200),
        });
        // Re-throw the error instead of silently returning empty array
        throw fetchError;
      }
    } catch (error: any) {
      console.error('❌ Error fetching subscriptions:', error);
      // Re-throw so the caller can handle it properly
      throw error;
    }
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
        price: 29,
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
        stripePriceId: 'price_1SVnzJAEo74nL2FWW479mvXJ',
      },
      {
        id: 'premium',
        name: 'Professional Plan',
        price: 79,
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
          'Subcontractor marketplace (full access)',
          'Price spike alerts',
          'Supplier integrations',
          'Priority support',
        ],
        stripePriceId: 'price_1SVnzKAEo74nL2FWI9JR5mW7',
      },
      {
        id: 'business',
        name: 'Business Plan',
        price: 149,
        description: 'For teams that need forecasting, AI optimization, and integrations.',
        tag: 'Teams',
        cta: 'Scale with Business',
        features: [
          'Everything in Professional',
          '5–10 team members',
          'Role-based permissions',
          'Advanced analytics & forecasting',
          'Profit simulation tools',
          'AI Bid Optimization (premium)',
          'Invoice generation & payment tracking',
          'Custom integrations (QuickBooks, Zapier, Gmail)',
          'Dedicated account support',
        ],
        stripePriceId: 'price_1SwOqmAEo74nL2FW6vCf983W',
      },
    ];
  }
}

export const stripeService = new StripeService();
