import React from 'react';
import { Text, View } from 'react-native';
import {
  confirmScopeSectionLabelStyle,
  estimateSummarySectionSubtitleStyle,
  getProjectJobDurationDays,
} from '@/utils/estimateFlowCardStyle';

type EstimateJobDurationFooterProps = {
  startDate?: string | null;
  endDate?: string | null;
  labelColor: string;
  textColor: string;
  darkMode: boolean;
};

export function EstimateJobDurationFooter({
  startDate,
  endDate,
  labelColor,
  textColor,
  darkMode,
}: EstimateJobDurationFooterProps) {
  const days = getProjectJobDurationDays(startDate, endDate);

  return (
    <View>
      <Text style={[confirmScopeSectionLabelStyle(), { color: labelColor, marginBottom: 4 }]}>
        Job duration
      </Text>
      <Text style={{ color: textColor, fontSize: 14, fontWeight: '700', lineHeight: 20 }}>
        {days != null
          ? `${days} day${days !== 1 ? 's' : ''} expected`
          : startDate
            ? 'Select an end date to see expected duration'
            : 'Add a start date to calculate duration'}
      </Text>
      {days != null ? (
        <Text style={[estimateSummarySectionSubtitleStyle(darkMode), { marginTop: 4, fontSize: 12 }]}>
          Inclusive count from start through end date
        </Text>
      ) : null}
    </View>
  );
}
