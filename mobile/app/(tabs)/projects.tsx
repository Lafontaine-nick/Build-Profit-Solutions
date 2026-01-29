import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  SafeAreaView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useProjectList } from '@/contexts/ProjectListContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAIManagerMode } from '@/hooks/useAIManagerMode';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

// Utility functions (same as dashboard)
const formatCurrencyShort = (value: number) => {
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
};

// Format currency as full value with 2 decimal places (e.g., $3,000.00)
const formatCurrencyFull = (value: number) => {
  return value.toLocaleString('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });
};

const sanitizePositiveNumber = (value: any): number => {
  if (value == null) return 0;
  const num =
    typeof value === 'string'
      ? Number(value.replace(/[$,\s]/g, ''))
      : Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

const getProjectRevenue = (project: any): number => {
  if (!project) return 0;
  const candidates: any[] = [
    project?.bidPrice,
    project?.projectData?.bidPrice,
    project?.projectData?.totalBidPrice,
    project?.estimateData?.bidPrice,
    project?.estimateData?.grandTotal,
    project?.total,
    project?.totalRevenue,
    project?.contractValue,
    project?.estimatedCost,
  ];
  for (const candidate of candidates) {
    const sanitized = sanitizePositiveNumber(candidate);
    if (sanitized > 0) {
      return sanitized;
    }
  }
  return 0;
};

// Palette aligned with key metric cards
const projectCardGradient = ['#070f1e', '#0b1f31', '#0c2f35', '#0fb493'];
const progressGradient = ['#22c55e', '#14b8a6', '#0ea5e9'];
const getStatusTheme = (darkMode: boolean) => ({
  Active: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Completed: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Submitted: { 
    bg: darkMode ? 'rgba(148, 163, 184, 0.24)' : 'rgba(148, 163, 184, 0.15)', 
    border: darkMode ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.25)', 
    color: darkMode ? '#e2e8f0' : '#475569' 
  },
  Won: { bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)', color: '#34d399' },
  Draft: { 
    bg: darkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.15)', 
    border: darkMode ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.25)', 
    color: darkMode ? '#cbd5e1' : '#64748b' 
  },
});

export default function ProjectsScreen() {
  const router = useRouter();
  useRequireAuth();
  const { t } = useTranslation();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => getStyles(Colors, darkMode), [Colors, darkMode]);
  const { activeProjects, estimates, deleteProject } = useProjectList();
  const { enabled: aiPmMode } = useAIManagerMode();

  const user = {
    name: 'Nick Lafontaine',
    initials: 'NL',
  };

  // Transform projects data - only show submitted and above (hide draft/estimate)
  const projects = useMemo(() => {
    return [...activeProjects, ...estimates]
      .filter((p) => {
        const status = (p.status || 'draft').toString().toLowerCase();
        // Only show projects that are submitted or beyond (hide draft/estimate)
        return status !== 'draft' && 
               status !== 'estimate' && 
               (status === 'bid_submitted' || 
                status === 'submitted' || 
                status === 'won' || 
                status === 'in_progress' || 
                status === 'active' || 
                status === 'completed');
      })
      .map((p) => {
        const status = p.status || 'draft';
        let displayStatus = 'Draft';
        if (status === 'estimate') displayStatus = 'Draft';
        else if (status === 'bid_submitted') displayStatus = 'Submitted';
        else if (status === 'won') displayStatus = 'Active';
        else if (status === 'in_progress') displayStatus = 'Active';
        else if (status === 'completed') displayStatus = 'Completed';
        else displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

      const revenue = getProjectRevenue(p);
      const margin = p.margin || 0;
      const marginRatio = Math.abs(margin) > 1 ? margin / 100 : margin;
      
      // Only show revenue for submitted/active/completed projects, show $0 for drafts
      const displayAmount = (displayStatus === 'Draft' || status === 'estimate') ? 0 : revenue;
      
      return {
        id: p.id,
        name: p.title || 'Untitled Project',
        status: displayStatus,
        location: p.location || 'Unknown, Unknown',
        progress: (p.progress || p.overallProgressPct || 0) / 100, // Convert to 0-1
        amount: displayAmount,
        margin: marginRatio * 100,
        marginDisplay: `${(marginRatio * 100).toFixed(1)}% margin`,
        dateLabel: p.endDate
          ? status === 'completed'
            ? `Completed ${new Date(p.endDate).toISOString().split('T')[0]}`
            : `Due ${new Date(p.endDate).toISOString().split('T')[0]}`
          : 'No due date',
        rawProject: p,
      };
    });
  }, [activeProjects, estimates]);

  const handleProjectPress = (project: any) => {
    router.push(`/project-detail/${project.id}`);
  };

  const handleDeleteProject = async (project: any, e: any) => {
    // Stop event propagation so it doesn't trigger the card press
    e?.stopPropagation();
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      t('projects.deleteProject'),
      t('projects.deleteConfirm', { name: project.name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProject(project.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Error deleting project:', error);
              Alert.alert(t('common.error'), t('projects.deleteError'));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={[styles.headerRow, styles.wideContainer]}>
          <View>
            <Text style={styles.screenTitle}>{t('projects.allProjects')}</Text>
            <Text style={styles.screenSubtitle}>
              {projects.length} {t('dashboard.total')} · {t('projects.latestActivity')}
            </Text>
          </View>

          {/* Profile with glow */}
          <LinearGradient
            colors={progressGradient}
            style={styles.profileOuter}
          >
            <Pressable
              style={styles.profileInner}
              onPress={() => router.push('/profile')}
            >
              <Text style={styles.profileInitials}>{user.initials}</Text>
            </Pressable>
          </LinearGradient>
        </View>

        {/* ALL PROJECTS CARD */}
        <View style={styles.wideContainer}>
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
              backgroundColor: darkMode ? Colors.card : Colors.bg,
              borderRadius: 18,
              padding: 16,
            }}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>{t('projects.allProjects')}</Text>
                  <Text style={styles.cardSubtitle}>
                    {projects.length} {t('dashboard.total')} · {t('projects.latestActivity')}
                  </Text>
                </View>
              </View>
              
              {projects.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="folder-outline" size={48} color={darkMode ? "#7C8BA0" : "#475569"} />
                  <Text style={styles.emptyStateText}>{t('dashboard.noProjects')}</Text>
                  <Text style={styles.emptyStateSubtext}>
                    {t('dashboard.createFirstProject')}
                  </Text>
                </View>
              ) : (
                <View style={{ marginTop: 12 }}>
                  {projects.map((project) => {
                    const statusThemeMap = getStatusTheme(darkMode);
                    const pill = statusThemeMap[project.status] ?? statusThemeMap.Draft;
                    return (
                    <Pressable
                      key={project.id}
                      style={styles.projectCard}
                      onPress={() => handleProjectPress(project)}
                    >
                      <View
                        style={[
                          styles.projectCardBorderLight,
                          darkMode && styles.projectCardBorderDark,
                          !darkMode && { borderColor: Colors.line },
                        ]}
                      >
                        <View style={[styles.projectCardInner, !darkMode && { borderWidth: 1, borderColor: Colors.line }]}>
                  <View style={styles.projectTopRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text 
                        style={styles.projectName}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {project.name}
                      </Text>
                      <View style={styles.projectLocationRow}>
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color={darkMode ? "#7C8BA0" : "#475569"}
                        />
                        <Text style={styles.projectLocationText}>
                          {project.location}
                        </Text>
                      </View>
                      {/* Customer Information */}
                      {(project.rawProject?.client || project.rawProject?.estimateData?.customerName || project.rawProject?.clientEmail || project.rawProject?.estimateData?.customerEmail) && (
                        <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {(project.rawProject?.client || project.rawProject?.estimateData?.customerName) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="person-outline" size={12} color={darkMode ? "#7C8BA0" : "#475569"} />
                              <Text style={{ color: darkMode ? Colors.sub : "#475569", fontSize: 11 }}>
                                {project.rawProject?.client || project.rawProject?.estimateData?.customerName}
                              </Text>
                            </View>
                          )}
                          {(project.rawProject?.clientEmail || project.rawProject?.estimateData?.customerEmail) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="mail-outline" size={12} color={darkMode ? "#7C8BA0" : "#475569"} />
                              <Text style={{ color: darkMode ? Colors.sub : "#475569", fontSize: 11 }}>
                                {project.rawProject?.clientEmail || project.rawProject?.estimateData?.customerEmail}
                              </Text>
                            </View>
                          )}
                          {(project.rawProject?.clientPhone || project.rawProject?.estimateData?.customerPhone) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="call-outline" size={12} color={darkMode ? "#7C8BA0" : "#475569"} />
                              <Text style={{ color: darkMode ? Colors.sub : "#475569", fontSize: 11 }}>
                                {project.rawProject?.clientPhone || project.rawProject?.estimateData?.customerPhone}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={[
                          styles.statusPillBase,
                          {
                            backgroundColor: pill.bg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillTextBase,
                            { color: pill.color },
                          ]}
                        >
                          {project.status}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={(e) => handleDeleteProject(project, e)}
                        style={styles.deleteButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <MaterialIcons name="delete-outline" size={18} color={darkMode ? "#7C8BA0" : "#475569"} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.projectMiddleRow}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.projectAmount}>
                          {formatCurrencyFull(project.amount)}
                        </Text>
                      {aiPmMode && (
                        <View style={styles.aiTagChip}>
                          <Ionicons
                            name="sparkles-outline"
                            size={10}
                            color="#22C55E"
                          />
                          <Text
                            style={[
                              styles.aiTagText,
                              { color: "#22C55E" },
                            ]}
                          >
                            AI
                          </Text>
                        </View>
                      )}
                      </View>
                      <Text style={styles.projectMetaText}>
                        {project.marginDisplay}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.projectMetaLabel}>
                        {project.dateLabel.includes('Due') ? 'Due' : 'Completed'}
                </Text>
                      <Text style={styles.projectMetaText}>
                        {project.dateLabel.replace(/^(Due |Completed )/, '')}
                </Text>
              </View>
            </View>

                  <View style={styles.progressRow}>
                    <View style={styles.progressBarTrack}>
                      <LinearGradient
                        colors={progressGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(
                              Math.max(project.progress * 100, 0),
                              100
                            )}%`,
                            opacity: darkMode ? 1 : 0.9, // Slightly reduced opacity in light mode
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressPercent}>
                      {Math.round(project.progress * 100)}%
                    </Text>
                  </View>

                  <Text style={styles.progressLabel}>Progress</Text>
                        </View>
                </View>
              </Pressable>
            );
          })}
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (Colors: any, darkMode: boolean) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  wideContainer: {
    marginHorizontal: -20,
    paddingHorizontal: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 18,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
  },
  screenSubtitle: {
    fontSize: 14,
    color: darkMode ? Colors.sub : "#475569",
    marginTop: 4,
  },
  card: {
    padding: 18,
    backgroundColor: Colors.card,
    marginBottom: 16,
  },
  projectsCardWide: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 22, // Match dashboard size
    fontWeight: darkMode ? '700' : '800', // Heavier in light mode
    color: darkMode ? Colors.text : Colors.text,
  },
  cardSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: darkMode ? Colors.sub : "#475569", // slate-600 for better contrast
  },
  projectCard: {
    marginTop: 8,
  },
  projectCardBorderLight: {
    borderRadius: 20,
    padding: 1,
    borderWidth: 1,
  },
  projectCardBorderDark: {
    padding: 0,
    borderWidth: 0,
  },
  projectCardBorder: {
    borderRadius: 20,
    padding: 1,
  },
  projectCardInner: {
    backgroundColor: Colors.surface2, // Same grey as dashboard project cards
    borderRadius: 14,
    padding: 16,
    borderWidth: darkMode ? 1 : 0,
    borderColor: Colors.line,
  },
  projectCardGradient: {
    width: '100%',
    borderRadius: 24,
    padding: 16,
  },
  projectTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '700',
    color: darkMode ? Colors.text : Colors.text,
    flexShrink: 1,
  },
  projectLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  projectLocationText: {
    fontSize: 13,
    color: darkMode ? Colors.sub : "#475569",
  },
  statusPillBase: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillTextBase: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0', // Will be overridden inline for light mode
  },
  projectMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
  },
  projectAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: darkMode ? Colors.text : Colors.text,
  },
  projectMetaText: {
    marginTop: 2,
    fontSize: 13,
    color: darkMode ? "#9BB2C8" : "#475569",
  },
  projectMetaLabel: {
    fontSize: 12,
    color: darkMode ? "#7C8BA0" : "#475569",
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: darkMode ? "#1B2938" : "#CBD5E1", // Darker track in light mode
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 999,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: darkMode ? '#E5F7FF' : Colors.text,
  },
  progressLabel: {
    marginTop: 4,
    fontSize: 13,
    color: darkMode ? Colors.sub : "#475569",
  },
  aiTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(187,247,208,0.3)',
  },
  aiTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#BBF7D0',
    letterSpacing: 0.3,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: darkMode ? Colors.text : Colors.text,
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: darkMode ? "#8DA0B8" : "#475569",
    marginTop: 4,
    textAlign: 'center',
  },
  deleteButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: darkMode ? Colors.surface2 : "#FFFFFF",
    borderWidth: 1,
    borderColor: darkMode ? Colors.line : "#E2E8F0",
  },
  profileOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
  },
  profileInner: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
});
