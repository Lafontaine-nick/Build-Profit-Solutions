import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";

export type BudgetProfitMixSegment = {
  key: string;
  label: string;
  value: number;
  sweepDeg: number;
  color: string;
};

/** Segment colors: teal (spent), blue (remaining), green (profit); shortfall stays distinct when EAC > contract. */
const COLOR_SPENT = '#d7e1f0';
const COLOR_REMAINING = "rgba(148, 163, 184, 0.55)";
const COLOR_OVERHEAD = "#94a3b8";
const COLOR_PROFIT = "#2dcc9a";
const COLOR_SHORTFALL = "#FB7185";

/**
 * Derives three donut segments from the same inputs as Budget profit forecast:
 * — Spent to Date (actual job spend)
 * — Projected Remaining Cost or Remaining cost when complete (max(0, EAC − spent))
 * — Company overhead when the bid allocates it (not part of the job-cost cap)
 * — Projected Profit / Projected Shortfall, or Net profit / Net shortfall when complete
 *   (contract value − EAC − overhead), by magnitude for the arc
 *
 * Arc angles sum to 360° with denominator spent + remaining + overhead + |net profit| so loss cases still close the ring.
 */
export function computeBudgetProfitMixSegments(params: {
  contractValue: number;
  spentToDate: number;
  forecastFinalCost: number;
  /** Allocated company overhead. Subtracted from profit, not from the job-cost cap. */
  allocatedCompanyOverhead?: number;
  /** Pending purchase orders. Held out of left to spend until they are received. */
  committedPOs?: number;
  /** When the job is marked completed, use net / actual wording in the legend. */
  jobCompleted?: boolean;
}): { segments: BudgetProfitMixSegment[]; contractValue: number } {
  const cv = Math.max(0, params.contractValue);
  const s = Math.max(0, params.spentToDate);
  const eac = Math.max(0, params.forecastFinalCost);
  const overhead = Math.max(0, params.allocatedCompanyOverhead ?? 0);
  const remainingPool = Math.max(0, eac - s);
  const committed = Math.min(Math.max(0, params.committedPOs ?? 0), remainingPool);
  const leftToSpend = Math.max(0, remainingPool - committed);
  const profit = cv - eac - overhead;
  const done = !!params.jobCompleted;

  if (cv <= 1e-6) {
    return { segments: [], contractValue: cv };
  }

  const remainLabel = "Left to spend";
  const thirdLabel =
    profit >= 0 ? (done ? "Your profit" : "Your profit") : done ? "Shortfall" : "Shortfall";
  const thirdColor = profit >= 0 ? COLOR_PROFIT : COLOR_SHORTFALL;

  const parts = [
    { key: "spent", label: "Spent", value: s, color: COLOR_SPENT },
    ...(committed > 0.005
      ? [{ key: "committed", label: "Committed POs", value: committed, color: "#f59e0b" }]
      : []),
    { key: "remain", label: remainLabel, value: leftToSpend, color: COLOR_REMAINING },
    ...(overhead > 0
      ? [{ key: "overhead", label: "Company overhead", value: overhead, color: COLOR_OVERHEAD }]
      : []),
    {
      key: profit >= 0 ? "profit" : "shortfall",
      label: thirdLabel,
      value: Math.abs(profit),
      color: thirdColor,
    },
  ];

  const denom = parts.reduce((sum, p) => sum + p.value, 0);
  if (denom <= 1e-6) {
    return {
      segments: [
        {
          key: "empty",
          label: "—",
          value: 0,
          sweepDeg: 360,
          color: "rgba(148, 163, 184, 0.35)",
        },
      ],
      contractValue: cv,
    };
  }

  const segments: BudgetProfitMixSegment[] = parts.map((p) => ({
    ...p,
    sweepDeg: (p.value / denom) * 360,
  }));

  return { segments, contractValue: cv };
}

type Props = {
  contractValue: number;
  spentToDate: number;
  forecastFinalCost: number;
  /** Net margin: (contract − EAC − allocated overhead) / contract × 100 */
  projectedMarginPct: number;
  /** Quiet note under the Spent row, such as the share of the cost cap. */
  spentNote?: string;
  allocatedCompanyOverhead?: number;
  /** Pending purchase orders still on order. */
  committedPOs?: number;
  currency?: string;
  formatMoney: (n: number, curr: string) => string;
  darkMode: boolean;
  /** Job marked completed — center + legend use net / actual wording. */
  jobCompleted?: boolean;
};

export default function BudgetProfitMixDonut({
  contractValue,
  spentToDate,
  forecastFinalCost,
  projectedMarginPct,
  spentNote,
  allocatedCompanyOverhead = 0,
  committedPOs = 0,
  currency = "USD",
  formatMoney,
  darkMode,
  jobCompleted = false,
}: Props) {
  const { segments } = useMemo(
    () =>
      computeBudgetProfitMixSegments({
        contractValue,
        spentToDate,
        forecastFinalCost,
        allocatedCompanyOverhead,
        committedPOs,
        jobCompleted,
      }),
    [contractValue, spentToDate, forecastFinalCost, allocatedCompanyOverhead, committedPOs, jobCompleted]
  );

  const accessibilityLabel = useMemo(() => {
    const rows = segments.filter((s) => s.key !== "empty");
    if (rows.length === 0) return "Budget and profit mix, no segments";
    return `Budget and profit mix. ${rows.map((s) => `${s.label} ${formatMoney(s.value, currency)}`).join(". ")}`;
  }, [segments, formatMoney, currency]);

  const labelDim = darkMode ? "#d7e1f0" : "#64748b";
  const valueBright = darkMode ? "#FFFFFF" : "#0f172a";
  const centerPctColor = projectedMarginPct >= 0 ? COLOR_PROFIT : COLOR_SHORTFALL;
  const visibleSegments = segments.filter((s) => s.key !== "empty");

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={[styles.centerLabel, { color: labelDim }]}>
        Net margin
      </Text>
      <Text style={[styles.centerValue, { color: centerPctColor }]}>
        {`${projectedMarginPct.toFixed(1)}%`}
      </Text>
      <View style={styles.mixTrack}>
        {visibleSegments.map((seg) => (
          <View
            key={seg.key}
            style={{
              flex: Math.max(seg.sweepDeg, 0.01),
              backgroundColor: seg.color,
            }}
          />
        ))}
      </View>
      <View style={styles.legend}>
        {visibleSegments.map((seg) => (
            <View key={seg.key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <View style={styles.legendLabelWrap}>
                <Text style={[styles.legendLabel, { color: labelDim }]}>
                  {seg.label}
                </Text>
                {seg.key === "spent" && spentNote ? (
                  <Text style={[styles.legendNote, { color: labelDim }]}>{spentNote}</Text>
                ) : null}
              </View>
              <Text style={[styles.legendValue, { color: valueBright }]}>
                {formatMoney(seg.value, currency)}
              </Text>
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "stretch",
    paddingTop: 4,
  },
  centerLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
    marginBottom: 4,
  },
  centerValue: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 38,
  },
  mixTrack: {
    marginTop: 14,
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  legend: {
    width: "100%",
    marginTop: 14,
    gap: 12,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
    marginTop: 6,
  },
  legendLabelWrap: {
    flex: 1,
  },
  legendLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  legendNote: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
  legendPct: {
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  legendValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "right",
    minWidth: 88,
    fontVariant: ["tabular-nums"],
  },
});
