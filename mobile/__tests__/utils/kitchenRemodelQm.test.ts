import {
  inferExistingKitchenFromNotes,
  inferKitchenInstallFromIntent,
  resolveKitchenDemoFromIntent,
  syncKitchenQmScopeItems,
} from '@/utils/qmScopePanels/kitchenRemodel';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';

function item(id: string, state: ScopeChecklistItem['state'] = 'unsure'): ScopeChecklistItem {
  return { id, label: id, inputType: 'yes_no', state, category: 'general' };
}

describe('kitchenRemodel QM', () => {
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
});
