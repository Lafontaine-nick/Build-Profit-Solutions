import { Redirect, useLocalSearchParams } from 'expo-router';

function buildLegacyProjectDetailHref(
  id: string | string[] | undefined,
  params: Record<string, string | string[] | undefined>,
): string {
  const projectId = Array.isArray(id) ? id[0] : id;
  if (!projectId) return '/(tabs)/projects';

  const query = Object.entries(params)
    .filter(([key]) => key !== 'id')
    .flatMap(([key, value]) => {
      if (value == null || value === '') return [];
      const values = Array.isArray(value) ? value : [value];
      return values.map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    })
    .join('&');

  return `/(tabs)/project-detail/${encodeURIComponent(projectId)}${query ? `?${query}` : ''}`;
}

/** Legacy `/project-detail/:id` → tab shell (keeps bottom nav visible). */
export default function LegacyProjectDetailRedirect() {
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>();
  const { id, ...rest } = params;
  return <Redirect href={buildLegacyProjectDetailHref(id, rest) as any} />;
}
