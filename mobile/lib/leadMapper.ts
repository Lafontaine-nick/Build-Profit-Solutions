import { Lead } from '../store/leads';

/**
 * Maps existing Lead type to simplified Lead interface for filtering
 */
export function mapLeadToFilterable(lead: any): Lead {
  const getTimeline = (timeline?: string): 'Urgent' | 'Soon' | 'Normal' | 'Flexible' => {
    if (!timeline) return 'Normal';
    const t = timeline.toLowerCase();
    if (t === 'urgent') return 'Urgent';
    if (t === 'soon') return 'Soon';
    if (t === 'flexible') return 'Flexible';
    return 'Normal';
  };

  const location = lead.location || {};
  const project = lead.project || {};

  return {
    id: lead.id,
    title: lead.title || lead.name || 'Untitled Lead',
    name: lead.contact?.name || lead.name || 'Unknown',
    company: lead.contact?.company,
    trade: lead.trade || 'Unknown',
    aiScore: lead.aiScore || 0,
    city: location.city || '',
    state: location.state || '',
    lat: location.lat,
    lng: location.lng,
    timeline: getTimeline(project.timeline),
    budgetMin: project.budgetMin,
    budgetMax: project.budgetMax,
    createdAt: lead.createdAt || new Date().toISOString(),
    // Keep all original properties
    ...lead,
  };
}


