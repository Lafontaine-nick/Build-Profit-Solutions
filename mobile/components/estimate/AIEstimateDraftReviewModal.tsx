import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { aiFlowStepTotal, isComplexEstimateTier } from '@/utils/estimateAiDraft';
import {
  draftHasApprovedSuggestions,
  draftHasCombinedRoomPrices,
  formatDraftMoney,
} from '@/utils/estimateAiDraft';
import type { EstimateConfidenceLevel } from '@/utils/estimateAiDraft';
import AIEstimateDraftReviewScopeOnly from '@/components/estimate/AIEstimateDraftReviewScopeOnly';
import AIEstimateDraftReviewPricingActions from '@/components/estimate/AIEstimateDraftReviewPricingActions';
import AIEstimateDraftReviewCompact from '@/components/estimate/AIEstimateDraftReviewCompact';
import AIEstimateDraftReviewDetails from '@/components/estimate/AIEstimateDraftReviewDetails';
import {
  dedupeDraftWarnings,
  draftHasUnpricedScope,
  isScopeOnlyDraft,
} from '@/utils/estimateDraftReviewUi';
import { draftHasApplyablePricing } from '@/utils/estimateAiDraftPricing';

type Props = {
  visible: boolean;
  draft: EstimateAiDraft | null;
  applying?: boolean;
  suggestingSplits?: boolean;
  clarifying?: boolean;
  clarifyQuestions?: string[] | null;
  fromAssistant?: boolean;
  embedded?: boolean;
  onClose: () => void;
  onBack?: () => void;
  onRegenerate: () => void;
  onSuggestSplits?: () => void;
  onClarifyMissing?: () => void;
  onToggleApplySuggestedSplits?: () => void;
  onApproveSuggestedSplit?: (parentItemName: string) => void;
  onApply: () => void;
  onApplyConfirmedOnly?: () => void;
  onApplyWithApproved?: () => void;
  onApplyScopeOnly?: () => void;
  onRequestRoughRange?: () => void;
  roughRangeLoading?: boolean;
  suggestingMissingPrices?: boolean;
  onSuggestMissingPrices?: () => void;
  onUseSavedPricing?: () => void;
  onSuggestRoughPrices?: () => void;
  onAddPricesManually?: () => void;
  saveToPricingLibrary?: boolean;
  onToggleSaveToPricingLibrary?: (value: boolean) => void;
  children?: React.ReactNode;
};

export default function AIEstimateDraftReviewModal({
  visible,
  draft,
  applying = false,
  suggestingSplits = false,
  clarifying = false,
  clarifyQuestions = null,
  fromAssistant = false,
  embedded = false,
  onClose,
  onBack,
  onRegenerate,
  onSuggestSplits,
  onClarifyMissing,
  onToggleApplySuggestedSplits,
  onApproveSuggestedSplit,
  onApply,
  onApplyConfirmedOnly,
  onApplyWithApproved,
  onApplyScopeOnly,
  onRequestRoughRange,
  roughRangeLoading = false,
  suggestingMissingPrices = false,
  onSuggestMissingPrices,
  onUseSavedPricing,
  onSuggestRoughPrices,
  onAddPricesManually,
  saveToPricingLibrary = true,
  onToggleSaveToPricingLibrary,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);

  const handleBack = () => {
    if (applying) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onBack) {
      onBack();
    } else {
      onClose();
    }
  };

  const showSuggestSplits =
    !!onSuggestSplits &&
    !!draft &&
    (draftHasCombinedRoomPrices(draft) || (draft.suggestedSplitRoomCount || 0) > 0);
  const hasSuggestedSplits = (draft?.suggestedSplitRoomCount || 0) > 0;
  const busy = applying || suggestingSplits || clarifying || roughRangeLoading;
  const hasApproved = draftHasApprovedSuggestions(draft);
  const confidenceLevel = draft?.estimateConfidence?.level as EstimateConfidenceLevel | undefined;
  const confidenceColors: Record<EstimateConfidenceLevel, { bg: string; color: string }> = {
    high: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
    medium: { bg: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' },
    low: { bg: 'rgba(248, 113, 113, 0.12)', color: '#f87171' },
  };
  const confStyle = confidenceLevel ? confidenceColors[confidenceLevel] : confidenceColors.medium;
  const scopeOnly = isScopeOnlyDraft(draft);
  const showPricingActions = draftHasUnpricedScope(draft);
  const scopeHasPricing = draftHasApplyablePricing(draft);
  const warnings = draft ? dedupeDraftWarnings(draft) : [];
  const needsReview = draft?.needsReviewItems?.length
    ? draft.needsReviewItems
    : draft?.missingInfo || [];
  const [footerExpanded, setFooterExpanded] = useState(false);
  const footerScrollPadding = scopeOnly
    ? 96 + insets.bottom
    : footerExpanded
      ? 280 + insets.bottom
      : 88 + insets.bottom;
  if (!visible) return null;

  const body = (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <AIEstimateFlowHeader
        title="Review draft"
        subtitle={
          scopeOnly
            ? draft?.scopeAssumptionsConfirmed && isComplexEstimateTier(draft)
              ? 'Scope confirmed — review suggested pricing'
              : 'Scope found — add pricing or save draft'
            : 'Confirm scope and pricing before applying'
        }
        step={aiFlowStepTotal(draft)}
        stepTotal={aiFlowStepTotal(draft)}
        fromAssistant={fromAssistant}
        omitTopSafeArea
        disabled={busy}
        onBack={handleBack}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: footerScrollPadding }}
      >
        {!draft ? (
          <Text style={{ color: Colors.sub, fontSize: 14 }}>No draft to review.</Text>
        ) : scopeOnly ? (
          <AIEstimateDraftReviewScopeOnly
            draft={draft}
            Colors={Colors}
            darkMode={darkMode}
            busy={busy}
            confStyle={confStyle}
            confidenceLevel={confidenceLevel}
            onUseSavedPricing={onUseSavedPricing ?? onSuggestMissingPrices}
            suggestingMissingPrices={suggestingMissingPrices}
            onSuggestRoughPrices={onSuggestRoughPrices ?? onRequestRoughRange}
            roughRangeLoading={roughRangeLoading}
            onAddPricesManually={onAddPricesManually}
            onRegenerate={onRegenerate}
            showDetailsContent={
              <AIEstimateDraftReviewDetails
                draft={draft}
                Colors={Colors}
                darkMode={darkMode}
                busy={busy}
                warnings={warnings}
                needsReview={needsReview}
                onApplyScopeOnly={onApplyScopeOnly}
                onClarifyMissing={onClarifyMissing}
                onRequestRoughRange={onRequestRoughRange}
                roughRangeLoading={roughRangeLoading}
              />
            }
          />
        ) : (
          <>
            {showPricingActions ? (
              <AIEstimateDraftReviewPricingActions
                draft={draft}
                Colors={Colors}
                darkMode={darkMode}
                busy={busy}
                onUseSavedPricing={onUseSavedPricing ?? onSuggestMissingPrices}
                suggestingMissingPrices={suggestingMissingPrices}
                onSuggestRoughPrices={onSuggestRoughPrices ?? onRequestRoughRange}
                roughRangeLoading={roughRangeLoading}
                onAddPricesManually={onAddPricesManually}
              />
            ) : null}
            <AIEstimateDraftReviewCompact
            draft={draft}
            Colors={Colors}
            darkMode={darkMode}
            busy={busy}
            confStyle={confStyle}
            onSuggestMissingPrices={onSuggestMissingPrices}
            suggestingMissingPrices={suggestingMissingPrices}
            onRegenerate={onRegenerate}
            showDetailsContent={
              <AIEstimateDraftReviewDetails
                draft={draft}
                Colors={Colors}
                darkMode={darkMode}
                busy={busy}
                warnings={warnings}
                needsReview={needsReview}
                clarifyQuestions={clarifyQuestions}
                onApplyScopeOnly={onApplyScopeOnly}
                onClarifyMissing={onClarifyMissing}
                onRequestRoughRange={onRequestRoughRange}
                roughRangeLoading={roughRangeLoading}
                onApproveSuggestedSplit={onApproveSuggestedSplit}
                onToggleApplySuggestedSplits={onToggleApplySuggestedSplits}
                showSuggestSplits={showSuggestSplits}
                hasSuggestedSplits={hasSuggestedSplits}
                suggestingSplits={suggestingSplits}
                onSuggestSplits={onSuggestSplits}
                onSuggestMissingPrices={onSuggestMissingPrices}
                suggestingMissingPrices={suggestingMissingPrices}
              />
            }
          />
          </>
        )}

      </ScrollView>

      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: footerExpanded ? 8 : 6,
          paddingBottom: Math.max(insets.bottom, 16),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
          backgroundColor: Colors.bg,
          gap: 10,
        }}
      >
        {!scopeOnly ? (
          footerExpanded ? (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setFooterExpanded(false)}
              style={styles.footerToggleRow}
              accessibilityRole="button"
              accessibilityLabel="Collapse apply options"
            >
              <Text style={{ color: Colors.sub, fontSize: 12, fontWeight: '600' }}>Hide options</Text>
              <MaterialIcons name="keyboard-arrow-down" size={22} color={Colors.sub} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => setFooterExpanded(true)}
              style={styles.footerExpandHandle}
              accessibilityRole="button"
              accessibilityLabel="Show apply options"
            >
              <View
                style={[
                  styles.footerHandleBar,
                  { backgroundColor: darkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)' },
                ]}
              />
            </TouchableOpacity>
          )
        ) : null}

        {footerExpanded ? (
          <>
            {onToggleSaveToPricingLibrary ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: Colors.sub, fontSize: 12, flex: 1, marginRight: 8 }}>
                  Save approved pricing to my library
                </Text>
                <Switch
                  value={saveToPricingLibrary}
                  onValueChange={onToggleSaveToPricingLibrary}
                  disabled={busy}
                />
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={onRegenerate}>
                <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>Edit notes & regenerate</Text>
              </TouchableOpacity>
              {onClarifyMissing ? (
                <>
                  <Text style={{ color: Colors.sub, fontSize: 14 }}>·</Text>
                  <TouchableOpacity activeOpacity={0.88} disabled={busy || !draft} onPress={onClarifyMissing}>
                    {clarifying ? (
                      <ActivityIndicator size="small" color="#60a5fa" />
                    ) : (
                      <Text style={{ color: '#60a5fa', fontSize: 14, fontWeight: '700' }}>What's missing?</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </>
        ) : null}

        {scopeOnly && scopeHasPricing ? (
          <TouchableOpacity activeOpacity={0.88} disabled={!draft || busy} onPress={onApply}>
            <LinearGradient
              colors={draft && !busy ? ['#2DFFC4', '#00A6FF'] : ['#64748b', '#475569']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.primaryBtn}
            >
              {applying ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color="#0f172a" />
                  <Text style={styles.primaryBtnText}>Apply to Estimate</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : scopeOnly && onApplyScopeOnly ? (
          <TouchableOpacity activeOpacity={0.88} disabled={!draft || busy} onPress={onApplyScopeOnly}>
            <LinearGradient
              colors={draft && !busy ? ['#2DFFC4', '#00A6FF'] : ['#64748b', '#475569']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.primaryBtn}
            >
              {applying ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <>
                  <MaterialIcons name="save" size={20} color="#0f172a" />
                  <Text style={styles.primaryBtnText}>Save Scope Draft</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : onApplyConfirmedOnly ? (
          <TouchableOpacity activeOpacity={0.88} disabled={!draft || busy} onPress={onApplyConfirmedOnly}>
            <LinearGradient
              colors={draft && !busy ? ['#2DFFC4', '#00A6FF'] : ['#64748b', '#475569']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.primaryBtn}
            >
              {applying ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color="#0f172a" />
                  <Text style={styles.primaryBtnText}>Apply Confirmed Only</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity activeOpacity={0.88} disabled={!draft || busy} onPress={onApply}>
            <LinearGradient
              colors={draft && !busy ? ['#2DFFC4', '#00A6FF'] : ['#64748b', '#475569']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.primaryBtn}
            >
              {applying ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color="#0f172a" />
                  <Text style={styles.primaryBtnText}>Apply to Estimate</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {footerExpanded && onApplyWithApproved ? (
          <TouchableOpacity
            activeOpacity={0.88}
            disabled={!draft || busy || !hasApproved}
            onPress={onApplyWithApproved}
            style={[
              styles.secondaryBtn,
              {
                borderColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line,
                opacity: hasApproved ? 1 : 0.45,
              },
            ]}
          >
            <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
              Apply With Approved Suggestions
            </Text>
          </TouchableOpacity>
        ) : null}

        {footerExpanded && onApplyScopeOnly ? (
          <TouchableOpacity
            activeOpacity={0.88}
            disabled={!draft || busy}
            onPress={onApplyScopeOnly}
            style={[styles.secondaryBtn, { borderColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line }]}
          >
            <Text style={{ color: Colors.sub, fontSize: 14, fontWeight: '700' }}>
              Save Scope Draft Only
            </Text>
          </TouchableOpacity>
        ) : null}

        {footerExpanded ? (
          <Text style={{ color: Colors.sub, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
            Confirmed & calculated prices from your notes only — no $0 lines. AI suggestions require approval.
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );

  const shell = body;

  if (embedded) {
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.embeddedShell, { backgroundColor: Colors.bg }]}>
        {shell}
      </View>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={handleBack}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top', 'left', 'right']}>
        {shell}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  embeddedShell: {
    zIndex: 101,
    elevation: 101,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  footerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  footerExpandHandle: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  footerHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
