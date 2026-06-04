import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';
import { formatDraftMoney } from '@/utils/estimateAiDraft';
import { draftHasApplyablePricing } from '@/utils/estimateAiDraftPricing';

type Colors = {
  text: string;
  sub: string;
  line: string;
};

type Props = {
  draft: EstimateAiDraft;
  Colors: Colors;
  darkMode: boolean;
  busy: boolean;
  onUseSavedPricing?: () => void;
  suggestingMissingPrices?: boolean;
  onSuggestRoughPrices?: () => void;
  roughRangeLoading?: boolean;
  onAddPricesManually?: () => void;
};

function ActionBtn({
  label,
  onPress,
  disabled,
  color = '#60a5fa',
  loading,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  color?: string;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: color,
        marginBottom: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? <ActivityIndicator size="small" color={color} /> : null}
        <Text style={{ color, fontSize: 14, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AIEstimateDraftReviewPricingActions({
  draft,
  Colors,
  darkMode,
  busy,
  onUseSavedPricing,
  suggestingMissingPrices,
  onSuggestRoughPrices,
  roughRangeLoading,
  onAddPricesManually,
}: Props) {
  const hasPricing = draftHasApplyablePricing(draft);
  const hasMemorySuggestions = (draft.pricingMemorySuggestions?.length ?? 0) > 0;
  const templateHints = (draft.pricingMemoryMissingSuggestions || []).filter(
    (s) => s.source === 'saved_template'
  );

  return (
    <View
      style={{
        marginBottom: 12,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
        backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'transparent',
      }}
    >
      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 6 }}>
        {hasPricing ? 'Finish pricing' : 'No pricing found yet'}
      </Text>
      <Text style={{ color: Colors.sub, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
        {hasPricing
          ? 'Some scope items still need prices. Use saved template rates, AI rough estimates, or enter manually.'
          : 'I found the scope and quantities, but no material or labor prices.'}
      </Text>

      <ActionBtn
        label="Use saved pricing"
        onPress={onUseSavedPricing}
        disabled={busy}
        loading={suggestingMissingPrices}
      />
      {templateHints.length > 0 ? (
        <View
          style={{
            marginBottom: 8,
            marginTop: -4,
            padding: 10,
            borderRadius: 10,
            backgroundColor: darkMode ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.08)',
          }}
        >
          <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
            Matched from saved bid template
          </Text>
          {templateHints.slice(0, 4).map((s, i) => (
            <Text key={`tpl-${i}`} style={{ color: Colors.sub, fontSize: 11, marginBottom: 2 }}>
              • {s.scopeItemName}: {formatDraftMoney(s.suggestedAmount)}
              {s.sourceLabel ? ` (${s.sourceLabel})` : ''}
            </Text>
          ))}
          <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 4 }}>
            Tap Use saved pricing to apply unit rates from your template (e.g. tile demo $/sqft).
          </Text>
        </View>
      ) : hasMemorySuggestions ? (
        <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 8, marginTop: -4 }}>
          Based on your saved pricing — approve before applying.
        </Text>
      ) : draft.pricingMemoryMessage ? (
        <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 8, marginTop: -4 }}>
          {draft.pricingMemoryMessage}
        </Text>
      ) : null}

      <ActionBtn
        label="Suggest rough prices"
        onPress={onSuggestRoughPrices}
        disabled={busy}
        color="#fbbf24"
        loading={roughRangeLoading}
      />
      {draft.roughEstimate ? (
        <Text style={{ color: '#fbbf24', fontSize: 12, marginBottom: 8 }}>
          AI Rough Estimate: {formatDraftMoney(draft.roughEstimate.low)} –{' '}
          {formatDraftMoney(draft.roughEstimate.high)} (review required)
        </Text>
      ) : (
        <Text style={{ color: Colors.sub, fontSize: 11, marginBottom: 8, marginTop: -4 }}>
          Labeled AI Rough Estimate — not applied until you approve.
        </Text>
      )}

      <ActionBtn
        label="Add prices manually"
        onPress={onAddPricesManually}
        disabled={busy}
        color={Colors.text}
      />
      <Text style={{ color: Colors.sub, fontSize: 11, textAlign: 'center' }}>
        Enter unit rates or lump sums for each scope item
      </Text>
    </View>
  );
}
