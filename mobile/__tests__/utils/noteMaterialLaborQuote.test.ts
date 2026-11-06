import { groupScopeChecklistItems } from '@/utils/estimateScopeChecklistUi';
import type { ScopeChecklistItem } from '@/utils/estimateScopeChecklistUi';
import {
  kitchenConfirmScopeNoteRate,
  listConfirmScopeAppliedPricingLines,
  sumConfirmScopeAppliedPricingBreakdown,
  wholeProjectGroupDisplayTotal,
} from '@/utils/benchmarkReasonablenessContext';
import { resolveItemRatePricingFromNotes } from '@/utils/scopeRatePricingParser';
import { resolveScopeItemSuggestedPricing } from '@/utils/scopeItemQuantities';
import {
  parseNoteMaterialLaborQuote,
  noteMaterialLaborQuoteSupersedes,
  noteQuoteNamedInstallIds,
} from '@/utils/noteMaterialLaborQuote';

const KITCHEN_NOTE =
  'Kitchen remodel with 18 LF cabinets, 55 sqft counters, and 28 sqft backsplash. Flooring by others. Labor $8,500, material $12,000.';

function item(id: string, label: string): ScopeChecklistItem {
  return { id, label, inputType: 'yes_no', state: 'included' };
}

describe('note material and labor totals', () => {
  it('reads a job-level material and labor total', () => {
    expect(parseNoteMaterialLaborQuote(KITCHEN_NOTE)).toEqual({
      material: 12000,
      labor: 8500,
      total: 20500,
    });
    expect(noteMaterialLaborQuoteSupersedes(KITCHEN_NOTE)).toBe(true);
    expect(noteQuoteNamedInstallIds(KITCHEN_NOTE)).toEqual([
      'cabinets',
      'countertops',
      'backsplash',
    ]);
  });

  it('leaves a unit rate on its own card', () => {
    const notes = 'Backsplash 28 sqft, material $8/sqft, labor $17/sqft.';
    expect(parseNoteMaterialLaborQuote(notes)).toBeNull();
  });

  it('keeps the normal kitchen cards and splits the note total across them', () => {
    const items = [
      item('cabinet_demo', 'Cabinet demo'),
      item('countertop_demo', 'Countertop demo'),
      item('backsplash_demo', 'Backsplash demo'),
      item('cabinets', 'Cabinets'),
      item('countertops', 'Countertops'),
      item('backsplash', 'Backsplash'),
      item('plumbing', 'Plumbing'),
    ];
    const measurements = {
      cabinetLf: '18',
      countertopSqft: '55',
      backsplashSqft: '28',
      itemQuantities: {},
    } as never;
    const installIds = ['cabinets', 'countertops', 'backsplash'];
    const fills = installIds.map(id =>
      resolveScopeItemSuggestedPricing(
        id,
        measurements,
        'kitchen',
        { quantity: null, unit: null, quantitySource: 'notes' },
        { checklistItems: items },
        null,
        KITCHEN_NOTE
      ).fill
    );
    expect(fills.every(fill => fill && fill.total > 0)).toBe(true);
    expect(fills.every(fill => fill?.rateSourceLabel === 'From notes')).toBe(true);
    const material = fills.reduce((sum, fill) => sum + Number(fill?.material || 0), 0);
    const labor = fills.reduce((sum, fill) => sum + Number(fill?.labor || 0), 0);
    expect(Math.round(material)).toBe(12000);
    expect(Math.round(labor)).toBe(8500);
    const measurementsForGroups = {
      ...measurements,
      itemQuantities: {},
    };
    const cabinetGroup = wholeProjectGroupDisplayTotal({
      items: [item('cabinets', 'Cabinets'), item('countertops', 'Countertops')],
      measurements: measurementsForGroups,
      templateKey: 'kitchen',
      notes: KITCHEN_NOTE,
    });
    const backsplashGroup = wholeProjectGroupDisplayTotal({
      items: [item('backsplash', 'Backsplash')],
      measurements: measurementsForGroups,
      templateKey: 'kitchen',
      notes: KITCHEN_NOTE,
    });
    const cardTotal = fills.reduce((sum, fill) => sum + Math.round(Number(fill?.total || 0)), 0);
    expect(cabinetGroup).toBeLessThan(20500);
    expect(backsplashGroup).toBeLessThan(20500);
    expect(cabinetGroup + backsplashGroup).toBe(cardTotal);
    expect(cardTotal).toBe(20500);

    const demo = resolveScopeItemSuggestedPricing(
      'cabinet_demo',
      measurements,
      'kitchen',
      { quantity: 18, unit: 'lf', quantitySource: 'notes' },
      { checklistItems: items },
      null,
      KITCHEN_NOTE
    ).fill;
    expect(demo?.total).toBe(450);
    expect(demo?.rateSourceLabel).not.toBe('From notes');

    const titles = groupScopeChecklistItems(items, 'kitchen', {
      notes: KITCHEN_NOTE,
      projectType: 'kitchen',
    }).map(group => group.title);
    expect(titles).toContain('Demo');
    expect(titles).toContain('Cabinets & Counters');
    expect(titles).toContain('Tile & Flooring');
    expect(titles).not.toContain('From notes');

    const appliedQuantities: Record<string, { quantity: number; unit: string; quantitySource: string }> = {};
    for (const id of installIds) {
      const fill = fills[installIds.indexOf(id)];
      const stored =
        id === 'backsplash'
          ? { material: 12000, labor: 8500, total: 20500 }
          : {
              material: Number(fill?.material || 0),
              labor: Number(fill?.labor || 0),
              total: Number(fill?.total || 0),
            };
      appliedQuantities[`${id}__material`] = {
        quantity: stored.material,
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
      appliedQuantities[`${id}__labor`] = {
        quantity: stored.labor,
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
      appliedQuantities[`${id}__allowance`] = {
        quantity: stored.total,
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
    }
    const appliedMeasurements = {
      ...measurements,
      itemQuantities: appliedQuantities,
      pricingAcceptance: Object.fromEntries(
        installIds.map(id => [
          id,
          { selectionStatus: 'user_selected', totalAmount: Number(fills[installIds.indexOf(id)]?.total || 0) },
        ])
      ),
    } as never;
    const lines = listConfirmScopeAppliedPricingLines({
      items,
      measurements: appliedMeasurements,
      templateKey: 'kitchen',
      notes: KITCHEN_NOTE,
      appliedOnly: true,
    });
    const breakdown = sumConfirmScopeAppliedPricingBreakdown({
      items,
      measurements: appliedMeasurements,
      templateKey: 'kitchen',
      notes: KITCHEN_NOTE,
      appliedOnly: true,
    });
    const backsplashLine = lines.find(line => line.itemId === 'backsplash');
    expect(kitchenConfirmScopeNoteRate({
      itemId: 'backsplash',
      measurements: appliedMeasurements,
      templateKey: 'kitchen',
      notes: KITCHEN_NOTE,
    })).toBeNull();
    expect(resolveItemRatePricingFromNotes('backsplash', { backsplashSqft: 28 }, KITCHEN_NOTE, { templateKey: 'kitchen' })).toBeNull();
    expect(backsplashLine?.total).toBe(Math.round(Number(fills[2]?.total || 0)));
    expect(backsplashLine?.total).toBeLessThan(20500);
    expect(lines.some(line => line.itemId === 'cabinet_demo')).toBe(false);
    expect(breakdown.material).toBe(12000);
    expect(breakdown.labor).toBe(8500);
    expect(breakdown.total).toBe(20500);
    const withDemo = {
      ...appliedMeasurements,
      itemQuantities: {
        ...appliedQuantities,
        cabinet_demo__material: { quantity: 36, unit: 'allowance', quantitySource: 'user_entered' },
        cabinet_demo__labor: { quantity: 414, unit: 'allowance', quantitySource: 'user_entered' },
        cabinet_demo__allowance: { quantity: 450, unit: 'allowance', quantitySource: 'user_entered' },
        countertop_demo__material: { quantity: 28, unit: 'allowance', quantitySource: 'user_entered' },
        countertop_demo__labor: { quantity: 275, unit: 'allowance', quantitySource: 'user_entered' },
        backsplash_demo__material: { quantity: 21, unit: 'allowance', quantitySource: 'user_entered' },
        backsplash_demo__labor: { quantity: 189, unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        ...appliedMeasurements.pricingAcceptance,
        cabinet_demo: { selectionStatus: 'user_selected', totalAmount: 450 },
        countertop_demo: { selectionStatus: 'user_selected', totalAmount: 303 },
        backsplash_demo: { selectionStatus: 'user_selected', totalAmount: 210 },
      },
    } as never;
    const quoted = sumConfirmScopeAppliedPricingBreakdown({
      items,
      measurements: withDemo,
      templateKey: 'kitchen',
      notes: KITCHEN_NOTE,
      appliedOnly: true,
    });
    const quotedLines = listConfirmScopeAppliedPricingLines({
      items,
      measurements: withDemo,
      templateKey: 'kitchen',
      notes: KITCHEN_NOTE,
      appliedOnly: true,
    });
    expect(quotedLines.some(line => line.itemId === 'cabinet_demo')).toBe(true);
    expect(quoted).toEqual({ total: 21463, material: 12085, labor: 9378, allowance: 0 });
    expect(
      wholeProjectGroupDisplayTotal({
        items: [
          item('cabinet_demo', 'Cabinet demo'),
          item('countertop_demo', 'Countertop demo'),
          item('backsplash_demo', 'Backsplash demo'),
        ],
        measurements: withDemo,
        templateKey: 'kitchen',
        notes: KITCHEN_NOTE,
      })
    ).toBe(963);
    const backsplashHeader = wholeProjectGroupDisplayTotal({
      items: [item('backsplash', 'Backsplash tile install')],
      measurements: appliedMeasurements,
      templateKey: 'kitchen',
      notes: KITCHEN_NOTE,
    });
    expect(backsplashHeader).toBe(Math.round(Number(fills[2]?.total || 0)));
  });
});
