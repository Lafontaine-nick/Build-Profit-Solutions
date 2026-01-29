import { apiService } from './api';

// Enhanced Lead interface with best-in-industry features
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  projectType:
    | 'residential'
    | 'commercial'
    | 'renovation'
    | 'new-build'
    | 'maintenance';
  projectSize: 'small' | 'medium' | 'large';
  budget: {
    min: number;
    max: number;
    currency: string;
  };
  timeline: {
    startDate: string;
    duration: number; // weeks
    urgency: 'low' | 'medium' | 'high';
  };
  location: {
    city: string;
    state: string;
    zipCode: string;
  };
  requirements: string;
  source:
    | 'website'
    | 'referral'
    | 'social-media'
    | 'cold-outreach'
    | 'advertisement';
  status: 'new' | 'contacted' | 'qualified' | 'proposal-sent' | 'won' | 'lost';

  // 🧠 Best-in-Industry Features
  aiScore: number; // AI-generated seriousness score (0-100)
  engagementLevel: 'hot' | 'warm' | 'cold'; // Real-time engagement tracking
  freshnessScore: number; // Lead freshness (0-100, based on recency)
  contractorMatch: {
    isMatched: boolean;
    matchScore: number;
    contractorId?: string;
    contractorName?: string;
  };
  followUpHistory: FollowUpEntry[];
  autoFollowUp: {
    isEnabled: boolean;
    nextFollowUpDate: string;
    followUpType: 'email' | 'call' | 'text' | 'proposal';
    template: string;
  };
  crmData: {
    lastContacted: string;
    contactAttempts: number;
    responseRate: number;
    preferredContactMethod: 'email' | 'phone' | 'text';
    notes: string[];
    tags: string[];
  };

  // Standard fields
  priority: 'low' | 'medium' | 'high';
  notes: string[];
  createdAt: string;
  updatedAt: string;
  lastContacted?: string;
  nextFollowUp?: string;
  assignedTo?: string;
  tags: string[];
}

export interface FollowUpEntry {
  id: string;
  date: string;
  type: 'email' | 'call' | 'text' | 'proposal';
  status: 'scheduled' | 'completed' | 'failed';
  notes: string;
  response?: string;
}

export interface LeadFilters {
  status?: string[];
  priority?: string[];
  projectType?: string[];
  source?: string[];
  assignedTo?: string;
  contractorId?: string; // New: Filter leads by contractor
  dateRange?: {
    start: string;
    end: string;
  };
  scoreRange?: {
    min: number;
    max: number;
  };
  engagementLevel?: string[];
  freshnessScore?: {
    min: number;
    max: number;
  };
  contractorMatch?: boolean;
}

export interface LeadAnalytics {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  byPriority: Record<string, number>;
  byEngagementLevel: Record<string, number>;
  averageAIScore: number;
  averageFreshnessScore: number;
  averageResponseRate: number;
  conversionRate: number;
  monthlyTrend: Array<{ month: string; count: number }>;
  topPerformingSources: Array<{ source: string; conversionRate: number }>;
  contractorMatchRate: number;
}

class LeadService {
  private apiService = apiService;

  // 🧠 AI-Powered Lead Scoring
  async scoreLead(leadData: Partial<Lead>): Promise<{
    aiScore: number;
    engagementLevel: 'hot' | 'warm' | 'cold';
    priority: 'low' | 'medium' | 'high';
    reasoning: string;
    factors: string[];
  }> {
    try {
      const response = await this.apiService.scoreLead(leadData);
      return response.data;
    } catch (error) {
      console.error('Error scoring lead:', error);
      throw error;
    }
  }

  // 🧪 Pre-vetted Lead Creation with AI Scoring
  async createLead(leadData: Partial<Lead>): Promise<Lead> {
    try {
      // First, score the lead with AI
      const scoreResult = await this.scoreLead(leadData);

      // Create lead with AI insights
      const enhancedLeadData = {
        ...leadData,
        aiScore: scoreResult.aiScore,
        engagementLevel: scoreResult.engagementLevel,
        priority: scoreResult.priority,
        freshnessScore: this.calculateFreshnessScore(),
        contractorMatch: {
          isMatched: false,
          matchScore: 0,
        },
        followUpHistory: [],
        autoFollowUp: {
          isEnabled: true,
          nextFollowUpDate: this.calculateNextFollowUpDate(),
          followUpType: 'email' as const,
          template: this.getFollowUpTemplate(scoreResult.engagementLevel),
        },
        crmData: {
          lastContacted: new Date().toISOString(),
          contactAttempts: 0,
          responseRate: 0,
          preferredContactMethod: 'email' as const,
          notes: [scoreResult.reasoning],
          tags: scoreResult.factors,
        },
      };

      const response = await this.apiService.createLead(enhancedLeadData);
      return response.data;
    } catch (error) {
      console.error('Error creating lead:', error);
      throw error;
    }
  }

  // 🔄 Real-time Lead Updates with Freshness Tracking
  async getLeads(filters?: LeadFilters): Promise<Lead[]> {
    try {
      const response = await this.apiService.getLeads(filters);

      // The API service returns { success: true, data: backendResponse }
      // The backend response is { success: true, data: [...] }
      let leads = [];
      if (
        response.success &&
        response.data &&
        response.data.success &&
        Array.isArray(response.data.data)
      ) {
        // Handle: { success: true, data: { success: true, data: [...] } }
        leads = response.data.data;
      } else if (
        response.success &&
        response.data &&
        Array.isArray(response.data)
      ) {
        // Handle: { success: true, data: [...] }
        leads = response.data;
      } else {
        console.error('Invalid leads response structure:', response);
        return [];
      }

      // Update freshness scores in real-time
      return leads.map(lead => ({
        ...lead,
        freshnessScore: this.calculateFreshnessScore(lead.createdAt),
      })) as Lead[];
    } catch (error) {
      console.error('Error fetching leads:', error);
      return []; // Return empty array instead of throwing
    }
  }

  // 🎯 Contractor Control - Match Leads to Contractors
  async matchLeadToContractor(
    leadId: string,
    contractorId: string
  ): Promise<Lead> {
    try {
      const response = await this.apiService.updateLead(leadId, {
        contractorMatch: {
          isMatched: true,
          matchScore: 85, // Calculate based on contractor profile
          contractorId,
          contractorName: 'Contractor Name', // Get from contractor service
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error matching lead to contractor:', error);
      throw error;
    }
  }

  // 💸 Engagement-Based Pricing - Track Lead Engagement
  async trackLeadEngagement(
    leadId: string,
    engagement: {
      type:
        | 'email_open'
        | 'email_click'
        | 'call'
        | 'text_response'
        | 'proposal_view';
      data?: any;
    }
  ): Promise<void> {
    try {
      const lead = await this.getLead(leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }
      const updatedEngagementLevel = this.calculateEngagementLevel(
        lead,
        engagement
      );

      await this.apiService.updateLead(leadId, {
        engagementLevel: updatedEngagementLevel,
        'crmData.lastContacted': new Date().toISOString(),
        'crmData.contactAttempts': lead.crmData.contactAttempts + 1,
      });
    } catch (error) {
      console.error('Error tracking lead engagement:', error);
      throw error;
    }
  }

  // 🔕 Built-in CRM + Auto Follow-up Logic
  async scheduleFollowUp(
    leadId: string,
    followUpData: {
      date: string;
      type: 'email' | 'call' | 'text' | 'proposal';
      template?: string;
      notes?: string;
    }
  ): Promise<Lead> {
    try {
      const response = await this.apiService.scheduleLeadFollowUp(leadId, {
        ...followUpData,
        autoFollowUp: {
          isEnabled: true,
          nextFollowUpDate: followUpData.date,
          followUpType: followUpData.type,
          template: followUpData.template || this.getFollowUpTemplate('warm'),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
      throw error;
    }
  }

  // 📊 Enhanced Analytics with Best-in-Industry Metrics
  async getLeadAnalytics(): Promise<LeadAnalytics> {
    try {
      const response = await this.apiService.getLeadAnalytics();

      // The API service returns { success: true, data: backendResponse }
      // The backend response is { success: true, data: {...} }
      let analyticsData;
      if (
        response.success &&
        response.data &&
        response.data.success &&
        response.data.data
      ) {
        // Handle: { success: true, data: { success: true, data: {...} } }
        analyticsData = response.data.data;
      } else if (response.success && response.data) {
        // Handle: { success: true, data: {...} }
        analyticsData = response.data;
      } else {
        analyticsData = {
          total: 0,
          byStatus: {},
          bySource: {},
          byPriority: {},
          byEngagementLevel: {},
          averageAIScore: 0,
          averageFreshnessScore: 0,
          averageResponseRate: 0,
          conversionRate: 0,
          monthlyTrend: [],
          topPerformingSources: [],
          contractorMatchRate: 0,
        };
      }

      return analyticsData;
    } catch (error) {
      console.error('Error fetching lead analytics:', error);
      return {
        total: 0,
        byStatus: {},
        bySource: {},
        byPriority: {},
        byEngagementLevel: {},
        averageAIScore: 0,
        averageFreshnessScore: 0,
        averageResponseRate: 0,
        conversionRate: 0,
        monthlyTrend: [],
        topPerformingSources: [],
        contractorMatchRate: 0,
      };
    }
  }

  // Standard CRUD operations
  async getLead(id: string): Promise<Lead> {
    try {
      const response = await this.apiService.getLead(id);
      if (!response.data) {
        throw new Error('Lead not found');
      }
      return response.data;
    } catch (error) {
      console.error('Error fetching lead:', error);
      throw error;
    }
  }

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
    try {
      const response = await this.apiService.updateLead(id, updates);
      if (!response.data) {
        throw new Error('Failed to update lead');
      }
      return response.data;
    } catch (error) {
      console.error('Error updating lead:', error);
      throw error;
    }
  }

  async deleteLead(id: string): Promise<void> {
    try {
      await this.apiService.deleteLead(id);
    } catch (error) {
      console.error('Error deleting lead:', error);
      throw error;
    }
  }

  // Helper methods for best-in-industry features
  private calculateFreshnessScore(createdAt?: string): number {
    if (!createdAt) return 100;
    const now = new Date();
    const created = new Date(createdAt);
    const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    // Freshness decreases over time: 100% at 0 hours, 50% at 24 hours, 0% at 72 hours
    if (hoursDiff <= 0) return 100;
    if (hoursDiff >= 72) return 0;
    return Math.max(0, 100 - (hoursDiff / 72) * 100);
  }

  private calculateNextFollowUpDate(): string {
    const now = new Date();
    // Schedule next follow-up in 24 hours
    now.setHours(now.getHours() + 24);
    return now.toISOString();
  }

  private getFollowUpTemplate(
    engagementLevel: 'hot' | 'warm' | 'cold'
  ): string {
    const templates = {
      hot: "Hi {name}, I noticed you're interested in {projectType}. I have immediate availability and would love to discuss your project. When would be a good time to call?",
      warm: "Hi {name}, thanks for your interest in {projectType}. I'd be happy to provide a detailed quote. Would you like to schedule a consultation?",
      cold: "Hi {name}, I hope you're doing well. I specialize in {projectType} projects and would love to help with your {projectType} needs. Let me know if you'd like to learn more.",
    };
    return templates[engagementLevel];
  }

  private calculateEngagementLevel(
    lead: Lead,
    engagement: any
  ): 'hot' | 'warm' | 'cold' {
    // Calculate engagement level based on recent activity
    const engagementScores: Record<string, number> = {
      email_open: 1,
      email_click: 3,
      call: 5,
      text_response: 4,
      proposal_view: 6,
    };

    const currentScore = lead.crmData.contactAttempts * 2;
    const newScore = currentScore + (engagementScores[engagement.type] || 0);

    if (newScore >= 10) return 'hot';
    if (newScore >= 5) return 'warm';
    return 'cold';
  }
}

// Singleton instance
const leadService = new LeadService();
export { leadService };

// Hook for React components
export const useLeadService = () => leadService;
