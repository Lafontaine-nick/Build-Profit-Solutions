import React, { useMemo } from "react";
import { View, Text, ScrollView, Dimensions } from "react-native";
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
  scrollable = false,
  varianceOverride,
  hideLegendSpendTotal = false,
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
    if (typeof varianceOverride === 'number') return varianceOverride;
    const lastA = actualPoints.at(-1)?.value ?? 0;
    const lastP = plannedPoints.at(-1)?.value ?? 0;
    return lastA - lastP;
  }, [actualPoints, plannedPoints, varianceOverride]);

  const statusLabel = useMemo(() => {
    if (variance > 0) return { text: "Over budget", color: "#ef4444" };
    if (variance < 0) return { text: "Under budget", color: "#10b981" };
    return { text: "On track", color: "#22c55e" };
  }, [variance]);

  const legendTextColor = darkMode ? "rgba(255,255,255,0.87)" : "#64748b";
  const chartSurface = darkMode ? "rgba(255,255,255,0.10)" : "#CBD5E1";
  const chartBorder = darkMode ? "rgba(255,255,255,0.14)" : "#94A3B8";
  const axisTextColor = darkMode ? "#F9FAFB" : "#1e293b";
  const chartRulesColor = darkMode ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)";
  const chartSpacing = 44;
  const chartInitialSpacing = 16;
  const chartEndSpacing = 16;
  const actualColor = "#34d399";
  const plannedColor = "#60a5fa";

  const screenWidth = Dimensions.get("window").width - 48;
  const chartWidth = scrollable && actualPoints.length > 8
    ? Math.max(screenWidth, actualPoints.length * chartSpacing + chartInitialSpacing + chartEndSpacing)
    : undefined;

  return (
    <View style={{ paddingTop: showHeader ? 10 : 0 }}>
      {showHeader && (
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: Colors.text, fontSize: 18, fontWeight: "800" }}>
              Spending Trend
            </Text>
            <View
              style={{
                backgroundColor: `${statusLabel.color}20`,
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
            Cumulative spend vs. plan
          </Text>
        </View>
      )}

      {showLegend && (
        <View
          style={{
            flexDirection: "row",
            gap: 14,
            marginTop: showHeader ? 12 : 0,
            marginBottom: 12,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "flex-start",
          }}
        >
          <LegendDot label="Actual" color={actualColor} textColor={legendTextColor} />
          <LegendDot label="Planned" color={plannedColor} textColor={legendTextColor} />
          <View
            style={{
              backgroundColor: `${statusLabel.color}18`,
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
          backgroundColor: chartSurface,
          borderRadius: 16,
          paddingVertical: 16,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: chartBorder,
          position: "relative",
          overflow: scrollable ? "visible" : "hidden",
          minHeight: 180,
        }}
      >
        {scrollable && chartWidth ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            <LineChart
              width={chartWidth}
          thickness={2.5}
          curved
          areaChart
          startFillColor={actualColor}
          endFillColor={actualColor}
          startOpacity={darkMode ? 0.35 : 0.25}
          endOpacity={0}
          startFillColor2={plannedColor}
          endFillColor2={plannedColor}
          startOpacity2={darkMode ? 0.25 : 0.18}
          endOpacity2={0}
          hideDataPoints={actualPoints.length > 20}
          dataPointsRadius={3}
          dataPointsColor={actualColor}
          textFontSize={11}
          yAxisLabelWidth={48}
          yAxisTextStyle={{ color: axisTextColor, fontSize: 11, fontWeight: "500" }}
          xAxisLabelTextStyle={{ color: axisTextColor, fontSize: 11, fontWeight: "500" }}
          rulesColor={chartRulesColor}
          rulesType="solid"
          spacing={chartSpacing}
          initialSpacing={chartInitialSpacing}
          endSpacing={chartEndSpacing}
          noOfSections={4}
          maxValue={maxVal}
          showReferenceLine1={budgetTotal > 0 && budgetTotal < maxVal}
          referenceLine1Position={budgetTotal}
          referenceLine1Config={{
            color: "#2dd4bf",
            type: "dotted",
            thickness: 2,
            labelText: `Budget cap: ${moneyTick(budgetTotal)}`,
            labelTextStyle: { color: "#2dd4bf", fontSize: 10, fontWeight: "600", marginTop: 6 },
          }}
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
          color={actualColor}
          dataPointsColor={actualColor}
          data2={plannedPoints}
          color2={plannedColor}
          dataPointsColor2={plannedColor}
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
          </ScrollView>
        ) : (
          <LineChart
            thickness={2.5}
            curved
            areaChart
            startFillColor={actualColor}
            endFillColor={actualColor}
            startOpacity={darkMode ? 0.35 : 0.25}
            endOpacity={0}
            startFillColor2={plannedColor}
            endFillColor2={plannedColor}
            startOpacity2={darkMode ? 0.25 : 0.18}
            endOpacity2={0}
            hideDataPoints={actualPoints.length > 20}
            dataPointsRadius={3}
            dataPointsColor={actualColor}
            textFontSize={11}
            yAxisLabelWidth={48}
            yAxisTextStyle={{ color: axisTextColor, fontSize: 11, fontWeight: "500" }}
            xAxisLabelTextStyle={{ color: axisTextColor, fontSize: 11, fontWeight: "500" }}
            rulesColor={chartRulesColor}
            rulesType="solid"
            spacing={chartSpacing}
            initialSpacing={chartInitialSpacing}
            endSpacing={chartEndSpacing}
            noOfSections={4}
            maxValue={maxVal}
            showReferenceLine1={budgetTotal > 0 && budgetTotal < maxVal}
            referenceLine1Position={budgetTotal}
            referenceLine1Config={{
              color: "#2dd4bf",
              type: "dotted",
              thickness: 2,
              labelText: `Budget cap: ${moneyTick(budgetTotal)}`,
              labelTextStyle: { color: "#2dd4bf", fontSize: 10, fontWeight: "600", marginTop: 6 },
            }}
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
            color={actualColor}
            dataPointsColor={actualColor}
            data2={plannedPoints}
            color2={plannedColor}
            dataPointsColor2={plannedColor}
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
        )}
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
