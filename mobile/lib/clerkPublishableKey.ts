import Constants from 'expo-constants';

function trimKey(value: string | undefined): string | undefined {
  if (value == null || typeof value !== 'string') return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Resolve Clerk publishable key everywhere (native + web).
 * On Metro web, `Constants.expoConfig.extra` is sometimes incomplete; fall back to manifest
 * and inlined `EXPO_PUBLIC_*` (see Expo issues around web + expo-constants).
 * Keys are trimmed — trailing newlines in `.env` break Clerk and can crash `clerk-js` on web.
 */
export function getClerkPublishableKey(): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const fromExtra =
    typeof extra?.clerkPublishableKey === 'string'
      ? trimKey(extra.clerkPublishableKey)
      : undefined;

  const m2 = Constants.manifest2 as { extra?: { clerkPublishableKey?: string } } | null | undefined;
  const m = Constants.manifest as { extra?: { clerkPublishableKey?: string } } | null | undefined;

  const fromManifest2 = trimKey(m2?.extra?.clerkPublishableKey);
  const fromManifest = trimKey(m?.extra?.clerkPublishableKey);

  const fromEnv =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
      ? trimKey(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY)
      : undefined;

  return fromExtra || fromManifest2 || fromManifest || fromEnv;
}

/** Same rule as `RootLayout` / `AuthGate`: real pk_live_ or pk_test_ (not Clerk dev placeholder). */
export function isClerkPublishableKeyConfigured(): boolean {
  const publishableKey = getClerkPublishableKey();
  return !!(
    publishableKey &&
    (publishableKey.startsWith('pk_live_') ||
      (publishableKey.startsWith('pk_test_') &&
        publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk'))
  );
}
