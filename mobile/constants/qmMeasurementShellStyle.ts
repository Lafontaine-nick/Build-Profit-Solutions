import { StyleSheet } from 'react-native';
import { ESTIMATE_FLOW_NESTED_CARD_BG_DARK } from '@/utils/estimateFlowCardStyle';

/**
 * Nested chips/inputs on Quick measurements + Confirm Scope cards (`#202022`).
 * Matches estimate-flow nested rows (lighter than the card shell).
 */
export const QM_MEASUREMENT_SHELL_FILL_DARK = ESTIMATE_FLOW_NESTED_CARD_BG_DARK;
export const QM_MEASUREMENT_SHELL_BORDER_DARK = 'rgba(148, 163, 184, 0.12)';
export const QM_MEASUREMENT_SHELL_BORDER_DARK_STRONG =
  'rgba(148, 163, 184, 0.18)';

export function qmMeasurementShellStyle(darkMode: boolean, surface2: string) {
  return {
    backgroundColor: darkMode ? QM_MEASUREMENT_SHELL_FILL_DARK : surface2,
    borderColor: darkMode ? QM_MEASUREMENT_SHELL_BORDER_DARK : surface2,
  };
}

type ShellColors = { line: string; surface2: string };

/** Inactive scope chips + Needs confirmation measurement rows — same shell. */
export function qmInactiveMeasurementShellStyle(
  darkMode: boolean,
  Colors: ShellColors,
  options?: { highlighted?: boolean }
) {
  const highlighted = options?.highlighted === true;
  return {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    borderColor: highlighted
      ? 'rgba(251, 191, 36, 0.45)'
      : darkMode
        ? QM_MEASUREMENT_SHELL_BORDER_DARK
        : Colors.line,
    backgroundColor: darkMode ? QM_MEASUREMENT_SHELL_FILL_DARK : Colors.surface2,
  };
}
