import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { EstimateAiDraft } from '@/utils/estimateAiDraft';

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
  onSuggestRoughPrices?: () => void;
  roughRangeLoading?: boolean;
  onAddPricesManually?: () => void;
  onContinueUnpriced?: () => void;
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

export default function AIEstimateSavedPricingApplySummary({
  draft,
  Colors,
  darkMode,
  busy,
  onSuggestRoughPrices,
  roughRangeLoading,
  onAddPricesManually,
  onContinueUnpriced,
}: Props) {
  const summary = draft.savedPricingApplySummary;
  if (!summary) return null;

  const { appliedCount, stillNeedCount } = summary;
  const appliedLabel = `${appliedCount} confirmed price${appliedCount === 1 ? '' : 's'} applied`;
  const stillLabel = `${stillNeedCount} item${stillNeedCount === 1 ? '' : 's'} still need pricing`;

  return (
    <View
      style={{
        marginBottom: 12,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: darkMode ? 'rgba(34, 197, 94, 0.35)' : 'rgba(34, 197, 94, 0.45)',
        backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.06)',
      }}
    >
      <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '800', marginBottom: 6 }}>
        Confirmed pricing applied
      </Text>
      <Text style={{ color: Colors.sub, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
        {appliedLabel} • {stillLabel}
      </Text>

      {stillNeedCount > 0 ? (
        <>
          <ActionBtn
            label="Suggest rough prices for remaining items"
            onPress={onSuggestRoughPrices}
            disabled={busy}
            color="#fbbf24"
            loading={roughRangeLoading}
          />
          <ActionBtn
            label="Add prices manually"
            onPress={onAddPricesManually}
            disabled={busy}
            color={Colors.text}
          />
          <ActionBtn
            label="Continue with unpriced items"
            onPress={onContinueUnpriced}
            disabled={busy}
            color="#94a3b8"
          />
        </>
      ) : (
        <ActionBtn
          label="Continue"
          onPress={onContinueUnpriced}
          disabled={busy}
          color="#22c55e"
        />
      )}
    </View>
  );
}
