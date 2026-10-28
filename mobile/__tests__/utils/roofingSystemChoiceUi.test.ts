import {
  CUSTOM_ROOF_SYSTEM_ID,
  notesIncludeFlatRoofSystems,
  roofingSystemChipLabel,
  roofingSystemChoicesForConfirm,
} from '@/utils/roofingSystemChoiceUi';

describe('roofing system confirm picker', () => {
  test('offers the five priced residential systems', () => {
    expect(
      roofingSystemChoicesForConfirm({
        notes: 'New architectural shingle roof, 26 squares.',
      })
    ).toEqual([
      'architectural_shingles',
      'three_tab_shingles',
      'standing_seam_metal',
      'exposed_fastener_metal',
      'concrete_clay_tile',
    ]);
  });

  test('adds flat-roof systems when the notes call for them', () => {
    expect(
      roofingSystemChoicesForConfirm({ notes: 'TPO flat roof replacement.' })
    ).toEqual([
      'architectural_shingles',
      'three_tab_shingles',
      'standing_seam_metal',
      'exposed_fastener_metal',
      'concrete_clay_tile',
      'tpo',
      'epdm',
      'modified_bitumen',
    ]);
    expect(notesIncludeFlatRoofSystems('Commercial membrane roof.')).toBe(true);
  });

  test('keeps a selected flat system on the list', () => {
    expect(
      roofingSystemChoicesForConfirm({
        notes: 'New shingle roof.',
        selectedId: 'epdm',
      })
    ).toContain('epdm');
  });

  test('leaves custom off the chip list', () => {
    expect(
      roofingSystemChoicesForConfirm({
        notes: 'Custom system, pricing gap.',
        selectedId: CUSTOM_ROOF_SYSTEM_ID,
      })
    ).not.toContain(CUSTOM_ROOF_SYSTEM_ID);
  });

  test('uses a readable collapsed label and a short open-list label', () => {
    expect(roofingSystemChipLabel('architectural_shingles', true)).toBe(
      'Architectural asphalt shingles'
    );
    expect(roofingSystemChipLabel('exposed_fastener_metal', false)).toBe(
      'Metal panel'
    );
    expect(roofingSystemChipLabel('concrete_clay_tile', false)).toBe('Tile');
  });
});
