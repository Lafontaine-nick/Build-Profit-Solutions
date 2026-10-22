/** A contractor took this line off the bid. Plan counts must not put it back. */
export function contractorKeptScopeItemOut(
  item: { contractorRemoved?: boolean } | null | undefined
): boolean {
  return item?.contractorRemoved === true;
}

export function applyContractorRemovedScopeItems<
  T extends { id: string; state?: string; contractorRemoved?: boolean },
>(items: T[], removedIds: readonly string[] | null | undefined): T[] {
  if (!removedIds?.length) return items;
  const removed = new Set(removedIds);
  let changed = false;
  const next = items.map(item => {
    if (!removed.has(item.id)) return item;
    if (item.state === 'excluded' && item.contractorRemoved) return item;
    changed = true;
    return {
      ...item,
      state: 'excluded' as T['state'],
      contractorRemoved: true,
    };
  });
  return changed ? next : items;
}
