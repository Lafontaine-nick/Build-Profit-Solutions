import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  api,
  Project,
  BudgetLine,
  Expense,
  ChangeOrder,
  TeamMember,
  Milestone,
  Message,
} from './BackendAPI';

// Data Sync Service
class DataSyncService {
  private syncInProgress = false;
  private lastSyncTime: Date | null = null;
  private syncInterval: ReturnType<typeof setTimeout> | null = null;

  // Cache keys
  private readonly CACHE_KEYS = {
    PROJECTS: 'cached_projects',
    BUDGET_LINES: 'cached_budget_lines',
    EXPENSES: 'cached_expenses',
    CHANGE_ORDERS: 'cached_change_orders',
    TEAM_MEMBERS: 'cached_team_members',
    MILESTONES: 'cached_milestones',
    MESSAGES: 'cached_messages',
    LAST_SYNC: 'last_sync_time',
  };

  // Initialize sync service
  async initialize(): Promise<void> {
    try {
      await this.loadLastSyncTime();
      await this.startPeriodicSync();
      console.log('DataSyncService initialized');
    } catch (error) {
      console.error('Failed to initialize DataSyncService:', error);
    }
  }

  // Start periodic sync (every 5 minutes)
  private async startPeriodicSync(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(
      async () => {
        await this.syncAllData();
      },
      5 * 60 * 1000
    ); // 5 minutes
  }

  // Stop periodic sync
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Load last sync time
  private async loadLastSyncTime(): Promise<void> {
    try {
      const lastSync = await AsyncStorage.getItem(this.CACHE_KEYS.LAST_SYNC);
      if (lastSync) {
        this.lastSyncTime = new Date(lastSync);
      }
    } catch (error) {
      console.error('Failed to load last sync time:', error);
    }
  }

  // Save last sync time
  private async saveLastSyncTime(): Promise<void> {
    try {
      this.lastSyncTime = new Date();
      await AsyncStorage.setItem(
        this.CACHE_KEYS.LAST_SYNC,
        this.lastSyncTime.toISOString()
      );
    } catch (error) {
      console.error('Failed to save last sync time:', error);
    }
  }

  // Sync all data
  async syncAllData(): Promise<void> {
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    this.syncInProgress = true;
    console.log('Starting data sync...');

    try {
      // Sync projects first
      await this.syncProjects();

      // Get all project IDs for other data
      const projects = await this.getCachedProjects();
      const projectIds = projects.map(p => p.id);

      // Sync data for each project
      for (const projectId of projectIds) {
        await Promise.all([
          this.syncBudgetLines(projectId),
          this.syncExpenses(projectId),
          this.syncChangeOrders(projectId),
          this.syncTeamMembers(projectId),
          this.syncMilestones(projectId),
          this.syncMessages(projectId),
        ]);
      }

      await this.saveLastSyncTime();
      console.log('Data sync completed successfully');
    } catch (error) {
      console.error('Data sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync projects
  async syncProjects(): Promise<void> {
    try {
      const response = await api.getProjects();
      if (response.success && response.data) {
        await this.cacheProjects(response.data);
        console.log(`Synced ${response.data.length} projects`);
      }
    } catch (error) {
      console.error('Failed to sync projects:', error);
    }
  }

  // Sync budget lines for a project
  async syncBudgetLines(projectId: string): Promise<void> {
    try {
      const response = await api.getBudgetLines(projectId);
      if (response.success && response.data) {
        await this.cacheBudgetLines(projectId, response.data);
        console.log(
          `Synced ${response.data.length} budget lines for project ${projectId}`
        );
      }
    } catch (error) {
      console.error(
        `Failed to sync budget lines for project ${projectId}:`,
        error
      );
    }
  }

  // Sync expenses for a project
  async syncExpenses(projectId: string): Promise<void> {
    try {
      const response = await api.getExpenses(projectId);
      if (response.success && response.data) {
        await this.cacheExpenses(projectId, response.data);
        console.log(
          `Synced ${response.data.length} expenses for project ${projectId}`
        );
      }
    } catch (error) {
      console.error(`Failed to sync expenses for project ${projectId}:`, error);
    }
  }

  // Sync change orders for a project
  async syncChangeOrders(projectId: string): Promise<void> {
    try {
      const response = await api.getChangeOrders(projectId);
      if (response.success && response.data) {
        await this.cacheChangeOrders(projectId, response.data);
        console.log(
          `Synced ${response.data.length} change orders for project ${projectId}`
        );
      }
    } catch (error) {
      console.error(
        `Failed to sync change orders for project ${projectId}:`,
        error
      );
    }
  }

  // Sync team members for a project
  async syncTeamMembers(projectId: string): Promise<void> {
    try {
      const response = await api.getTeamMembers(projectId);
      if (response.success && response.data) {
        await this.cacheTeamMembers(projectId, response.data);
        console.log(
          `Synced ${response.data.length} team members for project ${projectId}`
        );
      }
    } catch (error) {
      console.error(
        `Failed to sync team members for project ${projectId}:`,
        error
      );
    }
  }

  // Sync milestones for a project
  async syncMilestones(projectId: string): Promise<void> {
    try {
      const response = await api.getMilestones(projectId);
      if (response.success && response.data) {
        await this.cacheMilestones(projectId, response.data);
        console.log(
          `Synced ${response.data.length} milestones for project ${projectId}`
        );
      }
    } catch (error) {
      console.error(
        `Failed to sync milestones for project ${projectId}:`,
        error
      );
    }
  }

  // Sync messages for a project
  async syncMessages(projectId: string): Promise<void> {
    try {
      // Sync messages for each channel
      const channels = ['general', 'team', 'client'];
      for (const channelId of channels) {
        const response = await api.getMessages(projectId, channelId);
        if (response.success && response.data) {
          await this.cacheMessages(projectId, channelId, response.data);
          console.log(
            `Synced ${response.data.length} messages for project ${projectId}, channel ${channelId}`
          );
        }
      }
    } catch (error) {
      console.error(`Failed to sync messages for project ${projectId}:`, error);
    }
  }

  // Cache methods
  async cacheProjects(projects: Project[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.CACHE_KEYS.PROJECTS,
        JSON.stringify(projects)
      );
    } catch (error) {
      console.error('Failed to cache projects:', error);
    }
  }

  async cacheBudgetLines(
    projectId: string,
    lines: BudgetLine[]
  ): Promise<void> {
    try {
      const key = `${this.CACHE_KEYS.BUDGET_LINES}_${projectId}`;
      await AsyncStorage.setItem(key, JSON.stringify(lines));
    } catch (error) {
      console.error(
        `Failed to cache budget lines for project ${projectId}:`,
        error
      );
    }
  }

  async cacheExpenses(projectId: string, expenses: Expense[]): Promise<void> {
    try {
      const key = `${this.CACHE_KEYS.EXPENSES}_${projectId}`;
      await AsyncStorage.setItem(key, JSON.stringify(expenses));
    } catch (error) {
      console.error(
        `Failed to cache expenses for project ${projectId}:`,
        error
      );
    }
  }

  async cacheChangeOrders(
    projectId: string,
    changeOrders: ChangeOrder[]
  ): Promise<void> {
    try {
      const key = `${this.CACHE_KEYS.CHANGE_ORDERS}_${projectId}`;
      await AsyncStorage.setItem(key, JSON.stringify(changeOrders));
    } catch (error) {
      console.error(
        `Failed to cache change orders for project ${projectId}:`,
        error
      );
    }
  }

  async cacheTeamMembers(
    projectId: string,
    members: TeamMember[]
  ): Promise<void> {
    try {
      const key = `${this.CACHE_KEYS.TEAM_MEMBERS}_${projectId}`;
      await AsyncStorage.setItem(key, JSON.stringify(members));
    } catch (error) {
      console.error(
        `Failed to cache team members for project ${projectId}:`,
        error
      );
    }
  }

  async cacheMilestones(
    projectId: string,
    milestones: Milestone[]
  ): Promise<void> {
    try {
      const key = `${this.CACHE_KEYS.MILESTONES}_${projectId}`;
      await AsyncStorage.setItem(key, JSON.stringify(milestones));
    } catch (error) {
      console.error(
        `Failed to cache milestones for project ${projectId}:`,
        error
      );
    }
  }

  async cacheMessages(
    projectId: string,
    channelId: string,
    messages: Message[]
  ): Promise<void> {
    try {
      const key = `${this.CACHE_KEYS.MESSAGES}_${projectId}_${channelId}`;
      await AsyncStorage.setItem(key, JSON.stringify(messages));
    } catch (error) {
      console.error(
        `Failed to cache messages for project ${projectId}, channel ${channelId}:`,
        error
      );
    }
  }

  // Get cached data methods
  async getCachedProjects(): Promise<Project[]> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEYS.PROJECTS);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Failed to get cached projects:', error);
      return [];
    }
  }

  async getCachedBudgetLines(projectId: string): Promise<BudgetLine[]> {
    try {
      const key = `${this.CACHE_KEYS.BUDGET_LINES}_${projectId}`;
      const cached = await AsyncStorage.getItem(key);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error(
        `Failed to get cached budget lines for project ${projectId}:`,
        error
      );
      return [];
    }
  }

  async getCachedExpenses(projectId: string): Promise<Expense[]> {
    try {
      const key = `${this.CACHE_KEYS.EXPENSES}_${projectId}`;
      const cached = await AsyncStorage.getItem(key);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error(
        `Failed to get cached expenses for project ${projectId}:`,
        error
      );
      return [];
    }
  }

  async getCachedChangeOrders(projectId: string): Promise<ChangeOrder[]> {
    try {
      const key = `${this.CACHE_KEYS.CHANGE_ORDERS}_${projectId}`;
      const cached = await AsyncStorage.getItem(key);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error(
        `Failed to get cached change orders for project ${projectId}:`,
        error
      );
      return [];
    }
  }

  async getCachedTeamMembers(projectId: string): Promise<TeamMember[]> {
    try {
      const key = `${this.CACHE_KEYS.TEAM_MEMBERS}_${projectId}`;
      const cached = await AsyncStorage.getItem(key);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error(
        `Failed to get cached team members for project ${projectId}:`,
        error
      );
      return [];
    }
  }

  async getCachedMilestones(projectId: string): Promise<Milestone[]> {
    try {
      const key = `${this.CACHE_KEYS.MILESTONES}_${projectId}`;
      const cached = await AsyncStorage.getItem(key);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error(
        `Failed to get cached milestones for project ${projectId}:`,
        error
      );
      return [];
    }
  }

  async getCachedMessages(
    projectId: string,
    channelId: string
  ): Promise<Message[]> {
    try {
      const key = `${this.CACHE_KEYS.MESSAGES}_${projectId}_${channelId}`;
      const cached = await AsyncStorage.getItem(key);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error(
        `Failed to get cached messages for project ${projectId}, channel ${channelId}:`,
        error
      );
      return [];
    }
  }

  // Clear cache
  async clearCache(): Promise<void> {
    try {
      const keys = Object.values(this.CACHE_KEYS);
      await AsyncStorage.multiRemove(keys);
      this.lastSyncTime = null;
      console.log('Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  // Get sync status
  getSyncStatus(): { lastSync: Date | null; inProgress: boolean } {
    return {
      lastSync: this.lastSyncTime,
      inProgress: this.syncInProgress,
    };
  }

  // Force sync
  async forceSync(): Promise<void> {
    console.log('Force sync requested');
    await this.syncAllData();
  }
}

// Create and export singleton instance
export const dataSync = new DataSyncService();

export default dataSync;
