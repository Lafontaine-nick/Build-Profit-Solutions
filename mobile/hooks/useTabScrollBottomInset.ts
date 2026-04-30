import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getTabScrollContentBottomInset,
  isDesktopWebLayoutWidth,
} from '@/constants/ScreenLayout';

/**
 * Bottom padding for tab screen scroll areas: accounts for the floating pill tab bar
 * on phone / tablet web, and for the left sidebar layout on wide web (no bottom bar).
 */
export function useTabScrollBottomInset(): number {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const floatingBottomTabBar = !isDesktopWebLayoutWidth(width);
  return getTabScrollContentBottomInset(insets.bottom, { floatingBottomTabBar });
}
