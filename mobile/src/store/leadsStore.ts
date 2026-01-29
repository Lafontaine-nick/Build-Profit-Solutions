/**
 * Leads Store - Zustand State Management
 * Centralized state management for the leads system
 */

import { create } from 'zustand';
import { Lead, LeadStage, ContractorProfile } from '../types/leads';
import { rankContractors, scoreLead } from '../lib/ai';

// Sample contractor data
const contractors: ContractorProfile[] = [
  { 
    id: 'c1', 
    name: 'American Building LLC', 
    services: ['kitchen', 'bathroom', 'addition', 'new_build'], 
    serviceRadiusMiles: 50,
    homeBase: { lat: 0, lng: 0 }, 
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
    homeBase: { lat: 0, lng: 0 }, 
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
    homeBase: { lat: 0, lng: 0 }, 
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
    description: 'Full kitchen reno with custom cabinets', 
    verification: { emailValid: true, phoneValid: true }, 
    aiScore: undefined, 
    stage: 'new' 
  },
  { 
    id: 'L1002', 
    createdAt: now, 
    source: 'referral', 
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
];

// Store type definition
type Store = {
  leads: Lead[];
  contractors: ContractorProfile[];
  upsertLead: (l: Lead) => void;
  byStage: (stage: LeadStage) => Lead[];
  moveStage: (id: string, to: LeadStage) => void;
  rescore: (id: string) => void;
  assignMatches: (id: string) => void;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt'>) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  getLead: (id: string) => Lead | undefined;
};

// Create the store
export const useLeadsStore = create<Store>((set, get) => ({
  leads: seedLeads.map(l => ({ ...l, aiScore: scoreLead(l) })),
  contractors,

  // Add or update a lead
  upsertLead: (l) => set(s => {
    const i = s.leads.findIndex(x => x.id === l.id);
    if (i >= 0) s.leads[i] = l; 
    else s.leads.unshift(l);
    return { leads: [...s.leads] };
  }),

  // Get leads by stage, sorted by AI score
  byStage: (stage) => get().leads
    .filter(l => l.stage === stage)
    .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0)),

  // Move lead to different stage
  moveStage: (id, to) => set(s => ({ 
    leads: s.leads.map(l => l.id === id ? { ...l, stage: to } : l) 
  })),

  // Rescore a lead
  rescore: (id) => set(s => ({ 
    leads: s.leads.map(l => l.id === id ? { ...l, aiScore: scoreLead(l) } : l) 
  })),

  // Assign contractor matches to a lead
  assignMatches: (id) => set(s => ({
    leads: s.leads.map(l => l.id === id ? { ...l, matches: rankContractors(l, s.contractors) } : l)
  })),

  // Add a new lead
  addLead: (leadData) => set(s => {
    const newLead: Lead = {
      ...leadData,
      id: `L${Date.now()}`,
      createdAt: new Date().toISOString(),
      aiScore: scoreLead(leadData as Lead)
    };
    return { leads: [newLead, ...s.leads] };
  }),

  // Update a lead
  updateLead: (id, updates) => set(s => ({
    leads: s.leads.map(l => l.id === id ? { ...l, ...updates } : l)
  })),

  // Delete a lead
  deleteLead: (id) => set(s => ({
    leads: s.leads.filter(l => l.id !== id)
  })),

  // Get a specific lead
  getLead: (id) => get().leads.find(l => l.id === id)
}));



