import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
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
};

export default function AIEstimateGeneratingOverlay({ visible, phase, steps }: Props) {
  const { theme, darkMode } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const activeIndex = aiGeneratePhaseIndex(steps, phase);
  const accent = darkMode ? '#00A6FF' : '#0284c7';

  if (!visible) return null;

  const displaySteps = steps.length ? steps : (['building_scope', 'finalizing'] as AiGeneratePhaseId[]);

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
            <ActivityIndicator size="small" color={accent} />
            <Text style={[styles.title, { color: Colors.text }]}>Building your draft</Text>
          </View>
          <Text style={[styles.subtitle, { color: Colors.sub }]}>
            Usually takes a few seconds — hang tight.
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
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  stepList: {
    gap: 12,
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
    fontSize: 14,
    lineHeight: 20,
  },
});
