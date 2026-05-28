import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useUser } from '@clerk/clerk-react';
import { clerkAuthService } from '@/services/clerkAuth';
import { stripeService } from '@/services/stripeService';
import businessWorkspaceService, {
  type BusinessWorkspaceAccess,
} from '@/services/businessWorkspaceService';
import { setBusinessEntitlementSnapshot } from '@/utils/businessEntitlementCache';
import { persistWorkspaceAccessSnapshot } from '@/utils/workspaceAccessCache';
import { syncClerkTokenToAsyncStorage } from '@/utils/authTokenHelper';
import { fetchWorkspaceBootstrap } from '@/utils/workspaceBootstrapCache';
import {
  normalizeSubscriptionPlanId,
  resolveBestPlanIdFromSubscriptions,
} from '@/utils/resolveSubscriptionPlan';

const CACHED_PLAN_KEY = 'bps.cachedPlanId';
const CACHED_WORKSPACE_ACCESS_KEY = 'bps.cachedWorkspaceAccess';

type EntitlementState = {
  hasBusiness: boolean;
  hasWorkspaceAccess: boolean;
  canUseBusinessWorkspace: boolean;
  workspaceAccess: BusinessWorkspaceAccess | null;
  currentPlanId: string | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

async function getStoredProfileEmail(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem('bps.contractorProfile');
    if (!raw) return null;
    const profile = JSON.parse(raw);
    return typeof profile?.email === 'string' && profile.email.trim()
      ? profile.email.trim()
      : null;
  } catch {
    return null;
  }
}

export function useBusinessEntitlement(): EntitlementState {
  const { user: clerkUser } = useUser();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const clerkEmail =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    null;
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [hasWorkspaceAccess, setHasWorkspaceAccess] = useState(false);
  const [workspaceAccess, setWorkspaceAccess] = useState<BusinessWorkspaceAccess | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveEmail = useCallback(async () => {
    if (clerkEmail) return clerkEmail;
    try {
      const authState = clerkAuthService.getAuthState();
      if (authState?.user?.email) return authState.user.email;
    } catch {
      // Fall through to contractor profile.
    }
    return getStoredProfileEmail();
  }, [clerkEmail]);

  const applyPlanId = useCallback(async (planId: string | null) => {
    const normalized = normalizeSubscriptionPlanId(planId);
    setCurrentPlanId(normalized);
    if (normalized) {
      await AsyncStorage.setItem(CACHED_PLAN_KEY, normalized);
    } else {
      await AsyncStorage.removeItem(CACHED_PLAN_KEY);
    }
  }, []);

  const applyWorkspaceAccess = useCallback(async (allowed: boolean) => {
    setHasWorkspaceAccess(allowed);
    await AsyncStorage.setItem(CACHED_WORKSPACE_ACCESS_KEY, allowed ? '1' : '0');
  }, []);

  const refresh = useCallback(async () => {
    if (!isLoaded) return;

    setLoading(true);
    setError(null);

    try {
      const email = await resolveEmail();

      if (isSignedIn) {
        for (let attempt = 0; attempt < 30; attempt++) {
          try {
            const token = await getToken();
            if (token) {
              await syncClerkTokenToAsyncStorage(token, email);
              break;
            }
          } catch {
            /* retry */
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const bootstrap = await fetchWorkspaceBootstrap().catch(() => null);
      const workspaceResponse = bootstrap?.access
        ? { success: true as const, data: bootstrap.access }
        : await businessWorkspaceService.getWorkspaceAccess().catch(() => null);

      if (workspaceResponse?.success && workspaceResponse.data) {
        setWorkspaceAccess(workspaceResponse.data);
        await applyWorkspaceAccess(Boolean(workspaceResponse.data.hasWorkspaceAccess));
        if (workspaceResponse.data.hasWorkspaceAccess) {
          await persistWorkspaceAccessSnapshot(workspaceResponse.data);
        }
      } else if (__DEV__) {
        console.warn(
          'Workspace access check unavailable — keeping cached value',
          workspaceResponse?.error
        );
      }

      try {
        if (email) {
          const [plans, subscriptions] = await Promise.all([
            stripeService
              .fetchSubscriptionPlans()
              .catch(() => stripeService.getMockSubscriptionPlans()),
            stripeService.getCustomerSubscriptions(email).catch(() => []),
          ]);
          await applyPlanId(
            resolveBestPlanIdFromSubscriptions(subscriptions, plans)
          );
        } else {
          await applyPlanId(null);
        }
      } catch (planErr) {
        if (__DEV__) {
          console.warn('Plan lookup failed (workspace access kept):', planErr);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Could not verify subscription');
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [
    applyPlanId,
    applyWorkspaceAccess,
    getToken,
    isLoaded,
    isSignedIn,
    resolveEmail,
  ]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem(CACHED_PLAN_KEY),
      AsyncStorage.getItem(CACHED_WORKSPACE_ACCESS_KEY),
    ])
      .then(([cached, cachedWorkspaceAccess]) => {
        if (cancelled) return;
        const planId = normalizeSubscriptionPlanId(cached);
        if (planId) {
          setCurrentPlanId(planId);
        }
        setHasWorkspaceAccess(cachedWorkspaceAccess === '1');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    void refresh();
  }, [isLoaded, isSignedIn, refresh]);

  const hasBusiness = useMemo(
    () => normalizeSubscriptionPlanId(currentPlanId) === 'business',
    [currentPlanId]
  );
  const canUseBusinessWorkspace =
    hasBusiness ||
    hasWorkspaceAccess ||
    Boolean(workspaceAccess?.hasWorkspaceAccess);

  useEffect(() => {
    if (loading) return;
    setBusinessEntitlementSnapshot({ hasBusiness, hasWorkspaceAccess });
  }, [hasBusiness, hasWorkspaceAccess, loading]);

  return {
    hasBusiness,
    hasWorkspaceAccess,
    canUseBusinessWorkspace,
    workspaceAccess,
    currentPlanId,
    loading,
    initialized,
    error,
    refresh,
  };
}
