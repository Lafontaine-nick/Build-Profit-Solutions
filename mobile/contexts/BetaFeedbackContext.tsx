import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

export type BetaFeedbackPreset = {
  feedbackType?: string;
  aiContextFlag?: boolean;
  projectId?: string;
  estimateId?: string;
};

type BetaFeedbackContextValue = {
  openBetaFeedback: (preset?: BetaFeedbackPreset) => void;
};

const BetaFeedbackContext = createContext<BetaFeedbackContextValue | null>(null);

export function useBetaFeedback(): BetaFeedbackContextValue | null {
  return useContext(BetaFeedbackContext);
}

/**
 * Full-screen feedback lives at `/profile/beta-feedback`.
 * Must render under ClerkProvider. Omitted entirely when the app runs without Clerk.
 */
export function BetaFeedbackProvider({ children }: { children: React.ReactNode }) {
  const openBetaFeedback = useCallback((p?: BetaFeedbackPreset) => {
    const hasPreset =
      Boolean(p?.feedbackType) ||
      Boolean(p?.projectId) ||
      Boolean(p?.estimateId) ||
      Boolean(p?.aiContextFlag);
    if (!hasPreset) {
      router.push('/profile/beta-feedback');
      return;
    }
    router.push({
      pathname: '/profile/beta-feedback',
      params: {
        ...(p?.feedbackType ? { feedbackType: p.feedbackType } : {}),
        ...(p?.projectId ? { projectId: p.projectId } : {}),
        ...(p?.estimateId ? { estimateId: p.estimateId } : {}),
        ...(p?.aiContextFlag ? { aiContextFlag: '1' } : {}),
      },
    });
  }, []);

  const value = useMemo(
    () => ({
      openBetaFeedback,
    }),
    [openBetaFeedback]
  );

  return (
    <BetaFeedbackContext.Provider value={value}>
      <View style={{ flex: 1 }}>{children}</View>
    </BetaFeedbackContext.Provider>
  );
}
