import { applyDraftToEstimate } from '@/utils/estimateAiDraft';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { applyPricingProposalToDraft } from '@/utils/estimateAiDraftPricing';

describe('Step 3 pricing syncs into final bid line items', () => {
  it('preserves existing scopePackages when applying a rough proposal', () => {
    const draft = {
      projectType: 'adu',
      estimateTier: 'addition',
      originalNotes: '800 sqft ADU',
      rooms: [],
      scopePackages: [
        {
          name: 'Framing / shell',
          scope: 'framing',
          scopeQuantities: [{ quantity: 800, unit: 'sqft' }],
          price: null,
          laborPrice: null,
          materialPrice: null,
          pricingType: 'unknown',
          includesLabor: null,
          includesMaterials: null,
          priceSource: 'missing',
          status: 'missing_price',
          knownSubtotal: null,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
        },
        {
          name: 'Interior Painting',
          scope: 'paint',
          scopeQuantities: [{ quantity: 2560, unit: 'sqft' }],
          price: 8576,
          laborPrice: 6400,
          materialPrice: 2176,
          pricingType: 'split',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 8576,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceProvidedByUser: true,
        },
      ],
      scopeMeasurements: { itemQuantities: {} },
    } as unknown as EstimateAiDraft;

    const proposal = {
      empty: false,
      source: 'ai_rough_estimate' as const,
      sourceLabel: 'National Average',
      lines: [
        {
          packageName: 'Framing / shell',
          lineType: 'material' as const,
          label: 'Framing materials',
          unitType: 'sqft',
          quantity: 800,
          unitRate: 14,
          total: 11200,
          formula: '800 sqft × $14',
          priceSource: 'national_trade_average',
          sourceLabel: 'National Average',
          confidence: 'low',
          status: 'rough_price',
          requiresApproval: true,
        },
        {
          packageName: 'Framing / shell',
          lineType: 'labor' as const,
          label: 'Framing labor',
          unitType: 'sqft',
          quantity: 800,
          unitRate: 18,
          total: 14400,
          formula: '800 sqft × $18',
          priceSource: 'national_trade_average',
          sourceLabel: 'National Average',
          confidence: 'medium',
          status: 'rough_price',
          requiresApproval: true,
        },
      ],
      totalSuggested: 25600,
    };

    const next = applyPricingProposalToDraft(draft, proposal, { approved: true });
    expect(next.scopePackages?.length).toBe(2);
    const framing = next.scopePackages?.find((p) => p.name === 'Framing / shell');
    const paint = next.scopePackages?.find((p) => p.name === 'Interior Painting');
    expect(framing?.price).toBe(25600);
    expect(framing?.applyEligible).toBe(true);
    expect(framing?.status).toBe('confirmed');
    expect(paint?.price).toBe(8576);
    expect(paint?.status).toBe('user_provided');
  });

  it('applies confirmed packages including approved rough pricing into labor/material lines', () => {
    const draft = {
      projectType: 'adu',
      estimateTier: 'addition',
      originalNotes: '800 sqft ADU',
      rooms: [],
      scopePackages: [
        {
          name: 'Framing / shell',
          scope: 'framing',
          scopeQuantities: [{ quantity: 800, unit: 'sqft' }],
          price: 25600,
          laborPrice: 14400,
          materialPrice: 11200,
          pricingType: 'split',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'ai_rough_estimate',
          status: 'confirmed',
          knownSubtotal: 25600,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceIncludesLaborAndMaterials: true,
        },
        {
          name: 'Interior Painting',
          scope: 'paint',
          scopeQuantities: [{ quantity: 2560, unit: 'sqft' }],
          price: 8576,
          laborPrice: 6400,
          materialPrice: 2176,
          pricingType: 'split',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 8576,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceProvidedByUser: true,
          priceIncludesLaborAndMaterials: true,
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          paint__material: { quantity: 2176, unit: 'allowance', quantitySource: 'user_entered' },
          paint__labor: { quantity: 6400, unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
      applySuggestedSplits: true,
    } as unknown as EstimateAiDraft;

    const { bid, materialsCart } = applyDraftToEstimate({}, draft, {
      applyConfirmedOnly: true,
      applySuggestedSplits: true,
    });

    const laborTotal = (bid.laborLineItems as Array<{ total?: number }>).reduce(
      (s, l) => s + (Number(l.total) || 0),
      0
    );
    const materialTotal = (bid.materialLineItems as Array<{ total?: number }>).reduce(
      (s, l) => s + (Number(l.total) || 0),
      0
    );

    expect(laborTotal).toBeGreaterThanOrEqual(14400 + 6400);
    expect(materialTotal).toBeGreaterThanOrEqual(11200 + 2176);
    expect(materialsCart.length).toBeGreaterThan(0);
    expect((bid.laborLineItems as unknown[]).length).toBeGreaterThanOrEqual(2);
  });

  it('does not double-count materialPrice and pricingItems materials on apply', () => {
    // Reproduces the ~$20k Step 3 → Estimate overage: approved proposals store both
    // materialPrice and matching pricingItems; apply must emit materials once.
    const draft = {
      projectType: 'adu',
      estimateTier: 'addition',
      originalNotes: '800 sqft ADU',
      rooms: [],
      scopePackages: [
        {
          name: 'Framing / shell',
          scope: 'framing',
          scopeQuantities: [{ quantity: 800, unit: 'sqft' }],
          price: 32000,
          laborPrice: 18000,
          materialPrice: 14000,
          pricingType: 'split',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'ai_rough_estimate',
          status: 'confirmed',
          knownSubtotal: 32000,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [
            {
              name: 'Framing materials',
              amount: 14000,
              pricingType: 'material',
              status: 'confirmed',
              approvedByUser: true,
            },
            {
              name: 'Framing labor',
              amount: 18000,
              pricingType: 'labor',
              status: 'confirmed',
              approvedByUser: true,
            },
          ],
          applyEligible: true,
          priceIncludesLaborAndMaterials: true,
        },
        {
          name: 'Permits / fees',
          scope: 'permits',
          price: 3500,
          laborPrice: null,
          materialPrice: null,
          pricingType: 'lump_sum',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 3500,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceProvidedByUser: true,
          priceIncludesLaborAndMaterials: true,
        },
      ],
      scopeMeasurements: { itemQuantities: {} },
      applySuggestedSplits: true,
    } as unknown as EstimateAiDraft;

    const { bid } = applyDraftToEstimate({}, draft, {
      applyConfirmedOnly: true,
      applySuggestedSplits: true,
    });

    const laborTotal = (bid.laborLineItems as Array<{ total?: number }>).reduce(
      (s, l) => s + (Number(l.total) || 0),
      0
    );
    const materialTotal = (bid.materialLineItems as Array<{ total?: number }>).reduce(
      (s, l) => s + (Number(l.total) || 0),
      0
    );

    // Framing $32k + permits $3.5k — not framing materials twice ($14k extra).
    expect(materialTotal).toBe(14000);
    expect(laborTotal).toBe(18000);
    const allowanceTotal = (bid.allowanceLineItems as Array<{ amount?: number; total?: number }>).reduce(
      (s, l) => s + (Number(l.amount ?? l.total) || 0),
      0
    );
    expect(allowanceTotal).toBe(3500);
    expect(laborTotal + materialTotal + allowanceTotal).toBe(35500);
  });

  it('uses labor remainder when package has materials but no laborPrice', () => {
    const draft = {
      projectType: 'adu',
      estimateTier: 'addition',
      originalNotes: '800 sqft ADU',
      rooms: [],
      scopePackages: [
        {
          name: 'HVAC',
          scope: 'hvac',
          scopeQuantities: [{ quantity: 800, unit: 'sqft' }],
          price: 11200,
          laborPrice: null,
          materialPrice: 4200,
          pricingType: 'split',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'ai_rough_estimate',
          status: 'confirmed',
          knownSubtotal: 11200,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceIncludesLaborAndMaterials: true,
        },
      ],
      scopeMeasurements: { itemQuantities: {} },
    } as unknown as EstimateAiDraft;

    const { bid } = applyDraftToEstimate({}, draft, { applyConfirmedOnly: true });
    const laborTotal = (bid.laborLineItems as Array<{ total?: number }>).reduce(
      (s, l) => s + (Number(l.total) || 0),
      0
    );
    const materialTotal = (bid.materialLineItems as Array<{ total?: number }>).reduce(
      (s, l) => s + (Number(l.total) || 0),
      0
    );

    expect(materialTotal).toBe(4200);
    expect(laborTotal).toBe(7000);
    expect(laborTotal + materialTotal).toBe(11200);
  });

  it('does not treat combined laborPrice as labor when materials are also set', () => {
    const draft = {
      projectType: 'adu',
      estimateTier: 'addition',
      originalNotes: '800 sqft ADU',
      rooms: [],
      scopePackages: [
        {
          name: 'Framing / shell',
          scope: 'framing',
          price: 32000,
          laborPrice: 32000,
          materialPrice: 14000,
          pricingType: 'split',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'ai_rough_estimate',
          status: 'confirmed',
          knownSubtotal: 32000,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceIncludesLaborAndMaterials: true,
        },
      ],
      scopeMeasurements: { itemQuantities: {} },
    } as unknown as EstimateAiDraft;

    const { bid } = applyDraftToEstimate({}, draft, { applyConfirmedOnly: true });
    const laborTotal = (bid.laborLineItems as Array<{ total?: number }>).reduce(
      (s, l) => s + (Number(l.total) || 0),
      0
    );
    const materialTotal = (bid.materialLineItems as Array<{ total?: number }>).reduce(
      (s, l) => s + (Number(l.total) || 0),
      0
    );

    expect(materialTotal).toBe(14000);
    expect(laborTotal).toBe(18000);
    expect(laborTotal + materialTotal).toBe(32000);
  });

  it('keeps Step 3 allowance packages combined — does not invent national material splits', () => {
    // Step 3: Materials $X, Labor $Y, Allowances (unsplit packages).
    // Apply Confirmed Only must not force National Average splits onto allowances.
    const draft = {
      projectType: 'adu',
      estimateTier: 'addition',
      originalNotes: '800 sqft ADU',
      rooms: [],
      applySuggestedSplits: false,
      scopePackages: [
        {
          name: 'Interior Painting',
          scope: 'paint',
          price: 8576,
          laborPrice: 6400,
          materialPrice: 2176,
          pricingType: 'split',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 8576,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceProvidedByUser: true,
          splitIsSuggested: false,
          priceIncludesLaborAndMaterials: true,
        },
        {
          name: 'Framing / shell',
          scope: 'framing',
          price: 32000,
          laborPrice: null,
          materialPrice: null,
          pricingType: 'lump_sum',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 32000,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceProvidedByUser: true,
          splitIsSuggested: false,
          priceIncludesLaborAndMaterials: true,
        },
        {
          name: 'HVAC',
          scope: 'hvac',
          price: 11200,
          laborPrice: null,
          materialPrice: null,
          pricingType: 'lump_sum',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 11200,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceProvidedByUser: true,
          splitIsSuggested: false,
          priceIncludesLaborAndMaterials: true,
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          paint__material: { quantity: 2176, unit: 'allowance', quantitySource: 'user_entered' },
          paint__labor: { quantity: 6400, unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
    } as unknown as EstimateAiDraft;

    const { bid } = applyDraftToEstimate({}, draft, {
      applyConfirmedOnly: true,
      applySuggestedSplits: false,
    });

    const laborLines = bid.laborLineItems as Array<{ name?: string; total?: number }>;
    const materialLines = bid.materialLineItems as Array<{ name?: string; total?: number }>;
    const laborTotal = laborLines.reduce((s, l) => s + (Number(l.total) || 0), 0);
    const materialTotal = materialLines.reduce((s, l) => s + (Number(l.total) || 0), 0);

    expect(materialTotal).toBe(2176);
    expect(laborTotal).toBe(6400 + 32000 + 11200);
    expect(laborTotal + materialTotal).toBe(8576 + 32000 + 11200);
    expect(materialLines.some((l) => /Framing|HVAC/i.test(String(l.name || '')))).toBe(false);
    expect(laborLines.find((l) => l.name === 'Framing / shell')?.total).toBe(32000);
    expect(laborLines.find((l) => l.name === 'HVAC')?.total).toBe(11200);
  });

  it('applies confirmed Manual material split and keeps package remainder on labor', () => {
    // Step 3 Framing $32k with Manual $1,200 / $1,800 shown — remainder stays combined on labor.
    const draft = {
      projectType: 'adu',
      estimateTier: 'addition',
      originalNotes: '800 sqft ADU',
      rooms: [],
      applySuggestedSplits: false,
      scopePackages: [
        {
          name: 'Framing / shell',
          scope: 'framing',
          scopeQuantities: [{ quantity: 800, unit: 'sqft' }],
          price: 32000,
          laborPrice: 1800,
          materialPrice: 1200,
          pricingType: 'split',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 32000,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceProvidedByUser: true,
          splitIsSuggested: false,
          priceIncludesLaborAndMaterials: true,
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          framing__material: { quantity: 1200, unit: 'allowance', quantitySource: 'user_entered' },
          framing__labor: { quantity: 1800, unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
    } as unknown as EstimateAiDraft;

    const { bid } = applyDraftToEstimate({}, draft, {
      applyConfirmedOnly: true,
      applySuggestedSplits: false,
    });

    const laborTotal = (bid.laborLineItems as Array<{ total?: number }>).reduce(
      (s, l) => s + (Number(l.total) || 0),
      0
    );
    const materialTotal = (bid.materialLineItems as Array<{ total?: number }>).reduce(
      (s, l) => s + (Number(l.total) || 0),
      0
    );

    expect(materialTotal).toBe(1200);
    expect(laborTotal).toBe(30800);
    expect(laborTotal + materialTotal).toBe(32000);
  });

  it('routes soft-cost lump sums into allowanceLineItems, not labor', () => {
    const draft = {
      projectType: 'adu',
      estimateTier: 'addition',
      originalNotes: '800 sqft ADU',
      rooms: [],
      applySuggestedSplits: false,
      scopePackages: [
        {
          name: 'Permits / fees',
          scope: 'permits',
          price: 3500,
          laborPrice: null,
          materialPrice: null,
          pricingType: 'lump_sum',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 3500,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceProvidedByUser: true,
          splitIsSuggested: false,
          priceIncludesLaborAndMaterials: true,
        },
        {
          name: 'Cleanup / disposal',
          scope: 'cleanup',
          price: 1000,
          laborPrice: null,
          materialPrice: null,
          pricingType: 'lump_sum',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 1000,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceProvidedByUser: true,
          splitIsSuggested: false,
          priceIncludesLaborAndMaterials: true,
        },
        {
          name: 'HVAC',
          scope: 'hvac',
          price: 11200,
          laborPrice: null,
          materialPrice: null,
          pricingType: 'lump_sum',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 11200,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceProvidedByUser: true,
          splitIsSuggested: false,
          priceIncludesLaborAndMaterials: true,
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          permits__allowance: { quantity: 3500, unit: 'allowance', quantitySource: 'user_entered' },
          cleanup__allowance: { quantity: 1000, unit: 'allowance', quantitySource: 'user_entered' },
        },
      },
    } as unknown as EstimateAiDraft;

    const { bid } = applyDraftToEstimate({}, draft, {
      applyConfirmedOnly: true,
      applySuggestedSplits: false,
    });

    const laborLines = bid.laborLineItems as Array<{ name?: string; total?: number }>;
    const allowanceLines = bid.allowanceLineItems as Array<{
      name?: string;
      amount?: number;
      total?: number;
      category?: string;
    }>;

    expect(laborLines.find((l) => l.name === 'HVAC')?.total).toBe(11200);
    expect(laborLines.some((l) => /Permit|Cleanup/i.test(String(l.name || '')))).toBe(false);
    expect(allowanceLines).toHaveLength(2);
    expect(allowanceLines.find((l) => l.name === 'Permits / fees')?.amount).toBe(3500);
    expect(allowanceLines.find((l) => l.name === 'Cleanup / disposal')?.amount).toBe(1000);
    expect(allowanceLines.every((l) => l.category === 'Allowance')).toBe(true);
  });

  it('routes contingency and mobilization soft costs into allowanceLineItems by name/scope', () => {
    const draft = {
      projectType: 'adu',
      estimateTier: 'addition',
      originalNotes: '800 sqft ADU',
      rooms: [],
      applySuggestedSplits: false,
      scopePackages: [
        {
          name: 'Contingency',
          scope: 'contingency',
          price: 5000,
          laborPrice: null,
          materialPrice: null,
          pricingType: 'lump_sum',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 5000,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceProvidedByUser: true,
          splitIsSuggested: false,
          priceIncludesLaborAndMaterials: true,
        },
        {
          name: 'Mobilization / job setup',
          scope: 'mobilization',
          price: 750,
          laborPrice: null,
          materialPrice: null,
          pricingType: 'lump_sum',
          includesLabor: true,
          includesMaterials: true,
          priceSource: 'user_provided',
          status: 'user_provided',
          knownSubtotal: 750,
          formula: null,
          missingInfo: [],
          missingPriceItems: [],
          pricingItems: [],
          applyEligible: true,
          priceProvidedByUser: true,
          splitIsSuggested: false,
          priceIncludesLaborAndMaterials: true,
        },
      ],
      scopeMeasurements: { itemQuantities: {} },
    } as unknown as EstimateAiDraft;

    const { bid } = applyDraftToEstimate({}, draft, {
      applyConfirmedOnly: true,
      applySuggestedSplits: false,
    });

    const laborLines = bid.laborLineItems as Array<{ name?: string }>;
    const allowanceLines = bid.allowanceLineItems as Array<{ name?: string; amount?: number }>;

    expect(laborLines).toHaveLength(0);
    expect(allowanceLines).toHaveLength(2);
    expect(allowanceLines.find((l) => l.name === 'Contingency')?.amount).toBe(5000);
    expect(allowanceLines.find((l) => /Mobilization/i.test(String(l.name || '')))?.amount).toBe(750);
  });

  it('applies Ask AI Disposal Bid when it exists only on rooms, not scopePackages', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'ground_up',
        items: [{ id: 'framing', label: 'Framing', inputType: 'yes_no', state: 'included' }],
      },
      scopePackages: [
        {
          name: 'Framing',
          scope: 'framing',
          checklistItemId: 'framing',
          price: 500000,
          knownSubtotal: 500000,
          status: 'user_provided',
          priceProvidedByUser: true,
        },
      ],
      rooms: [
        {
          name: 'Framing',
          scope: 'framing',
          price: 500000,
          priceProvidedByUser: true,
          priceIncludesLaborAndMaterials: true,
        },
        {
          name: 'Disposal Bid',
          scope: 'Disposal Bid',
          price: 8000,
          priceProvidedByUser: true,
          priceIncludesLaborAndMaterials: true,
          scopeQuantities: [{ quantity: 1, unit: 'lump_sum', quantitySource: 'user_entered' }],
        },
      ],
      scopeMeasurements: {
        itemQuantities: {
          framing: { quantity: 500000, unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: { framing: { status: 'accepted', totalAmount: 500000 } },
      },
    } as unknown as EstimateAiDraft;

    const { bid } = applyDraftToEstimate({}, draft, {
      applyConfirmedOnly: true,
      applySuggestedSplits: false,
    });

    const laborLines = bid.laborLineItems as Array<{ name?: string; total?: number }>;
    const laborSum = laborLines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);
    expect(laborLines.some((l) => l.name === 'Disposal Bid' && l.total === 8000)).toBe(true);
    expect(laborSum).toBe(508000);
  });
});
