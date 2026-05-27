import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { clerkAuthService } from '@/services/clerkAuth';

export type AccountUserIdState = {
  userId: string | null;
  isReady: boolean;
};

export function useClerkAccountUserId(): AccountUserIdState {
  const { user, isLoaded } = useUser();
  return {
    userId: user?.id ?? null,
    isReady: isLoaded,
  };
}

export function useLegacyAccountUserId(): AccountUserIdState {
  const [state, setState] = useState<AccountUserIdState>(() => {
    const auth = clerkAuthService.getAuthState();
    return {
      userId: auth.user?.id ?? null,
      isReady: !auth.loading,
    };
  });

  const sync = useCallback(() => {
    const auth = clerkAuthService.getAuthState();
    setState({
      userId: auth.user?.id ?? null,
      isReady: !auth.loading,
    });
  }, []);

  useEffect(() => {
    sync();
    return clerkAuthService.addListener(sync);
  }, [sync]);

  return state;
}
