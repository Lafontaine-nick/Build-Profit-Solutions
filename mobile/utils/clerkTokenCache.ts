import * as SecureStore from 'expo-secure-store';

// Token cache for Clerk Expo to securely persist sessions on device
// This ensures users stay logged in even after closing and reopening the app
export const clerkTokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value) {
        console.log(`🔑 TokenCache: Retrieved token for key: ${key.substring(0, 20)}... (exists: true)`);
      } else {
        console.log(`🔑 TokenCache: No token found for key: ${key.substring(0, 20)}... (exists: false)`);
      }
      return value ?? null;
    } catch (error) {
      console.error('🔑 TokenCache: SecureStore getItemAsync error:', error);
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      // Use AFTER_FIRST_UNLOCK for better persistence across app restarts
      // This allows tokens to be accessible after the device is first unlocked,
      // which provides better persistence while maintaining security
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
      console.log(`🔑 TokenCache: Saved token for key: ${key.substring(0, 20)}... (length: ${value.length})`);
    } catch (error) {
      console.error('🔑 TokenCache: SecureStore setItemAsync error:', error);
      // Fallback: try without keychainAccessible option if the above fails
      try {
        await SecureStore.setItemAsync(key, value);
        console.log(`🔑 TokenCache: Saved token (fallback method) for key: ${key.substring(0, 20)}...`);
      } catch (fallbackError) {
        console.error('🔑 TokenCache: Fallback save also failed:', fallbackError);
      }
    }
  },
  async removeToken(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
      console.log(`🔑 TokenCache: Removed token for key: ${key.substring(0, 20)}...`);
    } catch (error) {
      console.error('🔑 TokenCache: SecureStore deleteItemAsync error:', error);
    }
  },
};

export default clerkTokenCache;
