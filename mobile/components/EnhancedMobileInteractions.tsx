import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanGestureHandler,
  TapGestureHandler,
  LongPressGestureHandler,
  State,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
  leftAction?: string;
  rightAction?: string;
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  leftAction = 'Delete',
  rightAction = 'Edit',
}: SwipeableCardProps) {
  const { darkMode } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [isPressed, setIsPressed] = useState(false);

  const theme = darkMode
    ? {
        background: '#1B365D',
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        accent: '#43cea2',
        danger: '#ef4444',
        success: '#10b981',
      }
    : {
        background: '#ffffff',
        text: '#1e293b',
        subtext: '#64748b',
        accent: '#1976d2',
        danger: '#dc2626',
        success: '#059669',
      };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;

      if (translationX > 100 || velocityX > 500) {
        // Swipe right
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: width,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.95,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onSwipeRight?.();
          translateX.setValue(0);
          scale.setValue(1);
        });
      } else if (translationX < -100 || velocityX < -500) {
        // Swipe left
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: -width,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.95,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onSwipeLeft?.();
          translateX.setValue(0);
          scale.setValue(1);
        });
      } else {
        // Return to center
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
        ]).start();
      }
    }
  };

  const onLongPressStateChange = (event: any) => {
    if (event.nativeEvent.state === State.BEGAN) {
      setIsPressed(true);
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (
      event.nativeEvent.state === State.END ||
      event.nativeEvent.state === State.CANCELLED
    ) {
      setIsPressed(false);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    }
  };

  const onLongPress = () => {
    onLongPress?.();
  };

  return (
    <View style={styles.swipeableContainer}>
      {/* Action indicators */}
      <View
        style={[
          styles.actionIndicator,
          styles.leftAction,
          { backgroundColor: theme.success },
        ]}
      >
        <Text style={styles.actionText}>{rightAction}</Text>
      </View>
      <View
        style={[
          styles.actionIndicator,
          styles.rightAction,
          { backgroundColor: theme.danger },
        ]}
      >
        <Text style={styles.actionText}>{leftAction}</Text>
      </View>

      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: theme.background,
              transform: [{ translateX }, { scale }],
            },
          ]}
        >
          <LongPressGestureHandler
            onHandlerStateChange={onLongPressStateChange}
            onActivated={onLongPress}
            minDurationMs={500}
          >
            <Animated.View style={styles.cardContent}>{children}</Animated.View>
          </LongPressGestureHandler>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  refreshing: boolean;
}

export function PullToRefresh({
  onRefresh,
  children,
  refreshing,
}: PullToRefreshProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY } = event.nativeEvent;

      if (translationY > 100) {
        // Trigger refresh
        setIsRefreshing(true);
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 60,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.loop(
            Animated.timing(rotate, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            })
          ),
        ]).start();

        onRefresh().finally(() => {
          setIsRefreshing(false);
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(rotate, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]).start();
        });
      } else {
        // Return to original position
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      }
    }
  };

  const rotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.pullToRefreshContainer}>
      <Animated.View
        style={[
          styles.refreshIndicator,
          {
            transform: [{ translateY }],
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.refreshText,
            {
              transform: [{ rotate }],
            },
          ]}
        >
          {isRefreshing ? '🔄' : '⬇️'}
        </Animated.Text>
        <Text style={styles.refreshLabel}>
          {isRefreshing ? 'Refreshing...' : 'Pull to refresh'}
        </Text>
      </Animated.View>

      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          {children}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

interface HapticButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  icon?: string;
}

export function HapticButton({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  icon,
}: HapticButtonProps) {
  const { darkMode } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const [isPressed, setIsPressed] = useState(false);

  const theme = darkMode
    ? {
        primary: '#43cea2',
        secondary: '#64748b',
        danger: '#ef4444',
        text: '#f1f5f9',
        disabled: '#374151',
      }
    : {
        primary: '#1976d2',
        secondary: '#6b7280',
        danger: '#dc2626',
        text: '#ffffff',
        disabled: '#d1d5db',
      };

  const getVariantStyle = () => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: theme.primary };
      case 'secondary':
        return { backgroundColor: theme.secondary };
      case 'danger':
        return { backgroundColor: theme.danger };
      default:
        return { backgroundColor: theme.primary };
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 16, fontSize: 14 };
      case 'large':
        return { paddingVertical: 16, paddingHorizontal: 32, fontSize: 18 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 24, fontSize: 16 };
    }
  };

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.timing(scale, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.hapticButton,
          getVariantStyle(),
          getSizeStyle(),
          disabled && { backgroundColor: theme.disabled },
          {
            transform: [{ scale }],
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        {icon && <Text style={styles.buttonIcon}>{icon}</Text>}
        <Text style={[styles.buttonText, { color: theme.text }]}>{title}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

interface FloatingActionButtonProps {
  onPress: () => void;
  icon: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export function FloatingActionButton({
  onPress,
  icon,
  position = 'bottom-right',
}: FloatingActionButtonProps) {
  const { darkMode } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  const theme = darkMode
    ? {
        background: '#43cea2',
        shadow: 'rgba(0, 0, 0, 0.3)',
      }
    : {
        background: '#1976d2',
        shadow: 'rgba(0, 0, 0, 0.2)',
      };

  const getPositionStyle = () => {
    switch (position) {
      case 'bottom-left':
        return { bottom: 20, left: 20 };
      case 'top-right':
        return { top: 20, right: 20 };
      case 'top-left':
        return { top: 20, left: 20 };
      default:
        return { bottom: 20, right: 20 };
    }
  };

  const handlePress = () => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]),
      Animated.timing(rotate, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      rotate.setValue(0);
      onPress();
    });
  };

  const rotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.fab,
        {
          backgroundColor: theme.background,
          shadowColor: theme.shadow,
          ...getPositionStyle(),
          transform: [{ scale }, { rotate: rotation }],
        },
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        style={styles.fabButton}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>{icon}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  swipeableContainer: {
    position: 'relative',
    marginVertical: 8,
  },
  actionIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  leftAction: {
    left: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  rightAction: {
    right: 0,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    padding: 16,
  },
  pullToRefreshContainer: {
    flex: 1,
  },
  refreshIndicator: {
    position: 'absolute',
    top: -60,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  refreshText: {
    fontSize: 24,
    marginBottom: 4,
  },
  refreshLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  content: {
    flex: 1,
  },
  hapticButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  buttonText: {
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  fabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabIcon: {
    fontSize: 24,
    color: 'white',
  },
});
