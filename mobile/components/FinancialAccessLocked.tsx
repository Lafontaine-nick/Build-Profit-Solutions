import React from 'react';
import { View, Text } from 'react-native';
import { getColors } from '@/theme/getColors';

type FinancialAccessLockedProps = {
  colors: ReturnType<typeof getColors>;
  compact?: boolean;
};

export default function FinancialAccessLocked({
  colors,
  compact = false,
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
          Financial details are restricted.
        </Text>
        <Text style={{ color: colors.sub, fontSize: 14, lineHeight: 20 }}>
          Your workspace role does not include owner-level financials like markup, overhead, profit,
          estimate breakdowns, payment pricing, or tax records. You can still work with the project
          areas allowed by your role.
        </Text>
      </View>
    </View>
  );
}
