/**
 * New Leads System Types
 * Modern lead management with AI scoring and contractor matching
 */

export type LeadStage = 'new' | 'verified' | 'qualified' | 'proposal' | 'won' | 'lost';

export interface Lead {
  id: string;
  createdAt: string;
  source: 'web' | 'referral' | 'import' | 'manual';
  contact: { 
    name: string; 
    email?: string; 
    phone?: string; 
    company?: string 
  };
  location?: { 
    city?: string; 
    state?: string; 
    lat?: number; 
    lng?: number 
  };
  project: {
    type: 'kitchen' | 'bathroom' | 'addition' | 'new_build' | 'landscaping' | 'other';
    budgetMin?: number; 
    budgetMax?: number; 
    timeline?: 'urgent' | 'soon' | 'flex';
  };
  description?: string;
  aiScore?: number;                 // 0–100
  verification?: VerificationResult;
  matches?: ContractorMatch[];      // Top 3
  stage: LeadStage;
  nextActionAt?: string;
  ownerId?: string;
}

export interface VerificationResult {
  emailValid?: boolean;
  phoneValid?: boolean;
  duplicateOfId?: string | null;
  propertyVerified?: boolean;
  riskFlags?: string[];
}

export interface ContractorProfile {
  id: string;
  name: string;
  services: Lead['project']['type'][];
  serviceRadiusMiles: number;
  homeBase: { lat: number; lng: number };
  avgTicketByType?: Record<string, number>;
  conversionByType?: Record<string, number>; // 0–1
  capacityScore?: number;                     // 0–1
  rating?: number;                            // 1–5
}

export interface ContractorMatch {
  contractorId: string;
  match: number; // 0–100
  reasons: string[];
}



