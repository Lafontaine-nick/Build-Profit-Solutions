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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import AIEstimateDisclaimer from '@/components/estimate/AIEstimateDisclaimer';
import AIEstimateDraftStatusBadge from '@/components/estimate/AIEstimateDraftStatusBadge';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import {
  draftHasApprovedSuggestions,
  draftHasCombinedRoomPrices,
  formatDraftMoney,
  getScopePackages,
} from '@/utils/estimateAiDraft';
import type { EstimateConfidenceLevel } from '@/utils/estimateAiDraft';
import ContractorPricingMemorySettings from '@/components/estimate/ContractorPricingMemorySettings';
import ContractorPricingLibraryModal from '@/components/estimate/ContractorPricingLibraryModal';
import AIEstimateDraftReviewScopeOnly from '@/components/estimate/AIEstimateDraftReviewScopeOnly';
import { dedupeDraftWarnings, isScopeOnlyDraft } from '@/utils/estimateDraftReviewUi';
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
};

function SectionCard({
  title,
  children,
  Colors,
  darkMode,
}: {
  title: string;
  children: React.ReactNode;
  Colors: ReturnType<typeof getColors>;
  darkMode: boolean;
}) {
  return (
    <View
      style={{
        marginBottom: 12,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
        backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
      }}
    >
      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}

function PriceRow({
  label,
  value,
  Colors,
  highlight,
}: {
  label: string;
  value: string;
  Colors: ReturnType<typeof getColors>;
  highlight?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ color: Colors.sub, fontSize: 13 }}>{label}</Text>
      <Text
        style={{
          color: highlight ? '#22c55e' : Colors.text,
          fontSize: 14,
          fontWeight: '700',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

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
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);

  const handleBack = () => {
    if (applying) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (fromAssistant && onBack) {
      onBack();
    } else {
      onClose();
    }
  };

  const scopePackages = useMemo(() => (draft ? getScopePackages(draft) : []), [draft]);
  const pricedRoomCount = draft?.rooms.filter((room) => room.price != null).length ?? 0;
  const showSuggestSplits =
    !!onSuggestSplits &&
    !!draft &&
    (draftHasCombinedRoomPrices(draft) || (draft.suggestedSplitRoomCount || 0) > 0);
  const hasSuggestedSplits = (draft?.suggestedSplitRoomCount || 0) > 0;
  const previewSplits = (draft?.suggestedSplits || []).filter((s) => s.previewOnly);
  const appliedSplits = (draft?.suggestedSplits || []).filter((s) => !s.previewOnly);
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
  const scopeHasPricing = draftHasApplyablePricing(draft);
  const warnings = draft ? dedupeDraftWarnings(draft) : [];
  const needsReview = draft?.needsReviewItems?.length
    ? draft.needsReviewItems
    : draft?.missingInfo || [];
  const [showPricingMemorySettings, setShowPricingMemorySettings] = useState(false);
  const [showPricingLibrary, setShowPricingLibrary] = useState(false);
  const [footerExpanded, setFooterExpanded] = useState(false);
  const tv = draft?.totalValidation;
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
            ? 'Scope & quantities found — add pricing or save draft'
            : 'Parsed from your notes — confirm before applying'
        }
        step={fromAssistant ? 2 : undefined}
        fromAssistant={fromAssistant}
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
              <>
                {(draft.whatAiDid?.length ?? 0) > 0 ? (
                  <SectionCard title="What AI did" Colors={Colors} darkMode={darkMode}>
                    {draft.whatAiDid!.map((line, i) => (
                      <Text
                        key={`did-${i}`}
                        style={{ color: Colors.sub, fontSize: 13, marginBottom: 6, lineHeight: 18 }}
                      >
                        • {line}
                      </Text>
                    ))}
                  </SectionCard>
                ) : null}
                {(draft.pricingMemoryMissingSuggestions?.length ?? 0) > 0 ? (
                  <SectionCard title="Suggested missing prices" Colors={Colors} darkMode={darkMode}>
                    {draft.pricingMemoryMissingSuggestions!.map((s, i) => (
                      <Text key={`msp-${i}`} style={{ color: Colors.sub, fontSize: 12, marginBottom: 6 }}>
                        • {s.scopeItemName}
                        {s.suggestedUnitRate != null ? `: $${s.suggestedUnitRate}/${s.unitType}` : ''}
                      </Text>
                    ))}
                  </SectionCard>
                ) : null}
                <SectionCard title="Pricing memory" Colors={Colors} darkMode={darkMode}>
                  <TouchableOpacity activeOpacity={0.88} onPress={() => setShowPricingLibrary(true)}>
                    <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700' }}>
                      Review saved pricing library
                    </Text>
                  </TouchableOpacity>
                </SectionCard>
                <SectionCard title="Total validation" Colors={Colors} darkMode={darkMode}>
                  <PriceRow label="Known subtotal" value="—" Colors={Colors} />
                  <PriceRow label="Calculated line items" value="—" Colors={Colors} />
                </SectionCard>
                {warnings.length > 0 ? (
                  <SectionCard title="Pricing warnings" Colors={Colors} darkMode={darkMode}>
                    {warnings.map((warning, index) => (
                      <Text
                        key={`warn-${index}`}
                        style={{ color: '#fbbf24', fontSize: 13, marginBottom: 6, lineHeight: 18 }}
                      >
                        • {warning}
                      </Text>
                    ))}
                  </SectionCard>
                ) : null}
              </>
            }
          />
        ) : (
          <>
              <AIEstimateDisclaimer variant="review" />

              {draft.estimateConfidence ? (
                <View
                  style={{
                    marginBottom: 12,
                    padding: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                    backgroundColor: confStyle.bg,
                  }}
                >
                  <Text style={{ color: confStyle.color, fontSize: 13, fontWeight: '800' }}>
                    {draft.estimateConfidence.label}
                  </Text>
                  <Text style={{ color: Colors.text, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                    {draft.estimateConfidence.summary}
                  </Text>
                </View>
              ) : null}

              {(draft.whatAiDid?.length ?? 0) > 0 ? (
                <SectionCard title="What AI did" Colors={Colors} darkMode={darkMode}>
                  {draft.whatAiDid!.map((line, i) => (
                    <Text
                      key={`did-${i}`}
                      style={{ color: Colors.sub, fontSize: 13, marginBottom: 6, lineHeight: 18 }}
                    >
                      • {line}
                    </Text>
                  ))}
                </SectionCard>
              ) : null}

              {draft.noPricingDetected ? (
                <SectionCard title="No pricing in notes" Colors={Colors} darkMode={darkMode}>
                  <Text style={{ color: Colors.text, fontSize: 13, lineHeight: 18, marginBottom: 10 }}>
                    No pricing was found. What would you like AI to do?
                  </Text>
                  {onApplyScopeOnly ? (
                    <TouchableOpacity
                      activeOpacity={0.88}
                      disabled={busy}
                      onPress={onApplyScopeOnly}
                      style={{ marginBottom: 8 }}
                    >
                      <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700' }}>
                        Structure scope only (save scope, no prices)
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {onClarifyMissing ? (
                    <TouchableOpacity
                      activeOpacity={0.88}
                      disabled={busy}
                      onPress={onClarifyMissing}
                      style={{ marginBottom: 8 }}
                    >
                      <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700' }}>
                        Ask clarifying questions
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {onRequestRoughRange ? (
                    <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={onRequestRoughRange}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {roughRangeLoading ? (
                          <ActivityIndicator size="small" color="#fbbf24" />
                        ) : null}
                        <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '700' }}>
                          Generate rough budget range (AI Rough Estimate)
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                </SectionCard>
              ) : null}

              {(draft.pricingMemorySuggestions?.length ?? 0) > 0 ? (
                <SectionCard title="Based on your pricing history" Colors={Colors} darkMode={darkMode}>
                  <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 8, lineHeight: 17 }}>
                    Suggestions from your past approved bids — approve before applying. Does not change
                    prices automatically.
                  </Text>
                  {draft.pricingMemorySuggestions!.map((s, i) => (
                    <View
                      key={`pm-${i}`}
                      style={{
                        marginBottom: 10,
                        paddingBottom: 10,
                        borderBottomWidth:
                          i < draft.pricingMemorySuggestions!.length - 1 ? StyleSheet.hairlineWidth : 0,
                        borderBottomColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                      }}
                    >
                      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{s.scopeItemName}</Text>
                      <Text style={{ color: '#60a5fa', fontSize: 13, marginTop: 4 }}>
                        Suggested: ${s.suggestedUnitRate}/{s.unitType}
                        {s.estimatedTotal != null ? ` → ${formatDraftMoney(s.estimatedTotal)}` : ''}
                      </Text>
                      <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                        Source: {s.sourceLabel} · Confidence: {s.confidence}
                      </Text>
                    </View>
                  ))}
                </SectionCard>
              ) : draft.pricingMemoryMessage && draft.noPricingDetected ? (
                <SectionCard title="Pricing history" Colors={Colors} darkMode={darkMode}>
                  <Text style={{ color: Colors.sub, fontSize: 13, lineHeight: 18 }}>{draft.pricingMemoryMessage}</Text>
                </SectionCard>
              ) : null}

              {(draft.pricingMemoryMissingSuggestions?.length ?? 0) > 0 ? (
                <SectionCard title="Suggested missing prices" Colors={Colors} darkMode={darkMode}>
                  <Text style={{ color: Colors.sub, fontSize: 12, marginBottom: 8 }}>
                    Priority: your history → templates → regional defaults. Approve before applying.
                  </Text>
                  {draft.pricingMemoryMissingSuggestions!.map((s, i) => (
                    <View key={`msp-${i}`} style={{ marginBottom: 10 }}>
                      <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }}>
                        {s.missingItem}
                      </Text>
                      <Text style={{ color: '#60a5fa', fontSize: 12, marginTop: 2 }}>
                        {s.label}: {s.scopeItemName}
                        {s.suggestedUnitRate != null ? ` — $${s.suggestedUnitRate}/${s.unitType || 'unit'}` : ''}
                        {s.estimatedTotal != null ? ` ≈ ${formatDraftMoney(s.estimatedTotal)}` : ''}
                      </Text>
                      <Text style={{ color: Colors.sub, fontSize: 11 }}>
                        {s.sourceLabel} · {s.confidence} confidence
                      </Text>
                    </View>
                  ))}
                </SectionCard>
              ) : null}

              {(draft.pricingMemoryActualInsights?.length ?? 0) > 0 ? (
                <SectionCard title="Actual cost insights" Colors={Colors} darkMode={darkMode}>
                  {draft.pricingMemoryActualInsights!.map((insight, i) => (
                    <Text
                      key={`insight-${i}`}
                      style={{ color: '#fbbf24', fontSize: 12, marginBottom: 6, lineHeight: 17 }}
                    >
                      • {insight.message}
                    </Text>
                  ))}
                </SectionCard>
              ) : null}

              {draft.roughEstimate ? (
                <SectionCard title="AI Rough Estimate (review required)" Colors={Colors} darkMode={darkMode}>
                  <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '800', marginBottom: 6 }}>
                    {draft.roughEstimate.label} · Low confidence
                  </Text>
                  <PriceRow
                    label="Range"
                    value={`${formatDraftMoney(draft.roughEstimate.low)} – ${formatDraftMoney(draft.roughEstimate.high)}`}
                    Colors={Colors}
                    highlight
                  />
                  <PriceRow
                    label="Midpoint (indicative)"
                    value={formatDraftMoney(draft.roughEstimate.mid)}
                    Colors={Colors}
                  />
                  {(draft.roughEstimate.assumptions || []).map((a, i) => (
                    <Text key={`rough-a-${i}`} style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                      • {a}
                    </Text>
                  ))}
                  <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 8, lineHeight: 16 }}>
                    {draft.roughEstimate.disclaimer}
                  </Text>
                </SectionCard>
              ) : null}

              {draft.bidCompletenessScore != null ? (
                <SectionCard title="Bid completeness" Colors={Colors} darkMode={darkMode}>
                  <Text style={{ color: Colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
                    {draft.bidCompletenessScore}%
                  </Text>
                  {(draft.bidCompletenessGood || []).slice(0, 5).map((line, i) => (
                    <Text key={`good-${i}`} style={{ color: '#22c55e', fontSize: 12, marginBottom: 4 }}>
                      ✓ {line}
                    </Text>
                  ))}
                  {(draft.bidCompletenessNeedsReview || []).slice(0, 4).map((line, i) => (
                    <Text key={`need-${i}`} style={{ color: Colors.sub, fontSize: 12, marginBottom: 4 }}>
                      • {line}
                    </Text>
                  ))}
                </SectionCard>
              ) : null}

              <SectionCard title="Customer / Project" Colors={Colors} darkMode={darkMode}>
              <Text style={{ color: Colors.sub, fontSize: 12 }}>Title</Text>
              <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 8 }}>
                {draft.projectTitle || 'Untitled project'}
              </Text>
              {draft.customerName ? (
                <>
                  <Text style={{ color: Colors.sub, fontSize: 12 }}>Customer</Text>
                  <Text style={{ color: Colors.text, fontSize: 15, marginBottom: 8 }}>{draft.customerName}</Text>
                </>
              ) : (
                <Text style={{ color: Colors.sub, fontSize: 13, marginBottom: 8 }}>Customer not in notes</Text>
              )}
              <Text style={{ color: Colors.sub, fontSize: 12 }}>Type</Text>
              <Text style={{ color: Colors.text, fontSize: 15, marginBottom: 8 }}>
                {draft.projectType.replace(/_/g, ' ')}
              </Text>
              <Text style={{ color: Colors.sub, fontSize: 12 }}>Address</Text>
              {draft.projectAddress ? (
                <Text style={{ color: Colors.text, fontSize: 14 }}>{draft.projectAddress}</Text>
              ) : (
                <Text style={{ color: Colors.sub, fontSize: 13 }}>Project address not in notes</Text>
              )}
            </SectionCard>

            <SectionCard title={`Scope packages (${scopePackages.length})`} Colors={Colors} darkMode={darkMode}>
              {scopePackages.map((pkg, index) => (
                <View
                  key={`${pkg.name}-${index}`}
                  style={{
                    marginBottom: index < scopePackages.length - 1 ? 12 : 0,
                    paddingBottom: index < scopePackages.length - 1 ? 12 : 0,
                    borderBottomWidth: index < scopePackages.length - 1 ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{pkg.name}</Text>
                    <AIEstimateDraftStatusBadge status={pkg.status} />
                  </View>
                  {(pkg.scopeQuantities?.length ?? 0) > 0 ? (
                    <View style={{ marginTop: 6, marginBottom: 6 }}>
                      <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '700' }}>
                        QUANTITIES FOUND (pricing needed)
                      </Text>
                      {pkg.scopeQuantities!.map((q, qi) => (
                        <Text key={`sq-${qi}`} style={{ color: Colors.text, fontSize: 12, marginTop: 4 }}>
                          • {q.label}: {q.quantity} {q.unit}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {pkg.knownSubtotal != null && pkg.knownSubtotal > 0 ? (
                    <View
                      style={{
                        marginTop: 6,
                        marginBottom: 6,
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: darkMode ? 'rgba(96, 165, 250, 0.08)' : 'rgba(59, 130, 246, 0.06)',
                      }}
                    >
                      <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '700' }}>KNOWN PRICING</Text>
                      <PriceRow
                        label="User-provided subtotal"
                        value={formatDraftMoney(pkg.knownSubtotal)}
                        Colors={Colors}
                        highlight
                      />
                      {(pkg.pricingItems || [])
                        .filter((i) => i.amount != null && i.amount > 0)
                        .map((item, ii) => (
                          <Text key={`pi-${ii}`} style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                            • {item.name}: {formatDraftMoney(item.amount)}
                            {item.status === 'rough_price' ? ' (rough)' : ''}
                          </Text>
                        ))}
                    </View>
                  ) : null}
                  {pkg.price != null ? (
                    <View style={{ marginTop: 6 }}>
                      {pkg.laborPrice != null && pkg.materialPrice != null ? (
                        <>
                          <PriceRow
                            label={pkg.splitIsSuggested ? 'AI suggested labor' : 'Labor (from notes)'}
                            value={formatDraftMoney(pkg.laborPrice)}
                            Colors={Colors}
                          />
                          <PriceRow
                            label={pkg.splitIsSuggested ? 'AI suggested materials' : 'Materials (from notes)'}
                            value={formatDraftMoney(pkg.materialPrice)}
                            Colors={Colors}
                          />
                        </>
                      ) : pkg.priceIncludesLaborAndMaterials ? (
                        <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 4 }}>
                          Combined labor + materials in notes
                        </Text>
                      ) : null}
                      <PriceRow
                        label="Total"
                        value={formatDraftMoney(pkg.price)}
                        Colors={Colors}
                        highlight
                      />
                      {pkg.formula ? (
                        <Text style={{ color: '#60a5fa', fontSize: 11, marginTop: 4 }}>{pkg.formula}</Text>
                      ) : null}
                    </View>
                  ) : pkg.status === 'partial_pricing' ? (
                    <Text style={{ color: '#60a5fa', fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                      Partial pricing — add remaining items before bidding
                    </Text>
                  ) : (
                    <Text style={{ color: Colors.sub, fontSize: 13, marginTop: 4 }}>Scope found — price needed</Text>
                  )}
                  {(pkg.missingPriceItems || []).length > 0 ? (
                    <View style={{ marginTop: 6 }}>
                      <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '700' }}>Still needs pricing</Text>
                      {pkg.missingPriceItems.slice(0, 6).map((item, ii) => (
                        <Text key={`miss-${ii}`} style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                          • {item}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {pkg.scope ? (
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 4, lineHeight: 17 }} numberOfLines={4}>
                      {pkg.scope}
                    </Text>
                  ) : null}
                </View>
              ))}
            </SectionCard>

            {draft.allowances.length > 0 ? (
              <SectionCard title="Materials / Allowances" Colors={Colors} darkMode={darkMode}>
                {draft.allowances.map((allowance, index) => (
                  <View key={`allow-${index}`} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '600', flex: 1 }}>
                        {allowance.name || allowance.description}
                      </Text>
                      {allowance.status ? <AIEstimateDraftStatusBadge status={allowance.status} /> : null}
                    </View>
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 2 }}>
                      Rate: {formatDraftMoney(allowance.rate ?? allowance.amount)}
                      {allowance.unit ? ` ${allowance.unit}` : ''}
                      {allowance.calculatedAmount != null
                        ? ` → ${formatDraftMoney(allowance.calculatedAmount)}`
                        : ''}
                    </Text>
                    {allowance.quantity != null ? (
                      <Text style={{ color: Colors.sub, fontSize: 11 }}>
                        Quantity: {allowance.quantity.toLocaleString()} sqft
                      </Text>
                    ) : null}
                  </View>
                ))}
              </SectionCard>
            ) : null}

            <SectionCard title="Labor / trade items" Colors={Colors} darkMode={darkMode}>
              {(draft.laborTradeItems || []).length > 0 ? (
                draft.laborTradeItems!.map((item, i) => (
                  <View key={`labor-${i}`} style={{ marginBottom: 8 }}>
                    <PriceRow
                      label={item.name}
                      value={item.amount != null ? formatDraftMoney(item.amount) : 'Needs pricing'}
                      Colors={Colors}
                    />
                    {item.missing && (item.missingItems || []).slice(0, 3).map((m, mi) => (
                      <Text key={`lm-${mi}`} style={{ color: Colors.sub, fontSize: 11 }}>
                        • Missing: {m}
                      </Text>
                    ))}
                  </View>
                ))
              ) : (
                <PriceRow
                  label={`Labor total (${pricedRoomCount} areas)`}
                  value={formatDraftMoney(draft.calculatedLaborTotal)}
                  Colors={Colors}
                />
              )}
              {(draft.combinedPriceRoomCount || 0) > 0 && !hasSuggestedSplits ? (
                <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 4 }}>
                  Combined trade packages until you split or approve a suggestion
                </Text>
              ) : null}
              {onSuggestMissingPrices ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  disabled={busy}
                  onPress={onSuggestMissingPrices}
                  style={{ marginTop: 10 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {suggestingMissingPrices ? (
                      <ActivityIndicator size="small" color="#60a5fa" />
                    ) : (
                      <MaterialIcons name="lightbulb-outline" size={16} color="#60a5fa" />
                    )}
                    <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700' }}>
                      Suggest missing prices
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
              {showSuggestSplits ? (
                <TouchableOpacity
                  activeOpacity={0.88}
                  disabled={busy}
                  onPress={onSuggestSplits}
                  style={{ marginTop: 10 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {suggestingSplits ? (
                      <ActivityIndicator size="small" color="#22c55e" />
                    ) : (
                      <MaterialIcons name="auto-awesome" size={16} color="#22c55e" />
                    )}
                    <Text style={{ color: '#22c55e', fontSize: 13, fontWeight: '700' }}>
                      {hasSuggestedSplits
                        ? 'Re-suggest AI Suggested Split'
                        : 'Suggest labor & material split (optional)'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </SectionCard>

            {(appliedSplits.length > 0 || previewSplits.length > 0) ? (
              <SectionCard title="AI suggested splits" Colors={Colors} darkMode={darkMode}>
                {[...previewSplits, ...appliedSplits].map((split, index) => (
                  <View key={`split-${index}`} style={{ marginBottom: 10 }}>
                    <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>{split.parentItemName}</Text>
                    <Text style={{ color: Colors.sub, fontSize: 12 }}>
                      User-provided total: {formatDraftMoney(split.total)}
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 12 }}>
                      AI suggested — Materials {formatDraftMoney(split.suggestedMaterials)} · Labor{' '}
                      {formatDraftMoney(split.suggestedLabor)}
                    </Text>
                    {split.previewOnly && onApproveSuggestedSplit ? (
                      <TouchableOpacity
                        style={{ marginTop: 6 }}
                        disabled={busy}
                        onPress={() => onApproveSuggestedSplit(split.parentItemName)}
                      >
                        <Text style={{ color: split.approvedByUser ? '#22c55e' : '#60a5fa', fontSize: 12, fontWeight: '700' }}>
                          {split.approvedByUser ? '✓ Approved for apply' : 'Approve this split for apply'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
                {onToggleApplySuggestedSplits ? (
                  <TouchableOpacity disabled={busy} onPress={onToggleApplySuggestedSplits}>
                    <Text style={{ color: draft.applySuggestedSplits ? '#22c55e' : Colors.sub, fontSize: 12, fontWeight: '700' }}>
                      {draft.applySuggestedSplits
                        ? '✓ Include approved AI splits when applying'
                        : 'Apply without AI splits (lump sums only)'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </SectionCard>
            ) : null}

            {draft.inclusions.length > 0 ? (
              <SectionCard title="Inclusions" Colors={Colors} darkMode={darkMode}>
                {draft.inclusions.map((line, i) => (
                  <Text key={`inc-${i}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 4 }}>
                    • {line}
                  </Text>
                ))}
              </SectionCard>
            ) : null}

            {draft.exclusions.length > 0 ? (
              <SectionCard title="Exclusions" Colors={Colors} darkMode={darkMode}>
                {draft.exclusions.map((line, i) => (
                  <Text key={`exc-${i}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 4 }}>
                    • {line}
                  </Text>
                ))}
              </SectionCard>
            ) : null}

            {draft.suggestedPaymentSchedule && draft.suggestedPaymentSchedule.length > 0 ? (
              <SectionCard title="Payment schedule (from notes)" Colors={Colors} darkMode={darkMode}>
                {draft.suggestedPaymentSchedule.map((p, i) => (
                  <Text key={`pay-${i}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 4 }}>
                    • {p.label}
                    {p.amount != null ? ` — ${formatDraftMoney(p.amount)}` : ''}
                    {p.percentage != null ? ` (${p.percentage}%)` : ''}
                    {p.dueTiming ? ` · ${p.dueTiming}` : ''}
                  </Text>
                ))}
              </SectionCard>
            ) : null}

            {warnings.length > 0 ? (
              <SectionCard title="Pricing warnings" Colors={Colors} darkMode={darkMode}>
                {warnings.map((warning, index) => (
                  <Text key={`warn-${index}`} style={{ color: '#fbbf24', fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
                    • {warning}
                  </Text>
                ))}
              </SectionCard>
            ) : null}

            {needsReview.length > 0 ? (
              <SectionCard title="Missing info / Needs review" Colors={Colors} darkMode={darkMode}>
                {needsReview.map((item, index) => (
                  <Text key={`missing-${index}`} style={{ color: Colors.sub, fontSize: 13, marginBottom: 6, lineHeight: 18 }}>
                    • {item}
                  </Text>
                ))}
              </SectionCard>
            ) : null}

            {clarifyQuestions && clarifyQuestions.length > 0 ? (
              <SectionCard title="Clarify missing items" Colors={Colors} darkMode={darkMode}>
                {clarifyQuestions.map((q, index) => (
                  <Text key={`clarify-${index}`} style={{ color: Colors.text, fontSize: 13, marginBottom: 8, lineHeight: 18 }}>
                    {index + 1}. {q}
                  </Text>
                ))}
                <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 4 }}>
                  Edit notes & regenerate, or fill in on estimate steps after applying.
                </Text>
              </SectionCard>
            ) : null}

            <SectionCard title="Pricing memory" Colors={Colors} darkMode={darkMode}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => setShowPricingLibrary(true)}
                style={{ marginBottom: 10 }}
              >
                <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700' }}>
                  Review saved pricing library
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => setShowPricingMemorySettings((v) => !v)}
                style={{ marginBottom: showPricingMemorySettings ? 10 : 0 }}
              >
                <Text style={{ color: '#60a5fa', fontSize: 13, fontWeight: '700' }}>
                  {showPricingMemorySettings ? 'Hide settings' : 'Manage pricing memory'}
                </Text>
              </TouchableOpacity>
              {showPricingMemorySettings ? (
                <ContractorPricingMemorySettings compact />
              ) : null}
            </SectionCard>

            <SectionCard title="Total validation" Colors={Colors} darkMode={darkMode}>
              <PriceRow
                label="Materials"
                value={formatDraftMoney(tv?.materialsTotal ?? draft.calculatedMaterialTotal)}
                Colors={Colors}
              />
              <PriceRow
                label="Labor / trade"
                value={formatDraftMoney(tv?.laborTotal ?? draft.calculatedLaborTotal)}
                Colors={Colors}
              />
              {tv?.knownSubtotal != null ? (
                <PriceRow label="Known subtotal (partial)" value={formatDraftMoney(tv.knownSubtotal)} Colors={Colors} />
              ) : null}
              {tv?.aiSuggestedSubtotal != null ? (
                <PriceRow label="AI suggested (approved)" value={formatDraftMoney(tv.aiSuggestedSubtotal)} Colors={Colors} />
              ) : null}
              <PriceRow
                label="Calculated line items"
                value={formatDraftMoney(tv?.calculatedLineItemsTotal ?? draft.calculatedLineItemTotal ?? draft.calculatedTotal)}
                Colors={Colors}
                highlight
              />
              {tv?.statedTotal != null || draft.statedTotal != null ? (
                <PriceRow
                  label="Stated total in notes"
                  value={formatDraftMoney(tv?.statedTotal ?? draft.statedTotal)}
                  Colors={Colors}
                />
              ) : null}
              {(tv?.warnings || []).map((w, i) => (
                <Text key={`tvw-${i}`} style={{ color: '#fbbf24', fontSize: 12, marginTop: 6 }}>
                  • {w}
                </Text>
              ))}
              {draft.totalMatches === true ? (
                <Text style={{ color: '#22c55e', fontSize: 12, marginTop: 6 }}>Line items match stated total.</Text>
              ) : null}
            </SectionCard>
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
    </View>
  );

  const shell = (
    <>
      {body}
      <ContractorPricingLibraryModal visible={showPricingLibrary} onClose={() => setShowPricingLibrary(false)} />
    </>
  );

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
      {shell}
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
