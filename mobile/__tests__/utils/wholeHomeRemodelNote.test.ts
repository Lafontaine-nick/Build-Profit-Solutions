import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import {
  scopePackageNeedsManualPrice,
  scopePackagePricedAmount,
} from '@/utils/estimateDraftReviewUi';
import { getInitialRevealUnderstoodBullets } from '@/utils/estimateInitialRevealUi';
import { reconcileScopePackagesForReview } from '@/utils/scopePackagesForReview';
import { syncElectricalScopeItems } from '@/utils/subcontractorTrade/electricalPlanConvergence';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
import { quickMeasurementRowsForInput } from '@/utils/scopeQuickMeasurements';
import { parsePlumbingMeasurementsFromNotes } from '@/utils/subcontractorTrade/plumbingPlanConvergence';
import {
  applyWholeHomeRemodelChecklist,
  scrubWholeHomeRemodelMeasurements,
  wholeHomeRemodelSuppressesInventedPrice,
} from '@/utils/wholeHomeRemodelNote';

const THIN_HOME_NOTES =
  'Remodel a 1,800 sqft home. Install 1,200 sqft of flooring, repair 400 sqft of drywall, and paint the interior.';

const WHOLE_HOME_NOTES =
  'Remodel a 2,400 sqft home with demolition and removal of existing cabinets, fixtures, flooring, drywall, and finishes as needed; kitchen and bathroom updates, 1,800 sqft flooring, 500 sqft drywall repair, six windows, two exterior doors, four interior doors, wall and attic insulation, air sealing, trim, plumbing, electrical, and interior paint.';

describe('whole-home remodel note authority', () => {
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
        'air_sealing',
        'trim',
        'plumbing',
        'electrical',
        'paint',
      ])
    );
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

    expect(flooringResolved.quantity).toBe(1100);
    expect(flooring.fill?.basis?.quantity).toBe(1100);
    expect(flooring.fill?.total).toBe(9427);

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
});
