/**
 * Where the profile-completion in-app banner is allowed to show.
 * Excludes marketing landing, auth, and onboarding — only after app onboarding is done.
 */

const EXCLUDED_ROOT_SEGMENTS = new Set([
  'index',
  'landing',
  'auth',
  'onboarding',
  'role-selection',
  'loading',
  'oauth-native-callback',
]);

/** Stack screens outside tabs that still count as “in the app”. */
const IN_APP_STACK_ROOTS = new Set([
  'profile',
  'project-detail',
  'payment',
  'tax-center',
  'tax-vendors',
  'tax-quickbooks-mapping',
  'legal-hub',
  'add-materials-equipment',
  'materials-equipment',
  'manual-labor-entry',
  'manual-material-entry',
]);

export function isPostOnboardingAppRoute(segments: string[]): boolean {
  const root = String(segments[0] ?? '').trim();
  if (!root || EXCLUDED_ROOT_SEGMENTS.has(root)) return false;
  if (root.startsWith('auth')) return false;
  if (root === '(tabs)') return true;
  return IN_APP_STACK_ROOTS.has(root);
}
