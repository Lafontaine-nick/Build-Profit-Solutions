import {
  applyDraftToEstimate,
  syncElectricalScopeQuantitiesOnBidLines,
} from '@/utils/estimateAiDraft';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

describe('electrical project line quantities', () => {
  it('keeps the ceiling fan takeoff on material and labor lines', () => {
    const draft = {
      projectType: 'electrical',
      originalNotes: 'Electrical',
      rooms: [],
      scopeChecklist: { templateKey: 'electrical', items: [] },
      scopePackages: [
        {
          name: 'Ceiling fan',
          checklistItemId: 'electrical_ceiling_fan',
          scopeQuantities: [{ quantity: 1, unit: 'each' }],
          budgetSplitBasis: { quantity: 1, unit: 'each' },
          price: 1925,
          materialPrice: 700,
          laborPrice: 1225,
          pricingType: 'split',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          priceProvidedByUser: true,
          applyEligible: true,
          knownSubtotal: 1925,
          pricingItems: [],
        },
        {
          name: 'Main panel',
          checklistItemId: 'electrical_main_panel',
          scopeQuantities: [{ quantity: 1, unit: 'each' }],
          budgetSplitBasis: { quantity: 1, unit: 'each' },
          price: 2050,
          materialPrice: 850,
          laborPrice: 1200,
          pricingType: 'split',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          priceProvidedByUser: true,
          applyEligible: true,
          knownSubtotal: 2050,
          pricingItems: [],
        },
      ],
      scopeMeasurements: {
        ceilingFanCount: 7,
        mainPanelCount: 1,
        itemQuantities: {
          electrical_ceiling_fan: {
            quantity: '1',
            unit: 'each',
            quantitySource: 'user_entered',
          },
          electrical_ceiling_fan__material: {
            quantity: '700',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          electrical_ceiling_fan__labor: {
            quantity: '1225',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          electrical_main_panel: {
            quantity: '1',
            unit: 'each',
            quantitySource: 'user_entered',
          },
          electrical_main_panel__material: {
            quantity: '850',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
          electrical_main_panel__labor: {
            quantity: '1200',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
        pricingAcceptance: {
          electrical_ceiling_fan: {
            selectionStatus: 'accepted',
            totalAmount: 1925,
            materialAmount: 700,
            laborAmount: 1225,
          },
          electrical_main_panel: {
            selectionStatus: 'accepted',
            totalAmount: 2050,
            materialAmount: 850,
            laborAmount: 1200,
          },
        },
      },
      applySuggestedSplits: true,
    } as unknown as EstimateAiDraft;

    const { bid } = applyDraftToEstimate({}, draft, {
      applySuggestedSplits: true,
    });
    const materials = bid.materialLineItems as Array<{
      name?: string;
      quantity?: number;
      total?: number;
    }>;
    const labor = bid.laborLineItems as Array<{
      name?: string;
      quantity?: number;
      total?: number;
    }>;
    const fanMaterial = materials.find(line => line.name?.includes('Ceiling fan'));
    const fanLabor = labor.find(line => line.name === 'Ceiling fan');
    const panelMaterial = materials.find(line => line.name?.includes('Main panel'));

    expect(fanMaterial).toMatchObject({ quantity: 7, total: 700 });
    expect(fanLabor).toMatchObject({ quantity: 7, total: 1225 });
    expect(panelMaterial).toMatchObject({ quantity: 1, total: 850 });
  });

  it('rewrites an already saved 1-each fan line from the scope count', () => {
    const lines = syncElectricalScopeQuantitiesOnBidLines(
      [
        {
          name: 'Ceiling fan',
          quantity: 1,
          qty: 1,
          hours: 1,
          unit: 'each',
          rate: 1225,
          total: 1225,
          totalCost: 1225,
        },
        {
          name: 'Ceiling fan — materials',
          quantity: 1,
          unit: 'each',
          unitPrice: 700,
          total: 700,
        },
      ],
      { ceilingFanCount: 7 }
    );
    expect(lines?.[0]).toMatchObject({ quantity: 7, rate: 175, total: 1225 });
    expect(lines?.[1]).toMatchObject({
      quantity: 7,
      unitPrice: 100,
      total: 700,
    });
  });
});
