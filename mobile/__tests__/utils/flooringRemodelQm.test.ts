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
    expect(inferExistingFlooringFromNotes('remove existing tile floor')).toMatchObject({
      flooringExistingCount: 1,
      flooringExistingTypes: ['tile'],
    });
  });

  it('separates existing LVP and sheet vinyl/VCT intent', () => {
    expect(inferExistingFlooringFromNotes('remove existing LVP and existing sheet vinyl')).toMatchObject({
      flooringExistingTypes: ['lvp', 'sheet_vinyl_vct'],
    });
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

  it('selects product cards from detected product types without inventing quantities', () => {
    const items = [item('flooring')];
    const next = syncFlooringQmScopeItems(items, {
      flooringProductScope: ['lvp', 'tile'],
      flooringInstallScopeCount: 1,
    });
    expect(next.find((r) => r.id === 'flooring_lvp')).toMatchObject({
      label: 'LVP installation',
      state: 'included',
    });
    expect(next.find((r) => r.id === 'tile_flooring')).toMatchObject({
      label: 'Tile installation',
      state: 'included',
    });
    expect(next.find((r) => r.id === 'flooring')?.state).toBe('excluded');
  });

  it('infers product scope from per-product install SF fields', () => {
    const items = [item('flooring'), item('flooring_carpet'), item('tile_flooring')];
    const next = syncFlooringQmScopeItems(items, {
      flooringCarpetSqft: 500,
      flooringTileSqft: 1200,
      flooringInstallScopeCount: 1,
    });
    expect(next.find((r) => r.id === 'flooring_carpet')?.state).toBe('included');
    expect(next.find((r) => r.id === 'tile_flooring')?.state).toBe('included');
    expect(next.find((r) => r.id === 'flooring')?.state).toBe('excluded');
  });

  it('demotes a previously selected product card when it is deselected', () => {
    const items = [item('flooring'), item('flooring_lvp', 'included'), item('tile_flooring', 'included')];
    const next = syncFlooringQmScopeItems(items, {
      flooringProductScope: ['lvp'],
      flooringInstallScopeCount: 1,
    });
    expect(next.find((r) => r.id === 'flooring_lvp')?.state).toBe('included');
    expect(next.find((r) => r.id === 'tile_flooring')?.state).toBe('excluded');
  });
});
