const ROLE_RANK = {
  owner: 3,
  manager: 2,
  field: 1,
};

const FIELD_WRITABLE_RESOURCES = new Set(['dailyLogs', 'timeline']);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function findCurrentWorkspaceMember(workspace, { userId, email }) {
  const normalizedEmail = normalizeEmail(email);
  return (workspace?.members || []).find((member) => {
    if (member.userId && member.userId === userId) return true;
    if (!normalizedEmail) return false;
    return normalizeEmail(member.email) === normalizedEmail;
  });
}

function getActiveWorkspaceMember(workspace, user) {
  const member = findCurrentWorkspaceMember(workspace, user);
  if (!member || member.status !== 'active') return null;
  return member;
}

function memberHasMinRole(member, minRole) {
  const currentRank = ROLE_RANK[String(member?.role || '').toLowerCase()] || 0;
  const requiredRank = ROLE_RANK[minRole] || 0;
  return currentRank >= requiredRank;
}

function canManageWorkspaceMembers(member) {
  return member?.role === 'owner';
}

function canWriteSharedResource(member, resourceType) {
  if (!member) return false;
  if (member.role === 'owner' || member.role === 'manager') return true;
  if (member.role === 'field') return FIELD_WRITABLE_RESOURCES.has(resourceType);
  return false;
}

function canReadSharedResources(member) {
  return Boolean(member);
}

module.exports = {
  canManageWorkspaceMembers,
  canReadSharedResources,
  canWriteSharedResource,
  findCurrentWorkspaceMember,
  getActiveWorkspaceMember,
  memberHasMinRole,
};
