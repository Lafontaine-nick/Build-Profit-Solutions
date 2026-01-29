import Constants from 'expo-constants';
import { apiService } from './api';

export interface PaymentMethod {
  id: string;
  type?: 'card';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  customerId?: string;
  createdAt: string;
}

class PaymentMethodService {
  // Use a getter so it always gets the current value, not cached at class instantiation
  private get baseUrl(): string {
    const configUrl = Constants.expoConfig?.extra?.apiBaseUrl;
    if (configUrl) {
      const url = configUrl.endsWith('/api') ? configUrl : `${configUrl}/api`;
      console.log('🔧 PaymentMethodService using API URL from Constants:', url);
      return url;
    }
    
    const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (envUrl) {
      const url = envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
      console.log('🔧 PaymentMethodService using API URL from env:', url);
      return url;
    }
    
    console.warn('⚠️ PaymentMethodService defaulting to production URL - Constants.expoConfig?.extra?.apiBaseUrl not available');
    return 'https://build-profit-solutions-backend.onrender.com/api';
  }

  async getPaymentMethods(email?: string | null): Promise<PaymentMethod[]> {
    try {
      // Get email from auth service if not provided
      let userEmail = email;
      if (!userEmail) {
        try {
          const { clerkAuthService } = await import('./clerkAuth');
          const authState = clerkAuthService.getAuthState();
          userEmail = authState?.user?.email || null;
        } catch (e) {
          // Try AsyncStorage as fallback
          try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const profileData = await AsyncStorage.getItem('bps.contractorProfile');
            if (profileData) {
              const profile = JSON.parse(profileData);
              userEmail = profile.email || null;
            }
          } catch (e2) {
            // Could not get email
          }
        }
      }

      if (!userEmail) {
        console.warn('⚠️ No email found for fetching payment methods');
        return [];
      }

      console.log('💳 Fetching payment methods for:', userEmail);
      const endpoint = `/api/payment-methods?email=${encodeURIComponent(userEmail)}`;
      console.log('🌐 Calling endpoint:', endpoint);
      const response = await apiService.get<PaymentMethod[]>(endpoint);
      const methods = response?.data || [];
      console.log('✅ Payment methods response:', methods?.length || 0, 'methods');
      return methods;
    } catch (error: any) {
      console.error('❌ Failed to get payment methods:', error);
      // If 404 or any error, return empty array (customer might not exist yet)
      // This is not a fatal error - user just doesn't have payment methods yet
      if (error?.message?.includes('404') || error?.message?.includes('not found')) {
        console.log('ℹ️ 404 - Customer not found or no payment methods - returning empty array');
        return [];
      }
      // For any other error, also return empty array (graceful degradation)
      console.log('ℹ️ Returning empty array due to error (non-fatal)');
      return [];
    }
  }

  async setDefaultPaymentMethod(paymentMethodId: string, email?: string | null): Promise<void> {
    try {
      // Get email if not provided
      let userEmail = email;
      if (!userEmail) {
        try {
          const { clerkAuthService } = await import('./clerkAuth');
          const authState = clerkAuthService.getAuthState();
          userEmail = authState?.user?.email || null;
        } catch (e) {
          try {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const profileData = await AsyncStorage.getItem('bps.contractorProfile');
            if (profileData) {
              const profile = JSON.parse(profileData);
              userEmail = profile.email || null;
            }
          } catch (e2) {}
        }
      }

      if (!userEmail) {
        throw new Error('Email is required to set default payment method');
      }

      await apiService.put(`/api/payment-methods/${paymentMethodId}/set-default`, { email: userEmail });
    } catch (error: any) {
      console.error('Failed to set default payment method:', error);
      throw error;
    }
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await apiService.delete(`/api/payment-methods/${paymentMethodId}`);
    } catch (error: any) {
      console.error('Failed to delete payment method:', error);
      throw error;
    }
  }

  async createCheckoutSessionForPaymentMethod(
    email: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string; customerId: string }> {
    try {
      console.log('💳 Creating checkout session for adding payment method');
      const response = await apiService.post<{ sessionId: string; url: string; customerId: string }>(
        '/api/payment-methods/checkout-session',
        {
          email,
          successUrl,
          cancelUrl,
        }
      );
      return response?.data || { sessionId: '', url: '', customerId: '' };
    } catch (error: any) {
      console.error('Failed to create checkout session:', error);
      throw error;
    }
  }

  async addPaymentMethod(setupIntentClientSecret: string): Promise<PaymentMethod> {
    try {
      const response = await apiService.post<PaymentMethod>('/api/payment-methods', {
        setupIntentClientSecret,
      });
      return response?.data || {} as PaymentMethod;
    } catch (error: any) {
      console.error('Failed to add payment method:', error);
      throw error;
    }
  }
}

export const paymentMethodService = new PaymentMethodService();

