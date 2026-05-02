import { isClerkPublishableKeyConfigured } from '@/lib/clerkPublishableKey';

/** Matches RootLayout / AuthGate: Clerk is on when a real publishable key is present. */
export function isClerkEnabled(): boolean {
  return isClerkPublishableKeyConfigured();
}
