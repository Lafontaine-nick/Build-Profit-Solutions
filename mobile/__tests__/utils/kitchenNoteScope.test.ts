import { repairDraftRatePricingFromNotes } from '../../utils/estimateAiDraft';
import { notesNameBathroomAssembly } from '../../utils/bathroomNoteScope';
import { measurementsForScopeFoundChoice } from '../../utils/scopeFoundClarification';
import { applyStep2NoteScopeFilters } from '../../utils/scopePackagesForReview';
import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '../../utils/scopeItemQuantities';
import { groupScopeChecklistItems } from '../../utils/estimateScopeChecklistUi';
import {
  getInitialRevealConfirmItems,
  getInitialRevealUnderstoodBullets,
} from '../../utils/estimateInitialRevealUi';
import {
  filterDedicatedKitchenConfirmItems,
  kitchenConfirmScopeSeedItems,
  kitchenNoteIncludesFloorWork,
  kitchenNoteNamesBacksplash,
  kitchenNoteNamesCabinetWork,
  kitchenNoteNamesCounterWork,
  kitchenNoteNamesSurfaceDemo,
} from '../../utils/kitchenNoteScope';

const GUT =
  'Kitchen remodel. Demo existing cabinets, countertops, backsplash, and vinyl floor. Install 22 LF new cabinets, quartz counters 48 sqft, tile backsplash 32 sqft, and LVP flooring 160 sqft. Baseboards 40 LF. Include sink and dishwasher hookup. No prices yet.';

describe('filterDedicatedKitchenConfirmItems', () => {
  it('keeps named kitchen lines and drops questionnaire leftovers', () => {
    const filtered = filterDedicatedKitchenConfirmItems(
      [
        { id: 'cabinet_demo', label: 'Cabinet demo / removal' },
        { id: 'floor_demo', label: 'Flooring removal / demolition' },
        { id: 'demo', label: 'Shower tile demo / tear-out' },
        { id: 'cabinets', label: '22 LF cabinets' },
        { id: 'backsplash', label: 'Backsplash tile install' },
        { id: 'tile', label: 'Tile' },
        { id: 'flooring', label: 'Kitchen flooring install' },
        { id: 'flooring_lvp', label: 'LVP installation' },
        { id: 'trim', label: 'Trim & baseboard' },
        { id: 'baseboard_install', label: 'Baseboard trim & finish' },
        { id: 'sink_faucet', label: 'Sink & faucet' },
        { id: 'garbage_disposal', label: 'Garbage disposal' },
        { id: 'electrical', label: 'Electrical outlets, GFCI & circuits' },
        { id: 'lighting', label: 'Lighting fixtures & install' },
        { id: 'drywall', label: 'Drywall / patching' },
        { id: 'paint', label: 'Interior painting' },
        { id: 'plumbing', label: 'Plumbing connections' },
        { id: 'interior_finishes', label: 'Interior Finishes' },
        { id: 'labor', label: 'Framing labor' },
        { id: 'permits', label: 'Permits & inspections' },
        { id: 'cleanup', label: 'Cleanup, haul-off & disposal' },
      ],
      { notes: GUT, templateKey: 'kitchen', projectType: 'kitchen' }
    );

    expect(filtered.map(item => item.id)).toEqual([
      'cabinet_demo',
      'floor_demo',
      'cabinets',
      'backsplash',
      'flooring',
      'trim',
      'plumbing',
    ]);
  });

  it('drops install-only kitchen demo cards when the note never says demo', () => {
    const notes =
      'install 24 LF cabinets lump sum $12,000, quartz counters 55 sqft allowance $4,400, backsplash 42 sqft material $8 per sqft and labor $14 per sqft. New LVP flooring 180 sqft material $4.25 per sqft and labor $3.75 per sqft. Baseboard 48 LF at $7 per LF.';
    const filtered = filterDedicatedKitchenConfirmItems(
      [
        { id: 'cabinets', label: 'Cabinets' },
        { id: 'cabinet_demo', label: 'Cabinet demo / removal' },
        { id: 'countertops', label: 'Countertops' },
        { id: 'countertop_demo', label: 'Countertop demo / removal' },
        { id: 'backsplash', label: 'Backsplash' },
        { id: 'backsplash_demo', label: 'Backsplash demo / removal' },
        { id: 'flooring', label: 'Kitchen flooring install' },
        { id: 'floor_demo', label: 'Kitchen flooring demo / removal' },
        { id: 'trim', label: 'Trim & baseboard' },
        { id: 'labor', label: 'Framing labor' },
      ],
      { templateKey: 'kitchen', projectType: 'kitchen', notes }
    );
    expect(filtered.map(item => item.id)).toEqual([
      'cabinets',
      'countertops',
      'backsplash',
      'flooring',
      'trim',
    ]);
  });

  it('drops unnamed counters and backsplash from a cabinet and LVP install', () => {
    const notes = 'Install 12 LF of base cabinets and 40 sqft of LVP.';
    const filtered = filterDedicatedKitchenConfirmItems(
      [
        { id: 'cabinets', label: '12 LF cabinets', state: 'included' },
        { id: 'countertops', label: 'Countertops', state: 'unsure' },
        { id: 'backsplash', label: 'Backsplash', state: 'unsure' },
        { id: 'cabinet_demo', label: 'Cabinet demo', state: 'unsure' },
        { id: 'countertop_demo', label: 'Countertop demo', state: 'unsure' },
        { id: 'flooring', label: 'Kitchen flooring install', state: 'included' },
      ],
      { notes, templateKey: 'kitchen', projectType: 'kitchen' }
    );
    expect(filtered.map(item => item.id)).toEqual(['cabinets', 'flooring']);
    expect(filtered.find(item => item.id === 'flooring')?.label).toBe(
      'LVP flooring'
    );
  });

  it('leaves a bare kitchen remodel on the full questionnaire', () => {
    const items = [
      { id: 'drywall', label: 'Drywall / patching' },
      { id: 'paint', label: 'Interior painting' },
    ];
    expect(
      filterDedicatedKitchenConfirmItems(items, {
        notes: 'Kitchen remodel',
        templateKey: 'kitchen',
      })
    ).toEqual(items);
  });

  it('keeps a new sink when the note asks for one', () => {
    const filtered = filterDedicatedKitchenConfirmItems(
      [
        { id: 'sink_faucet', label: 'Sink & faucet' },
        { id: 'cabinets', label: 'Cabinets' },
      ],
      {
        notes: 'Kitchen remodel. Install 12 LF cabinets and a new sink and faucet.',
        templateKey: 'kitchen',
      }
    );
    expect(filtered.map(item => item.id)).toEqual(['sink_faucet', 'cabinets']);
  });
});

const COSMETIC =
  'Keep existing cabinets. Paint cabinets, replace cabinet hardware, and install a new tile backsplash 28 sqft. New quartz counters 40 sqft. Flooring by others. No cabinet demo.';

describe('kitchen measurement visibility from notes', () => {
  it('hides demo and floor cards when the note keeps cabinets and flooring is by others', () => {
    expect(kitchenNoteNamesSurfaceDemo(COSMETIC, 'cabinet')).toBe(false);
    expect(kitchenNoteNamesSurfaceDemo(COSMETIC, 'counter')).toBe(false);
    expect(kitchenNoteNamesSurfaceDemo(COSMETIC, 'backsplash')).toBe(false);
    expect(kitchenNoteNamesSurfaceDemo(COSMETIC, 'floor')).toBe(false);
    expect(kitchenNoteIncludesFloorWork(COSMETIC)).toBe(false);
    const filtered = filterDedicatedKitchenConfirmItems(
      [
        { id: 'cabinets', label: 'Stock cabinet supply & installation' },
        { id: 'cabinet_hardware', label: 'Cabinet hardware' },
        { id: 'cabinet_demo', label: 'Cabinet demo' },
        { id: 'countertops', label: 'Countertops' },
        { id: 'countertop_demo', label: 'Countertop demo' },
        { id: 'backsplash', label: 'Backsplash' },
        { id: 'backsplash_demo', label: 'Backsplash demo' },
        { id: 'flooring', label: 'Flooring installation' },
        { id: 'floor_demo', label: 'Floor demo' },
        { id: 'paint', label: 'Interior paint' },
        { id: 'trim', label: 'Trim & baseboard' },
        { id: 'hardware', label: 'Hardware / connectors' },
      ],
      { templateKey: 'kitchen', projectType: 'kitchen', notes: COSMETIC }
    );
    expect(filtered.map(item => item.id)).toEqual([
      'cabinet_hardware',
      'countertops',
      'backsplash',
      'cabinet_paint',
    ]);
  });

  it('adds a cabinet hardware card when the note names hardware and the checklist omitted it', () => {
    const filtered = filterDedicatedKitchenConfirmItems(
      [{ id: 'countertops', label: 'Countertops' }],
      { templateKey: 'kitchen', projectType: 'kitchen', notes: COSMETIC }
    );
    expect(filtered.map(item => item.id)).toContain('cabinet_hardware');
  });

  it('keeps named tear-out and a real floor for a gut kitchen', () => {
    expect(kitchenNoteNamesSurfaceDemo(GUT, 'cabinet')).toBe(true);
    expect(kitchenNoteNamesSurfaceDemo(GUT, 'counter')).toBe(true);
    expect(kitchenNoteNamesSurfaceDemo(GUT, 'backsplash')).toBe(true);
    expect(kitchenNoteNamesSurfaceDemo(GUT, 'floor')).toBe(true);
    expect(kitchenNoteIncludesFloorWork(GUT)).toBe(true);
  });

  it('prices demo to the studs from the entered wall area and leaves tub surround blank', () => {
    const notes =
      'Interior remodel of an existing 1,800 sqft ranch. Kitchen: demo to the studs, 16 LF cabinets, 48 sqft quartz counters, 22 sqft backsplash, new sink and faucet. Hall bath: 40 sqft floor tile, tub surround, 36-inch vanity, toilet, and paint.';
    const demoResolved = resolveChecklistItemQuantity(
      'wall_demo',
      { itemQuantities: {}, wallDemoSqft: '1200' },
      { templateKey: 'room_remodel', notes }
    );
    const demoPrice = resolveScopeItemSuggestedPricing(
      'wall_demo',
      { itemQuantities: {}, wallDemoSqft: '1200' },
      'room_remodel',
      demoResolved,
      null,
      null,
      notes
    );
    expect(demoResolved.quantity).toBe(1200);
    expect(demoResolved.unit).toBe('sqft');
    expect(demoPrice.fill?.total).toBe(1800);
    expect(demoPrice.fill?.material).toBe(300);
    expect(demoPrice.fill?.labor).toBe(1500);

    const surroundResolved = resolveChecklistItemQuantity(
      'tub_surround',
      { itemQuantities: {}, floorAreaSqft: 1800 },
      { templateKey: 'room_remodel', notes }
    );
    const surroundPrice = resolveScopeItemSuggestedPricing(
      'tub_surround',
      { itemQuantities: {}, floorAreaSqft: 1800 },
      'room_remodel',
      surroundResolved,
      null,
      null,
      notes
    );
    expect(surroundResolved.quantity == null || surroundResolved.quantity <= 0).toBe(
      true
    );
    expect(surroundPrice.fill).toBeNull();

    const entered = resolveChecklistItemQuantity(
      'tub_surround',
      {
        itemQuantities: {
          tub_surround: {
            quantity: 55,
            unit: 'sqft',
            quantitySource: 'user_entered',
          },
        },
      },
      { templateKey: 'room_remodel', notes }
    );
    const enteredPrice = resolveScopeItemSuggestedPricing(
      'tub_surround',
      {
        itemQuantities: {
          tub_surround: {
            quantity: 55,
            unit: 'sqft',
            quantitySource: 'user_entered',
          },
        },
      },
      'room_remodel',
      entered,
      null,
      null,
      notes
    );
    expect(entered.quantity).toBe(55);
    expect(enteredPrice.fill?.total).toBe(1430);
  });

  it('does not treat demo to the studs as cabinet removal', () => {
    const notes =
      'Interior remodel of an existing 1,800 sqft ranch. Kitchen: demo to the studs, 16 LF cabinets, 48 sqft quartz counters, 22 sqft backsplash, new sink and faucet.';
    expect(kitchenNoteNamesSurfaceDemo(notes, 'cabinet')).toBe(false);
    expect(kitchenNoteNamesSurfaceDemo(notes, 'counter')).toBe(false);
    expect(kitchenNoteNamesSurfaceDemo(notes, 'backsplash')).toBe(false);
  });

  it('keeps a cabinet and counter tear-out off the next kitchen chip', () => {
    const notes =
      'Kitchen remodel.\nRemove the cabinets and countertops, New cabinets, Tile backsplash, New flooring, New island';
    expect(kitchenNoteNamesSurfaceDemo(notes, 'cabinet')).toBe(true);
    expect(kitchenNoteNamesSurfaceDemo(notes, 'counter')).toBe(true);
    expect(kitchenNoteNamesSurfaceDemo(notes, 'backsplash')).toBe(false);
    expect(kitchenNoteNamesSurfaceDemo(notes, 'floor')).toBe(false);
    expect(kitchenNoteNamesSurfaceDemo(notes, 'island')).toBe(false);
  });

  it('keeps a new island install and adds haul-off without an island demo', () => {
    const notes =
      'Kitchen remodel. Demo existing cabinets and countertops. Install 18 LF perimeter cabinets and a new island with 22 sqft of quartz. Perimeter counters 36 sqft. Haul-off lump sum $650.';
    expect(kitchenNoteNamesSurfaceDemo(notes, 'island')).toBe(false);
    expect(kitchenNoteNamesSurfaceDemo(notes, 'cabinet')).toBe(true);
    expect(kitchenNoteNamesSurfaceDemo(notes, 'counter')).toBe(true);
    const filtered = filterDedicatedKitchenConfirmItems(
      [
        { id: 'island', label: 'Island set & anchor' },
        { id: 'island_demo', label: 'Island demo' },
        { id: 'cabinets', label: 'Cabinets' },
        { id: 'countertops', label: 'Countertops' },
      ],
      { templateKey: 'kitchen', projectType: 'kitchen', notes }
    );
    expect(filtered.map(item => item.id)).toEqual([
      'island',
      'cabinets',
      'countertops',
      'haul_off',
    ]);
  });

  it('reads a shorthand kitchen reno as kitchen confirm scope', () => {
    const notes =
      'Kitchen reno. Cabs 20 LF, tops 48 sqft, splash 35 sqft, LVP 160 sqft. Four can lights. Sink hookup. No prices yet.';
    expect(kitchenNoteNamesCabinetWork(notes)).toBe(true);
    expect(kitchenNoteNamesCounterWork(notes)).toBe(true);
    expect(kitchenNoteNamesBacksplash(notes)).toBe(true);
    expect(kitchenNoteNamesSurfaceDemo(notes, 'cabinet')).toBe(false);
    expect(kitchenNoteIncludesFloorWork(notes)).toBe(true);
    const filtered = filterDedicatedKitchenConfirmItems(
      kitchenConfirmScopeSeedItems(),
      { templateKey: 'kitchen', projectType: 'kitchen', notes }
    );
    expect(filtered.map(item => item.id)).toEqual([
      'cabinets',
      'countertops',
      'backsplash',
      'flooring',
      'lighting',
      'plumbing',
    ]);
    const withPricedCans = filterDedicatedKitchenConfirmItems(
      [
        ...kitchenConfirmScopeSeedItems(),
        {
          id: 'electrical_recessed_light',
          label: 'Recessed / canless / wafer light',
        },
      ],
      { templateKey: 'kitchen', projectType: 'kitchen', notes }
    );
    expect(withPricedCans.map(item => item.id)).toEqual([
      'cabinets',
      'countertops',
      'backsplash',
      'flooring',
      'plumbing',
      'electrical_recessed_light',
    ]);
    expect(
      withPricedCans.find(item => item.id === 'electrical_recessed_light')
        ?.label
    ).toBe('Can lights');
    const trades = groupScopeChecklistItems(withPricedCans, 'kitchen', {
      notes,
    }).find(group => group.title === 'Trades');
    expect(trades?.items.map(item => item.id)).toEqual([
      'plumbing',
      'electrical_recessed_light',
    ]);
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'flooring',
        projectTitle: 'Kitchen Renovation Estimate',
        estimateTier: 'simple_unit',
        originalNotes: notes,
        scopeChecklist: { templateKey: 'flooring', items: [] },
        scopePackages: [{ name: 'Kitchen' }],
        rooms: [],
        inclusions: [],
        exclusions: [],
        missingInfo: [],
        pricingWarnings: [],
        whatAiDid: ['Detected flooring job.'],
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    expect(repaired.projectType).toBe('kitchen');
    expect(repaired.estimateTier).toBe('room_remodel');
    expect(repaired.scopeChecklist?.templateKey).toBe('kitchen');
    expect(repaired.requiresScopeConfirmation).toBe(true);
    expect(repaired.whatAiDid).toEqual(['Detected kitchen remodel.']);
    expect(repaired.scopeMeasurements?.cabinetLf).toBe(20);
    expect(repaired.scopeMeasurements?.countertopSqft).toBe(48);
    expect(repaired.scopeMeasurements?.backsplashSqft).toBe(35);
    expect(repaired.scopeMeasurements?.kitchenFloorSqft).toBe(160);
    expect(repaired.scopeMeasurements?.recessedLightCount).toBe(4);
    expect(repaired.scopeMeasurements?.itemQuantities?.lighting).toMatchObject({
      quantity: 4,
      unit: 'each',
    });
    expect(repaired.stillNeededReview).toEqual([]);
    expect(getInitialRevealUnderstoodBullets(repaired, 6)).toEqual([
      'Cabinets',
      'Countertops',
      'Backsplash',
      'Kitchen flooring',
      'Can lights',
      'Sink hookup',
    ]);
    expect(getInitialRevealConfirmItems(repaired).pricingScope).toEqual([
      'Price needed for Cabinets',
      'Price needed for Countertops',
      'Price needed for Backsplash',
      'Price needed for Kitchen flooring',
      'Price needed for Can lights',
      'Price needed for Sink hookup',
    ]);
  });

  it('files cabinets, quartz, backsplash, and LVP as a kitchen and prices the selected demos from those quantities', () => {
    const notes =
      'New cabinets 22 LF, quartz countertops 55 sqft, backsplash 30 sqft, new LVP 300 sqft.';
    expect(notesNameBathroomAssembly(notes)).toBe(false);
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'bathroom',
        projectTitle: 'Bathroom',
        estimateTier: 'room_remodel',
        originalNotes: notes,
        whatAiDid: ['Detected bathroom work.'],
        scopeChecklist: {
          templateKey: 'bathroom',
          items: [
            {
              id: 'countertops',
              label: 'Vanity top',
              state: 'included',
              inputType: 'yes_no',
            },
          ],
        },
        scopeMeasurements: {},
      } as Parameters<typeof repairDraftRatePricingFromNotes>[0],
      notes
    );
    expect(repaired.projectType).toBe('kitchen');
    expect(repaired.scopeChecklist?.templateKey).toBe('kitchen');
    expect(repaired.whatAiDid).toEqual(['Detected kitchen remodel.']);
    expect(repaired.scopeMeasurements?.cabinetLf).toBe(22);
    expect(repaired.scopeMeasurements?.countertopSqft).toBe(55);
    expect(repaired.scopeMeasurements?.backsplashSqft).toBe(30);
    expect(repaired.scopeMeasurements?.kitchenFloorSqft).toBe(300);
    const filtered = filterDedicatedKitchenConfirmItems(
      repaired.scopeChecklist?.items || [],
      { notes, templateKey: 'kitchen', projectType: 'kitchen' }
    );
    expect(filtered.map(item => item.id)).toEqual([
      'cabinets',
      'countertops',
      'backsplash',
      'flooring',
    ]);
    expect(filtered.find(item => item.id === 'flooring')?.label).toBe(
      'LVP flooring'
    );
    expect(filtered.find(item => item.id === 'countertops')?.label).toBe(
      'Countertops'
    );
    const chosen = measurementsForScopeFoundChoice(
      repaired.scopeMeasurements as Record<string, unknown>,
      'kitchen_demo',
      ['cabinets', 'countertops', 'backsplash', 'kitchen_floor'],
      notes
    );
    const items = applyStep2NoteScopeFilters(
      repaired.scopeChecklist?.items || [],
      { ...repaired, scopeMeasurements: chosen } as Parameters<
        typeof applyStep2NoteScopeFilters
      >[1],
      chosen,
      'kitchen'
    );
    expect(items.map(item => item.id)).toEqual(
      expect.arrayContaining([
        'cabinets',
        'countertops',
        'backsplash',
        'flooring',
        'cabinet_demo',
        'countertop_demo',
        'backsplash_demo',
        'floor_demo',
      ])
    );
    const price = (id: string) => {
      const resolved = resolveChecklistItemQuantity(id, chosen, {
        templateKey: 'kitchen',
        notes,
      });
      const fill = resolveScopeItemSuggestedPricing(
        id,
        chosen,
        'kitchen',
        resolved,
        null,
        null,
        notes
      ).fill;
      return {
        quantity: resolved.quantity,
        unit: resolved.unit,
        material: fill?.material,
        labor: fill?.labor,
        total: fill?.total,
      };
    };
    expect(price('cabinet_demo')).toMatchObject({
      quantity: 22,
      unit: 'lf',
      total: 550,
    });
    expect(price('countertop_demo')).toMatchObject({
      quantity: 55,
      unit: 'sqft',
      total: 302.5,
    });
    expect(price('backsplash_demo')).toMatchObject({
      quantity: 30,
      unit: 'sqft',
      total: 225,
    });
    expect(price('floor_demo')).toMatchObject({
      quantity: 300,
      unit: 'sqft',
      total: 1650,
    });
    expect(price('cabinets')).toMatchObject({
      quantity: 22,
      unit: 'lf',
      total: 5845.18,
    });
    expect(price('countertops')).toMatchObject({
      quantity: 55,
      unit: 'sqft',
      total: 3300,
    });
    expect(price('backsplash')).toMatchObject({
      quantity: 30,
      unit: 'sqft',
      total: 750,
    });
    expect(price('flooring')).toMatchObject({
      quantity: 300,
      unit: 'sqft',
      total: 2100,
    });
  });

  it('treats floor tile and LVP as floor work and ignores a tile backsplash', () => {
    expect(kitchenNoteIncludesFloorWork('Install kitchen floor tile 50 sqft.')).toBe(true);
    expect(kitchenNoteIncludesFloorWork('New LVP flooring 180 sqft.')).toBe(true);
    expect(
      kitchenNoteIncludesFloorWork('Install a new tile backsplash 28 sqft.')
    ).toBe(false);
  });
});
