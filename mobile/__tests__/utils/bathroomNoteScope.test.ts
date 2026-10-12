import {
  bathroomChecklistItemNamedInNotes,
  bathroomScopeLines,
  filterDedicatedBathroomConfirmItems,
  shouldLimitBathroomChecklistToNotes,
} from '../../utils/bathroomNoteScope';

const TILE =
  'Remodel the bathroom. Tear out the shower walls and the tile shower pan. Demo the bathroom floor. Install new shower wall tile, a new tile shower pan, and new bathroom floor tile.';
const PREFAB =
  'Remodel the bathroom. Remove the existing prefab shower and install a new prefab shower enclosure';
const TUB =
  'Remodel the bathroom. Tear out the existing tub and install a new tub. Paint the bathroom walls.';

const IDS = [
  'demo',
  'floor_demo',
  'tub_demo',
  'shower_floor_demo',
  'wet_area_install',
  'shower_pan',
  'shower_tile',
  'floor_tile',
  'paint_repair',
  'lighting',
  'vanity',
  'toilet',
  'trim',
  'plumbing_trim',
  'cleanup',
];

function namedIds(notes: string) {
  return IDS.filter(id => bathroomChecklistItemNamedInNotes(id, notes));
}

describe('bathroom note checklist', () => {
  it('keeps the full list for empty notes, mixed scope, and plan import', () => {
    expect(
      shouldLimitBathroomChecklistToNotes({
        notes: '',
        templateKey: 'bathroom',
      })
    ).toBe(false);
    expect(
      shouldLimitBathroomChecklistToNotes({
        notes: TUB,
        templateKey: 'bathroom',
        scopeMode: 'mixed',
      })
    ).toBe(false);
    expect(
      shouldLimitBathroomChecklistToNotes({
        notes: TUB,
        templateKey: 'bathroom',
        scopeMode: 'dedicated',
      })
    ).toBe(true);
    expect(
      shouldLimitBathroomChecklistToNotes({
        notes: TUB,
        templateKey: 'bathroom',
        planBacked: true,
      })
    ).toBe(false);
  });

  it('names only the tile, floor, and pan work in the tile note', () => {
    expect(namedIds(TILE).sort()).toEqual(
      [
        'demo',
        'floor_demo',
        'floor_tile',
        'shower_floor_demo',
        'shower_pan',
        'shower_tile',
        'wet_area_install',
      ].sort()
    );
  });

  it('names the prefab install and hides shower tile, paint, and lighting', () => {
    expect(namedIds(PREFAB).sort()).toEqual(['wet_area_install']);
  });

  it('ignores do-not lines and a drain connection on a prefab pan swap', () => {
    const notes =
      'Remodel the bathroom. The existing shower is a prefab shower pan with a prefab surround, and both are coming out. Demo and haul off the prefab shower pan, cap the drain, and leave the alcove ready for the new base. Install a new prefab shower pan, set it in mortar, and connect it to the existing drain. Do not tile the shower walls, do not change the bathroom floor, and do not replace the vanity or toilet. No paint.';
    expect(namedIds(notes).sort()).toEqual(
      ['cleanup', 'wet_area_install'].sort()
    );
    expect(bathroomChecklistItemNamedInNotes('plumbing', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('shower_tile', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('paint_repair', notes)).toBe(
      false
    );
  });

  it('keeps a floor-tile-only note off the tub, shower, vanity, and paint', () => {
    const notes =
      'Remodel the bathroom. Demo the bathroom floor tile only. The thinset gets scraped and the old tile gets hauled off. Install new bathroom floor tile wall to wall, and set a new marble threshold at the doorway. The tub, the shower walls, the vanity, and the toilet all stay in place. No paint and no new lighting.';
    expect(namedIds(notes).sort()).toEqual(
      ['cleanup', 'floor_demo', 'floor_tile'].sort()
    );
    expect(bathroomChecklistItemNamedInNotes('lighting', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('vanity', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('tub_demo', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('shower_tile', notes)).toBe(
      false
    );
  });

  it('names the tub swap and wall paint', () => {
    expect(namedIds(TUB).sort()).toEqual(
      ['paint_repair', 'tub_demo', 'wet_area_install'].sort()
    );
  });

  it('uses one line list for the notes we walked', () => {
    expect(bathroomScopeLines(TILE).map(line => line.label).sort()).toEqual(
      [
        'Bath floor tile',
        'Demo bath floor tile',
        'Remove tile shower pan',
        'Shower tile demo / tear-out',
        'Shower wall tile',
        'Tile shower pan',
        'Wet area install',
      ].sort()
    );
    expect(bathroomScopeLines(PREFAB).map(line => line.label).sort()).toEqual(
      [
        'Prefab shower enclosure',
        'Remove existing prefab shower enclosure',
      ].sort()
    );
    expect(bathroomScopeLines(TUB).map(line => line.label).sort()).toEqual(
      ['Bathroom wall paint', 'Remove tub', 'Tub install'].sort()
    );
    expect(
      bathroomScopeLines(
        'Remodel the bathroom. The existing shower is a prefab shower pan with a prefab surround, and both are coming out. Demo and haul off the prefab shower pan, cap the drain, and leave the alcove ready for the new base. Install a new prefab shower pan, set it in mortar, and connect it to the existing drain. Do not tile the shower walls, do not change the bathroom floor, and do not replace the vanity or toilet. No paint.'
      )
        .map(line => line.label)
        .sort()
    ).toEqual(
      [
        'Haul-off / dump fees',
        'Prefab shower pan',
        'Remove existing prefab shower enclosure',
        'Remove existing prefab shower pan',
      ].sort()
    );
    expect(
      bathroomScopeLines(
        'Remodel the bathroom. Demo the bathroom floor tile only. The thinset gets scraped and the old tile gets hauled off. Install new bathroom floor tile wall to wall, and set a new marble threshold at the doorway. The tub, the shower walls, the vanity, and the toilet all stay in place. No paint and no new lighting.'
      )
        .map(line => line.label)
        .sort()
    ).toEqual(
      [
        'Bath floor tile',
        'Demo bath floor tile',
        'Haul-off / dump fees',
        'Marble threshold',
      ].sort()
    );
  });

  it('keeps a tile shower niche and bench and leaves the floor, vanity, and paint', () => {
    const notes =
      'The wet area is a full tile shower. Install shower wall tile on the walls and a new tile shower pan at the floor. Frame, waterproof, and tile a shower niche in the side wall, and build a tiled shower bench on the back wall. Waterproof the shower walls with backer board and a membrane before the tile goes on. Install a new shower door after the tile is done. Leave the bathroom floor, vanity, and toilet. No paint.';
    expect(bathroomScopeLines(notes).map(line => line.label).sort()).toEqual(
      [
        'Shower bench',
        'Shower door',
        'Shower niche',
        'Shower wall tile',
        'Shower waterproofing & backer board',
        'Tile shower pan',
        'Wet area install',
      ].sort()
    );
  });

  it('drops package rows the note never names', () => {
    const filtered = filterDedicatedBathroomConfirmItems(
      [
        { id: 'floor_tile' },
        { id: 'transitions' },
        { id: 'plumbing' },
        { id: 'note:price needed for toilet' },
      ],
      {
        notes:
          'Remodel the bathroom. Demo the bathroom floor tile only. Install new bathroom floor tile wall to wall. The tub, the shower walls, the vanity, and the toilet all stay in place. No paint and no new lighting.',
        templateKey: 'bathroom',
        scopeMode: 'dedicated',
      }
    );
    expect(filtered.map(item => item.id)).toEqual(['floor_tile']);
  });

  it('drops unnamed bathroom rows and keeps custom rows', () => {
    const filtered = filterDedicatedBathroomConfirmItems(
      [
        { id: 'lighting' },
        { id: 'tub_demo' },
        { id: 'custom_1' },
        { id: 'vanity' },
      ],
      { notes: TUB, templateKey: 'bathroom', scopeMode: 'dedicated' }
    );
    expect(filtered.map(item => item.id)).toEqual(['tub_demo', 'custom_1']);
  });
});
