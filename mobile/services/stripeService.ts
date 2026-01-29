import { clerkAuthService } from './clerkAuth';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

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

class StripeService {
  // Use a getter so it always gets the current value, not cached at class instantiation
  private get baseUrl(): string {
    // Get base URL from Constants (same as other services)
    const configUrl = Constants.expoConfig?.extra?.apiBaseUrl;
    if (configUrl) {
      // If it already includes /api, use as is, otherwise add it
      const url = configUrl.endsWith('/api') ? configUrl : `${configUrl}/api`;
      console.log('🔧 StripeService using API URL from Constants:', url);
      return url;
    }
    
    // Fallback to env variable
    const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (envUrl) {
      const url = envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
      console.log('🔧 StripeService using API URL from env:', url);
      return url;
    }
    
    // Default to production URL
    console.warn('⚠️ StripeService defaulting to production URL - Constants.expoConfig?.extra?.apiBaseUrl not available');
    return 'https://build-profit-solutions-backend.onrender.com/api';
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
      const customerResponse = await fetch(
        `${this.baseUrl}/stripe/customer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ email, name }),
        }
      );

      if (!customerResponse.ok) {
        const error = await customerResponse.json();
        throw new Error(error.error || 'Failed to create customer');
      }

      const { customerId } = await customerResponse.json();

      // Then create checkout session
      const sessionResponse = await fetch(
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
        }
      );

      if (!sessionResponse.ok) {
        const error = await sessionResponse.json();
        const errorMessage = error.error || 'Failed to create checkout session';
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
      
      // Create an AbortController for timeout - shorter timeout for better UX
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('⏱️ Subscription fetch timeout after 10 seconds - aborting request');
        controller.abort();
      }, 10000); // 10 second timeout
      
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
          throw new Error('Request timed out. Please check your network connection and ensure the backend is accessible.');
        }
        
        if (fetchError.message?.includes('Network') || fetchError.message?.includes('Failed to connect')) {
          console.error('🌐 Network connection error:', fetchError.message);
          throw new Error(`Cannot connect to backend at ${this.baseUrl}. Please check: 1) Backend is running 2) Correct IP address 3) Device/simulator can reach backend`);
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

  getMockSubscriptionPlans(): SubscriptionPlan[] {
    return [
      {
        id: 'basic',
        name: 'Basic Plan',
        price: 25,
        description: 'Lead magnet plan that gets contractors onboard fast.',
        tag: 'Starter',
        cta: 'Start with Basic',
        features: [
          '5 active projects',
          'Basic project dashboard',
          'Material & labor costing',
          'AI Estimate Assistant (Lite usage)',
          'Save/export estimates (BPS branding)',
          'Basic Leads tab (view only)',
          'Customer database (simple CRM)',
          'Email support',
          'Subcontractor directory (view only)',
        ],
        stripePriceId: 'price_1S61YbAEo74nL2FWa0EZt4CE',
      },
      {
        id: 'premium',
        name: 'Professional Plan',
        price: 49,
        description: 'Best for growing contractors who want full automation.',
        tag: 'Most Popular',
        recommended: true,
        cta: 'Upgrade to Professional',
        features: [
          'Unlimited projects',
          'Full AI Estimator (high usage cap)',
          'Custom branded estimate PDFs',
          'Live project profitability tracking',
          'Overhead/markup automation',
          'Full Leads tab (filters + management)',
          'Job costing & budget tracking',
          'Team collaboration (1 additional user)',
          'Email + priority in-app support',
          'Subcontractor marketplace (full access)',
          'Price spike alerts & supplier integrations',
        ],
        stripePriceId: 'price_1S61YbAEo74nL2FWJQzrcFFG',
      },
      {
        id: 'business',
        name: 'Business Plan',
        price: 79,
        description: 'For GC teams that need forecasting, AI bids, and integrations.',
        tag: 'Teams',
        cta: 'Scale with Business',
        features: [
          'Everything in Professional',
          '5 team members included',
          'Role-based permissions',
          'Advanced analytics & forecasting',
          'Profit simulation tools',
          'Project health alerts',
          'AI Bid Optimization (premium prompts)',
          'Automated lead follow-up templates',
          'Invoice generation & payment tracking',
          'Custom integrations (QuickBooks, Zapier, Gmail)',
        ],
        stripePriceId: 'price_1SVnzKAEo74nL2FWPLqMUFfs',
      },
    ];
  }
}

export const stripeService = new StripeService();
