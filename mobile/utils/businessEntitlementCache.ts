/**
 * In-memory snapshot of Business workspace entitlement for non-React code paths
 * (e.g. workspace push sync). Updated by useBusinessEntitlement.
 */
let cachedHasBusiness = false;
let cachedHasWorkspaceAccess = false;
let cacheReady = false;

export function setBusinessEntitlementSnapshot(snapshot: { hasBusiness: boolean; hasWorkspaceAccess?: boolean }) {
  cachedHasBusiness = snapshot.hasBusiness;
  cachedHasWorkspaceAccess = Boolean(snapshot.hasWorkspaceAccess);
  cacheReady = true;
}

export function isBusinessWorkspaceSyncEnabled(): boolean {
  return cacheReady && (cachedHasBusiness || cachedHasWorkspaceAccess);
}

export function resetBusinessEntitlementCache() {
  cachedHasBusiness = false;
  cachedHasWorkspaceAccess = false;
  cacheReady = false;
}
