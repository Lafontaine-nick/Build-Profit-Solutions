import type { AssemblyComponentStatus } from '@/utils/scopeAssemblyRegistry';
import {
  applyParentScopeGapPriceAddon,
  applyScopeGapExclusionsToDraft,
  buildScopeReviewFooterText,
  collectParentIncludedScopeGapLines,
  formatParentIncludedScopeGapSummary,
  countNeedsSeparatePricing,
  countUnresolvedScopeDecisions,
  countUnresolvedScopeGaps,
  ensureSeparateScopeItemInChecklist,
  formatNeedsSeparatePricingLabel,
  getScopeGapRecord,
  getReviewableScopeComponents,
  benchmarkAssumptionRowLabel,
  benchmarkResolutionPrefillStatus,
  benchmarkScopeSummary,
  scopeReviewRecommendedActionLabel,
  scopeReviewRowGuidance,
  resolveSeparateLineItemId,
  scopeGapAddonCostBucketForComponent,
  scopeGapResolutionActionGroups,
  scopeGapStatusActionLabel,
  shouldAutoExpandScopeGapMoreOptions,
  scopeGapStatusRowLabel,
  setScopeGapResolution,
  syncScopeGapPricingStatuses,
} from '@/utils/scopeReviewUi';
import type { ScopeChecklistItem } from '@/utils/estimateAiDraft';
import type { BenchmarkScopeAssumptionProfile } from '@/utils/benchmarkScopeAssumptions';

function component(
  key: string,
  overrides: Partial<AssemblyComponentStatus> = {}
): AssemblyComponentStatus {
  return {
    key,
    label: key.replace(/_/g, ' '),
    status: 'unknown',
    severity: 'info',
    relatedScopeKeys: ['excavation', 'haul_off'],
    message: 'Not confirmed',
    ...overrides,
  };
}

describe('scopeReviewUi refinements', () => {
  it('uses action labels aligned with the review sheet wording', () => {
    expect(scopeGapStatusActionLabel('included')).toBe('Included');
    expect(scopeGapStatusActionLabel('excluded')).toBe('Not in this bid');
    expect(scopeGapStatusActionLabel('price_separately')).toBe('Price separately');
    expect(scopeGapStatusActionLabel('priced_elsewhere')).toBe('Covered elsewhere');
  });

  it('groups excluded benchmark actions into primary and more options', () => {
    const groups = scopeGapResolutionActionGroups('excluded', { offersIncludeWithCost: true });
    expect(groups.primary.map((row) => row.label)).toEqual(['Add as separate item', 'Not in this bid']);
    expect(groups.moreOptions.map((row) => row.label)).toEqual([
      'Covered elsewhere',
      'Include without price change',
    ]);
  });

  it('auto-expands more options when the saved choice lives under more options', () => {
    const groups = scopeGapResolutionActionGroups('excluded', { offersIncludeWithCost: true });
    const elsewhere = getScopeGapRecord(
      setScopeGapResolution(undefined, 'excavation', 'haul_off', 'priced_elsewhere'),
      'excavation',
      'haul_off'
    );
    const includedNoCost = getScopeGapRecord(
      setScopeGapResolution(undefined, 'excavation', 'haul_off', 'included'),
      'excavation',
      'haul_off'
    );
    const includedWithCost = getScopeGapRecord(
      setScopeGapResolution(undefined, 'excavation', 'haul_off', 'included', { parentPriceAddon: 600 }),
      'excavation',
      'haul_off'
    );
    expect(shouldAutoExpandScopeGapMoreOptions(elsewhere, groups)).toBe(true);
    expect(shouldAutoExpandScopeGapMoreOptions(includedNoCost, groups)).toBe(true);
    expect(shouldAutoExpandScopeGapMoreOptions(includedWithCost, groups)).toBe(false);
    expect(
      shouldAutoExpandScopeGapMoreOptions(
        getScopeGapRecord(
          setScopeGapResolution(undefined, 'excavation', 'haul_off', 'excluded'),
          'excavation',
          'haul_off'
        ),
        groups
      )
    ).toBe(false);
  });

  it('shows compact row labels distinct from action menu wording', () => {
    expect(scopeGapStatusRowLabel(getScopeGapRecord(undefined, 'x', 'y'))).toBe('Not confirmed');
    expect(
      scopeGapStatusRowLabel(
        getScopeGapRecord(
          setScopeGapResolution(undefined, 'excavation', 'export', 'excluded'),
          'excavation',
          'export'
        )
      )
    ).toBe('Not in bid');
    expect(
      scopeGapStatusRowLabel(
        getScopeGapRecord(
          setScopeGapResolution(undefined, 'excavation', 'export', 'price_separately', {
            linkedLineItemId: 'haul_off',
            parentScopeItemId: 'excavation',
          }),
          'excavation',
          'export'
        )
      )
    ).toBe('Needs separate price');
  });

  it('treats excluded as resolved without requiring pricing', () => {
    const resolutions = setScopeGapResolution(undefined, 'excavation', 'shoring', 'excluded');
    const reviewable = [component('shoring')];
    expect(countUnresolvedScopeGaps('excavation', reviewable, resolutions)).toBe(0);
    expect(countNeedsSeparatePricing('excavation', reviewable, resolutions)).toBe(0);
  });

  it('keeps price separately unresolved until linked line item has valid pricing', () => {
    const resolutions = setScopeGapResolution(undefined, 'excavation', 'export', 'price_separately', {
      linkedLineItemId: 'haul_off',
      parentScopeItemId: 'excavation',
    });
    const reviewable = [component('export')];
    expect(countNeedsSeparatePricing('excavation', reviewable, resolutions)).toBe(1);
    expect(countUnresolvedScopeGaps('excavation', reviewable, resolutions)).toBe(1);

    const pricingContext = {
      itemQuantities: { haul_off__allowance: { quantity: '900', unit: 'allowance', quantitySource: 'user_entered' } },
      pricingAcceptance: {
        haul_off: {
          selectionStatus: 'accepted' as const,
          pricingSourceLabel: 'User entered',
          pricingSourceKind: 'user_entered' as const,
          pricingTypeLabel: 'Lump sum',
          totalAmount: 900,
        },
      },
    };
    const priced = syncScopeGapPricingStatuses(resolutions, pricingContext);
    expect(countNeedsSeparatePricing('excavation', reviewable, priced, pricingContext)).toBe(0);
    expect(countUnresolvedScopeGaps('excavation', reviewable, priced, pricingContext)).toBe(0);
  });

  it('builds footer text that distinguishes review from pricing still required', () => {
    expect(
      buildScopeReviewFooterText({
        total: 5,
        unresolvedDecisionCount: 5,
        reviewedCount: 0,
        needsPricingCount: 0,
      })
    ).toBe('5 items still need review');
    expect(
      buildScopeReviewFooterText({
        total: 5,
        unresolvedDecisionCount: 0,
        reviewedCount: 4,
        needsPricingCount: 1,
      })
    ).toBe('4 of 5 reviewed · 1 still needs pricing');
    expect(
      buildScopeReviewFooterText({
        total: 5,
        unresolvedDecisionCount: 0,
        reviewedCount: 5,
        needsPricingCount: 0,
      })
    ).toBe('5 of 5 reviewed');
  });

  it('resolves separate line item ids from related scope keys', () => {
    expect(resolveSeparateLineItemId(component('export'), 'excavation')).toBe('haul_off');
    expect(resolveSeparateLineItemId(component('backfill', { relatedScopeKeys: ['backfill'] }), 'excavation')).toBe(
      'backfill'
    );
  });

  it('does not duplicate separate scope checklist items', () => {
    const existing: ScopeChecklistItem[] = [
      { id: 'haul_off', label: 'Haul-off', inputType: 'yes_no', state: 'included' },
    ];
    const result = ensureSeparateScopeItemInChecklist(existing, component('export'), 'excavation');
    expect(result.created).toBe(false);
    expect(result.lineItemId).toBe('haul_off');
    expect(result.items).toHaveLength(1);
  });

  it('creates a linked scope item when none exists', () => {
    const result = ensureSeparateScopeItemInChecklist([], component('shoring', { relatedScopeKeys: [] }), 'excavation');
    expect(result.created).toBe(true);
    expect(result.lineItemId).toBe('excavation__gap__shoring');
    expect(result.items[0].derivedFrom).toBe('excavation');
    expect(result.items[0].state).toBe('included');
  });

  it('merges and removes scope-gap exclusions on draft persist', () => {
    const resolutions = setScopeGapResolution(undefined, 'excavation', 'shoring', 'excluded');
    const next = applyScopeGapExclusionsToDraft(['Existing exclusion'], resolutions);
    expect(next).toContain('Existing exclusion');
    expect(next).toContain('Shoring');

    const cleared = applyScopeGapExclusionsToDraft(next, {}, resolutions);
    expect(cleared).toEqual(['Existing exclusion']);
  });

  it('formats needs-pricing card labels', () => {
    expect(formatNeedsSeparatePricingLabel(1)).toBe('1 item still needs pricing');
    expect(formatNeedsSeparatePricingLabel(2)).toBe('2 items still need pricing');
  });

  it('counts unresolved scope decisions separately from pricing completion', () => {
    const resolutions = setScopeGapResolution(undefined, 'excavation', 'export', 'price_separately', {
      linkedLineItemId: 'haul_off',
    });
    const reviewable = [component('export'), component('dump_fees')];
    expect(countUnresolvedScopeDecisions('excavation', reviewable, resolutions)).toBe(1);
  });

  it('uses a defined benchmark profile to require only excluded, conditional, unknown, or high-risk included assumptions', () => {
    const profile: BenchmarkScopeAssumptionProfile = {
      sourceRecordId: 'test:excavation',
      pricingSource: 'national_average',
      scopeAssumptionsDefined: true,
      scopeAssumptions: [
        { scopeKey: 'loading', status: 'included', displayLabel: 'Loading excavated material' },
        { scopeKey: 'haul_off', status: 'excluded', displayLabel: 'Haul-off / export' },
        {
          scopeKey: 'backfill',
          status: 'conditional',
          displayLabel: 'Backfill',
          conditionText: 'Included only when suitable excavated material is reused onsite.',
        },
        { scopeKey: 'rock_excavation', status: 'unknown', displayLabel: 'Rock excavation' },
      ],
    };
    const reviewable = getReviewableScopeComponents([], 'excavation', null, profile);
    expect(reviewable.map((item) => item.key)).toEqual(['haul_off', 'backfill', 'rock_excavation']);
    expect(benchmarkAssumptionRowLabel(profile, reviewable[0])).toBe('Not included in suggested price');
    expect(benchmarkAssumptionRowLabel(profile, reviewable[1])).toContain('Conditional');
  });

  it('includes defined included scope in the benchmark summary without making low-risk base scope reviewable', () => {
    const profile: BenchmarkScopeAssumptionProfile = {
      sourceRecordId: 'test:flooring',
      pricingSource: 'national_average',
      scopeAssumptionsDefined: true,
      scopeAssumptions: [
        { scopeKey: 'flooring_material', status: 'included', displayLabel: 'Flooring material' },
        { scopeKey: 'flooring_installation', status: 'included', displayLabel: 'Standard installation' },
        { scopeKey: 'floor_demo', status: 'excluded', displayLabel: 'Existing-floor demolition' },
      ],
    };
    const summary = benchmarkScopeSummary(profile, '$9,000');
    expect(summary.included).toEqual(['Flooring material', 'Standard installation']);
    expect(summary.notIncluded).toEqual(['Existing-floor demolition']);
    expect(getReviewableScopeComponents([], 'flooring', null, profile).map((item) => item.key)).toEqual(['floor_demo']);
  });

  it('shows undefined benchmark scope fallback copy', () => {
    const summary = benchmarkScopeSummary(
      { sourceRecordId: 'legacy', scopeAssumptionsDefined: false, scopeAssumptions: [] },
      '$2,500'
    );
    expect(summary.title).toBe('Benchmark inclusions not defined');
    expect(summary.body).toMatch(/does not specify all included work/i);
  });

  it('shows base national average copy for undefined national average profiles', () => {
    const summary = benchmarkScopeSummary(
      {
        sourceRecordId: 'legacy',
        pricingSource: 'national_average',
        scopeAssumptionsDefined: false,
        scopeAssumptions: [],
      },
      '$2,500',
      'excavation'
    );
    expect(summary.title).toBe('Base national average only');
    expect(summary.body).toMatch(/Base national average only/i);
    expect(summary.body).toMatch(/haul off, dump fees, backfill, and compaction/i);
  });

  it('shows base national average copy for defined national average profiles', () => {
    const summary = benchmarkScopeSummary(
      {
        sourceRecordId: 'test:excavation',
        pricingSource: 'national_average',
        scopeAssumptionsDefined: true,
        scopeAssumptions: [
          { scopeKey: 'excavation', status: 'included', displayLabel: 'Base excavation' },
          { scopeKey: 'haul_off', status: 'excluded', displayLabel: 'Haul-off / export' },
        ],
      },
      '$2,500',
      'excavation'
    );
    expect(summary.title).toBe('Base national average scope for $2,500');
    expect(summary.body).toBe(
      'Base national average only. Related work like haul-off / export may need to be added separately.'
    );
  });

  it('uses permit-specific national average copy instead of excavation defaults', () => {
    const summary = benchmarkScopeSummary(
      {
        sourceRecordId: 'national_average:permits:allowance',
        pricingSource: 'national_average',
        scopeAssumptionsDefined: true,
        scopeAssumptions: [
          { scopeKey: 'building_permit', status: 'included', displayLabel: 'Building permit allowance' },
          { scopeKey: 'impact_fees', status: 'excluded', displayLabel: 'Impact fees' },
          { scopeKey: 'meter_fees', status: 'excluded', displayLabel: 'Meter fees' },
        ],
      },
      '$3,500',
      'permits'
    );
    expect(summary.body).toMatch(/impact fees and meter fees/i);
    expect(summary.body).not.toMatch(/haul-off|backfill|pumping|reinforcement/i);
  });

  it('returns five high-impact excavation assumptions when benchmark scope is undefined', () => {
    const reviewable = getReviewableScopeComponents([], 'excavation', null, {
      sourceRecordId: 'legacy',
      scopeAssumptionsDefined: false,
      scopeAssumptions: [],
    });
    expect(reviewable.map((item) => item.key)).toEqual([
      'haul_off',
      'dump_fees',
      'backfill',
      'compaction',
      'shoring',
    ]);
  });

  it('shows trade guidance for unknown benchmark assumptions without treating it as benchmark fact', () => {
    const component = {
      key: 'dump_fees',
      label: 'Dump fees',
      status: 'unknown' as const,
      severity: 'review' as const,
      relatedScopeKeys: ['excavation', 'dump_fees'],
      message: '',
    };
    const guidance = scopeReviewRowGuidance('excavation', component, {
      sourceRecordId: 'legacy',
      scopeAssumptionsDefined: false,
      scopeAssumptions: [],
    });
    expect(guidance?.guidanceText).toMatch(/disposal facility/i);
    expect(scopeReviewRecommendedActionLabel({
      scopeKey: 'excavation',
      component,
      benchmarkProfile: { sourceRecordId: 'legacy', scopeAssumptionsDefined: false, scopeAssumptions: [] },
    })).toBe('Recommended: Add as separate item');
  });

  it('prefills included benchmark assumptions in the row label', () => {
    const profile = {
      sourceRecordId: 'test:excavation',
      scopeAssumptionsDefined: true,
      scopeAssumptions: [{ scopeKey: 'compaction', status: 'included' as const, displayLabel: 'Compaction' }],
    };
    const component = {
      key: 'compaction',
      label: 'Compaction',
      status: 'unknown' as const,
      severity: 'info' as const,
      relatedScopeKeys: ['excavation', 'compaction'],
      message: '',
    };
    expect(
      scopeGapStatusRowLabel(
        null,
        undefined,
        benchmarkResolutionPrefillStatus({ record: null, benchmarkProfile: profile, component })
      )
    ).toBe('Included');
    expect(benchmarkAssumptionRowLabel(profile, component)).toBe('Included in suggested price');
  });

  it('preserves original benchmark assumption metadata when contractor overrides it', () => {
    const profile: BenchmarkScopeAssumptionProfile = {
      sourceRecordId: 'test:excavation',
      scopeAssumptionsDefined: true,
      scopeAssumptions: [
        { scopeKey: 'haul_off', status: 'excluded', displayLabel: 'Haul-off / export' },
      ],
    };
    const resolutions = setScopeGapResolution(undefined, 'excavation', 'haul_off', 'included', {
      benchmarkProfile: profile,
      benchmarkAssumption: profile.scopeAssumptions[0],
    });
    const record = getScopeGapRecord(resolutions, 'excavation', 'haul_off');
    expect(record?.benchmarkAssumptionStatus).toBe('excluded');
    expect(record?.status).toBe('included');
    expect(record?.overriddenBenchmarkAssumption).toBe(true);
    expect(record?.sourceRecordId).toBe('test:excavation');
  });

  it('adds parent scope gap cost to excavation allowance without a separate line item', () => {
    const pricingAcceptance = {
      excavation: {
        selectionStatus: 'accepted' as const,
        pricingSourceLabel: 'National average',
        pricingSourceKind: 'national_average' as const,
        totalAmount: 2500,
        materialAmount: 250,
        laborAmount: 2250,
      },
    };
    const itemQuantities = {
      excavation: { quantity: '2500', unit: 'allowance', quantitySource: 'user_entered' as const },
      excavation__allowance: { quantity: '2500', unit: 'allowance', quantitySource: 'user_entered' as const },
      excavation__material: { quantity: '250', unit: 'allowance', quantitySource: 'user_entered' as const },
      excavation__labor: { quantity: '2250', unit: 'allowance', quantitySource: 'user_entered' as const },
    };
    const updated = applyParentScopeGapPriceAddon({
      parentScopeItemId: 'excavation',
      componentKey: 'haul_off',
      addonAmount: 800,
      itemQuantities,
      pricingAcceptance,
    });
    expect(updated.pricingAcceptance?.excavation?.totalAmount).toBe(3300);
    expect(updated.pricingAcceptance?.excavation?.laborAmount).toBe(2250);
    expect(updated.pricingAcceptance?.excavation?.allowanceAmount).toBe(800);
    expect(updated.itemQuantities.excavation__allowance?.quantity).toBe('3300');

    const resolutions = setScopeGapResolution(undefined, 'excavation', 'haul_off', 'included', {
      parentPriceAddon: 800,
    });
    expect(collectParentIncludedScopeGapLines('excavation', resolutions)).toEqual(['Haul-off / export (+$800)']);
    expect(
      scopeGapStatusRowLabel(getScopeGapRecord(resolutions, 'excavation', 'haul_off'))
    ).toBe('Included (+$800)');
  });

  it('replaces a prior parent addon instead of stacking when amount changes', () => {
    const pricingAcceptance = {
      excavation: {
        selectionStatus: 'manual_adjusted' as const,
        pricingSourceLabel: 'User adjusted',
        pricingSourceKind: 'user_entered' as const,
        totalAmount: 3300,
        materialAmount: 250,
        laborAmount: 3050,
      },
    };
    const itemQuantities = {
      excavation__allowance: { quantity: '3300', unit: 'allowance', quantitySource: 'user_entered' as const },
      excavation__material: { quantity: '250', unit: 'allowance', quantitySource: 'user_entered' as const },
      excavation__labor: { quantity: '3050', unit: 'allowance', quantitySource: 'user_entered' as const },
    };
    const updated = applyParentScopeGapPriceAddon({
      parentScopeItemId: 'excavation',
      componentKey: 'haul_off',
      addonAmount: 1000,
      previousAddonAmount: 800,
      itemQuantities,
      pricingAcceptance,
    });
    expect(updated.pricingAcceptance?.excavation?.totalAmount).toBe(3500);
    expect(updated.pricingAcceptance?.excavation?.allowanceAmount).toBe(1000);
  });

  it('routes sawcutting addons into labor and disposal addons into allowance', () => {
    expect(scopeGapAddonCostBucketForComponent('haul_off')).toBe('allowance');
    expect(scopeGapAddonCostBucketForComponent('disposal')).toBe('allowance');
    expect(scopeGapAddonCostBucketForComponent('sawcutting')).toBe('labor');

    const pricingAcceptance = {
      concrete: {
        selectionStatus: 'manual_adjusted' as const,
        pricingSourceLabel: 'User adjusted',
        pricingSourceKind: 'user_entered' as const,
        totalAmount: 9250,
        materialAmount: 4125,
        laborAmount: 5125,
        allowanceAmount: 0,
      },
    };
    const itemQuantities = {
      concrete__material: { quantity: '4125', unit: 'allowance', quantitySource: 'user_entered' as const },
      concrete__labor: { quantity: '5125', unit: 'allowance', quantitySource: 'user_entered' as const },
      concrete__allowance: { quantity: '9250', unit: 'allowance', quantitySource: 'user_entered' as const },
    };
    const updated = applyParentScopeGapPriceAddon({
      parentScopeItemId: 'concrete',
      componentKey: 'disposal',
      addonAmount: 200,
      itemQuantities,
      pricingAcceptance,
    });
    expect(updated.pricingAcceptance?.concrete?.totalAmount).toBe(9450);
    expect(updated.pricingAcceptance?.concrete?.laborAmount).toBe(5125);
    expect(updated.pricingAcceptance?.concrete?.allowanceAmount).toBe(200);
  });

  it('summarizes bundled scope addons when more than two are included', () => {
    const resolutions = {
      'concrete::sawcutting': { status: 'included' as const, parentPriceAddon: 500 },
      'concrete::disposal': { status: 'included' as const, parentPriceAddon: 200 },
      'concrete::reinforcement': { status: 'included' as const, parentPriceAddon: 300 },
    };
    expect(formatParentIncludedScopeGapSummary('concrete', resolutions)).toBe('Includes: 3 added scope items');
    expect(formatParentIncludedScopeGapSummary('concrete', {
      'concrete::sawcutting': { status: 'included' as const, parentPriceAddon: 500 },
      'concrete::disposal': { status: 'included' as const, parentPriceAddon: 200 },
    })).toBe('Includes: Sawcutting (+$500) · Disposal / haul-off (+$200)');
  });
});
