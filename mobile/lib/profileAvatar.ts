import type { ImageSourcePropType } from 'react-native';

/** Bundled placeholder shown until the user uploads their own profile photo. */
export const DEFAULT_PROFILE_AVATAR_SOURCE = require('../assets/images/bps-logo-updated.png');

const OAUTH_OR_STOCK_AVATAR_HOST =
  /(?:clerk\.com|googleusercontent\.com|gravatar\.com|fbcdn\.net|appleid\.apple\.com|licdn\.com|graph\.facebook|via\.placeholder)/i;

/**
 * True when the URI came from the in-app image picker (local file / data URL),
 * not OAuth or other remote defaults we should not treat as a contractor headshot.
 */
export function isUserUploadedProfileAvatar(
  uri: string | null | undefined
): boolean {
  const v = String(uri ?? '').trim();
  if (!v) return false;
  if (v.startsWith('file://')) return true;
  if (v.startsWith('data:image/')) return true;
  if (v.includes('bps-profile-avatar')) return true;
  if (/^https?:\/\//i.test(v)) {
    if (OAUTH_OR_STOCK_AVATAR_HOST.test(v)) return false;
    // Other remote URLs are not treated as deliberate profile uploads.
    return false;
  }
  // App document paths (Expo) without a file:// prefix
  if (v.includes('/') || v.includes('\\')) return true;
  return false;
}

/** Strip OAuth / stale remote URLs so new accounts default to the BPS placeholder. */
export function sanitizeStoredProfileAvatar(
  uri: string | null | undefined
): string {
  if (!isUserUploadedProfileAvatar(uri)) return '';
  return String(uri).trim();
}

export function getProfileAvatarImageSource(
  avatar: string | null | undefined
): ImageSourcePropType {
  const uri = sanitizeStoredProfileAvatar(avatar);
  if (uri) return { uri };
  return DEFAULT_PROFILE_AVATAR_SOURCE;
}

export function profileHasCustomAvatar(avatar: string | null | undefined): boolean {
  return Boolean(sanitizeStoredProfileAvatar(avatar));
}

/** Remove OAuth / remote defaults from persisted contractor profile rows. */
export function scrubContractorProfileAvatarFields<
  T extends { avatar?: unknown; logoUrl?: unknown },
>(profile: T): T {
  const avatar = sanitizeStoredProfileAvatar(
    typeof profile.avatar === 'string' ? profile.avatar : ''
  );
  const logoUrl = sanitizeStoredProfileAvatar(
    typeof profile.logoUrl === 'string' ? profile.logoUrl : ''
  );
  return {
    ...profile,
    avatar,
    ...(profile.logoUrl !== undefined ? { logoUrl } : {}),
  };
}
