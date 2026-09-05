// Shared UI kit for Build Profit Solutions
// Covers improvements #1–12 (cards, spacing, header, toggles, buttons, gradient, etc.)

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ViewStyle,
  TextStyle,
  PressableProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

/* ------------------------------------------------------------------
   THEME (spacing, radii, colors, typography)
   - #1, #2, #6, #11
------------------------------------------------------------------- */

export const bpsTheme = {
  colors: {
    bgDark: "#051629",
    bgCard: "#071D33",
    bgCardElevated: "#09233F",
    accent: "#1ED88F",
    accentSoft: "rgba(30,216,143,0.12)",
    accentBlue: "#329BFF",
    textMain: "#FFFFFF",
    textMuted: "#F1F5F9",
    textSubtle: "#E2E8F0",
    borderSoft: "rgba(255,255,255,0.06)",
    danger: "#FF4C5B",
    success: "#2ECC71",
    shadow: "rgba(0,0,0,0.45)",
    divider: "rgba(255,255,255,0.04)",
    chipBg: "rgba(255,255,255,0.06)",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16, // Use this for most cards (#1)
    xl: 20,
  },
  text: {
    h1: {
      fontSize: 28,
      fontWeight: "600" as const, // slightly softer than 700 (#6)
      letterSpacing: 0.3,
    },
    h2: {
      fontSize: 20,
      fontWeight: "600" as const,
      letterSpacing: 0.2,
    },
    h3: {
      fontSize: 16,
      fontWeight: "600" as const,
    },
    body: {
      fontSize: 14,
      fontWeight: "400" as const,
    },
    small: {
      fontSize: 12,
      fontWeight: "400" as const,
    },
  },
};

/* ------------------------------------------------------------------
   TEXT WRAPPERS
   - Ensures consistent typography (#6)
------------------------------------------------------------------- */

interface BpsTextProps {
  style?: TextStyle;
  children: React.ReactNode;
  numberOfLines?: number;
}

export const BpsText = {
  H1: ({ style, children, numberOfLines, ...props }: BpsTextProps) => (
    <Text
      style={[
        bpsTheme.text.h1,
        { color: bpsTheme.colors.textMain },
        style,
      ]}
      numberOfLines={numberOfLines}
      {...props}
    >
      {children}
    </Text>
  ),
  H2: ({ style, children, numberOfLines, ...props }: BpsTextProps) => (
    <Text
      style={[
        bpsTheme.text.h2,
        { color: bpsTheme.colors.textMain },
        style,
      ]}
      numberOfLines={numberOfLines}
      {...props}
    >
      {children}
    </Text>
  ),
  H3: ({ style, children, numberOfLines, ...props }: BpsTextProps) => (
    <Text
      style={[
        bpsTheme.text.h3,
        { color: bpsTheme.colors.textMain },
        style,
      ]}
      numberOfLines={numberOfLines}
      {...props}
    >
      {children}
    </Text>
  ),
  Body: ({
    style,
    muted,
    children,
    numberOfLines,
    ...props
  }: BpsTextProps & { muted?: boolean }) => (
    <Text
      style={[
        bpsTheme.text.body,
        { color: muted ? bpsTheme.colors.textMuted : bpsTheme.colors.textMain },
        style,
      ]}
      numberOfLines={numberOfLines}
      {...props}
    >
      {children}
    </Text>
  ),
  Small: ({
    style,
    muted,
    children,
    numberOfLines,
    ...props
  }: BpsTextProps & { muted?: boolean }) => (
    <Text
      style={[
        bpsTheme.text.small,
        {
          color: muted ? bpsTheme.colors.textSubtle : bpsTheme.colors.textMain,
        },
        style,
      ]}
      numberOfLines={numberOfLines}
      {...props}
    >
      {children}
    </Text>
  ),
};

/* ------------------------------------------------------------------
   PRESSABLE SCALE (micro-interactions)
   - #10: subtle scale on press
------------------------------------------------------------------- */

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  scaleTo?: number;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
}

export const PressableScale: React.FC<PressableScaleProps> = ({
  children,
  scaleTo = 0.96,
  duration = 90,
  disabled,
  style,
  ...props
}) => {
  const scale = useMemo(() => new Animated.Value(1), []);

  const handlePressIn = () => {
    if (disabled) return;
    Animated.timing(scale, {
      toValue: scaleTo,
      duration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.timing(scale, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...props}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

/* ------------------------------------------------------------------
   CARD COMPONENT
   - #1: single-radius, clean border
   - #2: consistent internal padding
   - #3, #7: elevation & section separation
------------------------------------------------------------------- */

interface BpsCardProps {
  style?: ViewStyle;
  children: React.ReactNode;
  elevated?: boolean;
  padded?: boolean;
}

export const BpsCard: React.FC<BpsCardProps> = ({
  style,
  children,
  elevated = false,
  padded = true,
}) => {
  const padding = padded ? bpsTheme.spacing.lg : 0;
  return (
    <View
      style={[
        {
          backgroundColor: elevated
            ? bpsTheme.colors.bgCardElevated
            : bpsTheme.colors.bgCard,
          borderRadius: bpsTheme.radius.lg,
          padding,
          borderWidth: 1,
          borderColor: bpsTheme.colors.borderSoft,
          shadowColor: bpsTheme.colors.shadow,
          shadowOffset: { width: 0, height: elevated ? 8 : 4 },
          shadowOpacity: elevated ? 0.4 : 0.25,
          shadowRadius: elevated ? 16 : 10,
          elevation: elevated ? 6 : 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

/* ------------------------------------------------------------------
   SECTION WRAPPERS
   - #2 & #7: consistent spacing & subtle separators
------------------------------------------------------------------- */

interface SectionProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Section: React.FC<SectionProps> = ({
  title,
  subtitle,
  children,
  style,
}) => (
  <View style={[{ marginBottom: bpsTheme.spacing.xxl }, style]}>
    {title && (
      <View style={{ marginBottom: bpsTheme.spacing.md }}>
        <BpsText.H3>{title}</BpsText.H3>
        {subtitle ? (
          <BpsText.Body muted style={{ marginTop: 4 }}>
            {subtitle}
          </BpsText.Body>
        ) : null}
      </View>
    )}
    {children}
  </View>
);

interface DividerProps {
  style?: ViewStyle;
}

export const Divider: React.FC<DividerProps> = ({ style }) => (
  <View
    style={[
      {
        height: StyleSheet.hairlineWidth,
        backgroundColor: bpsTheme.colors.divider,
        marginVertical: bpsTheme.spacing.md,
      },
      style,
    ]}
  />
);

/* ------------------------------------------------------------------
   HEADER BAR
   - #3: more iOS-native header
   - #8: ready to pin / use with scroll
------------------------------------------------------------------- */

interface BpsHeaderBarProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
  onBackPress?: () => void;
}

export const BpsHeaderBar: React.FC<BpsHeaderBarProps> = ({
  title,
  subtitle,
  showBack = true,
  rightElement,
  style,
  onBackPress,
}) => {
  return (
    <View
      style={[
        {
          paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 24,
          paddingHorizontal: bpsTheme.spacing.xl,
          paddingBottom: bpsTheme.spacing.lg,
          backgroundColor: "rgba(5, 22, 41, 0.94)", // faux blur
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: "rgba(255,255,255,0.04)",
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        {showBack && (
          <PressableScale
            onPress={onBackPress}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: "rgba(255,255,255,0.06)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: bpsTheme.spacing.md,
            }}
          >
            <Text style={{ color: bpsTheme.colors.textMain, fontSize: 18 }}>‹</Text>
          </PressableScale>
        )}
        <View style={{ flex: 1 }}>
          <BpsText.H1 numberOfLines={1}>{title}</BpsText.H1>
          {subtitle ? (
            <BpsText.Small muted style={{ marginTop: 4 }} numberOfLines={1}>
              {subtitle}
            </BpsText.Small>
          ) : null}
        </View>
      </View>
      {rightElement ? (
        <View style={{ marginLeft: bpsTheme.spacing.lg }}>{rightElement}</View>
      ) : null}
    </View>
  );
};

/* ------------------------------------------------------------------
   TOGGLE
   - #5: polished toggle with micro animation
------------------------------------------------------------------- */

interface BpsToggleProps {
  value: boolean;
  onValueChange?: (value: boolean) => void;
}

export const BpsToggle: React.FC<BpsToggleProps> = ({ value, onValueChange }) => {
  const [animValue] = useState(new Animated.Value(value ? 1 : 0));

  const toggle = () => {
    const newVal = !value;
    Animated.spring(animValue, {
      toValue: newVal ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 90,
    }).start();
    onValueChange?.(newVal);
  };

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22], // knob travel
  });

  const backgroundColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.08)", bpsTheme.colors.accent],
  });

  return (
    <Pressable onPress={toggle} hitSlop={10}>
      <Animated.View
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          padding: 2,
          backgroundColor,
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: "#FFFFFF",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.25,
            shadowRadius: 2,
            transform: [{ translateX }],
          }}
        />
      </Animated.View>
    </Pressable>
  );
};

/* ------------------------------------------------------------------
   BUTTON
   - #9: unify CTAs (height, radius, typography)
------------------------------------------------------------------- */

const BUTTON_VARIANTS = {
  primary: {
    backgroundColor: bpsTheme.colors.accent,
    textColor: "#02151A",
  },
  secondary: {
    backgroundColor: "rgba(255,255,255,0.06)",
    textColor: bpsTheme.colors.textMain,
  },
  ghost: {
    backgroundColor: "transparent",
    textColor: bpsTheme.colors.textMain,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  destructive: {
    backgroundColor: bpsTheme.colors.danger,
    textColor: "#FFFFFF",
  },
} as const;

type ButtonVariant = keyof typeof BUTTON_VARIANTS;

interface BpsButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const BpsButton: React.FC<BpsButtonProps> = ({
  title,
  variant = "primary",
  fullWidth = true,
  disabled,
  style,
  textStyle,
  ...props
}) => {
  const v = BUTTON_VARIANTS[variant] ?? BUTTON_VARIANTS.primary;

  return (
    <PressableScale
      disabled={disabled}
      style={[
        {
          height: 52,
          borderRadius: bpsTheme.radius.lg,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: bpsTheme.spacing.xl,
          backgroundColor: v.backgroundColor,
          borderWidth: (v as any).borderWidth ?? 0,
          borderColor: (v as any).borderColor ?? "transparent",
          opacity: disabled ? 0.6 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
      {...props}
    >
      <Text
        style={[
          {
            color: v.textColor,
            fontSize: 16,
            fontWeight: "600",
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </PressableScale>
  );
};

/* ------------------------------------------------------------------
   SCREEN CONTAINER & GRADIENT
   - #11: polished background & gradient
   - #12: safe bottom padding
------------------------------------------------------------------- */

interface ScreenGradientProps {
  children: React.ReactNode;
}

export const ScreenGradient: React.FC<ScreenGradientProps> = ({ children }) => {
  return (
    <LinearGradient
      colors={["#031021", "#04182C", "#03293A"]} // more subtle 2–3 stop gradient
      start={{ x: 0, y: 0 }}
      end={{ x: 0.2, y: 1 }}
      style={{ flex: 1 }}
    >
      {children}
    </LinearGradient>
  );
};

interface ScreenContainerProps {
  children: React.ReactNode;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({ children }) => {
  return (
    <ScreenGradient>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: bpsTheme.spacing.xl,
            paddingBottom: bpsTheme.spacing.xxxl, // #12 extra bottom padding
            paddingTop: bpsTheme.spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </ScreenGradient>
  );
};

/* ------------------------------------------------------------------
   EXAMPLE USAGE
   - Settings snippet & Plan card snippet to show how to plug in
------------------------------------------------------------------- */

// Example: Settings row using the new card & toggle
export const ExampleSettingsScreen = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [push, setPush] = useState(true);

  return (
    <>
      <BpsHeaderBar title="Settings" showBack={false} />
      <ScreenContainer>
        <Section title="App Preferences">
          <BpsCard>
            <SettingsRow
              label="Dark Mode"
              description="Use the dark theme for better low-light viewing."
            >
              <BpsToggle value={darkMode} onValueChange={setDarkMode} />
            </SettingsRow>

            <Divider />

            <SettingsRow label="Push Notifications">
              <BpsToggle value={push} onValueChange={setPush} />
            </SettingsRow>
          </BpsCard>
        </Section>

        <Section title="Subscription">
          <BpsCard elevated>
            <BpsText.H3 style={{ marginBottom: bpsTheme.spacing.sm }}>
              Founding Professional
            </BpsText.H3>
            <BpsText.Body muted>
              Full platform access · Prices shown at purchase
            </BpsText.Body>

            <BpsButton
              title="Manage Subscription"
              variant="secondary"
              style={{ marginTop: bpsTheme.spacing.lg }}
            />
          </BpsCard>
        </Section>
      </ScreenContainer>
    </>
  );
};

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

const SettingsRow: React.FC<SettingsRowProps> = ({ label, description, children }) => {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: bpsTheme.spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <BpsText.Body>{label}</BpsText.Body>
        {description ? (
          <BpsText.Small muted style={{ marginTop: 2 }}>
            {description}
          </BpsText.Small>
        ) : null}
      </View>
      {children}
    </View>
  );
};

// Example: Plan card component for Choose Your Plan screen
interface PlanCardProps {
  name: string;
  price: string;
  badge?: string;
  description?: string;
  features?: string[];
  variant?: "default" | "recommended";
  isCurrent?: boolean;
  onPress?: () => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  name,
  price,
  badge,
  description,
  features,
  variant = "default",
  isCurrent,
  onPress,
}) => {
  const borderColor =
    variant === "recommended"
      ? bpsTheme.colors.accentBlue
      : "rgba(255,255,255,0.08)";

  return (
    <PressableScale
      onPress={onPress}
      style={{
        marginBottom: bpsTheme.spacing.xl,
      }}
    >
      <BpsCard
        elevated={variant === "recommended"}
        style={{
          borderColor,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
        >
          <BpsText.H2 style={{ flex: 1 }}>{name}</BpsText.H2>
          {badge ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: bpsTheme.colors.chipBg,
              }}
            >
              <BpsText.Small>{badge}</BpsText.Small>
            </View>
          ) : null}
        </View>

        <BpsText.H1 style={{ marginBottom: 4 }}>{price}</BpsText.H1>
        {description ? (
          <BpsText.Body muted style={{ marginBottom: bpsTheme.spacing.lg }}>
            {description}
          </BpsText.Body>
        ) : null}

        {features?.map((f, idx) => (
          <View
            key={`${name}-feature-${idx}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: bpsTheme.colors.accentSoft,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 8,
              }}
            >
              <Text style={{ color: bpsTheme.colors.accent, fontSize: 12 }}>✓</Text>
            </View>
            <BpsText.Body muted>{f}</BpsText.Body>
          </View>
        ))}

        <BpsButton
          title={isCurrent ? "Current Plan" : "Choose Plan"}
          variant={isCurrent ? "ghost" : "primary"}
          style={{ marginTop: bpsTheme.spacing.lg }}
        />
      </BpsCard>
    </PressableScale>
  );
};

