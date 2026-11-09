import {
  applyDraftToEstimate,
  insulationAssemblyReviewLines,
  sumEstimateLineTotals,
} from '@/utils/estimateAiDraft';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { reviewScopePackages, scopePackagePricedAmount } from '@/utils/estimateDraftReviewUi';

const insulationDraft = (opts?: { material?: number; labor?: number; sqft?: number }) => {
  const material = opts?.material ?? 1597.5;
  const labor = opts?.labor ?? 2555;
  const sqft = opts?.sqft ?? 1400;
  return {
    scopeAssumptionsConfirmed: true,
    scopeChecklist: {
      templateKey: 'room_remodel',
      items: [{ id: 'insulation', label: 'Insulation', inputType: 'yes_no', state: 'included' }],
    },
    confirmedAssumptions: [
      { id: 'insulation', label: 'Insulation', inputType: 'yes_no', state: 'included' },
    ],
    scopeMeasurements: {
      scopeFoundPieces: ['remodel_insulation'],
      insulationAssemblies: [
        {
          id: 'wall',
          materialType: 'Cellulose',
          rValue: 'R-15',
          sqft: '1000',
          location: 'exterior_wall',
          source: 'contractor_entered',
          confirmed: true,
        },
        {
          id: 'attic',
          materialType: 'Cellulose',
          rValue: 'R-38',
          sqft: '400',
          location: 'attic_ceiling',
          source: 'contractor_entered',
          confirmed: true,
        },
      ],
      itemQuantities: {
        insulation: { quantity: String(sqft), unit: 'sqft', quantitySource: 'user_entered' },
        insulation__material: { quantity: String(material), unit: 'allowance', quantitySource: 'user_entered' },
        insulation__labor: { quantity: String(labor), unit: 'allowance', quantitySource: 'user_entered' },
      },
      pricingAcceptance: {
        insulation: { selectionStatus: 'accepted', totalAmount: material + labor },
      },
    },
    scopePackages: [
      {
        name: 'Insulation',
        checklistItemId: 'insulation',
        price: material + labor,
        materialPrice: material,
        laborPrice: labor,
        status: 'user_provided',
        priceProvidedByUser: true,
      },
    ],
  } as unknown as EstimateAiDraft;
};

describe('insulation assemblies on the bid and PDF', () => {
  it('writes one labor and one material line per priced assembly', () => {
    const { bid } = applyDraftToEstimate({}, insulationDraft(), { applyConfirmedOnly: true }) as any;
    const labor = bid.laborLineItems.map((line: any) => [line.name, line.quantity, line.total, line.section]);
    const material = bid.materialLineItems.map((line: any) => [line.name, line.quantity, line.total, line.section]);
    expect(labor).toEqual([
      ['Cellulose R-15 · Exterior wall', 1000, 1750, 'Insulation'],
      ['Cellulose R-38 · Attic / ceiling', 400, 805, 'Insulation'],
    ]);
    expect(material).toEqual([
      ['Cellulose R-15 · Exterior wall — materials', 1000, 1012.5, 'Insulation'],
      ['Cellulose R-38 · Attic / ceiling — materials', 400, 585, 'Insulation'],
    ]);
    expect(sumEstimateLineTotals(bid.materialLineItems, bid.laborLineItems)).toEqual({
      material: 1597.5,
      labor: 2555,
    });
  });

  it('keeps the applied total when the contractor edited the insulation price', () => {
    const { bid } = applyDraftToEstimate(
      {},
      insulationDraft({ material: 1800, labor: 3000 }),
      { applyConfirmedOnly: true }
    ) as any;
    expect(bid.laborLineItems).toHaveLength(2);
    expect(sumEstimateLineTotals(bid.materialLineItems, bid.laborLineItems)).toEqual({
      material: 1800,
      labor: 3000,
    });
  });

  it('lists each assembly under the Insulation row on Review', () => {
    const draft = insulationDraft();
    const pkg = reviewScopePackages(draft).find(row => row.name === 'Insulation')!;
    expect(scopePackagePricedAmount(pkg, draft)).toBe(4152.5);
    expect(insulationAssemblyReviewLines(pkg, draft, 4152.5)).toEqual([
      { name: 'Cellulose R-15 · Exterior wall', sqft: 1000, total: 2762.5 },
      { name: 'Cellulose R-38 · Attic / ceiling', sqft: 400, total: 1390 },
    ]);
  });

  it('keeps one insulation line when the rows do not cover the priced area', () => {
    const { bid } = applyDraftToEstimate(
      {},
      insulationDraft({ sqft: 2200 }),
      { applyConfirmedOnly: true }
    ) as any;
    expect(bid.laborLineItems.map((line: any) => line.name)).toEqual(['Insulation']);
  });
});
