import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { usePathname } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { apiService } from '@/services/api';
import { AnalyticsEvent, trackProductEvent } from '@/lib/analytics/productAnalytics';
import { featureAreaFromRoute } from '@/lib/betaFeedback/featureAreaFromRoute';
import type { BetaFeedbackPreset } from '@/contexts/BetaFeedbackContext';

const TYPES: { value: string; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'ux', label: 'Confusing / UX' },
  { value: 'math_financial', label: 'Math / financial' },
  { value: 'ai_response', label: 'AI issue' },
  { value: 'feature_request', label: 'Feature idea' },
  { value: 'general', label: 'General' },
];

const SEVERITIES: { value: string; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const MAX_BASE64 = 1_500_000;

type Props = {
  visible: boolean;
  onClose: () => void;
  preset?: BetaFeedbackPreset;
};

export default function BetaFeedbackModal({ visible, onClose, preset }: Props) {
  const pathname = usePathname();
  const { darkMode, theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);

  const [feedbackType, setFeedbackType] = useState('bug');
  const [severity, setSeverity] = useState<string | undefined>('medium');
  const [description, setDescription] = useState('');
  const [intendedAction, setIntendedAction] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      if (preset?.feedbackType) setFeedbackType(preset.feedbackType);
      else setFeedbackType('bug');
      setSeverity('medium');
      setDescription('');
      setIntendedAction('');
      setExpectedResult('');
      setScreenshotData(null);
    }
  }, [visible, preset]);

  const pickScreenshot = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos', 'Photo access is needed to attach a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.65,
      base64: true,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const mime = result.assets[0].mimeType || 'image/jpeg';
    const uri = `data:${mime};base64,${result.assets[0].base64}`;
    if (uri.length > MAX_BASE64) {
      Alert.alert('Image too large', 'Choose a smaller screenshot or skip the attachment.');
      return;
    }
    setScreenshotData(uri);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const submit = useCallback(async () => {
    const trimmed = description.trim();
    if (trimmed.length < 3) {
      Alert.alert('Description', 'Please describe what happened (a few words is fine).');
      return;
    }
    setSubmitting(true);
    try {
      const routeName = pathname || '';
      const featureArea = featureAreaFromRoute(routeName);
      const deviceInfo = `${Platform.OS} ${String(Platform.Version)}`;

      await apiService.submitBetaFeedback({
        feedbackType,
        description: trimmed,
        severity: severity || undefined,
        intendedAction: intendedAction.trim() || undefined,
        expectedResult: expectedResult.trim() || undefined,
        screenshotData: screenshotData || undefined,
        routeName,
        featureArea,
        projectId: preset?.projectId,
        estimateId: preset?.estimateId,
        aiContextFlag: Boolean(preset?.aiContextFlag || feedbackType === 'ai_response'),
        appVersion: Constants.expoConfig?.version || 'unknown',
        platform: Platform.OS,
        deviceInfo,
        metadata: {
          betaTester: true,
        },
      });

      trackProductEvent(AnalyticsEvent.feedbackSubmitted, {
        feedbackType,
        featureArea,
        hasScreenshot: Boolean(screenshotData),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thanks', 'Your feedback was submitted. We read every report.', [
        { text: 'OK', onPress: onClose },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      Alert.alert('Could not send', msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    description,
    feedbackType,
    severity,
    intendedAction,
    expectedResult,
    screenshotData,
    pathname,
    preset?.projectId,
    preset?.estimateId,
    preset?.aiContextFlag,
    onClose,
  ]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: Colors.card,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: Platform.OS === 'ios' ? 34 : 20,
          maxHeight: '92%',
        },
        title: {
          fontSize: 18,
          fontWeight: '700',
          color: Colors.text,
          marginBottom: 4,
        },
        subtitle: {
          fontSize: 13,
          color: Colors.sub,
          marginBottom: 14,
        },
        label: {
          fontSize: 12,
          fontWeight: '600',
          color: Colors.sub,
          marginBottom: 8,
          marginTop: 10,
        },
        chipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        chip: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.surface2,
          borderWidth: 1,
          borderColor: Colors.line,
        },
        chipOn: {
          borderColor: '#4ade80',
          backgroundColor: darkMode ? 'rgba(74,222,128,0.15)' : 'rgba(74,222,128,0.2)',
        },
        chipText: {
          fontSize: 13,
          fontWeight: '600',
          color: Colors.text,
        },
        input: {
          borderWidth: 1,
          borderColor: Colors.line,
          borderRadius: 12,
          padding: 12,
          color: Colors.text,
          backgroundColor: darkMode ? 'rgba(0,0,0,0.25)' : '#fff',
          minHeight: 100,
          textAlignVertical: 'top',
        },
        inputSmall: {
          minHeight: 44,
          textAlignVertical: 'center',
        },
        actions: {
          flexDirection: 'row',
          gap: 10,
          marginTop: 18,
        },
        btnSecondary: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: Colors.line,
        },
        btnPrimary: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
          backgroundColor: '#22c55e',
        },
        btnText: {
          fontSize: 16,
          fontWeight: '700',
          color: Colors.text,
        },
        btnTextPrimary: {
          color: '#050B13',
        },
      }),
    [Colors, darkMode]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close feedback"
        />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Beta feedback</Text>
            <Text style={styles.subtitle}>
              Tell us what broke, what confused you, or what to improve. Context is sent automatically.
            </Text>

            <Text style={styles.label}>Type</Text>
            <View style={styles.chipRow}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.chip, feedbackType === t.value && styles.chipOn]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFeedbackType(t.value);
                  }}
                >
                  <Text style={styles.chipText}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Severity (optional)</Text>
            <View style={styles.chipRow}>
              {SEVERITIES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.chip, severity === s.value && styles.chipOn]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSeverity(s.value);
                  }}
                >
                  <Text style={styles.chipText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>What happened? *</Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder="Be specific — screen, steps, what you expected…"
              placeholderTextColor={Colors.sub}
              value={description}
              onChangeText={setDescription}
            />

            <Text style={styles.label}>What were you trying to do? (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputSmall]}
              placeholder="e.g. Add a line item to the bid"
              placeholderTextColor={Colors.sub}
              value={intendedAction}
              onChangeText={setIntendedAction}
            />

            <Text style={styles.label}>Expected result (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputSmall]}
              placeholder="What should have happened instead?"
              placeholderTextColor={Colors.sub}
              value={expectedResult}
              onChangeText={setExpectedResult}
            />

            <TouchableOpacity style={[styles.chip, { alignSelf: 'flex-start', marginTop: 8 }]} onPress={pickScreenshot}>
              <Text style={styles.chipText}>{screenshotData ? 'Screenshot attached ✓' : 'Attach screenshot (optional)'}</Text>
            </TouchableOpacity>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnSecondary} onPress={onClose} disabled={submitting}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={submit} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#050B13" />
                ) : (
                  <Text style={[styles.btnText, styles.btnTextPrimary]}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
