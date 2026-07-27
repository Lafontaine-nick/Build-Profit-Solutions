import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  inferBathroomFixtureInstallFromIntent,
  inferExistingBathroomFixturesFromNotes,
  resolveBathroomFixtureDemoFromIntent,
  syncBathroomFixtureQmScopeItems,
  syncPairedBathroomDemoFromInstall,
} from '@/utils/qmScopePanels/bathroomFixtures';

const item = (id: string, state: ScopeChecklistItem['state'] = 'unsure'): ScopeChecklistItem => ({
  id,
  label: id,
  inputType: 'yes_no',
  state,
});

describe('bathroomFixturesQm', () => {
  test('notes infer existing vanity and counter separately', () => {
    const existing = inferExistingBathroomFixturesFromNotes(
      'Existing vanity and old countertop in primary bath.'
    );
    expect(existing.bathroomExistingVanityCount).toBe(1);
    expect(existing.bathroomExistingCounterCount).toBe(1);
  });

  test('install infers counter only from countertop notes', () => {
    const install = inferBathroomFixtureInstallFromIntent({
      notes: 'Keep vanity, install new quartz countertop.',
      checklistItems: [item('countertops', 'included')],
    });
    expect(install.bathroomInstallVanityCount).toBeNull();
    expect(install.bathroomInstallCounterCount).toBe(1);
  });

  test('demo counter only when installing new countertop', () => {
    const demo = resolveBathroomFixtureDemoFromIntent({
      notes: '',
      existing: { bathroomExistingVanityCount: 1, bathroomExistingCounterCount: 1 },
      install: { bathroomInstallVanityCount: null, bathroomInstallCounterCount: 1 },
    });
    expect(demo.bathroomDemoVanityCount).toBeNull();
    expect(demo.bathroomDemoCounterCount).toBe(1);
  });

  test('demo vanity only when installing new vanity', () => {
    const demo = resolveBathroomFixtureDemoFromIntent({
      notes: '',
      existing: { bathroomExistingVanityCount: 1, bathroomExistingCounterCount: 1 },
      install: { bathroomInstallVanityCount: 1, bathroomInstallCounterCount: null },
    });
    expect(demo.bathroomDemoVanityCount).toBe(1);
    expect(demo.bathroomDemoCounterCount).toBeNull();
  });

  test('paired demo from install only touches matching row', () => {
    const demo = syncPairedBathroomDemoFromInstall(
      { bathroomInstallVanityCount: null, bathroomInstallCounterCount: 1 },
      { bathroomDemoVanityCount: null, bathroomDemoCounterCount: null },
      {}
    );
    expect(demo.bathroomDemoVanityCount).toBeNull();
    expect(demo.bathroomDemoCounterCount).toBe(1);
  });

  test('sync includes countertops and countertop_demo independently', () => {
    const items = [
      item('vanity'),
      item('countertops'),
      item('vanity_demo'),
      item('countertop_demo'),
    ];
    const next = syncBathroomFixtureQmScopeItems(items, {
      bathroomInstallCounterCount: 1,
      bathroomDemoCounterCount: 1,
    });
    expect(next.find((r) => r.id === 'countertops')?.state).toBe('included');
    expect(next.find((r) => r.id === 'countertop_demo')?.state).toBe('included');
    expect(next.find((r) => r.id === 'vanity')?.state).toBe('unsure');
    expect(next.find((r) => r.id === 'vanity_demo')?.state).toBe('unsure');
  });
});
