import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const NOTIFICATION_TOKEN_KEY = 'expo_push_notification_token';
const NOTIFICATION_PERMISSION_KEY = 'notification_permission_status';

export interface NotificationPermissionResult {
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
}

/**
 * Request notification permissions with iOS-grade UX
 */
export async function requestNotificationPermissions(): Promise<NotificationPermissionResult> {
  try {
    // Check if device supports notifications
    if (!Device.isDevice) {
      console.warn('⚠️ Push notifications only work on physical devices');
      return {
        granted: false,
        canAskAgain: false,
        status: Notifications.PermissionStatus.UNDETERMINED,
      };
    }

    // Check current permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    // If already granted, return success
    if (existingStatus === 'granted') {
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'granted');
      return {
        granted: true,
        canAskAgain: true,
        status: Notifications.PermissionStatus.GRANTED,
      };
    }

    // If denied and can't ask again, return denied
    if (existingStatus === 'denied') {
      const finalStatus = await Notifications.getPermissionsAsync();
      if (finalStatus.status === 'denied') {
        await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'denied');
        return {
          granted: false,
          canAskAgain: false,
          status: Notifications.PermissionStatus.DENIED,
        };
      }
    }

    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    const granted = status === 'granted';
    await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, status);

    return {
      granted,
      canAskAgain: status !== 'denied',
      status: status as Notifications.PermissionStatus,
    };
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return {
      granted: false,
      canAskAgain: false,
      status: Notifications.PermissionStatus.UNDETERMINED,
    };
  }
}

/**
 * Get current notification permission status
 */
export async function getNotificationPermissionStatus(): Promise<NotificationPermissionResult> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return {
      granted: status === 'granted',
      canAskAgain: status !== 'denied',
      status: status as Notifications.PermissionStatus,
    };
  } catch (error) {
    console.error('Error getting notification permissions:', error);
    return {
      granted: false,
      canAskAgain: false,
      status: Notifications.PermissionStatus.UNDETERMINED,
    };
  }
}

/**
 * Register for push notifications and get the Expo push token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    // Check if device supports notifications
    if (!Device.isDevice) {
      console.warn('⚠️ Push notifications only work on physical devices');
      return null;
    }

    // Check permissions first
    const permissionResult = await getNotificationPermissionStatus();
    if (!permissionResult.granted) {
      console.warn('⚠️ Notification permissions not granted');
      return null;
    }

    // Get existing token if available
    const existingToken = await AsyncStorage.getItem(NOTIFICATION_TOKEN_KEY);
    if (existingToken) {
      return existingToken;
    }

    // Register for push notifications
    // Get project ID from Constants or environment
    const Constants = require('expo-constants').default;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                      Constants.expoConfig?.extra?.projectId ||
                      process.env.EXPO_PUBLIC_PROJECT_ID;
    
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = tokenData.data;
    
    // Save token
    await AsyncStorage.setItem(NOTIFICATION_TOKEN_KEY, token);
    
    console.log('✅ Push notification token registered:', token);
    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Unregister from push notifications (clear token)
 */
export async function unregisterFromPushNotifications(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_TOKEN_KEY);
    console.log('✅ Push notification token unregistered');
  } catch (error) {
    console.error('Error unregistering from push notifications:', error);
  }
}

/**
 * Schedule a local notification (for testing or reminders)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: any,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: trigger || null, // null = immediate
    });
    return identifier;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    throw error;
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
}

/**
 * Get the stored push notification token
 */
export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(NOTIFICATION_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting stored push token:', error);
    return null;
  }
}

/**
 * Initialize notification service
 * Sets up notification handlers and listeners
 */
export async function initializeNotificationService(): Promise<void> {
  try {
    // Set up notification received handler (when app is in foreground)
    Notifications.addNotificationReceivedListener(notification => {
      console.log('📬 Notification received:', notification);
      
      // Show in-app notification when app is in foreground
      try {
        const { useNotification } = require('../contexts/NotificationContext');
        // We'll handle this in the component that uses the context
        // For now, we'll use a global event emitter pattern
        const eventEmitter = require('../utils/notificationEmitter').default;
        if (eventEmitter) {
          eventEmitter.emit('notification', {
            title: notification.request.content.title || 'Notification',
            body: notification.request.content.body || '',
            data: notification.request.content.data,
            type: notification.request.content.data?.type || 'info',
          });
        }
      } catch (error) {
        console.warn('Could not show in-app notification:', error);
      }
    });

    // Set up notification response handler (when user taps notification)
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
      // Handle navigation or action based on notification data
      const data = response.notification.request.content.data;
      if (data?.screen) {
        // Navigate to specific screen if provided
        console.log('Navigate to:', data.screen);
      }
    });

    console.log('✅ Notification service initialized');
  } catch (error) {
    console.error('Error initializing notification service:', error);
  }
}

// Export default object for backward compatibility
const notificationService = {
  initialize: initializeNotificationService,
  requestPermissions: requestNotificationPermissions,
  getPermissionStatus: getNotificationPermissionStatus,
  register: registerForPushNotificationsAsync,
  unregister: unregisterFromPushNotifications,
  schedule: scheduleLocalNotification,
  cancel: cancelNotification,
  cancelAll: cancelAllNotifications,
  getToken: getStoredPushToken,
};

export default notificationService;
