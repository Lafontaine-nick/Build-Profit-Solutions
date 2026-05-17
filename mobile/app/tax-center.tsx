import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import { TAX_CENTER_WEB_MAX_CONTENT_WIDTH } from '@/constants/ScreenLayout';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import TaxGradientFrame from '@/src/components/tax/TaxGradientFrame';
import TaxCategoryBreakdown from '@/src/components/tax/TaxCategoryBreakdown';
import ProjectTaxSummaryList from '@/src/components/tax/ProjectTaxSummaryList';
import SubcontractorTaxReport from '@/src/components/tax/SubcontractorTaxReport';
import TaxSummaryCard from '@/src/components/tax/TaxSummaryCard';
import TaxCenterSummaryDetailModal, {
  type TaxCenterDetailKind,
} from '@/src/components/tax/TaxCenterSummaryDetailModal';
import { useProjectList } from '@/contexts/ProjectListContext';
import {
  buildProjectTaxSummaries,
  buildRuleBasedTaxInsights,
  buildSubcontractorPaymentSummary,
  computeTaxCenterSummary,
  customerNameFromProject,
  expenseCountsTowardSubcontractorPayments,
  getCommittedCostsDetailRows,
  getOutstandingReceivablesDetailRows,
  getReceiptCountDetailRows,
  getRevenueCollectedDetailPayments,
  getTaxCenterDataInputs,
  getTaxCenterYearBucketAnomalies,
  getTaxYearOptions,
  getTaxYearRange,
  getYearCollectedPayments,
  getYearExpenses,
  groupExpensesByTaxCategory,
  type TaxCenterSummary,
} from '@/src/lib/taxCenter';
import { computeTaxCenterReadiness, type ReadinessChecklistItem } from '@/src/lib/taxCenterReadiness';
import { ACCOUNTING_CATEGORY_MAPPING_ENABLED } from '@/src/lib/taxCenterLaunchFlags';
import {
  generateTaxSummaryPdf,
  shareExportUri,
  writeBase64ToCacheFile,
} from '@/src/lib/taxCenterExport';
import {
  generateAccountantWorkbookBase64,
  generateCpaVendorReviewXlsxBase64,
  generateReceiptManifestXlsxBase64,
} from '@/src/lib/accountantWorkbookExport';
import { build1099ReviewSummary } from '@/src/lib/tax1099Review';
import { useVendorDirectory } from '@/contexts/VendorDirectoryContext';
import Tax1099ReviewDashboard from '@/src/components/tax/Tax1099ReviewDashboard';
import { buildTaxSummaryExportPayload, type TaxSummaryExportPayload } from '@/src/lib/taxCenterExportPayload';
import { getContractorCompanyNameAsync, getDocumentContactEmailAsync } from '@/lib/documentContactEmail';
import { decodeBase64ToUint8Array, triggerBrowserFileDownload } from '@/utils/triggerBrowserFileDownload';

const money = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const percent = (value: number | null): string => {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return `${Math.round(value * 100)}%`;
};

function exportDialogTitle(kind: 'pdf' | 'receipt'): string {
  if (kind === 'pdf') return 'CPA Summary PDF';
  return 'Export Receipt Backup';
}

function exportGeneratingLine(
  type: 'pdf' | 'receipts' | 'workbook' | 'cpa1099' | null
): string | null {
  if (type === 'pdf') return 'Generating your CPA summary PDF...';
  if (type === 'receipts') return 'Preparing your receipt backup...';
  if (type === 'workbook') return 'Building your accountant workbook...';
  if (type === 'cpa1099') return 'Building your CPA vendor review spreadsheet...';
  return null;
}

function mapExportFailureMessage(
  err: unknown,
  kind: 'pdf' | 'receipt' | 'workbook' | 'cpa1099'
): string {
  const m = err instanceof Error ? err.message : String(err);
  if (m === 'SHARING_UNAVAILABLE') return 'Sharing is not available on this device.';
  if (m === 'NO_FILESYSTEM_BASE' || m === 'EXPORT_WRITE_FAILED') return 'Export failed. Please try again.';
  if (kind === 'pdf') {
    const lower = m.toLowerCase();
    if (
      lower.includes('could not render pdf') ||
      lower.includes('chrome') ||
      lower.includes('puppeteer') ||
      lower.includes('pdf render') ||
      lower.includes('network request failed') ||
      lower.includes('aborted')
    ) {
      const clipped = m.length > 1200 ? `${m.slice(0, 1200)}…` : m;
      return `PDF export failed.\n\n${clipped}`;
    }
    return 'PDF export failed. Please try again.';
  }
  if (kind === 'workbook') return 'Workbook export failed. Please try again.';
  if (kind === 'cpa1099') return 'Vendor review export failed. Please try again.';
  return 'Receipt backup export failed. Please try again.';
}

async function withContractorExportMetaOnPayload(base: TaxSummaryExportPayload): Promise<TaxSummaryExportPayload> {
  const [contractorContactEmail, contractorCompanyName] = await Promise.all([
    getDocumentContactEmailAsync(),
    getContractorCompanyNameAsync(),
  ]);
  return {
    ...base,
    contractorContactEmail: contractorContactEmail ?? undefined,
    contractorCompanyName: contractorCompanyName ?? undefined,
  };
}

/** Checklist icon + label tone: green complete, amber needs attention, gray pending (not yet reviewed). */
function checklistRowTone(
  row: ReadinessChecklistItem,
  revenueNeedsAttention: boolean
): 'done' | 'attention' | 'pending' {
  if (row.ok) return 'done';
  if (row.id === 'export') return 'pending';
  if (row.id === 'revenue') return revenueNeedsAttention ? 'attention' : 'pending';
  if (row.id === 'dates') return row.ok ? 'done' : 'attention';
  return 'attention';
}

function taxCenterDetailTitle(kind: TaxCenterDetailKind): string {
  switch (kind) {
    case 'revenue':
      return 'Revenue Collected';
    case 'ar':
      return 'Outstanding Receivables';
    case 'expenses':
      return 'Expenses Paid';
    case 'committed':
      return 'Committed Costs';
    case 'netIncome':
      return 'Net Income';
    case 'netMargin':
      return 'Net Margin';
    case 'subcontractor':
      return 'Subcontractor Payments';
    case 'receipts':
      return 'Receipt Count';
    default:
      return 'Detail';
  }
}

function taxCenterDetailSummaryCardValue(kind: TaxCenterDetailKind, summary: TaxCenterSummary): string {
  switch (kind) {
    case 'revenue':
      return money(summary.grossIncomeCollected);
    case 'ar':
      return money(summary.outstandingReceivables);
    case 'expenses':
      return money(summary.totalExpenses);
    case 'committed':
      return money(summary.committedCosts);
    case 'netIncome':
      return money(summary.netProfit);
    case 'netMargin':
      return percent(summary.netMargin);
    case 'subcontractor':
      return money(summary.subcontractorPayments);
    case 'receipts':
      return String(summary.receiptCount);
    default:
      return '';
  }
}

export default function TaxCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const { projects, refreshProjects } = useProjectList();
  const refreshProjectsRef = useRef(refreshProjects);
  refreshProjectsRef.current = refreshProjects;

  /** Re-merge `bps.timeline.v2.*` (payment milestones marked collected) before tax math — same session as Project detail. */
  useFocusEffect(
    useCallback(() => {
      void refreshProjectsRef.current();
    }, [])
  );
  const { vendors, quickBooksCategoryMap, addVendor } = useVendorDirectory();
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => getTaxYearOptions(projects, currentYear), [projects, currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [exportingType, setExportingType] = useState<
    'pdf' | 'receipts' | 'workbook' | 'cpa1099' | null
  >(null);
  const [taxBreakdownExpanded, setTaxBreakdownExpanded] = useState(false);
  const [vendorReviewExpanded, setVendorReviewExpanded] = useState(false);
  const [detailKind, setDetailKind] = useState<TaxCenterDetailKind | null>(null);

  const yearRange = useMemo(() => getTaxYearRange(selectedYear), [selectedYear]);
  const summary = useMemo(
    () => computeTaxCenterSummary(projects, [], [], [], selectedYear, vendors),
    [projects, selectedYear, vendors]
  );
  const yearExpenses = useMemo(() => getYearExpenses(projects, selectedYear), [projects, selectedYear]);
  const categoryRows = useMemo(
    () =>
      groupExpensesByTaxCategory(yearExpenses, (cat) => {
        const raw = quickBooksCategoryMap[cat];
        return typeof raw === 'string' ? raw.trim() : '';
      }),
    [yearExpenses, quickBooksCategoryMap]
  );
  const projectSummaries = useMemo(
    () => buildProjectTaxSummaries(projects, selectedYear),
    [projects, selectedYear]
  );
  const subcontractors = useMemo(
    () => buildSubcontractorPaymentSummary(yearExpenses, selectedYear, vendors),
    [yearExpenses, selectedYear, vendors]
  );
  const subcontractorPaymentsTotal = useMemo(
    () => subcontractors.reduce((sum, v) => sum + (Number(v.totalPaid) || 0), 0),
    [subcontractors]
  );

  const taxInputs = useMemo(() => getTaxCenterDataInputs(projects), [projects]);
  const revenueDetailPayments = useMemo(
    () => getRevenueCollectedDetailPayments(projects, selectedYear, taxInputs.payments),
    [projects, selectedYear, taxInputs.payments]
  );
  const revenueCustomerByProjectId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of projects) {
      const id = String(p?.id || '').trim();
      if (id) m[id] = customerNameFromProject(p);
    }
    return m;
  }, [projects]);
  const arDetailRows = useMemo(
    () => getOutstandingReceivablesDetailRows(projects, selectedYear),
    [projects, selectedYear]
  );
  const committedDetailRows = useMemo(
    () => getCommittedCostsDetailRows(projects, selectedYear),
    [projects, selectedYear]
  );
  const receiptDetailRows = useMemo(
    () => getReceiptCountDetailRows(projects, selectedYear),
    [projects, selectedYear]
  );
  const subcontractorExpenseRows = useMemo(
    () => yearExpenses.filter((e) => expenseCountsTowardSubcontractorPayments(e, vendors)),
    [yearExpenses, vendors]
  );
  const taxBucketAnomalies = useMemo(
    () => getTaxCenterYearBucketAnomalies(projects, selectedYear),
    [projects, selectedYear]
  );
  const review1099 = useMemo(
    () =>
      build1099ReviewSummary({
        vendors,
        expenses: yearExpenses,
        payments: taxInputs.payments,
        selectedYear,
      }),
    [vendors, yearExpenses, taxInputs.payments, selectedYear]
  );

  const yearCollectedPayments = useMemo(
    () => getYearCollectedPayments(projects, selectedYear),
    [projects, selectedYear]
  );

  const readiness = useMemo(
    () =>
      computeTaxCenterReadiness({
        summary,
        categoryRows,
        yearExpenses,
        review1099,
        anomalies: taxBucketAnomalies,
      }),
    [summary, categoryRows, yearExpenses, review1099, taxBucketAnomalies]
  );

  const aiInsightLines = useMemo(
    () => buildRuleBasedTaxInsights(summary, categoryRows, subcontractors),
    [summary, categoryRows, subcontractors]
  );

  const exportPayload = useMemo(
    () =>
      buildTaxSummaryExportPayload({
        selectedYear,
        summary,
        expenseCategories: categoryRows,
        quickBooksCategoryMap,
        projectSummaries,
        subcontractorSummary: subcontractors,
        aiTaxInsight: aiInsightLines,
        projects,
        yearExpenses,
        yearCollectedPayments,
        vendors,
      }),
    [
      selectedYear,
      summary,
      categoryRows,
      quickBooksCategoryMap,
      projectSummaries,
      subcontractors,
      aiInsightLines,
      projects,
      yearExpenses,
      yearCollectedPayments,
      vendors,
    ]
  );

  const busy = exportingType !== null;

  const handlePdfExport = async () => {
    if (busy) return;
    setExportingType('pdf');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const payload = await withContractorExportMetaOnPayload(exportPayload);
      const uri = await generateTaxSummaryPdf(payload);
      if (uri != null) {
        await shareExportUri(uri, 'application/pdf');
      }
      Alert.alert(
        exportDialogTitle('pdf'),
        Platform.OS === 'web'
          ? 'Your CPA summary PDF download should start in your browser.'
          : 'Your CPA summary PDF is ready to share.'
      );
    } catch (err) {
      console.error('Tax PDF export', err);
      Alert.alert(exportDialogTitle('pdf'), mapExportFailureMessage(err, 'pdf'));
    } finally {
      setExportingType(null);
    }
  };

  const handleReceiptManifestExport = async () => {
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (exportPayload.receipts.length === 0) {
      Alert.alert('Export Receipt Backup', 'No receipt-backed expense lines were found for this tax year.');
      return;
    }
    setExportingType('receipts');
    try {
      const payload = await withContractorExportMetaOnPayload(exportPayload);
      const b64 = generateReceiptManifestXlsxBase64({ payload });
      const filename = `BPS_Receipt_Backup_Manifest_${selectedYear}.xlsx`;
      if (Platform.OS === 'web') {
        triggerBrowserFileDownload(
          filename,
          decodeBase64ToUint8Array(b64),
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      } else {
        const path = await writeBase64ToCacheFile(b64, filename);
        await shareExportUri(path, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }
      Alert.alert(
        'Export Receipt Backup',
        Platform.OS === 'web'
          ? 'Your receipt backup manifest download should start in your browser.'
          : 'Your styled receipt backup manifest is ready to share.'
      );
    } catch (err) {
      console.error('Tax receipt manifest export', err);
      Alert.alert(exportDialogTitle('receipt'), mapExportFailureMessage(err, 'receipt'));
    } finally {
      setExportingType(null);
    }
  };

  const handleAccountantWorkbookExport = async () => {
    if (busy) return;
    setExportingType('workbook');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const payload = await withContractorExportMetaOnPayload(exportPayload);
      const b64 = generateAccountantWorkbookBase64({
        payload,
        review: review1099,
        quickBooksCategoryMap,
      });
      const filename = `BPS_Accountant_Workbook_${selectedYear}.xlsx`;
      if (Platform.OS === 'web') {
        triggerBrowserFileDownload(
          filename,
          decodeBase64ToUint8Array(b64),
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      } else {
        const path = await writeBase64ToCacheFile(b64, filename);
        await shareExportUri(path, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }
      Alert.alert(
        'Accountant Workbook',
        Platform.OS === 'web'
          ? 'Your workbook download should start in your browser.'
          : 'Your workbook is ready to share.'
      );
    } catch (err) {
      console.error('Accountant workbook export', err);
      Alert.alert('Accountant Workbook', mapExportFailureMessage(err, 'workbook'));
    } finally {
      setExportingType(null);
    }
  };

  const handleCpaVendorReviewExport = async () => {
    if (busy) return;
    setExportingType('cpa1099');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const payload = await withContractorExportMetaOnPayload(exportPayload);
      const b64 = generateCpaVendorReviewXlsxBase64({
        payload,
        review: review1099,
        vendors,
      });
      const filename = `BPS_CPA_Vendor_Review_${selectedYear}.xlsx`;
      if (Platform.OS === 'web') {
        triggerBrowserFileDownload(
          filename,
          decodeBase64ToUint8Array(b64),
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
      } else {
        const path = await writeBase64ToCacheFile(b64, filename);
        await shareExportUri(path, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }
      Alert.alert(
        'CPA vendor review',
        Platform.OS === 'web'
          ? 'Your vendor review download should start in your browser.'
          : 'Your styled vendor review spreadsheet is ready to share.'
      );
    } catch (err) {
      console.error('CPA vendor review export', err);
      Alert.alert('CPA vendor review', mapExportFailureMessage(err, 'cpa1099'));
    } finally {
      setExportingType(null);
    }
  };

  return (
    <View style={styles.screenRoot}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <View
          style={[
            styles.pageShell,
            Platform.OS === 'web' && styles.pageShellWeb,
            Platform.OS === 'web' && {
              paddingTop: Math.max(insets.top, 12) + 14,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={styles.backButtonWrapper}>
            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.backButtonBorder}
            >
              <GradientRingBackInner
                darkMode={darkMode}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.back();
                }}
                style={[
                  styles.backButtonInner,
                  { backgroundColor: darkMode ? Colors.card : Colors.bg },
                ]}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={24}
                  color={darkMode ? '#FFFFFF' : '#000000'}
                />
              </GradientRingBackInner>
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>TAX-READY REPORT</Text>
            <Text style={styles.title}>Tax Center</Text>
            <Text style={styles.headerSubtitle}>
              CPA-ready summaries, receipt backup, and vendor review from your project data.
            </Text>
            <Text style={styles.headerHelper}>
              Prepare clean year-end reports from your project income, expenses, receipts, vendors, and project
              summaries.
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <TaxGradientFrame innerStyle={styles.readinessFrameInner}>
            <Text style={styles.readinessTitle}>Tax Center Readiness</Text>
            <Text style={styles.readinessSub}>
              Review missing items before sending reports to your CPA or entering totals into tax software.
            </Text>
            <View style={styles.readinessStatusRow}>
              <MaterialIcons
                name={readiness.allReady ? 'check-circle' : 'warning-amber'}
                size={28}
                color={readiness.allReady ? '#4ADE80' : '#FBBF24'}
              />
              <View style={styles.readinessStatusText}>
                <Text style={styles.readinessHeadline}>
                  {readiness.allReady ? 'Tax Center Ready' : 'Needs review'}
                </Text>
                <Text style={styles.readinessBlurb}>
                  {readiness.allReady
                    ? 'Your year-end report is ready for review and export.'
                    : readiness.missingSummaryLines.join('\n') || 'Complete the checklist below before exporting.'}
                </Text>
              </View>
            </View>
            <View style={styles.checklistBox}>
              {readiness.checklist.map((row) => {
                const tone = checklistRowTone(row, readiness.revenueNeedsAttention);
                const iconName =
                  tone === 'done'
                    ? 'check-circle'
                    : tone === 'attention'
                      ? 'warning-amber'
                      : 'radio-button-unchecked';
                const iconColor =
                  tone === 'done'
                    ? '#4ADE80'
                    : tone === 'attention'
                      ? '#FBBF24'
                      : 'rgba(148, 163, 184, 0.65)';
                const labelStyle =
                  tone === 'done'
                    ? styles.checklistLabel
                    : tone === 'attention'
                      ? [styles.checklistLabel, styles.checklistLabelAttention]
                      : [styles.checklistLabel, styles.checklistLabelPendingGray];
                return (
                  <View key={row.id} style={styles.checklistRow}>
                    <MaterialIcons name={iconName} size={20} color={iconColor} />
                    <Text style={labelStyle}>{row.label}</Text>
                  </View>
                );
              })}
            </View>
          </TaxGradientFrame>

          <TaxGradientFrame innerStyle={styles.beforeExportFrameInner}>
            <Text style={styles.beforeExportTitle}>Before You Export</Text>
            <Pressable
              style={styles.missingDataRow}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/(tabs)/projects');
              }}
            >
              <Text style={styles.missingDataLabel}>Missing receipts</Text>
              <View style={styles.missingDataRight}>
                {readiness.missingReceipts === 0 ? (
                  <MaterialIcons name="check-circle" size={20} color="#4ADE80" />
                ) : (
                  <Text style={styles.missingDataCount}>{readiness.missingReceipts}</Text>
                )}
              </View>
            </Pressable>
            {ACCOUNTING_CATEGORY_MAPPING_ENABLED ? (
              <Pressable
                style={styles.missingDataRow}
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push('/tax-quickbooks-mapping');
                }}
              >
                <Text style={styles.missingDataLabel}>Unmapped categories</Text>
                <View style={styles.missingDataRight}>
                  {readiness.unmappedCategories === 0 ? (
                    <MaterialIcons name="check-circle" size={20} color="#4ADE80" />
                  ) : (
                    <Text style={styles.missingDataCount}>{readiness.unmappedCategories}</Text>
                  )}
                </View>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.missingDataRow}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/tax-vendors');
              }}
            >
              <Text style={styles.missingDataLabel}>Vendors missing W-9 status</Text>
              <View style={styles.missingDataRight}>
                {readiness.missingW9 === 0 ? (
                  <MaterialIcons name="check-circle" size={20} color="#4ADE80" />
                ) : (
                  <Text style={styles.missingDataCount}>{readiness.missingW9}</Text>
                )}
              </View>
            </Pressable>
            <Pressable
              style={styles.missingDataRow}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/tax-vendors');
              }}
            >
              <Text style={styles.missingDataLabel}>Vendors missing payment method</Text>
              <View style={styles.missingDataRight}>
                {readiness.missingPaymentMethod === 0 ? (
                  <MaterialIcons name="check-circle" size={20} color="#4ADE80" />
                ) : (
                  <Text style={styles.missingDataCount}>{readiness.missingPaymentMethod}</Text>
                )}
              </View>
            </Pressable>
            <View style={styles.missingDataRow}>
              <Text style={styles.missingDataLabel}>Potential 1099 review</Text>
              <View style={styles.missingDataRight}>
                {readiness.potential1099Review === 0 ? (
                  <MaterialIcons name="check-circle" size={20} color="#4ADE80" />
                ) : (
                  <Text style={styles.missingDataCount}>{readiness.potential1099Review}</Text>
                )}
              </View>
            </View>
          </TaxGradientFrame>

          <TaxGradientFrame innerStyle={styles.frameIntroInner}>
            <View style={styles.heroIcon}>
              <MaterialIcons name="request-quote" size={26} color="#2DFFC4" />
            </View>
            <Text style={styles.heroTitle}>Project-first job costing with tax-ready exports</Text>
            <Text style={styles.heroText}>
              Track project income, expenses, receipts, and vendors. Export CPA-ready PDFs, the accountant workbook,
              vendor and receipt spreadsheets — then review totals with your CPA or enter them into tax software.
            </Text>
            <Text style={styles.rangeText}>
              {yearRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
              {yearRange.end.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>

            <Text style={styles.taxCenterDisclaimer}>
              Tax Center uses project activity dated within the selected tax year. Active projects are included only
              for payments collected, expenses paid, invoices, receipts, and vendor activity recorded in that year.
              Pending receivables and committed costs are shown for review but may not be counted as taxable income or
              deductible expenses until collected or paid, depending on your accounting method.
            </Text>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tax year</Text>
              <Text style={styles.sectionHint}>Defaulted to current year · Jan 1 – Dec 31</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearRow}>
              {yearOptions.map((year) => {
                const active = year === selectedYear;
                return (
                  <Pressable
                    key={year}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedYear(year);
                    }}
                    style={[styles.yearPill, active && styles.yearPillActive]}
                    disabled={busy}
                  >
                    <Text style={[styles.yearText, active && styles.yearTextActive]}>{year}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tax basis</Text>
            </View>
            <View style={styles.basisRow}>
              <View style={[styles.basisPill, styles.basisPillActive]}>
                <Text style={styles.basisPillTextActive}>Cash Basis</Text>
              </View>
              <View style={[styles.basisPill, styles.basisPillDisabled]} accessibilityState={{ disabled: true }}>
                <Text style={styles.basisPillTextMuted}>Accrual / Invoice</Text>
              </View>
            </View>
            <Text style={styles.basisFootnote}>
              Tax year: Jan 1 – Dec 31. Cash Basis is recommended for most small contractors. Accrual / Invoice Basis
              coming soon.
            </Text>

            <View style={styles.summaryGrid}>
              <TaxSummaryCard
                label="Revenue Collected"
                value={money(summary.grossIncomeCollected)}
                icon="payments"
                helper="Payments actually collected during the selected tax year."
                onPress={() => {
                  Haptics.selectionAsync();
                  setDetailKind('revenue');
                }}
              />
              <TaxSummaryCard
                label="Outstanding Receivables"
                value={money(summary.outstandingReceivables)}
                icon="account-balance-wallet"
                helper="Unpaid invoices or scheduled payments tied to the selected tax year. Not counted as cash-basis income until collected."
                onPress={() => {
                  Haptics.selectionAsync();
                  setDetailKind('ar');
                }}
              />
              <TaxSummaryCard
                label="Expenses Paid"
                value={money(summary.totalExpenses)}
                icon="receipt-long"
                helper="Expenses and received/paid purchase orders dated within the selected tax year."
                onPress={() => {
                  Haptics.selectionAsync();
                  setDetailKind('expenses');
                }}
              />
              <TaxSummaryCard
                label="Committed Costs"
                value={money(summary.committedCosts)}
                icon="inventory"
                helper="Pending purchase orders and committed costs not yet paid or received. Shown for review only."
                onPress={() => {
                  Haptics.selectionAsync();
                  setDetailKind('committed');
                }}
              />
              <TaxSummaryCard
                label="Net Income"
                value={money(summary.netProfit)}
                icon="trending-up"
                accent={summary.netProfit >= 0 ? '#2DFFC4' : '#FCA5A5'}
                helper="Revenue collected minus expenses paid for the selected tax year."
                onPress={() => {
                  Haptics.selectionAsync();
                  setDetailKind('netIncome');
                }}
              />
              <TaxSummaryCard
                label="Net Margin"
                value={percent(summary.netMargin)}
                icon="percent"
                helper="Cash-basis net income divided by revenue collected."
                onPress={() => {
                  Haptics.selectionAsync();
                  setDetailKind('netMargin');
                }}
              />
              <TaxSummaryCard
                label="Subcontractor Payments"
                value={money(summary.subcontractorPayments)}
                icon="groups"
                helper="Subcontractor payments made during the selected tax year."
                onPress={() => {
                  Haptics.selectionAsync();
                  setDetailKind('subcontractor');
                }}
              />
              <TaxSummaryCard
                label="Receipt Count"
                value={String(summary.receiptCount)}
                icon="fact-check"
                helper="Receipts attached to expenses dated within the selected tax year."
                onPress={() => {
                  Haptics.selectionAsync();
                  setDetailKind('receipts');
                }}
              />
            </View>
            {summary.committedCosts > 0 ? (
              <Text style={styles.summaryReconcileNote}>
                Expenses Paid ({money(summary.totalExpenses)}) plus Committed costs ({money(summary.committedCosts)}) ={' '}
                {money(summary.totalExpenses + summary.committedCosts)} total recorded job spend for {selectedYear}. Net
                income uses Expenses Paid only. Confirm PO and cash-basis treatment with your CPA.
              </Text>
            ) : null}
          </TaxGradientFrame>

          <TaxGradientFrame innerStyle={styles.collapseFrameInner}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setTaxBreakdownExpanded((e) => !e);
              }}
            >
              <View style={styles.collapseHeader}>
                <View style={styles.collapseHeaderMain}>
                  <Text style={styles.collapseCardTitle}>Tax Breakdown</Text>
                  <Text style={styles.collapseCardSub}>
                    Expense categories, project summaries, and subcontractor payment review.
                  </Text>
                  {!taxBreakdownExpanded ? (
                    <View style={styles.collapsePreview}>
                      <Text style={styles.collapsePreviewLine}>Expense categories: {categoryRows.length}</Text>
                      <Text style={styles.collapsePreviewLine}>Projects: {projectSummaries.length}</Text>
                      <Text style={styles.collapsePreviewLine}>
                        Subcontractor payments: {money(subcontractorPaymentsTotal)}
                      </Text>
                      <Text style={styles.collapseCta}>View Tax Breakdown</Text>
                    </View>
                  ) : null}
                </View>
                <MaterialIcons
                  name={taxBreakdownExpanded ? 'expand-less' : 'expand-more'}
                  size={28}
                  color="#2DFFC4"
                  style={styles.collapseChevron}
                />
              </View>
            </Pressable>

            {taxBreakdownExpanded ? (
              <View style={styles.collapseExpandedStack}>
                <TaxCategoryBreakdown rows={categoryRows} formatMoney={money} />
                <ProjectTaxSummaryList projects={projectSummaries} formatMoney={money} formatPercent={percent} />
                <SubcontractorTaxReport vendors={subcontractors} formatMoney={money} />
              </View>
            ) : null}
          </TaxGradientFrame>

          <TaxGradientFrame innerStyle={styles.collapseFrameInner}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setVendorReviewExpanded((e) => !e);
              }}
            >
              <View style={styles.collapseHeader}>
                <View style={styles.collapseHeaderMain}>
                  <Text style={styles.collapseCardTitle}>Vendor & 1099 Review</Text>
                  <Text style={styles.collapseCardSub}>
                    Review vendors, W-9 tracking, payment methods, and potential year-end filing flags.
                  </Text>
                  {!vendorReviewExpanded ? (
                    <View style={styles.collapsePreview}>
                      <Text style={styles.collapsePreviewLine}>
                        Potential 1099 review: {review1099.potential1099VendorCount}
                      </Text>
                      <Text style={styles.collapsePreviewLine}>Missing W-9s: {review1099.missingW9Count}</Text>
                      <Text style={styles.collapsePreviewLine}>
                        Missing payment method: {review1099.paymentsMissingMethodCount}
                      </Text>
                      <Text style={styles.collapseCta}>Review Vendors</Text>
                    </View>
                  ) : null}
                </View>
                <MaterialIcons
                  name={vendorReviewExpanded ? 'expand-less' : 'expand-more'}
                  size={28}
                  color="#2DFFC4"
                  style={styles.collapseChevron}
                />
              </View>
            </Pressable>

            {vendorReviewExpanded ? (
              <>
                <View style={styles.vendorExplainerCard}>
                  <Text style={styles.vendorExplainerTitle}>How vendor review works</Text>
                  <Text style={styles.vendorExplainerBody}>
                    BPS detects vendors from your paid expenses and purchase orders. Save vendors you want to track,
                    then confirm whether they are suppliers, subcontractors, consultants, or other vendors. W-9
                    tracking is mainly for subcontractors, consultants, and vendors your CPA wants reviewed.
                  </Text>
                  <Text style={styles.vendorExplainerFooter}>
                    Informational only. Not tax advice. Review with your CPA or tax professional.
                  </Text>
                </View>
                <Tax1099ReviewDashboard
                  omitSectionTitle
                  review={review1099}
                  onPressVendor={(row) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (row.vendorId) router.push(`/tax-vendor/${row.vendorId}`);
                  }}
                  onSaveVendor={(row) => {
                    if (!row.saveDraft) return;
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    const v = addVendor({
                      businessName: row.saveDraft.businessName,
                      vendorType: row.saveDraft.vendorType,
                      defaultCategory: row.saveDraft.defaultCategory,
                      defaultPaymentMethod: row.saveDraft.defaultPaymentMethod,
                      w9Status: row.saveDraft.w9Status,
                      notes: row.saveDraft.notes,
                      requires1099Review: false,
                    });
                    router.push(`/tax-vendor/${v.id}`);
                  }}
                  onEditVendorProfile={(row) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (row.vendorId) router.push(`/tax-vendor/${row.vendorId}`);
                  }}
                />
              </>
            ) : null}
          </TaxGradientFrame>

          <TaxGradientFrame innerStyle={styles.framePanelInner}>
            <Text style={styles.exportTitle}>Vendor & Accounting Prep</Text>
            <ExportButton
              icon="business"
              title="Vendors & W-9 Tracking"
              disabled={busy}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/tax-vendors');
              }}
              showTopDivider={false}
            />
            <View style={[styles.exportButton, styles.exportButtonNoTopRule]}>
              <View style={[styles.exportIcon, styles.exportIconMuted]}>
                <MaterialIcons name="sync-alt" size={19} color="rgba(148, 163, 184, 0.75)" />
              </View>
              <View style={styles.comingSoonCol}>
                <View style={styles.comingSoonTitleRow}>
                  <Text style={styles.exportButtonText}>Accounting Category Mapping</Text>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonBadgeText}>Coming soon</Text>
                  </View>
                </View>
                <Text style={styles.comingSoonDesc}>
                  Map BPS categories to accounting or QuickBooks-style categories in a future update.
                </Text>
              </View>
            </View>
            <Text style={styles.qbPrepNote}>
              QuickBooks integration is coming later. For now, use CPA-ready exports, the accountant workbook, receipt
              backup, vendor review, and year-end summaries from your project data.
            </Text>
          </TaxGradientFrame>

          <TaxGradientFrame innerStyle={styles.framePanelInner}>
            <Text style={styles.exportTitle}>Exports for your CPA</Text>
            <View style={styles.exportDisclaimerMini}>
              <Text style={styles.exportDisclaimerMiniText}>
                Tax Center reports are for bookkeeping and tax-preparation support only. They are not tax advice, do not
                replace a CPA or tax professional, and are not official tax filings or official 1099 forms. Verify all
                amounts, categories, receipts, vendors, and tax treatment before filing.
              </Text>
            </View>
            {busy ? (
              <Text style={styles.exportBusyText}>{exportGeneratingLine(exportingType)}</Text>
            ) : null}

            <Pressable
              style={[styles.recommendedExportCard, busy && styles.exportButtonDisabled]}
              onPress={handleAccountantWorkbookExport}
              disabled={busy}
            >
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedBadgeText}>RECOMMENDED FOR CPA</Text>
              </View>
              <View style={styles.recommendedRow}>
                <View style={styles.recommendedIconWrap}>
                  <MaterialIcons name="grid-on" size={22} color="#2DFFC4" />
                </View>
                <View style={styles.recommendedTextCol}>
                  <Text style={styles.recommendedTitle}>Export Accountant Workbook</Text>
                  <Text style={styles.recommendedDesc}>
                    {ACCOUNTING_CATEGORY_MAPPING_ENABLED
                      ? 'Best for CPA review. Includes transaction-level detail, project summaries, category mapping, vendor review, and receipt tracking.'
                      : 'Best for CPA review. Includes transaction-level detail, project summaries, revenue, expenses, vendors, 1099 review, and receipt tracking.'}
                  </Text>
                  <Text style={styles.recommendedHint}>
                    {ACCOUNTING_CATEGORY_MAPPING_ENABLED
                      ? 'Includes summary, projects, expenses, revenue, vendors, 1099 review, receipts, and accounting category mappings.'
                      : 'Includes summary, projects, expenses, revenue, vendors, 1099 review, receipts, and export notes.'}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="rgba(15, 23, 42, 0.55)" />
              </View>
            </Pressable>

            <ExportButton
              icon="picture-as-pdf"
              title="Download CPA Summary PDF"
              disabled={busy}
              onPress={handlePdfExport}
              showTopDivider={false}
            />
            <Text style={styles.exportRowHint}>Polished summary report for your records or CPA.</Text>
            <ExportButton
              icon="assignment-ind"
              title="Export CPA vendor review (spreadsheet)"
              disabled={busy}
              onPress={handleCpaVendorReviewExport}
            />
            <Text style={styles.exportRowHint}>
              Informational vendor list for CPA review — not official 1099 forms. Uses Potential 1099 review language
              only.
            </Text>
            <ExportButton
              icon="folder-zip"
              title="Export Receipt Backup Manifest"
              disabled={busy}
              onPress={handleReceiptManifestExport}
            />
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/legal-hub?tab=tax');
              }}
              style={styles.exportDisclosureLink}
              hitSlop={12}
            >
              <Text style={styles.exportDisclosureText}>
                By using Tax Center exports, you agree to the Tax Center Disclosure in Legal & Disclosures.
              </Text>
            </Pressable>
          </TaxGradientFrame>

          <TaxGradientFrame innerStyle={[styles.aiInsightDisclaimerInner, styles.aiFrameInnerNoClip]}>
            <Text style={[styles.exportTitle, styles.exportTitleInInsightFrame]}>AI Tax Insight</Text>
            {aiInsightLines.map((line, idx) => (
              <Text key={idx} style={styles.aiLine}>
                • {line}
              </Text>
            ))}
            <Text style={styles.aiInsightLegal}>
              Rules-based insight. Not tax advice. Review with your CPA or tax professional.
            </Text>
            <View style={styles.disclaimer}>
              <MaterialIcons name="info-outline" size={18} color="#FBBF24" />
              <Text style={styles.disclaimerText}>
                Tax Center reports are for bookkeeping and tax-preparation support only. They are not tax advice, do
                not replace a CPA or tax professional, and are not official tax filings or official 1099 forms. Verify
                all amounts, categories, receipts, vendors, and tax treatment before filing.
              </Text>
            </View>
          </TaxGradientFrame>
        </ScrollView>
        </View>
      </SafeAreaView>
      <TaxCenterSummaryDetailModal
        visible={detailKind != null}
        onClose={() => setDetailKind(null)}
        kind={detailKind ?? 'revenue'}
        title={detailKind ? taxCenterDetailTitle(detailKind) : 'Detail'}
        summaryCardValue={
          detailKind ? taxCenterDetailSummaryCardValue(detailKind, summary) : ''
        }
        selectedYear={selectedYear}
        summary={summary}
        revenuePayments={revenueDetailPayments}
        revenueCustomerByProjectId={revenueCustomerByProjectId}
        arRows={arDetailRows}
        expenseRows={yearExpenses}
        committedRows={committedDetailRows}
        subcontractorExpenseRows={subcontractorExpenseRows}
        receiptRows={receiptDetailRows}
        vendors={vendors}
        review1099={review1099}
        formatMoney={money}
      />
    </View>
  );
}

function ExportButton({
  icon,
  title,
  onPress,
  disabled,
  showTopDivider = true,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  onPress: () => void;
  disabled?: boolean;
  showTopDivider?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.exportButton,
        !showTopDivider && styles.exportButtonNoTopRule,
        disabled && styles.exportButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.exportIcon}>
        <MaterialIcons name={icon} size={19} color="#2DFFC4" />
      </View>
      <Text style={styles.exportButtonText}>{title}</Text>
      <MaterialIcons name="chevron-right" size={20} color="rgba(148, 163, 184, 0.75)" />
    </Pressable>
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
  /** Shared horizontal inset + web max-width column (header + body align). */
  pageShell: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 8,
  },
  pageShellWeb: {
    maxWidth: TAX_CENTER_WEB_MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  frameIntroInner: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
  },
  collapseFrameInner: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  collapseHeaderMain: {
    flex: 1,
    minWidth: 0,
  },
  collapseCardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  collapseCardSub: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  collapsePreview: {
    marginTop: 10,
  },
  collapsePreviewLine: {
    color: 'rgba(203, 213, 225, 0.88)',
    fontSize: 12,
    lineHeight: 20,
    marginTop: 6,
  },
  collapseCta: {
    color: '#2DFFC4',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 12,
  },
  collapseChevron: {
    marginTop: 2,
  },
  collapseExpandedStack: {
    marginTop: 12,
  },
  vendorExplainerCard: {
    backgroundColor: 'rgba(45, 255, 196, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.22)',
    padding: 14,
    marginBottom: 16,
  },
  vendorExplainerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  vendorExplainerBody: {
    color: 'rgba(203, 213, 225, 0.92)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  vendorExplainerFooter: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  framePanelInner: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  /** Single gradient frame for AI insight + bookkeeping disclaimer */
  aiInsightDisclaimerInner: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 28,
  },
  /** Per-frame override so disclaimer text is not clipped by the gradient inner mask. */
  aiFrameInnerNoClip: {
    overflow: 'visible' as const,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  backButtonWrapper: {
    marginRight: 12,
  },
  backButtonBorder: {
    width: 42,
    height: 42,
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden',
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kicker: {
    color: '#2DFFC4',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 2,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 48,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45, 255, 196, 0.12)',
    marginBottom: 14,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  heroText: {
    color: 'rgba(203, 213, 225, 0.88)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  rangeText: {
    color: '#2DFFC4',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  sectionHint: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 12,
  },
  yearRow: {
    gap: 10,
    paddingRight: 8,
    marginBottom: 4,
  },
  yearPill: {
    borderRadius: 99,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  yearPillActive: {
    backgroundColor: 'rgba(45, 255, 196, 0.14)',
    borderColor: 'rgba(45, 255, 196, 0.65)',
  },
  yearText: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 14,
    fontWeight: '800',
  },
  yearTextActive: {
    color: '#FFFFFF',
  },
  taxCenterDisclaimer: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    marginBottom: 4,
  },
  basisRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  basisPill: {
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  basisPillActive: {
    backgroundColor: 'rgba(45, 255, 196, 0.14)',
    borderColor: 'rgba(45, 255, 196, 0.65)',
  },
  basisPillDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    opacity: 0.55,
  },
  basisPillTextActive: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  basisPillTextMuted: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 13,
    fontWeight: '700',
  },
  basisFootnote: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    marginBottom: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  summaryReconcileNote: {
    marginTop: 14,
    paddingHorizontal: 4,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(148, 163, 184, 0.95)',
    fontWeight: '500',
  },
  exportTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  /** AI + disclaimer share one gradient inner; avoid double horizontal padding */
  exportTitleInInsightFrame: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  exportBusyText: {
    color: '#7FDAC5',
    fontSize: 12,
    marginTop: -6,
    marginBottom: 8,
    fontWeight: '700',
    paddingHorizontal: 14,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  exportButtonNoTopRule: {
    borderTopWidth: 0,
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45, 255, 196, 0.1)',
  },
  exportIconMuted: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  comingSoonCol: {
    flex: 1,
    minWidth: 0,
  },
  comingSoonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  comingSoonBadgeText: {
    color: 'rgba(203, 213, 225, 0.92)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  comingSoonDesc: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  exportDisclosureLink: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
  },
  exportDisclosureText: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 11,
    lineHeight: 17,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(45, 255, 196, 0.45)',
  },
  exportWorkbookHint: {
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 14,
    paddingBottom: 10,
    marginTop: -4,
  },
  aiLine: {
    color: 'rgba(203, 213, 225, 0.88)',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    paddingBottom: 4,
  },
  aiInsightLegal: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 18,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.20)',
  },
  headerSubtitle: {
    color: 'rgba(203, 213, 225, 0.92)',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: 8,
  },
  headerHelper: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  readinessFrameInner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  readinessTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  readinessSub: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 12,
  },
  readinessStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  readinessStatusText: {
    flex: 1,
  },
  readinessHeadline: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  readinessBlurb: {
    color: 'rgba(203, 213, 225, 0.9)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  checklistBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
    gap: 8,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checklistLabel: {
    color: 'rgba(203, 213, 225, 0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  checklistLabelPendingGray: {
    color: 'rgba(148, 163, 184, 0.82)',
  },
  checklistLabelAttention: {
    color: 'rgba(253, 224, 71, 0.92)',
  },
  beforeExportFrameInner: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  beforeExportTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 10,
  },
  missingDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  missingDataLabel: {
    color: 'rgba(203, 213, 225, 0.92)',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  missingDataRight: {
    minWidth: 28,
    alignItems: 'flex-end',
  },
  missingDataCount: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '800',
  },
  qbPrepNote: {
    color: 'rgba(148, 163, 184, 0.78)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 2,
  },
  exportDisclaimerMini: {
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  exportDisclaimerMiniText: {
    color: 'rgba(203, 213, 225, 0.88)',
    fontSize: 11,
    lineHeight: 17,
  },
  recommendedExportCard: {
    marginHorizontal: 14,
    marginBottom: 6,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(45, 255, 196, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(45, 255, 196, 0.35)',
  },
  recommendedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(45, 255, 196, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  recommendedBadgeText: {
    color: '#2DFFC4',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  recommendedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  recommendedIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45, 255, 196, 0.16)',
  },
  recommendedTextCol: {
    flex: 1,
    minWidth: 0,
  },
  recommendedTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  recommendedDesc: {
    color: 'rgba(203, 213, 225, 0.9)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  recommendedHint: {
    color: 'rgba(148, 163, 184, 0.92)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  exportRowHint: {
    color: 'rgba(148, 163, 184, 0.85)',
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 14,
    marginTop: -6,
    marginBottom: 10,
  },
  disclaimerText: {
    color: '#FDE68A',
    fontSize: 12,
    lineHeight: 20,
    flex: 1,
    flexShrink: 1,
    paddingBottom: 6,
  },
});
