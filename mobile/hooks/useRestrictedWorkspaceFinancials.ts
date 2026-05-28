import { useMemo } from 'react';
import { useBusinessEntitlement } from '@/hooks/useBusinessEntitlement';
import { useResolvedWorkspaceAccess } from '@/hooks/useResolvedWorkspaceAccess';
import {
  canViewOwnerFinancials,
  canViewTaxCenter,
  canUseAIFinancialInsights,
  normalizeWorkspaceRole,
} from '@/utils/workspacePermissions';

export function useRestrictedWorkspaceFinancials() {
  const entitlement = useBusinessEntitlement();
  const access = useResolvedWorkspaceAccess();
  const role = normalizeWorkspaceRole(access?.role);
  const hasWorkspace = Boolean(access?.hasWorkspaceAccess);
  const isOwner = access?.isOwner === true;

  const restricted = useMemo(() => {
    if (!hasWorkspace) return false;
    if (isOwner) return false;
    return !canViewOwnerFinancials(role);
  }, [hasWorkspace, isOwner, role]);

  return {
    restricted,
    role,
    workspaceAccess: access,
    canViewTaxCenter: !hasWorkspace || isOwner || canViewTaxCenter(role),
    canUseAIFinancialInsights: !hasWorkspace || isOwner || canUseAIFinancialInsights(role),
    refresh: entitlement.refresh,
    initialized: entitlement.initialized,
  };
}
