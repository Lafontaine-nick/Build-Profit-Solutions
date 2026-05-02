import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

function isClerkLikeKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes("clerk") || k.startsWith("__clerk");
}

/** Clerk sometimes persists to IndexedDB; stale DBs cause `fromJSON` crashes after SDK changes. */
async function clearClerkIndexedDb(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const dbs =
      typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
    for (const db of dbs) {
      const name = db?.name;
      if (name && isClerkLikeKey(name)) {
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.deleteDatabase(name);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
          req.onblocked = () => resolve();
        });
        if (__DEV__) console.warn(`[Clerk] Deleted IndexedDB: ${name}`);
      }
    }
  } catch (e) {
    console.warn("[Clerk] IndexedDB clear skipped:", e);
  }
}

/**
 * Clears Clerk persistence on web (localStorage, sessionStorage, AsyncStorage, IndexedDB).
 * Use when `clerk.headless.js` throws in `$t#fromJSON` — usually corrupted cache after Clerk upgrades or bad writes.
 *
 * One-shot: set `EXPO_PUBLIC_CLEAR_CLERK_WEB_CACHE=1` in `.env.local`, restart Metro once, then remove the line.
 */
export async function clearClerkWebCache(): Promise<void> {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  const removeLsKeys = (storage: Storage, label: string) => {
    try {
      const drop: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (!k) continue;
        if (isClerkLikeKey(k)) drop.push(k);
      }
      drop.forEach((k) => storage.removeItem(k));
      if (__DEV__ && drop.length) {
        console.warn(`[Clerk] Removed ${drop.length} ${label} keys`);
      }
    } catch (e) {
      console.warn(`[Clerk] ${label} clear failed:`, e);
    }
  };

  removeLsKeys(window.localStorage, "localStorage");
  removeLsKeys(window.sessionStorage, "sessionStorage");

  try {
    const keys = await AsyncStorage.getAllKeys();
    const clerkKeys = keys.filter(isClerkLikeKey);
    if (clerkKeys.length) {
      await AsyncStorage.multiRemove(clerkKeys);
      if (__DEV__) {
        console.warn(`[Clerk] Removed ${clerkKeys.length} AsyncStorage keys`);
      }
    }
  } catch (e) {
    console.warn("[Clerk] AsyncStorage clear failed:", e);
  }

  await clearClerkIndexedDb();
}
