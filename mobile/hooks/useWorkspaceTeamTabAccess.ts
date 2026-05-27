import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useUser } from '@clerk/clerk-react';
import businessWorkspaceService from '@/services/businessWorkspaceService';
import { syncClerkTokenToAsyncStorage } from '@/utils/authTokenHelper';
import { setBusinessEntitlementSnapshot } from '@/utils/businessEntitlementCache';

const WORKSPACE_ACCESS_CACHE_KEY = 'bps.cachedWorkspaceAccess';

type WorkspaceTeamTabAccess = {
  allowed: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

/** Project-detail Team tab: resolve workspace membership directly (invited members have no Stripe plan). */
export function useWorkspaceTeamTabAccess(active: boolean): WorkspaceTeamTabAccess {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    const email =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      null;

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

    await businessWorkspaceService.acceptPendingInvites().catch(() => null);

    const response = await businessWorkspaceService.getWorkspaceAccess().catch(() => null);

    if (response?.success && response.data) {
      const hasAccess = Boolean(response.data.hasWorkspaceAccess);
      setAllowed(hasAccess);
      if (hasAccess) {
        await AsyncStorage.setItem(WORKSPACE_ACCESS_CACHE_KEY, '1');
        setBusinessEntitlementSnapshot({ hasBusiness: false, hasWorkspaceAccess: true });
      }
      setLoading(false);
      return;
    }

    // Do not clear a previously confirmed invite on transient auth/network failures.
    try {
      const cached = await AsyncStorage.getItem(WORKSPACE_ACCESS_CACHE_KEY);
      setAllowed(cached === '1');
    } catch {
      setAllowed(false);
    }
    setLoading(false);
  }, [getToken, isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!active) return;
    void refresh();
  }, [active, refresh]);

  return { allowed, loading, refresh };
}
