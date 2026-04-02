// API Service for connecting to Python backend
import { safeAsyncStorage } from '../utils/asyncStorage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type BetaFeedbackPayload = {
  feedbackType: string;
  description: string;
  severity?: string;
  intendedAction?: string;
  expectedResult?: string;
  screenshotData?: string | null;
  routeName?: string;
  featureArea?: string;
  projectId?: string;
  estimateId?: string;
  aiContextFlag?: boolean;
  appVersion?: string;
  platform?: string;
  deviceInfo?: string;
  email?: string;
  metadata?: Record<string, unknown>;
};

// Type definitions
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'contractor' | 'client' | 'admin';
  profile?: {
    company?: string;
    phone?: string;
    location?: string;
  };
  preferences?: {
    notifications?: boolean;
    theme?: 'light' | 'dark';
    language?: string;
  };
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  budget: number;
  startDate: string;
  endDate: string;
  clientId: string;
  contractorId?: string;
}

export interface Subcontractor {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  location: string;
  availability: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
}

export interface Analytics {
  revenue: number;
  projects: number;
  leads: number;
  conversionRate: number;
}

interface CacheItem {
  data: any;
  timestamp: number;
  expiresAt: number;
}

interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  endpoint: string;
  data: any;
  timestamp: number;
}

class ApiService {
  // ROOT CAUSE FIX: Production URL is hardcoded as default
  // This ensures the app ALWAYS works, even if config/env is wrong
  private readonly PRODUCTION_URL = 'https://build-profit-solutions-backend.onrender.com';

  // Use getter to always get current base URL
  private get baseUrl(): string {
    // Production URL is the default - ensures app works without local backend
    const PRODUCTION_URL = this.PRODUCTION_URL;
    
    // For iOS Simulator, check if explicitly configured to use localhost
    // Otherwise, fall through to production (same as physical devices)
    if (Platform.OS === 'ios' && !Constants.isDevice) {
      const useLocalhost = process.env.EXPO_PUBLIC_USE_LOCALHOST === 'true' || 
                          process.env.EXPO_PUBLIC_SIMULATOR_USE_LOCAL === 'true';
      if (useLocalhost) {
        if (!(this as any)._simulatorUrlLogged) {
          console.log('📱 iOS Simulator detected - using localhost:3001 (explicitly configured)');
          (this as any)._simulatorUrlLogged = true;
        }
        return 'http://localhost:3001';
      }
      // Fall through to production/default logic below
    }
    
    // For Android Emulator, check if explicitly configured to use localhost
    if (Platform.OS === 'android' && !Constants.isDevice) {
      const useLocalhost = process.env.EXPO_PUBLIC_USE_LOCALHOST === 'true' || 
                          process.env.EXPO_PUBLIC_EMULATOR_USE_LOCAL === 'true';
      if (useLocalhost) {
        if (!(this as any)._emulatorUrlLogged) {
          console.log('🤖 Android Emulator detected - using 10.0.2.2:3001 (explicitly configured)');
          (this as any)._emulatorUrlLogged = true;
        }
        return 'http://10.0.2.2:3001';
      }
      // Fall through to production/default logic below
    }
    
    // Log when simulator/emulator uses production (for debugging)
    if ((Platform.OS === 'ios' || Platform.OS === 'android') && !Constants.isDevice) {
      if (!(this as any)._simulatorProductionLogged) {
        console.log(`📱 ${Platform.OS === 'ios' ? 'iOS Simulator' : 'Android Emulator'} detected - using production backend (same as physical device)`);
        (this as any)._simulatorProductionLogged = true;
      }
    }
    
    const allowLocalBackend =
      process.env.EXPO_PUBLIC_USE_LOCALHOST === 'true' ||
      process.env.EXPO_PUBLIC_SIMULATOR_USE_LOCAL === 'true' ||
      process.env.EXPO_PUBLIC_EMULATOR_USE_LOCAL === 'true';

    // Check env URL, but only honor local IP URLs when explicitly enabled.
    const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (envUrl) {
      const url = envUrl.replace(/\/api$/, '');
      // Local env URLs can accidentally leak across devices/simulators.
      // Only use them when explicit local mode is enabled.
      if (url.includes('localhost') || url.includes('192.168') || url.includes('10.0.2.2')) {
        if (allowLocalBackend) {
          if (!(this as any)._localUrlWarned) {
            console.log('⚠️  Using LOCAL backend URL from env:', url);
            console.log('💡 Make sure backend is running: cd backend && npm start');
            (this as any)._localUrlWarned = true;
          }
          return url;
        }
        if (!(this as any)._localEnvIgnoredWarned) {
          console.log('⚠️  Ignoring LOCAL env backend URL because local mode is disabled:', url);
          console.log('✅ Falling back to production backend');
          (this as any)._localEnvIgnoredWarned = true;
        }
        return PRODUCTION_URL;
      }
      // If env URL is production, use it
      if (!(this as any)._envUrlLogged) {
        console.log('✅ Using backend URL from env:', url);
        (this as any)._envUrlLogged = true;
      }
      return url;
    }
    
    // Check Constants config (may be cached, so verify it's not local)
    const configUrl = Constants.expoConfig?.extra?.apiBaseUrl;
    if (configUrl) {
      const url = configUrl.replace(/\/api$/, '');
      // If config has local URL, ignore it and use production instead
      if (url.includes('localhost') || url.includes('192.168') || url.includes('10.0.2.2')) {
        if (!(this as any)._configLocalIgnored) {
          console.log('⚠️  Config has local URL, but using production instead:', url);
          console.log('✅ Defaulting to production backend for reliability');
          (this as any)._configLocalIgnored = true;
        }
        return PRODUCTION_URL;
      }
      // Config has production URL, use it
      if (!(this as any)._configUrlLogged) {
        console.log('✅ Using backend URL from config:', url);
        (this as any)._configUrlLogged = true;
      }
      return url;
    }
    
    // Default to production - this is the root cause fix
    if (!(this as any)._defaultUrlLogged) {
      console.log('✅ Using PRODUCTION backend (default):', PRODUCTION_URL);
      (this as any)._defaultUrlLogged = true;
    }
    return PRODUCTION_URL;
  }

  private cache: Map<string, CacheItem> = new Map();
  private syncQueue: SyncQueueItem[] = [];
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;

  private async getAuthToken(): Promise<string | null> {
    // Support both key formats used in the app to avoid auth drift across modules.
    const token =
      (await safeAsyncStorage.getItem('authToken')) ||
      (await safeAsyncStorage.getItem('auth_token'));
    return token;
  }

  constructor() {
    this.initializeNetworkListener();
    this.loadSyncQueue();
  }

  private async initializeNetworkListener() {
    this.isOnline = true;
  }

  private async loadSyncQueue() {
    try {
      const queueData = await safeAsyncStorage.getItem('syncQueue');
      if (queueData) {
        this.syncQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  private async saveSyncQueue() {
    try {
      await safeAsyncStorage.setItem(
        'syncQueue',
        JSON.stringify(this.syncQueue)
      );
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  // Network connectivity methods
  isConnected(): boolean {
    return this.isOnline;
  }

  // Test connection method with better error handling
  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/health`;
      if (__DEV__) {
        console.log('🔍 Testing backend connection to:', url);
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);
      if (__DEV__) {
        console.log('✅ Backend connection successful:', response.status);
      }
      return response.ok;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('⏱️  Backend connection test timed out');
        if (__DEV__) {
          console.log('🔍 Attempted URL was:', `${this.baseUrl}/health`);
        }
      } else {
        console.log('🌐 Backend connection test failed:', error.message || error);
        if (__DEV__) {
          console.log('🔍 Attempted URL was:', `${this.baseUrl}/health`);
        }
      }
      return false;
    }
  }

  // Authentication methods
  async checkAuthStatus(): Promise<{ isAuthenticated: boolean; user?: User }> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return { isAuthenticated: false };
      }

      const response = await this.makeRequest('/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });

      return { isAuthenticated: true, user: response.data };
    } catch (error) {
      return { isAuthenticated: false };
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.makeRequest('/api/auth/profile');
    return response.data;
  }

  async login(credentials: {
    email: string;
    password: string;
  }): Promise<{ user: User; token: string }> {
    const response = await this.makeRequest('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.data.token) {
      await safeAsyncStorage.setItem('authToken', response.data.token);
      await safeAsyncStorage.setItem('auth_token', response.data.token);
    }

    return response.data;
  }

  async register(userData: any): Promise<{ user: User; token: string }> {
    const response = await this.makeRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.data.token) {
      await safeAsyncStorage.setItem('authToken', response.data.token);
      await safeAsyncStorage.setItem('auth_token', response.data.token);
    }

    return response.data;
  }

  async logout(): Promise<void> {
    await safeAsyncStorage.removeItem('authToken');
    await safeAsyncStorage.removeItem('auth_token');
    this.cache.clear();
  }

  async deleteAccount(): Promise<void> {
    const response = await this.delete<{ success: boolean; message: string }>('/api/auth/account');
    return response.data;
  }

  async exportData(): Promise<any> {
    const response = await this.makeRequest('/api/auth/export');
    return response.data;
  }

  // Project methods
  async getProjects(): Promise<Project[]> {
    const response = await this.makeRequest('/api/projects');
    return response.data;
  }

  async getPublicProjects(): Promise<Project[]> {
    const response = await this.makeRequest('/api/projects/public');
    return response.data;
  }

  async createProject(project: Partial<Project>): Promise<Project> {
    const response = await this.makeRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
    return response.data;
  }

  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    const response = await this.makeRequest(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(project),
    });
    return response.data;
  }

  async deleteProject(id: string): Promise<void> {
    await this.makeRequest(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Subcontractor methods (using contractors endpoint)
  async getSubcontractors(filters?: any): Promise<Subcontractor[]> {
    const response = await this.makeRequest('/api/contractors', {
      query: filters,
    });
    return response.data;
  }

  async bookSubcontractor(id: string, bookingData: any): Promise<any> {
    const response = await this.makeRequest(`/api/contractors/${id}/book`, {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
    return response.data;
  }

  // Client methods (not implemented in backend - returning empty array)
  async getClients(): Promise<Client[]> {
    // This endpoint doesn't exist in backend, return empty array without making request
    if (__DEV__) {
      console.log('ℹ️  Clients endpoint not implemented, returning empty array');
    }
    return [];
  }

  async createClient(client: Partial<Client>): Promise<Client> {
    // This endpoint doesn't exist in backend, return the client data
    return client as Client;
  }

  async updateClient(id: string, client: Partial<Client>): Promise<Client> {
    // This endpoint doesn't exist in backend, return the client data
    return { ...client, id } as Client;
  }

  async deleteClient(id: string): Promise<void> {
    // This endpoint doesn't exist in backend, do nothing
    return;
  }

  // Analytics methods (using dashboard endpoint)
  async getAnalytics(): Promise<Analytics> {
    try {
      const response = await this.makeRequest('/api/dashboard');
      return response.data;
    } catch (error) {
      // Return default analytics if endpoint fails
      return {
        revenue: 0,
        projects: 0,
        leads: 0,
        conversionRate: 0,
      };
    }
  }

  async getPublicAnalytics(): Promise<Analytics> {
    // This endpoint doesn't exist, return default
    return {
      revenue: 0,
      projects: 0,
      leads: 0,
      conversionRate: 0,
    };
  }

  async getLeadAnalytics(): Promise<any> {
    const response = await this.makeRequest('/api/leads/analytics');
    return response.data;
  }

  // Lead methods
  async getLeads(filters?: any): Promise<any[]> {
    const response = await this.makeRequest('/api/leads', {
      query: filters,
    });
    return response.data;
  }

  async getLead(id: string): Promise<any> {
    const response = await this.makeRequest(`/api/leads/${id}`);
    return response.data;
  }

  async createLead(leadData: any): Promise<any> {
    const response = await this.makeRequest('/api/leads', {
      method: 'POST',
      body: JSON.stringify(leadData),
    });
    return response.data;
  }

  async updateLead(id: string, updates: any): Promise<any> {
    const response = await this.makeRequest(`/api/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  }

  async deleteLead(id: string): Promise<void> {
    await this.makeRequest(`/api/leads/${id}`, {
      method: 'DELETE',
    });
  }

  async scoreLead(leadData: any): Promise<any> {
    const response = await this.makeRequest('/api/leads/score', {
      method: 'POST',
      body: JSON.stringify(leadData),
    });
    return response.data;
  }

  async scheduleLeadFollowUp(leadId: string, followUpData: any): Promise<any> {
    const response = await this.makeRequest(`/api/leads/${leadId}/follow-up`, {
      method: 'POST',
      body: JSON.stringify(followUpData),
    });
    return response.data;
  }

  // Profile methods
  async updateProfile(profile: {
    firstName?: string;
    lastName?: string;
    name?: string;
    company?: string;
    phone?: string;
    location?: string;
  }): Promise<User> {
    const response = await this.makeRequest('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
    return response.data;
  }

  async updatePreferences(preferences: {
    notifications?: boolean;
    emailUpdates?: boolean;
    smsAlerts?: boolean;
    marketingEmails?: boolean;
    darkMode?: boolean;
  }): Promise<any> {
    const response = await this.makeRequest('/api/user-settings', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    });
    return response.data.settings;
  }

  // User settings methods (AI Project Manager Mode)
  async getUserSettings(): Promise<{
    ai_project_manager_mode: boolean;
    ai_manager_aggressiveness: string;
    ai_notify_about: string;
    ai_preferred_channel: string;
    darkMode?: boolean;
    notifications?: boolean;
    emailUpdates?: boolean;
    smsAlerts?: boolean;
    marketingEmails?: boolean;
  }> {
    try {
      const response = await this.makeRequest('/api/user-settings');
      return response.data.settings;
    } catch (error: any) {
      // If route not found, return default settings
      if (error.message?.includes('Route') && error.message?.includes('not found')) {
        console.log('⚠️  User settings route not available, using defaults');
        return {
          ai_project_manager_mode: false,
          ai_manager_aggressiveness: 'medium',
          ai_notify_about: 'all',
          ai_preferred_channel: 'in_app',
        };
      }
      throw error;
    }
  }

  /** Beta / launch feedback — requires auth; server must have BETA_FEEDBACK_INTAKE_ENABLED=true */
  async submitBetaFeedback(payload: BetaFeedbackPayload): Promise<{ id: number; createdAt?: string }> {
    const response = await this.makeRequest('/api/beta-feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.data?.success) {
      throw new Error(response.data?.error || 'Feedback submission failed');
    }
    return { id: response.data.id, createdAt: response.data.createdAt };
  }

  /** Lightweight telemetry — no-op on server when APP_TELEMETRY_ENABLED is not true */
  async trackAppEvent(
    event: string,
    properties?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.makeRequest('/api/telemetry/event', {
        method: 'POST',
        body: JSON.stringify({
          event,
          properties: properties || {},
          appVersion: Constants.expoConfig?.version || 'unknown',
          platform: Platform.OS,
        }),
      });
    } catch {
      // Never block UX on analytics
    }
  }

  async updateUserSettings(updates: {
    ai_project_manager_mode?: boolean;
    ai_manager_aggressiveness?: string;
    ai_notify_about?: string;
    ai_preferred_channel?: string;
  }): Promise<{
    ai_project_manager_mode: boolean;
    ai_manager_aggressiveness: string;
    ai_notify_about: string;
    ai_preferred_channel: string;
  }> {
    try {
      const response = await this.makeRequest('/api/user-settings', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return response.data.settings;
    } catch (error: any) {
      // If route not found, return the updates as if they were saved
      if (error.message?.includes('Route') && error.message?.includes('not found')) {
        console.log('⚠️  User settings route not available, using local defaults');
        return {
          ai_project_manager_mode: updates.ai_project_manager_mode ?? false,
          ai_manager_aggressiveness: updates.ai_manager_aggressiveness ?? 'medium',
          ai_notify_about: updates.ai_notify_about ?? 'all',
          ai_preferred_channel: updates.ai_preferred_channel ?? 'in_app',
        };
      }
      throw error;
    }
  }


  // HTTP method shortcuts
  async get<T>(endpoint: string, options: any = {}): Promise<{ data: T; status: number }> {
    return await this.makeRequest(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options: any = {}): Promise<{ data: T; status: number }> {
    return await this.makeRequest(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T>(endpoint: string, data?: any, options: any = {}): Promise<{ data: T; status: number }> {
    return await this.makeRequest(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T>(endpoint: string, options: any = {}): Promise<{ data: T; status: number }> {
    return await this.makeRequest(endpoint, { ...options, method: 'DELETE' });
  }

  // Core request method
  private async makeRequest(endpoint: string, options: any = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log('🌐 ApiService making request to:', url);
    console.log('🌐 ApiService baseUrl:', this.baseUrl);
    console.log('🌐 ApiService endpoint:', endpoint);
    const token = await this.getAuthToken();

    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const requestOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        // Try to get error message from response body
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // If response is not JSON, try text
          try {
            const text = await response.text();
            if (text) errorMessage = text;
          } catch (e2) {
            // Ignore if we can't read the response
          }
        }
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        throw error;
      }

      const data = await response.json();
      return { data, status: response.status };
    } catch (error) {
      // Only log errors, don't let them block Fast Refresh
      // Use console.warn instead of console.error to prevent error boundaries from triggering
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        // Silently handle network errors during development to not block Fast Refresh
        if (__DEV__) {
          console.warn('⚠️  Network request failed (non-blocking):', this.baseUrl);
        } else {
          console.error('API request failed:', error);
        }
        const networkError = new Error(
          `Cannot connect to backend at ${this.baseUrl}. ` +
          `Please ensure: 1) Backend is running 2) Correct IP address 3) Device can reach backend`
        );
        (networkError as any).status = 0;
        (networkError as any).isNetworkError = true;
        throw networkError;
      }
      
      // For other errors, still log but don't let them crash the app
      if (__DEV__) {
        console.warn('⚠️  API request error (non-blocking):', error);
      } else {
        console.error('API request failed:', error);
      }
      
      throw error;
    }
  }
}

export const apiService = new ApiService();
