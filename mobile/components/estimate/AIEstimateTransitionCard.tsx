import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { aiFlowCardBackground } from '@/utils/estimateFlowCardStyle';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
};

/** Centered card shown while Confirm Scope or Initial estimate hands off to the next screen. */
export default function AIEstimateTransitionCard({ visible, title, subtitle }: Props) {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: aiFlowCardBackground(darkMode, Colors.surface2),
              borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
            },
          ]}
        >
          <ActivityIndicator size="small" color="#2dcc9a" />
          <Text style={[styles.title, { color: Colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: Colors.sub }]}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: 'center',
  },
  title: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
