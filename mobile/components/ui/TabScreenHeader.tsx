import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { ScreenLayout } from '@/constants/ScreenLayout';

export type TabScreenHeaderProps = {
  title: string;
  subtitle?: string;
  titleColor: string;
  subtitleColor: string;
  right?: React.ReactNode;
  /** e.g. AI status row — sits under subtitle */
  belowTitle?: React.ReactNode;
  style?: ViewStyle;
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
}: TabScreenHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.left}>
        <Text style={[styles.screenTitle, { color: titleColor }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.screenSubtitle, { color: subtitleColor }]}>
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
  },
  screenTitle: {
    fontSize: ScreenLayout.header.titleSize,
    fontWeight: ScreenLayout.header.titleWeight,
    letterSpacing: ScreenLayout.header.titleLetterSpacing,
  },
  screenSubtitle: {
    fontSize: ScreenLayout.header.subtitleSize,
    fontWeight: ScreenLayout.header.subtitleWeight,
    marginTop: ScreenLayout.header.subtitleMarginTop,
  },
});
