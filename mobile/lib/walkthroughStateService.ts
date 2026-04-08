import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '@/services/api';
import {
  defaultWalkthroughsState,
  normalizeWalkthroughsState,
  shouldShowWalkthrough,
  type WalkthroughFlowKey,
  type WalkthroughsState,
  CURRENT_APP_ONBOARDING_VERSION,
  CURRENT_FIRST_ESTIMATE_WALKTHROUGH_VERSION,
  CURRENT_FIRST_PROJECT_WALKTHROUGH_VERSION,
} from './walkthroughStateTypes';
import {
  buildWalkthroughStateFromLegacyKeys,
  isWalkthroughStateUntouched,
  mergeWalkthroughStatesPreferringProgress,
} from './walkthroughStateMigration';

const CACHE_PREFIX = 'bps.walkthroughState.v1.';

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

function versionForFlow(flow: WalkthroughFlowKey): number {
  switch (flow) {
    case 'appOnboarding':
      return CURRENT_APP_ONBOARDING_VERSION;
    case 'firstEstimate':
      return CURRENT_FIRST_ESTIMATE_WALKTHROUGH_VERSION;
    case 'firstProject':
      return CURRENT_FIRST_PROJECT_WALKTHROUGH_VERSION;
    default:
      return 1;
  }
}

export async function readWalkthroughCache(
  userId: string | null | undefined
): Promise<WalkthroughsState | null> {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    return normalizeWalkthroughsState(p);
  } catch {
    return null;
  }
}

export async function writeWalkthroughCache(
  userId: string,
  state: WalkthroughsState
): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

async function syncLegacyKeysForFlow(userId: string, flow: WalkthroughFlowKey): Promise<void> {
  if (flow === 'appOnboarding') {
    const { onboardingCompleteKeyForUser } = await import('./onboardingStorage');
    const LEGACY_ONBOARDING_COMPLETE_KEY = 'bps.onboardingComplete';
    await AsyncStorage.setItem(onboardingCompleteKeyForUser(userId), 'true');
    await AsyncStorage.removeItem(LEGACY_ONBOARDING_COMPLETE_KEY);
  } else if (flow === 'firstEstimate') {
    const {
      FIRST_ESTIMATE_WALKTHROUGH_COMPLETE_KEY,
      FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY,
    } = await import('./firstEstimateWalkthroughStorage');
    await AsyncStorage.setItem(FIRST_ESTIMATE_WALKTHROUGH_COMPLETE_KEY, 'true');
    await AsyncStorage.removeItem(FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY);
  } else if (flow === 'firstProject') {
    const {
      ACTIVE_PROJECT_WALKTHROUGH_COMPLETE_KEY,
      ACTIVE_PROJECT_WALKTHROUGH_PROGRESS_KEY,
      PENDING_ACTIVE_PROJECT_WALKTHROUGH_PROJECT_ID_KEY,
    } = await import('./activeProjectWalkthroughStorage');
    await AsyncStorage.setItem(ACTIVE_PROJECT_WALKTHROUGH_COMPLETE_KEY, 'true');
    await AsyncStorage.removeItem(ACTIVE_PROJECT_WALKTHROUGH_PROGRESS_KEY);
    await AsyncStorage.removeItem(PENDING_ACTIVE_PROJECT_WALKTHROUGH_PROJECT_ID_KEY);
  }
}

/**
 * Fetch remote walkthrough state and merge with legacy device keys / local cache, then persist.
 * Backend wins when it already has non-default data; otherwise one-time migration from legacy/cache.
 */
export async function hydrateWalkthroughState(
  userId: string | null | undefined
): Promise<WalkthroughsState> {
  if (!userId) {
    return defaultWalkthroughsState();
  }

  let remote: WalkthroughsState | null = null;
  let serverPersisted = false;

  try {
    const res = await apiService.getWalkthroughState();
    remote = normalizeWalkthroughsState(res.walkthroughs);
    serverPersisted = Boolean(res.serverPersisted);
  } catch {
    remote = null;
  }

  const cached = await readWalkthroughCache(userId);
  const legacy = await buildWalkthroughStateFromLegacyKeys(userId);

  if (!remote) {
    const merged = mergeWalkthroughStatesPreferringProgress(
      mergeWalkthroughStatesPreferringProgress(legacy, defaultWalkthroughsState()),
      cached ?? defaultWalkthroughsState()
    );
    await writeWalkthroughCache(userId, merged);
    return merged;
  }

  if (!isWalkthroughStateUntouched(remote)) {
    await writeWalkthroughCache(userId, remote);
    return remote;
  }

  let merged = mergeWalkthroughStatesPreferringProgress(
    mergeWalkthroughStatesPreferringProgress(legacy, remote),
    cached ?? defaultWalkthroughsState()
  );

  if (!isWalkthroughStateUntouched(merged) && serverPersisted) {
    try {
      const res = await apiService.patchWalkthroughState({ walkthroughs: merged });
      merged = normalizeWalkthroughsState(res.walkthroughs);
    } catch {
      /* offline */
    }
  }

  await writeWalkthroughCache(userId, merged);
  return merged;
}

export async function markWalkthroughCompleted(
  userId: string | null | undefined,
  flow: WalkthroughFlowKey
): Promise<void> {
  if (!userId) return;
  const now = new Date().toISOString();
  const version = versionForFlow(flow);
  const patch = {
    [flow]: { status: 'completed' as const, version, updatedAt: now },
  };

  try {
    const res = await apiService.patchWalkthroughState({ walkthroughs: patch });
    await writeWalkthroughCache(userId, normalizeWalkthroughsState(res.walkthroughs));
  } catch {
    const cur = (await readWalkthroughCache(userId)) ?? defaultWalkthroughsState();
    const next: WalkthroughsState = {
      ...cur,
      [flow]: { status: 'completed', version, updatedAt: now },
    };
    await writeWalkthroughCache(userId, next);
  }

  await syncLegacyKeysForFlow(userId, flow);
}

export async function markWalkthroughSkipped(
  userId: string | null | undefined,
  flow: WalkthroughFlowKey
): Promise<void> {
  if (!userId) return;
  const now = new Date().toISOString();
  const version = versionForFlow(flow);
  const patch = {
    [flow]: { status: 'skipped' as const, version, updatedAt: now },
  };

  try {
    const res = await apiService.patchWalkthroughState({ walkthroughs: patch });
    await writeWalkthroughCache(userId, normalizeWalkthroughsState(res.walkthroughs));
  } catch {
    const cur = (await readWalkthroughCache(userId)) ?? defaultWalkthroughsState();
    const next: WalkthroughsState = {
      ...cur,
      [flow]: { status: 'skipped', version, updatedAt: now },
    };
    await writeWalkthroughCache(userId, next);
  }

  if (flow === 'appOnboarding') {
    await syncLegacyKeysForFlow(userId, 'appOnboarding');
  } else if (flow === 'firstEstimate') {
    const { saveFirstEstimateWalkthroughProgress } = await import(
      './firstEstimateWalkthroughStorage'
    );
    await saveFirstEstimateWalkthroughProgress({
      introResolved: true,
      skipTips: true,
    });
  } else if (flow === 'firstProject') {
    const { saveActiveProjectWalkthroughProgress } = await import('./activeProjectWalkthroughStorage');
    await saveActiveProjectWalkthroughProgress({ introResolved: true, skipTips: true });
  }
}

/** Dev / account reset: clear account walkthrough flags (local + best-effort server). */
export async function resetAllWalkthroughsForAccount(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  const fresh = defaultWalkthroughsState();
  try {
    const res = await apiService.patchWalkthroughState({ walkthroughs: fresh });
    await writeWalkthroughCache(userId, normalizeWalkthroughsState(res.walkthroughs));
  } catch {
    await writeWalkthroughCache(userId, fresh);
  }
}

export function shouldShowWalkthroughFlow(
  flow: WalkthroughFlowKey,
  state: WalkthroughsState | null
): boolean {
  return shouldShowWalkthrough(flow, state);
}
