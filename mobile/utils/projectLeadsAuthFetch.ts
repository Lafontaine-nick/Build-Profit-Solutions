import { clerkAuthService } from '@/services/clerkAuth';
import { getAuthTokenWithFallback } from '@/utils/authTokenHelper';

/**
 * Merge bearer token into fetch init for `/api/project-leads` routes.
 * Prefers AsyncStorage (Clerk sync / legacy sign-in), then in-memory `clerkAuthService`, then optional Clerk `getToken`.
 */
export async function withProjectLeadsAuth(
  init: RequestInit = {},
  getClerkToken?: () => Promise<string | null>
): Promise<RequestInit> {
  const fromStorage = await getAuthTokenWithFallback(getClerkToken);
  const token = fromStorage ?? clerkAuthService.getToken();
  const headers = new Headers((init.headers as HeadersInit) || undefined);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return { ...init, headers };
}
