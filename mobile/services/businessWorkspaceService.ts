import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { clerkAuthService } from '@/services/clerkAuth';
import { isBusinessWorkspaceSyncEnabled } from '@/utils/businessEntitlementCache';
import { getAuthTokenWithFallback } from '@/utils/authTokenHelper';
import { fetchWorkspaceClerkToken } from '@/utils/workspaceAuthBridge';
import { resolveBackendRestApiBaseUrl } from '@/utils/resolveBackendRestApiUrl';
import { writeSyncMeta } from '@/utils/workspaceResourceMerge';

export type BusinessSharedResourceType =
  | 'expenses'
  | 'purchaseOrders'
  | 'dailyLogs'
  | 'calendarEvents'
  | 'timeline'
  | 'team';

export type WorkspaceAccessRole = 'owner' | 'manager' | 'field';
export type WorkspaceInviteStatus = 'pending' | 'active' | 'suspended';

export type BusinessWorkspaceMember = {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  role?: WorkspaceAccessRole | string;
  tradeRole?: string;
  status?: WorkspaceInviteStatus | string;
  projectStatus?: 'active' | 'off_duty';
  skills?: string[];
  invitedAt?: string;
  joinedAt?: string | null;
  userId?: string;
};

export type BusinessWorkspaceAccess = {
  hasWorkspaceAccess: boolean;
  workspaceId: string | null;
  ownerUserId?: string | null;
  ownerMember?: BusinessWorkspaceMember | null;
  role: WorkspaceAccessRole | string | null;
  status: WorkspaceInviteStatus | string | null;
  isOwner: boolean;
  member: BusinessWorkspaceMember | null;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  emailDelivery?: {
    sent?: boolean;
    skipped?: boolean;
    provider?: string;
    reason?: string;
    error?: string;
  };
};

async function resolveAuthToken(): Promise<string | null> {
  const clerkToken = await fetchWorkspaceClerkToken();
  if (clerkToken) return clerkToken;

  const fromStorage = await getAuthTokenWithFallback();
  if (fromStorage) return fromStorage;
  try {
    const inMemory = clerkAuthService.getToken();
    if (inMemory) return inMemory;
    const clerkJwt = await SecureStore.getItemAsync('__clerk_client_jwt');
    if (clerkJwt) return clerkJwt;
  } catch {
    // optional
  }
  return null;
}

async function resolveAuthEmail(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem('auth_email');
    if (stored?.trim()) return stored.trim().toLowerCase();
  } catch {
    // optional
  }

  try {
    const rawUser = await AsyncStorage.getItem('user_data');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      const email = parsed?.email || parsed?.primaryEmailAddress?.emailAddress;
      if (typeof email === 'string' && email.trim()) {
        return email.trim().toLowerCase();
      }
    }
  } catch {
    // optional
  }

  try {
    const rawProfile = await AsyncStorage.getItem('bps.contractorProfile');
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile);
      if (typeof parsed?.email === 'string' && parsed.email.trim()) {
        return parsed.email.trim().toLowerCase();
      }
    }
  } catch {
    // optional
  }

  return null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = await resolveAuthToken();
  if (!token) {
    return { success: false, error: 'No auth token available' };
  }
  const email = await resolveAuthEmail();

  const response = await fetch(`${resolveBackendRestApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(email ? { 'X-BPS-User-Email': email } : {}),
      ...init.headers,
    },
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      error: json?.error || `HTTP ${response.status}`,
    };
  }
  return json;
}

class BusinessWorkspaceService {
  async getWorkspaceAccess() {
    return request<BusinessWorkspaceAccess>('/workspaces/access');
  }

  async ensureWorkspace(ownerName?: string) {
    const query = ownerName?.trim()
      ? `?name=${encodeURIComponent(ownerName.trim())}`
      : '';
    return request<any>(`/workspaces/me${query}`);
  }

  async acceptPendingInvites() {
    return request<{ accepted: BusinessWorkspaceMember[]; workspace?: unknown }>(
      '/workspaces/members/accept-invite',
      { method: 'POST', body: JSON.stringify({}) }
    );
  }

  async getWorkspaceMembers() {
    return request<{
      workspaceId: string;
      seatLimit: number;
      seatsUsed?: number;
      members: BusinessWorkspaceMember[];
    }>('/workspaces/members');
  }

  async getWorkspaceProjects() {
    return request<Record<string, unknown>[]>('/workspaces/projects');
  }

  async addWorkspaceMember(member: Partial<BusinessWorkspaceMember>) {
    return request<BusinessWorkspaceMember>('/workspaces/members', {
      method: 'POST',
      body: JSON.stringify(member),
    });
  }

  async updateWorkspaceMember(memberId: string, patch: Partial<BusinessWorkspaceMember>) {
    return request<BusinessWorkspaceMember>(`/workspaces/members/${encodeURIComponent(memberId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async resendWorkspaceInvite(memberId: string) {
    return request<BusinessWorkspaceMember>(
      `/workspaces/members/${encodeURIComponent(memberId)}/resend-invite`,
      { method: 'POST', body: JSON.stringify({}) }
    );
  }

  async removeWorkspaceMember(memberId: string) {
    return request<BusinessWorkspaceMember>(`/workspaces/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    });
  }

  async pushProjectResource(
    projectId: string,
    resourceType: BusinessSharedResourceType,
    payload: unknown
  ) {
    if (!isBusinessWorkspaceSyncEnabled()) {
      return { success: false, error: 'Business workspace sync not enabled' };
    }
    if (!projectId) return { success: false, error: 'Missing project id' };
    const result = await request<any>(
      `/workspaces/projects/${encodeURIComponent(projectId)}/resources/${resourceType}`,
      {
        method: 'PUT',
        body: JSON.stringify({ payload }),
      }
    );
    if (result.success && result.data?.updatedAt) {
      await writeSyncMeta(projectId, resourceType, result.data.updatedAt);
    }
    return result;
  }

  async getProjectResources(projectId: string) {
    if (!projectId) return { success: false, error: 'Missing project id' };
    return request<{
      workspaceId: string;
      resources: Record<
        BusinessSharedResourceType,
        { payload: unknown; updatedAt: string; updatedByUserId?: string }
      >;
    }>(`/workspaces/projects/${encodeURIComponent(projectId)}/resources`);
  }
}

export const businessWorkspaceService = new BusinessWorkspaceService();
export default businessWorkspaceService;
