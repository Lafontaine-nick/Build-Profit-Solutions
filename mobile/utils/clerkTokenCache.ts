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
        return value;
      } catch (error) {
        console.error("🔑 TokenCache [web] getItem error:", error);
        return null;
      }
    }
    try {
      const value = await SecureStore.getItemAsync(key);
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
      } catch (error) {
        console.error("🔑 TokenCache [web] setItem error:", error);
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } catch (error) {
      console.error("🔑 TokenCache: SecureStore setItemAsync error:", error);
      try {
        await SecureStore.setItemAsync(key, value);
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
    } catch (error) {
      console.error("🔑 TokenCache: SecureStore deleteItemAsync error:", error);
    }
  },
};

export default clerkTokenCache;
