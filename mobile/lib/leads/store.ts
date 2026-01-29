/**
 * Zustand Store for Lead Management
 * Centralized state management for the leads system
 */

import { create } from 'zustand';
import { Lead, LeadStage, ContractorProfile } from './types';
import { rankContractors, scoreLead, calculateLeadAnalytics } from './ai';
import { calculateAdvancedScore, defaultMarketData } from './ai/advanced-scoring';

// Mock contractor data
const contractors: ContractorProfile[] = [
  { 
    id: 'c1', 
    name: 'American Building LLC', 
    services: ['kitchen', 'bathroom', 'addition', 'new_build'], 
    serviceRadiusMiles: 50,
    homeBase: { lat: 40.7608, lng: -111.8910 }, // Salt Lake City
    avgTicketByType: { kitchen: 65000, bathroom: 25000 }, 
    conversionByType: { kitchen: 0.32, bathroom: 0.28 }, 
    capacityScore: 0.8, 
    rating: 4.8 
  },
  { 
    id: 'c2', 
    name: 'Smith Construction', 
    services: ['kitchen', 'landscaping'], 
    serviceRadiusMiles: 35,
    homeBase: { lat: 40.7608, lng: -111.8910 },
    avgTicketByType: { kitchen: 55000, landscaping: 12000 }, 
    conversionByType: { kitchen: 0.22 }, 
    capacityScore: 0.6, 
    rating: 4.4 
  },
  { 
    id: 'c3', 
    name: 'Utah Home Pros', 
    services: ['bathroom', 'addition'], 
    serviceRadiusMiles: 40,
    homeBase: { lat: 40.7608, lng: -111.8910 },
    avgTicketByType: { bathroom: 18000 }, 
    conversionByType: { bathroom: 0.27 }, 
    capacityScore: 0.9, 
    rating: 4.6 
  },
];

// Sample leads data
const now = new Date().toISOString();
const seedLeads: Lead[] = [
  { 
    id: 'L1001', 
    createdAt: now, 
    source: 'web', 
    trade: 'General',
    contact: { 
      name: 'Sarah Johnson', 
      email: 'sarah.j@email.com', 
      phone: '555-123-4567', 
      company: 'Johnson Construction' 
    },
    location: { city: 'Salt Lake City', state: 'UT' }, 
    project: { 
      type: 'kitchen', 
      budgetMin: 25000, 
      budgetMax: 45000, 
      timeline: 'soon' 
    },
    description: 'Full kitchen renovation with custom cabinets', 
    verification: { emailValid: true, phoneValid: true }, 
    aiScore: undefined, 
    stage: 'new' 
  },
  { 
    id: 'L1002', 
    createdAt: now, 
    source: 'referral', 
    trade: 'General',
    contact: { 
      name: 'Mike Carter', 
      phone: '555-222-1111' 
    },
    location: { city: 'St. George', state: 'UT' }, 
    project: { 
      type: 'bathroom', 
      budgetMin: 12000, 
      budgetMax: 18000, 
      timeline: 'urgent' 
    },
    verification: { phoneValid: true }, 
    stage: 'verified' 
  },
  { 
    id: 'L1003', 
    createdAt: now, 
    source: 'manual', 
    trade: 'General',
    contact: { 
      name: 'Olivia Chen', 
      email: 'olivia@ex.com' 
    },
    location: { city: 'Henderson', state: 'NV' }, 
    project: { 
      type: 'addition', 
      budgetMin: 75000, 
      budgetMax: 120000, 
      timeline: 'flex' 
    },
    verification: { emailValid: true }, 
    stage: 'qualified' 
  },
  {
    id: 'L1004',
    createdAt: now,
    source: 'web',
    trade: 'General',
    contact: {
      name: 'David Rodriguez',
      email: 'david@rodriguez.com',
      phone: '555-333-4444'
    },
    location: { city: 'Provo', state: 'UT' },
    project: {
      type: 'new_build',
      budgetMin: 200000,
      budgetMax: 350000,
      timeline: 'flex'
    },
    description: 'Custom home build on 2-acre lot',
    verification: { emailValid: true, phoneValid: true },
    stage: 'proposal'
  },
  {
    id: 'L1005',
    createdAt: now,
    source: 'referral',
    trade: 'General',
    contact: {
      name: 'Jennifer Martinez',
      email: 'jennifer@martinez.com',
      phone: '555-555-6666'
    },
    location: { city: 'Orem', state: 'UT' },
    project: {
      type: 'landscaping',
      budgetMin: 15000,
      budgetMax: 25000,
      timeline: 'soon'
    },
    description: 'Complete backyard landscaping and irrigation',
    verification: { emailValid: true, phoneValid: true },
    stage: 'won'
  }
];

type Store = {
  leads: Lead[];
  contractors: ContractorProfile[];
  analytics: ReturnType<typeof calculateLeadAnalytics>;
  
  // Actions
  upsertLead: (lead: Lead) => void;
  deleteLead: (id: string) => void;
  byStage: (stage: LeadStage) => Lead[];
  moveStage: (id: string, to: LeadStage) => void;
  rescore: (id: string) => void;
  assignMatches: (id: string) => void;
  refreshAnalytics: () => void;
  getLead: (id: string) => Lead | undefined;
  addNote: (id: string, note: string) => void;
  snoozeLead: (id: string, hours: number) => void;
  addPhoto: (id: string, photo: any) => void;
  deletePhoto: (id: string, photoId: string) => void;
  setFollowUp: (id: string, dateTime: string) => void;
};

export const useLeadStore = create<Store>((set, get) => ({
  leads: seedLeads.map(l => ({ ...l, aiScore: scoreLead(l) })),
  contractors,
  analytics: {
    total: 0,
    byStage: { new: 0, contacted: 0, quoted: 0, proposal: 0, 'proposal-sent': 0, verified: 0, qualified: 0, negotiation: 0, won: 0, lost: 0, closed: 0 },
    averageScore: 0,
    conversionRate: 0,
    topSources: [],
  },

  upsertLead: (lead) => set(state => {
    const leads = [...state.leads];
    const index = leads.findIndex(l => l.id === lead.id);
    
    if (index >= 0) {
      leads[index] = { ...lead, aiScore: scoreLead(lead) };
    } else {
      leads.unshift({ ...lead, aiScore: scoreLead(lead) });
    }
    
    const analytics = calculateLeadAnalytics(leads);
    return { leads, analytics };
  }),

  deleteLead: (id) => set(state => {
    const leads = state.leads.filter(l => l.id !== id);
    const analytics = calculateLeadAnalytics(leads);
    return { leads, analytics };
  }),

  byStage: (stage) => {
    const { leads } = get();
    return leads
      .filter(l => l.stage === stage)
      .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0));
  },

  moveStage: (id, to) => set(state => {
    const leads = state.leads.map(l => 
      l.id === id ? { ...l, stage: to } : l
    );
    const analytics = calculateLeadAnalytics(leads);
    return { leads, analytics };
  }),

  rescore: (id) => set(state => {
    const leads = state.leads.map(l => 
      l.id === id ? { ...l, aiScore: scoreLead(l) } : l
    );
    const analytics = calculateLeadAnalytics(leads);
    return { leads, analytics };
  }),

  assignMatches: (id) => set(state => {
    const { contractors } = state;
    const leads = state.leads.map(l => 
      l.id === id ? { ...l, matches: rankContractors(l, contractors) } : l
    );
    return { leads };
  }),

  refreshAnalytics: () => set(state => {
    const analytics = calculateLeadAnalytics(state.leads);
    return { analytics };
  }),

  getLead: (id) => {
    const { leads } = get();
    return leads.find(l => l.id === id);
  },

  addNote: (id, note) => set(state => {
    const leads = state.leads.map(l => {
      if (l.id === id) {
        const newNote = {
          id: `note-${Date.now()}`,
          text: note,
          createdAt: new Date().toISOString(),
        };
        return {
          ...l,
          notes: [...(l.notes || []), newNote]
        };
      }
      return l;
    });
    return { leads };
  }),

  snoozeLead: (id, hours) => set(state => {
    const snoozedUntil = new Date();
    snoozedUntil.setHours(snoozedUntil.getHours() + hours);
    
    const leads = state.leads.map(l => 
      l.id === id ? { ...l, snoozedUntil: snoozedUntil.toISOString() } : l
    );
    return { leads };
  }),

  addPhoto: (id, photo) => set(state => {
    const leads = state.leads.map(l => {
      if (l.id === id) {
        return {
          ...l,
          photos: [...(l.photos || []), photo]
        };
      }
      return l;
    });
    return { leads };
  }),

  deletePhoto: (id, photoId) => set(state => {
    const leads = state.leads.map(l => {
      if (l.id === id) {
        return {
          ...l,
          photos: (l.photos || []).filter(p => p.id !== photoId)
        };
      }
      return l;
    });
    return { leads };
  }),

  setFollowUp: (id, dateTime) => set(state => {
    const leads = state.leads.map(l => 
      l.id === id ? { ...l, nextFollowUp: dateTime } : l
    );
    return { leads };
  })
}));

