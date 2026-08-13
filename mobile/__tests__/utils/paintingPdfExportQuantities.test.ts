import { applyDraftToEstimate } from '@/utils/estimateAiDraft';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { buildProposalHtml } from '@/lib/proposals/buildProposalHtml';
import type { ContractDoc } from '@/lib/contracts/types';

function paintPackage(
  name: string,
  checklistItemId: string,
  quantity: number,
  unit: string,
  laborPrice: number,
  materialPrice: number
) {
  return {
    name,
    scope: name,
    checklistItemId,
    scopeQuantities: [{ quantity, unit }],
    price: laborPrice + materialPrice,
    laborPrice,
    materialPrice,
    pricingType: 'split',
    includesLabor: true,
    includesMaterials: true,
    priceSource: 'user_provided',
    status: 'confirmed',
    knownSubtotal: laborPrice + materialPrice,
    formula: null,
    missingInfo: [],
    missingPriceItems: [],
    pricingItems: [],
    applyEligible: true,
    priceProvidedByUser: true,
    priceIncludesLaborAndMaterials: true,
    splitIsSuggested: false,
  };
}

describe('painting PDF export quantities', () => {
  it('copies confirmed paint measurements onto bid labor and material line items', () => {
    const draft = {
      projectType: 'painting',
      scopeAssumptionsConfirmed: true,
      originalNotes: 'Interior and exterior paint',
      rooms: [],
      scopePackages: [
        paintPackage('Walls', 'interior_paint', 1500, 'sqft', 3750, 1305),
        paintPackage('Baseboards, trim & molding', 'trim_paint', 200, 'lf', 1000, 400),
        paintPackage('Interior doors & frames', 'door_paint', 6, 'each', 630, 120),
        paintPackage('Cabinets', 'cabinet_paint', 25, 'lf', 1041.67, 333.33),
        paintPackage('Exterior Paint', 'exterior_paint', 2000, 'sqft', 4500, 1800),
      ],
      scopeMeasurements: {
        combinedPaintableAreaSqft: 1500,
        paintPricingMethod: 'combined',
        baseboardLf: 200,
        interiorDoorCount: 6,
        cabinetRunLf: 25,
        exteriorPaintSqft: 2000,
        itemQuantities: {},
      },
      applySuggestedSplits: true,
    } as unknown as EstimateAiDraft;

    const { bid, materialsCart } = applyDraftToEstimate({}, draft, {
      applyConfirmedOnly: true,
      applySuggestedSplits: true,
    });

    const labor = bid.laborLineItems as Array<{
      name?: string;
      hours?: number;
      quantity?: number;
      unit?: string;
      mode?: string;
      total?: number;
    }>;
    const materials = bid.materialLineItems as Array<{
      name?: string;
      quantity?: number;
      unit?: string;
      total?: number;
    }>;

    const wallsLabor = labor.find(item => item.name === 'Walls');
    expect(wallsLabor).toMatchObject({ hours: 1500, unit: 'sq ft', mode: 'sqft' });
    expect(wallsLabor?.total).toBe(3750);

    const trimLabor = labor.find(item => item.name === 'Baseboards, trim & molding');
    expect(trimLabor).toMatchObject({ hours: 200, unit: 'lf' });

    const doorLabor = labor.find(item => item.name === 'Interior doors & frames');
    expect(doorLabor).toMatchObject({ hours: 6, unit: 'each' });

    const cabinetLabor = labor.find(item => item.name === 'Cabinets');
    expect(cabinetLabor).toMatchObject({ hours: 25, unit: 'lf' });

    const exteriorLabor = labor.find(item => item.name === 'Exterior Paint');
    expect(exteriorLabor).toMatchObject({ hours: 2000, unit: 'sq ft', mode: 'sqft' });

    expect(materials.find(item => String(item.name).startsWith('Walls'))).toMatchObject({
      quantity: 1500,
      unit: 'sq ft',
      total: 1305,
    });
    expect(materials.find(item => String(item.name).startsWith('Interior doors'))).toMatchObject({
      quantity: 6,
      unit: 'each',
      total: 120,
    });
    expect(materials.find(item => String(item.name).startsWith('Cabinets'))).toMatchObject({
      quantity: 25,
      unit: 'lf',
    });
    expect(materialsCart.length).toBeGreaterThan(0);

    const scope = String(bid.scopeDescription || '');
    expect(scope).toMatch(/Combined paintable area: 1,500 sqft/);
    expect(scope).toMatch(/Baseboard \/ trim: 200 LF/);
    expect(scope).toMatch(/Interior doors: 6 each/);
    expect(scope).toMatch(/Cabinet run length: 25 LF/);
    expect(scope).toMatch(/Exterior paint: 2,000 sqft/);
  });

  it('includes cabinet paint sqft from notes on the PDF confirmed measurements block', () => {
    const draft = {
      projectType: 'painting',
      scopeAssumptionsConfirmed: true,
      originalNotes: 'Interior paint 1500 sqft walls and ceilings. 200 sqft kitchen cabinets.',
      rooms: [],
      scopePackages: [
        paintPackage('Walls', 'interior_paint', 1500, 'sqft', 3750, 1305),
        paintPackage('Cabinets', 'cabinet_paint', 200, 'sqft', 800, 200),
      ],
      scopeMeasurements: {
        combinedPaintableAreaSqft: 1500,
        paintAreaSqft: 1500,
        paintPricingMethod: 'combined',
        cabinetPaintSqft: 200,
        itemQuantities: {},
      },
      applySuggestedSplits: true,
    } as unknown as EstimateAiDraft;

    const { bid, materialsCart } = applyDraftToEstimate({}, draft, {
      applyConfirmedOnly: true,
      applySuggestedSplits: true,
    });

    const materials = bid.materialLineItems as Array<{
      name?: string;
      quantity?: number;
      unit?: string;
    }>;
    const scope = String(bid.scopeDescription || '');
    expect(scope).toMatch(/Combined paintable area: 1,500 sqft/);
    expect(scope).toMatch(/Cabinet paint area: 200 sqft/);
    expect(materials.find(item => String(item.name).startsWith('Cabinets'))).toMatchObject({
      quantity: 200,
      unit: 'sq ft',
    });
    expect(materialsCart.length).toBeGreaterThan(0);
  });

  it('renders a Measurements card on the painting proposal HTML', () => {
    const html = buildProposalHtml(
      {
        summary: {
          contractId: 'P-1',
          projectName: 'Paint job',
          siteAddress: '1 Main St',
          totalBid: 1000,
          durationDays: 5,
          startDate: '2026-08-13',
        },
        contractor: {},
        owner: { legalName: 'Client' },
        scope: {
          bullets: ['Interior paint'],
          description: 'Interior paint',
          measurementLines: [
            { label: 'Combined paintable area', quantity: '1,500 sqft' },
            { label: 'Baseboard / trim', quantity: '200 LF' },
          ],
        },
        milestones: [],
        terms: {},
      } as ContractDoc,
      { projectType: 'painting' }
    );
    expect(html).toMatch(/Measurements/);
    expect(html).toMatch(/Combined paintable area/);
    expect(html).toMatch(/1,500 sqft/);
    expect(html).toMatch(/Baseboard \/ trim/);
  });
});
