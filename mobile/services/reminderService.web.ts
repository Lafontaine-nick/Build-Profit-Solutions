/**
 * Web stub: no expo-notifications (not supported on Metro web + Worklets).
 * Persists reminders in AsyncStorage only; no OS notification scheduling.
 */
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

  async initialize(): Promise<void> {
    await this.loadReminders();
    await this.checkOverdueReminders();
  }

  async loadReminders(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('lead_reminders');
      if (stored) {
        this.reminders = JSON.parse(stored).map((reminder: Record<string, unknown>) => ({
          ...reminder,
          scheduledDate: new Date(reminder.scheduledDate as string),
        }));
      }
    } catch {
      /* ignore */
    }
  }

  async saveReminders(): Promise<void> {
    try {
      await AsyncStorage.setItem('lead_reminders', JSON.stringify(this.reminders));
    } catch {
      /* ignore */
    }
  }

  async scheduleReminder(reminder: Omit<Reminder, 'id' | 'notificationId'>): Promise<string> {
    const id = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newReminder: Reminder = { ...reminder, id };
    this.reminders.push(newReminder);
    await this.saveReminders();
    return id;
  }

  async cancelReminder(reminderId: string): Promise<void> {
    this.reminders = this.reminders.filter(r => r.id !== reminderId);
    await this.saveReminders();
  }

  async getRemindersForLead(leadId: string): Promise<Reminder[]> {
    return this.reminders.filter(r => r.leadId === leadId);
  }

  async getAllReminders(): Promise<Reminder[]> {
    return [...this.reminders];
  }

  async getUpcomingReminders(hours: number = 24): Promise<Reminder[]> {
    const now = new Date();
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
    return this.reminders.filter(r => {
      const scheduled = new Date(r.scheduledDate);
      return scheduled > now && scheduled <= future;
    });
  }

  async checkOverdueReminders(): Promise<void> {
    const now = new Date();
    this.reminders.filter(r => new Date(r.scheduledDate) < now);
  }

  async clearAllReminders(): Promise<void> {
    this.reminders = [];
    await this.saveReminders();
  }

  async rescheduleReminder(reminderId: string, newDate: Date): Promise<void> {
    const reminder = this.reminders.find(r => r.id === reminderId);
    if (!reminder) return;
    reminder.scheduledDate = newDate;
    await this.saveReminders();
  }
}

export default ReminderService;
