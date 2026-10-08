import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import BackButton from '@/components/ui/BackButton';
import { PHONE_CARD_GUTTER } from '@/constants/ScreenLayout';
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
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.shell, { backgroundColor: Colors.bg, paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <View style={{ position: 'absolute', left: 0, top: 0 }}>
            <BackButton darkMode={darkMode} onPress={onClose} accessibilityLabel="Close saved bid templates" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: darkMode ? '#f9fafb' : Colors.text }]}>Saved bid templates</Text>
            <Text style={[styles.subtitle, { color: Colors.sub }]}>Snapshots from finished bids</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={Colors.sub} />
        ) : (
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
            {templates.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: Colors.surface2,
                    borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                  },
                ]}
              >
                <Text style={[styles.emptyBody, { color: Colors.sub }]}>
                  Material and labor saved from a finished bid. Confirm Scope can suggest these when no
                  library rate matches.
                </Text>
                <Text style={[styles.emptyTitle, { color: Colors.text }]}>No saved templates yet.</Text>
              </View>
            ) : (
              templates.map((template) => (
                <View
                  key={template.id}
                  style={[
                    styles.card,
                    {
                      borderColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
                      backgroundColor: Colors.surface2,
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
                    <Text style={{ color: Colors.primary, fontSize: 15, marginTop: 6, fontWeight: '700' }}>
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
  headerRow: {
    position: 'relative',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
    marginHorizontal: Platform.OS === 'web' ? 8 : PHONE_CARD_GUTTER,
  },
  headerCopy: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 52,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 18, marginTop: 4, textAlign: 'center' },
  scrollContent: {
    paddingHorizontal: Platform.OS === 'web' ? 8 : PHONE_CARD_GUTTER,
    paddingBottom: 40,
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  emptyBody: { fontSize: 14, lineHeight: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
});
