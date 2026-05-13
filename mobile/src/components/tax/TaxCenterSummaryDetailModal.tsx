import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type {
  OutstandingReceivableDetailRow,
  ReceiptCountDetailRow,
  TaxCenterSummary,
  TaxExpense,
  TaxPayment,
} from '@/src/lib/taxCenter';
import { classifyRevenuePaymentSource } from '@/src/lib/taxCenter';
import type { Vendor } from '@/src/lib/vendorTypes';
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

type Props = {
  visible: boolean;
  onClose: () => void;
  kind: TaxCenterDetailKind;
  title: string;
  selectedYear: number;
  /** Portfolio summary totals — used for Net Income / Net Margin only (no recalculation). */
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

export default function TaxCenterSummaryDetailModal({
  visible,
  onClose,
  kind,
  title,
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
  formatMoney,
}: Props) {
  const body = useMemo(() => {
    if (kind === 'netIncome') {
      return (
        <View style={styles.formulaBox}>
          <Text style={styles.formulaLine}>Revenue Collected − Expenses Paid = Net Income</Text>
          <Text style={styles.formulaValues}>
            {formatMoney(summary.grossIncomeCollected)} − {formatMoney(summary.totalExpenses)} ={' '}
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
          <Text style={styles.formulaLine}>Net Income ÷ Revenue Collected = Net Margin</Text>
          <Text style={styles.formulaValues}>
            {formatMoney(summary.netProfit)} ÷ {formatMoney(summary.grossIncomeCollected)} ={' '}
            {summary.grossIncomeCollected > 0
              ? `${Math.round(summary.netMargin * 100)}%`
              : 'N/A (no revenue collected in year)'}
          </Text>
          <Text style={styles.formulaFoot}>Uses the same portfolio totals shown on Tax Center for {selectedYear}.</Text>
        </View>
      );
    }

    if (kind === 'revenue') {
      return (
        <View>
          <Text style={styles.tableHint}>
            Revenue source labels are for traceability only and do not change Tax Center math.
          </Text>
          <Text style={styles.devTodo}>
            TODO (CPA review): Confirm whether every collected approved change-order payment is always included in
            Revenue Collected under the current cash-basis rules. Do not change revenue math without an explicit
            product decision.
          </Text>
          {revenuePayments.length === 0 ? (
            <Text style={styles.empty}>No collected payments dated in this tax year.</Text>
          ) : (
            revenuePayments.map((p, idx) => {
              const src = classifyRevenuePaymentSource(p);
              const proj = String(p.projectName || '').trim() || '—';
              const pid = String(p.projectId || '').trim();
              const customer = (pid && revenueCustomerByProjectId[pid]) || '—';
              const amt =
                Number(p.collectedAmount ?? p.amount ?? p.paymentAmount ?? 0) ||
                Number(String(p.amount ?? '').replace(/[$,\s]/g, '')) ||
                0;
              return (
                <View key={`${String(p.id || '')}-${idx}`} style={styles.rowCard}>
                  <Text style={styles.rowTitle}>{proj}</Text>
                  <Text style={styles.rowLine}>Customer: {customer}</Text>
                  <Text style={styles.rowLine}>
                    Payment date:{' '}
                    {String(
                      p.actualDate || p.collectedAt || p.paidAt || p.paymentDate || p.scheduledDate || '—'
                    )}
                  </Text>
                  <Text style={styles.rowLine}>Payment type: {paymentTypeLabel(p)}</Text>
                  <Text style={styles.rowLine}>Revenue source: {revenueSourceLabel(src)}</Text>
                  <Text style={styles.rowLine}>Amount: {formatMoney(amt)}</Text>
                  <Text style={styles.rowLine}>Notes: {String(p.description || '').trim() || '—'}</Text>
                </View>
              );
            })
          )}
        </View>
      );
    }

    if (kind === 'ar') {
      return arRows.length === 0 ? (
        <Text style={styles.empty}>No outstanding receivables for this tax year.</Text>
      ) : (
        arRows.map((r, idx) => (
          <View key={`${r.projectId}-${r.label}-${idx}`} style={styles.rowCard}>
            <Text style={styles.rowTitle}>{r.projectName}</Text>
            <Text style={styles.rowLine}>Customer: {r.customerName || '—'}</Text>
            <Text style={styles.rowLine}>Label: {r.label}</Text>
            <Text style={styles.rowLine}>Due / scheduled: {r.scheduledOrDue || '—'}</Text>
            <Text style={styles.rowLine}>Kind: {r.lineKind.replace(/_/g, ' ')}</Text>
            <Text style={styles.rowLine}>Amount: {formatMoney(r.amount)}</Text>
            <Text style={styles.rowLine}>Status: {r.status}</Text>
          </View>
        ))
      );
    }

    if (kind === 'expenses') {
      return expenseRows.length === 0 ? (
        <Text style={styles.empty}>No expenses paid in this tax year.</Text>
      ) : (
        expenseRows.map((e, idx) => {
          const uri = String(e.receiptUri ?? '').trim();
          const amt =
            typeof e.amount === 'number' ? e.amount : Number(String(e.amount ?? '').replace(/[$,\s]/g, '')) || 0;
          return (
            <View key={`${String(e.projectId)}-${String(e.id || idx)}`} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{String(e.projectName || '').trim() || '—'}</Text>
              <Text style={styles.rowLine}>Vendor: {String(e.vendor || e.vendorName || '').trim() || '—'}</Text>
              <Text style={styles.rowLine}>Category: {String(e.category || '').trim() || '—'}</Text>
              <Text style={styles.rowLine}>Paid date: {String(e.paidAt || e.date || '').trim() || '—'}</Text>
              <Text style={styles.rowLine}>Amount: {formatMoney(amt)}</Text>
              <Text style={styles.rowLine}>Receipt attached: {uri ? 'Yes' : 'No'}</Text>
              <Text style={styles.rowLine}>Source: {e.__isPurchaseOrder ? 'Purchase order' : 'Expense'}</Text>
            </View>
          );
        })
      );
    }

    if (kind === 'committed') {
      return committedRows.length === 0 ? (
        <Text style={styles.empty}>No committed (pending) purchase orders in this tax year.</Text>
      ) : (
        committedRows.map((r, idx) => (
          <View key={`${r.projectName}-${r.poLabel}-${idx}`} style={styles.rowCard}>
            <Text style={styles.rowTitle}>{r.projectName}</Text>
            <Text style={styles.rowLine}>Vendor: {r.vendor}</Text>
            <Text style={styles.rowLine}>PO: {r.poLabel}</Text>
            <Text style={styles.rowLine}>Committed date: {r.committedDate || '—'}</Text>
            <Text style={styles.rowLine}>Amount: {formatMoney(r.amount)}</Text>
            <Text style={styles.rowLine}>Status: {r.status}</Text>
            <Text style={styles.rowLine}>Received / paid: {r.receivedOrPaid}</Text>
          </View>
        ))
      );
    }

    if (kind === 'subcontractor') {
      return subcontractorExpenseRows.length === 0 ? (
        <Text style={styles.empty}>No subcontractor-classified payments in this tax year.</Text>
      ) : (
        subcontractorExpenseRows.map((e, idx) => {
          const v = resolveVendorForExpense(e, vendors);
          const w9 = v?.w9Status ? String(v.w9Status) : '—';
          const review =
            v?.vendorType === 'subcontractor' || v?.vendorType === 'consultant' || v?.vendorType === 'other'
              ? 'Review with CPA if applicable'
              : v?.requires1099Review
                ? 'Potential 1099 review — confirm with CPA'
                : '—';
          const amt =
            typeof e.amount === 'number' ? e.amount : Number(String(e.amount ?? '').replace(/[$,\s]/g, '')) || 0;
          return (
            <View key={`${String(e.projectId)}-${String(e.id || idx)}`} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{String(e.vendor || e.vendorName || '').trim() || '—'}</Text>
              <Text style={styles.rowLine}>Project: {String(e.projectName || '').trim() || '—'}</Text>
              <Text style={styles.rowLine}>Paid date: {String(e.paidAt || e.date || '').trim() || '—'}</Text>
              <Text style={styles.rowLine}>Amount: {formatMoney(amt)}</Text>
              <Text style={styles.rowLine}>Payment method: {String(e.paymentMethod || '').trim() || '—'}</Text>
              <Text style={styles.rowLine}>W-9 status: {w9}</Text>
              <Text style={styles.rowLine}>Potential 1099 review: {review}</Text>
            </View>
          );
        })
      );
    }

    if (kind === 'receipts') {
      return receiptRows.length === 0 ? (
        <Text style={styles.empty}>No receipt-backed lines in this tax year.</Text>
      ) : (
        receiptRows.map((r, idx) => (
          <View key={`${r.projectName}-${r.attachmentName}-${idx}`} style={styles.rowCard}>
            <Text style={styles.rowTitle}>{r.projectName}</Text>
            <Text style={styles.rowLine}>Vendor: {r.vendor}</Text>
            <Text style={styles.rowLine}>Expense date: {r.expenseDate || '—'}</Text>
            <Text style={styles.rowLine}>Category: {r.category}</Text>
            <Text style={styles.rowLine}>Amount: {formatMoney(r.amount)}</Text>
            <Text style={styles.rowLine}>Receipt status: {r.receiptStatus}</Text>
            <Text style={styles.rowLine}>Attachment: {r.attachmentName || '—'}</Text>
            <Text style={styles.rowLine}>Source: {r.source === 'purchase_order' ? 'Purchase order' : 'Expense'}</Text>
          </View>
        ))
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
  ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close detail" />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <MaterialIcons name="close" size={26} color="#E2E8F0" />
            </Pressable>
          </View>
          <Text style={styles.sheetSub}>Tax year {selectedYear} · same filters as summary cards</Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {body}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: Platform.OS === 'web' ? '85%' : '88%',
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    paddingRight: 12,
  },
  sheetSub: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 12,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  scroll: { maxHeight: 520 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  rowCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  rowTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 6 },
  rowLine: { color: 'rgba(226,232,240,0.92)', fontSize: 13, lineHeight: 20 },
  empty: { color: 'rgba(148,163,184,0.95)', fontStyle: 'italic', padding: 16 },
  formulaBox: {
    padding: 16,
    backgroundColor: 'rgba(45,255,196,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(45,255,196,0.25)',
  },
  formulaLine: { color: '#e2e8f0', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  formulaValues: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  formulaFoot: { color: 'rgba(148,163,184,0.95)', fontSize: 12, lineHeight: 18 },
  tableHint: { color: 'rgba(148,163,184,0.95)', fontSize: 12, marginBottom: 8, lineHeight: 18 },
  devTodo: {
    color: '#FBBF24',
    fontSize: 11,
    marginBottom: 12,
    lineHeight: 16,
    padding: 10,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
  },
});
