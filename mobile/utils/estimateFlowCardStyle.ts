import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { PROJECT_WIDE_CONTAINER_CARD_INSET } from '@/constants/ScreenLayout';
import { BRAND_FRAME_GRADIENT_COLORS } from '@/constants/brandFrameGradient';

/** Horizontal inset for estimate flow screens — matches `wideContainer` cards on Bid Summary. */
export const ESTIMATE_FLOW_SCREEN_HORIZONTAL_PAD = PROJECT_WIDE_CONTAINER_CARD_INSET;

/** Uniform vertical gap between stacked flow cards (Summary → Step 8). */
export const ESTIMATE_FLOW_CARD_GAP = 12;

/** Inclusive calendar-day count between project start and end (YYYY-MM-DD). */
export function getProjectJobDurationDays(
  startDate?: string | null,
  endDate?: string | null,
): number | null {
  if (!startDate || !endDate) return null;
  const startTs = new Date(`${startDate}T00:00:00`).getTime();
  const endTs = new Date(`${endDate}T00:00:00`).getTime();
  const spanDays = Math.round((endTs - startTs) / (1000 * 60 * 60 * 24));
  if (spanDays < 0) return null;
  return spanDays + 1;
}

/** Billable week count from Step 2 start/end dates (partial weeks round up). */
export function getProjectJobDurationWeeks(
  startDate?: string | null,
  endDate?: string | null,
): number | null {
  const days = getProjectJobDurationDays(startDate, endDate);
  if (days == null) return null;
  return Math.max(1, Math.ceil(days / 7));
}

/** Step 7 weekly progress default when Step 2 dates are not set yet. */
export const ESTIMATE_DEFAULT_WEEKLY_PROJECT_WEEKS = 4;

export function resolveWeeklyProjectWeeks(
  startDate?: string | null,
  endDate?: string | null,
  overrideWeeks?: string | number | null,
): number {
  const parsedOverride = Math.round(Number(overrideWeeks));
  if (Number.isFinite(parsedOverride) && parsedOverride > 0) {
    return parsedOverride;
  }
  return (
    getProjectJobDurationWeeks(startDate, endDate) ??
    ESTIMATE_DEFAULT_WEEKLY_PROJECT_WEEKS
  );
}

/** Active green ring when an inline date field has its calendar open. */
export function estimateFlowActiveDateFieldStyle(isActive: boolean): ViewStyle {
  if (!isActive) return {};
  return {
    borderColor: ESTIMATE_FLOW_CHIP_GREEN,
    borderWidth: 1.5,
    backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
  };
}

/** Extra bottom inset on long scroll steps (tab bar / keyboard clearance). */
export const ESTIMATE_FLOW_STEP_SCROLL_BOTTOM = 80;

/** `wideContainer` wrapper for step body content below the stepper. */
export function estimateFlowStepContentWrapStyle(options?: { scrollBottom?: number }): ViewStyle {
  return {
    marginTop: 0,
    marginBottom: options?.scrollBottom ?? ESTIMATE_FLOW_CARD_GAP,
  };
}

/** Wrapper above the shared stepper card. */
export function estimateFlowStepperWrapStyle(): ViewStyle {
  return {
    marginTop: ESTIMATE_FLOW_CARD_GAP,
  };
}

/** Solid card fill shared across Build with AI → Initial Reveal → Confirm Scope. */
export const AI_FLOW_CARD_BG_DARK = '#202022';

/** Input / chip shells nested inside `estimateFlowCardStyle` (Project Information, Step 2). */
export const ESTIMATE_FLOW_NESTED_FIELD_BG_DARK = 'rgba(255,255,255,0.04)';

export function aiFlowCardBackground(darkMode: boolean, lightFallback: string) {
  return darkMode ? AI_FLOW_CARD_BG_DARK : lightFallback;
}

type FlowCardColors = {
  line: string;
  surface2: string;
  sub?: string;
  text?: string;
};

/** Match Step 2 scope cards / Budget tab inner cards. */
export function estimateFlowCardStyle(
  Colors: FlowCardColors,
  darkMode: boolean,
  options?: { marginBottom?: number; marginTop?: number }
): ViewStyle {
  return {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
    backgroundColor: aiFlowCardBackground(darkMode, Colors.surface2),
    ...(options?.marginTop != null ? { marginTop: options.marginTop } : {}),
    ...(options?.marginBottom != null ? { marginBottom: options.marginBottom } : {}),
    ...(darkMode
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 3,
        }
      : {}),
  };
}

/** Negative horizontal inset so cards align with Confirm Scope scope rows (scroll padding 16 − 8). */
export function estimateFlowScopeCardAlignStyle(): ViewStyle {
  return { marginHorizontal: -8 };
}

/** Solid primary CTAs — Continue to review, Generate Estimate Draft, Apply. */
export const ESTIMATE_FLOW_GREEN = '#22c55e';
/** Selection chips — Paint Scope, trade picks (Confirm scope). */
export const ESTIMATE_FLOW_CHIP_GREEN = '#34d399';
export const ESTIMATE_FLOW_CHIP_GREEN_BG = 'rgba(52, 211, 153, 0.12)';
/** Brand electric blue — matches New bid ring / AI Assistant gradient end. */
export const ESTIMATE_FLOW_BRAND_CYAN = BRAND_FRAME_GRADIENT_COLORS[0];
export const ESTIMATE_FLOW_BLUE = BRAND_FRAME_GRADIENT_COLORS[1];
/** Materials bar — brand blue → cyan (bottom to top). */
export const ESTIMATE_FLOW_MATERIALS_BAR_GRADIENT: [string, string] = [
  ESTIMATE_FLOW_BLUE,
  ESTIMATE_FLOW_BRAND_CYAN,
];
export const ESTIMATE_FLOW_BLUE_BG = 'rgba(0, 166, 255, 0.12)';
export const ESTIMATE_FLOW_BLUE_BORDER = 'rgba(0, 166, 255, 0.35)';

export function estimateFlowDividerColor(darkMode: boolean) {
  return darkMode ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.2)';
}

type Step1AccentTone = 'green' | 'blue' | 'neutral';

/** Step 1 import cards — plan (green), photos (blue), notes (neutral). */
export function estimateStep1AccentCardStyle(
  Colors: FlowCardColors,
  darkMode: boolean,
  tone: Step1AccentTone,
  options?: { active?: boolean }
): ViewStyle {
  if (tone === 'green') {
    return {
      borderRadius: 14,
      borderWidth: options?.active ? 1.5 : 1,
      borderColor: options?.active
        ? 'rgba(56,211,159,0.5)'
        : darkMode
          ? 'rgba(148,163,184,0.25)'
          : Colors.line,
      backgroundColor: options?.active
        ? darkMode
          ? 'rgba(56,211,159,0.12)'
          : 'rgba(34,197,94,0.08)'
        : darkMode
          ? 'rgba(34,197,94,0.08)'
          : 'rgba(34,197,94,0.06)',
    };
  }
  if (tone === 'blue') {
    return {
      borderRadius: 14,
      borderWidth: options?.active ? 1.5 : 1,
      borderColor: options?.active
        ? ESTIMATE_FLOW_BLUE_BORDER
        : darkMode
          ? 'rgba(148,163,184,0.25)'
          : Colors.line,
      backgroundColor: options?.active
        ? darkMode
          ? ESTIMATE_FLOW_BLUE_BG
          : 'rgba(0, 166, 255, 0.08)'
        : darkMode
          ? 'rgba(0, 166, 255, 0.08)'
          : 'rgba(0, 166, 255, 0.05)',
    };
  }
  return {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
    backgroundColor: aiFlowCardBackground(darkMode, Colors.surface2),
    ...(darkMode
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 3,
        }
      : {}),
  };
}

export function estimateStep1ActionButtonStyle(
  Colors: FlowCardColors,
  darkMode: boolean,
  options?: { disabled?: boolean }
): ViewStyle {
  return {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.18)' : Colors.line,
    backgroundColor: darkMode ? AI_FLOW_CARD_BG_DARK : 'rgba(0,0,0,0.03)',
    opacity: options?.disabled ? 0.45 : 1,
  };
}

/** Selected toggle inside a flow card — nested field fill, not the card surface. */
export function estimateFlowNestedActionButtonStyle(
  Colors: FlowCardColors,
  darkMode: boolean,
  options?: { disabled?: boolean }
): ViewStyle {
  return {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.18)' : Colors.line,
    backgroundColor: darkMode ? ESTIMATE_FLOW_NESTED_FIELD_BG_DARK : 'rgba(0,0,0,0.03)',
    opacity: options?.disabled ? 0.45 : 1,
  };
}

/** Selected toggle — tinted fill + accent ring (Whole project, trades, etc.). */
export function estimateStep1ActionButtonSelectedStyle(
  darkMode: boolean,
  accent: 'green' | 'blue'
): ViewStyle {
  if (accent === 'green') {
    return {
      borderWidth: 1,
      borderColor: ESTIMATE_FLOW_CHIP_GREEN,
      backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
    };
  }
  return {
    borderWidth: 1,
    borderColor: ESTIMATE_FLOW_BLUE_BORDER,
    backgroundColor: darkMode ? 'rgba(0, 166, 255, 0.16)' : 'rgba(0, 166, 255, 0.12)',
  };
}

/** Borderless secondary action — e.g. Dictate under Job notes. */
export function estimateStep1GhostActionStyle(
  darkMode: boolean,
  options?: { disabled?: boolean }
): ViewStyle {
  return {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    opacity: options?.disabled ? 0.45 : 1,
  };
}

/** Step 1 input cards — same shell as Review draft; green ring when ready. */
export function estimateStep1InputCardStyle(
  Colors: FlowCardColors,
  darkMode: boolean,
  options?: { marginBottom?: number; ready?: boolean }
): ViewStyle {
  return {
    ...estimateFlowCardStyle(Colors, darkMode, { marginBottom: options?.marginBottom }),
    ...(options?.ready
      ? {
          borderWidth: 1.5,
          borderColor: 'rgba(34, 197, 94, 0.35)',
        }
      : {}),
  };
}

/** Muted vs active icon tint — matches Camera (green) / Library (blue) actions. */
export function estimateStep1ActionIconColor(
  selected: boolean,
  accent: 'green' | 'blue',
  darkMode: boolean
): string {
  if (selected) return accent === 'green' ? '#22c55e' : ESTIMATE_FLOW_BLUE;
  return darkMode ? 'rgba(148, 163, 184, 0.55)' : 'rgba(100, 116, 139, 0.75)';
}

export function estimateStep1IconBadgeStyle(darkMode: boolean, tone: 'green' | 'blue' = 'green'): ViewStyle {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      tone === 'blue'
        ? darkMode
          ? ESTIMATE_FLOW_BLUE_BG
          : 'rgba(0, 166, 255, 0.1)'
        : darkMode
          ? 'rgba(34, 197, 94, 0.14)'
          : 'rgba(34, 197, 94, 0.1)',
  };
}

/** Confirm Scope — Suggested pricing, Saved pricing, etc. */
export function confirmScopeSectionLabelStyle(): TextStyle {
  return {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  };
}

/** Confirm Scope — primary price on suggest/apply cards. */
export const CONFIRM_SCOPE_PRICE_TEXT: TextStyle = {
  fontSize: 30,
  fontWeight: '800',
  letterSpacing: -0.5,
};

/** Confirm Scope — ghost Apply (matches Build with AI footer CTAs). */
export function confirmScopeApplyButtonStyle(): ViewStyle {
  return {
    marginTop: 10,
    alignSelf: 'stretch',
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  };
}

export function confirmScopeApplyButtonTextStyle(): TextStyle {
  return {
    color: ESTIMATE_FLOW_GREEN,
    fontSize: 14,
    fontWeight: '700',
  };
}

/** Confirm Scope — Yes / included choice (tinted ring, not solid fill). */
export function confirmScopeChoiceSelectedYesColors() {
  return {
    borderColor: ESTIMATE_FLOW_CHIP_GREEN,
    backgroundColor: ESTIMATE_FLOW_CHIP_GREEN_BG,
    textColor: ESTIMATE_FLOW_CHIP_GREEN,
  };
}

export type EstimateSummaryStatusTone = 'ready' | 'review' | 'progress';

/** Bid Summary hero — status pill colors (matches Review draft badges). */
export function estimateSummaryStatusColors(tone: EstimateSummaryStatusTone) {
  const tones = {
    ready: { bg: 'rgba(34, 197, 94, 0.14)', color: '#4ade80' },
    review: { bg: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24' },
    progress: { bg: ESTIMATE_FLOW_BLUE_BG, color: ESTIMATE_FLOW_BLUE },
  };
  return tones[tone];
}

/** Bid Summary hero — Materials / Labor metric chips. */
export function estimateSummaryMetricChipStyle(darkMode: boolean): ViewStyle {
  return {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 96,
    backgroundColor: darkMode ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.7)',
  };
}

/** Steps 3–5 — row/panel nested inside a flow card (materials, labor, allowances). */
export function estimateFlowLineItemStyle(Colors: FlowCardColors, darkMode: boolean): ViewStyle {
  return {
    backgroundColor: darkMode ? ESTIMATE_FLOW_NESTED_FIELD_BG_DARK : 'rgba(0, 0, 0, 0.03)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: ESTIMATE_FLOW_CARD_GAP,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
  };
}

/** Steps 1–2 AppTextField shell — reusable in Step 3 modals. */
export function estimateFlowInputShellStyle(Colors: FlowCardColors, darkMode: boolean): ViewStyle {
  return darkMode
    ? {
        backgroundColor: ESTIMATE_FLOW_NESTED_FIELD_BG_DARK,
        borderColor: 'rgba(148, 163, 184, 0.12)',
        borderRadius: 14,
        borderWidth: 1,
      }
    : {
        backgroundColor: Colors.surface2,
        borderColor: Colors.line,
        borderRadius: 14,
        borderWidth: 1,
      };
}

/** Steps 3–4 — cart/list footer total band. */
export function estimateFlowLineItemsTotalStyle(darkMode: boolean): ViewStyle {
  return {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: darkMode ? 'rgba(34, 197, 94, 0.22)' : 'rgba(34, 197, 94, 0.18)',
    backgroundColor: darkMode ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.06)',
  };
}

/** Nested row inside a flow card — subtle fill, no outline. */
export function estimateFlowNestedRowStyle(darkMode: boolean): ViewStyle {
  return {
    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  };
}

/** Gradient ring thickness for + New bid / AI Assistant utility chrome. */
export const ESTIMATE_UTILITY_RING_PADDING = 1;

/** Gradient ring wrapper — matches + New bid chrome. */
export function estimateAiAssistPillRingStyle(): ViewStyle {
  return {
    borderRadius: 999,
    padding: ESTIMATE_UTILITY_RING_PADDING,
  };
}

/** Inner fill for AI Assistant pill — charcoal on dark to match flow cards. */
export function estimateAiAssistPillInnerStyle(darkMode: boolean): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 14,
    paddingLeft: 5,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: darkMode ? AI_FLOW_CARD_BG_DARK : '#f8fafc',
  };
}

export function estimateAiAssistPillIconBadgeStyle(): ViewStyle {
  return {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  };
}

export function estimateAiAssistPillTextStyle(darkMode: boolean): TextStyle {
  return {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '700',
    color: darkMode ? '#f1f5f9' : '#0f172a',
    letterSpacing: 0.15,
  };
}

export function estimateAiAssistRowStyle(): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 4,
  };
}

export function estimateAiAssistHintStyle(): TextStyle {
  return {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  };
}

/** Divider + inset for AI row tucked inside the Summary stepper card. */
export function estimateAiAssistRowInCardStyle(darkMode: boolean): ViewStyle {
  return {
    marginTop: 8,
    paddingTop: 10,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: estimateFlowDividerColor(darkMode),
  };
}

/** Page header — solid green + New bid utility button. */
export function estimateHeaderNewBidButtonStyle(): ViewStyle {
  return {
    backgroundColor: ESTIMATE_FLOW_GREEN,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  };
}

export function estimateHeaderNewBidTextStyle(): TextStyle {
  return {
    color: '#071018',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  };
}

/** Bid Summary — section card title (Cost Breakdown, Project Actions). */
export function estimateSummarySectionTitleStyle(): TextStyle {
  return {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  };
}

/** Bid Summary — secondary copy under section titles. */
export function estimateSummarySectionSubtitleStyle(darkMode: boolean): TextStyle {
  return {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: darkMode ? 'rgba(248, 250, 252, 0.88)' : '#4a5568',
  };
}

/** Bid Summary — hero total amount. */
export function estimateSummaryHeroAmountStyle(): TextStyle {
  return {
    color: ESTIMATE_FLOW_GREEN,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 10,
  };
}

/** Solid green primary CTA — Preview & Submit, nav Next on Summary. */
export function estimateFlowPrimaryButtonStyle(): ViewStyle {
  return {
    width: '100%',
    backgroundColor: ESTIMATE_FLOW_GREEN,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  };
}

export function estimateFlowPrimaryButtonTextStyle(): TextStyle {
  return {
    color: '#071018',
    fontSize: 15,
    fontWeight: '800',
  };
}

/** Disabled primary CTA — e.g. Save template without a name. */
export function estimateFlowDisabledPrimaryButtonStyle(): ViewStyle {
  return {
    width: '100%',
    backgroundColor: '#3a3a3c',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  };
}

export function estimateFlowDisabledPrimaryButtonTextStyle(): TextStyle {
  return {
    color: 'rgba(248, 250, 252, 0.45)',
    fontSize: 15,
    fontWeight: '800',
  };
}

/** Teal outlined secondary action — Open bid, etc. */
export function estimateFlowOutlineActionButtonStyle(): ViewStyle {
  return {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ESTIMATE_FLOW_CHIP_GREEN,
    backgroundColor: 'transparent',
  };
}

export function estimateFlowOutlineActionButtonTextStyle(): TextStyle {
  return {
    color: ESTIMATE_FLOW_CHIP_GREEN,
    fontSize: 14,
    fontWeight: '700',
  };
}

export const ESTIMATE_TEMPLATE_PRESERVATION_LONG =
  'Templates preserve scope, quantities, materials, labor, direct costs, overhead, markup, and the payment schedule. Client information is not included.';

export const ESTIMATE_TEMPLATE_PRESERVATION_SHORT =
  'Includes scope, quantities, costs, overhead, markup, and payment schedule. Client information is excluded.';

/** Summary stepper — compact icon shell (step 0 charcoal card). */
export function estimateSummaryStepperIconShellStyle(
  Colors: FlowCardColors,
  darkMode: boolean,
  active: boolean
): ViewStyle {
  return {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: darkMode
      ? active
        ? 'rgba(34, 197, 94, 0.22)'
        : 'rgba(255, 255, 255, 0.09)'
      : active
        ? 'rgba(34, 197, 94, 0.16)'
        : Colors.surface2,
    borderWidth: active ? 2 : 1,
    borderColor: darkMode
      ? active
        ? ESTIMATE_FLOW_CHIP_GREEN
        : 'rgba(255, 255, 255, 0.2)'
      : active
        ? ESTIMATE_FLOW_CHIP_GREEN
        : Colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  };
}

export function estimateSummaryStepperIconColor(
  Colors: FlowCardColors,
  darkMode: boolean,
  active: boolean
): string {
  if (active) return ESTIMATE_FLOW_CHIP_GREEN;
  return darkMode ? 'rgba(241, 245, 249, 0.92)' : Colors.text ?? Colors.line;
}

export function estimateSummaryStepperLabelStyle(
  Colors: FlowCardColors,
  darkMode: boolean,
  active: boolean
): TextStyle {
  return {
    color: active
      ? ESTIMATE_FLOW_CHIP_GREEN
      : darkMode
        ? 'rgba(241, 245, 249, 0.94)'
        : Colors.sub ?? Colors.line,
    fontWeight: active ? '800' : '500',
    textAlign: 'center',
    minWidth: 28,
    letterSpacing: 0.2,
  };
}
