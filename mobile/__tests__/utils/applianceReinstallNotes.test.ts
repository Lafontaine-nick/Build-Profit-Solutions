import { inferItemStateFromNotes } from '@/utils/scopeItemNoteHints';
import {
  applyKitchenScopeInferences,
  applyScopeInferencesFromNotes,
} from '@/utils/estimateScopeChecklistUi';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';

const KITCHEN_NOTES =
  'Okay, I need kitchen cabinets installed. Appliances have all already been removed. I just need to reinstall old appliances. Paint the walls after cabinet install. Countertops install and backsplash. Also need to do kitchen floor tile install.';

function kitchenApplianceItems(): ScopeChecklistItem[] {
  return [
    {
      id: 'appliance_removal',
      inputType: 'yes_no',
      label: 'Appliance removal',
      state: 'unsure',
    },
    {
      id: 'appliances',
      inputType: 'yes_no',
      label: 'Appliance reinstall & hookup',
      state: 'unsure',
    },
  ];
}

describe('appliance reinstall notes inference', () => {
  test('reinstall old appliances → Yes; already removed → No for removal', () => {
    expect(inferItemStateFromNotes('appliances', KITCHEN_NOTES)).toBe('included');
    expect(inferItemStateFromNotes('appliance_removal', KITCHEN_NOTES)).toBe('excluded');
  });

  test('hydrate sets Yes on reinstall and No on removal without flipping removal back to Yes', () => {
    const next = applyScopeInferencesFromNotes(kitchenApplianceItems(), KITCHEN_NOTES, 'kitchen');
    const byId = Object.fromEntries(next.map((i) => [i.id, i]));

    expect(byId.appliances.state).toBe('included');
    expect(byId.appliance_removal.state).toBe('excluded');
  });

  test('kitchen inference still implies removal when reinstall is Yes and notes are silent on removal', () => {
    const items = kitchenApplianceItems().map((item) =>
      item.id === 'appliances' ? { ...item, state: 'included' as const } : item
    );
    const next = applyKitchenScopeInferences(items, 'kitchen', {
      notes: 'Reinstall appliances after cabinets.',
    });
    const byId = Object.fromEntries(next.map((i) => [i.id, i]));
    expect(byId.appliance_removal.state).toBe('included');
  });

  test('kitchen inference does not force removal when notes say already removed', () => {
    const items = kitchenApplianceItems().map((item) =>
      item.id === 'appliances' ? { ...item, state: 'included' as const } : item
    );
    const next = applyKitchenScopeInferences(items, 'kitchen', { notes: KITCHEN_NOTES });
    const byId = Object.fromEntries(next.map((i) => [i.id, i]));
    expect(byId.appliance_removal.state).toBe('unsure');
  });
});
