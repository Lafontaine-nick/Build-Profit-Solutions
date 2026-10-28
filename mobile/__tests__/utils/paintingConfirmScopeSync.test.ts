import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import {
  confirmedAppliedRevealLines,
  omitPricedPaintPlaceholders,
} from '@/utils/estimateInitialRevealUi';
import { getScopePackagesForReview } from '@/utils/scopePackagesForReview';
import {
  reviewScopePackages,
  scopePackagePricedAmount,
} from '@/utils/estimateDraftReviewUi';

describe('painting confirm scope prices stay on the later screens', () => {
  const draft = {
    scopeAssumptionsConfirmed: true,
    originalNotes: 'Repaint entire interior',
    scopeChecklist: {
      templateKey: 'painting',
      items: [
        { id: 'interior_paint', label: 'Interior paint', state: 'included', inputType: 'yes_no' },
        { id: 'ceiling_paint', label: 'Ceiling paint', state: 'included', inputType: 'yes_no' },
        { id: 'cabinet_paint', label: 'Cabinet paint', state: 'included', inputType: 'yes_no' },
      ],
    },
    scopePackages: [
      {
        name: 'Interior paint',
        checklistItemId: 'interior_paint',
        price: 8875,
        status: 'user_provided',
        priceProvidedByUser: true,
      },
      {
        name: 'Ceiling paint',
        checklistItemId: 'ceiling_paint',
        price: null,
        status: 'missing_price',
      },
      {
        name: 'Cabinet paint',
        checklistItemId: 'cabinet_paint',
        price: 350,
        knownSubtotal: 350,
        status: 'user_provided',
        priceProvidedByUser: true,
      },
    ],
    scopeMeasurements: {
      paintPricingMethod: 'combined',
      paintScope: ['walls', 'ceilings', 'cabinets'],
      cabinetRunLf: '25',
      paintAreaSqft: '3000',
      itemQuantities: {
        interior_paint__material: {
          quantity: '2665',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        interior_paint__labor: {
          quantity: '6210',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        cabinet_paint__material: {
          quantity: '333',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
        cabinet_paint__labor: {
          quantity: '1042',
          unit: 'allowance',
          quantitySource: 'user_entered',
        },
      },
      pricingAcceptance: {
        interior_paint: {
          selectionStatus: 'accepted',
          totalAmount: 8875,
          materialAmount: 2665,
          laborAmount: 6210,
        },
        cabinet_paint: {
          selectionStatus: 'accepted',
          totalAmount: 1375,
          materialAmount: 333,
          laborAmount: 1042,
        },
      },
    },
  } as unknown as EstimateAiDraft;

  it('shows the cabinet card total instead of a lower leftover package price', () => {
    const cabinet = getScopePackagesForReview(draft).find(
      pkg => pkg.checklistItemId === 'cabinet_paint'
    );
    expect(scopePackagePricedAmount(cabinet!, draft)).toBe(1375);
  });

  it('keeps cabinet paint dollars off the trim card when only the run length is stored', () => {
    const priced = {
      ...draft,
      scopeChecklist: {
        templateKey: 'painting',
        items: [
          ...(draft.scopeChecklist?.items || []),
          { id: 'trim_paint', label: 'Trim paint', state: 'included', inputType: 'yes_no' },
          { id: 'door_paint', label: 'Interior door paint', state: 'included', inputType: 'yes_no' },
        ],
      },
      scopePackages: [
        ...(draft.scopePackages || []),
        {
          name: 'Trim paint',
          checklistItemId: 'trim_paint',
          price: 350,
          status: 'user_provided',
          priceProvidedByUser: true,
        },
      ],
      scopeMeasurements: {
        ...draft.scopeMeasurements,
        paintScope: ['walls', 'ceilings', 'trim', 'doors', 'cabinets'],
        baseboardLf: '50',
        interiorDoorCount: '5',
        itemQuantities: {
          ...draft.scopeMeasurements?.itemQuantities,
          cabinet_paint: {
            quantity: '25',
            unit: 'lf',
            quantitySource: 'user_entered',
          },
          trim_paint: {
            quantity: '50',
            unit: 'lf',
            quantitySource: 'user_entered',
          },
          trim_paint__material: {
            quantity: '100',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          trim_paint__labor: {
            quantity: '250',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
        pricingAcceptance: {
          ...draft.scopeMeasurements?.pricingAcceptance,
          trim_paint: {
            selectionStatus: 'accepted',
            totalAmount: 350,
            materialAmount: 100,
            laborAmount: 250,
          },
        },
      },
    } as unknown as EstimateAiDraft;
    delete (priced.scopeMeasurements as { itemQuantities?: Record<string, unknown> })
      .itemQuantities?.cabinet_paint__material;
    delete (priced.scopeMeasurements as { itemQuantities?: Record<string, unknown> })
      .itemQuantities?.cabinet_paint__labor;

    const packages = getScopePackagesForReview(priced);
    const cabinet = packages.find(pkg => pkg.checklistItemId === 'cabinet_paint');
    const trim = packages.find(pkg => pkg.checklistItemId === 'trim_paint');
    expect(scopePackagePricedAmount(cabinet!, priced)).toBe(1375);
    expect(scopePackagePricedAmount(trim!, priced)).toBe(350);
    expect(
      reviewScopePackages(priced).some(
        pkg => pkg.checklistItemId === 'cabinet_paint'
      )
    ).toBe(true);
  });

  it('leaves combined ceiling paint off the review list', () => {
    expect(
      reviewScopePackages(draft).some(pkg => pkg.checklistItemId === 'ceiling_paint')
    ).toBe(false);
  });

  it('drops unpriced wall and ceiling placeholders once interior paint is priced', () => {
    expect(
      omitPricedPaintPlaceholders(
        [
          { name: 'Interior wall paint', amount: 0 },
          { name: 'Ceiling paint', amount: 0 },
          { name: 'Interior door paint', amount: 375 },
          { name: 'Interior paint', amount: 8875 },
          { name: 'Cabinet paint', amount: 1375 },
        ],
        true
      ).map(row => row.name)
    ).toEqual(['Interior door paint', 'Interior paint', 'Cabinet paint']);
  });
});

describe('confirmed kitchen estimate lists Selected pricing', () => {
  function money(total: number, material: number, labor: number) {
    return {
      selectionStatus: 'accepted' as const,
      totalAmount: total,
      materialAmount: material,
      laborAmount: labor,
    };
  }

  it('uses the Step 2 lines instead of unpriced demo placeholders', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      originalNotes:
        'Kitchen remodel. Demo cabinets, countertops, backsplash, and flooring. New island.',
      projectType: 'kitchen',
      scopeChecklist: {
        templateKey: 'kitchen',
        items: [
          { id: 'backsplash_demo', label: 'Backsplash demo', state: 'included', inputType: 'yes_no' },
          { id: 'floor_demo', label: 'Remove existing flooring', state: 'included', inputType: 'yes_no' },
          { id: 'cabinet_demo', label: 'Cabinet demo / removal', state: 'included', inputType: 'yes_no' },
          { id: 'countertop_demo', label: 'Countertop demo / removal', state: 'included', inputType: 'yes_no' },
          { id: 'cabinets', label: 'Stock cabinet supply & installation', state: 'included', inputType: 'yes_no' },
          { id: 'countertops', label: 'Countertop fabrication & install', state: 'included', inputType: 'yes_no' },
          { id: 'island', label: 'Island set & anchor', state: 'included', inputType: 'yes_no' },
        ],
      },
      scopePackages: [
        {
          name: 'Countertop demo / removal',
          checklistItemId: 'countertop_demo',
          price: 3000,
          status: 'user_provided',
          priceProvidedByUser: true,
        },
        {
          name: 'Flooring demo / removal',
          checklistItemId: 'floor_demo',
          price: null,
          status: 'missing_price',
        },
      ],
      scopeMeasurements: {
        flooringExistingTypes: ['unknown'],
        itemQuantities: {
          backsplash_demo__material: { quantity: '50', unit: 'allowance', quantitySource: 'user_entered' },
          backsplash_demo__labor: { quantity: '176', unit: 'allowance', quantitySource: 'user_entered' },
          floor_demo_style_unknown__material: { quantity: '75', unit: 'allowance', quantitySource: 'user_entered' },
          floor_demo_style_unknown__labor: { quantity: '300', unit: 'allowance', quantitySource: 'user_entered' },
          cabinets__material: { quantity: '4000', unit: 'allowance', quantitySource: 'user_entered' },
          cabinets__labor: { quantity: '1845', unit: 'allowance', quantitySource: 'user_entered' },
          countertops__material: { quantity: '2000', unit: 'allowance', quantitySource: 'user_entered' },
          countertops__labor: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
          island__material: { quantity: '400', unit: 'allowance', quantitySource: 'user_entered' },
          island__labor: { quantity: '550', unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          backsplash_demo: money(226, 50, 176),
          floor_demo_style_unknown: money(375, 75, 300),
          cabinets: money(5845, 4000, 1845),
          countertops: money(3000, 2000, 1000),
          island: money(950, 400, 550),
        },
      },
    } as unknown as EstimateAiDraft;

    const rows = confirmedAppliedRevealLines(draft);
    expect(rows?.map(row => [row.name, row.amount])).toEqual([
      ['Backsplash demo', 226],
      ['Stock cabinet supply & installation', 5845],
      ['Countertop fabrication & install', 3000],
      ['Island set & anchor', 950],
      ['Remove existing flooring', 375],
    ]);
    expect(rows?.map(row => row.name)).not.toEqual(
      expect.arrayContaining([
        'Cabinet demo / removal',
        'Countertop demo / removal',
        'Flooring demo / removal',
      ])
    );
  });
});
