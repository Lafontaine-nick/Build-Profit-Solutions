import {
  buildGroupedCategoryExpenseList,
  resolveExpenseGroupKey,
} from '@/utils/groupCategoryExpenses';

describe('groupCategoryExpenses', () => {
  const lineLabels = { walls: 'Walls', prep: 'Prep & Masking' };

  it('groups multiple expenses for the same estimate line', () => {
    const items = [
      { id: 'e1', vendor: 'Home Depot', material: 'Walls', amount: 1000, linkedLineId: 'walls', date: '2026-09-03' },
      { id: 'e2', vendor: "Lowe's", material: 'Walls', amount: 600, linkedLineId: 'walls', date: '2026-09-03' },
      { id: 'e3', vendor: 'Home Depot', material: 'Prep & Masking', amount: 280, linkedLineId: 'prep', date: '2026-09-02' },
    ];
    const list = buildGroupedCategoryExpenseList(items, lineLabels);
    expect(list).toHaveLength(2);
    expect(list[0].kind).toBe('group');
    if (list[0].kind === 'group') {
      expect(list[0].lineName).toBe('Walls');
      expect(list[0].items).toHaveLength(2);
      expect(list[0].items.map((row) => row.vendor)).toEqual(expect.arrayContaining(['Home Depot', "Lowe's"]));
    }
    expect(list[1].kind).toBe('single');
  });

  it('keeps the budget line name when labor bills use different payees', () => {
    const items = [
      {
        id: 'new',
        vendor: 'Nicholas',
        description: 'GFCI receptacles',
        amount: 1000,
        linkedLineId: 'gfci',
        date: '2026-10-06',
      },
      {
        id: 'old',
        vendor: 'Electrical',
        description: 'GFCI receptacles',
        amount: 1000,
        linkedLineId: 'gfci',
        date: '2026-10-04',
      },
    ];
    const list = buildGroupedCategoryExpenseList(items, { gfci: 'GFCI receptacles' });
    expect(list[0].kind).toBe('group');
    if (list[0].kind === 'group') {
      expect(list[0].lineName).toBe('GFCI receptacles');
      expect(list[0].items.map((row) => row.vendor)).toEqual(['Nicholas', 'Electrical']);
    }
  });

  it('matches material-only expenses to linked line labels', () => {
    const key = resolveExpenseGroupKey(
      { id: 'e1', material: 'Walls' },
      lineLabels
    );
    const linkedKey = resolveExpenseGroupKey(
      { id: 'e2', material: 'Walls', linkedLineId: 'walls' },
      lineLabels
    );
    expect(key).toBe(linkedKey);
  });
});
