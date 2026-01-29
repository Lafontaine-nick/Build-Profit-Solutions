import { Lead, LeadSource, LeadStage } from '../lib/leads/types';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'http://192.168.0.201:3001/api';

export interface LeadFilters {
  source?: LeadSource | 'all';
  trade?: string;
  stage?: LeadStage;
  minScore?: number;
  sortBy?: 'priority' | 'score' | 'date' | 'budget';
}

export interface LeadStats {
  total: number;
  bySource: {
    PROJECT_BASED: number;
    BID_INVITATION: number;
    SHARED: number;
    AI_ESTIMATE: number;
    MARKETPLACE: number;
  };
  byStage: {
    new: number;
    contacted: number;
    quoted: number;
    proposal: number;
    won: number;
    lost: number;
  };
  highValue: number;
  averageScore: number;
}

export interface LeadInsights {
  highValueLeads: Lead[];
  urgentLeads: Lead[];
  recentLeads: Lead[];
  totalActiveLeads: number;
}

export class UnifiedLeadService {
  private contractorId: string;

  constructor(contractorId: string = 'contractor-demo') {
    this.contractorId = contractorId;
  }

  // Get all leads for the contractor with filtering
  async getLeads(filters: LeadFilters = {}): Promise<Lead[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.source && filters.source !== 'all') {
        queryParams.append('source', filters.source);
      }
      if (filters.trade) {
        queryParams.append('trade', filters.trade);
      }
      if (filters.stage) {
        queryParams.append('stage', filters.stage);
      }
      if (filters.minScore) {
        queryParams.append('minScore', filters.minScore.toString());
      }
      if (filters.sortBy) {
        queryParams.append('sortBy', filters.sortBy);
      }

      const url = `${API_BASE_URL}/unified-leads/contractor/${this.contractorId}?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.leads || [];

    } catch (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }
  }

  // Get lead statistics
  async getLeadStats(): Promise<LeadStats> {
    try {
      const response = await fetch(`${API_BASE_URL}/unified-leads/contractor/${this.contractorId}/stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.stats;

    } catch (error) {
      console.error('Error fetching lead stats:', error);
      throw error;
    }
  }

  // Get lead insights
  async getLeadInsights(): Promise<LeadInsights> {
    try {
      const response = await fetch(`${API_BASE_URL}/unified-leads/contractor/${this.contractorId}/insights`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.insights;

    } catch (error) {
      console.error('Error fetching lead insights:', error);
      throw error;
    }
  }

  // Update lead stage
  async updateLeadStage(leadId: string, stage: LeadStage): Promise<Lead> {
    try {
      const response = await fetch(`${API_BASE_URL}/unified-leads/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage,
          contractorId: this.contractorId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.lead;

    } catch (error) {
      console.error('Error updating lead stage:', error);
      throw error;
    }
  }

  // Accept a lead
  async acceptLead(leadId: string, message?: string): Promise<Lead> {
    try {
      const response = await fetch(`${API_BASE_URL}/unified-leads/leads/${leadId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractorId: this.contractorId,
          message
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.lead;

    } catch (error) {
      console.error('Error accepting lead:', error);
      throw error;
    }
  }

  // Respond to a bid invitation
  async respondToBid(
    leadId: string, 
    response: 'accepted' | 'declined' | 'countered',
    bidAmount?: number,
    message?: string,
    documents?: string[]
  ): Promise<Lead> {
    try {
      const response_body = await fetch(`${API_BASE_URL}/unified-leads/leads/${leadId}/respond-bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractorId: this.contractorId,
          response,
          bidAmount,
          message,
          documents
        }),
      });

      if (!response_body.ok) {
        throw new Error(`HTTP error! status: ${response_body.status}`);
      }

      const data = await response_body.json();
      return data.lead;

    } catch (error) {
      console.error('Error responding to bid:', error);
      throw error;
    }
  }

  // Get lead details
  async getLeadDetails(leadId: string): Promise<Lead> {
    try {
      const response = await fetch(`${API_BASE_URL}/unified-leads/leads/${leadId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.lead;

    } catch (error) {
      console.error('Error fetching lead details:', error);
      throw error;
    }
  }

  // Create project-based leads (for GCs)
  async createProjectLeads(projectId: string, trades: string[]): Promise<Lead[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/project-leads/projects/${projectId}/create-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trades,
          contractorId: this.contractorId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.leads;

    } catch (error) {
      console.error('Error creating project leads:', error);
      throw error;
    }
  }

  // Send bid invitations (for GCs)
  async sendBidInvitations(
    projectId: string,
    trade: string,
    contractorIds: string[],
    message?: string,
    deadline?: string
  ): Promise<Lead[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/bid-invitations/send-invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          trade,
          contractorIds,
          message,
          deadline
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.invitations;

    } catch (error) {
      console.error('Error sending bid invitations:', error);
      throw error;
    }
  }

  // Share a lead with other contractors
  async shareLead(
    originalLeadId: string,
    trade: string,
    message?: string,
    maxShares: number = 5,
    targetAreas: string[] = [],
    minRating: number = 4.0
  ): Promise<Lead[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/shared-leads/share-lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalLeadId,
          sharedBy: this.contractorId,
          trade,
          message,
          maxShares,
          targetAreas,
          minRating
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.sharedLeads;

    } catch (error) {
      console.error('Error sharing lead:', error);
      throw error;
    }
  }

  // Get available projects for lead creation
  async getAvailableProjects(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/project-leads/projects`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.projects;

    } catch (error) {
      console.error('Error fetching available projects:', error);
      throw error;
    }
  }

  // Get contractor network for sharing
  async getContractorNetwork(trade?: string, minRating: number = 4.0, area?: string): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (trade) {
        queryParams.append('trade', trade);
      }
      if (minRating) {
        queryParams.append('minRating', minRating.toString());
      }
      if (area) {
        queryParams.append('area', area);
      }

      const url = `${API_BASE_URL}/shared-leads/network?${queryParams.toString()}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.contractors;

    } catch (error) {
      console.error('Error fetching contractor network:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const unifiedLeadService = new UnifiedLeadService();
