import type { WorkspaceAccessRole } from '@/services/businessWorkspaceService';

export type WorkspacePermissionPreset = {
  viewAllProjects: boolean;
  viewAssignedProjects: boolean;
  viewOwnerFinancials: boolean;
  viewEstimateBreakdown: boolean;
  viewBudgetDetails: boolean;
  viewProfitMargin: boolean;
  viewPayments: boolean;
  viewTaxCenter: boolean;
  manageTeam: boolean;
  manageBilling: boolean;
  createExpense: boolean;
  approveExpense: boolean;
  createPurchaseOrder: boolean;
  approvePurchaseOrder: boolean;
  createChangeOrder: boolean;
  approveChangeOrder: boolean;
  editCalendar: boolean;
  addDailyLog: boolean;
  uploadPhoto: boolean;
  useAIFinancialInsights: boolean;
};

export const WORKSPACE_PERMISSION_PRESETS: Record<
  WorkspaceAccessRole,
  WorkspacePermissionPreset
> = {
  owner: {
    viewAllProjects: true,
    viewAssignedProjects: true,
    viewOwnerFinancials: true,
    viewEstimateBreakdown: true,
    viewBudgetDetails: true,
    viewProfitMargin: true,
    viewPayments: true,
    viewTaxCenter: true,
    manageTeam: true,
    manageBilling: true,
    createExpense: true,
    approveExpense: true,
    createPurchaseOrder: true,
    approvePurchaseOrder: true,
    createChangeOrder: true,
    approveChangeOrder: true,
    editCalendar: true,
    addDailyLog: true,
    uploadPhoto: true,
    useAIFinancialInsights: true,
  },
  manager: {
    viewAllProjects: false,
    viewAssignedProjects: true,
    viewOwnerFinancials: false,
    viewEstimateBreakdown: false,
    viewBudgetDetails: false,
    viewProfitMargin: false,
    viewPayments: false,
    viewTaxCenter: false,
    manageTeam: false,
    manageBilling: false,
    createExpense: true,
    approveExpense: false,
    createPurchaseOrder: true,
    approvePurchaseOrder: false,
    createChangeOrder: true,
    approveChangeOrder: false,
    editCalendar: true,
    addDailyLog: true,
    uploadPhoto: true,
    useAIFinancialInsights: false,
  },
  foreman: {
    viewAllProjects: false,
    viewAssignedProjects: true,
    viewOwnerFinancials: false,
    viewEstimateBreakdown: false,
    viewBudgetDetails: false,
    viewProfitMargin: false,
    viewPayments: false,
    viewTaxCenter: false,
    manageTeam: false,
    manageBilling: false,
    createExpense: true,
    approveExpense: false,
    createPurchaseOrder: false,
    approvePurchaseOrder: false,
    createChangeOrder: false,
    approveChangeOrder: false,
    editCalendar: true,
    addDailyLog: true,
    uploadPhoto: true,
    useAIFinancialInsights: false,
  },
  field: {
    viewAllProjects: false,
    viewAssignedProjects: true,
    viewOwnerFinancials: false,
    viewEstimateBreakdown: false,
    viewBudgetDetails: false,
    viewProfitMargin: false,
    viewPayments: false,
    viewTaxCenter: false,
    manageTeam: false,
    manageBilling: false,
    createExpense: true,
    approveExpense: false,
    createPurchaseOrder: false,
    approvePurchaseOrder: false,
    createChangeOrder: false,
    approveChangeOrder: false,
    editCalendar: false,
    addDailyLog: true,
    uploadPhoto: true,
    useAIFinancialInsights: false,
  },
  view_only: {
    viewAllProjects: false,
    viewAssignedProjects: true,
    viewOwnerFinancials: false,
    viewEstimateBreakdown: false,
    viewBudgetDetails: false,
    viewProfitMargin: false,
    viewPayments: false,
    viewTaxCenter: false,
    manageTeam: false,
    manageBilling: false,
    createExpense: false,
    approveExpense: false,
    createPurchaseOrder: false,
    approvePurchaseOrder: false,
    createChangeOrder: false,
    approveChangeOrder: false,
    editCalendar: false,
    addDailyLog: false,
    uploadPhoto: false,
    useAIFinancialInsights: false,
  },
};

export function normalizeWorkspaceRole(role: unknown): WorkspaceAccessRole {
  const value = String(role || '').trim().toLowerCase();
  if (
    value === 'owner' ||
    value === 'manager' ||
    value === 'foreman' ||
    value === 'field' ||
    value === 'view_only'
  ) {
    return value;
  }
  return 'field';
}

export function getRolePermissions(role: unknown): WorkspacePermissionPreset {
  return WORKSPACE_PERMISSION_PRESETS[normalizeWorkspaceRole(role)];
}

export const canViewOwnerFinancials = (role: unknown) =>
  getRolePermissions(role).viewOwnerFinancials;
export const canViewEstimateBreakdown = (role: unknown) =>
  getRolePermissions(role).viewEstimateBreakdown;
export const canViewBudgetDetails = (role: unknown) =>
  getRolePermissions(role).viewBudgetDetails;
export const canViewProfitMargin = (role: unknown) =>
  getRolePermissions(role).viewProfitMargin;
export const canViewPayments = (role: unknown) =>
  getRolePermissions(role).viewPayments;
export const canViewTaxCenter = (role: unknown) =>
  getRolePermissions(role).viewTaxCenter;
export const canManageTeam = (role: unknown) => getRolePermissions(role).manageTeam;
export const canManageBilling = (role: unknown) =>
  getRolePermissions(role).manageBilling;
export const canUseAIFinancialInsights = (role: unknown) =>
  getRolePermissions(role).useAIFinancialInsights;

export function workspacePermissionSummary(role: unknown): string {
  const normalized = normalizeWorkspaceRole(role);
  if (normalized === 'owner') return 'Full company access';
  if (normalized === 'manager') {
    return 'Can run assigned projects. Financial access hidden.';
  }
  if (normalized === 'foreman') {
    return 'Can lead field work, update schedule, logs, photos, and progress. Financial access hidden.';
  }
  if (normalized === 'field') {
    return 'Can add field updates, logs, photos, and receipts. Financial access hidden.';
  }
  return 'Read-only project visibility. Financial access hidden.';
}
