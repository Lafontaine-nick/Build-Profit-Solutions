import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { apiService } from '../services/api';
import { syncService } from '../services/syncService';

const { width } = Dimensions.get('window');

interface OfflineIndicatorProps {
  onSyncPress?: () => void;
  showSyncProgress?: boolean;
}

export default function OfflineIndicator({
  onSyncPress,
  showSyncProgress = true,
}: OfflineIndicatorProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [pendingItems, setPendingItems] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [slideAnim] = useState(new Animated.Value(-100));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOffline) {
      showIndicator();
    } else {
      hideIndicator();
    }
  }, [isOffline]);

  useEffect(() => {
    if (syncInProgress) {
      startPulseAnimation();
    } else {
      stopPulseAnimation();
    }
  }, [syncInProgress]);

  const checkNetworkStatus = async () => {
    const connected = apiService.isConnected();
    setIsOffline(!connected);

    if (connected) {
      const status = await syncService.getSyncStatus();
      setSyncInProgress(status.syncInProgress);
      setPendingItems(status.pendingItems);
      setLastSync(status.lastSync);
    }
  };

  const showIndicator = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const hideIndicator = () => {
    Animated.spring(slideAnim, {
      toValue: -100,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const handleSyncPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (onSyncPress) {
      onSyncPress();
    } else {
      try {
        setSyncInProgress(true);
        await syncService.forceSync();
        await checkNetworkStatus();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error('Sync failed:', error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setSyncInProgress(false);
      }
    }
  };

  if (!isOffline && pendingItems === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: pulseAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <MaterialIcons
            name={isOffline ? 'wifi-off' : 'sync'}
            size={20}
            color={isOffline ? '#F44336' : '#4CAF50'}
          />
          <View style={styles.textContainer}>
            <Text style={styles.title}>
              {isOffline ? "You're offline" : 'Syncing data'}
            </Text>
            <Text style={styles.subtitle}>
              {isOffline
                ? 'Some features may be limited'
                : `${pendingItems} items pending sync`}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.syncButton,
            {
              backgroundColor: isOffline ? '#F44336' : '#4CAF50',
              opacity: syncInProgress ? 0.6 : 1,
            },
          ]}
          onPress={handleSyncPress}
          disabled={syncInProgress}
        >
          <MaterialIcons
            name={syncInProgress ? 'sync' : 'refresh'}
            size={18}
            color='white'
            style={syncInProgress ? styles.rotating : undefined}
          />
        </TouchableOpacity>
      </View>

      {showSyncProgress && syncInProgress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: pulseAnim.interpolate({
                    inputRange: [0.5, 1],
                    outputRange: ['30%', '70%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>Syncing...</Text>
        </View>
      )}

      {lastSync && !isOffline && (
        <View style={styles.lastSyncContainer}>
          <Text style={styles.lastSyncText}>
            Last sync: {lastSync.toLocaleTimeString()}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  content: {
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
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  syncButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotating: {
    transform: [{ rotate: '360deg' }],
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  progressBar: {
    height: 2,
    backgroundColor: '#e0e0e0',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 1,
  },
  progressText: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
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
});
