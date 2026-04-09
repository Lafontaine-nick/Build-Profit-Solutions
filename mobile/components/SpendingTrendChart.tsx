import React, { useMemo } from "react";
import { View, Text, ScrollView, Dimensions, StyleSheet } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

type Point = { label?: string; value: number };

interface SpendingTrendChartProps {
  plannedCumulative?: Point[];
  actualCumulative?: Point[];
  totalBudget?: number;
  labels?: string[];
  actual?: number[];
  budget?: number[];
  plannedBudget?: number;
  data?: { date: string; spent: number }[];
  showHeader?: boolean;
  showLegend?: boolean;
  scrollable?: boolean;
  varianceOverride?: number;
  /** When true, omit the spent/total figures on the legend row (parent shows the same summary). */
  hideLegendSpendTotal?: boolean;
  /**
   * When set, badge uses actual + committed POs vs cost cap (computeSpendingTrendCostStatus).
   * Omit to fall back to cumulative-curve pace labels only (not cost cap).
   */
  costBudgetStatus?: { text: string; color: string };
  /** Tighter chart area, padding, and Y-axis headroom (visual only). */
  compact?: boolean;
  /** Hide the reference-line label (e.g. when the parent shows the planned cost cap). */
  hideReferenceLineLabel?: boolean;
  /**
   * `percentOfBudget` — Y-axis is % of cost cap with smart zoom so curves fill the plot (Health-style).
   * `currency` — raw dollars (sparse when spend ≪ cap).
   */
  yAxisMode?: "currency" | "percentOfBudget";
  /**
   * When true, shows a footer (Actual spent / Schedule pace / vs schedule) using the same
   * cumulative series as the chart. “Schedule pace” is time-prorated even burn—not cost-budget status.
   */
  showFooterStats?: boolean;
}

function moneyTick(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

function buildCumulative(points: number[]) {
  const out: number[] = [];
  let running = 0;
  for (const v of points) {
    running += v;
    out.push(running);
  }
  return out;
}

function buildPlannedCumulative(labels: string[], totalBudget: number) {
  if (!labels.length) return [];
  const step = totalBudget / labels.length;
  return labels.map((label, idx) => ({
    label,
    value: Math.max(0, Math.round(step * (idx + 1))),
  }));
}

/** Three evenly spaced Y tick labels (finance-grade, minimal clutter). */
function buildThreeYLabels(
  maxVal: number,
  mode: "currency" | "percent",
  fmtMoney: (n: number) => string
): string[] {
  if (maxVal <= 0) return mode === "percent" ? ["0%", "0%", "0%"] : ["$0", "$0", "$0"];
  const mid = maxVal / 2;
  if (mode === "percent") {
    const top = Math.min(100, maxVal);
    const m = mid < 10 ? mid.toFixed(1) : String(Math.round(mid));
    const t = top < 10 ? top.toFixed(1) : String(Math.round(top));
    return ["0%", `${m}%`, `${t}%`];
  }
  return [fmtMoney(0), fmtMoney(mid), fmtMoney(maxVal)];
}

export default function SpendingTrendChart({
  plannedCumulative,
  actualCumulative,
  totalBudget = 0,
  labels,
  actual,
  budget,
  plannedBudget,
  data,
  showHeader = true,
  showLegend = true,
  scrollable = false,
  varianceOverride,
  hideLegendSpendTotal = false,
  costBudgetStatus,
  compact = false,
  hideReferenceLineLabel = false,
  yAxisMode = "currency",
  showFooterStats = false,
}: SpendingTrendChartProps) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === "#000000";

  const { plannedPoints, actualPoints, budgetTotal } = useMemo(() => {
    if (plannedCumulative && actualCumulative) {
      const total =
        totalBudget ||
        plannedCumulative.at(-1)?.value ||
        actualCumulative.at(-1)?.value ||
        0;
      return {
        plannedPoints: plannedCumulative,
        actualPoints: actualCumulative,
        budgetTotal: total,
      };
    }

    if (labels && actual && (budget || plannedBudget !== undefined)) {
      const plannedTotal = plannedBudget ?? budget?.[0] ?? 0;
      const actualSeries = actual;
      const actualCume = actualSeries.length ? buildCumulative(actualSeries) : [];
      const actualPts = labels.map((label, idx) => ({
        label,
        value: actualCume[idx] ?? 0,
      }));
      const plannedPts = buildPlannedCumulative(labels, plannedTotal);
      return {
        plannedPoints: plannedPts,
        actualPoints: actualPts,
        budgetTotal: plannedTotal,
      };
    }

    if (data && plannedBudget !== undefined) {
      const dataLabels = data.map((point) => {
        const date = new Date(point.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      });
      const actualPts = data.map((point, idx) => ({
        label: dataLabels[idx],
        value: point.spent,
      }));
      const plannedPts = buildPlannedCumulative(dataLabels, plannedBudget);
      return {
        plannedPoints: plannedPts,
        actualPoints: actualPts,
        budgetTotal: plannedBudget,
      };
    }

    return { plannedPoints: [], actualPoints: [], budgetTotal: 0 };
  }, [plannedCumulative, actualCumulative, totalBudget, labels, actual, budget, plannedBudget, data]);

  const chartLayout = useMemo(() => {
    const refLabelStyle = {
      color: "rgba(148, 163, 184, 0.75)",
      fontSize: 9,
      fontWeight: "600" as const,
      marginTop: 2,
    };
    const makeRefConfig = (label: string) => ({
      color: "rgba(45, 212, 191, 0.22)",
      type: "dashed" as const,
      thickness: 1,
      labelText: hideReferenceLineLabel ? "" : label,
      labelTextStyle: refLabelStyle,
    });

    const useFewTicks = compact;

    if (yAxisMode !== "percentOfBudget" || budgetTotal <= 0) {
      const maxA = Math.max(...actualPoints.map((p) => p.value), 0);
      const maxP = Math.max(...plannedPoints.map((p) => p.value), 0);
      const headroom = compact ? 1.04 : 1.12;
      const maxVal = Math.max(budgetTotal, maxA, maxP) * headroom;
      const yLabels = useFewTicks
        ? buildThreeYLabels(maxVal, "currency", moneyTick)
        : [0, 0.25, 0.5, 0.75, 1].map((t) => moneyTick(maxVal * t));
      return {
        displayActual: actualPoints,
        displayPlanned: plannedPoints,
        maxVal,
        showRefLine: budgetTotal > 0 && budgetTotal <= maxVal,
        refPos: budgetTotal,
        refConfig: makeRefConfig(`Planned cost cap: ${moneyTick(budgetTotal)}`),
        yLabels,
        pointerInPercent: false as const,
        noOfSections: useFewTicks ? 2 : 4,
      };
    }

    const toPct = (v: number) => (budgetTotal > 0 ? (v / budgetTotal) * 100 : 0);
    const displayActual = actualPoints.map((p) => ({ ...p, value: toPct(p.value) }));
    const displayPlanned = plannedPoints.map((p) => ({ ...p, value: toPct(p.value) }));
    const peak = Math.max(
      0.5,
      ...displayActual.map((p) => p.value),
      ...displayPlanned.map((p) => p.value),
    );
    const head = compact ? 1.06 : 1.14;
    let chartMax = Math.min(100, Math.max(peak * head, peak + 2, 12));
    chartMax = Math.min(100, chartMax);
    const yLabels = useFewTicks
      ? buildThreeYLabels(chartMax, "percent", moneyTick)
      : [0, 0.25, 0.5, 0.75, 1].map((t) => {
          const v = chartMax * t;
          if (v === 0) return "0%";
          return `${v < 10 ? v.toFixed(1) : Math.round(v)}%`;
        });
    return {
      displayActual,
      displayPlanned,
      maxVal: chartMax,
      showRefLine: chartMax >= 97,
      refPos: 100,
      refConfig: makeRefConfig("100% of cost budget"),
      yLabels,
      pointerInPercent: true as const,
      noOfSections: useFewTicks ? 2 : 4,
    };
  }, [yAxisMode, budgetTotal, actualPoints, plannedPoints, compact, hideReferenceLineLabel]);

  const chartPlotHeight = compact ? 196 : 210;

  const variance = useMemo(() => {
    if (typeof varianceOverride === "number") return varianceOverride;
    const lastA = actualPoints.at(-1)?.value ?? 0;
    const lastP = plannedPoints.at(-1)?.value ?? 0;
    return lastA - lastP;
  }, [actualPoints, plannedPoints, varianceOverride]);

  const statusLabel = useMemo(() => {
    if (costBudgetStatus?.text) {
      return { text: costBudgetStatus.text, color: costBudgetStatus.color };
    }
    if (variance > 0) return { text: "Ahead of pace", color: "#f97316" };
    if (variance < 0) return { text: "Behind pace", color: "#38bdf8" };
    return { text: "On pace", color: "#22c55e" };
  }, [costBudgetStatus, variance]);

  const legendTextColor = darkMode ? "rgba(255,255,255,0.72)" : "#64748b";
  // Soft plot surface — avoid a heavy empty black box
  const plotFill = darkMode ? "rgba(255,255,255,0.03)" : "rgba(248, 250, 252, 0.92)";
  const plotBorder = darkMode ? "rgba(255,255,255,0.06)" : "rgba(148, 163, 184, 0.2)";
  const axisTextColor = darkMode ? "rgba(250,250,250,0.55)" : "rgba(51, 65, 85, 0.85)";
  const gridColor = darkMode ? "rgba(255,255,255,0.05)" : "rgba(15, 23, 42, 0.06)";
  const chartSpacing = compact ? 36 : 44;
  const chartInitialSpacing = 12;
  const chartEndSpacing = 12;
  /** Actual: teal-green solid; Planned: softer blue dashed */
  const actualLineColor = "#2DD4BF";
  const actualFillColor = "#34d399";
  const plannedLineColor = "rgba(96, 165, 250, 0.92)";

  const screenWidth = Dimensions.get("window").width - 48;
  const nPts = chartLayout.displayActual.length;
  const chartWidth =
    scrollable && nPts > 8
      ? Math.max(screenWidth, nPts * chartSpacing + chartInitialSpacing + chartEndSpacing)
      : undefined;

  const lineDataActual = useMemo(() => {
    const arr = chartLayout.displayActual;
    const n = arr.length;
    return arr.map((p, i) => ({
      ...p,
      hideDataPoint: n > 1 && i !== n - 1,
      dataPointsRadius: i === n - 1 ? 5 : 0,
      dataPointsColor: actualLineColor,
    }));
  }, [chartLayout.displayActual, actualLineColor]);

  const pointerLabelComponent = (items: any[]) => {
    const rawA = items?.[0]?.value ?? 0;
    const rawP = items?.[1]?.value ?? 0;
    const a = chartLayout.pointerInPercent ? (rawA / 100) * budgetTotal : rawA;
    const p = chartLayout.pointerInPercent ? (rawP / 100) * budgetTotal : rawP;
    const delta = a - p;
    return (
      <View
        style={{
          backgroundColor: darkMode ? "rgba(28, 28, 30, 0.94)" : "rgba(255,255,255,0.97)",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: darkMode ? "rgba(148,163,184,0.18)" : "rgba(15,23,42,0.08)",
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: Colors.text, fontWeight: "700", fontSize: 12 }}>
          Actual {moneyTick(a)}
        </Text>
        <Text style={{ color: Colors.sub, fontWeight: "600", fontSize: 11, marginTop: 3 }}>
          Pace {moneyTick(p)} ·{" "}
          <Text style={{ color: delta > 0 ? "#f87171" : "#6ee7b7" }}>
            {delta > 0 ? "+" : "−"}
            {moneyTick(Math.abs(delta))}
          </Text>
        </Text>
      </View>
    );
  };

  const lastActualSpend = actualPoints.at(-1)?.value ?? 0;
  const lastPlannedSpend = plannedPoints.at(-1)?.value ?? 0;
  const footerDelta = lastActualSpend - lastPlannedSpend;
  const footerDeltaColor =
    footerDelta > 0 ? "rgba(248, 113, 113, 0.95)" : footerDelta < 0 ? "rgba(110, 231, 183, 0.95)" : legendTextColor;

  const commonLineChartProps = {
    height: chartPlotHeight,
    thickness: 2.75,
    thickness2: 1.35,
    curved: true,
    areaChart: true,
    startFillColor: actualFillColor,
    endFillColor: actualFillColor,
    startOpacity: darkMode ? 0.14 : 0.12,
    endOpacity: 0,
    strokeDashArray2: [5, 5] as [number, number],
    hideDataPoints: false,
    textFontSize: 9,
    yAxisLabelWidth: chartLayout.pointerInPercent ? 38 : 46,
    yAxisTextStyle: { color: axisTextColor, fontSize: 9, fontWeight: "600" as const },
    xAxisLabelTextStyle: { color: axisTextColor, fontSize: 9, fontWeight: "500" as const },
    rulesColor: gridColor,
    rulesType: "solid" as const,
    spacing: chartSpacing,
    initialSpacing: chartInitialSpacing,
    endSpacing: chartEndSpacing,
    noOfSections: chartLayout.noOfSections,
    maxValue: chartLayout.maxVal,
    showReferenceLine1: chartLayout.showRefLine,
    referenceLine1Position: chartLayout.refPos,
    referenceLine1Config: chartLayout.refConfig,
    yAxisThickness: 0,
    xAxisThickness: 0,
    hideYAxisText: false,
    showVerticalLines: false,
    yAxisColor: "transparent",
    yAxisLabelPrefix: "",
    yAxisLabelTexts: chartLayout.yLabels,
    data: lineDataActual,
    color: actualLineColor,
    dataPointsColor: actualLineColor,
    data2: chartLayout.displayPlanned,
    color2: plannedLineColor,
    dataPointsColor2: "transparent",
    pointerConfig: {
      pointerStripColor: darkMode ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.06)",
      pointerStripWidth: StyleSheet.hairlineWidth,
      pointerColor: "rgba(226, 232, 240, 0.85)",
      radius: 3,
      pointerLabelWidth: 140,
      pointerLabelHeight: 58,
      autoAdjustPointerLabelPosition: true,
      pointerLabelComponent,
    },
  };

  const chartEmpty = nPts === 0;

  return (
    <View style={{ paddingTop: showHeader ? 10 : compact ? 0 : 0 }}>
      {showHeader && (
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: Colors.text, fontSize: 18, fontWeight: "800" }}>
              Spending Trend
            </Text>
            <View
              style={{
                backgroundColor: `${statusLabel.color}18`,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: statusLabel.color, fontSize: 12, fontWeight: "700" }}>
                {statusLabel.text}
              </Text>
            </View>
          </View>
          <Text style={{ color: legendTextColor, fontSize: 13, fontWeight: "500", marginTop: 4 }}>
            Cumulative spend vs. schedule pace (even burn)
          </Text>
        </View>
      )}

      {showLegend && (
        <View
          style={{
            flexDirection: "row",
            gap: 14,
            marginTop: showHeader ? 12 : compact ? 6 : 0,
            marginBottom: compact ? 8 : 12,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-start",
          }}
        >
          <LegendDot label="Actual" color={actualLineColor} textColor={legendTextColor} />
          <LegendDot label="Schedule pace" color={plannedLineColor} textColor={legendTextColor} />
          <View
            style={{
              backgroundColor: `${statusLabel.color}14`,
              paddingHorizontal: 9,
              paddingVertical: 4,
              borderRadius: 8,
              marginLeft: 4,
            }}
          >
            <Text style={{ color: statusLabel.color, fontSize: 11, fontWeight: "700" }}>
              {statusLabel.text}
            </Text>
          </View>
          {!hideLegendSpendTotal ? (
            <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <Text style={{ color: Colors.text, fontSize: 15, fontWeight: "700" }}>
                {moneyTick(actualPoints.at(-1)?.value ?? 0)}
              </Text>
              <Text style={{ color: legendTextColor, fontSize: 13, fontWeight: "600" }}>
                / {moneyTick(budgetTotal)}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <View
        style={{
          backgroundColor: plotFill,
          borderRadius: compact ? 16 : 18,
          paddingVertical: compact ? 8 : 12,
          paddingHorizontal: compact ? 4 : 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: plotBorder,
          position: "relative",
          overflow: scrollable ? "visible" : "hidden",
        }}
      >
        {chartEmpty ? (
          <View
            style={{
              height: chartPlotHeight,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ color: axisTextColor, fontSize: 13, fontWeight: "600" }}>
              No spending data for this range
            </Text>
          </View>
        ) : scrollable && chartWidth ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8 }}
            nestedScrollEnabled
          >
            <LineChart width={chartWidth} {...commonLineChartProps} />
          </ScrollView>
        ) : (
          <LineChart {...commonLineChartProps} />
        )}
      </View>

      {showFooterStats && !chartEmpty ? (
        <View
          style={{
            flexDirection: "row",
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(148, 163, 184, 0.22)",
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: legendTextColor, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 }}>
              ACTUAL SPENT
            </Text>
            <Text
              style={{
                color: Colors.text,
                fontSize: 15,
                fontWeight: "700",
                marginTop: 4,
                fontVariant: ["tabular-nums"],
              }}
            >
              {moneyTick(lastActualSpend)}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
            <Text style={{ color: legendTextColor, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 }}>
              SCHEDULE PACE
            </Text>
            <Text
              style={{
                color: Colors.text,
                fontSize: 15,
                fontWeight: "700",
                marginTop: 4,
                fontVariant: ["tabular-nums"],
              }}
            >
              {moneyTick(lastPlannedSpend)}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>
            <Text style={{ color: legendTextColor, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 }}>
              VS SCHEDULE
            </Text>
            <Text
              style={{
                color: footerDeltaColor,
                fontSize: 15,
                fontWeight: "700",
                marginTop: 4,
                fontVariant: ["tabular-nums"],
              }}
            >
              {footerDelta > 0 ? "+" : footerDelta < 0 ? "−" : ""}
              {moneyTick(Math.abs(footerDelta))}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function LegendDot({
  label,
  color,
  textColor,
}: {
  label: string;
  color: string;
  textColor: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: color }} />
      <Text style={{ color: textColor, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
