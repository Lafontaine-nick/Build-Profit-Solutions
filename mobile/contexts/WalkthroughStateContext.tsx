import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useUser } from '@clerk/clerk-react';
import { clerkAuthService } from '@/services/clerkAuth';
import type { WalkthroughFlowKey, WalkthroughsState } from '@/lib/walkthroughStateTypes';
import { shouldShowWalkthrough } from '@/lib/walkthroughStateTypes';
import {
  hydrateWalkthroughState,
  markWalkthroughCompleted,
  markWalkthroughSkipped,
} from '@/lib/walkthroughStateService';

type WalkthroughStateContextValue = {
  hydrated: boolean;
  userId: string | null;
  walkthroughState: WalkthroughsState | null;
  shouldShowAppOnboarding: boolean;
  shouldShowFirstEstimate: boolean;
  shouldShowFirstProject: boolean;
  refresh: () => Promise<void>;
  markCompleted: (flow: WalkthroughFlowKey) => Promise<void>;
  markSkipped: (flow: WalkthroughFlowKey) => Promise<void>;
};

const WalkthroughStateContext = createContext<WalkthroughStateContextValue | null>(null);

function useWalkthroughStateSync(userId: string | null): WalkthroughStateContextValue {
  const [hydrated, setHydrated] = useState(false);
  const [walkthroughState, setWalkthroughState] = useState<WalkthroughsState | null>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setWalkthroughState(null);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    void (async () => {
      try {
        const s = await hydrateWalkthroughState(userId);
        if (!cancelled) {
          setWalkthroughState(s);
          setHydrated(true);
        }
      } catch {
        if (!cancelled) {
          setWalkthroughState(null);
          setHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, bump]);

  const refresh = useCallback(async () => {
    setBump((b) => b + 1);
  }, []);

  const markCompleted = useCallback(
    async (flow: WalkthroughFlowKey) => {
      if (!userId) return;
      await markWalkthroughCompleted(userId, flow);
      const s = await hydrateWalkthroughState(userId);
      setWalkthroughState(s);
    },
    [userId]
  );

  const markSkipped = useCallback(
    async (flow: WalkthroughFlowKey) => {
      if (!userId) return;
      await markWalkthroughSkipped(userId, flow);
      const s = await hydrateWalkthroughState(userId);
      setWalkthroughState(s);
    },
    [userId]
  );

  return useMemo<WalkthroughStateContextValue>(() => {
    const s = walkthroughState;
    return {
      hydrated,
      userId,
      walkthroughState: s,
      shouldShowAppOnboarding: !hydrated ? true : shouldShowWalkthrough('appOnboarding', s),
      shouldShowFirstEstimate: !hydrated ? true : shouldShowWalkthrough('firstEstimate', s),
      shouldShowFirstProject: !hydrated ? true : shouldShowWalkthrough('firstProject', s),
      refresh,
      markCompleted,
      markSkipped,
    };
  }, [
    hydrated,
    userId,
    walkthroughState,
    refresh,
    markCompleted,
    markSkipped,
  ]);
}

/** Use inside `ClerkProvider` (Clerk user id). */
export function WalkthroughStateProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const value = useWalkthroughStateSync(userId);
  return (
    <WalkthroughStateContext.Provider value={value}>{children}</WalkthroughStateContext.Provider>
  );
}

/** Non-Clerk auth layout: resolve user id from `clerkAuthService`. */
export function WalkthroughStateProviderLegacy({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setUserId(clerkAuthService.getAuthState().user?.id ?? null);
    sync();
    return clerkAuthService.addListener(sync);
  }, []);
  const value = useWalkthroughStateSync(userId);
  return (
    <WalkthroughStateContext.Provider value={value}>{children}</WalkthroughStateContext.Provider>
  );
}

export function useWalkthroughState(): WalkthroughStateContextValue {
  const ctx = useContext(WalkthroughStateContext);
  if (!ctx) {
    throw new Error('useWalkthroughState must be used within WalkthroughStateProvider');
  }
  return ctx;
}
