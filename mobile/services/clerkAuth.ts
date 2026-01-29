import { safeAsyncStorage } from '../utils/asyncStorage';
import Constants from 'expo-constants';

// Get API base URL
const getApiBaseUrl = () => {
  return Constants.expoConfig?.extra?.apiBaseUrl || 
         process.env.EXPO_PUBLIC_API_BASE_URL || 
         'https://build-profit-solutions-backend.onrender.com/api';
};

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  role?: 'contractor' | 'admin';
  subscription?: {
    plan: 'basic' | 'premium';
    status: 'active' | 'inactive' | 'cancelled';
    expiresAt?: string;
  };
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
}

class ClerkAuthService {
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true,
  };

  private listeners: ((state: AuthState) => void)[] = [];

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      const token = await safeAsyncStorage.getItem('auth_token');
      const userData = await safeAsyncStorage.getItem('user_data');

      if (token && userData) {
        this.authState = {
          isAuthenticated: true,
          user: JSON.parse(userData),
          token,
          loading: false,
        };
      } else {
        this.authState.loading = false;
      }

      this.notifyListeners();
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      this.authState.loading = false;
      this.notifyListeners();
    }
  }

  async signUp(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) {
    try {
      this.authState.loading = true;
      this.notifyListeners();

      const apiBaseUrl = getApiBaseUrl();
      const url = apiBaseUrl.endsWith('/api') 
        ? `${apiBaseUrl}/auth/signup` 
        : `${apiBaseUrl}/api/auth/signup`;

      console.log('Sign up URL:', url);

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            firstName,
            lastName,
          }),
        });
      } catch (fetchError: any) {
        console.error('Fetch error:', fetchError);
        throw new Error('Network error. Please check your connection and ensure the backend is running.');
      }

      let responseData;
      try {
        responseData = await response.json();
      } catch (e) {
        // If response is not JSON, it might be a network error
        throw new Error('Network error. Please check your connection and try again.');
      }

      if (!response.ok) {
        // Handle different error formats
        let errorMessage = responseData.error || 
                          responseData.message || 
                          (responseData.details && responseData.details[0]?.msg) ||
                          'Sign up failed';
        
        // Include details if available (for debugging)
        if (responseData.details && typeof responseData.details === 'string') {
          errorMessage = responseData.details;
        } else if (responseData.details && Array.isArray(responseData.details) && responseData.details.length > 0) {
          errorMessage = responseData.details[0].msg || errorMessage;
        }
        
        console.error('Signup API error:', {
          status: response.status,
          error: responseData.error,
          message: responseData.message,
          details: responseData.details
        });
        
        // Use the message from backend if available, it's more specific
        const finalErrorMessage = responseData.message || errorMessage;
        throw new Error(finalErrorMessage);
      }

      const { user, token } = responseData;

      // Normalize user data (backend might return first_name/last_name)
      const normalizedUser = {
        ...user,
        firstName: user.first_name || user.firstName,
        lastName: user.last_name || user.lastName,
      };

      await this.setAuthState(normalizedUser, token);
      return { success: true, user: normalizedUser };
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message || 'Failed to create account. Please try again.');
    } finally {
      this.authState.loading = false;
      this.notifyListeners();
    }
  }

  async signIn(email: string, password: string) {
    try {
      this.authState.loading = true;
      this.notifyListeners();

      const apiBaseUrl = getApiBaseUrl();
      const url = apiBaseUrl.endsWith('/api') 
        ? `${apiBaseUrl}/auth/signin` 
        : `${apiBaseUrl}/api/auth/signin`;

      console.log('Sign in URL:', url);

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
          }),
        });
      } catch (fetchError: any) {
        console.error('Fetch error:', fetchError);
        throw new Error('Network error. Please check your connection and ensure the backend is running.');
      }

      let responseData;
      try {
        responseData = await response.json();
      } catch (e) {
        // If response is not JSON, it might be a network error
        throw new Error('Network error. Please check your connection and try again.');
      }

      if (!response.ok) {
        // Handle different error formats
        const errorMessage = responseData.error || 
                            responseData.message || 
                            'Invalid email or password';
        throw new Error(errorMessage);
      }

      const { user, token } = responseData;

      // Normalize user data (backend might return first_name/last_name)
      const normalizedUser = {
        ...user,
        firstName: user.first_name || user.firstName,
        lastName: user.last_name || user.lastName,
      };

      await this.setAuthState(normalizedUser, token);
      return { success: true, user: normalizedUser };
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(error.message || 'Invalid email or password. Please try again.');
    } finally {
      this.authState.loading = false;
      this.notifyListeners();
    }
  }

  async signOut() {
    try {
      await safeAsyncStorage.removeItem('auth_token');
      await safeAsyncStorage.removeItem('user_data');

      this.authState = {
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
      };

      this.notifyListeners();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  async updateProfile(updates: Partial<User>) {
    try {
      if (!this.authState.token) {
        throw new Error('Not authenticated');
      }

      const apiBaseUrl = getApiBaseUrl();
      const url = apiBaseUrl.endsWith('/api') 
        ? `${apiBaseUrl}/auth/profile` 
        : `${apiBaseUrl}/api/auth/profile`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authState.token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Profile update failed');
      }

      const updatedUser = await response.json();

      // Normalize user data (backend returns first_name/last_name, we need firstName/lastName)
      const normalizedUser = {
        ...this.authState.user,
        ...updatedUser.user || updatedUser,
        firstName: (updatedUser.user || updatedUser).first_name || (updatedUser.user || updatedUser).firstName,
        lastName: (updatedUser.user || updatedUser).last_name || (updatedUser.user || updatedUser).lastName,
      };

      this.authState.user = normalizedUser;
      await safeAsyncStorage.setItem(
        'user_data',
        JSON.stringify(normalizedUser)
      );

      this.notifyListeners();
      return { success: true, user: normalizedUser };
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }

  private async setAuthState(user: User, token: string) {
    this.authState = {
      isAuthenticated: true,
      user,
      token,
      loading: false,
    };

    await safeAsyncStorage.setItem('auth_token', token);
    await safeAsyncStorage.setItem('user_data', JSON.stringify(user));

    this.notifyListeners();
  }

  getAuthState(): AuthState {
    return { ...this.authState };
  }

  getToken(): string | null {
    return this.authState.token;
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  addListener(listener: (state: AuthState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.getAuthState()));
  }

  async refreshToken() {
    try {
      if (!this.authState.token) {
        throw new Error('No token to refresh');
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/auth/refresh`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.authState.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const { token } = await response.json();
      await safeAsyncStorage.setItem('auth_token', token);

      this.authState.token = token;
      this.notifyListeners();
    } catch (error) {
      console.error('Token refresh error:', error);
      await this.signOut();
    }
  }
}

export const clerkAuthService = new ClerkAuthService();
export default clerkAuthService;
