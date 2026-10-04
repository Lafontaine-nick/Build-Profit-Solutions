import React, { useMemo, useState, useCallback } from 'react';
import {
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROJECT_WIDE_CONTAINER_CARD_INSET } from '@/constants/ScreenLayout';
import { formatMoneyFull } from '@/src/lib/budgetUtils';
import { ESTIMATE_FLOW_TRACK_BG_DARK } from '@/utils/estimateFlowCardStyle';
import {
  getEstimateLineSpendSummaries,
  getUnlinkedExpensesForKind,
  resolveProjectEstimateData,
  resolveProjectExpenses,
  sortEstimateLineOptions,
  type EstimateLineSpendSummary,
} from '@/utils/rateInsightComparisons';
import {
  displayEstimateLineName,
  estimateLineOptionsFor,
  type EstimateLineOption,
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

export type EstimateLinePickerKind = 'materials' | 'labor';

export type { EstimateLineOption } from '@/utils/estimateLineOptions';
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

function optionsFor(
  projectLike: Record<string, unknown> | null | undefined,
  kind: EstimateLinePickerKind
): EstimateLineOption[] {
  return estimateLineOptionsFor(resolveProjectEstimateData(projectLike), kind);
}

function displayLineName(name: string): string {
  return displayEstimateLineName(name);
}

function lineCategoryLabel(kind: EstimateLinePickerKind): string {
  return kind === 'materials' ? 'Materials' : 'Labor';
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
  colors,
}: Props) {
  const insets = useSafeAreaInsets();
  const pageInset = PROJECT_WIDE_CONTAINER_CARD_INSET;
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  /** Draft highlight inside the modal; committed via footer Select. */
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);
  const options = useMemo(() => optionsFor(projectLike, kind), [projectLike, kind]);
  const spendInput = useMemo(
    () => ({
      estimateData: resolveProjectEstimateData(projectLike),
      expenses: resolveProjectExpenses(projectLike),
      kind,
      excludeExpenseId,
    }),
    [projectLike, kind, excludeExpenseId]
  );
  const spendSummaries = useMemo(
    () => getEstimateLineSpendSummaries(spendInput),
    [spendInput]
  );
  const unlinkedExpenses = useMemo(
    () => getUnlinkedExpensesForKind(spendInput),
    [spendInput]
  );
  const selected = options.find((item) => item.id === selectedLineId) || null;
  const pendingLine = options.find((item) => item.id === pendingLineId) || null;
  const sortedFiltered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const base = normalized
      ? options.filter((item) => item.name.toLowerCase().includes(normalized))
      : options;
    return sortEstimateLineOptions(base, spendSummaries);
  }, [options, query, spendSummaries]);

  const title = kind === 'materials' ? 'Materials & equipment' : 'Labor';

  const close = useCallback(() => {
    setVisible(false);
    setQuery('');
    setPendingLineId(null);
  }, []);

  const open = useCallback(() => {
    setPendingLineId(selectedLineId ?? null);
    setQuery('');
    setVisible(true);
  }, [selectedLineId]);

  const confirmSelection = useCallback(() => {
    onSelect(pendingLine);
    close();
  }, [close, onSelect, pendingLine]);

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
        spendSummaries[selected.id],
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
        {lineCategoryLabel(kind)} · Budget {formatMoneyFull(selected.budget, { decimals: 0 })}
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
        <Text style={[styles.linkedLabel, { color: colors.accent }]}>Linked to estimate ✓</Text>
      ) : null}
    </>
  ) : null;

  return (
    <>
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>
          {readOnly ? 'Budget item' : 'Link to the estimate'}
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
            accessibilityLabel={selected ? `Selected ${selected.name}` : `Select estimate ${title}`}
          >
            <View style={styles.selectorText}>
              {selected ? (
                selectedSummaryContent
              ) : (
                <>
                  <Text style={[styles.selectorTitle, styles.chooseTitle, { color: colors.accent }]}>
                    Choose from estimate
                  </Text>
                  <Text style={[styles.selectorSubtitle, { color: darkMode ? '#d7e1f0' : colors.secondary }]}>
                    {kind === 'materials'
                      ? 'Pick a material line from this bid'
                      : 'Pick a labor line from this bid'}
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
            <Text style={[styles.clearText, { color: colors.accent }]}>Clear estimate link</Text>
          </Pressable>
        ) : null}
      </View>

      {!readOnly ? (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={close}
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
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Link to estimate</Text>
              <Text style={[styles.sheetSubtitle, { color: darkMode ? '#d7e1f0' : colors.secondary }]}>
                Choose a budget item
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
                {sortedFiltered.map((line, index) => {
                  const rawSummary =
                    spendSummaries[line.id] ??
                    ({
                      loggedTotal: 0,
                      budget: line.budget,
                      remaining: line.budget,
                      variancePct: null,
                      badge: null,
                    } satisfies EstimateLineSpendSummary);
                  const summary = withEditingAmount(
                    rawSummary,
                    line.budget,
                    excludeExpenseId && (line.id === selectedLineId || line.id === pendingLineId)
                      ? editingAmount
                      : null
                  );
                  const isPending = line.id === pendingLineId;
                  const isLast = index === sortedFiltered.length - 1;
                  return (
                    <Pressable
                      key={line.id}
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
                          {lineCategoryLabel(kind)} · Budget{' '}
                          <Text style={{ color: '#2dcc9a', fontWeight: '700' }}>
                            {formatMoneyFull(line.budget, { decimals: 0 })}
                          </Text>
                          {line.quantity && line.unit ? ` · ${line.quantity} ${line.unit}` : ''}
                        </Text>
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
              {!sortedFiltered.length ? (
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
              accessibilityLabel={pendingLineId ? 'Select estimate line' : 'Continue without estimate link'}
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
