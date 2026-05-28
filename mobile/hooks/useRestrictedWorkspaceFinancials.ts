import { useMemo } from 'react';
import { useBusinessEntitlement } from '@/hooks/useBusinessEntitlement';
import {
  canViewOwnerFinancials,
  canViewTaxCenter,
  canUseAIFinancialInsights,
  normalizeWorkspaceRole,
} from '@/utils/workspacePermissions';

export function useRestrictedWorkspaceFinancials() {
  const entitlement = useBusinessEntitlement();
  const role = normalizeWorkspaceRole(entitlement.workspaceAccess?.role);
  const hasWorkspace = Boolean(entitlement.workspaceAccess?.hasWorkspaceAccess);
  const isOwner = Boolean(entitlement.workspaceAccess?.isOwner);

  const restricted = useMemo(
    () => hasWorkspace && !isOwner && !canViewOwnerFinancials(role),
    [hasWorkspace, isOwner, role]
  );

  return {
    restricted,
    role,
    workspaceAccess: entitlement.workspaceAccess,
    canViewTaxCenter: !hasWorkspace || isOwner || canViewTaxCenter(role),
    canUseAIFinancialInsights: !hasWorkspace || isOwner || canUseAIFinancialInsights(role),
    refresh: entitlement.refresh,
    initialized: entitlement.initialized,
  };
}
