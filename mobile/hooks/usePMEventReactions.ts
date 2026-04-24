import { useEffect, useRef, useCallback } from 'react';
import { useAIManagerMode } from '@/state/useAIManagerMode';

export type PMEventType = 
  | 'cost_edit'
  | 'schedule_change'
  | 'phase_transition'
  | 'expense_added'
  | 'change_order_added'
  | 'milestone_updated';

export interface PMEvent {
  type: PMEventType;
  projectId?: string;
  projectName?: string;
  data: {
    previousValue?: any;
    newValue?: any;
    amount?: number;
    marginImpact?: number;
    scheduleImpact?: number;
    [key: string]: any;
  };
  timestamp: number;
}

type PMReactionCallback = (event: PMEvent) => void;

class PMEventTracker {
  private listeners: Map<PMEventType, Set<PMReactionCallback>> = new Map();
  private eventHistory: PMEvent[] = [];
  private maxHistorySize = 50;

  subscribe(eventType: PMEventType, callback: PMReactionCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  emit(event: PMEvent) {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify listeners
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in PM event callback:', error);
        }
      });
    }
  }

  getHistory(eventType?: PMEventType): PMEvent[] {
    if (eventType) {
      return this.eventHistory.filter(e => e.type === eventType);
    }
    return [...this.eventHistory];
  }

  clearHistory() {
    this.eventHistory = [];
  }
}

// Singleton instance
export const pmEventTracker = new PMEventTracker();

/**
 * Hook to track project changes and trigger PM reactions
 */
export function usePMEventReactions(
  projectId?: string,
  projectName?: string,
  onReaction?: (suggestion: string, event: PMEvent) => void
) {
  const { enabled: aiManagerEnabled } = useAIManagerMode();
  const previousDataRef = useRef<any>(null);
  const reactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate PM reaction based on event
  const generateReaction = useCallback(async (event: PMEvent) => {
    if (!aiManagerEnabled || !onReaction) return;

    let suggestion = '';

    switch (event.type) {
      case 'cost_edit': {
        const { previousValue, newValue, marginImpact } = event.data;
        if (marginImpact && marginImpact < -2) {
          suggestion = `This cost change drops your margin to ${(marginImpact).toFixed(1)}%. Want me to rebalance markup?`;
        } else if (newValue > previousValue * 1.1) {
          suggestion = `Cost increased by ${((newValue / previousValue - 1) * 100).toFixed(0)}%. Should I update the payment schedule?`;
        }
        break;
      }

      case 'schedule_change': {
        const { scheduleImpact } = event.data;
        if (scheduleImpact && scheduleImpact > 7) {
          suggestion = `This pushes final payment out ${scheduleImpact} days. Want to adjust billing?`;
        } else if (scheduleImpact && scheduleImpact < -7) {
          suggestion = `Schedule moved up ${Math.abs(scheduleImpact)} days. Consider accelerating payment milestones?`;
        }
        break;
      }

      case 'phase_transition': {
        const { newValue } = event.data;
        if (newValue === 'won' || newValue === 'active') {
          suggestion = `Project moved to ${newValue}. Do you want to lock margin targets and payment milestones now?`;
        }
        break;
      }

      case 'expense_added': {
        const { amount } = event.data;
        if (amount && amount > 1000) {
          suggestion = `Large expense added ($${amount.toLocaleString()}). Should I check if this impacts your margin targets?`;
        }
        break;
      }

      case 'change_order_added': {
        const { amount } = event.data;
        if (amount && amount > 0) {
          suggestion = `Change order added ($${amount.toLocaleString()}). Want me to update the payment schedule?`;
        }
        break;
      }

      case 'milestone_updated': {
        const { scheduleImpact } = event.data;
        if (scheduleImpact && Math.abs(scheduleImpact) > 3) {
          suggestion = `Milestone date changed by ${scheduleImpact} days. Should I adjust the payment schedule?`;
        }
        break;
      }
    }

    if (suggestion) {
      // Debounce reactions to avoid spam
      if (reactionTimeoutRef.current) {
        clearTimeout(reactionTimeoutRef.current);
      }
      reactionTimeoutRef.current = setTimeout(() => {
        onReaction(suggestion, event);
      }, 1000);
    }
  }, [aiManagerEnabled, onReaction]);

  // Subscribe to PM events
  useEffect(() => {
    if (!aiManagerEnabled) return;

    const unsubscribeCost = pmEventTracker.subscribe('cost_edit', (event) => {
      if (event.projectId === projectId || !projectId) {
        generateReaction(event);
      }
    });

    const unsubscribeSchedule = pmEventTracker.subscribe('schedule_change', (event) => {
      if (event.projectId === projectId || !projectId) {
        generateReaction(event);
      }
    });

    const unsubscribePhase = pmEventTracker.subscribe('phase_transition', (event) => {
      if (event.projectId === projectId || !projectId) {
        generateReaction(event);
      }
    });

    const unsubscribeExpense = pmEventTracker.subscribe('expense_added', (event) => {
      if (event.projectId === projectId || !projectId) {
        generateReaction(event);
      }
    });

    const unsubscribeChangeOrder = pmEventTracker.subscribe('change_order_added', (event) => {
      if (event.projectId === projectId || !projectId) {
        generateReaction(event);
      }
    });

    const unsubscribeMilestone = pmEventTracker.subscribe('milestone_updated', (event) => {
      if (event.projectId === projectId || !projectId) {
        generateReaction(event);
      }
    });

    return () => {
      unsubscribeCost();
      unsubscribeSchedule();
      unsubscribePhase();
      unsubscribeExpense();
      unsubscribeChangeOrder();
      unsubscribeMilestone();
      if (reactionTimeoutRef.current) {
        clearTimeout(reactionTimeoutRef.current);
      }
    };
  }, [aiManagerEnabled, projectId, generateReaction]);

  // Helper function to track project data changes
  const trackProjectDataChange = useCallback((currentData: any) => {
    if (!aiManagerEnabled || !previousDataRef.current) {
      previousDataRef.current = currentData;
      return;
    }

    const prev = previousDataRef.current;

    // Detect cost changes
    if (prev.budgeted !== currentData.budgeted || prev.spent !== currentData.spent) {
      const prevMargin = prev.budgeted > 0 ? ((prev.budgeted - prev.spent) / prev.budgeted) * 100 : 0;
      const newMargin = currentData.budgeted > 0 ? ((currentData.budgeted - currentData.spent) / currentData.budgeted) * 100 : 0;
      const marginImpact = newMargin - prevMargin;

      if (Math.abs(marginImpact) > 1) {
        pmEventTracker.emit({
          type: 'cost_edit',
          projectId,
          projectName,
          data: {
            previousValue: prev.budgeted,
            newValue: currentData.budgeted,
            marginImpact,
          },
          timestamp: Date.now(),
        });
      }
    }

    // Detect phase/status changes
    if (prev.status !== currentData.status) {
      pmEventTracker.emit({
        type: 'phase_transition',
        projectId,
        projectName,
        data: {
          previousValue: prev.status,
          newValue: currentData.status,
        },
        timestamp: Date.now(),
      });
    }

    // Detect schedule changes
    if (prev.startDate !== currentData.startDate || prev.endDate !== currentData.endDate) {
      const prevDuration = prev.startDate && prev.endDate 
        ? (new Date(prev.endDate).getTime() - new Date(prev.startDate).getTime()) / (1000 * 60 * 60 * 24)
        : 0;
      const newDuration = currentData.startDate && currentData.endDate
        ? (new Date(currentData.endDate).getTime() - new Date(currentData.startDate).getTime()) / (1000 * 60 * 60 * 24)
        : 0;
      const scheduleImpact = newDuration - prevDuration;

      if (Math.abs(scheduleImpact) > 1) {
        pmEventTracker.emit({
          type: 'schedule_change',
          projectId,
          projectName,
          data: {
            previousValue: { startDate: prev.startDate, endDate: prev.endDate },
            newValue: { startDate: currentData.startDate, endDate: currentData.endDate },
            scheduleImpact,
          },
          timestamp: Date.now(),
        });
      }
    }

    previousDataRef.current = currentData;
  }, [aiManagerEnabled, projectId, projectName]);

  return {
    trackProjectDataChange,
    emitEvent: pmEventTracker.emit.bind(pmEventTracker),
  };
}
