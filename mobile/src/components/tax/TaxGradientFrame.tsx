import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** Green → blue ring + inner fill — same ring geometry as Profile (`profile.tsx` main content `LinearGradient`). */
export default function TaxGradientFrame({
  children,
  style,
  innerStyle,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={['#2DFFC4', '#00A6FF']}
      start={{ x: 0.05, y: 0.15 }}
      end={{ x: 0.95, y: 0.85 }}
      style={[styles.ring, style]}
    >
      <View style={[styles.inner, innerStyle]}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderRadius: 24,
    padding: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  inner: {
    backgroundColor: '#000000',
    borderRadius: 23,
    overflow: 'hidden',
  },
});
