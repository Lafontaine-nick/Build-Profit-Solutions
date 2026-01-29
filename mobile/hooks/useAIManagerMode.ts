import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AI_MANAGER_MODE_KEY = "bps.aiProjectManagerMode";
const AI_MANAGER_ALERTS_KEY = "bps.aiProjectManagerAlerts";

export function useAIManagerMode() {
  // TODO: replace with real API / user settings
  const [enabled, setEnabled] = useState(true); // AI PM Mode toggle
  const [hasAlerts, setHasAlerts] = useState(false); // e.g., project at risk flag
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load AI Manager Mode setting from storage
    const loadSettings = async () => {
      try {
        const storedEnabled = await AsyncStorage.getItem(AI_MANAGER_MODE_KEY);
        if (storedEnabled !== null) {
          setEnabled(JSON.parse(storedEnabled));
        }

        const storedAlerts = await AsyncStorage.getItem(AI_MANAGER_ALERTS_KEY);
        if (storedAlerts !== null) {
          setHasAlerts(JSON.parse(storedAlerts));
        }
      } catch (error) {
        console.error("Error loading AI Manager Mode settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const toggleEnabled = async (value: boolean) => {
    try {
      await AsyncStorage.setItem(AI_MANAGER_MODE_KEY, JSON.stringify(value));
      setEnabled(value);
    } catch (error) {
      console.error("Error saving AI Manager Mode setting:", error);
    }
  };

  return { 
    enabled, 
    hasAlerts, 
    isLoading,
    toggleEnabled,
    setHasAlerts, // Allow external components to set alerts
  };
}




