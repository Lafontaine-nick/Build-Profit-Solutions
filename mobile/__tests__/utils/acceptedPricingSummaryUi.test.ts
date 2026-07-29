import {
  buildAcceptanceFromSuggestedBlock,
  buildSecondaryDisclosureContent,
  clearAcceptedScopeItemPricing,
  collectProjectWideScopeGaps,
  confidenceBadgeLabel,
  currentScopePricingTotal,
  finalizeScopePricingAfterEditorClose,
  geographicBasisFromSourceKind,
  getPricingSecondaryAction,
  getPricingSourceMessage,
  hasAcceptedScopePricing,
  inferPricingModel,
  isItemSpecificAssemblyComponent,
  liveScopeMoneyFromQuantities,
  markManualPricingAdjustment,
  moneyTotalAfterQuantityEdit,
  pricingSourceLabelFromBlock,
  resolveAcceptedMoneyTotal,
  resolveAcceptedPricingDisplay,
  shouldHideSuggestedPanel,
  shouldShowConfidenceBadge,
} from '@/utils/acceptedPricingSummaryUi';
import type { ScopeItemIntelligence } from '@/utils/scopeIntelligence';
import {
  isNationalAverageComparisonBlock,
  type ResolvedItemQuantity,
  type SuggestedPricingBlock,
} from '@/utils/scopeItemQuantities';

function suggestedBlock(overrides: Partial<SuggestedPricingBlock> = {}): SuggestedPricingBlock {
  return {
    material: 0,
    labor: 3500,
    total: 3500,
    materialSource: 'national_average',
    laborSource: 'national_average',
    rateSourceLabel: 'Suggested · National Average',
    helper: 'Suggested permit and inspection allowance.',
    mode: 'suggested_price',
    lumpSumOnly: true,
    ...overrides,
  };
}

function allowanceResolved(overrides: Partial<ResolvedItemQuantity> = {}): ResolvedItemQuantity {
  return {
    quantity: 3500,
    unit: 'allowance',
    quantitySource: 'user_entered',
    sourceLabel: 'User entered',
    pricingReady: true,
    showInput: false,
    ...overrides,
  };
}

/** Resolve all TRADE_PRIORITY_GAP_KEYS for a scope so secondary actions beyond review can be tested. */
function resolvePriorityGaps(scopeKey: string, keys: string[]) {
  const now = '2026-01-01T00:00:00.000Z';
  return Object.fromEntries(
    keys.map((key) => [`${scopeKey}::${key}`, { status: 'included' as const, updatedAt: now }])
  );
}

function intelligence(overrides: Partial<ScopeItemIntelligence> = {}): ScopeItemIntelligence {
  return {
    scopeItemKey: 'permits',
    quantity: {
      source: 'user_entered',
      sourceLabel: 'User entered',
      confidence: 'high',
      confidenceLabel: 'High confidence',
      reason: '',
    },
    pricing: {
      source: 'national_average',
      confidence: 'low',
      confidenceLabel: 'Planning estimate',
      reason: 'Pricing uses a broad national average fallback.',
    },
    pricingCompleteness: {
      status: 'mostly_complete',
      rateType: 'allowance',
      confidence: 'medium',
      includedCostComponents: [],
      missingCostComponents: [],
      unknownCostComponents: [],
      notices: [],
      regionalRelevance: {
        overall: 'low',
        dimensions: { regionalMatch: 'low' },
      },
      dateRelevance: {
        status: 'unknown',
        message: 'Rate effective date is unknown.',
      },
    },
    validation: { status: 'ready', issues: [] },
    scopeGaps: [
      {
        key: 'adu_utility_coordination',
        scopeGroupKey: 'utility_coordination',
        label: 'Utility coordination',
        severity: 'review',
        message: 'Utility coordination may be needed.',
        suggestedScopeKeys: ['utility_coordination'],
      },
    ],
    ...overrides,
  } as ScopeItemIntelligence;
}

function displayForPermits(acceptance = buildAcceptanceFromSuggestedBlock(suggestedBlock())) {
  return resolveAcceptedPricingDisplay({
    itemId: 'permits',
    resolved: allowanceResolved(),
    acceptance,
    suggestedBlock: suggestedBlock(),
    intelligence: intelligence(),
  });
}

describe('acceptedPricingSummaryUi', () => {
  it('builds national-average acceptance metadata from suggested block', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock(suggestedBlock());
    expect(acceptance.pricingSourceLabel).toBe('BPS national benchmark');
    expect(acceptance.pricingSourceKind).toBe('national_average');
    expect(acceptance.selectionStatus).toBe('accepted');
    expect(acceptance.pricingTypeLabel).toBe('Flat allowance');
    expect(acceptance.geographicBasis).toBe('National');
  });

  it('shows Review assumptions for flat allowance cards with priority scope gaps', () => {
    const display = displayForPermits();
    const action = getPricingSecondaryAction({
      display,
      intelligence: intelligence(),
      resolved: allowanceResolved(),
      suggestedBlock: suggestedBlock(),
      scopeKey: 'permits',
    });
    expect(action).toEqual({
      kind: 'review_missing_scope',
      label: 'Review assumptions',
      unresolvedScopeGapCount: 2,
    });
  });

  it('does not show confidence badge for purely user-entered pricing', () => {
    const acceptance = {
      selectionStatus: 'user_entered' as const,
      pricingSourceLabel: 'User entered',
      pricingSourceKind: 'user_entered' as const,
      pricingTypeLabel: 'Lump sum',
      totalAmount: 12000,
    };
    expect(shouldShowConfidenceBadge(acceptance)).toBe(false);
    const display = resolveAcceptedPricingDisplay({
      itemId: 'demo',
      resolved: { ...allowanceResolved({ quantity: 12000, unit: 'lump_sum' }) },
      acceptance,
      intelligence: intelligence(),
    });
    expect(display.showConfidenceBadge).toBe(false);
    expect(display.confidenceLabel).toBeNull();
  });

  it('keeps accepted source, confidence, source message, and edit metadata without generic disclosure', () => {
    const display = displayForPermits();
    expect(display.selectionStatusLabel).toBe('Applied');
    expect(display.pricingSourceLabel).toBe('BPS national benchmark');
    expect(display.confidenceLabel).toBe('Planning estimate');
    expect(display.warningMessage).toBe(
      'Based on national average pricing. Review before sending the estimate.'
    );
    expect(display.warningMessage).not.toMatch(/Local pricing was unavailable/i);
    expect(display.warningMessage).not.toMatch(/Planning estimate/i);
    expect(getPricingSecondaryAction({
      display,
      intelligence: intelligence(),
      resolved: allowanceResolved(),
      scopeKey: 'permits',
    })?.label).toBe('Review assumptions');
  });

  it('does not show Last updated on confirm scope cards for unknown freshness', () => {
    const display = displayForPermits();
    expect(display.warningMessage).not.toMatch(/Update date unavailable/);
    expect(display.warningMessage || '').not.toMatch(/Update date unavailable/);
  });

  it('shows stale saved-rate source message when pricing is outdated', () => {
    const acceptance = {
      ...buildAcceptanceFromSuggestedBlock(
        suggestedBlock({ materialSource: 'template', laborSource: 'template', templateName: 'Saved bid' })
      ),
      pricingSourceKind: 'saved_rate' as const,
      pricingSourceLabel: 'Saved company pricing',
    };
    const message = getPricingSourceMessage(
      intelligence({
        pricing: {
          source: 'saved_rate',
          confidence: 'medium',
          confidenceLabel: 'Review before bid',
          reason: '',
        },
        pricingCompleteness: {
          status: 'mostly_complete',
          rateType: 'allowance',
          confidence: 'medium',
          includedCostComponents: [],
          missingCostComponents: [],
          unknownCostComponents: [],
          notices: [],
          dateRelevance: { status: 'stale', message: 'Rate effective date is unknown.' },
        },
      }),
      acceptance
    );
    expect(message).toBe('Based on your saved company pricing. Review if this rate is no longer current.');
  });

  it('shows View calculation for unit-priced items', () => {
    const resolved: ResolvedItemQuantity = {
      quantity: 600,
      unit: 'sqft',
      quantitySource: 'user_entered',
      sourceLabel: 'User entered',
      pricingReady: true,
      showInput: false,
      dualCount: { quantity: 600, unit: 'sqft' },
    };
    const block = suggestedBlock({
      material: 2550,
      labor: 2250,
      total: 4800,
      lumpSumOnly: false,
      basis: { quantity: 600, unit: 'sqft' },
    });
    const display = resolveAcceptedPricingDisplay({
      itemId: 'flooring',
      resolved,
      acceptance: {
        selectionStatus: 'accepted',
        pricingSourceLabel: 'National average',
        pricingSourceKind: 'national_average',
        pricingTypeLabel: 'Unit pricing',
        geographicBasis: 'National',
        totalAmount: 4800,
      },
      suggestedBlock: block,
      intelligence: intelligence(),
    });
    expect(display.subtitleLine).toMatch(/600 sqft × \$8\.00\/sqft/);
    const action = getPricingSecondaryAction({
      display,
      intelligence: intelligence(),
      resolved,
      suggestedBlock: block,
      scopeKey: 'flooring',
      scopeGapResolutions: resolvePriorityGaps('flooring', ['floor_prep', 'disposal']),
    });
    expect(action?.label).toBe('View calculation');
    const disclosure = buildSecondaryDisclosureContent({
      action: action!,
      display,
      intelligence: intelligence(),
      resolved,
      suggestedBlock: block,
      scopeKey: 'flooring',
    });
    expect(disclosure?.kind).toBe('rows');
    if (disclosure?.kind === 'rows') {
      expect(disclosure.rows.some((row) => row.label === 'Quantity')).toBe(true);
      expect(disclosure.rows.some((row) => row.label === 'Formula')).toBe(false);
    }
  });

  it('does not add View breakdown when material/labor is already inline', () => {
    const resolved: ResolvedItemQuantity = {
      quantity: 9200,
      unit: 'allowance',
      quantitySource: 'user_entered',
      sourceLabel: 'User entered',
      pricingReady: true,
      showInput: false,
      dualMaterial: { quantity: 5000, unit: 'allowance' },
      dualLabor: { quantity: 4200, unit: 'allowance' },
    };
    const display = resolveAcceptedPricingDisplay({
      itemId: 'drywall',
      resolved,
      acceptance: {
        selectionStatus: 'accepted',
        pricingSourceLabel: 'Saved company pricing',
        pricingSourceKind: 'saved_rate',
        pricingTypeLabel: 'Material + labor',
        materialAmount: 5000,
        laborAmount: 4200,
        totalAmount: 9200,
      },
      intelligence: intelligence(),
    });
    expect(display.subtitleLine).toBe('Material $5,000 · Labor $4,200');
    const action = getPricingSecondaryAction({
      display,
      intelligence: intelligence(),
      resolved,
      scopeKey: 'drywall',
      scopeGapResolutions: resolvePriorityGaps('drywall', ['texture', 'patching']),
    });
    expect(action).toBeNull();
  });

  it('preserves manual adjustment metadata when suggested block total still matches original acceptance', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock(suggestedBlock());
    const adjustedRecord = markManualPricingAdjustment(acceptance, 'permits', { permits: acceptance }, 4000);
    const display = resolveAcceptedPricingDisplay({
      itemId: 'permits',
      resolved: allowanceResolved({ quantity: 4000 }),
      acceptance: adjustedRecord?.permits,
      suggestedBlock: suggestedBlock(),
      intelligence: intelligence(),
    });
    expect(display.selectionStatusLabel).toBe('User adjusted');
    expect(display.pricingSourceLabel).toBe('User adjusted');
    expect(display.totalLabel).toBe('$4,000');
  });

  it('shows View original suggestion only when original suggestion data exists', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock(suggestedBlock());
    const adjustedRecord = markManualPricingAdjustment(acceptance, 'permits', { permits: acceptance }, 4000);
    expect(adjustedRecord?.permits.selectionStatus).toBe('manual_adjusted');
    const display = resolveAcceptedPricingDisplay({
      itemId: 'permits',
      resolved: allowanceResolved({ quantity: 4000 }),
      acceptance: adjustedRecord?.permits,
      suggestedBlock: suggestedBlock(),
      intelligence: intelligence(),
    });
    const action = getPricingSecondaryAction({
      display,
      intelligence: intelligence(),
      resolved: allowanceResolved({ quantity: 4000 }),
      suggestedBlock: suggestedBlock(),
      scopeKey: 'permits',
      scopeGapResolutions: resolvePriorityGaps('permits', ['meter_fees', 'plan_check']),
    });
    expect(action?.label).toBe('View original suggestion');
  });

  it('shows Compare sources when a comparison block differs from selected source', () => {
    const fill = suggestedBlock({ total: 4800, material: 2550, labor: 2250, lumpSumOnly: false, basis: { quantity: 600, unit: 'sqft' } });
    const comparison = suggestedBlock({
      total: 5100,
      material: 2700,
      labor: 2400,
      materialSource: 'template',
      laborSource: 'template',
      templateName: 'Saved bid',
      lumpSumOnly: false,
      basis: { quantity: 600, unit: 'sqft' },
      isComparison: true,
    });
    const display = resolveAcceptedPricingDisplay({
      itemId: 'flooring',
      resolved: {
        quantity: 600,
        unit: 'sqft',
        quantitySource: 'user_entered',
        sourceLabel: 'User entered',
        pricingReady: true,
        showInput: false,
        dualCount: { quantity: 600, unit: 'sqft' },
      },
      acceptance: buildAcceptanceFromSuggestedBlock(fill),
      suggestedBlock: fill,
      intelligence: intelligence(),
    });
    const action = getPricingSecondaryAction({
      display,
      intelligence: intelligence(),
      resolved: {
        quantity: 600,
        unit: 'sqft',
        quantitySource: 'user_entered',
        sourceLabel: 'User entered',
        pricingReady: true,
        showInput: false,
        dualCount: { quantity: 600, unit: 'sqft' },
      },
      suggestedBlock: fill,
      comparisonBlock: comparison,
      scopeKey: 'flooring',
      scopeGapResolutions: resolvePriorityGaps('flooring', ['floor_prep', 'disposal']),
    });
    expect(action?.label).toBe('Compare benchmarks');
  });

  it('shows count-based review action for item-specific unresolved components', () => {
    const display = displayForPermits();
    const assemblyIntel = intelligence({
      assembly: {
        assemblyKey: 'permits',
        label: 'Permits',
        completeness: 'mostly_complete',
        confidence: 'low',
        unknownComponents: [
          {
            key: 'plan_check',
            label: 'Plan check fees',
            status: 'unknown',
            severity: 'review',
            relatedScopeKeys: ['permits'],
            message: 'Not confirmed',
          },
        ],
        missingComponents: [],
        includedComponents: [],
      },
    });
    const action = getPricingSecondaryAction({
      display,
      intelligence: assemblyIntel,
      resolved: allowanceResolved(),
      scopeKey: 'permits',
    });
    expect(action?.kind).toBe('review_missing_scope');
    expect(action?.label).toBe('Review assumptions');
    expect(
      buildSecondaryDisclosureContent({
        action: action!,
        display,
        intelligence: assemblyIntel,
        resolved: allowanceResolved(),
        scopeKey: 'permits',
      })
    ).toBeNull();
  });

  it('hides review action when all item-specific gaps are resolved', () => {
    const display = displayForPermits();
    const assemblyIntel = intelligence({
      assembly: {
        assemblyKey: 'permits',
        label: 'Permits',
        completeness: 'mostly_complete',
        confidence: 'low',
        unknownComponents: [
          {
            key: 'plan_check',
            label: 'Plan check fees',
            status: 'unknown',
            severity: 'review',
            relatedScopeKeys: ['permits'],
            message: 'Not confirmed',
          },
        ],
        missingComponents: [],
        includedComponents: [],
      },
    });
    const scopeGapResolutions = resolvePriorityGaps('permits', ['meter_fees', 'plan_check']);
    expect(
      getPricingSecondaryAction({
        display,
        intelligence: assemblyIntel,
        resolved: allowanceResolved(),
        scopeKey: 'permits',
        scopeGapResolutions,
      })
    ).toBeNull();
  });

  it('shows needs-pricing card action when scope decisions are complete but pricing is not', () => {
    const display = resolveAcceptedPricingDisplay({
      itemId: 'excavation',
      resolved: {
        quantity: 2500,
        unit: 'allowance',
        quantitySource: 'user_entered',
        sourceLabel: 'User entered',
        pricingReady: true,
        showInput: false,
      },
      acceptance: buildAcceptanceFromSuggestedBlock(suggestedBlock({ total: 2500, labor: 2250, material: 250 })),
      intelligence: intelligence(),
    });
    const assemblyIntel = intelligence({
      assembly: {
        assemblyKey: 'excavation',
        label: 'Excavation',
        completeness: 'mostly_complete',
        confidence: 'low',
        unknownComponents: [
          {
            key: 'export',
            label: 'Export',
            status: 'unknown',
            severity: 'info',
            relatedScopeKeys: ['excavation', 'haul_off'],
            message: 'Not confirmed',
          },
        ],
        missingComponents: [],
        includedComponents: [],
      },
    });
    const scopeGapResolutions = {
      ...resolvePriorityGaps('excavation', [
        'haul_off',
        'spoils_export',
        'dump_fees',
        'backfill',
        'compaction',
        'shoring',
      ]),
      'excavation::export': {
        status: 'price_separately' as const,
        pricingStatus: 'needs_pricing' as const,
        linkedLineItemId: 'haul_off',
        parentScopeItemId: 'excavation',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    };
    const action = getPricingSecondaryAction({
      display,
      intelligence: assemblyIntel,
      resolved: {
        quantity: 2500,
        unit: 'allowance',
        quantitySource: 'user_entered',
        sourceLabel: 'User entered',
        pricingReady: true,
        showInput: false,
      },
      scopeKey: 'excavation',
      scopeGapResolutions,
      scopeGapPricingContext: { itemQuantities: {}, pricingAcceptance: {} },
    });
    expect(action?.kind).toBe('needs_separate_pricing');
    expect(action?.label).toBe('1 item still needs pricing');
  });

  it('shows plural review label for multiple unresolved gaps', () => {
    const display = resolveAcceptedPricingDisplay({
      itemId: 'excavation',
      resolved: {
        quantity: 2500,
        unit: 'allowance',
        quantitySource: 'user_entered',
        sourceLabel: 'User entered',
        pricingReady: true,
        showInput: false,
      },
      acceptance: buildAcceptanceFromSuggestedBlock(suggestedBlock({ total: 2500, labor: 2250, material: 250 })),
      intelligence: intelligence(),
    });
    const action = getPricingSecondaryAction({
      display,
      intelligence: intelligence({
        assembly: {
          assemblyKey: 'excavation',
          label: 'Excavation',
          completeness: 'mostly_complete',
          confidence: 'low',
          unknownComponents: [
            {
              key: 'export',
              label: 'Export',
              status: 'unknown',
              severity: 'info',
              relatedScopeKeys: ['excavation'],
              message: 'Not confirmed',
            },
            {
              key: 'dump_fees',
              label: 'Dump fees',
              status: 'unknown',
              severity: 'info',
              relatedScopeKeys: ['excavation'],
              message: 'Not confirmed',
            },
          ],
          missingComponents: [],
          includedComponents: [],
        },
      }),
      resolved: {
        quantity: 2500,
        unit: 'allowance',
        quantitySource: 'user_entered',
        sourceLabel: 'User entered',
        pricingReady: true,
        showInput: false,
      },
      scopeKey: 'excavation',
    });
    expect(action?.label).toBe('Review assumptions');
  });

  it('preserves pricing acceptance metadata after removing generic disclosure', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock(suggestedBlock());
    expect(acceptance.totalAmount).toBe(3500);
    expect(acceptance.originalPricingSourceLabel).toBe('BPS national benchmark');
    expect(acceptance.geographicBasis).toBe('National');
  });

  it('detects accepted pricing and hides suggestion panel when amounts match', () => {
    const itemQuantities = {
      permits__allowance: { quantity: '3500', unit: 'allowance', quantitySource: 'user_entered' as const },
    };
    const pricingAcceptance = { permits: buildAcceptanceFromSuggestedBlock(suggestedBlock()) };
    expect(hasAcceptedScopePricing('permits', itemQuantities, pricingAcceptance)).toBe(true);
    expect(
      shouldHideSuggestedPanel({
        itemId: 'permits',
        itemQuantities,
        pricingAcceptance,
        suggestedTotal: 3500,
      })
    ).toBe(true);
  });

  it('hides suggest row after Apply even when a stale suggest total would mismatch', () => {
    const itemQuantities = {
      demo__sqft_basis: { quantity: '95', unit: 'sqft', quantitySource: 'user_entered' as const },
      demo__material: { quantity: '97.5', unit: 'allowance', quantitySource: 'user_entered' as const },
      demo__labor: { quantity: '775', unit: 'allowance', quantitySource: 'user_entered' as const },
      demo__allowance: { quantity: '872.5', unit: 'allowance', quantitySource: 'user_entered' as const },
    };
    const pricingAcceptance = {
      demo: {
        ...buildAcceptanceFromSuggestedBlock(suggestedBlock({ total: 872.5, material: 97.5, labor: 775 })),
        selectionStatus: 'accepted' as const,
      },
    };
    expect(
      shouldHideSuggestedPanel({
        itemId: 'demo',
        itemQuantities,
        pricingAcceptance,
        suggestedTotal: 5148.75,
      })
    ).toBe(true);
  });

  it('clears applied price so the original Suggest card can return', () => {
    const itemQuantities = {
      excavation: { quantity: '132', unit: 'cy', quantitySource: 'user_entered' as const },
      excavation__sqft_basis: { quantity: '132', unit: 'cy', quantitySource: 'user_entered' as const },
      excavation__material: { quantity: '440', unit: 'allowance', quantitySource: 'user_entered' as const },
      excavation__labor: { quantity: '3990', unit: 'allowance', quantitySource: 'user_entered' as const },
      excavation__allowance: { quantity: '4430', unit: 'allowance', quantitySource: 'user_entered' as const },
    };
    const pricingAcceptance = {
      excavation: buildAcceptanceFromSuggestedBlock(
        suggestedBlock({
          material: 440,
          labor: 3990,
          total: 4430,
          lumpSumOnly: false,
          isComparison: false,
        })
      ),
    };
    const cleared = clearAcceptedScopeItemPricing({
      itemId: 'excavation',
      itemQuantities,
      pricingAcceptance,
    });
    expect(cleared.pricingAcceptance.excavation).toBeUndefined();
    expect(cleared.itemQuantities.excavation__material).toBeUndefined();
    expect(cleared.itemQuantities.excavation__labor).toBeUndefined();
    expect(cleared.itemQuantities.excavation__allowance).toBeUndefined();
    expect(cleared.itemQuantities.excavation__sqft_basis).toBeUndefined();
    // Keep physical CY takeoff on the item id.
    expect(cleared.itemQuantities.excavation).toEqual({
      quantity: '132',
      unit: 'cy',
      quantitySource: 'user_entered',
    });
    expect(hasAcceptedScopePricing('excavation', cleared.itemQuantities, cleared.pricingAcceptance)).toBe(
      false
    );
  });

  it('keeps lump-sum contingency allowance when pricing editor Done is pressed', () => {
    const itemQuantities = {
      contingency__allowance: {
        quantity: '5000',
        unit: 'allowance',
        quantitySource: 'user_entered' as const,
      },
    };
    const finalized = finalizeScopePricingAfterEditorClose({
      itemId: 'contingency',
      itemQuantities,
      pricingAcceptance: {},
    });
    expect(finalized.itemQuantities.contingency__allowance).toEqual(itemQuantities.contingency__allowance);
    expect(hasAcceptedScopePricing('contingency', finalized.itemQuantities, finalized.pricingAcceptance)).toBe(
      true
    );
  });

  it('clears orphan allowance when Material and Labor legs were wiped on Done', () => {
    const itemQuantities = {
      excavation__material: { quantity: '', unit: 'allowance', quantitySource: 'user_entered' as const },
      excavation__labor: { quantity: '', unit: 'allowance', quantitySource: 'user_entered' as const },
      excavation__allowance: { quantity: '2', unit: 'allowance', quantitySource: 'user_entered' as const },
    };
    const finalized = finalizeScopePricingAfterEditorClose({
      itemId: 'excavation',
      itemQuantities,
      pricingAcceptance: {
        excavation: buildAcceptanceFromSuggestedBlock(
          suggestedBlock({ material: 440, labor: 3990, total: 4430, lumpSumOnly: false })
        ),
      },
    });
    expect(finalized.itemQuantities.excavation__allowance).toBeUndefined();
    expect(finalized.pricingAcceptance.excavation).toBeUndefined();
  });

  it('clears sticky acceptance when the user deletes an edited allowance back to empty', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock(
      suggestedBlock({ total: 500, material: 0, labor: 500, lumpSumOnly: true })
    );
    // Digits deleted 500 → 50 → 5 → 2 → '' — last non-empty update left totalAmount at 2.
    const stuckAtTwo = markManualPricingAdjustment(acceptance, 'appliances', { appliances: acceptance }, 2);
    expect(stuckAtTwo?.appliances?.totalAmount).toBe(2);

    const afterClear = markManualPricingAdjustment(
      stuckAtTwo?.appliances,
      'appliances',
      stuckAtTwo,
      moneyTotalAfterQuantityEdit(
        'appliances',
        { appliances__allowance: { quantity: '', unit: 'allowance' } },
        'appliances__allowance',
        ''
      )
    );
    expect(afterClear?.appliances).toBeUndefined();
    expect(
      hasAcceptedScopePricing(
        'appliances',
        { appliances__allowance: { quantity: '', unit: 'allowance', quantitySource: 'user_entered' } },
        afterClear
      )
    ).toBe(false);
    expect(
      resolveAcceptedMoneyTotal({
        resolved: allowanceResolved({ quantity: null as unknown as number }),
        acceptance: afterClear?.appliances,
      })
    ).toBe(0);
  });

  it('does not keep a $2 card when quantities are empty but acceptance is still sticky', () => {
    const sticky = {
      appliances: {
        selectionStatus: 'manual_adjusted' as const,
        pricingSourceLabel: 'User entered',
        pricingSourceKind: 'user_entered' as const,
        pricingTypeLabel: 'Flat allowance',
        totalAmount: 2,
      },
    };
    expect(hasAcceptedScopePricing('appliances', {}, sticky)).toBe(false);
    expect(currentScopePricingTotal('appliances', {}, sticky)).toBeNull();
  });

  it('prefers live labor dollars over a stale acceptance total', () => {
    expect(
      resolveAcceptedMoneyTotal({
        resolved: {
          quantity: undefined,
          unit: 'each',
          quantitySource: 'user_entered',
          sourceLabel: 'User entered',
          pricingReady: true,
          showInput: true,
          dualLabor: { quantity: 2000, unit: 'allowance' },
        },
        acceptance: {
          selectionStatus: 'manual_adjusted',
          pricingSourceLabel: 'User entered',
          pricingSourceKind: 'user_entered',
          pricingTypeLabel: 'Flat allowance',
          totalAmount: 2,
        },
      })
    ).toBe(2000);
  });

  it('uses acceptance material+labor when primary quantity is a stale allowance count', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock(
      suggestedBlock({ total: 375, material: 200, labor: 175 })
    );
    expect(
      resolveAcceptedMoneyTotal({
        resolved: {
          quantity: 1,
          unit: 'allowance',
          quantitySource: 'user_entered',
          sourceLabel: 'User entered',
          pricingReady: true,
          showInput: true,
        },
        acceptance,
      })
    ).toBe(375);
  });

  it('shows applied bath accessories total after Apply, not $1 allowance count', () => {
    const acceptance = buildAcceptanceFromSuggestedBlock(
      suggestedBlock({ total: 375, material: 200, labor: 175 })
    );
    const display = resolveAcceptedPricingDisplay({
      itemId: 'mirror_accessories',
      resolved: {
        quantity: 1,
        unit: 'allowance',
        quantitySource: 'user_entered',
        sourceLabel: 'User entered',
        pricingReady: true,
        showInput: true,
        dualMaterial: { quantity: 200, unit: 'allowance' },
        dualLabor: { quantity: 175, unit: 'allowance' },
      },
      acceptance,
      suggestedBlock: suggestedBlock({ total: 375, material: 200, labor: 175 }),
      intelligence: intelligence(),
    });
    expect(display.totalLabel).toBe('$375');
  });

  it('does not keep $2 from stale __allowance when Labor is deleted to empty', () => {
    // Repro: Labor $2000 → delete digits → "" but appliances__allowance still "2".
    const itemQuantities = {
      appliances__labor: { quantity: '', unit: 'allowance', quantitySource: 'user_entered' as const },
      appliances__allowance: { quantity: '2', unit: 'allowance', quantitySource: 'user_entered' as const },
    };
    expect(
      moneyTotalAfterQuantityEdit(
        'appliances',
        itemQuantities,
        'appliances__labor',
        ''
      )
    ).toBeNull();
    expect(liveScopeMoneyFromQuantities('appliances', itemQuantities)).toBeNull();
    expect(
      hasAcceptedScopePricing('appliances', itemQuantities, {
        appliances: {
          selectionStatus: 'manual_adjusted',
          pricingSourceLabel: 'User entered',
          pricingSourceKind: 'user_entered',
          pricingTypeLabel: 'Flat allowance',
          totalAmount: 2,
        },
      })
    ).toBe(false);

    const after = markManualPricingAdjustment(
      {
        selectionStatus: 'manual_adjusted',
        pricingSourceLabel: 'User entered',
        pricingSourceKind: 'user_entered',
        pricingTypeLabel: 'Flat allowance',
        totalAmount: 2,
      },
      'appliances',
      {
        appliances: {
          selectionStatus: 'manual_adjusted',
          pricingSourceLabel: 'User entered',
          pricingSourceKind: 'user_entered',
          pricingTypeLabel: 'Flat allowance',
          totalAmount: 2,
        },
      },
      moneyTotalAfterQuantityEdit('appliances', itemQuantities, 'appliances__labor', '')
    );
    expect(after?.appliances).toBeUndefined();
  });

  it('recognizes pure national comparison blocks as applyable', () => {
    expect(
      isNationalAverageComparisonBlock({
        isComparison: true,
        rateSourceLabel: 'National average comparison',
        pricingRecordId: 'bps_national_comparison:excavation:cy',
      })
    ).toBe(true);
    expect(
      isNationalAverageComparisonBlock({
        isComparison: true,
        rateSourceLabel: 'Southern Utah benchmark',
        pricingRecordId: 'stage::sitework',
      })
    ).toBe(false);
  });

  it('keeps suggestion panel when user edited away from suggested amount', () => {
    const itemQuantities = {
      permits__allowance: { quantity: '34000', unit: 'allowance', quantitySource: 'user_entered' as const },
    };
    const pricingAcceptance = {
      permits: {
        ...buildAcceptanceFromSuggestedBlock(suggestedBlock({ total: 32000, labor: 32000 })),
        selectionStatus: 'manual_adjusted' as const,
        totalAmount: 34000,
      },
    };
    expect(
      shouldHideSuggestedPanel({
        itemId: 'permits',
        itemQuantities,
        pricingAcceptance,
        suggestedTotal: 32000,
      })
    ).toBe(false);
  });

  it('never maps confidence values into geographic basis', () => {
    expect(geographicBasisFromSourceKind('national_average')).toBe('National');
    const display = resolveAcceptedPricingDisplay({
      itemId: 'permits',
      resolved: allowanceResolved(),
      acceptance: { ...buildAcceptanceFromSuggestedBlock(suggestedBlock()), geographicBasis: 'low' },
      intelligence: intelligence(),
    });
    expect(display.geographicBasis).toBe('National');
  });

  it('separates project-wide gaps from item-specific assembly components', () => {
    const gaps = collectProjectWideScopeGaps(intelligence().scopeGaps);
    expect(gaps.map((gap) => gap.label)).toContain('Utility coordination');
    expect(
      isItemSpecificAssemblyComponent(
        {
          key: 'meter_fees',
          label: 'Meter fees',
          status: 'unknown',
          severity: 'review',
          relatedScopeKeys: ['utility_coordination'],
          message: 'Unknown',
        },
        'permits'
      )
    ).toBe(false);
  });

  it('labels retail and national sources from suggested block', () => {
    expect(pricingSourceLabelFromBlock(suggestedBlock())).toBe('BPS national benchmark');
    expect(
      pricingSourceLabelFromBlock(
        suggestedBlock({ materialSource: 'template', laborSource: 'template', templateName: 'My saved bid' })
      )
    ).toBe('Saved rate');
  });

  it('uses pricing intelligence confidence for national average', () => {
    expect(confidenceBadgeLabel(intelligence(), buildAcceptanceFromSuggestedBlock(suggestedBlock()))).toBe(
      'Planning estimate'
    );
  });

  it('infers flat allowance pricing model without quantity disclosure', () => {
    const display = displayForPermits();
    expect(inferPricingModel(display.acceptance, allowanceResolved())).toBe('flat_allowance');
  });

  describe('getPricingSourceMessage', () => {
    it('displays neutral national average messaging', () => {
      const acceptance = buildAcceptanceFromSuggestedBlock(suggestedBlock());
      expect(getPricingSourceMessage(intelligence(), acceptance)).toBe(
        'Based on national average pricing. Review before sending the estimate.'
      );
    });

    it('displays regional average messaging', () => {
      const acceptance = {
        ...buildAcceptanceFromSuggestedBlock(suggestedBlock()),
        pricingSourceLabel: 'Regional average',
        pricingSourceKind: 'unknown' as const,
        geographicBasis: 'Regional',
      };
      expect(getPricingSourceMessage(intelligence(), acceptance)).toBe(
        'Based on regional average pricing. Confirm local rates before sending.'
      );
    });

    it('does not show an unnecessary source warning for user-entered pricing', () => {
      const acceptance = {
        selectionStatus: 'user_entered' as const,
        pricingSourceLabel: 'User entered',
        pricingSourceKind: 'user_entered' as const,
        pricingTypeLabel: 'Lump sum',
        totalAmount: 12000,
      };
      expect(getPricingSourceMessage(intelligence(), acceptance)).toBeNull();
    });

    it('does not show an unnecessary source warning for current saved company pricing', () => {
      const acceptance = {
        selectionStatus: 'accepted' as const,
        pricingSourceLabel: 'Saved company pricing',
        pricingSourceKind: 'saved_rate' as const,
        pricingTypeLabel: 'Material + labor',
        totalAmount: 9200,
      };
      expect(
        getPricingSourceMessage(
          intelligence({
            pricing: {
              source: 'saved_rate',
              confidence: 'high',
              confidenceLabel: 'High confidence',
              reason: '',
            },
            pricingCompleteness: {
              status: 'mostly_complete',
              rateType: 'allowance',
              confidence: 'high',
              includedCostComponents: [],
              missingCostComponents: [],
              unknownCostComponents: [],
              notices: [],
              dateRelevance: { status: 'current', message: 'Updated recently.' },
            },
          }),
          acceptance
        )
      ).toBeNull();
    });

    it('displays AI fallback review messaging', () => {
      const acceptance = {
        selectionStatus: 'accepted' as const,
        pricingSourceLabel: 'AI-estimated pricing',
        pricingSourceKind: 'unknown' as const,
        pricingTypeLabel: 'Unit pricing',
        totalAmount: 4800,
      };
      expect(getPricingSourceMessage(intelligence(), acceptance)).toBe(
        'AI-estimated pricing. Review before sending the estimate.'
      );
    });

    it('displays supplier confirmation messaging', () => {
      const acceptance = {
        selectionStatus: 'accepted' as const,
        pricingSourceLabel: 'Supplier pricing',
        pricingSourceKind: 'unknown' as const,
        pricingTypeLabel: 'Material',
        totalAmount: 2400,
      };
      expect(getPricingSourceMessage(intelligence(), acceptance)).toBe(
        'Based on supplier pricing. Confirm current availability and rate before sending.'
      );
    });

    it('returns only one source-related message and keeps badge consistency', () => {
      const display = displayForPermits();
      expect(display.warningMessage?.split('.').length).toBeLessThanOrEqual(3);
      expect(display.pricingSourceLabel).toBe('BPS national benchmark');
      expect(display.warningMessage).toContain('national average pricing');
    });
  });

  it('does not treat living/floor SF as the accepted dollar total for tile & flooring', () => {
    const acceptance = {
      selectionStatus: 'manual_adjusted' as const,
      pricingSourceLabel: 'User adjusted',
      pricingSourceKind: 'user_entered' as const,
      pricingTypeLabel: 'Material + labor',
      materialAmount: 7159,
      laborAmount: 8944,
      // Bug regression: Edit seeded allowance with living SF (1879) as dollars.
      totalAmount: 1879,
    };
    const resolved: ResolvedItemQuantity = {
      quantity: 1879,
      unit: 'sqft',
      quantitySource: 'inferred',
      sourceLabel: 'From plan',
      pricingReady: true,
      showInput: true,
    };
    expect(resolveAcceptedMoneyTotal({ resolved, acceptance })).toBe(16103);
    const display = resolveAcceptedPricingDisplay({
      itemId: 'tile_flooring',
      resolved,
      acceptance,
      suggestedBlock: suggestedBlock({
        total: 16100,
        material: 7159,
        labor: 8944,
        lumpSumOnly: false,
        basis: { quantity: 1879, unit: 'sqft' },
      }),
      intelligence: intelligence(),
    });
    expect(display.totalLabel).toBe('$16,103');

    const itemQuantities = {
      tile_flooring__material: {
        quantity: '7159',
        unit: 'allowance',
        quantitySource: 'user_entered' as const,
      },
      tile_flooring__labor: {
        quantity: '8944',
        unit: 'allowance',
        quantitySource: 'user_entered' as const,
      },
      tile_flooring__allowance: {
        quantity: '1879',
        unit: 'allowance',
        quantitySource: 'user_entered' as const,
      },
    };
    expect(currentScopePricingTotal('tile_flooring', itemQuantities, { tile_flooring: acceptance })).toBe(
      16103
    );
    expect(
      moneyTotalAfterQuantityEdit(
        'tile_flooring',
        itemQuantities,
        'tile_flooring__sqft_basis',
        '1879'
      )
    ).toBe(16103);
  });

  it('shows cents on applied card totals when stored amounts include them', () => {
    const display = resolveAcceptedPricingDisplay({
      itemId: 'excavation',
      resolved: {
        quantity: null,
        unit: 'allowance',
        quantitySource: 'user_entered',
        sourceLabel: 'Applied',
        pricingReady: true,
        showInput: true,
        dualMaterial: { quantity: 2500.15, unit: 'allowance' },
        dualLabor: { quantity: 3047.4, unit: 'allowance' },
      },
      acceptance: {
        selectionStatus: 'accepted',
        pricingSourceLabel: 'National Average',
        pricingSourceKind: 'national_average',
        pricingTypeLabel: 'Material + Labor',
        totalAmount: 5547.55,
        materialAmount: 2500.15,
        laborAmount: 3047.4,
      },
      intelligence: intelligence(),
    });
    expect(display.totalLabel).toBe('$5,547.55');
  });
});
