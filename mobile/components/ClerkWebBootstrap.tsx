import React, { useEffect, useMemo, useState } from "react";
import { Platform, Text, View } from "react-native";
import { ClerkProvider as ClerkProviderExpo } from "@clerk/clerk-expo";
import { ClerkProvider as ClerkProviderWeb } from "@clerk/clerk-react";
import clerkTokenCache from "@/utils/clerkTokenCache";
import { clearClerkWebCache } from "@/utils/clearClerkWebCache";

/** Bump when Clerk SDK or cache shape changes — dev browsers run one heal before Clerk mounts. */
const DEV_CLERK_CACHE_PROTOCOL = "v7";

type Props = {
  publishableKey: string;
  children: React.ReactNode;
};

function webNeedsDevCacheHeal(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined" || !__DEV__) return false;
  try {
    return window.localStorage.getItem("__bps_clerk_cache_protocol") !== DEV_CLERK_CACHE_PROTOCOL;
  } catch {
    return true;
  }
}

function markDevCacheHealDone(): void {
  try {
    window.localStorage.setItem("__bps_clerk_cache_protocol", DEV_CLERK_CACHE_PROTOCOL);
  } catch {
    // ignore
  }
}

/**
 * On web, optionally clears Clerk browser cache before mounting ClerkProvider (see `clearClerkWebCache`).
 * Set `EXPO_PUBLIC_CLEAR_CLERK_WEB_CACHE=1` when fixing recurring `fromJSON` crashes in clerk.headless.js.
 * In __DEV__ on web, runs a one-time cache heal when `__bps_clerk_cache_protocol` is behind (fixes stale IndexedDB/localStorage).
 */
export default function ClerkWebBootstrap({ publishableKey, children }: Props) {
  const envForcedClear =
    Platform.OS === "web" &&
    typeof process !== "undefined" &&
    process.env?.EXPO_PUBLIC_CLEAR_CLERK_WEB_CACHE === "1";

  const devHeal = useMemo(() => webNeedsDevCacheHeal(), []);

  const needsClear = envForcedClear || devHeal;

  const [ready, setReady] = useState(!needsClear);

  useEffect(() => {
    if (!needsClear) return;
    let cancelled = false;
    void (async () => {
      await clearClerkWebCache();
      if (Platform.OS === "web" && __DEV__) markDevCacheHealDone();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [needsClear]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0b1c38",
        }}
      >
        <Text style={{ color: "#fff" }}>Preparing sign-in…</Text>
      </View>
    );
  }

  /**
   * Expo’s `ClerkProvider` treats web like a native client and can attach `Authorization`
   * to FAPI calls; browsers also send `Origin`, which Clerk rejects (`origin_authorization_headers_conflict`).
   * Use `@clerk/clerk-react`’s provider on web only. See clerk/javascript#3044.
   */
  if (Platform.OS === "web") {
    return (
      <ClerkProviderWeb publishableKey={publishableKey} standardBrowser>
        {children}
      </ClerkProviderWeb>
    );
  }

  return (
    <ClerkProviderExpo publishableKey={publishableKey} tokenCache={clerkTokenCache}>
      {children}
    </ClerkProviderExpo>
  );
}
