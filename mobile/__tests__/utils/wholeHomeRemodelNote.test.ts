import { repairDraftRatePricingFromNotes } from '@/utils/estimateAiDraft';
import { parseScopeMeasurementsFromNotes } from '@/utils/scopeMeasurementParser';
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
});
