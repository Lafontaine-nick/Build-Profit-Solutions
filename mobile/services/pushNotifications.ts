import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isExpoWebRuntime } from '@/utils/isExpoWebRuntime';
import { isReactNativeJsRuntime } from '@/utils/isReactNativeJsRuntime';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'http://192.168.0.201:3001/api';

// Configure notification behavior (skip on web — same reasons as notificationService)
if (!isExpoWebRuntime()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export const pushNotificationService = {
  // Register for push notifications and get token
  registerForPushNotifications: async (): Promise<string | null> => {
    try {
      if (!isReactNativeJsRuntime() || isExpoWebRuntime()) {
        return null;
      }

      // Check if we're on a physical device
      if (!Device.isDevice) {
        return null;
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      // Get the Expo push token
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId || 'your-project-id',
      })).data;

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('leads', {
          name: 'Lead Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3B82F6',
          sound: 'default',
        });
      }

      return token;

    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  },

  // Send push token to backend
  registerPushToken: async (contractorId: string, pushToken: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/contractors/${contractorId}/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ expoPushToken: pushToken }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Registered push token with backend');
      return data.success;

    } catch (error) {
      console.error('Error registering push token with backend:', error);
      return false;
    }
  },

  // Add notification received listener
  addNotificationReceivedListener: (handler: (notification: Notifications.Notification) => void) => {
    return Notifications.addNotificationReceivedListener(handler);
  },

  // Add notification response listener (when user taps notification)
  addNotificationResponseListener: (handler: (response: Notifications.NotificationResponse) => void) => {
    return Notifications.addNotificationResponseReceivedListener(handler);
  },

  // Schedule a local notification (for testing or reminders)
  scheduleLocalNotification: async (title: string, body: string, data: any = {}, seconds: number = 0) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: seconds > 0 ? { seconds } : null,
      });
      console.log('✅ Scheduled local notification');
    } catch (error) {
      console.error('Error scheduling local notification:', error);
    }
  },

  // Get notification permissions status
  getPermissionStatus: async (): Promise<string> => {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  },

  // Badge management
  setBadgeCount: async (count: number) => {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  },

  getBadgeCount: async (): Promise<number> => {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  },
};




