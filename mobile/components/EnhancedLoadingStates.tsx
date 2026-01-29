import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function SkeletonLoader({
  width: skeletonWidth = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonLoaderProps) {
  const { darkMode } = useTheme();
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  const theme = darkMode
    ? {
        base: '#374151',
        highlight: '#4b5563',
      }
    : {
        base: '#e5e7eb',
        highlight: '#f3f4f6',
      };

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    shimmer.start();

    return () => shimmer.stop();
  }, []);

  const backgroundColor = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.base, theme.highlight],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: skeletonWidth,
          height,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    />
  );
}

interface LoadingCardProps {
  title?: string;
  subtitle?: string;
  showProgress?: boolean;
  progress?: number;
}

export function LoadingCard({
  title = 'Loading...',
  subtitle = 'Please wait while we process your request',
  showProgress = false,
  progress = 0,
}: LoadingCardProps) {
  const { darkMode } = useTheme();
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;

  const theme = darkMode
    ? {
        background: '#1B365D',
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        accent: '#43cea2',
      }
    : {
        background: '#ffffff',
        text: '#1e293b',
        subtext: '#64748b',
        accent: '#1976d2',
      };

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    if (showProgress) {
      Animated.timing(progressAnimation, {
        toValue: progress,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }

    return () => pulse.stop();
  }, [progress, showProgress]);

  return (
    <Animated.View
      style={[
        styles.loadingCard,
        {
          backgroundColor: theme.background,
          transform: [{ scale: pulseAnimation }],
        },
      ]}
    >
      <View style={styles.loadingContent}>
        <ActivityIndicator size='large' color={theme.accent} />
        <Text style={[styles.loadingTitle, { color: theme.text }]}>
          {title}
        </Text>
        <Text style={[styles.loadingSubtitle, { color: theme.subtext }]}>
          {subtitle}
        </Text>

        {showProgress && (
          <View style={styles.progressContainer}>
            <View
              style={[styles.progressBar, { backgroundColor: theme.subtext }]}
            >
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.accent,
                    width: progressAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: theme.subtext }]}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

interface SuccessToastProps {
  visible: boolean;
  message: string;
  onHide: () => void;
  duration?: number;
}

export function SuccessToast({
  visible,
  message,
  onHide,
  duration = 3000,
}: SuccessToastProps) {
  const slideAnimation = useRef(new Animated.Value(-100)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnimation, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          transform: [{ translateY: slideAnimation }],
          opacity: fadeAnimation,
        },
      ]}
    >
      <View style={styles.toastContent}>
        <Text style={styles.toastIcon}>✅</Text>
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
}

interface ErrorToastProps {
  visible: boolean;
  message: string;
  onHide: () => void;
  duration?: number;
}

export function ErrorToast({
  visible,
  message,
  onHide,
  duration = 4000,
}: ErrorToastProps) {
  const slideAnimation = useRef(new Animated.Value(-100)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(shakeAnimation, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: -10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: 10,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnimation, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnimation, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        styles.errorToast,
        {
          transform: [
            { translateY: slideAnimation },
            { translateX: shakeAnimation },
          ],
          opacity: fadeAnimation,
        },
      ]}
    >
      <View style={styles.toastContent}>
        <Text style={styles.toastIcon}>❌</Text>
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
}

interface ProgressIndicatorProps {
  steps: string[];
  currentStep: number;
  completedSteps?: number[];
}

export function ProgressIndicator({
  steps,
  currentStep,
  completedSteps = [],
}: ProgressIndicatorProps) {
  const { darkMode } = useTheme();
  const progressAnimation = useRef(new Animated.Value(0)).current;

  const theme = darkMode
    ? {
        background: '#1B365D',
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        accent: '#43cea2',
        success: '#10b981',
      }
    : {
        background: '#ffffff',
        text: '#1e293b',
        subtext: '#64748b',
        accent: '#1976d2',
        success: '#059669',
      };

  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: currentStep / (steps.length - 1),
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [currentStep, steps.length]);

  return (
    <View style={styles.progressIndicator}>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressLine,
            {
              backgroundColor: theme.accent,
              width: progressAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <View style={styles.stepsContainer}>
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = index === currentStep;

          return (
            <View key={index} style={styles.stepContainer}>
              <View
                style={[
                  styles.stepCircle,
                  {
                    backgroundColor: isCompleted
                      ? theme.success
                      : isCurrent
                        ? theme.accent
                        : theme.subtext,
                  },
                ]}
              >
                <Text style={styles.stepNumber}>
                  {isCompleted ? '✓' : index + 1}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color: isCurrent ? theme.text : theme.subtext,
                    fontWeight: isCurrent ? '600' : '400',
                  },
                ]}
              >
                {step}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number;
}

export function LoadingOverlay({
  visible,
  message = 'Loading...',
  progress,
}: LoadingOverlayProps) {
  const fadeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnimation,
        },
      ]}
    >
      <View style={styles.overlayContent}>
        <ActivityIndicator size='large' color='#43cea2' />
        <Text style={styles.overlayText}>{message}</Text>
        {progress !== undefined && (
          <View style={styles.overlayProgress}>
            <View style={styles.overlayProgressBar}>
              <View
                style={[styles.overlayProgressFill, { width: `${progress}%` }]}
              />
            </View>
            <Text style={styles.overlayProgressText}>{progress}%</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    marginVertical: 4,
  },
  loadingCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  toast: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  errorToast: {
    backgroundColor: '#ef4444',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  toastText: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  progressIndicator: {
    padding: 20,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressLine: {
    height: '100%',
    borderRadius: 2,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumber: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  stepLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  overlayContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
  },
  overlayText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
    color: '#1e293b',
  },
  overlayProgress: {
    width: '100%',
    marginTop: 16,
  },
  overlayProgressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  overlayProgressFill: {
    height: '100%',
    backgroundColor: '#43cea2',
    borderRadius: 2,
  },
  overlayProgressText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#64748b',
  },
});
