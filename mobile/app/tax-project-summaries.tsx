import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, Platform, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAX_CENTER_WEB_MAX_CONTENT_WIDTH } from '@/constants/ScreenLayout';
import { useProjectList } from '@/contexts/ProjectListContext';
import ProjectTaxSummaryList from '@/src/components/tax/ProjectTaxSummaryList';
import BackButton from '@/components/ui/BackButton';
import { buildProjectTaxSummaries, formatTaxNetMarginPercent, isCurrentTaxProject } from '@/src/lib/taxCenter';

const money = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const percent = (value: number | null): string => formatTaxNetMarginPercent(value);

export default function TaxProjectSummariesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ year?: string }>();
  const selectedYear = Number(params.year) || new Date().getFullYear();
  const { projects, refreshProjects, rehydrateProjectsFromStorage } = useProjectList();
  const refreshProjectsRef = useRef(refreshProjects);
  const rehydrateProjectsRef = useRef(rehydrateProjectsFromStorage);
  refreshProjectsRef.current = refreshProjects;
  rehydrateProjectsRef.current = rehydrateProjectsFromStorage;

  const refreshTaxCenterData = useCallback(() => {
    void rehydrateProjectsRef.current();
    void refreshProjectsRef.current();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshTaxCenterData();
    }, [refreshTaxCenterData])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refreshTaxCenterData();
    });
    return () => sub.remove();
  }, [refreshTaxCenterData]);

  const summaries = useMemo(() => {
    const current = projects.filter(isCurrentTaxProject);
    return buildProjectTaxSummaries(current, selectedYear);
  }, [projects, selectedYear]);

  return (
    <View style={styles.screenRoot}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.pageShell, Platform.OS === 'web' && styles.pageShellWeb]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <View style={styles.backButtonWrapper}>
                <BackButton darkMode={true} onPress={() => router.back()} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>Project summaries</Text>
                <Text style={styles.subtitle}>Tax year {selectedYear}</Text>
              </View>
            </View>
            <Text style={styles.note}>
              Revenue is cash collected in this tax year. Outstanding invoices are informational and are not counted as
              collected income.
            </Text>
            <ProjectTaxSummaryList projects={summaries} formatMoney={money} formatPercent={percent} asPage />
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pageShell: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 16,
  },
  pageShellWeb: {
    maxWidth: TAX_CENTER_WEB_MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  scroll: {
    flex: 1,
  },
  headerRow: {
    minHeight: 56,
    justifyContent: 'center',
    marginBottom: 8,
  },
  backButtonWrapper: {
    position: 'absolute',
    left: 0,
    zIndex: 2,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    alignItems: 'center',
    paddingHorizontal: 44,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 23,
    textAlign: 'center',
  },
  subtitle: {
    color: '#d7e1f0',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.12,
    lineHeight: 20,
    textAlign: 'center',
  },
  note: {
    color: '#d7e1f0',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
});
