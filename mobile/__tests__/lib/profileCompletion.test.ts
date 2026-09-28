import { buildProfileCompletionReminderCopy } from '@/lib/profileCompletion';

describe('profile completion reminder copy', () => {
  it('keeps the combined reminder short enough for the banner', () => {
    const copy = buildProfileCompletionReminderCopy({
      percent: 0,
      isComplete: false,
      missing: ['name', 'company', 'phone', 'location', 'photo'],
    });
    expect(copy.title).toBe('Finish your profile');
    expect(copy.body).toBe('Add your company, phone, and logo.');
  });

  it('asks only for a logo when the business details are filled', () => {
    const copy = buildProfileCompletionReminderCopy({
      percent: 80,
      isComplete: false,
      missing: ['photo'],
    });
    expect(copy.title).toBe('Add your logo');
    expect(copy.body).toBe('Upload a logo or photo for bids and contracts.');
  });
});
