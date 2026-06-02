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

type Props = {
  visible: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (input: { name: string; category: string; description: string }) => void;
};

export default function SaveAsTemplateModal({
  visible,
  saving = false,
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
      setName('');
      setCategory('');
      setDescription('');
    }
  }, [visible]);

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
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom, 24),
            }}
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
                <Text style={[styles.title, { color: Colors.text }]}>Save as Template</Text>
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

              <Text style={[styles.label, { color: Colors.sub }]}>Category / trade</Text>
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
                Saves materials, labor, direct costs, overhead, markup, and payment schedule. Customer
                info is not included — use Saved Customers for that.
              </Text>

              <TouchableOpacity
                activeOpacity={0.88}
                disabled={!name.trim() || saving}
                onPress={handleSave}
                style={{ opacity: !name.trim() || saving ? 0.55 : 1 }}
              >
                <LinearGradient
                  colors={['#2DFFC4', '#00A6FF']}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.saveButton}
                >
                  {saving ? (
                    <ActivityIndicator color="#001B14" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Template</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
  form: { paddingHorizontal: 16, gap: 8 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 8 },
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
    marginBottom: 12,
  },
  saveButton: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#001B14',
    fontSize: 16,
    fontWeight: '900',
  },
});
