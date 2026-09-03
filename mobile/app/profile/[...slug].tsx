import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy `/profile/*` → tab shell (keeps bottom nav visible). */
export default function LegacyProfileSubpageRedirect() {
  const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
  const parts = Array.isArray(slug) ? slug : slug ? [slug] : [];
  const suffix = parts.length > 0 ? `/${parts.join('/')}` : '';
  return <Redirect href={`/(tabs)/profile${suffix}` as const} />;
}
