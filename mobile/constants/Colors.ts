/**
 * Professional color palette for Build Profit Solutions
 * Optimized for readability, accessibility, and professional appearance
 */

// Primary Brand Colors
const primaryBlue = '#1B365D'; // Deep Navy - Primary brand color
const primaryGreen = '#43cea2'; // Teal Green - Accent and success
const primaryGold = '#FFD700'; // Gold - Premium/highlight

// Secondary Colors
const secondaryBlue = '#2d5a3d'; // Dark Green - Secondary brand
const secondaryGray = '#6b7280'; // Medium Gray - Secondary text
const secondaryLight = '#f3f4f6'; // Light Gray - Backgrounds

// Semantic Colors
const success = '#10b981'; // Green - Success states
const warning = '#f59e0b'; // Amber - Warning states
const error = '#ef4444'; // Red - Error states
const info = '#3b82f6'; // Blue - Information

// Neutral Colors
const white = '#ffffff';
const black = '#000000';
const darkGray = '#374151';
const lightGray = '#f9fafb';

// Dark Mode Specific
const darkBackground = '#0b1c38'; // Deep dark blue background
const darkCard = '#142850'; // Dark card background
const darkText = '#ffffff'; // Primary text on dark — max contrast on black/navy
const darkSubtext = '#ffffff'; // Secondary/helper text (was grey; same as primary for readability)

export const Colors = {
  light: {
    // Text Colors
    text: '#1f2937', // Primary text - Dark for readability
    subtext: '#6b7280', // Secondary text
    caption: '#9ca3af', // Caption text
    link: '#3b82f6', // Link text

    // Background Colors
    background: '#ffffff', // Main background
    card: '#f9fafb', // Card background
    surface: '#f3f4f6', // Surface elements

    // Brand Colors
    primary: primaryBlue,
    secondary: primaryGreen,
    accent: primaryGold,

    // UI Elements
    border: '#e5e7eb',
    shadow: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',

    // Semantic
    success,
    warning,
    error,
    info,
  },

  dark: {
    // Text Colors
    text: darkText, // Primary text - Light for readability
    subtext: darkSubtext, // Secondary text
    caption: '#f3f4f6', // Caption — light on dark (was mid-grey, too low contrast)
    link: '#60a5fa', // Link text

    // Background Colors
    background: darkBackground, // Main background
    card: darkCard, // Card background
    surface: '#1e293b', // Surface elements

    // Brand Colors
    primary: primaryBlue,
    secondary: primaryGreen,
    accent: primaryGold,

    // UI Elements
    border: '#374151',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',

    // Semantic
    success,
    warning,
    error,
    info,
  },

  // Common colors used across themes
  common: {
    white,
    black,
    transparent: 'transparent',

    // Gradients
    gradients: {
      primary: [primaryBlue, primaryGreen],
      secondary: [primaryGreen, primaryBlue],
      success: [success, '#059669'],
      warning: [warning, '#d97706'],
      error: [error, '#dc2626'],
    },

    // Status colors
    status: {
      draft: '#6b7280',
      inProgress: '#3b82f6',
      completed: '#10b981',
      cancelled: '#ef4444',
      pending: '#f59e0b',
    },
  },
};

// Helper function to get theme-aware colors
export const getThemeColor = (
  colorKey: keyof typeof Colors.light,
  isDark: boolean
) => {
  return isDark ? Colors.dark[colorKey] : Colors.light[colorKey];
};

// Helper function to get semantic colors
export const getSemanticColor = (
  type: 'success' | 'warning' | 'error' | 'info'
) => {
  const semanticColors = {
    success,
    warning,
    error,
    info,
  };
  return semanticColors[type];
};
