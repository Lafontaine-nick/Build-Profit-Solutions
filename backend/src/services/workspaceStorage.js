const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const STORAGE_DIR = path.join(__dirname, '../../storage');
const WORKSPACES_FILE = path.join(STORAGE_DIR, 'workspaces.json');
const SHARED_PROJECT_DATA_FILE = path.join(STORAGE_DIR, 'project-shared-data.json');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

for (const file of [WORKSPACES_FILE, SHARED_PROJECT_DATA_FILE]) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify([], null, 2));
  }
}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Failed to load ${path.basename(file)}:`, error);
    return [];
  }
}

function saveJson(file, rows) {
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
}

function loadWorkspaces() {
  return loadJson(WORKSPACES_FILE);
}

function saveWorkspaces(workspaces) {
  saveJson(WORKSPACES_FILE, workspaces);
}

function loadSharedProjectData() {
  return loadJson(SHARED_PROJECT_DATA_FILE);
}

function saveSharedProjectData(rows) {
  saveJson(SHARED_PROJECT_DATA_FILE, rows);
}

function normalizeEmail(email) {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

function countBillableSeats(members = []) {
  return members.filter(
    (member) => member.role !== 'owner' && member.status !== 'suspended'
  ).length;
}

function findWorkspaceForUser(userId, email) {
  const normalizedEmail = normalizeEmail(email);
  const workspaces = loadWorkspaces();

  // Prefer invited/member access over accidental empty owner workspaces.
  // This matters when a user created an account before their invite was accepted.
  const memberWorkspace = workspaces.find((workspace) => {
    return (workspace.members || []).some(
      (member) =>
        member.role !== 'owner' &&
        (member.userId === userId ||
          (normalizedEmail && normalizeEmail(member.email) === normalizedEmail))
    );
  });
  if (memberWorkspace) return memberWorkspace;

  return workspaces.find((workspace) => {
    if (workspace.ownerUserId === userId) return true;
    return (workspace.members || []).some(
      (member) =>
        member.userId === userId ||
        (normalizedEmail && normalizeEmail(member.email) === normalizedEmail)
    );
  });
}

function findInvitedWorkspaceForUser(userId, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!userId && !normalizedEmail) return null;

  for (const workspace of loadWorkspaces()) {
    const member = (workspace.members || []).find((row) => {
      if (row.role === 'owner') return false;
      if (userId && row.userId === userId) {
        return row.status === 'pending' || row.status === 'active';
      }
      if (normalizedEmail && normalizeEmail(row.email) === normalizedEmail) {
        return row.status === 'pending' || row.status === 'active';
      }
      return false;
    });
    if (member) return workspace;
  }
  return null;
}

function ensureOwnerWorkspace({ userId, email, name }) {
  const existing = findWorkspaceForUser(userId, email);
  if (existing) {
    if (existing.ownerUserId !== userId) {
      return existing;
    }

    const members = existing.members || [];
    const ownerIdx = members.findIndex(
      (member) => member.role === 'owner'
    );
    if (ownerIdx >= 0) {
      const owner = members[ownerIdx];
      const normalizedEmail = normalizeEmail(email);
      const displayName = String(name || owner.displayName || normalizedEmail || 'Owner').trim();
      const shouldUpdate =
        (normalizedEmail && normalizeEmail(owner.email) !== normalizedEmail) ||
        (displayName && owner.displayName !== displayName) ||
        (normalizedEmail && !normalizeEmail(owner.email));
      if (shouldUpdate) {
        const nextMembers = [...members];
        nextMembers[ownerIdx] = {
          ...owner,
          email: normalizedEmail || owner.email,
          displayName,
          updatedAt: new Date().toISOString(),
        };
        return saveWorkspace({ ...existing, members: nextMembers, ownerEmail: normalizedEmail || existing.ownerEmail });
      }
    }
    return existing;
  }

  const invitedWorkspace = findInvitedWorkspaceForUser(userId, email);
  if (invitedWorkspace) {
    if (userId && email) {
      acceptWorkspaceInvitesForUser({ userId, email });
    }
    return findWorkspaceForUser(userId, email) || invitedWorkspace;
  }

  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(email);
  const displayName = String(name || normalizedEmail || 'Owner').trim();
  const workspace = {
    id: uuidv4(),
    name: name || 'Build Profit Workspace',
    ownerUserId: userId,
    ownerEmail: normalizedEmail || null,
    billingPlan: 'business',
    billingStatus: 'inactive',
    seatLimit: 5,
    members: [
      {
        id: uuidv4(),
        userId,
        email: normalizedEmail || '',
        displayName,
        role: 'owner',
        tradeRole: 'Project Manager',
        status: 'active',
        projectStatus: 'active',
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const workspaces = loadWorkspaces();
  workspaces.push(workspace);
  saveWorkspaces(workspaces);
  return workspace;
}

function saveWorkspace(workspace) {
  const workspaces = loadWorkspaces();
  const index = workspaces.findIndex((row) => row.id === workspace.id);
  if (index < 0) return null;
  const next = {
    ...workspace,
    updatedAt: new Date().toISOString(),
  };
  workspaces[index] = next;
  saveWorkspaces(workspaces);
  return next;
}

function listWorkspaceMembers(workspaceId) {
  const workspace = loadWorkspaces().find((row) => row.id === workspaceId);
  return workspace?.members || [];
}

const ALLOWED_ACCESS_ROLES = new Set(['owner', 'manager', 'foreman', 'field', 'view_only']);
const ALLOWED_INVITE_STATUSES = new Set(['pending', 'active', 'suspended']);
const ALLOWED_PROJECT_ACCESS = new Set(['all_active', 'assigned']);
const ALLOWED_JOB_TITLES = new Set([
  'Project Manager',
  'Foreman',
  'Field Lead',
  'Crew Member',
  'General Laborer',
  'Office/Admin',
  'Estimator',
  'Bookkeeper',
  'Subcontractor',
  'Other',
]);

function normalizeAccessRole(value, fallback = 'field') {
  const role = String(value || fallback).trim().toLowerCase();
  return ALLOWED_ACCESS_ROLES.has(role) ? role : fallback;
}

function normalizeInviteStatus(value, fallback = 'pending') {
  const status = String(value || fallback).trim().toLowerCase();
  return ALLOWED_INVITE_STATUSES.has(status) ? status : fallback;
}

function normalizeProjectStatus(value, fallback = 'active') {
  return value === 'off_duty' ? 'off_duty' : fallback === 'off_duty' ? 'off_duty' : 'active';
}

function normalizeProjectAccess(value, fallback = 'all_active') {
  const access = String(value || fallback).trim().toLowerCase();
  return ALLOWED_PROJECT_ACCESS.has(access) ? access : fallback;
}

function normalizeAssignedProjectIds(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );
}

function defaultJobTitleForRole(role) {
  if (role === 'manager') return 'Project Manager';
  if (role === 'foreman') return 'Foreman';
  if (role === 'view_only') return 'Other';
  return 'General Laborer';
}

function normalizeJobTitle(value, role) {
  const title = String(value || '').trim();
  if (ALLOWED_JOB_TITLES.has(title)) return title;
  if (title === 'General Labor') return 'General Laborer';
  if (['Electrician', 'Plumber', 'Carpenter', 'Tile Setter', 'Concrete', 'Drywall Installer', 'Painter'].includes(title)) {
    return 'Subcontractor';
  }
  return defaultJobTitleForRole(role);
}

function normalizeWorkspaceMember(input = {}, existing = {}) {
  const now = new Date().toISOString();
  const email = normalizeEmail(input.email ?? existing.email);
  const displayName = String(
    input.displayName || input.name || existing.displayName || email || 'Team Member'
  ).trim();
  const accessRole = normalizeAccessRole(
    input.accessRole || input.workspaceRole || existing.role,
    existing.role || 'field'
  );
  const jobTitle = normalizeJobTitle(
    input.jobTitle || input.tradeRole || existing.jobTitle || existing.tradeRole,
    accessRole
  );

  const inviteStatus = normalizeInviteStatus(
    input.inviteStatus ?? input.status ?? existing.status,
    existing.status || 'pending'
  );
  const projectStatus = normalizeProjectStatus(
    input.projectStatus ?? existing.projectStatus,
    existing.projectStatus || 'active'
  );

  return {
    ...existing,
    id: existing.id || uuidv4(),
    userId: input.userId ?? existing.userId ?? null,
    email,
    displayName,
    phone: input.phone ?? existing.phone ?? '',
    role: accessRole,
    jobTitle,
    // Backward-compatible alias for older mobile clients. This is job title, not permissions.
    tradeRole: jobTitle,
    status: inviteStatus,
    projectStatus,
    projectAccess: normalizeProjectAccess(
      input.projectAccess ?? existing.projectAccess,
      existing.projectAccess || 'all_active'
    ),
    assignedProjectIds: normalizeAssignedProjectIds(
      input.assignedProjectIds ?? existing.assignedProjectIds
    ),
    skills: Array.isArray(input.skills) ? input.skills : existing.skills || [],
    invitedByUserId: input.invitedByUserId ?? existing.invitedByUserId ?? null,
    invitedAt: existing.invitedAt || now,
    joinedAt: input.joinedAt ?? existing.joinedAt ?? null,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
}

function addWorkspaceMember({ workspaceId, member, invitedByUserId }) {
  const workspace = loadWorkspaces().find((row) => row.id === workspaceId);
  if (!workspace) return { success: false, error: 'Workspace not found' };

  const inviteEmail = normalizeEmail(member?.email);
  if (!inviteEmail) {
    return { success: false, error: 'Email is required to invite a workspace member.' };
  }

  const members = workspace.members || [];
  const billableSeats = countBillableSeats(members);
  if (billableSeats >= (workspace.seatLimit || 5)) {
    return {
      success: false,
      error: `Business plan includes ${workspace.seatLimit || 5} team seats (owner not included). Remove a member before inviting another.`,
      code: 'SEAT_LIMIT_REACHED',
    };
  }

  const normalized = normalizeWorkspaceMember({
    ...member,
    email: inviteEmail,
    invitedByUserId,
    inviteStatus: 'pending',
    accessRole: member?.accessRole || member?.role || 'field',
  });
  const duplicate = members.find(
    (row) => normalized.email && normalizeEmail(row.email) === normalized.email
  );
  if (duplicate) {
    return { success: false, error: 'A workspace member with this email already exists.' };
  }

  const saved = saveWorkspace({
    ...workspace,
    members: [...members, normalized],
  });
  return { success: true, member: normalized, workspace: saved };
}

function updateWorkspaceMember({ workspaceId, memberId, patch }) {
  const workspace = loadWorkspaces().find((row) => row.id === workspaceId);
  if (!workspace) return { success: false, error: 'Workspace not found' };

  const members = workspace.members || [];
  const index = members.findIndex((row) => row.id === memberId);
  if (index < 0) return { success: false, error: 'Workspace member not found' };

  const existing = members[index];
  const updated = normalizeWorkspaceMember(patch, existing);
  if (existing.role === 'owner') {
    updated.role = 'owner';
    updated.status = 'active';
  }

  const nextMembers = [...members];
  nextMembers[index] = updated;
  const saved = saveWorkspace({ ...workspace, members: nextMembers });
  return { success: true, member: updated, workspace: saved };
}

function acceptWorkspaceInvitesForUser({ userId, email }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return { success: true, accepted: [] };

  const workspaces = loadWorkspaces();
  const accepted = [];
  let changed = false;

  for (const workspace of workspaces) {
    const members = workspace.members || [];
    let workspaceChanged = false;
    const nextMembers = members.map((member) => {
      if (
        member.status === 'pending' &&
        normalizeEmail(member.email) === normalizedEmail
      ) {
        const now = new Date().toISOString();
        const updated = {
          ...member,
          userId,
          status: 'active',
          joinedAt: now,
          updatedAt: now,
        };
        accepted.push(updated);
        workspaceChanged = true;
        return updated;
      }
      return member;
    });

    if (workspaceChanged) {
      workspace.members = nextMembers;
      workspace.updatedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) saveWorkspaces(workspaces);
  return { success: true, accepted };
}

function resendWorkspaceInvite({ workspaceId, memberId }) {
  const workspace = loadWorkspaces().find((row) => row.id === workspaceId);
  if (!workspace) return { success: false, error: 'Workspace not found' };

  const members = workspace.members || [];
  const index = members.findIndex((row) => row.id === memberId);
  if (index < 0) return { success: false, error: 'Workspace member not found' };

  const existing = members[index];
  if (existing.status !== 'pending') {
    return { success: false, error: 'Only pending invites can be resent.' };
  }
  if (!existing.email) {
    return { success: false, error: 'This invite has no email address.' };
  }

  const now = new Date().toISOString();
  const updated = { ...existing, invitedAt: now, updatedAt: now };
  const nextMembers = [...members];
  nextMembers[index] = updated;
  const saved = saveWorkspace({ ...workspace, members: nextMembers });
  return { success: true, member: updated, workspace: saved };
}

function removeWorkspaceMember({ workspaceId, memberId }) {
  const workspace = loadWorkspaces().find((row) => row.id === workspaceId);
  if (!workspace) return { success: false, error: 'Workspace not found' };

  const members = workspace.members || [];
  const member = members.find((row) => row.id === memberId);
  if (!member) return { success: false, error: 'Workspace member not found' };
  if (member.role === 'owner') {
    return { success: false, error: 'The workspace owner cannot be removed.' };
  }

  const saved = saveWorkspace({
    ...workspace,
    members: members.filter((row) => row.id !== memberId),
  });
  return { success: true, member, workspace: saved };
}

function upsertSharedProjectResource({ workspaceId, projectId, resourceType, payload, userId }) {
  const rows = loadSharedProjectData();
  const now = new Date().toISOString();
  const index = rows.findIndex(
    (row) =>
      row.workspaceId === workspaceId &&
      row.projectId === projectId &&
      row.resourceType === resourceType
  );
  const next = {
    id: index >= 0 ? rows[index].id : uuidv4(),
    workspaceId,
    projectId,
    resourceType,
    payload,
    updatedByUserId: userId,
    updatedAt: now,
    createdAt: index >= 0 ? rows[index].createdAt : now,
  };

  if (index >= 0) rows[index] = next;
  else rows.push(next);
  saveSharedProjectData(rows);
  return next;
}

function getSharedProjectResources({ workspaceId, projectId }) {
  return loadSharedProjectData().filter(
    (row) => row.workspaceId === workspaceId && row.projectId === projectId
  );
}

function listWorkspaceOwnerProjects(workspace) {
  const { loadProjects } = require('./leadStorage');
  const ownerUserId = workspace?.ownerUserId;
  if (!ownerUserId) return [];
  return loadProjects().filter((project) => project.userId === ownerUserId);
}

function sanitizeTimelineItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
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

function sanitizeProjectForWorkspaceMember(project, member) {
  if (!project || member?.role === 'owner') return project;

  const now = new Date().toISOString();
  return {
    id: project.id,
    title: project.title || project.name || 'Untitled Project',
    name: project.name || project.title || 'Untitled Project',
    status: project.status || 'in_progress',
    location: project.location || project.projectData?.location || '',
    city: project.city,
    state: project.state,
    zip: project.zip,
    startDate: project.startDate || project.estimateData?.projectStartDate || now,
    endDate: project.endDate || project.estimateData?.projectEndDate || project.estimateData?.endDate || now,
    progress: Number(project.progress ?? project.overallProgressPct ?? 0) || 0,
    overallProgressPct: Number(project.overallProgressPct ?? project.progress ?? 0) || 0,
    milestones: sanitizeTimelineItems(project.milestones || project.projectData?.milestones || []),
    client: project.client || project.projectData?.client || 'Client',
    clientEmail: project.clientEmail,
    clientPhone: project.clientPhone,
    createdAt: project.createdAt || now,
    updatedAt: project.updatedAt || now,
    completedAt: project.completedAt || project.projectData?.completedAt,
    projectType: project.projectType || project.projectData?.projectType || project.title || project.name,
    workspacePrivacy: {
      role: member?.role || 'field',
      restrictedFinancials: true,
      message:
        'Owner financials are hidden for this workspace role.',
    },
  };
}

function listWorkspaceProjectsForMember(workspace, member) {
  const { memberCanAccessProject } = require('./workspacePermissions');
  const projects = listWorkspaceOwnerProjects(workspace);
  return projects
    .filter((project) => memberCanAccessProject(member, project.id))
    .map((project) => sanitizeProjectForWorkspaceMember(project, member));
}

module.exports = {
  acceptWorkspaceInvitesForUser,
  addWorkspaceMember,
  countBillableSeats,
  ensureOwnerWorkspace,
  findInvitedWorkspaceForUser,
  findWorkspaceForUser,
  getSharedProjectResources,
  listWorkspaceMembers,
  listWorkspaceOwnerProjects,
  listWorkspaceProjectsForMember,
  removeWorkspaceMember,
  resendWorkspaceInvite,
  updateWorkspaceMember,
  upsertSharedProjectResource,
};
