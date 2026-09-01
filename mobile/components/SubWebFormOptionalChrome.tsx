import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import {
  ESTIMATE_FLOW_CARD_GAP,
  estimateFlowCardStyle,
} from '@/utils/estimateFlowCardStyle';

/** Web: gradient card (max 860); native: charcoal flow card — matches Step 3 search / Step 4 subs. */
export function SubWebFormOptionalChrome({
  isWeb,
  darkMode,
  Colors,
  columnStyle,
  children,
}: {
  isWeb: boolean;
  darkMode: boolean;
  Colors: any;
  columnStyle?: Record<string, unknown>;
  children: React.ReactNode;
}) {
  if (isWeb) {
    return (
      <LinearGradient
        colors={BRAND_FRAME_GRADIENT_COLORS}
        start={BRAND_FRAME_GRADIENT_START}
        end={BRAND_FRAME_GRADIENT_END}
        style={{
          width: '100%',
          maxWidth: 860,
          alignSelf: 'center',
          borderRadius: 24,
          padding: 1,
          overflow: 'hidden',
          marginBottom: 4,
        }}
      >
        <View
          style={{
            width: '100%',
            borderRadius: 23,
            padding: 28,
            backgroundColor: darkMode ? '#050807' : Colors.surface2,
          }}
        >
          <View style={{ gap: 14, width: '100%' }}>{children}</View>
        </View>
      </LinearGradient>
    );
  }
  return (
    <View style={[estimateFlowCardStyle(Colors, darkMode), { gap: ESTIMATE_FLOW_CARD_GAP }, columnStyle || {}]}>
      {children}
    </View>
  );
}
