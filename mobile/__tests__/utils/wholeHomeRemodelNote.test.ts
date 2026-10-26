import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import {
  scopePackageNeedsManualPrice,
  scopePackagePricedAmount,
} from '@/utils/estimateDraftReviewUi';
import { getInitialRevealUnderstoodBullets } from '@/utils/estimateInitialRevealUi';
import {
  applyStep2NoteScopeFilters,
  reconcileScopePackagesForReview,
} from '@/utils/scopePackagesForReview';
import { syncElectricalScopeItems } from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import {
  emptyQuickMeasurementInput,
  quickMeasurementRowsForInput,
} from '@/utils/scopeQuickMeasurements';
import {
  resolveChecklistItemQuantity,
  resolveScopeItemSuggestedPricing,
} from '@/utils/scopeItemQuantities';
import { wholeProjectGroupDisplayTotal } from '@/utils/benchmarkReasonablenessContext';
import { bucketWholeProjectScopeGroups } from '@/utils/estimateScopeChecklistUi';
import { parsePlumbingMeasurementsFromNotes } from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import {
  getInitialRevealChecklistScopePreview,
  getInitialRevealConfirmItems,
} from '@/utils/estimateInitialRevealUi';
import { kitchenNoteIncludesFloorWork } from '@/utils/kitchenNoteScope';
import {
  applyWholeHomeRemodelChecklist,
  includeEnteredRemodelCards,
  notesDescribeMeasuredWholeHomeRemodel,
  notesNameBathroomRemodelPanel,
  notesNameKitchenRemodelPanel,
  notesNameOwnerSuppliedAppliances,
  notesOpeningMentionIsKeepOnly,
  notesStateFlooringArea,
  scrubWholeHomeRemodelMeasurements,
  statedWholeHomeSizeSqft,
  wholeHomeRemodelSuppressesInventedPrice,
} from '@/utils/wholeHomeRemodelNote';

const THIN_HOME_NOTES =
  'Remodel a 1,800 sqft home. Install 1,200 sqft of flooring, repair 400 sqft of drywall, and paint the interior.';

const WHOLE_HOME_NOTES =
  'Remodel a 2,400 sqft home with demolition and removal of existing cabinets, fixtures, flooring, drywall, and finishes as needed; kitchen and bathroom updates, 1,800 sqft flooring, 500 sqft drywall repair, six windows, two exterior doors, four interior doors, wall and attic insulation, air sealing, trim, plumbing, electrical, and interior paint.';

describe('whole-home remodel note authority', () => {
  it('prices only the flooring this note measured', () => {
    const notes =
      'Whole house remodel. The house is 2,400 sqft. Kitchen and bathroom updates, 1,800 sqft flooring, and paint the interior. Keep the windows and doors.';
    const measurements = {
      ...emptyQuickMeasurementInput(),
      flooringSqft: '1800',
      floorAreaSqft: '2400',
      itemQuantities: {},
    };
    const items = [
      {
        id: 'flooring',
        label: 'Flooring installation',
        state: 'included' as const,
        inputType: 'yes_no' as const,
      },
      {
        id: 'interior_paint',
        label: 'Interior paint',
        state: 'included' as const,
        inputType: 'yes_no' as const,
      },
      {
        id: 'kitchen_updates',
        label: 'Kitchen updates',
        state: 'included' as const,
        inputType: 'yes_no' as const,
      },
      {
        id: 'bathroom_updates',
        label: 'Bathroom updates',
        state: 'included' as const,
        inputType: 'yes_no' as const,
      },
    ];
    const priceFor = (id: string) => {
      const resolved = resolveChecklistItemQuantity(
        id,
        measurements as never,
        { templateKey: 'room_remodel', notes }
      );
      return resolveScopeItemSuggestedPricing(
        id,
        measurements as never,
        'room_remodel',
        resolved,
        { checklistItems: items },
        null,
        notes
      ).fill?.total;
    };
    expect(priceFor('flooring')).toBe(15426);
    expect(priceFor('interior_paint')).toBeUndefined();
    expect(priceFor('kitchen_updates')).toBeUndefined();
    expect(priceFor('bathroom_updates')).toBeUndefined();
    expect(priceFor('shower_tile')).toBeUndefined();
    expect(
      wholeHomeRemodelSuppressesInventedPrice('shower_tile', notes, measurements)
    ).toBe(true);
    const withUnnamedLump = [
      ...items,
      {
        id: 'shower_tile',
        label: 'Shower wall tile installation',
        state: 'included' as const,
        inputType: 'yes_no' as const,
      },
    ];
    expect(
      wholeProjectGroupDisplayTotal({
        items: withUnnamedLump,
        measurements: measurements as never,
        templateKey: 'room_remodel',
        notes,
      })
    ).toBe(15426);
    expect(
      wholeProjectGroupDisplayTotal({
        items,
        measurements: measurements as never,
        templateKey: 'room_remodel',
        notes,
      })
    ).toBe(15426);
    expect(
      resolveChecklistItemQuantity('kitchen_updates', measurements as never, {
        templateKey: 'room_remodel',
        notes,
      }).unit
    ).toBe('allowance');
  });

  it('recognizes a whole-house remodel when the size is not written as sqft home', () => {
    const notes =
      'Whole house remodel. The house is 2,400 sqft. Kitchen and bathroom updates, 1,800 sqft flooring, and paint the interior.';
    expect(notesDescribeMeasuredWholeHomeRemodel(notes)).toBe(true);
    expect(notesNameKitchenRemodelPanel(notes)).toBe(true);
    expect(notesNameBathroomRemodelPanel(notes)).toBe(true);
    const entered = applyWholeHomeRemodelChecklist(
      [{ id: 'flooring', label: 'Flooring installation', state: 'included' }],
      notes,
      {
        cabinetLf: '25',
        countertopSqft: '5',
        backsplashSqft: '25',
        bathroomVanityCabinetLf: '8',
        bathroomInstallVanityCount: 1,
        bathroomInstallToiletCount: 1,
      }
    );
    expect(entered.find(item => item.id === 'cabinets')?.state).toBe('included');
    expect(entered.find(item => item.id === 'countertops')?.state).toBe(
      'included'
    );
    expect(entered.find(item => item.id === 'backsplash')?.state).toBe(
      'included'
    );
    expect(entered.find(item => item.id === 'vanity')?.state).toBe('included');
    expect(entered.find(item => item.id === 'toilet')?.state).toBe('included');
    const vanityLengthOnly = includeEnteredRemodelCards(
      [{ id: 'flooring', label: 'Flooring installation', state: 'included' }],
      { bathroomVanityCabinetLf: '8' }
    );
    expect(vanityLengthOnly.some(item => item.id === 'cabinets')).toBe(false);
    expect(
      notesNameBathroomRemodelPanel(
        'Guest bath remodel. Remove the tub and demo the old bathroom floor tile. Put in a tiled shower with shower wall tile and shower floor tile. Tile the bathroom floor. New vanity with a countertop. Replace the window. Insulation in the walls. New toilet. No paint.'
      )
    ).toBe(false);
    expect(
      notesNameKitchenRemodelPanel(
        'Kitchen remodel. Install 20 LF of cabinets and 40 sqft of counters.'
      )
    ).toBe(false);
    expect(notesDescribeMeasuredWholeHomeRemodel(WHOLE_HOME_NOTES)).toBe(true);
    expect(
      notesDescribeMeasuredWholeHomeRemodel(
        'Remodel the bathroom. The house is 2,400 sqft. Tile the shower.'
      )
    ).toBe(false);
    expect(
      notesDescribeMeasuredWholeHomeRemodel(
        'Whole house remodel. Install 1,200 sqft of flooring and paint the interior.'
      )
    ).toBe(false);

    const items = applyWholeHomeRemodelChecklist(
      [
        { id: 'flooring', label: 'Flooring installation', state: 'included' },
        { id: 'paint', label: 'Interior paint', state: 'included' },
        { id: 'wall_framing', label: 'Wall framing', state: 'included' },
      ],
      notes
    );
    expect(items.find(item => item.id === 'flooring')?.state).toBe('included');
    expect(items.find(item => item.id === 'paint')?.state).toBe('included');
    expect(items.find(item => item.id === 'wall_framing')?.state).toBe(
      'excluded'
    );

    const scrubbed = scrubWholeHomeRemodelMeasurements(
      { floorDemoSqft: 2400, flooringSqft: 1800, kitchenFloorSqft: 1800 },
      notes
    );
    expect(scrubbed.floorDemoSqft).toBeUndefined();
    expect(scrubbed.kitchenFloorSqft).toBeUndefined();
    expect(scrubbed.flooringSqft).toBe(1800);
  });

  it('keeps windows and doors out of the scope and off the kitchen floor', () => {
    const notes =
      'Whole house remodel. The house is 2,400 sqft. Kitchen and bathroom updates, 1,800 sqft flooring, and paint the interior. Keep the windows and doors.';
    expect(notesOpeningMentionIsKeepOnly(notes, 'windows')).toBe(true);
    expect(notesOpeningMentionIsKeepOnly(notes, 'doors')).toBe(true);
    expect(kitchenNoteIncludesFloorWork(notes)).toBe(false);
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'room_remodel',
      projectType: 'other',
    });
    expect(parsed.flooringSqft).toBe(1800);
    expect(parsed.kitchenFloorSqft).toBeUndefined();
    expect(parsed.paintAreaSqft).toBeUndefined();

    const preview = getInitialRevealChecklistScopePreview({
      originalNotes: notes,
      projectType: 'other',
      scopeMode: 'mixed',
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          { id: 'flooring', label: 'Flooring installation', state: 'included' },
          { id: 'interior_paint', label: 'Interior paint', state: 'included' },
          { id: 'window_install', label: 'Window install', state: 'included' },
          {
            id: 'interior_door_install',
            label: 'Interior door installation',
            state: 'included',
          },
        ],
      },
    } as EstimateAiDraft);
    const names = preview.map(row => row.name);
    expect(names).toContain('Flooring installation');
    expect(names).toContain('Interior paint');
    expect(names).toContain('Kitchen updates');
    expect(names).toContain('Bathroom updates');
    expect(names).not.toContain('Window install');
    expect(names).not.toContain('Interior door installation');
    const attention = getInitialRevealConfirmItems({
      originalNotes: notes,
      projectType: 'other',
      scopeMode: 'mixed',
      estimateTier: 'room_remodel',
      requiresScopeConfirmation: true,
      scopeChecklist: {
        templateKey: 'room_remodel',
        items: [
          { id: 'flooring', label: 'Flooring installation', state: 'included' },
          { id: 'interior_paint', label: 'Interior paint', state: 'included' },
          { id: 'window_install', label: 'Window install', state: 'included' },
        ],
      },
    } as EstimateAiDraft).pricingScope;
    expect(attention.join(' ')).not.toMatch(/window/i);
    expect(attention.join(' ')).toMatch(/Kitchen updates/);
    expect(attention.join(' ')).toMatch(/Bathroom updates/);

    const confirmItems = applyStep2NoteScopeFilters(
      [
        { id: 'flooring', label: 'Flooring installation', state: 'included' },
        { id: 'interior_paint', label: 'Interior paint', state: 'included' },
        { id: 'window_install', label: 'Window install', state: 'included' },
        {
          id: 'interior_door_install',
          label: 'Interior door installation',
          state: 'included',
        },
      ],
      {
        originalNotes: notes,
        projectType: 'other',
        scopeMode: 'mixed',
        scopeChecklist: { templateKey: 'room_remodel', items: [] },
      } as EstimateAiDraft,
      {},
      'room_remodel'
    );
    const confirmIds = confirmItems
      .filter(item => item.state === 'included')
      .map(item => item.id);
    expect(confirmIds).toContain('flooring');
    expect(confirmIds).toContain('interior_paint');
    expect(confirmIds).not.toContain('window_install');
    expect(confirmIds).not.toContain('interior_door_install');
    const withRooms = applyWholeHomeRemodelChecklist(
      [
        { id: 'flooring', label: 'Flooring installation', state: 'included' },
        { id: 'interior_paint', label: 'Interior paint', state: 'included' },
      ],
      notes
    )
      .filter(item => item.state === 'included')
      .map(item => item.id);
    expect(withRooms).toEqual(
      expect.arrayContaining([
        'flooring',
        'interior_paint',
        'kitchen_updates',
        'bathroom_updates',
      ])
    );
    const interior = bucketWholeProjectScopeGroups([
      {
        title: 'Scope',
        items: [
          {
            id: 'flooring',
            label: 'Flooring installation',
            inputType: 'yes_no',
            state: 'included',
          },
          {
            id: 'interior_paint',
            label: 'Interior paint',
            inputType: 'yes_no',
            state: 'included',
          },
          {
            id: 'kitchen_updates',
            label: 'Kitchen updates',
            inputType: 'yes_no',
            state: 'included',
          },
          {
            id: 'bathroom_updates',
            label: 'Bathroom updates',
            inputType: 'yes_no',
            state: 'included',
          },
        ],
      },
    ]).find(group => group.title === 'Interior finishes');
    expect(interior?.items.map(item => item.id)).toEqual(
      expect.arrayContaining([
        'flooring',
        'interior_paint',
        'kitchen_updates',
        'bathroom_updates',
      ])
    );
  });

  it('keeps named work and drops the borrowed kitchen floor, house-size demo, and extra paint', () => {
    const repaired = repairDraftRatePricingFromNotes(
      {
        projectType: 'other',
        originalNotes: WHOLE_HOME_NOTES,
        scopeChecklist: {
          templateKey: 'room_remodel',
          items: [
            { id: 'flooring', label: 'Flooring installation', state: 'included' },
            { id: 'drywall', label: 'Drywall repair', state: 'included' },
            {
              id: 'plumbing',
              label: 'Plumbing fixture updates',
              state: 'included',
            },
            { id: 'door_paint', label: 'Interior door painting', state: 'included' },
            {
              id: 'trim_paint',
              label: 'Baseboard and trim painting',
              state: 'included',
            },
            { id: 'wall_framing', label: 'Wall framing', state: 'included' },
            { id: 'electrical', label: 'Electrical', state: 'included' },
          ],
        },
        scopeMeasurements: {
          flooringSqft: 1800,
          kitchenFloorSqft: 1800,
          floorDemoSqft: 2400,
          floorAreaSqft: 2400,
          wallFramingSqft: '',
        },
      } as never,
      WHOLE_HOME_NOTES
    );

    expect(repaired.scopeChecklist?.templateKey).not.toBe('bathroom');
    expect(repaired.projectType).not.toBe('bathroom');
    expect(repaired.scopeMeasurements?.kitchenFloorSqft).toBeFalsy();
    expect(repaired.scopeMeasurements?.floorDemoSqft).toBeFalsy();
    expect(Number(repaired.scopeMeasurements?.flooringSqft)).toBe(1800);
    const included = applyWholeHomeRemodelChecklist(
      [
        { id: 'flooring', label: 'Flooring installation', state: 'included' },
        {
          id: 'plumbing',
          label: 'Plumbing fixture updates',
          state: 'included',
        },
        { id: 'door_paint', label: 'Interior door painting', state: 'included' },
        {
          id: 'trim_paint',
          label: 'Baseboard and trim painting',
          state: 'included',
        },
        { id: 'wall_framing', label: 'Wall framing', state: 'included' },
        { id: 'electrical', label: 'Electrical', state: 'included' },
      ],
      WHOLE_HOME_NOTES
    ).filter(item => item.state === 'included');
    const ids = included.map(item => item.id);
    expect(ids).toEqual(expect.arrayContaining(['flooring', 'plumbing', 'fixture_demo']));
    expect(ids).not.toEqual(expect.arrayContaining(['door_paint', 'trim_paint', 'wall_framing']));
    expect(included.find(item => item.id === 'plumbing')?.label).toBe('Plumbing');
  });

  it('keeps the confirm list on the named lines', () => {
    const included = applyWholeHomeRemodelChecklist(
      [
        { id: 'framing', label: 'Framing', state: 'included' },
        { id: 'plans_engineering', label: 'Plans', state: 'included' },
        { id: 'permits', label: 'Permits', state: 'included' },
        { id: 'hvac', label: 'HVAC', state: 'included' },
        { id: 'door_paint', label: 'Interior door painting', state: 'included' },
        { id: 'trim_paint', label: 'Baseboard and trim painting', state: 'included' },
        { id: 'windows', label: 'Windows', state: 'included' },
        { id: 'window_install', label: 'Window install', state: 'included' },
        { id: 'flooring', label: 'Flooring', state: 'included' },
        { id: 'drywall', label: 'Drywall', state: 'included' },
        { id: 'patch_repair', label: 'Patch', state: 'included' },
        { id: 'paint', label: 'Interior paint', state: 'included' },
        { id: 'interior_paint', label: 'Interior paint', state: 'included' },
        { id: 'trim', label: 'Trim', state: 'included' },
        { id: 'plumbing', label: 'Plumbing fixture updates', state: 'included' },
        { id: 'electrical', label: 'Electrical', state: 'included' },
        {
          id: 'trim_finish',
          inputType: 'choice',
          choiceId: 'interior_paint_grade',
          state: 'included',
        },
      ],
      WHOLE_HOME_NOTES
    ).filter(item => item.state === 'included' && item.choiceId !== 'not_in_scope');
    const ids = included.map(item => item.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'flooring',
        'drywall',
        'windows',
        'cabinet_demo',
        'fixture_demo',
        'floor_demo',
        'insulation',
        'trim',
        'plumbing',
        'electrical',
        'paint',
      ])
    );
    expect(ids).not.toEqual(expect.arrayContaining(['air_sealing']));
    expect(ids).not.toEqual(
      expect.arrayContaining([
        'framing',
        'plans_engineering',
        'permits',
        'hvac',
        'door_paint',
        'trim_paint',
        'window_install',
        'patch_repair',
        'interior_paint',
        'trim_finish',
      ])
    );
    expect(included.find(item => item.id === 'insulation')?.label).toBe(
      'Wall & attic insulation'
    );
  });

  it('does not invent a cabinet length, plumbing connection, or insulation area', () => {
    expect(
      wholeHomeRemodelSuppressesInventedPrice('cabinet_demo', WHOLE_HOME_NOTES, {})
    ).toBe(true);
    expect(
      wholeHomeRemodelSuppressesInventedPrice('plumbing', WHOLE_HOME_NOTES, {})
    ).toBe(true);
    expect(
      wholeHomeRemodelSuppressesInventedPrice('insulation', WHOLE_HOME_NOTES, {})
    ).toBe(true);
    expect(
      wholeHomeRemodelSuppressesInventedPrice('cabinet_demo', WHOLE_HOME_NOTES, {
        cabinetLf: 40,
      })
    ).toBe(false);
    expect(
      wholeHomeRemodelSuppressesInventedPrice('flooring', WHOLE_HOME_NOTES, {})
    ).toBe(false);
  });

  it('prices stated flooring and drywall and leaves unnamed quantities blank', () => {
    const {
      resolveChecklistItemQuantity,
      resolveScopeItemSuggestedPricing,
    } = require('@/utils/scopeItemQuantities') as typeof import('@/utils/scopeItemQuantities');
    const measurements = {
      floorAreaSqft: '2400',
      flooringSqft: '1800',
      drywallSqft: '500',
      floorDemoSqft: '2000',
      wallPaintSqft: '1000',
      itemQuantities: {
        floor_demo: { quantity: 2000, unit: 'sqft', quantitySource: 'user_entered' },
        paint: { quantity: 1000, unit: 'sqft', quantitySource: 'user_entered' },
      },
    };
    const price = (itemId: string) => {
      const resolved = resolveChecklistItemQuantity(itemId, measurements as never, {
        templateKey: 'ground_up',
        originalNotes: WHOLE_HOME_NOTES,
      });
      return resolveScopeItemSuggestedPricing(
        itemId,
        measurements as never,
        'ground_up',
        resolved,
        null,
        null,
        WHOLE_HOME_NOTES
      );
    };

    const flooring = price('flooring').fill;
    const drywall = price('drywall').fill;
    const floorDemo = price('floor_demo').fill;
    const paint = price('paint').fill;
    const airSealing = price('air_sealing').fill;
    expect({
      flooringQty: flooring?.basis?.quantity,
      flooringTotal: flooring?.total,
      drywallQty: drywall?.basis?.quantity,
      drywallTotal: drywall?.total,
      cabinet: price('cabinet_demo').fill,
      plumbing: price('plumbing').fill,
      insulation: price('insulation').fill,
      floorDemoQty: floorDemo?.basis?.quantity,
      floorDemoTotal: floorDemo?.total,
      paintQty: paint?.basis?.quantity,
      paintTotal: paint?.total,
      airSealingTotal: airSealing?.total,
    }).toEqual({
      flooringQty: 1800,
      flooringTotal: 15426,
      drywallQty: 500,
      drywallTotal: 815,
      cabinet: null,
      plumbing: null,
      insulation: null,
      floorDemoQty: 2000,
      floorDemoTotal: 11000,
      paintQty: 1000,
      paintTotal: 3350,
      airSealingTotal: 1200,
    });
  });

  it('does not price flooring removal from the new flooring area', () => {
    const parsed = parseScopeMeasurementsFromNotes(THIN_HOME_NOTES, {
      templateKey: 'room_remodel',
      projectType: 'other',
    });
    expect(parsed.flooringSqft).toBe(1200);
    expect(parsed.floorAreaSqft).toBe(1800);
    expect(parsed.floorDemoSqft).toBeUndefined();
    expect(parsed.drywallSqft).toBe(400);

    const checklist = applyWholeHomeRemodelChecklist(
      [
        { id: 'flooring', label: 'Flooring installation', state: 'included' },
        { id: 'floor_demo', label: 'Flooring removal', state: 'included' },
        { id: 'drywall', label: 'Drywall repair', state: 'included' },
        { id: 'paint', label: 'Interior paint', state: 'included' },
      ],
      THIN_HOME_NOTES
    );
    expect(checklist.find(item => item.id === 'floor_demo')?.state).toBe(
      'excluded'
    );
    expect(checklist.find(item => item.id === 'flooring')?.state).toBe(
      'included'
    );

    const scrubbed = scrubWholeHomeRemodelMeasurements(
      { floorDemoSqft: '1200', flooringSqft: '1200', floorAreaSqft: '1800' },
      THIN_HOME_NOTES
    );
    expect(scrubbed.floorDemoSqft).toBeUndefined();
    expect(
      wholeHomeRemodelSuppressesInventedPrice('floor_demo', THIN_HOME_NOTES, {
        flooringSqft: '1200',
        floorAreaSqft: '1800',
      })
    ).toBe(true);

    const {
      resolveChecklistItemQuantity,
      resolveScopeItemSuggestedPricing,
    } = require('@/utils/scopeItemQuantities') as typeof import('@/utils/scopeItemQuantities');
    const measurements = {
      floorAreaSqft: '1200',
      flooringSqft: '1200',
      drywallSqft: '400',
      floorDemoSqft: '1200',
    };
    const resolved = resolveChecklistItemQuantity(
      'floor_demo',
      measurements as never,
      {
        templateKey: 'room_remodel',
        originalNotes: THIN_HOME_NOTES,
      }
    );
    const priced = resolveScopeItemSuggestedPricing(
      'floor_demo',
      measurements as never,
      'room_remodel',
      resolved,
      null,
      null,
      THIN_HOME_NOTES
    );
    expect(priced.fill).toBeNull();
  });

  it('does not invent a cabinet length or house-size flooring removal', () => {
    const {
      resolveChecklistItemQuantity,
      resolveScopeItemSuggestedPricing,
    } = require('@/utils/scopeItemQuantities') as typeof import('@/utils/scopeItemQuantities');
    const measurements = { floorAreaSqft: '2400' };
    const cabinet = resolveChecklistItemQuantity(
      'cabinet_demo',
      measurements as never,
      { templateKey: 'room_remodel', notes: WHOLE_HOME_NOTES }
    );
    const floorDemo = resolveChecklistItemQuantity(
      'floor_demo',
      measurements as never,
      { templateKey: 'room_remodel', notes: WHOLE_HOME_NOTES }
    );
    const price = (itemId: string, resolved: typeof cabinet) =>
      resolveScopeItemSuggestedPricing(
        itemId,
        measurements as never,
        'room_remodel',
        resolved,
        null,
        null,
        WHOLE_HOME_NOTES
      );
    expect(cabinet.quantity).toBeNull();
    expect(price('cabinet_demo', cabinet).fill).toBeNull();
    expect(floorDemo.quantity).toBeNull();
    expect(price('floor_demo', floorDemo).fill).toBeNull();

    const measured = resolveChecklistItemQuantity(
      'cabinet_demo',
      { ...measurements, cabinetDemoLf: '22' } as never,
      { templateKey: 'room_remodel', notes: WHOLE_HOME_NOTES }
    );
    expect(measured.quantity).toBe(22);
    expect(
      resolveScopeItemSuggestedPricing(
        'cabinet_demo',
        { ...measurements, cabinetDemoLf: '22' } as never,
        'room_remodel',
        measured,
        null,
        null,
        WHOLE_HOME_NOTES
      ).fill?.total
    ).toBe(550);

    const typed = {
      floorAreaSqft: '2400',
      baseboardLf: '100',
      exteriorWallInsulationSqft: '1000',
      atticInsulationSqft: '800',
      plumbingRoughPointCount: '4',
      standardReceptacleCount: '2',
      gfciReceptacleCount: '1',
    };
    const priced = (itemId: string) => {
      const resolved = resolveChecklistItemQuantity(itemId, typed as never, {
        templateKey: 'room_remodel',
        notes: WHOLE_HOME_NOTES,
      });
      return resolveScopeItemSuggestedPricing(
        itemId,
        typed as never,
        'room_remodel',
        resolved,
        null,
        null,
        WHOLE_HOME_NOTES
      ).fill?.total;
    };
    expect(priced('trim')).toBe(850);
    expect(priced('insulation')).toBe(5400);
    expect(priced('plumbing')).toBe(1200);
    expect(priced('electrical')).toBe(295);
  });

  it('binds kitchen and bath quantities to the trade they describe', () => {
    const notes =
      'Remodel a 2,200 sqft home. In the kitchen, remove 22 linear feet of existing cabinets and install 28 linear feet of new cabinets, 42 sqft of quartz countertops, 18 sqft of backsplash, and 160 sqft of kitchen flooring. Update two bathrooms: tile 90 sqft of shower walls in the primary bath and 40 sqft of floor tile in the hall bath, and replace both vanities. Repair 250 sqft of drywall. Paint the interior.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'room_remodel',
      projectType: 'other',
    });
    expect(parsed.cabinetDemoLf).toBe(22);
    expect(parsed.cabinetLf).toBe(28);
    expect(parsed.countertopSqft).toBe(42);
    expect(parsed.backsplashSqft).toBe(18);
    expect(parsed.kitchenFloorSqft).toBe(160);
    expect(parsed.showerWallTileSqft).toBe(90);
    expect(parsed.bathroomFloorSqft).toBe(40);
    expect(parsed.drywallSqft).toBe(250);
    expect(parsed.wallPaintSqft).toBeUndefined();
    expect(parsed.floorDemoSqft).toBeUndefined();
    expect(parsed.itemQuantities?.vanity?.quantity).toBe(2);
    expect(parsed.itemQuantities?.cabinet_demo?.quantity).toBe(22);
    expect(parsed.itemQuantities?.cabinets?.quantity).toBe(28);

    const included = applyWholeHomeRemodelChecklist(
      [
        { id: 'floor_demo', label: 'Flooring removal', state: 'included' },
        { id: 'flooring', label: 'Tile flooring install', state: 'included' },
        { id: 'drywall', label: 'Drywall repair', state: 'included' },
        { id: 'cabinets', label: 'Cabinets', state: 'excluded' },
        { id: 'paint', label: 'Interior paint', state: 'included' },
      ],
      notes
    ).filter(item => item.state === 'included');
    const ids = included.map(item => item.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'cabinet_demo',
        'cabinets',
        'countertops',
        'backsplash',
        'shower_tile',
        'floor_tile',
        'vanity',
        'flooring',
        'drywall',
        'paint',
      ])
    );
    expect(ids).not.toContain('floor_demo');
    expect(
      wholeHomeRemodelSuppressesInventedPrice('paint', notes, {
        floorAreaSqft: 2200,
        wallPaintSqft: 90,
      })
    ).toBe(true);
    expect(
      wholeHomeRemodelSuppressesInventedPrice('cabinet_demo', notes, {
        cabinetLf: 28,
        cabinetDemoLf: 22,
      })
    ).toBe(false);

    const scrubbed = scrubWholeHomeRemodelMeasurements(
      { wallPaintSqft: 90, showerWallTileSqft: 90, floorDemoSqft: 160 },
      notes
    );
    expect(scrubbed.wallPaintSqft).toBeUndefined();
    expect(scrubbed.floorDemoSqft).toBeUndefined();
    expect(scrubbed.showerWallTileSqft).toBe(90);
  });

  it('keeps whole-home outlets on the electrical line instead of unpriced device rows', () => {
    const next = syncElectricalScopeItems(
      [{ id: 'electrical', label: 'Electrical work', state: 'included' }],
      {
        templateKey: 'room_remodel',
        notes: WHOLE_HOME_NOTES,
        quantities: {
          standardReceptacleCount: 5,
          gfciReceptacleCount: 5,
          dedicated20aCircuitCount: 10,
        },
      }
    );
    const ids = next.map(item => item.id);
    expect(ids).toContain('electrical');
    expect(ids).not.toContain('electrical_standard_receptacle');
    expect(ids).not.toContain('electrical_gfci_receptacle');
    expect(ids).not.toContain('electrical_dedicated_20a');
  });

  it('keeps an unapplied card as price needed and shows a card that was applied', () => {
    const draft = {
      originalNotes: WHOLE_HOME_NOTES,
      scopeAssumptionsConfirmed: true,
      scopeChecklist: { templateKey: 'room_remodel' },
      scopeMeasurements: {
        itemQuantities: {
          electrical__material: {
            quantity: '1975',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          electrical__labor: {
            quantity: '6575',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
        pricingAcceptance: {
          electrical: {
            selectionStatus: 'accepted',
            totalAmount: 8550,
            materialAmount: 1975,
            laborAmount: 6575,
          },
        },
      },
      scopePackages: [
        {
          name: 'Fixture removal',
          checklistItemId: 'fixture_demo',
          status: 'missing_price',
          price: null,
          scopeQuantities: [{ quantity: 1, unit: 'lump_sum' }],
        },
        {
          name: 'Electrical work',
          checklistItemId: 'electrical',
          status: 'confirmed',
          price: 8550,
        },
      ],
      whatAiDid: [
        'Detected existing home interior remodel job.',
        'Organized Fixture removal: 1 lump_sum — pricing needed.',
      ],
    } as unknown as EstimateAiDraft;
    const packages = reconcileScopePackagesForReview(draft, [
      { id: 'electrical', label: 'Electrical work', state: 'included' },
      { id: 'fixture_demo', label: 'Fixture removal', state: 'included' },
    ]);
    const fixture = packages.find(pkg => pkg.checklistItemId === 'fixture_demo');
    const electrical = packages.find(pkg => pkg.checklistItemId === 'electrical');
    expect(fixture).toBeTruthy();
    expect(scopePackageNeedsManualPrice(fixture!, draft)).toBe(true);
    expect(scopePackagePricedAmount(electrical!, draft)).toBe(8550);
    expect(scopePackageNeedsManualPrice(electrical!, draft)).toBe(false);
    expect(getInitialRevealUnderstoodBullets(draft, 4).join(' ')).not.toMatch(
      /pricing needed/i
    );
  });

  it('binds stated remodel quantities instead of the house size', () => {
    const notes =
      'Remodel a 1,650 sqft home. Kitchen and two bathroom updates. Remove 18 linear feet of existing cabinets and install 24 linear feet of new cabinets. Remove 900 sqft of existing flooring and install 1,100 sqft of flooring. Repair 320 sqft of drywall. Replace 5 windows, 1 exterior door, and 3 interior doors. Insulate 1,400 sqft of walls and 1,650 sqft of attic. Air sealing, 80 linear feet of trim, 8 plumbing connections, electrical, and paint 1,200 sqft of interior walls.';
    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'room_remodel',
      projectType: 'other',
    });
    expect(parsed.floorAreaSqft).toBe(1650);
    expect(parsed.floorDemoSqft).toBe(900);
    expect(parsed.flooringSqft).toBe(1100);
    expect(parsed.exteriorWallInsulationSqft).toBe(1400);
    expect(parsed.atticInsulationSqft).toBe(1650);
    expect(parsed.baseboardLf).toBe(80);
    expect(parsed.wallPaintSqft).toBe(1200);
    expect(parsed.plumbingRoughPointCount).toBe(8);
    expect(parsed.cabinetDemoLf).toBe(18);
    expect(parsed.cabinetLf).toBe(24);
    expect(
      parsePlumbingMeasurementsFromNotes(notes).plumbingRoughPointCount
    ).toBe(8);

    const {
      resolveChecklistItemQuantity,
      resolveScopeItemSuggestedPricing,
    } = require('@/utils/scopeItemQuantities') as typeof import('@/utils/scopeItemQuantities');
    const measurements = {
      floorAreaSqft: '1650',
      floorDemoSqft: '900',
      flooringSqft: '1100',
      exteriorWallInsulationSqft: '1400',
      atticInsulationSqft: '1650',
    };
    const floorDemoResolved = resolveChecklistItemQuantity(
      'floor_demo',
      { ...measurements, floorAreaSqft: '1650' } as never,
      { templateKey: 'room_remodel', originalNotes: notes }
    );
    const floorDemo = resolveScopeItemSuggestedPricing(
      'floor_demo',
      measurements as never,
      'room_remodel',
      {
        ...floorDemoResolved,
        quantity: 1650,
        unit: 'sqft',
        quantitySource: 'inferred',
      },
      null,
      null,
      notes
    );
    expect(floorDemo.fill?.basis?.quantity).toBe(900);
    expect(floorDemo.fill?.total).toBe(4950);

    const insulationResolved = resolveChecklistItemQuantity(
      'insulation',
      measurements as never,
      { templateKey: 'room_remodel', notes, originalNotes: notes }
    );
    const insulation = resolveScopeItemSuggestedPricing(
      'insulation',
      measurements as never,
      'room_remodel',
      insulationResolved,
      null,
      null,
      notes
    );
    const flooringResolved = resolveChecklistItemQuantity(
      'flooring',
      measurements as never,
      { templateKey: 'room_remodel', notes, originalNotes: notes }
    );
    const flooring = resolveScopeItemSuggestedPricing(
      'flooring',
      measurements as never,
      'room_remodel',
      flooringResolved,
      null,
      null,
      notes
    );
    expect(insulationResolved.quantity).toBe(3050);
    expect(insulation.fill?.basis?.quantity).toBe(3050);
    expect(insulation.fill?.total).toBe(9150);

    const insulationFromNote = resolveScopeItemSuggestedPricing(
      'insulation',
      { floorAreaSqft: '1650' } as never,
      'room_remodel',
      { quantity: 2893, unit: 'sqft', quantitySource: 'inferred' },
      null,
      null,
      notes
    );
    expect(insulationFromNote.fill?.basis?.quantity).toBe(3050);
    expect(insulationFromNote.fill?.total).toBe(9150);

    expect(Number(flooringResolved.quantity)).toBe(1100);
    expect(flooring.fill?.basis?.quantity).toBe(1100);
    expect(flooring.fill?.total).toBe(9427);

    const trim = resolveScopeItemSuggestedPricing(
      'trim',
      { floorAreaSqft: '1650', baseboardLf: '80' } as never,
      'room_remodel',
      { quantity: 80, unit: 'lf', quantitySource: 'notes' },
      null,
      null,
      notes
    );
    expect(trim.fill?.basis?.quantity).toBe(80);
    expect(trim.fill?.total).toBe(680);

    const keys = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      undefined,
      { scopeNotes: notes }
    )
      .flat()
      .map(field => field.key);
    expect(keys).toContain('exteriorWallInsulationSqft');
    expect(keys).toContain('atticInsulationSqft');
    expect(keys).toContain('baseboardLf');
    expect(keys).toContain('plumbingRoughPointCount');
    expect(keys).not.toContain('kitchenFloorSqft');
    expect(keys).not.toContain('ceilingPaintSqft');
  });

  it('prices stated flooring and insulation areas instead of a stuck package', () => {
    const notes =
      'Remodel a 2,100 sqft home. Kitchen and two bathroom updates. Remove 16 linear feet of existing cabinets and install 28 linear feet of new cabinets. Remove 800 sqft of existing flooring and install 1,250 sqft of flooring. Repair 410 sqft of drywall. Replace 7 windows, 1 exterior door, and 6 interior doors. Insulate 1,750 sqft of walls and 900 sqft of attic. Air sealing, 95 linear feet of trim, 9 plumbing connections, electrical, and paint 1,600 sqft of interior walls.';
    const {
      measuredWholeHomeStatedScopeFill,
    } = require('@/utils/scopeItemQuantities') as typeof import('@/utils/scopeItemQuantities');
    const { listConfirmScopeAppliedPricingLines } =
      require('@/utils/benchmarkReasonablenessContext') as typeof import('@/utils/benchmarkReasonablenessContext');
    const measurements = {
      floorAreaSqft: '2100',
      flooringSqft: '1250',
      exteriorWallInsulationSqft: '1750',
      atticInsulationSqft: '900',
      itemQuantities: {},
    };
    const flooring = measuredWholeHomeStatedScopeFill(
      'flooring',
      measurements as never,
      'room_remodel',
      notes,
      null
    );
    const tilePackage = measuredWholeHomeStatedScopeFill(
      'tile_flooring',
      measurements as never,
      'room_remodel',
      notes,
      null
    );
    const insulation = measuredWholeHomeStatedScopeFill(
      'insulation',
      { floorAreaSqft: '2100' } as never,
      'room_remodel',
      notes,
      null
    );
    expect(flooring?.basis.quantity).toBe(1250);
    expect(flooring?.total).not.toBe(20864);
    expect(flooring?.total).toBe(10712.5);
    expect(tilePackage?.basis.quantity).toBe(1250);
    expect(tilePackage?.total).toBe(flooring?.total);
    expect(insulation?.basis.quantity).toBe(2650);
    expect(insulation?.total).not.toBe(8419);
    expect(insulation?.total).toBe(5273.5);

    const lines = listConfirmScopeAppliedPricingLines({
      items: [
        { id: 'flooring', label: 'Flooring installation', state: 'included' },
        { id: 'insulation', label: 'Insulation', state: 'included' },
        {
          id: 'air_sealing',
          label: 'Standard air sealing',
          state: 'included',
        },
      ] as never,
      measurements: measurements as never,
      templateKey: 'room_remodel',
      notes,
    });
    expect(lines.find(line => line.itemId === 'flooring')?.total).toBe(
      flooring?.total
    );
    expect(lines.find(line => line.itemId === 'insulation')?.total).toBe(5273.5);
    expect(lines.find(line => line.itemId === 'air_sealing')).toBeUndefined();
  });

  it('keeps house size off unstated LVP and does not measure kept windows or doors', () => {
    const notes =
      'Whole house remodel. The house is 2,400 sqft. LVP flooring. Keep the windows and doors. Appliances are owner-supplied.';
    expect(statedWholeHomeSizeSqft(notes)).toBe(2400);
    expect(notesDescribeMeasuredWholeHomeRemodel(notes)).toBe(true);
    expect(notesStateFlooringArea(notes)).toBe(false);
    expect(notesNameOwnerSuppliedAppliances(notes)).toBe(true);
    expect(notesOpeningMentionIsKeepOnly(notes, 'windows')).toBe(true);
    expect(notesOpeningMentionIsKeepOnly(notes, 'doors')).toBe(true);
    expect(
      statedWholeHomeSizeSqft('The house is 2,400 sqft LVP flooring.')
    ).toBeNull();
    expect(notesStateFlooringArea(WHOLE_HOME_NOTES)).toBe(true);
    expect(
      wholeHomeRemodelSuppressesInventedPrice('flooring', WHOLE_HOME_NOTES, {})
    ).toBe(false);
    expect(
      wholeHomeRemodelSuppressesInventedPrice('flooring', notes, {
        floorAreaSqft: 2400,
        flooringSqft: 2400,
        flooringLvpSqft: 2400,
      })
    ).toBe(true);
    expect(
      wholeHomeRemodelSuppressesInventedPrice('flooring_lvp', notes, {
        flooringLvpSqft: 2400,
      })
    ).toBe(true);

    const scrubbed = scrubWholeHomeRemodelMeasurements(
      { floorAreaSqft: 2400, flooringSqft: 2400, flooringLvpSqft: 2400 },
      notes
    );
    expect(scrubbed.flooringSqft).toBeUndefined();
    expect(scrubbed.flooringLvpSqft).toBeUndefined();
    expect(scrubbed.floorAreaSqft).toBe(2400);

    const parsed = parseScopeMeasurementsFromNotes(notes, {
      templateKey: 'room_remodel',
      projectType: 'other',
    });
    expect(parsed.flooringSqft).toBeUndefined();
    expect(parsed.flooringLvpSqft).toBeUndefined();
    expect(parsed.floorAreaSqft).toBeUndefined();

    const keys = quickMeasurementRowsForInput(
      'windows_doors',
      'other',
      {},
      ['windowCount', 'interiorDoorCount', 'flooringLvpSqft'],
      { scopeNotes: notes, crossScopeMode: true }
    )
      .flat()
      .map(field => field.key);
    expect(keys).toContain('flooringSqft');
    expect(keys).not.toContain('windowCount');
    expect(keys).not.toContain('interiorDoorCount');

    const doorKeys = quickMeasurementRowsForInput(
      'room_remodel',
      'other',
      {},
      [],
      { scopeNotes: 'Replace 3 interior doors and paint the ceilings.' }
    )
      .flat()
      .map(field => field.key);
    expect(doorKeys).toContain('interiorDoorCount');

    const flooring = resolveScopeItemSuggestedPricing(
      'flooring',
      { floorAreaSqft: '2400', flooringSqft: '2400', flooringLvpSqft: '2400' } as never,
      'room_remodel',
      { quantity: 2400, unit: 'sqft', quantitySource: 'notes' },
      null,
      null,
      notes
    );
    expect(flooring.fill).toBeNull();
    const stated = resolveChecklistItemQuantity('flooring', { flooringSqft: 1800, floorAreaSqft: 2400 } as never, {
      templateKey: 'room_remodel',
      notes: WHOLE_HOME_NOTES,
    });
    expect(Number(stated.quantity)).toBe(1800);
  });
});
