import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import {
  getWebPageShellMaxWidth,
  WEB_PAGE_SHELL_HORIZONTAL_PADDING,
} from '@/components/layout/WebPageShell';

/** Default horizontal margin on the teal chrome `LinearGradient` (matches help-support). */
export const PROFILE_HELP_CHROME_H_MARGIN = 8;

/**
 * Web only: horizontal margins so the back control lines up with the outer edge of the
 * profile-column chrome (WebPageShell padding + optional gradient `marginHorizontal`).
 *
 * @param chromeHorizontalMargin — use `0` when the web chrome has no horizontal inset
 *   (e.g. Getting Started); default `8` matches `marginHorizontal: 8` on the frame.
 */
export function useWebProfileHelpHeaderMargins(
  chromeHorizontalMargin: number = PROFILE_HELP_CHROME_H_MARGIN
) {
  const { width: layoutWidth } = useWindowDimensions();
  return useMemo(() => {
    if (Platform.OS !== 'web') return undefined;
    const maxW = getWebPageShellMaxWidth('profile');
    const gutter = (layoutWidth - Math.min(layoutWidth, maxW)) / 2;
    const inset =
      gutter + WEB_PAGE_SHELL_HORIZONTAL_PADDING + chromeHorizontalMargin;
    return { marginLeft: inset, marginRight: inset };
  }, [layoutWidth, chromeHorizontalMargin]);
}
