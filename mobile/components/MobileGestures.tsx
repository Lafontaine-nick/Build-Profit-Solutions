import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import {
  PanGestureHandler,
  TapGestureHandler,
  LongPressGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { mobileOptimization } from '../services/MobileOptimization';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Swipeable Card Component
export const SwipeableCard: React.FC<{
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  style?: any;
}> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  style,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const onGestureEvent = Animated.event(
    [
      {
        nativeEvent: {
          translationX: translateX,
          translationY: translateY,
        },
      },
    ],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, translationY, velocityX, velocityY } =
        event.nativeEvent;

      // Determine swipe direction
      const isHorizontalSwipe = Math.abs(translationX) > Math.abs(translationY);
      const isVerticalSwipe = Math.abs(translationY) > Math.abs(translationX);

      if (isHorizontalSwipe) {
        if (translationX > threshold && velocityX > 0.5) {
          // Swipe right
          onSwipeRight?.();
          mobileOptimization.selectionChange();
          animateSwipeOut('right');
        } else if (translationX < -threshold && velocityX < -0.5) {
          // Swipe left
          onSwipeLeft?.();
          mobileOptimization.selectionChange();
          animateSwipeOut('left');
        } else {
          // Return to center
          animateReturn();
        }
      } else if (isVerticalSwipe) {
        if (translationY > threshold && velocityY > 0.5) {
          // Swipe down
          onSwipeDown?.();
          mobileOptimization.selectionChange();
          animateSwipeOut('down');
        } else if (translationY < -threshold && velocityY < -0.5) {
          // Swipe up
          onSwipeUp?.();
          mobileOptimization.selectionChange();
          animateSwipeOut('up');
        } else {
          // Return to center
          animateReturn();
        }
      } else {
        // Return to center
        animateReturn();
      }
    }
  };

  const animateSwipeOut = (direction: 'left' | 'right' | 'up' | 'down') => {
    const targetX =
      direction === 'left'
        ? -screenWidth
        : direction === 'right'
          ? screenWidth
          : 0;
    const targetY =
      direction === 'up'
        ? -screenHeight
        : direction === 'down'
          ? screenHeight
          : 0;

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: targetX,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: targetY,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateReturn = () => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ translateX }, { translateY }, { scale }],
            opacity,
          },
        ]}
      >
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
};

// Pull to Refresh Component
export const PullToRefresh: React.FC<{
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  refreshing?: boolean;
  style?: any;
}> = ({ children, onRefresh, refreshing = false, style }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const [isRefreshing, setIsRefreshing] = useState(refreshing);

  const onGestureEvent = Animated.event(
    [
      {
        nativeEvent: {
          translationY: translateY,
        },
      },
    ],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY } = event.nativeEvent;

      if (translationY > 100 && !isRefreshing) {
        handleRefresh();
      }

      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mobileOptimization.mediumImpact();

    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ translateY }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </PanGestureHandler>
  );
};

// Long Press Component
export const LongPressable: React.FC<{
  children: React.ReactNode;
  onLongPress: () => void;
  delay?: number;
  style?: any;
}> = ({ children, onLongPress, delay = 500, style }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.BEGAN) {
      // Press started
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 0.95,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      mobileOptimization.lightImpact();
    } else if (event.nativeEvent.state === State.END) {
      // Press ended
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  return (
    <LongPressGestureHandler
      onHandlerStateChange={onHandlerStateChange}
      onActivated={onLongPress}
      minDurationMs={delay}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        {children}
      </Animated.View>
    </LongPressGestureHandler>
  );
};

// Double Tap Component
export const DoubleTappable: React.FC<{
  children: React.ReactNode;
  onDoubleTap: () => void;
  style?: any;
}> = ({ children, onDoubleTap, style }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.1,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();

      mobileOptimization.selectionChange();
    }
  };

  return (
    <TapGestureHandler
      onHandlerStateChange={onHandlerStateChange}
      onActivated={onDoubleTap}
      numberOfTaps={2}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </TapGestureHandler>
  );
};

// Gesture Feedback Component
export const GestureFeedback: React.FC<{
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  onDoublePress?: () => void;
  hapticType?: 'light' | 'medium' | 'heavy' | 'selection';
  style?: any;
}> = ({
  children,
  onPress,
  onLongPress,
  onDoublePress,
  hapticType = 'light',
  style,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const triggerHaptic = () => {
    switch (hapticType) {
      case 'light':
        mobileOptimization.lightImpact();
        break;
      case 'medium':
        mobileOptimization.mediumImpact();
        break;
      case 'heavy':
        mobileOptimization.heavyImpact();
        break;
      case 'selection':
        mobileOptimization.selectionChange();
        break;
    }
  };

  const onPressIn = () => {
    triggerHaptic();
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.95,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <TapGestureHandler
      onHandlerStateChange={event => {
        if (event.nativeEvent.state === State.BEGAN) {
          onPressIn();
        } else if (event.nativeEvent.state === State.END) {
          onPressOut();
          onPress?.();
        }
      }}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        {children}
      </Animated.View>
    </TapGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default {
  SwipeableCard,
  PullToRefresh,
  LongPressable,
  DoubleTappable,
  GestureFeedback,
};
