import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

const SELECTED_GREEN = '#34d399';
const SELECTED_BG = 'rgba(52, 211, 153, 0.12)';

type ConfirmScopeChipProps = {
  selected: boolean;
  /** Green highlight without a check. The count is captured and still needs a tap to enter the bid. */
  captured?: boolean;
  label: string;
  subtitle?: string | null;
  /** Keep the two-line count size after the subtitle is removed. */
  countButton?: boolean;
  onPress: () => void;
  darkMode: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/**
 * Dumb chip. No touch-start paint, slop, or press-out commit — those layers
 * remounted the label mid-gesture and cancelled the first tap on taller cards
 * like Service amperage. Parent local state paints green from onPress.
 */
export function ConfirmScopeChip({
  selected,
  captured = false,
  label,
  subtitle,
  countButton = false,
  onPress,
  darkMode,
  disabled = false,
  accessibilityLabel,
}: ConfirmScopeChipProps) {
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const highlighted = selected || captured;

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel || label}
      disabled={disabled}
      unstable_pressDelay={0}
      onPress={() => {
        if (disabled) return;
        onPressRef.current();
      }}
      style={[
        styles.chip,
        countButton ? styles.countButton : null,
        highlighted
          ? styles.chipSelected
          : darkMode
            ? styles.chipIdleDark
            : styles.chipIdleLight,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: highlighted ? SELECTED_GREEN : darkMode ? '#e4e4e7' : '#0f172a',
          },
        ]}
      >
        {selected ? '✓ ' : ''}
        {label}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            {
              color: highlighted
                ? SELECTED_GREEN
                : darkMode
                  ? '#94a3b8'
                  : '#64748b',
            },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: SELECTED_GREEN,
    backgroundColor: SELECTED_BG,
  },
  chipIdleDark: {
    borderColor: 'rgba(148, 163, 184, 0.28)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipIdleLight: {
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  countButton: {
    minHeight: 58,
    width: '100%',
    alignSelf: 'stretch',
  },
  label: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 11, fontWeight: '600', marginTop: 2, textAlign: 'center' },
});
