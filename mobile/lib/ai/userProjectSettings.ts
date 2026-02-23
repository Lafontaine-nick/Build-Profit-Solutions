/**
 * User Project Settings
 * 
 * Manages user settings related to projects, including last opened project tracking
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_OPENED_PROJECT_KEY = 'bps.lastOpenedProjectId';

/**
 * Get the last opened project ID
 */
export async function getLastOpenedProjectId(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(LAST_OPENED_PROJECT_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Check if it's within 7 days
      if (data.timestamp) {
        const daysSinceOpened = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
        if (daysSinceOpened <= 7) {
          return data.projectId;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting last opened project ID:', error);
    return null;
  }
}

/**
 * Set the last opened project ID
 */
export async function setLastOpenedProjectId(projectId: string): Promise<void> {
  try {
    const data = {
      projectId,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(LAST_OPENED_PROJECT_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error setting last opened project ID:', error);
  }
}

/**
 * Clear the last opened project ID
 */
export async function clearLastOpenedProjectId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_OPENED_PROJECT_KEY);
  } catch (error) {
    console.error('Error clearing last opened project ID:', error);
  }
}
