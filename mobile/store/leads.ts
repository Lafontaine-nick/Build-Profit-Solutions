import { create } from 'zustand';
import { usePrefsStore, Timeline } from './prefs';
import { distanceMi } from '../lib/geo';
import { normalizeTrade, tradesMatch } from '../lib/trades';

export interface LeadRaw {
  id: string;
  name: string;
  company?: string;
  trade: string;
  city: string; 
  state: string; 
  lat: number; 
  lng: number;
  timeline: Timeline;
  budgetMin?: number; 
  budgetMax?: number;
  createdAt: string;
  // Additional properties for existing structure
  title?: string;
  source?: string;
  stage?: string;
  verified?: boolean;
  contact?: any;
  project?: any;
  location?: any;
  verification?: any;
  description?: string;
  createdBy?: string;
  [key: string]: any;
}

export interface LeadScored extends LeadRaw {
  aiScore: number;              // derived from prefs
  temperature: 'Hot' | 'Warm' | 'Cold';
  matches: { trade:boolean; location:boolean; timeline:boolean; };
}

interface LeadsState { 
  allRaw: LeadRaw[]; 
  setAll: (l: LeadRaw[]) => void; 
}

const createLeadsStore = () =>
  create<LeadsState>()((set) => ({
    allRaw: [],
    setAll: (l) => {
      // Strip any baked-in fields defensively
      const sanitized = l.map(({ 
        // @ts-expect-error – ignore extra fields from API
        aiScore, temperature, ...rest 
      }) => rest);
      set({ allRaw: sanitized });
    },
  }));

export const useLeadsStore: ReturnType<typeof createLeadsStore> =
  (global as any).__BPS_LEADS__ || ((global as any).__BPS_LEADS__ = createLeadsStore());

// --- scoring that respects Match Preferences ---
const scoreLead = (lead: LeadRaw, opts: {
  trades: Set<string>;
  locations: { lat?: number; lng?: number; radiusMi: number }[];
  minAIScore: number;
  allowedTimeline: Set<Timeline>;
  filterByTrade: boolean;
}): LeadScored | null => {
  let score = 50; // neutral base
  const matches = { trade:false, location:false, timeline:false };

  // trade matching - normalize both lead trade and preferences
  const leadTradeNormalized = normalizeTrade(lead.trade);
  const prefTradesArray = Array.from(opts.trades);
  const hasMatch = opts.trades.size === 0 || prefTradesArray.some(prefTrade => tradesMatch(leadTradeNormalized, prefTrade));
  
  if (hasMatch) {
    matches.trade = true; 
    score += 20;
  } else { 
    score -= 20;
    // If filterByTrade is enabled, reject this lead
    if (opts.filterByTrade) return null;
  }

  // timeline
  if (opts.allowedTimeline.has(lead.timeline)) {
    matches.timeline = true; 
    score += 15;
  } else { 
    score -= 10; 
  }

  // location
  if (opts.locations.length === 0) {
    matches.location = true;
  } else {
    const ok = opts.locations.some(loc => {
      if (!loc.lat || !loc.lng) return true; // fail-open until geocoded
      return distanceMi({lat:loc.lat, lng:loc.lng}, {lat:lead.lat, lng:lead.lng}) <= loc.radiusMi;
    });
    matches.location = ok;
    score += ok ? 15 : -15;
  }

  // clamp
  score = Math.max(0, Math.min(100, score));
  if (score < opts.minAIScore) return null;

  const temperature = score >= 80 ? 'Hot' : score >= 60 ? 'Warm' : 'Cold';
  return { ...lead, aiScore: score, temperature, matches };
};

// Selector hook: always computed from current prefs
export const useScoredLeads = () => {
  const { allRaw } = useLeadsStore();
  const { prefs, hydrated } = usePrefsStore();
  if (!hydrated) return { hydrated:false, leads: [] as LeadScored[] };

  const trades = new Set([...prefs.trades, ...prefs.specificTrades].map(t=>t.toLowerCase()));
  const allowedTimeline = new Set(prefs.timelineAllowed);

  console.log(`🔍 Scoring leads with prefs: filterByTrade=${prefs.filterByTrade}, trades=${Array.from(trades)}, minScore=${prefs.minAIScore}`);

  const leads: LeadScored[] = [];
  for (const l of allRaw) {
    const scored = scoreLead(l, {
      trades, 
      locations: prefs.locations, 
      minAIScore: prefs.minAIScore, 
      allowedTimeline,
      filterByTrade: prefs.filterByTrade
    });
    if (scored) leads.push(scored);
  }

  // Sort: highest score first, newest next
  leads.sort((a,b) => (b.aiScore - a.aiScore) || (Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  
  return { hydrated:true, leads };
};

// Legacy export for backwards compatibility
export const useFilteredLeads = useScoredLeads;

