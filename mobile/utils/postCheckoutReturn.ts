import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'bps.postCheckoutReturn';

export type PostCheckoutReturn = {
  projectId: string;
  tab?: string;
  targetPlanId?: string;
};

export async function savePostCheckoutReturn(payload: PostCheckoutReturn): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function peekPostCheckoutReturn(): Promise<PostCheckoutReturn | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PostCheckoutReturn;
    if (!parsed?.projectId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function consumePostCheckoutReturn(): Promise<PostCheckoutReturn | null> {
  const payload = await peekPostCheckoutReturn();
  if (payload) {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
  return payload;
}

export function buildProjectDetailHref(projectId: string, tab = 'Budget'): string {
  return `/project-detail/${encodeURIComponent(projectId)}?activeTab=${encodeURIComponent(tab)}`;
}
