/**
 * Typography constants for consistent font usage across the app
 * This ensures professional, readable typography throughout the application
 */

export const Typography = {
  // Font Families
  fonts: {
    primary: 'Saira_400Regular', // Body text, readable and clean
    secondary: 'Montserrat_700Bold', // Headings, strong and professional
    monospace: 'monospace', // Code, technical content
  },

  // Font Sizes
  sizes: {
    xs: 12, // Captions, small labels
    sm: 14, // Small body text
    base: 16, // Standard body text
    lg: 18, // Large body text
    xl: 20, // Subheadings
    '2xl': 24, // Section headings
    '3xl': 28, // Page titles
    '4xl': 32, // Main titles
    '5xl': 36, // Hero titles
  },

  // Line Heights
  lineHeights: {
    tight: 1.2, // Headings
    normal: 1.5, // Body text
    relaxed: 1.75, // Long paragraphs
  },

  // Letter Spacing
  letterSpacing: {
    tight: -0.5, // Headings
    normal: 0, // Body text
    wide: 0.5, // Buttons, emphasis
  },

  // Font Weights (when needed for fallback)
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Text Styles
  styles: {
    h1: {
      fontFamily: 'Montserrat_700Bold',
      fontSize: 32,
      lineHeight: 40,
      letterSpacing: -0.5,
      color: '#1B365D',
    },
    h2: {
      fontFamily: 'Montserrat_700Bold',
      fontSize: 24,
      lineHeight: 32,
      letterSpacing: -0.2,
      color: '#1B365D',
    },
    h3: {
      fontFamily: 'Montserrat_700Bold',
      fontSize: 20,
      lineHeight: 28,
      letterSpacing: -0.3,
      color: '#1B365D',
    },
    body: {
      fontFamily: 'Saira_400Regular',
      fontSize: 16,
      lineHeight: 24,
      color: '#555555',
    },
    bodyLarge: {
      fontFamily: 'Saira_400Regular',
      fontSize: 18,
      lineHeight: 28,
      color: '#555555',
    },
    caption: {
      fontFamily: 'Saira_400Regular',
      fontSize: 14,
      lineHeight: 20,
      color: '#777777',
    },
    button: {
      fontFamily: 'Montserrat_700Bold',
      fontSize: 16,
      lineHeight: 20,
      color: '#FFFFFF',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    link: {
      fontFamily: 'Saira_400Regular',
      fontSize: 16,
      lineHeight: 24,
      color: '#0a7ea4',
      textDecorationLine: 'underline',
    },
  },
};

// Helper function to get consistent text styles
export const getTextStyle = (variant: keyof typeof Typography.styles) => {
  return Typography.styles[variant];
};

// Helper function for responsive font sizes
export const getResponsiveFontSize = (baseSize: number, scale: number = 1) => {
  return Math.round(baseSize * scale);
};
