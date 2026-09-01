import AsyncStorage from '@react-native-async-storage/async-storage';

/** Stored in onboarding JSON and mapped to profile Role display text */
export type OnboardingRoleId =
  | 'gc'
  | 'subcontractor'
  | 'developer'
  | 'owner-builder'
  | 'other';

const ROLE_DISPLAY: Record<OnboardingRoleId, string> = {
  gc: 'General contractor',
  subcontractor: 'Trade contractor',
  developer: 'Developer',
  'owner-builder': 'Owner-Builder',
  other: 'Other',
};

/** Human-readable role for Edit Profile / contractor card */
export function onboardingRoleIdToDisplay(
  roleId: string | null | undefined
): string | null {
  if (!roleId) return null;
  return ROLE_DISPLAY[roleId as OnboardingRoleId] ?? null;
}

/** Join multiple onboarding role ids for a single profile Role line. */
export function onboardingRoleIdsToDisplay(
  roleIds: string[] | null | undefined
): string | null {
  if (!Array.isArray(roleIds) || roleIds.length === 0) return null;
  const labels = roleIds
    .map((id) => onboardingRoleIdToDisplay(id))
    .filter((label): label is string => Boolean(label));
  return labels.length > 0 ? labels.join(' · ') : null;
}

/**
 * Writes the onboarding role(s) into `bps.contractorProfile` so Profile → Role shows the same choice.
 */
export async function mergeOnboardingRoleIntoContractorProfile(
  roleId: string | string[] | null | undefined
): Promise<void> {
  const display = Array.isArray(roleId)
    ? onboardingRoleIdsToDisplay(roleId)
    : onboardingRoleIdToDisplay(roleId);
  if (!display) return;
  try {
    const raw = await AsyncStorage.getItem('bps.contractorProfile');
    const profile = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const ids = Array.isArray(roleId) ? roleId : roleId ? [roleId] : [];
    await AsyncStorage.setItem(
      'bps.contractorProfile',
      JSON.stringify({
        ...profile,
        role: display,
        ...(ids.length > 0 ? { onboardingRoles: ids } : {}),
      })
    );
  } catch (e) {
    if (__DEV__) {
      console.warn('mergeOnboardingRoleIntoContractorProfile failed', e);
    }
  }
}
