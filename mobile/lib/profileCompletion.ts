import { profileHasCustomAvatar } from './profileAvatar';

export type ContractorProfileLike = {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  location?: string;
  avatar?: string;
  licenses?: string[];
  insurance?: Record<string, boolean>;
  companyBio?: string;
};

export type ProfileCompletionResult = {
  percent: number;
  isComplete: boolean;
  missing: Array<'name' | 'company' | 'phone' | 'location' | 'photo'>;
};

const CORE_FIELDS: Array<keyof Pick<ContractorProfileLike, 'name' | 'company' | 'phone' | 'location'>> = [
  'name',
  'company',
  'phone',
  'location',
];

export function evaluateContractorProfileCompletion(
  profile: ContractorProfileLike | null | undefined
): ProfileCompletionResult {
  const missing: ProfileCompletionResult['missing'] = [];

  if (!String(profile?.name || '').trim()) missing.push('name');
  if (!String(profile?.company || '').trim()) missing.push('company');
  if (!String(profile?.phone || '').trim()) missing.push('phone');
  if (!String(profile?.location || '').trim()) missing.push('location');
  if (!profileHasCustomAvatar(profile?.avatar)) missing.push('photo');

  const total = CORE_FIELDS.length + 1;
  const completed = total - missing.length;

  return {
    percent: Math.round((completed / total) * 100),
    isComplete: missing.length === 0,
    missing,
  };
}

export function buildProfileCompletionReminderCopy(
  result: ProfileCompletionResult
): { title: string; body: string } {
  const needsPhoto = result.missing.includes('photo');
  const needsDetails = result.missing.some((m) => m !== 'photo');

  if (needsDetails && needsPhoto) {
    return {
      title: 'Finish your profile',
      body: 'Add your company, phone, and logo.',
    };
  }
  if (needsPhoto) {
    return {
      title: 'Add your logo',
      body: 'Upload a logo or photo for bids and contracts.',
    };
  }
  return {
    title: 'Finish your profile',
    body: 'Add your company, phone, and service area.',
  };
}
