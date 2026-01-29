/**
 * Spacing and layout constants for consistent, professional spacing
 * Based on 8px grid system for clean, organized layouts
 */

export const Spacing = {
  // Base spacing unit (8px grid system)
  xs: 4, // 4px - Minimal spacing
  sm: 8, // 8px - Small spacing
  md: 16, // 16px - Medium spacing
  lg: 24, // 24px - Large spacing
  xl: 32, // 32px - Extra large spacing
  '2xl': 48, // 48px - Double extra large
  '3xl': 64, // 64px - Triple extra large

  // Component-specific spacing
  component: {
    padding: 16, // Standard component padding
    margin: 16, // Standard component margin
    borderRadius: 12, // Standard border radius
    borderWidth: 1, // Standard border width
  },

  // Layout spacing
  layout: {
    screenPadding: 20, // Screen edge padding
    sectionSpacing: 32, // Spacing between sections
    cardSpacing: 16, // Spacing between cards
    itemSpacing: 12, // Spacing between list items
  },

  // Navigation spacing
  navigation: {
    headerHeight: 56, // Header height
    tabBarHeight: 88, // Tab bar height (iOS)
    tabBarHeightAndroid: 70, // Tab bar height (Android)
    safeAreaTop: 44, // Safe area top (notch)
    safeAreaBottom: 34, // Safe area bottom (home indicator)
  },

  // Form spacing
  form: {
    inputPadding: 16, // Input field padding
    inputMargin: 12, // Input field margin
    labelMargin: 8, // Label margin
    buttonPadding: 16, // Button padding
    buttonMargin: 12, // Button margin
  },

  // Card spacing
  card: {
    padding: 20, // Card internal padding
    margin: 16, // Card external margin
    borderRadius: 16, // Card border radius
    shadowOffset: 4, // Card shadow offset
  },

  // Modal spacing
  modal: {
    padding: 24, // Modal padding
    margin: 20, // Modal margin
    borderRadius: 20, // Modal border radius
    headerHeight: 60, // Modal header height
  },
};

// Helper function to get responsive spacing
export const getResponsiveSpacing = (
  baseSpacing: number,
  scale: number = 1
) => {
  return Math.round(baseSpacing * scale);
};

// Helper function to get theme-aware spacing
export const getThemeSpacing = (
  spacingKey: keyof typeof Spacing,
  isCompact: boolean = false
) => {
  const baseSpacing = Spacing[spacingKey] as number;
  return isCompact ? Math.round(baseSpacing * 0.75) : baseSpacing;
};
