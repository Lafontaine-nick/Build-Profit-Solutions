import AsyncStorage from '@react-native-async-storage/async-storage';
import { onboardingCompleteKeyForUser } from './onboardingStorage';
import {
  FIRST_ESTIMATE_WALKTHROUGH_COMPLETE_KEY,
  FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY,
  type FirstEstimateWalkthroughProgress,
} from './firstEstimateWalkthroughStorage';
import {
  ACTIVE_PROJECT_WALKTHROUGH_COMPLETE_KEY,
  ACTIVE_PROJECT_WALKTHROUGH_PROGRESS_KEY,
  type ActiveProjectWalkthroughProgress,
} from './activeProjectWalkthroughStorage';
import {
  CURRENT_APP_ONBOARDING_VERSION,
  CURRENT_FIRST_ESTIMATE_WALKTHROUGH_VERSION,
  CURRENT_FIRST_PROJECT_WALKTHROUGH_VERSION,
  type WalkthroughsState,
  defaultWalkthroughsState,
} from './walkthroughStateTypes';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Build account-level state from legacy device keys (best-effort).
 * Prefer completed over skipped when both could apply.
 */
export async function buildWalkthroughStateFromLegacyKeys(
  userId: string | null | undefined
): Promise<WalkthroughsState> {
  const out = defaultWalkthroughsState();

  if (userId) {
    const ob = await AsyncStorage.getItem(onboardingCompleteKeyForUser(userId));
    if (ob === 'true') {
      out.appOnboarding = {
        status: 'completed',
        version: CURRENT_APP_ONBOARDING_VERSION,
        updatedAt: nowIso(),
      };
    }
  }

  try {
    const feDone = await AsyncStorage.getItem(FIRST_ESTIMATE_WALKTHROUGH_COMPLETE_KEY);
    let feProg: FirstEstimateWalkthroughProgress | null = null;
    const rawFe = await AsyncStorage.getItem(FIRST_ESTIMATE_WALKTHROUGH_PROGRESS_KEY);
    if (rawFe) {
      try {
        feProg = JSON.parse(rawFe) as FirstEstimateWalkthroughProgress;
      } catch {
        feProg = null;
      }
    }
    if (feDone === 'true') {
      out.firstEstimate = {
        status: 'completed',
        version: CURRENT_FIRST_ESTIMATE_WALKTHROUGH_VERSION,
        updatedAt: nowIso(),
      };
    } else if (feProg?.skipTips) {
      out.firstEstimate = {
        status: 'skipped',
        version: CURRENT_FIRST_ESTIMATE_WALKTHROUGH_VERSION,
        updatedAt: nowIso(),
      };
    }
  } catch {
    /* ignore */
  }

  try {
    const apDone = await AsyncStorage.getItem(ACTIVE_PROJECT_WALKTHROUGH_COMPLETE_KEY);
    let apProg: ActiveProjectWalkthroughProgress | null = null;
    const rawAp = await AsyncStorage.getItem(ACTIVE_PROJECT_WALKTHROUGH_PROGRESS_KEY);
    if (rawAp) {
      try {
        apProg = JSON.parse(rawAp) as ActiveProjectWalkthroughProgress;
      } catch {
        apProg = null;
      }
    }
    if (apDone === 'true') {
      out.firstProject = {
        status: 'completed',
        version: CURRENT_FIRST_PROJECT_WALKTHROUGH_VERSION,
        updatedAt: nowIso(),
      };
    } else if (apProg?.skipTips) {
      out.firstProject = {
        status: 'skipped',
        version: CURRENT_FIRST_PROJECT_WALKTHROUGH_VERSION,
        updatedAt: nowIso(),
      };
    }
  } catch {
    /* ignore */
  }

  return out;
}

export function isWalkthroughStateUntouched(state: WalkthroughsState): boolean {
  return (
    state.appOnboarding.status === 'not_started' &&
    (state.appOnboarding.version ?? 0) === 0 &&
    state.firstEstimate.status === 'not_started' &&
    (state.firstEstimate.version ?? 0) === 0 &&
    state.firstProject.status === 'not_started' &&
    (state.firstProject.version ?? 0) === 0
  );
}

/**
 * Merge two states: prefer any non–not_started / version > 0 from either side.
 */
export function mergeWalkthroughStatesPreferringProgress(
  a: WalkthroughsState,
  b: WalkthroughsState
): WalkthroughsState {
  const score = (s: WalkthroughsState['appOnboarding']) => {
    const v = s.version ?? 0;
    if (s.status === 'completed') return 100 + v;
    if (s.status === 'skipped') return 50 + v;
    return v;
  };
  const pick = (
    key: keyof WalkthroughsState
  ): WalkthroughsState[typeof key] => {
    const x = a[key];
    const y = b[key];
    return score(x) >= score(y) ? x : y;
  };
  return {
    appOnboarding: pick('appOnboarding'),
    firstEstimate: pick('firstEstimate'),
    firstProject: pick('firstProject'),
  };
}
