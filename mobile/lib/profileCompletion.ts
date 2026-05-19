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
      title: 'Complete your profile',
      body:
        'Add your business details and upload a company logo or personal photo. Your profile appears on bids, contracts, and Find Subcontractors.',
    };
  }
  if (needsPhoto) {
    return {
      title: 'Add your logo or photo',
      body:
        'Upload a company logo or personal photo in Profile so estimates and contracts show your brand—not the default placeholder.',
    };
  }
  return {
    title: 'Finish your profile',
    body:
      'Add your company name, phone, and service area in Profile so leads and project tools use the right contact info.',
  };
}
