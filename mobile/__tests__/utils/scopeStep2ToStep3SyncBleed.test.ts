import {
  syncSelectedScopePricing,
  getScopePackages,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';
import { buildAcceptanceFromSuggestedBlock } from '@/utils/acceptedPricingSummaryUi';
import {
  initialScopeMeasurementInputExtended,
  lookupRuleKeyForPackage,
  scopeMeasurementsPayloadForPersist,
} from '@/utils/scopeItemQuantities';
import { mergeScopeProgressIntoDraft } from '@/utils/estimateScopeChecklistUi';

const NOTES = 'Ground-up custom home 3098 SF.';

function draftBase(): EstimateAiDraft {
  return {
    scopeChecklist: { templateKey: 'ground_up' },
    projectType: 'ground_up',
    estimateTier: 'ground_up',
    originalNotes: NOTES,
    scopePackages: [
      {
        name: 'Tile & flooring',
        scope: 'Living-area flooring package',
        price: null,
        status: 'missing_price',
        priceSource: 'missing',
      },
      {
        name: 'Bath floor tile',
        scope: 'Bathroom floor tile labor and materials.',
        price: null,
        status: 'missing_price',
        priceSource: 'missing',
      },
      {
        name: 'Landscaping / site walls & gates',
        scope:
          'Landscaping, exterior site walls, fences & gates package. Not driveway flatwork or iron entry doors.',
        price: null,
        status: 'missing_price',
        priceSource: 'missing',
      },
      {
        name: 'Exterior concrete flatwork',
        scope: 'Driveway, walkways, porch, and exterior patio slabs — not the house or garage slab.',
        price: null,
        status: 'missing_price',
        priceSource: 'missing',
      },
      {
        name: 'Electrical fixtures',
        scope: 'Devices, plates, and bulbs.',
        price: null,
        status: 'missing_price',
        priceSource: 'missing',
      },
      {
        name: 'Electrical rough-in',
        scope: 'Electrical rough-in',
        price: null,
        status: 'missing_price',
        priceSource: 'missing',
      },
      {
        name: 'Finish carpentry / interior trim',
        scope: 'Finish trim, interior doors, door hardware & shelving package until detailed takeoff.',
        price: null,
        status: 'missing_price',
        priceSource: 'missing',
      },
    ],
    rooms: [],
    allowances: [],
    scopeMeasurements: { floorAreaSqft: 3098, itemQuantities: {} },
  } as unknown as EstimateAiDraft;
}

describe('Step 2 → Step 3 sync does not bleed sibling prices', () => {
  it('maps ground-up package labels to the correct checklist keys', () => {
    expect(lookupRuleKeyForPackage('Tile & flooring')).toBe('tile_flooring');
    expect(lookupRuleKeyForPackage('Bath floor tile')).toBe('floor_tile');
    expect(
      lookupRuleKeyForPackage(
        'Landscaping / site walls & gates',
        'Landscaping, exterior site walls, fences & gates package. Not driveway flatwork or iron entry doors.'
      )
    ).toBe('landscaping');
    expect(lookupRuleKeyForPackage('Exterior concrete flatwork')).toBe('pour_flatwork');
    expect(lookupRuleKeyForPackage('Electrical fixtures')).toBe('electrical_trim');
    expect(lookupRuleKeyForPackage('Finish carpentry / interior trim')).toBe('interior_trim');
  });

  it('syncs each Applied Confirm Scope total onto the matching Step 3 package', () => {
    const draft0 = draftBase();
    const input = initialScopeMeasurementInputExtended(draft0);
    input.itemQuantities = {
      ...input.itemQuantities,
      tile_flooring: { quantity: '3098', unit: 'sqft', quantitySource: 'user_entered' },
      tile_flooring__material: { quantity: '11803', unit: 'allowance', quantitySource: 'user_entered' },
      tile_flooring__labor: { quantity: '14746', unit: 'allowance', quantitySource: 'user_entered' },
      floor_tile: { quantity: '120', unit: 'sqft', quantitySource: 'user_entered' },
      floor_tile__material: { quantity: '960', unit: 'allowance', quantitySource: 'user_entered' },
      floor_tile__labor: { quantity: '1560', unit: 'allowance', quantitySource: 'user_entered' },
      landscaping: { quantity: '13008', unit: 'allowance', quantitySource: 'user_entered' },
      landscaping__material: { quantity: '7154', unit: 'allowance', quantitySource: 'user_entered' },
      landscaping__labor: { quantity: '5854', unit: 'allowance', quantitySource: 'user_entered' },
      landscaping__allowance: { quantity: '13008', unit: 'allowance', quantitySource: 'user_entered' },
      pour_flatwork: { quantity: '850', unit: 'sqft', quantitySource: 'user_entered' },
      pour_flatwork__material: { quantity: '3400', unit: 'allowance', quantitySource: 'user_entered' },
      pour_flatwork__labor: { quantity: '5100', unit: 'allowance', quantitySource: 'user_entered' },
      electrical_trim: { quantity: '4172', unit: 'allowance', quantitySource: 'user_entered' },
      electrical_trim__allowance: { quantity: '4172', unit: 'allowance', quantitySource: 'user_entered' },
      electrical_rough: { quantity: '3098', unit: 'sqft', quantitySource: 'user_entered' },
      electrical_rough__material: { quantity: '8086', unit: 'allowance', quantitySource: 'user_entered' },
      electrical_rough__labor: { quantity: '19703', unit: 'allowance', quantitySource: 'user_entered' },
      interior_trim: { quantity: '10118', unit: 'allowance', quantitySource: 'user_entered' },
      interior_trim__material: { quantity: '5519', unit: 'allowance', quantitySource: 'user_entered' },
      interior_trim__labor: { quantity: '4599', unit: 'allowance', quantitySource: 'user_entered' },
    };
    input.pricingAcceptance = {
      tile_flooring: buildAcceptanceFromSuggestedBlock({
        total: 26550,
        material: 11803,
        labor: 14746,
        lumpSumOnly: false,
        rateSourceLabel: 'National Average',
        materialSource: 'national_average',
        laborSource: 'national_average',
      }),
      floor_tile: buildAcceptanceFromSuggestedBlock({
        total: 2520,
        material: 960,
        labor: 1560,
        lumpSumOnly: false,
        rateSourceLabel: 'National Average',
        materialSource: 'national_average',
        laborSource: 'national_average',
      }),
      landscaping: buildAcceptanceFromSuggestedBlock({
        total: 13008,
        material: 7154,
        labor: 5854,
        lumpSumOnly: false,
        rateSourceLabel: 'National Average',
        materialSource: 'national_average',
        laborSource: 'national_average',
      }),
      pour_flatwork: buildAcceptanceFromSuggestedBlock({
        total: 8500,
        material: 3400,
        labor: 5100,
        lumpSumOnly: false,
        rateSourceLabel: 'National Average',
        materialSource: 'national_average',
        laborSource: 'national_average',
      }),
      electrical_trim: buildAcceptanceFromSuggestedBlock({
        total: 4172,
        material: 0,
        labor: 0,
        lumpSumOnly: true,
        rateSourceLabel: 'National Average',
        materialSource: 'national_average',
        laborSource: 'national_average',
      }),
      electrical_rough: buildAcceptanceFromSuggestedBlock({
        total: 27789,
        material: 8086,
        labor: 19703,
        lumpSumOnly: false,
        rateSourceLabel: 'National Average',
        materialSource: 'national_average',
        laborSource: 'national_average',
      }),
      interior_trim: buildAcceptanceFromSuggestedBlock({
        total: 10118,
        material: 5519,
        labor: 4599,
        lumpSumOnly: false,
        rateSourceLabel: 'National Average',
        materialSource: 'national_average',
        laborSource: 'national_average',
      }),
    };

    const payload = scopeMeasurementsPayloadForPersist(input, {
      notes: NOTES,
      templateKey: 'ground_up',
    });
    const draft1 = syncSelectedScopePricing(
      mergeScopeProgressIntoDraft(draft0, [], payload, { scopeNotes: NOTES })
    );
    const pkgs = getScopePackages(draft1);
    const byName = (n: string) => pkgs.find((p) => p.name === n)!;

    // Totals follow live Confirm Scope M+L (not a stale acceptance total that can be $1 off).
    expect(byName('Tile & flooring')).toMatchObject({
      price: 11803 + 14746,
      materialPrice: 11803,
      laborPrice: 14746,
    });
    expect(byName('Bath floor tile')).toMatchObject({
      price: 2520,
      materialPrice: 960,
      laborPrice: 1560,
    });
    expect(byName('Landscaping / site walls & gates')).toMatchObject({
      price: 13008,
      materialPrice: 7154,
      laborPrice: 5854,
    });
    expect(byName('Exterior concrete flatwork')).toMatchObject({
      price: 8500,
      materialPrice: 3400,
      laborPrice: 5100,
    });
    expect(byName('Electrical fixtures').price).toBe(4172);
    expect(byName('Electrical rough-in')).toMatchObject({
      price: 27789,
      materialPrice: 8086,
      laborPrice: 19703,
    });
    expect(byName('Finish carpentry / interior trim')).toMatchObject({
      price: 10118,
      materialPrice: 5519,
      laborPrice: 4599,
    });
    expect(draft1.calculatedLineItemTotal).toBe(
      11803 + 14746 + 2520 + 13008 + 8500 + 4172 + 27789 + 10118
    );
    expect(draft1.calculatedMaterialTotal).toBe(11803 + 960 + 7154 + 3400 + 8086 + 5519);
    expect(draft1.calculatedLaborTotal).toBe(14746 + 1560 + 5854 + 5100 + 19703 + 4599);
  });

  it('prefers live Confirm Scope M/L over stale acceptance amounts', () => {
    const draft0 = draftBase();
    const draft = syncSelectedScopePricing({
      ...draft0,
      scopePackages: [
        {
          name: 'Finish carpentry / interior trim',
          scope: 'Finish trim package',
          checklistItemId: 'interior_trim',
          price: null,
          status: 'missing_price',
        },
      ],
      scopeMeasurements: {
        floorAreaSqft: 3098,
        itemQuantities: {
          interior_trim__material: {
            quantity: 6000,
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          interior_trim__labor: {
            quantity: 5000,
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
        pricingAcceptance: {
          interior_trim: {
            selectionStatus: 'accepted',
            pricingSourceLabel: 'National Average',
            pricingSourceKind: 'national_average',
            totalAmount: 10118,
            materialAmount: 5519,
            laborAmount: 4599,
          },
        },
      },
    } as unknown as EstimateAiDraft);

    const pkg = getScopePackages(draft).find((p) => /finish carpentry/i.test(p.name))!;
    expect(pkg).toMatchObject({
      price: 11000,
      materialPrice: 6000,
      laborPrice: 5000,
    });
  });

  it('does not stamp orphan sticky acceptance after Material/Labor wipe', () => {
    const draft = syncSelectedScopePricing({
      ...draftBase(),
      scopePackages: [
        {
          name: 'Appliance install',
          scope: 'appliances',
          checklistItemId: 'appliances',
          price: null,
          status: 'missing_price',
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          appliances__material: { quantity: 0, unit: 'allowance', quantitySource: 'user_entered' },
          appliances__labor: { quantity: 0, unit: 'allowance', quantitySource: 'user_entered' },
          appliances__allowance: { quantity: 2, unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          appliances: {
            selectionStatus: 'accepted',
            pricingSourceLabel: 'National Average',
            pricingSourceKind: 'national_average',
            totalAmount: 500,
            materialAmount: 0,
            laborAmount: 500,
          },
        },
      },
    } as unknown as EstimateAiDraft);

    const pkg = getScopePackages(draft).find((p) => /appliance/i.test(p.name))!;
    // Sync must not re-apply the stale $500 acceptance over wiped legs.
    expect(pkg.price == null || Number(pkg.price) <= 0).toBe(true);
    expect(pkg.status).toBe('missing_price');
  });
});
