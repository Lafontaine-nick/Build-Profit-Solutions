import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?:
    | 'default'
    | 'title'
    | 'defaultSemiBold'
    | 'subtitle'
    | 'link'
    | 'heading'
    | 'body'
    | 'caption'
    | 'button';
};

type ColorKey = keyof typeof Colors.light & keyof typeof Colors.dark;

function colorKeyForType(
  type: NonNullable<ThemedTextProps['type']>,
  darkMode: boolean
): ColorKey {
  switch (type) {
    case 'link':
      return 'link';
    case 'caption':
      return 'caption';
    case 'body':
      return 'subtext';
    case 'title':
    case 'subtitle':
    case 'heading':
      return darkMode ? 'text' : 'primary';
    default:
      return 'text';
  }
}

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const { darkMode } = useTheme();
  const colorKey = type === 'button' ? 'text' : colorKeyForType(type, darkMode);
  const resolved = useThemeColor({ light: lightColor, dark: darkColor }, colorKey);
  const color =
    type === 'button' && lightColor == null && darkColor == null
      ? '#FFFFFF'
      : resolved;

  return (
    <Text
      style={[
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'heading' ? styles.heading : undefined,
        type === 'body' ? styles.body : undefined,
        type === 'caption' ? styles.caption : undefined,
        type === 'button' ? styles.button : undefined,
        { color },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Saira_400Regular',
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Saira_400Regular',
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: -0.3,
  },
  heading: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Saira_400Regular',
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Saira_400Regular',
  },
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'Montserrat_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    fontFamily: 'Saira_400Regular',
    textDecorationLine: 'underline',
  },
});
