// src/lib/thresholds.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Thresholds = {
  overallPct: number;     // e.g., alert if projected > planned by +X%
  materialsPct: number;   // alert if materials variance > +X%
  laborPct: number;
  equipmentPct: number;
};

const DEFAULT_THRESHOLDS: Thresholds = {
  overallPct: 10,
  materialsPct: 20,
  laborPct: 15,
  equipmentPct: 15,
};

const key = (projectId: string) => `bps.thresholds.${projectId}`;

export async function loadThresholds(projectId: string): Promise<Thresholds> {
  try {
    const raw = await AsyncStorage.getItem(key(projectId));
    return raw ? { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) } : DEFAULT_THRESHOLDS;
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export async function saveThresholds(projectId: string, t: Thresholds) {
  await AsyncStorage.setItem(key(projectId), JSON.stringify(t));
} 