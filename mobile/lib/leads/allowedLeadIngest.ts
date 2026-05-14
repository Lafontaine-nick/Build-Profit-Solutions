import type { Lead } from './types';

function norm(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase();
}

/**
 * Leads tab only shows the three product paths:
 * 1) MY CAMPAIGN — PROJECT_BASED + CAMPAIGN-… (your campaign post)
 * 2) Sub request — your posted need (isOwnRequest, not campaign) OR matched incoming copy (assignedTo you)
 * 3) Directory pick — BPS_SELECTION where you are GC or selected sub
 */
export function isAllowedProductLead(lead: Lead, currentUserId: string): boolean {
  const uid = norm(currentUserId);
  if (!uid) return false;

  if (lead.source === 'BPS_SELECTION') {
    const assignedTo = norm(lead.assignedTo);
    const createdBy = norm(lead.createdBy);
    return assignedTo === uid || createdBy === uid;
  }

  if (lead.source !== 'PROJECT_BASED') {
    return false;
  }

  const isCampaign = !!lead.projectId?.startsWith?.('CAMPAIGN-');
  const createdBy = norm(lead.createdBy);
  const assignedTo = norm(lead.assignedTo);

  if (isCampaign) {
    return lead.isOwnRequest === true || createdBy === uid;
  }

  if (!isCampaign && lead.isOwnRequest === true) {
    return createdBy === uid;
  }

  return assignedTo === uid && assignedTo.length > 0;
}
