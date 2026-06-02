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
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import AIEstimateDisclaimer from '@/components/estimate/AIEstimateDisclaimer';

type Props = {
  visible: boolean;
  generating?: boolean;
  initialNotes?: string;
  fromAssistant?: boolean;
  /** Render inside AI Assistant instead of a separate Modal (fixes iOS stacking). */
  embedded?: boolean;
  onClose: () => void;
  onBack?: () => void;
  onGenerate: (notes: string) => void;
};

export default function AIEstimateBuilderModal({
  visible,
  generating = false,
  initialNotes = '',
  fromAssistant = false,
  embedded = false,
  onClose,
  onBack,
  onGenerate,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setNotes(initialNotes || '');
    }
  }, [visible, initialNotes]);

  const handleBack = () => {
    if (generating) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (fromAssistant && onBack) {
      onBack();
    } else {
      onClose();
    }
  };

  const handleGenerate = () => {
    const trimmed = notes.trim();
    if (!trimmed || generating) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onGenerate(trimmed);
  };

  const placeholderColor = darkMode ? 'rgba(255,255,255,0.4)' : Colors.sub;
  const inputShell = {
    backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
    borderColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line,
  };
  const footerBottomPad = Math.max(insets.bottom, 16);

  if (!visible) return null;

  const notesField = (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          padding: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: 'rgba(45, 255, 196, 0.22)',
          backgroundColor: darkMode ? 'rgba(45, 255, 196, 0.06)' : 'rgba(34, 197, 94, 0.06)',
        }}
      >
        <MaterialIcons name="auto-awesome" size={20} color="#22c55e" />
        <Text style={{ color: Colors.sub, fontSize: 13, flex: 1, lineHeight: 18 }}>
          Paste rough job notes from a walkthrough. AI will organize rooms, scope, and pricing into a
          draft you can review before applying.
        </Text>
      </View>

      <AIEstimateDisclaimer variant="compact" />

      <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 12 }}>
        Job notes
      </Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        editable={!generating}
        multiline
        scrollEnabled={false}
        textAlignVertical="top"
        placeholder="Example: Ruth whole-home remodel — master bath $12,500, kitchen $18,000, includes LVP at $3/sqft allowance..."
        placeholderTextColor={placeholderColor}
        style={[
          styles.notesInput,
          inputShell,
          {
            color: Colors.text,
            minHeight: embedded ? 320 : 280,
          },
        ]}
      />
    </>
  );

  const footer = (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: footerBottomPad,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
        backgroundColor: Colors.bg,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        disabled={!notes.trim() || generating}
        onPress={handleGenerate}
      >
        <LinearGradient
          colors={notes.trim() && !generating ? ['#2DFFC4', '#00A6FF'] : ['#64748b', '#475569']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.primaryBtn}
        >
          {generating ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <>
              <MaterialIcons name="auto-awesome" size={20} color="#0f172a" />
              <Text style={styles.primaryBtnText}>Generate Estimate Draft</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const body = (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
    >
      <View style={{ flex: 1 }}>
        <AIEstimateFlowHeader
          title="Build with AI"
          subtitle="Paste walkthrough notes"
          step={fromAssistant ? 1 : undefined}
          fromAssistant={fromAssistant}
          disabled={generating}
          onBack={handleBack}
        />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={false}
        >
          {notesField}
        </ScrollView>
        {footer}
      </View>
    </KeyboardAvoidingView>
  );

  if (embedded) {
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.embeddedShell, { backgroundColor: Colors.bg }]}>
        {body}
      </View>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={handleBack}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  embeddedShell: {
    zIndex: 100,
    elevation: 100,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
});
