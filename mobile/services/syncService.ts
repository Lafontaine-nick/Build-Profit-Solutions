import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './api';

export interface SyncItem {
  id: string;
  type: 'project' | 'lead' | 'invoice' | 'estimate' | 'client';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingItems: number;
  syncInProgress: boolean;
  lastError: string | null;
}

export interface SyncProgress {
  total: number;
  completed: number;
  current: string;
  status: 'idle' | 'syncing' | 'completed' | 'error';
}

class SyncService {
  private syncQueue: SyncItem[] = [];
  private syncInProgress: boolean = false;
  private lastSync: Date | null = null;
  private syncListeners: Array<(status: SyncStatus) => void> = [];
  private progressListeners: Array<(progress: SyncProgress) => void> = [];

  constructor() {
    this.loadSyncQueue();
    this.startPeriodicSync();
  }

  private async loadSyncQueue() {
    try {
      const queueData = await AsyncStorage.getItem('syncQueue');
      if (queueData) {
        this.syncQueue = JSON.parse(queueData);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  private async saveSyncQueue() {
    try {
      await AsyncStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  private async startPeriodicSync() {
    // Sync every 5 minutes when online
    setInterval(
      async () => {
        if (apiService.isConnected() && this.syncQueue.length > 0) {
          await this.syncPendingItems();
        }
      },
      5 * 60 * 1000
    );
  }

  async addToSyncQueue(
    item: Omit<SyncItem, 'id' | 'timestamp' | 'retryCount'>
  ): Promise<void> {
    const syncItem: SyncItem = {
      ...item,
      id: `${item.type}_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.syncQueue.push(syncItem);
    await this.saveSyncQueue();
    this.notifyStatusChange();

    // Try to sync immediately if online
    if (apiService.isConnected()) {
      await this.syncPendingItems();
    }
  }

  async syncPendingItems(): Promise<void> {
    if (this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    this.notifyStatusChange();

    const progress: SyncProgress = {
      total: this.syncQueue.length,
      completed: 0,
      current: '',
      status: 'syncing',
    };

    this.notifyProgressChange(progress);

    try {
      const itemsToSync = [...this.syncQueue];

      for (const item of itemsToSync) {
        progress.current = `Syncing ${item.type} ${item.action}`;
        this.notifyProgressChange(progress);

        try {
          await this.performSyncAction(item);

          // Remove from queue after successful sync
          this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
          await this.saveSyncQueue();

          progress.completed++;
          this.notifyProgressChange(progress);
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);

          // Increment retry count
          item.retryCount++;

          // Remove from queue if max retries exceeded
          if (item.retryCount >= item.maxRetries) {
            this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
            await this.saveSyncQueue();
            console.warn(`Removed item ${item.id} after max retries`);
          }
        }
      }

      this.lastSync = new Date();
      progress.status = 'completed';
      this.notifyProgressChange(progress);
    } catch (error) {
      console.error('Sync failed:', error);
      progress.status = 'error';
      this.notifyProgressChange(progress);
    } finally {
      this.syncInProgress = false;
      this.notifyStatusChange();
    }
  }

  private async performSyncAction(item: SyncItem): Promise<void> {
    const endpoint = this.getEndpointForType(item.type);
    const url = `${endpoint}${item.action === 'delete' ? `/${item.data.id}` : ''}`;

    const options: RequestInit = {
      method: this.getMethodForAction(item.action),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (item.action !== 'delete' && item.data) {
      options.body = JSON.stringify(item.data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
  }

  private getEndpointForType(type: string): string {
    const endpoints = {
      project: '/projects',
      lead: '/leads',
      invoice: '/invoices',
      estimate: '/estimates',
      client: '/clients',
    };
    return endpoints[type as keyof typeof endpoints] || '/data';
  }

  private getMethodForAction(action: string): string {
    const methods = {
      create: 'POST',
      update: 'PUT',
      delete: 'DELETE',
    };
    return methods[action as keyof typeof methods] || 'POST';
  }

  async forceSync(): Promise<void> {
    if (apiService.isConnected()) {
      await this.syncPendingItems();
    } else {
      throw new Error('No internet connection available');
    }
  }

  async getSyncStatus(): Promise<SyncStatus> {
    return {
      isOnline: apiService.isConnected(),
      lastSync: this.lastSync,
      pendingItems: this.syncQueue.length,
      syncInProgress: this.syncInProgress,
      lastError: null,
    };
  }

  async getPendingItems(): Promise<SyncItem[]> {
    return [...this.syncQueue];
  }

  async clearSyncQueue(): Promise<void> {
    this.syncQueue = [];
    await this.saveSyncQueue();
    this.notifyStatusChange();
  }

  async retryFailedItems(): Promise<void> {
    const failedItems = this.syncQueue.filter(item => item.retryCount > 0);

    for (const item of failedItems) {
      item.retryCount = 0; // Reset retry count
    }

    await this.saveSyncQueue();
    await this.syncPendingItems();
  }

  // Event listeners
  onStatusChange(callback: (status: SyncStatus) => void) {
    this.syncListeners.push(callback);
  }

  offStatusChange(callback: (status: SyncStatus) => void) {
    const index = this.syncListeners.indexOf(callback);
    if (index > -1) {
      this.syncListeners.splice(index, 1);
    }
  }

  onProgressChange(callback: (progress: SyncProgress) => void) {
    this.progressListeners.push(callback);
  }

  offProgressChange(callback: (progress: SyncProgress) => void) {
    const index = this.progressListeners.indexOf(callback);
    if (index > -1) {
      this.progressListeners.splice(index, 1);
    }
  }

  private notifyStatusChange() {
    this.getSyncStatus().then(status => {
      this.syncListeners.forEach(callback => {
        try {
          callback(status);
        } catch (error) {
          console.error('Error in sync status listener:', error);
        }
      });
    });
  }

  private notifyProgressChange(progress: SyncProgress) {
    this.progressListeners.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('Error in sync progress listener:', error);
      }
    });
  }

  // Data type specific sync methods
  async syncProject(
    project: any,
    action: 'create' | 'update' | 'delete'
  ): Promise<void> {
    await this.addToSyncQueue({
      type: 'project',
      action,
      data: project,
      maxRetries: 3,
    });
  }

  async syncLead(
    lead: any,
    action: 'create' | 'update' | 'delete'
  ): Promise<void> {
    await this.addToSyncQueue({
      type: 'lead',
      action,
      data: lead,
      maxRetries: 3,
    });
  }

  async syncInvoice(
    invoice: any,
    action: 'create' | 'update' | 'delete'
  ): Promise<void> {
    await this.addToSyncQueue({
      type: 'invoice',
      action,
      data: invoice,
      maxRetries: 3,
    });
  }

  async syncEstimate(
    estimate: any,
    action: 'create' | 'update' | 'delete'
  ): Promise<void> {
    await this.addToSyncQueue({
      type: 'estimate',
      action,
      data: estimate,
      maxRetries: 3,
    });
  }

  async syncClient(
    client: any,
    action: 'create' | 'update' | 'delete'
  ): Promise<void> {
    await this.addToSyncQueue({
      type: 'client',
      action,
      data: client,
      maxRetries: 3,
    });
  }

  // Batch sync methods
  async syncAllData(): Promise<void> {
    // This would sync all local data with the server
    // Implementation depends on your data structure
    console.log('Syncing all data...');
  }

  async getDataConflicts(): Promise<
    Array<{
      localItem: any;
      remoteItem: any;
      type: string;
      conflictType: 'modified' | 'deleted' | 'created';
    }>
  > {
    // This would detect and return data conflicts
    // Implementation depends on your conflict resolution strategy
    return [];
  }

  async resolveConflict(
    conflict: {
      localItem: any;
      remoteItem: any;
      type: string;
      conflictType: 'modified' | 'deleted' | 'created';
    },
    resolution: 'local' | 'remote' | 'merge'
  ): Promise<void> {
    // This would resolve a data conflict
    // Implementation depends on your conflict resolution strategy
    console.log(
      'Resolving conflict:',
      conflict,
      'with resolution:',
      resolution
    );
  }
}

export const syncService = new SyncService();
