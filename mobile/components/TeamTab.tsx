// Expo/React Native screen: iOS-grade Team tab (same theme, better hierarchy)

import React, { useMemo, useState, useEffect } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
import GradientRingBackInner from "@/components/GradientRingBackInner";

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
type Trade =
  | "Project Manager"
  | "Foreman"
  | "Electrician"
  | "Plumber"
  | "Carpenter"
  | "General Labor"
  | "Tile Setter"
  | "Concrete"
  | "Drywall Installer"
  | "Painter"
  | "General";

interface Member {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role: Trade;
  status: Status;
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
    skills: ["Scheduling", "Budget", "Client Comms"],
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
    skills: ["Crew Lead", "Safety"],
    licenseVerified: true,
    licenseExpiryISO: "2025-11-30",
  },
  {
    id: "3",
    name: "Sarah Wilson",
    phone: "(555) 345-6789",
    email: "sarah@bps.app",
    role: "Electrician",
    status: "active",
    tasksOpen: 3,
    tasksTotal: 9,
    skills: ["Panel", "Rough-in", "Troubleshoot"],
    licenseVerified: true,
    licenseExpiryISO: "2025-10-20",
  },
  {
    id: "4",
    name: "Tom Brown",
    phone: "(555) 456-7890",
    email: "tom@bps.app",
    role: "Plumber",
    status: "off_duty",
    tasksOpen: 0,
    tasksTotal: 3,
    skills: ["PEX", "Fixtures"],
    licenseVerified: false,
  },
  {
    id: "5",
    name: "Lisa Garcia",
    phone: "(555) 567-8901",
    email: "lisa@bps.app",
    role: "Carpenter",
    status: "active",
    tasksOpen: 5,
    tasksTotal: 12,
    skills: ["Framing", "Finish", "Custom"],
    licenseVerified: true,
    licenseExpiryISO: "2026-03-15",
  },
];

// ---------- Helpers ----------
const statusLabel: Record<Status, string> = {
  active: "Active",
  off_duty: "Off Duty",
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

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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

// ---------- Member Row (iOS denser) ----------
const MemberRowCompact = ({
  m,
  onEdit,
  onStatusToggle,
  supportSubColor,
}: {
  m: Member;
  onEdit: (m: Member) => void;
  onStatusToggle?: (m: Member) => void;
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

  const subtitle = [m.role, m.phone].filter(Boolean).join(' • ');

  return (
    <View style={styles.memberRowWrapper}>
      <TouchableOpacity
        onPress={() => onEdit(m)}
        activeOpacity={0.85}
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
              <TouchableOpacity onPress={handleStatusToggle} activeOpacity={0.7} style={styles.statusRow}>
                <StatusPill s={m.status} />
              </TouchableOpacity>
              <View style={styles.memberMetaRow}>
                <Chip text={m.role} tone="outline" compact />
              </View>
            </View>

            <View style={styles.memberActionsCol}>
              <TouchableOpacity
                onPress={() => callNumber(m.phone)}
                style={styles.iconBtn}
                activeOpacity={0.8}
              >
                <MaterialIcons name="call" size={16} color="rgba(34, 197, 94, 0.85)" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => smsNumber(m.phone)}
                style={styles.iconBtn}
                activeOpacity={0.8}
              >
                <MaterialIcons name="chat-bubble" size={16} color="rgba(255, 255, 255, 0.65)" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => emailTo(m.email)}
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
const EditMemberModal = ({ member, onClose, onSave, onDelete }: {
  member: Member;
  onClose: () => void;
  onSave: (m: Member) => void;
  onDelete: (id: string) => void;
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
  const [phone, setPhone] = useState(member.phone || "");
  const [email, setEmail] = useState(member.email || "");
  const [role, setRole] = useState(member.role);
  const [status, setStatus] = useState(member.status);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    onSave({
      ...member,
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      role,
      status,
    });
  };

  const trades: Trade[] = ["Project Manager", "Foreman", "Electrician", "Plumber", "Carpenter", "General Labor", "Tile Setter", "Concrete", "Drywall Installer", "Painter", "General"];

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
                  onChangeText={setPhone}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={placeholderTint}
                  keyboardType="phone-pad"
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
                <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Trade/Role</Text>
                <View style={styles.addMemberChipWrap}>
                  {trades.map((t) =>
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
            </LinearGradient>

            <View
              style={[
                styles.editMemberWebBottomActions,
                {
                  borderTopColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15, 23, 42, 0.12)",
                  backgroundColor: Colors.bg,
                  paddingBottom: Platform.OS === "ios" ? 24 : 16,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  Alert.alert(
                    "Remove Team Member",
                    `Are you sure you want to remove ${member.name} from the team?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: () => onDelete(member.id),
                      },
                    ]
                  );
                }}
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
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addMemberSaveGradient}
                >
                  <Text style={styles.addMemberSaveText}>✓ Save Changes</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
                onChangeText={setPhone}
                placeholder="(555) 123-4567"
                placeholderTextColor={placeholderTint}
                keyboardType="phone-pad"
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
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Trade/Role</Text>
              <View style={styles.addMemberChipWrap}>
                {trades.map((t) =>
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
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert(
                "Remove Team Member",
                `Are you sure you want to remove ${member.name} from the team?`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => onDelete(member.id),
                  },
                ]
              );
            }}
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
            <LinearGradient
              colors={["#22c55e", "#22d3ee"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addMemberSaveGradient}
            >
              <Text style={styles.addMemberSaveText}>✓ Save Changes</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

// ---------- Add Member Modal ----------
const AddMemberModal = ({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (m: Member) => void;
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
  const [role, setRole] = useState<Trade>("General Labor");
  const [status, setStatus] = useState<Status>("active");

  const handleAdd = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    const newMember: Member = {
      id: `member-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      role,
      status,
      tasksOpen: 0,
      tasksTotal: 0,
      skills: [],
      licenseVerified: false,
    };
    onAdd(newMember);
  };

  const trades: Trade[] = ["Project Manager", "Foreman", "Electrician", "Plumber", "Carpenter", "General Labor", "Tile Setter", "Concrete", "Drywall Installer", "Painter", "General"];

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
                <Text style={[styles.addMemberTitle, { color: Colors.text }]}>Add Team Member</Text>
                <Text style={[styles.addMemberSubtitle, { color: supportSub }]}>Add a new team member</Text>
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
                      onChangeText={setPhone}
                      placeholder="(555) 123-4567"
                      placeholderTextColor={placeholderTint}
                      keyboardType="phone-pad"
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
                    <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Trade/Role</Text>
                    <View style={styles.addMemberChipWrap}>
                      {trades.map((t) =>
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
            <Text style={[styles.addMemberTitle, { color: Colors.text }]}>Add Team Member</Text>
            <Text style={[styles.addMemberSubtitle, { color: supportSub }]}>Add a new team member</Text>
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
                onChangeText={setPhone}
                placeholder="(555) 123-4567"
                placeholderTextColor={placeholderTint}
                keyboardType="phone-pad"
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
              <Text style={[styles.addMemberLabel, { color: Colors.text }]}>Trade/Role</Text>
              <View style={styles.addMemberChipWrap}>
                {trades.map((t) =>
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
const TEAM_STORAGE_KEY = "bps.team.members";

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
  const [team, setTeam] = useState<Member[]>(TEAM);
  const [q, setQ] = useState("");
  const [tradeFilter, setTradeFilter] = useState<Trade | "All">("All");
  const [sortBy, setSortBy] = useState<"alpha" | "status">("status");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load team from storage (also when refreshTrigger changes, e.g. after AI updates status)
  useEffect(() => {
    const loadTeam = async () => {
      try {
        const saved = await AsyncStorage.getItem(TEAM_STORAGE_KEY);
        if (saved) setTeam(JSON.parse(saved));
      } catch (error) {
        console.error("Failed to load team:", error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTeam();
  }, [refreshTrigger]);

  // Merge PM and crew from ProjectDataContext into team list
  useEffect(() => {
    if (!projectData || !isLoaded) return;
    
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
            role: 'General Labor',
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
  }, [projectData?.team?.pmName, (projectData?.team as any)?.crewMembers, (projectData?.team as any)?.crewMemberPhones, isLoaded]);

  // Save team whenever it changes
  useEffect(() => {
    if (!isLoaded) return;
    const saveTeam = async () => {
      try {
        await AsyncStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(team));
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

  const stats = useMemo(() => {
    const active = team.filter((m) => m.status === "active").length;
    const offDuty = team.filter((m) => m.status === "off_duty").length;
    return { active, offDuty, total: team.length };
  }, [team]);

  const allTrades: Trade[] = [
    "Project Manager",
    "Foreman",
    "Electrician",
    "Plumber",
    "Carpenter",
    "General Labor",
    "Tile Setter",
    "Concrete",
    "Drywall Installer",
    "Painter",
    "General",
  ];
  const trades: (Trade | "All")[] = ["All", ...allTrades];

  const data = useMemo(() => {
    let arr = team.filter(
      (m) =>
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
      const order: Status[] = ["active", "off_duty"];
      arr = arr.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
    }
    return arr;
  }, [q, tradeFilter, sortBy, team]);

  const updateMember = (updated: Member) => {
    setTeam((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setEditingMember(null);
  };

  const addMember = (newMember: Member) => {
    setTeam((prev) => [...prev, newMember]);
    setShowAddModal(false);
  };

  const deleteMember = (id: string) => {
    const member = team.find((m) => m.id === id);
    Alert.alert("Remove Team Member", "Remove this team member?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setTeam((prev) => prev.filter((m) => m.id !== id));
          setEditingMember(null);
          // Sync deletion to ProjectDataContext so the AI gets updated team
          if (member && updateTeam) {
            const pmName = projectData?.team?.pmName;
            const crewMembers = (projectData?.team as any)?.crewMembers || [];
            const crewPhones = (projectData?.team as any)?.crewMemberPhones || {};
            const name = member.name?.trim() || "";
            const nameLower = name.toLowerCase();
            if (member.role === "Project Manager" && pmName && pmName.trim().toLowerCase() === nameLower) {
              // Remove PM
              const newCrew = (crewMembers as string[]).filter((n) => n.trim().toLowerCase() !== nameLower);
              updateTeam(false, "", newCrew.length, newCrew, crewPhones);
            } else if (id.startsWith("crew-") || (crewMembers as string[]).some((n) => n.trim().toLowerCase() === nameLower)) {
              // Remove from crew
              const newCrew = (crewMembers as string[]).filter((n) => n.trim().toLowerCase() !== nameLower);
              const newPhones = { ...crewPhones };
              delete newPhones[name];
              Object.keys(newPhones).forEach((k) => {
                if (k.trim().toLowerCase() === nameLower) delete newPhones[k];
              });
              updateTeam(Boolean(pmName), pmName || "", newCrew.length, newCrew, newPhones);
            }
          }
        },
      },
    ]);
  };

  const supportSub = darkMode ? 'rgba(226, 232, 240, 0.78)' : Colors.sub;
  const supportMuted = darkMode ? 'rgba(226, 232, 240, 0.62)' : Colors.sub;

  return (
    <View style={[styles.screen, embedded && styles.screenEmbedded, { backgroundColor: Colors.bg }]}>
      <View
        style={[
          styles.outerCard,
          styles.teamContainerWide,
          embedded && styles.teamContainerEmbedded,
          !darkMode && { backgroundColor: Colors.bg },
        ]}
      >
        {/* Outer green-to-blue border wrapping Team Details header, Team card, and Search card */}
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
                  <Text style={[styles.teamHeaderTitle, { color: Colors.text }]}>Team Details</Text>
                  <View style={styles.headerQuickActions}>
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
                  </View>
                </View>
                <Text style={[styles.teamHeaderSubtitle, { color: supportSub }]}>
                  Manage your team members and assignments
                </Text>
              </View>
            </View>

            {/* Team Stats Section */}
            <View style={[styles.sectionCardContainer, { marginTop: 12 }]}>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: Colors.surface2, borderWidth: darkMode ? 1 : 1, borderColor: Colors.line, borderRadius: 14 },
                ]}
              >
              <View style={[styles.sectionHeader, !darkMode && { borderBottomColor: Colors.line }]}>
                <MaterialIcons name='people' size={22} color='#22c55e' />
              <Text style={[styles.sectionTitle, { marginLeft: 12, color: Colors.text }]}>Team</Text>
              </View>
              <View
                style={[
                  styles.statsUnified,
                  {
                    backgroundColor: darkMode ? 'rgba(15, 23, 42, 0.42)' : Colors.surface2,
                    borderColor: darkMode ? 'rgba(148, 163, 184, 0.1)' : Colors.line,
                  },
                ]}
              >
                <View style={styles.statCell}>
                  <Text style={[styles.statVal, { color: '#22c55e' }]}>{stats.active}</Text>
                  <Text style={[styles.statLabel, { color: supportSub }]} numberOfLines={1}>
                    Active
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: darkMode ? 'rgba(148,163,184,0.08)' : Colors.line }]} />
                <View style={styles.statCell}>
                  <Text style={[styles.statVal, { color: '#ffd166' }]}>{stats.offDuty}</Text>
                  <Text style={[styles.statLabel, { color: supportSub }]} numberOfLines={1}>
                    Off Duty
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: darkMode ? 'rgba(148,163,184,0.08)' : Colors.line }]} />
                <View style={styles.statCell}>
                  <Text style={[styles.statVal, { color: '#22d3ee' }]}>{stats.total}</Text>
                  <Text style={[styles.statLabel, { color: supportSub }]} numberOfLines={1}>
                    Total
                  </Text>
                </View>
              </View>
            </View>
            </View>

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
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                style={[
                  styles.filterChip,
                  tradeFilter === "All" && styles.filterChipActive,
                  tradeFilter !== "All" && { backgroundColor: Colors.surface2, borderColor: Colors.line, borderWidth: 1 }
                ]}
              >
                <Text style={[styles.filterChipText, tradeFilter === "All" && styles.filterChipTextActive, tradeFilter !== "All" && { color: supportMuted }]}>
                  {tradeFilter === "All" ? "All Trades" : tradeFilter}
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

            {/* Trade Filter Pills - Horizontal Scrollable (only show when All is selected) */}
            {tradeFilter === "All" && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScrollContainer}
                contentContainerStyle={styles.filterScrollContent}
              >
                {trades.slice(1).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => {
                      setTradeFilter(t);
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
              <View style={[styles.sectionHeader, styles.teamMembersSectionHeader, !darkMode && { borderBottomColor: Colors.line }]}>
                <MaterialIcons name='list' size={22} color='#22c55e' />
                <Text style={[styles.sectionTitle, { marginLeft: 12, color: Colors.text }]}>Team Members</Text>
              </View>
              <View style={styles.teamMembersListPad}>
                {data.length > 0 ? (
                  data.map((item) => (
                    <MemberRowCompact
                      key={item.id}
                      m={item}
                      onEdit={setEditingMember}
                      onStatusToggle={handleStatusToggle}
                      supportSubColor={supportSub}
                    />
                  ))
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


      {/* Modals */}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={updateMember}
          onDelete={deleteMember}
        />
      )}

      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onAdd={addMember}
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
  /** Selected Trade/Role + Active status — solid brand green (not save-button gradient). */
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
