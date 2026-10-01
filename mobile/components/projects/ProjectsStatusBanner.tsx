import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { estimateFlowCardStyle } from '@/utils/estimateFlowCardStyle';

export type ProjectsStatusBannerVariant = 'submitted' | 'activated';

type FlowColors = {
  line: string;
  surface2: string;
  text: string;
};

const BANNER_ACCENT = '#2dcc9a';
const BANNER_MUTED = '#94a3b8';

const BANNER_ICONS: Record<ProjectsStatusBannerVariant, keyof typeof Ionicons.glyphMap> = {
  submitted: 'paper-plane-outline',
  activated: 'checkmark-circle-outline',
};

type ProjectsStatusBannerProps = {
  visible: boolean;
  variant: ProjectsStatusBannerVariant;
  title: string;
  body: string;
  darkMode: boolean;
  Colors: FlowColors;
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
  autoDismissMs?: number;
  bodyLines?: number;
};

export function ProjectsStatusBanner({
  visible,
  variant,
  title,
  body,
  darkMode,
  Colors,
  onDismiss,
  style,
  autoDismissMs = 4800,
  bodyLines = 2,
}: ProjectsStatusBannerProps) {
  const translateY = useRef(new Animated.Value(-10)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);
  const panStartY = useRef(0);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const dismissAnimated = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -14,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      closingRef.current = false;
      if (finished) onDismissRef.current();
    });
  }, [opacity, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > Math.abs(g.dx) && g.dy < -6,
        onPanResponderGrant: () => {
          translateY.stopAnimation((v) => {
            panStartY.current = v;
          });
        },
        onPanResponderMove: (_, g) => {
          const next = Math.min(0, panStartY.current + g.dy);
          translateY.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy < -28 || g.vy < -0.45) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            dismissAnimated();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 80,
              friction: 12,
            }).start();
          }
        },
      }),
    [dismissAnimated, translateY]
  );

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    translateY.setValue(-12);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 11,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
    timerRef.current = setTimeout(() => {
      dismissAnimated();
    }, autoDismissMs);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, autoDismissMs, dismissAnimated, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        estimateFlowCardStyle(Colors, darkMode, { marginBottom: 0, marginTop: 0 }),
        {
          borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
          padding: 0,
          shadowOpacity: 0,
          elevation: 0,
          opacity,
          transform: [{ translateY }],
        },
        style,
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.row}>
        <Ionicons name={BANNER_ICONS[variant]} size={18} color={BANNER_ACCENT} />
        <View style={styles.textCol}>
          <Text
            style={[
              styles.title,
              { color: darkMode ? Colors.text : '#0f172a' },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.body,
              {
                color: darkMode ? BANNER_MUTED : '#64748b',
              },
            ]}
            numberOfLines={bodyLines}
            ellipsizeMode="tail"
          >
            {body}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            dismissAnimated();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          style={({ pressed }) => [
            styles.dismissBtn,
            pressed && styles.dismissBtnPressed,
          ]}
        >
          <Ionicons
            name="close"
            size={16}
            color={darkMode ? BANNER_MUTED : '#64748b'}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 14,
    paddingRight: 8,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.25,
    marginBottom: 2,
  },
  body: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    ...Platform.select({
      android: { marginRight: 2 },
    }),
  },
  dismissBtnPressed: {
    opacity: 0.65,
  },
});
