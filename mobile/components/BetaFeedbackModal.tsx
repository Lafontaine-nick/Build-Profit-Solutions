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
  useWindowDimensions,
} from 'react-native';
import { usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { apiService } from '@/services/api';
import { AnalyticsEvent, trackProductEvent } from '@/lib/analytics/productAnalytics';
import { featureAreaFromRoute } from '@/lib/betaFeedback/featureAreaFromRoute';
import type { BetaFeedbackPreset } from '@/contexts/BetaFeedbackContext';

/** `value` is sent to the API unchanged; `label` is display only. */
const TYPES: { value: string; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'ux', label: 'UX / Confusing' },
  { value: 'math_financial', label: 'Math / Financial' },
  { value: 'ai_response', label: 'AI / Assistant' },
  { value: 'feature_request', label: 'Feature idea' },
  { value: 'general', label: 'General' },
];

const SEVERITIES: { value: string; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const RADIUS = {
  sheet: 20,
  field: 14,
  chip: 999,
  button: 14,
};

type Props = {
  visible: boolean;
  onClose: () => void;
  preset?: BetaFeedbackPreset;
};

export default function BetaFeedbackModal({ visible, onClose, preset }: Props) {
  const pathname = usePathname();
  const { height: winH } = useWindowDimensions();
  const { darkMode, theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);

  const [feedbackType, setFeedbackType] = useState('bug');
  const [severity, setSeverity] = useState<string | undefined>('medium');
  const [description, setDescription] = useState('');
  const [intendedAction, setIntendedAction] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sheetHeight = useMemo(
    () => Math.min(Math.round(winH * 0.88), 720),
    [winH]
  );

  useEffect(() => {
    if (visible) {
      if (preset?.feedbackType) setFeedbackType(preset.feedbackType);
      else setFeedbackType('bug');
      setSeverity('medium');
      setDescription('');
      setIntendedAction('');
      setExpectedResult('');
    }
  }, [visible, preset]);

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
    pathname,
    preset?.projectId,
    preset?.estimateId,
    preset?.aiContextFlag,
    onClose,
  ]);

  const styles = useMemo(() => {
    const fieldBg = darkMode ? 'rgba(10,12,16,0.92)' : '#fff';
    const chipInactiveBg = darkMode ? 'rgba(28,30,34,0.95)' : Colors.surface2;
    const chipInactiveBorder = darkMode ? 'rgba(255,255,255,0.08)' : Colors.line;
    const chipActiveBg = darkMode ? 'rgba(34,197,94,0.22)' : 'rgba(34,197,94,0.18)';
    const chipActiveBorder = '#22c55e';
    const muted = darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';

    return StyleSheet.create({
      overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
      },
      sheet: {
        height: sheetHeight,
        width: '100%',
        backgroundColor: darkMode ? '#0B0C0F' : Colors.card,
        borderTopLeftRadius: RADIUS.sheet,
        borderTopRightRadius: RADIUS.sheet,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: darkMode ? 'rgba(255,255,255,0.07)' : Colors.line,
        overflow: 'hidden',
        zIndex: 2,
        elevation: 24,
      },
      backdropDismiss: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
      },
      scroll: {
        flex: 1,
      },
      scrollContent: {
        paddingHorizontal: 22,
        paddingTop: 8,
        paddingBottom: 12,
      },
      grabSpacer: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        marginBottom: 18,
        marginTop: 8,
      },
      title: {
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: -0.3,
        color: Colors.text,
        marginBottom: 10,
      },
      subtitle: {
        fontSize: 13,
        lineHeight: 19,
        fontWeight: '400',
        color: muted,
        marginBottom: 26,
      },
      sectionLabel: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.2,
        color: darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
        marginBottom: 10,
      },
      sectionBlock: {
        marginBottom: 22,
      },
      chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
      },
      chip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: RADIUS.chip,
        backgroundColor: chipInactiveBg,
        borderWidth: 1,
        borderColor: chipInactiveBorder,
      },
      chipOn: {
        borderColor: chipActiveBorder,
        backgroundColor: chipActiveBg,
      },
      chipText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.text,
      },
      chipTextOn: {
        color: darkMode ? '#f8fafc' : '#0f172a',
      },
      field: {
        borderWidth: 1,
        borderColor: darkMode ? 'rgba(255,255,255,0.1)' : Colors.line,
        borderRadius: RADIUS.field,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: Colors.text,
        backgroundColor: fieldBg,
        fontSize: 15,
        lineHeight: 22,
      },
      fieldPrimary: {
        minHeight: 128,
        textAlignVertical: 'top',
        paddingTop: 14,
      },
      fieldSecondary: {
        minHeight: 48,
        paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        textAlignVertical: 'center',
        fontSize: 14,
      },
      actionBar: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: darkMode ? 'rgba(255,255,255,0.08)' : Colors.line,
        paddingHorizontal: 22,
        paddingTop: 14,
        paddingBottom: Platform.OS === 'ios' ? 28 : 18,
        backgroundColor: darkMode ? '#0B0C0F' : Colors.card,
      },
      actions: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
      },
      btnSecondary: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: RADIUS.button,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: darkMode ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)',
      },
      btnPrimary: {
        flex: 1,
        paddingVertical: 15,
        borderRadius: RADIUS.button,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#22c55e',
      },
      btnSecondaryText: {
        fontSize: 16,
        fontWeight: '600',
        color: muted,
      },
      btnPrimaryText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#050B13',
      },
    });
  }, [Colors, darkMode, sheetHeight]);

  const placeholderProps = {
    placeholderTextColor:
      darkMode ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.38)',
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdropDismiss}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close feedback"
        />
        <View style={styles.sheet}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.grabSpacer} />
            <Text style={styles.title}>Beta feedback</Text>
            <Text style={styles.subtitle}>
              Help us improve Build Profit Solutions. Tell us what broke, what felt confusing, or
              what should work better. Context is included automatically.
            </Text>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Type</Text>
              <View style={styles.chipRow}>
                {TYPES.map((t) => {
                  const on = feedbackType === t.value;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.chip, on && styles.chipOn]}
                      activeOpacity={0.78}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setFeedbackType(t.value);
                      }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Severity (optional)</Text>
              <View style={styles.chipRow}>
                {SEVERITIES.map((s) => {
                  const on = severity === s.value;
                  return (
                    <TouchableOpacity
                      key={s.value}
                      style={[styles.chip, on && styles.chipOn]}
                      activeOpacity={0.78}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSeverity(s.value);
                      }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>What happened? *</Text>
              <TextInput
                style={[styles.field, styles.fieldPrimary]}
                multiline
                placeholder="Describe the issue. Include the screen, steps, and what seemed wrong."
                {...placeholderProps}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>What were you trying to do? (optional)</Text>
              <TextInput
                style={[styles.field, styles.fieldSecondary]}
                placeholder="Example: Add a line item, update markup, review project health…"
                {...placeholderProps}
                value={intendedAction}
                onChangeText={setIntendedAction}
              />
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>Expected result (optional)</Text>
              <TextInput
                style={[styles.field, styles.fieldSecondary]}
                placeholder="What should have happened instead?"
                {...placeholderProps}
                value={expectedResult}
                onChangeText={setExpectedResult}
              />
            </View>

          </ScrollView>

          <View style={styles.actionBar}>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={onClose}
                disabled={submitting}
                activeOpacity={0.65}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={submit}
                disabled={submitting}
                activeOpacity={0.88}
              >
                {submitting ? (
                  <ActivityIndicator color="#050B13" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
