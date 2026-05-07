/** Revenue for dashboard / projects list — delegates to `computeProjectFinancials` (same as Budget tab). */

import { computeProjectFinancials } from '@/src/lib/projectFinancials';

export const sanitizePositiveNumber = (value: any): number => {
  if (value == null) return 0;
  const num =
    typeof value === 'string'
      ? Number(value.replace(/[$,\s]/g, ''))
      : Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

export const getProjectRevenue = (project: any): number => {
  if (!project) return 0;
  const { adjustedContractValue } = computeProjectFinancials(project, {});
  return adjustedContractValue > 0 ? adjustedContractValue : 0;
};
