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
  deleteSavedBidTemplate,
  formatTemplateCategory,
  formatTemplateMoney,
  formatTemplateUsageLabel,
  loadSavedBidTemplates,
  type SavedBidTemplate,
} from '@/utils/estimateSavedBidTemplates';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SavedBidTemplatesBrowserModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = getColors(theme);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<SavedBidTemplate[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await loadSavedBidTemplates());
    } catch (e) {
      Alert.alert('Saved bid templates', (e as Error)?.message || 'Could not load');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const handleDelete = (template: SavedBidTemplate) => {
    Alert.alert('Delete template?', `Remove "${template.name}" from saved bid templates?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setTemplates(await deleteSavedBidTemplate(template.id));
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
          <Text style={[styles.title, { color: Colors.text }]}>Saved bid templates</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <MaterialIcons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={{ color: Colors.sub, fontSize: 13, paddingHorizontal: 16, marginBottom: 12 }}>
          Full material and labor snapshots saved from bids. Confirm Scope can suggest rates from these
          templates when no library match exists.
        </Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={Colors.sub} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
            {templates.length === 0 ? (
              <Text style={{ color: Colors.sub, fontSize: 14 }}>
                No saved bid templates yet. Save a template from the estimate generator when finishing a
                bid.
              </Text>
            ) : (
              templates.map((template) => (
                <View
                  key={template.id}
                  style={[
                    styles.card,
                    {
                      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                      backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : Colors.surface2,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.text, fontSize: 15, fontWeight: '700' }}>
                      {template.name}
                    </Text>
                    {template.category || template.trade ? (
                      <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 4 }}>
                        {formatTemplateCategory(template.category || template.trade)}
                      </Text>
                    ) : null}
                    <Text style={{ color: '#60a5fa', fontSize: 13, marginTop: 6, fontWeight: '600' }}>
                      {formatTemplateMoney(template.estimatedBidTotal)} estimated
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 12, marginTop: 4 }}>
                      Material {formatTemplateMoney(template.estimatedMaterialsTotal)} · Labor{' '}
                      {formatTemplateMoney(template.estimatedLaborTotal)} · {template.lineItemCount}{' '}
                      line{template.lineItemCount === 1 ? '' : 's'}
                    </Text>
                    <Text style={{ color: Colors.sub, fontSize: 11, marginTop: 4 }}>
                      {formatTemplateUsageLabel(template.usageCount)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(template)}>
                    <MaterialIcons name="delete-outline" size={22} color="#f87171" />
                  </TouchableOpacity>
                </View>
              ))
            )}
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
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
});
