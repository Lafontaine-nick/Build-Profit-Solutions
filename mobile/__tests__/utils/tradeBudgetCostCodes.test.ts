/**
 * Confirm Scope cost codes must survive apply → estimate lines → Projects rollup.
 */
jest.mock('@/utils/resolveAiBackendUrl', () => ({
  resolveAiBaseUrl: () => 'http://localhost:3001',
}));

import {
  applyDraftToEstimate,
  tradeBudgetRollupFromEstimate,
  type EstimateAiDraft,
} from '@/utils/estimateAiDraft';

function groundUpTradeDraft(): EstimateAiDraft {
  return {
    projectType: 'ground_up',
    estimateTier: 'ground_up',
    originalNotes: 'New home Lot 41',
    applySuggestedSplits: true,
    scopeChecklist: { templateKey: 'ground_up' },
    scopeMeasurements: {
      floorAreaSqft: '1879',
      excavationCy: '132',
      concreteCy: '85',
      roofSquares: '28',
      drywallSqft: '5200',
      wallPaintSqft: '4800',
      itemQuantities: {
        excavation: { quantity: 132, unit: 'cy', quantitySource: 'user_entered' },
        excavation__material: { quantity: 660, unit: 'allowance', quantitySource: 'user_entered' },
        excavation__labor: { quantity: 5940, unit: 'allowance', quantitySource: 'user_entered' },
        foundation: { quantity: 85, unit: 'cy', quantitySource: 'user_entered' },
        foundation__material: { quantity: 12750, unit: 'allowance', quantitySource: 'user_entered' },
        foundation__labor: { quantity: 8500, unit: 'allowance', quantitySource: 'user_entered' },
        roofing: { quantity: 28, unit: 'squares', quantitySource: 'user_entered' },
        roofing__material: { quantity: 9800, unit: 'allowance', quantitySource: 'user_entered' },
        roofing__labor: { quantity: 12600, unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        excavation: {
          selectionStatus: 'accepted',
          totalAmount: 6600,
          materialAmount: 660,
          laborAmount: 5940,
        },
        foundation: {
          selectionStatus: 'accepted',
          totalAmount: 21250,
          materialAmount: 12750,
          laborAmount: 8500,
        },
        roofing: {
          selectionStatus: 'accepted',
          totalAmount: 22400,
          materialAmount: 9800,
          laborAmount: 12600,
        },
      },
    },
    rooms: [],
    scopePackages: [
      {
        name: 'Excavation',
        scope: 'Base excavation from plan takeoff',
        price: 6600,
        laborPrice: 5940,
        materialPrice: 660,
        pricingType: 'split',
        includesLabor: true,
        includesMaterials: true,
        priceSource: 'user_provided',
        status: 'user_provided',
        formula: null,
        missingInfo: [],
        priceIncludesLaborAndMaterials: false,
        splitIsSuggested: false,
        priceProvidedByUser: true,
        applyEligible: true,
      },
      {
        name: 'Foundation',
        scope: 'Slab and footing concrete',
        price: 21250,
        laborPrice: 8500,
        materialPrice: 12750,
        pricingType: 'split',
        includesLabor: true,
        includesMaterials: true,
        priceSource: 'user_provided',
        status: 'user_provided',
        formula: null,
        missingInfo: [],
        priceIncludesLaborAndMaterials: false,
        splitIsSuggested: false,
        priceProvidedByUser: true,
        applyEligible: true,
      },
      {
        name: 'Roofing',
        scope: 'Shingle roofing install',
        price: 22400,
        laborPrice: 12600,
        materialPrice: 9800,
        pricingType: 'split',
        includesLabor: true,
        includesMaterials: true,
        priceSource: 'user_provided',
        status: 'user_provided',
        formula: null,
        missingInfo: [],
        priceIncludesLaborAndMaterials: false,
        splitIsSuggested: false,
        priceProvidedByUser: true,
        applyEligible: true,
      },
    ],
  } as EstimateAiDraft;
}

describe('trade budget cost codes', () => {
  it('stamps Confirm Scope ids on material and labor lines when applying', () => {
    const { bid, materialsCart } = applyDraftToEstimate({}, groundUpTradeDraft(), {
      applyConfirmedOnly: true,
      applySuggestedSplits: true,
    });

    const labor = bid.laborLineItems as Array<Record<string, unknown>>;
    const materials = bid.materialLineItems as Array<Record<string, unknown>>;

    expect(labor.map((l) => l.costCode).sort()).toEqual(['excavation', 'foundation', 'roofing']);
    expect(materials.map((m) => m.costCode).sort()).toEqual(['excavation', 'foundation', 'roofing']);
    expect(labor.every((l) => l.sourceItemId === l.costCode)).toBe(true);
    expect(materials.every((m) => m.checklistItemId === m.costCode)).toBe(true);
    expect(materialsCart.every((m) => m.costCode)).toBe(true);
  });

  it('rolls up Projects trade budgets by cost code', () => {
    const { bid } = applyDraftToEstimate({}, groundUpTradeDraft(), {
      applyConfirmedOnly: true,
      applySuggestedSplits: true,
    });

    const rollup = tradeBudgetRollupFromEstimate(bid as Parameters<typeof tradeBudgetRollupFromEstimate>[0]);
    expect(rollup).toEqual([
      {
        costCode: 'excavation',
        label: 'Excavation',
        material: 660,
        labor: 5940,
        allowance: 0,
        total: 6600,
      },
      {
        costCode: 'foundation',
        label: 'Foundation',
        material: 12750,
        labor: 8500,
        allowance: 0,
        total: 21250,
      },
      {
        costCode: 'roofing',
        label: 'Roofing',
        material: 9800,
        labor: 12600,
        allowance: 0,
        total: 22400,
      },
    ]);
  });
});
