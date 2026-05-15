/** Lowercase trim for comparing lead owner fields to the signed-in contractor scope. */
export function normScopeKey(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase();
}

/** True if `value` is the same identity as `scopeUserId` (Clerk id, email, or demo fallback). */
export function touchesLeadScope(scopeUserId: string, value?: string | null): boolean {
  const keys = new Set<string>();
  const n = normScopeKey(scopeUserId);
  if (n) keys.add(n);
  if (keys.size === 0) keys.add('contractor-demo');
  const t = normScopeKey(value);
  return t.length > 0 && keys.has(t);
}
