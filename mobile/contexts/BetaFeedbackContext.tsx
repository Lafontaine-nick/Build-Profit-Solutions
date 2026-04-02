import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import BetaFeedbackModal from '@/components/BetaFeedbackModal';
import BetaFeedbackFab from '@/components/BetaFeedbackFab';

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
 */
export function BetaFeedbackProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const testerEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null;

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
        <BetaFeedbackFab onOpen={openBetaFeedback} testerEmail={testerEmail} />
      </View>
    </BetaFeedbackContext.Provider>
  );
}
