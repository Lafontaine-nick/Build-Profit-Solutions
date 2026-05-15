/**
 * Shared identity helpers for lead routes (Clerk JWT + legacy backend JWT).
 */

function normalizeLeadOwnerKey(s) {
  return String(s || '').trim().toLowerCase();
}

function authOwnerKeys(req) {
  const u = req.user || {};
  const keys = new Set();
  if (u.userId) keys.add(normalizeLeadOwnerKey(u.userId));
  if (u.sub) keys.add(normalizeLeadOwnerKey(u.sub));
  if (u.id != null && u.id !== '') keys.add(normalizeLeadOwnerKey(u.id));
  if (u.email) keys.add(normalizeLeadOwnerKey(u.email));
  return keys;
}

/** Primary id string for createdBy / assignedTo (Clerk sub, backend user id, or email). */
function resolveActorIdFromAuth(req) {
  const u = req.user || {};
  if (u.userId) return String(u.userId).trim();
  if (u.sub) return String(u.sub).trim();
  if (u.id != null && u.id !== '') return String(u.id).trim();
  if (u.email) return String(u.email).trim();
  return null;
}

/** `GET .../scope/:userId`-style param must match one of the authenticated identities. */
function urlParamUserMatchesAuth(req, paramUserId) {
  const keys = authOwnerKeys(req);
  const p = normalizeLeadOwnerKey(decodeURIComponent(String(paramUserId || '')));
  return keys.has(p);
}

/** Delete / bulk-delete: only the creator may remove project-based rows. */
function leadOwnedByRequester(req, lead) {
  if (!lead || !lead.createdBy) return false;
  return authOwnerKeys(req).has(normalizeLeadOwnerKey(lead.createdBy));
}

/** Read access: creator (GC) or assigned contractor. */
function leadAccessibleByRequest(req, lead) {
  if (!lead) return false;
  const keys = authOwnerKeys(req);
  if (lead.createdBy && keys.has(normalizeLeadOwnerKey(lead.createdBy))) return true;
  if (lead.assignedTo && keys.has(normalizeLeadOwnerKey(lead.assignedTo))) return true;
  return false;
}

module.exports = {
  normalizeLeadOwnerKey,
  authOwnerKeys,
  resolveActorIdFromAuth,
  urlParamUserMatchesAuth,
  leadOwnedByRequester,
  leadAccessibleByRequest,
};
