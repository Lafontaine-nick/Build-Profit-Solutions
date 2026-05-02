import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const isWeb = Platform.OS === "web";

/**
 * Clerk session token persistence.
 * - **Native:** expo-secure-store (Keychain / Keystore).
 * - **Web:** AsyncStorage → localStorage. `expo-secure-store` is not viable on web; passing no
 *   token cache broke some `@clerk/clerk-expo` web flows; SecureStore-only threw or never persisted.
 */
export const clerkTokenCache = {
  async getToken(key: string): Promise<string | null> {
    if (isWeb) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (__DEV__) {
          console.log(
            `🔑 TokenCache [web]: ${key.substring(0, 24)}… → ${value ? "hit" : "miss"}`
          );
        }
        return value;
      } catch (error) {
        console.error("🔑 TokenCache [web] getItem error:", error);
        return null;
      }
    }
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value) {
        console.log(`🔑 TokenCache: Retrieved token for key: ${key.substring(0, 20)}... (exists: true)`);
      } else {
        console.log(`🔑 TokenCache: No token found for key: ${key.substring(0, 20)}... (exists: false)`);
      }
      return value ?? null;
    } catch (error) {
      console.error("🔑 TokenCache: SecureStore getItemAsync error:", error);
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    if (isWeb) {
      try {
        await AsyncStorage.setItem(key, value);
        if (__DEV__) {
          console.log(`🔑 TokenCache [web]: saved ${key.substring(0, 24)}… (len ${value.length})`);
        }
      } catch (error) {
        console.error("🔑 TokenCache [web] setItem error:", error);
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
      console.log(`🔑 TokenCache: Saved token for key: ${key.substring(0, 20)}... (length: ${value.length})`);
    } catch (error) {
      console.error("🔑 TokenCache: SecureStore setItemAsync error:", error);
      try {
        await SecureStore.setItemAsync(key, value);
        console.log(`🔑 TokenCache: Saved token (fallback method) for key: ${key.substring(0, 20)}...`);
      } catch (fallbackError) {
        console.error("🔑 TokenCache: Fallback save also failed:", fallbackError);
      }
    }
  },
  async removeToken(key: string): Promise<void> {
    if (isWeb) {
      try {
        await AsyncStorage.removeItem(key);
      } catch (error) {
        console.error("🔑 TokenCache [web] removeItem error:", error);
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
      console.log(`🔑 TokenCache: Removed token for key: ${key.substring(0, 20)}...`);
    } catch (error) {
      console.error("🔑 TokenCache: SecureStore deleteItemAsync error:", error);
    }
  },
};

export default clerkTokenCache;
