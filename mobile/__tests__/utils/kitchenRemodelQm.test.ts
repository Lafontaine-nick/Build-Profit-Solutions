import {
  inferExistingKitchenFromNotes,
  inferKitchenInstallFromIntent,
  KITCHEN_QM_EMBEDDED_IDS,
  resolveKitchenDemoFromIntent,
  syncKitchenQmScopeItems,
} from '@/utils/qmScopePanels/kitchenRemodel';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';

function item(id: string, state: ScopeChecklistItem['state'] = 'unsure'): ScopeChecklistItem {
  return { id, label: id, inputType: 'yes_no', state, category: 'general' };
}

describe('kitchenRemodel QM', () => {
  it('keeps the cabinet install scope card visible in Confirm Scope', () => {
    expect(KITCHEN_QM_EMBEDDED_IDS.has('cabinets')).toBe(false);
  });

  it('infers existing cabinets from notes', () => {
    const out = inferExistingKitchenFromNotes('demo existing cabinets and install new quartz counters');
    expect(out.kitchenExistingCabinetCount).toBe(1);
  });

  it('infers install from notes', () => {
    const out = inferKitchenInstallFromIntent({
      notes: 'new cabinets, backsplash, and appliance hookup',
    });
    expect(out.kitchenInstallCabinetCount).toBe(1);
    expect(out.kitchenInstallBacksplashCount).toBe(1);
    expect(out.kitchenInstallApplianceCount).toBe(1);
  });

  it('does not treat an island countertop mention as a new island base install', () => {
    const out = inferKitchenInstallFromIntent({
      notes: 'Demo island countertop and install new quartz countertops.',
    });
    expect(out.kitchenInstallIslandCount).toBeNull();
    expect(out.kitchenInstallCounterCount).toBe(1);
  });

  it('derives demo when replacing existing cabinets', () => {
    const existing = inferExistingKitchenFromNotes('existing cabinets');
    const install = inferKitchenInstallFromIntent({ notes: 'new cabinets' });
    const demo = resolveKitchenDemoFromIntent({
      notes: 'kitchen remodel — new cabinets',
      existing,
      install,
    });
    expect(demo.kitchenDemoCabinetCount).toBe(1);
  });

  it('recognizes explicit cabinet/counter demo without requiring existing-count inference', () => {
    const install = inferKitchenInstallFromIntent({
      notes: 'Demo all cabinets and counter tops and install new cabinets.',
    });
    const demo = resolveKitchenDemoFromIntent({
      notes: 'Demo all cabinets and counter tops and install new cabinets.',
      existing: inferExistingKitchenFromNotes('Demo all cabinets and counter tops.'),
      install,
    });
    expect(demo.kitchenDemoCabinetCount).toBe(1);
    expect(demo.kitchenDemoCounterCount).toBe(1);
    expect(demo.kitchenDemoIslandCount).toBeNull();
  });

  it('syncs scope checklist from QM counts', () => {
    const items = [
      item('cabinets'),
      item('countertops'),
      item('demo'),
      item('floor_demo'),
    ];
    const next = syncKitchenQmScopeItems(items, {
      kitchenInstallCabinetCount: 1,
      kitchenInstallCounterCount: 1,
      kitchenDemoCabinetCount: 1,
      kitchenDemoFloorCount: 1,
    });
    expect(next.find((r) => r.id === 'cabinets')?.state).toBe('included');
    expect(next.find((r) => r.id === 'countertops')?.state).toBe('included');
    expect(next.find((r) => r.id === 'demo')?.state).toBe('included');
    expect(next.find((r) => r.id === 'floor_demo')?.state).toBe('included');
  });

  it('removes a previously synced flooring scope when the QM stepper is cleared', () => {
    const items = [item('flooring', 'included')];
    const next = syncKitchenQmScopeItems(items, {
      kitchenInstallFlooringCount: null,
    });
    expect(next.find((r) => r.id === 'flooring')?.state).toBe('excluded');
  });

  it('syncs kitchen install scopes so measurements follow cabinets, counters, and backsplash', () => {
    const items = [item('cabinets'), item('countertops'), item('backsplash')];
    const next = syncKitchenQmScopeItems(items, {
      kitchenInstallCabinetCount: 1,
      kitchenInstallCounterCount: 1,
      kitchenInstallBacksplashCount: 1,
    });
    expect(next.every((row) => row.state === 'included')).toBe(true);
  });
});
