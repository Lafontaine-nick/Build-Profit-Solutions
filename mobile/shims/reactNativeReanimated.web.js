const ReactNative = require('react-native');
const React = require('react');

const NOOP = () => {};
const ID = value => value;

function makeSharedValue(initialValue) {
  return {
    value: initialValue,
    get() {
      return this.value;
    },
    set(nextValue) {
      this.value = typeof nextValue === 'function' ? nextValue(this.value) : nextValue;
    },
  };
}

function useAnimatedStyle(updater) {
  try {
    return typeof updater === 'function' ? updater() : {};
  } catch {
    return {};
  }
}

function interpolate(value, inputRange = [0, 1], outputRange = [0, 1]) {
  const startIn = inputRange[0] ?? 0;
  const endIn = inputRange[inputRange.length - 1] ?? 1;
  const startOut = outputRange[0] ?? 0;
  const endOut = outputRange[outputRange.length - 1] ?? 1;
  const progress = endIn === startIn ? 0 : (value - startIn) / (endIn - startIn);
  return startOut + progress * (endOut - startOut);
}

const Animated = {
  ...ReactNative.Animated,
  View: ReactNative.Animated.View,
  Text: ReactNative.Animated.Text,
  Image: ReactNative.Animated.Image,
  ScrollView: ReactNative.Animated.ScrollView,
  FlatList: ReactNative.Animated.FlatList,
  createAnimatedComponent: ReactNative.Animated.createAnimatedComponent,
};

const BaseAnimationBuilder = {
  duration() { return this; },
  delay() { return this; },
  springify() { return this; },
  damping() { return this; },
  stiffness() { return this; },
  withCallback() { return this; },
  withInitialValues() { return this; },
  easing() { return this; },
  build() { return () => ({ initialValues: {}, animations: {} }); },
};

module.exports = {
  __esModule: true,
  default: Animated,
  useSharedValue: makeSharedValue,
  useAnimatedStyle,
  useAnimatedProps: useAnimatedStyle,
  useAnimatedRef: () => React.useRef(null),
  useScrollViewOffset: () => makeSharedValue(0),
  useScrollOffset: () => makeSharedValue(0),
  useAnimatedScrollHandler: () => NOOP,
  useDerivedValue: updater => makeSharedValue(typeof updater === 'function' ? updater() : updater),
  withTiming: ID,
  withSpring: ID,
  withRepeat: ID,
  withSequence: (...values) => values[values.length - 1],
  withDelay: (_delayMs, value) => value,
  withDecay: () => 0,
  cancelAnimation: NOOP,
  runOnJS: fn => fn,
  runOnUI: fn => fn,
  runOnRuntime: (_runtime, fn) => fn,
  createWorkletRuntime: NOOP,
  makeMutable: makeSharedValue,
  createAnimatedComponent: ReactNative.Animated.createAnimatedComponent,
  interpolate,
  interpolateColor: () => undefined,
  Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Easing: ReactNative.Easing,
  FadeIn: BaseAnimationBuilder,
  FadeOut: BaseAnimationBuilder,
  SlideInRight: BaseAnimationBuilder,
  SlideOutRight: BaseAnimationBuilder,
  Layout: BaseAnimationBuilder,
  LinearTransition: BaseAnimationBuilder,
};
