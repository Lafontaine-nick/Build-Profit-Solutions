import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { isDesktopWebLayoutWidth } from '@/constants/ScreenLayout';

export const BPS_BRAND_GREEN = '#22c55e';

export type SegmentNavItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badgeCount?: number;
};

type SegmentNavBarProps = {
  items: SegmentNavItem[];
  activeKey: string;
  onPress: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  /** Defaults to true when there are more than 4 tabs. */
  scrollable?: boolean;
};

type SegmentTabProps = {
  item: SegmentNavItem;
  isActive: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  darkMode: boolean;
  equalWidth: boolean;
};

const SegmentTab = React.memo(function SegmentTab({
  item,
  isActive,
  onPress,
  styles,
  darkMode,
  equalWidth,
}: SegmentTabProps) {
  const iconColor = isActive ? '#050B13' : darkMode ? '#FFFFFF' : '#334155';
  const badgeCount = item.badgeCount ?? 0;

  const tabContent = (
    <>
      {badgeCount > 0 ? (
        <View style={styles.segmentBadgeFloated} pointerEvents="none">
          <Text style={styles.segmentBadgeText}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.segmentTabInner,
          badgeCount > 0 && styles.segmentTabInnerWithBadge,
        ]}
      >
        <View style={styles.segmentIconSlot}>
          <Ionicons name={item.icon} size={16} color={iconColor} />
        </View>
        <Text
          style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          {item.label}
        </Text>
      </View>
    </>
  );

  const tabStyle = [
    styles.segmentTab,
    equalWidth ? styles.segmentTabEqual : styles.segmentTabScroll,
  ];

  if (isActive) {
    return (
      <Pressable
        onPress={onPress}
        style={[tabStyle, styles.segmentTabClipped, equalWidth && styles.segmentTabFlex]}
      >
        <LinearGradient
          colors={['#22c55e', '#22d3ee']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, styles.segmentTabActive]}
        >
          {tabContent}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={[tabStyle, equalWidth && styles.segmentTabFlex]}>
      {tabContent}
    </Pressable>
  );
});

export function SegmentNavBar({
  items,
  activeKey,
  onPress,
  style,
  scrollable,
}: SegmentNavBarProps) {
  const { darkMode, theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const { width } = useWindowDimensions();
  const desktopWeb = Platform.OS === 'web' && isDesktopWebLayoutWidth(width);
  const styles = useMemo(() => createStyles(Colors, desktopWeb), [Colors, desktopWeb]);
  const shouldScroll = scrollable ?? items.length > 4;

  const tabs = items.map((item) => (
    <SegmentTab
      key={item.key}
      item={item}
      isActive={activeKey === item.key}
      onPress={() => onPress(item.key)}
      styles={styles}
      darkMode={darkMode}
      equalWidth={!shouldScroll}
    />
  ));

  return (
    <BlurView
      intensity={35}
      tint={darkMode ? 'dark' : 'light'}
      style={[styles.segmentContainer, style]}
    >
      {shouldScroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentInnerScroll}
        >
          {tabs}
        </ScrollView>
      ) : (
        <View style={styles.segmentInner}>{tabs}</View>
      )}
    </BlurView>
  );
}

function createStyles(Colors: ReturnType<typeof getColors>, desktopWeb: boolean) {
  const isDarkBg = Colors.bg === '#000000';
  return StyleSheet.create({
    segmentContainer: {
      borderRadius: 999,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: BPS_BRAND_GREEN,
      marginBottom: desktopWeb ? 22 : 18,
    },
    segmentInner: {
      flexDirection: 'row',
      padding: desktopWeb ? 5 : 4,
      backgroundColor: isDarkBg ? 'rgba(255, 255, 255, 0.04)' : Colors.surface2,
      minWidth: '100%',
    },
    segmentInnerScroll: {
      flexDirection: 'row',
      padding: desktopWeb ? 5 : 4,
      backgroundColor: isDarkBg ? 'rgba(255, 255, 255, 0.04)' : Colors.surface2,
      gap: 2,
    },
    segmentTab: {
      borderRadius: 999,
      marginHorizontal: 1,
      position: 'relative',
      overflow: 'visible',
    },
    segmentTabFlex: {
      flex: 1,
      minWidth: 0,
    },
    segmentTabScroll: {
      minWidth: 88,
    },
    segmentTabClipped: {
      overflow: 'hidden',
    },
    segmentTabActive: {
      borderRadius: 999,
      backgroundColor: isDarkBg ? 'transparent' : '#FFFFFF',
      shadowColor: isDarkBg ? BPS_BRAND_GREEN : '#000',
      shadowOpacity: isDarkBg ? 0.4 : 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
    },
    segmentTabInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: desktopWeb ? 10 : 8,
      paddingHorizontal: desktopWeb ? 8 : 6,
      gap: 5,
    },
    segmentTabInnerWithBadge: {
      paddingRight: desktopWeb ? 14 : 12,
    },
    segmentIconSlot: {
      width: 18,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentLabel: {
      fontSize: desktopWeb ? 14 : 13,
      fontWeight: '600',
      color: isDarkBg ? '#FFFFFF' : Colors.text,
      flexShrink: 1,
    },
    segmentLabelActive: {
      color: isDarkBg ? '#050B13' : '#071018',
    },
    segmentBadgeFloated: {
      position: 'absolute',
      top: 3,
      right: 3,
      zIndex: 2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f97316',
    },
    segmentBadgeText: {
      color: '#050B13',
      fontSize: 10,
      fontWeight: '800',
      lineHeight: 12,
    },
  });
}
