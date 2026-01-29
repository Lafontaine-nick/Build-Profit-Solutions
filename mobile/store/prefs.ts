import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeTrade } from '../lib/trades';

export type Timeline = 'Urgent' | 'Soon' | 'Normal' | 'Flexible';

export interface MatchLocation {
  city: string;
  state: string;
  radiusMi: number;
  lat?: number;
  lng?: number;
}

export interface MatchPreferences {
  trades: string[];
  specificTrades: string[];
  locations: MatchLocation[];
  minAIScore: number;
  timelineAllowed: Timeline[];
  filterByTrade: boolean;
  serviceHours?: { start: string; end: string };
  priceRange?: { min: number; max: number; currency: string };
}

interface PrefsState {
  hydrated: boolean;
  prefs: MatchPreferences;
  setPrefs: (p: Partial<MatchPreferences>) => void;
  replacePrefs: (p: MatchPreferences) => void;
  clear: () => void;
}

const defaultPrefs: MatchPreferences = {
  trades: [],
  specificTrades: [],
  locations: [],
  minAIScore: 50,
  timelineAllowed: ['Urgent', 'Soon', 'Normal', 'Flexible'],
  filterByTrade: false,
  serviceHours: undefined,
  priceRange: { min: 5000, max: 500000, currency: 'USD' },
};

const createStore = () =>
  create<PrefsState>()(
    persist(
      (set, get) => ({
        hydrated: false,
        prefs: defaultPrefs,
        setPrefs: (p) => set({ prefs: { ...get().prefs, ...p } }),
        replacePrefs: (p) => set({ prefs: p }),
        clear: () => set({ prefs: defaultPrefs }),
      }),
      {
        name: 'bps-prefs-v1',
        storage: createJSONStorage(() => AsyncStorage),
        onRehydrateStorage: () => async (state, err) => {
          // Mark hydrated when rehydration finishes
          console.log('🔄 Rehydration complete', { state: !!state, error: !!err });
          // One-time migration from legacy keys to unified prefs
          try {
            const legacyProfile = await AsyncStorage.getItem('bps.contractorProfile');
            if (legacyProfile) {
              const profile = JSON.parse(legacyProfile);
              const legacyTradeTypes: string[] = profile.tradeTypes || profile.trades || [];
              const legacySpecific: string[] = profile.specificTrades || [];
              const normalizedSpecific = Array.from(new Set((legacySpecific || []).map((t:string)=>normalizeTrade(t)))).filter(Boolean);
              const normalizedTypes = Array.from(new Set((legacyTradeTypes || []).map((t:string)=>normalizeTrade(t)))).filter(Boolean);
              const current = usePrefsStore.getState().prefs;
              const mergedSpecific = Array.from(new Set([...(current.specificTrades||[]), ...normalizedSpecific]));
              const mergedTrades = Array.from(new Set([...(current.trades||[]), ...normalizedTypes]));
              usePrefsStore.setState({ prefs: { ...current, specificTrades: mergedSpecific, trades: mergedTrades } });
              console.log('🔁 Migrated legacy trades to unified prefs');
            }
          } catch (e) {
            console.warn('Legacy trade migration failed', e);
          }
          usePrefsStore.setState({ hydrated: true });
        },
        partialize: (s) => ({ prefs: s.prefs }),
      }
    )
  );

// Prevent multiple stores during Fast Refresh
export const usePrefsStore: ReturnType<typeof createStore> =
  (global as any).__BPS_PREFS__ || ((global as any).__BPS_PREFS__ = createStore());

// Be extra sure hydration flag flips
usePrefsStore.persist?.onFinishHydration?.(() => {
  console.log('✅ Hydration finished');
  usePrefsStore.setState({ hydrated: true });
});

