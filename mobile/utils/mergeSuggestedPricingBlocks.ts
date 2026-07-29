/**
 * Bulk-apply Confirm Scope suggested prices into measurement state.
 * Trade Applies (Foundation, Framing, flatwork, etc.) always write.
 * Child trades only clear a stage *planning allowance* — never another trade on the stage owner.
 */
import { buildAcceptanceFromSuggestedBlock } from '@/utils/acceptedPricingSummaryUi';
import { syncScopeGapPricingStatuses } from '@/utils/scopeReviewUi';
import {
  allowanceSplitSubKey,
  getChecklistItemQuantityRuleOrDefault,
  primaryQuantityForAppliedSuggestedBlock,
  roughAllowanceSubKey,
  type ScopeMeasurementsInputExtended,
  type SuggestedPricingBlock,
} from '@/utils/scopeItemQuantities';
import {
  benchmarkStageForScopeKey,
  measurementSemanticsV1Enabled,
  STAGE_BENCHMARK_OWNERS,
} from '@/utils/measurementSemantics';

export type SuggestedPricingApplyRow = {
  itemId: string;
  block: SuggestedPricingBlock;
};

export type MergeSuggestedPricingResult = {
  measurements: ScopeMeasurementsInputExtended;
  /** Stage hosts cleared because a child trade was applied in this batch. */
  clearedSelectedOwners: string[];
};

function isTradeApplyBlock(block: SuggestedPricingBlock): boolean {
  if (block.benchmarkAction === 'benchmark_only') return false;
  if (block.benchmarkAction === 'price_ready') return true;
  return block.materialSource !== 'local_benchmark' || block.laborSource !== 'local_benchmark';
}

export function mergeSuggestedPricingBlocksIntoMeasurements(
  prev: ScopeMeasurementsInputExtended,
  rows: SuggestedPricingApplyRow[],
  templateKey?: string | null
): MergeSuggestedPricingResult {
  if (!rows.length) {
    return { measurements: prev, clearedSelectedOwners: [] };
  }

  const itemQuantities: Record<
    string,
    { quantity: string; unit: string; quantitySource: string }
  > = {
    ...(prev.itemQuantities || {}),
  };
  const pricingAcceptance = {
    ...(prev.pricingAcceptance || {}),
  };
  let appliedBenchmarkKeys = [...(prev.appliedBenchmarkKeys || [])];
  const clearedSelectedOwners = new Set<string>();

  // Stage owners that receive a trade Apply in this same batch must not be wiped
  // by a sibling trade (e.g. Foundation + Exterior flatwork).
  const tradeOwnersInBatch = new Set(
    rows
      .filter(({ itemId, block }) => {
        if (!isTradeApplyBlock(block)) return false;
        const stageKey = block.benchmarkStageKey || benchmarkStageForScopeKey(itemId);
        return Boolean(stageKey && STAGE_BENCHMARK_OWNERS[stageKey] === itemId);
      })
      .map(({ itemId }) => itemId)
  );

  const clearSupersededStageAllowance = (
    stageKey: string | null | undefined,
    exceptItemId: string
  ) => {
    if (!stageKey) return;
    const owner = STAGE_BENCHMARK_OWNERS[stageKey];
    if (!owner || owner === exceptItemId) return;
    if (tradeOwnersInBatch.has(owner)) return;
    // Only replace a planning stage allowance — never Foundation/Framing trade $.
    if (pricingAcceptance[owner]?.pricingSourceKind !== 'local_benchmark') return;

    delete pricingAcceptance[owner];
    for (const key of [
      owner,
      allowanceSplitSubKey(owner, 'allowance'),
      allowanceSplitSubKey(owner, 'sqft_basis'),
      allowanceSplitSubKey(owner, 'material'),
      allowanceSplitSubKey(owner, 'labor'),
      roughAllowanceSubKey(owner),
    ]) {
      delete itemQuantities[key];
    }
    clearedSelectedOwners.add(owner);
    appliedBenchmarkKeys = appliedBenchmarkKeys.filter(
      (key) => !String(key).endsWith(`::stage::${stageKey}`)
    );
  };

  for (const { itemId, block } of rows) {
    const appKey = block.benchmarkApplicationKey;
    if (
      measurementSemanticsV1Enabled() &&
      appKey &&
      block.benchmarkAction === 'benchmark_only' &&
      appliedBenchmarkKeys.includes(appKey)
    ) {
      continue;
    }

    const stageKey = block.benchmarkStageKey || benchmarkStageForScopeKey(itemId);
    if (stageKey && isTradeApplyBlock(block)) {
      clearSupersededStageAllowance(stageKey, itemId);
    }

    const rule = getChecklistItemQuantityRuleOrDefault(itemId, templateKey);
    const allowanceKey = rule.dualAllowanceField
      ? roughAllowanceSubKey(itemId)
      : allowanceSplitSubKey(itemId, 'allowance');
    const basisKey = allowanceSplitSubKey(itemId, 'sqft_basis');
    const materialKey = allowanceSplitSubKey(itemId, 'material');
    const laborKey = allowanceSplitSubKey(itemId, 'labor');
    itemQuantities[allowanceKey] = {
      quantity: String(block.storedTotalExact ?? block.total),
      unit: 'allowance',
      quantitySource: 'user_entered',
    };
    if (block.basis?.quantity && block.basis.unit) {
      itemQuantities[basisKey] = {
        quantity: String(block.basis.quantity),
        unit: block.basis.unit,
        quantitySource: 'user_entered',
      };
    }
    if (!block.lumpSumOnly) {
      itemQuantities[materialKey] = {
        quantity: String(block.material),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
      itemQuantities[laborKey] = {
        quantity: String(block.labor),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
    } else if (block.labor > 0) {
      itemQuantities[laborKey] = {
        quantity: String(block.labor),
        unit: 'allowance',
        quantitySource: 'user_entered',
      };
    }
    if (!rule.dualAllowanceField) {
      const primary = primaryQuantityForAppliedSuggestedBlock(block, rule);
      itemQuantities[itemId] = {
        quantity: primary.quantity,
        unit: primary.unit,
        quantitySource: 'user_entered',
      };
    }
    pricingAcceptance[itemId] = buildAcceptanceFromSuggestedBlock(block);
    if (appKey && !appliedBenchmarkKeys.includes(appKey)) {
      appliedBenchmarkKeys.push(appKey);
    }
  }

  return {
    measurements: {
      ...prev,
      itemQuantities,
      pricingAcceptance,
      appliedBenchmarkKeys,
      scopeGapResolutions: syncScopeGapPricingStatuses(prev.scopeGapResolutions, {
        itemQuantities,
        pricingAcceptance,
      }),
    },
    clearedSelectedOwners: [...clearedSelectedOwners],
  };
}
