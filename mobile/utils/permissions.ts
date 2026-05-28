/**
 * Central workspace role permissions (re-export + project-detail helpers).
 * @see workspacePermissions.ts for presets and core guards.
 */
export {
  WORKSPACE_PERMISSION_PRESETS,
  normalizeWorkspaceRole,
  getRolePermissions,
  canViewOwnerFinancials,
  canViewEstimateBreakdown,
  canViewBudgetDetails,
  canViewProfitMargin,
  canViewPayments,
  canViewTaxCenter,
  canManageTeam,
  canManageBilling,
  canUseAIFinancialInsights,
  workspacePermissionSummary,
  effectiveWorkspaceRole,
  canViewContractValue,
  canViewCostControl,
  canViewProjectTeamAdmin,
  getVisibleProjectTabs,
  getBudgetTabLabel,
  canEditTimeline,
  canEditCalendar,
  canAddDailyLog,
  canUploadPhoto,
  canSubmitExpense,
  canCreateTask,
  canAssignTask,
  filterProjectAIContext,
  type ProjectDetailTab,
  type WorkspacePermissionPreset,
} from './workspacePermissions';

export type { WorkspaceAccessRole } from '@/services/businessWorkspaceService';
