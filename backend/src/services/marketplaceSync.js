/**
 * Marketplace Lead Sync Service
 * Syncs marketplace leads into the main leads system for contractors
 */

const axios = require('axios');

class MarketplaceSyncService {
  constructor() {
    this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    this.syncInterval = 5 * 60 * 1000; // 5 minutes
    this.isRunning = false;
  }

  /**
   * Start the sync service
   */
  start() {
    if (this.isRunning) {
      console.log('🔄 Marketplace sync service already running');
      return;
    }

    console.log('🚀 Starting marketplace lead sync service...');
    this.isRunning = true;

    // Initial sync
    this.syncMarketplaceLeads();

    // Set up recurring sync
    this.syncTimer = setInterval(() => {
      this.syncMarketplaceLeads();
    }, this.syncInterval);
  }

  /**
   * Stop the sync service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('⏹️ Stopping marketplace lead sync service...');
    this.isRunning = false;

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Sync marketplace leads into the main leads system
   */
  async syncMarketplaceLeads() {
    try {
      console.log('🔄 Syncing marketplace leads...');

      // Fetch new marketplace leads
      const response = await axios.get(`${this.apiBaseUrl}/api/marketplace-leads`, {
        params: {
          // Only get leads from the last sync
          since: this.lastSyncTime || new Date(Date.now() - this.syncInterval).toISOString()
        }
      });

      const marketplaceLeads = response.data.leads || [];

      if (marketplaceLeads.length === 0) {
        console.log('✅ No new marketplace leads to sync');
        this.lastSyncTime = new Date().toISOString();
        return;
      }

      console.log(`📥 Found ${marketplaceLeads.length} new marketplace leads`);

      // Transform marketplace leads to contractor leads
      const contractorLeads = marketplaceLeads.map(lead => this.transformToContractorLead(lead));

      // Add leads to the main leads system
      for (const lead of contractorLeads) {
        try {
          await axios.post(`${this.apiBaseUrl}/api/leads`, lead);
          console.log(`✅ Synced marketplace lead: ${lead.id}`);
        } catch (error) {
          console.error(`❌ Failed to sync lead ${lead.id}:`, error.message);
        }
      }

      this.lastSyncTime = new Date().toISOString();
      console.log(`🎉 Successfully synced ${contractorLeads.length} marketplace leads`);

    } catch (error) {
      console.error('❌ Error syncing marketplace leads:', error.message);
    }
  }

  /**
   * Transform marketplace lead to contractor lead format
   */
  transformToContractorLead(marketplaceLead) {
    return {
      // Use the same ID to maintain traceability
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
      verified: false, // Marketplace leads need verification
      verification: marketplaceLead.verification,
      stage: 'new',
      createdBy: 'marketplace-sync',
      assignedTo: null,
      createdAt: marketplaceLead.createdAt,
      // Additional fields for contractor app
      notes: [],
      photos: [],
      nextActionAt: null,
      ownerId: null,
      // Preserve marketplace metadata
      marketplaceData: marketplaceLead.marketplaceData
    };
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/api/marketplace-leads/stats/overview`);
      return {
        lastSync: this.lastSyncTime,
        isRunning: this.isRunning,
        syncInterval: this.syncInterval,
        marketplaceStats: response.data
      };
    } catch (error) {
      console.error('Error fetching sync stats:', error.message);
      return {
        lastSync: this.lastSyncTime,
        isRunning: this.isRunning,
        syncInterval: this.syncInterval,
        error: error.message
      };
    }
  }

  /**
   * Manual sync trigger (for testing or immediate sync)
   */
  async forceSync() {
    console.log('🔄 Manual sync triggered...');
    await this.syncMarketplaceLeads();
  }
}

// Create singleton instance
const marketplaceSyncService = new MarketplaceSyncService();

module.exports = marketplaceSyncService;



