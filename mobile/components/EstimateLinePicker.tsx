import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROJECT_WIDE_CONTAINER_CARD_INSET } from '@/constants/ScreenLayout';
import { formatMoneyFull } from '@/src/lib/budgetUtils';
import {
  approvedChangeOrderBudgetLines,
  changeOrderIdFromBudgetLineId,
  isChangeOrderBudgetLineId,
  isChangeOrderPaymentMilestoneReceived,
} from '@/src/lib/projectFinancials';
import { isChangeOrderPaymentReceived } from '@/lib/markPaymentCollected';
import { ESTIMATE_FLOW_TRACK_BG_DARK } from '@/utils/estimateFlowCardStyle';
import {
  getEstimateLineBudgetBadge,
  getEstimateLineSpendSummaries,
  getUnlinkedExpensesForKind,
  EQUIPMENT_RENTAL_LINE_ID,
  resolveProjectEstimateData,
  resolveProjectExpenses,
  sortEstimateLineOptions,
  type EstimateLineSpendSummary,
} from '@/utils/rateInsightComparisons';
import {
  budgetLineSpendForKind,
  displayEstimateLineName,
  estimateLineOptionsFor,
  type EstimateLineOption,
  type EstimateLinePickerKind,
} from '@/utils/estimateLineOptions';
import BudgetStatusBadge from '@/components/BudgetStatusBadge';
import {
  formatSpendDetail,
  lineBudgetStatusVariant,
  lineSpendColor,
  progressFillPercent,
  withEditingAmount,
} from '@/utils/estimateLineBudgetDisplay';
import { resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';

export type { EstimateLineOption, EstimateLinePickerKind } from '@/utils/estimateLineOptions';
export { resolveEstimateLineOption } from '@/utils/estimateLineOptions';

type Props = {
  kind: EstimateLinePickerKind;
  projectLike?: Record<string, unknown> | null;
  selectedLineId?: string | null;
  onSelect: (line: EstimateLineOption | null) => void;
  darkMode: boolean;
  /** When editing an expense, omit it from logged spend totals. */
  excludeExpenseId?: string | null;
  /** Amount on the form — added back for display when `excludeExpenseId` is set. */
  editingAmount?: number | null;
  /** Show linked line as a read-only summary (no picker, no clear). */
  readOnly?: boolean;
  /** Close the picker and open this change order's Timeline payment. */
  onOpenChangeOrderPayment?: (changeOrderId: string) => void;
  /** Fires after this sheet has fully closed. */
  onDidDismiss?: () => void;
  colors: {
    background: string;
    card: string;
    text: string;
    secondary: string;
    border: string;
    nestedCard: string;
    accent: string;
  };
};

function tracksChangeOrders(kind: EstimateLinePickerKind): kind is 'materials' | 'labor' {
  return kind === 'materials' || kind === 'labor';
}

function optionsFor(
  projectLike: Record<string, unknown> | null | undefined,
  kind: EstimateLinePickerKind
): EstimateLineOption[] {
  const estimateLines = estimateLineOptionsFor(resolveProjectEstimateData(projectLike), kind);
  if (!tracksChangeOrders(kind)) return estimateLines;
  const changeOrderLines = approvedChangeOrderBudgetLines(projectLike, kind).map((line) => ({
    id: line.id,
    name: line.name,
    budget: line.budget,
    quantity: null,
    unit: null,
    costCode: null,
    clientPrice: line.clientPrice,
  }));
  return [...estimateLines, ...changeOrderLines];
}

function displayLineName(name: string): string {
  return displayEstimateLineName(name);
}

function lineCategoryLabel(kind: EstimateLinePickerKind): string {
  if (kind === 'materials') return 'Materials';
  if (kind === 'labor') return 'Labor';
  if (kind === 'soft') return 'Soft cost';
  if (kind === 'overhead') return 'Overhead';
  return 'Contingency';
}

function pickerTitle(kind: EstimateLinePickerKind): string {
  if (kind === 'materials') return 'Materials & equipment';
  if (kind === 'labor') return 'Labor';
  if (kind === 'soft') return 'Soft costs';
  if (kind === 'overhead') return 'Company overhead';
  return 'Contingency';
}

function pickerSubtitle(kind: EstimateLinePickerKind): string {
  if (kind === 'materials') return 'Materials, equipment, and change orders';
  if (kind === 'labor') return 'Labor and change orders';
  if (kind === 'soft') return 'Soft costs';
  if (kind === 'overhead') return 'Company overhead';
  return 'Contingency';
}

function spendTone(summary: EstimateLineSpendSummary): string {
  const color = lineSpendColor(summary);
  return color === '#22c55e' ? '#2dcc9a' : color;
}

export default function EstimateLinePicker({
  kind,
  projectLike,
  selectedLineId,
  onSelect,
  darkMode,
  excludeExpenseId,
  editingAmount,
  readOnly = false,
  onOpenChangeOrderPayment,
  onDidDismiss,
  colors,
}: Props) {
  const insets = useSafeAreaInsets();
  const pageInset = PROJECT_WIDE_CONTAINER_CARD_INSET;
  const [visible, setVisible] = useState(false);
  const [modalAnimation, setModalAnimation] = useState<'slide' | 'none'>('slide');
  const [query, setQuery] = useState('');
  /** Draft highlight inside the modal; committed via footer Select. */
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);
  /** Change order ids whose Timeline payment is Received. Null until the timeline load finishes. */
  const [receivedChangeOrderIds, setReceivedChangeOrderIds] = useState<Set<string> | null>(null);
  const options = useMemo(() => optionsFor(projectLike, kind), [projectLike, kind]);
  const namedBudgetKind = kind === 'soft' || kind === 'contingency' || kind === 'overhead';
  const spendInput = useMemo(
    () => ({
      estimateData: resolveProjectEstimateData(projectLike),
      expenses: resolveProjectExpenses(projectLike),
      kind,
      excludeExpenseId,
    }),
    [projectLike, kind, excludeExpenseId]
  );
  const namedSpend = useMemo(() => {
    if (kind !== 'soft' && kind !== 'contingency' && kind !== 'overhead') return null;
    return budgetLineSpendForKind({
      options,
      expenses: resolveProjectExpenses(projectLike),
      kind,
      excludeExpenseId,
    });
  }, [options, projectLike, kind, excludeExpenseId]);
  const spendSummaries = useMemo(() => {
    if (namedSpend) return namedSpend.summaries;
    if (kind !== 'materials' && kind !== 'labor') return {};
    return getEstimateLineSpendSummaries({ ...spendInput, kind });
  }, [namedSpend, spendInput, kind]);
  const unlinkedExpenses = useMemo(() => {
    if (namedSpend) return namedSpend.unlinked;
    if (kind !== 'materials' && kind !== 'labor') return [];
    return getUnlinkedExpensesForKind({ ...spendInput, kind });
  }, [namedSpend, spendInput, kind]);
  const changeOrderSpend = useMemo(() => {
    const spent: Record<string, number> = {};
    if (!tracksChangeOrders(kind)) return spent;
    for (const expense of resolveProjectExpenses(projectLike)) {
      if (excludeExpenseId && expense.id === excludeExpenseId) continue;
      const linked = expense.linkedLineId ? String(expense.linkedLineId) : '';
      if (!isChangeOrderBudgetLineId(linked, kind)) continue;
      const amount = Number(expense.amount);
      if (!Number.isFinite(amount)) continue;
      spent[linked] = (spent[linked] || 0) + amount;
    }
    return spent;
  }, [projectLike, kind, excludeExpenseId]);

  const summaryForLine = useCallback(
    (lineId: string, budget: number): EstimateLineSpendSummary => {
      const fromEstimate = spendSummaries[lineId];
      if (fromEstimate) return fromEstimate;
      const loggedTotal = changeOrderSpend[lineId] || 0;
      return {
        loggedTotal,
        budget,
        remaining: budget > 0 ? budget - loggedTotal : 0,
        variancePct: null,
        badge: getEstimateLineBudgetBadge(loggedTotal, budget),
      };
    },
    [spendSummaries, changeOrderSpend]
  );

  const selected = options.find((item) => item.id === selectedLineId) || null;
  const pendingLine = options.find((item) => item.id === pendingLineId) || null;

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const projectId = String(
      (projectLike as { id?: string; projectId?: string } | null)?.id ||
        (projectLike as { projectId?: string } | null)?.projectId ||
        ''
    );
    void (async () => {
      try {
        const raw = projectId ? await AsyncStorage.getItem(`bps.timeline.v2.${projectId}`) : null;
        const parsed = raw ? JSON.parse(raw) : [];
        const ids = new Set<string>();
        if (Array.isArray(parsed)) {
          for (const milestone of parsed) {
            const milestoneId = String(milestone?.id || '');
            if (
              !milestoneId.startsWith('bps-co-') ||
              milestoneId.startsWith('bps-co-material-') ||
              milestoneId.startsWith('bps-co-labor-')
            ) {
              continue;
            }
            const changeOrderId = milestoneId.slice('bps-co-'.length);
            if (changeOrderId && isChangeOrderPaymentMilestoneReceived(milestone)) {
              ids.add(changeOrderId);
            }
          }
        }
        if (!cancelled) setReceivedChangeOrderIds(ids);
      } catch {
        if (!cancelled) setReceivedChangeOrderIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, projectLike]);
  const { materialRows, equipmentRows, changeOrderRows } = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = normalized
      ? options.filter((item) => item.name.toLowerCase().includes(normalized))
      : options;
    const equipment = tracksChangeOrders(kind)
      ? base.filter((item) => item.id === EQUIPMENT_RENTAL_LINE_ID)
      : [];
    const changeOrders = tracksChangeOrders(kind)
      ? base.filter((item) => isChangeOrderBudgetLineId(item.id, kind))
      : [];
    const bidLines = base.filter(
      (item) => item.id !== EQUIPMENT_RENTAL_LINE_ID && !changeOrders.some((row) => row.id === item.id)
    );
    const materials = namedBudgetKind ? bidLines : sortEstimateLineOptions(bidLines, spendSummaries);
    return { materialRows: materials, equipmentRows: equipment, changeOrderRows: changeOrders };
  }, [options, query, spendSummaries, kind, namedBudgetKind]);

  const title = pickerTitle(kind);

  const close = useCallback(() => {
    setModalAnimation('slide');
    setVisible(false);
    setQuery('');
    setPendingLineId(null);
  }, []);

  const closeImmediately = useCallback(() => {
    setModalAnimation('none');
    setVisible(false);
    setQuery('');
    setPendingLineId(null);
  }, []);

  const open = useCallback(() => {
    setModalAnimation('slide');
    setPendingLineId(selectedLineId ?? null);
    setQuery('');
    setVisible(true);
  }, [selectedLineId]);

  const confirmSelection = useCallback(() => {
    void (async () => {
      const changeOrderId = changeOrderIdFromBudgetLineId(pendingLine?.id);
      if (changeOrderId) {
        const projectId = String(
          (projectLike as { id?: string; projectId?: string } | null)?.id ||
            (projectLike as { projectId?: string } | null)?.projectId ||
            ''
        );
        const received = await isChangeOrderPaymentReceived(projectId, changeOrderId);
        if (!received) {
          const name = pendingLine?.name?.trim() || 'this change order';
          Alert.alert(
            'Payment not received',
            `Mark ${name} as Received on the Timeline before logging this bill.`,
            onOpenChangeOrderPayment
              ? [
                  { text: 'Not now', style: 'cancel' },
                  {
                    text: 'Go to Timeline',
                    onPress: () => {
                      setTimeout(() => {
                        onOpenChangeOrderPayment(changeOrderId);
                        setTimeout(() => {
                          closeImmediately();
                          onDidDismiss?.();
                        }, 50);
                      }, 200);
                    },
                  },
                ]
              : undefined
          );
          return;
        }
      }
      onSelect(pendingLine);
      close();
    })();
  }, [close, closeImmediately, onDidDismiss, onOpenChangeOrderPayment, onSelect, pendingLine, projectLike]);

  const choose = (line: EstimateLineOption | null) => {
    onSelect(line);
    close();
  };

  const togglePending = (lineId: string) => {
    setPendingLineId((current) => (current === lineId ? null : lineId));
  };

  const pendingSummary = pendingLine
    ? withEditingAmount(
        spendSummaries[pendingLine.id],
        pendingLine.budget,
        excludeExpenseId ? editingAmount : null
      )
    : null;

  const selectedDisplaySummary = selected
    ? withEditingAmount(
        summaryForLine(selected.id, selected.budget),
        selected.budget,
        excludeExpenseId ? editingAmount : null
      )
    : null;

  const selectedSummaryContent = selected ? (
    <>
      <Text style={[styles.selectorTitle, { color: colors.text }]}>
        {displayLineName(selected.name)}
      </Text>
      <Text style={[styles.selectorSubtitle, { color: colors.secondary }]}>
        {tracksChangeOrders(kind) && isChangeOrderBudgetLineId(selected.id, kind)
          ? 'Change order'
          : selected.id === EQUIPMENT_RENTAL_LINE_ID
            ? 'Equipment'
            : lineCategoryLabel(kind)} · Budget {formatMoneyFull(selected.budget, { decimals: 0 })}
        {selected.quantity && selected.unit ? ` · ${selected.quantity} ${selected.unit}` : ''}
      </Text>
      {selectedDisplaySummary && selectedDisplaySummary.loggedTotal > 0 ? (
        <Text
          style={[
            styles.selectorSubtitle,
            { color: spendTone(selectedDisplaySummary), marginTop: 4, fontWeight: '700' },
          ]}
        >
          {formatSpendDetail(selectedDisplaySummary)}
        </Text>
      ) : null}
      {!readOnly ? (
        <Text style={[styles.linkedLabel, { color: colors.accent }]}>Linked ✓</Text>
      ) : null}
    </>
  ) : null;

  return (
    <>
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>
          {readOnly ? 'Budget item' : 'Link to a budget item'}
        </Text>
        {readOnly && selected ? (
          <View
            style={[
              styles.selector,
              styles.selectorReadOnly,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            accessibilityRole="text"
          >
            <View style={styles.selectorText}>{selectedSummaryContent}</View>
          </View>
        ) : (
          <Pressable
            onPress={open}
            style={[
              styles.selector,
              selected
                ? { backgroundColor: colors.card, borderColor: colors.accent }
                : {
                    backgroundColor: darkMode
                      ? 'rgba(45, 204, 154, 0.14)'
                      : 'rgba(45, 204, 154, 0.1)',
                    borderColor: colors.accent,
                    borderWidth: 1.5,
                  },
            ]}
            accessibilityRole="button"
            accessibilityLabel={selected ? `Selected ${selected.name}` : 'Choose a budget item'}
          >
            <View style={styles.selectorText}>
              {selected ? (
                selectedSummaryContent
              ) : (
                <>
                  <Text style={[styles.selectorTitle, styles.chooseTitle, { color: colors.accent }]}>
                    Choose a budget item
                  </Text>
                  <Text style={[styles.selectorSubtitle, { color: darkMode ? '#d7e1f0' : colors.secondary }]}>
                    {pickerSubtitle(kind)}
                  </Text>
                </>
              )}
            </View>
            <MaterialIcons
              name="chevron-right"
              size={26}
              color={selected ? colors.secondary : colors.accent}
            />
          </Pressable>
        )}
        {selected && !readOnly ? (
          <Pressable onPress={() => choose(null)} accessibilityRole="button">
            <Text style={[styles.clearText, { color: colors.accent }]}>Clear link</Text>
          </Pressable>
        ) : null}
      </View>

      {!readOnly ? (
      <Modal
        visible={visible}
        animationType={modalAnimation}
        presentationStyle="overFullScreen"
        onRequestClose={close}
        onDismiss={onDidDismiss}
      >
        <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View
            style={[
              styles.pageHeader,
              {
                paddingHorizontal: pageInset,
                borderBottomColor: darkMode ? 'rgba(148, 163, 184, 0.14)' : colors.border,
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={close}
              style={[
                styles.headerBack,
                { backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : colors.nestedCard },
              ]}
            >
              <MaterialIcons name="arrow-back" size={22} color={darkMode ? '#FFFFFF' : colors.text} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose a budget item</Text>
              <Text style={[styles.sheetSubtitle, { color: darkMode ? '#d7e1f0' : colors.secondary }]}>
                {pickerSubtitle(kind)}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: pageInset, paddingBottom: 16 },
            ]}
          >
            <View
              style={[
                styles.listCard,
                {
                  backgroundColor: darkMode ? '#202022' : colors.card,
                  borderColor: darkMode ? 'rgba(148,163,184,0.12)' : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.searchShell,
                  {
                    backgroundColor: darkMode ? '#3A3A3C' : colors.nestedCard,
                    borderColor: darkMode ? 'rgba(148,163,184,0.35)' : colors.border,
                  },
                ]}
              >
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Search ${title.toLowerCase()}...`}
                  placeholderTextColor={colors.secondary}
                  style={[styles.search, { color: colors.text }]}
                  autoCapitalize="none"
                  {...resolveTextInputKeyboardProps()}
                />
              </View>

              <View style={styles.optionsList}>
                {[...materialRows, ...equipmentRows, ...changeOrderRows].map((line, index, rows) => {
                  const rawSummary = summaryForLine(line.id, line.budget);
                  const summary = withEditingAmount(
                    rawSummary,
                    line.budget,
                    excludeExpenseId && (line.id === selectedLineId || line.id === pendingLineId)
                      ? editingAmount
                      : null
                  );
                  const isPending = line.id === pendingLineId;
                  const isEquipment = line.id === EQUIPMENT_RENTAL_LINE_ID;
                  const isChangeOrder = tracksChangeOrders(kind) && isChangeOrderBudgetLineId(line.id, kind);
                  const isLast =
                    index === rows.length - 1 ||
                    (equipmentRows.length > 0 && index === materialRows.length - 1) ||
                    (changeOrderRows.length > 0 &&
                      index === materialRows.length + equipmentRows.length - 1);
                  const isFirstEquipment = isEquipment && index === materialRows.length;
                  const isFirstChangeOrder =
                    isChangeOrder && index === materialRows.length + equipmentRows.length;
                  const showSectionDivider =
                    (isFirstEquipment && materialRows.length > 0) ||
                    (isFirstChangeOrder && materialRows.length + equipmentRows.length > 0);
                  return (
                    <React.Fragment key={line.id}>
                    {showSectionDivider ? (
                      <View style={styles.equipmentDivider}>
                        <View
                          style={[
                            styles.equipmentDividerLine,
                            { backgroundColor: darkMode ? 'rgba(148,163,184,0.28)' : colors.border },
                          ]}
                        />
                        {isEquipment || isChangeOrder ? (
                          <Text style={[styles.sectionLabel, { color: darkMode ? '#d7e1f0' : colors.secondary }]}>
                            {isEquipment ? 'Equipment' : 'Change orders'}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => togglePending(line.id)}
                      style={[
                        styles.option,
                        {
                          borderBottomColor: darkMode ? 'rgba(148,163,184,0.12)' : colors.border,
                          backgroundColor: 'transparent',
                        },
                        isLast && styles.optionLast,
                      ]}
                    >
                      <View style={styles.optionText}>
                        <View style={styles.optionTitleRow}>
                          <Text style={[styles.optionName, { color: colors.text, flex: 1 }]}>
                            {displayLineName(line.name)}
                          </Text>
                          {lineBudgetStatusVariant(summary) !== 'neutral' ? (
                            <BudgetStatusBadge variant={lineBudgetStatusVariant(summary)} />
                          ) : null}
                        </View>
                        <Text style={[styles.optionMeta, { color: darkMode ? '#d7e1f0' : colors.secondary }]}>
                          {isChangeOrder ? 'Change order' : isEquipment ? 'Equipment' : lineCategoryLabel(kind)}
                          {' · Budget '}
                          <Text style={{ color: '#2dcc9a', fontWeight: '700' }}>
                            {formatMoneyFull(line.budget, { decimals: 0 })}
                          </Text>
                          {line.quantity && line.unit ? ` · ${line.quantity} ${line.unit}` : ''}
                        </Text>
                        {isChangeOrder &&
                        receivedChangeOrderIds != null &&
                        !receivedChangeOrderIds.has(changeOrderIdFromBudgetLineId(line.id) || '') ? (
                          <Text style={{ color: '#f59e0b', fontSize: 14, fontWeight: '700', marginTop: 8 }}>
                            Mark Received on the Timeline
                          </Text>
                        ) : null}
                        {summary.loggedTotal > 0 ? (
                          <>
                            <Text
                              style={[
                                styles.optionSpent,
                                { color: spendTone(summary) },
                              ]}
                            >
                              {formatSpendDetail(summary)}
                            </Text>
                            {summary.budget > 0 ? (
                              <View
                                style={[
                                  styles.progressTrack,
                                  {
                                    backgroundColor: darkMode
                                      ? ESTIMATE_FLOW_TRACK_BG_DARK
                                      : 'rgba(15,23,42,0.08)',
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.progressFill,
                                    {
                                      width: `${progressFillPercent(summary)}%`,
                                      backgroundColor: spendTone(summary),
                                    },
                                  ]}
                                />
                              </View>
                            ) : null}
                          </>
                        ) : null}
                      </View>
                      <MaterialIcons
                        name={isPending ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={24}
                        color="#2dcc9a"
                      />
                    </Pressable>
                    </React.Fragment>
                  );
                })}
              </View>
              {unlinkedExpenses.length > 0 ? (
                <View style={styles.unlinkedSection}>
                  <Text style={[styles.groupLabel, { color: colors.secondary, marginTop: 18 }]}>
                    Unmatched expenses
                  </Text>
                  <Text style={[styles.unlinkedHint, { color: colors.secondary }]}>
                    Tap to search for a matching estimate line.
                  </Text>
                  {unlinkedExpenses.map((expense, index) => (
                    <Pressable
                      key={expense.id}
                      onPress={() => setQuery(expense.label)}
                      style={[
                        styles.unlinkedRow,
                        {
                          borderBottomColor: darkMode ? 'rgba(148,163,184,0.12)' : colors.border,
                        },
                        index === unlinkedExpenses.length - 1 && styles.optionLast,
                      ]}
                    >
                      <Text
                        style={[styles.unlinkedLabel, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {expense.label}
                      </Text>
                      <Text style={[styles.unlinkedAmount, { color: colors.secondary }]}>
                        {formatMoneyFull(expense.amount, { decimals: 0 })}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {materialRows.length + equipmentRows.length + changeOrderRows.length === 0 ? (
                <Text style={[styles.empty, { color: colors.secondary }]}>
                  {options.length
                    ? 'No matching estimate items. Try a different search.'
                    : 'No estimate items are available for this project. Enter the expense manually below.'}
                </Text>
              ) : null}
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                paddingHorizontal: pageInset,
                paddingBottom: Math.max(insets.bottom, 16),
                borderTopColor: darkMode ? 'rgba(148, 163, 184, 0.14)' : colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            {pendingSummary && pendingSummary.remaining < 0 ? (
              <Text style={[styles.footerWarning, { color: '#f87171' }]}>
                {displayLineName(pendingLine!.name)} is already over budget by{' '}
                {formatMoneyFull(Math.abs(pendingSummary.remaining), { decimals: 0 })}.
              </Text>
            ) : pendingLine && pendingSummary && pendingSummary.loggedTotal > 0 ? (
              <Text style={[styles.footerHint, { color: colors.secondary }]}>
                {formatMoneyFull(pendingSummary.loggedTotal, { decimals: 0 })} already logged to{' '}
                {displayLineName(pendingLine.name)}. You can add more.
              </Text>
            ) : null}
            <Pressable
              onPress={confirmSelection}
              style={({ pressed }) => [styles.selectBtnWrap, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel={pendingLineId ? 'Select budget item' : 'Continue without link'}
            >
              <View style={styles.selectBtnInner}>
                <Text style={styles.selectBtnText}>
                  {pendingLineId ? 'Select' : 'Continue without link'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  selector: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectorReadOnly: {
    opacity: 0.92,
  },
  selectorText: { flex: 1, minWidth: 0 },
  selectorTitle: { fontSize: 15, fontWeight: '700' },
  chooseTitle: { fontSize: 16, fontWeight: '800' },
  selectorSubtitle: { fontSize: 12, marginTop: 4 },
  linkedLabel: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  clearText: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  root: {
    flex: 1,
    width: '100%',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingTop: 4,
    alignItems: 'stretch',
    flexGrow: 1,
  },
  exteriorCard: {
    width: '100%',
    alignSelf: 'stretch',
  },
  listCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  pageHeader: {
    position: 'relative',
    minHeight: 56,
    paddingTop: 8,
    paddingBottom: 12,
    justifyContent: 'center',
    marginBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBack: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    paddingHorizontal: 52,
    alignItems: 'center',
    paddingTop: 8,
  },
  backButtonBorder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 1,
    overflow: 'hidden',
  },
  backButton: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.25, lineHeight: 23, textAlign: 'center' },
  sheetSubtitle: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  groupLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 2,
    marginBottom: 10,
  },
  searchShell: {
    width: '100%',
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 14,
  },
  search: {
    width: '100%',
    fontSize: 15,
    padding: 0,
    margin: 0,
    ...(Platform.OS === 'ios'
      ? { paddingVertical: 13 }
      : { textAlignVertical: 'center' as const, includeFontPadding: false }),
  },
  optionsList: {
    gap: 0,
  },
  equipmentDivider: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 10,
  },
  equipmentDividerLine: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  option: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionLast: {
    borderBottomWidth: 0,
  },
  optionText: { flex: 1, minWidth: 0, marginRight: 10 },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  optionName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  optionMeta: { fontSize: 15, marginTop: 4, fontWeight: '600' },
  optionSpent: { fontSize: 15, marginTop: 6, fontWeight: '700' },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeOver: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  badgeText: { fontSize: 10, fontWeight: '600' },
  unlinkedSection: { marginTop: 4 },
  unlinkedHint: { fontSize: 12, marginBottom: 10, lineHeight: 17 },
  unlinkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  unlinkedLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  unlinkedAmount: { fontSize: 13, fontWeight: '700' },
  empty: { textAlign: 'center', paddingVertical: 24, fontSize: 13 },
  footer: {
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  footerWarning: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  selectBtnWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 48,
  },
  selectBtnInner: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2dcc9a',
    minHeight: 48,
  },
  selectBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#050B13',
    letterSpacing: 0.3,
  },
});
