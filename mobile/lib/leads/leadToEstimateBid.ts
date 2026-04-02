/**
 * Maps a CRM lead into the estimate generator bid shape stored at `bps.currentBid.v2`.
 * Keeps LeadDetailModal, CompactLeadCard, and any future entry points in sync.
 */

import type { Lead } from './types';

/** Mirrors PROJECT_TYPES / slugs in estimate-generator (avoid importing the whole screen). */
const PROJECT_CATEGORY_SLUGS: Record<string, string> = {
  kitchen: 'kitchen-remodel',
  bathroom: 'bathroom-remodel',
  room_addition: 'addition',
  home_addition: 'home-renovation',
  new_build: 'new-build',
  landscaping: 'landscaping',
  other: 'other',
};

export type EstimateProjectType =
  | 'kitchen'
  | 'bathroom'
  | 'room_addition'
  | 'home_addition'
  | 'new_build'
  | 'landscaping'
  | 'other';

/**
 * Prefer the lead's project.type (kitchen, bathroom, …) for scope pickers.
 * Trade strings (Electrical, HVAC) are not valid estimate scopes → `other`.
 */
export function mapLeadProjectTypeToEstimateProjectType(
  projectType: string | undefined
): EstimateProjectType {
  const t = String(projectType || 'other')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (t === 'kitchen') return 'kitchen';
  if (t === 'bathroom') return 'bathroom';
  if (t === 'addition' || t === 'room_addition') return 'room_addition';
  if (t === 'home_addition') return 'home_addition';
  if (t === 'new_build') return 'new_build';
  if (t === 'landscaping') return 'landscaping';
  return 'other';
}

function formatLeadSiteAddress(lead: Lead): string {
  const city = (lead.location?.city || '').trim();
  const state = (lead.location?.state || '').trim();
  const zip = (lead.location?.zip || '').trim();
  if (city && state) {
    return zip ? `${city}, ${state} ${zip}` : `${city}, ${state}`;
  }
  if (city) return city;
  if (state) return state;
  return '';
}

function desiredStartFromTimeline(lead: Lead): string {
  const raw = String(lead.project?.timeline || '').toLowerCase();
  if (raw === 'urgent') {
    return new Date().toISOString().split('T')[0];
  }
  return '';
}

/** Plain object written to AsyncStorage as JSON (estimate-generator hydrates this). */
/** Category slug for contract/sections (matches estimate-generator PROJECT_CATEGORY_SLUGS). */
export function estimateCategorySlugForScope(scopeKey: string): string {
  const pt = mapLeadProjectTypeToEstimateProjectType(scopeKey.replace(/-/g, '_'));
  return PROJECT_CATEGORY_SLUGS[pt] || PROJECT_CATEGORY_SLUGS.other;
}

export function buildBidPayloadFromLead(lead: Lead): Record<string, unknown> {
  const estimateProjectType = mapLeadProjectTypeToEstimateProjectType(lead.project?.type);
  const projectCategory =
    PROJECT_CATEGORY_SLUGS[estimateProjectType] || PROJECT_CATEGORY_SLUGS.other;
  const siteAddress = formatLeadSiteAddress(lead);
  const state = (lead.location?.state || '').trim();

  return {
    id: `bid-${lead.id}-${Date.now()}`,
    title: `${lead.title || lead.contact.name || 'Lead'} - Proposal`,
    region: state || 'NV',
    template: estimateProjectType,

    projectType: estimateProjectType,
    projectCategory,
    sqft: 0,
    category: projectCategory,

    desiredStartDate: desiredStartFromTimeline(lead),
    budgetRange: `$${lead.project.budgetMin.toLocaleString()} - $${lead.project.budgetMax.toLocaleString()}`,

    customerName: lead.contact.name || '',
    customerEmail: lead.contact.email || '',
    customerPhone: lead.contact.phone || '',
    customerAddress: siteAddress,
    customerCity: (lead.location?.city || '').trim(),
    customerState: state,
    customerZip: (lead.location?.zip || '').trim(),
    customerCompany: lead.contact.company || '',
    customerNotes: lead.description || `Project for ${lead.contact.name || 'Customer'}`,

    clientName: lead.contact.name || '',
    clientEmail: lead.contact.email || '',

    scopeDescription: lead.description || `Project for ${lead.contact.name || 'Customer'}`,

    startDate: '',
    endDate: '',

    projectBudgetMin: lead.project.budgetMin,
    projectBudgetMax: lead.project.budgetMax,

    license: true,
    insurance: true,
    bond: false,
    osha: false,

    permitCost: 0,
    permitCostText: '',
    zoning: 'residential',

    materialLineItems: [],
    laborLineItems: [],
    labor: 0,
    unionToggle: false,
    zipRate: 38,

    insuranceOverhead: 0,
    equipment: 0,
    facilities: 0,
    otherOverhead: 0,

    contingencyPct: 7,
    markupPct: 15,

    clientUpdates: 'weekly',
    internalChannel: 'inapp',
    clientTransparency: 'totals',
    esign: true,

    unitMode: 'sqft',

    leadId: lead.id,
    leadSource: 'qualified_lead',
  };
}
