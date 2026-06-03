import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import {
  clearPricingMemory,
  deletePricingRate,
  fetchPricingLibrary,
  type PricingLibrarySection,
} from '@/utils/contractorPricingMemory';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ContractorPricingLibraryModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<PricingLibrarySection[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { sections: s } = await fetchPricingLibrary();
      setSections(s);
    } catch (e) {
      Alert.alert('Pricing library', (e as Error)?.message || 'Could not load');
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete rate?', `Remove "${name}" from your pricing library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePricingRate(id);
            await load();
          } catch (e) {
            Alert.alert('Error', (e as Error)?.message || 'Delete failed');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.shell, { backgroundColor: Colors.bg, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors.text }]}>Pricing library</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <MaterialIcons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={{ color: Colors.sub, fontSize: 13, paddingHorizontal: 16, marginBottom: 12 }}>
          Rates learned from bids you applied, submitted, won, or saved as templates. Suggestions always
          require your approval.
        </Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={Colors.sub} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
            {sections.length === 0 ? (
              <Text style={{ color: Colors.sub, fontSize: 14 }}>
                No saved pricing yet. Apply or submit a real bid to start building your library.
              </Text>
            ) : (
              sections.map((section) => (
                <View key={section.trade} style={{ marginBottom: 20 }}>
                  <Text style={{ color: Colors.text, fontSize: 16, fontWeight: '800', marginBottom: 8 }}>
                    {section.label}
                  </Text>
                  {section.items.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.card,
                        {
                          borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                          backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>
                          {item.scopeItemName}
                        </Text>
                        <Text style={{ color: '#60a5fa', fontSize: 13, marginTop: 4 }}>
                          {item.unitRate != null ? `$${item.unitRate}/${item.unitType}` : '—'}
                        </Text>
                        <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 2 }}>
                          Used {item.usageCount} time{item.usageCount === 1 ? '' : 's'} ·{' '}
                          {item.pricingSource?.replace(/_/g, ' ')}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDelete(item.id, item.scopeItemName)}>
                        <MaterialIcons name="delete-outline" size={22} color="#f87171" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))
            )}
            <TouchableOpacity
              style={{ marginTop: 16 }}
              onPress={() => {
                Alert.alert('Clear all pricing memory?', 'This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                      await clearPricingMemory();
                      await load();
                    },
                  },
                ]);
              }}
            >
              <Text style={{ color: '#f87171', fontWeight: '700', textAlign: 'center' }}>
                Clear pricing memory
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 18, fontWeight: '800' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
});
