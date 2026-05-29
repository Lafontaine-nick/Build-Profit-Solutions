// Expo/React Native screen: iOS-grade Team tab (same theme, better hierarchy)

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  Modal,
  ScrollView,
  Platform,
  SafeAreaView,
  StatusBar,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import {
  BRAND_FRAME_GRADIENT_COLORS,
  BRAND_FRAME_GRADIENT_END,
  BRAND_FRAME_GRADIENT_START,
} from "@/constants/brandFrameGradient";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { KEYBOARD_SCROLL_DEFAULTS } from "@/constants/keyboardScrollProps";
import { useProjectData } from "@/contexts/ProjectDataContext";
import { useRouter } from "expo-router";
import BusinessTeamLock from "@/components/BusinessTeamLock";
import GradientRingBackInner from "@/components/GradientRingBackInner";
import { useUser, useAuth } from "@clerk/clerk-react";
import {
  businessWorkspaceService,
  type BusinessWorkspaceAccess,
  type BusinessWorkspaceMember,
} from "@/services/businessWorkspaceService";
import { readWorkspaceAccessSnapshot, persistWorkspaceAccessSnapshot } from "@/utils/workspaceAccessCache";
import { useBusinessEntitlement } from "@/hooks/useBusinessEntitlement";
import { useProjectList } from "@/contexts/ProjectListContext";
import { syncClerkTokenToAsyncStorage } from "@/utils/authTokenHelper";
import { setBusinessEntitlementSnapshot } from "@/utils/businessEntitlementCache";
import { clearWorkspaceAccessSnapshot } from "@/utils/workspaceAccessCache";
import {
  fetchWorkspaceBootstrap,
  invalidateWorkspaceBootstrapCache,
} from "@/utils/workspaceBootstrapCache";
import {
  normalizeWorkspaceRole,
  workspacePermissionSummary,
} from "@/utils/workspacePermissions";

const Colors = {
  bg: "#020617",
  card: "#020617",
  text: "#F9FAFB",
  sub: "#8DA0B8",
  green: "#22c55e",
  yellow: "#ffd166",
  red: "#ef4444",
  gray: "#9CA3AF",
  line: "rgba(148, 163, 184, 0.1)",
};

const CARD_GRADIENT = [
  "rgba(34, 197, 94, 0.15)",
  "rgba(34, 211, 238, 0.08)",
  "rgba(34, 197, 94, 0)",
];
const CARD_BORDER = "rgba(34, 197, 94, 0.3)";

// ---------- Types ----------
type Status = "active" | "off_duty";
type InviteStatus = "pending" | "active" | "suspended";
type AccessRole = "owner" | "manager" | "foreman" | "field" | "view_only";
type ProjectAccess = "all_active" | "assigned";
type JobTitle = "Project Manager" | "Foreman" | "Crew Member";

const JOB_TITLE_OPTIONS: JobTitle[] = [
  "Project Manager",
  "Foreman",
  "Crew Member",
];

const TRADE_SKILL_TAGS = [
  "Demo",
  "Framing",
  "Finish Carpentry",
  "Drywall",
  "Paint",
  "Tile",
  "Flooring",
  "Concrete",
  "Roofing",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Landscaping",
  "Cleanup",
  "Other",
];

interface Member {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  userId?: string;
  role: JobTitle;
  status: Status;
  inviteStatus?: InviteStatus;
  accessRole?: AccessRole;
  projectAccess?: ProjectAccess;
  assignedProjectIds?: string[];
  isWorkspaceMember?: boolean;
  tasksOpen: number;
  tasksTotal: number;
  skills: string[];
  licenseNumber?: string;
  licenseVerified?: boolean;
  licenseExpiryISO?: string;
  avatarUrl?: string;
}

// ---------- Demo Data ----------
const TEAM: Member[] = [
  {
    id: "1",
    name: "John Smith",
    phone: "(555) 123-4567",
    email: "john@bps.app",
    role: "Project Manager",
    status: "active",
    tasksOpen: 2,
    tasksTotal: 14,
    skills: [],
    licenseVerified: true,
    licenseExpiryISO: "2026-01-01",
  },
  {
    id: "2",
    name: "Mike Johnson",
    phone: "(555) 234-5678",
    email: "mike@bps.app",
    role: "Foreman",
    status: "active",
    tasksOpen: 4,
    tasksTotal: 21,
    skills: ["Demo", "Framing"],
    licenseVerified: true,
    licenseExpiryISO: "2025-11-30",
  },
  {
    id: "3",
    name: "Sarah Wilson",
    phone: "(555) 345-6789",
    email: "sarah@bps.app",
    role: "Crew Member",
    status: "active",
    tasksOpen: 3,
    tasksTotal: 9,
    skills: ["Electrical"],
    licenseVerified: true,
    licenseExpiryISO: "2025-10-20",
  },
  {
    id: "4",
    name: "Tom Brown",
    phone: "(555) 456-7890",
    email: "tom@bps.app",
    role: "Crew Member",
    status: "off_duty",
    tasksOpen: 0,
    tasksTotal: 3,
    skills: ["Plumbing"],
    licenseVerified: false,
  },
  {
    id: "5",
    name: "Lisa Garcia",
    phone: "(555) 567-8901",
    email: "lisa@bps.app",
    role: "Crew Member",
    status: "active",
    tasksOpen: 5,
    tasksTotal: 12,
    skills: ["Framing", "Finish Carpentry"],
    licenseVerified: true,
    licenseExpiryISO: "2026-03-15",
  },
];

const TEAM_STORAGE_KEY = "bps.team.members";

function isDemoTeamRoster(members: unknown): boolean {
  if (!Array.isArray(members) || members.length === 0) return false;
  return members.some((row) => {
    const m = row as Member;
    const email = String(m?.email || "").toLowerCase();
    return email.endsWith("@bps.app") || (m?.id === "1" && m?.name === "John Smith");
  });
}

function getTeamStorageKey(workspaceId?: string | null): string {
  const id = String(workspaceId || "").trim();
  return id ? `${TEAM_STORAGE_KEY}.${id}` : TEAM_STORAGE_KEY;
}
const statusLabel: Record<Status, string> = {
  active: "Active",
  off_duty: "Off Duty",
};

const inviteStatusLabel: Record<InviteStatus, string> = {
  pending: "Pending invite",
  active: "Active member",
  suspended: "Suspended",
};

const accessRoleLabel: Record<AccessRole, string> = {
  owner: "Owner",
  manager: "Project Manager",
  foreman: "Foreman",
  field: "Crew Member",
  view_only: "Crew Member",
};

/** Roles shown in invite/edit UI (view_only kept internal for legacy records). */
const INVITE_ACCESS_ROLES: AccessRole[] = ["manager", "foreman", "field"];

const normalizeInviteAccessRole = (role: AccessRole | undefined): AccessRole => {
  if (!role || role === "view_only") return "field";
  return role;
};

function statusColor(s: Status) {
  switch (s) {
    case "active":
      return Colors.green;
    case "off_duty":
      return Colors.gray;
  }
}

function daysUntil(dateISO?: string) {
  if (!dateISO) return undefined;
  const d = new Date(dateISO).getTime();
  const now = new Date().getTime();
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}

function callNumber(n?: string) {
  if (!n) return;
  Linking.openURL(`tel:${n.replace(/\D/g, "")}`);
}
function smsNumber(n?: string) {
  if (!n) return;
  Linking.openURL(`sms:${n.replace(/\D/g, "")}`);
}
function emailTo(addr?: string) {
  if (!addr) return;
  Linking.openURL(`mailto:${addr}`);
}

function buildWorkspaceInviteMessage(member: Pick<Member, "name" | "email">) {
  const email = member.email?.trim() || "the email this invite was sent to";
  return [
    `You're invited to join our Build Profit workspace${member.name ? `, ${member.name}` : ""}.`,
    "",
    `Open Build Profit Solutions and sign up or sign in with ${email}.`,
    "Once you're signed in, open the project Team tab and your workspace access will activate automatically.",
  ].join("\n");
}

/** Ten digits max, formatted as XXX-XXX-XXXX */
function formatTeamPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isJobTitle(value: unknown): value is JobTitle {
  return JOB_TITLE_OPTIONS.includes(String(value) as JobTitle);
}

/** Map stored / legacy titles to the three supported job titles. */
function normalizeJobTitle(
  value: unknown,
  accessRole?: AccessRole | string | null
): JobTitle {
  const raw = String(value || "").trim();
  if (raw === "Project Manager") return "Project Manager";
  if (raw === "Foreman" || raw === "Field Lead") return "Foreman";
  if (isJobTitle(raw)) return raw;
  if (
    raw === "Crew Member" ||
    raw === "General Laborer" ||
    raw === "Office/Admin" ||
    raw === "Estimator" ||
    raw === "Bookkeeper" ||
    raw === "Subcontractor" ||
    raw === "Other"
  ) {
    return "Crew Member";
  }
  return defaultJobTitleForAccessRole(accessRole);
}

function defaultJobTitleForAccessRole(role: AccessRole | string | null | undefined): JobTitle {
  if (role === "owner" || role === "manager") return "Project Manager";
  if (role === "foreman") return "Foreman";
  return "Crew Member";
}

function legacyTradeToSkillTag(value: unknown): string | null {
  const raw = String(value || "").trim();
  const map: Record<string, string> = {
    Electrician: "Electrical",
    Plumber: "Plumbing",
    Carpenter: "Finish Carpentry",
    "Tile Setter": "Tile",
    Concrete: "Concrete",
    "Drywall Installer": "Drywall",
    Painter: "Paint",
    "General Labor": "Other",
  };
  return TRADE_SKILL_TAGS.includes(map[raw] || raw) ? map[raw] || raw : null;
}

function memberFromWorkspace(member: BusinessWorkspaceMember): Member {
  const projectStatus = member.projectStatus === "off_duty" ? "off_duty" : "active";
  const inviteStatus = (member.status as InviteStatus) || "active";
  const accessRole = normalizeWorkspaceRole(member.role) as AccessRole;
  const projectAccess = member.projectAccess === "assigned" ? "assigned" : "all_active";
  const rawJobTitle = member.jobTitle || member.tradeRole;
  const jobTitle = normalizeJobTitle(rawJobTitle, accessRole);
  const legacySkillTag = isJobTitle(rawJobTitle) ? null : legacyTradeToSkillTag(rawJobTitle);
  const skills = Array.isArray(member.skills) ? member.skills : [];

  return {
    id: member.id,
    name: member.displayName || member.email || "Team Member",
    phone: member.phone || undefined,
    email: member.email || undefined,
    userId: member.userId || undefined,
    role: jobTitle,
    status: projectStatus,
    inviteStatus,
    accessRole,
    projectAccess,
    assignedProjectIds: Array.isArray(member.assignedProjectIds)
      ? member.assignedProjectIds.map(String)
      : [],
    isWorkspaceMember: true,
    tasksOpen: 0,
    tasksTotal: 0,
    skills: legacySkillTag && !skills.includes(legacySkillTag) ? [...skills, legacySkillTag] : skills,
    licenseVerified: false,
  };
}

function teamRowsFromWorkspaceAccess(
  accessData: BusinessWorkspaceAccess | null | undefined
): Member[] {
  if (!accessData?.hasWorkspaceAccess) return [];
  const rows: Member[] = [];
  if (accessData.ownerMember) {
    rows.push(memberFromWorkspace(accessData.ownerMember));
  }
  if (accessData.member) {
    const self = memberFromWorkspace(accessData.member);
    if (!rows.some((row) => row.id === self.id)) {
      rows.push(self);
    }
  }
  return rows;
}

type ClerkUserLike = {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: { emailAddress?: string }[];
};

function clerkProfileName(clerkUser: ClerkUserLike | null | undefined): string | null {
  if (!clerkUser) return null;
  const first = String(clerkUser.firstName ?? "").trim();
  const last = String(clerkUser.lastName ?? "").trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  const full = String(clerkUser.fullName ?? "").trim();
  if (full) return full;
  const email =
    clerkUser.primaryEmailAddress?.emailAddress?.trim() ||
    clerkUser.emailAddresses?.[0]?.emailAddress?.trim() ||
    "";
  return email || null;
}

function memberMatchesClerkUser(
  member: Member,
  clerkUser: ClerkUserLike | null | undefined
): boolean {
  if (!clerkUser) return false;
  const clerkId = String(clerkUser.id || "").trim();
  const clerkEmail = (
    clerkUser.primaryEmailAddress?.emailAddress ||
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    ""
  )
    .trim()
    .toLowerCase();
  if (clerkId && member.userId && member.userId === clerkId) return true;
  if (clerkEmail && member.email?.trim().toLowerCase() === clerkEmail) return true;
  return false;
}

function applyClerkNameToMember(
  member: Member,
  clerkUser: ClerkUserLike | null | undefined
): Member {
  if (!memberMatchesClerkUser(member, clerkUser)) return member;
  const name = clerkProfileName(clerkUser);
  return name ? { ...member, name } : member;
}

async function readCachedTeamRoster(workspaceId: string | null): Promise<Member[] | null> {
  const scopedKey = getTeamStorageKey(workspaceId);
  const saved =
    (await AsyncStorage.getItem(scopedKey)) ||
    (scopedKey !== TEAM_STORAGE_KEY ? await AsyncStorage.getItem(TEAM_STORAGE_KEY) : null);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && !isDemoTeamRoster(parsed)) {
      return parsed as Member[];
    }
  } catch {
    /* ignore corrupt cache */
  }
  return null;
}

function countTeamSeatsUsed(members: Member[]): number {
  return members.filter(
    (member) =>
      member.accessRole !== "owner" &&
      member.inviteStatus !== "suspended"
  ).length;
}

function memberToWorkspacePayload(member: Member): Partial<BusinessWorkspaceMember> {
  return {
    displayName: member.name,
    email: member.email,
    phone: member.phone,
    jobTitle: member.role,
    // Backward-compatible alias for older backend/mobile versions.
    tradeRole: member.role,
    projectStatus: member.status,
    accessRole: member.accessRole,
    projectAccess: member.projectAccess || "all_active",
    assignedProjectIds: member.assignedProjectIds || [],
    inviteStatus: member.inviteStatus,
    skills: member.skills,
  };
}

// ---------- Tiny UI Bits ----------
const Chip = ({
  text,
  tone = "outline",
  compact = false,
}: {
  text: string;
  tone?: "outline" | "solid" | "warn";
  /** Secondary / role context — smaller, lighter */
  compact?: boolean;
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const subTint = darkMode ? 'rgba(226, 232, 240, 0.68)' : Colors.sub;

  return (
  <View
    style={[
      styles.chip,
      compact && styles.chipCompact,
        tone === "outline" && {
          backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : Colors.surface2,
          borderColor: darkMode ? 'rgba(148, 163, 184, 0.14)' : Colors.line,
          borderWidth: 1,
        },
      tone === "solid" && {
        backgroundColor: "rgba(34,197,94,0.18)",
        borderColor: "rgba(255, 255, 255, 0.15)",
      },
      tone === "warn" && {
        backgroundColor: "rgba(255,209,102,0.18)",
        borderColor: "rgba(255, 255, 255, 0.15)",
      },
    ]}
  >
    <Text
      style={[
        styles.chipText,
        compact && styles.chipTextCompact,
          tone === "outline" && { color: subTint },
        tone !== "outline" && { color: Colors.text, fontWeight: "800" },
      ]}
      numberOfLines={1}
    >
      {text}
    </Text>
  </View>
);
};

const StatusPill = ({ s }: { s: Status }) => {
  if (s === "active") {
    return (
      <LinearGradient
        colors={["#22c55e", "#22d3ee"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pillStatus}
      >
        <Text style={styles.pillText}>{statusLabel[s]}</Text>
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.pillStatus, styles.pillStatusMuted, { backgroundColor: statusColor(s) }]}>
      <Text style={styles.pillTextOffDuty}>{statusLabel[s]}</Text>
    </View>
  );
};

const InvitePill = ({ status }: { status: InviteStatus }) => {
  const tone =
    status === "pending"
      ? { bg: "rgba(255,209,102,0.18)", border: "rgba(255,209,102,0.45)", text: "#ffd166" }
      : status === "suspended"
        ? { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.35)", text: "#fca5a5" }
        : null;
  if (!tone) return null;
  return (
    <View style={[styles.pillStatus, { backgroundColor: tone.bg, borderColor: tone.border, borderWidth: 1 }]}>
      <Text style={[styles.pillTextOffDuty, { color: tone.text }]}>{inviteStatusLabel[status]}</Text>
    </View>
  );
};

const WorkspaceOwnerCard = ({
  owner,
  onEdit,
}: {
  owner: Member;
  onEdit: (m: Member) => void;
  supportSubColor?: string;
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === "#000000";
  const mutedSoft = darkMode ? "rgba(186, 204, 224, 0.82)" : Colors.sub;
  const footerBorderColor = "rgba(45, 255, 196, 0.2)";
  const ownerSubtitle = owner.email?.trim() || "Workspace owner";

  return (
    <View style={styles.workspaceOwnerSection}>
      <TouchableOpacity onPress={() => onEdit(owner)} activeOpacity={0.86}>
        <View style={styles.workspaceOwnerCard}>
          <View style={styles.workspaceOwnerHeaderRow}>
            <MaterialIcons name="check-circle" size={18} color="#22c55e" />
            <Text style={styles.workspaceOwnerHeaderTitle}>Business workspace connected</Text>
          </View>

          <View style={styles.workspaceOwnerBodyRow}>
            <View style={styles.workspaceOwnerBodyCopy}>
              <Text style={[styles.workspaceOwnerName, { color: Colors.text }]} numberOfLines={1}>
                {owner.name}
              </Text>
              <Text style={[styles.workspaceOwnerMeta, { color: mutedSoft }]} numberOfLines={1}>
                {ownerSubtitle}
              </Text>
            </View>
            <View style={styles.workspaceOwnerRightCol}>
              <Text style={[styles.workspaceOwnerRightLabel, { color: Colors.text }]}>Active</Text>
              <Text style={[styles.workspaceOwnerRightSub, { color: mutedSoft }]}>Included</Text>
            </View>
          </View>

          <View style={[styles.workspaceOwnerFooterRow, { borderTopColor: footerBorderColor }]}>
            <Text style={[styles.workspaceOwnerFooterLabel, { color: Colors.text }]}>Account type</Text>
            <View style={styles.workspaceOwnerFooterValueCol}>
              <Text style={styles.workspaceOwnerFooterValue}>Business</Text>
              <Text style={styles.workspaceOwnerFooterSub}>Full access</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const WorkspaceMemberAccessCard = ({
  ownerName,
  memberName,
  role,
  tradeRole,
  status,
}: {
  ownerName: string;
  memberName?: string;
  role: AccessRole | string | null;
  tradeRole?: string;
  status?: InviteStatus | string | null;
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === "#000000";
  const mutedSoft = darkMode ? "rgba(186, 204, 224, 0.82)" : Colors.sub;
  const roleKey = String(role || "field").toLowerCase() as AccessRole;
  const roleLabel = accessRoleLabel[roleKey] || "Team member";
  const tradeLabel = normalizeJobTitle(tradeRole, roleKey);
  const statusLabel =
    status === "active" || !status ? "Active" : String(status).replace(/_/g, " ");

  return (
    <View style={styles.workspaceOwnerSection}>
      <View style={styles.workspaceOwnerCard}>
        <View style={styles.workspaceOwnerHeaderRow}>
          <MaterialIcons name="verified-user" size={18} color="#22d3ee" />
          <Text style={styles.workspaceOwnerHeaderTitle}>You're on the team</Text>
        </View>

        <View style={styles.workspaceOwnerBodyRow}>
          <View style={styles.workspaceOwnerBodyCopy}>
            <Text style={[styles.workspaceOwnerMeta, { color: mutedSoft }]} numberOfLines={1}>
              Workspace owner
            </Text>
            <Text style={[styles.workspaceOwnerName, { color: Colors.text }]} numberOfLines={1}>
              {ownerName}
            </Text>
          </View>
          <View style={styles.workspaceOwnerRightCol}>
            <Text style={[styles.workspaceOwnerRightLabel, { color: Colors.text }]}>
              {statusLabel}
            </Text>
            <Text style={[styles.workspaceOwnerRightSub, { color: mutedSoft }]}>Included seat</Text>
          </View>
        </View>

        <View style={[styles.workspaceOwnerFooterRow, { borderTopColor: "rgba(45, 255, 196, 0.2)" }]}>
          <Text style={[styles.workspaceOwnerFooterLabel, { color: Colors.text }]}>Your role</Text>
          <View style={styles.workspaceOwnerFooterValueCol}>
            {memberName ? (
              <Text style={[styles.workspaceOwnerMeta, { color: mutedSoft, marginBottom: 4 }]} numberOfLines={1}>
                {memberName}
              </Text>
            ) : null}
            <Text style={styles.workspaceOwnerFooterValue}>{roleLabel}</Text>
            <Text style={styles.workspaceOwnerFooterSub}>{tradeLabel}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// ---------- Member Row (iOS denser) ----------
const MemberRowCompact = ({
  m,
  onEdit,
  onRequestRemove,
  onStatusToggle,
  canManageWorkspace,
  memberViewOnly = false,
  isCurrentUser = false,
  supportSubColor,
}: {
  m: Member;
  onEdit: (m: Member) => void;
  onRequestRemove?: (m: Member) => void;
  onStatusToggle?: (m: Member) => void;
  canManageWorkspace?: boolean;
  memberViewOnly?: boolean;
  isCurrentUser?: boolean;
  supportSubColor: string;
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';

  const handleStatusToggle = (e: any) => {
    e.stopPropagation();
    if (onStatusToggle) {
      onStatusToggle(m);
    }
  };

  const handleDeletePress = (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    if (!onRequestRemove || !canManageWorkspace || m.accessRole === "owner") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRequestRemove(m);
  };

  const subtitle = [m.role, m.phone].filter(Boolean).join(' • ');

  return (
    <View style={styles.memberRowWrapper}>
      <TouchableOpacity
        onPress={() => {
          if (!memberViewOnly) onEdit(m);
        }}
        activeOpacity={memberViewOnly ? 1 : 0.85}
        disabled={memberViewOnly}
      >
        <View style={[styles.memberRow, { backgroundColor: Colors.surface2, borderColor: Colors.line, borderWidth: 1, borderRadius: 16 }]}>
          <View style={styles.memberRowInner}>
            <View style={styles.initial}>
              <Text style={styles.initialText}>{initials(m.name)}</Text>
            </View>

            <View style={styles.memberMainCol}>
              <Text style={[styles.name, !darkMode && { color: Colors.text }]} numberOfLines={1}>
                {m.name}
              </Text>
              <Text
                style={[styles.memberSubtitle, { color: supportSubColor }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {subtitle || m.role}
              </Text>
              <TouchableOpacity
                onPress={memberViewOnly ? undefined : handleStatusToggle}
                activeOpacity={memberViewOnly ? 1 : 0.7}
                style={styles.statusRow}
                disabled={memberViewOnly}
              >
                {m.inviteStatus === "pending" || m.inviteStatus === "suspended" ? (
                  <InvitePill status={m.inviteStatus} />
                ) : (
                  <StatusPill s={m.status} />
                )}
              </TouchableOpacity>
              <View style={styles.memberMetaRow}>
                <Chip text={m.role} tone="outline" compact />
                {m.isWorkspaceMember && m.accessRole ? (
                  <Chip text={accessRoleLabel[m.accessRole]} tone="outline" compact />
                ) : null}
                {m.skills.slice(0, 3).map((skill) => (
                  <Chip key={skill} text={skill} tone="outline" compact />
                ))}
              </View>
              {m.isWorkspaceMember && m.accessRole ? (
                <Text style={[styles.memberPermissionSummary, { color: supportSubColor }]} numberOfLines={2}>
                  {workspacePermissionSummary(m.accessRole)}
                  {m.projectAccess === "assigned"
                    ? ` Assigned to ${m.assignedProjectIds?.length || 0} project${(m.assignedProjectIds?.length || 0) === 1 ? "" : "s"}.`
                    : " Assigned to all active projects."}
                </Text>
              ) : null}
            </View>

            <View style={styles.memberActionsCol}>
              {canManageWorkspace && m.accessRole !== "owner" && !isCurrentUser && onRequestRemove ? (
                <TouchableOpacity
                  onPress={handleDeletePress}
                  style={[styles.iconBtn, styles.iconBtnDanger]}
                  activeOpacity={0.8}
                  accessibilityLabel={`Remove ${m.name} from team`}
                >
                  <MaterialIcons name="delete-outline" size={16} color="rgba(248, 113, 113, 0.95)" />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={(e) => {
                  e?.stopPropagation?.();
                  callNumber(m.phone);
                }}
                style={styles.iconBtn}
                activeOpacity={0.8}
              >
                <MaterialIcons name="call" size={16} color="rgba(34, 197, 94, 0.85)" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={(e) => {
                  e?.stopPropagation?.();
                  smsNumber(m.phone);
                }}
                style={styles.iconBtn}
                activeOpacity={0.8}
              >
                <MaterialIcons name="chat-bubble" size={16} color="rgba(255, 255, 255, 0.65)" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={(e) => {
                  e?.stopPropagation?.();
                  emailTo(m.email);
                }}
                style={styles.iconBtn}
                activeOpacity={0.8}
              >
                <MaterialIcons name="mail" size={16} color="rgba(34, 211, 238, 0.85)" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

// ---------- Edit Member Modal ----------

type AssignableProjectRow = { id: string; title: string };

function ProjectAccessControls({
  availableProjects,
  projectAccess,
  onProjectAccessChange,
  selectedProjectIds,
  onToggleProject,
  supportSub,
  chipIdleBg,
  chipIdleBorder,
  textColor,
}: {
  availableProjects: AssignableProjectRow[];
  projectAccess: ProjectAccess;
  onProjectAccessChange: (value: ProjectAccess) => void;
  selectedProjectIds: string[];
  onToggleProject: (projectId: string) => void;
  supportSub: string;
  chipIdleBg: string;
  chipIdleBorder: string;
  textColor: string;
}) {
  return (
    <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
      <Text style={[styles.addMemberLabel, { color: textColor }]}>Assigned projects</Text>
      <Text style={[styles.addMemberHelperText, { color: supportSub }]}>
        Team members only receive projects allowed here. Owner financials stay hidden for every non-owner role.
      </Text>
      <View style={styles.addMemberChipWrap}>
        {projectAccess === "all_active" ? (
          <TouchableOpacity onPress={() => onProjectAccessChange("all_active")} activeOpacity={0.9}>
            <View style={styles.addMemberChipSelectedSolid}>
              <Text style={styles.addMemberChipTextOnGreen}>All active projects</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => onProjectAccessChange("all_active")}
            activeOpacity={0.85}
            style={[styles.addMemberChipIdle, { backgroundColor: chipIdleBg, borderColor: chipIdleBorder }]}
          >
            <Text style={[styles.addMemberChipTextIdle, { color: supportSub }]}>All active projects</Text>
          </TouchableOpacity>
        )}
        {availableProjects.length > 0 ? (
          <TouchableOpacity
            onPress={() => onProjectAccessChange("assigned")}
            activeOpacity={0.85}
            style={[
              projectAccess === "assigned"
                ? styles.addMemberChipSelectedSolid
                : styles.addMemberChipIdle,
              projectAccess !== "assigned" && { backgroundColor: chipIdleBg, borderColor: chipIdleBorder },
            ]}
          >
            <Text
              style={
                projectAccess === "assigned"
                  ? styles.addMemberChipTextOnGreen
                  : [styles.addMemberChipTextIdle, { color: supportSub }]
              }
            >
              Selected projects
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {projectAccess === "assigned" ? (
        <View style={[styles.addMemberChipWrap, { marginTop: 10 }]}>
          {availableProjects.map((project) => {
            const selected = selectedProjectIds.includes(project.id);
            return (
              <TouchableOpacity
                key={project.id}
                onPress={() => onToggleProject(project.id)}
                activeOpacity={0.85}
                style={[
                  selected ? styles.addMemberChipSelectedSolid : styles.addMemberChipIdle,
                  !selected && { backgroundColor: chipIdleBg, borderColor: chipIdleBorder },
                ]}
              >
                <Text
                  style={
                    selected
                      ? styles.addMemberChipTextOnGreen
                      : [styles.addMemberChipTextIdle, { color: supportSub }]
                  }
                >
                  {project.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const EditMemberModal = ({ member, onClose, onSave, onDelete, onResendInvite, canManageWorkspace, availableProjects }: {
  member: Member;
  onClose: () => void;
  onSave: (m: Member) => void;
  onDelete: (id: string) => void;
  onResendInvite?: (member: Member) => void;
  canManageWorkspace?: boolean;
  availableProjects: AssignableProjectRow[];
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const supportSub = darkMode ? 'rgba(226, 232, 240, 0.78)' : Colors.sub;
  const placeholderTint = darkMode ? 'rgba(226, 232, 240, 0.58)' : Colors.sub;
  const inputSurface = darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2;
  const inputBorder = darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line;
  const chipIdleBg = darkMode ? 'rgba(255, 255, 255, 0.04)' : Colors.surface2;
  const chipIdleBorder = darkMode ? 'rgba(148, 163, 184, 0.14)' : Colors.line;
  const headerRule = darkMode ? 'rgba(148, 163, 184, 0.1)' : Colors.line;
  const actionBarRule = darkMode ? 'rgba(148, 163, 184, 0.1)' : Colors.line;
  const isWeb = Platform.OS === "web";

  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(formatTeamPhoneInput(member.phone || ""));
  const [email, setEmail] = useState(member.email || "");
  const [role, setRole] = useState<JobTitle>(
    normalizeJobTitle(member.role, member.accessRole)
  );
  const [status, setStatus] = useState(member.status);
  const [accessRole, setAccessRole] = useState<AccessRole>(
    normalizeInviteAccessRole(member.accessRole || "field")
  );
  const [skillTags, setSkillTags] = useState<string[]>(member.skills || []);
  const [projectAccess, setProjectAccess] = useState<ProjectAccess>(
    member.projectAccess || "all_active"
  );
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    member.assignedProjectIds || []
  );

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId]
    );
  };

  const toggleSkillTag = (tag: string) => {
    setSkillTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const selectAccessRole = (nextRole: AccessRole) => {
    setAccessRole(nextRole);
    setRole(defaultJobTitleForAccessRole(nextRole));
  };

  const handleSave = () => {
    if (!name.trim()) {
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        typeof window.alert === "function"
      ) {
        window.alert("Error\n\nName is required");
      } else {
        Alert.alert("Error", "Name is required");
      }
      return;
    }
    const isEditableWorkspaceMember =
      member.isWorkspaceMember && member.accessRole !== "owner";
    if (
      isEditableWorkspaceMember &&
      projectAccess === "assigned" &&
      selectedProjectIds.length === 0
    ) {
      const msg = "Choose at least one project or switch to All active projects.";
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        typeof window.alert === "function"
      ) {
        window.alert(`Select projects\n\n${msg}`);
      } else {
        Alert.alert("Select projects", msg);
      }
      return;
    }
    onSave({
      ...member,
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      role,
      status,
      accessRole: member.accessRole === "owner" ? "owner" : normalizeInviteAccessRole(accessRole),
      skills: skillTags,
      projectAccess: isEditableWorkspaceMember ? projectAccess : member.projectAccess,
      assignedProjectIds:
        isEditableWorkspaceMember && projectAccess === "assigned"
          ? selectedProjectIds
          : member.assignedProjectIds || [],
    });
  };

  const confirmRemoveMember = () => {
    const msg = `Are you sure you want to remove ${member.name} from the team?`;
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.confirm === "function"
    ) {
      if (window.confirm(`Remove Team Member\n\n${msg}`)) {
        onDelete(member.id);
      }
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Remove Team Member", msg, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => onDelete(member.id),
      },
    ]);
  };

  const accessRoles: AccessRole[] =
    member.accessRole === "owner" ? ["owner"] : INVITE_ACCESS_ROLES;

  const inputStyle = [
    styles.addMemberInput,
    {
      backgroundColor: inputSurface,
      borderColor: inputBorder,
      color: Colors.text,
    },
  ];

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.addMemberSafe, { backgroundColor: Colors.bg }]}>
        {isWeb ? (
          <>
            <ScrollView
              style={[styles.addMemberScroll, { flex: 1, width: "100%" }]}
              contentContainerStyle={[
                styles.editMemberWebPageContent,
                { flexGrow: 0, paddingBottom: 12 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              {...KEYBOARD_SCROLL_DEFAULTS}
            >
            <View
              style={[
                styles.editMemberWebHeaderRow,
                {
                  borderBottomColor: headerRule,
                  paddingTop: 18,
                },
              ]}
            >
              <View style={styles.addMemberBackWrap}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.addMemberBackGradient}
                >
                  <GradientRingBackInner
                    darkMode={darkMode}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                    }}
                    style={[styles.addMemberBackBtn, { backgroundColor: Colors.bg }]}
                  >
                    <MaterialIcons name="arrow-back" size={22} color={darkMode ? "#FFFFFF" : Colors.text} />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>
              <View style={styles.addMemberTitleBlock}>
                <Text style={[styles.addMemberTitle, { color: Colors.text }]}>Edit Team Member</Text>
                <Text style={[styles.addMemberSubtitle, { color: supportSub }]} numberOfLines={2}>
                  {member.name}
                </Text>
              </View>
            </View>

            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={BRAND_FRAME_GRADIENT_START}
              end={BRAND_FRAME_GRADIENT_END}
              style={styles.editMemberWebFormCardGradient}
            >
              <View
                style={[
                  styles.editMemberWebFormCardInner,
                  {
                    backgroundColor: darkMode ? "#050807" : Colors.surface2,
                  },
                ]}
              >
              <View style={styles.addMemberField}>
                <Text style={[styles.addMemberLabel, { color: Colors.text }]}>
                  Name <Text style={styles.addMemberRequired}>*</Text>
                </Text>
                <TextInput
                  style={inputStyle}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full Name"
                  placeholderTextColor={placeholderTint}
                />
              </View>

              <View style={styles.addMemberField}>
                <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Phone</Text>
                <TextInput
                  style={inputStyle}
                  value={phone}
                  onChangeText={(text) => setPhone(formatTeamPhoneInput(text))}
                  placeholder="555-123-4567"
                  placeholderTextColor={placeholderTint}
                  keyboardType="phone-pad"
                  maxLength={12}
                />
              </View>

              <View style={styles.addMemberField}>
                <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Email</Text>
                <TextInput
                  style={inputStyle}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  placeholderTextColor={placeholderTint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
                <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Job title</Text>
                <View style={styles.addMemberChipWrap}>
                  {JOB_TITLE_OPTIONS.map((t) =>
                    role === t ? (
                      <TouchableOpacity
                        key={t}
                        onPress={() => {
                          setRole(t);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.9}
                      >
                        <View style={styles.addMemberChipSelectedSolid}>
                          <Text style={styles.addMemberChipTextOnGreen}>{t}</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        key={t}
                        onPress={() => {
                          setRole(t);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.85}
                        style={[
                          styles.addMemberChipIdle,
                          {
                            backgroundColor: chipIdleBg,
                            borderColor: chipIdleBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.addMemberChipTextIdle, { color: supportSub }]}>{t}</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>

              <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
                <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Trade / skill tags</Text>
                <Text style={[styles.addMemberHelperText, { color: supportSub }]}>
                  Optional tags for filtering and organization. These do not control financial permissions.
                </Text>
                <View style={styles.addMemberChipWrap}>
                  {TRADE_SKILL_TAGS.map((tag) => {
                    const selected = skillTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => toggleSkillTag(tag)}
                        activeOpacity={0.85}
                        style={[
                          selected ? styles.addMemberChipSelectedSolid : styles.addMemberChipIdle,
                          !selected && { backgroundColor: chipIdleBg, borderColor: chipIdleBorder },
                        ]}
                      >
                        <Text
                          style={
                            selected
                              ? styles.addMemberChipTextOnGreen
                              : [styles.addMemberChipTextIdle, { color: supportSub }]
                          }
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {member.isWorkspaceMember && member.accessRole !== "owner" ? (
                <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
                  <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Workspace access</Text>
                  <View style={styles.addMemberChipWrap}>
                    {accessRoles.map((r) =>
                      accessRole === r ? (
                        <TouchableOpacity key={r} onPress={() => selectAccessRole(r)} activeOpacity={0.9}>
                          <View style={styles.addMemberChipSelectedSolid}>
                            <Text style={styles.addMemberChipTextOnGreen}>{accessRoleLabel[r]}</Text>
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          key={r}
                          onPress={() => selectAccessRole(r)}
                          activeOpacity={0.85}
                          style={[styles.addMemberChipIdle, { backgroundColor: chipIdleBg, borderColor: chipIdleBorder }]}
                        >
                          <Text style={[styles.addMemberChipTextIdle, { color: supportSub }]}>{accessRoleLabel[r]}</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                  <Text style={[styles.addMemberHelperText, { color: supportSub }]}>
                    {workspacePermissionSummary(accessRole)}
                  </Text>
                </View>
              ) : null}

              {member.isWorkspaceMember && member.accessRole !== "owner" ? (
                <ProjectAccessControls
                  availableProjects={availableProjects}
                  projectAccess={projectAccess}
                  onProjectAccessChange={setProjectAccess}
                  selectedProjectIds={selectedProjectIds}
                  onToggleProject={toggleProject}
                  supportSub={supportSub}
                  chipIdleBg={chipIdleBg}
                  chipIdleBorder={chipIdleBorder}
                  textColor={Colors.text}
                />
              ) : null}

              {member.inviteStatus === "pending" && onResendInvite && canManageWorkspace ? (
                <TouchableOpacity
                  onPress={() => onResendInvite(member)}
                  style={[styles.addMemberField, { paddingVertical: 4 }]}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: "#22d3ee", fontWeight: "700" }}>Email workspace invite</Text>
                  <Text style={{ color: supportSub, marginTop: 4, fontSize: 13 }}>
                    Send or resend instructions for signing in with {member.email || "their invited email"}.
                  </Text>
                </TouchableOpacity>
              ) : null}

              {member.inviteStatus !== "pending" ? (
              <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
                <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Status</Text>
                <View style={styles.addMemberChipWrap}>
                  {(["active", "off_duty"] as Status[]).map((s) =>
                    status === s ? (
                      <TouchableOpacity
                        key={s}
                        onPress={() => {
                          setStatus(s);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.9}
                      >
                        {s === "active" ? (
                          <View style={styles.addMemberChipSelectedSolid}>
                            <Text style={styles.addMemberChipTextOnGreen}>{statusLabel[s]}</Text>
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.addMemberChipIdle,
                              {
                                backgroundColor: statusColor(s),
                                borderColor: statusColor(s),
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Text style={styles.editFormChipTextActive}>{statusLabel[s]}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        key={s}
                        onPress={() => {
                          setStatus(s);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.85}
                        style={[
                          styles.addMemberChipIdle,
                          {
                            backgroundColor: chipIdleBg,
                            borderColor: chipIdleBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.addMemberChipTextIdle, { color: supportSub }]}>{statusLabel[s]}</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>
              ) : null}

              <Text
                style={[
                  styles.editMemberStatusHelper,
                  { color: darkMode ? "rgba(255,255,255,0.48)" : Colors.sub },
                ]}
              >
                {member.inviteStatus === "pending"
                  ? "Pending invites become active when the member signs in with the invited email."
                  : "Active team members appear in project assignments and AI scheduling."}
              </Text>
              </View>
            </LinearGradient>
            </ScrollView>

            <View
              style={[
                styles.editMemberWebBottomActions,
                {
                  borderTopColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15, 23, 42, 0.12)",
                  backgroundColor: Colors.bg,
                  paddingBottom: 16,
                },
              ]}
            >
              {canManageWorkspace && member.accessRole !== "owner" ? (
              <TouchableOpacity
                onPress={confirmRemoveMember}
                style={[
                  styles.editMemberRemoveBtn,
                  {
                    backgroundColor: darkMode ? "rgba(239, 68, 68, 0.12)" : "rgba(239, 68, 68, 0.08)",
                    borderColor: darkMode ? "rgba(248, 113, 113, 0.45)" : "rgba(239, 68, 68, 0.35)",
                  },
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.editMemberRemoveText, { color: darkMode ? "#fca5a5" : "#dc2626" }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  Remove from Team
                </Text>
              </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={handleSave}
                style={[
                  styles.addMemberSaveBtn,
                  Platform.select({
                    ios: {
                      shadowColor: "#22c55e",
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.22,
                      shadowRadius: 10,
                    },
                    android: { elevation: 5 },
                  }),
                ]}
                activeOpacity={0.9}
              >
                <View style={[styles.addMemberSaveGradient, { backgroundColor: "#22c55e" }]}>
                  <Text style={styles.addMemberSaveText}>✓ Save Changes</Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        ) : (
        <View style={{ flex: 1, width: "100%" }}>
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />

        <View
          style={[
            styles.addMemberHeader,
            {
              borderBottomColor: headerRule,
              paddingTop: Platform.OS === "ios" ? 10 : 18,
            },
          ]}
        >
          <View style={styles.addMemberBackWrap}>
            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.addMemberBackGradient}
            >
              <GradientRingBackInner
                darkMode={darkMode}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={[styles.addMemberBackBtn, { backgroundColor: Colors.bg }]}
              >
                <MaterialIcons name="arrow-back" size={22} color={darkMode ? "#FFFFFF" : Colors.text} />
              </GradientRingBackInner>
            </LinearGradient>
          </View>
          <View style={styles.addMemberTitleBlock}>
            <Text style={[styles.addMemberTitle, { color: Colors.text }]}>Edit Team Member</Text>
            <Text style={[styles.addMemberSubtitle, { color: supportSub }]} numberOfLines={2}>
              {member.name}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.addMemberScroll}
          contentContainerStyle={[styles.addMemberScrollContent, { paddingBottom: 150 }]}
          showsVerticalScrollIndicator={false}
          {...KEYBOARD_SCROLL_DEFAULTS}
        >
          <View style={styles.addMemberForm}>
            <View style={styles.addMemberField}>
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>
                Name <Text style={styles.addMemberRequired}>*</Text>
              </Text>
              <TextInput
                style={inputStyle}
                value={name}
                onChangeText={setName}
                placeholder="Full Name"
                placeholderTextColor={placeholderTint}
              />
            </View>

            <View style={styles.addMemberField}>
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Phone</Text>
              <TextInput
                style={inputStyle}
                value={phone}
                onChangeText={(text) => setPhone(formatTeamPhoneInput(text))}
                placeholder="555-123-4567"
                placeholderTextColor={placeholderTint}
                keyboardType="phone-pad"
                maxLength={12}
              />
            </View>

            <View style={styles.addMemberField}>
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Email</Text>
              <TextInput
                style={inputStyle}
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor={placeholderTint}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Job title</Text>
              <View style={styles.addMemberChipWrap}>
                {JOB_TITLE_OPTIONS.map((t) =>
                  role === t ? (
                    <TouchableOpacity
                      key={t}
                      onPress={() => {
                        setRole(t);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      activeOpacity={0.9}
                    >
                      <View style={styles.addMemberChipSelectedSolid}>
                        <Text style={styles.addMemberChipTextOnGreen}>{t}</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      key={t}
                      onPress={() => {
                        setRole(t);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      activeOpacity={0.85}
                      style={[
                        styles.addMemberChipIdle,
                        {
                          backgroundColor: chipIdleBg,
                          borderColor: chipIdleBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.addMemberChipTextIdle, { color: supportSub }]}>{t}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>

            <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Trade / skill tags</Text>
              <Text style={[styles.addMemberHelperText, { color: supportSub }]}>
                Optional tags for filtering and organization. These do not control financial permissions.
              </Text>
              <View style={styles.addMemberChipWrap}>
                {TRADE_SKILL_TAGS.map((tag) => {
                  const selected = skillTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleSkillTag(tag)}
                      activeOpacity={0.85}
                      style={[
                        selected ? styles.addMemberChipSelectedSolid : styles.addMemberChipIdle,
                        !selected && { backgroundColor: chipIdleBg, borderColor: chipIdleBorder },
                      ]}
                    >
                      <Text
                        style={
                          selected
                            ? styles.addMemberChipTextOnGreen
                            : [styles.addMemberChipTextIdle, { color: supportSub }]
                        }
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {member.isWorkspaceMember && member.accessRole !== "owner" ? (
              <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
                <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Workspace access</Text>
                <View style={styles.addMemberChipWrap}>
                  {accessRoles.map((r) =>
                    accessRole === r ? (
                      <TouchableOpacity key={r} onPress={() => selectAccessRole(r)} activeOpacity={0.9}>
                        <View style={styles.addMemberChipSelectedSolid}>
                          <Text style={styles.addMemberChipTextOnGreen}>{accessRoleLabel[r]}</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        key={r}
                        onPress={() => selectAccessRole(r)}
                        activeOpacity={0.85}
                        style={[styles.addMemberChipIdle, { backgroundColor: chipIdleBg, borderColor: chipIdleBorder }]}
                      >
                        <Text style={[styles.addMemberChipTextIdle, { color: supportSub }]}>{accessRoleLabel[r]}</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
                <Text style={[styles.addMemberHelperText, { color: supportSub }]}>
                  {workspacePermissionSummary(accessRole)}
                </Text>
              </View>
            ) : null}

            {member.isWorkspaceMember && member.accessRole !== "owner" ? (
              <ProjectAccessControls
                availableProjects={availableProjects}
                projectAccess={projectAccess}
                onProjectAccessChange={setProjectAccess}
                selectedProjectIds={selectedProjectIds}
                onToggleProject={toggleProject}
                supportSub={supportSub}
                chipIdleBg={chipIdleBg}
                chipIdleBorder={chipIdleBorder}
                textColor={Colors.text}
              />
            ) : null}

            <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Status</Text>
              <View style={styles.addMemberChipWrap}>
                {(["active", "off_duty"] as Status[]).map((s) =>
                  status === s ? (
                    <TouchableOpacity
                      key={s}
                      onPress={() => {
                        setStatus(s);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      activeOpacity={0.9}
                    >
                      {s === "active" ? (
                        <View style={styles.addMemberChipSelectedSolid}>
                          <Text style={styles.addMemberChipTextOnGreen}>{statusLabel[s]}</Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.addMemberChipIdle,
                            {
                              backgroundColor: statusColor(s),
                              borderColor: statusColor(s),
                              alignItems: "center",
                              justifyContent: "center",
                            },
                          ]}
                        >
                          <Text style={styles.editFormChipTextActive}>{statusLabel[s]}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      key={s}
                      onPress={() => {
                        setStatus(s);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      activeOpacity={0.85}
                      style={[
                        styles.addMemberChipIdle,
                        {
                          backgroundColor: chipIdleBg,
                          borderColor: chipIdleBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.addMemberChipTextIdle, { color: supportSub }]}>{statusLabel[s]}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>

            <Text
              style={[
                styles.editMemberStatusHelper,
                { color: darkMode ? "rgba(255,255,255,0.48)" : Colors.sub },
              ]}
            >
              Active team members appear in project assignments and AI scheduling.
            </Text>
          </View>
        </ScrollView>

        <View
          style={[
            styles.addMemberActionBar,
            {
              borderTopColor: actionBarRule,
              backgroundColor: Colors.bg,
              paddingBottom: Platform.OS === "ios" ? 34 : 22,
            },
          ]}
        >
          {canManageWorkspace && member.accessRole !== "owner" ? (
          <TouchableOpacity
            onPress={confirmRemoveMember}
            style={[
              styles.editMemberRemoveBtn,
              {
                backgroundColor: darkMode ? "rgba(239, 68, 68, 0.12)" : "rgba(239, 68, 68, 0.08)",
                borderColor: darkMode ? "rgba(248, 113, 113, 0.45)" : "rgba(239, 68, 68, 0.35)",
              },
            ]}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.editMemberRemoveText, { color: darkMode ? "#fca5a5" : "#dc2626" }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Remove from Team
            </Text>
          </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={handleSave}
            style={[
              styles.addMemberSaveBtn,
              Platform.select({
                ios: {
                  shadowColor: "#22c55e",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.22,
                  shadowRadius: 10,
                },
                android: { elevation: 5 },
              }),
            ]}
            activeOpacity={0.9}
          >
            <View style={[styles.addMemberSaveGradient, { backgroundColor: "#22c55e" }]}>
              <Text style={styles.addMemberSaveText}>✓ Save Changes</Text>
            </View>
          </TouchableOpacity>
        </View>
        </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

// ---------- Add Member Modal ----------
const AddMemberModal = ({ onClose, onAdd, availableProjects }: {
  onClose: () => void;
  onAdd: (m: Member) => void;
  availableProjects: { id: string; title: string }[];
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const supportSub = darkMode ? 'rgba(226, 232, 240, 0.78)' : Colors.sub;
  const placeholderTint = darkMode ? 'rgba(226, 232, 240, 0.58)' : Colors.sub;
  const inputSurface = darkMode ? 'rgba(255, 255, 255, 0.05)' : Colors.surface2;
  const inputBorder = darkMode ? 'rgba(148, 163, 184, 0.16)' : Colors.line;
  const chipIdleBg = darkMode ? 'rgba(255, 255, 255, 0.04)' : Colors.surface2;
  const chipIdleBorder = darkMode ? 'rgba(148, 163, 184, 0.14)' : Colors.line;
  const headerRule = darkMode ? 'rgba(148, 163, 184, 0.1)' : Colors.line;
  const actionBarRule = darkMode ? 'rgba(148, 163, 184, 0.1)' : Colors.line;
  const isWeb = Platform.OS === "web";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<JobTitle>("Crew Member");
  const [status, setStatus] = useState<Status>("active");
  const [accessRole, setAccessRole] = useState<AccessRole>("field");
  const [projectAccess, setProjectAccess] = useState<ProjectAccess>(
    availableProjects.length > 0 ? "assigned" : "all_active"
  );
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [skillTags, setSkillTags] = useState<string[]>([]);

  const handleAdd = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Email required", "Enter an email to invite this person to your Business workspace.");
      return;
    }
    if (projectAccess === "assigned" && selectedProjectIds.length === 0) {
      Alert.alert("Select projects", "Choose at least one project or switch to All active projects.");
      return;
    }
    const newMember: Member = {
      id: `member-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim().toLowerCase(),
      role,
      status,
      inviteStatus: "pending",
      accessRole: normalizeInviteAccessRole(accessRole),
      projectAccess,
      assignedProjectIds: projectAccess === "assigned" ? selectedProjectIds : [],
      isWorkspaceMember: true,
      tasksOpen: 0,
      tasksTotal: 0,
      skills: skillTags,
      licenseVerified: false,
    };
    onAdd(newMember);
  };

  const accessRoles: AccessRole[] = INVITE_ACCESS_ROLES;

  const inputStyle = [
    styles.addMemberInput,
    {
      backgroundColor: inputSurface,
      borderColor: inputBorder,
      color: Colors.text,
    },
  ];

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const toggleSkillTag = (tag: string) => {
    setSkillTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const selectAccessRole = (nextRole: AccessRole) => {
    setAccessRole(nextRole);
    setRole(defaultJobTitleForAccessRole(nextRole));
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.addMemberSafe, { backgroundColor: Colors.bg }]}>
        {isWeb ? (
          <ScrollView
            style={styles.addMemberScroll}
            contentContainerStyle={styles.editMemberWebPageContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            {...KEYBOARD_SCROLL_DEFAULTS}
          >
            <View
              style={[
                styles.editMemberWebHeaderRow,
                {
                  borderBottomColor: headerRule,
                  paddingTop: 18,
                },
              ]}
            >
              <View style={styles.addMemberBackWrap}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.addMemberBackGradient}
                >
                  <GradientRingBackInner
                    darkMode={darkMode}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                    }}
                    style={[styles.addMemberBackBtn, { backgroundColor: Colors.bg }]}
                  >
                    <MaterialIcons name="arrow-back" size={22} color={darkMode ? "#FFFFFF" : Colors.text} />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>
              <View style={styles.addMemberTitleBlock}>
                <Text style={[styles.addMemberTitle, { color: Colors.text }]}>Invite Team Member</Text>
                <Text style={[styles.addMemberSubtitle, { color: supportSub }]}>
                  Send a workspace invite by email (uses one Business seat)
                </Text>
              </View>
            </View>

            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={BRAND_FRAME_GRADIENT_START}
              end={BRAND_FRAME_GRADIENT_END}
              style={styles.editMemberWebFormCardGradient}
            >
              <View
                style={[
                  styles.editMemberWebFormCardInner,
                  {
                    backgroundColor: darkMode ? "#050807" : Colors.surface2,
                  },
                ]}
              >
                <View style={styles.addMemberForm}>
                  <View style={styles.addMemberField}>
                    <Text style={[styles.addMemberLabel, { color: Colors.text }]}>
                      Name <Text style={styles.addMemberRequired}>*</Text>
                    </Text>
                    <TextInput
                      style={inputStyle}
                      value={name}
                      onChangeText={setName}
                      placeholder="Full Name"
                      placeholderTextColor={placeholderTint}
                      autoFocus
                    />
                  </View>

                  <View style={styles.addMemberField}>
                    <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Phone</Text>
                    <TextInput
                      style={inputStyle}
                      value={phone}
                      onChangeText={(text) => setPhone(formatTeamPhoneInput(text))}
                      placeholder="555-123-4567"
                      placeholderTextColor={placeholderTint}
                      keyboardType="phone-pad"
                      maxLength={12}
                    />
                  </View>

                  <View style={styles.addMemberField}>
                    <Text style={[styles.addMemberLabel, { color: Colors.text }]}>
                      Email <Text style={styles.addMemberRequired}>*</Text>
                    </Text>
                    <TextInput
                      style={inputStyle}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="email@example.com"
                      placeholderTextColor={placeholderTint}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
                    <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Job title</Text>
                    <View style={styles.addMemberChipWrap}>
                      {JOB_TITLE_OPTIONS.map((t) =>
                        role === t ? (
                          <TouchableOpacity
                            key={t}
                            onPress={() => {
                              setRole(t);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            activeOpacity={0.9}
                          >
                            <View style={styles.addMemberChipSelectedSolid}>
                              <Text style={styles.addMemberChipTextOnGreen}>{t}</Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            key={t}
                            onPress={() => {
                              setRole(t);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            activeOpacity={0.85}
                            style={[
                              styles.addMemberChipIdle,
                              {
                                backgroundColor: chipIdleBg,
                                borderColor: chipIdleBorder,
                              },
                            ]}
                          >
                            <Text style={[styles.addMemberChipTextIdle, { color: supportSub }]}>{t}</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>

                  <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
                    <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Trade / skill tags</Text>
                    <Text style={[styles.addMemberHelperText, { color: supportSub }]}>
                      Optional tags for filtering and organization. These do not control financial permissions.
                    </Text>
                    <View style={styles.addMemberChipWrap}>
                      {TRADE_SKILL_TAGS.map((tag) => {
                        const selected = skillTags.includes(tag);
                        return (
                          <TouchableOpacity
                            key={tag}
                            onPress={() => toggleSkillTag(tag)}
                            activeOpacity={0.85}
                            style={[
                              selected ? styles.addMemberChipSelectedSolid : styles.addMemberChipIdle,
                              !selected && { backgroundColor: chipIdleBg, borderColor: chipIdleBorder },
                            ]}
                          >
                            <Text
                              style={
                                selected
                                  ? styles.addMemberChipTextOnGreen
                                  : [styles.addMemberChipTextIdle, { color: supportSub }]
                              }
                            >
                              {tag}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
                    <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Workspace access</Text>
                    <Text style={[styles.addMemberHelperText, { color: supportSub }]}>
                      Access role controls permissions. Job title and skill tags are labels only.
                    </Text>
                    <View style={styles.addMemberChipWrap}>
                      {accessRoles.map((r) =>
                        accessRole === r ? (
                          <TouchableOpacity key={r} onPress={() => selectAccessRole(r)} activeOpacity={0.9}>
                            <View style={styles.addMemberChipSelectedSolid}>
                              <Text style={styles.addMemberChipTextOnGreen}>{accessRoleLabel[r]}</Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            key={r}
                            onPress={() => selectAccessRole(r)}
                            activeOpacity={0.85}
                            style={[styles.addMemberChipIdle, { backgroundColor: chipIdleBg, borderColor: chipIdleBorder }]}
                          >
                            <Text style={[styles.addMemberChipTextIdle, { color: supportSub }]}>{accessRoleLabel[r]}</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                    <Text style={[styles.addMemberHelperText, { color: supportSub }]}>
                      {workspacePermissionSummary(accessRole)}
                    </Text>
                  </View>
                  <ProjectAccessControls
                    availableProjects={availableProjects}
                    projectAccess={projectAccess}
                    onProjectAccessChange={setProjectAccess}
                    selectedProjectIds={selectedProjectIds}
                    onToggleProject={toggleProject}
                    supportSub={supportSub}
                    chipIdleBg={chipIdleBg}
                    chipIdleBorder={chipIdleBorder}
                    textColor={Colors.text}
                  />
                </View>
              </View>
            </LinearGradient>

            <View
              style={[
                styles.editMemberWebBottomActions,
                {
                  borderTopColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15, 23, 42, 0.12)",
                  backgroundColor: Colors.bg,
                  paddingBottom: 16,
                },
              ]}
            >
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.addMemberCancelBtn,
                  {
                    backgroundColor: darkMode ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.04)",
                    borderColor: darkMode ? "rgba(148, 163, 184, 0.28)" : Colors.line,
                  },
                ]}
                activeOpacity={0.85}
              >
                <Text style={[styles.addMemberCancelText, { color: supportSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleAdd();
                }}
                style={styles.addMemberSaveBtn}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addMemberSaveGradient}
                >
                  <Text style={styles.addMemberSaveText}>✓ Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
        <>
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
        <View
          style={[
            styles.addMemberHeader,
            {
              borderBottomColor: headerRule,
              paddingTop: Platform.OS === "ios" ? 10 : 18,
            },
          ]}
        >
          <View style={styles.addMemberBackWrap}>
            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.addMemberBackGradient}
            >
              <GradientRingBackInner
                darkMode={darkMode}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={[styles.addMemberBackBtn, { backgroundColor: Colors.bg }]}
              >
                <MaterialIcons name="arrow-back" size={22} color={darkMode ? "#FFFFFF" : Colors.text} />
              </GradientRingBackInner>
            </LinearGradient>
          </View>
          <View style={styles.addMemberTitleBlock}>
            <Text style={[styles.addMemberTitle, { color: Colors.text }]}>Invite Team Member</Text>
            <Text style={[styles.addMemberSubtitle, { color: supportSub }]}>
              Send a workspace invite by email (uses one Business seat)
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.addMemberScroll}
          contentContainerStyle={[styles.addMemberScrollContent, { paddingBottom: 150 }]}
          showsVerticalScrollIndicator={false}
          {...KEYBOARD_SCROLL_DEFAULTS}
        >
          <View style={styles.addMemberForm}>
            <View style={styles.addMemberField}>
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>
                Name <Text style={styles.addMemberRequired}>*</Text>
              </Text>
              <TextInput
                style={inputStyle}
                value={name}
                onChangeText={setName}
                placeholder="Full Name"
                placeholderTextColor={placeholderTint}
                autoFocus
              />
            </View>

            <View style={styles.addMemberField}>
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Phone</Text>
              <TextInput
                style={inputStyle}
                value={phone}
                onChangeText={(text) => setPhone(formatTeamPhoneInput(text))}
                placeholder="555-123-4567"
                placeholderTextColor={placeholderTint}
                keyboardType="phone-pad"
                maxLength={12}
              />
            </View>

            <View style={styles.addMemberField}>
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>
                Email <Text style={styles.addMemberRequired}>*</Text>
              </Text>
              <TextInput
                style={inputStyle}
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor={placeholderTint}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Job title</Text>
              <View style={styles.addMemberChipWrap}>
                {JOB_TITLE_OPTIONS.map((t) =>
                  role === t ? (
                    <TouchableOpacity
                      key={t}
                      onPress={() => {
                        setRole(t);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      activeOpacity={0.9}
                    >
                      <View style={styles.addMemberChipSelectedSolid}>
                        <Text style={styles.addMemberChipTextOnGreen}>{t}</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      key={t}
                      onPress={() => {
                        setRole(t);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      activeOpacity={0.85}
                      style={[
                        styles.addMemberChipIdle,
                        {
                          backgroundColor: chipIdleBg,
                          borderColor: chipIdleBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.addMemberChipTextIdle, { color: supportSub }]}>{t}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>

            <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Trade / skill tags</Text>
              <Text style={[styles.addMemberHelperText, { color: supportSub }]}>
                Optional tags for filtering and organization. These do not control financial permissions.
              </Text>
              <View style={styles.addMemberChipWrap}>
                {TRADE_SKILL_TAGS.map((tag) => {
                  const selected = skillTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleSkillTag(tag)}
                      activeOpacity={0.85}
                      style={[
                        selected ? styles.addMemberChipSelectedSolid : styles.addMemberChipIdle,
                        !selected && { backgroundColor: chipIdleBg, borderColor: chipIdleBorder },
                      ]}
                    >
                      <Text
                        style={
                          selected
                            ? styles.addMemberChipTextOnGreen
                            : [styles.addMemberChipTextIdle, { color: supportSub }]
                        }
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.addMemberField, styles.addMemberRoleBlock]}>
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Workspace access</Text>
              <Text style={[styles.addMemberHelperText, { color: supportSub }]}>
                Access role controls permissions. Job title and skill tags are labels only.
              </Text>
              <View style={styles.addMemberChipWrap}>
                {accessRoles.map((r) =>
                  accessRole === r ? (
                    <TouchableOpacity key={r} onPress={() => selectAccessRole(r)} activeOpacity={0.9}>
                      <View style={styles.addMemberChipSelectedSolid}>
                        <Text style={styles.addMemberChipTextOnGreen}>{accessRoleLabel[r]}</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      key={r}
                      onPress={() => selectAccessRole(r)}
                      activeOpacity={0.85}
                      style={[styles.addMemberChipIdle, { backgroundColor: chipIdleBg, borderColor: chipIdleBorder }]}
                    >
                      <Text style={[styles.addMemberChipTextIdle, { color: supportSub }]}>{accessRoleLabel[r]}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
              <Text style={[styles.addMemberHelperText, { color: supportSub }]}>
                {workspacePermissionSummary(accessRole)}
              </Text>
            </View>
            <ProjectAccessControls
              availableProjects={availableProjects}
              projectAccess={projectAccess}
              onProjectAccessChange={setProjectAccess}
              selectedProjectIds={selectedProjectIds}
              onToggleProject={toggleProject}
              supportSub={supportSub}
              chipIdleBg={chipIdleBg}
              chipIdleBorder={chipIdleBorder}
              textColor={Colors.text}
            />
          </View>
        </ScrollView>

        <View
          style={[
            styles.addMemberActionBar,
            {
              borderTopColor: actionBarRule,
              backgroundColor: Colors.bg,
              paddingBottom: Platform.OS === "ios" ? 34 : 22,
            },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.addMemberCancelBtn,
              {
                backgroundColor: darkMode ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.04)",
                borderColor: darkMode ? "rgba(148, 163, 184, 0.28)" : Colors.line,
              },
            ]}
            activeOpacity={0.85}
          >
            <Text style={[styles.addMemberCancelText, { color: supportSub }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleAdd();
            }}
            style={[
              styles.addMemberSaveBtn,
              Platform.select({
                ios: {
                  shadowColor: "#22c55e",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.22,
                  shadowRadius: 10,
                },
                android: { elevation: 5 },
              }),
            ]}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#22c55e", "#22d3ee"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addMemberSaveGradient}
            >
              <Text style={styles.addMemberSaveText}>✓ Save</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        </>
        )}
      </SafeAreaView>
    </Modal>
  );
};

// ---------- Notify Team Modal ----------
const NotifyTeamModal = ({ members, onClose }: {
  members: Member[];
  onClose: () => void;
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const isWeb = Platform.OS === "web";
  const headerRule = darkMode ? "rgba(148, 163, 184, 0.1)" : Colors.line;
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(members.map(m => m.id)));

  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map(m => m.id)));
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert("Error", "Please enter a message");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (selectedIds.size === 0) {
      Alert.alert("Error", "Please select at least one team member");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const selectedMembers = members.filter(m => selectedIds.has(m.id));
    let sentCount = 0;
    let failedCount = 0;
    const failedMembers: string[] = [];
    const successMembers: string[] = [];

    // Send notifications via SMS and Email
    // For multiple recipients, we'll open the first one immediately
    // and show instructions for the rest
    for (let i = 0; i < selectedMembers.length; i++) {
      const member = selectedMembers[i];
      let memberSent = false;
      
      // Try SMS first if phone is available
      if (member.phone) {
        try {
          const phoneNumber = member.phone.replace(/\D/g, "");
          if (phoneNumber.length > 0) {
            const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
          const canOpen = await Linking.canOpenURL(smsUrl);
          if (canOpen) {
              // Add a small delay for multiple recipients to avoid opening too many apps at once
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            await Linking.openURL(smsUrl);
            memberSent = true;
            sentCount++;
              successMembers.push(`${member.name} (SMS)`);
            }
          }
        } catch (error) {
          console.error(`Failed to send SMS to ${member.name}:`, error);
        }
      }
      
      // Try Email if SMS didn't work or phone not available
      if (!memberSent && member.email) {
        try {
          const emailUrl = `mailto:${member.email}?subject=Team Notification&body=${encodeURIComponent(message)}`;
          const canOpen = await Linking.canOpenURL(emailUrl);
          if (canOpen) {
            // Add a small delay for multiple recipients
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            await Linking.openURL(emailUrl);
            memberSent = true;
            sentCount++;
            successMembers.push(`${member.name} (Email)`);
          }
        } catch (error) {
          console.error(`Failed to send email to ${member.name}:`, error);
        }
      }
      
      if (!memberSent) {
        failedCount++;
        failedMembers.push(member.name);
      }
    }

    // Provide feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (failedCount === 0) {
      Alert.alert(
        "Notifications Sent!",
        `Opened messaging app for ${sentCount} team member${sentCount !== 1 ? 's' : ''}:\n${successMembers.map(m => `• ${m}`).join('\n')}\n\nPlease complete sending in your messaging app.${selectedMembers.length > 1 ? '\n\nNote: You may need to send to each recipient separately if multiple apps opened.' : ''}`,
        [{ text: "OK", onPress: onClose }]
      );
    } else if (sentCount > 0) {
      Alert.alert(
        "Partially Sent",
        `Opened messaging app for ${sentCount} team member${sentCount !== 1 ? 's' : ''}:\n${successMembers.map(m => `• ${m}`).join('\n')}\n\nCould not send to:\n${failedMembers.map(m => `• ${m}`).join('\n')}\n\nPlease check their contact information.`,
        [{ text: "OK", onPress: onClose }]
      );
    } else {
      Alert.alert(
        "Unable to Send",
        `Could not send notifications. Please check that team members have valid phone numbers or email addresses.\n\nFailed for:\n${failedMembers.map(m => `• ${m}`).join('\n')}`,
        [{ text: "OK" }]
      );
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        {isWeb ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.editMemberWebPageContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View
              style={[
                styles.editMemberWebHeaderRow,
                {
                  borderBottomColor: headerRule,
                  paddingTop: 18,
                },
              ]}
            >
              <View style={styles.addMemberBackWrap}>
                <LinearGradient
                  colors={BRAND_FRAME_GRADIENT_COLORS}
                  start={{ x: 0.05, y: 0.15 }}
                  end={{ x: 0.95, y: 0.85 }}
                  style={styles.addMemberBackGradient}
                >
                  <GradientRingBackInner
                    darkMode={darkMode}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                    }}
                    style={[styles.addMemberBackBtn, { backgroundColor: Colors.bg }]}
                  >
                    <MaterialIcons name="arrow-back" size={22} color={darkMode ? "#FFFFFF" : Colors.text} />
                  </GradientRingBackInner>
                </LinearGradient>
              </View>
              <View style={styles.addMemberTitleBlock}>
                <Text style={[styles.addMemberTitle, { color: Colors.text }]}>Notify Team</Text>
                <Text style={[styles.addMemberSubtitle, { color: Colors.sub }]}>Send message to team members</Text>
              </View>
            </View>

            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={BRAND_FRAME_GRADIENT_START}
              end={BRAND_FRAME_GRADIENT_END}
              style={styles.editMemberWebFormCardGradient}
            >
              <View
                style={[
                  styles.editMemberWebFormCardInner,
                  {
                    backgroundColor: darkMode ? "#050807" : Colors.surface2,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={[styles.addMemberLabel, { color: Colors.text }]}>
                    Select recipients ({selectedIds.size}/{members.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      toggleAll();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={{
                      backgroundColor: darkMode ? "rgba(255, 255, 255, 0.06)" : Colors.surface2,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: darkMode ? "rgba(148, 163, 184, 0.2)" : Colors.line,
                    }}
                  >
                    <Text style={{ color: Colors.sub, fontWeight: "600", fontSize: 13 }}>
                      {selectedIds.size === members.length ? "Deselect All" : "Select All"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View
                  style={{
                    backgroundColor: darkMode ? "rgba(255, 255, 255, 0.04)" : Colors.bg,
                    borderRadius: 12,
                    padding: 8,
                    marginBottom: 20,
                    maxHeight: 200,
                    borderWidth: 1,
                    borderColor: darkMode ? "rgba(148, 163, 184, 0.14)" : Colors.line,
                  }}
                >
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {members.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => {
                            toggleMember(item.id);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            padding: 12,
                            borderRadius: 12,
                            backgroundColor: isSelected ? "rgba(34, 197, 94, 0.15)" : "transparent",
                            marginBottom: 6,
                          }}
                        >
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              borderWidth: 2,
                              borderColor: isSelected ? "#22c55e" : Colors.line,
                              backgroundColor: isSelected ? "#22c55e" : "transparent",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 12,
                            }}
                          >
                            {isSelected ? (
                              <Text style={{ color: "#020617", fontSize: 16, fontWeight: "900" }}>✓</Text>
                            ) : null}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: Colors.text, fontSize: 15, fontWeight: isSelected ? "700" : "600" }}>{item.name}</Text>
                            <Text style={{ color: Colors.sub, fontSize: 12 }}>{item.role}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={{ marginBottom: 4 }}>
                  <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Message</Text>
                  <TextInput
                    style={{
                      marginTop: 8,
                      backgroundColor: darkMode ? "rgba(255, 255, 255, 0.05)" : Colors.bg,
                      borderColor: darkMode ? "rgba(148, 163, 184, 0.16)" : Colors.line,
                      borderWidth: 1,
                      borderRadius: 12,
                      color: Colors.text,
                      fontSize: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      minHeight: 120,
                      textAlignVertical: "top",
                    }}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Enter your message..."
                    placeholderTextColor={Colors.sub}
                    multiline
                  />
                </View>
              </View>
            </LinearGradient>

            <View
              style={[
                styles.editMemberWebBottomActions,
                {
                  borderTopColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15, 23, 42, 0.12)",
                  backgroundColor: Colors.bg,
                  paddingBottom: 16,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={[
                  styles.addMemberCancelBtn,
                  {
                    backgroundColor: darkMode ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.04)",
                    borderColor: darkMode ? "rgba(148, 163, 184, 0.28)" : Colors.line,
                  },
                ]}
                activeOpacity={0.85}
              >
                <Text style={[styles.addMemberCancelText, { color: Colors.sub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleSend();
                }}
                style={styles.addMemberSaveBtn}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addMemberSaveGradient}
                >
                  <Text style={styles.addMemberSaveText}>📢 Send ({selectedIds.size})</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
        <>
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
        {/* Header with Back Arrow */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 8 : 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.line }}>
          <View style={{ marginRight: 12 }}>
            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={{ borderRadius: 22, padding: 1, overflow: "hidden" }}
            >
              <GradientRingBackInner
                darkMode={darkMode}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 21,
                  backgroundColor: Colors.bg,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : Colors.text} />
              </GradientRingBackInner>
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.4, lineHeight: 34 }}>Notify Team</Text>
            <Text style={{ color: Colors.sub, fontSize: 14, marginTop: 2, fontWeight: "500" }}>Send message to team members</Text>
          </View>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View>
          
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: "600" }}>
                Select recipients ({selectedIds.size}/{members.length})
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  toggleAll();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }} 
                style={{ backgroundColor: Colors.surface2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: Colors.line }}
              >
                <Text style={{ color: Colors.sub, fontWeight: "600", fontSize: 13 }}>
                  {selectedIds.size === members.length ? "Deselect All" : "Select All"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: Colors.surface2, borderRadius: 12, padding: 8, marginBottom: 20, maxHeight: 200, borderWidth: 1, borderColor: Colors.line }}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {members.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => {
                        toggleMember(item.id);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: isSelected ? "rgba(34, 197, 94, 0.15)" : "transparent",
                        marginBottom: 6,
                      }}
                    >
                      <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: isSelected ? "#22c55e" : Colors.line,
                        backgroundColor: isSelected ? "#22c55e" : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}>
                        {isSelected && <Text style={{ color: "#020617", fontSize: 16, fontWeight: "900" }}>✓</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: Colors.text, fontSize: 15, fontWeight: isSelected ? "700" : "600" }}>
                          {item.name}
                        </Text>
                        <Text style={{ color: Colors.sub, fontSize: 12 }}>{item.role}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: "600", marginBottom: 10, letterSpacing: 0.2 }}>Message</Text>
              <TextInput
                style={{
                  backgroundColor: Colors.surface2,
                  borderColor: Colors.line,
                  borderWidth: 1,
                  borderRadius: 12,
                  color: Colors.text,
                  fontSize: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
                value={message}
                onChangeText={setMessage}
                placeholder="Enter your message..."
                placeholderTextColor={Colors.sub}
                multiline
              />
            </View>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 34 : 20, flexDirection: "row", gap: 10, borderTopWidth: 1, borderTopColor: Colors.line, backgroundColor: Colors.bg }}>
          <View style={{ flex: 1 }}>
            <LinearGradient
              colors={BRAND_FRAME_GRADIENT_COLORS}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={{ borderRadius: 12, padding: 1 }}
            >
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
                style={{ backgroundColor: darkMode ? "#000000" : "#FFFFFF", borderRadius: 11, paddingVertical: 14, alignItems: "center", justifyContent: "center" }}
          >
                <Text style={{ color: darkMode ? "#FFFFFF" : "#000000", fontSize: 15, fontWeight: "600" }}>Cancel</Text>
          </TouchableOpacity>
            </LinearGradient>
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleSend();
            }}
            style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}
          >
            <LinearGradient
              colors={["#22c55e", "#22d3ee"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingVertical: 14, alignItems: "center", justifyContent: "center", ...Platform.select({
              ios: {
                shadowColor: '#22c55e',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.25,
                shadowRadius: 12,
              },
              android: {
                  elevation: 4,
              },
            }) }}
          >
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 }}>📢 Send ({selectedIds.size})</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        </>
        )}
      </SafeAreaView>
    </Modal>
  );
};

// ---------- Screen ----------
export default function TeamTab({
  refreshTrigger = 0,
  embedded = false,
}: {
  refreshTrigger?: number;
  /** When true (project detail), align gradient frame with Budget — flush under AI PM row */
  embedded?: boolean;
}) {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const { projectData, updateTeam } = useProjectData();
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const {
    workspaceAccess,
    refresh: refreshWorkspaceEntitlement,
    initialized: entitlementInitialized,
    hasBusiness,
    currentPlanId,
    loading: entitlementLoading,
  } = useBusinessEntitlement();
  const { refreshProjects, activeProjects } = useProjectList();
  const ownerDisplayName =
    clerkUser?.fullName?.trim() ||
    clerkUser?.primaryEmailAddress?.emailAddress?.trim() ||
    undefined;
  const [team, setTeam] = useState<Member[]>([]);
  const [workspaceMemberIds, setWorkspaceMemberIds] = useState<Set<string>>(new Set());
  const [seatLimit, setSeatLimit] = useState(5);
  const [seatsUsed, setSeatsUsed] = useState(0);
  const [q, setQ] = useState("");
  const [tradeFilter, setTradeFilter] = useState<JobTitle | "All">("All");
  const [sortBy, setSortBy] = useState<"alpha" | "status">("status");
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [workspaceRosterLoaded, setWorkspaceRosterLoaded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [canManageWorkspace, setCanManageWorkspace] = useState(false);
  const [workspaceRole, setWorkspaceRole] = useState<AccessRole | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [cachedAccessSnapshot, setCachedAccessSnapshot] = useState<BusinessWorkspaceAccess | null>(
    null
  );

  const effectiveWorkspaceAccess = workspaceAccess || cachedAccessSnapshot;
  const assignableProjects = useMemo(
    () =>
      activeProjects.map((project) => ({
        id: String(project.id),
        title: project.title || project.name || "Untitled Project",
      })),
    [activeProjects]
  );

  const applyAccessContext = useCallback((access: BusinessWorkspaceAccess | null | undefined) => {
    if (!access) return;
    setCanManageWorkspace(Boolean(access.isOwner || access.role === "owner"));
    setWorkspaceRole((access.role as AccessRole) || null);
    if (access.workspaceId) {
      setActiveWorkspaceId(access.workspaceId);
    }
  }, []);

  const applyTeamRows = useCallback(
    async (rows: Member[], workspaceId: string | null, persist = true) => {
      if (!rows.length) return false;
      setWorkspaceMemberIds(new Set(rows.map((row) => row.id)));
      setTeam(rows);
      setWorkspaceRosterLoaded(true);
      if (persist) {
        await AsyncStorage.setItem(getTeamStorageKey(workspaceId), JSON.stringify(rows));
      }
      return true;
    },
    []
  );

  const pushTeamRosterToBusinessWorkspace = (members: Member[]) => {
    if (!projectData?.id) return;
    businessWorkspaceService
      .pushProjectResource(projectData.id, "team", members)
      .catch((error) => console.warn("Business workspace team sync failed:", error));
  };

  const loadWorkspaceRoster = async () => {
    try {
      const clerkEmail =
        clerkUser?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() || "";

      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          const token = await getToken();
          if (token) {
            await syncClerkTokenToAsyncStorage(token, clerkEmail || null);
            break;
          }
        } catch {
          /* retry */
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const bootstrap = await fetchWorkspaceBootstrap().catch(() => null);
      const access = bootstrap?.access
        ? { success: true as const, data: bootstrap.access }
        : await businessWorkspaceService.getWorkspaceAccess().catch(() => null);
      const workspaceId = access?.data?.workspaceId || null;
      if (workspaceId) {
        setActiveWorkspaceId(workspaceId);
      }
      const rosterStorageKey = getTeamStorageKey(workspaceId);

      if (access?.success && access.data) {
        setCanManageWorkspace(
          Boolean(access.data.isOwner || access.data.role === "owner")
        );
        setWorkspaceRole((access.data.role as AccessRole) || null);

        if (access.data.hasWorkspaceAccess) {
          const ownerWithoutBusiness = Boolean(access.data.isOwner) && !hasBusiness;
          if (ownerWithoutBusiness) {
            await clearWorkspaceAccessSnapshot();
            setCachedAccessSnapshot(null);
            setBusinessEntitlementSnapshot({
              hasBusiness: false,
              hasWorkspaceAccess: false,
            });
          } else {
            await persistWorkspaceAccessSnapshot(access.data);
            await AsyncStorage.setItem("bps.cachedWorkspaceAccess", "1");
            setCachedAccessSnapshot(access.data);
            setBusinessEntitlementSnapshot({
              hasBusiness: hasBusiness || Boolean(access.data.isOwner),
              hasWorkspaceAccess: true,
            });
          }
          try {
            const legacyRaw = await AsyncStorage.getItem(TEAM_STORAGE_KEY);
            if (legacyRaw) {
              const legacyParsed = JSON.parse(legacyRaw);
              if (isDemoTeamRoster(legacyParsed)) {
                await AsyncStorage.removeItem(TEAM_STORAGE_KEY);
              }
            }
          } catch {
            /* ignore */
          }
        }
      }

      if (access?.data?.isOwner) {
        await businessWorkspaceService.ensureWorkspace(ownerDisplayName);
        invalidateWorkspaceBootstrapCache();
        void refreshProjects();
      }

      if (bootstrap?.members && access?.data?.hasWorkspaceAccess) {
        let workspaceMembers = bootstrap.members;
        if (workspaceMembers.length === 0 && access?.data?.hasWorkspaceAccess) {
          const fallbackMembers = teamRowsFromWorkspaceAccess(access.data);
          if (await applyTeamRows(fallbackMembers, workspaceId)) {
            return true;
          }
        }

        const ownerInRoster = workspaceMembers.some(
          (member) =>
            member.role === "owner" &&
            String(member.email || "").trim().toLowerCase() === clerkEmail
        );
        if (ownerInRoster) {
          setCanManageWorkspace(true);
          setWorkspaceRole("owner");
        }
        setSeatLimit(bootstrap.seatLimit || 5);
        setSeatsUsed(
          typeof bootstrap.seatsUsed === "number"
            ? bootstrap.seatsUsed
            : countTeamSeatsUsed(workspaceMembers.map(memberFromWorkspace))
        );
        setWorkspaceMemberIds(new Set(workspaceMembers.map((member) => member.id)));
        setTeam(workspaceMembers.map(memberFromWorkspace));
        setWorkspaceRosterLoaded(true);
        await AsyncStorage.setItem(
          rosterStorageKey,
          JSON.stringify(workspaceMembers.map(memberFromWorkspace))
        );
        return true;
      }

      const roster = await businessWorkspaceService.getWorkspaceMembers();
      if (roster.success && roster.data) {
        let workspaceMembers = roster.data.members || [];
        if (workspaceMembers.length === 0 && access?.data?.hasWorkspaceAccess) {
          const fallbackMembers = teamRowsFromWorkspaceAccess(access.data);
          if (await applyTeamRows(fallbackMembers, workspaceId)) {
            return true;
          }
        }

        const ownerInRoster = workspaceMembers.some(
          (member) =>
            member.role === "owner" &&
            String(member.email || "").trim().toLowerCase() === clerkEmail
        );
        if (ownerInRoster) {
          setCanManageWorkspace(true);
          setWorkspaceRole("owner");
        }
        setSeatLimit(roster.data.seatLimit || 5);
        setSeatsUsed(
          typeof roster.data.seatsUsed === "number"
            ? roster.data.seatsUsed
            : countTeamSeatsUsed(workspaceMembers.map(memberFromWorkspace))
        );
        setWorkspaceMemberIds(new Set(workspaceMembers.map((member) => member.id)));
        setTeam(workspaceMembers.map(memberFromWorkspace));
        setWorkspaceRosterLoaded(true);
        await AsyncStorage.setItem(
          rosterStorageKey,
          JSON.stringify(workspaceMembers.map(memberFromWorkspace))
        );
        return true;
      }

      // Invited members: show owner + self even if full roster fetch fails.
      if (
        access?.success &&
        access.data?.hasWorkspaceAccess &&
        !access.data.isOwner
      ) {
        const rows = teamRowsFromWorkspaceAccess(access.data);
        if (await applyTeamRows(rows, workspaceId)) {
          return true;
        }
      }

      // Workspace access confirmed but roster unavailable — use access snapshot, not demo crew.
      if (access?.success && access.data?.hasWorkspaceAccess) {
        const rows = teamRowsFromWorkspaceAccess(access.data);
        if (await applyTeamRows(rows, workspaceId)) {
          return true;
        }
      }

      if (roster.error) {
        console.warn("Workspace roster unavailable:", roster.error);
      }
    } catch (error) {
      console.error("Failed to load workspace roster:", error);
    }
    return false;
  };

  // Load team from workspace first — never fall back to demo seed data on web.
  useEffect(() => {
    const loadTeam = async () => {
      try {
        if (entitlementInitialized && !workspaceAccess?.hasWorkspaceAccess) {
          await refreshWorkspaceEntitlement().catch(() => null);
        }

        const loadedFromWorkspace = await loadWorkspaceRoster();
        if (loadedFromWorkspace) return;

        const accessResponse = await businessWorkspaceService
          .getWorkspaceAccess()
          .catch(() => null);
        const snapshot =
          accessResponse?.data ??
          workspaceAccess ??
          cachedAccessSnapshot ??
          (await readWorkspaceAccessSnapshot());
        if (snapshot?.hasWorkspaceAccess) {
          setCachedAccessSnapshot(snapshot);
          applyAccessContext(snapshot);
        }

        const wsId = snapshot?.workspaceId || null;
        const cachedWorkspaceAccess = await AsyncStorage.getItem(
          "bps.cachedWorkspaceAccess"
        );
        if (cachedWorkspaceAccess === "1" || snapshot?.hasWorkspaceAccess) {
          const cachedRoster = await readCachedTeamRoster(wsId);
          if (cachedRoster && cachedRoster.length > 0) {
            await applyTeamRows(cachedRoster, wsId, false);
            return;
          }

          const fallbackRows = teamRowsFromWorkspaceAccess(snapshot);
          if (await applyTeamRows(fallbackRows, wsId)) {
            return;
          }
        }

        const cachedRoster = await readCachedTeamRoster(wsId);
        if (cachedRoster && cachedRoster.length > 0) {
          setTeam(cachedRoster);
          return;
        }

        const scopedKey = getTeamStorageKey(wsId);
        const saved =
          (await AsyncStorage.getItem(scopedKey)) ||
          (scopedKey !== TEAM_STORAGE_KEY
            ? await AsyncStorage.getItem(TEAM_STORAGE_KEY)
            : null);

        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && !isDemoTeamRoster(parsed)) {
              setTeam(parsed);
              return;
            }
          } catch {
            /* ignore corrupt cache */
          }
        }

        if (snapshot?.hasWorkspaceAccess) {
          await applyTeamRows(teamRowsFromWorkspaceAccess(snapshot), wsId, false);
          return;
        }

        setTeam([]);
      } catch (error) {
        console.error("Failed to load team:", error);
        setTeam([]);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTeam();
  }, [refreshTrigger, clerkUser?.id, entitlementInitialized, hasBusiness]);

  useEffect(() => {
    void readWorkspaceAccessSnapshot().then((snapshot) => {
      if (snapshot?.hasWorkspaceAccess) {
        setCachedAccessSnapshot(snapshot);
        applyAccessContext(snapshot);
      }
    });
  }, [applyAccessContext]);

  useEffect(() => {
    if (team.length > 0 || !effectiveWorkspaceAccess?.hasWorkspaceAccess) return;
    applyAccessContext(effectiveWorkspaceAccess);
    void applyTeamRows(
      teamRowsFromWorkspaceAccess(effectiveWorkspaceAccess),
      effectiveWorkspaceAccess.workspaceId,
      false
    );
  }, [
    team.length,
    effectiveWorkspaceAccess,
    applyAccessContext,
    applyTeamRows,
  ]);

  // Merge PM and crew from ProjectDataContext when not using workspace roster
  useEffect(() => {
    if (!projectData || !isLoaded || workspaceRosterLoaded) return;
    
    const pmName = projectData.team?.pmName;
    const crewMembers = (projectData.team as any)?.crewMembers || [];
    const crewSet = new Set(crewMembers.map((n: string) => n.trim().toLowerCase()));
    const pmNameLower = pmName?.trim().toLowerCase() || '';
    
    setTeam(prevTeam => {
      let updatedTeam = [...prevTeam];
      
      // Remove crew members no longer in crewMembers (e.g. promoted to PM) so we don't show duplicates
      updatedTeam = updatedTeam.filter(m => {
        if (m.id.startsWith('crew-')) {
          const nameLower = (m.name || '').trim().toLowerCase();
          if (pmNameLower && nameLower === pmNameLower) return false; // Now PM, remove crew entry
          if (!crewSet.has(nameLower)) return false; // No longer in crew
        }
        return true;
      });
      
      // Add/update PM if assigned — promote existing member to PM instead of creating a duplicate
      if (pmName) {
        const pmNameLower = pmName.trim().toLowerCase();
        const existingIndex = updatedTeam.findIndex(
          m => (m.name || '').trim().toLowerCase() === pmNameLower
        );
        if (existingIndex >= 0) {
          // Promote existing team member to PM (don't create a new one)
          const member = updatedTeam[existingIndex];
          const promoted: Member = {
            ...member,
            role: 'Project Manager',
          };
          updatedTeam.splice(existingIndex, 1);
          updatedTeam.unshift(promoted);
        } else {
          // No existing member with this name, add new PM
          const pmMember: Member = {
            id: `pm-${pmName}-${Date.now()}`,
            name: pmName,
            role: 'Project Manager',
            status: 'active',
            phone: '',
            email: '',
            tasksOpen: 0,
            tasksTotal: 0,
            licenseNumber: '',
            licenseExpiryISO: '',
            skills: [],
            licenseVerified: false,
          };
          updatedTeam.unshift(pmMember);
        }
      }
      
      // Add crew members that aren't already in the list (skip PM - they're shown above)
      // Also sync phone from crewMemberPhones for existing members (e.g. added via AI with phone)
      const crewMemberPhones = (projectData.team as any)?.crewMemberPhones || {};
      const getPhoneForCrew = (crewName: string) => {
        const key = crewName?.trim() || '';
        return crewMemberPhones[key]
          || crewMemberPhones[crewName]
          || Object.entries(crewMemberPhones).find(([k]) => (k || '').trim().toLowerCase() === (crewName || '').trim().toLowerCase())?.[1]
          || '';
      };
      crewMembers.forEach((crewName: string) => {
        if (pmName && crewName.trim().toLowerCase() === pmName.toLowerCase()) return; // PM already shown
        const crewIndex = updatedTeam.findIndex(m => (m.name || '').trim().toLowerCase() === (crewName || '').trim().toLowerCase() && m.role !== 'Project Manager');
        const phone = getPhoneForCrew(crewName);
        if (crewIndex >= 0 && phone) {
          // Update existing member's phone if we have it from crewMemberPhones
          updatedTeam[crewIndex] = { ...updatedTeam[crewIndex], phone };
        } else if (crewIndex < 0 && crewName.trim()) {
          const crewMember: Member = {
            id: `crew-${crewName}-${Date.now()}`,
            name: crewName,
            role: 'Crew Member',
            status: 'active',
            phone,
            email: '',
            tasksOpen: 0,
            tasksTotal: 0,
            licenseNumber: '',
            licenseExpiryISO: '',
            skills: [],
            licenseVerified: false,
          };
          updatedTeam.push(crewMember);
        }
      });
      
      return updatedTeam;
    });
  }, [projectData?.team?.pmName, (projectData?.team as any)?.crewMembers, (projectData?.team as any)?.crewMemberPhones, isLoaded, workspaceRosterLoaded]);

  // Save team whenever it changes
  useEffect(() => {
    if (!isLoaded) return;
    const saveTeam = async () => {
      try {
        await AsyncStorage.setItem(
          getTeamStorageKey(activeWorkspaceId),
          JSON.stringify(team)
        );
      } catch (error) {
        console.error("Failed to save team:", error);
      }
    };
    saveTeam();
  }, [team, isLoaded]);

  const handleStatusToggle = (member: Member) => {
    const newStatus: Status = member.status === "active" ? "off_duty" : "active";
    setTeam(team.map(m => m.id === member.id ? { ...m, status: newStatus } : m));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const effectiveTeam = useMemo(() => {
    const base =
      team.length > 0 ? team : teamRowsFromWorkspaceAccess(effectiveWorkspaceAccess);
    return base.map((member) => applyClerkNameToMember(member, clerkUser));
  }, [team, effectiveWorkspaceAccess, clerkUser]);

  const resolvedCanManageWorkspace = useMemo(() => {
    if (!hasBusiness && Boolean(effectiveWorkspaceAccess?.isOwner)) {
      return false;
    }
    if (effectiveWorkspaceAccess?.hasWorkspaceAccess) {
      return Boolean(
        effectiveWorkspaceAccess.isOwner || effectiveWorkspaceAccess.role === "owner"
      );
    }
    return canManageWorkspace;
  }, [canManageWorkspace, effectiveWorkspaceAccess, hasBusiness]);

  const ownerMember = useMemo(() => {
    const fromTeam = effectiveTeam.find((member) => member.accessRole === "owner");
    if (fromTeam) return fromTeam;
    if (effectiveWorkspaceAccess?.ownerMember) {
      return memberFromWorkspace(effectiveWorkspaceAccess.ownerMember);
    }
    return null;
  }, [effectiveTeam, effectiveWorkspaceAccess]);

  const isWorkspaceOwner = useMemo(
    () =>
      Boolean(
        effectiveWorkspaceAccess?.isOwner ||
          workspaceRole === "owner" ||
          ownerMember?.accessRole === "owner"
      ),
    [effectiveWorkspaceAccess?.isOwner, workspaceRole, ownerMember?.accessRole]
  );

  const showBusinessTeamLock =
    entitlementInitialized &&
    isWorkspaceOwner &&
    !hasBusiness &&
    !entitlementLoading;

  const selfMember = useMemo(() => {
    const email =
      clerkUser?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() || "";
    const clerkId = clerkUser?.id || "";
    const fromTeam = effectiveTeam.find((member) => memberMatchesClerkUser(member, clerkUser));
    if (fromTeam) return applyClerkNameToMember(fromTeam, clerkUser);
    if (
      effectiveWorkspaceAccess?.member &&
      !effectiveWorkspaceAccess.isOwner &&
      (effectiveWorkspaceAccess.member.userId === clerkId ||
        (email &&
          effectiveWorkspaceAccess.member.email?.trim().toLowerCase() === email))
    ) {
      return applyClerkNameToMember(
        memberFromWorkspace(effectiveWorkspaceAccess.member),
        clerkUser
      );
    }
    return null;
  }, [effectiveTeam, effectiveWorkspaceAccess, clerkUser]);

  const stats = useMemo(() => {
    const rosterMembers = effectiveTeam.filter((m) => m.accessRole !== "owner");
    const visibleMembers = resolvedCanManageWorkspace
      ? rosterMembers
      : rosterMembers.filter((m) => !selfMember || m.id !== selfMember.id);
    const active = visibleMembers.filter(
      (m) => m.status === "active" && m.inviteStatus !== "pending"
    ).length;
    const offDuty = visibleMembers.filter(
      (m) => m.status === "off_duty" && m.inviteStatus !== "pending"
    ).length;
    const pending = visibleMembers.filter((m) => m.inviteStatus === "pending").length;
    const usedSeats = countTeamSeatsUsed(effectiveTeam);
    return { active, offDuty, pending, total: visibleMembers.length, usedSeats };
  }, [effectiveTeam, resolvedCanManageWorkspace, selfMember]);

  const jobTitles: (JobTitle | "All")[] = ["All", ...JOB_TITLE_OPTIONS];

  const showInviteButton = resolvedCanManageWorkspace;

  const data = useMemo(() => {
    let arr = effectiveTeam.filter(
      (m) =>
        m.accessRole !== "owner" &&
        (!selfMember || resolvedCanManageWorkspace || m.id !== selfMember.id) &&
        (tradeFilter === "All" || m.role === tradeFilter) &&
        (q.trim() === "" ||
          `${m.name} ${m.role} ${m.skills.join(" ")}`
            .toLowerCase()
            .includes(q.toLowerCase()))
    );
    if (sortBy === "alpha") {
      arr = arr.sort((a, b) => {
        const firstNameA = a.name.split(" ")[0];
        const firstNameB = b.name.split(" ")[0];
        return firstNameA.localeCompare(firstNameB);
      });
    }
    if (sortBy === "status") {
      arr = arr.sort((a, b) => {
        const aPending = a.inviteStatus === "pending" ? 0 : 1;
        const bPending = b.inviteStatus === "pending" ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        const order: Status[] = ["active", "off_duty"];
        return order.indexOf(a.status) - order.indexOf(b.status);
      });
    }
    return arr;
  }, [q, tradeFilter, sortBy, effectiveTeam, resolvedCanManageWorkspace, selfMember]);

  const updateMember = async (updated: Member) => {
    if (workspaceMemberIds.has(updated.id)) {
      const result = await businessWorkspaceService.updateWorkspaceMember(
        updated.id,
        memberToWorkspacePayload(updated)
      );
      if (!result.success) {
        Alert.alert("Could not update member", result.error || "Try again.");
        return;
      }
      invalidateWorkspaceBootstrapCache();
      await loadWorkspaceRoster();
    }

    setTeam((prev) => {
      const next = prev.map((m) => (m.id === updated.id ? updated : m));
      pushTeamRosterToBusinessWorkspace(next);
      return next;
    });
    setEditingMember(null);
  };

  const addMember = async (newMember: Member) => {
    if (!newMember.email?.trim()) {
      Alert.alert("Email required", "Enter an email to invite this person to your workspace.");
      return;
    }

    const ensured = await businessWorkspaceService.ensureWorkspace(ownerDisplayName);
    if (!ensured.success) {
      Alert.alert(
        "Could not add member",
        ensured.error || "Sign in again and make sure the backend is running."
      );
      return;
    }

    const result = await businessWorkspaceService.addWorkspaceMember(
      memberToWorkspacePayload(newMember)
    );
    if (!result.success) {
      Alert.alert("Could not add member", result.error || "Try again.");
      return;
    }

    invalidateWorkspaceBootstrapCache();
    await loadWorkspaceRoster();

    setShowAddModal(false);
    const emailWasSent = result.emailDelivery?.sent;
    Alert.alert(
      emailWasSent ? "Invite emailed" : "Invite ready",
      emailWasSent
        ? `${newMember.name} was emailed a workspace invite. They become active when they sign in with ${newMember.email}.`
        : `${newMember.name} was added as pending. Share these sign-in instructions so they can activate workspace access.`,
      [
        { text: "Not now", style: "cancel" },
        {
          text: emailWasSent ? "Share backup" : "Share invite",
          onPress: () => {
            void shareWorkspaceInvite(newMember);
          },
        },
      ]
    );
  };

  const resendInvite = async (member: Member) => {
    const result = await businessWorkspaceService.resendWorkspaceInvite(member.id);
    if (!result.success) {
      Alert.alert("Could not resend invite", result.error || "Try again.");
      return;
    }
    if (result.emailDelivery?.sent) {
      Alert.alert(
        "Invite emailed",
        `${member.name} was emailed another workspace invite.`,
        [
          { text: "Done", style: "cancel" },
          {
            text: "Share backup",
            onPress: () => {
              void shareWorkspaceInvite(member);
            },
          },
        ]
      );
      return;
    }
    await shareWorkspaceInvite(member);
  };

  const removeMemberById = async (id: string) => {
    const member = team.find((m) => m.id === id);
    if (workspaceMemberIds.has(id)) {
      const result = await businessWorkspaceService.removeWorkspaceMember(id);
      if (!result.success) {
        const errMsg = result.error || "Try again.";
        if (
          Platform.OS === "web" &&
          typeof window !== "undefined" &&
          typeof window.alert === "function"
        ) {
          window.alert(`Could not remove member\n\n${errMsg}`);
        } else {
          Alert.alert("Could not remove member", errMsg);
        }
        return;
      }
      setWorkspaceMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      invalidateWorkspaceBootstrapCache();
      await loadWorkspaceRoster();
      setEditingMember(null);
      if (member && updateTeam) {
        const pmName = projectData?.team?.pmName;
        const crewMembers = (projectData?.team as any)?.crewMembers || [];
        const crewPhones = (projectData?.team as any)?.crewMemberPhones || {};
        const name = member.name?.trim() || "";
        const nameLower = name.toLowerCase();
        if (member.role === "Project Manager" && pmName && pmName.trim().toLowerCase() === nameLower) {
          const newCrew = (crewMembers as string[]).filter((n) => n.trim().toLowerCase() !== nameLower);
          updateTeam(false, "", newCrew.length, newCrew, crewPhones);
        } else if (id.startsWith("crew-") || (crewMembers as string[]).some((n) => n.trim().toLowerCase() === nameLower)) {
          const newCrew = (crewMembers as string[]).filter((n) => n.trim().toLowerCase() !== nameLower);
          const newPhones = { ...crewPhones };
          delete newPhones[name];
          Object.keys(newPhones).forEach((k) => {
            if (k.trim().toLowerCase() === nameLower) delete newPhones[k];
          });
          updateTeam(Boolean(pmName), pmName || "", newCrew.length, newCrew, newPhones);
        }
      }
      return;
    }

    setTeam((prev) => {
      const next = prev.filter((m) => m.id !== id);
      pushTeamRosterToBusinessWorkspace(next);
      return next;
    });
    setEditingMember(null);
    if (member && updateTeam) {
      const pmName = projectData?.team?.pmName;
      const crewMembers = (projectData?.team as any)?.crewMembers || [];
      const crewPhones = (projectData?.team as any)?.crewMemberPhones || {};
      const name = member.name?.trim() || "";
      const nameLower = name.toLowerCase();
      if (member.role === "Project Manager" && pmName && pmName.trim().toLowerCase() === nameLower) {
        const newCrew = (crewMembers as string[]).filter((n) => n.trim().toLowerCase() !== nameLower);
        updateTeam(false, "", newCrew.length, newCrew, crewPhones);
      } else if (id.startsWith("crew-") || (crewMembers as string[]).some((n) => n.trim().toLowerCase() === nameLower)) {
        const newCrew = (crewMembers as string[]).filter((n) => n.trim().toLowerCase() !== nameLower);
        const newPhones = { ...crewPhones };
        delete newPhones[name];
        Object.keys(newPhones).forEach((k) => {
          if (k.trim().toLowerCase() === nameLower) delete newPhones[k];
        });
        updateTeam(Boolean(pmName), pmName || "", newCrew.length, newCrew, newPhones);
      }
    }
  };

  const requestRemoveMember = (member: Member) => {
    if (!resolvedCanManageWorkspace || member.accessRole === "owner") return;

    const msg = `Are you sure you want to remove ${member.name} from the team?`;
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof window.confirm === "function"
    ) {
      if (window.confirm(`Remove Team Member\n\n${msg}`)) {
        void removeMemberById(member.id);
      }
      return;
    }

    Alert.alert("Remove Team Member", msg, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void removeMemberById(member.id);
        },
      },
    ]);
  };

  const supportSub = darkMode ? 'rgba(226, 232, 240, 0.78)' : Colors.sub;
  const supportMuted = darkMode ? 'rgba(226, 232, 240, 0.62)' : Colors.sub;

  const shareWorkspaceInvite = async (member: Member) => {
    const message = buildWorkspaceInviteMessage(member);
    try {
      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(message);
        Alert.alert("Invite copied", "Paste it into a text or email to send this workspace invite.");
        return;
      }
      await Share.share({
        title: "Build Profit workspace invite",
        message,
      });
    } catch (error) {
      try {
        await Clipboard.setStringAsync(message);
        Alert.alert("Invite copied", "Sharing was unavailable, so the invite text was copied.");
      } catch {
        Alert.alert("Could not share invite", "Try again, or ask them to sign in with the invited email.");
      }
    }
  };

  return (
    <View style={[styles.screen, embedded && styles.screenEmbedded, { backgroundColor: Colors.bg }]}>
      {showBusinessTeamLock ? (
        <View
          style={[
            styles.outerCard,
            styles.teamContainerWide,
            embedded && styles.teamContainerEmbedded,
            !darkMode && { backgroundColor: Colors.bg },
          ]}
        >
          <BusinessTeamLock
            loading={entitlementLoading}
            currentPlanId={currentPlanId}
            onUpgrade={() => router.push('/payment/plans')}
            onRefresh={() => {
              void refreshWorkspaceEntitlement();
            }}
          />
        </View>
      ) : (
      <View
        style={[
          styles.outerCard,
          styles.teamContainerWide,
          embedded && styles.teamContainerEmbedded,
          !darkMode && { backgroundColor: Colors.bg },
        ]}
      >
        {/* Outer green-to-blue border wrapping Team workspace controls */}
        <LinearGradient
          colors={BRAND_FRAME_GRADIENT_COLORS}
          start={{ x: 0.05, y: 0.15 }}
          end={{ x: 0.95, y: 0.85 }}
          style={styles.overviewBorder}
        >
          <View style={[styles.overviewInner, { backgroundColor: darkMode ? "#000000" : Colors.bg }]}>
            {/* Header */}
            <View style={styles.teamHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.teamHeaderTopRow}>
                  <Text style={[styles.teamHeaderTitle, { color: Colors.text }]}>Team</Text>
                  <View style={styles.headerQuickActions}>
                    {resolvedCanManageWorkspace ? (
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowNotifyModal(true);
                      }}
                      activeOpacity={0.85}
                      style={[
                        styles.headerIconBtn,
                        {
                          borderColor: darkMode ? 'rgba(34, 211, 238, 0.35)' : Colors.line,
                          borderWidth: 1,
                          backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : Colors.bg,
                        },
                      ]}
                    >
                      <MaterialIcons name="campaign" size={19} color="#22c55e" />
                    </TouchableOpacity>
                    ) : null}
                    {showInviteButton ? (
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowAddModal(true);
                      }}
                      activeOpacity={0.85}
                      style={[
                        styles.headerIconBtn,
                        {
                          borderColor: darkMode ? 'rgba(34, 211, 238, 0.35)' : Colors.line,
                          borderWidth: 1,
                          backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : Colors.bg,
                        },
                      ]}
                    >
                      <MaterialIcons name="person-add" size={19} color="#22c55e" />
                    </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                <Text style={[styles.teamHeaderSubtitle, { color: supportSub }]}>
                  {stats.active} active · {stats.offDuty} off duty
                  {stats.pending > 0 ? ` · ${stats.pending} pending` : ""} · {stats.total} total
                  {resolvedCanManageWorkspace && workspaceRole && workspaceRole !== "owner"
                    ? ` · ${accessRoleLabel[workspaceRole]} access`
                    : ""}
                </Text>
              </View>
            </View>

            {resolvedCanManageWorkspace ? (
            <View style={styles.workspaceSummaryRow}>
              <View style={[styles.workspaceSummaryPill, { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <MaterialIcons name="business-center" size={15} color="#22c55e" />
                <Text style={[styles.workspaceSummaryText, { color: Colors.text }]}>Business workspace</Text>
              </View>
              <View style={[styles.workspaceSummaryPill, { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <MaterialIcons name="verified-user" size={15} color="#22d3ee" />
                <Text style={[styles.workspaceSummaryText, { color: Colors.text }]}>Role access</Text>
              </View>
              <View style={[styles.workspaceSummaryPill, { backgroundColor: Colors.surface2, borderColor: Colors.line }]}>
                <MaterialIcons name="event-seat" size={15} color="#22c55e" />
                <Text style={[styles.workspaceSummaryText, { color: Colors.text }]}>
                  {stats.usedSeats}/{seatLimit} seats
                </Text>
              </View>
            </View>
            ) : null}

            {/* Search & Filters Section - iOS Refined */}
            <View style={styles.filterCardContainer}>
              <View style={[styles.filterCard, { backgroundColor: Colors.surface2, borderWidth: darkMode ? 1 : 1, borderColor: Colors.line, borderRadius: 14 }]}>
            {/* Search Bar - iOS Style */}
            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : Colors.surface2,
                  borderColor: darkMode ? 'rgba(148, 163, 184, 0.12)' : Colors.line,
                  borderWidth: 1,
                },
              ]}
            >
              <MaterialIcons name="search" size={18} color={supportMuted} style={styles.searchIcon} />
              <TextInput
                style={[styles.search, { color: Colors.text }]}
                placeholder="Search by name, role, or skill..."
                placeholderTextColor={supportMuted}
                value={q}
                onChangeText={setQ}
                clearButtonMode="while-editing"
              />
              {q.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setQ("");
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.searchClearBtn}
                >
                  <MaterialIcons name="close" size={16} color={supportMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Sort Pills */}
            <View style={styles.sortSection}>
              <Text style={[styles.sectionLabel, { color: supportSub }]}>Sort</Text>
              <View style={styles.sortPillsContainer}>
                {(["status","alpha"] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => {
                      setSortBy(s);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={styles.sortPillWrapper}
                  >
                    {sortBy === s ? (
                      <LinearGradient
                        colors={["#22c55e", "#22d3ee"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.sortPillActive}
                      >
                        <Text style={styles.sortPillTextActive}>
                          {s === "alpha" ? "A-Z" : "Status"}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.sortPill, { backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : Colors.surface2, borderColor: darkMode ? 'rgba(148,163,184,0.12)' : Colors.line, borderWidth: 1 }]}>
                        <Text style={[styles.sortPillText, { color: supportMuted }]}>
                          {s === "alpha" ? "A-Z" : "Status"}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Filter Section */}
            <View style={styles.filterSection}>
              <Text style={[styles.sectionLabel, { color: supportSub }]}>Filter</Text>
              <TouchableOpacity
                onPress={() => {
                  if (tradeFilter !== "All") {
                    setTradeFilter("All");
                  } else {
                    setShowFilterOptions((prev) => !prev);
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.filterChip,
                  tradeFilter === "All" && styles.filterChipActive,
                  tradeFilter !== "All" && { backgroundColor: Colors.surface2, borderColor: Colors.line, borderWidth: 1 }
                ]}
              >
                <Text style={[styles.filterChipText, tradeFilter === "All" && styles.filterChipTextActive, tradeFilter !== "All" && { color: supportMuted }]}>
                  {tradeFilter === "All" ? "All Job Titles" : tradeFilter}
                </Text>
                {tradeFilter !== "All" && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      setTradeFilter("All");
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={styles.filterChipClose}
                  >
                    <MaterialIcons name="close" size={14} color={supportMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            {/* Job title filter pills - collapsed until Filter is opened */}
            {tradeFilter === "All" && showFilterOptions && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScrollContainer}
                contentContainerStyle={styles.filterScrollContent}
              >
                {jobTitles.slice(1).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => {
                      setTradeFilter(t);
                      setShowFilterOptions(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: Colors.surface2,
                        borderColor: Colors.line,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[styles.filterPillText, { color: supportMuted }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
              </View>
            </View>
          </View>
          </LinearGradient>

        {/* Team List Section */}
        <View style={styles.teamListContainer}>
          <LinearGradient
            colors={BRAND_FRAME_GRADIENT_COLORS}
            start={{ x: 0.05, y: 0.15 }}
            end={{ x: 0.95, y: 0.85 }}
            style={styles.teamListBorder}
          >
            <View
              style={[
                styles.teamListInner,
                { backgroundColor: darkMode ? "#000000" : Colors.bg },
              ]}
            >
              <View style={styles.teamMembersListPad}>
                {!resolvedCanManageWorkspace && ownerMember ? (
                  <WorkspaceMemberAccessCard
                    ownerName={ownerMember.name}
                    memberName={selfMember?.name || clerkProfileName(clerkUser) || undefined}
                    role={
                      workspaceRole ||
                      selfMember?.accessRole ||
                      effectiveWorkspaceAccess?.role ||
                      "field"
                    }
                    tradeRole={
                      selfMember?.role ||
                      effectiveWorkspaceAccess?.member?.tradeRole ||
                      undefined
                    }
                    status={selfMember?.inviteStatus || effectiveWorkspaceAccess?.status || "active"}
                  />
                ) : ownerMember ? (
                  <WorkspaceOwnerCard
                    owner={ownerMember}
                    onEdit={setEditingMember}
                    supportSubColor={supportSub}
                  />
                ) : null}
              </View>
              <View style={[styles.sectionHeader, styles.teamMembersSectionHeader, !darkMode && { borderBottomColor: Colors.line }]}>
                <MaterialIcons name='groups' size={22} color='#22d3ee' />
                <Text style={[styles.sectionTitle, { marginLeft: 12, color: Colors.text }]}>
                  {resolvedCanManageWorkspace
                    ? ownerMember
                      ? "Invites & team"
                      : "Team Members"
                    : "Team roster"}
                </Text>
              </View>
              <View style={styles.teamMembersListPad}>
                {data.length > 0 ? (
                  data.map((item) => (
                    <MemberRowCompact
                      key={item.id}
                      m={item}
                      onEdit={setEditingMember}
                      onRequestRemove={requestRemoveMember}
                      canManageWorkspace={resolvedCanManageWorkspace}
                      memberViewOnly={!resolvedCanManageWorkspace}
                      isCurrentUser={Boolean(selfMember && item.id === selfMember.id)}
                      onStatusToggle={handleStatusToggle}
                      supportSubColor={supportSub}
                    />
                  ))
                ) : !resolvedCanManageWorkspace && ownerMember ? (
                  <View style={styles.emptyTeamWrap}>
                    <Text style={{ color: supportSub, fontSize: 15, fontWeight: '500', textAlign: 'center' }}>
                      You're the only team member on this workspace right now.
                    </Text>
                  </View>
                ) : resolvedCanManageWorkspace && ownerMember ? (
                  <View style={styles.emptyTeamWrap}>
                    <Text style={{ color: supportSub, fontSize: 15, fontWeight: '500', textAlign: 'center' }}>
                      No invited members yet. Tap + to send a workspace invite.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyTeamWrap}>
                    <Text style={{ color: supportSub, fontSize: 15, fontWeight: '500' }}>No team members found</Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
      )}


      {/* Modals */}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={updateMember}
          onDelete={(id) => {
            void removeMemberById(id);
          }}
          onResendInvite={resendInvite}
          canManageWorkspace={resolvedCanManageWorkspace}
          availableProjects={assignableProjects}
        />
      )}

      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onAdd={addMember}
          availableProjects={assignableProjects}
        />
      )}

      {showNotifyModal && (
        <NotifyTeamModal
          members={team}
          onClose={() => setShowNotifyModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
    paddingTop: 0,
    marginHorizontal: -20,
  },
  screenEmbedded: {
    marginHorizontal: 0,
  },
  outerCard: {
    backgroundColor: "#000000",
    borderRadius: 28,
    marginBottom: 16,
  },
  teamContainerWide: {
    marginHorizontal: 0, // Container already extends with -20, so 0 here extends to edges
    paddingHorizontal: 4, // Match dashboard wideContainer pattern
    paddingTop: 18,
    paddingBottom: 18,
  },
  teamContainerEmbedded: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 18,
  },
  overviewBorder: {
    borderRadius: 20,
    padding: 1,
    marginBottom: 16,
  },
  overviewInner: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  teamHeaderRow: {
    marginBottom: 4,
  },
  teamHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 12,
  },
  teamHeaderTitle: {
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: 0.15,
    color: "#F9FAFB",
    flex: 1,
    minWidth: 0,
  },
  headerQuickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  teamHeaderSubtitle: {
    fontSize: 14,
    marginTop: 2,
    lineHeight: 20,
    color: "#8DA0B8",
  },
  workspaceSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  workspaceSummaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  workspaceSummaryText: {
    fontSize: 12,
    fontWeight: "800",
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionCardContainer: {
    marginTop: 12,
  },
  sectionCardBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  sectionCard: {
    padding: 12,
    paddingBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.08)",
  },
  teamMembersSectionHeader: {
    marginBottom: 14,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.15,
  },

  // Stats — single grouped module
  statsUnified: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 4,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: 10,
  },
  statVal: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },

  // Filter Card - iOS Grade
  filterCardContainer: {
    marginTop: 12,
  },
  filterCardBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  filterCard: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },

  // Search - iOS Style
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000000",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    marginBottom: 14,
    paddingHorizontal: 12,
    minHeight: 44, // iOS minimum touch target
  },
  searchIcon: {
    marginRight: 8,
  },
  search: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  searchClearBtn: {
    padding: 4,
    marginLeft: 8,
  },

  // Sort Section - iOS Segmented Control
  sortSection: {
    marginTop: 4,
    marginBottom: 12,
  },
  sectionLabel: {
    color: Colors.sub,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sortPillsContainer: {
    flexDirection: "row",
    gap: 10,
  },
  sortPillWrapper: {
    borderRadius: 20,
    overflow: "hidden",
  },
  sortPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  sortPillActive: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sortPillText: {
    color: Colors.sub,
    fontSize: 13,
    fontWeight: "600",
  },
  sortPillTextActive: {
    color: "#0d1b2a",
    fontSize: 13,
    fontWeight: "700",
  },

  // Filter Section
  filterSection: {
    marginBottom: 10,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  filterChipActive: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
  filterChipText: {
    color: Colors.sub,
    fontSize: 13,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#0d1b2a",
    fontWeight: "700",
  },
  filterChipClose: {
    marginLeft: 6,
    padding: 2,
  },

  // Filter Pills
  filterScrollContainer: {
    marginTop: 6,
    marginBottom: 2,
  },
  filterScrollContent: {
    paddingRight: 16,
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    marginRight: 6,
  },
  filterPillActive: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
  filterPillText: {
    color: Colors.sub,
    fontSize: 12,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#0d1b2a",
    fontWeight: "700",
  },

  // Member row (compact)
  teamListContainer: {
    marginTop: 12,
  },
  teamListBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  teamListInner: {
    borderRadius: 19,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 8,
  },
  teamMembersListPad: {
    paddingBottom: 8,
  },
  emptyTeamWrap: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  workspaceOwnerSection: {
    marginBottom: 18,
  },
  workspaceOwnerCard: {
    borderRadius: 15,
    padding: 13,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(45, 255, 196, 0.32)",
    gap: 10,
  },
  workspaceOwnerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  workspaceOwnerHeaderTitle: {
    color: "#2DFFC4",
    fontSize: 14,
    fontWeight: "800",
  },
  workspaceOwnerBodyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    paddingBottom: 8,
  },
  workspaceOwnerBodyCopy: {
    flex: 1,
    minWidth: 0,
  },
  workspaceOwnerName: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  workspaceOwnerMeta: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  workspaceOwnerRightCol: {
    alignItems: "flex-end",
  },
  workspaceOwnerRightLabel: {
    fontSize: 13,
    fontWeight: "900",
  },
  workspaceOwnerRightSub: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  workspaceOwnerFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
  },
  workspaceOwnerFooterLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  workspaceOwnerFooterValueCol: {
    alignItems: "flex-end",
  },
  workspaceOwnerFooterValue: {
    color: "#2DFFC4",
    fontSize: 15,
    fontWeight: "900",
  },
  workspaceOwnerFooterSub: {
    color: "#22c55e",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  memberRowWrapper: {
    marginBottom: 12,
  },
  memberRowBorder: {
    borderRadius: 18,
    padding: 1,
    overflow: "hidden",
  },
  memberRow: {
    backgroundColor: "#000000",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    width: "100%",
    alignSelf: "stretch",
  },
  memberRowInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  memberMainCol: {
    flex: 1,
    minWidth: 0,
  },
  statusRow: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  memberSubtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
    fontWeight: "500",
  },
  initial: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  initialText: { color: "#020617", fontWeight: "900", fontSize: 16 },

  name: { color: Colors.text, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },

  memberMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  memberPermissionSummary: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 8,
    fontWeight: "600",
  },

  memberActionsCol: {
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
    minWidth: 36,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.12)",
  },
  iconBtnDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(248, 113, 113, 0.35)",
  },

  // Pills & Chips
  pillStatus: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  pillStatusMuted: {
    opacity: 0.95,
  },
  pillText: { fontSize: 11, fontWeight: "900", color: "#0d1b2a" },
  pillTextOffDuty: { fontSize: 11, fontWeight: "800", color: "#FFFFFF" },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "#000000",
    maxWidth: 160,
  },
  chipCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 148,
    borderRadius: 8,
  },
  chipText: { color: Colors.sub, fontSize: 11, fontWeight: "600" },
  chipTextCompact: { fontSize: 10, fontWeight: "600" },

  // Bottom Bar
  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: "row",
    gap: 10,
  },
  bulkBtn: {
    flex: 1,
    backgroundColor: Colors.yellow,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bulkBtnText: { color: "#0d1b2a", fontSize: 16, fontWeight: "800", textAlign: "center" },

  // Edit member modal: Off Duty selected chip label (layout shares addMember* styles)
  editFormChipTextActive: {
    color: "#0d1b2a",
    fontSize: 13,
    fontWeight: "800",
  },
  editMemberRemoveBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  editMemberRemoveText: {
    fontSize: 15,
    fontWeight: "600",
  },
  addMemberSafe: {
    flex: 1,
  },
  addMemberHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addMemberBackWrap: {
    marginRight: 16,
  },
  addMemberBackGradient: {
    borderRadius: 22,
    padding: 1,
    overflow: "hidden",
  },
  addMemberBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  addMemberTitleBlock: {
    flex: 1,
    paddingRight: 4,
    minWidth: 0,
  },
  addMemberTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.35,
    lineHeight: 32,
  },
  addMemberSubtitle: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
    fontWeight: "500",
  },
  addMemberScroll: {
    flex: 1,
  },
  addMemberScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 120,
  },
  addMemberForm: {
    paddingBottom: 8,
  },
  addMemberField: {
    marginBottom: 22,
  },
  addMemberRoleBlock: {
    marginBottom: 8,
  },
  addMemberLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  addMemberRequired: {
    color: "#22c55e",
    fontWeight: "700",
  },
  addMemberInput: {
    borderWidth: 1,
    borderRadius: 14,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addMemberChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
  },
  addMemberHelperText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    fontWeight: "500",
  },
  addMemberChipIdle: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  addMemberChipTextIdle: {
    fontSize: 13,
    fontWeight: "600",
  },
  /** Selected job title, skill tag, and active status — solid brand green. */
  addMemberChipSelectedSolid: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22c55e",
    borderWidth: 1,
    borderColor: "#16a34a",
  },
  addMemberChipTextOnGreen: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  addMemberActionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    flexDirection: "row",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addMemberCancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  addMemberCancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
  addMemberSaveBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  addMemberSaveGradient: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  addMemberSaveText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
  editMemberWebPageContent: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: 32,
    paddingTop: 36,
    paddingBottom: 32,
  },
  editMemberWebHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 0,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  /** Web: 1px neon frame via gradient (same tokens as materials / brand frame). */
  editMemberWebFormCardGradient: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    borderRadius: 24,
    padding: 1,
    overflow: "hidden",
  },
  editMemberWebFormCardInner: {
    width: "100%",
    borderRadius: 23,
    padding: 28,
  },
  editMemberWebBottomActions: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    flexDirection: "row",
    gap: 14,
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
  },
  editMemberStatusHelper: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
});
