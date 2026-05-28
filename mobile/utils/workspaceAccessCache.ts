import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BusinessWorkspaceAccess } from '@/services/businessWorkspaceService';
import { invalidateWorkspaceBootstrapCache } from '@/utils/workspaceBootstrapCache';

const WORKSPACE_ACCESS_SNAPSHOT_KEY = 'bps.cachedWorkspaceAccessSnapshot';

export async function persistWorkspaceAccessSnapshot(
  access: BusinessWorkspaceAccess | null | undefined
): Promise<void> {
  if (!access?.hasWorkspaceAccess) return;
  try {
    await AsyncStorage.setItem(WORKSPACE_ACCESS_SNAPSHOT_KEY, JSON.stringify(access));
    await AsyncStorage.setItem('bps.cachedWorkspaceAccess', '1');
  } catch {
    /* ignore */
  }
}

export async function readWorkspaceAccessSnapshot(): Promise<BusinessWorkspaceAccess | null> {
  try {
    const raw = await AsyncStorage.getItem(WORKSPACE_ACCESS_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BusinessWorkspaceAccess;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearWorkspaceAccessSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WORKSPACE_ACCESS_SNAPSHOT_KEY);
    await AsyncStorage.setItem('bps.cachedWorkspaceAccess', '0');
  } catch {
    /* ignore */
  }
  invalidateWorkspaceBootstrapCache();
}
