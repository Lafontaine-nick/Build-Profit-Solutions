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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from '@/constants/brandFrameGradient';
import {
  ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
  ESTIMATE_TEMPLATE_PRESERVATION_SHORT,
  estimateFlowDisabledPrimaryButtonStyle,
  estimateFlowDisabledPrimaryButtonTextStyle,
  estimateFlowPrimaryButtonStyle,
  estimateFlowPrimaryButtonTextStyle,
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
    backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
    borderColor: Colors.line,
  };

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
            <View style={[styles.headerRow, { paddingTop: headerTopPadding }]}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={BRAND_FRAME_GRADIENT_START}
                end={BRAND_FRAME_GRADIENT_END}
                style={styles.backButtonBorder}
              >
                <GradientRingBackInner
                  darkMode={darkMode}
                  onPress={handleClose}
                  style={[styles.backButton, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
                >
                  <MaterialIcons
                    name="arrow-back"
                    size={24}
                    color={darkMode ? '#FFFFFF' : Colors.text}
                  />
                </GradientRingBackInner>
              </LinearGradient>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: Colors.text }]}>Save as template</Text>
                <Text style={[styles.subtitle, { color: Colors.sub }]}>
                  Reuse this bid package on future estimates
                </Text>
              </View>
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
              />

              <Text style={[styles.label, { color: Colors.sub }]}>Trade or category (optional)</Text>
              <Text style={[styles.fieldHelper, { color: Colors.sub }]}>
                Helps you organize and find this template later.
              </Text>
              <TextInput
                value={category}
                onChangeText={setCategory}
                placeholder="Bathroom, remodel, renovation"
                placeholderTextColor={placeholderColor}
                style={[styles.input, inputShell, { color: Colors.text }]}
                autoCorrect={false}
              />

              <Text style={[styles.label, { color: Colors.sub }]}>Description (optional)</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What this template is best for"
                placeholderTextColor={placeholderColor}
                multiline
                style={[styles.input, styles.textArea, inputShell, { color: Colors.text }]}
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
              activeOpacity={nameIsValid ? 0.88 : 1}
              disabled={!nameIsValid || saving}
              onPress={handleSave}
            >
              <View
                style={
                  nameIsValid && !saving
                    ? estimateFlowPrimaryButtonStyle()
                    : estimateFlowDisabledPrimaryButtonStyle()
                }
              >
                {saving ? (
                  <ActivityIndicator color="rgba(248, 250, 252, 0.45)" />
                ) : (
                  <Text
                    style={
                      nameIsValid
                        ? estimateFlowPrimaryButtonTextStyle()
                        : estimateFlowDisabledPrimaryButtonTextStyle()
                    }
                  >
                    Save template
                  </Text>
                )}
              </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD,
    paddingBottom: 18,
    gap: 12,
  },
  backButtonBorder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 1,
    overflow: 'hidden',
  },
  backButton: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  form: { paddingHorizontal: ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD, gap: 8 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  fieldHelper: { fontSize: 11, lineHeight: 16, marginTop: 2, marginBottom: 2 },
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
});
