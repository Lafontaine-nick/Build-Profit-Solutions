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
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { getColors } from "@/theme/getColors";
import { useProjectData } from "@/contexts/ProjectDataContext";

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
}: {
  text: string;
  tone?: "outline" | "solid" | "warn";
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  
  return (
  <View
    style={[
      styles.chip,
        tone === "outline" && {
          backgroundColor: Colors.surface2,
          borderColor: Colors.line,
          borderWidth: darkMode ? 1 : 0,
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
          tone === "outline" && { color: Colors.sub },
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
        style={styles.pill}
      >
        <Text style={styles.pillText}>{statusLabel[s]}</Text>
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.pill, { backgroundColor: statusColor(s) }]}>
      <Text style={styles.pillText}>{statusLabel[s]}</Text>
    </View>
  );
};

// ---------- Member Row (iOS denser) ----------
const MemberRowCompact = ({
  m,
  onEdit,
  onStatusToggle,
}: {
  m: Member;
  onEdit: (m: Member) => void;
  onStatusToggle?: (m: Member) => void;
}) => {
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
  const d = daysUntil(m.licenseExpiryISO);
  const showWarn = m.licenseVerified && d !== undefined && d <= 30 && d >= 0;

  const skills = m.skills.slice(0, 2);
  const extra = Math.max(0, m.skills.length - skills.length);

  const handleStatusToggle = (e: any) => {
    e.stopPropagation();
    if (onStatusToggle) {
      onStatusToggle(m);
    }
  };

  return (
    <View style={styles.memberRowWrapper}>
      <TouchableOpacity
        onPress={() => onEdit(m)}
        activeOpacity={0.85}
      >
        <View style={[styles.memberRow, { backgroundColor: Colors.surface2, borderColor: Colors.line, borderWidth: darkMode ? 1 : 0, borderRadius: 14 }]}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={styles.initial}>
            <Text style={styles.initialText}>{initials(m.name)}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.memberTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, !darkMode && { color: "#000000" }]} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={styles.role} numberOfLines={1}>
                  {m.role}
                  {m.phone ? ` • ${m.phone}` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={handleStatusToggle} activeOpacity={0.7}>
                <StatusPill s={m.status} />
              </TouchableOpacity>
            </View>

            <View style={styles.memberMetaRow}>
              <Chip text={m.role} />
            </View>
          </View>

          {/* Small iOS-style icon actions */}
          <View style={styles.memberActionsCol}>
            <TouchableOpacity
              onPress={() => callNumber(m.phone)}
              style={styles.iconBtn}
              activeOpacity={0.8}
            >
              <MaterialIcons name="call" size={18} color="#22c55e" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => smsNumber(m.phone)}
              style={styles.iconBtn}
              activeOpacity={0.8}
            >
              <MaterialIcons name="chat-bubble" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => emailTo(m.email)}
              style={styles.iconBtn}
              activeOpacity={0.8}
            >
              <MaterialIcons name="mail" size={18} color="#22d3ee" />
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
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const Colors = useMemo(() => getColors(theme), [theme]);
  const darkMode = theme.bg === '#000000';
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

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.editModalContainer, { backgroundColor: Colors.bg }]}>
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
        
        {/* Header with Back Arrow */}
        <View style={[styles.editModalHeader, { borderBottomColor: Colors.line, borderBottomWidth: 1 }]}>
          <View style={styles.editModalBackBtnWrapper}>
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={styles.editModalBackBtnBorder}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={[styles.editModalBackBtn, { backgroundColor: Colors.bg }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : Colors.text} />
              </TouchableOpacity>
            </LinearGradient>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.editModalTitle, { color: Colors.text }]}>Edit Team Member</Text>
            <Text style={[styles.editModalSubtitle, { color: Colors.sub }]}>{member.name}</Text>
          </View>
        </View>

        {/* Form Content */}
        <View style={styles.editModalContent}>
          <ScrollView
            style={styles.editModalScrollView}
            contentContainerStyle={styles.editModalScrollContent}
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.editFormSection}>
            <Text style={[styles.editFormLabel, { color: Colors.text }]}>Name</Text>
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
              }}
                value={name}
                onChangeText={setName}
                placeholder="Full Name"
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
              />
          </View>

          <View style={styles.editFormSection}>
            <Text style={[styles.editFormLabel, { color: Colors.text }]}>Phone</Text>
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
              }}
                value={phone}
                onChangeText={setPhone}
                placeholder="(555) 123-4567"
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                keyboardType="phone-pad"
              />
          </View>

          <View style={styles.editFormSection}>
            <Text style={[styles.editFormLabel, { color: Colors.text }]}>Email</Text>
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
              }}
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.4)" : Colors.sub}
                keyboardType="email-address"
                autoCapitalize="none"
              />
          </View>

          <View style={styles.editFormSection}>
            <Text style={[styles.editFormLabel, { color: Colors.text }]}>Trade/Role</Text>
            <View style={styles.editFormChips}>
              {(["Project Manager", "Foreman", "Electrician", "Plumber", "Carpenter", "General Labor", "Tile Setter", "Concrete", "Drywall Installer", "Painter", "General"] as Trade[]).map(t => (
                <View key={t} style={styles.editFormChipWrapper}>
                  {role === t ? (
                    <TouchableOpacity
                      onPress={() => {
                        setRole(t);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={styles.editFormChipActive}
                    >
                      <Text style={styles.editFormChipTextActive}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                      <TouchableOpacity
                        onPress={() => {
                          setRole(t);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 12,
                        backgroundColor: Colors.surface2,
                        borderWidth: 1,
                        borderColor: Colors.line,
                      }}
                      >
                      <Text style={{ color: Colors.sub, fontWeight: "600", fontSize: 13 }}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.editFormSection}>
            <Text style={[styles.editFormLabel, { color: Colors.text }]}>Status</Text>
            <View style={styles.editFormChips}>
              {(["active", "off_duty"] as Status[]).map(s => (
                <View key={s} style={styles.editFormChipWrapper}>
                  {status === s ? (
                    <TouchableOpacity
                      onPress={() => {
                        setStatus(s);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      style={styles.editFormChipActiveWrapper}
                    >
                      <LinearGradient
                        colors={s === "active" ? ["#22c55e", "#22d3ee"] : [statusColor(s), statusColor(s)]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.editFormChipActiveGradient}
                      >
                        <Text style={styles.editFormChipTextActive}>
                          {statusLabel[s]}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                      <TouchableOpacity
                        onPress={() => {
                          setStatus(s);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 12,
                        backgroundColor: Colors.surface2,
                        borderWidth: 1,
                        borderColor: Colors.line,
                      }}
                      >
                      <Text style={{ color: Colors.sub, fontWeight: "600", fontSize: 13 }}>
                          {statusLabel[s]}
                        </Text>
                      </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>

          </ScrollView>
        </View>

        {/* Action Buttons - Fixed at Bottom */}
        <View
          style={[
            styles.editFormActions,
            {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Platform.OS === "ios" ? 34 : 20,
              flexDirection: "row",
              gap: 10,
              borderTopWidth: 1,
              borderTopColor: Colors.line,
              backgroundColor: Colors.bg,
              shadowOpacity: 0,
              shadowRadius: 0,
              shadowOffset: { width: 0, height: 0 },
              elevation: 0,
            },
          ]}
        >
          {/* Remove Button */}
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
              styles.editFormDeleteBtn,
              {
                backgroundColor: darkMode ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.1)",
                borderColor: "#ef4444",
                borderWidth: 1,
              },
            ]}
          >
            <Text
              style={[styles.editFormDeleteBtnText, { color: "#ef4444" }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Remove from Team
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            style={styles.editFormSaveBtn}
          >
            <LinearGradient
              colors={["#22c55e", "#22d3ee"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.editFormSaveBtnGradient}
            >
              <Text style={styles.editFormSaveBtnText}>✓ Save Changes</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        <StatusBar barStyle="light-content" />
        {/* Header with Back Arrow */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 8 : 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.line }}>
          <View style={{ marginRight: 12 }}>
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={{ borderRadius: 22, padding: 1, overflow: "hidden" }}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={{ width: 44, height: 44, borderRadius: 21, backgroundColor: Colors.bg, justifyContent: "center", alignItems: "center" }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#000000"} />
              </TouchableOpacity>
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.4, lineHeight: 34 }}>Add Team Member</Text>
            <Text style={{ color: Colors.sub, fontSize: 14, marginTop: 2, fontWeight: "500" }}>Add a new team member</Text>
          </View>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: "600", marginBottom: 10, letterSpacing: 0.2 }}>Name *</Text>
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
                }}
                value={name}
                onChangeText={setName}
                placeholder="Full Name"
                placeholderTextColor={Colors.sub}
                autoFocus
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: "600", marginBottom: 10, letterSpacing: 0.2 }}>Phone</Text>
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
                }}
                value={phone}
                onChangeText={setPhone}
                placeholder="(555) 123-4567"
                placeholderTextColor={Colors.sub}
                keyboardType="phone-pad"
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: "600", marginBottom: 10, letterSpacing: 0.2 }}>Email</Text>
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
                }}
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                placeholderTextColor={Colors.sub}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: Colors.text, fontSize: 14, fontWeight: "600", marginBottom: 10, letterSpacing: 0.2 }}>Trade/Role</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {trades.map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => {
                      setRole(t);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                      backgroundColor: role === t ? "#22c55e" : Colors.surface2,
                      borderWidth: 1,
                      borderColor: role === t ? "#22c55e" : Colors.line,
                    }}
                  >
                    <Text style={{ color: role === t ? "#020617" : Colors.sub, fontWeight: role === t ? "800" : "600", fontSize: 13 }}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 34 : 20, flexDirection: "row", gap: 10, borderTopWidth: 1, borderTopColor: Colors.line, backgroundColor: Colors.bg }}>
          <TouchableOpacity 
            onPress={onClose} 
            style={{ 
              flex: 1,
              backgroundColor: darkMode ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.1)",
              borderColor: "#ef4444",
              borderWidth: 1,
              paddingVertical: 14, 
              borderRadius: 12, 
              alignItems: "center" 
            }}
          >
            <Text style={{ color: "#ef4444", fontSize: 15, fontWeight: "600" }}>Cancel</Text>
          </TouchableOpacity>
          {darkMode ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleAdd();
              }}
              style={{ flex: 1, borderRadius: 12, overflow: "hidden", ...Platform.select({
                ios: {
                  shadowColor: '#22c55e',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                },
                android: {
                  elevation: 6,
                },
              }) }}
            >
              <LinearGradient
                colors={["rgba(34, 197, 94, 0.9)", "rgba(34, 211, 238, 0.9)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1, borderRadius: 12, padding: 1 }}
              >
                <LinearGradient
                  colors={["#22c55e", "#22d3ee"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ paddingVertical: 14, borderRadius: 11, alignItems: "center" }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 }}>✓ Save</Text>
                </LinearGradient>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleAdd();
              }} 
              style={{ flex: 1, borderRadius: 12, overflow: "hidden", ...Platform.select({
                ios: {
                  shadowColor: '#22c55e',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                },
                android: {
                  elevation: 6,
                },
              }) }}
            >
              <LinearGradient
                colors={["#22c55e", "#22d3ee"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingVertical: 14, alignItems: "center" }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 }}>✓ Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
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
        <StatusBar barStyle="light-content" />
        {/* Header with Back Arrow */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 8 : 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.line }}>
          <View style={{ marginRight: 12 }}>
            <LinearGradient
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
              start={{ x: 0.05, y: 0.15 }}
              end={{ x: 0.95, y: 0.85 }}
              style={{ borderRadius: 22, padding: 1, overflow: "hidden" }}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={{ width: 44, height: 44, borderRadius: 21, backgroundColor: Colors.bg, justifyContent: "center", alignItems: "center" }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="arrow-back" size={24} color={darkMode ? "#FFFFFF" : "#000000"} />
              </TouchableOpacity>
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
              colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
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
      </SafeAreaView>
    </Modal>
  );
};

// ---------- Screen ----------
const TEAM_STORAGE_KEY = "bps.team.members";

export default function TeamTab({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
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
            trade: 'Project Manager',
            status: 'active',
            phone: '',
            email: '',
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
            trade: 'General Labor',
            status: 'active',
            phone,
            email: '',
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

  // Header actions (iOS style)
  const activeCount = data.filter((m) => m.status === "active").length;

  return (
    <View style={[styles.screen, { backgroundColor: Colors.bg }]}>
      <View style={[styles.outerCard, styles.teamContainerWide, !darkMode && { backgroundColor: Colors.bg }]}>
        {/* Outer green-to-blue border wrapping Team Details header, Team card, and Search card */}
        <LinearGradient
          colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
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
                  <View style={{ flexDirection: "row", gap: 8, marginLeft: 12 }}>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowNotifyModal(true);
                      }}
                      activeOpacity={0.85}
                      style={[
                        styles.headerIconBtn,
                        { borderColor: "#22c55e", borderWidth: 1, backgroundColor: darkMode ? "#000000" : Colors.bg },
                      ]}
                    >
                      <MaterialIcons name="campaign" size={20} color="#22c55e" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowAddModal(true);
                      }}
                      activeOpacity={0.85}
                      style={[
                        styles.headerIconBtn,
                        { borderColor: "#22c55e", borderWidth: 1, backgroundColor: darkMode ? "#000000" : Colors.bg },
                      ]}
                    >
                      <MaterialIcons name="person-add" size={20} color="#22c55e" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.teamHeaderSubtitle, { color: Colors.sub }]}>
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
              <View style={styles.statsContent}>
                <View style={styles.statsRow}>
                  <View style={styles.statBoxWrapper}>
                  <View
                    style={[
                      styles.statBoxBorder,
                      {
                        backgroundColor: Colors.surface2,
                        borderColor: Colors.line,
                        borderWidth: 1,
                        borderRadius: 12,
                      },
                    ]}
                  >
                    <View style={[styles.statBox, { backgroundColor: 'transparent' }]}>
                        <Text style={[styles.statVal, { color: "#22c55e" }]}>{stats.active}</Text>
                      <Text style={[styles.statLabel, { color: Colors.text }]} numberOfLines={1}>Active</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.statBoxWrapper}>
                  <View
                    style={[
                      styles.statBoxBorder,
                      {
                        backgroundColor: Colors.surface2,
                        borderColor: Colors.line,
                        borderWidth: 1,
                        borderRadius: 12,
                      },
                    ]}
                  >
                    <View style={[styles.statBox, { backgroundColor: 'transparent' }]}>
                      <Text style={[styles.statVal, { color: "#ffd166" }]}>{stats.offDuty}</Text>
                      <Text style={[styles.statLabel, { color: Colors.text }]} numberOfLines={1}>Off Duty</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.statBoxWrapper}>
                  <View
                    style={[
                      styles.statBoxBorder,
                      {
                        backgroundColor: Colors.surface2,
                        borderColor: Colors.line,
                        borderWidth: 1,
                        borderRadius: 12,
                      },
                    ]}
                  >
                    <View style={[styles.statBox, { backgroundColor: 'transparent' }]}>
                        <Text style={[styles.statVal, { color: "#22d3ee" }]}>{stats.total}</Text>
                      <Text style={[styles.statLabel, { color: Colors.text }]} numberOfLines={1}>Total</Text>
                      </View>
                    </View>
                  </View>
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
                  backgroundColor: Colors.surface2,
                  borderColor: Colors.line,
                  borderWidth: 1,
                },
              ]}
            >
              <MaterialIcons name="search" size={18} color={Colors.sub} style={styles.searchIcon} />
              <TextInput
                style={[styles.search, { color: Colors.text }]}
                placeholder="Search by name, role, or skill..."
                placeholderTextColor={Colors.sub}
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
                  <MaterialIcons name="close" size={16} color={Colors.sub} />
                </TouchableOpacity>
              )}
            </View>

            {/* Sort Pills */}
            <View style={styles.sortSection}>
              <Text style={[styles.sectionLabel, { color: Colors.sub }]}>Sort</Text>
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
                      <View style={[styles.sortPill, { backgroundColor: Colors.surface2, borderColor: Colors.line, borderWidth: 1 }]}>
                        <Text style={[styles.sortPillText, { color: Colors.sub }]}>
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
              <Text style={[styles.sectionLabel, { color: Colors.sub }]}>Filter</Text>
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
                <Text style={[styles.filterChipText, tradeFilter === "All" && styles.filterChipTextActive, tradeFilter !== "All" && { color: Colors.sub }]}>
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
                    <MaterialIcons name="close" size={14} color={tradeFilter === "All" ? "#0d1b2a" : Colors.sub} />
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
                    <Text style={[styles.filterPillText, { color: Colors.sub }]}>{t}</Text>
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
            colors={["rgba(45, 255, 196, 0.8)", "rgba(0, 166, 255, 0.8)"]}
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
              <View style={[styles.sectionHeader, !darkMode && { borderBottomColor: Colors.line }]}>
                <MaterialIcons name='list' size={22} color='#22c55e' />
                <Text style={[styles.sectionTitle, { marginLeft: 12, color: Colors.text }]}>Team Members</Text>
              </View>
              <View style={{ paddingBottom: 16 }}>
                {data.length > 0 ? (
                  data.map((item) => (
                    <MemberRowCompact key={item.id} m={item} onEdit={setEditingMember} onStatusToggle={handleStatusToggle} />
                  ))
                ) : (
                  <View style={{ alignItems: "center", padding: 40 }}>
                    <Text style={{ color: Colors.sub, fontSize: 16 }}>No team members found</Text>
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
  outerCard: {
    backgroundColor: "#000000",
    borderRadius: 28,
    marginBottom: 16,
  },
  teamContainerWide: {
    marginHorizontal: 0, // Container already extends with -20, so 0 here extends to edges
    paddingHorizontal: 4, // Match dashboard wideContainer pattern
    paddingVertical: 18,
    paddingBottom: 18,
  },
  overviewBorder: {
    borderRadius: 20,
    padding: 1,
    marginBottom: 16,
  },
  overviewInner: {
    borderRadius: 18,
    padding: 12,
  },
  teamHeaderRow: {
    marginBottom: 14,
  },
  teamHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  teamHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.15,
    color: "#F9FAFB",
    flex: 1,
  },
  teamHeaderSubtitle: {
    fontSize: 14,
    marginTop: 4,
    color: "#8DA0B8",
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.3)",
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
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.15,
  },

  // Stats
  statsContent: {},
  statsRow: { flexDirection: "row", gap: 10 },
  statBoxWrapper: {
    flex: 1,
  },
  statBoxBorder: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  statBox: {
    borderRadius: 15,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#000000",
  },
  statVal: { fontSize: 22, fontWeight: "900" },
  statLabel: { color: Colors.sub, fontSize: 12, marginTop: 4, textAlign: "center" },

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
    padding: 12,
  },

  // Search - iOS Style
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000000",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    marginBottom: 16,
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
    marginBottom: 16,
  },
  sectionLabel: {
    color: Colors.sub,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.1,
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
    marginBottom: 12,
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
    marginTop: 8,
    marginBottom: 0,
  },
  filterScrollContent: {
    paddingRight: 16,
    gap: 8,
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
    padding: 12,
    paddingTop: 16,
  },
  memberRowWrapper: {
    marginBottom: 10,
  },
  memberRowBorder: {
    borderRadius: 18,
    padding: 1,
    overflow: "hidden",
  },
  memberRow: {
    backgroundColor: "#000000",
    borderRadius: 17,
    padding: 14,
    width: "100%",
    alignSelf: "stretch",
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

  memberTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { color: Colors.text, fontSize: 16, fontWeight: "900" },
  role: { color: Colors.sub, fontSize: 13, marginTop: 2 },

  memberMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },

  memberActionsCol: { gap: 10, alignItems: "center", justifyContent: "center" },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },

  // Pills & Chips
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: "900", color: "#0d1b2a" },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "#000000",
    maxWidth: 150,
  },
  chipText: { color: Colors.sub, fontSize: 11, fontWeight: "700" },

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

  // Edit Modal - Full Page
  editModalContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  editModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 8 : 16,
    paddingBottom: 16,
  },
  editModalBackBtnWrapper: {
    marginRight: 12,
  },
  editModalBackBtnBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
  },
  editModalBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 19,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  editModalTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  editModalSubtitle: {
    color: "#8DA0B8",
    fontSize: 14,
    marginTop: 4,
  },
  editModalContent: {
    flex: 1,
  },
  editModalScrollView: {
    flex: 1,
  },
  editModalScrollContent: {
    padding: 20,
    paddingBottom: 200,
  },
  editFormSection: {
    marginBottom: 20,
  },
  editFormLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  editFormInputBorder: {
    borderRadius: 20,
    padding: 1,
  },
  editFormInput: {
    backgroundColor: "#000000",
    color: Colors.text,
    fontSize: 15,
    padding: 14,
    borderRadius: 18,
    fontWeight: "500",
  },
  editFormChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  editFormChipWrapper: {
    marginBottom: 0,
  },
  editFormChipBorder: {
    borderRadius: 16,
    padding: 1,
    overflow: "hidden",
  },
  editFormChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: "#000000",
  },
  editFormChipActiveWrapper: {
    borderRadius: 16,
    overflow: "hidden",
  },
  editFormChipActiveGradient: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  editFormChipActive: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: Colors.green,
    borderWidth: 0,
  },
  editFormChipText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  editFormChipTextActive: {
    color: "#0d1b2a",
    fontSize: 14,
    fontWeight: "800",
  },
  editFormActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#000000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  editFormSaveBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  editFormSaveBtnGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  editFormSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  editFormDeleteBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 11,
  },
  editFormDeleteBorder: {
    flex: 1,
    borderRadius: 12,
    padding: 1,
  },
  editFormDeleteBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
