import { useMemo } from 'react';
import { useBusinessEntitlement } from '@/hooks/useBusinessEntitlement';
import { useResolvedWorkspaceAccess } from '@/hooks/useResolvedWorkspaceAccess';
import {
  effectiveWorkspaceRole,
  getVisibleProjectTabs,
  getBudgetTabLabel,
  canViewOwnerFinancials,
  canViewCostControl,
  canViewProjectTeamAdmin,
  canUseAIFinancialInsights,
  canEditCalendar as roleCanEditCalendar,
  type ProjectDetailTab,
} from '@/utils/workspacePermissions';
import type { WorkspaceAccessRole } from '@/services/businessWorkspaceService';

export type BudgetAccessMode = 'owner' | 'cost_control' | 'hidden';

export type WorkspaceProjectPermissions = {
  hasWorkspace: boolean;
  isOwner: boolean;
  role: WorkspaceAccessRole;
  visibleTabs: ProjectDetailTab[];
  budgetTabLabel: string;
  budgetAccessMode: BudgetAccessMode;
  canViewOwnerFinancials: boolean;
  canViewCostControl: boolean;
  canViewProjectTeamAdmin: boolean;
  canUseAIFinancialInsights: boolean;
  canViewPaymentSchedule: boolean;
  canCollectPayments: boolean;
  canAccessEstimateAndLeads: boolean;
  canEditCalendar: boolean;
  isManager: boolean;
  isForeman: boolean;
  isField: boolean;
  isRestrictedMember: boolean;
  showProjectAI: boolean;
};

export function useWorkspaceProjectPermissions(): WorkspaceProjectPermissions {
  const access = useResolvedWorkspaceAccess();
  const entitlement = useBusinessEntitlement();

  return useMemo(() => {
    const hasWorkspace = Boolean(access?.hasWorkspaceAccess);
    const isWorkspaceOwner = hasWorkspace && access?.isOwner === true;
    const isSoloAccount = !hasWorkspace;
    const tabOwnerContext = isSoloAccount || isWorkspaceOwner;
    const role = effectiveWorkspaceRole(access?.role);
    const visibleTabs = getVisibleProjectTabs(role, tabOwnerContext, {
      hasBusinessEntitlement: entitlement.hasBusiness,
      hasWorkspaceAccess: hasWorkspace,
    });
    const ownerFinancials = tabOwnerContext || canViewOwnerFinancials(role);
    const costControl = hasWorkspace && !isWorkspaceOwner && canViewCostControl(role);

    const budgetAccessMode: BudgetAccessMode = ownerFinancials
      ? 'owner'
      : costControl
        ? 'cost_control'
        : 'hidden';

    return {
      hasWorkspace,
      isOwner: tabOwnerContext,
      role,
      visibleTabs,
      budgetTabLabel: getBudgetTabLabel(role, tabOwnerContext),
      budgetAccessMode,
      canViewOwnerFinancials: ownerFinancials,
      canViewCostControl: costControl,
      canViewProjectTeamAdmin: tabOwnerContext || canViewProjectTeamAdmin(role),
      canUseAIFinancialInsights: tabOwnerContext || canUseAIFinancialInsights(role),
      canViewPaymentSchedule: isSoloAccount || isWorkspaceOwner || role === 'manager',
      canCollectPayments: isSoloAccount || isWorkspaceOwner,
      canAccessEstimateAndLeads: isSoloAccount || isWorkspaceOwner,
      canEditCalendar: isSoloAccount || isWorkspaceOwner || roleCanEditCalendar(role),
      isManager: hasWorkspace && !isWorkspaceOwner && role === 'manager',
      isForeman: hasWorkspace && !isWorkspaceOwner && role === 'foreman',
      isField: hasWorkspace && !isWorkspaceOwner && role === 'field',
      isRestrictedMember: hasWorkspace && !isWorkspaceOwner,
      showProjectAI: tabOwnerContext || hasWorkspace,
    };
  }, [access, entitlement.hasBusiness]);
}
