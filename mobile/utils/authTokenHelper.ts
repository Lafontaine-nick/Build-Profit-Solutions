import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Utility functions to check and fix authentication token issues
 */

export interface TokenStatus {
  hasToken: boolean;
  tokenLength: number;
  tokenPreview: string;
  source: 'AsyncStorage' | 'Clerk' | 'none';
  isValid: boolean;
}

/**
 * Check the current authentication token status
 */
export async function checkAuthTokenStatus(): Promise<TokenStatus> {
  try {
    // Check AsyncStorage first (where BackendAPI looks)
    const token = await AsyncStorage.getItem('auth_token');
    
    if (token) {
      return {
        hasToken: true,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 20) + '...',
        source: 'AsyncStorage',
        isValid: token.length > 20, // Basic validation - JWT tokens are usually longer
      };
    }
    
    // Token not found
    return {
      hasToken: false,
      tokenLength: 0,
      tokenPreview: '',
      source: 'none',
      isValid: false,
    };
  } catch (error) {
    console.error('Error checking auth token:', error);
    return {
      hasToken: false,
      tokenLength: 0,
      tokenPreview: '',
      source: 'none',
      isValid: false,
    };
  }
}

/**
 * Sync Clerk token to AsyncStorage for BackendAPI compatibility
 * Call this after Clerk authentication succeeds
 */
export async function syncClerkTokenToAsyncStorage(
  clerkToken: string,
  email?: string | null
): Promise<boolean> {
  try {
    await AsyncStorage.setItem('auth_token', clerkToken);
    await AsyncStorage.setItem('authToken', clerkToken);
    if (email && email.trim()) {
      await AsyncStorage.setItem('auth_email', email.trim().toLowerCase());
    }
    console.log('✅ Synced Clerk token to AsyncStorage (auth_token + authToken)');
    return true;
  } catch (error) {
    console.error('❌ Failed to sync Clerk token to AsyncStorage:', error);
    return false;
  }
}

/**
 * Clear authentication token (useful for debugging or logout)
 */
export async function clearAuthToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('authToken');
    console.log('✅ Cleared auth token from AsyncStorage');
  } catch (error) {
    console.error('❌ Failed to clear auth token:', error);
  }
}

/**
 * Get authentication token with fallback to Clerk
 * This is a helper that can be used in components
 */
export async function getAuthTokenWithFallback(getClerkToken?: () => Promise<string | null>): Promise<string | null> {
  const isExpired = (token: string | null): boolean => {
    if (!token) return true;
    try {
      const payload = token.split('.')[1];
      if (!payload) return false;
      const decoded = JSON.parse(
        decodeURIComponent(
          Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
            .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
            .join('')
        )
      );
      return typeof decoded.exp === 'number' && decoded.exp <= Date.now() / 1000;
    } catch {
      return false;
    }
  };

  // Clerk is authoritative and refreshes an expired session token. AsyncStorage
  // can contain yesterday's JWT, so reading it first causes AI/photo requests
  // to reach the backend with an expired token even after the user is signed in.
  if (getClerkToken) {
    const clerkToken = await getClerkToken();
    if (clerkToken && !isExpired(clerkToken)) {
      await syncClerkTokenToAsyncStorage(clerkToken);
      return clerkToken;
    }
  }
  
  // Legacy fallback for non-Clerk/dev flows.
  const token =
    (await AsyncStorage.getItem('auth_token')) ||
    (await AsyncStorage.getItem('authToken'));
  if (token && !isExpired(token)) return token;

  return null;
}

/**
 * Debug function to print current auth status
 */
export async function debugAuthStatus(): Promise<void> {
  const status = await checkAuthTokenStatus();
  console.log('🔍 Auth Token Status:', {
    hasToken: status.hasToken,
    tokenLength: status.tokenLength,
    source: status.source,
    isValid: status.isValid,
    preview: status.tokenPreview,
  });
  
  if (!status.hasToken) {
    console.warn('⚠️ No auth token found! User needs to log in.');
  } else if (!status.isValid) {
    console.warn('⚠️ Auth token found but appears invalid (too short).');
  } else {
    console.log('✅ Auth token appears valid.');
  }
}
