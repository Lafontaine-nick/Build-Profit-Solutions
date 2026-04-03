import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View } from 'react-native';
import BetaFeedbackModal from '@/components/BetaFeedbackModal';

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
 * Must render under ClerkProvider. Omitted entirely when the app runs without Clerk.
 * Entry point: Profile → Beta feedback (no floating pill, no AI header link).
 */
export function BetaFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [preset, setPreset] = useState<BetaFeedbackPreset | undefined>(undefined);

  const openBetaFeedback = useCallback((p?: BetaFeedbackPreset) => {
    setPreset(p);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setPreset(undefined);
  }, []);

  const value = useMemo(
    () => ({
      openBetaFeedback,
    }),
    [openBetaFeedback]
  );

  return (
    <BetaFeedbackContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <BetaFeedbackModal visible={visible} onClose={close} preset={preset} />
      </View>
    </BetaFeedbackContext.Provider>
  );
}
