import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';

type Variant = 'saved' | 'rough';

type Props = {
  visible: boolean;
  variant: Variant;
  onAddManually: () => void;
  onClose: () => void;
};

const COPY: Record<Variant, { title: string; message: string }> = {
  saved: {
    title: 'No saved pricing found yet',
    message:
      'No unit-based saved rates ($/sqft, $/LF) matched this scope. Flat template totals (e.g. $10,000 lump sums) are not applied to new quantities. Add prices manually or use Suggest rough prices.',
  },
  rough: {
    title: 'AI rough pricing unavailable',
    message:
      'AI rough pricing is not available yet. Add prices manually or save this as a scope draft.',
  },
};

export default function AIEstimatePricingFallbackModal({
  visible,
  variant,
  onAddManually,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const { title, message } = COPY[variant];
  const cardBg = darkMode ? '#161b22' : '#FFFFFF';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line,
              marginBottom: insets.bottom + 16,
            },
          ]}
        >
          <Text style={[styles.title, { color: Colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: Colors.sub }]}>{message}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={onAddManually} activeOpacity={0.88}>
            <Text style={styles.primaryBtnText}>Add prices manually</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={{ color: Colors.sub, fontWeight: '700' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  title: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  message: { fontSize: 14, lineHeight: 20, marginBottom: 18 },
  primaryBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
});
