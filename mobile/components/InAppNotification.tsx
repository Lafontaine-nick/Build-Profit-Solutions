import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';

const { width } = Dimensions.get('window');
const NOTIFICATION_HEIGHT = 80;
const NOTIFICATION_MARGIN = 12;

export interface InAppNotificationData {
  id?: string;
  title: string;
  body: string;
  icon?: keyof typeof MaterialIcons.glyphMap | keyof typeof Ionicons.glyphMap;
  iconType?: 'material' | 'ionicons';
  type?: 'info' | 'success' | 'warning' | 'error' | 'lead' | 'project';
  action?: {
    label: string;
    onPress: () => void;
  };
  onPress?: () => void;
  duration?: number;
  data?: any;
  /** Called when the banner auto-dismisses or the user closes it. */
  onDismiss?: () => void;
}

interface InAppNotificationProps {
  notification: InAppNotificationData | null;
  onDismiss: () => void;
  onPress?: () => void;
}

export default function InAppNotification({
  notification,
  onDismiss,
  onPress,
}: InAppNotificationProps) {
  const { darkMode, theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(-NOTIFICATION_HEIGHT - NOTIFICATION_MARGIN)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panStartY = useRef(0);
  const isDismissingRef = useRef(false);

  const dismiss = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -NOTIFICATION_HEIGHT - NOTIFICATION_MARGIN,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isDismissingRef.current = false;
      onDismiss();
    });
  }, [onDismiss, opacityAnim, slideAnim]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dy) > Math.abs(g.dx) && g.dy < -8,
        onPanResponderGrant: () => {
          slideAnim.stopAnimation((value) => {
            panStartY.current = value;
          });
        },
        onPanResponderMove: (_, g) => {
          const next = Math.min(0, panStartY.current + g.dy);
          slideAnim.setValue(next);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy < -36 || g.vy < -0.55) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            dismiss();
          } else {
            Animated.spring(slideAnim, {
              toValue: 0,
              useNativeDriver: true,
              tension: 78,
              friction: 11,
            }).start();
          }
        },
      }),
    [dismiss, slideAnim]
  );

  useEffect(() => {
    if (notification) {
      isDismissingRef.current = false;
      // Trigger haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Slide in animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after duration (default 4 seconds)
      const duration = notification.duration || 4000;
      dismissTimeoutRef.current = setTimeout(() => {
        dismiss();
      }, duration);
    } else {
      slideAnim.setValue(-NOTIFICATION_HEIGHT - NOTIFICATION_MARGIN);
      opacityAnim.setValue(0);
    }

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, [notification, dismiss, opacityAnim, slideAnim]);

  if (!notification) return null;

  // Get notification type colors
  const getTypeColors = (): {
    gradient: readonly [string, string];
    iconBg: string;
    iconColor: string;
  } => {
    switch (notification.type) {
      case 'success':
        return {
          gradient: ['#22c55e', '#16a34a'] as const,
          iconBg: 'rgba(34, 197, 94, 0.2)',
          iconColor: '#22c55e',
        };
      case 'warning':
        return {
          gradient: ['#f59e0b', '#d97706'] as const,
          iconBg: 'rgba(245, 158, 11, 0.2)',
          iconColor: '#f59e0b',
        };
      case 'error':
        return {
          gradient: ['#ef4444', '#dc2626'] as const,
          iconBg: 'rgba(239, 68, 68, 0.2)',
          iconColor: '#ef4444',
        };
      case 'lead':
        return {
          gradient: ['#3b82f6', '#2563eb'] as const,
          iconBg: 'rgba(59, 130, 246, 0.2)',
          iconColor: '#3b82f6',
        };
      case 'project':
        return {
          gradient: ['#8b5cf6', '#7c3aed'] as const,
          iconBg: 'rgba(139, 92, 246, 0.2)',
          iconColor: '#8b5cf6',
        };
      default: // info
        return {
          gradient: ['#43cea2', '#2d5a3d'] as const,
          iconBg: 'rgba(67, 206, 162, 0.2)',
          iconColor: '#43cea2',
        };
    }
  };

  const typeColors = getTypeColors();
  const defaultIcon = notification.type === 'lead' ? 'person-add' : 
                      notification.type === 'project' ? 'folder' : 
                      notification.type === 'success' ? 'check-circle' :
                      notification.type === 'error' ? 'error' :
                      notification.type === 'warning' ? 'warning' : 'info';

  const IconComponent = notification.iconType === 'ionicons' ? Ionicons : MaterialIcons;
  const iconName = notification.icon || defaultIcon;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (notification.onPress) {
      notification.onPress();
    } else if (onPress) {
      onPress();
    }
    dismiss();
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        style={styles.touchable}
      >
        <BlurView
          intensity={darkMode ? 80 : 100}
          tint={darkMode ? 'dark' : 'light'}
          style={styles.blurContainer}
        >
          <LinearGradient
            colors={typeColors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientBorder}
          >
            <View
              style={[
                styles.content,
                {
                  backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                },
              ]}
            >
              {/* Icon */}
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: typeColors.iconBg },
                ]}
              >
                <IconComponent
                  name={iconName as any}
                  size={24}
                  color={typeColors.iconColor}
                />
              </View>

              {/* Text Content */}
              <View style={styles.textContainer}>
                <Text
                  style={[
                    styles.title,
                    { color: darkMode ? '#fff' : '#000' },
                  ]}
                  numberOfLines={1}
                >
                  {notification.title}
                </Text>
                <Text
                  style={[
                    styles.body,
                    { color: darkMode ? '#aaa' : '#666' },
                  ]}
                  numberOfLines={2}
                >
                  {notification.body}
                </Text>
              </View>

              {/* Action Button or Close */}
              {notification.action ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: typeColors.iconColor }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    notification.action?.onPress();
                    dismiss();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionText}>{notification.action.label}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    dismiss();
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons
                    name="close"
                    size={20}
                    color={darkMode ? '#aaa' : '#666'}
                  />
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: NOTIFICATION_MARGIN,
    right: NOTIFICATION_MARGIN,
    zIndex: 9999,
    elevation: 10,
  },
  touchable: {
    width: '100%',
  },
  blurContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gradientBorder: {
    borderRadius: 16,
    padding: 1.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14.5,
    minHeight: NOTIFICATION_HEIGHT - 20,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});
