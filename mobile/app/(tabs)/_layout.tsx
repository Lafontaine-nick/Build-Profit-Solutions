/** Metro picks `PillTabBarBackground.web` on web and `.native` on iOS/Android — never import `.native` here or web loads expo-blur / Worklets. */
import PillTabBarBackground from '@/components/ui/PillTabBarBackground';
import TabLayoutShared from './_TabLayoutShared';

export default function TabLayout() {
  return <TabLayoutShared PillTabBarBackground={PillTabBarBackground} />;
}
