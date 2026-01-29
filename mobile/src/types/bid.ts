export type SectionKey =
  | "overview" | "projectInfo" | "legal" | "locationTimeline" | "scope"
  | "developerPlanning" | "subQuotes" | "laborCrew" | "overhead"
  | "comms" | "aiOptimization" | "analysis" | "contract" | "client"
  | "finalBid";

export interface BidLine { 
  id: string; 
  label: string; 
  qty?: number; 
  unit?: string; 
  cost: number; 
}

export interface BidState {
  id: string;
  title: string;
  region: string;                      // NV / UT etc.
  sections: Record<SectionKey, { done: boolean; warnings?: string[] }>;
  materials: BidLine[];
  labor: BidLine[];
  overheadPct: number;                 // e.g. 8
  markupPct: number;                   // e.g. 12
  contingencyPct: number;              // e.g. 5
  
  // Project Information
  projectAddress?: string;
  projectCity?: string;
  projectState?: string;
  projectZip?: string;
  startDate?: string;                  // ISO date
  completionDate?: string;             // ISO date
  scopeDescription?: string;
  
  // Client Information
  clientName?: string;
  clientCompany?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
}

export type TemplateKey = "Residential Remodel" | "Tenant Improvement" | "Multifamily";

export const Templates: Record<TemplateKey, Partial<BidState>> = {
  "Residential Remodel": {
    overheadPct: 10, markupPct: 15, contingencyPct: 7,
    materials: [{ id: "m1", label: "Lumber", cost: 4200 }],
    labor: [{ id: "l1", label: "Framing Crew (per sq ft)", cost: 3500 }],
  },
  "Tenant Improvement": { 
    overheadPct: 12, 
    markupPct: 18, 
    contingencyPct: 5 
  },
  "Multifamily": { 
    overheadPct: 14, 
    markupPct: 20, 
    contingencyPct: 6 
  },
}; 