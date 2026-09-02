import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { BRAND_FRAME_GRADIENT_COLORS } from '@/constants/brandFrameGradient';
import { TAX_CENTER_WEB_MAX_CONTENT_WIDTH } from '@/constants/ScreenLayout';
import GradientRingBackInner from '@/components/GradientRingBackInner';
import HelpSupportSubpageWebHeader from '@/components/profile/HelpSupportSubpageWebHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import { FORM_KEYBOARD_SCROLL_PROPS } from '@/constants/keyboardScrollProps';
import { resolveTextInputKeyboardProps } from '@/constants/inputKeyboardPresets';
import { apiService } from '@/services/api';
import { AnalyticsEvent, trackProductEvent } from '@/lib/analytics/productAnalytics';
import { featureAreaFromRoute } from '@/lib/betaFeedback/featureAreaFromRoute';
import type { BetaFeedbackPreset } from '@/contexts/BetaFeedbackContext';

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
  field: 14,
  chip: 999,
  button: 14,
};

export type BetaFeedbackPanelProps = {
  preset?: BetaFeedbackPreset;
  onCancel: () => void;
};

export default function BetaFeedbackPanel({ preset, onCancel }: BetaFeedbackPanelProps) {
  const pathname = usePathname();
  const { darkMode, theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);

  const [feedbackType, setFeedbackType] = useState('bug');
  const [severity, setSeverity] = useState<string | undefined>('medium');
  const [description, setDescription] = useState('');
  const [intendedAction, setIntendedAction] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const intendedActionRef = useRef<TextInput>(null);
  const expectedResultRef = useRef<TextInput>(null);

  useEffect(() => {
    if (preset?.feedbackType) setFeedbackType(preset.feedbackType);
    else setFeedbackType('bug');
    setSeverity('medium');
    setDescription('');
    setIntendedAction('');
    setExpectedResult('');
  }, [preset]);

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
        { text: 'OK', onPress: onCancel },
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
    onCancel,
  ]);

  const styles = useMemo(() => {
    const fieldBg = darkMode ? 'rgba(10,12,16,0.92)' : '#fff';
    const chipInactiveBg = darkMode ? 'rgba(28,30,34,0.95)' : Colors.surface2;
    const chipInactiveBorder = darkMode ? 'rgba(255,255,255,0.08)' : Colors.line;
    const chipActiveBg = darkMode ? 'rgba(34,197,94,0.22)' : 'rgba(34,197,94,0.18)';
    const chipActiveBorder = '#22c55e';
    const muted = darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';

    return StyleSheet.create({
      root: {
        flex: 1,
      },
      pageShell: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 8,
      },
      pageShellWeb: {
        maxWidth: TAX_CENTER_WEB_MAX_CONTENT_WIDTH,
        alignSelf: 'center',
        paddingHorizontal: 20,
      },
      scroll: {
        flex: 1,
        minHeight: 0,
      },
      scrollContent: {
        paddingTop: 16,
        paddingBottom: Platform.OS === 'web' ? 40 : 24,
      },
      headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 12,
        ...(Platform.OS === 'web' ? {} : { marginHorizontal: 20 }),
      },
      backButtonWrapper: {
        marginRight: 12,
        zIndex: 1,
      },
      backButtonBorder: {
        borderRadius: 20,
        padding: 1,
        overflow: 'hidden',
      },
      backButton: {
        width: 40,
        height: 40,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
      },
      screenTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: Colors.text,
      },
      gradientFrameOuter: {
        borderRadius: 24,
        padding: 1,
        marginBottom: 16,
      },
      content: {
        padding: 16,
        paddingBottom: 40,
      },
      contentCard: {
        borderRadius: 23,
        overflow: 'hidden',
      },
      subtitle: {
        fontSize: 13,
        lineHeight: 19,
        fontWeight: '400',
        color: muted,
        marginBottom: 22,
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
      sendButton: {
        marginTop: 8,
        paddingVertical: 15,
        borderRadius: RADIUS.button,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#22c55e',
      },
      sendText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#050B13',
      },
    });
  }, [Colors, darkMode]);

  const placeholderProps = {
    placeholderTextColor:
      darkMode ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.38)',
  };

  return (
    <View style={styles.root}>
      <View style={[styles.pageShell, Platform.OS === 'web' && styles.pageShellWeb]}>
        {Platform.OS === 'web' ? (
          <HelpSupportSubpageWebHeader
            title='Beta feedback'
            darkMode={darkMode}
            lightBg={Colors.bg}
          />
        ) : (
          <View style={styles.headerRow}>
            <View style={styles.backButtonWrapper}>
              <LinearGradient
                colors={BRAND_FRAME_GRADIENT_COLORS}
                start={{ x: 0.05, y: 0.15 }}
                end={{ x: 0.95, y: 0.85 }}
                style={styles.backButtonBorder}
              >
                <GradientRingBackInner
                  darkMode={darkMode}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onCancel();
                  }}
                  style={[styles.backButton, { backgroundColor: darkMode ? '#000000' : Colors.bg }]}
                >
                  <MaterialIcons
                    name='arrow-back'
                    size={24}
                    color={darkMode ? '#FFFFFF' : '#000000'}
                  />
                </GradientRingBackInner>
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                ellipsizeMode='tail'
                style={[styles.screenTitle, { color: darkMode ? '#f9fafb' : '#000000' }]}
              >
                Beta feedback
              </Text>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={Platform.OS === 'web'}
          {...FORM_KEYBOARD_SCROLL_PROPS}
        >
          <LinearGradient
            colors={['#2DFFC4', '#00A6FF']}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={styles.gradientFrameOuter}
          >
            <View
              style={[
                styles.contentCard,
                {
                  backgroundColor: darkMode ? Colors.cardDark : Colors.bg,
                  borderColor: Colors.line,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={styles.content}>
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
                    placeholder='Describe the issue. Include the screen, steps, and what seemed wrong.'
                    {...placeholderProps}
                    value={description}
                    onChangeText={setDescription}
                    {...resolveTextInputKeyboardProps({ multiline: true })}
                  />
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>What were you trying to do? (optional)</Text>
                  <TextInput
                    ref={intendedActionRef}
                    style={[styles.field, styles.fieldSecondary]}
                    placeholder='Example: Add a line item, update markup, review project health…'
                    {...placeholderProps}
                    value={intendedAction}
                    onChangeText={setIntendedAction}
                    onSubmitEditing={() => expectedResultRef.current?.focus()}
                    {...resolveTextInputKeyboardProps()}
                  />
                </View>

                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>Expected result (optional)</Text>
                  <TextInput
                    ref={expectedResultRef}
                    style={[styles.field, styles.fieldSecondary]}
                    placeholder='What should have happened instead?'
                    {...placeholderProps}
                    value={expectedResult}
                    onChangeText={setExpectedResult}
                    onSubmitEditing={() => void submit()}
                    {...(Platform.OS === 'web'
                      ? { returnKeyType: 'send' as const, blurOnSubmit: true }
                      : resolveTextInputKeyboardProps())}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.sendButton, submitting && { opacity: 0.7 }]}
                  onPress={() => void submit()}
                  disabled={submitting}
                  activeOpacity={0.88}
                >
                  {submitting ? (
                    <ActivityIndicator color='#050B13' />
                  ) : (
                    <Text style={styles.sendText}>Send feedback</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </ScrollView>
      </View>
    </View>
  );
}
