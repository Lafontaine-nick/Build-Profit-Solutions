import React, { useMemo, useRef, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";

interface ProjectTypeStat {
  label: string;
  amount: string;   // "$12,744"
  percent: number;  // 58.4
}

interface ProfileAnalyticsProps {
  activeWonCount?: number;
  completedCount?: number;
  projectTypeStats?: ProjectTypeStat[];
  overviewProfit?: number;
  completedProjects?: any[];
}

const ProfileAnalytics: React.FC<ProfileAnalyticsProps> = ({
  activeWonCount = 0,
  completedCount,
  projectTypeStats = [],
  overviewProfit = 0,
  completedProjects = [],
}) => {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors, darkMode), [Colors, darkMode]);
  const scrollViewRef = useRef<ScrollView>(null);

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })}`;

  const formatCurrencyShort = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${Math.round(value)}`;
  };

  // Calculate monthly profit for the last 6 months (including current month)
  const monthlyProfitData = useMemo(() => {
    const now = new Date();
    const months: { month: string; value: number; year: number; monthIndex: number }[] = [];
    
    // Get last 6 months (including current month)
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthIndex = date.getMonth();
      const year = date.getFullYear();
      const monthName = date.toLocaleString("en-US", { month: "short" });
      months.push({ month: monthName, value: 0, year, monthIndex });
    }

    // Debug: Log the months we're looking for
  if (__DEV__) {
      console.log('📅 Monthly profit trend: months window',
        months.map(m => `${m.month} ${m.year} (index: ${m.monthIndex})`));
      console.log('📊 Monthly profit trend: completed projects count', completedProjects.length);
    }

    // Calculate profit for each month from completed projects
    completedProjects.forEach((project) => {
      const status = (project?.status || "").toString().toLowerCase();
      if (status !== "completed") return;

      // Get completion date - check multiple possible fields
      // For completed projects, ALWAYS use the earlier of endDate (actual completion) or updatedAt (when marked complete)
      // This ensures profit is assigned to the month the project actually completed, not when it was marked complete
      let completionDate: Date | null = null;
      
      const updatedAtDate = project.updatedAt ? new Date(project.updatedAt) : null;
      const endDateValue = project.endDate || project.projectData?.endDate || project.estimateData?.projectEndDate || project.estimateData?.endDate;
      const endDateObj = endDateValue ? new Date(endDateValue) : null;
      
      // For ALL completed projects, use the earlier date between endDate and updatedAt
      // This handles cases where project was completed in one month but marked complete in another month
      // Example: Project completed Nov 30, but marked complete Dec 2 -> should show in November
      if (endDateObj && !isNaN(endDateObj.getTime()) && updatedAtDate && !isNaN(updatedAtDate.getTime())) {
        // Use the earlier date (actual completion vs when marked complete)
        completionDate = endDateObj < updatedAtDate ? endDateObj : updatedAtDate;
      } else if (endDateObj && !isNaN(endDateObj.getTime())) {
        // Use endDate if available (most accurate for actual completion)
        completionDate = endDateObj;
      } else if (updatedAtDate && !isNaN(updatedAtDate.getTime())) {
        // Fall back to updatedAt if no endDate
        completionDate = updatedAtDate;
      } else if (project.createdAt) {
        // Last resort: use creation date
        completionDate = new Date(project.createdAt);
      }

      if (!completionDate || isNaN(completionDate.getTime())) {
        // Skip projects without valid dates
        if (__DEV__) {
          console.log(`⚠️ Monthly profit trend: Project "${project.title || 'Untitled'}" has invalid completion date`, {
            endDate: project.endDate,
            projectDataEndDate: project.projectData?.endDate,
            estimateDataEndDate: project.estimateData?.projectEndDate,
            updatedAt: project.updatedAt,
            createdAt: project.createdAt,
          });
        }
        return;
      }

      const projectMonth = completionDate.getMonth();
      const projectYear = completionDate.getFullYear();
      const projectMonthName = completionDate.toLocaleString("en-US", { month: "short" });

      // Debug: Log the project's completion date and all available dates
      if (__DEV__) {
        console.log(`📅 Monthly profit trend: Project "${project.title || 'Untitled'}"`, {
          endDate: project.endDate || project.projectData?.endDate || project.estimateData?.projectEndDate || 'none',
          updatedAt: project.updatedAt || 'none',
          selectedDate: completionDate.toISOString(),
          assignedMonth: `${projectMonthName} ${projectYear}`,
        });
      }

      // Find matching month by year and month index
      const monthData = months.find(
        (m) => m.monthIndex === projectMonth && m.year === projectYear
      );

      if (monthData) {
        // Calculate profit for this project
        const revenue = 
          project.bidPrice ||
          project.projectData?.bidPrice ||
          project.projectData?.totalBidPrice ||
          project.estimateData?.bidPrice ||
          project.estimateData?.grandTotal ||
          project.total ||
          project.totalRevenue ||
          project.contractValue ||
          project.estimatedCost ||
          0;

        const actualCost = 
          project.actualCost ||
          project.projectData?.actualCost ||
          project.projectData?.spent ||
          project.projectData?.totalSpent ||
          project.totalSpent ||
          0;

        let profit = 0;
        if (actualCost > 0) {
          profit = revenue - actualCost;
        } else {
          // Fall back to margin-based calculation
          const margin = project.margin || 0;
          const marginRatio = Math.abs(margin) > 1 ? margin / 100 : margin;
          profit = revenue * marginRatio;
        }

        monthData.value += profit;

        // Debug logging
      if (__DEV__) {
          console.log(`📊 Monthly profit trend: Added $${profit.toFixed(0)} profit for ${project.title || 'Untitled'} to ${monthData.month} ${monthData.year}`);
        }
      } else if (__DEV__) {
        // Debug: log projects that don't match any month
        console.log(`⚠️ Monthly profit trend: Project "${project.title || 'Untitled'}" completed ${completionDate.toLocaleDateString()} doesn't match window`);
      }
    });

    // Calculate max value for height percentage
    const maxValue = Math.max(...months.map((m) => m.value), 1);

    // Debug logging
    if (__DEV__) {
      console.log('📊 Monthly profit trend data:', {
        months: months.map(m => ({ month: m.month, value: m.value, year: m.year })),
        completedProjectsCount: completedProjects.length,
        maxValue,
      });
    }

    // Format and return with height percentages (visual only; month.value unchanged)
    return months.map((month) => {
      const isEmpty = month.value <= 0;
      const heightPct = isEmpty
        ? 5
        : maxValue > 0
          ? Math.max(14, (month.value / maxValue) * 100)
          : 14;
      return {
        month: month.month,
        value: formatCurrencyShort(month.value),
        isEmpty,
        heightPct,
      };
    });
  }, [completedProjects]);

  // Auto-scroll to most recent month when data changes
  useEffect(() => {
    if (monthlyProfitData.length > 0) {
      // Small delay to ensure ScrollView has rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [monthlyProfitData]);

  return (
    <View>
      {/* Live Data pill */}
      <View style={styles.livePillRow}>
        <View style={styles.livePill}>
          <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
          <Text style={styles.livePillText}>
            Live Data · {activeWonCount} Active
            {completedCount != null && completedCount > 0 ? ` · ${completedCount} Completed` : ""}
        </Text>
        </View>
      </View>

      {/* Monthly completed-profit trend (same data as before; clearer label) */}
      <LinearGradient
        colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
        start={{ x: 0.05, y: 0.15 }}
        end={{ x: 0.95, y: 0.85 }}
        style={styles.cardBorder}
      >
        <View style={styles.cardInner}>
          <View style={styles.blockHeaderRow}>
            <View style={styles.blockHeaderTextCol}>
              <View style={styles.blockHeaderLeft}>
                <Ionicons name="bar-chart-outline" size={17} color="#22C55E" />
                <Text style={styles.blockTitle}>Monthly Profit Trend</Text>
              </View>
              <Text style={styles.blockSubtitle}>
                Completed projects by close month
              </Text>
            </View>
          </View>

          <ScrollView 
            ref={scrollViewRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartContainer}
            onContentSizeChange={() => {
              // Scroll to the end (most recent month) when content loads
              scrollViewRef.current?.scrollToEnd({ animated: false });
            }}
          >
            {monthlyProfitData.map((item, index) => (
              <View key={`${item.month}-${index}`} style={styles.barWrapper}>
                <Text
                  style={[
                    styles.barValueLabel,
                    item.isEmpty && styles.barValueLabelMuted,
                  ]}
                >
                  {item.value}
                </Text>

                <View
                  style={[
                    styles.barTrack,
                    item.isEmpty && styles.barTrackEmpty,
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      item.isEmpty && styles.barFillEmpty,
                      { height: `${item.heightPct}%` },
                    ]}
                  />
                </View>

                <View style={[styles.monthPill, item.isEmpty && styles.monthPillMuted]}>
                  <Text
                    style={[
                      styles.chartXAxisLabel,
                      item.isEmpty && styles.chartXAxisLabelMuted,
                    ]}
                  >
                    {item.month}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </LinearGradient>

      {/* Profit Analytics & Profitability by Project Type - Combined */}
      <LinearGradient
        colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
        start={{ x: 0.05, y: 0.15 }}
        end={{ x: 0.95, y: 0.85 }}
        style={[styles.cardBorder, styles.cardBorderStacked]}
      >
        <View style={styles.cardInner}>
          {/* Profit Analytics Section */}
          <Text style={styles.sectionEyebrow}>Historical performance</Text>
          <View style={styles.blockHeaderRow}>
            <View style={styles.blockHeaderLeft}>
              <Feather name="trending-up" size={17} color="#22C55E" />
              <Text style={styles.blockTitle}>Profit Analytics</Text>
            </View>
          </View>

          <View style={styles.singleProfitRow}>
            <View>
              <Text style={styles.profitLabel}>Overview Profit (completed)</Text>
              <Text style={styles.profitValue}>{formatCurrency(overviewProfit)}</Text>
            </View>
          </View>

          <Text style={styles.profitSubnote}>
            Based on completed projects to date.
          </Text>

          {/* Divider */}
          <View style={styles.sectionDivider} />

          {/* Profitability by Project Type Section */}
          <View style={styles.blockHeaderRow}>
            <View style={styles.blockHeaderLeft}>
              <Feather name="triangle" size={17} color="#22C55E" />
              <Text style={styles.blockTitle}>
                Profitability by Project Type
              </Text>
            </View>
          </View>

          {projectTypeStats.length === 0 ? (
            <Text style={styles.profitSubnote}>
              No data yet. Complete projects with a project type (from estimates) to
              see average margin by Kitchen, Bathroom, and other types.
            </Text>
          ) : (
            projectTypeStats.map((pt) => (
              <View key={pt.label} style={styles.projectRow}>
                <View style={styles.projectRowHeader}>
                  <Text style={styles.projectLabel}>{pt.label}</Text>
                  <Text style={styles.projectAmount}>{pt.amount}</Text>
                </View>
                <Text style={styles.projectSubLabel}>
                  Avg margin {pt.percent.toFixed(1)}%
                </Text>
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={['#22c55e', '#14b8a6', '#0ea5e9']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(100, Math.max(0, pt.percent))}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </LinearGradient>

      {/* Revenue Forecast */}
      <LinearGradient
        colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
        start={{ x: 0.05, y: 0.15 }}
        end={{ x: 0.95, y: 0.85 }}
        style={[styles.cardBorder, styles.cardBorderStacked]}
      >
        <View style={styles.cardInner}>
          <Text style={styles.sectionEyebrow}>Forward-looking projection</Text>
          <View style={styles.blockHeaderRow}>
            <View style={styles.blockHeaderLeft}>
              <Feather name="trending-up" size={17} color="#22C55E" />
              <Text style={styles.blockTitle}>Revenue Forecast</Text>
            </View>
          </View>

          <View style={styles.forecastRow}>
            <View style={styles.forecastTile}>
              <Text style={styles.forecastLabel}>Projected Revenue</Text>
              <Text style={styles.forecastValue}>$38,237</Text>
              <Text style={styles.forecastSub}>
                Assumes 3 leads/mo · 100% win rate
              </Text>
            </View>

            <View style={styles.forecastTile}>
              <Text style={styles.forecastLabel}>Projected Profit</Text>
              <Text style={styles.forecastValue}>$26,546</Text>
              <Text style={styles.forecastSub}>Margin basis 69.4%</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name="information-circle-outline"
              size={15}
              color={darkMode ? "rgba(255,255,255,0.78)" : "#475569"}
            />
            <Text style={styles.infoText}>
              Projection based on monthly lead volume, average bid size, and win
              conversions.
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const getStyles = (Colors: any, darkMode: boolean) => StyleSheet.create({
  /* live data pill */
  livePillRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 6,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(22, 163, 74, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.55)",
  },
  livePillText: {
    marginLeft: 6,
    fontSize: 12,
    color: darkMode ? "rgba(255,255,255,0.92)" : "#0f172a",
    fontWeight: "500",
  },

  /* gradient border card */
  cardBorder: {
    borderRadius: 20,
    padding: 1,
    marginTop: 6,
  },
  cardBorderStacked: {
    marginTop: 12,
  },
  cardInner: {
    backgroundColor: darkMode ? Colors.card : Colors.cardDark,
    borderRadius: 18,
    padding: 14,
    borderWidth: darkMode ? 0 : 1,
    borderColor: darkMode ? "transparent" : Colors.line,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: darkMode ? "rgba(226,232,240,0.92)" : "#475569",
    marginBottom: 6,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "rgba(45, 212, 191, 0.25)",
    marginVertical: 14,
  },
  /* generic block card (legacy) */
  blockCard: {
    backgroundColor: "transparent",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
    marginTop: 14,
  },
  analyticsGradient: {
    width: "100%",
    borderRadius: 22,
    padding: 16,
  },
  blockHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  blockHeaderTextCol: {
    flex: 1,
    gap: 4,
  },
  blockHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  blockSubtitle: {
    marginLeft: 25,
    fontSize: 11,
    lineHeight: 15,
    color: darkMode ? "rgba(255,255,255,0.82)" : "#475569",
    fontWeight: "500",
  },
  blockTitle: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },

  /* chart */
  chartContainer: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingHorizontal: 4,
    paddingBottom: 2,
    minWidth: "100%",
  },
  barWrapper: {
    alignItems: "center",
    minWidth: 48,
    marginRight: 5,
  },
  barValueLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 3,
  },
  barValueLabelMuted: {
    color: darkMode ? "rgba(255,255,255,0.68)" : "rgba(51,65,85,0.68)",
    fontWeight: "500",
  },
  barTrack: {
    width: 22,
    height: 64,
    borderRadius: 999,
    backgroundColor: darkMode ? Colors.card : Colors.surface,
    borderWidth: 1,
    borderColor: darkMode ? Colors.line : "#94A3B8",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barTrackEmpty: {
    backgroundColor: darkMode ? "rgba(15,23,42,0.65)" : "rgba(241,245,249,0.9)",
    borderColor: darkMode ? "rgba(51,65,85,0.55)" : "rgba(148,163,184,0.45)",
  },
  barFill: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: "#22d3ee",
  },
  barFillEmpty: {
    backgroundColor: "rgba(34,211,238,0.22)",
  },
  monthPill: {
    marginTop: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  monthPillMuted: {
    backgroundColor: darkMode ? "rgba(30,41,59,0.6)" : "rgba(241,245,249,0.85)",
  },
  chartXAxisLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: darkMode ? "#FFFFFF" : "#334155",
  },
  chartXAxisLabelMuted: {
    color: darkMode ? "rgba(255,255,255,0.72)" : "rgba(51,65,85,0.68)",
    fontWeight: "500",
  },

  /* range filters */
  rangeRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 4,
    marginBottom: 12,
  },
  rangeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.8)",
    marginRight: 8,
  },
  rangeChipActive: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  rangeChipText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: "600",
  },
  rangeChipTextActive: {
    color: "#022C22",
  },

  singleProfitRow: {
    marginTop: 2,
    marginBottom: 6,
  },
  profitLabel: {
    fontSize: 12,
    color: darkMode ? "rgba(255,255,255,0.88)" : "#334155",
  },
  profitValue: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 3,
  },
  profitSubnote: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 15,
    color: darkMode ? "rgba(255,255,255,0.82)" : "#475569",
  },

  /* project type rows */
  projectRow: {
    marginTop: 8,
  },
  projectRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  projectLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  projectAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  projectSubLabel: {
    marginTop: 2,
    fontSize: 12,
    color: darkMode ? "rgba(255,255,255,0.86)" : "#475569",
  },
  progressTrack: {
    marginTop: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  /* forecast */
  forecastRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  forecastTile: {
    flex: 1,
    marginRight: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: darkMode ? "rgba(255, 255, 255, 0.05)" : Colors.surface,
    borderWidth: 1,
    borderColor: darkMode ? "rgba(255, 255, 255, 0.1)" : Colors.line,
  },
  forecastLabel: {
    fontSize: 11,
    color: darkMode ? "rgba(255,255,255,0.88)" : "#334155",
    fontWeight: "600",
  },
  forecastValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 3,
  },
  forecastSub: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    color: darkMode ? "rgba(255,255,255,0.82)" : "#475569",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 10,
    backgroundColor: darkMode ? "rgba(255, 255, 255, 0.04)" : Colors.surface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: darkMode ? "rgba(255, 255, 255, 0.08)" : Colors.line,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 11,
    lineHeight: 16,
    color: darkMode ? "rgba(255,255,255,0.86)" : "#475569",
    flex: 1,
  },
});

export default ProfileAnalytics;
