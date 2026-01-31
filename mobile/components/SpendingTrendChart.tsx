import React, { useMemo } from "react";
import { View, Text } from "react-native";
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

  const maxVal = useMemo(() => {
    const maxA = Math.max(...actualPoints.map((p) => p.value), 0);
    const maxP = Math.max(...plannedPoints.map((p) => p.value), 0);
    const headroom = 1.12;
    return Math.max(budgetTotal, maxA, maxP) * headroom;
  }, [actualPoints, plannedPoints, budgetTotal]);

  const variance = useMemo(() => {
    const lastA = actualPoints.at(-1)?.value ?? 0;
    const lastP = plannedPoints.at(-1)?.value ?? 0;
    return lastA - lastP;
  }, [actualPoints, plannedPoints]);

  const legendTextColor = Colors.sub;
  const chartSurface = Colors.surface2;
  const chartBorder = darkMode ? Colors.line : "#9CA3AF";
  const chartSpacing = 42;
  const chartInitialSpacing = 14;
  const chartEndSpacing = 14;

  return (
    <View style={{ paddingTop: showHeader ? 10 : 0 }}>
      {showHeader && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={{ color: Colors.text, fontSize: 18, fontWeight: "800" }}>
            Spending Trend
          </Text>
          <Text
            style={{
              color: variance > 0 ? "#ef4444" : "#10b981",
              fontSize: 13,
              fontWeight: "800",
            }}
          >
            {variance > 0
              ? `Over plan ${moneyTick(Math.abs(variance))}`
              : `Under plan ${moneyTick(Math.abs(variance))}`}
          </Text>
        </View>
      )}

      {showLegend && (
        <View style={{ flexDirection: "row", gap: 16, marginTop: showHeader ? 10 : 0, marginBottom: 6 }}>
          <LegendDot label="Actual" color="#22c55e" textColor={legendTextColor} />
          <LegendDot label="Planned" color="#38bdf8" textColor={legendTextColor} />
          <Text style={{ marginLeft: "auto", color: legendTextColor, fontSize: 12 }}>
            {moneyTick(actualPoints.at(-1)?.value ?? 0)} / {moneyTick(budgetTotal)}
          </Text>
        </View>
      )}

      <View
        style={{
          backgroundColor: chartSurface,
          borderRadius: 18,
          paddingVertical: 10,
          paddingRight: 10,
          paddingLeft: 10,
          borderWidth: 1,
          borderColor: chartBorder,
          position: "relative",
          overflow: "hidden",
        }}
      >
    <LineChart
          thickness={3}
          curved
          hideDataPoints={false}
          dataPointsRadius={2}
          dataPointsColor={Colors.card}
          textFontSize={11}
          yAxisLabelWidth={46}
          yAxisTextStyle={{ color: Colors.sub }}
          xAxisLabelTextStyle={{ color: Colors.sub }}
          rulesColor={darkMode ? "rgba(148,163,184,0.18)" : "rgba(15,23,42,0.08)"}
          rulesType="solid"
          spacing={chartSpacing}
          initialSpacing={chartInitialSpacing}
          endSpacing={chartEndSpacing}
          noOfSections={4}
          maxValue={maxVal}
          yAxisThickness={0}
          xAxisThickness={0}
          hideYAxisText={false}
          showVerticalLines={false}
          yAxisColor="transparent"
          yAxisLabelPrefix=""
          yAxisLabelTexts={[
            moneyTick(maxVal * 0.0),
            moneyTick(maxVal * 0.25),
            moneyTick(maxVal * 0.5),
            moneyTick(maxVal * 0.75),
            moneyTick(maxVal),
          ]}
          data={actualPoints}
          color="#22c55e"
          dataPointsColor="#22c55e"
          data2={plannedPoints}
          color2="#38bdf8"
          dataPointsColor2="#38bdf8"
          pointerConfig={{
            pointerStripColor: darkMode ? "rgba(148,163,184,0.25)" : "rgba(15,23,42,0.18)",
            pointerStripWidth: 1,
            pointerColor: Colors.text,
            radius: 5,
            pointerLabelWidth: 120,
            pointerLabelHeight: 56,
            autoAdjustPointerLabelPosition: true,
            pointerLabelComponent: (items: any[]) => {
              const a = items?.[0]?.value ?? 0;
              const p = items?.[1]?.value ?? 0;
              const delta = a - p;

              return (
                <View
                  style={{
                    backgroundColor: darkMode ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.97)",
                    borderWidth: 1,
                    borderColor: darkMode ? "rgba(148,163,184,0.18)" : "rgba(15,23,42,0.10)",
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 14,
                  }}
                >
                  <Text style={{ color: Colors.text, fontWeight: "800", fontSize: 12 }}>
                    Actual {moneyTick(a)}
                  </Text>
                  <Text style={{ color: Colors.sub, fontWeight: "700", fontSize: 11, marginTop: 2 }}>
                    Planned {moneyTick(p)} ·{" "}
                    <Text style={{ color: delta > 0 ? "#ef4444" : "#10b981" }}>
                      {delta > 0 ? "+" : "-"}
                      {moneyTick(Math.abs(delta))}
                    </Text>
                  </Text>
                </View>
              );
            },
      }}
        />
      </View>
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
