import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { isDesktopWebLayoutWidth } from '@/constants/ScreenLayout';

export const BPS_BRAND_GREEN = '#2dcc9a';

/** Reanimated is shimmed on web, so the sliding indicator only runs natively. */
const CAN_SLIDE = Platform.OS !== 'web';
const INDICATOR_SPRING = { damping: 24, stiffness: 300, mass: 0.9 };

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

type TabLayout = { x: number; y: number; width: number; height: number };

type SegmentTabProps = {
  item: SegmentNavItem;
  isActive: boolean;
  onPress: () => void;
  onLayout: (key: string, layout: TabLayout) => void;
  styles: ReturnType<typeof createStyles>;
  darkMode: boolean;
  equalWidth: boolean;
  /** When set, the shared indicator draws the active background and labels tint as it passes. */
  indicator: { x: SharedValue<number>; width: SharedValue<number> } | null;
  layout: TabLayout | undefined;
};

const SegmentTab = React.memo(function SegmentTab({
  item,
  isActive,
  onPress,
  onLayout,
  styles,
  darkMode,
  equalWidth,
  indicator,
  layout,
}: SegmentTabProps) {
  const activeIconColor = '#050B13';
  const inactiveIconColor = darkMode ? '#e2e8f0' : '#334155';
  const activeLabelColor = StyleSheet.flatten(styles.segmentLabelActive).color as string;
  const inactiveLabelColor = StyleSheet.flatten(styles.segmentLabel).color as string;
  const badgeCount = item.badgeCount ?? 0;
  const tabX = layout?.x ?? 0;
  const tabW = layout?.width ?? 0;
  const measured = !!layout;

  const fallbackX = useSharedValue(0);
  const fallbackW = useSharedValue(0);
  const indX = indicator?.x ?? fallbackX;
  const indW = indicator?.width ?? fallbackW;

  const tintStyle = useAnimatedStyle(() => {
    if (!measured || tabW <= 0 || indW.value <= 0) {
      return { opacity: isActive ? 1 : 0 };
    }
    const overlap = Math.min(indX.value + indW.value, tabX + tabW) - Math.max(indX.value, tabX);
    return { opacity: Math.min(1, Math.max(0, overlap / tabW)) };
  });

  const baseIconStyle = useAnimatedStyle(() => {
    if (!measured || tabW <= 0 || indW.value <= 0) {
      return { opacity: isActive ? 0 : 1 };
    }
    const overlap = Math.min(indX.value + indW.value, tabX + tabW) - Math.max(indX.value, tabX);
    return { opacity: 1 - Math.min(1, Math.max(0, overlap / tabW)) };
  });

  const labelStyle = useAnimatedStyle(() => {
    if (!measured || tabW <= 0 || indW.value <= 0) {
      return { color: isActive ? activeLabelColor : inactiveLabelColor };
    }
    const overlap = Math.min(indX.value + indW.value, tabX + tabW) - Math.max(indX.value, tabX);
    const p = Math.min(1, Math.max(0, overlap / tabW));
    return { color: interpolateColor(p, [0, 1], [inactiveLabelColor, activeLabelColor]) };
  });

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => onLayout(item.key, e.nativeEvent.layout),
    [onLayout, item.key]
  );

  const sliding = indicator != null;

  const icon = sliding ? (
    <View style={styles.segmentIconSlot}>
      <Animated.View style={baseIconStyle}>
        <Ionicons name={item.icon} size={16} color={inactiveIconColor} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.segmentIconCenter, tintStyle]}>
        <Ionicons name={item.icon} size={16} color={activeIconColor} />
      </Animated.View>
    </View>
  ) : (
    <View style={styles.segmentIconSlot}>
      <Ionicons name={item.icon} size={16} color={isActive ? activeIconColor : inactiveIconColor} />
    </View>
  );

  const label = sliding ? (
    <Animated.Text
      style={[styles.segmentLabel, labelStyle]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.82}
    >
      {item.label}
    </Animated.Text>
  ) : (
    <Text
      style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.82}
    >
      {item.label}
    </Text>
  );

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
        {icon}
        {label}
      </View>
    </>
  );

  const tabStyle = [
    styles.segmentTab,
    !equalWidth && styles.segmentTabScroll,
  ];

  if (isActive && !sliding) {
    return (
      <Pressable
        onPress={onPress}
        onLayout={handleLayout}
        style={[
          tabStyle,
          styles.segmentTabClipped,
          styles.segmentTabActive,
          equalWidth && styles.segmentTabFlex,
        ]}
      >
        {tabContent}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLayout={handleLayout}
      style={[tabStyle, equalWidth && styles.segmentTabFlex]}
    >
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

  const [layouts, setLayouts] = useState<Record<string, TabLayout>>({});
  const handleTabLayout = useCallback((key: string, next: TabLayout) => {
    setLayouts((prev) => {
      const cur = prev[key];
      if (
        cur &&
        cur.x === next.x &&
        cur.y === next.y &&
        cur.width === next.width &&
        cur.height === next.height
      ) {
        return prev;
      }
      return { ...prev, [key]: next };
    });
  }, []);

  const indX = useSharedValue(0);
  const indW = useSharedValue(0);
  const placedRef = useRef(false);
  const activeLayout = layouts[activeKey];
  const sliding = CAN_SLIDE && activeLayout != null;
  const indicator = useMemo(
    () => (sliding ? { x: indX, width: indW } : null),
    [sliding, indX, indW]
  );

  useEffect(() => {
    if (!CAN_SLIDE || !activeLayout) return;
    if (!placedRef.current) {
      placedRef.current = true;
      indX.value = activeLayout.x;
      indW.value = activeLayout.width;
      return;
    }
    indX.value = withSpring(activeLayout.x, INDICATOR_SPRING);
    indW.value = withSpring(activeLayout.width, INDICATOR_SPRING);
  }, [activeLayout, indX, indW]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indW.value,
    transform: [{ translateX: indX.value }],
  }));

  const indicatorView = sliding ? (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.segmentIndicator,
        { top: activeLayout.y, height: activeLayout.height },
        indicatorStyle,
      ]}
    />
  ) : null;

  const tabs = items.map((item) => (
    <SegmentTab
      key={item.key}
      item={item}
      isActive={activeKey === item.key}
      onPress={() => onPress(item.key)}
      onLayout={handleTabLayout}
      styles={styles}
      darkMode={darkMode}
      equalWidth={!shouldScroll}
      indicator={indicator}
      layout={layouts[item.key]}
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
          {indicatorView}
          {tabs}
        </ScrollView>
      ) : (
        <View style={styles.segmentInner}>
          {indicatorView}
          {tabs}
        </View>
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
      borderColor: 'rgba(148, 163, 184, 0.35)',
      marginBottom: desktopWeb ? 22 : 18,
    },
    segmentInner: {
      flexDirection: 'row',
      padding: desktopWeb ? 5 : 4,
      backgroundColor: isDarkBg ? '#202022' : Colors.surface2,
      minWidth: '100%',
    },
    segmentInnerScroll: {
      flexDirection: 'row',
      padding: desktopWeb ? 5 : 4,
      backgroundColor: isDarkBg ? '#202022' : Colors.surface2,
      gap: 2,
    },
    segmentIndicator: {
      position: 'absolute',
      left: 0,
      borderRadius: 999,
      backgroundColor: BPS_BRAND_GREEN,
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
      backgroundColor: BPS_BRAND_GREEN,
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
    segmentIconCenter: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentLabel: {
      fontSize: desktopWeb ? 14 : 13,
      fontWeight: '600',
      color: isDarkBg ? '#e2e8f0' : '#334155',
      flexShrink: 1,
    },
    segmentLabelActive: {
      color: isDarkBg ? '#050B13' : '#071018',
    },
    segmentBadgeFloated: {
      position: 'absolute',
      top: 0,
      right: 1,
      zIndex: 2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(251, 191, 36, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(251, 191, 36, 0.42)',
    },
    segmentBadgeText: {
      color: '#fbbf24',
      fontSize: 10,
      fontWeight: '800',
      lineHeight: 12,
    },
  });
}
