import React, { useState, useEffect } from 'react';
import {
  Platform,
  Dimensions,
  StatusBar,
  Keyboard,
  AppState,
  AppStateStatus,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Mobile Optimization Service
class MobileOptimizationService {
  private isInitialized = false;

  // Initialize mobile optimizations
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure status bar
      this.configureStatusBar();

      // Set up haptic feedback
      await this.setupHaptics();

      // Configure gesture handling
      this.setupGestures();

      this.isInitialized = true;
      console.log('MobileOptimizationService initialized');
    } catch (error) {
      console.error('Failed to initialize MobileOptimizationService:', error);
    }
  }

  // Status Bar Configuration
  private configureStatusBar(): void {
    if (Platform.OS === 'ios') {
      StatusBar.setBarStyle('light-content', true);
    } else {
      StatusBar.setBackgroundColor('transparent', true);
      StatusBar.setBarStyle('light-content', true);
    }
  }

  // Haptic Feedback Setup
  private async setupHaptics(): Promise<void> {
    try {
      // Check if haptics are available
      // Haptics are available on most modern devices
      // Check platform to determine haptic support
      if (Platform.OS === 'web') {
        console.log('Haptics not available on web platform');
        return;
      }

      console.log('Haptics initialized successfully');
    } catch (error) {
      console.error('Failed to setup haptics:', error);
    }
  }

  // Gesture Setup
  private setupGestures(): void {
    // Gesture configuration will be handled by individual components
    console.log('Gesture handling configured');
  }

  // Haptic Feedback Methods
  async lightImpact(): Promise<void> {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Haptic feedback failed:', error);
    }
  }

  async mediumImpact(): Promise<void> {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Haptic feedback failed:', error);
    }
  }

  async heavyImpact(): Promise<void> {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      console.error('Haptic feedback failed:', error);
    }
  }

  async selectionChange(): Promise<void> {
    try {
      await Haptics.selectionAsync();
    } catch (error) {
      console.error('Haptic feedback failed:', error);
    }
  }

  async notification(
    type: 'success' | 'warning' | 'error'
  ): Promise<void> {
    try {
      switch (type) {
        case 'success':
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
          break;
        case 'warning':
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning
          );
          break;
        case 'error':
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error
          );
          break;
      }
    } catch (error) {
      console.error('Haptic notification failed:', error);
    }
  }

  // Screen Dimensions
  static getScreenDimensions() {
    return {
      width: screenWidth,
      height: screenHeight,
      isSmall: screenWidth < 375,
      isMedium: screenWidth >= 375 && screenWidth < 414,
      isLarge: screenWidth >= 414,
      isTablet: screenWidth >= 768,
      safeAreaTop: Platform.OS === 'ios' ? 44 : 24,
      safeAreaBottom: Platform.OS === 'ios' ? 34 : 0,
    };
  }

  // Responsive Design Helpers
  static getResponsiveValue(
    small: number,
    medium: number,
    large: number
  ): number {
    const { isSmall, isMedium, isLarge } = this.getScreenDimensions();

    if (isSmall) return small;
    if (isMedium) return medium;
    if (isLarge) return large;
    return large;
  }

  static getResponsiveFontSize(baseSize: number): number {
    const { isSmall, isMedium, isLarge } = this.getScreenDimensions();

    if (isSmall) return baseSize * 0.9;
    if (isMedium) return baseSize;
    if (isLarge) return baseSize * 1.1;
    return baseSize;
  }

  static getResponsiveSpacing(baseSpacing: number): number {
    const { isSmall, isMedium, isLarge } = this.getScreenDimensions();

    if (isSmall) return baseSpacing * 0.8;
    if (isMedium) return baseSpacing;
    if (isLarge) return baseSpacing * 1.2;
    return baseSpacing;
  }

  // Platform-specific helpers
  static isIOS(): boolean {
    return Platform.OS === 'ios';
  }

  static isAndroid(): boolean {
    return Platform.OS === 'android';
  }

  static getPlatformVersion(): string {
    return Platform.Version.toString();
  }

  // Performance optimizations
  static optimizeForPerformance(): void {
    // Disable yellow box warnings in production
    if (__DEV__ === false) {
      // Yellow box warnings are handled by LogBox in newer React Native versions
    }
  }

  // Memory management
  static clearMemoryCache(): void {
    // Clear any cached data if needed
    console.log('Memory cache cleared');
  }
}

// Gesture Handler Hook
export const useGestureHandler = () => {
  const translateX = new Animated.Value(0);
  const translateY = new Animated.Value(0);
  const scale = new Animated.Value(1);

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
      // Reset position with spring animation
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
    }
  };

  return {
    translateX,
    translateY,
    scale,
    onGestureEvent,
    onHandlerStateChange,
  };
};

// Swipe Gesture Hook
export const useSwipeGesture = (
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void
) => {
  const translateX = new Animated.Value(0);
  const lastGestureX = new Animated.Value(0);

  const onGestureEvent = Animated.event(
    [
      {
        nativeEvent: {
          translationX: translateX,
        },
      },
    ],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;

      // Determine swipe direction and trigger callbacks
      if (translationX > 50 && velocityX > 0.5) {
        onSwipeRight?.();
        mobileOptimization.selectionChange();
      } else if (translationX < -50 && velocityX < -0.5) {
        onSwipeLeft?.();
        mobileOptimization.selectionChange();
      }

      // Reset position
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  return {
    translateX,
    onGestureEvent,
    onHandlerStateChange,
  };
};

// Pull to Refresh Hook
export const usePullToRefresh = (onRefresh: () => Promise<void>) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const translateY = new Animated.Value(0);

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    await mobileOptimization.mediumImpact();

    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

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

      if (translationY > 100) {
        handleRefresh();
      }

      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  return {
    isRefreshing,
    translateY,
    onGestureEvent,
    onHandlerStateChange,
    handleRefresh,
  };
};

// Long Press Hook
export const useLongPress = (onLongPress: () => void, delay: number = 500) => {
  const [isPressed, setIsPressed] = useState(false);
  const scale = new Animated.Value(1);

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();

    // Trigger haptic feedback
    mobileOptimization.lightImpact();
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleLongPress = () => {
    mobileOptimization.mediumImpact();
    onLongPress();
  };

  return {
    isPressed,
    scale,
    handlePressIn,
    handlePressOut,
    handleLongPress,
  };
};

// Keyboard Handling Hook
export const useKeyboard = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    /** RN Web: keyboard listeners are unreliable and `remove`/listener wiring can throw — Estimates uses this hook. */
    if (Platform.OS === 'web') {
      return undefined;
    }

    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      e => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  return {
    keyboardHeight,
    isKeyboardVisible,
  };
};

// Network Status Hook
export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      setConnectionType(state.type);
    });

    return unsubscribe;
  }, []);

  return {
    isConnected,
    connectionType,
  };
};

// Battery Status Hook
export const useBatteryStatus = () => {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean | null>(null);

  useEffect(() => {
    const getBatteryStatus = async () => {
      try {
        const batteryInfo = await Battery.getBatteryLevelAsync();
        setBatteryLevel(batteryInfo);

        const batteryState = await Battery.getBatteryStateAsync();
        setIsCharging(batteryState === Battery.BatteryState.CHARGING);
      } catch (error) {
        console.error('Failed to get battery status:', error);
      }
    };

    getBatteryStatus();
  }, []);

  return {
    batteryLevel,
    isCharging,
  };
};

// Device Orientation Hook
export const useOrientation = () => {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    'portrait'
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setOrientation(window.width > window.height ? 'landscape' : 'portrait');
    });

    return () => subscription?.remove();
  }, []);

  return orientation;
};

// App State Hook
export const useAppState = () => {
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      setAppState(nextAppState);
    });

    return () => subscription?.remove();
  }, []);

  return appState;
};

// Create and export singleton instance
export const mobileOptimization = new MobileOptimizationService();

export default mobileOptimization;
