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
    viewBudgetDetails: true,
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

/** Map legacy view_only to field for UI and permission checks. */
export function effectiveWorkspaceRole(role: unknown): WorkspaceAccessRole {
  const normalized = normalizeWorkspaceRole(role);
  return normalized === 'view_only' ? 'field' : normalized;
}

export type ProjectDetailTab = 'Overview' | 'Budget' | 'Timeline' | 'Calendar' | 'Team';

export function getVisibleProjectTabs(
  role: unknown,
  isOwner: boolean
): ProjectDetailTab[] {
  if (isOwner) {
    return ['Overview', 'Budget', 'Timeline', 'Calendar', 'Team'];
  }
  switch (effectiveWorkspaceRole(role)) {
    case 'manager':
      return ['Overview', 'Budget', 'Timeline', 'Calendar', 'Team'];
    case 'foreman':
      return ['Overview', 'Timeline', 'Calendar', 'Team'];
    case 'field':
    default:
      return ['Overview', 'Timeline', 'Calendar'];
  }
}

export function getBudgetTabLabel(role: unknown, isOwner: boolean): string {
  if (isOwner || canViewOwnerFinancials(role)) return 'Budget';
  if (canViewCostControl(role)) return 'Cost Control';
  return 'Budget';
}

export function canViewCostControl(role: unknown): boolean {
  return effectiveWorkspaceRole(role) === 'manager';
}

export function canViewContractValue(role: unknown): boolean {
  return getRolePermissions(role).viewOwnerFinancials;
}

export function canViewProjectTeamAdmin(role: unknown): boolean {
  return getRolePermissions(role).manageTeam;
}

export function canEditTimeline(role: unknown): boolean {
  const r = effectiveWorkspaceRole(role);
  return r === 'owner' || r === 'manager' || r === 'foreman' || r === 'field';
}

export function canEditCalendar(role: unknown): boolean {
  return getRolePermissions(role).editCalendar;
}

export function canAddDailyLog(role: unknown): boolean {
  return getRolePermissions(role).addDailyLog;
}

export function canUploadPhoto(role: unknown): boolean {
  return getRolePermissions(role).uploadPhoto;
}

export function canSubmitExpense(role: unknown): boolean {
  return getRolePermissions(role).createExpense;
}

export function canCreateTask(role: unknown): boolean {
  const r = effectiveWorkspaceRole(role);
  return r === 'owner' || r === 'manager' || r === 'foreman';
}

export function canAssignTask(role: unknown): boolean {
  const r = effectiveWorkspaceRole(role);
  return r === 'owner' || r === 'manager';
}

export function getRolePermissions(role: unknown): WorkspacePermissionPreset {
  return WORKSPACE_PERMISSION_PRESETS[effectiveWorkspaceRole(role)];
}

export function filterProjectAIContext<T extends Record<string, unknown>>(
  context: T,
  budgetAccessMode: 'owner' | 'cost_control' | 'hidden',
  role: WorkspaceAccessRole
): T & Record<string, unknown> {
  if (budgetAccessMode === 'owner') return context;
  const filtered = { ...context } as T & Record<string, unknown>;
  const sensitiveKeys = [
    'bidPrice',
    'bidTotal',
    'total',
    'contractValue',
    'approvedChangeOrdersTotal',
    'forecastFinalCost',
    'projectedProfit',
    'projectedMarginPct',
    'spendToDateMarginPct',
    'profitStatus',
    'margin',
    'markup',
    'overheadPct',
    'profit',
    'estimateData',
    'estimateLineItems',
    'materialTotal',
    'laborTotal',
    'overheadTotal',
  ];
  for (const key of sensitiveKeys) {
    delete filtered[key];
  }
  filtered.aiFinancialAccess =
    budgetAccessMode === 'cost_control' ? 'operations_only' : 'field_only';
  filtered.workspaceRole = role;
  if (budgetAccessMode === 'hidden') {
    delete filtered.buckets;
    delete filtered.materialBudgetDirect;
    delete filtered.materialSpentDirect;
    filtered.financialAccessNote =
      'You do not have permission to view project profitability or owner-level financial details. I can help with assigned tasks, schedule, field notes, material requests, receipts, photos, or daily logs for this project.';
  }
  return filtered;
}

export type WorkspaceProjectPrivacy = {
  role?: string;
  restrictedFinancials?: boolean;
  message?: string;
};

/** Server-sanitized workspace projects carry this flag — never show owner financials locally. */
export function isWorkspaceRestrictedFinancialsProject(
  project: { workspacePrivacy?: WorkspaceProjectPrivacy | null } | null | undefined
): boolean {
  return Boolean(project?.workspacePrivacy?.restrictedFinancials);
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

/** Owner + manager see payment schedule on Timeline. Foreman/field do not. */
export function canViewPaymentSchedule(role: unknown, isOwner: boolean): boolean {
  if (isOwner) return true;
  return effectiveWorkspaceRole(role) === 'manager';
}

/** Mark payments collected / complete — workspace owner only (solo users always allowed). */
export function canCollectPayments(hasWorkspace: boolean, isOwner: boolean): boolean {
  if (!hasWorkspace) return true;
  return isOwner;
}

export const canViewTaxCenter = (role: unknown) =>
  getRolePermissions(role).viewTaxCenter;
export const canManageTeam = (role: unknown) => getRolePermissions(role).manageTeam;
export const canManageBilling = (role: unknown) =>
  getRolePermissions(role).manageBilling;
export const canUseAIFinancialInsights = (role: unknown) =>
  getRolePermissions(role).useAIFinancialInsights;

export function workspacePermissionSummary(role: unknown): string {
  const normalized = effectiveWorkspaceRole(role);
  if (normalized === 'owner') return 'Full company access';
  if (normalized === 'manager') {
    return 'Runs assigned projects with cost control. Owner profit and contract pricing stay hidden.';
  }
  if (normalized === 'foreman') {
    return 'Leads field work — schedule, logs, photos, and crew updates. No owner financials.';
  }
  if (normalized === 'field') {
    return 'Assigned tasks, schedule, notes, photos, and receipts. No budget or team admin.';
  }
  return 'Shared project access. Owner financials stay hidden.';
}
