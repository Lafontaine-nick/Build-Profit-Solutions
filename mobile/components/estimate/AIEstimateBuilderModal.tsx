import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
  StyleSheet,
  StatusBar,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import AIEstimateFlowHeader from '@/components/estimate/AIEstimateFlowHeader';
import AIEstimateDisclaimer from '@/components/estimate/AIEstimateDisclaimer';
import EstimateVoiceDictationButton from '@/components/estimate/EstimateVoiceDictationButton';
import EstimateSitePhotosStrip, {
  type EstimateSitePhotosStripHandle,
  type SitePhotoState,
} from '@/components/estimate/EstimateSitePhotosStrip';
import type { PhotoScopeDetection } from '@/utils/estimateAiDraft';

type Props = {
  visible: boolean;
  generating?: boolean;
  initialNotes?: string;
  fromAssistant?: boolean;
  /** Render inside AI Assistant instead of a separate Modal (fixes iOS stacking). */
  embedded?: boolean;
  onClose: () => void;
  onBack?: () => void;
  onGenerate: (notes: string, photoDetections?: PhotoScopeDetection[]) => void;
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
  const photosStripRef = useRef<EstimateSitePhotosStripHandle>(null);
  const [notes, setNotes] = useState('');
  const [photoDetections, setPhotoDetections] = useState<PhotoScopeDetection[]>([]);
  const [photoState, setPhotoState] = useState<SitePhotoState>({
    photoCount: 0,
    hasAnalyzed: false,
  });
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [localGenerating, setLocalGenerating] = useState(false);
  const busy = generating || localGenerating;

  useEffect(() => {
    if (visible) {
      setNotes(initialNotes || '');
      setPhotoDetections([]);
      setPhotoState({ photoCount: 0, hasAnalyzed: false });
    } else {
      setKeyboardVisible(false);
      setLocalGenerating(false);
    }
  }, [visible, initialNotes]);

  useEffect(() => {
    if (!generating) {
      setLocalGenerating(false);
    }
  }, [generating]);

  useEffect(() => {
    if (!visible || Platform.OS === 'web') return undefined;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const handleBack = () => {
    if (busy) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onBack) {
      onBack();
    } else {
      onClose();
    }
  };

  const handleTranscript = (text: string) => {
    setNotes((prev) => {
      const existing = prev.trim();
      return existing ? `${existing}\n${text}` : text;
    });
  };

  const handlePhotoNotesMerged = (
    mergedNotes: string,
    detectionCount: number,
    detections: PhotoScopeDetection[]
  ) => {
    setNotes(mergedNotes);
    setPhotoDetections(detections || []);
    // Defer alert so it doesn't fight the modal / picker dismiss animation.
    setTimeout(() => {
      if (detectionCount > 0) {
        Alert.alert(
          'Scope from photos',
          `${detectionCount} item${detectionCount === 1 ? '' : 's'} detected and added to Job notes. Review the text, then Generate.`
        );
      } else {
        Alert.alert(
          'Photo notes added',
          'Observations were added to Job notes. Review the text, then Generate.'
        );
      }
    }, 0);
  };

  const runGenerate = async () => {
    const trimmed = notes.trim();
    if (!trimmed || busy) return;
    setLocalGenerating(true);
    Keyboard.dismiss();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      await Promise.resolve(onGenerate(trimmed, photoDetections));
    } catch {
      setLocalGenerating(false);
    }
  };

  const handleGenerate = () => {
    const trimmed = notes.trim();
    if (!trimmed || busy) return;
    // Photos attached but Detect never run — remind so users don't skip vision scope.
    if (photoState.photoCount > 0 && !photoState.hasAnalyzed) {
      const n = photoState.photoCount;
      Alert.alert(
        'Detect scope from photos?',
        `You added ${n} photo${n === 1 ? '' : 's'} but haven't run Detect scope yet. That step finds finishes and likely work from the pictures — worth doing before generating.`,
        [
          { text: 'Generate anyway', style: 'cancel', onPress: () => void runGenerate() },
          {
            text: 'Detect first',
            onPress: () => photosStripRef.current?.detectScope(),
          },
        ]
      );
      return;
    }
    void runGenerate();
  };

  const placeholderColor = darkMode ? 'rgba(255,255,255,0.4)' : Colors.sub;
  const inputShell = {
    backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : Colors.surface2,
    borderColor: darkMode ? 'rgba(255,255,255,0.12)' : Colors.line,
  };
  const footerBottomPad = Math.max(insets.bottom, 16);

  if (!visible) return null;

  const canGenerate = Boolean(notes.trim()) && !busy;

  const notesField = (
    <>
      <Text style={{ color: Colors.sub, fontSize: 13, lineHeight: 18, marginBottom: 14 }}>
        Type, paste, dictate, or add site photos — AI drafts scope for review.
      </Text>

      <EstimateSitePhotosStrip
        ref={photosStripRef}
        Colors={Colors}
        darkMode={darkMode}
        disabled={busy}
        existingNotes={notes}
        onNotesMerged={handlePhotoNotesMerged}
        onPhotoStateChange={setPhotoState}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text style={{ color: Colors.text, fontSize: 14, fontWeight: '700' }}>Job notes</Text>
        <EstimateVoiceDictationButton
          Colors={Colors}
          darkMode={darkMode}
          disabled={busy}
          onTranscript={handleTranscript}
        />
      </View>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        editable={!busy}
        multiline
        scrollEnabled={false}
        textAlignVertical="top"
        blurOnSubmit
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={() => Keyboard.dismiss()}
        placeholder="Example: Josh whole-home remodel — master bath $14,750 (materials $6,900 / labor $7,850), kitchen $23,400 lump sum, guest bath 420 sqft tile $4/sqft + labor $5.75/sqft..."
        placeholderTextColor={placeholderColor}
        style={[
          styles.notesInput,
          inputShell,
          {
            color: Colors.text,
            minHeight: embedded ? 360 : 320,
          },
        ]}
      />

      <AIEstimateDisclaimer variant="compact" />
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
        disabled={!notes.trim() || busy}
        onPress={handleGenerate}
        style={[
          styles.primaryBtn,
          { backgroundColor: canGenerate || busy ? '#22c55e' : '#64748b' },
          !notes.trim() && !busy ? styles.primaryBtnDisabled : null,
        ]}
      >
        {busy ? (
          <>
            <ActivityIndicator color="#0f172a" />
            <Text style={styles.primaryBtnText}>Generating…</Text>
          </>
        ) : (
          <>
            <MaterialIcons name="auto-awesome" size={20} color="#0f172a" />
            <Text style={styles.primaryBtnText}>Generate Estimate Draft</Text>
          </>
        )}
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
          subtitle="Notes, dictate, or site photos"
          step={1}
          fromAssistant={fromAssistant}
          omitTopSafeArea={embedded}
          disabled={busy}
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
        {!keyboardVisible || busy ? footer : null}
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
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBack}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={{ flex: 1, backgroundColor: Colors.bg }}>{body}</View>
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
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.85,
  },
  primaryBtnText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
});
