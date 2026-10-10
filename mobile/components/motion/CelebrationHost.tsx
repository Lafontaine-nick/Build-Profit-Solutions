import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { haptic } from '@/utils/haptics';
import { useReduceMotion } from './useReduceMotion';

type Celebration = { id: number; title: string; subtitle?: string };

let listener: ((c: Celebration) => void) | null = null;
let nextId = 1;

/**
 * Brief, non-blocking success moment: checkmark badge, confetti, and a title.
 * Taps pass through. Call after any Modal has started closing (iOS draws Modals above this layer).
 */
export function celebrate(title: string, subtitle?: string) {
  listener?.({ id: nextId++, title, subtitle });
}

const CAN_ANIMATE = Platform.OS !== 'web';
const VISIBLE_MS = 1700;
const FADE_MS = 260;
const CONFETTI_MS = 1600;
const CONFETTI_COLORS = ['#2dcc9a', '#5eead4', '#fbbf24', '#38bdf8', '#F5F7FA'];
const CONFETTI_COUNT = 26;

type PieceSpec = {
  vx: number;
  vy: number;
  gravity: number;
  rotate: number;
  color: string;
  width: number;
  height: number;
};

function makePieces(): PieceSpec[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => {
    const angle = -Math.PI * (0.08 + 0.84 * Math.random());
    const speed = 170 + Math.random() * 170;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 480 + Math.random() * 220,
      rotate: (Math.random() > 0.5 ? 1 : -1) * (240 + Math.random() * 360),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: 6 + Math.random() * 4,
      height: 10 + Math.random() * 6,
    };
  });
}

function ConfettiPiece({ t, spec }: { t: SharedValue<number>; spec: PieceSpec }) {
  const style = useAnimatedStyle(() => {
    const p = t.value;
    const drag = 1 - Math.pow(1 - p, 3);
    return {
      opacity: p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3),
      transform: [
        { translateX: spec.vx * drag },
        { translateY: spec.vy * drag + spec.gravity * p * p },
        { rotate: `${spec.rotate * p}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        { backgroundColor: spec.color, width: spec.width, height: spec.height },
        style,
      ]}
    />
  );
}

function CelebrationView({
  celebration,
  onDone,
}: {
  celebration: Celebration;
  onDone: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const animate = CAN_ANIMATE && !reduceMotion;
  const pieces = useMemo(() => makePieces(), []);

  const fade = useSharedValue(0);
  const badge = useSharedValue(animate ? 0.3 : 1);
  const ring = useSharedValue(0);
  const confetti = useSharedValue(0);

  useEffect(() => {
    haptic.success();
    fade.value = withSequence(
      withTiming(1, { duration: 160 }),
      withDelay(VISIBLE_MS, withTiming(0, { duration: FADE_MS }))
    );
    if (animate) {
      badge.value = withSpring(1, { damping: 11, stiffness: 200, mass: 0.8 });
      ring.value = withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) });
      confetti.value = withTiming(1, { duration: CONFETTI_MS, easing: Easing.linear });
    }
    const timer = setTimeout(onDone, 160 + VISIBLE_MS + FADE_MS + 40);
    return () => clearTimeout(timer);
    // Runs once per celebration; the host remounts this view by key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badge.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - ring.value),
    transform: [{ scale: 1 + 0.9 * ring.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 8 * (1 - Math.min(1, badge.value)) }],
  }));

  const accessibilityLabel = celebration.subtitle
    ? `${celebration.title}. ${celebration.subtitle}`
    : celebration.title;

  if (!CAN_ANIMATE) {
    return (
      <View pointerEvents="none" style={styles.host} accessibilityLiveRegion="polite">
        <View style={styles.badge}>
          <MaterialIcons name="check" size={50} color="#050B13" />
        </View>
        <View style={styles.titleCard} accessible accessibilityLabel={accessibilityLabel}>
          <Text style={styles.title}>{celebration.title}</Text>
          {celebration.subtitle ? <Text style={styles.subtitle}>{celebration.subtitle}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.host, containerStyle]}>
      <View style={styles.badgeWrap}>
        {animate ? <Animated.View style={[styles.ring, ringStyle]} /> : null}
        {animate ? (
          <View style={styles.confettiOrigin}>
            {pieces.map((spec, i) => (
              <ConfettiPiece key={i} t={confetti} spec={spec} />
            ))}
          </View>
        ) : null}
        <Animated.View style={[styles.badge, badgeStyle]}>
          <MaterialIcons name="check" size={50} color="#050B13" />
        </Animated.View>
      </View>
      <Animated.View
        style={[styles.titleCard, titleStyle]}
        accessible
        accessibilityRole="alert"
        accessibilityLabel={accessibilityLabel}
      >
        <Text style={styles.title}>{celebration.title}</Text>
        {celebration.subtitle ? <Text style={styles.subtitle}>{celebration.subtitle}</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}

/** Mount once near the app root. */
export default function CelebrationHost() {
  const [current, setCurrent] = useState<Celebration | null>(null);

  useEffect(() => {
    listener = setCurrent;
    return () => {
      if (listener === setCurrent) listener = null;
    };
  }, []);

  if (!current) return null;
  return (
    <CelebrationView key={current.id} celebration={current} onDone={() => setCurrent(null)} />
  );
}

const BADGE = 92;

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  badgeWrap: {
    width: BADGE,
    height: BADGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: '#2dcc9a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2dcc9a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 10,
  },
  ring: {
    position: 'absolute',
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 3,
    borderColor: '#2dcc9a',
  },
  confettiOrigin: {
    position: 'absolute',
    left: BADGE / 2,
    top: BADGE / 2,
    width: 0,
    height: 0,
    overflow: 'visible',
  },
  piece: {
    position: 'absolute',
    borderRadius: 2,
  },
  titleCard: {
    marginTop: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(45, 204, 154, 0.35)',
    alignItems: 'center',
    maxWidth: 320,
  },
  title: {
    color: '#F5F7FA',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  subtitle: {
    color: '#d7e1f0',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
});
