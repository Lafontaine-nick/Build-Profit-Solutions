import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";

export type BudgetProfitMixSegment = {
  key: string;
  label: string;
  value: number;
  sweepDeg: number;
  color: string;
};

/** Segment colors: teal (spent), blue (remaining), green (profit); shortfall stays distinct when EAC > contract. */
const COLOR_SPENT_TEAL = "#14B8A6";
const COLOR_REMAINING_BLUE = "#3B82F6";
const COLOR_PROFIT_GREEN = "#22C55E";
const COLOR_SHORTFALL = "#FB7185";

/**
 * Derives three donut segments from the same inputs as Budget profit forecast:
 * — Spent to Date (actual job spend)
 * — Projected Remaining Cost (max(0, EAC − spent))
 * — Projected Profit or Projected Shortfall (contract value − EAC), by magnitude for the arc
 *
 * Arc angles sum to 360° with denominator spent + remaining + |contract − EAC| so loss cases still close the ring.
 */
export function computeBudgetProfitMixSegments(params: {
  contractValue: number;
  spentToDate: number;
  forecastFinalCost: number;
}): { segments: BudgetProfitMixSegment[]; contractValue: number } {
  const cv = Math.max(0, params.contractValue);
  const s = Math.max(0, params.spentToDate);
  const eac = Math.max(0, params.forecastFinalCost);
  const remaining = Math.max(0, eac - s);
  const profit = cv - eac;

  if (cv <= 1e-6) {
    return { segments: [], contractValue: cv };
  }

  const thirdLabel = profit >= 0 ? "Projected Profit" : "Projected Shortfall";
  const thirdColor = profit >= 0 ? COLOR_PROFIT_GREEN : COLOR_SHORTFALL;

  const parts = [
    { key: "spent", label: "Spent to Date", value: s, color: COLOR_SPENT_TEAL },
    { key: "remain", label: "Projected Remaining Cost", value: remaining, color: COLOR_REMAINING_BLUE },
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

/** Donut geometry — wider ring + larger center type */
const SIZE = 228;
const STROKE = 28;
const R = SIZE / 2 - STROKE / 2 - 3;

type Props = {
  contractValue: number;
  spentToDate: number;
  forecastFinalCost: number;
  /** Same source as Financial Health: (contract − EAC) / contract × 100 */
  projectedMarginPct: number;
  currency?: string;
  formatMoney: (n: number, curr: string) => string;
  darkMode: boolean;
};

export default function BudgetProfitMixDonut({
  contractValue,
  spentToDate,
  forecastFinalCost,
  projectedMarginPct,
  currency = "USD",
  formatMoney,
  darkMode,
}: Props) {
  const { segments } = useMemo(
    () =>
      computeBudgetProfitMixSegments({
        contractValue,
        spentToDate,
        forecastFinalCost,
      }),
    [contractValue, spentToDate, forecastFinalCost]
  );

  const accessibilityLabel = useMemo(() => {
    const rows = segments.filter((s) => s.key !== "empty");
    if (rows.length === 0) return "Budget and profit mix, no segments";
    return `Budget and profit mix. ${rows.map((s) => `${s.label} ${formatMoney(s.value, currency)}`).join(". ")}`;
  }, [segments, formatMoney, currency]);

  const circumference = 2 * Math.PI * R;
  const labelDim = darkMode ? "rgba(255,255,255,0.52)" : "rgba(15,23,42,0.52)";
  const valueBright = darkMode ? "#FFFFFF" : "#0f172a";
  const centerPctColor =
    projectedMarginPct >= 0
      ? COLOR_PROFIT_GREEN
      : "#FB7185";

  /** Midpoint of each ring segment (degrees from +x), for % labels on the stroke centerline */
  const segmentRingLabels = useMemo(() => {
    let rotation = -90;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    /** Hide on-card % only if the arc is too small to place text (very thin sliver) */
    const MIN_SWEEP_DEG = 4;
    return segments
      .filter((s) => s.key !== "empty")
      .map((seg) => {
        const midDeg = rotation + seg.sweepDeg / 2;
        const rad = (midDeg * Math.PI) / 180;
        const x = cx + R * Math.cos(rad);
        const y = cy + R * Math.sin(rad);
        rotation += seg.sweepDeg;
        const pct = (seg.sweepDeg / 360) * 100;
        const pctStr =
          pct < 1 && pct > 0 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`;
        return {
          key: seg.key,
          x,
          y,
          pctStr,
          show: seg.sweepDeg >= MIN_SWEEP_DEG,
          fontSize: seg.sweepDeg < 14 ? 11 : seg.sweepDeg < 28 ? 12 : 13,
        };
      });
  }, [segments]);

  let rotation = -90;
  const circles = segments.map((seg, idx) => {
    const len = (seg.sweepDeg / 360) * circumference;
    const el = (
      <Circle
        key={seg.key + idx}
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        stroke={seg.color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${len} ${circumference}`}
        rotation={rotation}
        originX={SIZE / 2}
        originY={SIZE / 2}
      />
    );
    rotation += seg.sweepDeg;
    return el;
  });

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.chartBox}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={darkMode ? "rgba(255,255,255,0.07)" : "rgba(15, 23, 42, 0.07)"}
            strokeWidth={STROKE}
            fill="none"
          />
          {circles}
          {segmentRingLabels
            .filter((l) => l.show)
            .map((l) => (
              <SvgText
                key={`pct-${l.key}`}
                x={l.x}
                y={l.y}
                fill="rgba(255,255,255,0.96)"
                fontSize={l.fontSize}
                fontWeight="700"
                textAnchor="middle"
                alignmentBaseline="central"
              >
                {l.pctStr}
              </SvgText>
            ))}
        </Svg>
        <View style={styles.centerOverlay} pointerEvents="none">
          <Text style={[styles.centerLabel, { color: labelDim }]}>PROJECTED MARGIN</Text>
          <Text
            style={[styles.centerValue, { color: centerPctColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {`${projectedMarginPct.toFixed(1)}%`}
          </Text>
        </View>
      </View>

      <View style={styles.legend}>
        {segments
          .filter((s) => s.key !== "empty")
          .map((seg) => (
            <View key={seg.key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <View style={styles.legendTextCol}>
                <Text style={[styles.legendLabel, { color: labelDim }]}>{seg.label}</Text>
                <Text style={[styles.legendValue, { color: valueBright }]}>{formatMoney(seg.value, currency)}</Text>
              </View>
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 2,
  },
  chartBox: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 18,
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  centerLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    marginBottom: 6,
    textAlign: "center",
  },
  centerValue: {
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 44,
    textAlign: "center",
  },
  legend: {
    width: "100%",
    marginTop: 4,
    gap: 14,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
    flexShrink: 0,
  },
  legendTextCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  legendLabel: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  legendValue: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
});
