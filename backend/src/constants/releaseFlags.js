/**
 * Launch feature flags — set env BUSINESS_PLAN_ENABLED / TEAM_WORKSPACE_ENABLED to "true"
 * when Business plan + Team workspace ship together.
 */

function parseBoolEnv(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

const BUSINESS_PLAN_ENABLED = parseBoolEnv(process.env.BUSINESS_PLAN_ENABLED, false);
const TEAM_WORKSPACE_ENABLED = parseBoolEnv(process.env.TEAM_WORKSPACE_ENABLED, false);

function isBusinessPlanReleased() {
  return BUSINESS_PLAN_ENABLED;
}

function isTeamWorkspaceReleased() {
  return BUSINESS_PLAN_ENABLED && TEAM_WORKSPACE_ENABLED;
}

function filterLaunchSubscriptionPlans(plans) {
  let filtered = (plans || []).filter((plan) => plan?.id !== 'basic');
  if (!isBusinessPlanReleased()) {
    filtered = filtered.filter((plan) => plan?.id !== 'business');
  }
  return filtered;
}

module.exports = {
  BUSINESS_PLAN_ENABLED,
  TEAM_WORKSPACE_ENABLED,
  isBusinessPlanReleased,
  isTeamWorkspaceReleased,
  filterLaunchSubscriptionPlans,
};
