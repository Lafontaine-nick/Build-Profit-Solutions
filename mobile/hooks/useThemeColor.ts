/**
 * Theme colors follow the in-app ThemeContext toggle (not only the OS color scheme).
 */

import { Colors } from '@/constants/Colors';
import { useTheme } from '@/contexts/ThemeContext';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const { darkMode } = useTheme();
  const scheme = darkMode ? 'dark' : 'light';
  const colorFromProps = props[scheme];

  if (colorFromProps) {
    return colorFromProps;
  }
  return Colors[scheme][colorName];
}
