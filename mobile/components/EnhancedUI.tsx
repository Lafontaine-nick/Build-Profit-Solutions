import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import {
  useFadeIn,
  useSlideIn,
  useBounce,
  usePulse,
  useHapticFeedback,
} from './EnhancedAnimations';

const { width: screenWidth } = Dimensions.get('window');

// Enhanced Button Component
export const EnhancedButton: React.FC<{
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: any;
}> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  disabled = false,
  loading = false,
  style,
}) => {
  const { darkMode } = useTheme();
  const { hapticAnim, triggerHaptic } = useHapticFeedback();
  const bounceAnim = useBounce(200, 0);

  const theme = darkMode
    ? {
        primary: '#43cea2',
        secondary: '#1B365D',
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        background: '#0b1c38',
        border: 'rgba(255, 255, 255, 0.1)',
      }
    : {
        primary: '#1976d2',
        secondary: '#f5f7fa',
        text: '#1e293b',
        subtext: '#64748b',
        background: '#ffffff',
        border: 'rgba(0, 0, 0, 0.1)',
      };

  const getButtonStyle = () => {
    const baseStyle = {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: 12,
      borderWidth: 1,
      gap: 8,
    };

    const sizeStyles = {
      small: { paddingHorizontal: 12, paddingVertical: 8, minHeight: 36 },
      medium: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
      large: { paddingHorizontal: 20, paddingVertical: 16, minHeight: 52 },
    };

    const variantStyles = {
      primary: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
      },
      secondary: {
        backgroundColor: theme.secondary,
        borderColor: theme.border,
      },
      outline: {
        backgroundColor: 'transparent',
        borderColor: theme.primary,
      },
      ghost: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      opacity: disabled ? 0.6 : 1,
    };
  };

  const getTextStyle = () => {
    const sizeStyles = {
      small: { fontSize: 14, fontWeight: '500' as const },
      medium: { fontSize: 16, fontWeight: '600' as const },
      large: { fontSize: 18, fontWeight: '600' as const },
    };

    const variantStyles = {
      primary: { color: '#fff' },
      secondary: { color: theme.text },
      outline: { color: theme.primary },
      ghost: { color: theme.primary },
    };

    return {
      ...sizeStyles[size],
      ...variantStyles[variant],
    };
  };

  const handlePress = () => {
    if (!disabled && !loading) {
      triggerHaptic();
      onPress();
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: hapticAnim }] }}>
      <Pressable
        style={[getButtonStyle(), style]}
        onPress={handlePress}
        disabled={disabled || loading}
      >
        {loading ? (
          <Animated.View style={{ transform: [{ scale: bounceAnim }] }}>
            <MaterialIcons
              name='refresh'
              size={20}
              color={getTextStyle().color}
            />
          </Animated.View>
        ) : (
          <>
            {icon && (
              <MaterialIcons
                name={icon as any}
                size={size === 'small' ? 16 : size === 'large' ? 24 : 20}
                color={getTextStyle().color}
              />
            )}
            <Text style={getTextStyle()}>{title}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};

// Enhanced Card Component
export const EnhancedCard: React.FC<{
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: string;
  onPress?: () => void;
  style?: any;
  elevation?: 'low' | 'medium' | 'high';
}> = ({
  children,
  title,
  subtitle,
  icon,
  onPress,
  style,
  elevation = 'medium',
}) => {
  const { darkMode } = useTheme();
  const fadeAnim = useFadeIn(400, 100);
  const slideAnim = useSlideIn('up', 400, 100);

  const theme = darkMode
    ? {
        card: '#1B365D',
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        border: 'rgba(255, 255, 255, 0.1)',
        shadow: 'rgba(0, 0, 0, 0.3)',
      }
    : {
        card: '#ffffff',
        text: '#1e293b',
        subtext: '#64748b',
        border: 'rgba(0, 0, 0, 0.1)',
        shadow: 'rgba(0, 0, 0, 0.1)',
      };

  const getElevationStyle = () => {
    switch (elevation) {
      case 'low':
        return {
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        };
      case 'medium':
        return {
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 4,
        };
      case 'high':
        return {
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 8,
        };
      default:
        return {};
    }
  };

  const cardStyle = {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 20,
    ...getElevationStyle(),
  };

  const CardContent = () => (
    <Animated.View
      style={[
        cardStyle,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
        style,
      ]}
    >
      {(title || subtitle || icon) && (
        <View style={styles.cardHeader}>
          {icon && (
            <View style={[styles.cardIcon, { backgroundColor: theme.border }]}>
              <MaterialIcons name={icon as any} size={24} color={theme.text} />
            </View>
          )}
          <View style={styles.cardTitleContainer}>
            {title && (
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text style={[styles.cardSubtitle, { color: theme.subtext }]}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
      )}
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
      >
        <CardContent />
      </Pressable>
    );
  }

  return <CardContent />;
};

// Enhanced Input Component
export const EnhancedInput: React.FC<{
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  icon?: string;
  multiline?: boolean;
  keyboardType?: any;
  secureTextEntry?: boolean;
  style?: any;
}> = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  icon,
  multiline = false,
  keyboardType = 'default',
  secureTextEntry = false,
  style,
}) => {
  const { darkMode } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const theme = darkMode
    ? {
        background: '#0b1c38',
        card: '#1B365D',
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        border: 'rgba(255, 255, 255, 0.1)',
        accent: '#43cea2',
        error: '#ef4444',
      }
    : {
        background: '#f5f7fa',
        card: '#ffffff',
        text: '#1e293b',
        subtext: '#64748b',
        border: 'rgba(0, 0, 0, 0.1)',
        accent: '#1976d2',
        error: '#ef4444',
      };

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, focusAnim]);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.border, theme.accent],
  });

  return (
    <View style={[styles.inputContainer, style]}>
      {label && (
        <Text style={[styles.inputLabel, { color: theme.text }]}>{label}</Text>
      )}
      <Animated.View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.card,
            borderColor,
            borderWidth: 2,
          },
        ]}
      >
        {icon && (
          <MaterialIcons
            name={icon as any}
            size={20}
            color={isFocused ? theme.accent : theme.subtext}
            style={styles.inputIcon}
          />
        )}
        <TextInput
          style={[
            styles.textInput,
            {
              color: theme.text,
              minHeight: multiline ? 80 : 44,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.subtext}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={multiline}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
        />
      </Animated.View>
      {error && (
        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
      )}
    </View>
  );
};

// Enhanced Tab Component
export const EnhancedTabs: React.FC<{
  tabs: { key: string; title: string; icon?: string }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  style?: any;
}> = ({ tabs, activeTab, onTabChange, style }) => {
  const { darkMode } = useTheme();
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  const theme = darkMode
    ? {
        background: '#0b1c38',
        card: '#1B365D',
        text: '#f1f5f9',
        subtext: '#cbd5e1',
        accent: '#43cea2',
        border: 'rgba(255, 255, 255, 0.1)',
      }
    : {
        background: '#f5f7fa',
        card: '#ffffff',
        text: '#1e293b',
        subtext: '#64748b',
        accent: '#1976d2',
        border: 'rgba(0, 0, 0, 0.1)',
      };

  const activeIndex = tabs.findIndex(tab => tab.key === activeTab);
  const tabWidth = screenWidth / tabs.length;

  useEffect(() => {
    Animated.timing(indicatorAnim, {
      toValue: activeIndex,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, indicatorAnim]);

  const translateX = indicatorAnim.interpolate({
    inputRange: [0, tabs.length - 1],
    outputRange: [0, tabWidth * (tabs.length - 1)],
  });

  return (
    <View
      style={[
        styles.tabsContainer,
        { backgroundColor: theme.card, borderColor: theme.border },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.tabIndicator,
          {
            backgroundColor: theme.accent,
            width: tabWidth,
            transform: [{ translateX }],
          },
        ]}
      />
      {tabs.map(tab => (
        <Pressable
          key={tab.key}
          style={[styles.tab, { width: tabWidth }]}
          onPress={() => onTabChange(tab.key)}
        >
          {tab.icon && (
            <MaterialIcons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.key ? theme.accent : theme.subtext}
            />
          )}
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === tab.key ? theme.accent : theme.subtext,
                fontWeight: activeTab === tab.key ? '600' : '400',
              },
            ]}
          >
            {tab.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

// Enhanced Loading Component
export const EnhancedLoading: React.FC<{
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
}> = ({ size = 'medium', color, text }) => {
  const { darkMode } = useTheme();
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = usePulse(1000, 0);

  const theme = darkMode
    ? {
        accent: '#43cea2',
        text: '#f1f5f9',
        subtext: '#cbd5e1',
      }
    : {
        accent: '#1976d2',
        text: '#1e293b',
        subtext: '#64748b',
      };

  const spinnerColor = color || theme.accent;
  const textColor = theme.subtext;

  const sizeStyles = {
    small: { width: 20, height: 20 },
    medium: { width: 32, height: 32 },
    large: { width: 48, height: 48 },
  };

  const textSizes = {
    small: 12,
    medium: 14,
    large: 16,
  };

  useEffect(() => {
    const spin = () => {
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        spinAnim.setValue(0);
        spin();
      });
    };

    spin();
  }, [spinAnim]);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.loadingContainer}>
      <Animated.View
        style={[
          styles.spinner,
          sizeStyles[size],
          {
            borderColor: spinnerColor,
            transform: [{ rotate: rotation }, { scale: pulseAnim }],
          },
        ]}
      />
      {text && (
        <Text
          style={[
            styles.loadingText,
            {
              color: textColor,
              fontSize: textSizes[size],
            },
          ]}
        >
          {text}
        </Text>
      )}
    </View>
  );
};

// Enhanced Badge Component
export const EnhancedBadge: React.FC<{
  text: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'small' | 'medium' | 'large';
  style?: any;
}> = ({ text, variant = 'neutral', size = 'medium', style }) => {
  const { darkMode } = useTheme();
  const bounceAnim = useBounce(300, 0);

  const theme = darkMode
    ? {
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
        neutral: '#64748b',
        text: '#f1f5f9',
      }
    : {
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
        neutral: '#64748b',
        text: '#1e293b',
      };

  const getVariantStyle = () => {
    const colors = {
      success: { backgroundColor: `${theme.success}20`, color: theme.success },
      warning: { backgroundColor: `${theme.warning}20`, color: theme.warning },
      error: { backgroundColor: `${theme.error}20`, color: theme.error },
      info: { backgroundColor: `${theme.info}20`, color: theme.info },
      neutral: { backgroundColor: `${theme.neutral}20`, color: theme.neutral },
    };
    return colors[variant];
  };

  const sizeStyles = {
    small: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 10 },
    medium: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 12 },
    large: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 14 },
  };

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          ...getVariantStyle(),
          ...sizeStyles[size],
          transform: [{ scale: bounceAnim }],
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          {
            color: getVariantStyle().color,
            fontSize: sizeStyles[size].fontSize,
          },
        ]}
      >
        {text}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Button styles
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },

  // Card styles
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 14,
  },

  // Input styles
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },

  // Tab styles
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 12,
    opacity: 0.1,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
  },

  // Loading styles
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  spinner: {
    borderWidth: 3,
    borderTopColor: 'transparent',
    borderRadius: 50,
  },
  loadingText: {
    fontWeight: '500',
  },

  // Badge styles
  badge: {
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
