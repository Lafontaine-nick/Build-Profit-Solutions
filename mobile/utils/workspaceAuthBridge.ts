/** Lets workspace API calls use Clerk's live session token on web (AsyncStorage can lag). */
let clerkTokenGetter: (() => Promise<string | null>) | null = null;

export function setWorkspaceClerkTokenGetter(
  getter: (() => Promise<string | null>) | null
): void {
  clerkTokenGetter = getter;
}

export async function fetchWorkspaceClerkToken(): Promise<string | null> {
  if (!clerkTokenGetter) return null;
  try {
    return await clerkTokenGetter();
  } catch {
    return null;
  }
}
