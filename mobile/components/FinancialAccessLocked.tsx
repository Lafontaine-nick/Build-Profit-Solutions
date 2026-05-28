import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { getColors } from '@/theme/getColors';

type FinancialAccessLockedProps = {
  colors: ReturnType<typeof getColors>;
  compact?: boolean;
  onBackToProject?: () => void;
};

export default function FinancialAccessLocked({
  colors,
  compact = false,
  onBackToProject,
}: FinancialAccessLockedProps) {
  return (
    <View style={{ padding: compact ? 12 : 20, alignItems: 'center' }}>
      <View
        style={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'rgba(148, 163, 184, 0.22)',
          backgroundColor: colors.surface2 || 'rgba(15, 23, 42, 0.84)',
          padding: compact ? 16 : 20,
          maxWidth: 520,
          width: '100%',
        }}
      >
        <Text
          style={{
            color: colors.text,
            fontSize: compact ? 16 : 18,
            fontWeight: '800',
            marginBottom: 8,
          }}
        >
          Financial details are restricted
        </Text>
        <Text style={{ color: colors.sub, fontSize: 14, lineHeight: 20 }}>
          Your role does not include access to owner-level financials such as markup, overhead,
          profit, margin, or estimate breakdowns. You can still add updates, receipts, logs, photos,
          tasks, and project notes based on your permissions.
        </Text>
        {onBackToProject ? (
          <Pressable
            onPress={onBackToProject}
            style={{
              marginTop: 16,
              alignSelf: 'flex-start',
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 10,
              backgroundColor: 'rgba(34, 197, 94, 0.14)',
            }}
          >
            <Text style={{ color: '#22c55e', fontWeight: '700', fontSize: 14 }}>Back to Project</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
