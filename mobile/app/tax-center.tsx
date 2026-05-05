import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_FRAME_GRADIENT_COLORS } from "@/constants/brandFrameGradient";
import GradientRingBackInner from '@/components/GradientRingBackInner';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import TaxGradientFrame from '@/src/components/tax/TaxGradientFrame';
import TaxCategoryBreakdown from '@/src/components/tax/TaxCategoryBreakdown';
import ProjectTaxSummaryList from '@/src/components/tax/ProjectTaxSummaryList';
import SubcontractorTaxReport from '@/src/components/tax/SubcontractorTaxReport';
import TaxSummaryCard from '@/src/components/tax/TaxSummaryCard';
import { useProjectList } from '@/contexts/ProjectListContext';
import {
  buildProjectTaxSummaries,
  buildRuleBasedTaxInsights,
  buildSubcontractorPaymentSummary,
  computeTaxCenterSummary,
  getTaxCenterDataInputs,
  getTaxYearOptions,
  getTaxYearRange,
  getYearExpenses,
  groupReceiptsForExport,
  groupExpensesByTaxCategory,
} from '@/src/lib/taxCenter';
import { buildTaxSummaryExportPayload } from '@/src/lib/taxCenterExportPayload';
import {
  generateReceiptManifestCsv,
  generateTaxCenterCsv,
  generateTaxSummaryPdf,
  shareExportUri,
  writeBase64ToCacheFile,
  writeStringToCacheFile,
} from '@/src/lib/taxCenterExport';
import { generateAccountantWorkbookBase64 } from '@/src/lib/accountantWorkbookExport';
import { build1099ReviewSummary } from '@/src/lib/tax1099Review';
import { useVendorDirectory } from '@/contexts/VendorDirectoryContext';
import Tax1099ReviewDashboard from '@/src/components/tax/Tax1099ReviewDashboard';
import { getDocumentContactEmailAsync } from '@/lib/documentContactEmail';
import type { TaxSummaryExportPayload } from '@/src/lib/taxCenterExportPayload';

const money = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const percent = (value: number | null): string => {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return `${Math.round(value * 100)}%`;
};

function exportDialogTitle(kind: 'pdf' | 'csv' | 'receipt'): string {
  if (kind === 'pdf') return 'Year-End Tax Summary PDF';
  if (kind === 'csv') return 'Export CSV';
  return 'Export Receipt Backup';
}

function exportGeneratingLine(type: 'pdf' | 'csv' | 'receipts' | 'workbook' | null): string | null {
  if (type === 'pdf') return 'Generating your tax summary PDF...';
  if (type === 'csv') return 'Generating your tax summary CSV...';
  if (type === 'receipts') return 'Preparing your receipt backup...';
  if (type === 'workbook') return 'Building your accountant workbook...';
  return null;
}

function mapExportFailureMessage(err: unknown, kind: 'pdf' | 'csv' | 'receipt' | 'workbook'): string {
  const m = err instanceof Error ? err.message : String(err);
  if (m === 'SHARING_UNAVAILABLE') return 'Sharing is not available on this device.';
  if (m === 'NO_FILESYSTEM_BASE' || m === 'EXPORT_WRITE_FAILED') return 'Export failed. Please try again.';
  if (kind === 'pdf') return 'PDF export failed. Please try again.';
  if (kind === 'csv') return 'CSV export failed. Please try again.';
  if (kind === 'workbook') return 'Workbook export failed. Please try again.';
  return 'Receipt backup export failed. Please try again.';
}

async function withContractorContactOnPayload(base: TaxSummaryExportPayload): Promise<TaxSummaryExportPayload> {
  const contractorContactEmail = await getDocumentContactEmailAsync();
  return { ...base, contractorContactEmail: contractorContactEmail ?? undefined };
}

export default function TaxCenterScreen() {
  const router = useRouter();
  const { darkMode, theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);
  const { projects } = useProjectList();
  const { vendors, quickBooksCategoryMap, addVendor } = useVendorDirectory();
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => getTaxYearOptions(projects, currentYear), [projects, currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [exportingType, setExportingType] = useState<'pdf' | 'csv' | 'receipts' | 'workbook' | null>(null);
  const [taxBreakdownExpanded, setTaxBreakdownExpanded] = useState(false);
  const [vendorReviewExpanded, setVendorReviewExpanded] = useState(false);

  const yearRange = useMemo(() => getTaxYearRange(selectedYear), [selectedYear]);
  const summary = useMemo(
    () => computeTaxCenterSummary(projects, [], [], [], selectedYear),
    [projects, selectedYear]
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
    () => buildSubcontractorPaymentSummary(yearExpenses, selectedYear),
    [yearExpenses, selectedYear]
  );
  const subcontractorPaymentsTotal = useMemo(
    () => subcontractors.reduce((sum, v) => sum + (Number(v.totalPaid) || 0), 0),
    [subcontractors]
  );

  const taxInputs = useMemo(() => getTaxCenterDataInputs(projects), [projects]);
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

  const receiptExportGroups = useMemo(
    () => groupReceiptsForExport(projects, selectedYear),
    [projects, selectedYear]
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
        receiptGroups: receiptExportGroups,
        aiTaxInsight: aiInsightLines,
      }),
    [
      selectedYear,
      summary,
      categoryRows,
      quickBooksCategoryMap,
      projectSummaries,
      subcontractors,
      receiptExportGroups,
      aiInsightLines,
    ]
  );

  const busy = exportingType !== null;

  const handlePdfExport = async () => {
    if (busy) return;
    setExportingType('pdf');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const payload = await withContractorContactOnPayload(exportPayload);
      const uri = await generateTaxSummaryPdf(payload);
      await shareExportUri(uri, 'application/pdf');
      Alert.alert(exportDialogTitle('pdf'), 'Your Year-End Tax Summary PDF is ready to share.');
    } catch (err) {
      console.error('Tax PDF export', err);
      Alert.alert(exportDialogTitle('pdf'), mapExportFailureMessage(err, 'pdf'));
    } finally {
      setExportingType(null);
    }
  };

  const handleCsvExport = async () => {
    if (busy) return;
    setExportingType('csv');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const payload = await withContractorContactOnPayload(exportPayload);
      const csv = generateTaxCenterCsv(payload);
      const path = await writeStringToCacheFile(csv, `BPS_Year_End_Tax_Summary_${selectedYear}.csv`);
      await shareExportUri(path, 'text/csv');
      Alert.alert(exportDialogTitle('csv'), 'Your Year-End Tax Summary CSV is ready to share.');
    } catch (err) {
      console.error('Tax CSV export', err);
      Alert.alert(exportDialogTitle('csv'), mapExportFailureMessage(err, 'csv'));
    } finally {
      setExportingType(null);
    }
  };

  const handleReceiptManifestExport = async () => {
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (exportPayload.receipts.length === 0) {
      Alert.alert('Export Receipt Backup', 'No receipt lines were found for this tax year.');
      return;
    }
    setExportingType('receipts');
    try {
      const payload = await withContractorContactOnPayload(exportPayload);
      const csv = generateReceiptManifestCsv(payload);
      const path = await writeStringToCacheFile(csv, `BPS_Receipt_Backup_Manifest_${selectedYear}.csv`);
      await shareExportUri(path, 'text/csv');
      Alert.alert('Export Receipt Backup', 'Your Receipt Backup Manifest is ready to share.');
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
      const payload = await withContractorContactOnPayload(exportPayload);
      const b64 = generateAccountantWorkbookBase64({
        payload,
        review: review1099,
        vendors,
        quickBooksCategoryMap,
      });
      const path = await writeBase64ToCacheFile(b64, `BPS_Accountant_Workbook_${selectedYear}.xlsx`);
      await shareExportUri(path, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      Alert.alert('Accountant Workbook', 'Your workbook is ready to share.');
    } catch (err) {
      console.error('Accountant workbook export', err);
      Alert.alert('Accountant Workbook', mapExportFailureMessage(err, 'workbook'));
    } finally {
      setExportingType(null);
    }
  };

  return (
    <View style={styles.screenRoot}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
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
            <Text style={styles.kicker}>Tax-ready report</Text>
            <Text style={styles.title}>Tax Center</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TaxGradientFrame innerStyle={styles.frameIntroInner}>
            <View style={styles.heroIcon}>
              <MaterialIcons name="request-quote" size={26} color="#2DFFC4" />
            </View>
            <Text style={styles.heroTitle}>Year-End Tax Summary</Text>
            <Text style={styles.heroText}>
              Select a tax year and review collected income, actual expenses, project profit, receipts,
              and subcontractor payments before sending reports to your CPA.
            </Text>
            <Text style={styles.rangeText}>
              {yearRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
              {yearRange.end.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tax year</Text>
              <Text style={styles.sectionHint}>Defaulted to current year</Text>
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

            <View style={styles.summaryGrid}>
              <TaxSummaryCard label="Revenue Collected" value={money(summary.grossIncomeCollected)} icon="payments" />
              <TaxSummaryCard
                label="Outstanding Receivables"
                value={money(summary.outstandingReceivables)}
                icon="account-balance-wallet"
              />
              <TaxSummaryCard label="Expenses Paid" value={money(summary.totalExpenses)} icon="receipt-long" />
              <TaxSummaryCard
                label="Committed Costs"
                value={money(summary.committedCosts)}
                icon="inventory"
                helper="Approved purchase orders not yet paid"
              />
              <TaxSummaryCard
                label="Net Income"
                value={money(summary.netProfit)}
                icon="trending-up"
                accent={summary.netProfit >= 0 ? '#2DFFC4' : '#FCA5A5'}
              />
              <TaxSummaryCard
                label="Net Margin"
                value={percent(summary.netMargin)}
                icon="percent"
                helper={summary.netMargin == null ? 'No collected income yet' : undefined}
              />
              <TaxSummaryCard
                label="Subcontractor payments"
                value={money(summary.subcontractorPayments)}
                icon="groups"
              />
              <TaxSummaryCard label="Receipt count" value={String(summary.receiptCount)} icon="fact-check" />
            </View>
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
                    Review vendors, W-9 tracking, payment methods, and year-end CPA flags.
                  </Text>
                  {!vendorReviewExpanded ? (
                    <View style={styles.collapsePreview}>
                      <Text style={styles.collapsePreviewLine}>
                        Potential 1099 vendors: {review1099.potential1099VendorCount}
                      </Text>
                      <Text style={styles.collapsePreviewLine}>Missing W-9s: {review1099.missingW9Count}</Text>
                      <Text style={styles.collapsePreviewLine}>
                        Payments missing method: {review1099.paymentsMissingMethodCount}
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
            <Text style={styles.exportTitle}>Vendor & accounting prep</Text>
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
            <ExportButton
              icon="sync-alt"
              title="Accounting / QuickBooks Mapping"
              disabled={busy}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/tax-quickbooks-mapping');
              }}
            />
          </TaxGradientFrame>

          <TaxGradientFrame innerStyle={styles.framePanelInner}>
            <Text style={styles.exportTitle}>Export options</Text>
            {busy ? (
              <Text style={styles.exportBusyText}>{exportGeneratingLine(exportingType)}</Text>
            ) : null}
            <ExportButton
              icon="picture-as-pdf"
              title="Download Year-End Tax Summary PDF"
              disabled={busy}
              onPress={handlePdfExport}
              showTopDivider={false}
            />
            <ExportButton icon="table-chart" title="Export CSV" disabled={busy} onPress={handleCsvExport} />
            <ExportButton
              icon="folder-zip"
              title="Export Receipt Backup Manifest"
              disabled={busy}
              onPress={handleReceiptManifestExport}
            />
            <ExportButton
              icon="grid-on"
              title="Export Accountant Workbook (XLSX)"
              disabled={busy}
              onPress={handleAccountantWorkbookExport}
            />
            <Text style={styles.exportWorkbookHint}>
              Includes summary, projects, categories, vendor review, missing W-9s, receipts, and accounting mappings.
            </Text>
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
                This report is for bookkeeping and tax-preparation support only. It is not tax advice, does not replace a CPA or tax professional, and is not an official tax filing or official 1099 form. Verify all amounts, categories, receipts, vendor information, and tax treatment with your CPA or tax professional before filing.
              </Text>
            </View>
          </TaxGradientFrame>
        </ScrollView>
      </SafeAreaView>
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
    marginTop: 8,
    marginBottom: 10,
    marginHorizontal: 20,
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
    paddingHorizontal: 8,
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
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
  disclaimerText: {
    color: '#FDE68A',
    fontSize: 12,
    lineHeight: 20,
    flex: 1,
    flexShrink: 1,
    paddingBottom: 6,
  },
});
