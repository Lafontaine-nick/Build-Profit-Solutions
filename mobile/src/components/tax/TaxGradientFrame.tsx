import React, { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';

/** Gray flow card shell — matches Build with AI / Confirm Scope (`estimateFlowCardStyle`). */
export default function TaxGradientFrame({
  children,
  style,
  innerStyle,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
}) {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const shell = useMemo(
    () => estimateFlowCardStyle(Colors, darkMode, { marginBottom: 12 }),
    [Colors, darkMode]
  );

  return (
    <View style={[shell, style]}>
      <View style={innerStyle}>{children}</View>
    </View>
  );
}
