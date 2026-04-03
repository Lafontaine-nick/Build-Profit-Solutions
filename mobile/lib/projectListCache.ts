import AsyncStorage from '@react-native-async-storage/async-storage';

export const UNIFIED_PROJECTS_STORAGE_KEY = 'bps.unifiedProjects.v1';

/** Clears the cached project list so the next load/refresh can match the API (e.g. after onboarding). */
export async function clearUnifiedProjectsListCache(): Promise<void> {
  await AsyncStorage.removeItem(UNIFIED_PROJECTS_STORAGE_KEY);
}
