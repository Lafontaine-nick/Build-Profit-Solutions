import { Lead, LeadSource, LeadStage } from '../lib/leads/types';
import Constants from 'expo-constants';
import { withProjectLeadsAuth } from '@/utils/projectLeadsAuthFetch';
import { clerkAuthService } from './clerkAuth';

const PRODUCTION_API_BASE_URL = 'https://build-profit-solutions-backend.onrender.com/api';

const normalizeApiBaseUrl = (url: string): string => {
  const trimmed = url.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const isLocalUrl = (url: string): boolean => {
  return url.includes('localhost') || url.includes('192.168.') || url.includes('10.0.2.2');
};

const resolveApiBaseUrl = (): string => {
  const allowLocalBackend =
    process.env.EXPO_PUBLIC_USE_LOCALHOST === 'true' ||
    process.env.EXPO_PUBLIC_SIMULATOR_USE_LOCAL === 'true' ||
    process.env.EXPO_PUBLIC_EMULATOR_USE_LOCAL === 'true';

  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) {
    const normalized = normalizeApiBaseUrl(envUrl);
    if (isLocalUrl(normalized) && !allowLocalBackend) {
      if (__DEV__) {
        console.log('⚠️ unifiedLeadService ignoring local env URL, using production');
      }
      return PRODUCTION_API_BASE_URL;
    }
    return normalized;
  }

  const configUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (configUrl) {
    const normalized = normalizeApiBaseUrl(configUrl);
    if (isLocalUrl(normalized) && !allowLocalBackend) {
      if (__DEV__) {
        console.log('⚠️ unifiedLeadService ignoring local config URL, using production');
      }
      return PRODUCTION_API_BASE_URL;
    }
    return normalized;
  }

  return PRODUCTION_API_BASE_URL;
};

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
    BPS_SELECTION: number;
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
  private get apiBaseUrl(): string {
    return resolveApiBaseUrl();
  }

  /** Clerk id or email — must match `GET /unified-leads/contractor/:id` auth scope. */
  private resolveContractorScopeKey(): string {
    const u = clerkAuthService.getAuthState().user;
    const fromSession = (u?.id || u?.email || '').trim();
    if (fromSession) return fromSession;
    return (this.contractorId || 'contractor-demo').trim();
  }

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

      const url = `${this.apiBaseUrl}/unified-leads/contractor/${encodeURIComponent(
        this.resolveContractorScopeKey()
      )}?${queryParams.toString()}`;

      const response = await fetch(
        url,
        await withProjectLeadsAuth({
          headers: {
            Accept: 'application/json',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
          cache: 'no-store',
        })
      );
      
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
      const response = await fetch(
        `${this.apiBaseUrl}/unified-leads/contractor/${encodeURIComponent(
          this.resolveContractorScopeKey()
        )}/stats`,
        await withProjectLeadsAuth({ headers: { Accept: 'application/json' } })
      );
      
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
      const response = await fetch(
        `${this.apiBaseUrl}/unified-leads/contractor/${encodeURIComponent(
          this.resolveContractorScopeKey()
        )}/insights`,
        await withProjectLeadsAuth({ headers: { Accept: 'application/json' } })
      );
      
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
      const response = await fetch(
        `${this.apiBaseUrl}/unified-leads/leads/${leadId}/stage`,
        await withProjectLeadsAuth({
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ stage }),
        })
      );

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
      const response = await fetch(
        `${this.apiBaseUrl}/unified-leads/leads/${leadId}/accept`,
        await withProjectLeadsAuth({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message != null ? { message } : {}),
        })
      );

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
      const response_body = await fetch(
        `${this.apiBaseUrl}/unified-leads/leads/${leadId}/respond-bid`,
        await withProjectLeadsAuth({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            response,
            bidAmount,
            message,
            documents,
          }),
        })
      );

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
      const response = await fetch(
        `${this.apiBaseUrl}/unified-leads/leads/${leadId}`,
        await withProjectLeadsAuth({ headers: { Accept: 'application/json' } })
      );
      
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
      const response = await fetch(
        `${this.apiBaseUrl}/project-leads/projects/${projectId}/create-leads`,
        await withProjectLeadsAuth({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trades,
            contractorId: this.resolveContractorScopeKey(),
          }),
        })
      );

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

  // Get available projects for lead creation
  async getAvailableProjects(): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/project-leads/projects`,
        await withProjectLeadsAuth({ headers: { Accept: 'application/json' } })
      );
      
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
}

// Export singleton instance
export const unifiedLeadService = new UnifiedLeadService();
