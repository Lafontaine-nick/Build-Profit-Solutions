/* ----------------- ANALYTICS ----------------- */

interface AnalyticsSectionProps {
  metrics: {
    totalBids: string;
    activeProjects: string;
    avgMargin: string;
    completedProfit: number;
  };
  dashboardMetrics: any;
  activeWonCount: number;
  activeProjects: any[];
  estimates: any[];
}

const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
  metrics,
  dashboardMetrics,
  activeWonCount,
  activeProjects,
  estimates,
}) => {
  // Simple avg project value for the snapshot card
  const avgProjectValue = useMemo(() => {
    const rawTotal = metrics.totalBids; // e.g. "$44K"

    const numeric = parseFloat(rawTotal.replace(/[^\d.]/g, "")); // 44
    if (!numeric || !activeWonCount) return "$0";

    // If the string contains "K", treat it as thousands
    const isThousands = /K/i.test(rawTotal);
    const totalValue = isThousands ? numeric * 1000 : numeric; // 44,000

    return formatCurrencyShort(totalValue / activeWonCount);
  }, [metrics.totalBids, activeWonCount]);

  return (
    <>
      {/* Top snapshot card (4 mini metrics) */}
      <View style={[styles.analyticsSection, styles.wideContainer]}>
        <LinearGradient
          colors={["#2DFFC4", "#00A6FF"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={{
            borderRadius: 20,
            padding: 1,
            marginBottom: 16,
          }}
        >
          <View style={{
            backgroundColor: '#000000',
            borderRadius: 18,
            padding: 16,
          }}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>Performance Snapshot</Text>
                <Text style={styles.cardSubtitle}>Key metrics at a glance</Text>
              </View>
            </View>

            <View style={styles.analyticsGrid}>
              <AnalyticsMetric label="Total Bids" value={metrics.totalBids} />
              <AnalyticsMetric
                label="Active Projects"
                value={activeWonCount.toString()}
              />
              <AnalyticsMetric
                label="Avg Project Value"
                value={avgProjectValue}
              />
              <AnalyticsMetric
                label="Avg Margin"
                value={metrics.avgMargin}
                extra="+0.0%"
              />
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Deeper charts / profit analytics */}
      <View style={[styles.analyticsSection, styles.wideContainer]}>
        <ProfileAnalytics
          activeWonCount={activeWonCount}
          projectTypeStats={dashboardMetrics?.projectTypeStats}
          overviewProfit={metrics.completedProfit}
          completedProjects={[...activeProjects, ...estimates].filter(
            (p) => (p.status || "").toString().toLowerCase() === "completed"
          )}
        />
      </View>
    </>
  );
};

const AnalyticsMetric = ({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: string;
}) => {
  // Get icon and color for each metric type
  const getMetricConfig = (label: string) => {
    switch (label) {
      case "Total Bids":
        return { icon: "cash-outline" as keyof typeof Ionicons.glyphMap, color: "#3b82f6", bgColor: "rgba(59, 130, 246, 0.1)" };
      case "Active Projects":
        return { icon: "folder-outline" as keyof typeof Ionicons.glyphMap, color: "#22c55e", bgColor: "rgba(34, 197, 94, 0.1)" };
      case "Avg Project Value":
        return { icon: "trending-up-outline" as keyof typeof Ionicons.glyphMap, color: "#22d3ee", bgColor: "rgba(34, 211, 238, 0.1)" };
      case "Avg Margin":
        return { icon: "pie-chart-outline" as keyof typeof Ionicons.glyphMap, color: "#a78bfa", bgColor: "rgba(167, 139, 250, 0.1)" };
      default:
        return { icon: "stats-chart-outline" as keyof typeof Ionicons.glyphMap, color: "#8DA0B8", bgColor: "rgba(141, 160, 184, 0.1)" };
    }
  };

  const config = getMetricConfig(label);

  return (
    <View style={styles.analyticsMetricInner}>
      <View style={[styles.analyticsMetricIconContainer, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={19} color={config.color} />
      </View>
      <View style={styles.analyticsMetricContent}>
        <Text style={styles.analyticsLabel}>{label}</Text>
        <Text style={styles.analyticsValue}>{value}</Text>
        {extra ? (
          <View style={styles.analyticsExtraContainer}>
            <Text style={styles.analyticsExtra}>{extra}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

/* ----------------- INSIGHTS ----------------- */

interface InsightsSectionProps {
  projects: any[];
  filteredNextSteps: any[];
  aiPmMode: boolean;
  aiLoading: boolean;
  aiError: string | null;
  aiData: AiDashboardResponse | null;
}

const InsightsSection: React.FC<InsightsSectionProps> = ({
  projects,
  filteredNextSteps,
  aiPmMode,
  aiLoading,
  aiError,
  aiData,
}) => {
  const urgentProjects = useMemo(() => {
    return projects.filter(
      (p) =>
        (p.status === "Active" || p.status === "In Progress") &&
        p.progress < 0.3 &&
        p.dateLabel.includes("Due")
    );
  }, [projects]);

  const avgMargin =
    projects.length > 0
      ? projects.reduce((sum, p) => sum + (p.margin || 0), 0) / projects.length
      : 0;

  return (
    <>
      <View style={styles.wideContainer}>
        <LinearGradient
          colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.nextStepsBorder}
        >
          <View style={styles.nextStepsInner}>
            <Text style={styles.cardTitle}>AI Insights</Text>
            <Text style={[styles.cardSubtitle, { marginTop: 8 }]}>
              {avgMargin > 80 && (
                <>
                  Your average margin is trending above {avgMargin.toFixed(1)}%. Consider raising
                  your minimum markup on new bids.
                  {"\n\n"}
                </>
              )}
              {urgentProjects.length > 0 && (
                <>
                  {urgentProjects.length} project{urgentProjects.length > 1 ? "s are" : " is"} under-utilizing your labor team. Shift crew from completed jobs to in-progress
                  work to finish sooner.
                </>
              )}
              {urgentProjects.length === 0 && avgMargin <= 80 && (
                <>
                  Smart suggestions about your bids, margins, and project risks will appear here
                  as you add more projects.
                </>
              )}
            </Text>
          </View>
        </LinearGradient>
      </View>

      {/* NEXT STEPS */}
      <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
        <View>
          <Text style={styles.sectionTitle}>Next Steps for You</Text>
          <Text style={styles.sectionSubtitle}>Quick actions to stay ahead</Text>
        </View>
      </View>

      <View style={styles.wideContainer}>
        <LinearGradient
          colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.nextStepsBorder}
        >
          <View style={styles.nextStepsInner}>
            {aiPmMode && aiLoading && (
              <Text style={styles.aiPanelPausedText}>Building your next steps…</Text>
            )}

            {aiPmMode &&
              !aiLoading &&
              !aiError &&
              filteredNextSteps.map((step) => (
                <NextStepItem
                  key={step.id}
                  label={step.label}
                  chip={step.chip}
                />
              ))}

            {!aiPmMode && (
              <Text style={styles.aiPanelPausedText}>
                Turn AI PM Mode back on to get smart next steps.
              </Text>
            )}

            {aiPmMode && !aiLoading && (aiData?.nextSteps ?? []).length === 0 && (
              <Text style={styles.aiPanelPausedText}>
                No immediate actions needed. Keep up the great work!
              </Text>
            )}
          </View>
        </LinearGradient>
      </View>
    </>
  );
};

/* ----------------- STYLES ----------------- */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  glossOverlay: {
    position: "absolute",
    top: -120,
    left: -60,
    right: -60,
    height: 260,
    backgroundColor: "rgba(15,23,42,0.6)",
  },

  // HEADER
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
    marginBottom: 18,
    marginHorizontal: -20,
    paddingHorizontal: 8,
  },
  titleGlow: {
    position: "absolute",
    left: -16,
    top: -8,
    width: 180,
    height: 56,
    opacity: 0.22,
    borderRadius: 999,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#f9fafb",
  },
  screenSubtitle: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 4,
  },
  aiStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  aiDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    marginRight: 6,
  },
  aiStatusText: {
    fontSize: 12,
    color: "#6ee7b7",
  },
  profileOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#22c55e",
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
  },
  profileInner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitials: {
    color: "#e5e7eb",
    fontWeight: "700",
    fontSize: 16,
  },

  // SEGMENTED CONTROL
  segmentContainer: {
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#19E180",
    marginBottom: 18,
  },
  segmentInner: {
    flexDirection: "row",
    padding: 4,
  },
  segmentTab: {
    flex: 1,
    borderRadius: 999,
  },
  segmentTabActive: {
    shadowColor: "#22c55e",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  segmentTabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 8,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#E5F7FF",
  },
  segmentLabelActive: {
    color: "#050B13",
  },

  // GENERIC CARD
  card: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  allProjectsCard: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  allProjectsContainer: {
    marginBottom: 16,
    marginHorizontal: -20,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  analyticsCardWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
    borderWidth: 0,
  },
  analyticsSection: {
    marginBottom: 16,
  },
  performanceSnapshotCard: {
    backgroundColor: "transparent", // gradient handles the fill
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#102131",
    marginBottom: 16,
  },
  analyticsGradient: {
    width: "100%",
    borderRadius: 22,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#8DA0B8",
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#15E08A",
  },

  // METRICS
  metricRow: {
    flexDirection: "row",
    gap: 12,
    paddingRight: 20,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  metricCard: {
    width: 200,
    borderRadius: 26,
    padding: 16,
    justifyContent: "space-between",
    minHeight: 140,
  },
  metricCardSecondary: {
    width: 200,
    borderRadius: 26,
    padding: 16,
    backgroundColor: "#0A2641",
    justifyContent: "space-between",
    minHeight: 140,
  },
  metricIconPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E5F7FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricIconPillSecondary: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E5F7FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  metricValueSecondary: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 14,
    color: "#E6F5FF",
  },
  metricLabelSecondary: {
    marginTop: 2,
    fontSize: 14,
    color: "#E6F5FF",
  },
  metricFooterRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(4, 16, 30, 0.75)",
  },
  metricChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  metricDeltaText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5FFF3",
  },
  metricChipSecondary: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#062033",
  },
  metricChipTextSecondary: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5F7FF",
  },

  // PROJECTS
  projectCard: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: "transparent", // gradient handles the fill
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#102131",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  projectCardGradient: {
    width: "100%",
    borderRadius: 24,
    padding: 16,
  },
  projectTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  projectName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  projectLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  projectLocationText: {
    fontSize: 13,
    color: "#7C8BA0",
  },
  statusPillBase: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillTextBase: {
    fontSize: 13,
    fontWeight: '700',
  },
  projectMiddleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 10,
  },
  projectAmount: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  projectMetaText: {
    marginTop: 2,
    fontSize: 13,
    color: "#9BB2C8",
  },
  projectMetaLabel: {
    fontSize: 12,
    color: "#7C8BA0",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#1B2938",
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    borderRadius: 999,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E5F7FF",
  },
  progressLabel: {
    marginTop: 4,
    fontSize: 13,
    color: "#7C8BA0",
  },
  aiTagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.2)",
    borderWidth: 1,
    borderColor: "rgba(187,247,208,0.3)",
  },
  aiTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#BBF7D0",
    letterSpacing: 0.3,
  },

  // PROJECT SUMMARY CARDS
  projectSummaryWrapper: {
    marginTop: 8,
  },
  projectSummaryBorder: {
    borderRadius: 20,
    padding: 1,
  },
  projectSummaryCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  projectSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  projectSummaryName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    flexShrink: 1,
  },
  projectSummaryAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9BB2C8",
    marginTop: 4,
  },
  projectSummaryProgress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // ANALYTICS
  analyticsGrid: {
    flexDirection: "column",
    marginTop: 16,
    gap: 10,
  },
  analyticsMetricBorder: {
    width: "48%",
    borderRadius: 16,
    padding: 1,
    marginBottom: 2,
  },
  analyticsMetricInner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  analyticsMetricCard: {
    width: "48%",
    backgroundColor: "transparent",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#102131",
  },
  analyticsMetricGradient: {
    width: "100%",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  analyticsMetricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  analyticsMetricContent: {
    flex: 1,
    minWidth: 0,
  },
  analyticsLabel: {
    fontSize: 10,
    color: "#8DA0B8",
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
    lineHeight: 12,
  },
  analyticsValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
    lineHeight: 24,
    marginBottom: 2,
  },
  analyticsExtraContainer: {
    marginTop: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignSelf: "flex-start",
  },
  analyticsExtra: {
    fontSize: 10,
    color: "#4ade80",
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  // EMPTY STATE
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: "#8DA0B8",
    marginTop: 4,
    textAlign: "center",
  },

  // ENHANCED METRIC CARDS
  metricOuter: {
    width: width * 0.72,
    marginRight: 14,
  },
  metricGradientCard: {
    flex: 1,
    borderRadius: 24,
    padding: 16,
    minHeight: 140,
    justifyContent: "space-between",
  },
  metricTopRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  metricIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  metricBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.7)",
  },
  chipText: {
    fontSize: 11,
    color: "#e5e7eb",
    fontWeight: "600",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "600",
  },
  metricContext: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 10,
  },

  // WIDE CONTAINER (matches allProjectsContainer)
  wideContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 8,
  },

  // SECTION HEADERS
  sectionHeaderRow: {
    marginTop: 8,
    marginBottom: 10,
    marginHorizontal: -20,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },

  // AI INSIGHTS PANEL
  aiPanelBorder: {
    borderRadius: 20,
    padding: 1,
    marginBottom: 16,
  },
  aiPanelInner: {
    backgroundColor: "#000000",
    borderRadius: 18,
    padding: 16,
  },
  aiPanel: {
    backgroundColor: "#000000",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 16,
  },
  aiPanelWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  aiPanelPausedText: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 10,
  },
  insightRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  insightIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e5e7eb",
  },
  insightBody: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },

  // NEXT STEPS
  nextStepsBorder: {
    borderRadius: 20,
    padding: 1,
    marginBottom: 16,
  },
  nextStepsInner: {
    backgroundColor: "#000000",
    borderRadius: 18,
    padding: 16,
  },
  nextStepsCard: {
    marginTop: 4,
    borderRadius: 20,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "#111827",
    padding: 14,
    marginBottom: 16,
  },
  nextStepsCardWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  nextStepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  nextStepBullet: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#22c55e",
    marginRight: 8,
  },
  nextStepLabel: {
    flex: 1,
    fontSize: 13,
    color: "#e5e7eb",
  },
  nextStepChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.18)",
    marginLeft: 8,
  },
  nextStepChipText: {
    fontSize: 10,
    color: "#4ade80",
    fontWeight: "600",
  },

  // FLOATING AI BADGE
  aiFloatingWrapper: {
    position: "absolute",
    right: 20,
    bottom: 88, // sits above bottom nav
  },
  aiFloating: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: "#22c55e",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  aiFloatingText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#020617",
  },
});
export default DashboardScreen;
