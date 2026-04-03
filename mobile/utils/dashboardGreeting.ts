export type DashboardGreeting = {
  name: string;
  initials: string;
};

type LooseProfile = {
  firstName?: string | null;
  lastName?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  fullName?: string | null;
  email?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: { emailAddress?: string }[];
};

/**
 * Display name + avatar initials for the dashboard header.
 * Prefers first + last (email sign-up / profile) over fullName so it matches what users typed.
 * OAuth: Clerk fills first/last/full from Google or Apple; values come from the provider profile.
 */
export function dashboardGreetingFromProfile(
  profile: LooseProfile | Record<string, unknown> | null | undefined
): DashboardGreeting {
  if (!profile || typeof profile !== 'object') {
    return { name: 'there', initials: '?' };
  }

  const p = profile as LooseProfile;
  const first = String(p.firstName ?? p.first_name ?? '').trim();
  const last = String(p.lastName ?? p.last_name ?? '').trim();
  const full = String(p.fullName ?? '').trim();
  const email =
    String(p.primaryEmailAddress?.emailAddress ?? '').trim() ||
    String(p.emailAddresses?.[0]?.emailAddress ?? '').trim() ||
    String(p.email ?? '').trim();

  let name = '';
  if (first || last) name = [first, last].filter(Boolean).join(' ');
  else if (full) name = full;
  else if (email) {
    const local = email.split('@')[0] || '';
    const pretty = local
      .replace(/[.+_-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    name = pretty || email;
  } else {
    name = 'there';
  }

  let initials = '';
  if (first && last) initials = `${first[0]}${last[0]}`.toUpperCase();
  else if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) initials = `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    else if (parts.length === 1 && parts[0].length >= 2) initials = parts[0].slice(0, 2).toUpperCase();
    else if (parts[0]) initials = parts[0][0].toUpperCase();
  } else if (first) initials = first.slice(0, 2).toUpperCase();
  else if (email) initials = email[0].toUpperCase();
  if (!initials) initials = '?';

  return { name, initials };
}
