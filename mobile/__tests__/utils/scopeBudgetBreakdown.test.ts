import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { applyDraftToEstimate } from '@/utils/estimateAiDraft';
import {
  lookupRuleKeyForBudgetPackage,
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

  it('uses selected saved-rate split even when it is lower than the stale package total', () => {
    const draft = flooringDraft({
      scopeMeasurements: {
        floorAreaSqft: '850',
        baseboardLf: '220',
        itemQuantities: {
          flooring: { quantity: 850, unit: 'sqft', quantitySource: 'user_entered' },
          flooring__material: { quantity: 2550, unit: 'allowance', quantitySource: 'user_entered' },
          flooring__labor: { quantity: 3400, unit: 'allowance', quantitySource: 'user_entered' },
          flooring__allowance: { quantity: 5950, unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
      scopePackages: [
        {
          name: 'LVP Flooring Installation',
          price: 6800,
          status: 'partial_pricing',
          priceSource: 'notes',
          scopeQuantities: [{ quantity: 850, unit: 'sqft' }],
        },
      ],
    });
    const breakdown = resolveScopePackageBudgetBreakdown(draft.scopePackages![0], draft);
    expect(breakdown).toMatchObject({
      total: 5950,
      material: 2550,
      labor: 3400,
      materialSource: 'manual',
      laborSource: 'manual',
    });
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

  it('rejects stale material/labor splits that do not match the package total', () => {
    const draft = flooringDraft({
      scopeMeasurements: {
        floorAreaSqft: '850',
        baseboardLf: '220',
        itemQuantities: {
          floor_demo__material: { quantity: 3825, unit: 'allowance' },
          floor_demo__labor: { quantity: 5313, unit: 'allowance' },
        },
      },
      scopePackages: [
        {
          name: 'Tile Demo',
          price: 2550,
          materialPrice: 3825,
          laborPrice: 5313,
          status: 'calculated',
          priceSource: 'notes',
          scopeQuantities: [{ quantity: 850, unit: 'sqft' }],
        },
      ],
    });
    const breakdown = resolveScopePackageBudgetBreakdown(draft.scopePackages![0], draft);
    expect(breakdown).toMatchObject({
      total: 2550,
      material: 425,
      labor: 2125,
      materialSource: 'suggested',
      laborSource: 'suggested',
    });
  });

  it('shows Framing / shell material+labor from rough pricing even without Confirm Scope keys', () => {
    const draft = {
      projectType: 'adu',
      originalNotes: '800 sqft ADU',
      scopeMeasurements: { itemQuantities: {} },
      scopePackages: [
        {
          name: 'Framing / shell',
          scope: 'framing',
          price: 32000,
          materialPrice: 14400,
          laborPrice: 17600,
          priceSource: 'ai_rough_estimate',
          status: 'confirmed',
          knownSubtotal: 32000,
          scopeQuantities: [{ quantity: 800, unit: 'sqft' }],
          splitIsSuggested: false,
          applyEligible: true,
        },
      ],
      rooms: [],
    } as EstimateAiDraft;

    const framingBreakdown = resolveScopePackageBudgetBreakdown(draft.scopePackages![0], draft);
    expect(framingBreakdown).toMatchObject({
      total: 32000,
      material: 14400,
      labor: 17600,
      materialSource: 'suggested',
      laborSource: 'suggested',
    });
  });

  it('shows split from pricingItems when package material/labor fields are empty', () => {
    const draft = {
      projectType: 'adu',
      originalNotes: '800 sqft ADU',
      scopeMeasurements: { itemQuantities: {} },
      scopePackages: [
        {
          name: 'HVAC',
          scope: 'hvac',
          price: 11200,
          materialPrice: null,
          laborPrice: null,
          priceSource: 'ai_rough_estimate',
          status: 'confirmed',
          knownSubtotal: 11200,
          scopeQuantities: [{ quantity: 800, unit: 'sqft' }],
          pricingItems: [
            { name: 'HVAC materials', amount: 4800, pricingType: 'material' },
            { name: 'HVAC labor', amount: 6400, pricingType: 'labor' },
          ],
          applyEligible: true,
        },
      ],
      rooms: [],
    } as EstimateAiDraft;

    expect(resolveScopePackageBudgetBreakdown(draft.scopePackages![0], draft)).toMatchObject({
      total: 11200,
      material: 4800,
      labor: 6400,
    });
  });

  it('shows split from pending pricing proposal before packages are updated', () => {
    const draft = {
      projectType: 'adu',
      originalNotes: '800 sqft ADU',
      scopeMeasurements: { itemQuantities: {} },
      pendingPricingProposal: {
        empty: false,
        source: 'ai_rough_estimate',
        lines: [
          {
            packageName: 'Insulation',
            lineType: 'material',
            label: 'Insulation materials',
            total: 1000,
            unitType: 'sqft',
            quantity: 800,
            unitRate: 1.25,
          },
          {
            packageName: 'Insulation',
            lineType: 'labor',
            label: 'Insulation labor',
            total: 1400,
            unitType: 'sqft',
            quantity: 800,
            unitRate: 1.75,
          },
        ],
      },
      scopePackages: [
        {
          name: 'Insulation',
          scope: 'insulation',
          price: null,
          materialPrice: null,
          laborPrice: null,
          priceSource: 'missing',
          status: 'missing_price',
          knownSubtotal: null,
          scopeQuantities: [{ quantity: 800, unit: 'sqft' }],
        },
      ],
      rooms: [],
    } as EstimateAiDraft;

    expect(resolveScopePackageBudgetBreakdown(draft.scopePackages![0], draft)).toMatchObject({
      total: 2400,
      material: 1000,
      labor: 1400,
      materialSource: 'suggested',
    });
  });

  it('infers labor remainder when only materialPrice is set', () => {
    const draft = {
      projectType: 'adu',
      originalNotes: '800 sqft ADU',
      scopeMeasurements: { itemQuantities: {} },
      scopePackages: [
        {
          name: 'Drywall',
          scope: 'drywall',
          price: 12600,
          materialPrice: 4200,
          laborPrice: null,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 12600,
          scopeQuantities: [{ quantity: 2800, unit: 'sqft' }],
        },
      ],
      rooms: [],
    } as EstimateAiDraft;

    expect(resolveScopePackageBudgetBreakdown(draft.scopePackages![0], draft)).toMatchObject({
      total: 12600,
      material: 4200,
      labor: 8400,
      materialSource: 'manual',
    });
  });

  it('maps Roofing / tie-in and Decking package names to budget split keys', () => {
    expect(lookupRuleKeyForBudgetPackage('Roofing / tie-in')).toBe('shingles_roofing');
    expect(lookupRuleKeyForBudgetPackage('Decking')).toBe('decking');
    expect(lookupRuleKeyForBudgetPackage('Framing / shell')).toBe('framing');
    expect(lookupRuleKeyForBudgetPackage('Windows & doors')).toBe('windows_doors');
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
