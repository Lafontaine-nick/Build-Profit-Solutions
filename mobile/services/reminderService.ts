import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Reminder {
  id: string;
  leadId: string;
  leadTitle: string;
  content: string;
  scheduledDate: Date;
  notificationId?: string;
}

class ReminderService {
  private static instance: ReminderService;
  private reminders: Reminder[] = [];

  static getInstance(): ReminderService {
    if (!ReminderService.instance) {
      ReminderService.instance = new ReminderService();
    }
    return ReminderService.instance;
  }

  async initialize() {
    // Request notification permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Notification permissions not granted');
      return;
    }

    // Configure notification behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Load existing reminders
    await this.loadReminders();
    
    // Check for overdue reminders
    await this.checkOverdueReminders();
  }

  async loadReminders() {
    try {
      const stored = await AsyncStorage.getItem('lead_reminders');
      if (stored) {
        this.reminders = JSON.parse(stored).map((reminder: any) => ({
          ...reminder,
          scheduledDate: new Date(reminder.scheduledDate),
        }));
      }
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  }

  async saveReminders() {
    try {
      await AsyncStorage.setItem('lead_reminders', JSON.stringify(this.reminders));
    } catch (error) {
      console.error('Error saving reminders:', error);
    }
  }

  async scheduleReminder(reminder: Omit<Reminder, 'id' | 'notificationId'>): Promise<string> {
    const id = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Schedule the notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Lead Reminder',
        body: `${reminder.leadTitle}: ${reminder.content}`,
        data: { leadId: reminder.leadId, reminderId: id },
      },
      trigger: {
        date: reminder.scheduledDate,
      },
    });

    const newReminder: Reminder = {
      ...reminder,
      id,
      notificationId,
    };

    this.reminders.push(newReminder);
    await this.saveReminders();

    console.log(`📅 Scheduled reminder for ${reminder.leadTitle} at ${reminder.scheduledDate}`);
    return id;
  }

  async cancelReminder(reminderId: string) {
    const reminder = this.reminders.find(r => r.id === reminderId);
    if (reminder && reminder.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
    }

    this.reminders = this.reminders.filter(r => r.id !== reminderId);
    await this.saveReminders();

    console.log(`❌ Cancelled reminder ${reminderId}`);
  }

  async getRemindersForLead(leadId: string): Promise<Reminder[]> {
    return this.reminders.filter(r => r.leadId === leadId);
  }

  async getAllReminders(): Promise<Reminder[]> {
    return [...this.reminders];
  }

  async getUpcomingReminders(hours: number = 24): Promise<Reminder[]> {
    const now = new Date();
    const future = new Date(now.getTime() + (hours * 60 * 60 * 1000));
    
    return this.reminders.filter(r => {
      const scheduled = new Date(r.scheduledDate);
      return scheduled > now && scheduled <= future;
    });
  }

  async checkOverdueReminders() {
    const now = new Date();
    const overdue = this.reminders.filter(r => new Date(r.scheduledDate) < now);
    
    if (overdue.length > 0) {
      console.log(`⚠️ Found ${overdue.length} overdue reminders`);
      
      // You could show a notification or update the UI here
      // For now, we'll just log them
      overdue.forEach(reminder => {
        console.log(`⏰ Overdue: ${reminder.leadTitle} - ${reminder.content}`);
      });
    }
  }

  async clearAllReminders() {
    // Cancel all scheduled notifications
    for (const reminder of this.reminders) {
      if (reminder.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
      }
    }

    this.reminders = [];
    await this.saveReminders();
    console.log('🗑️ Cleared all reminders');
  }

  async rescheduleReminder(reminderId: string, newDate: Date) {
    const reminder = this.reminders.find(r => r.id === reminderId);
    if (!reminder) return;

    // Cancel the old notification
    if (reminder.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
    }

    // Schedule the new notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Lead Reminder',
        body: `${reminder.leadTitle}: ${reminder.content}`,
        data: { leadId: reminder.leadId, reminderId },
      },
      trigger: {
        date: newDate,
      },
    });

    // Update the reminder
    reminder.scheduledDate = newDate;
    reminder.notificationId = notificationId;

    await this.saveReminders();
    console.log(`🔄 Rescheduled reminder ${reminderId} to ${newDate}`);
  }
}

export default ReminderService;










