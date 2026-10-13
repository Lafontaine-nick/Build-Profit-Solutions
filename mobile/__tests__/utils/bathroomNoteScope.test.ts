import {
  bathroomChecklistItemNamedInNotes,
  bathroomScopeLines,
  filterDedicatedBathroomConfirmItems,
  notesKeepExistingWetArea,
  notesMentionStructuralFraming,
  shouldLimitBathroomChecklistToNotes,
} from '../../utils/bathroomNoteScope';
import { hydrateScopeChecklistFromNotes } from '../../utils/estimateScopeChecklistUi';

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
    expect(bathroomScopeLines(TUB).map(line => line.id).sort()).toEqual(
      ['paint_repair', 'tub_demo', 'tub_install'].sort()
    );
  });

  it('treats leave-the-alcove as a new tub, not keeping the old one', () => {
    const notes =
      'Remodel the bathroom. Tear out the existing alcove tub and haul it off. Cap the drain and leave the alcove ready for the new tub. Install a new alcove tub and connect it to the existing drain. Paint the bathroom walls. Do not tile the shower, and do not replace the vanity or toilet.';
    expect(notesKeepExistingWetArea(notes)).toBe(false);
    expect(notesKeepExistingWetArea('Leave the existing tub in place.')).toBe(
      true
    );
    expect(bathroomScopeLines(notes).map(line => line.id).sort()).toEqual(
      ['paint_repair', 'tub_demo', 'tub_install'].sort()
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

  it('prices a marble doorway threshold as its own each card', () => {
    const notes =
      'Remodel the bathroom. Demo the bathroom floor tile only. The thinset gets scraped and the old tile gets hauled off. Install new bathroom floor tile wall to wall, and set a new marble threshold at the doorway. The tub, the shower walls, the vanity, and the toilet all stay in place. No paint and no new lighting.';
    expect(bathroomChecklistItemNamedInNotes('marble_threshold', notes)).toBe(
      true
    );
    expect(
      bathroomChecklistItemNamedInNotes(
        'marble_threshold',
        'Remodel the bathroom. Do not set a marble threshold. Install new bathroom floor tile.'
      )
    ).toBe(false);
    const filtered = filterDedicatedBathroomConfirmItems(
      [
        { id: 'floor_demo' },
        { id: 'floor_tile' },
        { id: 'marble_threshold' },
        { id: 'transitions' },
        { id: 'cleanup' },
      ],
      { notes, templateKey: 'bathroom', scopeMode: 'dedicated' }
    );
    expect(filtered.map(item => item.id).sort()).toEqual(
      ['cleanup', 'floor_demo', 'floor_tile', 'marble_threshold'].sort()
    );
    const hydrated = hydrateScopeChecklistFromNotes(
      [{ id: 'floor_tile', inputType: 'yes_no', label: 'Bath floor tile', state: 'included' }],
      'bathroom',
      notes
    );
    const threshold = hydrated.find(item => item.id === 'marble_threshold');
    expect(threshold?.state).toBe('included');
    expect(threshold?.label).toBe('Marble threshold');
    expect(hydrated.some(item => item.id === 'transitions')).toBe(false);
  });

  it('keeps a framed shower niche on the bathroom note instead of wall framing', () => {
    const notes =
      'Remodel the bathroom. Tear out the existing shower wall tile, the tile shower pan, and the old shower door. Haul off the debris. Install new shower wall tile and a new tile shower pan. Frame, waterproof, and tile a shower niche in the side wall, and build a tiled shower bench on the back wall. Waterproof the shower walls with backer board and a membrane before the tile goes on. Install a new shower door after the tile is done. Leave the bathroom floor, vanity, and toilet. No paint.';
    expect(notesMentionStructuralFraming(notes)).toBe(false);
    expect(
      shouldLimitBathroomChecklistToNotes({
        notes,
        templateKey: 'bathroom',
        scopeMode: 'dedicated',
      })
    ).toBe(true);
    expect(bathroomScopeLines(notes).map(line => line.label).sort()).toEqual(
      [
        'Haul-off / dump fees',
        'Remove shower door',
        'Remove tile shower pan',
        'Shower bench',
        'Shower door',
        'Shower niche',
        'Shower tile demo / tear-out',
        'Shower wall tile',
        'Shower waterproofing & backer board',
        'Tile shower pan',
        'Wet area install',
      ].sort()
    );
    expect(
      shouldLimitBathroomChecklistToNotes({
        notes: 'Remodel the bathroom. Frame the new walls, then hang drywall.',
        templateKey: 'bathroom',
        scopeMode: 'dedicated',
      })
    ).toBe(true);
    expect(
      bathroomScopeLines(
        'Remodel the bathroom. Frame the new walls, then hang drywall.'
      )
        .map(line => line.label)
        .sort()
    ).toEqual(['Drywall', 'Wall framing']);
  });

  it('keeps a wall-framing bathroom on that measurement and leaves the toilet and paint off', () => {
    const notes =
      'Remodel the bathroom. Frame the bathroom walls to move the shower to the opposite wall. Leave the vanity and the toilet. No paint.';
    expect(notesMentionStructuralFraming(notes)).toBe(true);
    expect(
      shouldLimitBathroomChecklistToNotes({
        notes,
        templateKey: 'bathroom',
        scopeMode: 'dedicated',
      })
    ).toBe(true);
    expect(bathroomScopeLines(notes).map(line => line.label)).toEqual([
      'Wall framing',
    ]);
    expect(bathroomChecklistItemNamedInNotes('toilet', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('paint_repair', notes)).toBe(
      false
    );
    expect(bathroomChecklistItemNamedInNotes('vanity', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('shower_tile', notes)).toBe(
      false
    );
    const filtered = filterDedicatedBathroomConfirmItems(
      [
        { id: 'framing' },
        { id: 'toilet' },
        { id: 'paint_repair' },
        { id: 'demo' },
        { id: 'shower_tile' },
        { id: 'floor_tile' },
        { id: 'vanity' },
      ],
      { notes, templateKey: 'bathroom', scopeMode: 'dedicated' }
    );
    expect(filtered.map(item => item.id)).toEqual(['framing']);
  });

  it('keeps the old shower door without a new door or a kept shower', () => {
    const notes =
      'Remodel the bathroom. Tear out the existing shower wall tile and the tile shower pan. Install new shower wall tile and a new tile shower pan. Keep the existing shower door. Leave the bathroom floor, vanity, and toilet. No paint.';
    expect(notesKeepExistingWetArea(notes)).toBe(false);
    expect(bathroomScopeLines(notes).map(line => line.label).sort()).toEqual(
      [
        'Remove tile shower pan',
        'Shower tile demo / tear-out',
        'Shower wall tile',
        'Tile shower pan',
        'Wet area install',
      ].sort()
    );
    expect(notesKeepExistingWetArea('Leave the existing tub in place.')).toBe(
      true
    );
    expect(notesKeepExistingWetArea('Keep the existing shower.')).toBe(true);
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

  it('keeps a bath fan and vanity lights when the tub, floor, and cabinet stay', () => {
    const notes =
      'Replace the exhaust fan with a new bath fan and run the duct to the existing roof cap. Install new vanity lighting over the mirror, two fixtures. The tub, shower, floor tile, and vanity cabinet all stay. Do not demo any tile, do not replace the toilet, and do not paint the walls.';
    expect(bathroomScopeLines(notes).map(line => line.label).sort()).toEqual(
      ['Bath exhaust fan', 'Vanity lighting · 2 fixtures'].sort()
    );
    expect(bathroomChecklistItemNamedInNotes('vanity', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('floor_tile', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('tub_demo', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('paint_repair', notes)).toBe(
      false
    );
  });

  it('keeps prefab pan and surround demo and install as priced cards', () => {
    const notes =
      'Remodel the bathroom. The existing shower is a prefab shower pan with a prefab surround, and both are coming out. Demo and haul off the prefab shower pan and the prefab surround, cap the drain, and leave the alcove ready. Install a new prefab shower pan, set it in mortar, and connect it to the existing drain. Install a new prefab shower surround on the walls.';
    const filtered = filterDedicatedBathroomConfirmItems(
      [
        { id: 'wet_area_install' },
        { id: 'shower_floor_demo' },
        { id: 'shower_enclosure_demo' },
        { id: 'prefab_shower_pan' },
        { id: 'prefab_shower_enclosure' },
        { id: 'shower_tile' },
        { id: 'plumbing' },
        { id: 'toilet' },
        { id: 'cleanup' },
      ],
      { notes, templateKey: 'bathroom', scopeMode: 'dedicated' }
    );
    expect(filtered.map(item => item.id).sort()).toEqual(
      [
        'cleanup',
        'prefab_shower_enclosure',
        'prefab_shower_pan',
        'shower_enclosure_demo',
        'shower_floor_demo',
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

  it('names the vanity, top, faucet, and toilet a fixture note asks for', () => {
    const notes =
      'Remodel the bathroom. Demo and haul off the existing vanity cabinet and the vanity top. Remove the existing toilet. Install a new 60-inch vanity with a quartz top, a new faucet, and a new toilet. Set the vanity and connect it to the existing supply and drain. Do not change the shower, the bathroom floor, or the paint.';
    expect(bathroomScopeLines(notes).map(line => line.label).sort()).toEqual(
      [
        'Faucet',
        'Haul-off / dump fees',
        'Remove vanity',
        'Remove vanity top',
        'Toilet',
        'Vanity',
        'Vanity top',
      ].sort()
    );
    expect(bathroomChecklistItemNamedInNotes('floor_tile', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('paint_repair', notes)).toBe(
      false
    );
    expect(bathroomChecklistItemNamedInNotes('plumbing', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('shower_tile', notes)).toBe(false);
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
