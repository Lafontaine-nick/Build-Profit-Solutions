import { useMemo } from 'react';
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

  return useMemo(() => {
    const hasWorkspace = Boolean(access?.hasWorkspaceAccess);
    const isOwner = hasWorkspace && access?.isOwner === true;
    const role = effectiveWorkspaceRole(access?.role);
    const visibleTabs = getVisibleProjectTabs(role, isOwner);
    const ownerFinancials = isOwner || canViewOwnerFinancials(role);
    const costControl = hasWorkspace && !isOwner && canViewCostControl(role);

    const budgetAccessMode: BudgetAccessMode = ownerFinancials
      ? 'owner'
      : costControl
        ? 'cost_control'
        : 'hidden';

    return {
      hasWorkspace,
      isOwner,
      role,
      visibleTabs,
      budgetTabLabel: getBudgetTabLabel(role, isOwner),
      budgetAccessMode,
      canViewOwnerFinancials: ownerFinancials,
      canViewCostControl: costControl,
      canViewProjectTeamAdmin: isOwner || canViewProjectTeamAdmin(role),
      canUseAIFinancialInsights: isOwner || canUseAIFinancialInsights(role),
      canViewPaymentSchedule: !hasWorkspace || isOwner || role === 'manager',
      canCollectPayments: !hasWorkspace || isOwner,
      canAccessEstimateAndLeads: !hasWorkspace || isOwner,
      canEditCalendar: !hasWorkspace || isOwner || roleCanEditCalendar(role),
      isManager: hasWorkspace && !isOwner && role === 'manager',
      isForeman: hasWorkspace && !isOwner && role === 'foreman',
      isField: hasWorkspace && !isOwner && role === 'field',
      isRestrictedMember: hasWorkspace && !isOwner,
      showProjectAI: isOwner || hasWorkspace,
    };
  }, [access]);
}
