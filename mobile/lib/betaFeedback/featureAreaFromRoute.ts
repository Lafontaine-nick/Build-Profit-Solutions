/** Coarse feature bucket for feedback triage (no PII). */
export function featureAreaFromRoute(pathname: string): string {
  const p = (pathname || '').toLowerCase();
  if (p.includes('estimate')) return 'estimate';
  if (p.includes('project-detail') || p.includes('project')) return 'project';
  if (p.includes('leads')) return 'leads';
  if (p.includes('assistant')) return 'ai_assistant';
  if (p.includes('dashboard')) return 'dashboard';
  if (p.includes('profile')) return 'profile';
  return 'other';
}
