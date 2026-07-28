import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import {
  ensureBathroomPaintRepairItem,
  suppressBathroomDrywallChecklistItems,
  suppressBathroomInteriorPaintChecklistItems,
} from '@/utils/estimateScopeChecklistUi';
import {
  defaultBathroomDrywallPatchSqft,
  formatBathroomDrywallPatchSqftHint,
  resolveBathroomDrywallPatchSuggestedPricing,
} from '@/utils/bathroomDrywallPatchPricing';
import { detectDrywallPaintInteriorOverlap } from '@/utils/bathroomDrywallPaintScope';
import {
  buildBathroomDrywallPaintCombinedSummary,
  buildBathroomSeparateDrywallPaintSuggestedBlock,
  resolveBathroomPaintRepairSuggestedPricing,
} from '@/utils/bathroomPaintRepairPricing';

function item(id: string, state: ScopeChecklistItem['state'] = 'included') {
  return { id, state };
}

describe('resolveBathroomDrywallPatchSuggestedPricing', () => {
  it('does not auto-price without user-entered patch SF', () => {
    const result = resolveBathroomDrywallPatchSuggestedPricing({
      checklistItems: [item('shower_tile'), item('plumbing_rough'), item('drywall')],
      showerWallTileSqft: 80,
    });
    expect(result).toBeUndefined();
  });

  it('prices user-entered 36 sqft patch at $400 (mat $100 / labor $300)', () => {
    const result = resolveBathroomDrywallPatchSuggestedPricing({
      checklistItems: [item('shower_tile'), item('plumbing_rough'), item('drywall')],
      quantity: 36,
      showerWallTileSqft: 80,
    });
    expect(result?.fill?.basis).toEqual({ quantity: 36, unit: 'sqft' });
    expect(result?.fill?.total).toBe(400);
    expect(result?.fill?.material).toBe(100);
    expect(result?.fill?.labor).toBe(300);
    expect(result?.fill?.comparisonRange).toEqual({ low: 350, high: 650 });
    expect(result?.fill?.helper).toMatch(/texture only/i);
  });

  it('uses 24 sqft minimum when shower SF is missing but wet work is in scope', () => {
    const sqft = defaultBathroomDrywallPatchSqft({
      checklistItems: [item('demo')],
    });
    expect(sqft).toBe(24);
  });

  it('formats patch SF hint from shower wall area', () => {
    expect(formatBathroomDrywallPatchSqftHint({ showerWallTileSqft: 80 })).toMatch(/36 SF/);
  });

  it('uses combined $700 assembly when selected for affected area', () => {
    const result = resolveBathroomDrywallPatchSuggestedPricing({
      checklistItems: [item('drywall'), item('paint_repair'), item('shower_tile')],
      quantity: 36,
      showerWallTileSqft: 80,
      useCombinedAssembly: true,
      paintRepairScope: 'affected_area',
    });
    expect(result?.fill?.total).toBe(700);
    expect(result?.fill?.basis).toEqual({ quantity: 1, unit: 'each' });
  });

  it('does not use combined assembly for full-room scope', () => {
    const result = resolveBathroomDrywallPatchSuggestedPricing({
      checklistItems: [item('drywall'), item('paint_repair'), item('shower_tile')],
      quantity: 36,
      showerWallTileSqft: 80,
      useCombinedAssembly: true,
      paintRepairScope: 'full_room',
    });
    expect(result?.fill?.total).toBe(400);
    expect(result?.fill?.basis).toEqual({ quantity: 36, unit: 'sqft' });
  });
});

describe('bathroom drywall checklist consolidation', () => {
  it('always injects paint_repair for bathroom templates', () => {
    const items = ensureBathroomPaintRepairItem(
      [{ id: 'plumbing_rough', label: 'Rough', state: 'included', inputType: 'yes_no' }],
      'bathroom'
    );
    expect(items.some((row) => row.id === 'paint_repair')).toBe(true);
  });

  it('removes legacy drywall rows and migrates included state to paint_repair', () => {
    const items = suppressBathroomDrywallChecklistItems(
      [
        { id: 'drywall', label: 'Drywall', state: 'included', inputType: 'yes_no' },
        { id: 'paint_repair', label: 'Paint repair', state: 'excluded', inputType: 'yes_no' },
      ],
      'bathroom'
    );
    expect(items.some((row) => row.id === 'drywall')).toBe(false);
    expect(items.find((row) => row.id === 'paint_repair')?.state).toBe('included');
  });

  it('removes interior paint rows and migrates included state to paint_repair', () => {
    const items = suppressBathroomInteriorPaintChecklistItems(
      [
        { id: 'interior_paint', label: 'Interior paint', state: 'included', inputType: 'yes_no' },
        { id: 'paint_repair', label: 'Paint repair', state: 'excluded', inputType: 'yes_no' },
      ],
      'bathroom'
    );
    expect(items.some((row) => row.id === 'interior_paint')).toBe(false);
    expect(items.some((row) => row.id === 'paint')).toBe(false);
    expect(items.find((row) => row.id === 'paint_repair')?.state).toBe('included');
  });
});

describe('resolveBathroomPaintRepairSuggestedPricing', () => {
  it('prices affected area at $500 for 36 sqft planning area', () => {
    const result = resolveBathroomPaintRepairSuggestedPricing({
      checklistItems: [item('paint_repair'), item('shower_tile')],
      showerWallTileSqft: 80,
      paintRepairScope: 'affected_area',
      useCombinedAssembly: false,
    });
    expect(result?.fill?.total).toBe(500);
    expect(result?.fill?.material).toBe(125);
    expect(result?.fill?.labor).toBe(375);
  });

  it('migrates legacy touch_up to affected area pricing', () => {
    const result = resolveBathroomPaintRepairSuggestedPricing({
      checklistItems: [item('paint_repair'), item('shower_tile')],
      showerWallTileSqft: 80,
      paintRepairScope: 'touch_up',
      useCombinedAssembly: false,
    });
    expect(result?.fill?.total).toBe(500);
  });

  it('suppresses paint-only when combined assembly is active for affected area', () => {
    const result = resolveBathroomPaintRepairSuggestedPricing({
      checklistItems: [item('paint_repair'), item('shower_tile')],
      showerWallTileSqft: 80,
      paintRepairScope: 'affected_area',
    });
    expect(result?.fill).toBeNull();
  });

  it('prices full room on room SF with patch included', () => {
    const result = resolveBathroomPaintRepairSuggestedPricing({
      checklistItems: [item('paint_repair'), item('shower_tile')],
      showerWallTileSqft: 80,
      paintRepairScope: 'full_room',
      entireRoomSqft: 350,
      useCombinedAssembly: false,
    });
    expect(result?.fill?.total).toBe(1400);
    expect(result?.fill?.material).toBe(350);
    expect(result?.fill?.labor).toBe(1050);
    expect(result?.fill?.basis).toEqual({ quantity: 350, unit: 'sqft' });
    expect(result?.fill?.helper).toMatch(/paint included/i);
  });

  it('routes legacy entire_room scope to full-room pricing', () => {
    const result = resolveBathroomPaintRepairSuggestedPricing({
      checklistItems: [item('paint_repair'), item('shower_tile')],
      showerWallTileSqft: 80,
      paintRepairScope: 'entire_room',
      entireRoomSqft: 280,
      useCombinedAssembly: false,
    });
    expect(result?.fill?.total).toBeGreaterThan(350);
  });
});

describe('drywall/paint overlap helpers', () => {
  it('detects interior paint overlap when both are in scope for affected area', () => {
    expect(
      detectDrywallPaintInteriorOverlap({
        checklistItems: [item('paint_repair'), item('interior_paint')],
        paintRepairScope: 'affected_area',
      })
    ).toBe(true);
  });

  it('allows full-room paint without overlap warning', () => {
    expect(
      detectDrywallPaintInteriorOverlap({
        checklistItems: [item('paint_repair'), item('interior_paint')],
        paintRepairScope: 'full_room',
      })
    ).toBe(false);
  });

  it('builds combined drywall + paint summary', () => {
    const summary = buildBathroomDrywallPaintCombinedSummary({
      checklistItems: [item('drywall'), item('paint_repair'), item('shower_tile')],
      showerWallTileSqft: 80,
      paintRepairScope: 'affected_area',
    });
    expect(summary?.combinedTotal).toBe(900);
  });

  it('merges separate patch and paint into one suggested block', () => {
    const drywall = resolveBathroomDrywallPatchSuggestedPricing({
      checklistItems: [item('paint_repair'), item('shower_tile')],
      quantity: 36,
      showerWallTileSqft: 80,
      useCombinedAssembly: false,
      paintRepairScope: 'affected_area',
    })!.fill!;
    const paint = resolveBathroomPaintRepairSuggestedPricing({
      checklistItems: [item('paint_repair'), item('shower_tile')],
      patchSqft: 36,
      showerWallTileSqft: 80,
      paintRepairScope: 'affected_area',
      useCombinedAssembly: false,
    })!.fill!;
    const merged = buildBathroomSeparateDrywallPaintSuggestedBlock({
      drywall,
      paint,
      patchSqft: 36,
    });
    expect(merged.total).toBe(drywall.total + paint.total);
    expect(merged.basis).toEqual({ quantity: 36, unit: 'sqft' });
    expect(merged.helper).toMatch(/Apply once to price all lines/i);
  });
});
