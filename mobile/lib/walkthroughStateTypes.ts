export const CURRENT_APP_ONBOARDING_VERSION = 1;
export const CURRENT_FIRST_ESTIMATE_WALKTHROUGH_VERSION = 1;
export const CURRENT_FIRST_PROJECT_WALKTHROUGH_VERSION = 1;

export type WalkthroughFlowKey = 'appOnboarding' | 'firstEstimate' | 'firstProject';

export type WalkthroughStatus = 'not_started' | 'skipped' | 'completed';

export type WalkthroughEntry = {
  status: WalkthroughStatus;
  version: number;
  updatedAt: string | null;
};

export type WalkthroughsState = {
  appOnboarding: WalkthroughEntry;
  firstEstimate: WalkthroughEntry;
  firstProject: WalkthroughEntry;
};

export function defaultWalkthroughsState(): WalkthroughsState {
  return {
    appOnboarding: { status: 'not_started', version: 0, updatedAt: null },
    firstEstimate: { status: 'not_started', version: 0, updatedAt: null },
    firstProject: { status: 'not_started', version: 0, updatedAt: null },
  };
}

export function normalizeWalkthroughsState(raw: unknown): WalkthroughsState {
  const d = defaultWalkthroughsState();
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Record<string, unknown>;
  const pick = (k: keyof WalkthroughsState): WalkthroughEntry => {
    const e = o[k];
    if (!e || typeof e !== 'object') return d[k];
    const x = e as Record<string, unknown>;
    const status =
      x.status === 'skipped' || x.status === 'completed' || x.status === 'not_started'
        ? x.status
        : d[k].status;
    const version = typeof x.version === 'number' && Number.isFinite(x.version) ? x.version : d[k].version;
    const updatedAt = typeof x.updatedAt === 'string' ? x.updatedAt : x.updatedAt == null ? null : d[k].updatedAt;
    return { status, version, updatedAt };
  };
  return {
    appOnboarding: pick('appOnboarding'),
    firstEstimate: pick('firstEstimate'),
    firstProject: pick('firstProject'),
  };
}

function currentVersionForFlow(flow: WalkthroughFlowKey): number {
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

/**
 * Show walkthrough if user has not finished this version (not_started, or outdated version).
 */
export function shouldShowWalkthrough(
  flow: WalkthroughFlowKey,
  state: WalkthroughsState | null | undefined
): boolean {
  if (!state) return true;
  const entry = state[flow];
  if (!entry) return true;
  const v = typeof entry.version === 'number' ? entry.version : 0;
  if (v < currentVersionForFlow(flow)) return true;
  return entry.status === 'not_started';
}
