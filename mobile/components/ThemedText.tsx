import { StyleSheet, Text, type TextProps } from 'react-native';

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

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'heading' ? styles.heading : undefined,
        type === 'body' ? styles.body : undefined,
        type === 'caption' ? styles.caption : undefined,
        type === 'button' ? styles.button : undefined,
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
    color: '#333333',
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Saira_400Regular',
    fontWeight: '600',
    color: '#333333',
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: 'Montserrat_700Bold',
    color: '#1B365D',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: 'Montserrat_700Bold',
    color: '#1B365D',
    letterSpacing: -0.3,
  },
  heading: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: 'Montserrat_700Bold',
    color: '#1B365D',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Saira_400Regular',
    color: '#555555',
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Saira_400Regular',
    color: '#777777',
  },
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
    fontFamily: 'Saira_400Regular',
    textDecorationLine: 'underline',
  },
});
