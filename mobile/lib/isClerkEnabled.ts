import Constants from 'expo-constants';

/** Matches RootLayout / AuthGate: Clerk is on when a real publishable key is present. */
export function isClerkEnabled(): boolean {
  const publishableKey =
    Constants.expoConfig?.extra?.clerkPublishableKey ||
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return !!(
    publishableKey &&
    (publishableKey.startsWith('pk_live_') ||
      (publishableKey.startsWith('pk_test_') &&
        publishableKey !== 'pk_test_Y2xlcmsuZGV2LmNsZXJrLmF1dGgudGVzdC5rZXk'))
  );
}
