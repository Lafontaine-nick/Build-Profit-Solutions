import React, { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import BetaFeedbackPanel from '@/components/betaFeedback/BetaFeedbackPanel';
import { useTheme } from '@/contexts/ThemeContext';
import { getColors } from '@/theme/getColors';
import type { BetaFeedbackPreset } from '@/contexts/BetaFeedbackContext';

export default function BetaFeedbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    feedbackType?: string;
    projectId?: string;
    estimateId?: string;
    aiContextFlag?: string;
  }>();
  const { theme: themeContext } = useTheme();
  const Colors = useMemo(() => getColors(themeContext), [themeContext]);

  const theme = useMemo(
    () => ({
      background: [Colors.bg, Colors.bg, Colors.bg] as [string, string, string],
    }),
    [Colors.bg]
  );

  const preset: BetaFeedbackPreset | undefined = useMemo(() => {
    const feedbackType =
      typeof params.feedbackType === 'string' && params.feedbackType.length > 0
        ? params.feedbackType
        : undefined;
    const projectId =
      typeof params.projectId === 'string' && params.projectId.length > 0
        ? params.projectId
        : undefined;
    const estimateId =
      typeof params.estimateId === 'string' && params.estimateId.length > 0
        ? params.estimateId
        : undefined;
    const aiContextFlag = params.aiContextFlag === '1' || params.aiContextFlag === 'true';
    if (!feedbackType && !projectId && !estimateId && !aiContextFlag) return undefined;
    return { feedbackType, projectId, estimateId, aiContextFlag };
  }, [params.feedbackType, params.projectId, params.estimateId, params.aiContextFlag]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={theme.background} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <BetaFeedbackPanel preset={preset} onCancel={() => router.back()} />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </>
  );
}
