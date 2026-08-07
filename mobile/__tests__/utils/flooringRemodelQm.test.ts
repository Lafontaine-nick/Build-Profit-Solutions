import {
  inferExistingFlooringFromNotes,
  inferFlooringInstallFromIntent,
  readFlooringProductScope,
  resolveFlooringDemoFromIntent,
  shouldUseFlooringConfirmScopeLineCard,
  flooringConfirmScopeIncludedLines,
  flooringConfirmScopeSummaryLabel,
  flooringScopeCardLabel,
  flooringScopeCardHelper,
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

  it('treats an explicit deselection as authoritative over preserved product measurements', () => {
    expect(
      readFlooringProductScope({
        flooringProductScope: [],
        flooringTileSqft: 1200,
      })
    ).toEqual([]);
    expect(
      readFlooringProductScope({
        flooringProductScope: ['tile'],
        flooringTileSqft: 1200,
      })
    ).toEqual(['tile']);
  });

  it('re-includes a product card when it is selected again', () => {
    const items = [item('flooring'), item('tile_flooring', 'excluded')];
    const next = syncFlooringQmScopeItems(items, {
      flooringProductScope: ['tile'],
      flooringTileSqft: 1200,
      flooringInstallScopeCount: 1,
    });
    expect(next.find((r) => r.id === 'tile_flooring')?.state).toBe('included');
  });

  it('keeps a product card excluded when measurements are preserved after deselection', () => {
    const items = [item('flooring'), item('tile_flooring', 'included')];
    const next = syncFlooringQmScopeItems(items, {
      flooringProductScope: ['carpet'],
      flooringTileSqft: 1200,
      flooringCarpetSqft: 500,
      flooringInstallScopeCount: 1,
    });
    expect(next.find((r) => r.id === 'tile_flooring')?.state).toBe('excluded');
    expect(next.find((r) => r.id === 'flooring_carpet')?.state).toBe('included');
  });

  it('includes solid hardwood when selected in QM', () => {
    const items = [item('flooring'), item('flooring_solid_hardwood', 'excluded')];
    const next = syncFlooringQmScopeItems(items, {
      flooringProductScope: ['solid_hardwood'],
      flooringSolidHardwoodSqft: 800,
      flooringInstallScopeCount: 1,
    });
    expect(next.find((r) => r.id === 'flooring_solid_hardwood')?.state).toBe('included');
  });

  it('uses the included-line card layout for included flooring scope items', () => {
    expect(
      shouldUseFlooringConfirmScopeLineCard('flooring', {
        id: 'floor_demo',
        state: 'included',
        noteBacked: true,
      })
    ).toBe(true);
    expect(
      shouldUseFlooringConfirmScopeLineCard('flooring', {
        id: 'tile_flooring',
        state: 'included',
        noteBacked: true,
      })
    ).toBe(true);
    expect(
      shouldUseFlooringConfirmScopeLineCard('flooring', {
        id: 'tile_flooring',
        state: 'unsure',
        noteBacked: false,
      })
    ).toBe(false);
    expect(
      shouldUseFlooringConfirmScopeLineCard('bathroom', {
        id: 'floor_demo',
        state: 'included',
        noteBacked: true,
      })
    ).toBe(false);
  });

  it('builds install included lines for flooring product cards', () => {
    expect(flooringConfirmScopeIncludedLines('tile_flooring')).toEqual([
      'Floor tile material',
      'Standard layout, cutting, and installation',
    ]);
    expect(flooringConfirmScopeSummaryLabel('tile_flooring')).toBe('Included:');
    expect(
      flooringScopeCardLabel('flooring_lvp', { flooringNewLvpInstallMethod: 'glue_down' })
    ).toBe('Glue-down LVP');
    expect(
      flooringScopeCardHelper('flooring_lvp', { flooringNewLvpInstallMethod: 'floating' })
    ).toMatch(/Floating \/ click-lock/);
    expect(
      flooringConfirmScopeIncludedLines('flooring_lvp', null, {
        flooringNewLvpInstallMethod: 'glue_down',
      })
    ).toEqual(['Glue-down LVP material', 'Standard layout, cutting, and installation']);
    expect(
      flooringConfirmScopeIncludedLines('flooring_lvp', null, {
        rateSourceLabel: 'Suggested budget split · National Average · floating/click-lock LVP',
      })
    ).toEqual(['Floating / click-lock LVP material', 'Standard layout, cutting, and installation']);
  });

  it('creates a sheet vinyl / VCT install card from QM selection', () => {
    const items = [item('flooring'), item('floor_demo')];
    const next = syncFlooringQmScopeItems(items, {
      flooringProductScope: ['sheet_vinyl_vct'],
      flooringSheetVinylSqft: 1200,
      flooringInstallScopeCount: 1,
    });
    expect(next.find((r) => r.id === 'flooring_sheet_vinyl')).toMatchObject({
      label: 'Sheet vinyl / VCT installation',
      state: 'included',
    });
  });
});
