import { applyDraftToEstimate } from '@/utils/estimateAiDraft';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { applyPricingProposalToDraft } from '@/utils/estimateAiDraftPricing';
import { sumStep3ReviewBudgetTotals, sumAppliedScopePricingFromDraft } from '@/utils/benchmarkReasonablenessContext';
import { buildAcceptanceFromSuggestedBlock } from '@/utils/acceptedPricingSummaryUi';
import { compactPackagePricingSourceLabel } from '@/utils/estimateDraftReviewUi';

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

  it('apply Confirmed Only matches Step 3 totals — skips stale AI confirmed checklist prices', () => {
    const acceptance = (total: number, material: number, labor: number) =>
      buildAcceptanceFromSuggestedBlock({
        total,
        material,
        labor,
        lumpSumOnly: !(material > 0 && labor > 0),
        rateSourceLabel: 'National Average',
        materialSource: 'national_average',
        laborSource: 'national_average',
      });

    const draft = {
      projectType: 'bathroom',
      estimateTier: 'room_remodel',
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'bathroom',
        items: [
          { id: 'demo', label: 'Demo', state: 'included', inputType: 'yes_no' },
          { id: 'floor_tile', label: 'Floor tile', state: 'included', inputType: 'yes_no' },
          { id: 'toilet', label: 'Toilet', state: 'included', inputType: 'yes_no' },
          { id: 'vanity', label: 'Vanity', state: 'included', inputType: 'yes_no' },
          { id: 'plumbing_rough', label: 'Plumbing rough', state: 'included', inputType: 'yes_no' },
          { id: 'cleanup', label: 'Cleanup', state: 'included', inputType: 'yes_no' },
        ],
      },
      scopePackages: [
        {
          name: 'Bathroom Demo',
          scope: 'demo',
          checklistItemId: 'demo',
          price: 522.5,
          materialPrice: 209,
          laborPrice: 313.5,
          status: 'user_provided',
          priceProvidedByUser: true,
          applyEligible: true,
        },
        {
          name: 'Tile Installation',
          scope: 'floor tile',
          checklistItemId: 'floor_tile',
          price: 2520,
          materialPrice: 960,
          laborPrice: 1560,
          status: 'user_provided',
          priceProvidedByUser: true,
          applyEligible: true,
        },
        {
          name: 'Toilet Installation',
          scope: 'toilet',
          checklistItemId: 'toilet',
          price: 2500,
          status: 'confirmed',
          priceSource: 'ai_rough_estimate',
          // AI drafts often set applyEligible without Confirm Scope Applied —
          // must still be excluded from Bid Summary.
          applyEligible: true,
          priceIncludesLaborAndMaterials: true,
        },
        {
          name: 'Vanity Installation',
          scope: 'vanity',
          checklistItemId: 'vanity',
          price: 3500,
          status: 'confirmed',
          priceSource: 'ai_rough_estimate',
          applyEligible: true,
          priceIncludesLaborAndMaterials: true,
        },
        {
          name: 'Plumbing (Bathroom)',
          scope: 'plumbing rough',
          checklistItemId: 'plumbing_rough',
          price: 4500,
          status: 'confirmed',
          priceSource: 'ai_rough_estimate',
          applyEligible: true,
          priceIncludesLaborAndMaterials: true,
        },
        {
          name: 'Cleanup, Haul-off & Disposal',
          scope: 'cleanup',
          checklistItemId: 'cleanup',
          price: 1000,
          status: 'user_provided',
          priceProvidedByUser: true,
          applyEligible: true,
        },
      ],
      scopeMeasurements: {
        bathroomFloorSqft: 120,
        itemQuantities: {
          demo__material: { quantity: '209', unit: 'allowance', quantitySource: 'user_entered' },
          demo__labor: { quantity: '313.5', unit: 'allowance', quantitySource: 'user_entered' },
          floor_tile__material: { quantity: '960', unit: 'allowance', quantitySource: 'user_entered' },
          floor_tile__labor: { quantity: '1560', unit: 'allowance', quantitySource: 'user_entered' },
          cleanup: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          demo: acceptance(522.5, 209, 313.5),
          floor_tile: acceptance(2520, 960, 1560),
          cleanup: acceptance(1000, 0, 0),
        },
      },
      applySuggestedSplits: false,
    } as unknown as EstimateAiDraft;

    const step3Applied = sumAppliedScopePricingFromDraft(draft);
    expect(step3Applied?.total).toBeCloseTo(4042.5, 2);

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
    const allowanceTotal = (bid.allowanceLineItems as Array<{ amount?: number; total?: number }>).reduce(
      (s, l) => s + (Number(l.amount ?? l.total) || 0),
      0
    );

    expect(materialTotal + laborTotal + allowanceTotal).toBeCloseTo(step3Applied!.total, 2);
    // Stale AI confirmed+applyEligible rows ($2,500 + $3,500 + $4,500) must not inflate the bid.
    expect(materialTotal + laborTotal + allowanceTotal).toBeLessThan(9000);
    expect(materialTotal + laborTotal + allowanceTotal).toBeCloseTo(4042.5, 2);
    expect(
      (bid.laborLineItems as Array<{ name?: string }>).some((l) => /Toilet|Vanity|Plumbing/i.test(String(l.name)))
    ).toBe(false);
  });

  it('Bid Summary subtotal matches Step 3 when AI confirmed+applyEligible extras exist', () => {
    const acceptance = (total: number, material: number, labor: number) =>
      buildAcceptanceFromSuggestedBlock({
        total,
        material,
        labor,
        lumpSumOnly: !(material > 0 && labor > 0),
        rateSourceLabel: 'National Average',
        materialSource: 'national_average',
        laborSource: 'national_average',
      });

    // Mirrors the ~$20k Step 3 vs ~$37k Bid Summary bug: Applied scopes only,
    // plus AI packages marked confirmed/applyEligible that Step 3 correctly ignores.
    const draft = {
      projectType: 'bathroom',
      estimateTier: 'room_remodel',
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'bathroom',
        items: [
          { id: 'demo', label: 'Demo', state: 'included', inputType: 'yes_no' },
          { id: 'floor_tile', label: 'Floor tile', state: 'included', inputType: 'yes_no' },
          { id: 'shower_tile', label: 'Shower tile', state: 'included', inputType: 'yes_no' },
          { id: 'waterproofing', label: 'Waterproofing', state: 'included', inputType: 'yes_no' },
          { id: 'glass_door', label: 'Glass door', state: 'included', inputType: 'yes_no' },
          { id: 'interior_paint', label: 'Paint', state: 'included', inputType: 'yes_no' },
          { id: 'cleanup', label: 'Cleanup', state: 'included', inputType: 'yes_no' },
          { id: 'toilet', label: 'Toilet', state: 'included', inputType: 'yes_no' },
          { id: 'vanity', label: 'Vanity', state: 'included', inputType: 'yes_no' },
          { id: 'plumbing_rough', label: 'Plumbing rough', state: 'included', inputType: 'yes_no' },
        ],
      },
      scopePackages: [
        {
          name: 'Bathroom Demo',
          checklistItemId: 'demo',
          price: 522.5,
          materialPrice: 209,
          laborPrice: 313.5,
          status: 'user_provided',
          priceProvidedByUser: true,
          applyEligible: true,
        },
        {
          name: 'Tile Installation',
          checklistItemId: 'floor_tile',
          price: 2520,
          materialPrice: 960,
          laborPrice: 1560,
          status: 'user_provided',
          priceProvidedByUser: true,
          applyEligible: true,
        },
        {
          name: 'Shower Tile Installation',
          checklistItemId: 'shower_tile',
          price: 2080,
          materialPrice: 960,
          laborPrice: 1120,
          status: 'user_provided',
          priceProvidedByUser: true,
          applyEligible: true,
        },
        {
          name: 'Shower Waterproofing & Backer Board',
          checklistItemId: 'waterproofing',
          price: 960,
          materialPrice: 400,
          laborPrice: 560,
          status: 'user_provided',
          priceProvidedByUser: true,
          applyEligible: true,
        },
        {
          name: 'Glass Shower Door Install',
          checklistItemId: 'glass_door',
          price: 1650,
          materialPrice: 950,
          laborPrice: 700,
          status: 'user_provided',
          priceProvidedByUser: true,
          applyEligible: true,
        },
        {
          name: 'Interior Painting',
          checklistItemId: 'interior_paint',
          price: 350,
          materialPrice: 75,
          laborPrice: 275,
          status: 'user_provided',
          priceProvidedByUser: true,
          applyEligible: true,
        },
        {
          name: 'Cleanup, Haul-off & Disposal',
          checklistItemId: 'cleanup',
          price: 1000,
          status: 'user_provided',
          priceProvidedByUser: true,
          applyEligible: true,
        },
        {
          name: 'Toilet Installation',
          checklistItemId: 'toilet',
          price: 2500,
          status: 'confirmed',
          applyEligible: true,
          priceSource: 'ai_rough_estimate',
        },
        {
          name: 'Vanity Installation',
          checklistItemId: 'vanity',
          price: 3500,
          status: 'confirmed',
          applyEligible: true,
          priceSource: 'ai_rough_estimate',
        },
        {
          name: 'Plumbing (Bathroom)',
          checklistItemId: 'plumbing_rough',
          price: 4500,
          status: 'confirmed',
          applyEligible: true,
          priceSource: 'ai_rough_estimate',
        },
      ],
      scopeMeasurements: {
        bathroomFloorSqft: 120,
        showerWallTileSqft: 80,
        itemQuantities: {
          demo__material: { quantity: '209', unit: 'allowance', quantitySource: 'user_entered' },
          demo__labor: { quantity: '313.5', unit: 'allowance', quantitySource: 'user_entered' },
          floor_tile__material: { quantity: '960', unit: 'allowance', quantitySource: 'user_entered' },
          floor_tile__labor: { quantity: '1560', unit: 'allowance', quantitySource: 'user_entered' },
          shower_tile__material: { quantity: '960', unit: 'allowance', quantitySource: 'user_entered' },
          shower_tile__labor: { quantity: '1120', unit: 'allowance', quantitySource: 'user_entered' },
          waterproofing__material: { quantity: '400', unit: 'allowance', quantitySource: 'user_entered' },
          waterproofing__labor: { quantity: '560', unit: 'allowance', quantitySource: 'user_entered' },
          glass_door__material: { quantity: '950', unit: 'allowance', quantitySource: 'user_entered' },
          glass_door__labor: { quantity: '700', unit: 'allowance', quantitySource: 'user_entered' },
          interior_paint__material: { quantity: '75', unit: 'allowance', quantitySource: 'user_entered' },
          interior_paint__labor: { quantity: '275', unit: 'allowance', quantitySource: 'user_entered' },
          cleanup: { quantity: '1000', unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          demo: acceptance(522.5, 209, 313.5),
          floor_tile: acceptance(2520, 960, 1560),
          shower_tile: acceptance(2080, 960, 1120),
          waterproofing: acceptance(960, 400, 560),
          glass_door: acceptance(1650, 950, 700),
          interior_paint: acceptance(350, 75, 275),
          cleanup: acceptance(1000, 0, 0),
        },
      },
      applySuggestedSplits: false,
    } as unknown as EstimateAiDraft;

    const step3 = sumStep3ReviewBudgetTotals(draft);
    expect(step3?.total).toBeCloseTo(9082.5, 2);

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
    const allowanceTotal = (bid.allowanceLineItems as Array<{ amount?: number; total?: number }>).reduce(
      (s, l) => s + (Number(l.amount ?? l.total) || 0),
      0
    );
    const bidSubtotal = materialTotal + laborTotal + allowanceTotal;

    expect(bidSubtotal).toBeCloseTo(step3!.total, 2);
    // Without the fix, toilet+vanity+plumbing (~$10.5k) inflate Bid Summary past Step 3.
    expect(bidSubtotal).toBeLessThan(10000);
  });
});

describe('Step 3 scope row pricing source labels', () => {
  it('shows User entered from pricingAcceptance metadata', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'bathroom',
        items: [
          {
            id: 'waterproofing',
            label: 'Shower waterproofing & backer board',
            inputType: 'yes_no',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        itemQuantities: {
          waterproofing__allowance: {
            quantity: '1400',
            unit: 'allowance',
            quantitySource: 'user_entered',
          },
        },
        pricingAcceptance: {
          waterproofing: {
            selectionStatus: 'user_entered',
            pricingSourceLabel: 'User entered',
            pricingSourceKind: 'user_entered',
            totalAmount: 1400,
          },
        },
      },
    } as unknown as EstimateAiDraft;
    const label = compactPackagePricingSourceLabel(
      {
        name: 'Shower waterproofing & backer board',
        scope: 'waterproofing',
        checklistItemId: 'waterproofing',
        status: 'user_provided',
      },
      draft
    );
    expect(label).toBe('User entered');
  });

  it('shows Applied when user tapped Apply on Step 2', () => {
    const draft = {
      scopeAssumptionsConfirmed: true,
      scopeChecklist: {
        templateKey: 'bathroom',
        items: [
          {
            id: 'waterproofing',
            label: 'Shower waterproofing & backer board',
            inputType: 'yes_no',
            state: 'included',
          },
        ],
      },
      scopeMeasurements: {
        itemQuantities: {
          waterproofing__allowance: { quantity: '1100', unit: 'allowance', quantitySource: 'user_entered' },
        },
        pricingAcceptance: {
          waterproofing: {
            selectionStatus: 'accepted',
            pricingSourceLabel: 'BPS national benchmark',
            pricingSourceKind: 'national_average',
            totalAmount: 1100,
          },
        },
      },
    } as unknown as EstimateAiDraft;
    const label = compactPackagePricingSourceLabel(
      {
        name: 'Shower waterproofing & backer board',
        scope: 'waterproofing',
        checklistItemId: 'waterproofing',
        status: 'user_provided',
      },
      draft
    );
    expect(label).toBe('Applied');
  });
});
