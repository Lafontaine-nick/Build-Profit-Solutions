import AsyncStorage from '@react-native-async-storage/async-storage';
import businessWorkspaceService, {
  type BusinessWorkspaceAccess,
} from '@/services/businessWorkspaceService';
import { safeAsyncStorage } from '@/utils/asyncStorage';
import { fetchWorkspaceBootstrap } from '@/utils/workspaceBootstrapCache';
import { persistWorkspaceAccessSnapshot } from '@/utils/workspaceAccessCache';
import { markWalkthroughSkipped } from './walkthroughStateService';

const appliedFirstRunByUser = new Set<string>();

/** Invited team members — not workspace owners setting up their own business. */
export function isInvitedWorkspaceMember(
  access: BusinessWorkspaceAccess | null | undefined
): boolean {
  if (!access || access.isOwner || !access.workspaceId) return false;
  const status = String(access.status || access.member?.status || '').toLowerCase();
  if (status === 'active') return true;
  if (status === 'pending' && access.member) return true;
  return Boolean(access.hasWorkspaceAccess);
}

/** Accept pending invites and load workspace access (bootstrap preferred). */
export async function resolveWorkspaceAccessAfterAuth(): Promise<BusinessWorkspaceAccess | null> {
  try {
    await businessWorkspaceService.acceptPendingInvites();
  } catch {
    /* non-fatal */
  }

  try {
    const bootstrap = await fetchWorkspaceBootstrap({ force: true });
    if (bootstrap?.access) {
      if (bootstrap.access.hasWorkspaceAccess) {
        await persistWorkspaceAccessSnapshot(bootstrap.access);
      }
      return bootstrap.access;
    }
  } catch {
    /* fall through */
  }

  try {
    const response = await businessWorkspaceService.getWorkspaceAccess();
    if (response.success && response.data) {
      if (response.data.hasWorkspaceAccess) {
        await persistWorkspaceAccessSnapshot(response.data);
      }
      return response.data;
    }
  } catch {
    /* ignore */
  }

  return null;
}

async function ensureDefaultContractorRole(userId: string): Promise<void> {
  const existing = await safeAsyncStorage.getItem('userRole');
  if (existing) return;

  const roleData = {
    role: 'contractor' as const,
    userId,
    permissions: [
      'view_leads',
      'accept_leads',
      'reject_leads',
      'update_lead_status',
      'view_analytics',
      'manage_profile',
    ],
    preferences: {
      notifications: true,
      emailUpdates: true,
      smsAlerts: false,
    },
  };

  await safeAsyncStorage.setItem('userRole', 'contractor');
  await safeAsyncStorage.setItem('userRoleData', JSON.stringify(roleData));
}

async function seedWorkspaceMemberProfile(opts: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  access: BusinessWorkspaceAccess;
}): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem('bps.contractorProfile');
    const profile = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const fullName = [opts.firstName, opts.lastName]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ');
    const ownerLabel =
      opts.access.ownerMember?.displayName?.trim() ||
      opts.access.member?.displayName?.trim() ||
      'Team';

    await AsyncStorage.setItem(
      'bps.contractorProfile',
      JSON.stringify({
        ...profile,
        name: String(profile.name || '').trim() || fullName || ownerLabel,
        company: String(profile.company || '').trim() || `${ownerLabel}'s Team`,
        email:
          String(profile.email || '').trim() ||
          String(opts.email || opts.access.member?.email || '').trim(),
        role:
          String(profile.role || '').trim() ||
          String(opts.access.member?.jobTitle || opts.access.member?.tradeRole || 'Team member'),
      })
    );
  } catch (e) {
    if (__DEV__) {
      console.warn('seedWorkspaceMemberProfile failed', e);
    }
  }
}

export type WorkspaceMemberFirstRunResult = {
  applied: boolean;
  access: BusinessWorkspaceAccess | null;
};

/**
 * Skip owner onboarding for invited workspace members and seed minimal profile/role defaults.
 */
export async function applyWorkspaceMemberFirstRunIfNeeded(
  userId: string,
  opts?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    force?: boolean;
  }
): Promise<WorkspaceMemberFirstRunResult> {
  if (!userId) {
    return { applied: false, access: null };
  }

  if (!opts?.force && appliedFirstRunByUser.has(userId)) {
    const access = await resolveWorkspaceAccessAfterAuth();
    return { applied: isInvitedWorkspaceMember(access), access };
  }

  const access = await resolveWorkspaceAccessAfterAuth();
  if (!isInvitedWorkspaceMember(access)) {
    return { applied: false, access };
  }

  await markWalkthroughSkipped(userId, 'appOnboarding');
  await ensureDefaultContractorRole(userId);
  await seedWorkspaceMemberProfile({
    firstName: opts?.firstName,
    lastName: opts?.lastName,
    email: opts?.email,
    access,
  });

  appliedFirstRunByUser.add(userId);
  return { applied: true, access };
}

export function resetWorkspaceMemberFirstRunCache(userId?: string | null): void {
  if (userId) {
    appliedFirstRunByUser.delete(userId);
    return;
  }
  appliedFirstRunByUser.clear();
}
