import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScopeActualComparison } from '@/utils/estimateFeedback';
import {
  submitCloseoutCalibration,
  type CloseoutCalibrationResult,
} from '@/utils/contractorPricingMemory';
import { formatMoneyFull } from '@/src/lib/budgetUtils';
import { BRAND_FRAME_GRADIENT_COLORS } from '@/constants/brandFrameGradient';
import { PROJECT_WIDE_CONTAINER_CARD_INSET } from '@/constants/ScreenLayout';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import {
  AI_FLOW_CARD_BG_DARK,
  ESTIMATE_FLOW_NESTED_CARD_BG_DARK,
  ESTIMATE_FLOW_TEXT_LABEL_DARK,
  ESTIMATE_FLOW_TEXT_MUTED_DARK,
  ESTIMATE_FLOW_TEXT_SECONDARY_DARK,
} from '@/utils/estimateFlowCardStyle';
import {
  buildRateInsightSections,
  countRateInsightRows,
  formatCategoryBudgetExplanation,
  formatRateInsightLineEstimate,
  formatRateInsightLoggedLabel,
  getRateInsightSpendStatus,
  normalizeExpenseForMatching,
  resolveProjectEstimateData,
  type RateInsightLineItem,
  type RateInsightSection,
  type RateInsightSpendStatus,
} from '@/utils/rateInsightComparisons';

const SPEND_STATUS_STYLES: Record<
  RateInsightSpendStatus,
  { backgroundColor: string; borderColor: string; loggedColor: string }
> = {
  none: {
    backgroundColor: ESTIMATE_FLOW_NESTED_CARD_BG_DARK,
    borderColor: 'rgba(148,163,184,0.12)',
    loggedColor: ESTIMATE_FLOW_TEXT_SECONDARY_DARK,
  },
  on_track: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.45)',
    loggedColor: '#4ade80',
  },
  over: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    loggedColor: '#f87171',
  },
};

type Props = {
  visible: boolean;
  onClose: () => void;
  projectLike: Record<string, unknown> | null | undefined;
  clientSuggestions?: unknown[];
  scopeComparisons?: ScopeActualComparison[];
  projectStatus?: string;
  darkMode?: boolean;
  /** @deprecated Approval is disabled — kept for call-site compatibility. */
  budgetAccessMode?: 'owner' | 'cost_control';
  onApproved?: (count: number) => void;
};

function formatMoney(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return formatMoneyFull(amount, { decimals: 0 });
}

function formatVariancePct(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function LineItemCard({
  line,
  nestedCardBg,
  cardBorder,
  text,
  secondary,
  muted,
  darkMode,
}: {
  line: RateInsightLineItem;
  nestedCardBg: string;
  cardBorder: string;
  text: string;
  secondary: string;
  muted: string;
  darkMode: boolean;
}) {
  const estimateDetail = formatRateInsightLineEstimate(line);
  const spendStatus = getRateInsightSpendStatus(line);
  const statusStyle = SPEND_STATUS_STYLES[spendStatus];
  const loggedLabel = formatRateInsightLoggedLabel(line);
  const cardBg =
    spendStatus === 'none'
      ? nestedCardBg
      : darkMode
        ? statusStyle.backgroundColor
        : statusStyle.backgroundColor;
  const borderColor = spendStatus === 'none' ? cardBorder : statusStyle.borderColor;

  return (
    <View style={[styles.lineCard, { backgroundColor: cardBg, borderColor }]}>
      <Text style={[styles.lineTitle, { color: text }]} numberOfLines={2}>
        {line.name}
      </Text>
      <Text style={[styles.lineMeta, { color: secondary }]}>
        Estimated {formatMoney(line.estimatedTotal)}
        {estimateDetail ? ` (${estimateDetail})` : ''}
      </Text>
      {line.loggedTotal > 0 ? (
        <Text style={[styles.lineMeta, styles.loggedMeta, { color: statusStyle.loggedColor }]}>
          Logged {formatMoney(line.loggedTotal)}
          {loggedLabel ? ` · ${loggedLabel}` : ''}
        </Text>
      ) : (
        <Text style={[styles.lineMetaMuted, { color: muted }]}>No costs logged for this line yet</Text>
      )}
      {line.expenses.map((expense) => (
        <Text key={expense.id} style={[styles.expenseRow, { color: muted }]}>
          · {expense.label} — {formatMoney(expense.amount)}
        </Text>
      ))}
    </View>
  );
}

function SectionCard({
  section,
  outerCardBg,
  nestedCardBg,
  cardBorder,
  text,
  secondary,
  label,
  muted,
  darkMode,
}: {
  section: RateInsightSection;
  outerCardBg: string;
  nestedCardBg: string;
  cardBorder: string;
  text: string;
  secondary: string;
  label: string;
  muted: string;
  darkMode: boolean;
}) {
  const sectionVariance = formatVariancePct(
    section.estimatedTotal > 0 && section.loggedTotal > 0
      ? Math.round(((section.loggedTotal - section.estimatedTotal) / section.estimatedTotal) * 100)
      : null
  );

  return (
    <View style={[styles.outerCard, { backgroundColor: outerCardBg, borderColor: cardBorder }]}>
      <Text style={[styles.sectionLabel, { color: label }]}>{section.title}</Text>
      <Text style={[styles.sectionTotals, { color: text }]}>
        Est. {formatMoney(section.estimatedTotal)} · Logged {formatMoney(section.loggedTotal)}
        {sectionVariance ? ` (${sectionVariance})` : ''}
      </Text>
      {section.budgetOnly ? (
        <Text style={[styles.budgetOnlyNote, { color: muted }]}>
          {formatCategoryBudgetExplanation(section.key as 'materials' | 'labor' | 'other')}
        </Text>
      ) : null}
      {section.lineItems.map((line) => (
        <LineItemCard
          key={line.id}
          line={line}
          nestedCardBg={nestedCardBg}
          cardBorder={cardBorder}
          text={text}
          secondary={secondary}
          muted={muted}
          darkMode={darkMode}
        />
      ))}
      {section.unlinkedExpenses.length > 0 ? (
        <View style={[styles.unlinkedBlock, { borderColor: cardBorder }]}>
          <Text style={[styles.unlinkedLabel, { color: label }]}>Logged costs (not linked to a line)</Text>
          {section.unlinkedExpenses.map((expense) => (
            <Text key={expense.id} style={[styles.expenseRow, { color: muted }]}>
              · {expense.label} — {formatMoney(expense.amount)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function isProjectCloseout(status?: string): boolean {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'completed' || normalized === 'complete' || normalized === 'closed';
}

function formatSummaryStatus(status?: string): string {
  return String(status || 'building data')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function CalibrationReviewModal({
  visible,
  onClose,
  projectLike,
  scopeComparisons = [],
  projectStatus,
  darkMode = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [closeout, setCloseout] = useState<CloseoutCalibrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectData = (projectLike?.projectData as Record<string, unknown> | undefined) || projectLike || {};
  const estimateData = useMemo(() => resolveProjectEstimateData(projectLike), [projectLike]);
  const expenses = useMemo(
    () =>
      ((projectData.expenses as Array<Record<string, unknown>>) || []).map(normalizeExpenseForMatching),
    [projectData.expenses]
  );

  const insightSections = useMemo(
    () =>
      buildRateInsightSections({
        estimateData,
        expenses,
        scopeComparisons,
      }),
    [estimateData, expenses, scopeComparisons]
  );
  const insightRowCount = countRateInsightRows(insightSections);
  const isCloseout = isProjectCloseout(projectStatus);

  const load = useCallback(async () => {
    if (!projectLike?.id && !(projectLike as any)?.projectData) {
      setError('No project loaded.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await submitCloseoutCalibration(projectLike);
      setCloseout(result);
      if (result.success === false && result.message) {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rate insights');
    } finally {
      setLoading(false);
    }
  }, [projectLike]);

  useEffect(() => {
    if (visible) {
      void load();
    } else {
      setCloseout(null);
      setError(null);
    }
  }, [visible, load]);

  const pageBg = darkMode ? '#000000' : '#F8FAFC';
  const outerCardBg = darkMode ? AI_FLOW_CARD_BG_DARK : '#FFFFFF';
  const nestedCardBg = darkMode ? ESTIMATE_FLOW_NESTED_CARD_BG_DARK : '#F1F5F9';
  const cardBorder = darkMode ? 'rgba(148,163,184,0.12)' : '#E2E8F0';
  const text = darkMode ? '#F5F7FA' : '#0F172A';
  const secondary = darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : '#64748B';
  const label = darkMode ? ESTIMATE_FLOW_TEXT_LABEL_DARK : '#64748B';
  const muted = darkMode ? ESTIMATE_FLOW_TEXT_MUTED_DARK : '#94A3B8';
  const pageInset = PROJECT_WIDE_CONTAINER_CARD_INSET;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: pageBg, paddingTop: insets.top }]}>
        <View style={[styles.header, { paddingHorizontal: pageInset }]}>
          <View style={[styles.headerBack, { left: pageInset }]}>
            {darkMode ? (
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backButtonBorder}
              >
                <GradientRingBackInner
                  darkMode
                  onPress={onClose}
                  style={[styles.backButton, { backgroundColor: '#000000' }]}
                >
                  <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
                </GradientRingBackInner>
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backButtonBorder}
              >
                <GradientRingBackInner
                  darkMode={false}
                  onPress={onClose}
                  style={[styles.backButton, { backgroundColor: '#FFFFFF' }]}
                >
                  <MaterialIcons name="arrow-back" size={22} color="#0F172A" />
                </GradientRingBackInner>
              </LinearGradient>
            )}
          </View>
          <View style={styles.headerCenter}>
            <Text style={[styles.title, { color: text }]}>Rate insights</Text>
            <Text style={[styles.subtitle, { color: secondary }]}>
              For information only — saved rates are not changed from this screen.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={darkMode ? ESTIMATE_FLOW_TEXT_SECONDARY_DARK : '#64748B'} />
            <Text style={[styles.subtitle, { color: muted, marginTop: 12 }]}>Comparing estimate vs actual…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingHorizontal: pageInset, paddingBottom: 24 + insets.bottom }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {closeout?.summary ? (
              <View style={[styles.outerCard, { backgroundColor: outerCardBg, borderColor: cardBorder }]}>
                <Text style={[styles.sectionLabel, { color: label }]}>
                  {isCloseout ? 'This close-out' : 'This job so far'}
                </Text>
                <Text style={[styles.summaryValue, { color: text }]}>
                  {formatSummaryStatus(closeout.status)}
                </Text>
                {closeout.message ? (
                  <Text style={[styles.bodyText, { color: secondary }]}>{closeout.message}</Text>
                ) : (
                  <Text style={[styles.bodyText, { color: secondary }]}>
                    {insightRowCount
                      ? `${insightRowCount} line${insightRowCount === 1 ? '' : 's'} compared between your estimate and logged costs.`
                      : 'No meaningful differences found yet.'}
                  </Text>
                )}
                {!isCloseout && insightSections.some((s) => s.loggedTotal > 0 && s.loggedTotal < s.estimatedTotal * 0.5) ? (
                  <View style={[styles.noteCard, { backgroundColor: nestedCardBg, borderColor: cardBorder }]}>
                    <Text style={[styles.noteText, { color: muted }]}>
                      Job still in progress — logged costs may be incomplete until all expenses are entered.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {error ? (
              <View style={[styles.outerCard, { backgroundColor: outerCardBg, borderColor: cardBorder }]}>
                <Text style={[styles.bodyText, { color: '#fbbf24' }]}>{error}</Text>
              </View>
            ) : null}

            {insightSections.length > 0 ? (
              <>
                <View style={[styles.outerCard, { backgroundColor: outerCardBg, borderColor: cardBorder }]}>
                  <Text style={[styles.sectionLabel, { color: label }]}>Estimated vs logged</Text>
                <Text style={[styles.bodyText, { color: muted, marginTop: 4 }]}>
                  Each estimate line is listed below. Expenses auto-match by name when possible;
                  link manually in Budget for certainty. Green = on or under budget, red = over.
                </Text>
                <View style={[styles.legendRow, { borderColor: cardBorder }]}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: SPEND_STATUS_STYLES.on_track.backgroundColor, borderColor: SPEND_STATUS_STYLES.on_track.borderColor }]} />
                    <Text style={[styles.legendText, { color: muted }]}>On budget</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: SPEND_STATUS_STYLES.over.backgroundColor, borderColor: SPEND_STATUS_STYLES.over.borderColor }]} />
                    <Text style={[styles.legendText, { color: muted }]}>Over budget</Text>
                  </View>
                </View>
                </View>
                {insightSections.map((section) => (
                  <SectionCard
                    key={section.key}
                    section={section}
                    outerCardBg={outerCardBg}
                    nestedCardBg={nestedCardBg}
                    cardBorder={cardBorder}
                    text={text}
                    secondary={secondary}
                    label={label}
                    muted={muted}
                    darkMode={darkMode}
                  />
                ))}
              </>
            ) : (
              <View style={[styles.outerCard, { backgroundColor: outerCardBg, borderColor: cardBorder, alignItems: 'center' }]}>
                <MaterialIcons name="insights" size={28} color={muted} />
                <Text style={[styles.emptyTitle, { color: text, marginTop: 10 }]}>No insights yet</Text>
                <Text style={[styles.bodyText, { color: muted, textAlign: 'center' }]}>
                  Log expenses and link them to estimate lines to see how actuals compare to your bid.
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        <View
          style={[
            styles.footer,
            {
              borderTopColor: cardBorder,
              backgroundColor: pageBg,
              paddingHorizontal: pageInset,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <Pressable onPress={onClose} style={styles.doneBtn} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={[styles.doneText, { color: text }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    position: 'relative',
    minHeight: 56,
    paddingBottom: 12,
    justifyContent: 'center',
  },
  headerBack: {
    position: 'absolute',
    top: 0,
    zIndex: 2,
  },
  headerCenter: {
    paddingHorizontal: 52,
    alignItems: 'center',
    paddingTop: 2,
  },
  backButtonBorder: {
    borderRadius: 22,
    padding: 1,
    overflow: 'hidden',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  scroll: {
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: -0.3,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  noteCard: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 17,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sectionTotals: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  budgetOnlyNote: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  lineCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  lineTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  lineMeta: {
    fontSize: 13,
    marginTop: 5,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  lineMetaMuted: {
    fontSize: 12,
    marginTop: 5,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  loggedMeta: {
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 12,
  },
  expenseRow: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    paddingLeft: 2,
  },
  unlinkedBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  unlinkedLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneBtn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
