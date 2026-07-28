import {
  checklistDisplayHelper,
  checklistDisplayLabel,
  quantityNeededLabel,
} from '@/utils/estimateScopeChecklistUi';
import { getChecklistItemQuantityRule } from '@/utils/scopeItemQuantities';

describe('bathroom plumbing rough-in scope copy', () => {
  const item = {
    id: 'plumbing_rough',
    label: 'Plumbing rough-in (new lines / relocation)',
    helperText: 'New/relocated lines, not fixture hookup only.',
    inputType: 'yes_no' as const,
    state: 'included' as const,
  };

  it('uses shower/tub-only label and helper on bathroom template', () => {
    expect(checklistDisplayLabel(item, 'bathroom')).toBe('Plumbing rough-in (shower / tub)');
    expect(checklistDisplayHelper(item, 'bathroom')).toMatch(/shower and tub/i);
    expect(checklistDisplayHelper(item, 'bathroom')).toMatch(/same-location vs relocated/i);
    expect(checklistDisplayHelper(item, 'bathroom')).toMatch(/demolition exposes the plumbing/i);
    expect(checklistDisplayHelper(item, 'bathroom')).toMatch(/toilet rough-in is on toilet/i);
    expect(checklistDisplayHelper(item, 'bathroom')).toMatch(/lav.*vanity/i);
  });

  it('uses bathroom quantity helper for work type and plumbing exposure', () => {
    const rule = getChecklistItemQuantityRule('plumbing_rough', 'bathroom');
    expect(rule?.quantityHelper).toMatch(/same-location vs relocated/i);
    expect(rule?.quantityHelper).toMatch(/demolition exposes/i);
    expect(rule?.missingMessage).toMatch(/work type|plumbing exposure/i);
  });

  it('uses remodel wording in quantity-needed label', () => {
    expect(quantityNeededLabel('plumbing_rough', 'bathroom', 'each')).toBe(
      'fixture type, work type, plumbing exposure & floor construction'
    );
  });
});
