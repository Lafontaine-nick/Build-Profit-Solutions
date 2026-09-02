const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authenticateToken');
const { isTeamWorkspaceReleased } = require('../constants/releaseFlags');
const {
  acceptWorkspaceInvitesForUser,
  addWorkspaceMember,
  ensureOwnerWorkspace,
  findInvitedWorkspaceForUser,
  findWorkspaceForUser,
  getSharedProjectResources,
  listWorkspaceMembers,
  countBillableSeats,
  listWorkspaceProjectsForMember,
  removeWorkspaceMember,
  resendWorkspaceInvite,
  updateWorkspaceMember,
  upsertSharedProjectResource,
  linkWorkspaceMemberIdentity,
} = require('../services/workspaceStorage');
const { sendWorkspaceInviteEmail } = require('../services/emailDelivery');
const {
  canManageWorkspaceMembers,
  canReadSharedResources,
  canWriteSharedResource,
  getActiveWorkspaceMember,
  memberCanAccessProject,
} = require('../services/workspacePermissions');

const ALLOWED_RESOURCE_TYPES = new Set([
  'expenses',
  'purchaseOrders',
  'dailyLogs',
  'calendarEvents',
  'timeline',
  'team',
]);

const DISABLED_WORKSPACE_ACCESS = {
  hasWorkspaceAccess: false,
  workspaceId: null,
  ownerUserId: null,
  ownerMember: null,
  role: null,
  status: null,
  isOwner: false,
  member: null,
};

router.use(authenticateToken);

router.use((req, res, next) => {
  if (isTeamWorkspaceReleased()) return next();

  if (req.method === 'GET' && req.path === '/access') {
    return res.json({ success: true, data: DISABLED_WORKSPACE_ACCESS });
  }

  if (req.method === 'GET' && req.path === '/bootstrap') {
    return res.json({
      success: true,
      data: { access: DISABLED_WORKSPACE_ACCESS },
    });
  }

  return res.status(503).json({
    success: false,
    error: 'Team workspace is not available yet.',
    code: 'TEAM_WORKSPACE_DISABLED',
  });
});

function currentUser(req) {
  const userId = String(req.user?.userId || req.user?.id || req.user?.sub || '');
  const email = req.user?.email || null;
  return { userId, email };
}

/** Find workspace for invited members; create one for new Business owners. */
function getOrEnsureWorkspace(req) {
  const { userId, email } = currentUser(req);
  if (!userId) return null;
  return ensureOwnerWorkspace({
    userId,
    email,
    name: 'Build Profit Workspace',
  });
}

function getAccessibleWorkspace(req, { linkIdentity = false } = {}) {
  const { userId, email } = currentUser(req);
  acceptWorkspaceInvitesForUser({ userId, email });
  let workspace = findWorkspaceForUser(userId, email);
  if (workspace && linkIdentity) {
    workspace = linkWorkspaceMemberIdentity(workspace, { userId, email }) || workspace;
  }
  return workspace;
}

function resolveWorkspace(req, { createIfMissing = false } = {}) {
  const user = currentUser(req);
  acceptWorkspaceInvitesForUser(user);
  let workspace = getAccessibleWorkspace(req);
  if (!workspace && createIfMissing) {
    const invited = findInvitedWorkspaceForUser(user.userId, user.email);
    if (invited) {
      workspace = getAccessibleWorkspace(req) || invited;
    } else {
      workspace = getOrEnsureWorkspace(req);
    }
  }
  return { workspace, user };
}

function requireActiveMember(req, res, workspace) {
  const member = getActiveWorkspaceMember(workspace, currentUser(req));
  if (!member) {
    res.status(403).json({
      success: false,
      error: 'Active workspace membership is required.',
    });
    return null;
  }
  return member;
}

function normalizePendingMemberEmail(member, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return normalizedEmail && String(member?.email || '').trim().toLowerCase() === normalizedEmail;
}

function buildWorkspaceAccessPayload(req) {
  const { userId, email } = currentUser(req);
  const workspace = getAccessibleWorkspace(req);
  const member = workspace
    ? getActiveWorkspaceMember(workspace, { userId, email }) ||
      (workspace.members || []).find(
        (row) => normalizePendingMemberEmail(row, email) && row.status === 'pending'
      )
    : null;
  const isActive = member?.status === 'active';
  const isOwner = Boolean(
    workspace &&
      (workspace.ownerUserId === userId ||
        (member?.role === 'owner' && member?.status === 'active'))
  );
  const ownerMember = workspace
    ? (workspace.members || []).find(
        (row) => row.role === 'owner' || row.userId === workspace.ownerUserId
      ) || null
    : null;

  return {
    hasWorkspaceAccess: Boolean(workspace && member && isActive),
    workspaceId: workspace?.id || null,
    ownerUserId: workspace?.ownerUserId || null,
    ownerMember,
    role: member?.role || null,
    status: member?.status || null,
    isOwner,
    member: member || null,
  };
}

router.get('/access', authenticateToken, async (req, res) => {
  const { userId, email } = currentUser(req);
  acceptWorkspaceInvitesForUser({ userId, email });
  getAccessibleWorkspace(req, { linkIdentity: true });

  res.json({
    success: true,
    data: buildWorkspaceAccessPayload(req),
  });
});

/** Single round-trip: accept invites, access snapshot, roster, and member project list. */
router.get('/bootstrap', authenticateToken, async (req, res) => {
  const { userId, email } = currentUser(req);
  acceptWorkspaceInvitesForUser({ userId, email });

  const workspace = getAccessibleWorkspace(req, { linkIdentity: true });
  const access = buildWorkspaceAccessPayload(req);
  const data = { access };

  if (!access.hasWorkspaceAccess || !access.workspaceId) {
    return res.json({ success: true, data });
  }

  const member = requireActiveMember(req, res, workspace);
  if (!member) return;

  const members = listWorkspaceMembers(workspace.id);
  data.members = members;
  data.seatLimit = workspace.seatLimit || 5;
  data.seatsUsed = countBillableSeats(members);

  if (!access.isOwner) {
    data.projects = listWorkspaceProjectsForMember(workspace, member);
  }

  res.json({ success: true, data });
});

function sanitizeSharedResourcePayload(resourceType, payload, member) {
  if (member?.role === 'owner' || member?.role === 'manager') return payload;
  if (resourceType === 'expenses' || resourceType === 'purchaseOrders') return [];
  if (resourceType !== 'timeline' || !Array.isArray(payload)) return payload;

  return payload.map((item) => ({
    id: item?.id,
    title: item?.title || item?.name || item?.description || 'Milestone',
    name: item?.name || item?.title,
    description: item?.description || '',
    dueDate: item?.dueDate || item?.scheduledDate || item?.date,
    scheduledDate: item?.scheduledDate || item?.dueDate || item?.date,
    status: item?.status,
    progressPct: item?.progressPct,
    completedAt: item?.completedAt,
    type: item?.type === 'payment' || item?.type === 'deposit' ? 'milestone' : item?.type,
  }));
}

router.get('/me', authenticateToken, async (req, res) => {
  const { userId, email } = currentUser(req);
  acceptWorkspaceInvitesForUser({ userId, email });
  let workspace = getAccessibleWorkspace(req);
  if (!workspace) {
    const invited = findInvitedWorkspaceForUser(userId, email);
    if (invited) {
      workspace = getAccessibleWorkspace(req) || invited;
    } else {
      workspace = ensureOwnerWorkspace({
        userId,
        email,
        name: req.query.name || 'Build Profit Workspace',
      });
    }
  }
  res.json({ success: true, data: workspace });
});

router.post('/me', authenticateToken, async (req, res) => {
  const { userId, email } = currentUser(req);
  acceptWorkspaceInvitesForUser({ userId, email });
  let workspace = getAccessibleWorkspace(req);
  if (!workspace) {
    const invited = findInvitedWorkspaceForUser(userId, email);
    if (invited) {
      workspace = getAccessibleWorkspace(req) || invited;
    } else {
      workspace = ensureOwnerWorkspace({
        userId,
        email,
        name: req.body?.name || 'Build Profit Workspace',
      });
    }
  }
  res.status(201).json({ success: true, data: workspace });
});

router.get('/members', authenticateToken, async (req, res) => {
  const { workspace } = resolveWorkspace(req, { createIfMissing: false });
  if (!workspace) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const member = requireActiveMember(req, res, workspace);
  if (!member) return;

  res.json({
    success: true,
    data: {
      workspaceId: workspace.id,
      seatLimit: workspace.seatLimit || 5,
      seatsUsed: countBillableSeats(listWorkspaceMembers(workspace.id)),
      members: listWorkspaceMembers(workspace.id),
    },
  });
});

router.post('/members', authenticateToken, async (req, res) => {
  const { workspace } = resolveWorkspace(req, { createIfMissing: true });
  if (!workspace) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const member = requireActiveMember(req, res, workspace);
  if (!member) return;
  if (!canManageWorkspaceMembers(member)) {
    return res.status(403).json({
      success: false,
      error: 'Only the workspace owner can invite members.',
    });
  }

  const result = addWorkspaceMember({
    workspaceId: workspace.id,
    member: {
      ...req.body,
      displayName: req.body?.displayName || req.body?.name,
      email: req.body?.email,
      accessRole: req.body?.accessRole || req.body?.workspaceRole,
      tradeRole: req.body?.tradeRole || req.body?.role,
    },
    invitedByUserId: currentUser(req).userId,
  });
  if (!result.success) {
    return res.status(result.code === 'SEAT_LIMIT_REACHED' ? 409 : 400).json(result);
  }

  const emailDelivery = await sendWorkspaceInviteEmail({
    workspace,
    member: result.member,
    invitedByEmail: currentUser(req).email,
  }).catch((error) => ({
    sent: false,
    error: error?.response?.data?.message || error?.message || 'Email delivery failed',
  }));

  res.status(201).json({ success: true, data: result.member, emailDelivery });
});

router.patch('/members/:memberId', authenticateToken, async (req, res) => {
  const { workspace } = resolveWorkspace(req, { createIfMissing: true });
  if (!workspace) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const member = requireActiveMember(req, res, workspace);
  if (!member) return;
  if (!canManageWorkspaceMembers(member)) {
    return res.status(403).json({
      success: false,
      error: 'Only the workspace owner can update members.',
    });
  }

  const result = updateWorkspaceMember({
    workspaceId: workspace.id,
    memberId: req.params.memberId,
    patch: req.body || {},
  });
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json({ success: true, data: result.member });
});

router.delete('/members/:memberId', authenticateToken, async (req, res) => {
  const { workspace } = resolveWorkspace(req, { createIfMissing: true });
  if (!workspace) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const member = requireActiveMember(req, res, workspace);
  if (!member) return;
  if (!canManageWorkspaceMembers(member)) {
    return res.status(403).json({
      success: false,
      error: 'Only the workspace owner can remove members.',
    });
  }

  const result = removeWorkspaceMember({
    workspaceId: workspace.id,
    memberId: req.params.memberId,
  });
  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json({ success: true, data: result.member });
});

router.post('/members/accept-invite', authenticateToken, async (req, res) => {
  const { userId, email } = currentUser(req);
  const result = acceptWorkspaceInvitesForUser({ userId, email });
  res.json({
    success: true,
    data: {
      accepted: result.accepted || [],
      workspace: getAccessibleWorkspace(req),
    },
  });
});

router.post('/members/:memberId/resend-invite', authenticateToken, async (req, res) => {
  const { workspace } = resolveWorkspace(req, { createIfMissing: true });
  if (!workspace) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const member = requireActiveMember(req, res, workspace);
  if (!member) return;
  if (!canManageWorkspaceMembers(member)) {
    return res.status(403).json({
      success: false,
      error: 'Only the workspace owner can resend invites.',
    });
  }

  const result = resendWorkspaceInvite({
    workspaceId: workspace.id,
    memberId: req.params.memberId,
  });
  if (!result.success) {
    return res.status(400).json(result);
  }

  const emailDelivery = await sendWorkspaceInviteEmail({
    workspace,
    member: result.member,
    invitedByEmail: currentUser(req).email,
  }).catch((error) => ({
    sent: false,
    error: error?.response?.data?.message || error?.message || 'Email delivery failed',
  }));

  res.json({ success: true, data: result.member, emailDelivery });
});

router.get('/projects', authenticateToken, async (req, res) => {
  const { userId, email } = currentUser(req);
  acceptWorkspaceInvitesForUser({ userId, email });

  const workspace = getAccessibleWorkspace(req, { linkIdentity: true });
  if (!workspace) {
    return res.json({ success: true, data: [], total: 0, workspaceId: null, ownerUserId: null });
  }

  const member = requireActiveMember(req, res, workspace);
  if (!member) return;

  const projects = listWorkspaceProjectsForMember(workspace, member);
  res.json({
    success: true,
    data: projects,
    total: projects.length,
    workspaceId: workspace.id,
    ownerUserId: workspace.ownerUserId,
  });
});

router.get('/projects/:projectId/resources', authenticateToken, async (req, res) => {
  const { workspace } = resolveWorkspace(req, { createIfMissing: true });
  if (!workspace) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const member = requireActiveMember(req, res, workspace);
  if (!member) return;
  if (!canReadSharedResources(member)) {
    return res.status(403).json({ success: false, error: 'Workspace access required.' });
  }
  if (!memberCanAccessProject(member, req.params.projectId)) {
    return res.status(403).json({ success: false, error: 'Project access is restricted for this workspace role.' });
  }

  const rows = getSharedProjectResources({
    workspaceId: workspace.id,
    projectId: req.params.projectId,
  });
  const resources = rows.reduce((acc, row) => {
    acc[row.resourceType] = {
      payload: sanitizeSharedResourcePayload(row.resourceType, row.payload, member),
      updatedAt: row.updatedAt,
      updatedByUserId: row.updatedByUserId,
    };
    return acc;
  }, {});

  res.json({ success: true, data: { workspaceId: workspace.id, resources } });
});

router.put('/projects/:projectId/resources/:resourceType', authenticateToken, async (req, res) => {
  const { resourceType } = req.params;
  if (!ALLOWED_RESOURCE_TYPES.has(resourceType)) {
    return res.status(400).json({
      success: false,
      error: `Unsupported resource type: ${resourceType}`,
    });
  }

  const { workspace, user } = resolveWorkspace(req, { createIfMissing: true });
  if (!workspace) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const member = requireActiveMember(req, res, workspace);
  if (!member) return;
  if (!canWriteSharedResource(member, resourceType)) {
    return res.status(403).json({
      success: false,
      error:
        member.role === 'field' || member.role === 'foreman'
          ? 'Field users can only update allowed field resources in the workspace.'
          : 'You do not have permission to update this workspace resource.',
    });
  }
  if (!memberCanAccessProject(member, req.params.projectId)) {
    return res.status(403).json({ success: false, error: 'Project access is restricted for this workspace role.' });
  }

  const row = upsertSharedProjectResource({
    workspaceId: workspace.id,
    projectId: req.params.projectId,
    resourceType,
    payload: req.body?.payload ?? req.body ?? [],
    userId: user.userId,
  });

  res.json({ success: true, data: row });
});

module.exports = router;
