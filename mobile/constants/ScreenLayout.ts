/**
 * Shared layout tokens for tab screens: headers, cards, and bottom inset
 * (floating pill tab bar in app/(tabs)/_layout.tsx).
 */

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

export function getTabScrollContentBottomInset(safeAreaBottom: number): number {
  return (
    ScreenLayout.tabBar.bottomOffset +
    ScreenLayout.tabBar.height +
    ScreenLayout.tabBar.extraBottom +
    safeAreaBottom
  );
}
