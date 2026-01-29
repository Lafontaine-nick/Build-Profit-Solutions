import React from 'react';
import {
  View,
  Text,
  Pressable,
  ViewStyle,
  TextStyle,
  StyleSheet,
  PressableProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { bpsThemeV2 } from '../../theme/bpsThemeV2';

type TextVariant = keyof typeof bpsThemeV2.text;

interface BpsTextProps {
  children: React.ReactNode;
  variant?: TextVariant;
  muted?: boolean;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
}

export const BpsText: React.FC<BpsTextProps> = ({
  children,
  variant = 'body',
  muted,
  style,
  numberOfLines,
}) => (
  <Text
    style={[
      bpsThemeV2.text[variant],
      { color: muted ? bpsThemeV2.colors.textMuted : bpsThemeV2.colors.textPrimary },
      style,
    ]}
    numberOfLines={numberOfLines}
  >
    {children}
  </Text>
);

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  elevated?: boolean;
  gradient?: boolean;
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  elevated,
  gradient,
  padded = true,
}) => {
  const paddingStyle = padded ? { padding: bpsThemeV2.spacing.lg } : undefined;

  if (gradient) {
    return (
      <LinearGradient
        colors={bpsThemeV2.gradients.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.cardBase,
          paddingStyle,
          {
            borderColor: 'rgba(148,163,184,0.28)',
          },
          elevated ? styles.cardElevated : null,
          style,
        ]}
      >
        {children}
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.cardBase,
        paddingStyle,
        {
          backgroundColor: bpsThemeV2.colors.card,
          borderColor: bpsThemeV2.colors.border,
        },
        elevated ? styles.cardElevated : styles.cardSoft,
        style,
      ]}
    >
      {children}
    </View>
  );
};

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
  style,
}) => (
  <View style={[styles.sectionHeader, style]}>
    <View style={{ flex: 1 }}>
      <BpsText variant='subtitle'>{title}</BpsText>
      {subtitle ? (
        <BpsText variant='small' muted style={{ marginTop: 4 }}>
          {subtitle}
        </BpsText>
      ) : null}
    </View>
    {action ? <View style={{ marginLeft: bpsThemeV2.spacing.md }}>{action}</View> : null}
  </View>
);

interface IconBadgeProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const IconBadge: React.FC<IconBadgeProps> = ({ children, style }) => (
  <View
    style={[
      {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: bpsThemeV2.colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      },
      style,
    ]}
  >
    {children}
  </View>
);

interface StatusChipProps {
  label: string;
  color?: string;
  muted?: boolean;
  style?: ViewStyle;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  label,
  color = bpsThemeV2.colors.accent,
  muted,
  style,
}) => {
  const bg = muted ? 'rgba(148,163,184,0.14)' : `${color}20`;
  const textColor = muted ? bpsThemeV2.colors.textMuted : color;

  return (
    <View
      style={[
        {
          paddingHorizontal: bpsThemeV2.spacing.md,
          paddingVertical: 6,
          borderRadius: bpsThemeV2.radius.md,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <BpsText variant='small' style={{ color: textColor }}>
        {label}
      </BpsText>
    </View>
  );
};

interface GradientButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  fullWidth = true,
  disabled,
  style,
  textStyle,
  ...props
}) => (
  <Pressable disabled={disabled} {...props} style={{ alignSelf: fullWidth ? 'stretch' : 'flex-start' }}>
    <LinearGradient
      colors={bpsThemeV2.gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[
        styles.buttonBase,
        {
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      <BpsText
        variant='subtitle'
        style={[
          {
            color: '#02151a',
            textAlign: 'center',
          },
          textStyle,
        ]}
      >
        {title}
      </BpsText>
    </LinearGradient>
  </Pressable>
);

interface PillTabsProps<T extends string> {
  tabs: T[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  style?: ViewStyle;
}

export const PillTabs = <T extends string>({
  tabs,
  activeTab,
  onTabChange,
  style,
}: PillTabsProps<T>) => (
  <View style={[styles.tabsContainer, style]}>
    {tabs.map((tab) => {
      const active = tab === activeTab;
      return (
        <Pressable
          key={tab}
          onPress={() => onTabChange(tab)}
          style={[
            styles.tabItem,
            active
              ? {
                  backgroundColor: bpsThemeV2.colors.accent,
                  shadowColor: bpsThemeV2.colors.accent,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                }
              : null,
          ]}
        >
          <BpsText
            variant='small'
            style={{
              color: active ? '#020617' : bpsThemeV2.colors.textMuted,
              fontWeight: active ? '700' : '600',
            }}
            numberOfLines={1}
          >
            {tab}
          </BpsText>
        </Pressable>
      );
    })}
  </View>
);

interface ProgressBarProps {
  progress: number; // 0 - 100
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = bpsThemeV2.colors.accent,
  backgroundColor = 'rgba(148,163,184,0.25)',
  style,
}) => (
  <View
    style={[
      {
        height: 10,
        borderRadius: 999,
        backgroundColor,
        overflow: 'hidden',
      },
      style,
    ]}
  >
    <View
      style={{
        width: `${Math.min(100, Math.max(0, progress))}%`,
        height: '100%',
        backgroundColor: color,
      }}
    />
  </View>
);

export const Divider = ({ style }: { style?: ViewStyle }) => (
  <View
    style={[
      {
        height: StyleSheet.hairlineWidth,
        backgroundColor: bpsThemeV2.colors.divider,
      },
      style,
    ]}
  />
);

export const ScreenBackground: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => (
  <LinearGradient
    colors={[bpsThemeV2.colors.bg, '#020617']}
    start={{ x: 0, y: 0 }}
    end={{ x: 0.6, y: 1 }}
    style={[{ flex: 1 }, style]}
  >
    {children}
  </LinearGradient>
);

// Tiny example to show composition. Delete or move to a storybook if you wire one up.
export const ExampleHeroCard = () => (
  <Card gradient elevated>
    <BpsText variant='titleXL'>Build Profit Solutions</BpsText>
    <BpsText muted style={{ marginTop: 6 }}>
      AI-powered estimates, live job costing, and project insights.
    </BpsText>
    <GradientButton title='Get Started' style={{ marginTop: bpsThemeV2.spacing.xl }} />
  </Card>
);

const styles = StyleSheet.create({
  cardBase: {
    borderRadius: bpsThemeV2.radius.xl,
    borderWidth: 1,
  },
  cardElevated: {
    ...bpsThemeV2.shadows.card,
  },
  cardSoft: {
    ...bpsThemeV2.shadows.soft,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: bpsThemeV2.spacing.md,
  },
  buttonBase: {
    height: 54,
    borderRadius: bpsThemeV2.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: bpsThemeV2.spacing.xl,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: bpsThemeV2.radius.pill,
    padding: 4,
    backgroundColor: '#0b1323',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
  },
  tabItem: {
    flex: 1,
    borderRadius: bpsThemeV2.radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
