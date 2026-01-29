import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Fade In Animation
export const useFadeIn = (duration: number = 300, delay: number = 0) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, duration, delay]);

  return fadeAnim;
};

// Slide In Animation
export const useSlideIn = (
  direction: 'up' | 'down' | 'left' | 'right' = 'up',
  duration: number = 300,
  delay: number = 0
) => {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const toValue =
      direction === 'up'
        ? 0
        : direction === 'down'
          ? 0
          : direction === 'left'
            ? 0
            : 0;
    const fromValue =
      direction === 'up'
        ? 50
        : direction === 'down'
          ? -50
          : direction === 'left'
            ? 50
            : -50;

    slideAnim.setValue(fromValue);

    Animated.timing(slideAnim, {
      toValue,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [slideAnim, direction, duration, delay]);

  return slideAnim;
};

// Scale Animation
export const useScale = (duration: number = 300, delay: number = 0) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim, duration, delay]);

  return scaleAnim;
};

// Bounce Animation
export const useBounce = (duration: number = 600, delay: number = 0) => {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: 1,
        duration: duration * 0.6,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(bounceAnim, {
        toValue: 0.8,
        duration: duration * 0.2,
        useNativeDriver: true,
      }),
      Animated.timing(bounceAnim, {
        toValue: 1,
        duration: duration * 0.2,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bounceAnim, duration, delay]);

  return bounceAnim;
};

// Pulse Animation
export const usePulse = (duration: number = 1000, delay: number = 0) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };

    const timer = setTimeout(pulse, delay);
    return () => clearTimeout(timer);
  }, [pulseAnim, duration, delay]);

  return pulseAnim;
};

// Shake Animation
export const useShake = (duration: number = 500, delay: number = 0) => {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shake = () => {
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const timer = setTimeout(shake, delay);
    return () => clearTimeout(timer);
  }, [shakeAnim, duration, delay]);

  return shakeAnim;
};

// Staggered Animation for Lists
export const useStaggeredAnimation = (
  itemCount: number,
  delay: number = 100
) => {
  const animations = useRef(
    Array.from({ length: itemCount }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const stagger = animations.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: index * delay,
        useNativeDriver: true,
      })
    );

    Animated.stagger(delay, stagger).start();
  }, [animations, delay]);

  return animations;
};

// Loading Spinner Animation
export const useSpinner = (duration: number = 1000) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = () => {
      Animated.timing(spinAnim, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(() => {
        spinAnim.setValue(0);
        spin();
      });
    };

    spin();
  }, [spinAnim, duration]);

  return spinAnim;
};

// Progress Bar Animation
export const useProgressBar = (progress: number, duration: number = 500) => {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration,
      useNativeDriver: false,
    }).start();
  }, [progressAnim, progress, duration]);

  return progressAnim;
};

// Parallax Scroll Animation
export const useParallax = (scrollY: Animated.Value, speed: number = 0.5) => {
  const parallaxY = scrollY.interpolate({
    inputRange: [0, screenHeight],
    outputRange: [0, -screenHeight * speed],
    extrapolate: 'clamp',
  });

  return parallaxY;
};

// Card Flip Animation
export const useCardFlip = () => {
  const flipAnim = useRef(new Animated.Value(0)).current;

  const flip = () => {
    Animated.timing(flipAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const flipBack = () => {
    Animated.timing(flipAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  return {
    flipAnim,
    flip,
    flipBack,
    frontInterpolate,
    backInterpolate,
  };
};

// Gesture-based Animations
export const useGestureAnimation = () => {
  const panAnim = useRef(new Animated.ValueXY()).current;

  const resetPosition = () => {
    Animated.spring(panAnim, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
    }).start();
  };

  const snapToPosition = (x: number, y: number) => {
    Animated.spring(panAnim, {
      toValue: { x, y },
      useNativeDriver: true,
    }).start();
  };

  return {
    panAnim,
    resetPosition,
    snapToPosition,
  };
};

// Haptic Feedback Animation
export const useHapticFeedback = () => {
  const hapticAnim = useRef(new Animated.Value(1)).current;

  const triggerHaptic = () => {
    Animated.sequence([
      Animated.timing(hapticAnim, {
        toValue: 0.95,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(hapticAnim, {
        toValue: 1,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return {
    hapticAnim,
    triggerHaptic,
  };
};

// Success/Error Animation
export const useStatusAnimation = (type: 'success' | 'error' | 'warning') => {
  const statusAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(statusAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [statusAnim, scaleAnim]);

  return {
    statusAnim,
    scaleAnim,
  };
};

// Tab Indicator Animation
export const useTabIndicator = (activeIndex: number, tabCount: number) => {
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(indicatorAnim, {
      toValue: activeIndex,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [indicatorAnim, activeIndex]);

  const translateX = indicatorAnim.interpolate({
    inputRange: [0, tabCount - 1],
    outputRange: [0, (screenWidth / tabCount) * (tabCount - 1)],
  });

  return {
    indicatorAnim,
    translateX,
  };
};

// Floating Action Button Animation
export const useFAB = () => {
  const fabAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  const showFAB = () => {
    Animated.parallel([
      Animated.spring(fabAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideFAB = () => {
    Animated.parallel([
      Animated.spring(fabAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(rotationAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const rotation = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return {
    fabAnim,
    rotation,
    showFAB,
    hideFAB,
  };
};

// Skeleton Loading Animation
export const useSkeleton = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = () => {
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => shimmer());
    };

    shimmer();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  return {
    shimmerAnim,
    opacity,
  };
};

// Notification Animation
export const useNotification = () => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const showNotification = () => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return {
    slideAnim,
    opacityAnim,
    showNotification,
    hideNotification,
  };
};

// Custom Hook for Combined Animations
export const useCombinedAnimation = (animations: any[], delay: number = 0) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel(animations).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [animations, delay]);
};

// Animation Presets
export const AnimationPresets = {
  fadeIn: { duration: 300, delay: 0 },
  slideIn: { duration: 300, delay: 0 },
  bounce: { duration: 600, delay: 0 },
  pulse: { duration: 1000, delay: 0 },
  shake: { duration: 500, delay: 0 },
  stagger: { delay: 100 },
  spinner: { duration: 1000 },
  progress: { duration: 500 },
};

export default {
  useFadeIn,
  useSlideIn,
  useScale,
  useBounce,
  usePulse,
  useShake,
  useStaggeredAnimation,
  useSpinner,
  useProgressBar,
  useParallax,
  useCardFlip,
  useGestureAnimation,
  useHapticFeedback,
  useStatusAnimation,
  useTabIndicator,
  useFAB,
  useSkeleton,
  useNotification,
  useCombinedAnimation,
  AnimationPresets,
};
