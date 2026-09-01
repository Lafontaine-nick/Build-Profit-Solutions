import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import {
  ESTIMATE_FLOW_CARD_GAP,
  estimateFlowCardStyle,
} from '@/utils/estimateFlowCardStyle';

type TabFlowCardColors = {
  line: string;
  surface2: string;
};

export type TabFlowCardProps = {
  children: React.ReactNode;
  Colors: TabFlowCardColors;
  darkMode: boolean;
  style?: StyleProp<ViewStyle>;
  /** Defaults to `ESTIMATE_FLOW_CARD_GAP` (12). */
  marginBottom?: number;
};

/**
 * Standard content card for tab screens (Dashboard, Projects, Leads).
 * Matches Estimates / Build with AI flow cards (`estimateFlowCardStyle`).
 */
export function TabFlowCard({
  children,
  Colors,
  darkMode,
  style,
  marginBottom = ESTIMATE_FLOW_CARD_GAP,
}: TabFlowCardProps) {
  return (
    <View
      style={[
        estimateFlowCardStyle(Colors, darkMode, { marginBottom }),
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Style object for screens that still use StyleSheet `card` keys. */
export function tabFlowCardStyle(
  Colors: TabFlowCardColors,
  darkMode: boolean,
  options?: { marginBottom?: number; marginTop?: number },
): ViewStyle {
  return estimateFlowCardStyle(Colors, darkMode, {
    marginBottom: options?.marginBottom ?? ESTIMATE_FLOW_CARD_GAP,
    marginTop: options?.marginTop,
  });
}
