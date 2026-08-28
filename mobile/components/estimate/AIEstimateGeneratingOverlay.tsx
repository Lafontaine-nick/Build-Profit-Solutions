import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import {
  AI_GENERATE_PHASE_LABELS,
  aiGeneratePhaseIndex,
  type AiGeneratePhaseId,
} from '@/utils/aiEstimateGeneratingUi';
import { aiFlowCardBackground } from '@/utils/estimateFlowCardStyle';

type Props = {
  visible: boolean;
  phase: AiGeneratePhaseId | null;
  steps: AiGeneratePhaseId[];
  onCancel?: () => void;
};

export default function AIEstimateGeneratingOverlay({ visible, phase, steps, onCancel }: Props) {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const accent = darkMode ? '#00A6FF' : '#0284c7';

  useEffect(() => {
    if (!visible) {
      setElapsedSec(0);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  const displaySteps = steps.length ? steps : (['building_scope', 'finalizing'] as AiGeneratePhaseId[]);
  const resolvedPhase = phase ?? 'building_scope';
  const activeIndex = aiGeneratePhaseIndex(displaySteps, resolvedPhase);
  const slowHint =
    elapsedSec >= 20
      ? 'Still working — large notes or a cold server can take up to a minute.'
      : elapsedSec >= 8
        ? 'Usually 10–30 seconds for painting notes.'
        : null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: aiFlowCardBackground(darkMode, Colors.surface2),
              borderColor: darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: Colors.text }]}>Building your draft</Text>
          </View>
          <Text style={[styles.subtitle, { color: Colors.sub }]}>
            {slowHint || 'Usually takes a few seconds — hang tight.'}
          </Text>

          <View style={styles.stepList}>
            {displaySteps.map((stepId, index) => {
              const done = index < activeIndex;
              const active = index === activeIndex;
              const label = AI_GENERATE_PHASE_LABELS[stepId];
              return (
                <View key={stepId} style={styles.stepRow}>
                  {done ? (
                    <MaterialIcons name="check-circle" size={18} color="#22c55e" />
                  ) : active ? (
                    <ActivityIndicator size={16} color={accent} />
                  ) : (
                    <View
                      style={[
                        styles.stepDot,
                        { borderColor: darkMode ? 'rgba(148, 163, 184, 0.35)' : Colors.line },
                      ]}
                    />
                  )}
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: active ? Colors.text : done ? Colors.sub : Colors.sub,
                        opacity: active || done ? 1 : 0.55,
                        fontWeight: active ? '700' : '500',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
          {onCancel ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cancel draft generation"
              onPress={onCancel}
              style={styles.cancelBtn}
            >
              <Text style={[styles.cancelLabel, { color: Colors.sub }]}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 26,
  },
  headerRow: {
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  stepList: {
    gap: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  stepLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },
  cancelBtn: {
    marginTop: 22,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
