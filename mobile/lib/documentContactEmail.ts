import AsyncStorage from '@react-native-async-storage/async-storage';

import { clerkAuthService } from '@/services/clerkAuth';

const PROFILE_KEY = 'bps.contractorProfile';

export type ClerkEmailUser = {
  primaryEmailAddress?: { emailAddress?: string };
  emailAddresses?: { emailAddress?: string }[];
} | null | undefined;

function trimEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Canonical contact email for exports, PDF contracts, and outbound document footers:
 * Profile (bps.contractorProfile) first, then Clerk login email, then legacy auth.
 */
export async function getDocumentContactEmailAsync(clerkUser?: ClerkEmailUser): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { email?: string; companyEmail?: string };
      const fromStored = trimEmail(p.email) || trimEmail(p.companyEmail);
      if (fromStored) return fromStored;
    }
  } catch {
    /* noop */
  }

  const clerk =
    trimEmail(clerkUser?.primaryEmailAddress?.emailAddress) ||
    trimEmail(clerkUser?.emailAddresses?.[0]?.emailAddress);
  if (clerk) return clerk;

  try {
    const auth = clerkAuthService.getAuthState()?.user?.email?.trim();
    if (auth) return auth;
  } catch {
    /* noop */
  }

  return null;
}

/** Ensures contract branding reads one email from both common profile keys. */
export function applyDocumentContactEmailToProfile(
  merged: Record<string, unknown>,
  canonicalEmail: string | null,
): void {
  const e = trimEmail(canonicalEmail);
  if (!e) return;
  merged.email = e;
  merged.companyEmail = e;
}
