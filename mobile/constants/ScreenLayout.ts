import { Platform } from 'react-native';

/**
 * Shared layout tokens for tab screens: headers, cards, and bottom inset
 * (floating pill tab bar in app/(tabs)/_layout.tsx).
 */

/** Web ≥ this width: landing, auth, getting-started use a centered max-width column (not full-bleed). */
export const WEB_CENTERED_COLUMN_MIN_WIDTH = 768;
/** Max width for that centered column (forms + marketing hero). */
export const WEB_CENTERED_COLUMN_MAX_WIDTH = 720;

/**
 * Dashboard / portfolio-style tabs on web: keeps metrics and sections readable on ultrawide
 * monitors instead of stretching edge-to-edge.
 */
export const DASHBOARD_WEB_MAX_CONTENT_WIDTH = 1180;

/** Tax Center year-end summary: readable column on wide monitors (web only). */
export const TAX_CENTER_WEB_MAX_CONTENT_WIDTH = 920;

/** Horizontal padding for tab shell content on desktop web (≥ DESKTOP_WEB_MIN_WIDTH). */
export const WEB_DESKTOP_EDGE_HORIZONTAL = 32;

/** Web viewports at or above this width use a left sidebar tab bar (office / desktop). */
export const DESKTOP_WEB_MIN_WIDTH = 1024;

export function isDesktopWebLayoutWidth(width: number): boolean {
  return Platform.OS === 'web' && width >= DESKTOP_WEB_MIN_WIDTH;
}

/**
 * Horizontal padding inside project-detail `wideContainer` on phone (non-desktop web).
 * Budget “Categories” / overview gradient cards use this inset after the -edge margin.
 */
export const PROJECT_WIDE_CONTAINER_CARD_INSET = 4;

/**
 * Header / scroll / footer horizontal padding for project expense modals (Add Transaction, PO, etc.).
 * Matches Add Material + Budget tab: tight inset on native, roomier on web / desktop web.
 */
export function getProjectExpenseFormHorizontalPadding(options: {
  desktopWeb: boolean;
}): { header: number; scroll: number; footer: number } {
  const { desktopWeb } = options;
  if (desktopWeb) {
    return { header: 20, scroll: 20, footer: 20 };
  }
  if (Platform.OS === 'web') {
    return { header: 20, scroll: 12, footer: 20 };
  }
  return {
    header: PROJECT_WIDE_CONTAINER_CARD_INSET,
    scroll: PROJECT_WIDE_CONTAINER_CARD_INSET,
    footer: PROJECT_WIDE_CONTAINER_CARD_INSET,
  };
}

export const ScreenLayout = {
  edge: {
    horizontal: 20,
  },
  screen: {
    paddingTop: 20,
  },
  header: {
    marginTop: 12,
    marginBottom: 18,
    /** Matches Estimates tab page title (`estimate-generator.jsx`). */
    titleSize: 34,
    titleWeight: '900' as const,
    titleLetterSpacing: -0.3,
    subtitleSize: 14,
    subtitleWeight: '500' as const,
    subtitleMarginTop: 6,
  },
  /** Primary content cards — aligned with `estimateFlowCardStyle` (Estimates / Build with AI). */
  card: {
    radius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidthDark: 1,
  },
  /** Must match app/(tabs)/_layout.tsx tabBarStyle */
  tabBar: {
    bottomOffset: 22,
    height: 64,
    /** Breathing room below bar + assistant tab glow */
    extraBottom: 24,
  },
} as const;

/** Dashboard + project detail calendar: slightly inset vs full-bleed section cards. */
export function getCalendarTabContainerStyle(options: {
  desktopWeb: boolean;
  edgeHorizontal?: number;
}): {
  marginHorizontal: number;
  paddingHorizontal: number;
} {
  const edge = options.edgeHorizontal ?? ScreenLayout.edge.horizontal;
  return {
    marginHorizontal: options.desktopWeb ? 0 : -(edge - 8),
    paddingHorizontal: options.desktopWeb ? 24 : 8,
  };
}

/** Full calendar tab shell — matches Dashboard `calendarContainer` + project detail embedded calendar. */
export function getCalendarTabShellStyle(options: {
  desktopWeb: boolean;
  edgeHorizontal?: number;
  marginTop?: number;
}): {
  marginTop: number;
  marginBottom: number;
  marginHorizontal: number;
  paddingHorizontal: number;
} {
  const { marginTop = 4, ...rest } = options;
  return {
    marginTop,
    marginBottom: 14,
    ...getCalendarTabContainerStyle(rest),
  };
}

export function getTabScrollContentBottomInset(
  safeAreaBottom: number,
  options?: { floatingBottomTabBar?: boolean }
): number {
  const floating = options?.floatingBottomTabBar !== false;
  if (!floating) {
    return 32 + safeAreaBottom;
  }
  return (
    ScreenLayout.tabBar.bottomOffset +
    ScreenLayout.tabBar.height +
    ScreenLayout.tabBar.extraBottom +
    safeAreaBottom
  );
}
