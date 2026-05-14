import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'bps.subRequestSeenMatchCount.v1';

/** Last acknowledged `matchedContractors` count per sub-request lead (own posted needs). */
export async function getSubRequestSeenMatchCount(leadId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, number>;
    const n = map[leadId];
    return typeof n === 'number' && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function setSubRequestSeenMatchCount(leadId: string, count: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[leadId] = Math.max(0, Math.floor(count));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
