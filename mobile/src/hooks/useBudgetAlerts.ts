// src/hooks/useBudgetAlerts.ts
import * as Notifications from "expo-notifications";
import { useEffect, useMemo, useRef } from "react";
import type { Thresholds } from "@/src/lib/thresholds";

export type CategoryKey = "materials" | "labor" | "equipment";

export type CategorySnapshot = {
  name: CategoryKey;
  budget: number; // current/adjusted budget for the category
  projected: number; // model projection for category
};

export type OverallSnapshot = {
  planned: number;      // project planned/adjusted budget
  projected: number;    // project projected final cost
};

export type AlertItem = {
  id: string;
  level: "info" | "warning" | "high";
  message: string;
};

type UseBudgetAlertsParams = {
  projectId: string;
  thresholds: Thresholds;
  overall: OverallSnapshot;
  categories: CategorySnapshot[];
  notify?: boolean; // default true
};

export function useBudgetAlerts({
  projectId,
  thresholds,
  overall,
  categories,
  notify = true,
}: UseBudgetAlertsParams) {
  const sent = useRef<Set<string>>(new Set());

  const alerts: AlertItem[] = useMemo(() => {
    const list: AlertItem[] = [];

    // Overall variance %
    const overallVar = pctOver(overall.projected, overall.planned); // e.g., 12.3
    if (overallVar >= thresholds.overallPct) {
      list.push({
        id: `${projectId}.overall`,
        level: overallVar >= thresholds.overallPct * 1.75 ? "high" : "warning",
        message: `Overall budget trending +${overallVar.toFixed(1)}% over plan`,
      });
    }

    // Per-category
    for (const c of categories) {
      const varPct = pctOver(c.projected, c.budget);
      const limit = thresholds[`${c.name}Pct` as keyof Thresholds] as number;
      if (limit && varPct >= limit) {
        list.push({
          id: `${projectId}.${c.name}`,
          level: varPct >= limit * 1.5 ? "high" : "warning",
          message: `${label(c.name)} trending +${varPct.toFixed(1)}% over`,
        });
      }
    }
    return list;
  }, [projectId, thresholds, overall, categories]);

  // Optional push (debounced so we don't spam)
  useEffect(() => {
    if (!notify || alerts.length === 0) return;

    (async () => {
      for (const a of alerts) {
        if (sent.current.has(a.id)) continue;
        sent.current.add(a.id);

        await Notifications.scheduleNotificationAsync({
          content: {
            title: a.level === "high" ? "⚠️ High budget risk" : "⚠️ Budget warning",
            body: a.message,
            data: { projectId },
          },
          trigger: null, // deliver immediately
        });
      }
    })();
  }, [alerts, notify, projectId]);

  return alerts;
}

function pctOver(projected: number, baseline: number) {
  const base = Math.max(1, Number(baseline) || 0);
  const proj = Math.max(0, Number(projected) || 0);
  const delta = Math.max(0, proj - base);
  return Math.min(999, (delta / base) * 100);
}

function label(k: CategoryKey) {
  switch (k) {
    case "materials": return "Materials";
    case "labor": return "Labor";
    case "equipment": return "Equipment";
  }
} 