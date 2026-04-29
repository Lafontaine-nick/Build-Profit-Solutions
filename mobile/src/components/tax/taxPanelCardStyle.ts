import type { ViewStyle } from 'react-native';

/**
 * Matches overview “Project Status” / “Financial Health” cards on black:
 * translucent grey surface (same token as ThemeContext.surface2 in dark mode).
 */
export const taxCenterPanelCard: ViewStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  borderRadius: 20,
  padding: 16,
  marginBottom: 16,
  borderWidth: 0,
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};
