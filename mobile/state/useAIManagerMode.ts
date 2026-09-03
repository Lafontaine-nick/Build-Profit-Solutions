import { useEffect, useState, useCallback } from "react";
import { apiService } from "@/services/api";

type AIManagerSettings = {
  enabled: boolean;   // AI Daily Brief on/off (budget alerts are always on)
  hasAlerts: boolean; // future: project at-risk indicator
};

async function apiGetAIManagerSettings(): Promise<AIManagerSettings> {
  try {
    const settings = await apiService.getUserSettings();
    return {
      enabled: settings.ai_project_manager_mode ?? true,
      hasAlerts: false, // TODO: implement alerts when backend supports it
    };
  } catch (error) {
    console.warn("Failed to fetch AI manager settings, using defaults:", error);
    return {
      enabled: true,
      hasAlerts: false,
    };
  }
}

async function apiUpdateAIManagerSettings(
  updates: Partial<AIManagerSettings>
): Promise<AIManagerSettings> {
  try {
    const settings = await apiService.updateUserSettings({
      ai_project_manager_mode: updates.enabled,
    });
    return {
      enabled: settings.ai_project_manager_mode ?? true,
      hasAlerts: updates.hasAlerts ?? false,
    };
  } catch (error) {
    console.warn("Failed to update AI manager settings:", error);
    // Return the attempted update on error (optimistic update)
    return {
      enabled: updates.enabled ?? false,
      hasAlerts: updates.hasAlerts ?? false,
    };
  }
}

export function useAIManagerMode() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [hasAlerts, setHasAlerts] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const settings = await apiGetAIManagerSettings();
        if (mounted) {
          setEnabled(settings.enabled);
          setHasAlerts(settings.hasAlerts);
        }
      } catch (e) {
        console.warn("Failed to load AI manager settings", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const toggleEnabled = useCallback(async (value?: boolean) => {
    try {
      const next = value !== undefined ? value : !enabled;
      setEnabled(next); // optimistic update
      const updated = await apiUpdateAIManagerSettings({ enabled: next });
      // Only update if the API returned a different value (revert on error)
      if (updated.enabled !== next) {
        setEnabled(updated.enabled);
      }
    } catch (e) {
      console.warn("Failed to update AI manager mode", e);
      // Revert on error
      setEnabled(prev => !prev);
    }
  }, [enabled]);

  return {
    enabled,
    hasAlerts,
    loading,
    toggleEnabled,
    setHasAlerts, // you can use this later when AI detects risk
  };
}




