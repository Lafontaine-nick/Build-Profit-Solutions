import {
  inferExistingFlooringFromNotes,
  inferFlooringInstallFromIntent,
  resolveFlooringDemoFromIntent,
  syncFlooringQmScopeItems,
} from '@/utils/qmScopePanels/flooringRemodel';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';

function item(id: string, state: ScopeChecklistItem['state'] = 'unsure'): ScopeChecklistItem {
  return { id, label: id, inputType: 'yes_no', state, category: 'general' };
}

describe('flooringRemodel QM', () => {
  it('infers existing floor from notes', () => {
    expect(inferExistingFlooringFromNotes('remove existing tile floor').flooringExistingCount).toBe(1);
  });

  it('infers install from notes', () => {
    expect(
      inferFlooringInstallFromIntent({ notes: 'install LVP throughout main floor' }).flooringInstallScopeCount
    ).toBe(1);
  });

  it('derives floor demo when replacing existing', () => {
    const existing = { flooringExistingCount: 1 as number | null };
    const install = { flooringInstallScopeCount: 1 as number | null };
    const demo = resolveFlooringDemoFromIntent({
      notes: 'new LVP floor',
      existing,
      install,
    });
    expect(demo.flooringDemoScopeCount).toBe(1);
  });

  it('syncs scope checklist from QM counts', () => {
    const items = [item('flooring'), item('floor_demo')];
    const next = syncFlooringQmScopeItems(items, {
      flooringInstallScopeCount: 1,
      flooringDemoScopeCount: 1,
    });
    expect(next.find((r) => r.id === 'flooring')?.state).toBe('included');
    expect(next.find((r) => r.id === 'floor_demo')?.state).toBe('included');
  });
});
