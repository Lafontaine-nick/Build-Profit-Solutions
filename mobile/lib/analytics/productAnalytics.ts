import { apiService } from '@/services/api';

/** Canonical event names for beta / product analytics (server logs + optional DB when APP_TELEMETRY_ENABLED=true). */
export const AnalyticsEvent = {
  estimateCreated: 'estimate_created',
  estimateCompleted: 'estimate_completed',
  estimateWon: 'estimate_won',
  projectCreated: 'project_created',
  projectOpened: 'project_opened',
  aiUsed: 'ai_used',
  aiHealthCheckRun: 'ai_health_check_run',
  expenseLogged: 'expense_logged',
  poCreated: 'po_created',
  paymentScheduleCreated: 'payment_schedule_created',
  leadContacted: 'lead_contacted',
  feedbackSubmitted: 'feedback_submitted',
} as const;

/** Fire-and-forget; never throws to callers. */
export function trackProductEvent(
  name: string,
  properties?: Record<string, unknown>
): void {
  void apiService.trackAppEvent(name, properties);
}
