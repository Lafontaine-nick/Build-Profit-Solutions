import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import type { getColors } from '@/theme/getColors';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';
import type { AssemblyComponentStatus } from '@/utils/scopeAssemblyRegistry';
import {
  buildScopeGapResolutionPrompt,
  buildScopeReviewFooterText,
  buildScopeReviewSheetSubtitle,
  buildScopeReviewSheetTitle,
  benchmarkAssumptionForComponent,
  benchmarkAssumptionRowLabel,
  benchmarkResolutionPrefillStatus,
  benchmarkScopeSummary,
  countNeedsSeparatePricing,
  countReviewedScopeGaps,
  countUnresolvedScopeDecisions,
  getScopeGapDisplayLabel,
  getScopeGapRecord,
  scopeGapStatusRowLabel,
  scopeReviewRecommendedActionLabel,
  scopeReviewRowGuidance,
  setScopeGapResolution,
  scopeGapResolutionActionGroups,
  shouldAutoExpandScopeGapMoreOptions,
  type ScopeGapPricingContext,
  type ScopeGapResolutionStatus,
  type ScopeGapResolutionsMap,
} from '@/utils/scopeReviewUi';
import type {
  BenchmarkScopeAssumption,
  BenchmarkScopeAssumptionProfile,
  BenchmarkScopeAssumptionStatus,
} from '@/utils/benchmarkScopeAssumptions';
import { parsePricingAmount } from '@/utils/acceptedPricingSummaryUi';
import {
  trackScopeGapStatusChanged,
  trackScopeReviewClosed,
  trackScopeReviewOpened,
} from '@/utils/scopeReviewAnalytics';

type Props = {
  visible: boolean;
  scopeItemId: string;
  scopeItemLabel: string;
  priceLabel: string;
  components: AssemblyComponentStatus[];
  benchmarkProfile?: BenchmarkScopeAssumptionProfile;
  resolutions?: ScopeGapResolutionsMap;
  pricingContext?: ScopeGapPricingContext;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
  onClose: () => void;
  onResolve: (next: ScopeGapResolutionsMap) => void;
  onPriceSeparately?: (
    componentKey: string,
    component: AssemblyComponentStatus,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
  onIncludeInParentPrice?: (
    componentKey: string,
    component: AssemblyComponentStatus,
    addonAmount: number,
    benchmarkAssumption?: BenchmarkScopeAssumption | null,
    benchmarkProfile?: BenchmarkScopeAssumptionProfile | null
  ) => void;
};

function statusColor(
  record: ReturnType<typeof getScopeGapRecord>,
  darkMode: boolean,
  pricingContext?: ScopeGapPricingContext
): string {
  if (!record || record.status === 'not_confirmed') return '#f59e0b';
  if (record.status === 'included') return '#22c55e';
  if (record.status === 'excluded') return darkMode ? 'rgba(255,255,255,0.55)' : '#64748b';
  if (record.status === 'priced_elsewhere') return '#60a5fa';
  if (record.status === 'price_separately') {
    const rowLabel = scopeGapStatusRowLabel(record, pricingContext);
    return rowLabel === 'Needs separate price' ? '#f59e0b' : '#a78bfa';
  }
  return '#f59e0b';
}

export default function ScopeReviewSheet({
  visible,
  scopeItemId,
  scopeItemLabel,
  priceLabel,
  components,
  benchmarkProfile,
  resolutions,
  pricingContext,
  Colors,
  darkMode,
  onClose,
  onResolve,
  onPriceSeparately,
  onIncludeInParentPrice,
}: Props) {
  const insets = useSafeAreaInsets();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [includeCostKey, setIncludeCostKey] = useState<string | null>(null);
  const [includeCostAmount, setIncludeCostAmount] = useState('');
  const [moreOptionsKey, setMoreOptionsKey] = useState<string | null>(null);

  const unresolvedDecisionCount = useMemo(
    () => countUnresolvedScopeDecisions(scopeItemId, components, resolutions),
    [scopeItemId, components, resolutions]
  );
  const reviewedCount = useMemo(
    () => countReviewedScopeGaps(scopeItemId, components, resolutions, pricingContext),
    [scopeItemId, components, resolutions, pricingContext]
  );
  const needsPricingCount = useMemo(
    () => countNeedsSeparatePricing(scopeItemId, components, resolutions, pricingContext),
    [scopeItemId, components, resolutions, pricingContext]
  );

  const footerText = useMemo(
    () =>
      buildScopeReviewFooterText({
        total: components.length,
        unresolvedDecisionCount,
        reviewedCount,
        needsPricingCount,
      }),
    [components.length, unresolvedDecisionCount, reviewedCount, needsPricingCount]
  );
  const summary = useMemo(
    () => benchmarkScopeSummary(benchmarkProfile, priceLabel, scopeItemId),
    [benchmarkProfile, priceLabel, scopeItemId]
  );

  const openSheet = useCallback(() => {
    trackScopeReviewOpened({
      tradeOrCategory: scopeItemId,
      unresolvedCount: unresolvedDecisionCount + needsPricingCount,
    });
  }, [scopeItemId, unresolvedDecisionCount, needsPricingCount]);

  React.useEffect(() => {
    if (visible) {
      openSheet();
      setExpandedKey(null);
      setIncludeCostKey(null);
      setIncludeCostAmount('');
      setMoreOptionsKey(null);
    }
  }, [visible, openSheet]);

  const handleClose = () => {
    trackScopeReviewClosed({
      tradeOrCategory: scopeItemId,
      unresolvedCount: unresolvedDecisionCount + needsPricingCount,
    });
    setExpandedKey(null);
    setMoreOptionsKey(null);
    onClose();
  };

  const applyStatus = (component: AssemblyComponentStatus, status: ScopeGapResolutionStatus) => {
    const benchmarkAssumption = benchmarkAssumptionForComponent(benchmarkProfile, component);
    if (status === 'price_separately') {
      onPriceSeparately?.(component.key, component, benchmarkAssumption, benchmarkProfile);
      setExpandedKey(null);
      setMoreOptionsKey(null);
      return;
    }
    const previous = getScopeGapRecord(resolutions, scopeItemId, component.key)?.status || 'not_confirmed';
    const next = setScopeGapResolution(resolutions, scopeItemId, component.key, status, {
      parentScopeItemId: scopeItemId,
      pricingContext,
      benchmarkAssumption,
      benchmarkProfile,
    });
    onResolve(next);
    trackScopeGapStatusChanged({
      tradeOrCategory: scopeItemId,
      gapIdentifier: component.key,
      previousStatus: previous,
      newStatus: status,
      unresolvedCount: countUnresolvedScopeDecisions(scopeItemId, components, next),
    });
    setExpandedKey(null);
    setMoreOptionsKey(null);
  };

  const caption = darkMode ? 'rgba(255,255,255,0.62)' : Colors.sub;
  const headerTopPadding =
    Platform.OS === 'ios' ? 8 : Math.max(insets.top, 8);

  const offersIncludeWithCost = (assumptionStatus?: BenchmarkScopeAssumptionStatus) =>
    (assumptionStatus === 'excluded' || assumptionStatus == null) && Boolean(onIncludeInParentPrice);

  const submitIncludeWithCost = (component: AssemblyComponentStatus) => {
    const addonAmount = parsePricingAmount(includeCostAmount);
    if (!addonAmount) return;
    const benchmarkAssumption = benchmarkAssumptionForComponent(benchmarkProfile, component);
    onIncludeInParentPrice?.(component.key, component, addonAmount, benchmarkAssumption, benchmarkProfile);
    setIncludeCostKey(null);
    setIncludeCostAmount('');
    setExpandedKey(null);
    setMoreOptionsKey(null);
  };

  const renderActionButton = (
    component: AssemblyComponentStatus,
    choice: { status: ScopeGapResolutionStatus; label: string },
    record: ReturnType<typeof getScopeGapRecord>,
    displayLabel: string,
    subdued?: boolean
  ) => (
    <TouchableOpacity
      key={choice.status}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${choice.label} for ${displayLabel}`}
      onPress={() => applyStatus(component, choice.status)}
      style={[
        styles.actionBtn,
        record?.status === choice.status && styles.actionBtnActive,
        {
          borderColor:
            record?.status === choice.status
              ? '#22c55e'
              : darkMode
                ? 'rgba(255,255,255,0.15)'
                : Colors.line,
          opacity: subdued ? 0.92 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: record?.status === choice.status ? '#22c55e' : Colors.text,
          fontSize: subdued ? 13 : 14,
          fontWeight: subdued ? '600' : '700',
          textAlign: 'center',
        }}
      >
        {choice.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={handleClose}
    >
      <View style={[styles.shell, { backgroundColor: Colors.bg }]}>
        <View style={[styles.headerRow, { paddingTop: headerTopPadding }]}>
          <View style={styles.headerSide}>
            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={BRAND_FRAME_GRADIENT_START}
              end={BRAND_FRAME_GRADIENT_END}
              style={styles.backButtonBorder}
            >
              <GradientRingBackInner
                darkMode={darkMode}
                onPress={handleClose}
                accessibilityLabel="Close scope review"
                style={[styles.backButton, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={24}
                  color={darkMode ? '#FFFFFF' : Colors.text}
                />
              </GradientRingBackInner>
            </LinearGradient>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: Colors.text }]} accessibilityRole="header">
              {buildScopeReviewSheetTitle(scopeItemLabel)}
            </Text>
            <Text style={[styles.subtitle, { color: caption }]} numberOfLines={4}>
              {buildScopeReviewSheetSubtitle(scopeItemLabel, priceLabel, {
                scopeKey: scopeItemId,
                benchmarkProfile,
              })}
            </Text>
          </View>
          <View style={styles.headerSide} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.assumptionSummary,
              estimateFlowCardStyle(Colors, darkMode),
            ]}
          >
            <Text style={[styles.summaryTitle, { color: Colors.text }]}>{summary.title}</Text>
            <Text style={[styles.summaryBody, { color: caption }]}>{summary.body}</Text>
            {summary.included.length ? (
              <Text style={[styles.summaryBody, { color: caption }]}>
                Included: {summary.included.join(', ')}
              </Text>
            ) : null}
            {summary.notIncluded.length ? (
              <Text style={[styles.summaryBody, { color: caption }]}>
                Not included: {summary.notIncluded.join(', ')}
              </Text>
            ) : null}
            {summary.conditional.length ? (
              <Text style={[styles.summaryBody, { color: caption }]}>
                Conditional: {summary.conditional.join('; ')}
              </Text>
            ) : null}
          </View>
          {components.map((component) => {
            const displayLabel = getScopeGapDisplayLabel(component.key, component.label);
            const benchmarkAssumption = benchmarkAssumptionForComponent(benchmarkProfile, component);
            const benchmarkLabel = benchmarkAssumptionRowLabel(benchmarkProfile, component);
            const record = getScopeGapRecord(resolutions, scopeItemId, component.key);
            const prefillStatus = benchmarkResolutionPrefillStatus({
              record,
              benchmarkProfile,
              component,
            });
            const rowLabel = scopeGapStatusRowLabel(record, pricingContext, prefillStatus);
            const guidance = scopeReviewRowGuidance(scopeItemId, component, benchmarkProfile);
            const recommendedAction = scopeReviewRecommendedActionLabel({
              scopeKey: scopeItemId,
              component,
              benchmarkProfile,
            });
            const expanded = expandedKey === component.key;
            const actionGroups = scopeGapResolutionActionGroups(benchmarkAssumption?.status, {
              offersIncludeWithCost: offersIncludeWithCost(benchmarkAssumption?.status),
            });
            const showMoreOptions = moreOptionsKey === component.key;
            return (
              <View
                key={component.key}
                style={[
                  styles.rowCard,
                  estimateFlowCardStyle(Colors, darkMode),
                  { padding: 0 },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`${displayLabel}, ${rowLabel}`}
                  accessibilityState={{ expanded }}
                  onPress={() => {
                    if (expanded) {
                      setExpandedKey(null);
                      setIncludeCostKey(null);
                      setIncludeCostAmount('');
                      setMoreOptionsKey(null);
                      return;
                    }
                    setExpandedKey(component.key);
                    setIncludeCostKey(null);
                    setIncludeCostAmount('');
                    setMoreOptionsKey(
                      shouldAutoExpandScopeGapMoreOptions(record, actionGroups) ? component.key : null
                    );
                  }}
                  style={styles.rowTap}
                >
                  <View style={styles.rowTextStack}>
                    <Text style={[styles.rowLabel, { color: Colors.text }]} numberOfLines={2}>
                      {displayLabel}
                    </Text>
                    <Text style={[styles.benchmarkLabel, { color: caption }]} numberOfLines={2}>
                      {benchmarkLabel}
                    </Text>
                    {guidance ? (
                      <Text style={[styles.guidanceLabel, { color: caption }]} numberOfLines={3}>
                        {guidance.guidanceText}
                      </Text>
                    ) : benchmarkAssumption?.conditionText ? (
                      <Text style={[styles.guidanceLabel, { color: caption }]} numberOfLines={3}>
                        {benchmarkAssumption.conditionText}
                      </Text>
                    ) : null}
                    {recommendedAction ? (
                      <Text style={[styles.recommendedLabel, { color: darkMode ? '#93c5fd' : '#2563eb' }]} numberOfLines={2}>
                        {recommendedAction}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.rowRight}>
                    <Text
                      style={[styles.rowStatus, { color: statusColor(record, darkMode, pricingContext) }]}
                      accessibilityLabel={rowLabel}
                    >
                      {rowLabel}
                    </Text>
                    <MaterialIcons
                      name={expanded ? 'expand-less' : 'chevron-right'}
                      size={20}
                      color={caption}
                    />
                  </View>
                </TouchableOpacity>

                {expanded ? (
                  <View style={styles.actions}>
                    <Text style={[styles.prompt, { color: caption }]}>
                      {buildScopeGapResolutionPrompt(
                        displayLabel,
                        priceLabel,
                        scopeItemLabel,
                        benchmarkAssumption?.status
                      )}
                    </Text>
                    {offersIncludeWithCost(benchmarkAssumption?.status) && onIncludeInParentPrice ? (
                      includeCostKey === component.key ? (
                        <View style={styles.includeCostForm}>
                          <Text style={[styles.prompt, { color: caption, marginBottom: 8 }]}>
                            Add to {scopeItemLabel.toLowerCase()} price
                          </Text>
                          <TextInput
                            value={includeCostAmount}
                            onChangeText={setIncludeCostAmount}
                            placeholder="Amount ($)"
                            placeholderTextColor={darkMode ? 'rgba(255,255,255,0.35)' : '#94a3b8'}
                            keyboardType="decimal-pad"
                            style={[
                              styles.includeCostInput,
                              {
                                color: Colors.text,
                                borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
                                backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
                              },
                            ]}
                            accessibilityLabel={`Amount to add for ${displayLabel}`}
                          />
                          <TouchableOpacity
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={`Add ${displayLabel} to ${scopeItemLabel} price`}
                            disabled={!parsePricingAmount(includeCostAmount)}
                            onPress={() => submitIncludeWithCost(component)}
                            style={[
                              styles.actionBtn,
                              styles.includeCostApplyBtn,
                              {
                                borderColor: parsePricingAmount(includeCostAmount) ? '#22c55e' : Colors.line,
                                opacity: parsePricingAmount(includeCostAmount) ? 1 : 0.55,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: parsePricingAmount(includeCostAmount) ? '#22c55e' : Colors.text,
                                fontSize: 14,
                                fontWeight: '700',
                                textAlign: 'center',
                              }}
                            >
                              Add to {scopeItemLabel.toLowerCase()} price
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.75}
                            onPress={() => {
                              setIncludeCostKey(null);
                              setIncludeCostAmount('');
                            }}
                            style={[
                              styles.cancelBtn,
                              {
                                borderColor: darkMode ? 'rgba(148, 163, 184, 0.35)' : Colors.line,
                              },
                            ]}
                            accessibilityRole="button"
                          >
                            <Text style={{ color: caption, fontSize: 13, fontWeight: '600' }}>Back</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={`Include ${displayLabel} in this price and add cost`}
                          onPress={() => {
                            setIncludeCostKey(component.key);
                            setIncludeCostAmount('');
                          }}
                          style={[
                            styles.actionBtn,
                            styles.includeCostPrimaryBtn,
                            {
                              borderColor: darkMode ? 'rgba(34,197,94,0.45)' : 'rgba(34,197,94,0.35)',
                              backgroundColor: darkMode ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
                            },
                          ]}
                        >
                          <Text style={{ color: '#22c55e', fontSize: 14, fontWeight: '800', textAlign: 'center' }}>
                            Include in this price & add cost
                          </Text>
                        </TouchableOpacity>
                      )
                    ) : null}
                    {includeCostKey !== component.key
                      ? actionGroups.primary.map((choice) =>
                          renderActionButton(component, choice, record, displayLabel)
                        )
                      : null}
                    {includeCostKey !== component.key && actionGroups.moreOptions.length ? (
                      <>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel={`More options for ${displayLabel}`}
                          accessibilityState={{ expanded: showMoreOptions }}
                          onPress={() =>
                            setMoreOptionsKey(showMoreOptions ? null : component.key)
                          }
                          style={styles.moreOptionsToggle}
                        >
                          <Text style={{ color: caption, fontSize: 13, fontWeight: '700' }}>
                            More options
                          </Text>
                          <MaterialIcons
                            name={showMoreOptions ? 'expand-less' : 'expand-more'}
                            size={18}
                            color={caption}
                          />
                        </TouchableOpacity>
                        {showMoreOptions
                          ? actionGroups.moreOptions.map((choice) =>
                              renderActionButton(component, choice, record, displayLabel, true)
                            )
                          : null}
                      </>
                    ) : null}
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => {
                        setExpandedKey(null);
                        setIncludeCostKey(null);
                        setIncludeCostAmount('');
                        setMoreOptionsKey(null);
                      }}
                      style={[
                        styles.cancelBtn,
                        {
                          borderColor: darkMode ? 'rgba(148, 163, 184, 0.35)' : Colors.line,
                        },
                      ]}
                      accessibilityRole="button"
                    >
                      <Text style={{ color: caption, fontSize: 13, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
              backgroundColor: Colors.bg,
            },
          ]}
        >
          <Text style={{ color: caption, fontSize: 12, textAlign: 'center', marginBottom: 10 }}>
            {footerText}
          </Text>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleClose}
            style={styles.doneBtn}
            accessibilityRole="button"
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerSide: { width: 52, alignItems: 'flex-start' },
  backButtonBorder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden',
  },
  backButton: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: { flex: 1, alignItems: 'center', paddingHorizontal: 8, gap: 4 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  subtitle: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  rowCard: { overflow: 'hidden' },
  assumptionSummary: { gap: 5 },
  summaryTitle: { fontSize: 13, fontWeight: '800' },
  summaryBody: { fontSize: 12, lineHeight: 17 },
  rowTap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 44,
  },
  rowTextStack: { flex: 1, gap: 4 },
  rowLabel: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  benchmarkLabel: { fontSize: 11, fontWeight: '700', lineHeight: 15 },
  guidanceLabel: { fontSize: 11, lineHeight: 15 },
  recommendedLabel: { fontSize: 11, fontWeight: '600', lineHeight: 15 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  rowStatus: { fontSize: 12, fontWeight: '700' },
  actions: { paddingHorizontal: 14, paddingBottom: 12, gap: 8 },
  prompt: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionBtnActive: { backgroundColor: 'rgba(34,197,94,0.08)' },
  includeCostPrimaryBtn: {},
  includeCostForm: { gap: 8 },
  includeCostInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 44,
  },
  includeCostApplyBtn: { marginTop: 2 },
  moreOptionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    minHeight: 40,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12 },
  doneBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  doneBtnText: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
});
