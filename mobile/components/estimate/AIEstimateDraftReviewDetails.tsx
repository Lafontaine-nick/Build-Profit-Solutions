import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { formatDraftMoney, getScopePackages } from '@/utils/estimateAiDraft';
import {
  compactNeedsReviewForDisplay,
  dedupeMissingPriceSuggestions,
  summarizePricingWarnings,
  summarizeWhatAiDidForDisplay,
} from '@/utils/estimateDraftReviewUi';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';

type Colors = {
  text: string;
  sub: string;
  line: string;
  bg: string;
  surface2: string;
};

type Props = {
  draft: EstimateAiDraft;
  Colors: Colors;
  darkMode: boolean;
  busy: boolean;
  warnings: string[];
  needsReview: string[];
  clarifyQuestions?: string[] | null;
  onApplyScopeOnly?: () => void;
  onClarifyMissing?: () => void;
  onRequestRoughRange?: () => void;
  roughRangeLoading?: boolean;
  onApproveSuggestedSplit?: (parentItemName: string) => void;
  onToggleApplySuggestedSplits?: () => void;
  showSuggestSplits?: boolean;
  hasSuggestedSplits?: boolean;
  suggestingSplits?: boolean;
  onSuggestSplits?: () => void;
  onSuggestMissingPrices?: () => void;
  suggestingMissingPrices?: boolean;
};

const flowCard = (Colors: Colors, darkMode: boolean) =>
  estimateFlowCardStyle(Colors, darkMode, { marginBottom: 10 });

function PriceRow({
  label,
  value,
  Colors,
  highlight,
}: {
  label: string;
  value: string;
  Colors: Colors;
  highlight?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={{ color: Colors.sub, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: highlight ? '#22c55e' : Colors.text, fontSize: 13, fontWeight: '700' }}>
        {value}
      </Text>
    </View>
  );
}

function Collapsible({
  title,
  defaultOpen = false,
  Colors,
  darkMode,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  Colors: Colors;
  darkMode: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={flowCard(Colors, darkMode)}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setOpen((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '800', flex: 1 }}>{title}</Text>
        <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}>{open ? 'Hide' : 'Show'}</Text>
      </TouchableOpacity>
      {open ? <View style={{ marginTop: 10 }}>{children}</View> : null}
    </View>
  );
}

export default function AIEstimateDraftReviewDetails({
  draft,
  Colors,
  darkMode,
  busy,
  warnings,
  needsReview,
  clarifyQuestions,
  onApplyScopeOnly,
  onClarifyMissing,
  onRequestRoughRange,
  roughRangeLoading,
  onApproveSuggestedSplit,
  onToggleApplySuggestedSplits,
  showSuggestSplits,
  hasSuggestedSplits,
  suggestingSplits,
  onSuggestSplits,
  onSuggestMissingPrices,
  suggestingMissingPrices,
}: Props) {
  const scopePackages = getScopePackages(draft);
  const previewSplits = (draft.suggestedSplits || []).filter((s) => s.previewOnly);
  const appliedSplits = (draft.suggestedSplits || []).filter((s) => !s.previewOnly);
  const allSplits = [...previewSplits, ...appliedSplits];
  const tv = draft.totalValidation;
  const whatAiDid = summarizeWhatAiDidForDisplay(draft.whatAiDid || [], 3);
  const summaryWarnings = summarizePricingWarnings(warnings);
  const compactReview = compactNeedsReviewForDisplay(needsReview, 5);
  const missingPriceHints = dedupeMissingPriceSuggestions(draft.pricingMemoryMissingSuggestions || [], 4);
  const partialCount = scopePackages.filter((p) => p.status === 'partial_pricing').length;
  const calculatedTotal =
    tv?.calculatedLineItemsTotal ?? draft.calculatedLineItemTotal ?? draft.calculatedTotal;
  const statedTotal = tv?.statedTotal ?? draft.statedTotal;

  return (
    <>
      <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 16, marginBottom: 10, textAlign: 'center' }}>
        AI-organized draft — verify scope, pricing, and totals before applying.
      </Text>

      {whatAiDid.length > 0 ? (
        <View style={flowCard(Colors, darkMode)}>
          {whatAiDid.map((line, i) => (
            <Text key={`did-${i}`} style={{ color: Colors.sub, fontSize: 12, marginBottom: i < whatAiDid.length - 1 ? 4 : 0, lineHeight: 17 }}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      {(showSuggestSplits && onSuggestSplits) || (onSuggestMissingPrices && partialCount > 0) ? (
        <View style={{ marginBottom: 10, gap: 8 }}>
          {showSuggestSplits && onSuggestSplits ? (
            <TouchableOpacity
              activeOpacity={0.88}
              disabled={busy}
              onPress={onSuggestSplits}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#22c55e',
                opacity: busy ? 0.5 : 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {suggestingSplits ? (
                  <ActivityIndicator size="small" color="#22c55e" />
                ) : (
                  <MaterialIcons name="auto-awesome" size={14} color="#22c55e" />
                )}
                <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700' }}>
                  {hasSuggestedSplits ? 'Re-suggest labor & material split' : 'Suggest labor & material split'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {draft.noPricingDetected ? (
        <View style={flowCard(Colors, darkMode)}>
          {onApplyScopeOnly ? (
            <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={onApplyScopeOnly} style={{ marginBottom: 6 }}>
              <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}>Save scope only (no prices)</Text>
            </TouchableOpacity>
          ) : null}
          {onClarifyMissing ? (
            <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={onClarifyMissing} style={{ marginBottom: 6 }}>
              <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '700' }}>Ask clarifying questions</Text>
            </TouchableOpacity>
          ) : null}
          {onRequestRoughRange ? (
            <TouchableOpacity activeOpacity={0.88} disabled={busy} onPress={onRequestRoughRange}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {roughRangeLoading ? <ActivityIndicator size="small" color="#fbbf24" /> : null}
                <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '700' }}>Rough budget range</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {(calculatedTotal != null && calculatedTotal > 0) || statedTotal != null ? (
        <View style={flowCard(Colors, darkMode)}>
          <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '800', marginBottom: 6 }}>
            Totals
          </Text>
          {(tv?.materialsTotal ?? draft.calculatedMaterialTotal) != null ? (
            <PriceRow
              label="Materials"
              value={formatDraftMoney(tv?.materialsTotal ?? draft.calculatedMaterialTotal)}
              Colors={Colors}
            />
          ) : null}
          {(tv?.laborTotal ?? draft.calculatedLaborTotal) != null ? (
            <PriceRow
              label="Labor"
              value={formatDraftMoney(tv?.laborTotal ?? draft.calculatedLaborTotal)}
              Colors={Colors}
            />
          ) : null}
          {calculatedTotal != null && calculatedTotal > 0 ? (
            <PriceRow label="Line items" value={formatDraftMoney(calculatedTotal)} Colors={Colors} highlight />
          ) : null}
          {statedTotal != null && statedTotal > 0 ? (
            <PriceRow label="In your notes" value={formatDraftMoney(statedTotal)} Colors={Colors} />
          ) : null}
          {draft.totalMatches === true ? (
            <Text style={{ color: '#22c55e', fontSize: 11, marginTop: 4 }}>Totals match your notes.</Text>
          ) : null}
        </View>
      ) : null}

      {summaryWarnings.length > 0 ? (
        <View style={flowCard(Colors, darkMode)}>
          <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '800', marginBottom: 6 }}>
            Heads up
          </Text>
          {summaryWarnings.map((warning, index) => (
            <Text key={`warn-${index}`} style={{ color: '#fbbf24', fontSize: 12, marginBottom: 4, lineHeight: 17 }}>
              • {warning}
            </Text>
          ))}
        </View>
      ) : null}

      {draft.roughEstimate ? (
        <View style={flowCard(Colors, darkMode)}>
          <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '700' }}>
            Rough estimate: {formatDraftMoney(draft.roughEstimate.low)} –{' '}
            {formatDraftMoney(draft.roughEstimate.high)}
          </Text>
        </View>
      ) : null}

      {missingPriceHints.length > 0 && !draft.noPricingDetected && partialCount === 0 ? (
        <View style={flowCard(Colors, darkMode)}>
          <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '800', marginBottom: 4 }}>
            Pricing gaps
          </Text>
          <Text style={{ color: Colors.sub, fontSize: 11, lineHeight: 16 }}>
            Common gaps: {missingPriceHints.join(' · ')}
          </Text>
        </View>
      ) : null}

      {compactReview.items.length > 0 ? (
        <Collapsible title={`Missing project info (${compactReview.items.length})`} Colors={Colors} darkMode={darkMode}>
          {compactReview.items.map((item, index) => (
            <Text key={`missing-${index}`} style={{ color: Colors.sub, fontSize: 12, marginBottom: 4, lineHeight: 17 }}>
              • {item}
            </Text>
          ))}
          {compactReview.overflow > 0 ? (
            <Text style={{ color: Colors.sub, fontSize: 11 }}>+ {compactReview.overflow} more</Text>
          ) : null}
        </Collapsible>
      ) : null}

      {allSplits.length > 0 ? (
        <Collapsible
          title={`Labor / material splits (${allSplits.length})`}
          defaultOpen={allSplits.length <= 4}
          Colors={Colors}
          darkMode={darkMode}
        >
          {allSplits.slice(0, 6).map((split, index) => (
            <View key={`split-${index}`} style={{ marginBottom: 8 }}>
              <Text style={{ color: Colors.text, fontSize: 13, fontWeight: '700' }}>{split.parentItemName}</Text>
              <Text style={{ color: Colors.sub, fontSize: 11 }}>
                {formatDraftMoney(split.total)} → Mat {formatDraftMoney(split.suggestedMaterials)} · Lab{' '}
                {formatDraftMoney(split.suggestedLabor)}
              </Text>
              {split.previewOnly && onApproveSuggestedSplit ? (
                <TouchableOpacity
                  style={{ marginTop: 2 }}
                  disabled={busy}
                  onPress={() => onApproveSuggestedSplit(split.parentItemName)}
                >
                  <Text style={{ color: split.approvedByUser ? '#22c55e' : '#60a5fa', fontSize: 11, fontWeight: '700' }}>
                    {split.approvedByUser ? '✓ Approved' : 'Approve split'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          {allSplits.length > 6 ? (
            <Text style={{ color: Colors.sub, fontSize: 11 }}>+ {allSplits.length - 6} more rooms</Text>
          ) : null}
          {onToggleApplySuggestedSplits ? (
            <TouchableOpacity disabled={busy} onPress={onToggleApplySuggestedSplits} style={{ marginTop: 4 }}>
              <Text style={{ color: draft.applySuggestedSplits ? '#22c55e' : Colors.sub, fontSize: 11, fontWeight: '700' }}>
                {draft.applySuggestedSplits ? '✓ Include approved splits when applying' : 'Apply without AI splits'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </Collapsible>
      ) : null}

      {scopePackages.length > 0 ? (
        <Collapsible title={`Room scope text (${scopePackages.length})`} Colors={Colors} darkMode={darkMode}>
          {scopePackages.map((pkg, index) => (
            <View key={`${pkg.name}-${index}`} style={{ marginBottom: index < scopePackages.length - 1 ? 8 : 0 }}>
              <Text style={{ color: Colors.text, fontSize: 12, fontWeight: '700' }}>{pkg.name}</Text>
              {pkg.scope ? (
                <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2, lineHeight: 16 }} numberOfLines={2}>
                  {pkg.scope}
                </Text>
              ) : (
                <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>No scope text</Text>
              )}
            </View>
          ))}
        </Collapsible>
      ) : null}

      {draft.allowances.length > 0 ? (
        <Collapsible title="Allowances" Colors={Colors} darkMode={darkMode}>
          {draft.allowances.map((allowance, index) => (
            <Text key={`allow-${index}`} style={{ color: Colors.sub, fontSize: 12, marginBottom: 4 }}>
              • {allowance.name || allowance.description}: {formatDraftMoney(allowance.rate ?? allowance.amount)}
              {allowance.unit ? ` ${allowance.unit}` : ''}
            </Text>
          ))}
        </Collapsible>
      ) : null}

      {(draft.pricingMemorySuggestions?.length ?? 0) > 0 ? (
        <Collapsible title="Pricing history matches" Colors={Colors} darkMode={darkMode}>
          {draft.pricingMemorySuggestions!.slice(0, 5).map((s, i) => (
            <Text key={`pm-${i}`} style={{ color: Colors.sub, fontSize: 12, marginBottom: 4 }}>
              • {s.scopeItemName}: ${s.suggestedUnitRate}/{s.unitType}
            </Text>
          ))}
        </Collapsible>
      ) : null}

      {clarifyQuestions && clarifyQuestions.length > 0 ? (
        <Collapsible title="Clarifying questions" defaultOpen Colors={Colors} darkMode={darkMode}>
          {clarifyQuestions.map((q, index) => (
            <Text key={`clarify-${index}`} style={{ color: Colors.text, fontSize: 12, marginBottom: 6, lineHeight: 17 }}>
              {index + 1}. {q}
            </Text>
          ))}
        </Collapsible>
      ) : null}
    </>
  );
}
