import Constants from 'expo-constants';

/**
 * Master switch: set EXPO_PUBLIC_BETA_FEEDBACK_ENABLED=true in EAS env for beta builds.
 * For public launch, omit it or set false and hide all beta feedback UI.
 */
export function isBetaFeedbackEnabledInConfig(): boolean {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  if (extra?.betaFeedbackEnabled === true) return true;
  return process.env.EXPO_PUBLIC_BETA_FEEDBACK_ENABLED === 'true';
}

/**
 * Optional allowlist: EXPO_PUBLIC_BETA_FEEDBACK_ALLOWLIST_EMAILS=a@x.com,b@y.com
 * When empty, any signed-in user sees beta feedback (if master switch is on).
 */
export function isBetaFeedbackVisibleForUser(userEmail?: string | null): boolean {
  if (!isBetaFeedbackEnabledInConfig()) return false;
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const raw =
    (extra?.betaFeedbackAllowlistEmails as string) ||
    process.env.EXPO_PUBLIC_BETA_FEEDBACK_ALLOWLIST_EMAILS ||
    '';
  const allow = raw.trim();
  if (!allow) return true;
  const email = userEmail?.trim().toLowerCase();
  if (!email) return false;
  const set = new Set(
    allow
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  return set.has(email);
}
