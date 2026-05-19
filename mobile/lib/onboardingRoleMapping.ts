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
  subcontractor: 'Subcontractor',
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

/**
 * Writes the onboarding role into `bps.contractorProfile` so Profile → Role shows the same choice.
 */
export async function mergeOnboardingRoleIntoContractorProfile(
  roleId: string | null | undefined
): Promise<void> {
  const display = onboardingRoleIdToDisplay(roleId);
  if (!display) return;
  try {
    const raw = await AsyncStorage.getItem('bps.contractorProfile');
    const profile = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    await AsyncStorage.setItem(
      'bps.contractorProfile',
      JSON.stringify({ ...profile, role: display })
    );
  } catch (e) {
    if (__DEV__) {
      console.warn('mergeOnboardingRoleIntoContractorProfile failed', e);
    }
  }
}
