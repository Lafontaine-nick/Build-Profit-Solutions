import {
  applyPriceActionLabel,
  buildSuggestedPricingCardDisplay,
  displayPriceSourceLabel,
  formatFallbackBasisLine,
  formatQuantityProvenanceLine,
  formatSuggestedComponentMoney,
  formatSuggestedDisplayMoney,
  formatSuggestedSplitLine,
  isLivingAreaFallbackPricing,
  normalizeQuantitySource,
  quantityProvenanceLabel,
  resolveSuggestedActionType,
  roundSuggestedDisplayComponent,
  roundSuggestedDisplayTotal,
  suggestedActionLabel,
  suggestedCardTitle,
} from '@/utils/suggestedPricingCardUi';
import { benchmarkActionButtonLabel, missingStatusDisplayLabel } from '@/utils/measurementSemantics/scopePriceUi';
import { SCOPE_PARSED_FROM_NOTES_LABEL } from '@/constants/scopeNoteSourceLabels';
import type { SuggestedPricingBlock } from '@/utils/scopeItemQuantities';

function block(overrides: Partial<SuggestedPricingBlock> = {}): SuggestedPricingBlock {
  return {
    material: 27840.44,
    labor: 19510.22,
    total: 47350.66,
    materialSource: 'national_average',
    laborSource: 'national_average',
    rateSourceLabel: 'Suggested · National Average (builder-budget calibrated)',
    helper: 'Based on 2,873 sqft · suggested pricing',
    mode: 'suggested_price',
    basis: { quantity: 2873, unit: 'sqft' },
    costBuckets: [
      { key: 'material', label: 'Material', amount: 27840.44, source: 'national_average' },
      { key: 'labor', label: 'Labor', amount: 19510.22, source: 'national_average' },
    ],
    ...overrides,
  };
}

describe('suggestedPricingCardUi', () => {
  it('shortens national source labels to BPS national benchmark', () => {
    expect(displayPriceSourceLabel('Suggested · National Average (builder-budget calibrated)')).toBe(
      'BPS national benchmark'
    );
    expect(displayPriceSourceLabel('National Average')).toBe('BPS national benchmark');
  });

  it('normalizes quantity provenance separately from pricing source', () => {
    expect(normalizeQuantitySource('notes')).toBe('notes');
    expect(quantityProvenanceLabel('notes')).toBe('From notes');
    expect(quantityProvenanceLabel('plan')).toBe('From plan');
    expect(quantityProvenanceLabel('calculated')).toBe('Calculated');
    expect(quantityProvenanceLabel('fallback')).toBe('Fallback basis');
    expect(
      formatQuantityProvenanceLine({ quantity: 132, unit: 'cy', provenance: 'notes' })
    ).toBe('132 CY · From notes');
    expect(SCOPE_PARSED_FROM_NOTES_LABEL).toBe('From notes');
  });

  it('labels living-area fallback distinctly from trade measurements', () => {
    expect(
      isLivingAreaFallbackPricing({
        itemId: 'windows_doors',
        block: block({ basis: { quantity: 1879, unit: 'sqft' } }),
        hasPrimaryTakeoff: false,
      })
    ).toBe(true);
    expect(
      isLivingAreaFallbackPricing({
        itemId: 'excavation',
        block: block({ basis: { quantity: 132, unit: 'cy' } }),
        quantitySource: 'notes',
        hasPrimaryTakeoff: true,
      })
    ).toBe(false);
    expect(formatFallbackBasisLine({ livingSf: 1879 })).toBe(
      'Fallback basis: 1,879 sqft living area'
    );
  });

  it('selects CTA by pricing status', () => {
    expect(resolveSuggestedActionType({ lumpSumOnly: true })).toBe('apply_allowance');
    expect(resolveSuggestedActionType({ isFallbackPricing: true })).toBe('use_planning_price');
    expect(resolveSuggestedActionType({})).toBe('apply_price');
    expect(suggestedActionLabel('use_planning_price')).toBe('Use planning price');
    expect(applyPriceActionLabel({ isFallbackPricing: true })).toBe('Use planning price');
    expect(benchmarkActionButtonLabel('price_ready', { isFallbackPricing: true })).toBe(
      'Use planning price'
    );
    expect(benchmarkActionButtonLabel('benchmark_only')).toBe('Apply allowance');
  });

  it('uses permit allowance terminology', () => {
    expect(missingStatusDisplayLabel('permits')).toBe('Needs local fee confirmation');
    const display = buildSuggestedPricingCardDisplay({
      itemId: 'permits',
      block: block({
        lumpSumOnly: true,
        material: 0,
        labor: 32000,
        total: 32000,
        basis: null,
        costBuckets: [{ key: 'allowance', label: 'Allowance', amount: 32000, source: 'national_average' }],
      }),
    });
    expect(display.title).toBe('Suggested allowance');
    expect(display.splitLine).toBe('Allowance · Flat amount');
    expect(display.statusLine).toBe('Planning allowance · Confirm locally');
    expect(display.missingMeasurementTitle).toBe('Needs local fee confirmation');
    expect(display.missingMeasurementHint).toMatch(/Confirm permit and impact fees/i);
    expect(display.actionLabel).toBe('Apply allowance');
    expect(display.sourceLine).toBe('BPS national benchmark');
    expect(display.allowanceExtraNote).toMatch(/Water, sewer, fire/i);
  });

  it('rounds component and total displays while preserving exact internals', () => {
    const raw = block({
      material: 443.52,
      labor: 3994.32,
      total: 4437.84,
      costBuckets: [
        { key: 'equipment', label: 'Equipment', amount: 443.52, source: 'national_average' },
        { key: 'labor', label: 'Labor', amount: 3994.32, source: 'national_average' },
      ],
    });
    expect(roundSuggestedDisplayComponent(443.52)).toBe(440);
    expect(roundSuggestedDisplayComponent(3994.32)).toBe(3990);
    expect(roundSuggestedDisplayTotal(4437.84)).toBe(4440);
    expect(formatSuggestedComponentMoney(443.52)).toBe('$440');
    expect(formatSuggestedSplitLine(raw)).toBe('Equipment $440 · Labor $3,990');
    expect(formatSuggestedDisplayMoney(4437.84)).toBe('$4,440');
    expect(raw.total).toBe(4437.84);
    expect(raw.material).toBe(443.52);
  });

  it('separates pricing source from status and builds fallback card display', () => {
    const display = buildSuggestedPricingCardDisplay({
      itemId: 'windows_doors',
      block: block({
        material: 4792.1,
        labor: 2911.4,
        total: 7703.5,
        basis: { quantity: 1879, unit: 'sqft' },
        costBuckets: [
          { key: 'material', label: 'Material', amount: 4792.1, source: 'national_average' },
          { key: 'labor', label: 'Labor', amount: 2911.4, source: 'national_average' },
        ],
      }),
      hasPrimaryTakeoff: false,
      livingSf: 1879,
      confidenceLabel: 'Low confidence',
    });
    expect(display.title).toBe('Suggested planning price');
    expect(display.isFallbackPricing).toBe(true);
    expect(display.quantityLine).toBeNull();
    expect(display.fallbackBasisLine).toBe('Fallback basis: 1,879 sqft living area');
    expect(display.missingMeasurementTitle).toBe('Opening count needed');
    expect(display.sourceLine).toBe('BPS national benchmark');
    expect(display.statusLine).toBe('Planning price · Opening count not provided');
    expect(display.statusTone).toBe('amber');
    expect(display.actionType).toBe('use_planning_price');
    expect(display.actionLabel).toBe('Use planning price');
    expect(display.splitLine).toBe('Material $4,790 · Labor $2,910');
  });

  it('keeps notes provenance on measurement-ready trade cards', () => {
    const display = buildSuggestedPricingCardDisplay({
      itemId: 'excavation',
      block: block({
        material: 443.52,
        labor: 3994.32,
        total: 4437.84,
        basis: { quantity: 132, unit: 'cy' },
        costBuckets: [
          { key: 'equipment', label: 'Equipment', amount: 443.52, source: 'national_average' },
          { key: 'labor', label: 'Labor', amount: 3994.32, source: 'national_average' },
        ],
      }),
      quantitySource: 'notes',
      hasPrimaryTakeoff: true,
      confidenceLabel: 'Low confidence',
    });
    expect(display.quantityLine).toBe('132 CY · From notes');
    expect(display.sourceLine).toBe('BPS national benchmark');
    expect(display.statusLine).toBe('Low confidence · Local pricing not verified');
    expect(display.actionLabel).toBe('Apply price');
    expect(display.title).toBe('Suggested pricing');
  });

  it('keeps Suggested pricing title readable', () => {
    expect(suggestedCardTitle(block())).toBe('Suggested pricing');
    expect(suggestedCardTitle({ lumpSumOnly: true })).toBe('Suggested allowance');
    expect(suggestedCardTitle({ isFallbackPricing: true })).toBe('Suggested planning price');
  });
});
