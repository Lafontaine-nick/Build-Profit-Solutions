import type { ViewStyle } from 'react-native';

type FlowCardColors = {
  line: string;
  surface2: string;
};

/** Match Step 2 scope cards / Budget tab inner cards. */
export function estimateFlowCardStyle(
  Colors: FlowCardColors,
  darkMode: boolean,
  options?: { marginBottom?: number }
): ViewStyle {
  return {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
    backgroundColor: Colors.surface2,
    ...(options?.marginBottom != null ? { marginBottom: options.marginBottom } : {}),
    ...(darkMode
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 3,
        }
      : {}),
  };
}

export function estimateFlowDividerColor(darkMode: boolean) {
  return darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.2)';
}
