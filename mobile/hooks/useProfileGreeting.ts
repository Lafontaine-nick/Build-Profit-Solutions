import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { clerkAuthService } from '@/services/clerkAuth';
import {
  dashboardGreetingFromProfile,
  type DashboardGreeting,
} from '@/utils/dashboardGreeting';

/** Clerk session — must run under ClerkProvider. */
export function useClerkProfileGreeting(): DashboardGreeting {
  const { user } = useUser();
  return useMemo(() => dashboardGreetingFromProfile(user), [user]);
}

/** Legacy auth when ClerkProvider is not mounted. */
export function useLegacyProfileGreeting(): DashboardGreeting {
  const [greeting, setGreeting] = useState(() =>
    dashboardGreetingFromProfile(clerkAuthService.getAuthState().user)
  );

  useEffect(() => {
    const sync = () => {
      setGreeting(dashboardGreetingFromProfile(clerkAuthService.getAuthState().user));
    };
    sync();
    return clerkAuthService.addListener(sync);
  }, []);

  return greeting;
}

export type { DashboardGreeting };
