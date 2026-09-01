import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { ScreenLayout } from '@/constants/ScreenLayout';
import { estimateSummarySectionSubtitleStyle } from '@/utils/estimateFlowCardStyle';

export type TabScreenHeaderProps = {
  title: string;
  subtitle?: string;
  titleColor: string;
  subtitleColor: string;
  right?: React.ReactNode;
  /** e.g. AI status row — sits under subtitle */
  belowTitle?: React.ReactNode;
  style?: ViewStyle;
  /** Merged after base title styles — use for Budget / overview type scale (e.g. 22 / 800 / -0.4) */
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  darkMode?: boolean;
};

/**
 * Standard tab-screen title block: title, optional subtitle, optional trailing actions.
 * Spacing matches ScreenLayout.header.
 */
export function TabScreenHeader({
  title,
  subtitle,
  titleColor,
  subtitleColor,
  right,
  belowTitle,
  style,
  titleStyle,
  subtitleStyle,
  darkMode = false,
}: TabScreenHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        <Text style={[styles.screenTitle, { color: titleColor }, titleStyle]}>{title}</Text>
        {subtitle ? (
          <Text
            style={[
              estimateSummarySectionSubtitleStyle(darkMode),
              { color: subtitleColor },
              subtitleStyle,
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
        {belowTitle}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: ScreenLayout.header.marginTop,
    marginBottom: ScreenLayout.header.marginBottom,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  right: {
    marginLeft: ScreenLayout.edge.horizontal,
    /** Stay above long titles / decorative layers so the avatar receives presses (web + native). */
    zIndex: 2,
    position: 'relative',
  },
  screenTitle: {
    fontSize: ScreenLayout.header.titleSize,
    fontWeight: ScreenLayout.header.titleWeight,
    letterSpacing: ScreenLayout.header.titleLetterSpacing,
  },
});
