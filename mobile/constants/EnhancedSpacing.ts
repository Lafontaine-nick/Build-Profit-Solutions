import { Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Enhanced Spacing System
export const Spacing = {
  // Base spacing units (4px grid system)
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,

  // Semantic spacing
  section: 24,
  card: 16,
  button: 12,
  input: 16,
  list: 12,

  // Screen-based spacing
  screen: {
    horizontal: 16,
    vertical: 20,
    safe: 44, // Safe area for notched devices
  },

  // Component-specific spacing
  components: {
    card: {
      padding: 16,
      margin: 12,
      borderRadius: 12,
    },
    button: {
      padding: 12,
      margin: 8,
      borderRadius: 8,
    },
    input: {
      padding: 12,
      margin: 8,
      borderRadius: 8,
    },
    list: {
      item: 12,
      section: 20,
    },
    modal: {
      padding: 20,
      margin: 16,
      borderRadius: 16,
    },
  },
};

// Enhanced Typography System
export const Typography = {
  // Font sizes
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 48,
  },

  // Font weights
  weights: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  // Line heights
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8,
  },

  // Semantic typography
  semantic: {
    heading: {
      fontSize: 24,
      fontWeight: '600' as const,
      lineHeight: 32,
    },
    subheading: {
      fontSize: 18,
      fontWeight: '500' as const,
      lineHeight: 24,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
    },
    caption: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    small: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
  },
};

// Enhanced Layout System
export const Layout = {
  // Screen dimensions
  screen: {
    width: screenWidth,
    height: screenHeight,
    isSmall: screenWidth < 375,
    isMedium: screenWidth >= 375 && screenWidth < 414,
    isLarge: screenWidth >= 414,
  },

  // Breakpoints
  breakpoints: {
    mobile: 0,
    tablet: 768,
    desktop: 1024,
  },

  // Grid system
  grid: {
    columns: 12,
    gutter: 16,
    margin: 16,
  },

  // Container widths
  containers: {
    sm: '90%',
    md: '85%',
    lg: '80%',
    xl: '75%',
    full: '100%',
  },

  // Aspect ratios
  aspectRatios: {
    square: 1,
    landscape: 16 / 9,
    portrait: 3 / 4,
    golden: 1.618,
  },
};

// Enhanced Color System
export const Colors = {
  // Primary colors
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },

  // Secondary colors
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  // Accent colors
  accent: {
    teal: '#43cea2',
    blue: '#1976d2',
    green: '#22c55e',
    yellow: '#f59e0b',
    red: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
    orange: '#f97316',
  },

  // Status colors
  status: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },

  // Neutral colors
  neutral: {
    white: '#ffffff',
    black: '#000000',
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
  },
};

// Enhanced Shadow System
export const Shadows = {
  // Elevation levels
  elevation: {
    none: {
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: {
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
    xl: {
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 16,
    },
  },

  // Colored shadows
  colored: {
    primary: {
      shadowColor: Colors.primary[500],
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    accent: {
      shadowColor: Colors.accent.teal,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    error: {
      shadowColor: Colors.status.error,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
  },
};

// Enhanced Border Radius System
export const BorderRadius = {
  // Base radius values
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  full: 9999,

  // Semantic radius
  semantic: {
    button: 8,
    card: 12,
    input: 8,
    modal: 16,
    avatar: 50,
    badge: 16,
  },
};

// Enhanced Animation Durations
export const AnimationDurations = {
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 750,
  slowest: 1000,

  // Semantic durations
  semantic: {
    button: 150,
    card: 300,
    modal: 300,
    transition: 500,
    loading: 1000,
  },
};

// Enhanced Animation Easings
export const AnimationEasings = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',

  // Custom easings
  custom: {
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
};

// Enhanced Z-Index System
export const ZIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modal: 1040,
  popover: 1050,
  tooltip: 1060,
  toast: 1070,
  max: 2147483647,
};

// Enhanced Responsive Utilities
export const Responsive = {
  // Screen size helpers
  isSmallScreen: () => screenWidth < 375,
  isMediumScreen: () => screenWidth >= 375 && screenWidth < 414,
  isLargeScreen: () => screenWidth >= 414,

  // Responsive values
  getResponsiveValue: (small: any, medium: any, large: any) => {
    if (screenWidth < 375) return small;
    if (screenWidth < 414) return medium;
    return large;
  },

  // Responsive spacing
  getResponsiveSpacing: (base: number) => {
    if (screenWidth < 375) return base * 0.8;
    if (screenWidth < 414) return base;
    return base * 1.2;
  },

  // Responsive typography
  getResponsiveFontSize: (base: number) => {
    if (screenWidth < 375) return base * 0.9;
    if (screenWidth < 414) return base;
    return base * 1.1;
  },
};

// Enhanced Theme Utilities
export const ThemeUtils = {
  // Get contrast color
  getContrastColor: (backgroundColor: string) => {
    // Simple contrast calculation
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  },

  // Get alpha color
  getAlphaColor: (color: string, alpha: number) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  // Get gradient colors
  getGradientColors: (
    baseColor: string,
    direction: 'light' | 'dark' = 'light'
  ) => {
    const alpha = direction === 'light' ? 0.1 : 0.3;
    return [
      ThemeUtils.getAlphaColor(baseColor, alpha),
      baseColor,
      ThemeUtils.getAlphaColor(baseColor, alpha),
    ];
  },
};

export default {
  Spacing,
  Typography,
  Layout,
  Colors,
  Shadows,
  BorderRadius,
  AnimationDurations,
  AnimationEasings,
  ZIndex,
  Responsive,
  ThemeUtils,
};
