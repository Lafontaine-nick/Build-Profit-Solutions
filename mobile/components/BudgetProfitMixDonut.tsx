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
const COLOR_SPENT = "#94a3b8";
const COLOR_REMAINING = "rgba(148, 163, 184, 0.35)";
const COLOR_PROFIT = "#2dcc9a";
const COLOR_SHORTFALL = "#FB7185";

/**
 * Derives three donut segments from the same inputs as Budget profit forecast:
 * — Spent to Date (actual job spend)
 * — Projected Remaining Cost or Remaining cost when complete (max(0, EAC − spent))
 * — Projected Profit / Projected Shortfall, or Net profit / Net shortfall when complete (contract value − EAC), by magnitude for the arc
 *
 * Arc angles sum to 360° with denominator spent + remaining + |contract − EAC| so loss cases still close the ring.
 */
export function computeBudgetProfitMixSegments(params: {
  contractValue: number;
  spentToDate: number;
  forecastFinalCost: number;
  /** When the job is marked completed, use net / actual wording in the legend. */
  jobCompleted?: boolean;
}): { segments: BudgetProfitMixSegment[]; contractValue: number } {
  const cv = Math.max(0, params.contractValue);
  const s = Math.max(0, params.spentToDate);
  const eac = Math.max(0, params.forecastFinalCost);
  const remaining = Math.max(0, eac - s);
  const profit = cv - eac;
  const done = !!params.jobCompleted;

  if (cv <= 1e-6) {
    return { segments: [], contractValue: cv };
  }

  const remainLabel = done ? "Remaining cost" : "Projected Remaining Cost";
  const thirdLabel =
    profit >= 0 ? (done ? "Net profit" : "Projected Profit") : done ? "Net shortfall" : "Projected Shortfall";
  const thirdColor = profit >= 0 ? COLOR_PROFIT : COLOR_SHORTFALL;

  const parts = [
    { key: "spent", label: "Spent to Date", value: s, color: COLOR_SPENT },
    { key: "remain", label: remainLabel, value: remaining, color: COLOR_REMAINING },
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
  /** Same source as Financial Health: (contract − EAC) / contract × 100 */
  projectedMarginPct: number;
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
        jobCompleted,
      }),
    [contractValue, spentToDate, forecastFinalCost, jobCompleted]
  );

  const accessibilityLabel = useMemo(() => {
    const rows = segments.filter((s) => s.key !== "empty");
    if (rows.length === 0) return "Budget and profit mix, no segments";
    return `Budget and profit mix. ${rows.map((s) => `${s.label} ${formatMoney(s.value, currency)}`).join(". ")}`;
  }, [segments, formatMoney, currency]);

  const labelDim = darkMode ? "#94a3b8" : "#64748b";
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
        {jobCompleted ? "NET MARGIN" : "PROJECTED MARGIN"}
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
        {visibleSegments.map((seg) => {
          const pct = (seg.sweepDeg / 360) * 100;
          const pctStr = pct < 1 && pct > 0 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`;
          return (
            <View key={seg.key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <Text style={[styles.legendLabel, { color: labelDim }]}>
                {seg.label}
              </Text>
              <Text style={[styles.legendPct, { color: labelDim }]}>{pctStr}</Text>
              <Text style={[styles.legendValue, { color: valueBright }]}>
                {formatMoney(seg.value, currency)}
              </Text>
            </View>
          );
        })}
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
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
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
    alignItems: "center",
    width: "100%",
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  legendPct: {
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  legendValue: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    minWidth: 88,
    fontVariant: ["tabular-nums"],
  },
});
