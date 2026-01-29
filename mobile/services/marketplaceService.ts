/**
 * Marketplace Service
 * Handles marketplace lead operations for the contractor app
 */

import { Lead } from '../lib/leads/types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export interface MarketplaceLead {
  id: string;
  title: string;
  trade: string;
  source: 'MARKETPLACE';
  contact: {
    name: string;
    email: string;
    phone: string;
    company?: string;
  };
  location: {
    city: string;
    state: string;
    zip: string;
    lat?: number;
    lng?: number;
  };
  project: {
    type: string;
    budgetMin: number;
    budgetMax: number;
    timeline: 'Normal' | 'Soon' | 'Urgent';
  };
  description: string;
  aiScore: number;
  verified: boolean;
  verification: {
    emailValid: boolean;
    phoneValid: boolean;
  };
  stage: string;
  createdBy: string;
  assignedTo?: string;
  createdAt: string;
  marketplaceData?: {
    submittedAt: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface MarketplaceStats {
  totalLeads: number;
  newLeads: number;
  claimedLeads: number;
  leadsByTrade: Record<string, number>;
  leadsByTimeline: Record<string, number>;
  averageBudget: number;
  totalValue: number;
}

export interface SyncStatus {
  lastSync: string;
  isRunning: boolean;
  syncInterval: number;
  marketplaceStats: MarketplaceStats;
}

class MarketplaceService {
  /**
   * Fetch all marketplace leads
   */
  async getMarketplaceLeads(filters?: {
    trade?: string;
    city?: string;
    minBudget?: number;
  }): Promise<MarketplaceLead[]> {
    try {
      const params = new URLSearchParams();
      
      if (filters?.trade) params.append('trade', filters.trade);
      if (filters?.city) params.append('city', filters.city);
      if (filters?.minBudget) params.append('minBudget', filters.minBudget.toString());

      const response = await fetch(`${API_BASE_URL}/api/marketplace-leads?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch marketplace leads: ${response.status}`);
      }

      const data = await response.json();
      return data.leads || [];
    } catch (error) {
      console.error('Error fetching marketplace leads:', error);
      throw error;
    }
  }

  /**
   * Get marketplace statistics
   */
  async getMarketplaceStats(): Promise<MarketplaceStats> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/marketplace-leads/stats/overview`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch marketplace stats: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching marketplace stats:', error);
      throw error;
    }
  }

  /**
   * Claim a marketplace lead
   */
  async claimLead(leadId: string, contractorId: string, contractorName: string): Promise<MarketplaceLead> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/marketplace-leads/${leadId}/claim`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractorId,
          contractorName,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to claim lead: ${response.status}`);
      }

      const data = await response.json();
      return data.lead;
    } catch (error) {
      console.error('Error claiming marketplace lead:', error);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/marketplace-sync/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sync status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching sync status:', error);
      throw error;
    }
  }

  /**
   * Trigger manual sync
   */
  async triggerSync(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/marketplace-sync/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger sync: ${response.status}`);
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      throw error;
    }
  }

  /**
   * Transform marketplace lead to contractor lead format
   */
  transformToContractorLead(marketplaceLead: MarketplaceLead): Lead {
    return {
      id: marketplaceLead.id,
      title: marketplaceLead.title,
      trade: marketplaceLead.trade,
      projectId: null,
      source: 'MARKETPLACE',
      contact: marketplaceLead.contact,
      location: marketplaceLead.location,
      project: marketplaceLead.project,
      description: marketplaceLead.description,
      aiScore: marketplaceLead.aiScore,
      verified: marketplaceLead.verified,
      verification: marketplaceLead.verification,
      stage: marketplaceLead.stage as any,
      createdBy: marketplaceLead.createdBy,
      assignedTo: marketplaceLead.assignedTo,
      createdAt: marketplaceLead.createdAt,
      notes: [],
      photos: [],
      nextActionAt: null,
      ownerId: null,
      nextFollowUp: null,
      reminderNote: null,
      snoozedUntil: null,
      statusHistory: [],
    };
  }

  /**
   * Get leads that match contractor's specialties
   */
  async getRelevantLeads(contractorTrades: string[], contractorLocation?: string): Promise<MarketplaceLead[]> {
    try {
      const allLeads = await this.getMarketplaceLeads();
      
      return allLeads.filter(lead => {
        // Filter by trade
        const matchesTrade = contractorTrades.includes(lead.trade) || 
                           contractorTrades.includes(lead.project.type);
        
        // Filter by location if specified
        const matchesLocation = !contractorLocation || 
                              lead.location.city.toLowerCase().includes(contractorLocation.toLowerCase());
        
        // Only show unclaimed leads
        const isUnclaimed = !lead.assignedTo;
        
        return matchesTrade && matchesLocation && isUnclaimed;
      });
    } catch (error) {
      console.error('Error fetching relevant leads:', error);
      return [];
    }
  }
}

export const marketplaceService = new MarketplaceService();



