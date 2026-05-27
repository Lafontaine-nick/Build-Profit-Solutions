import AsyncStorage from '@react-native-async-storage/async-storage';

/** Base key — per-account keys append `.{clerkUserId}`. */
export const UNIFIED_PROJECTS_STORAGE_KEY = 'bps.unifiedProjects.v1';

/** Tracks which Clerk account owns the legacy (unscoped) cache. */
export const ACTIVE_PROJECT_USER_ID_KEY = 'bps.unifiedProjects.activeUserId';

export function getUnifiedProjectsStorageKey(userId?: string | null): string {
  const id = String(userId ?? '').trim();
  if (!id) return UNIFIED_PROJECTS_STORAGE_KEY;
  return `${UNIFIED_PROJECTS_STORAGE_KEY}.${id}`;
}

/** Shared project list cache for workspace members (same list per workspace). */
export function getWorkspaceProjectsStorageKey(workspaceId: string): string {
  const id = String(workspaceId ?? '').trim();
  return `${UNIFIED_PROJECTS_STORAGE_KEY}.ws.${id || 'unknown'}`;
}

/** Clears the cached project list for one account (or legacy unscoped key when userId omitted). */
export async function clearUnifiedProjectsListCache(
  userId?: string | null
): Promise<void> {
  await AsyncStorage.removeItem(getUnifiedProjectsStorageKey(userId));
}

export async function setActiveProjectUserId(userId: string | null): Promise<void> {
  if (!userId) {
    await AsyncStorage.removeItem(ACTIVE_PROJECT_USER_ID_KEY);
    return;
  }
  await AsyncStorage.setItem(ACTIVE_PROJECT_USER_ID_KEY, userId);
}

export async function getActiveProjectUserId(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(ACTIVE_PROJECT_USER_ID_KEY)) || null;
  } catch {
    return null;
  }
}
