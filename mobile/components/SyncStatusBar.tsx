import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { syncService } from '../services/syncService';
import { apiService } from '../services/api';

interface SyncStatusBarProps {
  visible?: boolean;
  onClose?: () => void;
}

interface SyncItem {
  id: string;
  type: string;
  action: string;
  timestamp: number;
  retryCount: number;
}

export default function SyncStatusBar({
  visible = false,
  onClose,
}: SyncStatusBarProps) {
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [pendingItems, setPendingItems] = useState<SyncItem[]>([]);
  const [syncProgress, setSyncProgress] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      loadSyncStatus();
      const interval = setInterval(loadSyncStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadSyncStatus = async () => {
    try {
      const status = await syncService.getSyncStatus();
      const items = await syncService.getPendingItems();
      setSyncStatus(status);
      setPendingItems(items);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const handleSyncPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await syncService.forceSync();
      await loadSyncStatus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Sync failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleRetryFailed = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await syncService.retryFailedItems();
      await loadSyncStatus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Retry failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleClearQueue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await syncService.clearSyncQueue();
      await loadSyncStatus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Clear queue failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const getStatusColor = () => {
    if (!syncStatus) return '#999';
    if (syncStatus.syncInProgress) return '#2196F3';
    if (syncStatus.pendingItems > 0) return '#FF9800';
    if (syncStatus.isOnline) return '#4CAF50';
    return '#F44336';
  };

  const getStatusText = () => {
    if (!syncStatus) return 'Checking...';
    if (syncStatus.syncInProgress) return 'Syncing...';
    if (syncStatus.pendingItems > 0)
      return `${syncStatus.pendingItems} pending`;
    if (syncStatus.isOnline) return 'All synced';
    return 'Offline';
  };

  const getStatusIcon = () => {
    if (!syncStatus) return 'help';
    if (syncStatus.syncInProgress) return 'sync';
    if (syncStatus.pendingItems > 0) return 'cloud-upload';
    if (syncStatus.isOnline) return 'cloud-done';
    return 'cloud-off';
  };

  if (!visible) return null;

  return (
    <>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.statusBar}>
          <View style={styles.leftSection}>
            <MaterialIcons
              name={getStatusIcon() as any}
              size={20}
              color={getStatusColor()}
              style={syncStatus?.syncInProgress ? styles.rotating : undefined}
            />
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>

          <View style={styles.rightSection}>
            {syncStatus?.pendingItems > 0 && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleSyncPress}
                disabled={syncStatus?.syncInProgress}
              >
                <MaterialIcons name='refresh' size={18} color='#2196F3' />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => setShowDetails(true)}
            >
              <MaterialIcons name='info' size={18} color='#666' />
            </TouchableOpacity>
          </View>
        </View>

        {syncStatus?.lastSync && (
          <View style={styles.lastSyncContainer}>
            <Text style={styles.lastSyncText}>
              Last sync: {syncStatus.lastSync.toLocaleTimeString()}
            </Text>
          </View>
        )}
      </Animated.View>

      <Modal
        visible={showDetails}
        transparent
        animationType='slide'
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sync Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDetails(false)}
              >
                <MaterialIcons name='close' size={24} color='#666' />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.statusSection}>
                <Text style={styles.sectionTitle}>Connection Status</Text>
                <View style={styles.statusItem}>
                  <MaterialIcons
                    name={syncStatus?.isOnline ? 'wifi' : 'wifi-off'}
                    size={20}
                    color={syncStatus?.isOnline ? '#4CAF50' : '#F44336'}
                  />
                  <Text style={styles.statusItemText}>
                    {syncStatus?.isOnline ? 'Online' : 'Offline'}
                  </Text>
                </View>
              </View>

              <View style={styles.statusSection}>
                <Text style={styles.sectionTitle}>Sync Status</Text>
                <View style={styles.statusItem}>
                  <MaterialIcons
                    name={syncStatus?.syncInProgress ? 'sync' : 'cloud-done'}
                    size={20}
                    color={syncStatus?.syncInProgress ? '#2196F3' : '#4CAF50'}
                  />
                  <Text style={styles.statusItemText}>
                    {syncStatus?.syncInProgress ? 'In Progress' : 'Idle'}
                  </Text>
                </View>
              </View>

              <View style={styles.statusSection}>
                <Text style={styles.sectionTitle}>Pending Items</Text>
                <Text style={styles.pendingCount}>
                  {syncStatus?.pendingItems || 0} items
                </Text>

                {pendingItems.length > 0 && (
                  <View style={styles.itemsList}>
                    {pendingItems.slice(0, 5).map(item => (
                      <View key={item.id} style={styles.itemRow}>
                        <MaterialIcons
                          name={getItemIcon(item.type)}
                          size={16}
                          color='#666'
                        />
                        <Text style={styles.itemText}>
                          {item.type} - {item.action}
                        </Text>
                        {item.retryCount > 0 && (
                          <Text style={styles.retryCount}>
                            ({item.retryCount} retries)
                          </Text>
                        )}
                      </View>
                    ))}
                    {pendingItems.length > 5 && (
                      <Text style={styles.moreItems}>
                        +{pendingItems.length - 5} more items
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {syncStatus?.lastSync && (
                <View style={styles.statusSection}>
                  <Text style={styles.sectionTitle}>Last Sync</Text>
                  <Text style={styles.lastSyncDetail}>
                    {syncStatus.lastSync.toLocaleString()}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              {pendingItems.length > 0 && (
                <>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.retryButton]}
                    onPress={handleRetryFailed}
                  >
                    <MaterialIcons name='refresh' size={18} color='white' />
                    <Text style={styles.buttonText}>Retry Failed</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.clearButton]}
                    onPress={handleClearQueue}
                  >
                    <MaterialIcons name='clear' size={18} color='white' />
                    <Text style={styles.buttonText}>Clear Queue</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.modalButton, styles.syncButton]}
                onPress={handleSyncPress}
              >
                <MaterialIcons name='sync' size={18} color='white' />
                <Text style={styles.buttonText}>Force Sync</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const getItemIcon = (type: string) => {
  const icons: { [key: string]: string } = {
    project: 'assignment',
    lead: 'people',
    invoice: 'receipt',
    estimate: 'calculate',
    client: 'business',
  };
  return icons[type] || 'data-usage';
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  detailsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lastSyncContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  lastSyncText: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  rotating: {
    transform: [{ rotate: '360deg' }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  statusSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusItemText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  pendingCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  itemsList: {
    marginTop: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  retryCount: {
    fontSize: 10,
    color: '#999',
  },
  moreItems: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  lastSyncDetail: {
    fontSize: 14,
    color: '#666',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  retryButton: {
    backgroundColor: '#FF9800',
  },
  clearButton: {
    backgroundColor: '#F44336',
  },
  syncButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});
