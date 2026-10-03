import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import {
  ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
  ESTIMATE_TEMPLATE_PRESERVATION_SHORT,
} from '@/utils/estimateFlowCardStyle';

type Props = {
  visible: boolean;
  saving?: boolean;
  defaultEstimateName?: string;
  onClose: () => void;
  onSave: (input: { name: string; category: string; description: string }) => void;
};

function defaultTemplateName(raw?: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed === 'Untitled Bid') return '';
  return trimmed;
}

export default function SaveAsTemplateModal({
  visible,
  saving = false,
  defaultEstimateName,
  onClose,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (visible) {
      setName(defaultTemplateName(defaultEstimateName));
      setCategory('');
      setDescription('');
    }
  }, [visible, defaultEstimateName]);

  const nameIsValid = Boolean(name.trim());
  const handleClose = () => {
    if (saving) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onSave({
      name: trimmed,
      category: category.trim(),
      description: description.trim(),
    });
  };

  const headerTopPadding = Math.max(insets.top, Platform.OS === 'ios' ? 12 : 0) + 8;
  const placeholderColor = darkMode ? 'rgba(255,255,255,0.4)' : Colors.sub;
  const inputShell = {
    backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : Colors.surface2,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
  };
  const canSave = nameIsValid && !saving;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.root, { backgroundColor: Colors.bg }]}>
        <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              pointerEvents="box-none"
              style={[styles.headerRow, { paddingTop: headerTopPadding }]}
            >
              <View pointerEvents="none" style={styles.headerText}>
                <Text style={[styles.title, { color: Colors.text }]}>Save as template</Text>
                <Text style={[styles.subtitle, !darkMode && { color: Colors.sub }]}>
                  Reuse this bid package on future estimates
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleClose}
                disabled={saving}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={[
                  styles.backButton,
                  { top: headerTopPadding },
                  { backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.surface2 },
                ]}
              >
                <MaterialIcons name="arrow-back" size={22} color={darkMode ? '#e2e8f0' : Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <Text style={[styles.label, { color: Colors.sub }]}>Template name *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Bathroom remodel"
                placeholderTextColor={placeholderColor}
                style={[styles.input, inputShell, { color: Colors.text }]}
                autoCorrect={false}
                {...resolveTextInputKeyboardProps()}
              />

              <Text style={[styles.label, { color: Colors.sub }]}>Trade or category (optional)</Text>
              <TextInput
                value={category}
                onChangeText={setCategory}
                placeholder="Bathroom, remodel, renovation"
                placeholderTextColor={placeholderColor}
                style={[styles.input, inputShell, { color: Colors.text }]}
                autoCorrect={false}
                {...resolveTextInputKeyboardProps()}
              />

              <Text style={[styles.label, { color: Colors.sub }]}>Description (optional)</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What this template is best for"
                placeholderTextColor={placeholderColor}
                style={[styles.input, styles.textArea, inputShell, { color: Colors.text }]}
                {...resolveTextInputKeyboardProps({ multiline: true })}
              />

              <Text style={[styles.hint, { color: Colors.sub }]}>
                {ESTIMATE_TEMPLATE_PRESERVATION_SHORT}
              </Text>
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, 16),
                borderTopColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
                backgroundColor: Colors.bg,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={canSave ? 0.88 : 1}
              disabled={!canSave}
              onPress={handleSave}
              style={[styles.saveButton, { backgroundColor: canSave ? '#2dcc9a' : '#3A3A3C' }]}
            >
              {saving ? (
                <ActivityIndicator color="#050B13" />
              ) : (
                <Text style={[styles.saveButtonText, { color: canSave ? '#050B13' : '#d7e1f0' }]}>
                  Save template
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  headerRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 16,
    minHeight: 56,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 56,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 23,
    textAlign: 'center',
  },
  subtitle: {
    color: '#d7e1f0',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.12,
    lineHeight: 20,
    textAlign: 'center',
  },
  form: { paddingHorizontal: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD, gap: 8 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    fontSize: 15,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
  },
  saveButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
