import React from 'react';
import { View, Text } from 'react-native';
import type { DraftItemStatus } from '@/utils/estimateAiDraft';

const STATUS_STYLES: Record<
  DraftItemStatus,
  { label: string; bg: string; color: string }
> = {
  confirmed: { label: 'Confirmed', bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  user_provided: { label: 'User Provided', bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  rough_price: { label: 'Rough Price', bg: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' },
  partial_pricing: { label: 'Partial Pricing', bg: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' },
  calculated: { label: 'Calculated', bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
  ai_suggested: { label: 'AI Suggested', bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' },
  needs_review: { label: 'Needs Review', bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' },
  missing_price: { label: 'Missing Price', bg: 'rgba(248, 113, 113, 0.15)', color: '#f87171' },
};

export default function AIEstimateDraftStatusBadge({ status }: { status: DraftItemStatus }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.needs_review;
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: style.bg,
      }}
    >
      <Text style={{ color: style.color, fontSize: 10, fontWeight: '800' }}>{style.label}</Text>
    </View>
  );
}
