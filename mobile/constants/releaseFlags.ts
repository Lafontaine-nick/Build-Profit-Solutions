/**
 * Launch feature flags — flip both to `true` when Business plan + Team workspace ship together.
 * Keep Team/Business code in the repo; hide all customer-facing surfaces while disabled.
 */
export const BUSINESS_PLAN_ENABLED = false;
export const TEAM_WORKSPACE_ENABLED = false;

/** Contractor networking (Leads tab, Request Subcontractor, campaigns). Re-enable when user density supports matching. */
export const LEADS_NETWORKING_ENABLED = false;

export function isLeadsNetworkingReleased(): boolean {
  return LEADS_NETWORKING_ENABLED;
}

export function isBusinessPlanReleased(): boolean {
  return BUSINESS_PLAN_ENABLED;
}

export function isTeamWorkspaceReleased(): boolean {
  return BUSINESS_PLAN_ENABLED && TEAM_WORKSPACE_ENABLED;
}

export type LaunchGatedPlan = { id: string };

/** Hide legacy Basic and unreleased Business from pricing/catalog surfaces. */
export function filterLaunchSubscriptionPlans<T extends LaunchGatedPlan>(plans: T[]): T[] {
  let filtered = plans.filter((plan) => plan.id !== 'basic');
  if (!isBusinessPlanReleased()) {
    filtered = filtered.filter((plan) => plan.id !== 'business');
  }
  return filtered;
}

export type ProjectDetailTabName = 'Overview' | 'Budget' | 'Timeline' | 'Calendar' | 'Team';

export type ProjectTeamTabGate = {
  hasBusinessEntitlement?: boolean;
  hasWorkspaceAccess?: boolean;
};

/**
 * Team tab is customer-facing only when the feature is released and the user
 * has Business entitlement or active workspace membership (invited crew).
 */
export function shouldShowProjectTeamTab(options: ProjectTeamTabGate = {}): boolean {
  if (!isTeamWorkspaceReleased()) return false;
  const { hasBusinessEntitlement = false, hasWorkspaceAccess = false } = options;
  return hasBusinessEntitlement || hasWorkspaceAccess;
}

export function filterProjectDetailTabs<T extends ProjectDetailTabName>(
  tabs: T[],
  options: ProjectTeamTabGate = {}
): T[] {
  if (shouldShowProjectTeamTab(options)) return tabs;
  return tabs.filter((tab) => tab !== 'Team');
}
