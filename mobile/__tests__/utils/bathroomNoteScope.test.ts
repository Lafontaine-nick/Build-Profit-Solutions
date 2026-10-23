import {
  bathroomChecklistItemNamedInNotes,
  bathroomNoteTakeoff,
  bathroomScopeLines,
  filterDedicatedBathroomConfirmItems,
  notesAskForSeparateHaulOff,
  notesKeepExistingWetArea,
  notesMentionStructuralFraming,
  shouldLimitBathroomChecklistToNotes,
} from '../../utils/bathroomNoteScope';
import {
  ensureBathroomVisiblePricingCards,
  hydrateScopeChecklistFromNotes,
  syncWindowInstallScopeFromNotes,
} from '../../utils/estimateScopeChecklistUi';
import { emptyQuickMeasurementInput } from '../../utils/scopeQuickMeasurements';
import { applyContractorRemovedScopeItems } from '../../utils/contractorRemovedScope';
import {
  checklistItemInScope,
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '../../utils/scopeItemQuantities';

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
  it('keeps the full list for empty notes and plan import', () => {
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
    ).toBe(true);
    const filtered = filterDedicatedBathroomConfirmItems(
      [
        { id: 'tub_demo' },
        { id: 'wet_area_install' },
        { id: 'shower_tile' },
        { id: 'flooring' },
      ],
      { notes: TUB, templateKey: 'bathroom', scopeMode: 'mixed' }
    );
    expect(filtered.map(item => item.id)).toEqual(['tub_demo', 'flooring']);
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

  it('gives a dumpster and a final clean their own haul-off line', () => {
    const notes =
      'Remodel the bathroom. Demo the bathroom floor tile only. Scrape the thinset. Install new bathroom floor tile wall to wall. Order a dumpster for the debris and do a final clean when the tile is done. The tub, the shower walls, the vanity, and the toilet all stay in place. No paint and no new lighting.';
    expect(namedIds(notes).sort()).toEqual(
      ['cleanup', 'floor_demo', 'floor_tile'].sort()
    );
    expect(bathroomChecklistItemNamedInNotes('shower_floor_demo', notes)).toBe(
      false
    );
    expect(bathroomChecklistItemNamedInNotes('lighting', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('paint_repair', notes)).toBe(
      false
    );
    expect(notesAskForSeparateHaulOff(notes)).toBe(true);
    expect(
      notesAskForSeparateHaulOff(
        'Remodel the bathroom. Demo the bathroom floor tile only. The thinset gets scraped and the old tile gets hauled off. Install new bathroom floor tile wall to wall.'
      )
    ).toBe(false);
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
        'Build shower pan',
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
        'Build shower pan',
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

  it('keeps a mud pan and shower floor tile off the walls and the bathroom floor', () => {
    const notes =
      'Remodel the bathroom. Tear out the existing mud pan. Build a new mud pan and waterproof it. Install shower floor tile on the pan. Leave the shower walls, the bathroom floor, the vanity, and the toilet. No paint.';
    expect(bathroomScopeLines(notes).map(line => line.label).sort()).toEqual(
      [
        'Remove tile shower pan',
        'Shower floor tile',
        'Shower pan waterproofing',
        'Build shower pan',
        'Wet area install',
      ].sort()
    );
    expect(bathroomChecklistItemNamedInNotes('demo', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('shower_tile', notes)).toBe(
      false
    );
    expect(bathroomChecklistItemNamedInNotes('floor_tile', notes)).toBe(false);
    expect(bathroomChecklistItemNamedInNotes('floor_demo', notes)).toBe(false);
    expect(
      bathroomChecklistItemNamedInNotes('shower_floor_tile', notes)
    ).toBe(true);
  });

  it('keeps the old shower door without a new door or a kept shower', () => {
    const notes =
      'Remodel the bathroom. Tear out the existing shower wall tile and the tile shower pan. Install new shower wall tile and a new tile shower pan. Keep the existing shower door. Leave the bathroom floor, vanity, and toilet. No paint.';
    expect(notesKeepExistingWetArea(notes)).toBe(false);
    expect(bathroomScopeLines(notes).map(line => line.label).sort()).toEqual(
      [
        'Reinstall existing shower door',
        'Remove existing shower door',
        'Remove tile shower pan',
        'Shower tile demo / tear-out',
        'Shower wall tile',
        'Build shower pan',
        'Wet area install',
      ].sort()
    );
    expect(bathroomChecklistItemNamedInNotes('glass_door', notes)).toBe(false);
    expect(
      bathroomChecklistItemNamedInNotes('glass_door_demo', notes)
    ).toBe(false);
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
        'Build shower pan',
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

  it('opens a measurement box for every priced line the note kept', () => {
    const notes =
      'I need to make an estimate for a bathroom remodel. Tear out bathroom floor and shower floor and shower walls.Put back new tile. Remove bathroom window and install new one. Install new insulation in the walls. New vanity and countertop';
    expect(bathroomNoteTakeoff(notes)).toEqual({
      showerWallDemo: true,
      showerWallSqft: true,
      showerFloorSqft: true,
      bathFloorDemo: true,
      bathFloorSqft: true,
      wallInsulationSqft: true,
      windowCount: true,
    });
    expect(
      bathroomNoteTakeoff(
        'Remodel the bathroom. Demo the bathroom floor tile only. Install new bathroom floor tile wall to wall. The tub, the shower walls, the vanity, and the toilet all stay in place. No paint and no new lighting.'
      )
    ).toMatchObject({
      showerWallSqft: false,
      showerFloorSqft: false,
      bathFloorSqft: true,
      windowCount: false,
      wallInsulationSqft: false,
    });
  });

  it('prices the tile that goes back, plus a bathroom window and wall insulation', () => {
    const notes =
      'I need to make an estimate for a bathroom remodel. Tear out bathroom floor and shower floor and shower walls.Put back new tile. Remove bathroom window and install new one. Install new insulation in the walls. New vanity and countertop';
    expect(bathroomScopeLines(notes).map(line => line.label).sort()).toEqual(
      [
        'Bath floor tile',
        'Demo bath floor tile',
        'Shower floor tile',
        'Shower tile demo / tear-out',
        'Build shower pan',
        'Shower wall tile',
        'Vanity',
        'Vanity top',
        'Wall insulation',
        'Wet area install',
        'Window removal and install',
      ].sort()
    );
    const hydrated = hydrateScopeChecklistFromNotes(
      [
        { id: 'demo', inputType: 'yes_no', label: 'Demo', state: 'included' },
        {
          id: 'floor_demo',
          inputType: 'yes_no',
          label: 'Floor demo',
          state: 'included',
        },
        {
          id: 'shower_tile',
          inputType: 'yes_no',
          label: 'Shower tile',
          state: 'included',
        },
        { id: 'vanity', inputType: 'yes_no', label: 'Vanity', state: 'included' },
        {
          id: 'countertops',
          inputType: 'yes_no',
          label: 'Counters',
          state: 'included',
        },
      ],
      'bathroom',
      notes
    );
    const kept = syncWindowInstallScopeFromNotes(hydrated, {
      notes,
      templateKey: 'bathroom',
      windowCount: 1,
    });
    expect(
      kept
        .filter(item =>
          [
            'floor_tile',
            'shower_floor_tile',
            'shower_pan',
            'window_install',
            'insulation',
          ].includes(item.id)
        )
        .map(item => item.id)
        .sort()
    ).toEqual(
      [
        'floor_tile',
        'insulation',
        'shower_floor_tile',
        'shower_pan',
        'window_install',
      ].sort()
    );
    const fromGenericWindow = ensureBathroomVisiblePricingCards(
      [{ id: 'windows', inputType: 'yes_no', label: 'Window install', state: 'included' }],
      notes,
      'bathroom',
      { windowCount: '1' }
    );
    expect(fromGenericWindow.some(item => item.id === 'windows')).toBe(false);
    expect(fromGenericWindow.some(item => item.id === 'window_install')).toBe(
      true
    );
    expect(fromGenericWindow.some(item => item.id === 'shower_pan')).toBe(true);
    expect(
      filterDedicatedBathroomConfirmItems(fromGenericWindow, {
        notes,
        templateKey: 'bathroom',
        scopeMode: 'dedicated',
      }).map(item => item.id)
    ).toEqual(
      expect.arrayContaining([
        'window_install',
        'shower_pan',
        'shower_floor_tile',
        'insulation',
      ])
    );
    const measurements = {
      ...emptyQuickMeasurementInput(),
      bathroomFloorSqft: '120',
      showerFloorTileSqft: '20',
      windowCount: '1',
      exteriorWallInsulationSqft: '50',
    };
    for (const id of [
      'floor_tile',
      'shower_floor_tile',
      'shower_pan',
      'window_install',
      'insulation',
    ]) {
      const resolved = resolveChecklistItemQuantity(id, measurements, {
        templateKey: 'bathroom',
      });
      const pricing = resolveScopeItemSuggestedPricing(
        id,
        measurements,
        'bathroom',
        resolved,
        null,
        null,
        notes
      );
      expect(Number(resolved.quantity)).toBeGreaterThan(0);
      expect(pricing.fill?.total).toBeGreaterThan(0);
    }
  });

  it('prices a replaced bathroom window from the entered count', () => {
    const notes = 'Guest bath remodel. Replace the window.';
    const measurements = {
      ...emptyQuickMeasurementInput(),
      windowCount: '1',
      itemQuantities: {
        window_install: {
          quantity: 0,
          unit: 'each',
          quantitySource: 'user_entered' as const,
        },
      },
    };
    const resolved = resolveChecklistItemQuantity('window_install', measurements, {
      templateKey: 'bathroom',
      notes,
    });
    expect(resolved.quantity).toBe(1);
    expect(resolved.unit).toBe('each');
    expect(resolved.pricingReady).toBe(true);
    const pricing = resolveScopeItemSuggestedPricing(
      'window_install',
      measurements,
      'bathroom',
      resolved,
      null,
      null,
      notes
    );
    expect(pricing.fill?.total).toBeGreaterThan(0);
    const withoutCount = resolveChecklistItemQuantity(
      'window_install',
      emptyQuickMeasurementInput(),
      { templateKey: 'bathroom', notes }
    );
    expect(withoutCount.quantity == null || Number(withoutCount.quantity) <= 0).toBe(
      true
    );
  });

  it('keeps a removed bathroom window off the bid when the count is still entered', () => {
    const notes = 'Guest bath remodel. Replace the window.';
    const removed = {
      id: 'window_install',
      inputType: 'yes_no' as const,
      label: 'Window replacement',
      helperText:
        'Remove the existing bathroom window and install the new one. Enter the count.',
      state: 'excluded' as const,
      contractorRemoved: true,
    };
    const synced = syncWindowInstallScopeFromNotes(
      [removed, { id: 'windows', inputType: 'yes_no', label: 'Windows', state: 'included' }],
      { notes, templateKey: 'bathroom', windowCount: 1 }
    );
    expect(synced.find(item => item.id === 'window_install')).toMatchObject({
      state: 'excluded',
      contractorRemoved: true,
    });
    const visible = ensureBathroomVisiblePricingCards(synced, notes, 'bathroom', {
      windowCount: '1',
    });
    const windowCard = applyContractorRemovedScopeItems(visible, [
      'window_install',
    ]).find(item => item.id === 'window_install');
    expect(windowCard).toMatchObject({
      state: 'excluded',
      contractorRemoved: true,
    });
    expect(checklistItemInScope(windowCard!)).toBe(false);
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
