import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import type {
  OutstandingReceivableDetailRow,
  ReceiptCountDetailRow,
  TaxCenterSummary,
  TaxExpense,
  TaxPayment,
} from '@/src/lib/taxCenter';
import { classifyRevenuePaymentSource } from '@/src/lib/taxCenter';
import type { Vendor } from '@/src/lib/vendorTypes';
import type { Tax1099ReviewSummary } from '@/src/lib/tax1099Review';
import { resolveVendorForExpense } from '@/src/lib/tax1099Review';

export type TaxCenterDetailKind =
  | 'revenue'
  | 'ar'
  | 'expenses'
  | 'committed'
  | 'netIncome'
  | 'netMargin'
  | 'subcontractor'
  | 'receipts';

const FOOTER_NOTE =
  'Detail rows are for review and traceability. Totals follow the current Tax Center logic.';

type Props = {
  visible: boolean;
  onClose: () => void;
  kind: TaxCenterDetailKind;
  title: string;
  /** Same formatted value as the summary card (portfolio totals only; not recomputed in the modal). */
  summaryCardValue: string;
  selectedYear: number;
  /** Portfolio summary totals — used for Net Income / Net Margin and chip totals (no recalculation). */
  summary: TaxCenterSummary;
  revenuePayments: TaxPayment[];
  revenueCustomerByProjectId: Record<string, string>;
  arRows: OutstandingReceivableDetailRow[];
  expenseRows: TaxExpense[];
  committedRows: {
    projectName: string;
    vendor: string;
    poLabel: string;
    committedDate: string;
    amount: number;
    status: string;
    receivedOrPaid: string;
  }[];
  subcontractorExpenseRows: TaxExpense[];
  receiptRows: ReceiptCountDetailRow[];
  vendors: Vendor[];
  review1099: Tax1099ReviewSummary;
  formatMoney: (n: number) => string;
};

function revenueSourceLabel(src: ReturnType<typeof classifyRevenuePaymentSource>): string {
  if (src === 'change_order') return 'Change order';
  if (src === 'base_contract') return 'Base contract';
  return 'Unclassified';
}

function paymentTypeLabel(p: TaxPayment): string {
  const t = String((p as { type?: string }).type || '').trim();
  return t || 'Payment';
}

function isBlankish(raw: string): boolean {
  const s = String(raw || '').trim();
  return !s || s === '—';
}

function displayLabel(raw: string, emptyLabel: string): string {
  return isBlankish(raw) ? emptyLabel : String(raw).trim();
}

function formatDisplayDate(raw: string): { text: string; warn: boolean } {
  const s = String(raw || '').trim();
  if (!s) return { text: 'Missing date', warn: true };
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return { text: 'Missing date', warn: true };
  return {
    text: new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    warn: false,
  };
}

function receivableKindLine(kind: OutstandingReceivableDetailRow['lineKind']): string {
  if (kind === 'invoice') return 'Invoice';
  if (kind === 'change_order') return 'Change order';
  if (kind === 'milestone') return 'Scheduled / milestone';
  return 'Approved change orders (supplement)';
}

function sheetContextLine(kind: TaxCenterDetailKind, selectedYear: number): string {
  if (kind === 'ar' || kind === 'committed') {
    return `Tax Year ${selectedYear} · Informational only`;
  }
  return `Tax Year ${selectedYear} · Cash Basis`;
}

function detailDescription(kind: TaxCenterDetailKind): string {
  if (kind === 'revenue') {
    return 'These rows use the same tax-year filters as the summary cards. Source labels are shown for traceability only and do not change Tax Center math.';
  }
  return 'These rows use the same tax-year filters as the summary cards.';
}

function w9StatusShort(linked: Vendor | undefined): { text: string; warn: boolean } {
  if (!linked) return { text: 'Not added', warn: true };
  const s = linked.w9Status;
  if (s === 'not_applicable') return { text: 'Not needed', warn: false };
  if (s === 'missing') return { text: 'Missing W-9', warn: true };
  if (s === 'requested') return { text: 'W-9 requested', warn: true };
  if (s === 'uploaded' || s === 'verified') return { text: 'Received', warn: false };
  return { text: String(s || 'Not added'), warn: true };
}

function percentFromSummaryMargin(netMargin: number | null | undefined, grossIncomeCollected: number): string {
  if (grossIncomeCollected > 0 && netMargin != null && Number.isFinite(netMargin)) {
    return `${Math.round(netMargin * 100)}%`;
  }
  return 'N/A (no revenue collected in year)';
}

function createStyles(Colors: ReturnType<typeof getColors>, darkMode: boolean) {
  const meta = darkMode ? 'rgba(148, 163, 184, 0.95)' : Colors.sub;
  const meta2 = darkMode ? 'rgba(148, 163, 184, 0.85)' : 'rgba(51, 65, 85, 0.88)';
  const metaSoft = darkMode ? 'rgba(226, 232, 240, 0.88)' : 'rgba(15, 23, 42, 0.78)';
  const chipBg = darkMode ? 'rgba(255,255,255,0.08)' : Colors.surface;
  const chipBorder = darkMode ? 'rgba(255,255,255,0.12)' : Colors.line;
  const rowCardBg = darkMode ? 'rgba(255,255,255,0.06)' : Colors.surface2;
  const rowCardBorder = darkMode ? 'rgba(255,255,255,0.08)' : Colors.line;
  const formulaBg = darkMode ? 'rgba(45,255,196,0.10)' : 'rgba(34, 197, 94, 0.12)';
  const formulaBorder = darkMode ? 'rgba(45,255,196,0.28)' : 'rgba(34, 197, 94, 0.32)';

  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: Colors.overlay,
      justifyContent: 'flex-end',
      alignItems: 'stretch',
    },
    sheetRing: {
      flex: 1,
      minHeight: 0,
      borderRadius: 21,
      padding: 1,
      zIndex: 1,
      elevation: 12,
    },
    sheetInner: {
      flex: 1,
      minHeight: 0,
      backgroundColor: Colors.card,
      borderRadius: 20,
      overflow: 'hidden',
      paddingBottom: 10,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 4,
    },
    sheetTitle: {
      color: Colors.text,
      fontSize: 18,
      fontWeight: '800',
      flex: 1,
      paddingRight: 12,
    },
    cardTotal: {
      color: Colors.text,
      fontSize: 24,
      fontWeight: '800',
      paddingHorizontal: 16,
      marginBottom: 4,
    },
    sheetSub: {
      color: meta,
      fontSize: 12,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    tableHint: {
      color: meta,
      fontSize: 12,
      marginBottom: 10,
      lineHeight: 18,
      paddingHorizontal: 16,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: chipBg,
      borderWidth: 1,
      borderColor: chipBorder,
      maxWidth: '100%',
    },
    chipWarn: {
      backgroundColor: 'rgba(251,191,36,0.12)',
      borderColor: 'rgba(251,191,36,0.38)',
    },
    chipText: {
      color: metaSoft,
      fontSize: 11,
      fontWeight: '600',
    },
    chipTextWarn: {
      color: '#FBBF24',
    },
    scroll: { flex: 1, minHeight: 0 },
    scrollContent: { paddingHorizontal: 12, paddingBottom: 28 },
    rowCard: {
      backgroundColor: rowCardBg,
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: rowCardBorder,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 2,
    },
    rowPrimaryLeft: { color: Colors.text, fontWeight: '700', fontSize: 15, flex: 1 },
    rowPrimaryRight: { color: Colors.text, fontWeight: '800', fontSize: 15 },
    rowMeta: { color: metaSoft, fontSize: 12, lineHeight: 18 },
    rowMetaSub: { color: meta, fontSize: 12, lineHeight: 17, marginTop: 1 },
    rowDetailMuted: {
      color: meta2,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 4,
    },
    metaWarn: { color: '#FBBF24', fontWeight: '700' },
    empty: { color: meta, fontStyle: 'italic', padding: 16 },
    formulaBox: {
      padding: 16,
      backgroundColor: formulaBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: formulaBorder,
    },
    formulaLine: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
    formulaValues: { color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
    formulaFoot: { color: meta, fontSize: 12, lineHeight: 18 },
    footerNote: {
      marginTop: 18,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: Colors.line,
      color: meta,
      fontSize: 11,
      lineHeight: 16,
    },
  });
}

type TaxDetailStyleSheet = ReturnType<typeof createStyles>;

function Chip({ label, warn, styles: s }: { label: string; warn?: boolean; styles: TaxDetailStyleSheet }) {
  return (
    <View style={[s.chip, warn ? s.chipWarn : null]}>
      <Text style={[s.chipText, warn ? s.chipTextWarn : null]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export default function TaxCenterSummaryDetailModal({
  visible,
  onClose,
  kind,
  title,
  summaryCardValue,
  selectedYear,
  summary,
  revenuePayments,
  revenueCustomerByProjectId,
  arRows,
  expenseRows,
  committedRows,
  subcontractorExpenseRows,
  receiptRows,
  vendors,
  review1099,
  formatMoney,
}: Props) {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const styles = useMemo(() => createStyles(Colors, darkMode), [Colors, darkMode]);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  /** Height between top and bottom safe areas — `windowHeight` alone ignores the status bar / home indicator. */
  const safeViewportHeight = Math.max(1, windowHeight - insets.top - insets.bottom);
  /**
   * Generous bottom inset so the gradient ring’s bottom curve + horizontal segment sit fully above
   * the home indicator / display edge (Modal is not always inset by default).
   */
  const backdropBottomPad = Math.max(insets.bottom, 20) + 32;
  const backdropHorizontalPad = Math.max(Math.max(insets.left, insets.right), Platform.OS === 'web' ? 12 : 6);
  /**
   * Fixed cap inside the padded backdrop — keeps the outer LinearGradient from growing past the
   * visible area (which was clipping the bottom border). Slightly conservative % of safe height.
   */
  const sheetMaxHeightPx = Math.max(280, Math.floor(safeViewportHeight * 0.82 - 8));

  const missingReceiptsExpenseCount = useMemo(
    () => expenseRows.filter((e) => !String(e.receiptUri ?? '').trim()).length,
    [expenseRows]
  );

  const chips = useMemo(() => {
    const yearChip = `TY ${selectedYear}`;
    const total = summaryCardValue;
    switch (kind) {
      case 'revenue':
        return (
          <>
            <Chip styles={styles} label={`${revenuePayments.length} payment row${revenuePayments.length === 1 ? '' : 's'}`} />
            <Chip styles={styles} label={total} />
            <Chip styles={styles} label={yearChip} />
            <Chip styles={styles} label="Cash basis" />
          </>
        );
      case 'ar':
        return (
          <>
            <Chip styles={styles} label={`${arRows.length} unpaid row${arRows.length === 1 ? '' : 's'}`} />
            <Chip styles={styles} label={total} />
            <Chip styles={styles} label="Informational only" />
            <Chip styles={styles} label={yearChip} />
          </>
        );
      case 'expenses': {
        const miss = missingReceiptsExpenseCount;
        return (
          <>
            <Chip styles={styles} label={`${expenseRows.length} expense row${expenseRows.length === 1 ? '' : 's'}`} />
            <Chip styles={styles} label={total} />
            {miss > 0 ? (
              <Chip styles={styles} label={`Missing receipts: ${miss}`} warn />
            ) : (
              <Chip styles={styles} label="Missing receipts: 0" />
            )}
            <Chip styles={styles} label={yearChip} />
          </>
        );
      }
      case 'committed':
        return (
          <>
            <Chip styles={styles} label={`${committedRows.length} committed row${committedRows.length === 1 ? '' : 's'}`} />
            <Chip styles={styles} label={total} />
            <Chip styles={styles} label="Informational only" />
            <Chip styles={styles} label={yearChip} />
          </>
        );
      case 'subcontractor':
        return (
          <>
            <Chip
              styles={styles}
              label={`${subcontractorExpenseRows.length} payment${subcontractorExpenseRows.length === 1 ? '' : 's'}`}
            />
            <Chip styles={styles} label={`Total paid ${total}`} />
            <Chip styles={styles} label={`Potential 1099 review: ${review1099.potential1099VendorCount}`} />
            <Chip styles={styles} label={yearChip} />
          </>
        );
      case 'receipts': {
        const miss = missingReceiptsExpenseCount;
        return (
          <>
            <Chip styles={styles} label={`Receipt count: ${summary.receiptCount}`} />
            {miss > 0 ? <Chip styles={styles} label={`Missing receipts: ${miss}`} warn /> : <Chip styles={styles} label="Missing receipts: 0" />}
            <Chip styles={styles} label={yearChip} />
          </>
        );
      }
      default:
        return null;
    }
  }, [
    arRows.length,
    committedRows.length,
    expenseRows.length,
    kind,
    missingReceiptsExpenseCount,
    revenuePayments.length,
    review1099.potential1099VendorCount,
    subcontractorExpenseRows.length,
    summary.receiptCount,
    summaryCardValue,
    selectedYear,
    styles,
  ]);

  const body = useMemo(() => {
    if (kind === 'netIncome') {
      return (
        <View style={styles.formulaBox}>
          <Text style={styles.formulaLine}>Revenue Collected - Expenses Paid = Net Income</Text>
          <Text style={styles.formulaValues}>
            {formatMoney(summary.grossIncomeCollected)} - {formatMoney(summary.totalExpenses)} ={' '}
            {formatMoney(summary.netProfit)}
          </Text>
          <Text style={styles.formulaFoot}>
            Uses the same portfolio totals shown on Tax Center for {selectedYear}. Outstanding receivables and
            committed costs are not included in net income here.
          </Text>
        </View>
      );
    }
    if (kind === 'netMargin') {
      return (
        <View style={styles.formulaBox}>
          <Text style={styles.formulaLine}>Net Income / Revenue Collected = Net Margin</Text>
          <Text style={styles.formulaValues}>
            {formatMoney(summary.netProfit)} / {formatMoney(summary.grossIncomeCollected)} ={' '}
            {percentFromSummaryMargin(summary.netMargin, summary.grossIncomeCollected)}
          </Text>
          <Text style={styles.formulaFoot}>Uses the same portfolio totals shown on Tax Center for {selectedYear}.</Text>
        </View>
      );
    }

    if (kind === 'revenue') {
      /*
       * CPA/product validation (do not ship as user-facing TODO):
       * Confirm whether every collected approved change-order payment is always included in Revenue Collected
       * under the current cash-basis rules before changing revenue math.
       */
      return revenuePayments.length === 0 ? (
        <Text style={styles.empty}>No collected payments dated in this tax year.</Text>
      ) : (
        <>
          {revenuePayments.map((p, idx) => {
            const src = classifyRevenuePaymentSource(p);
            const proj = displayLabel(String(p.projectName || '').trim(), 'Not added');
            const pid = String(p.projectId || '').trim();
            const customerRaw = (pid && revenueCustomerByProjectId[pid]) || '';
            const customer = displayLabel(customerRaw, 'Not added');
            const amt =
              Number(p.collectedAmount ?? p.amount ?? p.paymentAmount ?? 0) ||
              Number(String(p.amount ?? '').replace(/[$,\s]/g, '')) ||
              0;
            const rawDate = String(
              p.actualDate || p.collectedAt || p.paidAt || p.paymentDate || p.scheduledDate || ''
            ).trim();
            const dateFmt = formatDisplayDate(rawDate);
            const notes = displayLabel(String(p.description || '').trim(), 'None');
            return (
              <View key={`${String(p.id || '')}-${idx}`} style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowPrimaryLeft} numberOfLines={2}>
                    {proj}
                  </Text>
                  <Text style={styles.rowPrimaryRight}>{formatMoney(amt)}</Text>
                </View>
              <Text style={styles.rowMeta}>
                <Text style={dateFmt.warn ? styles.metaWarn : undefined}>{dateFmt.text}</Text>
                <Text style={styles.rowMeta}>{` · ${paymentTypeLabel(p)}`}</Text>
              </Text>
                <Text style={styles.rowMetaSub}>{revenueSourceLabel(src)}</Text>
                <Text style={styles.rowDetailMuted}>
                  Customer: {customer} · Notes: {notes}
                </Text>
              </View>
            );
          })}
        </>
      );
    }

    if (kind === 'ar') {
      return arRows.length === 0 ? (
        <Text style={styles.empty}>No outstanding receivables for this tax year.</Text>
      ) : (
        arRows.map((r, idx) => {
          const due = formatDisplayDate(r.scheduledOrDue);
          const customer = displayLabel(r.customerName, 'Not added');
          const primary = displayLabel(r.label, r.projectName);
          return (
            <View key={`${r.projectId}-${r.label}-${idx}`} style={styles.rowCard}>
              <View style={styles.rowTop}>
                <Text style={styles.rowPrimaryLeft} numberOfLines={2}>
                  {primary}
                </Text>
                <Text style={styles.rowPrimaryRight}>{formatMoney(r.amount)}</Text>
              </View>
              <Text style={styles.rowMeta}>
                <Text style={due.warn ? styles.metaWarn : undefined}>{due.text}</Text>
                <Text style={styles.rowMeta}>{` · ${r.status}`}</Text>
              </Text>
              <Text style={styles.rowMetaSub}>{receivableKindLine(r.lineKind)}</Text>
              <Text style={styles.rowDetailMuted}>
                Project: {displayLabel(r.projectName, 'Not added')} · Customer: {customer}
              </Text>
            </View>
          );
        })
      );
    }

    if (kind === 'expenses') {
      return expenseRows.length === 0 ? (
        <Text style={styles.empty}>No expenses paid in this tax year.</Text>
      ) : (
        expenseRows.map((e, idx) => {
          const uri = String(e.receiptUri ?? '').trim();
          const missingReceipt = !uri;
          const amt =
            typeof e.amount === 'number' ? e.amount : Number(String(e.amount ?? '').replace(/[$,\s]/g, '')) || 0;
          const vendor = displayLabel(String(e.vendor || e.vendorName || '').trim(), 'Not added');
          const category = displayLabel(String(e.category || '').trim(), 'Not added');
          const primary = !isBlankish(String(e.vendor || e.vendorName || '').trim()) ? vendor : category;
          const paidRaw = String(e.paidAt || e.date || '').trim();
          const paidFmt = formatDisplayDate(paidRaw);
          const project = displayLabel(String(e.projectName || '').trim(), 'Not added');
          return (
            <View key={`${String(e.projectId)}-${String(e.id || idx)}`} style={styles.rowCard}>
              <View style={styles.rowTop}>
                <Text style={styles.rowPrimaryLeft} numberOfLines={2}>
                  {primary}
                </Text>
                <Text style={styles.rowPrimaryRight}>{formatMoney(amt)}</Text>
              </View>
              <Text style={styles.rowMeta}>
                <Text style={paidFmt.warn ? styles.metaWarn : undefined}>{paidFmt.text}</Text>
                <Text style={styles.rowMeta}>{` · ${project}`}</Text>
              </Text>
              <Text style={missingReceipt ? styles.metaWarn : styles.rowMetaSub}>
                {missingReceipt ? 'Missing receipt' : 'Receipt attached'}
              </Text>
              <Text style={styles.rowDetailMuted}>
                Vendor: {vendor} · Category: {category} · Source:{' '}
                {e.__isPurchaseOrder ? 'Purchase order' : 'Expense'}
              </Text>
            </View>
          );
        })
      );
    }

    if (kind === 'committed') {
      return committedRows.length === 0 ? (
        <Text style={styles.empty}>No committed (pending) purchase orders in this tax year.</Text>
      ) : (
        committedRows.map((r, idx) => {
          const vendor = displayLabel(r.vendor, 'Not added');
          const po = displayLabel(r.poLabel, 'Not added');
          const committed = formatDisplayDate(r.committedDate);
          const primary = !isBlankish(r.vendor) ? vendor : po;
          return (
            <View key={`${r.projectName}-${r.poLabel}-${idx}`} style={styles.rowCard}>
              <View style={styles.rowTop}>
                <Text style={styles.rowPrimaryLeft} numberOfLines={2}>
                  {primary}
                </Text>
                <Text style={styles.rowPrimaryRight}>{formatMoney(r.amount)}</Text>
              </View>
              <Text style={styles.rowMeta}>
                <Text style={committed.warn ? styles.metaWarn : undefined}>{committed.text}</Text>
                <Text style={styles.rowMeta}>{` · ${r.status}`}</Text>
              </Text>
              <Text style={styles.rowMetaSub}>Pending · Not received</Text>
              <Text style={styles.rowDetailMuted}>
                Project: {displayLabel(r.projectName, 'Not added')} · PO: {po} · Received / paid:{' '}
                {r.receivedOrPaid}
              </Text>
            </View>
          );
        })
      );
    }

    if (kind === 'subcontractor') {
      return subcontractorExpenseRows.length === 0 ? (
        <Text style={styles.empty}>No subcontractor-classified payments in this tax year.</Text>
      ) : (
        subcontractorExpenseRows.map((e, idx) => {
          const v = resolveVendorForExpense(e, vendors);
          const amt =
            typeof e.amount === 'number' ? e.amount : Number(String(e.amount ?? '').replace(/[$,\s]/g, '')) || 0;
          const vendor = displayLabel(String(e.vendor || e.vendorName || '').trim(), 'Not added');
          const paidRaw = String(e.paidAt || e.date || '').trim();
          const paidFmt = formatDisplayDate(paidRaw);
          const project = displayLabel(String(e.projectName || '').trim(), 'Not added');
          const pmRaw = String(e.paymentMethod || '').trim();
          const pmMissing = !pmRaw;
          const pmText = pmMissing ? 'Not added' : pmRaw;
          const w9 = w9StatusShort(v);
          const uri = String(e.receiptUri ?? '').trim();
          const missingReceipt = !uri;
          return (
            <View key={`${String(e.projectId)}-${String(e.id || idx)}`} style={styles.rowCard}>
              <View style={styles.rowTop}>
                <Text style={styles.rowPrimaryLeft} numberOfLines={2}>
                  {vendor}
                </Text>
                <Text style={styles.rowPrimaryRight}>{formatMoney(amt)}</Text>
              </View>
              <Text style={styles.rowMeta}>
                <Text style={paidFmt.warn ? styles.metaWarn : undefined}>{paidFmt.text}</Text>
                <Text style={styles.rowMeta}>{` · ${project}`}</Text>
              </Text>
              <Text style={styles.rowMeta}>
                <Text style={pmMissing ? styles.metaWarn : undefined}>{pmText}</Text>
                <Text style={styles.rowMeta}> · </Text>
                <Text style={w9.warn ? styles.metaWarn : undefined}>{w9.text}</Text>
              </Text>
              <Text style={missingReceipt ? styles.metaWarn : styles.rowMetaSub}>
                {missingReceipt ? 'Missing receipt' : 'Receipt attached'}
              </Text>
            </View>
          );
        })
      );
    }

    if (kind === 'receipts') {
      return receiptRows.length === 0 ? (
        <Text style={styles.empty}>No receipt-backed lines in this tax year.</Text>
      ) : (
        receiptRows.map((r, idx) => {
          const vendor = displayLabel(r.vendor, 'Not added');
          const expDate = formatDisplayDate(r.expenseDate);
          const project = displayLabel(r.projectName, 'Not added');
          const attach = displayLabel(r.attachmentName, 'Missing');
          return (
            <View key={`${r.projectName}-${r.attachmentName}-${idx}`} style={styles.rowCard}>
              <View style={styles.rowTop}>
                <Text style={styles.rowPrimaryLeft} numberOfLines={2}>
                  {vendor}
                </Text>
                <Text style={styles.rowPrimaryRight}>{formatMoney(r.amount)}</Text>
              </View>
              <Text style={styles.rowMeta}>
                <Text style={expDate.warn ? styles.metaWarn : undefined}>{expDate.text}</Text>
                <Text style={styles.rowMeta}>{` · ${project}`}</Text>
              </Text>
              <Text style={styles.rowMetaSub}>
                Receipt attached
                <Text> · </Text>
                {attach === 'Missing' ? <Text style={styles.metaWarn}>Missing</Text> : <Text>{attach}</Text>}
              </Text>
              <Text style={styles.rowDetailMuted}>
                Category: {String(r.category || '').trim() || 'Not added'} · Source:{' '}
                {r.source === 'purchase_order' ? 'Purchase order' : 'Expense'}
              </Text>
            </View>
          );
        })
      );
    }

    return null;
  }, [
    arRows,
    committedRows,
    expenseRows,
    kind,
    receiptRows,
    revenueCustomerByProjectId,
    revenuePayments,
    selectedYear,
    subcontractorExpenseRows,
    summary.grossIncomeCollected,
    summary.netMargin,
    summary.netProfit,
    summary.totalExpenses,
    vendors,
    formatMoney,
    styles,
  ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={[
          styles.backdrop,
          {
            paddingBottom: backdropBottomPad,
            paddingHorizontal: backdropHorizontalPad,
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close detail" />
        <View
          style={{
            alignSelf: 'stretch',
            height: sheetMaxHeightPx,
            maxHeight: sheetMaxHeightPx,
            marginBottom: 8,
          }}
        >
          <LinearGradient
            colors={BRAND_FRAME_GRADIENT_COLORS}
            start={BRAND_FRAME_GRADIENT_START}
            end={BRAND_FRAME_GRADIENT_END}
            style={styles.sheetRing}
          >
          <View style={styles.sheetInner}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <MaterialIcons name="close" size={26} color={Colors.text} />
            </Pressable>
          </View>
          {summaryCardValue ? <Text style={styles.cardTotal}>{summaryCardValue}</Text> : null}
          <Text style={styles.sheetSub}>{sheetContextLine(kind, selectedYear)}</Text>
          <Text style={styles.tableHint}>{detailDescription(kind)}</Text>
          {chips ? <View style={styles.chipRow}>{chips}</View> : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {body}
            <Text style={styles.footerNote}>{FOOTER_NOTE}</Text>
          </ScrollView>
          </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}
