import {
  applyPriceActionLabel,
  buildSuggestedPricingCardDisplay,
  displayPriceSourceLabel,
  formatCompactSuggestedLine,
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
  shouldUseCompactSuggestedAlternative,
  suggestedActionLabel,
  suggestedCardTitle,
} from '@/utils/suggestedPricingCardUi';
import { benchmarkActionButtonLabel, missingStatusDisplayLabel } from '@/utils/measurementSemantics/scopePriceUi';
import { SCOPE_PARSED_FROM_NOTES_LABEL } from '@/constants/scopeNoteSourceLabels';
import {
  formatCountFieldSuffix,
  formatDualCountQuantity,
  getScopeQuantityFieldLabels,
  pricingBasisFieldLabel,
  type SuggestedPricingBlock,
} from '@/utils/scopeItemQuantities';

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
  it('shortens national source labels to National planning rate', () => {
    expect(displayPriceSourceLabel('Suggested · National Average (builder-budget calibrated)')).toBe(
      'National planning rate'
    );
    expect(displayPriceSourceLabel('National Average')).toBe('National planning rate');
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

  it('uses a single Apply CTA across pricing statuses', () => {
    expect(resolveSuggestedActionType({ lumpSumOnly: true })).toBe('apply_allowance');
    expect(resolveSuggestedActionType({ isFallbackPricing: true })).toBe('use_planning_price');
    expect(resolveSuggestedActionType({})).toBe('apply_price');
    expect(suggestedActionLabel('use_planning_price')).toBe('Apply');
    expect(suggestedActionLabel('apply_allowance')).toBe('Apply');
    expect(suggestedActionLabel('apply_price')).toBe('Apply');
    expect(applyPriceActionLabel({ isFallbackPricing: true })).toBe('Apply');
    expect(benchmarkActionButtonLabel('price_ready', { isFallbackPricing: true })).toBe('Apply');
    expect(benchmarkActionButtonLabel('benchmark_only')).toBe('Apply');
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
    expect(display.statusLine).toBe('Confirm local permit fees');
    expect(display.missingMeasurementTitle).toBeNull();
    expect(display.missingMeasurementHint).toBeNull();
    expect(display.actionLabel).toBe('Apply');
    expect(display.sourceLine).toBe('National planning rate');
    expect(display.allowanceExtraNote).toMatch(/Water, sewer, fire/i);
    expect(display.whyThisPriceLines.join(' ')).toMatch(/National planning rate/);
    expect(display.whyThisPriceLines.join(' ')).toMatch(/Water, sewer, fire/);
  });

  it('shows exact apply amounts on suggest cards (no planning rounding)', () => {
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
    expect(roundSuggestedDisplayTotal(4437.84)).toBe(4440);
    expect(formatSuggestedComponentMoney(443.52)).toBe('$443.52');
    expect(formatSuggestedSplitLine(raw)).toBe('Estimated planning split · Equipment $443.52 · Labor $3,994.32');
    expect(formatSuggestedDisplayMoney(4437.84)).toBe('$4,437.84');
    expect(raw.total).toBe(4437.84);
    expect(raw.material).toBe(443.52);
  });

  it('uses one status line for fallback cards (no stacked title/hint)', () => {
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
      confidenceLabel: 'Planning estimate',
    });
    expect(display.title).toBe('Suggested planning price');
    expect(display.isFallbackPricing).toBe(true);
    expect(display.quantityLine).toBeNull();
    expect(display.fallbackBasisLine).toBe('Fallback basis: 1,879 sqft living area');
    expect(display.missingMeasurementTitle).toBeNull();
    expect(display.missingMeasurementHint).toBeNull();
    expect(display.statusLine).toMatch(/window and door count/i);
    expect(display.statusTone).toBe('amber');
    expect(display.actionType).toBe('use_planning_price');
    expect(display.actionLabel).toBe('Apply');
    expect(display.splitLine).toBe('Estimated planning split · Material $4,792.10 · Labor $2,911.40');
    expect(display.whyThisPriceLines).toEqual(
      expect.arrayContaining(['Fallback basis: 1,879 sqft living area', 'National planning rate'])
    );
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
      confidenceLabel: 'Planning estimate',
    });
    expect(display.quantityLine).toBe('132 CY · From notes');
    expect(display.sourceLine).toBe('National planning rate');
    expect(display.statusLine).toBe('National planning rate');
    expect(display.statusTone).toBe('amber');
    expect(display.actionLabel).toBe('Apply');
    expect(display.title).toBe('Suggested pricing');
    expect(display.whyThisPriceLines).toContain('National planning rate');
  });

  it('keeps Suggested pricing title readable', () => {
    expect(suggestedCardTitle(block())).toBe('Suggested pricing');
    expect(suggestedCardTitle({ lumpSumOnly: true })).toBe('Suggested allowance');
    expect(suggestedCardTitle({ isFallbackPricing: true })).toBe('Suggested planning price');
    expect(
      suggestedCardTitle({
        materialSource: 'template',
        laborSource: 'template',
        rateSourceLabel: 'Saved pricing',
      })
    ).toBe('Saved pricing');
    expect(displayPriceSourceLabel('Saved pricing')).toBe('Saved pricing');
  });

  it('hides redundant each suffix on count fields', () => {
    expect(formatCountFieldSuffix('each')).toBeUndefined();
    expect(formatCountFieldSuffix('ea')).toBeUndefined();
    expect(formatCountFieldSuffix('sqft')).toBe('sqft');
    expect(formatCountFieldSuffix('points')).toBe('points');
    expect(formatDualCountQuantity(4, 'each')).toBe('4');
    expect(formatDualCountQuantity(1200, 'sqft')).toBe('1,200 sqft');
  });

  it('uses specific count/area field labels for measurement-needed scopes', () => {
    expect(getScopeQuantityFieldLabels('windows_doors').count).toBe('Window & door openings');
    expect(getScopeQuantityFieldLabels('plumbing_rough').count).toBe('Rough-in points');
    expect(getScopeQuantityFieldLabels('electrical_rough').count).toBe('Circuits / devices / boxes');
    expect(getScopeQuantityFieldLabels('hvac').count).toBe('Systems / tons');
    expect(getScopeQuantityFieldLabels('insulation').count).toBe('Thermal-envelope area');
    expect(getScopeQuantityFieldLabels('appliances').count).toBe('Appliances');
    expect(pricingBasisFieldLabel('windows_doors', 'each')).toBe('Window & door openings');
    expect(pricingBasisFieldLabel('insulation', 'sqft')).toBe('Thermal-envelope area');
    expect(pricingBasisFieldLabel('unknown_scope', 'sqft')).toBe('Area (sqft)');
  });

  it('uses compact Apply presentation when a current allowance already exists', () => {
    expect(
      shouldUseCompactSuggestedAlternative({ currentTotal: 3500, suggestedTotal: 3000 })
    ).toBe(true);
    expect(
      shouldUseCompactSuggestedAlternative({ currentTotal: 3000, suggestedTotal: 3000 })
    ).toBe(false);
    expect(formatCompactSuggestedLine(3000)).toBe('$3,000');

    const display = buildSuggestedPricingCardDisplay({
      itemId: 'plans_engineering',
      block: block({
        lumpSumOnly: true,
        material: 0,
        labor: 3000,
        total: 3000,
        basis: null,
        costBuckets: [{ key: 'allowance', label: 'Allowance', amount: 3000, source: 'national_average' }],
      }),
      hasCurrentPricing: true,
    });
    expect(display.presentation).toBe('compact');
    expect(display.missingMeasurementTitle).toBeNull();
    expect(display.missingMeasurementHint).toBeNull();
    expect(display.actionLabel).toBe('Apply');
    expect(display.compactLine).toBe('$3,000');
  });

  it('forceCompact collapses soft-cost idle cards while keeping Apply', () => {
    const display = buildSuggestedPricingCardDisplay({
      itemId: 'plans_engineering',
      block: block({
        lumpSumOnly: true,
        material: 0,
        labor: 3000,
        total: 3000,
        basis: null,
        costBuckets: [{ key: 'allowance', label: 'Allowance', amount: 3000, source: 'national_average' }],
      }),
      forceCompact: true,
    });
    expect(display.presentation).toBe('compact');
    expect(display.actionLabel).toBe('Apply');
    expect(display.compactLine).toBe('$3,000');
  });

  it('uses blended SF pricing chrome for flooring install cards', () => {
    const display = buildSuggestedPricingCardDisplay({
      itemId: 'tile_flooring',
      block: block({
        material: 4572,
        labor: 5712,
        total: 10284,
        basis: { quantity: 1200, unit: 'sqft' },
      }),
      quantitySource: 'calculated_confirmed',
    });
    expect(display.quantityLine).toBe('1,200 SF total · $8.57/SF blended');
    expect(display.unitRateLine).toBeNull();
    expect(display.splitLine).toMatch(/Material \$[\d,]+ · Labor \$[\d,]+/);
  });

  it('keeps landscaping installed-package prose in whyThisPriceLines (not card chrome)', () => {
    const display = buildSuggestedPricingCardDisplay({
      itemId: 'landscaping',
      block: block({
        lumpSumOnly: true,
        installedBudgetBenchmark: true,
        material: 0,
        labor: 0,
        total: 13000,
        splitSource: 'none',
        basis: null,
        comparisonRange: { low: 8300, high: 15500 },
        costBuckets: [],
      }),
    });
    expect(display.statusLine).toBe('Installed site package');
    expect(display.allowanceExtraNote).toMatch(/Local range/);
    expect(display.whyThisPriceLines.join(' ')).toMatch(/walls\/gates/i);
    expect(display.actionLabel).toBe('Apply');
  });
});
