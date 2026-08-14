import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CONFIRM_SCOPE_CHIP_PRESS_LOCK_MS,
  confirmScopeChipIsTap,
  confirmScopeChipPainted,
} from '@/utils/electricalQuickMeasurementUi';

const SELECTED_GREEN = '#34d399';
const SELECTED_BG = 'rgba(52, 211, 153, 0.12)';

type ConfirmScopeChipProps = {
  selected: boolean;
  label: string;
  subtitle?: string | null;
  onPress: () => void;
  darkMode: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/**
 * Paint green inside this chip on touch. Parent Confirm Scope pricing must
 * not be what turns the chip green, or the highlight waits on that render.
 */
export function ConfirmScopeChip({
  selected,
  label,
  subtitle,
  onPress,
  darkMode,
  disabled = false,
  accessibilityLabel,
}: ConfirmScopeChipProps) {
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  return (
    <ConfirmScopeChipView
      selected={selected}
      label={label}
      subtitle={subtitle}
      darkMode={darkMode}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onPressRef={onPressRef}
    />
  );
}

const ConfirmScopeChipView = React.memo(function ConfirmScopeChipView({
  selected,
  label,
  subtitle,
  darkMode,
  disabled = false,
  accessibilityLabel,
  onPressRef,
}: Omit<ConfirmScopeChipProps, 'onPress'> & {
  onPressRef: React.MutableRefObject<() => void>;
}) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const painted = confirmScopeChipPainted(selected, optimistic);
  const selectedRef = useRef(selected);
  const optimisticRef = useRef(optimistic);
  const disabledRef = useRef(disabled);
  const lockedUntilRef = useRef(0);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const cancelledRef = useRef(false);
  const shellRef = useRef<View>(null);
  const labelRef = useRef<Text>(null);
  const subtitleRef = useRef<Text>(null);
  selectedRef.current = selected;
  optimisticRef.current = optimistic;
  disabledRef.current = disabled;

  useEffect(() => {
    if (optimisticRef.current !== selected) return;
    optimisticRef.current = null;
    setOptimistic(null);
  }, [selected]);

  const paintNative = (next: boolean) => {
    shellRef.current?.setNativeProps({
      style: {
        borderColor: next
          ? SELECTED_GREEN
          : darkMode
            ? '#52525b'
            : '#cbd5e1',
        backgroundColor: next
          ? SELECTED_BG
          : darkMode
            ? '#27272a'
            : '#f1f5f9',
      },
    });
    const color = next
      ? SELECTED_GREEN
      : darkMode
        ? '#e4e4e7'
        : '#0f172a';
    labelRef.current?.setNativeProps({ style: { color } });
    subtitleRef.current?.setNativeProps({
      style: {
        color: next
          ? SELECTED_GREEN
          : darkMode
            ? '#94a3b8'
            : '#64748b',
      },
    });
  };

  const handleGrant = (event: {
    nativeEvent: { pageX: number; pageY: number };
  }) => {
    if (disabledRef.current) return;
    cancelledRef.current = false;
    startRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
  };

  const handleMove = (event: {
    nativeEvent: { pageX: number; pageY: number };
  }) => {
    const start = startRef.current;
    if (!start || cancelledRef.current) return;
    if (
      !confirmScopeChipIsTap(
        event.nativeEvent.pageX - start.x,
        event.nativeEvent.pageY - start.y
      )
    ) {
      cancelledRef.current = true;
    }
  };

  const handleRelease = () => {
    const start = startRef.current;
    startRef.current = null;
    if (disabledRef.current || cancelledRef.current || !start) return;
    const now = Date.now();
    if (now < lockedUntilRef.current) return;
    lockedUntilRef.current = now + CONFIRM_SCOPE_CHIP_PRESS_LOCK_MS;
    const current = confirmScopeChipPainted(
      selectedRef.current,
      optimisticRef.current
    );
    const next = !current;
    optimisticRef.current = next;
    paintNative(next);
    setOptimistic(next);
    const run = onPressRef.current;
    // Let the native green paint cross the bridge before any pricing work.
    setTimeout(run, 48);
  };

  const handleTerminate = () => {
    cancelledRef.current = true;
    startRef.current = null;
  };

  return (
    <View
      ref={shellRef}
      accessibilityRole='button'
      accessibilityState={{ selected: painted, disabled }}
      accessibilityLabel={accessibilityLabel || label}
      onStartShouldSetResponder={() => !disabledRef.current}
      onResponderGrant={handleGrant}
      onResponderMove={handleMove}
      onResponderRelease={handleRelease}
      onResponderTerminate={handleTerminate}
      onResponderTerminationRequest={() => true}
      style={[
        styles.chip,
        painted
          ? styles.chipSelected
          : darkMode
            ? styles.chipIdleDark
            : styles.chipIdleLight,
      ]}
    >
      <Text
        ref={labelRef}
        style={[
          styles.label,
          {
            color: painted ? SELECTED_GREEN : darkMode ? '#e4e4e7' : '#0f172a',
          },
        ]}
      >
        {painted ? '✓ ' : ''}
        {label}
      </Text>
      {subtitle ? (
        <Text
          ref={subtitleRef}
          style={[
            styles.subtitle,
            {
              color: painted ? SELECTED_GREEN : darkMode ? '#94a3b8' : '#64748b',
            },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
});
ConfirmScopeChipView.displayName = 'ConfirmScopeChipView';

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: SELECTED_GREEN,
    backgroundColor: SELECTED_BG,
  },
  chipIdleDark: {
    borderColor: '#52525b',
    backgroundColor: '#27272a',
  },
  chipIdleLight: {
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
  },
  label: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 11, fontWeight: '600', marginTop: 2, textAlign: 'center' },
});
