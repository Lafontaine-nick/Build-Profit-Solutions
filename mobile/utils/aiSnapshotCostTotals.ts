import { sumStep3ReviewBudgetTotals } from '@/utils/benchmarkReasonablenessContext';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { applyDraftToEstimate, sumEstimateLineTotals } from '@/utils/estimateAiDraft';

export type EstimateLineTotals = { material: number; labor: number };

type RegeneratedApply = {
  totals: EstimateLineTotals;
  labels: Set<string>;
};

const regeneratedByDraft = new WeakMap<object, RegeneratedApply | null>();

const normLabel = (value: unknown) =>
  String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');

function applyForComparison(draft: EstimateAiDraft, applyConfirmedOnly: boolean): RegeneratedApply {
  const { bid } = applyDraftToEstimate({}, draft, { applyConfirmedOnly });
  const rows = [
    ...((bid.materialLineItems as any[]) || []),
    ...((bid.laborLineItems as any[]) || []),
  ];
  return {
    totals: sumEstimateLineTotals(bid.materialLineItems, bid.laborLineItems),
    labels: new Set(rows.map((row) => normLabel(row?.name)).filter(Boolean)),
  };
}

/**
 * What applying this draft produces today (cached per draft object). The apply mode is not
 * stored on the snapshot, so prefer whichever mode reproduces the Confirm Scope totals.
 */
function regeneratedApply(draft: unknown): RegeneratedApply | null {
  if (!draft || typeof draft !== 'object') return null;
  if (regeneratedByDraft.has(draft)) return regeneratedByDraft.get(draft) ?? null;
  let result: RegeneratedApply | null = null;
  try {
    const step3 = sumStep3ReviewBudgetTotals(draft as EstimateAiDraft);
    const matchesStep3 = (r: RegeneratedApply) =>
      Boolean(step3) &&
      Math.abs(r.totals.material - step3!.material) < 0.01 &&
      Math.abs(r.totals.labor - step3!.labor) < 0.01;
    const confirmedOnly = applyForComparison(draft as EstimateAiDraft, true);
    if (matchesStep3(confirmedOnly)) {
      result = confirmedOnly;
    } else {
      const everything = applyForComparison(draft as EstimateAiDraft, false);
      result = matchesStep3(everything) ? everything : confirmedOnly;
    }
  } catch {
    result = null;
  }
  regeneratedByDraft.set(draft, result);
  return result;
}

function storedLineTotalsAtApply(snapshot: any): EstimateLineTotals | null {
  const stored = snapshot?.lineTotalsAtApply;
  if (stored && Number.isFinite(Number(stored.material)) && Number.isFinite(Number(stored.labor))) {
    return { material: Number(stored.material), labor: Number(stored.labor) };
  }
  return null;
}

/** Line-item totals written when the draft was applied; re-derived from the draft for older snapshots. */
export function lineTotalsAtApply(snapshot: any): EstimateLineTotals | null {
  const stored = storedLineTotalsAtApply(snapshot);
  if (stored) return stored;
  if (snapshot?.applyMode === 'scope_only') return { material: 0, labor: 0 };
  return regeneratedApply(snapshot?.draft)?.totals ?? null;
}

/**
 * Cost totals for a bid built from an applied AI draft. Confirm Scope totals stay the base
 * (persisted line items can carry stale legacy rows); changes made to the line items since the
 * draft was applied are added on top, so hand edits move the price.
 */
export function appliedAiSnapshotCostTotals(
  bid: any,
  currentLineTotals: EstimateLineTotals
): EstimateLineTotals | null {
  const snapshot = bid?.aiEstimateDraftSnapshot;
  const draft = snapshot?.draft;
  if (!draft) return null;
  const totals = sumStep3ReviewBudgetTotals(draft);
  if (!totals || !(totals.total > 0)) return null;
  const atApply = lineTotalsAtApply(snapshot);
  if (!atApply) return { material: totals.material, labor: totals.labor };
  const adjusted = (base: number, current: number, applied: number) =>
    Math.max(Math.round((base + current - applied) * 100) / 100, 0);
  return {
    material: adjusted(totals.material, currentLineTotals.material, atApply.material),
    labor: adjusted(totals.labor, currentLineTotals.labor, atApply.labor),
  };
}

/**
 * Whether persisted line items should be rebuilt from the confirmed draft. Snapshots that record
 * their apply totals are rebuilt only when the apply itself exceeded Confirm Scope. Older snapshots
 * are rebuilt only when they carry rows the confirmed draft no longer produces (stale packages);
 * price or quantity edits on existing rows are kept.
 */
export function aiSnapshotLinesNeedRebuild(bid: any): boolean {
  const snapshot = bid?.aiEstimateDraftSnapshot;
  const draft = snapshot?.draft;
  if (!draft) return false;
  const step3 = sumStep3ReviewBudgetTotals(draft);
  if (!step3 || !(step3.total > 0)) return false;
  const step3Lines = step3.material + step3.labor;

  const stored = storedLineTotalsAtApply(snapshot);
  if (stored) return stored.material + stored.labor > step3Lines + 0.01;

  const regenerated = regeneratedApply(draft);
  if (!regenerated) return false;
  const current = sumEstimateLineTotals(bid.materialLineItems, bid.laborLineItems);
  if (!(current.material + current.labor > step3Lines + 0.01)) return false;
  const rows = [...(bid.materialLineItems || []), ...(bid.laborLineItems || [])];
  return rows.some((row: any) => {
    const label = normLabel(row?.name);
    return Boolean(label) && !regenerated.labels.has(label);
  });
}
