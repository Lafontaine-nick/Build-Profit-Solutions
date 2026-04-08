import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACTIVE_PROJECT_WALKTHROUGH_COMPLETE_KEY = 'bps.activeProjectWalkthroughComplete';

export const ACTIVE_PROJECT_WALKTHROUGH_PROGRESS_KEY = 'bps.activeProjectWalkthroughProgress';

/** Set when user marks a bid won so the list intro can open the right project on Start. */
export const PENDING_ACTIVE_PROJECT_WALKTHROUGH_PROJECT_ID_KEY =
  'bps.pendingActiveProjectWalkthroughProjectId';

export type ActiveProjectWalkthroughProgress = {
  introResolved?: boolean;
  started?: boolean;
  skipTips?: boolean;
  /** Index of the tab step in project detail (0–4). */
  detailStepIndex?: number;
  tourProjectId?: string;
  dismissed?: Record<string, boolean>;
};

export async function isActiveProjectWalkthroughComplete(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ACTIVE_PROJECT_WALKTHROUGH_COMPLETE_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export async function markActiveProjectWalkthroughComplete(
  userId?: string | null
): Promise<void> {
  try {
    if (userId) {
      const { markWalkthroughCompleted } = await import('./walkthroughStateService');
      await markWalkthroughCompleted(userId, 'firstProject');
      return;
    }
    await AsyncStorage.setItem(ACTIVE_PROJECT_WALKTHROUGH_COMPLETE_KEY, 'true');
    await AsyncStorage.removeItem(ACTIVE_PROJECT_WALKTHROUGH_PROGRESS_KEY);
    await AsyncStorage.removeItem(PENDING_ACTIVE_PROJECT_WALKTHROUGH_PROJECT_ID_KEY);
  } catch {
    /* ignore */
  }
}

export async function loadActiveProjectWalkthroughProgress(): Promise<ActiveProjectWalkthroughProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_PROJECT_WALKTHROUGH_PROGRESS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return null;
    return p as ActiveProjectWalkthroughProgress;
  } catch {
    return null;
  }
}

export async function saveActiveProjectWalkthroughProgress(
  progress: ActiveProjectWalkthroughProgress
): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_PROJECT_WALKTHROUGH_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export async function setPendingActiveProjectWalkthroughProjectId(projectId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_ACTIVE_PROJECT_WALKTHROUGH_PROJECT_ID_KEY, projectId);
  } catch {
    /* ignore */
  }
}

export async function getPendingActiveProjectWalkthroughProjectId(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(PENDING_ACTIVE_PROJECT_WALKTHROUGH_PROJECT_ID_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export async function clearPendingActiveProjectWalkthroughProjectId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_ACTIVE_PROJECT_WALKTHROUGH_PROJECT_ID_KEY);
  } catch {
    /* ignore */
  }
}

export async function resetActiveProjectWalkthroughStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      ACTIVE_PROJECT_WALKTHROUGH_COMPLETE_KEY,
      ACTIVE_PROJECT_WALKTHROUGH_PROGRESS_KEY,
      PENDING_ACTIVE_PROJECT_WALKTHROUGH_PROJECT_ID_KEY,
    ]);
  } catch {
    /* ignore */
  }
}
