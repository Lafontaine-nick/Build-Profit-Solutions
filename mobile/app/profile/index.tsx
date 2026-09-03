import { Redirect } from 'expo-router';

/** Legacy `/profile` → tab shell (keeps bottom nav visible). */
export default function LegacyProfileRedirect() {
  return <Redirect href="/(tabs)/profile" />;
}
