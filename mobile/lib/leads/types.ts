/**
 * Lead Management System Types
 * Defines the structure for the new leads pipeline system
 */

export type LeadStage = 'new' | 'contacted' | 'quoted' | 'proposal' | 'proposal-sent' | 'verified' | 'qualified' | 'negotiation' | 'won' | 'lost' | 'closed';

export type LeadSource = 
  | 'PROJECT_BASED'
  | 'BID_INVITATION'
  | 'MARKETPLACE'
  | 'AI_ESTIMATE'
  | 'SHARED'
  | 'web'
  | 'referral'
  | 'manual';

export type LeadUrgency = 'Normal' | 'Soon' | 'Urgent' | 'soon' | 'urgent' | 'flex';

export interface LeadNote {
  id: string;
  text: string;
  createdAt: string;
  createdBy?: string;
}

export interface LeadPhoto {
  id: string;
  uri: string;
  type: 'site_photo' | 'document' | 'blueprint' | 'other';
  caption?: string;
  uploadedAt: string;
}

export interface LeadQualityIndicators {
  phoneVerified: boolean;
  emailVerified: boolean;
  budgetConfirmed: boolean;
  photosAttached: boolean;
  locationVerified: boolean;
  highIntent: boolean; // Composite score
}

export interface LeadEngagement {
  viewCount: number; // How many contractors are viewing
  responseCount: number; // How many contractors responded
  lastViewedAt?: string;
  yourLastResponseAt?: string; // When YOU last responded
  averageResponseTime?: number; // In minutes
  bidStartedAt?: string; // When bid builder was started
  bidSubmittedAt?: string; // When bid was submitted to client
  bidWonAt?: string; // When bid was marked as won (converted to active project)
}

export interface LeadTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  createdBy?: string;
}

export interface Lead {
  id: string;
  title?: string;                    // e.g., "Framing bid request"
  createdAt: string;
  projectId?: string;               // link to project if applicable
  trade: string;                    // "Framing", "HVAC", "Stucco", etc.
  source: LeadSource;
  contact: { 
    name: string; 
    email?: string; 
    phone?: string; 
    company?: string 
  };
  location: { 
    city: string; 
    state: string; 
    zip?: string;
    lat?: number; 
    lng?: number;
  };
  project: {
    type: 'kitchen' | 'bathroom' | 'addition' | 'new_build' | 'landscaping' | 'framing' | 'hvac' | 'stucco' | 'other';
    budgetMin: number; 
    budgetMax: number; 
    timeline: LeadUrgency;
  };
  description?: string;
  aiScore?: number;                  // 0–100
  verified?: boolean;
  verification?: VerificationResult;
  matches?: ContractorMatch[];      // Top 3
  stage: LeadStage;
  createdBy?: string;                // userId of GC/dev/sub
  assignedTo?: string;              // contractor who accepted
  nextActionAt?: string;
  ownerId?: string;
  notes?: LeadNote[];
  photos?: LeadPhoto[];
  snoozedUntil?: string;
  statusHistory?: Array<{ stage: LeadStage; timestamp: string; user?: string }>;
  nextFollowUp?: string;
  reminderNote?: string;
  isOwnRequest?: boolean; // Flag to indicate this is a request created by the current user
  matchedContractors?: number; // Number of contractors matched for this request
  archived?: boolean; // Whether the lead has been archived
  archivedAt?: string; // ISO timestamp when archived
  
  // Phase 1 Enhancements
  qualityIndicators?: LeadQualityIndicators;
  engagement?: LeadEngagement;
  urgencyScore?: number; // 0-100 based on time since created

  // Phase 3 Enhancements
  marketPricing?: {
    averagePrice: number;
    priceRange: { min: number; max: number };
    competitorCount: number;
    marketTrend: 'rising' | 'stable' | 'declining';
    pricePerSqFt?: number;
    laborCosts: { hourly: number; daily: number };
    materialCosts: { average: number; range: { min: number; max: number } };
  };
  pricingRecommendation?: {
    suggestedPrice: { min: number; max: number; optimal: number };
    confidence: 'high' | 'medium' | 'low';
    reasoning: string[];
    competitiveAdvantage: string;
    profitMargin: number;
  };
  customerReviews?: {
    overallRating: number;
    reviewCount: number;
    recentReviews: {
      rating: number;
      comment: string;
      date: string;
      contractor: string;
    }[];
    paymentHistory: { onTime: number; late: number; disputes: number };
    reliabilityScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    verifiedBuyer: boolean;
    repeatCustomer: boolean;
  };
  analytics?: {
    conversionRate: number;
    averageResponseTime: number;
    closeRate: number;
    averageDealSize: number;
    leadSourceEffectiveness: { [source: string]: any };
    performanceMetrics: {
      leadsViewed: number;
      leadsContacted: number;
      quotesSent: number;
      dealsClosed: number;
    };
    seasonalTrends: { month: string; leadCount: number; conversionRate: number }[];
  };
  notifications?: {
    priority: 'high' | 'medium' | 'low';
    type: 'new_lead' | 'follow_up' | 'competitor_activity' | 'market_opportunity' | 'reminder';
    title: string;
    message: string;
    actionRequired: boolean;
    expiresAt?: string;
    leadId?: string;
  }[];
  tasks?: LeadTask[];
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

export interface LeadAnalytics {
  total: number;
  byStage: Record<LeadStage, number>;
  averageScore: number;
  conversionRate: number;
  topSources: Array<{ source: string; count: number }>;
}

