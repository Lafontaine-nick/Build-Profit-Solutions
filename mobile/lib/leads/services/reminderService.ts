/**
 * Follow-up Reminder Service
 * Manages lead follow-up reminders with push notifications
 */

import * as Notifications from 'expo-notifications';
import { Lead } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Reminder {
  id: string;
  leadId: string;
  leadName: string;
  type: 'follow_up' | 'site_visit' | 'proposal' | 'custom';
  scheduledFor: string;
  message: string;
  completed: boolean;
  notificationId?: string;
}

const REMINDERS_KEY = '@lead_reminders';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

// Create a reminder
export async function createReminder(
  lead: Lead,
  type: Reminder['type'],
  scheduledFor: Date,
  customMessage?: string
): Promise<Reminder> {
  const hasPermission = await requestNotificationPermissions();

  const defaultMessages = {
    follow_up: `⏰ Follow up with ${lead.contact.name} about ${lead.project.type} project`,
    site_visit: `📍 Site visit scheduled with ${lead.contact.name}`,
    proposal: `📋 Send proposal to ${lead.contact.name}`,
    custom: customMessage || `Reminder for ${lead.contact.name}`,
  };

  const message = customMessage || defaultMessages[type];

  const reminder: Reminder = {
    id: `reminder-${Date.now()}`,
    leadId: lead.id,
    leadName: lead.contact.name,
    type,
    scheduledFor: scheduledFor.toISOString(),
    message,
    completed: false,
  };

  // Schedule push notification if we have permission
  if (hasPermission) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Lead Reminder',
          body: message,
          data: { leadId: lead.id, reminderId: reminder.id },
          sound: true,
        },
        trigger: {
          date: scheduledFor,
        },
      });
      reminder.notificationId = notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

  // Save reminder to storage
  await saveReminder(reminder);

  return reminder;
}

// Get all reminders
export async function getAllReminders(): Promise<Reminder[]> {
  try {
    const remindersJson = await AsyncStorage.getItem(REMINDERS_KEY);
    return remindersJson ? JSON.parse(remindersJson) : [];
  } catch (error) {
    console.error('Error getting reminders:', error);
    return [];
  }
}

// Get reminders for a specific lead
export async function getLeadReminders(leadId: string): Promise<Reminder[]> {
  const allReminders = await getAllReminders();
  return allReminders.filter(r => r.leadId === leadId && !r.completed);
}

// Get upcoming reminders
export async function getUpcomingReminders(hours: number = 24): Promise<Reminder[]> {
  const allReminders = await getAllReminders();
  const now = new Date();
  const future = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return allReminders.filter(r => {
    if (r.completed) return false;
    const scheduledDate = new Date(r.scheduledFor);
    return scheduledDate >= now && scheduledDate <= future;
  });
}

// Mark reminder as completed
export async function completeReminder(reminderId: string): Promise<void> {
  const reminders = await getAllReminders();
  const updatedReminders = reminders.map(r => {
    if (r.id === reminderId) {
      // Cancel notification if exists
      if (r.notificationId) {
        Notifications.cancelScheduledNotificationAsync(r.notificationId);
      }
      return { ...r, completed: true };
    }
    return r;
  });

  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(updatedReminders));
}

// Delete a reminder
export async function deleteReminder(reminderId: string): Promise<void> {
  const reminders = await getAllReminders();
  const reminder = reminders.find(r => r.id === reminderId);

  // Cancel notification if exists
  if (reminder?.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
  }

  const filteredReminders = reminders.filter(r => r.id !== reminderId);
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(filteredReminders));
}

// Save a reminder to storage
async function saveReminder(reminder: Reminder): Promise<void> {
  const reminders = await getAllReminders();
  reminders.push(reminder);
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

// Get reminder suggestions based on lead stage
export function getReminderSuggestions(lead: Lead): Array<{ label: string; hours: number }> {
  switch (lead.stage) {
    case 'new':
      return [
        { label: '1 hour', hours: 1 },
        { label: '4 hours', hours: 4 },
        { label: 'Tomorrow', hours: 24 },
      ];
    case 'verified':
      return [
        { label: '2 hours', hours: 2 },
        { label: 'Tomorrow', hours: 24 },
        { label: '3 days', hours: 72 },
      ];
    case 'qualified':
      return [
        { label: 'Tomorrow', hours: 24 },
        { label: '3 days', hours: 72 },
        { label: '1 week', hours: 168 },
      ];
    default:
      return [
        { label: '1 day', hours: 24 },
        { label: '3 days', hours: 72 },
        { label: '1 week', hours: 168 },
      ];
  }
}

// Clean up old completed reminders
export async function cleanupOldReminders(daysOld: number = 30): Promise<void> {
  const reminders = await getAllReminders();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const filteredReminders = reminders.filter(r => {
    if (!r.completed) return true;
    const scheduledDate = new Date(r.scheduledFor);
    return scheduledDate >= cutoffDate;
  });

  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(filteredReminders));
}





