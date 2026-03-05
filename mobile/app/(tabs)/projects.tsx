import React, { useState, useMemo, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useProjectList } from '@/contexts/ProjectListContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAIManagerMode } from '@/hooks/useAIManagerMode';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIAssistantModal from '@/components/AIAssistantModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // CRITICAL: Original budget MUST come from estimate/contract fields ONLY
  // NEVER use projectData.budgeted or project.budgeted - these may already include change orders!
  // Priority order matches BudgetTab and OverviewScreen to ensure consistency across all pages
  const originalBudgetCandidates: any[] = [
    project?.estimateData?.grandTotal,      // PRIMARY: estimate's grandTotal (what user sees in estimate, e.g. $7,200)
    project?.estimateData?.bidPrice,        // Secondary: estimate's bidPrice
    project?.estimateData?.total,           // Tertiary: estimate's total
    project?.bidPrice,                      // Fallback: project's bidPrice (should match estimate)
    project?.projectData?.bidPrice,         // Fallback: projectData bidPrice
    project?.projectData?.totalBidPrice,    // Fallback: projectData totalBidPrice
    project?.estimatedCost,                 // Fallback: estimatedCost
    project?.projectData?.estimatedCost,    // Fallback: projectData estimatedCost
    project?.total,                         // Fallback: project total
    project?.totalRevenue,                  // Fallback: totalRevenue
    project?.contractValue,                 // Fallback: contractValue
  ];

  let originalBudget = 0;
  for (const candidate of originalBudgetCandidates) {
    const sanitized = sanitizePositiveNumber(candidate);
    if (sanitized > 0) {
      originalBudget = sanitized;
      break;
    }
  }

  // CRITICAL: Do NOT use projectData.budgeted or project.budgeted as fallback
  // These fields may already include approved change orders, which would cause double-counting
  // If no original estimate value exists, return 0 (better to show 0 than wrong value)
  if (originalBudget <= 0) {
    if (__DEV__) {
      const projectName = project?.title || project?.name || 'Unknown';
      console.warn(`⚠️ No original budget found for ${projectName}. Estimate fields missing.`);
    }
    return 0;
  }

  // Collect change orders from all possible locations and compute approved total.
  const changeOrderSources: any[] = [
    project?.projectData?.changeOrders,
    project?.changeOrders,
    (project as any)?.rawProject?.projectData?.changeOrders,
    (project as any)?.rawProject?.changeOrders,
  ];

  const collected: any[] = [];
  for (const source of changeOrderSources) {
    if (Array.isArray(source) && source.length > 0) {
      collected.push(...source);
    }
  }

  // Deduplicate by id when available, otherwise by title+amount signature.
  const seen = new Set<string>();
  const uniqueChangeOrders = collected.filter((co: any) => {
    const key = co?.id != null
      ? `id:${String(co.id)}`
      : `sig:${String(co?.title || '')}:${String(co?.amount ?? co?.clientPrice ?? co?.cost ?? 0)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let approvedChangeOrdersTotal = uniqueChangeOrders.reduce(
    (sum, co) => {
      const amount = Number(co.amount ?? co.clientPrice ?? co.cost ?? 0);
      const isApproved =
        (typeof co.approved === 'boolean' && co.approved) ||
        (typeof co.status === 'string' && co.status.toLowerCase() === 'approved');
      return isApproved ? sum + amount : sum;
    },
    0
  );

  // Legacy fallback: some records persist only aggregate CO total.
  if (approvedChangeOrdersTotal <= 0) {
    approvedChangeOrdersTotal = sanitizePositiveNumber(
      project?.projectData?.changeOrderTotal ??
      (project as any)?.changeOrderTotal ??
      (project as any)?.rawProject?.projectData?.changeOrderTotal
    );
  }

  // Core rule: adjusted budget = original budget + approved COs.
  return originalBudget + approvedChangeOrdersTotal;
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
  const { activeProjects, estimates, deleteProject, convertBidToProject, updateProject } = useProjectList();
  const { enabled: aiPmMode } = useAIManagerMode();
  const params = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<'active' | 'submitted'>(
    params.tab === 'submitted' ? 'submitted' : 'active'
  );
  const [showSubmitBanner, setShowSubmitBanner] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [projectDataOverrides, setProjectDataOverrides] = useState<Record<string, any>>({});

  const loadProjectDataOverrides = React.useCallback(async () => {
    const all = [...activeProjects, ...estimates];
    const next: Record<string, any> = {};

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const projectKeys = allKeys.filter((k) => k.startsWith('bps.project.'));
      const entries = await AsyncStorage.multiGet(projectKeys);

      const byId: Record<string, any> = {};
      const byTitle: Record<string, any> = {};

      for (const [key, value] of entries) {
        if (!value) continue;
        try {
          const parsed = JSON.parse(value);
          const idFromKey = key.replace('bps.project.', '');
          const idFromData = String(parsed?.id ?? '');
          const title = String(parsed?.title ?? '').trim().toLowerCase();
          if (idFromKey) byId[idFromKey] = parsed;
          if (idFromData) byId[idFromData] = parsed;
          if (title) byTitle[title] = parsed;
        } catch {
          // Ignore malformed per-project storage entries.
        }
      }

      for (const project of all) {
        const pid = String(project?.id ?? '');
        const titleKey = String(project?.title ?? '').trim().toLowerCase();
        const override = byId[pid] || (titleKey ? byTitle[titleKey] : undefined);
        if (override) next[pid] = override;
      }
    } catch {
      // Keep UI responsive if storage read fails.
    }

    setProjectDataOverrides(next);
  }, [activeProjects, estimates]);

  useEffect(() => {
    loadProjectDataOverrides();
  }, [loadProjectDataOverrides]);

  useFocusEffect(
    React.useCallback(() => {
      loadProjectDataOverrides();
    }, [loadProjectDataOverrides])
  );

  // Update tab if route param changes
  useEffect(() => {
    if (params.tab === 'submitted') {
      setActiveTab('submitted');
      // Show confirmation banner when arriving from submit bid
      if (params.fromSubmit === 'true') {
        setShowSubmitBanner(true);
        setTimeout(() => {
          setShowSubmitBanner(false);
        }, 3000);
      }
    }
  }, [params.tab, params.fromSubmit]);

  const user = {
    name: 'Nick Lafontaine',
    initials: 'NL',
  };

  // Transform projects data - separate submitted and active
  const allProjects = useMemo(() => {
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
        const pid = String(p?.id ?? '');
        const override = projectDataOverrides[pid];

        const mergedProject = override
          ? {
              ...p,
              budgeted: override?.budgeted ?? p?.budgeted,
              changeOrders: Array.isArray(override?.changeOrders)
                ? override.changeOrders
                : (Array.isArray(p?.changeOrders) ? p.changeOrders : []),
              projectData: {
                ...(p?.projectData || {}),
                ...override,
                changeOrders: Array.isArray(override?.changeOrders)
                  ? override.changeOrders
                  : (Array.isArray(p?.projectData?.changeOrders) ? p.projectData.changeOrders : []),
              },
            }
          : p;

        const status = p.status || 'draft';
        let displayStatus = 'Draft';
        if (status === 'estimate') displayStatus = 'Draft';
        else if (status === 'bid_submitted') displayStatus = 'Submitted';
        else if (status === 'won') displayStatus = 'Active';
        else if (status === 'in_progress') displayStatus = 'Active';
        else if (status === 'completed') displayStatus = 'Completed';
        else displayStatus = status.charAt(0).toUpperCase() + status.slice(1);

      const revenue = getProjectRevenue(mergedProject);
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
        rawProject: mergedProject,
        rawStatus: status,
      };
    });
  }, [activeProjects, estimates, projectDataOverrides]);

  // Filter projects by active tab
  const projects = useMemo(() => {
    if (activeTab === 'submitted') {
      return allProjects.filter(p => p.status === 'Submitted' || p.rawStatus === 'bid_submitted' || p.rawStatus === 'submitted');
    } else {
      return allProjects.filter(p => p.status === 'Active' || p.status === 'Completed' || p.rawStatus === 'won' || p.rawStatus === 'in_progress' || p.rawStatus === 'active' || p.rawStatus === 'completed');
    }
  }, [allProjects, activeTab]);

  const handleProjectPress = (project: any) => {
    router.push(`/project-detail/${project.id}`);
  };

  const [markAsWonModalVisible, setMarkAsWonModalVisible] = useState(false);
  const [selectedProjectForWon, setSelectedProjectForWon] = useState<any>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [successProjectName, setSuccessProjectName] = useState('');

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

  const handleMarkAsWon = (project: any, e: any) => {
    e?.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedProjectForWon(project);
    setMarkAsWonModalVisible(true);
  };

  const confirmMarkAsWon = async () => {
    if (!selectedProjectForWon) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMarkAsWonModalVisible(false);
    
    try {
      // Convert the submitted bid to active project
      convertBidToProject(selectedProjectForWon.id);
      
      // Show success banner
      setSuccessProjectName(selectedProjectForWon.name);
      setShowSuccessBanner(true);
      
      // Auto-dismiss banner after 2 seconds
      setTimeout(() => {
        setShowSuccessBanner(false);
      }, 2000);
      
      // Switch to Active tab and scroll to show the new project
      setTimeout(() => {
        setActiveTab('active');
        // The project will now appear in the Active tab
      }, 500);
      
    } catch (error) {
      console.error('Error marking project as won:', error);
      Alert.alert('Error', 'Failed to mark project as won');
    }
    
    setSelectedProjectForWon(null);
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
              {projects.length} {activeTab === 'submitted' ? 'submitted' : 'active'} {projects.length === 1 ? 'project' : 'projects'}
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

        {/* TABS */}
        <View style={[styles.tabsContainer, styles.wideContainer]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'active' && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('active');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Active
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'submitted' && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab('submitted');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'submitted' && styles.tabTextActive]}>
              Submitted
            </Text>
          </TouchableOpacity>
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
              padding: 12,
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
                      {/* Waiting for client decision - only for submitted projects */}
                      {project.status === 'Submitted' && (
                        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="time-outline" size={12} color={darkMode ? "#94a3b8" : "#64748b"} />
                          <Text style={{ color: darkMode ? "#94a3b8" : "#64748b", fontSize: 12, fontStyle: 'italic' }}>
                            Waiting for client decision
                          </Text>
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
                  
                  {/* Mark as Won button for submitted projects */}
                  {project.status === 'Submitted' && (
                    <TouchableOpacity
                      style={styles.markAsWonButton}
                      onPress={(e) => handleMarkAsWon(project, e)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#2DFFC4', '#00A6FF']}
                        start={{ x: 0.05, y: 0.15 }}
                        end={{ x: 0.95, y: 0.85 }}
                        style={styles.markAsWonGradient}
                      >
                        <Text style={styles.markAsWonText}>Mark as Won</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
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

      {/* Submit Bid Confirmation Banner */}
      {showSubmitBanner && (
        <View style={styles.submitBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          <Text style={styles.submitBannerText}>
            ✅ Bid submitted{'\n'}
            We'll keep this estimate ready to turn into a project.
          </Text>
        </View>
      )}

      {/* Success Banner */}
      {showSuccessBanner && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          <Text style={styles.successBannerText}>
            🏁 Project activated{'\n'}
            {successProjectName} is now a live project.
          </Text>
        </View>
      )}

      {/* Mark as Won Confirmation Modal (Bottom Sheet) */}
      <Modal
        visible={markAsWonModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMarkAsWonModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMarkAsWonModalVisible(false)}
        >
          <Pressable
            style={styles.bottomSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>Mark project as won?</Text>
            <Text style={styles.bottomSheetBody}>
              This will convert your estimate into an active project and begin tracking costs, labor, and profit.
            </Text>
            <View style={styles.bottomSheetButtons}>
              <TouchableOpacity
                style={styles.bottomSheetCancelButton}
                onPress={() => {
                  setMarkAsWonModalVisible(false);
                  setSelectedProjectForWon(null);
                }}
              >
                <Text style={styles.bottomSheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bottomSheetConfirmButton}
                onPress={confirmMarkAsWon}
              >
                <LinearGradient
                  colors={['#2DFFC4', '#00A6FF']}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.bottomSheetConfirmGradient}
                >
                  <Text style={styles.bottomSheetConfirmText}>Mark as won</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* FLOATING ASK PM BADGE - Dashboard AI PM Mode Style */}
      <Pressable
        style={styles.aiFloatingWrapper}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowAIAssistant(true);
        }}
      >
        <LinearGradient
          colors={["#22c55e", "#22d3ee"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiFloating}
        >
          <Ionicons
            name="sparkles"
            size={18}
            color="#020617"
          />
          <Text style={styles.aiFloatingText}>Ask PM</Text>
        </LinearGradient>
      </Pressable>

      {/* AI Assistant Modal */}
      <AIAssistantModal
        visible={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        context={JSON.stringify({
          screen: "Projects",
          allProjects: [...activeProjects, ...estimates].map(p => ({
            id: p.id,
            title: p.title,
            customerName: (p as any).client || p.title,
            status: p.status,
            bidPrice: p.bidPrice || 0,
            estimatedCost: p.estimatedCost || 0,
            actualCost: p.actualCost || p.totalSpent || (p.projectData?.actualCost || p.projectData?.spent || 0),
            totalSpent: p.totalSpent || p.actualCost || (p.projectData?.spent || p.projectData?.actualCost || 0),
            expenses: p.expenses || p.projectData?.expenses || [],
            expensesCount: (p.expenses || p.projectData?.expenses || []).length,
            margin: p.margin || 0,
            progress: p.progress || p.overallProgressPct || 0,
          })),
        })}
        onAction={async (action) => {
          console.log('AI Action from Projects page:', action);
          
          // Handle project expense actions
          if ((action.type === 'add_material' || action.type === 'add_material_purchase') && 
              action.projectId && 
              action.projectName) {
            const allProjects = [...activeProjects, ...estimates];
            const project = allProjects.find(p => p.id === action.projectId);
            
            if (project) {
              // CRITICAL: Load expenses from AsyncStorage to avoid restoring deleted items
              let currentExpenses = project.projectData?.expenses || [];
              try {
                const storageKey = `bps.project.${action.projectId}`;
                const existingDataStr = await AsyncStorage.getItem(storageKey);
                if (existingDataStr) {
                  const existingProjectData = JSON.parse(existingDataStr);
                  // Use expenses from AsyncStorage as source of truth (includes deletions)
                  currentExpenses = existingProjectData.expenses || [];
                }
              } catch (error) {
                console.error('Error loading expenses from AsyncStorage:', error);
                // Fallback to project.projectData if AsyncStorage fails
              }
              
              const expenseCategory = action.category || 'Materials/Equipment';
              
              const newExpense = {
                id: `exp-${Date.now()}`,
                category: expenseCategory,
                vendor: action.vendor || '',
                amount: action.amount || 0,
                date: new Date().toISOString(),
                notes: action.notes || `${action.category || 'Material'} from ${action.vendor || 'vendor'}`,
                receiptUri: null,
              };
              
              const updatedExpenses = [...currentExpenses, newExpense];
              
              // Load current spent from AsyncStorage too
              let currentSpent = project.projectData?.spent || 0;
              try {
                const storageKey = `bps.project.${action.projectId}`;
                const existingDataStr = await AsyncStorage.getItem(storageKey);
                if (existingDataStr) {
                  const existingProjectData = JSON.parse(existingDataStr);
                  currentSpent = existingProjectData.spent || 0;
                }
              } catch (error) {
                // Fallback to project.projectData if AsyncStorage fails
              }
              
              const newSpent = currentSpent + (action.amount || 0);
              
              // Update budget buckets
              const expenseCategoryLower = expenseCategory.toLowerCase();
              let currentBuckets = project.projectData?.buckets || [];
              try {
                const storageKey = `bps.project.${action.projectId}`;
                const existingDataStr = await AsyncStorage.getItem(storageKey);
                if (existingDataStr) {
                  const existingProjectData = JSON.parse(existingDataStr);
                  currentBuckets = existingProjectData.buckets || [];
                }
              } catch (error) {
                // Fallback to project.projectData if AsyncStorage fails
              }
              
              const updatedBuckets = currentBuckets.map((bucket: any) => {
                const bucketName = (bucket.name || '').toLowerCase();
                
                if (bucketName === expenseCategoryLower) {
                  return {
                    ...bucket,
                    spent: (bucket.spent || 0) + (action.amount || 0),
                  };
                }
                
                const isMaterialsBucket = bucketName.includes('materials') || bucketName.includes('equipment');
                const isMaterialCategory = expenseCategoryLower.includes('materials') || 
                                         expenseCategoryLower.includes('equipment') ||
                                         ['tile', 'drywall', 'lumber', 'concrete', 'paint', 'electrical', 
                                          'plumbing', 'hardware', 'roofing', 'insulation', 'flooring', 
                                          'cabinets', 'appliances', 'windows', 'doors', 'siding', 
                                          'decking', 'fencing', 'landscaping'].includes(expenseCategoryLower);
                
                if (isMaterialsBucket && isMaterialCategory) {
                  return {
                    ...bucket,
                    spent: (bucket.spent || 0) + (action.amount || 0),
                  };
                }
                
                if (bucketName.includes('labor') && expenseCategoryLower.includes('labor')) {
                  return {
                    ...bucket,
                    spent: (bucket.spent || 0) + (action.amount || 0),
                  };
                }
                
                return bucket;
              });
              
              updateProject(action.projectId, {
                projectData: {
                  ...project.projectData,
                  expenses: updatedExpenses,
                  spent: newSpent,
                  buckets: updatedBuckets,
                  lastUpdated: new Date().toISOString(),
                },
              });
              
              // Also save directly to AsyncStorage to ensure consistency
              try {
                const storageKey = `bps.project.${action.projectId}`;
                const existingDataStr = await AsyncStorage.getItem(storageKey);
                let existingProjectData = existingDataStr ? JSON.parse(existingDataStr) : {};
                
                const projectDataToSave = {
                  ...existingProjectData,
                  expenses: updatedExpenses,
                  spent: newSpent,
                  buckets: updatedBuckets,
                  lastUpdated: new Date().toISOString(),
                };
                
                await AsyncStorage.setItem(storageKey, JSON.stringify(projectDataToSave));
                console.log('✅ Saved expense to AsyncStorage from Projects page');
              } catch (error) {
                console.error('Error saving to AsyncStorage:', error);
              }
              
              console.log('✅ Added expense to project:', action.projectName, action.amount, action.category);
            }
          }
        }}
      />
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
    paddingHorizontal: 4,
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
    padding: 12,
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
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.08)',
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabActive: {
    backgroundColor: darkMode ? 'rgba(45, 255, 196, 0.15)' : 'rgba(45, 255, 196, 0.1)',
    borderWidth: 2,
    borderColor: darkMode ? '#2DFFC4' : '#0EA5E9',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: darkMode ? Colors.sub : '#64748B',
  },
  tabTextActive: {
    color: darkMode ? '#2DFFC4' : '#0EA5E9',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: darkMode ? '#2DFFC4' : '#0EA5E9',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  markAsWonButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  markAsWonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAsWonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  submitBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: darkMode ? '#1e293b' : '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  submitBannerText: {
    flex: 1,
    color: darkMode ? Colors.text : Colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  successBanner: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: darkMode ? '#1e293b' : '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  successBannerText: {
    flex: 1,
    color: darkMode ? Colors.text : Colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: darkMode ? Colors.card : Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '50%',
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: darkMode ? Colors.sub : '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  bottomSheetBody: {
    fontSize: 16,
    color: Colors.sub,
    lineHeight: 24,
    marginBottom: 24,
  },
  bottomSheetButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomSheetCancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: darkMode ? Colors.surface2 : '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetCancelText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSheetConfirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bottomSheetConfirmGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheetConfirmText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  // FLOATING ASK PM BADGE - Dashboard AI PM Mode Style
  aiFloatingWrapper: {
    position: "absolute",
    right: 20,
    bottom: 100, // Raised above tab bar with more spacing
    zIndex: 10,
  },
  aiFloating: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: "#22c55e",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8, // Android shadow
  },
  aiFloatingText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#020617",
  },
});
