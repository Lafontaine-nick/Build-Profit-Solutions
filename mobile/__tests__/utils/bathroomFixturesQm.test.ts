import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import {
  inferBathroomFixtureInstallFromIntent,
  inferExistingBathroomFixturesFromNotes,
  resolveBathroomFixtureDemoFromIntent,
  syncBathroomFixtureQmScopeItems,
  syncPairedBathroomDemoFromInstall,
  bathroomFixtureScopeCardVisible,
  shouldHideBathroomFixtureScopeCardInQmEmbed,
  expandBathroomFixtureScopeDisplayItems,
  inferBathroomCountertopSqftFromNotes,
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

  test('demo counter not inferred from install alone', () => {
    const demo = resolveBathroomFixtureDemoFromIntent({
      notes: '',
      existing: { bathroomExistingVanityCount: null, bathroomExistingCounterCount: null },
      install: { bathroomInstallVanityCount: null, bathroomInstallCounterCount: 1 },
    });
    expect(demo.bathroomDemoCounterCount).toBeNull();
  });

  test('demo counter when existing and installing together', () => {
    const demo = resolveBathroomFixtureDemoFromIntent({
      notes: '',
      existing: { bathroomExistingVanityCount: 1, bathroomExistingCounterCount: 1 },
      install: { bathroomInstallVanityCount: null, bathroomInstallCounterCount: 1 },
    });
    expect(demo.bathroomDemoVanityCount).toBeNull();
    expect(demo.bathroomDemoCounterCount).toBe(1);
  });

  test('demo vanity not inferred from install alone', () => {
    const demo = resolveBathroomFixtureDemoFromIntent({
      notes: '',
      existing: { bathroomExistingVanityCount: null, bathroomExistingCounterCount: null },
      install: { bathroomInstallVanityCount: 1, bathroomInstallCounterCount: null },
    });
    expect(demo.bathroomDemoVanityCount).toBeNull();
    expect(demo.bathroomDemoCounterCount).toBeNull();
  });

  test('demo vanity when existing and installing together', () => {
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

  test('inferBathroomCountertopSqftFromNotes reads sqft near counter keywords', () => {
    expect(inferBathroomCountertopSqftFromNotes('Install 12 sqft quartz vanity top.')).toBe('12');
    expect(inferBathroomCountertopSqftFromNotes('No measurements here')).toBeNull();
  });

  test('scope cards show when QM steppers are set', () => {
    const m = {
      bathroomInstallVanityCount: 1,
      bathroomInstallCounterCount: 1,
      bathroomDemoVanityCount: 1,
      bathroomDemoCounterCount: 1,
    };
    expect(bathroomFixtureScopeCardVisible('vanity', m)).toBe(true);
    expect(bathroomFixtureScopeCardVisible('countertops', m)).toBe(true);
    expect(bathroomFixtureScopeCardVisible('vanity_demo', m)).toBe(true);
    expect(bathroomFixtureScopeCardVisible('countertop_demo', m)).toBe(true);
    expect(shouldHideBathroomFixtureScopeCardInQmEmbed('vanity_demo', m)).toBe(false);
    expect(shouldHideBathroomFixtureScopeCardInQmEmbed('vanity_demo', {})).toBe(true);
  });

  test('expandBathroomFixtureScopeDisplayItems splits QM lines into separate cards', () => {
    const expanded = expandBathroomFixtureScopeDisplayItems(
      [
        item('vanity'),
        item('paint', 'included'),
      ],
      {
        bathroomInstallVanityCount: 1,
        bathroomInstallCounterCount: 1,
        bathroomDemoVanityCount: 1,
        bathroomDemoCounterCount: 1,
      },
      'bathroom'
    );
    expect(expanded.find((r) => r.id === 'vanity')).toMatchObject({
      label: 'New vanity',
      inputType: 'yes_no',
      state: 'included',
    });
    expect(expanded.find((r) => r.id === 'countertops')).toMatchObject({
      label: 'Vanity countertop',
      state: 'included',
    });
    expect(expanded.find((r) => r.id === 'vanity_demo')).toMatchObject({
      label: 'Remove vanity',
      state: 'included',
    });
    expect(expanded.find((r) => r.id === 'countertop_demo')).toMatchObject({
      label: 'Remove countertop',
      state: 'included',
    });
  });
});
