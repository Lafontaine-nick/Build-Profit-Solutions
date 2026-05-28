import { useEffect, useState } from 'react';
import { useBusinessEntitlement } from '@/hooks/useBusinessEntitlement';
import type { BusinessWorkspaceAccess } from '@/services/businessWorkspaceService';
import { readWorkspaceAccessSnapshot } from '@/utils/workspaceAccessCache';

export function resolveWorkspaceAccess(
  live: BusinessWorkspaceAccess | null,
  cached: BusinessWorkspaceAccess | null,
  hasWorkspaceAccessFlag: boolean
): BusinessWorkspaceAccess | null {
  if (live?.hasWorkspaceAccess) return live;
  if (cached?.hasWorkspaceAccess) return cached;
  if (hasWorkspaceAccessFlag) {
    return { hasWorkspaceAccess: true, isOwner: false } as BusinessWorkspaceAccess;
  }
  return null;
}

/** Workspace access with AsyncStorage snapshot fallback (member sessions load before live bootstrap). */
export function useResolvedWorkspaceAccess(): BusinessWorkspaceAccess | null {
  const entitlement = useBusinessEntitlement();
  const [cachedAccess, setCachedAccess] = useState<BusinessWorkspaceAccess | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readWorkspaceAccessSnapshot().then((snapshot) => {
      if (!cancelled) setCachedAccess(snapshot);
    });
    return () => {
      cancelled = true;
    };
  }, [entitlement.workspaceAccess]);

  return resolveWorkspaceAccess(
    entitlement.workspaceAccess,
    cachedAccess,
    entitlement.hasWorkspaceAccess
  );
}
