import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data?: any;
  sound?: string;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  category?: string;
  threadId?: string;
}

export interface NotificationCategory {
  id: string;
  actions: Array<{
    id: string;
    title: string;
    options?: {
      foreground?: boolean;
      destructive?: boolean;
      authenticationRequired?: boolean;
    };
  }>;
  options?: {
    allowAnnouncement?: boolean;
    allowInCarPlay?: boolean;
    allowWhileLocked?: boolean;
    hiddenPreviewsShowTitle?: boolean;
    hiddenPreviewsShowSubtitle?: boolean;
  };
}

class PushNotificationService {
  private expoPushToken: string | null = null;
  private notificationListeners: Array<(notification: any) => void> = [];
  private responseListeners: Array<(response: any) => void> = [];

  async initialize(): Promise<boolean> {
    try {
      // Request permissions
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return false;
      }

      // Get push token
      if (Device.isDevice) {
        this.expoPushToken = (
          await Notifications.getExpoPushTokenAsync({
            projectId: 'your-project-id', // Replace with your Expo project ID
          })
        ).data;
        console.log('Expo push token:', this.expoPushToken);
      } else {
        console.log('Must use physical device for Push Notifications');
        return false;
      }

      // Set up notification channels for Android
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      // Set up notification categories
      await this.setupNotificationCategories();

      // Set up listeners
      this.setupNotificationListeners();

      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  private async setupAndroidChannels() {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    await Notifications.setNotificationChannelAsync('leads', {
      name: 'Lead Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
    });

    await Notifications.setNotificationChannelAsync('projects', {
      name: 'Project Updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2196F3',
    });

    await Notifications.setNotificationChannelAsync('urgent', {
      name: 'Urgent Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#F44336',
    });
  }

  private async setupNotificationCategories() {
    await Notifications.setNotificationCategoryAsync('lead_match', [
      {
        id: 'view_lead',
        title: 'View Lead',
        options: {},
      },
      {
        id: 'contact_lead',
        title: 'Contact Now',
        options: {},
      },
    ]);

    await Notifications.setNotificationCategoryAsync('project_update', [
      {
        id: 'view_project',
        title: 'View Project',
        options: {},
      },
      {
        id: 'update_status',
        title: 'Update Status',
        options: {},
      },
    ]);

    await Notifications.setNotificationCategoryAsync('payment', [
      {
        id: 'view_invoice',
        title: 'View Invoice',
        options: {},
      },
      {
        id: 'mark_paid',
        title: 'Mark as Paid',
        options: {},
      },
    ]);
  }

  private setupNotificationListeners() {
    // Listen for notifications received while app is in foreground
    const notificationListener = Notifications.addNotificationReceivedListener(
      notification => {
        this.handleNotificationReceived(notification);
      }
    );

    // Listen for notification responses (when user taps notification)
    const responseListener =
      Notifications.addNotificationResponseReceivedListener(response => {
        this.handleNotificationResponse(response);
      });

    this.notificationListeners.push(notificationListener);
    this.responseListeners.push(responseListener);
  }

  private async handleNotificationReceived(
    notification: Notifications.Notification
  ) {
    const { title, body, data } = notification.request.content;

    // Provide haptic feedback based on notification type
    if (data?.priority === 'high') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Emit to listeners
    this.notificationListeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });

    console.log('Notification received:', { title, body, data });
  }

  private async handleNotificationResponse(
    response: Notifications.NotificationResponse
  ) {
    const { notification } = response;
    const { title, body, data } = notification.request.content;
    const actionId = response.actionIdentifier;

    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Handle different action types
    switch (actionId) {
      case 'view_lead':
        // Navigate to lead details
        console.log('Navigate to lead:', data?.leadId);
        break;
      case 'contact_lead':
        // Open contact options
        console.log('Contact lead:', data?.leadId);
        break;
      case 'view_project':
        // Navigate to project details
        console.log('Navigate to project:', data?.projectId);
        break;
      case 'update_status':
        // Open status update modal
        console.log('Update project status:', data?.projectId);
        break;
      case 'view_invoice':
        // Navigate to invoice details
        console.log('Navigate to invoice:', data?.invoiceId);
        break;
      case 'mark_paid':
        // Mark invoice as paid
        console.log('Mark invoice as paid:', data?.invoiceId);
        break;
      default:
        // Default action - navigate based on notification type
        this.handleDefaultAction(data);
        break;
    }

    // Emit to response listeners
    this.responseListeners.forEach(listener => {
      try {
        listener(response);
      } catch (error) {
        console.error('Error in response listener:', error);
      }
    });
  }

  private handleDefaultAction(data: any) {
    if (!data) return;

    switch (data.type) {
      case 'lead_match':
        console.log('Navigate to lead match:', data.leadId);
        break;
      case 'project_update':
        console.log('Navigate to project update:', data.projectId);
        break;
      case 'payment_received':
        console.log('Navigate to payment details:', data.paymentId);
        break;
      case 'urgent_alert':
        console.log('Show urgent alert:', data.message);
        break;
    }
  }

  async sendLocalNotification(notification: PushNotification): Promise<string> {
    try {
      const notificationContent = {
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        sound: notification.sound || 'default',
        priority: notification.priority || 'default',
        badge: notification.badge,
        categoryIdentifier: notification.category,
        threadIdentifier: notification.threadId,
      };

      const result = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // Send immediately
      });

      return result;
    } catch (error) {
      console.error('Failed to send local notification:', error);
      throw error;
    }
  }

  async scheduleNotification(
    notification: PushNotification,
    trigger: any
  ): Promise<string> {
    try {
      const notificationContent = {
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        sound: notification.sound || 'default',
        priority: notification.priority || 'default',
        badge: notification.badge,
        categoryIdentifier: notification.category,
        threadIdentifier: notification.threadId,
      };

      const result = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger,
      });

      return result;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      throw error;
    }
  }

  async sendLeadMatchNotification(leadData: any): Promise<string> {
    const notification: PushNotification = {
      id: `lead_match_${leadData.id}`,
      title: '🎯 New Lead Match!',
      body: `${leadData.name} - ${leadData.projectType} • $${leadData.budget.min.toLocaleString()}-${leadData.budget.max.toLocaleString()}`,
      data: {
        type: 'lead_match',
        leadId: leadData.id,
        priority: 'high',
      },
      category: 'lead_match',
      priority: 'high',
      badge: 1,
    };

    return await this.sendLocalNotification(notification);
  }

  async sendProjectUpdateNotification(projectData: any): Promise<string> {
    const notification: PushNotification = {
      id: `project_update_${projectData.id}`,
      title: '📋 Project Update',
      body: `${projectData.name} - Status changed to ${projectData.status}`,
      data: {
        type: 'project_update',
        projectId: projectData.id,
        priority: 'normal',
      },
      category: 'project_update',
      priority: 'normal',
    };

    return await this.sendLocalNotification(notification);
  }

  async sendPaymentNotification(paymentData: any): Promise<string> {
    const notification: PushNotification = {
      id: `payment_${paymentData.id}`,
      title: '💰 Payment Received',
      body: `$${paymentData.amount.toLocaleString()} received for ${paymentData.projectName}`,
      data: {
        type: 'payment_received',
        paymentId: paymentData.id,
        priority: 'high',
      },
      category: 'payment',
      priority: 'high',
    };

    return await this.sendLocalNotification(notification);
  }

  async sendUrgentNotification(
    title: string,
    message: string,
    data?: any
  ): Promise<string> {
    const notification: PushNotification = {
      id: `urgent_${Date.now()}`,
      title,
      body: message,
      data: {
        type: 'urgent_alert',
        priority: 'high',
        ...data,
      },
      priority: 'high',
      badge: 1,
    };

    return await this.sendLocalNotification(notification);
  }

  async scheduleReminderNotification(
    reminderData: any,
    scheduledFor: Date
  ): Promise<string> {
    const notification: PushNotification = {
      id: `reminder_${reminderData.id}`,
      title: '⏰ Follow-up Reminder',
      body: `Don't forget to follow up with ${reminderData.leadName}`,
      data: {
        type: 'reminder',
        leadId: reminderData.leadId,
        priority: 'normal',
      },
      priority: 'normal',
    };

    return await this.scheduleNotification(notification, {
      date: scheduledFor,
    });
  }

  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Failed to get badge count:', error);
      return 0;
    }
  }

  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Failed to set badge count:', error);
    }
  }

  getPushToken(): string | null {
    return this.expoPushToken;
  }

  // Event listeners
  onNotificationReceived(callback: (notification: any) => void) {
    this.notificationListeners.push(callback);
  }

  onNotificationResponse(callback: (response: any) => void) {
    this.responseListeners.push(callback);
  }

  // Cleanup
  cleanup() {
    this.notificationListeners.forEach(listener => listener.remove?.());
    this.responseListeners.forEach(listener => listener.remove?.());
    this.notificationListeners = [];
    this.responseListeners = [];
  }
}

export const pushNotificationService = new PushNotificationService();
