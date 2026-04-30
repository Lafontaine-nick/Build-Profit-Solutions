import { Platform } from 'react-native';

/**
 * Shared layout tokens for tab screens: headers, cards, and bottom inset
 * (floating pill tab bar in app/(tabs)/_layout.tsx).
 */

/** Web ≥ this width: landing, auth, getting-started use a centered max-width column (not full-bleed). */
export const WEB_CENTERED_COLUMN_MIN_WIDTH = 768;
/** Max width for that centered column (forms + marketing hero). */
export const WEB_CENTERED_COLUMN_MAX_WIDTH = 720;

/** Web viewports at or above this width use a left sidebar tab bar (office / desktop). */
export const DESKTOP_WEB_MIN_WIDTH = 1024;

export function isDesktopWebLayoutWidth(width: number): boolean {
  return Platform.OS === 'web' && width >= DESKTOP_WEB_MIN_WIDTH;
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
    titleSize: 32,
    titleWeight: '800' as const,
    titleLetterSpacing: 0.2,
    subtitleSize: 14,
    subtitleWeight: '500' as const,
    subtitleMarginTop: 4,
  },
  /** Primary content cards (dashboard / projects) */
  card: {
    radius: 28,
    padding: 18,
    marginBottom: 16,
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
