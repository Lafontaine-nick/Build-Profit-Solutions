import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { applyDraftToEstimate } from '@/utils/estimateAiDraft';
import {
  packageNeedsSuggestedBudgetSplit,
  resolveScopePackageBudgetBreakdown,
} from '@/utils/scopeBudgetBreakdown';
import {
  computeNationalAverageBudgetSplit,
  resolveSuggestedBudgetSplitDisplay,
} from '@/utils/scopeItemQuantities';

function flooringDraft(overrides: Partial<EstimateAiDraft> = {}): EstimateAiDraft {
  return {
    projectType: 'flooring',
    originalNotes:
      '850 sqft floor. Tile demo $2550. LVP $4.50/sqft material + $3.25/sqft labor. Baseboard $1540.',
    scopeMeasurements: {
      floorAreaSqft: '850',
      baseboardLf: '220',
      itemQuantities: {},
    },
    scopeChecklist: { templateKey: 'flooring' },
    scopePackages: [
      {
        name: 'Tile Demo',
        price: 2550,
        status: 'calculated',
        priceSource: 'notes',
        scopeQuantities: [{ quantity: 850, unit: 'sqft' }],
      },
      {
        name: 'LVP Flooring',
        price: 6587.5,
        status: 'calculated',
        priceSource: 'notes',
        scopeQuantities: [{ quantity: 850, unit: 'sqft' }],
      },
      {
        name: 'Baseboard',
        price: 1540,
        status: 'calculated',
        priceSource: 'notes',
        scopeQuantities: [{ quantity: 220, unit: 'lf' }],
      },
    ],
    rooms: [],
    ...overrides,
  } as EstimateAiDraft;
}

describe('scopeBudgetBreakdown', () => {
  it('uses National Average for tile demo lump sum', () => {
    const draft = flooringDraft();
    const pkg = draft.scopePackages![0];
    const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft);
    expect(breakdown).toMatchObject({
      total: 2550,
      materialSource: 'suggested',
      laborSource: 'suggested',
    });
    expect(breakdown!.material).toBe(425);
    expect(breakdown!.labor).toBe(2125);
    expect(packageNeedsSuggestedBudgetSplit(pkg, draft)).toBe(true);
  });

  it('uses From notes when material and labor rates are explicit', () => {
    const draft = flooringDraft({
      scopeMeasurements: {
        floorAreaSqft: '850',
        baseboardLf: '220',
        itemQuantities: {
          flooring__material: { quantity: 3825, unit: 'allowance' },
          flooring__labor: { quantity: 2762.5, unit: 'allowance' },
        },
      },
    });
    const pkg = draft.scopePackages!.find((p) => p.name === 'LVP Flooring')!;
    const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft);
    expect(breakdown).toMatchObject({
      material: 3825,
      labor: 2762.5,
      materialSource: 'notes',
      laborSource: 'notes',
    });
    expect(packageNeedsSuggestedBudgetSplit(pkg, draft)).toBe(false);
  });

  it('uses National Average for baseboard lump sum', () => {
    const draft = flooringDraft();
    const pkg = draft.scopePackages!.find((p) => p.name === 'Baseboard')!;
    const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft);
    expect(breakdown).toMatchObject({
      total: 1540,
      material: 440,
      labor: 1100,
      materialSource: 'suggested',
      laborSource: 'suggested',
    });
  });

  it('does not treat labor-only note totals as an explicit notes split', () => {
    const draft = flooringDraft({
      originalNotes: '850 sqft. Tile demo $3/sqft labor.',
      scopeMeasurements: {
        floorAreaSqft: '850',
        itemQuantities: {
          floor_demo__labor: { quantity: 2550, unit: 'allowance' },
        },
      },
    });
    const pkg = draft.scopePackages![0];
    const breakdown = resolveScopePackageBudgetBreakdown(pkg, draft);
    expect(breakdown?.materialSource).toBe('suggested');
    expect(breakdown?.laborSource).toBe('suggested');
  });

  it('assigns rock supply lump sums to materials only', () => {
    const draft = {
      projectType: 'landscape',
      originalNotes: '500 sqft rock $1200',
      scopeMeasurements: { rockMulchSqft: '500' },
      scopePackages: [
        {
          name: 'Rock Supply',
          scope: 'rock mulch install',
          price: 1200,
          status: 'calculated',
          priceSource: 'notes',
          scopeQuantities: [{ quantity: 500, unit: 'sqft' }],
        },
      ],
      rooms: [],
    } as EstimateAiDraft;
    const breakdown = resolveScopePackageBudgetBreakdown(draft.scopePackages![0], draft);
    expect(breakdown).toMatchObject({
      total: 1200,
      material: 1200,
      labor: 0,
      materialSource: 'notes',
      laborSource: 'notes',
    });
    expect(packageNeedsSuggestedBudgetSplit(draft.scopePackages![0], draft)).toBe(false);
  });
});

describe('computeNationalAverageBudgetSplit', () => {
  it('computes paint splits from sqft', () => {
    const split = computeNationalAverageBudgetSplit('paint', 875, 350);
    expect(split).toEqual({ material: 297.5, labor: 577.5 });
  });
});

describe('resolveSuggestedBudgetSplitDisplay', () => {
  it('returns null when explicit dual material/labor exist', () => {
    const split = resolveSuggestedBudgetSplitDisplay(
      'flooring',
      { floorAreaSqft: '850' },
      'flooring',
      {
        quantity: 6587.5,
        unit: 'allowance',
        quantitySource: 'notes',
        dualMaterial: { quantity: 3825, unit: 'allowance' },
        dualLabor: { quantity: 2762.5, unit: 'allowance' },
        dualAllowance: { quantity: 6587.5, unit: 'allowance' },
      }
    );
    expect(split).toBeNull();
  });
});

describe('applyDraftToEstimate budget splits', () => {
  it('applies Step 3 scope package splits instead of stale room prices', () => {
    const draft = flooringDraft({
      applySuggestedSplits: true,
      pricingProposalApproved: true,
      scopeMeasurements: {
        floorAreaSqft: '850',
        baseboardLf: '220',
        itemQuantities: {
          flooring__material: { quantity: 3825, unit: 'allowance' },
          flooring__labor: { quantity: 2762.5, unit: 'allowance' },
        },
      },
      rooms: [
        {
          name: 'Demo existing tile which is 850 square feet.',
          scope: 'Demo existing tile which is 850 square feet.',
          price: 2550,
          laborPrice: 5313,
          materialPrice: 3825,
          priceIncludesLaborAndMaterials: true,
          priceProvidedByUser: true,
        },
      ],
    });

    const result = applyDraftToEstimate({}, draft, {
      applyConfirmedOnly: true,
      applySuggestedSplits: true,
    });

    const materials = result.materialsCart.map((item) => ({
      name: String(item.name),
      total: Number(item.total),
    }));
    const labor = (result.bid.laborLineItems as Array<Record<string, unknown>>).map((item) => ({
      name: String(item.name),
      total: Number(item.total),
    }));

    expect(materials).toEqual([
      { name: 'Tile Demo — materials', total: 425 },
      { name: 'LVP Flooring — materials', total: 3825 },
      { name: 'Baseboard — materials', total: 440 },
    ]);
    expect(labor).toEqual([
      { name: 'Tile Demo', total: 2125 },
      { name: 'LVP Flooring', total: 2762.5 },
      { name: 'Baseboard', total: 1100 },
    ]);
  });
});
